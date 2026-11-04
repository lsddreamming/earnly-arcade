-- Additive, server-recorded challenge progress. No currency or purchase changes.
alter table earnly_world.item_definitions add column challenge_only boolean not null default false;
insert into earnly_world.item_definitions(id,name,sprite_id,item_height,price,can_stack,tradeable,category,color,challenge_only)
values ('arcade-weekly-cup','Arcade All-Star Cup','trophy',1.5,0,false,false,'Arcade Rewards','#70dcff',true);

create table earnly_world.arcade_challenge_progress (
 user_id uuid not null references auth.users(id) on delete cascade,
 day date not null, game text not null, metric integer not null check(metric>=0),
 primary key(user_id,day,game)
);
create table earnly_world.arcade_challenge_days (
 user_id uuid not null references auth.users(id) on delete cascade,
 day date not null, primary key(user_id,day)
);
create table earnly_world.arcade_challenge_awards (
 user_id uuid not null references auth.users(id) on delete cascade,
 week date not null, item_id uuid references earnly_world.items(id) on delete set null,
 delivered boolean not null default false, primary key(user_id,week)
);
alter table earnly_world.arcade_challenge_progress enable row level security;
alter table earnly_world.arcade_challenge_days enable row level security;
alter table earnly_world.arcade_challenge_awards enable row level security;
revoke all on earnly_world.arcade_challenge_progress,earnly_world.arcade_challenge_days,earnly_world.arcade_challenge_awards from public,anon,authenticated;
grant select,insert,update on earnly_world.arcade_challenge_progress,earnly_world.arcade_challenge_days,earnly_world.arcade_challenge_awards to service_role;

create function earnly_world.arcade_challenge_goals(p_day date)
returns table(game text,goal integer,slot integer)
language sql immutable security invoker set search_path='' as $$
 select t.game,t.goal,mod(t.n-mod(p_day-date '2026-01-01',6)+6,6) as slot
 from (values (0,'spiralDrop',8),(1,'bounceRun',60),(2,'neonSlice',120),(3,'towerStack',8),(4,'snake',5),(5,'coinCatch',20)) t(n,game,goal)
 where mod(t.n-mod(p_day-date '2026-01-01',6)+6,6)<3 order by slot;
$$;
revoke all on function earnly_world.arcade_challenge_goals(date) from public,anon,authenticated;
grant execute on function earnly_world.arcade_challenge_goals(date) to service_role;

create function earnly_world.record_arcade_challenge() returns trigger
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
   insert into earnly_world.arcade_challenge_awards(user_id,week) values(new.user_id,week_start) on conflict do nothing;
  end if;
 end if;
 return new;
end $$;
revoke all on function earnly_world.record_arcade_challenge() from public,anon,authenticated;
grant execute on function earnly_world.record_arcade_challenge() to service_role;
create trigger arcade_challenge_result after insert on public.coin_ledger for each row execute function earnly_world.record_arcade_challenge();

create function public.arcade_challenge_status(p_actor uuid) returns jsonb
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
  update earnly_world.item_definitions set minted=minted+1 where id='arcade-weekly-cup' returning minted into serial_no;
  insert into earnly_world.items(owner_id,definition_id,serial,origin,state) values(p_actor,'arcade-weekly-cup',serial_no,'earned',jsonb_build_object('earnedWeek',award.week)) returning id into iid;
  update earnly_world.arcade_challenge_awards set delivered=true,item_id=iid where user_id=p_actor and week=award.week;
 end loop;
 return jsonb_build_object('day',today,'week',week_start,'resetAt',(today+1)::timestamp at time zone 'UTC','weekResetAt',(week_start+7)::timestamp at time zone 'UTC',
  'goals',(select jsonb_agg(jsonb_build_object('game',g.game,'goal',g.goal,'progress',coalesce(p.metric,0)) order by g.slot) from earnly_world.arcade_challenge_goals(today) g left join earnly_world.arcade_challenge_progress p on p.user_id=p_actor and p.day=today and p.game=g.game),
  'days',(select coalesce(jsonb_agg(day order by day),'[]') from earnly_world.arcade_challenge_days where user_id=p_actor and day>=week_start and day<week_start+7),
  'reward','Arcade All-Star Cup','delivered',exists(select 1 from earnly_world.arcade_challenge_awards where user_id=p_actor and week=week_start and delivered),
  'pending',exists(select 1 from earnly_world.arcade_challenge_awards where user_id=p_actor and not delivered),
  'totalAwards',(select count(*) from earnly_world.arcade_challenge_awards where user_id=p_actor and delivered));
end $$;
revoke all on function public.arcade_challenge_status(uuid) from public,anon,authenticated;
grant execute on function public.arcade_challenge_status(uuid) to service_role;

-- Reward-only furniture is never a free catalog purchase.
do $$ declare source text;begin
 select pg_get_functiondef('public.world_api(uuid,text,jsonb)'::regprocedure) into source;
 if strpos(source,'if w.balance<d.price')=0 then raise exception 'Unexpected World purchase implementation';end if;
 source:=replace(source,'if w.balance<d.price','if d.challenge_only then raise exception ''CHALLENGE_REWARD_ONLY'';end if; if w.balance<d.price');
 execute source;
end $$;
