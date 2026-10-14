-- TEST FIXTURE ONLY. Pre-migration production function definitions, without user data.
CREATE OR REPLACE FUNCTION public.apply_coin_ledger_event(p_user_id uuid, p_event_id text, p_source_type text, p_source_label text, p_game text, p_metric integer, p_aux integer, p_amount integer)
 RETURNS TABLE(applied boolean, balance bigint, lifetime_earned bigint, ledger_id bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id bigint;
  v_inserted boolean := false;
begin
  if p_user_id is null then
    raise exception 'user required';
  end if;

  if p_event_id is null or char_length(p_event_id) < 8 or char_length(p_event_id) > 160 then
    raise exception 'invalid event id';
  end if;

  if p_amount < 0 or p_amount > 100 then
    raise exception 'invalid reward amount';
  end if;

  insert into public.coin_wallets(user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  insert into public.coin_ledger(
    user_id, client_event_id, source_type, source_label,
    game, metric, aux, amount
  )
  values(
    p_user_id, p_event_id, p_source_type, coalesce(p_source_label,'Arcade reward'),
    p_game, p_metric, p_aux, p_amount
  )
  on conflict (user_id, client_event_id) do nothing
  returning id into v_id;

  if v_id is not null then
    v_inserted := true;

    update public.coin_wallets as cw
    set
      balance = cw.balance + p_amount,
      lifetime_earned = cw.lifetime_earned + p_amount,
      updated_at = now()
    where cw.user_id = p_user_id;
  else
    select l.id into v_id
    from public.coin_ledger l
    where l.user_id = p_user_id
      and l.client_event_id = p_event_id;
  end if;

  return query
  select v_inserted, w.balance, w.lifetime_earned, v_id
  from public.coin_wallets w
  where w.user_id = p_user_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.claim_coin_reward(p_event_id text, p_kind text, p_game text DEFAULT NULL::text, p_metric integer DEFAULT NULL::integer, p_aux integer DEFAULT NULL::integer, p_challenge_id text DEFAULT NULL::text, p_source text DEFAULT 'Arcade reward'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_event_id text := trim(coalesce(p_event_id,''));
  v_kind text := trim(coalesce(p_kind,''));
  v_game text := nullif(trim(coalesce(p_game,'')), '');
  v_metric integer := greatest(0, least(coalesce(p_metric,0), 10000));
  v_aux integer := greatest(0, least(coalesce(p_aux,0), 10000));
  v_amount integer := 0;
  v_source_type text;
  v_source_label text := left(coalesce(nullif(trim(p_source),''),'Arcade reward'),80);
  v_day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  v_count integer := 0;
  v_dup_amount integer;
  v_balance bigint;
  v_lifetime bigint;
  v_applied boolean;
  v_ledger_id bigint;
  v_date_text text;
  v_digit_sum integer := 0;
  v_i integer;
  v_all_challenges text[] := array[
    'variety','snake10','block3','tap20','dodger15','brick15','jungle8','tower10','memory',
    'coinCatch15','colorMatch18','paddleRally12','laneRunner20','safeCracker8',
    'blockGrid250','mergeRush800','perfectDrop10','spiralDrop10','shapeFit10','bounceRun100','trafficEscape10'
  ];
  v_expected_9 text;
  v_expected_14 text;
  v_expected_21 text;
  v_challenge text := nullif(trim(coalesce(p_challenge_id,'')), '');
begin
  if v_user_id is null then
    raise exception 'Sign in required';
  end if;

  if v_event_id !~ '^[A-Za-z0-9_.:-]{8,160}$' then
    raise exception 'Invalid reward event';
  end if;

  select l.amount
    into v_dup_amount
  from public.coin_ledger l
  where l.user_id = v_user_id
    and l.client_event_id = v_event_id
  limit 1;

  if found then
    select w.balance, w.lifetime_earned
      into v_balance, v_lifetime
    from public.coin_wallets w
    where w.user_id = v_user_id;

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'amount', v_dup_amount,
      'wallet', jsonb_build_object(
        'balance', coalesce(v_balance,0),
        'lifetime_earned', coalesce(v_lifetime,0)
      )
    );
  end if;

  if v_kind = 'game' then
    if v_game is null then
      raise exception 'Game required';
    end if;

    select count(*)::integer
      into v_count
    from public.coin_ledger l
    where l.user_id = v_user_id
      and l.source_type = 'game'
      and l.game = v_game
      and l.created_at >= v_day_start;

    if v_count >= 9 then
      raise exception 'Daily server reward limit reached for this game';
    end if;

    case v_game
      when 'snake' then
        v_amount := floor(v_metric / 3.0)::integer
          + case when v_metric >= 10 then 2 else 0 end
          + case when v_metric >= 25 then 3 else 0 end
          + case when v_metric >= 50 then 4 else 0 end;
        v_amount := least(v_amount,30);
        v_aux := 0;

      when 'blockDrop' then
        v_amount := least(v_metric,5);
        v_aux := 0;

      when 'tapRush' then
        v_amount := floor(v_metric / 5.0)::integer
          + case when v_metric >= 20 then 2 else 0 end
          + case when v_metric >= 35 then 3 else 0 end
          + case when v_metric >= 50 then 5 else 0 end;
        v_amount := least(v_amount,20);
        v_aux := 0;

      when 'memory' then
        if v_metric < 1 then
          raise exception 'Invalid memory result';
        end if;
        v_amount := 8
          + case
              when v_metric <= 16 then 7
              when v_metric <= 20 then 5
              when v_metric <= 24 then 3
              when v_metric <= 30 then 1
              else 0
            end;
        v_amount := least(v_amount,15);
        v_aux := 0;

      when 'dodger' then
        v_metric := least(v_metric,30);
        v_amount := floor(v_metric / 3.0)::integer
          + floor(v_aux / 5.0)::integer
          + case when v_metric >= 15 then 2 else 0 end
          + case when v_metric >= 25 then 3 else 0 end
          + case when v_metric >= 30 then 4 else 0 end;
        v_amount := least(v_amount,20);

      when 'brickBreaker' then
        v_metric := least(v_metric,35);
        v_aux := case when v_aux > 0 then 1 else 0 end;
        v_amount := floor(v_metric / 3.0)::integer
          + case when v_metric >= 15 then 2 else 0 end
          + case when v_metric >= 25 then 3 else 0 end
          + case when v_aux = 1 then 5 else 0 end;
        v_amount := least(v_amount,22);

      when 'jungleHopper' then
        -- One gold on each even vine; every sixth vine has double gold.
        -- The current vine can be collected before it is scored.
        v_aux := least(v_aux, (v_metric + 1) / 2 + (v_metric + 1) / 6, 25);
        v_amount := floor(v_metric / 2.0)::integer
          + case when v_metric >= 10 then 2 else 0 end
          + case when v_metric >= 20 then 3 else 0 end
          + case when v_metric >= 30 then 5 else 0 end;
        v_amount := least(v_amount + v_aux,25);

      when 'towerStack' then
        v_aux := least(v_aux,v_metric);
        v_amount := floor(v_metric / 3.0)::integer
          + floor(v_aux / 3.0)::integer
          + case when v_metric >= 10 then 2 else 0 end
          + case when v_metric >= 20 then 3 else 0 end
          + case when v_metric >= 30 then 5 else 0 end;
        v_amount := least(v_amount,25);

      when 'coinCatch' then
        v_amount := floor(v_metric / 4.0)::integer
          + case when v_metric >= 15 then 2 else 0 end
          + case when v_metric >= 25 then 3 else 0 end
          + case when v_metric >= 40 then 5 else 0 end;
        v_amount := least(v_amount,25);
        v_aux := 0;

      when 'colorMatch' then
        v_amount := floor(v_metric / 4.0)::integer
          + case when v_metric >= 15 then 2 else 0 end
          + case when v_metric >= 25 then 3 else 0 end
          + case when v_metric >= 35 then 4 else 0 end;
        v_amount := least(v_amount,22);
        v_aux := 0;

      when 'paddleRally' then
        v_amount := floor(v_metric / 3.0)::integer
          + case when v_metric >= 10 then 2 else 0 end
          + case when v_metric >= 20 then 3 else 0 end
          + case when v_metric >= 35 then 5 else 0 end;
        v_amount := least(v_amount,25);
        v_aux := 0;

      when 'laneRunner' then
        v_amount := floor(v_metric / 6.0)::integer
          + floor(v_aux / 8.0)::integer
          + case when v_metric >= 20 then 2 else 0 end
          + case when v_metric >= 40 then 4 else 0 end;
        v_amount := least(v_amount,25);

      when 'safeCracker' then
        v_amount := floor(v_metric / 2.0)::integer
          + case when v_metric >= 8 then 2 else 0 end
          + case when v_metric >= 15 then 4 else 0 end
          + case when v_metric >= 25 then 5 else 0 end;
        v_amount := least(v_amount,25);
        v_aux := 0;

      when 'blockGrid' then
        v_amount := floor(v_metric / 40.0)::integer
          + case when v_metric >= 250 then 3 else 0 end
          + case when v_metric >= 500 then 5 else 0 end;
        v_amount := least(v_amount,25);
        v_aux := 0;

      when 'mergeRush' then
        v_amount := case
          when v_metric >= 50 then greatest(1, floor(v_metric / 100.0)::integer)
          else 0
        end
          + case when v_metric >= 500 then 2 else 0 end
          + case when v_metric >= 1000 then 3 else 0 end
          + case when v_metric >= 2500 then 5 else 0 end;
        v_amount := least(v_amount,25);
        v_aux := 0;

      when 'perfectDrop' then
        v_amount := case
          when v_metric >= 1 then ceil(v_metric / 3.0)::integer
          else 0
        end
          + case when v_metric >= 5 then 1 else 0 end
          + case when v_metric >= 10 then 2 else 0 end
          + case when v_metric >= 15 then 3 else 0 end
          + case when v_metric >= 20 then 5 else 0 end;
        v_amount := least(v_amount,25);
        v_aux := 0;

      when 'spiralDrop' then
        v_amount := floor(v_metric / 2.0)::integer
          + case when v_metric >= 10 then 2 else 0 end
          + case when v_metric >= 20 then 5 else 0 end;
        v_amount := least(v_amount,25);
        v_aux := 0;

      when 'shapeFit' then
        v_amount := floor(v_metric / 2.0)::integer
          + case when v_metric >= 10 then 3 else 0 end
          + case when v_metric >= 20 then 5 else 0 end;
        v_amount := least(v_amount,25);
        v_aux := 0;

      when 'bounceRun' then
        v_amount := floor(v_metric / 15.0)::integer
          + case when v_metric >= 120 then 3 else 0 end
          + case when v_metric >= 220 then 5 else 0 end;
        v_amount := least(v_amount,25);
        v_aux := 0;

      when 'trafficEscape' then
        v_amount := floor(v_metric / 2.0)::integer
          + case when v_metric >= 10 then 3 else 0 end
          + case when v_metric >= 20 then 5 else 0 end;
        v_amount := least(v_amount,25);
        v_aux := 0;

      else
        raise exception 'Unknown game';
    end case;

    v_source_type := 'game';

  elsif v_kind = 'daily_bonus' then
    select count(*)::integer
      into v_count
    from public.coin_ledger l
    where l.user_id = v_user_id
      and l.source_type = 'daily_bonus'
      and l.created_at >= v_day_start;

    if v_count > 0 then
      raise exception 'Daily bonus already recorded';
    end if;

    v_source_type := 'daily_bonus';
    v_amount := 10;
    v_game := null;
    v_metric := null;
    v_aux := null;

  elsif v_kind = 'daily_challenge' then
    v_date_text := to_char((now() at time zone 'UTC')::date,'YYYYMMDD');
    for v_i in 1..length(v_date_text) loop
      v_digit_sum := v_digit_sum + substr(v_date_text,v_i,1)::integer;
    end loop;

    v_expected_9 := v_all_challenges[(v_digit_sum % 9) + 1];
    v_expected_14 := v_all_challenges[(v_digit_sum % 14) + 1];
    v_expected_21 := v_all_challenges[(v_digit_sum % 21) + 1];

    if v_challenge is null or not (v_challenge = any(array[v_expected_9,v_expected_14,v_expected_21])) then
      raise exception 'That is not today''s server challenge';
    end if;

    select count(*)::integer
      into v_count
    from public.coin_ledger l
    where l.user_id = v_user_id
      and l.source_type = 'daily_challenge'
      and l.created_at >= v_day_start;

    if v_count > 0 then
      raise exception 'Daily challenge already recorded';
    end if;

    v_amount := case v_challenge
      when 'variety' then 8
      when 'snake10' then 10
      when 'block3' then 8
      when 'tap20' then 8
      when 'dodger15' then 8
      when 'brick15' then 8
      when 'jungle8' then 10
      when 'tower10' then 10
      when 'memory' then 8
      when 'coinCatch15' then 10
      when 'colorMatch18' then 10
      when 'paddleRally12' then 10
      when 'laneRunner20' then 10
      when 'safeCracker8' then 10
      when 'blockGrid250' then 10
      when 'mergeRush800' then 10
      when 'perfectDrop10' then 10
      when 'spiralDrop10' then 10
      when 'shapeFit10' then 10
      when 'bounceRun100' then 10
      when 'trafficEscape10' then 10
      else 0
    end;

    v_source_type := 'daily_challenge';
    v_game := null;
    v_metric := null;
    v_aux := null;

  else
    raise exception 'Unsupported reward type';
  end if;

  select a.applied, a.balance, a.lifetime_earned, a.ledger_id
    into v_applied, v_balance, v_lifetime, v_ledger_id
  from public.apply_coin_ledger_event(
    v_user_id,
    v_event_id,
    v_source_type,
    v_source_label,
    v_game,
    v_metric,
    v_aux,
    v_amount
  ) a;

  return jsonb_build_object(
    'ok', true,
    'duplicate', not coalesce(v_applied,false),
    'amount', v_amount,
    'wallet', jsonb_build_object(
      'balance', coalesce(v_balance,0),
      'lifetime_earned', coalesce(v_lifetime,0)
    ),
    'ledger_id', v_ledger_id,
    'server_day', to_char((now() at time zone 'UTC')::date,'YYYY-MM-DD')
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.coin_play_action(p_user_id uuid, p_game text, p_request_id uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE w public.coin_wallets; receipt public.coin_play_receipts; plays integer;
BEGIN
 IF p_action NOT IN ('buy','consume') OR p_game NOT IN ('snake','blockDrop','tapRush','memory','brickBreaker','jungleHopper','towerStack','coinCatch','colorMatch','paddleRally','laneRunner','safeCracker','neonDrift','mergeRush','perfectDrop','spiralDrop','shapeFit','bounceRun','trafficEscape','starDefender','neonBreach','neonMaze') THEN RAISE EXCEPTION 'INVALID_GAME'; END IF;
 SELECT * INTO w FROM public.coin_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_UNAVAILABLE'; END IF;
 INSERT INTO public.coin_play_credits(user_id,game) VALUES(p_user_id,p_game) ON CONFLICT DO NOTHING;
 SELECT * INTO receipt FROM public.coin_play_receipts WHERE user_id=p_user_id AND request_id=p_request_id;
 IF FOUND THEN
  IF receipt.game<>p_game OR receipt.action<>p_action THEN RAISE EXCEPTION 'REQUEST_REUSED'; END IF;
 ELSE
  IF p_action='buy' THEN
   IF w.balance<25 THEN RAISE EXCEPTION 'INSUFFICIENT_COINS'; END IF;
   UPDATE public.coin_wallets SET balance=balance-25,updated_at=now() WHERE user_id=p_user_id RETURNING * INTO w;
   UPDATE public.coin_play_credits SET remaining=remaining+3 WHERE user_id=p_user_id AND game=p_game;
  ELSE
   UPDATE public.coin_play_credits SET remaining=remaining-1 WHERE user_id=p_user_id AND game=p_game AND remaining>0;
   IF NOT FOUND THEN RAISE EXCEPTION 'NO_PLAYS'; END IF;
  END IF;
  INSERT INTO public.coin_play_receipts(user_id,request_id,game,action) VALUES(p_user_id,p_request_id,p_game,p_action);
 END IF;
 SELECT remaining INTO plays FROM public.coin_play_credits WHERE user_id=p_user_id AND game=p_game;
 RETURN jsonb_build_object('remaining',plays,'requestId',p_request_id,'game',p_game,'wallet',jsonb_build_object('balance',w.balance::text,'lifetime_earned',w.lifetime_earned::text));
END $function$
;
