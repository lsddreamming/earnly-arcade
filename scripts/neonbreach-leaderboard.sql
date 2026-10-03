-- Idempotent production repair: preserve the existing allowlist and add Neon Breach.
-- No policies, grants, user records, or existing scores are changed.
DO $$
DECLARE rule text;
BEGIN
  SELECT pg_get_expr(conbin, conrelid) INTO STRICT rule
  FROM pg_constraint
  WHERE conrelid='public.leaderboard_scores'::regclass
    AND conname='leaderboard_scores_game_check';
  IF position('neonBreach' in rule)=0 THEN
    ALTER TABLE public.leaderboard_scores DROP CONSTRAINT leaderboard_scores_game_check;
    EXECUTE format('ALTER TABLE public.leaderboard_scores ADD CONSTRAINT leaderboard_scores_game_check CHECK ((%s) OR game = %L)', rule, 'neonBreach');
  END IF;
END $$;
