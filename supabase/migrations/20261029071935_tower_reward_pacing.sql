-- Future Tower Stack claims only; preserve all existing claims and wallet totals.
DO $migration$
DECLARE original text; updated text;
old_rule text := $old$      when 'towerStack' then
        v_amount := least(100,(floor(v_metric/3.0)+floor(least(v_aux,v_metric)/3.0)+(case when v_metric>=10 then 2 else 0 end)+(case when v_metric>=20 then 3 else 0 end)+(case when v_metric>=30 then 5 else 0 end))*4)::integer;
$old$;
new_rule text := $new$      when 'towerStack' then
        v_amount := least(100,floor(v_metric/3.0)+floor(least(v_aux,v_metric)/10.0)+(case when v_metric>=20 then 2 else 0 end)+(case when v_metric>=50 then 3 else 0 end)+(case when v_metric>=100 then 5 else 0 end))::integer;
$new$;
BEGIN
 SELECT pg_get_functiondef('public.claim_coin_reward(text,text,text,integer,integer,text,text)'::regprocedure) INTO original;
 IF position(new_rule in original)>0 THEN RETURN; END IF;
 IF position(old_rule in original)=0 THEN RAISE EXCEPTION 'Tower reward rule changed; review migration'; END IF;
 updated:=replace(original,old_rule,new_rule);
 EXECUTE updated;
END
$migration$;
