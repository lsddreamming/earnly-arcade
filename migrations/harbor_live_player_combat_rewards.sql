alter table harbor_private.peers add column health integer not null default 100, add column life uuid not null default gen_random_uuid(), add column dead_until timestamptz, add column shield_until timestamptz not null default clock_timestamp()+interval '5 seconds', add column shot_at timestamptz not null default '-infinity', add column guns integer[] not null default array[0];
create table harbor_private.defeats(life uuid primary key,winner uuid not null,victim uuid not null,created timestamptz not null default clock_timestamp());
alter table harbor_private.defeats enable row level security;
create function harbor_private.clear_shot(ax float,az float,bx float,bz float) returns boolean language plpgsql immutable set search_path=pg_catalog as $$
declare n integer:=ceil(sqrt(power(bx-ax,2)+power(bz-az,2))*5); i integer; px float; pz float; r integer; c integer; x float; z float;
begin
for i in 1..greatest(1,n) loop
px:=ax+(bx-ax)*i/greatest(1,n); pz:=az+(bz-az)*i/greatest(1,n); c:=floor((px-12)/28);r:=floor((pz-12)/28);
if c between 0 and 10 and r between 0 and 10 and not((r>=3 or c>=3) and mod(r*7+c*3,8)=0) then
x:=12+c*28;z:=12+r*28;
if (px>x+9 and px<x+20 and pz>z+7 and pz<z+13) or (px>x+7 and px<x+20 and pz>z+17 and pz<z+22) then return false;end if;
end if;end loop;return true;end $$;
create or replace function public.harbor_live(p_x double precision,p_z double precision,p_angle double precision,p_driving boolean default false,p_leave boolean default false) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); r harbor_private.peers; result jsonb; respawn boolean:=false; now_at timestamptz:=clock_timestamp();
begin
if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required'; end if;
perform pg_advisory_xact_lock(7451029);
if p_leave then update harbor_private.peers set seen='-infinity' where user_id=u; return '{}'::jsonb; end if;
if p_x is null or p_z is null or p_angle is null or not(p_x between 0 and 340 and p_z between 0 and 340 and p_angle between -100 and 100) then raise exception 'Invalid position'; end if;
select * into r from harbor_private.peers where user_id=u;
if not found then
insert into harbor_private.peers(user_id,x,z,angle,driving,seen) values(u,p_x,p_z,p_angle,coalesce(p_driving,false),now_at) returning * into r;
else
if r.seen>now_at-interval '350 milliseconds' then raise exception 'Update too fast';end if;
if r.health=0 then
if r.dead_until<=now_at then
update harbor_private.peers set health=100,life=gen_random_uuid(),dead_until=null,shield_until=now_at+interval '5 seconds',x=12,z=43,driving=false where user_id=u;respawn:=true;
end if;
elsif r.seen>now_at-interval '8 seconds' then
if sqrt(power(p_x-r.x,2)+power(p_z-r.z,2)) <= extract(epoch from now_at-r.seen)*30+4 then
update harbor_private.peers set x=p_x,z=p_z,angle=p_angle,driving=coalesce(p_driving,false) where user_id=u;
end if;
else
update harbor_private.peers set x=p_x,z=p_z,angle=p_angle,driving=coalesce(p_driving,false),shield_until=now_at+interval '5 seconds' where user_id=u;
end if;
update harbor_private.peers set seen=now_at where user_id=u returning * into r;
end if;
if r.health>0 then
if least(sqrt(power(r.x-17,2)+power(r.z-40,2)),sqrt(power(r.x-292,2)+power(r.z-264,2)))<3 and not(1=any(r.guns)) then update harbor_private.peers set guns=array_append(guns,1) where user_id=u;end if;
if least(sqrt(power(r.x-40,2)+power(r.z-60,2)),sqrt(power(r.x-152,2)+power(r.z-180,2)))<3 and not(2=any(r.guns)) then update harbor_private.peers set guns=array_append(guns,2) where user_id=u;end if;
end if;
select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'x',x,'z',z,'angle',angle,'driving',driving,'health',health,'shield',shield_until>now_at)),'[]') into result from (select * from harbor_private.peers where user_id<>u and seen>now_at-interval '8 seconds' order by seen desc limit 15) p;
return jsonb_build_object('peers',result,'health',r.health,'respawn',respawn,'x',r.x,'z',r.z,'shield',r.shield_until>now_at,'respawnIn',greatest(0,ceil(extract(epoch from r.dead_until-now_at))));
end $$;
create function public.harbor_fire(p_angle double precision,p_weapon integer default 0) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid:=auth.uid(); a harbor_private.peers; v harbor_private.peers; now_at timestamptz:=clock_timestamp(); dx float; dz float; reach float; damage integer; delay float; killed boolean; amount integer:=0; credited record;
begin
if u is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Sign in required';end if;
if p_angle is null or not(p_angle between -100 and 100) or p_weapon is null or p_weapon not between 0 and 2 then raise exception 'Invalid shot';end if;
perform pg_advisory_xact_lock(7451029);
select * into a from harbor_private.peers where user_id=u;
if not found or a.seen<now_at-interval '3 seconds' or a.health<=0 or a.driving or a.shield_until>now_at then return jsonb_build_object('hit',false);end if;
if not(p_weapon=any(a.guns)) then p_weapon:=0;end if;
damage:=(array[50,25,85])[p_weapon+1];delay:=(array[0.28,0.12,0.55])[p_weapon+1];reach:=(array[22,26,38])[p_weapon+1];
if extract(epoch from now_at-a.shot_at)<delay then return jsonb_build_object('hit',false);end if;
update harbor_private.peers set shot_at=now_at where user_id=u;
dx:=sin(p_angle);dz:=-cos(p_angle);
select * into v from harbor_private.peers p where user_id<>u and health>0 and seen>now_at-interval '3 seconds' and shield_until<=now_at
and (x-a.x)*dx+(z-a.z)*dz between 0.4 and reach and abs((x-a.x)*dz-(z-a.z)*dx)<(case when driving then 1.2 else 0.85 end)
and harbor_private.clear_shot(a.x,a.z,x,z) order by (x-a.x)*dx+(z-a.z)*dz limit 1;
if not found then return jsonb_build_object('hit',false);end if;
killed:=v.health<=damage;
update harbor_private.peers set health=greatest(0,health-damage),dead_until=case when killed then now_at+interval '8 seconds' else null end where user_id=v.user_id;
if killed then
insert into harbor_private.defeats(life,winner,victim) values(v.life,u,v.user_id) on conflict do nothing;
if found then
select * into credited from public.apply_coin_ledger_event(u,'harbor:pvp:'||v.life,'game','Harbor live player defeat','harborGetaway',1,0,100);amount:=100;
end if;end if;
return jsonb_build_object('hit',true,'killed',killed,'amount',amount,'health',greatest(0,v.health-damage),'x',v.x,'z',v.z);
end $$;
revoke all on function public.harbor_fire(double precision,integer) from public,anon;
grant execute on function public.harbor_fire(double precision,integer) to authenticated;
revoke all on function harbor_private.clear_shot(float,float,float,float) from public,anon,authenticated;
