-- Future Safe Cracker claims only. Historical receipts, wallets and all other games are preserved.
DO $migration$
DECLARE original text; updated text;
old_rule text := $old$      when 'safeCracker' then
        v_amount := least(100,(floor(v_metric/2.0)+(case when v_metric>=8 then 2 else 0 end)+(case when v_metric>=15 then 4 else 0 end)+(case when v_metric>=25 then 5 else 0 end))*4)::integer;
$old$;
new_rule text := $new$      when 'safeCracker' then
        v_amount := least(100,floor(v_metric/5.0)*2+(case when v_metric>=25 then 2 else 0 end)+(case when v_metric>=50 then 4 else 0 end)+(case when v_metric>=75 then 6 else 0 end)+(case when v_metric>=100 then 8 else 0 end))::integer;
$new$;
BEGIN
 SELECT pg_get_functiondef('public.claim_coin_reward(text,text,text,integer,integer,text,text)'::regprocedure) INTO original;
 IF position(new_rule in original)>0 THEN RETURN; END IF;
 IF position(old_rule in original)=0 THEN RAISE EXCEPTION 'Safe Cracker reward rule changed; review migration'; END IF;
 updated:=replace(original,old_rule,new_rule);
 EXECUTE updated;
END
$migration$;
