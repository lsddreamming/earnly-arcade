-- Only the authenticated replay verifier may open tickets or settle rewards.
CREATE TABLE public.neon_slice_rounds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 seed bigint NOT NULL CHECK(seed BETWEEN 1 AND 4294967295),
 created_at timestamptz NOT NULL DEFAULT now(), claimed_at timestamptz, score integer, amount integer,
 CHECK(score IS NULL OR score>=0), CHECK(amount IS NULL OR amount BETWEEN 0 AND 30)
);
CREATE INDEX neon_slice_owner_time ON public.neon_slice_rounds(user_id,created_at);
ALTER TABLE public.neon_slice_rounds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.neon_slice_rounds FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.neon_slice_rounds TO service_role;
CREATE FUNCTION public.neon_slice_start(p_user_id uuid,p_seed bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.neon_slice_rounds; used integer;
BEGIN
 IF p_user_id IS NULL OR p_seed IS NULL OR p_seed NOT BETWEEN 1 AND 4294967295 THEN RAISE EXCEPTION 'INVALID_RUN'; END IF;
 INSERT INTO public.coin_wallets(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM public.coin_wallets WHERE user_id=p_user_id FOR UPDATE;
 SELECT count(*) INTO used FROM public.neon_slice_rounds WHERE user_id=p_user_id AND amount>0 AND claimed_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 IF used>=3 THEN RETURN jsonb_build_object('practice',true,'remaining',0); END IF;
 IF (SELECT count(*) FROM public.neon_slice_rounds WHERE user_id=p_user_id AND created_at>now()-interval '1 hour')>=120 THEN RAISE EXCEPTION 'ROUND_LIMIT'; END IF;
 INSERT INTO public.neon_slice_rounds(user_id,seed) VALUES(p_user_id,p_seed) RETURNING * INTO r;
 RETURN jsonb_build_object('id',r.id,'seed',r.seed,'userId',r.user_id,'remaining',3-used);
END $$;
CREATE FUNCTION public.neon_slice_claim(p_user_id uuid,p_round_id uuid,p_score integer,p_ticks integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.neon_slice_rounds; w public.coin_wallets; earned integer; used integer; duplicate boolean;
BEGIN
 IF p_user_id IS NULL OR p_score IS NULL OR p_score NOT BETWEEN 0 AND 100000 OR p_ticks IS NULL OR p_ticks NOT BETWEEN 1 AND 10800 THEN RAISE EXCEPTION 'INVALID_RUN'; END IF;
 SELECT * INTO w FROM public.coin_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_UNAVAILABLE'; END IF;
 SELECT * INTO r FROM public.neon_slice_rounds WHERE id=p_round_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ROUND_NOT_FOUND'; END IF;
 duplicate:=r.claimed_at IS NOT NULL;
 SELECT count(*) INTO used FROM public.neon_slice_rounds WHERE user_id=p_user_id AND amount>0 AND claimed_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 earned:=0;
 IF NOT duplicate THEN
  IF r.created_at<now()-interval '24 hours' THEN RAISE EXCEPTION 'ROUND_EXPIRED'; END IF;
  IF now()<r.created_at+make_interval(secs=>p_ticks/60.0) THEN RAISE EXCEPTION 'ROUND_TOO_FAST'; END IF;
  earned:=CASE WHEN used>=3 THEN 0 ELSE least(30,p_score/50) END;
  IF earned>0 THEN
   PERFORM * FROM public.apply_coin_ledger_event(p_user_id,'neon-slice:'||r.id,'game','Neon Slice','neonSlice',p_score,p_ticks,earned);
   used:=used+1;
  END IF;
  UPDATE public.neon_slice_rounds SET claimed_at=now(),score=p_score,amount=earned WHERE id=r.id;
 END IF;
 SELECT * INTO w FROM public.coin_wallets WHERE user_id=p_user_id;
 RETURN jsonb_build_object('ok',true,'duplicate',duplicate,'amount',earned,'remaining',greatest(0,3-used),'wallet',jsonb_build_object('balance',w.balance::text,'lifetime_earned',w.lifetime_earned::text));
END $$;
REVOKE ALL ON FUNCTION public.neon_slice_start(uuid,bigint),public.neon_slice_claim(uuid,uuid,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.neon_slice_start(uuid,bigint),public.neon_slice_claim(uuid,uuid,integer,integer) TO service_role;
