-- Future Neon Breach claims only; preserve existing receipts, wallet history and all other games.
DO $migration$
DECLARE original text; updated text;
old_rule text := $old$      when 'neonBreach' then
        v_amount := least(100,(floor(v_metric/150.0))*4)::integer;
$old$;
new_rule text := $new$      when 'neonBreach' then
        v_amount := least(200,floor(v_metric/250.0)*4)::integer;
$new$;
BEGIN
 SELECT pg_get_functiondef('public.claim_coin_reward(text,text,text,integer,integer,text,text)'::regprocedure) INTO original;
 IF position(new_rule in original)>0 THEN RETURN; END IF;
 IF position(old_rule in original)=0 THEN RAISE EXCEPTION 'Neon Breach reward rule changed; review migration'; END IF;
 updated:=replace(original,old_rule,new_rule);
 EXECUTE updated;
END
$migration$;
