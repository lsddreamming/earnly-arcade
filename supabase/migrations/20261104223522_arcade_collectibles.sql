alter table public.coin_ledger drop constraint coin_ledger_source_type_check;
alter table public.coin_ledger add constraint coin_ledger_source_type_check check(source_type in ('game','daily_bonus','daily_challenge','legacy_seed','world_mission','ad_bonus','arcade_daily'));
-- Additive rewards: existing cups and pending awards retain their original definition.
insert into earnly_world.item_definitions(id,name,sprite_id,item_height,price,can_stack,tradeable,category,color,challenge_only) values
 ('arcade-prize-cabinet','Neon Champion Cabinet','arcade',2,0,false,false,'Arcade Rewards','#b28aff',true),
 ('arcade-prize-lamp','Starlight Room Lamp','lamp',2,0,false,false,'Arcade Rewards','#83efca',true)
on conflict(id) do nothing;
alter table earnly_world.arcade_challenge_awards add column definition_id text not null default 'arcade-weekly-cup' references earnly_world.item_definitions(id);
create or replace function earnly_world.arcade_weekly_reward(p_week date) returns text language sql immutable security invoker set search_path='' as $$
 select (array['arcade-weekly-cup','arcade-prize-cabinet','arcade-prize-lamp'])[1+(((date_trunc('week',p_week::timestamp)::date-date '2026-11-02')/7)%3+3)%3]
$$;
revoke all on function earnly_world.arcade_weekly_reward(date) from public,anon,authenticated;
grant execute on function earnly_world.arcade_weekly_reward(date) to service_role;
create or replace function earnly_world.pay_arcade_daily_bonus(p_actor uuid) returns void language plpgsql security invoker set search_path='' as $$
declare today date:=(now() at time zone 'UTC')::date;
begin
 if exists(select 1 from earnly_world.arcade_challenge_days where user_id=p_actor and day=today)
 and exists(select 1 from auth.users where id=p_actor and not coalesce(is_anonymous,false) and email_confirmed_at is not null)
 and not exists(select 1 from public.leaderboard_bans where user_id=p_actor)
 and not exists(select 1 from earnly_world.social_members where user_id=p_actor and suspended_until>now()) then
  perform public.apply_coin_ledger_event(p_actor,'arcade/daily:'||today::text,'arcade_daily','Daily Arcade completion',null,null,null,50);
 end if;
end $$;
revoke all on function earnly_world.pay_arcade_daily_bonus(uuid) from public,anon,authenticated;
grant execute on function earnly_world.pay_arcade_daily_bonus(uuid) to service_role;
create or replace function earnly_world.record_arcade_challenge() returns trigger
language plpgsql security invoker set search_path='' as $$
declare today date := (now() at time zone 'UTC')::date; week_start date; target integer;
begin
 if new.source_type<>'game' or new.metric is null or new.metric<=0 then return new;end if;
 select goal into target from earnly_world.arcade_challenge_goals(today) where game=new.game;
 if target is null then return new;end if;
 -- Date comes from the database, never a client timestamp or device clock.
 perform 1 from public.coin_wallets where user_id=new.user_id for update;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text,184));
 insert into earnly_world.arcade_challenge_progress values(new.user_id,today,new.game,least(new.metric,target))
 on conflict(user_id,day,game) do update set metric=greatest(arcade_challenge_progress.metric,excluded.metric);
 if (select count(*) from earnly_world.arcade_challenge_goals(today) g join earnly_world.arcade_challenge_progress p on p.game=g.game and p.user_id=new.user_id and p.day=today where p.metric>=g.goal)=3 then
  insert into earnly_world.arcade_challenge_days values(new.user_id,today) on conflict do nothing;
  week_start:=date_trunc('week',today::timestamp)::date;
  if (select count(*) from earnly_world.arcade_challenge_days where user_id=new.user_id and day>=week_start and day<week_start+7)>=4 then
   insert into earnly_world.arcade_challenge_awards(user_id,week,definition_id) values(new.user_id,week_start,earnly_world.arcade_weekly_reward(week_start)) on conflict do nothing;
  end if;
 end if;
 perform earnly_world.pay_arcade_daily_bonus(new.user_id);
 return new;
end $$;

create or replace function public.arcade_challenge_status(p_actor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare today date := (now() at time zone 'UTC')::date; week_start date; award record; serial_no bigint; iid uuid;
begin
 if not exists(select 1 from auth.users where id=p_actor and not coalesce(is_anonymous,false) and email_confirmed_at is not null)
 or exists(select 1 from public.leaderboard_bans where user_id=p_actor)
 or exists(select 1 from earnly_world.social_members where user_id=p_actor and suspended_until>now()) then raise exception 'Account unavailable';end if;
 week_start:=date_trunc('week',today::timestamp)::date;
 -- Same inventory lock as purchases; retry pending gifts even after their week ends.
 perform 1 from public.coin_wallets where user_id=p_actor for update;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text,184));
 for award in select * from earnly_world.arcade_challenge_awards where user_id=p_actor and not delivered order by week limit 10 for update loop
  exit when (select count(*) from earnly_world.items where owner_id=p_actor and not gift_revoked)>=500;
  update earnly_world.item_definitions set minted=minted+1 where id=award.definition_id returning minted into serial_no;
  insert into earnly_world.items(owner_id,definition_id,serial,origin,state) values(p_actor,award.definition_id,serial_no,'earned',jsonb_build_object('earnedWeek',award.week)) returning id into iid;
  update earnly_world.arcade_challenge_awards set delivered=true,item_id=iid where user_id=p_actor and week=award.week;
 end loop;
 perform earnly_world.pay_arcade_daily_bonus(p_actor);
 return jsonb_build_object('day',today,'week',week_start,'resetAt',(today+1)::timestamp at time zone 'UTC','weekResetAt',(week_start+7)::timestamp at time zone 'UTC',
  'goals',(select jsonb_agg(jsonb_build_object('game',g.game,'goal',g.goal,'progress',coalesce(p.metric,0)) order by g.slot) from earnly_world.arcade_challenge_goals(today) g left join earnly_world.arcade_challenge_progress p on p.user_id=p_actor and p.day=today and p.game=g.game),
  'days',(select coalesce(jsonb_agg(day order by day),'[]') from earnly_world.arcade_challenge_days where user_id=p_actor and day>=week_start and day<week_start+7),
  'dailyBonus',50,'dailyBonusPaid',exists(select 1 from public.coin_ledger where user_id=p_actor and client_event_id='arcade/daily:'||today::text),
  'reward',(select name from earnly_world.item_definitions where id=earnly_world.arcade_weekly_reward(week_start)),
  'rewardPreview',(select jsonb_build_object('id',id,'name',name,'sprite',sprite_id,'color',color) from earnly_world.item_definitions where id=earnly_world.arcade_weekly_reward(week_start)),
  'nextReward',(select name from earnly_world.item_definitions where id=earnly_world.arcade_weekly_reward(week_start+7)),'delivered',exists(select 1 from earnly_world.arcade_challenge_awards where user_id=p_actor and week=week_start and delivered),
  'pending',exists(select 1 from earnly_world.arcade_challenge_awards where user_id=p_actor and not delivered),
  'totalAwards',(select count(*) from earnly_world.arcade_challenge_awards where user_id=p_actor and delivered));
end $$;
