-- AI relations are private account data, separate from human friendships/presence.
create table earnly_world.ai_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 quiet boolean not null default false,
 remember boolean not null default false
);
create table earnly_world.ai_memories (
 user_id uuid not null references auth.users(id) on delete cascade,
 resident_id text not null check(resident_id in ('jax','blitz','mochi','zippy','fern','nova','pip','rio','sage','bea')),
 friend boolean not null default false,
 visits integer not null default 0 check(visits between 0 and 1000000),
 topics text[] not null default '{}' check(cardinality(topics)<=6),
 favorite_game text check(favorite_game in ('Snake','Bubble Pop','Tap Rush','Neon Slice','Coin Catch')),
 room_visits uuid[] not null default '{}' check(cardinality(room_visits)<=8),
 achievements jsonb not null default '[]' check(jsonb_typeof(achievements)='array' and jsonb_array_length(achievements)<=5),
 last_seen timestamptz,
 primary key(user_id,resident_id)
);
alter table earnly_world.ai_preferences enable row level security;
alter table earnly_world.ai_memories enable row level security;
revoke all on earnly_world.ai_preferences,earnly_world.ai_memories from public,anon,authenticated;
grant select,insert,update,delete on earnly_world.ai_preferences,earnly_world.ai_memories to service_role;

create function public.world_residents(p_actor uuid,p_room uuid,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare pref earnly_world.ai_preferences%rowtype; rid text; topic text; result jsonb; scores jsonb;
begin
 if p_actor is null or not exists(select 1 from auth.users where id=p_actor and not coalesce(is_anonymous,false) and email_confirmed_at is not null)
 or exists(select 1 from public.leaderboard_bans where user_id=p_actor)
 or exists(select 1 from earnly_world.social_members where user_id=p_actor and suspended_until>now()) then raise exception 'Account unavailable';end if;
 perform public.world_room_snapshot(p_actor,p_room);
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,182));
 select * into pref from earnly_world.ai_preferences where user_id=p_actor;
 if not found then pref.quiet:=false;pref.remember:=false;end if;
 if jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>2048 then raise exception 'Invalid AI settings';end if;
 rid:=p_data->>'residentId';
 if rid is not null and rid not in ('jax','blitz','mochi','zippy','fern','nova','pip','rio','sage','bea') then raise exception 'Unknown AI resident';end if;
 if p_action='settings' then
  if p_data ? 'quiet' then if jsonb_typeof(p_data->'quiet')<>'boolean' then raise exception 'Choose Natural or Quiet mode';end if;pref.quiet:=(p_data->>'quiet')::boolean;end if;
  if p_data ? 'remember' then if jsonb_typeof(p_data->'remember')<>'boolean' then raise exception 'Choose a memory setting';end if;pref.remember:=(p_data->>'remember')::boolean;end if;
  insert into earnly_world.ai_preferences(user_id,quiet,remember) values(p_actor,pref.quiet,pref.remember)
   on conflict(user_id) do update set quiet=excluded.quiet,remember=excluded.remember;
  if not pref.remember then update earnly_world.ai_memories set visits=0,topics='{}',favorite_game=null,room_visits='{}',achievements='[]',last_seen=null where user_id=p_actor;end if;
 elsif p_action='friend' then
  if rid is null or jsonb_typeof(p_data->'friend') is distinct from 'boolean' then raise exception 'Choose an AI friendship';end if;
  insert into earnly_world.ai_memories(user_id,resident_id,friend) values(p_actor,rid,(p_data->>'friend')::boolean)
   on conflict(user_id,resident_id) do update set friend=excluded.friend;
 elsif p_action='forget' then
  update earnly_world.ai_memories set visits=0,topics='{}',favorite_game=null,room_visits='{}',achievements='[]',last_seen=null where user_id=p_actor and (rid is null or resident_id=rid);
  if rid is null then
   pref.remember:=false;
   insert into earnly_world.ai_preferences(user_id,quiet,remember) values(p_actor,pref.quiet,false) on conflict(user_id) do update set remember=false;
  end if;
 elsif p_action='touch' then
  topic:=p_data->>'topic';
  if rid is null or topic is null or topic not in ('hello','games','room','joke','bye','memory') then raise exception 'Choose a conversation topic';end if;
  if p_data ? 'favoriteGame' and (p_data->>'favoriteGame' is null or p_data->>'favoriteGame' not in ('Snake','Bubble Pop','Tap Rush','Neon Slice','Coin Catch')) then raise exception 'Unknown game';end if;
  if pref.remember then
   -- All achievements come from the authenticated actor's verified leaderboard rows.
   select coalesce(jsonb_agg(to_jsonb(q)),'[]') into scores from (
    select game,score::text as score from public.leaderboard_scores where user_id=p_actor order by achieved_at desc limit 5
   ) q;
   insert into earnly_world.ai_memories(user_id,resident_id) values(p_actor,rid) on conflict do nothing;
   update earnly_world.ai_memories set visits=least(1000000,visits+case when last_seen is null or last_seen<now()-interval '30 minutes' then 1 else 0 end),
    topics=case when topic=any(topics) then topics else array_append(topics,topic) end,
    favorite_game=coalesce(p_data->>'favoriteGame',favorite_game),
    room_visits=case when p_room=any(room_visits) then room_visits else (array_prepend(p_room,room_visits))[1:8] end,
    achievements=scores,last_seen=now() where user_id=p_actor and resident_id=rid;
  end if;
 elsif p_action<>'read' then raise exception 'Unknown AI action';end if;
 select coalesce(jsonb_agg(jsonb_build_object('residentId',resident_id,'friend',friend,'remember',pref.remember,'visits',visits,'topics',topics,'favoriteGame',favorite_game,'roomVisits',room_visits,'achievements',achievements) order by resident_id),'[]') into result
  from earnly_world.ai_memories where user_id=p_actor;
 return jsonb_build_object('quiet',pref.quiet,'remember',pref.remember,'relations',result);
end $$;
revoke all on function public.world_residents(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.world_residents(uuid,uuid,text,jsonb) to service_role;
-- Only needed columns for the verified achievement snapshot.
grant select(user_id,game,score,achieved_at) on public.leaderboard_scores to service_role;
