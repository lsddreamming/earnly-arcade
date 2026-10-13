-- Earnly World foundation. No client writes and no currency changes in this phase.
create schema if not exists earnly_world;
revoke all on schema earnly_world from public, anon, authenticated;
grant usage on schema earnly_world to service_role;
create table earnly_world.rooms (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 64),
 heightmap text not null check(length(heightmap) between 1 and 4224),
 access_type text not null default 'closed' check(access_type in ('open','doorbell','password','closed')),
 password_hash text,
 max_users integer not null default 25 check(max_users between 1 and 100),
 revision bigint not null default 0 check(revision>=0),
 created_at timestamptz not null default now(),
 check(access_type<>'password' or password_hash is not null)
);
create index on earnly_world.rooms(owner_id);
create table earnly_world.item_definitions (
 id text primary key,
 name text not null check(length(name) between 1 and 64),
 sprite_id text not null,
 width integer not null default 1 check(width between 1 and 64),
 length integer not null default 1 check(length between 1 and 64),
 item_height numeric(6,2) not null check(item_height>0 and item_height<=64 and mod(item_height,.25)=0),
 walkable boolean not null default false,
 can_sit boolean not null default false,
 can_lay boolean not null default false,
 can_stack boolean not null default true,
 tradeable boolean not null default true,
 price bigint not null check(price>=0),
 supply_limit bigint check(supply_limit>0),
 minted bigint not null default 0 check(minted>=0),
 check(supply_limit is null or minted<=supply_limit)
);
create table earnly_world.items (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 definition_id text not null references earnly_world.item_definitions(id),
 serial bigint not null check(serial>0),
 origin text not null check(origin in ('starter','earned','catalog','admin')),
 room_id uuid references earnly_world.rooms(id) on delete set null,
 x integer check(x between 0 and 63), y integer check(y between 0 and 63),
 z numeric(6,2) check(z between 0 and 64 and mod(z,.25)=0),
 rotation integer not null default 0 check(rotation in (0,2,4,6)),
 state jsonb not null default '{}'::jsonb check(jsonb_typeof(state)='object'),
 created_at timestamptz not null default now(),
 unique(definition_id,serial),
 check(room_id is null or (x is not null and y is not null and z is not null))
);
create index on earnly_world.items(owner_id);
create index on earnly_world.items(room_id);
create table earnly_world.trades (
 id uuid primary key default gen_random_uuid(),
 player_a uuid not null references auth.users(id) on delete cascade,
 player_b uuid not null references auth.users(id) on delete cascade,
 revision integer not null default 0 check(revision>=0),
 locked_a boolean not null default false, locked_b boolean not null default false,
 confirmed_a boolean not null default false, confirmed_b boolean not null default false,
 status text not null default 'open' check(status in ('open','complete','cancelled')),
 expires_at timestamptz not null default now()+interval '10 minutes',
 created_at timestamptz not null default now(), completed_at timestamptz,
 check(player_a<>player_b)
);
create index on earnly_world.trades(player_a,status);
create index on earnly_world.trades(player_b,status);
create table earnly_world.trade_items (
 trade_id uuid not null references earnly_world.trades(id) on delete cascade,
 item_id uuid not null references earnly_world.items(id) on delete cascade,
 offered_by uuid not null references auth.users(id) on delete cascade,
 primary key(trade_id,item_id)
);
create index on earnly_world.trade_items(item_id);
create index on earnly_world.trade_items(offered_by);
create table earnly_world.item_history (
 id bigint generated always as identity primary key,
 item_id uuid not null references earnly_world.items(id) on delete cascade,
 trade_id uuid not null references earnly_world.trades(id) on delete cascade,
 previous_owner uuid not null, new_owner uuid not null,
 created_at timestamptz not null default now(), unique(trade_id,item_id)
);
create index on earnly_world.item_history(item_id);
-- All operations originate in the authenticated room service. Never ship its key.
alter table earnly_world.rooms enable row level security;
alter table earnly_world.item_definitions enable row level security;
alter table earnly_world.items enable row level security;
alter table earnly_world.trades enable row level security;
alter table earnly_world.trade_items enable row level security;
alter table earnly_world.item_history enable row level security;
revoke all on all tables in schema earnly_world from public,anon,authenticated;
grant all on all tables in schema earnly_world to service_role;
grant usage,select on all sequences in schema earnly_world to service_role;

-- The service binds p_actor from a verified session, never from a message field.
-- Locking the trade serializes edit/lock/confirm; ordered item locks serialize competing trades.
create or replace function public.world_trade_action(p_actor uuid,p_trade uuid,p_revision integer,p_action text,p_items uuid[] default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare t earnly_world.trades%rowtype; is_a boolean; item_count integer; expected_count integer;
begin
 if not exists(select 1 from auth.users where id=p_actor and not coalesce(is_anonymous,false) and email_confirmed_at is not null)
 or exists(select 1 from public.leaderboard_bans where user_id=p_actor) then raise exception 'Account unavailable'; end if;
 select * into t from earnly_world.trades where id=p_trade for update;
 if not found or p_actor not in (t.player_a,t.player_b) then raise exception 'Trade unavailable'; end if;
 if p_revision is distinct from t.revision then raise exception 'Stale trade revision'; end if;
 if t.status='complete' and p_action='confirm' then return jsonb_build_object('id',t.id,'revision',t.revision,'status',t.status); end if;
 if t.status<>'open' or t.expires_at<=now() then raise exception 'Trade closed or expired'; end if;
 is_a:=p_actor=t.player_a;
 if p_action='edit' then
   if p_items is null or cardinality(p_items)>12 or cardinality(p_items)<>(select count(distinct v) from unnest(p_items) v) then raise exception 'Invalid items'; end if;
   perform id from earnly_world.items where id=any(p_items) order by id for update;
   select count(*) into item_count from earnly_world.items i join earnly_world.item_definitions d on d.id=i.definition_id
     where i.id=any(p_items) and i.owner_id=p_actor and i.room_id is null and d.tradeable and i.origin<>'starter';
   if item_count<>cardinality(p_items) then raise exception 'Items unavailable'; end if;
   delete from earnly_world.trade_items where trade_id=t.id and offered_by=p_actor;
   insert into earnly_world.trade_items(trade_id,item_id,offered_by) select t.id,v,p_actor from unnest(p_items) v;
   update earnly_world.trades set revision=revision+1,locked_a=false,locked_b=false,confirmed_a=false,confirmed_b=false where id=t.id;
 elsif p_action='lock' then
   update earnly_world.trades set locked_a=locked_a or is_a,locked_b=locked_b or not is_a where id=t.id;
 elsif p_action='cancel' then
   update earnly_world.trades set status='cancelled' where id=t.id;
 elsif p_action='confirm' then
   if not t.locked_a or not t.locked_b then raise exception 'Both offers must be locked'; end if;
   update earnly_world.trades set confirmed_a=confirmed_a or is_a,confirmed_b=confirmed_b or not is_a where id=t.id returning * into t;
   if t.confirmed_a and t.confirmed_b then
     if exists(select 1 from public.leaderboard_bans where user_id in(t.player_a,t.player_b))
     or (select count(*) from auth.users where id in(t.player_a,t.player_b) and not coalesce(is_anonymous,false) and email_confirmed_at is not null)<>2 then raise exception 'Account unavailable'; end if;
     perform i.id from earnly_world.items i join earnly_world.trade_items o on o.item_id=i.id where o.trade_id=t.id order by i.id for update of i;
     select count(*) into expected_count from earnly_world.trade_items where trade_id=t.id;
     select count(*) into item_count from earnly_world.trade_items o join earnly_world.items i on i.id=o.item_id join earnly_world.item_definitions d on d.id=i.definition_id
       where o.trade_id=t.id and o.offered_by in(t.player_a,t.player_b) and i.owner_id=o.offered_by and i.room_id is null and d.tradeable and i.origin<>'starter';
     if expected_count=0 or expected_count<>item_count then raise exception 'Items unavailable'; end if;
     insert into earnly_world.item_history(item_id,trade_id,previous_owner,new_owner)
       select item_id,t.id,offered_by,case when offered_by=t.player_a then t.player_b else t.player_a end from earnly_world.trade_items where trade_id=t.id;
     update earnly_world.items i set owner_id=case when o.offered_by=t.player_a then t.player_b else t.player_a end
       from earnly_world.trade_items o where o.trade_id=t.id and o.item_id=i.id;
     update earnly_world.trades set status='complete',completed_at=now() where id=t.id;
   end if;
 else raise exception 'Unknown trade action'; end if;
 select * into t from earnly_world.trades where id=p_trade;
 return jsonb_build_object('id',t.id,'revision',t.revision,'status',t.status,'lockedA',t.locked_a,'lockedB',t.locked_b,'confirmedA',t.confirmed_a,'confirmedB',t.confirmed_b,
 'offers',coalesce((select jsonb_agg(jsonb_build_object('userId',offered_by,'itemId',item_id) order by item_id) from earnly_world.trade_items where trade_id=t.id),'[]'::jsonb));
end $$;
revoke all on function public.world_trade_action(uuid,uuid,integer,text,uuid[]) from public,anon,authenticated;
grant execute on function public.world_trade_action(uuid,uuid,integer,text,uuid[]) to service_role;

-- Read-only room admission for the first release. Password and doorbell admission
-- remain closed until their explicit approval flows are implemented.
create or replace function public.world_room_snapshot(p_actor uuid,p_room uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r earnly_world.rooms%rowtype; player_name text;
begin
 if not exists(select 1 from auth.users where id=p_actor and not coalesce(is_anonymous,false) and email_confirmed_at is not null)
 or exists(select 1 from public.leaderboard_bans where user_id=p_actor) then raise exception 'Account unavailable'; end if;
 select username into player_name from public.profiles where user_id=p_actor;
 if player_name is null then raise exception 'Profile required'; end if;
 select * into r from earnly_world.rooms where id=p_room;
 if not found or (r.owner_id is distinct from p_actor and r.access_type<>'open') then raise exception 'Room unavailable'; end if;
 return jsonb_build_object('roomId',r.id,'username',player_name,'heightmap',r.heightmap,'revision',r.revision,'capacity',r.max_users,
 'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'x',i.x,'y',i.y,'z',i.z,'rotation',i.rotation,
 'width',d.width,'length',d.length,'itemHeight',d.item_height,'walkable',d.walkable,'canStack',d.can_stack,'canSit',d.can_sit,'canLay',d.can_lay))
 from earnly_world.items i join earnly_world.item_definitions d on d.id=i.definition_id where i.room_id=r.id),'[]'::jsonb));
end $$;
revoke all on function public.world_room_snapshot(uuid,uuid) from public,anon,authenticated;
grant execute on function public.world_room_snapshot(uuid,uuid) to service_role;
