CREATE OR REPLACE FUNCTION public.coin_play_action_v2(p_user_id uuid, p_game text, p_request_id uuid, p_action text, p_expected_cost integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE w public.coin_wallets; receipt public.coin_play_receipts; plays integer;
BEGIN
 IF p_action NOT IN ('buy','consume') OR p_game NOT IN ('snake','blockDrop','tapRush','memory','brickBreaker','jungleHopper','towerStack','coinCatch','colorMatch','paddleRally','laneRunner','safeCracker','neonDrift','turboKart','mergeRush','perfectDrop','spiralDrop','shapeFit','bounceRun','trafficEscape','starDefender','neonBreach','neonMaze') THEN RAISE EXCEPTION 'INVALID_GAME'; END IF;
 SELECT * INTO w FROM public.coin_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_UNAVAILABLE'; END IF;
 INSERT INTO public.coin_play_credits(user_id,game) VALUES(p_user_id,p_game) ON CONFLICT DO NOTHING;
 SELECT * INTO receipt FROM public.coin_play_receipts WHERE user_id=p_user_id AND request_id=p_request_id;
 IF FOUND THEN
  IF receipt.game<>p_game OR receipt.action<>p_action THEN RAISE EXCEPTION 'REQUEST_REUSED'; END IF;
 ELSE
  IF p_action='buy' THEN
   IF p_expected_cost IS DISTINCT FROM 5000 THEN RAISE EXCEPTION 'PRICE_CHANGED'; END IF;
   IF w.balance<5000 THEN RAISE EXCEPTION 'INSUFFICIENT_COINS'; END IF;
   UPDATE public.coin_wallets SET balance=balance-5000,updated_at=now() WHERE user_id=p_user_id RETURNING * INTO w;
   UPDATE public.coin_play_credits SET remaining=remaining+3 WHERE user_id=p_user_id AND game=p_game;
  ELSE
   UPDATE public.coin_play_credits SET remaining=remaining-1 WHERE user_id=p_user_id AND game=p_game AND remaining>0;
   IF NOT FOUND THEN RAISE EXCEPTION 'NO_PLAYS'; END IF;
  END IF;
  INSERT INTO public.coin_play_receipts(user_id,request_id,game,action) VALUES(p_user_id,p_request_id,p_game,p_action);
 END IF;
 SELECT remaining INTO plays FROM public.coin_play_credits WHERE user_id=p_user_id AND game=p_game;
 RETURN jsonb_build_object('remaining',plays,'requestId',p_request_id,'game',p_game,'wallet',jsonb_build_object('balance',w.balance::text,'lifetime_earned',w.lifetime_earned::text));
END $function$;

REVOKE ALL ON FUNCTION public.coin_play_action_v2(uuid,text,uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.coin_play_action_v2(uuid,text,uuid,text,integer) TO service_role;
-- Existing receipts remain replayable; legacy new purchases fail before debit.
CREATE OR REPLACE FUNCTION public.coin_play_action(p_user_id uuid,p_game text,p_request_id uuid,p_action text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT public.coin_play_action_v2(p_user_id,p_game,p_request_id,p_action,NULL);
$$;
REVOKE ALL ON FUNCTION public.coin_play_action(uuid,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.coin_play_action(uuid,text,uuid,text) TO service_role;
