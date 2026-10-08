-- Preserve the existing reward ledger, authentication, replay protection, limits,
-- and every other game. Old clients omit aux and keep their original rewards.
DO $migration$
DECLARE
  signature regprocedure := 'public.claim_coin_reward(text,text,text,integer,integer,text,text)'::regprocedure;
  definition text;
  old_branch text := $old$      when 'jungleHopper' then
        v_amount := floor(v_metric / 2.0)::integer
          + case when v_metric >= 10 then 2 else 0 end
          + case when v_metric >= 20 then 3 else 0 end
          + case when v_metric >= 30 then 5 else 0 end;
        v_amount := least(v_amount,25);
        v_aux := 0;$old$;
  new_branch text := $new$      when 'jungleHopper' then
        -- One gold on each even vine; every sixth vine has double gold.
        -- The current vine can be collected before it is scored.
        v_aux := least(v_aux, (v_metric + 1) / 2 + (v_metric + 1) / 6, 25);
        v_amount := floor(v_metric / 2.0)::integer
          + case when v_metric >= 10 then 2 else 0 end
          + case when v_metric >= 20 then 3 else 0 end
          + case when v_metric >= 30 then 5 else 0 end;
        v_amount := least(v_amount + v_aux,25);$new$;
BEGIN
  definition := pg_get_functiondef(signature);
  IF position(old_branch in definition) > 0 THEN
    EXECUTE replace(definition, old_branch, new_branch);
  ELSIF position(new_branch in definition) = 0 THEN
    RAISE EXCEPTION 'Jungle Hopper reward source changed; review before applying';
  END IF;
END
$migration$;
