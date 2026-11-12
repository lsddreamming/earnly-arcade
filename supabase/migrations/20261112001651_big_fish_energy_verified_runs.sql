-- Server-only checkpoint state. Browser scores and snapshots are never trusted.
CREATE TABLE public.big_fish_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 seed bigint NOT NULL CHECK(seed BETWEEN 1 AND 4294967295), mode text NOT NULL CHECK(mode IN ('endless','timed','predator')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 snapshot jsonb, sequence integer NOT NULL DEFAULT 0, ticks bigint NOT NULL DEFAULT 0,
 earned integer NOT NULL DEFAULT 0, finished boolean NOT NULL DEFAULT false, last_receipt jsonb
);
CREATE INDEX big_fish_runs_owner_time ON public.big_fish_runs(user_id,created_at);
CREATE TABLE public.big_fish_bests (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 size double precision NOT NULL CHECK(size>=.3 AND size<=1e100), eaten bigint NOT NULL,
 survival_seconds double precision NOT NULL, achieved_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.big_fish_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.big_fish_bests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.big_fish_runs,public.big_fish_bests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.big_fish_runs,public.big_fish_bests TO service_role;
CREATE FUNCTION public.big_fish_start(p_user_id uuid,p_seed bigint,p_mode text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.big_fish_runs;
BEGIN
 IF p_user_id IS NULL OR p_seed IS NULL OR p_seed NOT BETWEEN 1 AND 4294967295 OR p_mode IS NULL OR p_mode NOT IN ('endless','timed','predator') THEN RAISE EXCEPTION 'INVALID_RUN'; END IF;
 INSERT INTO public.coin_wallets(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM public.coin_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF (SELECT count(*) FROM public.big_fish_runs WHERE user_id=p_user_id AND created_at>now()-interval '1 hour')>=30 THEN RAISE EXCEPTION 'ROUND_LIMIT'; END IF;
 -- Starting elsewhere ends the previous ranked run, preventing parallel reward sessions.
 UPDATE public.big_fish_runs SET finished=true WHERE user_id=p_user_id AND NOT finished;
 INSERT INTO public.big_fish_runs(user_id,seed,mode) VALUES(p_user_id,p_seed,p_mode) RETURNING * INTO r;
 RETURN jsonb_build_object('id',r.id,'userId',r.user_id,'seed',r.seed,'mode',r.mode);
END $$;
CREATE FUNCTION public.big_fish_checkpoint(p_user_id uuid,p_id uuid,p_sequence integer,p_snapshot jsonb,p_ticks integer,p_size double precision,p_eaten bigint,p_time double precision,p_finished boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.big_fish_runs; w public.coin_wallets; eligible integer; amount integer; spent integer; receipt jsonb;
BEGIN
 IF p_size IS NULL OR NOT(p_size>=.3 AND p_size<=1e100) OR p_eaten IS NULL OR p_eaten<0 OR p_time IS NULL OR NOT(p_time>=0 AND p_time<1e12) OR p_ticks IS NULL OR p_ticks NOT BETWEEN 1 AND 1800 OR p_sequence IS NULL OR p_sequence<0 OR p_snapshot IS NULL OR p_finished IS NULL THEN RAISE EXCEPTION 'INVALID_RUN'; END IF;
 SELECT * INTO w FROM public.coin_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_UNAVAILABLE'; END IF;
 SELECT * INTO r FROM public.big_fish_runs WHERE id=p_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ROUND_NOT_FOUND'; END IF;
 IF p_sequence=r.sequence-1 AND r.last_receipt IS NOT NULL THEN RETURN r.last_receipt||jsonb_build_object('duplicate',true,'amount',0); END IF;
 IF p_sequence<>r.sequence OR r.finished THEN RAISE EXCEPTION 'SEQUENCE_CONFLICT'; END IF;
 IF r.updated_at<now()-interval '24 hours' THEN RAISE EXCEPTION 'ROUND_EXPIRED'; END IF;
 IF (r.ticks+p_ticks)::double precision/30>extract(epoch FROM now()-r.created_at)+2 THEN RAISE EXCEPTION 'ROUND_TOO_FAST'; END IF;
 -- Five coins needs ALL of: 90 active seconds, 20 fish, and a doubling in size.
 -- Account-wide daily cap, including concurrent sessions, takes at least 30 active minutes.
 eligible:=least(100,floor(p_time/90)*5,floor(p_eaten/20.0)*5,floor(ln(p_size/.3)/ln(2.0))*5)::integer;
 SELECT coalesce(sum(l.amount),0)::integer INTO spent FROM public.coin_ledger l WHERE user_id=p_user_id AND game='bigFishEnergy' AND source_type='game' AND created_at>=(date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');
 amount:=greatest(0,least(eligible-r.earned,100-spent));
 IF amount>0 THEN
  PERFORM * FROM public.apply_coin_ledger_event(p_user_id,'big-fish:'||r.id||':'||p_sequence,'game','Big Fish Energy growth','bigFishEnergy',least(2147483647,floor(p_size*1000))::integer,least(2147483647,p_eaten)::integer,amount);
 END IF;
 -- Endless rankings only: timed and challenge remain separate personal stats.
 IF r.mode='endless' AND NOT EXISTS(SELECT 1 FROM public.leaderboard_bans WHERE user_id=p_user_id) THEN
  INSERT INTO public.big_fish_bests(user_id,size,eaten,survival_seconds) VALUES(p_user_id,p_size,p_eaten,p_time)
  ON CONFLICT(user_id) DO UPDATE SET size=excluded.size,eaten=excluded.eaten,survival_seconds=excluded.survival_seconds,achieved_at=now() WHERE excluded.size>public.big_fish_bests.size;
 END IF;
 SELECT * INTO w FROM public.coin_wallets WHERE user_id=p_user_id;
 receipt:=jsonb_build_object('ok',true,'sequence',p_sequence+1,'size',p_size,'eaten',p_eaten,'survivalSeconds',p_time,'amount',amount,'earned',r.earned+amount,'finished',p_finished,'wallet',jsonb_build_object('balance',w.balance::text,'lifetime_earned',w.lifetime_earned::text));
 UPDATE public.big_fish_runs SET snapshot=p_snapshot,sequence=sequence+1,ticks=ticks+p_ticks,earned=earned+amount,finished=p_finished,updated_at=now(),last_receipt=receipt WHERE id=r.id;
 RETURN receipt;
END $$;
CREATE FUNCTION public.big_fish_leaderboard() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(row_to_json(t)),'[]'::jsonb) FROM (
  SELECT p.username,b.size,b.eaten,b.survival_seconds AS "survivalSeconds",true AS verified
  FROM public.big_fish_bests b JOIN public.profiles p USING(user_id)
  WHERE p.username IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.leaderboard_bans x WHERE x.user_id=b.user_id)
  ORDER BY b.size DESC,b.achieved_at ASC LIMIT 10
 )t;
$$;
REVOKE ALL ON FUNCTION public.big_fish_start(uuid,bigint,text),public.big_fish_checkpoint(uuid,uuid,integer,jsonb,integer,double precision,bigint,double precision,boolean),public.big_fish_leaderboard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.big_fish_start(uuid,bigint,text),public.big_fish_checkpoint(uuid,uuid,integer,jsonb,integer,double precision,bigint,double precision,boolean),public.big_fish_leaderboard() TO service_role;
