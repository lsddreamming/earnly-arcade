-- Evidence is recorded only by the World service or an actual furniture change.
-- Coins use the existing atomic ledger, with one immutable key per player/day/task.
create table earnly_world.daily_progress (
 user_id uuid not null references auth.users(id) on delete cascade,
 day date not null,
 mission text not null check(mission in ('visit','decorate')),
 primary key(user_id,day,mission)
);
alter table earnly_world.daily_progress enable row level security;
revoke all on earnly_world.daily_progress from public,anon,authenticated;
grant select,insert on earnly_world.daily_progress to service_role;
alter table public.coin_ledger drop constraint coin_ledger_source_type_check;
alter table public.coin_ledger add constraint coin_ledger_source_type_check check(source_type in ('game','daily_bonus','daily_challenge','legacy_seed','world_mission'));

create function public.world_daily_visit(p_actor uuid,p_room uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
 perform public.world_room_snapshot(p_actor,p_room);
 if exists(select 1 from earnly_world.rooms where id=p_room and owner_id is null) then
  insert into earnly_world.daily_progress values(p_actor,(now() at time zone 'UTC')::date,'visit') on conflict do nothing;
 end if;
end $$;
revoke all on function public.world_daily_visit(uuid,uuid) from public,anon,authenticated;
grant execute on function public.world_daily_visit(uuid,uuid) to service_role;

create function earnly_world.record_daily_decor() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.room_id is not null and new.owner_id=old.owner_id
 and row(new.room_id,new.x,new.y,new.z,new.rotation) is distinct from row(old.room_id,old.x,old.y,old.z,old.rotation)
 and exists(select 1 from earnly_world.rooms where id=new.room_id and owner_id=new.owner_id) then
  insert into earnly_world.daily_progress values(new.owner_id,(now() at time zone 'UTC')::date,'decorate') on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function earnly_world.record_daily_decor() from public,anon,authenticated;
grant execute on function earnly_world.record_daily_decor() to service_role;
create trigger world_daily_decor after update of room_id,x,y,z,rotation on earnly_world.items for each row execute function earnly_world.record_daily_decor();

create function public.world_daily_missions(p_actor uuid,p_claim text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 today date := (now() at time zone 'UTC')::date;
 day_start timestamptz := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 missions jsonb := '[]'; task record; complete boolean; claimed boolean; event_key text;
begin
 if not exists(select 1 from auth.users where id=p_actor and not coalesce(is_anonymous,false) and email_confirmed_at is not null)
 or exists(select 1 from public.leaderboard_bans where user_id=p_actor)
 or exists(select 1 from earnly_world.social_members where user_id=p_actor and suspended_until>now()) then raise exception 'Account unavailable';end if;
 if p_claim is not null and p_claim not in ('visit','decorate','game') then raise exception 'Unknown daily mission';end if;
 for task in select * from (values
 ('visit','Visit a public hangout','Drop into the plaza or another public hangout.'),
 ('decorate','Make your room yours','Place or move a piece of furniture in your own room.'),
 ('game','Earn coins in the arcade','Finish a signed-in arcade game that earns coins.')
 ) as t(id,title,description) loop
  if task.id='game' then
   complete := exists(select 1 from public.coin_ledger where user_id=p_actor and source_type='game' and amount>0 and created_at>=day_start and created_at<day_start+interval '1 day');
  else
   complete := exists(select 1 from earnly_world.daily_progress where user_id=p_actor and day=today and mission=task.id);
  end if;
  event_key := 'world-mission:'||today::text||':'||task.id;
  claimed := exists(select 1 from public.coin_ledger where user_id=p_actor and client_event_id=event_key);
  if p_claim=task.id then
   if not complete and not claimed then raise exception 'Complete the mission first';end if;
   perform public.apply_coin_ledger_event(p_actor,event_key,'world_mission',task.title,null,null,null,5);
   claimed := true;
  end if;
  missions := missions||jsonb_build_array(jsonb_build_object('id',task.id,'title',task.title,'description',task.description,'complete',complete,'claimed',claimed,'reward',5));
 end loop;
 return jsonb_build_object('day',today,'resetsAt',day_start+interval '1 day','missions',missions);
end $$;
revoke all on function public.world_daily_missions(uuid,text) from public,anon,authenticated;
grant execute on function public.world_daily_missions(uuid,text) to service_role;
