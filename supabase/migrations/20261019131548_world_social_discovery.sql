-- Server-only community features. No browser can manufacture visits, rewards or telemetry.
create table earnly_world.room_reactions (
 room_id uuid references earnly_world.rooms(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 reaction text not null check(reaction in ('heart','thumb')),
 primary key(room_id,user_id)
);
create table earnly_world.room_invites (
 id uuid primary key default gen_random_uuid(),
 sender uuid not null references auth.users(id) on delete cascade,
 recipient uuid not null references auth.users(id) on delete cascade,
 room_id uuid not null references earnly_world.rooms(id) on delete cascade,
 sent_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '1 hour',
 dismissed boolean not null default false,
 unique(sender,recipient,room_id),check(sender<>recipient)
);
create index world_invites_inbox on earnly_world.room_invites(recipient,expires_at);
create table earnly_world.room_decor_activity (
 room_id uuid primary key references earnly_world.rooms(id) on delete cascade,
 changed_at timestamptz not null default now()
);
create table earnly_world.weekly_entries (
 user_id uuid references auth.users(id) on delete cascade,
 week date not null,room_id uuid not null references earnly_world.rooms(id) on delete cascade,
 entered_at timestamptz not null default now(),primary key(user_id,week)
);
create table earnly_metrics.world_first_sessions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 joined_at timestamptz not null default now(),walked_at timestamptz,decorated_at timestamptz,visited_at timestamptz
);
alter table earnly_world.room_reactions enable row level security;
alter table earnly_world.room_invites enable row level security;
alter table earnly_world.room_decor_activity enable row level security;
alter table earnly_world.weekly_entries enable row level security;
alter table earnly_metrics.world_first_sessions enable row level security;
revoke all on earnly_world.room_reactions,earnly_world.room_invites,earnly_world.room_decor_activity,earnly_world.weekly_entries,earnly_metrics.world_first_sessions from public,anon,authenticated;
grant select,insert,update,delete on earnly_world.room_reactions,earnly_world.room_invites to service_role;
grant select,insert,update on earnly_world.room_decor_activity,earnly_metrics.world_first_sessions to service_role;
grant select,insert on earnly_world.weekly_entries to service_role;

create function earnly_world.social_visible(p_actor uuid,p_owner uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select (p_owner is null or exists(select 1 from auth.users where id=p_owner and not coalesce(is_anonymous,false) and email_confirmed_at is not null))
 and not exists(select 1 from public.leaderboard_bans where user_id in (p_actor,p_owner))
 and not exists(select 1 from earnly_world.social_members where user_id in (p_actor,p_owner) and suspended_until>now())
 and not exists(select 1 from earnly_world.blocks where (user_id=p_actor and blocked_id=p_owner) or (user_id=p_owner and blocked_id=p_actor));
$$;
revoke all on function earnly_world.social_visible(uuid,uuid) from public,anon,authenticated;
grant execute on function earnly_world.social_visible(uuid,uuid) to service_role;

create function public.world_track_step(p_actor uuid,p_step text,p_room uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if p_step not in ('join','walk') then raise exception 'Invalid step';end if;
 if p_step='join' then
  insert into earnly_metrics.world_first_sessions(user_id) values(p_actor) on conflict do nothing;
  if exists(select 1 from earnly_world.rooms where id=p_room and owner_id is distinct from p_actor) then
   update earnly_metrics.world_first_sessions set visited_at=coalesce(visited_at,now()) where user_id=p_actor and now()<joined_at+interval '30 minutes';
  end if;
 else
  update earnly_metrics.world_first_sessions set walked_at=coalesce(walked_at,now()) where user_id=p_actor and now()<joined_at+interval '30 minutes';
 end if;
end $$;
revoke all on function public.world_track_step(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.world_track_step(uuid,text,uuid) to service_role;

create function earnly_world.record_social_decor() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.room_id is not null and new.owner_id=old.owner_id
 and row(new.room_id,new.x,new.y,new.z,new.rotation) is distinct from row(old.room_id,old.x,old.y,old.z,old.rotation)
 and exists(select 1 from earnly_world.rooms where id=new.room_id and owner_id=new.owner_id) then
  insert into earnly_world.room_decor_activity values(new.room_id,now()) on conflict(room_id) do update set changed_at=excluded.changed_at;
  update earnly_metrics.world_first_sessions set decorated_at=coalesce(decorated_at,now()) where user_id=new.owner_id and now()<joined_at+interval '30 minutes';
 end if;return new;
end $$;
revoke all on function earnly_world.record_social_decor() from public,anon,authenticated;
grant execute on function earnly_world.record_social_decor() to service_role;
create trigger world_social_decor after update of room_id,x,y,z,rotation on earnly_world.items for each row execute function earnly_world.record_social_decor();

create function public.world_social(p_actor uuid,p_room uuid,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r earnly_world.rooms%rowtype; target uuid; invite earnly_world.room_invites%rowtype; mine text; result jsonb;
 week_start date:=(date_trunc('week',now() at time zone 'UTC'))::date;
 theme text; entered boolean; ready boolean; duplicate boolean:=false;
begin
 if not exists(select 1 from auth.users where id=p_actor and not coalesce(is_anonymous,false) and email_confirmed_at is not null)
 or not earnly_world.social_visible(p_actor,null) then raise exception 'Account unavailable';end if;
 select * into r from earnly_world.rooms where id=p_room;
 if not found or (r.owner_id is distinct from p_actor and r.access_type<>'open') or not earnly_world.social_visible(p_actor,r.owner_id) then raise exception 'Room unavailable';end if;
 if p_action in ('reactions','react') then
  if p_action='react' then
   if r.owner_id is null or r.owner_id=p_actor or r.access_type<>'open' then raise exception 'Visit another player’s open room to react';end if;
   mine:=p_data->>'reaction';
   if mine is null then delete from earnly_world.room_reactions where room_id=p_room and user_id=p_actor;
   elsif mine in ('heart','thumb') then
    insert into earnly_world.room_reactions values(p_room,p_actor,mine) on conflict(room_id,user_id) do update set reaction=excluded.reaction;
   else raise exception 'Invalid reaction';end if;
  end if;
  return jsonb_build_object('heart',(select count(*) from earnly_world.room_reactions x where room_id=p_room and reaction='heart' and earnly_world.social_visible(p_actor,x.user_id)),
   'thumb',(select count(*) from earnly_world.room_reactions x where room_id=p_room and reaction='thumb' and earnly_world.social_visible(p_actor,x.user_id)),
   'mine',(select reaction from earnly_world.room_reactions where room_id=p_room and user_id=p_actor),'canReact',r.owner_id is not null and r.owner_id<>p_actor and r.access_type='open');
 elsif p_action='featured' then
  select coalesce(jsonb_agg(to_jsonb(q) order by q.score desc,q.rank_key),'[]'::jsonb) into result from (
   select w.id,w.name,w.owner_id as "ownerId",p.username as "ownerUsername",w.heightmap,
   (select count(*) from earnly_world.room_reactions x where x.room_id=w.id and earnly_world.social_visible(p_actor,x.user_id)) as score,
   md5(w.id::text||week_start::text) as rank_key,
   exists(select 1 from earnly_world.weekly_entries e where e.room_id=w.id and e.week=week_start) as "weeklyEntry",
   (select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'x',i.x,'y',i.y,'z',i.z,'rotation',i.rotation,'sprite',d.sprite_id,'color',coalesce(i.color,d.color),'width',d.width,'length',d.length,'itemHeight',d.item_height,'centered',i.centered)),'[]'::jsonb)
    from (select * from earnly_world.items where room_id=w.id order by id limit 40) i join earnly_world.item_definitions d on d.id=i.definition_id) as items
   from earnly_world.rooms w join public.profiles p on p.user_id=w.owner_id
   where w.access_type='open' and w.owner_id is not null and earnly_world.social_visible(p_actor,w.owner_id)
   and (select count(*) from earnly_world.items where room_id=w.id)>=3
   order by score desc,rank_key limit 12
  ) q;
  return result;
 elsif p_action='invite' then
  target:=(p_data->>'userId')::uuid;
  if r.access_type<>'open' then raise exception 'Open this room to visitors before inviting';end if;
  if target=p_actor or not earnly_world.social_visible(target,r.owner_id) or not earnly_world.social_visible(p_actor,target) or not exists(select 1 from auth.users where id=target and not coalesce(is_anonymous,false) and email_confirmed_at is not null)
  or not exists(select 1 from earnly_world.friends where accepted and ((requester=p_actor and recipient=target) or (requester=target and recipient=p_actor))) then raise exception 'Player unavailable';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text,915));
  select * into invite from earnly_world.room_invites where sender=p_actor and recipient=target and room_id=p_room;
  if found and invite.sent_at>now()-interval '10 minutes' then duplicate:=true;
  else
   if (select count(*) from earnly_world.room_invites where sender=p_actor and sent_at>now()-interval '1 hour')>=10 then raise exception 'Please slow down';end if;
   delete from earnly_world.room_invites where sender=p_actor and expires_at<now();
   insert into earnly_world.room_invites(sender,recipient,room_id) values(p_actor,target,p_room)
   on conflict(sender,recipient,room_id) do update set sent_at=now(),expires_at=now()+interval '1 hour',dismissed=false returning * into invite;
  end if;
  return jsonb_build_object('id',invite.id,'roomId',p_room,'roomName',r.name,'recipient',target,'expiresAt',invite.expires_at,'duplicate',duplicate);
 elsif p_action in ('invites','dismiss_invite') then
  if p_action='dismiss_invite' then update earnly_world.room_invites set dismissed=true where id=(p_data->>'id')::uuid and recipient=p_actor;end if;
  return coalesce((select jsonb_agg(to_jsonb(q) order by q."sentAt" desc) from (
   select i.id,i.room_id as "roomId",w.name as "roomName",p.username,i.sent_at as "sentAt",i.expires_at as "expiresAt"
   from earnly_world.room_invites i join earnly_world.rooms w on w.id=i.room_id join public.profiles p on p.user_id=i.sender
   where i.recipient=p_actor and not i.dismissed and i.expires_at>now() and w.access_type='open'
   and earnly_world.social_visible(p_actor,i.sender) and earnly_world.social_visible(p_actor,w.owner_id)
   and exists(select 1 from earnly_world.friends f where f.accepted and ((f.requester=p_actor and f.recipient=i.sender) or (f.requester=i.sender and f.recipient=p_actor)))
   order by i.sent_at desc limit 30
  ) q),'[]'::jsonb);
 elsif p_action in ('weekly','weekly_enter') then
  theme:=(array['Cozy Arcade','Garden Hideaway','Neon Nights','Cafe Corner'])[1+mod((week_start-date '2026-10-19')/7+400000,4)];
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text,916));
  entered:=exists(select 1 from public.coin_ledger where user_id=p_actor and client_event_id='world-week:'||week_start::text);
  ready:=r.owner_id=p_actor and r.access_type='open' and (select count(*) from earnly_world.items where room_id=p_room)>=3
   and exists(select 1 from earnly_world.room_decor_activity where room_id=p_room and changed_at>=week_start::timestamp at time zone 'UTC');
  if p_action='weekly_enter' and not entered then
   if not ready then raise exception 'Decorate your open room with at least 3 pieces this week';end if;
   insert into earnly_world.weekly_entries values(p_actor,week_start,p_room,now()) on conflict do nothing;
   perform public.apply_coin_ledger_event(p_actor,'world-week:'||week_start::text,'world_mission','Weekly decorating challenge',null,null,null,10);
   entered:=true;
  end if;
  return jsonb_build_object('theme',theme,'week',week_start,'endsAt',(week_start+7)::timestamp at time zone 'UTC','entered',entered,'ready',ready,'reward',10,
   'entryRoomId',(select room_id from earnly_world.weekly_entries where user_id=p_actor and week=week_start));
 end if;
 raise exception 'Unknown social action';
end $$;
revoke all on function public.world_social(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.world_social(uuid,uuid,text,jsonb) to service_role;

create or replace function public.activity_report(p_actor uuid,p_days integer default 7,p_include_tests boolean default false)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare since_at timestamptz; today_at timestamptz; result jsonb; started timestamptz;
begin
 if not public.activity_owner_access(p_actor) then raise exception 'Owner access required' using errcode='42501'; end if;
 if p_days not in (1,7,30) then raise exception 'Invalid range'; end if;
 today_at := date_trunc('day',now() at time zone 'America/Chicago') at time zone 'America/Chicago';
 since_at := (date_trunc('day',now() at time zone 'America/Chicago')-make_interval(days=>p_days-1)) at time zone 'America/Chicago';
 select started_at into started from earnly_metrics.settings;
 with eligible as (
  select u.id,u.created_at from auth.users u where u.deleted_at is null and not coalesce(u.is_anonymous,false) and u.email_confirmed_at is not null
  and (p_include_tests or not exists(select 1 from earnly_metrics.accounts a where a.user_id=u.id and a.excluded))
 ), events as (
  select e.* from earnly_metrics.events e join eligible u on u.id=e.user_id where e.created_at>=since_at
 ), players as (
  select user_id,count(distinct (created_at at time zone 'America/Chicago')::date) as active_days from events where kind='world_join' group by user_id
 ), purchases as (
  select o.user_id,o.fulfilled_at as paid_at from public.coin_orders o join eligible u on u.id=o.user_id where o.status='fulfilled' and o.fulfilled_at>=since_at and o.refunded_coins=0
  union all
  select a.user_id,a.created_at from public.apple_coin_transactions a join eligible u on u.id=a.user_id where not a.revoked and a.created_at>=since_at
 ), rooms as (
  select e.room_id,count(*) as entries,count(distinct e.user_id) as players,max(e.occupancy) as peak
  from events e where kind='world_join' and room_id is not null group by e.room_id
 )
 select jsonb_build_object(
  'generatedAt',now(),'trackingSince',started,'since',since_at,'days',p_days,'includeTests',p_include_tests,'timezone','America/Chicago',
  'signups',jsonb_build_object('total',(select count(*) from eligible),'today',(select count(*) from eligible where created_at>=today_at),'week',(select count(*) from eligible where created_at>=((date_trunc('day',now() at time zone 'America/Chicago')-interval '6 days') at time zone 'America/Chicago'))),
  'world',jsonb_build_object('players',(select count(*) from players),'entries',(select count(*) from events where kind='world_join'),'returning',(select count(*) from players where active_days>1),'attempts',(select count(*) from events where kind='world_attempt'),'failures',(select count(*) from events where kind='world_failure'),'reconnects',(select count(*) from events where kind='world_reconnect')),
  'shop',jsonb_build_object('views',(select count(*) from events where kind='shop_view'),'players',(select count(distinct user_id) from events where kind='shop_view'),'attempts',(select count(*) from events where kind='purchase_attempt'),'purchases',(select count(*) from purchases),'buyers',(select count(distinct user_id) from purchases)),
  'rooms',coalesce((select jsonb_agg(row_to_json(r)) from (select coalesce(w.name,'Deleted room') as name,x.entries,x.players,x.peak from rooms x left join earnly_world.rooms w on w.id=x.room_id order by x.entries desc,x.room_id limit 10) r),'[]'::jsonb)
 ) into result;
 return result||jsonb_build_object('firstSession',(
  select jsonb_build_object('joined',count(*),'walked',count(walked_at),'decorated',count(decorated_at),'visited',count(visited_at),
   'windowMinutes',30,'stillInWindow',count(*) filter(where now()<joined_at+interval '30 minutes'))
  from earnly_metrics.world_first_sessions s join auth.users u on u.id=s.user_id
  where s.joined_at>=since_at and u.deleted_at is null and not coalesce(u.is_anonymous,false) and u.email_confirmed_at is not null
  and (p_include_tests or not exists(select 1 from earnly_metrics.accounts a where a.user_id=s.user_id and a.excluded))
 ));
end $$;
