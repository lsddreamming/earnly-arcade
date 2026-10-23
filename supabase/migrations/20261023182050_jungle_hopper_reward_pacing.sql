-- Reduce future Jungle Hopper rewards only. Existing balances and claims are unchanged.
DO $migration$
DECLARE original text; updated text;
old_rule text := $old$      when 'jungleHopper' then
        v_amount := least(100,(floor(v_metric/2.0)+(case when v_metric>=10 then 2 else 0 end)+(case when v_metric>=20 then 3 else 0 end)+(case when v_metric>=30 then 5 else 0 end)+least(v_aux,floor((v_metric+1)/2.0)+floor((v_metric+1)/6.0),25))*4)::integer;
$old$;
new_rule text := $new$      when 'jungleHopper' then
        v_amount := least(50,floor(v_metric/2.0)+(case when v_metric>=10 then 2 else 0 end)+(case when v_metric>=20 then 3 else 0 end)+(case when v_metric>=30 then 5 else 0 end)+least(v_aux,floor((v_metric+1)/2.0)+floor((v_metric+1)/6.0),10))::integer;
$new$;
BEGIN
 SELECT pg_get_functiondef('public.claim_coin_reward(text,text,text,integer,integer,text,text)'::regprocedure) INTO original;
 IF position(new_rule in original)>0 THEN RETURN; END IF;
 IF position(old_rule in original)=0 THEN RAISE EXCEPTION 'Jungle reward rule changed; review migration'; END IF;
 updated:=replace(original,old_rule,new_rule);
 EXECUTE updated;
END
$migration$;
