-- Add completed Crystal Command wins to the existing earned-coin ledger.
-- Keep every existing formula, balance, permission and idempotency check intact.
DO $migration$
DECLARE original text; updated text;
BEGIN
 SELECT pg_get_functiondef('public.claim_coin_reward(text,text,text,integer,integer,text,text)'::regprocedure) INTO original;
 IF position('when ''crystalCommand'' then' in original)>0 THEN RETURN; END IF;
 IF position('    case v_game' in original)=0 THEN RAISE EXCEPTION 'Reward function changed; review migration'; END IF;
 updated:=replace(original,'    case v_game',$cases$    case v_game
      when 'crystalCommand' then
        -- Metric: defeated units; aux: completed battle seconds. Only the win
        -- path submits these, never lessons, quits, draws or disconnects.
        if v_metric < 1 or v_aux < 60 then raise exception 'Invalid battle result'; end if;
        v_amount := 10 + least(15, floor(v_metric / 3.0)::integer);
$cases$);
 EXECUTE updated;
END $migration$;
