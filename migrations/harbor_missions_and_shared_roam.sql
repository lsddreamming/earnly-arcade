create schema if not exists harbor_private;
revoke all on schema harbor_private from public,anon,authenticated;
create table harbor_private.missions(id integer primary key, definition jsonb not null, reward integer not null);
create table harbor_private.runs(user_id uuid primary key, mission integer not null, token uuid not null default gen_random_uuid(), stage integer not null default 0, started timestamptz not null default clock_timestamp(), updated timestamptz not null default clock_timestamp(), x double precision not null default 12,z double precision not null default 43);
create table harbor_private.claims(user_id uuid not null,mission integer not null, primary key(user_id,mission));
create table harbor_private.peers(user_id uuid primary key,x double precision not null,z double precision not null,angle double precision not null,driving boolean not null,seen timestamptz not null);
alter table harbor_private.missions enable row level security;
alter table harbor_private.runs enable row level security;
alter table harbor_private.claims enable row level security;
alter table harbor_private.peers enable row level security;
create function public.harbor_live(p_x double precision,p_z double precision,p_angle double precision,p_driving boolean default false,p_leave boolean default false) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); last_seen timestamptz; result jsonb;
begin
if u is null then raise exception 'Sign in required'; end if;
if p_leave then delete from harbor_private.peers where user_id=u; return '[]'::jsonb; end if;
if p_x is null or p_z is null or p_angle is null or not(p_x between 0 and 340 and p_z between 0 and 340 and p_angle between -100 and 100) then raise exception 'Invalid position'; end if;
select seen into last_seen from harbor_private.peers where user_id=u;
if last_seen>clock_timestamp()-interval '350 milliseconds' then raise exception 'Update too fast'; end if;
insert into harbor_private.peers values(u,p_x,p_z,p_angle,coalesce(p_driving,false),clock_timestamp()) on conflict(user_id) do update set x=excluded.x,z=excluded.z,angle=excluded.angle,driving=excluded.driving,seen=excluded.seen;
select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'x',x,'z',z,'angle',angle,'driving',driving)),'[]') into result from (select * from harbor_private.peers where user_id<>u and seen>clock_timestamp()-interval '8 seconds' order by seen desc limit 15) p;
return result;
end $$;
create function public.harbor_mission(p_action text,p_mission integer default 0,p_token uuid default null,p_stage integer default 0,p_x double precision default 12,p_z double precision default 43) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r harbor_private.runs; m harbor_private.missions; objective jsonb; duration double precision; amount integer; credited record;
begin
if u is null then raise exception 'Sign in required'; end if;
perform pg_advisory_xact_lock(hashtextextended(u::text,45));
if p_action='start' then
select * into m from harbor_private.missions where id=p_mission;
if not found then raise exception 'Unknown mission'; end if;
insert into harbor_private.runs(user_id,mission) values(u,p_mission) on conflict(user_id) do update set mission=excluded.mission,token=gen_random_uuid(),stage=0,started=clock_timestamp(),updated=clock_timestamp(),x=12,z=43 returning * into r;
return jsonb_build_object('token',r.token,'reward',m.reward);
end if;
select * into r from harbor_private.runs where user_id=u for update;
if not found or r.token<>p_token or p_token is null then raise exception 'Mission session expired'; end if;
select * into m from harbor_private.missions where id=r.mission;
if clock_timestamp()-r.started>interval '45 minutes' then raise exception 'Mission session expired'; end if;
if p_action='stage' then
if p_stage<=r.stage then return jsonb_build_object('stage',r.stage); end if;
if p_stage<>r.stage+1 or p_stage>jsonb_array_length(m.definition->'stages') then raise exception 'Invalid stage order'; end if;
objective=m.definition->'stages'->r.stage;
duration=extract(epoch from clock_timestamp()-r.updated);
if duration<0.25 then raise exception 'Stage too fast'; end if;
if p_x is null or p_z is null or not(p_x between 0 and 340 and p_z between 0 and 340) then raise exception 'Invalid position'; end if;
if sqrt(power(p_x-r.x,2)+power(p_z-r.z,2))>duration*28+25 then raise exception 'Travel too fast'; end if;
if objective->>'kind'<>'escape' and sqrt(power(p_x-(objective->>'x')::float,2)+power(p_z-(objective->>'z')::float,2))>(case when objective->>'kind'='shoot' then 23 else 6 end) then raise exception 'Objective not reached'; end if;
update harbor_private.runs set stage=p_stage,updated=clock_timestamp(),x=p_x,z=p_z where user_id=u;
return jsonb_build_object('stage',p_stage);
end if;
if p_action<>'claim' or r.stage<>jsonb_array_length(m.definition->'stages') then raise exception 'Finish all objectives first'; end if;
insert into harbor_private.claims values(u,r.mission) on conflict do nothing;
if not found then return jsonb_build_object('amount',0,'alreadyClaimed',true); end if;
amount=m.reward;
select * into credited from public.apply_coin_ledger_event(u,'harbor:mission:v1:'||r.mission,'game','Harbor: '||(m.definition->>'name'),'harborGetaway',r.mission,0,amount);
return jsonb_build_object('amount',amount,'balance',credited.balance);
end $$;
revoke all on function public.harbor_live(double precision,double precision,double precision,boolean,boolean) from public,anon;
revoke all on function public.harbor_mission(text,integer,uuid,integer,double precision,double precision) from public,anon;
grant execute on function public.harbor_live(double precision,double precision,double precision,boolean,boolean) to authenticated;
grant execute on function public.harbor_mission(text,integer,uuid,integer,double precision,double precision) to authenticated;

insert into harbor_private.missions values (0,'{"name": "Coastal Run", "time": 120, "heat": 1, "model": "coupe", "stages": [{"kind": "drive", "x": 12, "z": 12, "label": "Pass the west checkpoint"}, {"kind": "drive", "x": 68, "z": 12, "label": "Cross the waterfront"}, {"kind": "escape", "label": "Break patrol line of sight"}, {"kind": "park", "x": 96, "z": 91, "label": "Park at the garage"}], "tagline": "First getaway", "briefing": "Take the coupe along the waterfront, lose the patrol, then bring it home.", "tip": "Keep moving through both checkpoints before trying to lose the patrol."}'::jsonb,25);
insert into harbor_private.missions values (1,'{"name": "Dock Dispatch", "time": 300, "heat": 0, "model": "van", "stages": [{"kind": "park", "x": 40, "z": 68, "label": "Collect the manifest"}, {"kind": "park", "x": 152, "z": 152, "label": "Deliver to Central City"}], "tagline": "Manifest delivery", "briefing": "Collect a shipping manifest and deliver it across town without a scheduled chase.", "tip": "Brake before each delivery marker; passing through at speed does not count."}'::jsonb,40);
insert into harbor_private.missions values (2,'{"name": "Signal Check", "time": 130, "heat": 1, "model": "coupe", "stages": [{"kind": "shoot", "x": 12, "z": 28, "label": "Shoot the first signal target"}, {"kind": "shoot", "x": 12, "z": 19, "label": "Shoot the second signal target"}, {"kind": "escape", "label": "Break patrol line of sight"}, {"kind": "park", "x": 96, "z": 91, "label": "Park at the garage"}], "tagline": "Signal training", "briefing": "Find two roadside signal targets, fire on foot, then escape in your coupe.", "tip": "Exit the car and face each target before firing."}'::jsonb,30);
insert into harbor_private.missions values (3,'{"name": "Industrial Mile", "time": 300, "heat": 2, "model": "muscle", "stages": [{"kind": "drive", "x": 96, "z": 96, "label": "Cross the depot"}, {"kind": "drive", "x": 208, "z": 96, "label": "Take the eastern boulevard"}, {"kind": "drive", "x": 208, "z": 264, "label": "Reach South Industrial"}, {"kind": "escape", "label": "Break patrol line of sight"}, {"kind": "park", "x": 292, "z": 264, "label": "Park at the industrial drop-off"}], "tagline": "Industrial pursuit", "briefing": "Drive the muscle car from the depot to South Industrial while police close in.", "tip": "Use the long boulevards for speed and side streets to break sight."}'::jsonb,75);
insert into harbor_private.missions values (4,'{"name": "Parts Run", "time": 300, "heat": 0, "model": "van", "stages": [{"kind": "park", "x": 40, "z": 12, "label": "Collect spare parts"}, {"kind": "park", "x": 152, "z": 68, "label": "Deliver to the central workshop"}, {"kind": "park", "x": 292, "z": 152, "label": "Deliver to East Docks"}], "tagline": "Workshop courier", "briefing": "Collect parts, visit the central workshop, then deliver to East Docks.", "tip": "Plan for three separate stops and slow down early in the van."}'::jsonb,55);
insert into harbor_private.missions values (5,'{"name": "Under the Tracks", "time": 300, "heat": 2, "model": "muscle", "stages": [{"kind": "drive", "x": 12, "z": 152, "label": "Follow West Rail"}, {"kind": "drive", "x": 12, "z": 292, "label": "Reach the south rail yard"}, {"kind": "drive", "x": 152, "z": 292, "label": "Cross the southern district"}, {"kind": "escape", "label": "Break patrol line of sight"}, {"kind": "park", "x": 208, "z": 292, "label": "Park at the south depot"}], "tagline": "Rail corridor escape", "briefing": "Follow West Rail south, cross the district, then hide before the depot handoff.", "tip": "Stay on the west corridor until the route sends you east."}'::jsonb,80);
insert into harbor_private.missions values (6,'{"name": "Cut the Feed", "time": 170, "heat": 2, "model": "coupe", "stages": [{"kind": "shoot", "x": 12, "z": 28, "label": "Take out the first relay"}, {"kind": "drive", "x": 40, "z": 40, "label": "Reach the second relay"}, {"kind": "shoot", "x": 40, "z": 30, "label": "Take out the depot relay"}, {"kind": "escape", "label": "Break patrol line of sight"}, {"kind": "park", "x": 96, "z": 91, "label": "Park at the garage"}], "tagline": "Relay shutdown", "briefing": "Disable the west relay, drive to the depot relay, and shut it down before escaping.", "tip": "This job alternates on-foot shooting and driving; watch the next objective."}'::jsonb,60);
insert into harbor_private.missions values (7,'{"name": "Breakwater Express", "time": 300, "heat": 2, "model": "muscle", "stages": [{"kind": "drive", "x": 12, "z": 12, "label": "Join the waterfront road"}, {"kind": "drive", "x": 320, "z": 12, "label": "Cross the northern waterfront"}, {"kind": "drive", "x": 320, "z": 208, "label": "Follow East Docks"}, {"kind": "escape", "label": "Break patrol line of sight"}, {"kind": "park", "x": 292, "z": 236, "label": "Park at the dock handoff"}], "tagline": "Waterfront express", "briefing": "Cross the northern waterfront and follow the eastern shore to a dock handoff.", "tip": "The long straight is fast, but brake before the turn down East Docks."}'::jsonb,85);
insert into harbor_private.missions values (8,'{"name": "Heavy Haul", "time": 300, "heat": 2, "model": "van", "stages": [{"kind": "park", "x": 68, "z": 68, "label": "Load the first crate"}, {"kind": "park", "x": 180, "z": 152, "label": "Load central cargo"}, {"kind": "drive", "x": 292, "z": 152, "label": "Take the eastern boulevard"}, {"kind": "escape", "label": "Break patrol line of sight"}, {"kind": "park", "x": 292, "z": 292, "label": "Unload in South Industrial"}], "tagline": "Cargo under pressure", "briefing": "Load two shipments and take the cargo van to the southeast industrial depot.", "tip": "The loaded van turns slowly; choose wider streets during the chase."}'::jsonb,90);
insert into harbor_private.missions values (9,'{"name": "Three Alarms", "time": 300, "heat": 3, "model": "muscle", "stages": [{"kind": "shoot", "x": 12, "z": 28, "label": "Disable the west alarm"}, {"kind": "drive", "x": 152, "z": 152, "label": "Reach Central City"}, {"kind": "shoot", "x": 152, "z": 142, "label": "Disable the central alarm"}, {"kind": "drive", "x": 292, "z": 264, "label": "Reach the southern relay"}, {"kind": "shoot", "x": 292, "z": 254, "label": "Disable the southern alarm"}, {"kind": "escape", "label": "Break patrol line of sight"}, {"kind": "park", "x": 320, "z": 292, "label": "Park at the east safehouse"}], "tagline": "Three-district shutdown", "briefing": "Disable alarms in the west, center, and south, then reach the eastern safehouse.", "tip": "Stop near each alarm, exit, and shoot before continuing across town."}'::jsonb,120);
insert into harbor_private.missions values (10,'{"name": "Harbor Lockdown", "time": 300, "heat": 3, "model": "muscle", "stages": [{"kind": "drive", "x": 12, "z": 292, "label": "Reach the southwest corner"}, {"kind": "drive", "x": 292, "z": 292, "label": "Cross the southern district"}, {"kind": "drive", "x": 292, "z": 40, "label": "Head north through East Docks"}, {"kind": "escape", "label": "Break patrol line of sight"}, {"kind": "park", "x": 152, "z": 40, "label": "Park at the northern safehouse"}], "tagline": "Citywide lockdown", "briefing": "Cross the southwest and southern districts, drive north through East Docks, and disappear.", "tip": "Three-star patrols require distance and cover; a straight sprint may not lose them."}'::jsonb,125);
insert into harbor_private.missions values (11,'{"name": "The Last Crossing", "time": 360, "heat": 3, "model": "coupe", "stages": [{"kind": "park", "x": 40, "z": 40, "label": "Collect the final cargo"}, {"kind": "drive", "x": 320, "z": 40, "label": "Cross the northern district"}, {"kind": "drive", "x": 320, "z": 320, "label": "Follow the eastern shoreline"}, {"kind": "drive", "x": 40, "z": 320, "label": "Cross the southern harbor"}, {"kind": "escape", "label": "Break patrol line of sight"}, {"kind": "park", "x": 96, "z": 91, "label": "Park at the garage"}], "tagline": "Final harbor circuit", "briefing": "Collect the final cargo and complete a north-east-south circuit before returning to the garage.", "tip": "Save time on the long crossings, then lose the patrol before the final stop."}'::jsonb,150);