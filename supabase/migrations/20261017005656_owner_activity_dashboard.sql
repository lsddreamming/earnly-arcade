-- Aggregate owner reporting. No wallet, purchase, room or player-state writes.
create schema if not exists earnly_metrics;
revoke all on schema earnly_metrics from public, anon, authenticated;
grant usage on schema earnly_metrics to service_role;
create table earnly_metrics.accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 owner boolean not null default false,
 excluded boolean not null default true
);
create table earnly_metrics.settings (
 id boolean primary key default true check(id), started_at timestamptz not null default now()
);
insert into earnly_metrics.settings(id) values(true);
create table earnly_metrics.events (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('world_join','world_attempt','world_failure','world_reconnect','shop_view','purchase_attempt')),
 room_id uuid, occupancy integer check(occupancy between 0 and 200),
 created_at timestamptz not null default now()
);
create index metrics_event_time on earnly_metrics.events(created_at);
create index metrics_event_actor_time on earnly_metrics.events(user_id,created_at);
alter table earnly_metrics.accounts enable row level security;
alter table earnly_metrics.settings enable row level security;
alter table earnly_metrics.events enable row level security;
revoke all on all tables in schema earnly_metrics from public,anon,authenticated;
grant select,insert on earnly_metrics.events to service_role;
grant select on earnly_metrics.accounts,earnly_metrics.settings to service_role;

create function public.activity_record(p_actor uuid,p_id uuid,p_kind text,p_room uuid default null,p_occupancy integer default null)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from auth.users where id=p_actor and not coalesce(is_anonymous,false) and email_confirmed_at is not null and deleted_at is null) then return false; end if;
 if p_kind not in ('world_join','world_attempt','world_failure','world_reconnect','shop_view','purchase_attempt') then raise exception 'Invalid event'; end if;
 -- Serialize each actor's intake so simultaneous requests cannot bypass the cap.
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,724));
 if (select count(*) from earnly_metrics.events where user_id=p_actor and created_at>now()-interval '1 hour')>=120 then return false; end if;
 insert into earnly_metrics.events(id,user_id,kind,room_id,occupancy)
 values(p_id,p_actor,p_kind,case when p_kind='world_join' then p_room end,case when p_kind='world_join' then p_occupancy end)
 on conflict(id) do nothing;
 return true;
end $$;

create function public.activity_owner_access(p_actor uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from earnly_metrics.accounts a join auth.users u on u.id=a.user_id where a.user_id=p_actor and a.owner and u.deleted_at is null and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false));
$$;

create function public.activity_report(p_actor uuid,p_days integer default 7,p_include_tests boolean default false)
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
 return result;
end $$;
revoke all on function public.activity_record(uuid,uuid,text,uuid,integer),public.activity_owner_access(uuid),public.activity_report(uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.activity_record(uuid,uuid,text,uuid,integer),public.activity_owner_access(uuid),public.activity_report(uuid,integer,boolean) to service_role;
