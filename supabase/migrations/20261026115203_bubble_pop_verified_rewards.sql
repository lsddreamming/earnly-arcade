-- Only the authenticated Edge verifier can open tickets or mint verified wins.
CREATE TABLE public.bubble_pop_rounds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 level integer NOT NULL CHECK(level BETWEEN 0 AND 999), seed bigint NOT NULL CHECK(seed BETWEEN 1 AND 4294967295),
 created_at timestamptz NOT NULL DEFAULT now(), claimed_at timestamptz, stars integer CHECK(stars BETWEEN 1 AND 3)
);
CREATE INDEX bubble_pop_rounds_owner_time ON public.bubble_pop_rounds(user_id,created_at);
CREATE TABLE public.bubble_pop_rewards (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, level integer NOT NULL CHECK(level BETWEEN 0 AND 999),
 round_id uuid NOT NULL REFERENCES public.bubble_pop_rounds(id), stars integer NOT NULL CHECK(stars BETWEEN 1 AND 3),
 amount integer NOT NULL, bonus integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,level)
);
ALTER TABLE public.bubble_pop_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bubble_pop_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bubble_pop_rounds,public.bubble_pop_rewards FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bubble_pop_rounds,public.bubble_pop_rewards TO service_role;

CREATE FUNCTION public.bubble_pop_start(p_user_id uuid,p_level integer,p_seed bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bubble_pop_rounds;
BEGIN
 IF p_user_id IS NULL OR p_level IS NULL OR p_level NOT BETWEEN 0 AND 999 OR p_seed IS NULL OR p_seed NOT BETWEEN 1 AND 4294967295 THEN RAISE EXCEPTION 'INVALID_ROUND'; END IF;
 INSERT INTO public.coin_wallets(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM public.coin_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF (SELECT count(*) FROM public.bubble_pop_rounds WHERE user_id=p_user_id AND created_at>now()-interval '1 hour')>=120 THEN RAISE EXCEPTION 'ROUND_LIMIT'; END IF;
 INSERT INTO public.bubble_pop_rounds(user_id,level,seed) VALUES(p_user_id,p_level,p_seed) RETURNING * INTO r;
 RETURN jsonb_build_object('id',r.id,'level',r.level,'seed',r.seed,'userId',r.user_id);
END $$;

CREATE FUNCTION public.bubble_pop_claim(p_user_id uuid,p_round_id uuid,p_stars integer,p_turns integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bubble_pop_rounds; receipt public.bubble_pop_rewards; w public.coin_wallets; base integer; bonus integer; duplicate boolean;
BEGIN
 IF p_user_id IS NULL OR p_stars IS NULL OR p_stars NOT BETWEEN 1 AND 3 OR p_turns IS NULL OR p_turns NOT BETWEEN 1 AND 40 THEN RAISE EXCEPTION 'INVALID_RESULT'; END IF;
 -- Serialize all tickets and awards for this account; concurrent rounds cannot evade the daily cap.
 SELECT * INTO w FROM public.coin_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_UNAVAILABLE'; END IF;
 SELECT * INTO r FROM public.bubble_pop_rounds WHERE id=p_round_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ROUND_NOT_FOUND'; END IF;
 SELECT * INTO receipt FROM public.bubble_pop_rewards WHERE user_id=p_user_id AND level=r.level;
 duplicate:=FOUND;
 IF NOT duplicate THEN
  IF r.created_at<now()-interval '24 hours' THEN RAISE EXCEPTION 'ROUND_EXPIRED'; END IF;
  IF now()<r.created_at+make_interval(secs=>p_turns*0.25) THEN RAISE EXCEPTION 'ROUND_TOO_FAST'; END IF;
  IF (SELECT count(*) FROM public.coin_ledger WHERE user_id=p_user_id AND game='bubblePop' AND source_type='game' AND client_event_id LIKE 'bubble-pop:level:%' AND created_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')>=9 THEN RAISE EXCEPTION 'DAILY_REWARD_LIMIT'; END IF;
  base:=15+CASE p_stars WHEN 2 THEN 10 WHEN 3 THEN 20 ELSE 0 END;
  bonus:=CASE WHEN (r.level+1)%10=0 THEN 100 ELSE 0 END;
  INSERT INTO public.bubble_pop_rewards(user_id,level,round_id,stars,amount,bonus) VALUES(p_user_id,r.level,r.id,p_stars,base,bonus) RETURNING * INTO receipt;
  PERFORM * FROM public.apply_coin_ledger_event(p_user_id,'bubble-pop:level:'||r.level,'game','Bubble Pop level '||(r.level+1),'bubblePop',r.level+1,p_stars,base);
  IF bonus>0 THEN
   PERFORM * FROM public.apply_coin_ledger_event(p_user_id,'bubble-pop:milestone:'||(r.level+1),'game','Bubble Pop milestone '||(r.level+1),'bubblePop',r.level+1,p_stars,bonus);
  END IF;
  UPDATE public.bubble_pop_rounds SET claimed_at=now(),stars=p_stars WHERE id=r.id;
 END IF;
 SELECT * INTO w FROM public.coin_wallets WHERE user_id=p_user_id;
 RETURN jsonb_build_object('ok',true,'duplicate',duplicate,'amount',CASE WHEN duplicate THEN 0 ELSE receipt.amount END,'bonus',CASE WHEN duplicate THEN 0 ELSE receipt.bonus END,'stars',receipt.stars,'wallet',jsonb_build_object('balance',w.balance::text,'lifetime_earned',w.lifetime_earned::text));
END $$;
REVOKE ALL ON FUNCTION public.bubble_pop_start(uuid,integer,bigint),public.bubble_pop_claim(uuid,uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bubble_pop_start(uuid,integer,bigint),public.bubble_pop_claim(uuid,uuid,integer,integer) TO service_role;
