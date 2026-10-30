-- Raise future claims to 50 coins; preserve existing daily ledger keys and paid amounts.
create or replace function public.world_daily_missions(p_actor uuid,p_claim text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 today date := (now() at time zone 'UTC')::date;
 day_start timestamptz := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 missions jsonb := '[]'; task record; complete boolean; claimed boolean; event_key text; paid_reward integer;
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
  if p_claim=task.id and not claimed then
   if not complete and not claimed then raise exception 'Complete the mission first';end if;
   perform public.apply_coin_ledger_event(p_actor,event_key,'world_mission',task.title,null,null,null,50);
   claimed := true;
  end if;
  select amount into paid_reward from public.coin_ledger where user_id=p_actor and client_event_id=event_key;
  missions := missions||jsonb_build_array(jsonb_build_object('id',task.id,'title',task.title,'description',task.description,'complete',complete,'claimed',claimed,'reward',coalesce(paid_reward,50)));
 end loop;
 return jsonb_build_object('day',today,'resetsAt',day_start+interval '1 day','missions',missions);
end $$;
revoke all on function public.world_daily_missions(uuid,text) from public,anon,authenticated;
grant execute on function public.world_daily_missions(uuid,text) to service_role;
