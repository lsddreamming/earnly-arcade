-- Purchase receipt environment must not determine gameplay eligibility.
-- Keep sandbox wallets/receipts and production checkout restrictions intact.
-- Normal authenticated leaderboard submission, score bounds and bans still apply.
DROP TRIGGER IF EXISTS apple_sandbox_unranked ON public.leaderboard_scores;

-- Recover only scores evidenced by the server game ledger for affected accounts.
-- Never infer scores from wallet balances or client backups; preserve better scores.
WITH candidates AS (
 SELECT DISTINCT ON (l.user_id,l.game)
  l.user_id,l.game,l.metric AS score,l.created_at AS achieved_at
 FROM public.coin_ledger l
 JOIN public.apple_sandbox_accounts a USING(user_id)
 JOIN public.profiles p USING(user_id)
 WHERE l.source_type='game' AND p.username IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM public.leaderboard_bans b WHERE b.user_id=l.user_id)
 AND l.metric BETWEEN 1 AND CASE
  WHEN l.game IN ('snake','blockDrop','tapRush','memory','dodger','towerStack') THEN 1000000
  WHEN l.game IN ('brickBreaker','jungleHopper') THEN 100000000
  ELSE 0 END
 ORDER BY l.user_id,l.game,
  CASE WHEN l.game='memory' THEN l.metric ELSE -l.metric END,
  l.created_at
)
INSERT INTO public.leaderboard_scores(user_id,game,score,verified,achieved_at,updated_at)
 SELECT user_id,game,score,true,achieved_at,now() FROM candidates
ON CONFLICT(user_id,game) DO UPDATE SET
 score=EXCLUDED.score,verified=true,achieved_at=EXCLUDED.achieved_at,updated_at=now()
WHERE CASE WHEN EXCLUDED.game='memory'
 THEN EXCLUDED.score < leaderboard_scores.score
 ELSE EXCLUDED.score > leaderboard_scores.score END;
