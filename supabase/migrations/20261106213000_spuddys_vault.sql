create table earnly_world.spuddy_pulls (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  pack text not null check (pack in ('starter','deluxe','weekly')),
  card text not null,
  sell_coins integer not null check (sell_coins > 0),
  free_week date,
  revealed boolean not null default false,
  resolution text check (resolution in ('vaulted','sold')),
  primary key (user_id, request_id),
  unique (user_id, free_week)
);
create unique index spuddy_one_pending on earnly_world.spuddy_pulls(user_id) where resolution is null;
alter table earnly_world.spuddy_pulls enable row level security;
revoke all on earnly_world.spuddy_pulls from public, anon, authenticated;
grant select, insert, update on earnly_world.spuddy_pulls to service_role;

create function earnly_world.spuddy_catalog()
returns table(id text, title text, rarity text, sell_coins integer, starter integer, deluxe integer)
language sql immutable set search_path='' as $$
  values ('jax','Jax','Common',10,3600,0),
         ('mochi','Mochi','Common',10,3400,0),
         ('zippy','Zippy','Uncommon',25,2100,0),
         ('blitz','Blitz','Rare',50,700,5500),
         ('bubble-mochi','Bubble Pop Mochi','Holo',100,120,3000),
         ('tower-zippy','Tower Stack Zippy','Holo',250,70,1400),
         ('neon-blitz','Neon Breach Blitz','Chase Holo',1000,10,100)
$$;
revoke all on function earnly_world.spuddy_catalog() from public, anon, authenticated;
grant execute on function earnly_world.spuddy_catalog() to service_role;

-- Keep Auth rows private and expose only the eligibility result to the Vault service.
create function earnly_world.spuddy_account_eligible(p_actor uuid)
returns boolean language sql stable security definer set search_path='' as $eligibility$
  select exists(
    select 1 from auth.users
    where id = p_actor
      and not coalesce(is_anonymous, false)
      and email_confirmed_at is not null
      and deleted_at is null
  )
$eligibility$;
revoke all on function earnly_world.spuddy_account_eligible(uuid) from public, anon, authenticated;
grant execute on function earnly_world.spuddy_account_eligible(uuid) to service_role;

create function public.spuddy_vault_action(p_actor uuid, p_action text, p_request uuid default null, p_pack text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  wallet public.coin_wallets;
  pull earnly_world.spuddy_pulls;
  picked record;
  cost integer;
  roll integer;
  this_week date := date_trunc('week',now() at time zone 'UTC')::date;
  weekly_ready boolean;
  problem text;
begin
  if not earnly_world.spuddy_account_eligible(p_actor)
     or exists(select 1 from public.leaderboard_bans where user_id=p_actor)
     or exists(select 1 from earnly_world.social_members where user_id=p_actor and suspended_until>now()) then
    raise exception 'Account unavailable';
  end if;
  if p_action is null or p_action not in ('status','buy','reveal','vault','sell') then raise exception 'Invalid action'; end if;
  if p_action <> 'status' and p_request is null then raise exception 'Missing request'; end if;
  if p_action = 'buy' and (p_pack is null or p_pack not in ('starter','deluxe','weekly')) then raise exception 'Invalid pack'; end if;

  -- Use the same wallet lock and purchased-coin tracking trigger as the coin shop.
  select * into wallet from public.coin_wallets where user_id=p_actor for update;
  if not found then raise exception 'Wallet unavailable'; end if;
  select * into pull from earnly_world.spuddy_pulls where user_id=p_actor and request_id=p_request;

  if p_action = 'buy' and pull.request_id is null then
    cost := case p_pack when 'deluxe' then 300 when 'starter' then 50 else 0 end;
    if exists(select 1 from earnly_world.spuddy_pulls where user_id=p_actor and resolution is null) then
      problem := 'Finish your current pack first.';
    elsif p_pack='weekly' and (not exists(select 1 from earnly_world.arcade_challenge_awards where user_id=p_actor and week=this_week)
        or exists(select 1 from earnly_world.spuddy_pulls where user_id=p_actor and free_week=this_week)) then
      problem := 'No weekly pack is ready to claim.';
    elsif wallet.balance < cost then
      problem := 'You need more Arcade Coins for this pack.';
    else
      roll := floor(random()*10000)::integer;
      select weighted.* into picked from (
        select c.*, sum(case when p_pack='deluxe' then deluxe else starter end) over(order by id) as cutoff
        from earnly_world.spuddy_catalog() c
      ) weighted where cutoff > roll and (case when p_pack='deluxe' then deluxe else starter end)>0 order by cutoff, id limit 1;
      if cost > 0 then
        update public.coin_wallets set balance=balance-cost,updated_at=now() where user_id=p_actor returning * into wallet;
      end if;
      insert into earnly_world.spuddy_pulls(user_id,request_id,pack,card,sell_coins,free_week)
        values(p_actor,p_request,p_pack,picked.id,picked.sell_coins,case when p_pack='weekly' then this_week end);
    end if;
  elsif p_action = 'buy' and pull.pack <> p_pack then
    problem := 'That request belongs to another pack.';
  elsif p_action in ('reveal','vault','sell') then
    if pull.request_id is null then
      problem := 'Pack not found.';
    elsif pull.resolution is null then
      if p_action = 'reveal' then
        update earnly_world.spuddy_pulls set revealed=true where user_id=p_actor and request_id=p_request;
      elsif not pull.revealed then
        problem := 'Reveal your card first.';
      elsif p_action = 'sell' and not exists(select 1 from earnly_world.spuddy_pulls
          where user_id=p_actor and card=pull.card and resolution='vaulted') then
        problem := 'Vault your first copy before selling duplicates.';
      else
        update earnly_world.spuddy_pulls set resolution=case p_action when 'sell' then 'sold' else 'vaulted' end
          where user_id=p_actor and request_id=p_request;
        if p_action = 'sell' then
          -- A sellback is internal play credit. The receipt prevents a second credit.
          update public.coin_wallets set balance=balance+pull.sell_coins,updated_at=now()
            where user_id=p_actor returning * into wallet;
        end if;
      end if;
    end if;
  end if;
  select * into pull from earnly_world.spuddy_pulls where user_id=p_actor and resolution is null;
  weekly_ready := exists(select 1 from earnly_world.arcade_challenge_awards where user_id=p_actor and week=this_week)
    and not exists(select 1 from earnly_world.spuddy_pulls where user_id=p_actor and free_week=this_week);
  return jsonb_build_object(
    'error',problem, 'balance',wallet.balance::text, 'lifetimeEarned',wallet.lifetime_earned::text, 'weeklyReady',weekly_ready,
    'catalog',(select jsonb_agg(to_jsonb(c) order by c.starter desc,c.deluxe desc,c.id) from earnly_world.spuddy_catalog() c),
    'owned',(select coalesce(jsonb_object_agg(card,qty),'{}'::jsonb) from (
       select card,count(*) as qty from earnly_world.spuddy_pulls where user_id=p_actor and resolution='vaulted' group by card
    ) owned),
    'pending',case when pull.request_id is not null then jsonb_build_object('id',pull.request_id,'pack',pull.pack,
      'card',case when pull.revealed then pull.card end,'sellCoins',case when pull.revealed then pull.sell_coins end) end);
end
$$;
revoke all on function public.spuddy_vault_action(uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function public.spuddy_vault_action(uuid,text,uuid,text) to service_role;
