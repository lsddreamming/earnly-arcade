-- Release candidate only: do not apply or enable the Edge Function without owner approval.
-- Existing games, payment rules and generic client reward APIs are unchanged.
CREATE TABLE public.metal_mayhem_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 seed bigint NOT NULL CHECK(seed BETWEEN 1 AND 4294967295),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 snapshot jsonb, sequence integer NOT NULL DEFAULT 0, ticks bigint NOT NULL DEFAULT 0,
 earned integer NOT NULL DEFAULT 0, finished boolean NOT NULL DEFAULT false, last_receipt jsonb
);
CREATE INDEX metal_mayhem_owner_time ON public.metal_mayhem_runs(user_id,created_at);
CREATE TABLE public.metal_mayhem_bests (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 score integer NOT NULL CHECK(score>=0),wave integer NOT NULL CHECK(wave>=1),kills integer NOT NULL CHECK(kills>=0),
 survival_seconds double precision NOT NULL,achieved_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.metal_mayhem_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metal_mayhem_bests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.metal_mayhem_runs,public.metal_mayhem_bests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.metal_mayhem_runs,public.metal_mayhem_bests TO service_role;
CREATE FUNCTION public.metal_mayhem_start(p_user_id uuid,p_seed bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.metal_mayhem_runs;
BEGIN
 IF p_user_id IS NULL OR p_seed IS NULL OR p_seed NOT BETWEEN 1 AND 4294967295 THEN RAISE EXCEPTION 'INVALID_RUN'; END IF;
 INSERT INTO public.coin_wallets(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM public.coin_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF (SELECT count(*) FROM public.metal_mayhem_runs WHERE user_id=p_user_id AND created_at>now()-interval '1 hour')>=30 THEN RAISE EXCEPTION 'ROUND_LIMIT'; END IF;
 UPDATE public.metal_mayhem_runs SET finished=true WHERE user_id=p_user_id AND NOT finished;
 INSERT INTO public.metal_mayhem_runs(user_id,seed) VALUES(p_user_id,p_seed) RETURNING * INTO r;
 RETURN jsonb_build_object('id',r.id,'userId',r.user_id,'seed',r.seed);
END $$;
CREATE FUNCTION public.metal_mayhem_checkpoint(p_user_id uuid,p_id uuid,p_sequence integer,p_snapshot jsonb,p_ticks integer,p_score integer,p_wave integer,p_kills integer,p_time double precision,p_finished boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.metal_mayhem_runs; w public.coin_wallets;eligible integer;amount integer;spent integer;receipt jsonb;
BEGIN
 IF p_score IS NULL OR p_score<0 OR p_wave IS NULL OR p_wave<1 OR p_kills IS NULL OR p_kills<0 OR p_time IS NULL OR NOT(p_time>=0 AND p_time<1e12) OR p_ticks IS NULL OR p_ticks NOT BETWEEN 0 AND 900 OR p_sequence IS NULL OR p_sequence<0 OR p_snapshot IS NULL OR p_finished IS NULL THEN RAISE EXCEPTION 'INVALID_RUN'; END IF;
 SELECT * INTO w FROM public.coin_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_UNAVAILABLE'; END IF;
 SELECT * INTO r FROM public.metal_mayhem_runs WHERE id=p_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ROUND_NOT_FOUND'; END IF;
 IF p_sequence=r.sequence-1 AND r.last_receipt IS NOT NULL THEN RETURN r.last_receipt||jsonb_build_object('duplicate',true,'amount',0); END IF;
 IF p_sequence<>r.sequence OR r.finished THEN RAISE EXCEPTION 'SEQUENCE_CONFLICT'; END IF;
 IF r.updated_at<now()-interval '24 hours' THEN RAISE EXCEPTION 'ROUND_EXPIRED'; END IF;
 IF (r.ticks+p_ticks)::double precision/30>extract(epoch FROM now()-r.created_at)+2 THEN RAISE EXCEPTION 'ROUND_TOO_FAST'; END IF;
 -- Same conservative 100/day ceiling as Big Fish; all three milestones required.
 -- No rewards for idle survival: five coins requires 90 active seconds, 10 kills,
 -- and 3 completed waves. Repeated new runs share the account's daily cap.
 eligible:=least(100,floor(p_time/90)*5,floor(p_kills/10.0)*5,floor((p_wave-1)/3.0)*5)::integer;
 SELECT coalesce(sum(l.amount),0)::integer INTO spent FROM public.coin_ledger l WHERE user_id=p_user_id AND game='metalMayhem' AND source_type='game' AND created_at>=(date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');
 amount:=greatest(0,least(eligible-r.earned,100-spent));
 IF amount>0 THEN PERFORM * FROM public.apply_coin_ledger_event(p_user_id,'metal-mayhem:'||r.id||':'||p_sequence,'game','Metal Mayhem survival','metalMayhem',p_score,p_wave,amount); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.leaderboard_bans WHERE user_id=p_user_id) THEN
  INSERT INTO public.metal_mayhem_bests(user_id,score,wave,kills,survival_seconds) VALUES(p_user_id,p_score,p_wave,p_kills,p_time)
  ON CONFLICT(user_id) DO UPDATE SET score=excluded.score,wave=excluded.wave,kills=excluded.kills,survival_seconds=excluded.survival_seconds,achieved_at=now() WHERE excluded.score>public.metal_mayhem_bests.score;
 END IF;
 SELECT * INTO w FROM public.coin_wallets WHERE user_id=p_user_id;
 receipt:=jsonb_build_object('ok',true,'sequence',p_sequence+1,'score',p_score,'wave',p_wave,'amount',amount,'earned',r.earned+amount,'finished',p_finished,'wallet',jsonb_build_object('balance',w.balance::text,'lifetime_earned',w.lifetime_earned::text));
 UPDATE public.metal_mayhem_runs SET snapshot=p_snapshot,sequence=sequence+1,ticks=ticks+p_ticks,earned=earned+amount,finished=p_finished,updated_at=now(),last_receipt=receipt WHERE id=r.id;
 RETURN receipt;
END $$;
CREATE FUNCTION public.metal_mayhem_leaderboard() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(row_to_json(t)),'[]'::jsonb) FROM (
  SELECT p.username,b.score,b.wave,b.kills,true AS verified FROM public.metal_mayhem_bests b JOIN public.profiles p USING(user_id)
  WHERE p.username IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.leaderboard_bans x WHERE x.user_id=b.user_id)
  ORDER BY b.score DESC,b.achieved_at ASC LIMIT 10
 )t;
$$;
REVOKE ALL ON FUNCTION public.metal_mayhem_start(uuid,bigint),public.metal_mayhem_checkpoint(uuid,uuid,integer,jsonb,integer,integer,integer,integer,double precision,boolean),public.metal_mayhem_leaderboard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.metal_mayhem_start(uuid,bigint),public.metal_mayhem_checkpoint(uuid,uuid,integer,jsonb,integer,integer,integer,integer,double precision,boolean),public.metal_mayhem_leaderboard() TO service_role;
