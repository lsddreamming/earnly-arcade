-- Preserve the existing game allowlist and add verified Neon Slice rankings.
DO $$ DECLARE rule text; BEGIN
 SELECT pg_get_expr(conbin,conrelid) INTO rule FROM pg_constraint
 WHERE conrelid='public.leaderboard_scores'::regclass AND conname='leaderboard_scores_game_check';
 IF rule IS NULL THEN RAISE EXCEPTION 'Leaderboard game constraint missing'; END IF;
 ALTER TABLE public.leaderboard_scores DROP CONSTRAINT leaderboard_scores_game_check;
 EXECUTE 'ALTER TABLE public.leaderboard_scores ADD CONSTRAINT leaderboard_scores_game_check CHECK ((' || rule || ') OR game = ''neonSlice'')';
END $$;

-- Runs are written only by the authenticated replay verifier. Keep ranking atomic
-- with settlement, even when a run earns zero coins. Clients cannot invoke this.
CREATE FUNCTION public.neon_slice_rank_verified() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.claimed_at IS NOT NULL AND NEW.score BETWEEN 1 AND 100000
 AND NOT EXISTS (SELECT 1 FROM public.leaderboard_bans WHERE user_id=NEW.user_id) THEN
  INSERT INTO public.leaderboard_scores(user_id,game,score,verified,achieved_at,updated_at)
  VALUES(NEW.user_id,'neonSlice',NEW.score,true,NEW.claimed_at,now())
  ON CONFLICT(user_id,game) DO UPDATE SET score=EXCLUDED.score,verified=true,
   achieved_at=EXCLUDED.achieved_at,updated_at=now()
  WHERE EXCLUDED.score>leaderboard_scores.score;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.neon_slice_rank_verified() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER neon_slice_rank_verified AFTER UPDATE OF claimed_at ON public.neon_slice_rounds
FOR EACH ROW WHEN (OLD.claimed_at IS NULL AND NEW.claimed_at IS NOT NULL)
EXECUTE FUNCTION public.neon_slice_rank_verified();

-- Restore historical replay-verified scores, never device-only bests.
INSERT INTO public.leaderboard_scores(user_id,game,score,verified,achieved_at,updated_at)
SELECT DISTINCT ON (r.user_id) r.user_id,'neonSlice',r.score,true,r.claimed_at,now()
FROM public.neon_slice_rounds r
WHERE r.claimed_at IS NOT NULL AND r.score BETWEEN 1 AND 100000
AND NOT EXISTS (SELECT 1 FROM public.leaderboard_bans b WHERE b.user_id=r.user_id)
ORDER BY r.user_id,r.score DESC,r.claimed_at
ON CONFLICT(user_id,game) DO UPDATE SET score=EXCLUDED.score,verified=true,
 achieved_at=EXCLUDED.achieved_at,updated_at=now()
WHERE EXCLUDED.score>leaderboard_scores.score;

-- Continue verifying ranked runs after the three daily coin rewards.
CREATE OR REPLACE FUNCTION public.neon_slice_start(p_user_id uuid,p_seed bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.neon_slice_rounds; used integer;
BEGIN
 IF p_user_id IS NULL OR p_seed IS NULL OR p_seed NOT BETWEEN 1 AND 4294967295 THEN RAISE EXCEPTION 'INVALID_RUN'; END IF;
 INSERT INTO public.coin_wallets(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM public.coin_wallets WHERE user_id=p_user_id FOR UPDATE;
 SELECT count(*) INTO used FROM public.neon_slice_rounds WHERE user_id=p_user_id AND amount>0 AND claimed_at>=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 IF (SELECT count(*) FROM public.neon_slice_rounds WHERE user_id=p_user_id AND created_at>now()-interval '1 hour')>=120 THEN RAISE EXCEPTION 'ROUND_LIMIT'; END IF;
 INSERT INTO public.neon_slice_rounds(user_id,seed) VALUES(p_user_id,p_seed) RETURNING * INTO r;
 RETURN jsonb_build_object('id',r.id,'seed',r.seed,'userId',r.user_id,'remaining',greatest(0,3-used));
END $$;
