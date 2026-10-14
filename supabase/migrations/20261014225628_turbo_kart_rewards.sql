-- Preserve existing authenticated ledger settlement, duplicate protection and caps.
-- Add the missing newer-game formulas and the new circuit racer.
DO $migration$
DECLARE definition text; updated text; rule text;
BEGIN
 SELECT pg_get_functiondef('public.claim_coin_reward(text,text,text,integer,integer,text,text)'::regprocedure) INTO definition;
 updated := definition;
 IF position('when ''turboKart'' then' in updated)=0 THEN
  IF position('    case v_game' in updated)=0 THEN RAISE EXCEPTION 'Reward function changed; review migration'; END IF;
  updated := replace(updated,'    case v_game', $cases$    case v_game
      when 'turboKart' then
        if v_metric < 1 or v_metric > 5 then raise exception 'Invalid kart result'; end if;
        v_aux := least(v_aux,5);
        v_amount := case v_metric when 1 then 20 when 2 then 15 when 3 then 12 when 4 then 9 else 7 end + v_aux;
$cases$);
 END IF;
 IF position('when ''neonDrift'' then' in updated)=0 THEN
  updated := replace(updated,'    case v_game', $cases$    case v_game
      when 'neonDrift' then
        v_aux := least(v_aux,20);
        v_amount := least(floor(v_metric / 100.0)::integer,25) + v_aux;
$cases$);
 END IF;
 IF position('when ''neonBreach'' then' in updated)=0 THEN
  updated := replace(updated,'    case v_game', $cases$    case v_game
      when 'neonBreach' then
        v_amount := least(floor(v_metric / 150.0)::integer,25);
$cases$);
 END IF;
 IF position('when ''starDefender'' then' in updated)=0 THEN
  updated := replace(updated,'    case v_game', $cases$    case v_game
      when 'starDefender' then
        v_amount := least(floor(v_metric / 80.0)::integer,15);
$cases$);
 END IF;
 IF position('when ''neonMaze'' then' in updated)=0 THEN
  updated := replace(updated,'    case v_game', $cases$    case v_game
      when 'neonMaze' then
        v_amount := least(floor(v_metric / 6.0)::integer,15);
$cases$);
 END IF;
 IF updated<>definition THEN EXECUTE updated; END IF;
 SELECT pg_get_functiondef('public.coin_play_action(uuid,text,uuid,text)'::regprocedure) INTO definition;
 IF position('''turboKart''' in definition)=0 THEN
  updated := replace(definition,'''neonDrift''','''neonDrift'',''turboKart''');
  IF updated=definition THEN RAISE EXCEPTION 'Play function changed; review migration'; END IF;
  EXECUTE updated;
 END IF;
 SELECT pg_get_expr(conbin,conrelid) INTO STRICT rule FROM pg_constraint
 WHERE conrelid='public.leaderboard_scores'::regclass AND conname='leaderboard_scores_game_check';
 IF position('turboKart' in rule)=0 THEN
  ALTER TABLE public.leaderboard_scores DROP CONSTRAINT leaderboard_scores_game_check;
  EXECUTE format('ALTER TABLE public.leaderboard_scores ADD CONSTRAINT leaderboard_scores_game_check CHECK ((%s) OR game = %L)',rule,'turboKart');
 END IF;
END $migration$;
