-- Future Neon Breach claims only; preserve existing receipts, wallet history and all other games.
DO $migration$
DECLARE original text; updated text;
old_rule text := $old$      when 'neonBreach' then
        v_amount := least(100,(floor(v_metric/150.0))*4)::integer;
$old$;
new_rule text := $new$      when 'neonBreach' then
        v_amount := least(200,floor(v_metric/200.0)*4)::integer;
$new$;
BEGIN
 SELECT pg_get_functiondef('public.claim_coin_reward(text,text,text,integer,integer,text,text)'::regprocedure) INTO original;
 IF position(new_rule in original)>0 THEN RETURN; END IF;
 IF position(old_rule in original)=0 THEN RAISE EXCEPTION 'Neon Breach reward rule changed; review migration'; END IF;
 updated:=replace(original,old_rule,new_rule);
 EXECUTE updated;
END
$migration$;

-- The ledger itself traditionally rejects amounts above 100. Extend only verified
-- Neon Breach game awards, leaving other categories under their existing 100 cap.
-- Do not expose the privileged writer as a public RPC.
DO $ledger_guard$
DECLARE original text; updated text;
old_guard text := 'if p_amount < 0 or p_amount > 100 then';
new_guard text := 'if p_amount < 0 or p_amount > (case when p_source_type = ''game'' and p_game = ''neonBreach'' and coalesce(p_metric,0) >= 5000 then 200 else 100 end) then';
BEGIN
 SELECT pg_get_functiondef('public.apply_coin_ledger_event(uuid,text,text,text,text,integer,integer,integer)'::regprocedure) INTO original;
 IF position(new_guard in original)>0 THEN RETURN; END IF;
 IF position(old_guard in original)=0 THEN RAISE EXCEPTION 'Coin ledger guard changed; review migration'; END IF;
 updated:=replace(original,old_guard,new_guard);
 EXECUTE updated;
END
$ledger_guard$;

-- Only privileged database functions may write the wallet ledger. The client must
-- claim rewards through the existing authenticated claim_coin_reward endpoint.
REVOKE EXECUTE ON FUNCTION public.apply_coin_ledger_event(uuid,text,text,text,text,integer,integer,integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_coin_ledger_event(uuid,text,text,text,text,integer,integer,integer) FROM anon, authenticated;
