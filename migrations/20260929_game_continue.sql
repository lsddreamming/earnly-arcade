-- Continue purchases debit the signed-in wallet atomically. Price is fixed on
-- the server; client balances and requested prices are never trusted.
create table if not exists public.coin_spends (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_event_id text not null,
  game text not null,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, client_event_id)
);

create index if not exists coin_spends_user_created_idx
  on public.coin_spends (user_id, created_at desc);
alter table public.coin_spends enable row level security;
create policy "Players can read their own coin spends"
  on public.coin_spends for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.coin_spends from anon, authenticated;
grant select on public.coin_spends to authenticated;

create or replace function public.spend_game_continue(p_event_id text, p_game text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  player_id uuid := auth.uid();
  continue_price constant integer := 25;
  current_balance bigint;
  spend_receipt public.coin_spends%rowtype;
  wallet_row public.coin_wallets%rowtype;
begin
  if player_id is null then
    raise exception 'Sign in to spend Coins' using errcode = '28000';
  end if;
  if p_game is distinct from 'brickBreaker'
     or p_event_id is null or length(p_event_id) < 12 or length(p_event_id) > 120
     or p_event_id !~ '^[a-zA-Z0-9_-]+$' then
    raise exception 'Invalid continue request' using errcode = '22023';
  end if;

  -- Serializes competing purchases for this account and keeps retries safe.
  select * into wallet_row from public.coin_wallets
    where user_id = player_id for update;
  if not found then
    raise exception 'Coin wallet unavailable' using errcode = 'P0001';
  end if;
  select * into spend_receipt from public.coin_spends
    where user_id = player_id and client_event_id = p_event_id;
  if found then
    if spend_receipt.game <> p_game then
      raise exception 'Continue request already used' using errcode = '22023';
    end if;
    return jsonb_build_object('charged', false, 'amount', spend_receipt.amount,
      'wallet', jsonb_build_object('balance', wallet_row.balance,
        'lifetime_earned', wallet_row.lifetime_earned));
  end if;
  if wallet_row.balance < continue_price then
    raise exception 'Not enough Coins to continue' using errcode = 'P0001';
  end if;

  update public.coin_wallets set balance = balance - continue_price,
    updated_at = now() where user_id = player_id returning * into wallet_row;
  insert into public.coin_spends (user_id, client_event_id, game, amount)
    values (player_id, p_event_id, p_game, continue_price);
  return jsonb_build_object('charged', true, 'amount', continue_price,
    'wallet', jsonb_build_object('balance', wallet_row.balance,
      'lifetime_earned', wallet_row.lifetime_earned));
end;
$$;
revoke all on function public.spend_game_continue(text, text) from public, anon;
grant execute on function public.spend_game_continue(text, text) to authenticated;
