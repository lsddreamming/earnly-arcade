-- Server-only payment ledger. Card details never enter Earnly's database.
ALTER TABLE public.coin_wallets ADD COLUMN purchased_balance bigint NOT NULL DEFAULT 0
 CHECK(purchased_balance>=0 AND purchased_balance<=balance);
ALTER TABLE public.coin_wallets ADD COLUMN purchase_debt bigint NOT NULL DEFAULT 0 CHECK(purchase_debt>=0);
CREATE TABLE public.coin_packs(id text PRIMARY KEY, coins integer NOT NULL CHECK(coins>0),
 price_cents integer NOT NULL CHECK(price_cents>0), currency text NOT NULL DEFAULT 'usd' CHECK(currency='usd'), active boolean NOT NULL DEFAULT true);
INSERT INTO public.coin_packs(id,coins,price_cents) VALUES('starter',500,199),('plus',1500,499),('vault',4000,999);
CREATE TABLE public.coin_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,pack_id text NOT NULL REFERENCES public.coin_packs(id),coins integer NOT NULL,
 amount_cents integer NOT NULL,currency text NOT NULL,session_id text UNIQUE,payment_intent text UNIQUE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','fulfilled')),refunded_coins bigint NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),fulfilled_at timestamptz,UNIQUE(user_id,request_id));
CREATE INDEX coin_orders_user_created ON public.coin_orders(user_id,created_at DESC);
CREATE TABLE public.coin_play_credits(user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 game text NOT NULL,remaining integer NOT NULL DEFAULT 0 CHECK(remaining>=0),PRIMARY KEY(user_id,game));
CREATE TABLE public.coin_play_receipts(user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,game text NOT NULL,action text NOT NULL CHECK(action IN ('buy','consume')),
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,request_id));
ALTER TABLE public.coin_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_play_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_play_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coin_packs,public.coin_orders,public.coin_play_credits,public.coin_play_receipts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.coin_packs,public.coin_orders,public.coin_play_credits,public.coin_play_receipts TO service_role;

-- Existing outfit and continue purchases consume the purchased portion first.
-- This does not change earned totals or the existing spend APIs.
CREATE FUNCTION public.coin_track_purchased_spend() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.balance<OLD.balance AND NEW.purchased_balance=OLD.purchased_balance THEN
  NEW.purchased_balance:=greatest(0,OLD.purchased_balance-(OLD.balance-NEW.balance));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER coin_purchased_spend BEFORE UPDATE ON public.coin_wallets FOR EACH ROW EXECUTE FUNCTION public.coin_track_purchased_spend();
REVOKE ALL ON FUNCTION public.coin_track_purchased_spend() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.coin_order_create(p_user_id uuid,p_pack_id text,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o public.coin_orders; p public.coin_packs;
BEGIN
 PERFORM 1 FROM public.coin_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_UNAVAILABLE'; END IF;
 SELECT * INTO o FROM public.coin_orders WHERE user_id=p_user_id AND request_id=p_request_id;
 IF FOUND THEN
  IF o.pack_id<>p_pack_id THEN RAISE EXCEPTION 'REQUEST_REUSED'; END IF;
  RETURN to_jsonb(o);
 END IF;
 IF (SELECT count(*) FROM public.coin_orders WHERE user_id=p_user_id AND created_at>now()-interval '1 hour')>=10 THEN RAISE EXCEPTION 'RATE_LIMITED'; END IF;
 SELECT * INTO p FROM public.coin_packs WHERE id=p_pack_id AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'PACK_NOT_FOUND'; END IF;
 INSERT INTO public.coin_orders(user_id,request_id,pack_id,coins,amount_cents,currency)
 VALUES(p_user_id,p_request_id,p.id,p.coins,p.price_cents,p.currency) RETURNING * INTO o;
 RETURN to_jsonb(o);
END $$;

-- Called only after the Edge Function retrieves and validates Stripe's session.
-- The order lock serializes duplicate delivery, return-page checks and refunds.
CREATE FUNCTION public.coin_order_fulfill(p_order_id uuid,p_session_id text,p_amount integer,p_currency text,
 p_live boolean,p_paid boolean,p_intent text,p_refunded integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE o public.coin_orders; w public.coin_wallets; settle bigint; credit bigint; refund bigint; delta bigint; withdraw bigint;
BEGIN
 IF p_live IS DISTINCT FROM true OR p_paid IS DISTINCT FROM true THEN RAISE EXCEPTION 'PAYMENT_NOT_LIVE_PAID'; END IF;
 SELECT * INTO o FROM public.coin_orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
 IF p_amount IS NULL OR p_currency IS NULL OR p_session_id IS NULL OR p_refunded IS NULL OR o.session_id IS DISTINCT FROM p_session_id OR o.amount_cents<>p_amount OR o.currency<>p_currency OR p_intent IS NULL
 OR p_refunded<0 OR p_refunded>o.amount_cents THEN RAISE EXCEPTION 'PAYMENT_MISMATCH'; END IF;
 SELECT * INTO w FROM public.coin_wallets WHERE user_id=o.user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_UNAVAILABLE'; END IF;
 IF o.status='pending' THEN
  settle:=least(w.purchase_debt,o.coins);credit:=o.coins-settle;
  UPDATE public.coin_wallets SET balance=balance+credit,purchased_balance=purchased_balance+credit,
   purchase_debt=purchase_debt-settle,updated_at=now() WHERE user_id=o.user_id RETURNING * INTO w;
  UPDATE public.coin_orders SET status='fulfilled',payment_intent=p_intent,fulfilled_at=now() WHERE id=o.id;
 ELSIF o.payment_intent IS DISTINCT FROM p_intent THEN RAISE EXCEPTION 'PAYMENT_MISMATCH'; END IF;
 refund:=ceil(o.coins::numeric*p_refunded/o.amount_cents)::bigint;
 delta:=greatest(0,refund-o.refunded_coins);
 IF delta>0 THEN
  withdraw:=least(w.purchased_balance,delta);
  UPDATE public.coin_wallets SET balance=balance-withdraw,purchased_balance=purchased_balance-withdraw,
   purchase_debt=purchase_debt+(delta-withdraw),updated_at=now() WHERE user_id=o.user_id RETURNING * INTO w;
  UPDATE public.coin_orders SET refunded_coins=refund WHERE id=o.id;
 END IF;
 RETURN jsonb_build_object('status','fulfilled','coins',o.coins,'refundedCoins',greatest(refund,o.refunded_coins),
 'wallet',jsonb_build_object('balance',w.balance::text,'lifetime_earned',w.lifetime_earned::text,'purchase_debt',w.purchase_debt::text));
END $$;

CREATE FUNCTION public.coin_play_action(p_user_id uuid,p_game text,p_request_id uuid,p_action text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE w public.coin_wallets; receipt public.coin_play_receipts; plays integer;
BEGIN
 IF p_action NOT IN ('buy','consume') OR p_game NOT IN ('snake','blockDrop','tapRush','memory','brickBreaker','jungleHopper','towerStack','coinCatch','colorMatch','paddleRally','laneRunner','safeCracker','neonDrift','mergeRush','perfectDrop','spiralDrop','shapeFit','bounceRun','trafficEscape','starDefender','neonBreach','neonMaze') THEN RAISE EXCEPTION 'INVALID_GAME'; END IF;
 SELECT * INTO w FROM public.coin_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_UNAVAILABLE'; END IF;
 INSERT INTO public.coin_play_credits(user_id,game) VALUES(p_user_id,p_game) ON CONFLICT DO NOTHING;
 SELECT * INTO receipt FROM public.coin_play_receipts WHERE user_id=p_user_id AND request_id=p_request_id;
 IF FOUND THEN
  IF receipt.game<>p_game OR receipt.action<>p_action THEN RAISE EXCEPTION 'REQUEST_REUSED'; END IF;
 ELSE
  IF p_action='buy' THEN
   IF w.balance<25 THEN RAISE EXCEPTION 'INSUFFICIENT_COINS'; END IF;
   UPDATE public.coin_wallets SET balance=balance-25,updated_at=now() WHERE user_id=p_user_id RETURNING * INTO w;
   UPDATE public.coin_play_credits SET remaining=remaining+3 WHERE user_id=p_user_id AND game=p_game;
  ELSE
   UPDATE public.coin_play_credits SET remaining=remaining-1 WHERE user_id=p_user_id AND game=p_game AND remaining>0;
   IF NOT FOUND THEN RAISE EXCEPTION 'NO_PLAYS'; END IF;
  END IF;
  INSERT INTO public.coin_play_receipts(user_id,request_id,game,action) VALUES(p_user_id,p_request_id,p_game,p_action);
 END IF;
 SELECT remaining INTO plays FROM public.coin_play_credits WHERE user_id=p_user_id AND game=p_game;
 RETURN jsonb_build_object('remaining',plays,'requestId',p_request_id,'game',p_game,'wallet',jsonb_build_object('balance',w.balance::text,'lifetime_earned',w.lifetime_earned::text));
END $$;
REVOKE ALL ON FUNCTION public.coin_order_create(uuid,text,uuid),public.coin_order_fulfill(uuid,text,integer,text,boolean,boolean,text,integer),public.coin_play_action(uuid,text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.coin_order_create(uuid,text,uuid),public.coin_order_fulfill(uuid,text,integer,text,boolean,boolean,text,integer),public.coin_play_action(uuid,text,uuid,text) TO service_role;
