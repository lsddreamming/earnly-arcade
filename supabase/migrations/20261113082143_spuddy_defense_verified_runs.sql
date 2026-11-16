-- Isolated game tables. Only the authenticated replay service may mutate them.
-- Never expose these SECURITY DEFINER RPCs to browser roles.
CREATE TABLE public.spuddy_defense_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 map text NOT NULL,mode text NOT NULL,seed bigint NOT NULL,challenge jsonb,
 snapshot jsonb NOT NULL,sequence integer NOT NULL DEFAULT 0,ticks bigint NOT NULL DEFAULT 0,
 earned integer NOT NULL DEFAULT 0,finished boolean NOT NULL DEFAULT false,last_receipt jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX spuddy_defense_runs_owner ON public.spuddy_defense_runs(user_id,created_at);
CREATE TABLE public.spuddy_defense_progress (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 xp bigint NOT NULL DEFAULT 0,bosses bigint NOT NULL DEFAULT 0,wins integer NOT NULL DEFAULT 0,
 mastery jsonb NOT NULL DEFAULT '[0,0,0,0,0,0,0,0]'
);
CREATE TABLE public.spuddy_defense_bests (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,map text NOT NULL,mode text NOT NULL,
 challenge_id text NOT NULL DEFAULT '',wave integer NOT NULL,kills bigint NOT NULL,achieved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,map,mode,challenge_id)
);
ALTER TABLE public.spuddy_defense_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spuddy_defense_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spuddy_defense_bests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.spuddy_defense_runs,public.spuddy_defense_progress,public.spuddy_defense_bests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.spuddy_defense_runs,public.spuddy_defense_progress,public.spuddy_defense_bests TO service_role;

CREATE FUNCTION public.spuddy_defense_start(p_user_id uuid,p_snapshot jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.spuddy_defense_runs; best integer; required_wave integer; m text:=p_snapshot->>'map'; mode_id text:=p_snapshot->>'mode';
BEGIN
 IF p_user_id IS NULL OR m IS NULL OR m NOT IN ('meadows','city','tropical','factory','neon') OR mode_id IS NULL OR mode_id NOT IN ('easy','normal','hard','endless') OR (p_snapshot->>'version')::integer<>1 OR (p_snapshot->>'tick')::integer<>0 THEN RAISE EXCEPTION 'INVALID_RUN'; END IF;
 INSERT INTO public.coin_wallets(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM public.coin_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF (SELECT count(*) FROM public.spuddy_defense_runs WHERE user_id=p_user_id AND created_at>now()-interval '1 hour')>=30 THEN RAISE EXCEPTION 'ROUND_LIMIT'; END IF;
 INSERT INTO public.spuddy_defense_progress(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 IF p_snapshot->'challenge' IS NULL OR p_snapshot->'challenge'='null'::jsonb THEN
  SELECT coalesce(max(wave),0) INTO best FROM public.spuddy_defense_bests WHERE user_id=p_user_id;
  required_wave:=greatest(CASE m WHEN 'city' THEN 8 WHEN 'tropical' THEN 16 WHEN 'factory' THEN 24 WHEN 'neon' THEN 32 ELSE 0 END,CASE mode_id WHEN 'hard' THEN 20 WHEN 'endless' THEN 40 ELSE 0 END);
  IF best<required_wave THEN RAISE EXCEPTION 'CONTENT_LOCKED'; END IF;
 END IF;
 UPDATE public.spuddy_defense_runs SET finished=true WHERE user_id=p_user_id AND NOT finished;
 INSERT INTO public.spuddy_defense_runs(user_id,map,mode,seed,challenge,snapshot) VALUES(p_user_id,m,mode_id,(p_snapshot->>'seed')::bigint,nullif(p_snapshot->'challenge','null'::jsonb),p_snapshot) RETURNING * INTO r;
 RETURN jsonb_build_object('id',r.id,'userId',r.user_id,'map',r.map,'mode',r.mode,'seed',r.seed,'challenge',r.challenge);
END $$;

CREATE FUNCTION public.spuddy_defense_checkpoint(p_user_id uuid,p_id uuid,p_sequence integer,p_snapshot jsonb,p_ticks integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.spuddy_defense_runs; w public.coin_wallets; p public.spuddy_defense_progress; wave integer; kills bigint; v_bosses integer; v_finished boolean; eligible integer; spent integer; amount integer; receipt jsonb; v_mastery jsonb; v_challenge_id text;
BEGIN
 IF p_sequence IS NULL OR p_sequence<0 OR p_ticks IS NULL OR p_ticks NOT BETWEEN 0 AND 900 OR p_snapshot IS NULL THEN RAISE EXCEPTION 'INVALID_RUN'; END IF;
 SELECT * INTO w FROM public.coin_wallets WHERE user_id=p_user_id FOR UPDATE;
 SELECT * INTO r FROM public.spuddy_defense_runs WHERE id=p_id AND user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ROUND_NOT_FOUND'; END IF;
 IF p_sequence=r.sequence-1 AND r.last_receipt IS NOT NULL THEN RETURN r.last_receipt||jsonb_build_object('duplicate',true,'amount',0); END IF;
 IF p_sequence<>r.sequence OR r.finished THEN RAISE EXCEPTION 'SEQUENCE_CONFLICT'; END IF;
 IF (r.ticks+p_ticks)::double precision/60>extract(epoch FROM now()-r.created_at)+2 THEN RAISE EXCEPTION 'ROUND_TOO_FAST'; END IF;
 IF p_snapshot->>'map'<>r.map OR p_snapshot->>'mode'<>r.mode OR (p_snapshot->>'tick')::bigint<>r.ticks+p_ticks THEN RAISE EXCEPTION 'INVALID_RUN'; END IF;
 wave:=(p_snapshot->>'completed')::integer;kills:=(p_snapshot->>'kills')::bigint;v_bosses:=(p_snapshot->>'bosses')::integer;v_finished:=p_snapshot->>'phase' IN ('won','lost');
 SELECT * INTO p FROM public.spuddy_defense_progress WHERE user_id=p_user_id FOR UPDATE;
 SELECT jsonb_agg((p.mastery->>i)::bigint+greatest(0,(p_snapshot->'mastery'->>i)::bigint-(r.snapshot->'mastery'->>i)::bigint) ORDER BY i) INTO v_mastery FROM generate_series(0,7) i;
 UPDATE public.spuddy_defense_progress SET xp=xp+greatest(0,wave-(r.snapshot->>'completed')::integer)*25,bosses=spuddy_defense_progress.bosses+greatest(0,v_bosses-(r.snapshot->>'bosses')::integer),wins=wins+CASE WHEN p_snapshot->>'phase'='won' THEN 1 ELSE 0 END,mastery=v_mastery WHERE user_id=p_user_id;
 v_challenge_id:=coalesce(r.challenge->>'id','');
 INSERT INTO public.spuddy_defense_bests(user_id,map,mode,challenge_id,wave,kills) VALUES(p_user_id,r.map,r.mode,v_challenge_id,wave,kills)
 ON CONFLICT(user_id,map,mode,challenge_id) DO UPDATE SET wave=excluded.wave,kills=excluded.kills,achieved_at=now() WHERE (excluded.wave,excluded.kills)>(spuddy_defense_bests.wave,spuddy_defense_bests.kills);
 -- Five coins per ten cleared waves, plus five for a win; max 50/run and 60/account/day.
 eligible:=least(50,(wave/10)*5+CASE WHEN p_snapshot->>'phase'='won' THEN 5 ELSE 0 END);
 SELECT coalesce(sum(l.amount),0)::integer INTO spent FROM public.coin_ledger l WHERE user_id=p_user_id AND game='spuddyDefense' AND source_type='game' AND created_at>=(date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');
 amount:=greatest(0,least(eligible-r.earned,60-spent));
 IF amount>0 THEN PERFORM * FROM public.apply_coin_ledger_event(p_user_id,'spuddy-defense:'||r.id||':'||p_sequence,'game','Spuddy Defense waves','spuddyDefense',wave,least(2147483647,kills)::integer,amount); END IF;
 SELECT * INTO w FROM public.coin_wallets WHERE user_id=p_user_id;
 receipt:=jsonb_build_object('ok',true,'sequence',p_sequence+1,'wave',wave,'amount',amount,'earned',r.earned+amount,'finished',v_finished,'wallet',jsonb_build_object('balance',w.balance::text,'lifetime_earned',w.lifetime_earned::text));
 UPDATE public.spuddy_defense_runs SET snapshot=p_snapshot,sequence=sequence+1,ticks=ticks+p_ticks,earned=earned+amount,finished=v_finished,updated_at=now(),last_receipt=receipt WHERE id=r.id;
 RETURN receipt;
END $$;

CREATE FUNCTION public.spuddy_defense_profile(p_user_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('profile',jsonb_build_object('xp',coalesce(p.xp,0),'bosses',coalesce(p.bosses,0),'wins',coalesce(p.wins,0),'mastery',coalesce(p.mastery,'[0,0,0,0,0,0,0,0]'::jsonb),'best',coalesce((SELECT jsonb_object_agg(b.map||':'||b.mode,jsonb_build_object('wave',b.wave,'kills',b.kills)) FROM public.spuddy_defense_bests b WHERE b.user_id=p_user_id AND b.challenge_id=''),'{}'::jsonb),'challenges',coalesce((SELECT jsonb_object_agg(b.challenge_id,b.wave) FROM public.spuddy_defense_bests b WHERE b.user_id=p_user_id AND b.challenge_id<>''),'{}'::jsonb)),
 'run',(SELECT to_jsonb(r)-'last_receipt' FROM public.spuddy_defense_runs r WHERE r.user_id=p_user_id AND NOT r.finished ORDER BY r.created_at DESC LIMIT 1))
 FROM (SELECT p_user_id AS user_id) u LEFT JOIN public.spuddy_defense_progress p USING(user_id);
$$;
CREATE FUNCTION public.spuddy_defense_leaderboard(p_map text,p_mode text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(row_to_json(t)),'[]'::jsonb) FROM (
  SELECT p.username,b.wave,b.kills,true AS verified FROM public.spuddy_defense_bests b JOIN public.profiles p USING(user_id)
  WHERE b.map=p_map AND b.mode=p_mode AND b.challenge_id='' AND p.username IS NOT NULL AND b.wave>0 AND NOT EXISTS(SELECT 1 FROM public.leaderboard_bans x WHERE x.user_id=b.user_id)
  ORDER BY b.wave DESC,b.kills DESC,b.achieved_at ASC LIMIT 10
 )t;
$$;
REVOKE ALL ON FUNCTION public.spuddy_defense_start(uuid,jsonb),public.spuddy_defense_checkpoint(uuid,uuid,integer,jsonb,integer),public.spuddy_defense_profile(uuid),public.spuddy_defense_leaderboard(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.spuddy_defense_start(uuid,jsonb),public.spuddy_defense_checkpoint(uuid,uuid,integer,jsonb,integer),public.spuddy_defense_profile(uuid),public.spuddy_defense_leaderboard(text,text) TO service_role;
