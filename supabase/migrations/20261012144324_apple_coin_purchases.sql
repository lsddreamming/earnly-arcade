-- A single visible wallet; purchased provenance is server-only and never earned.
-- Sandbox cannot enter this production ledger. Use a separate staging project.
CREATE TABLE public.apple_coin_transactions (
 transaction_id text PRIMARY KEY, user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 product_id text NOT NULL, coins integer NOT NULL CHECK(coins>0),
 revoked boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.apple_coin_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apple_coin_transactions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.apple_coin_transactions TO service_role;
CREATE FUNCTION public.apple_coin_fulfill(p_user_id uuid,p_transaction_id text,p_product_id text,p_environment text,p_revoked boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE w public.coin_wallets; t public.apple_coin_transactions; amount integer; credit bigint; settle bigint; withdraw bigint;
BEGIN
 IF p_environment IS DISTINCT FROM 'Production' OR p_revoked IS NULL OR p_transaction_id IS NULL OR p_transaction_id !~ '^[0-9]{1,32}$' THEN RAISE EXCEPTION 'INVALID_TRANSACTION'; END IF;
 amount:=CASE p_product_id WHEN 'com.earnly.arcade.coins.starter' THEN 500 WHEN 'com.earnly.arcade.coins.plus' THEN 1500 WHEN 'com.earnly.arcade.coins.vault' THEN 4000 ELSE NULL END;
 IF amount IS NULL THEN RAISE EXCEPTION 'INVALID_PRODUCT'; END IF;
 -- Global transaction lock, then wallet lock: duplicate requests serialize even across accounts.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_transaction_id,0));
 SELECT * INTO t FROM public.apple_coin_transactions WHERE transaction_id=p_transaction_id FOR UPDATE;
 IF FOUND AND (t.user_id IS DISTINCT FROM p_user_id OR t.product_id IS DISTINCT FROM p_product_id) THEN RAISE EXCEPTION 'TRANSACTION_OWNER_MISMATCH'; END IF;
 SELECT * INTO w FROM public.coin_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_UNAVAILABLE'; END IF;
 IF t.transaction_id IS NULL THEN
  INSERT INTO public.apple_coin_transactions(transaction_id,user_id,product_id,coins,revoked)
   VALUES(p_transaction_id,p_user_id,p_product_id,amount,p_revoked);
  IF NOT p_revoked THEN
   settle:=least(w.purchase_debt,amount);credit:=amount-settle;
   UPDATE public.coin_wallets SET balance=balance+credit,purchased_balance=purchased_balance+credit,
    purchase_debt=purchase_debt-settle,updated_at=now() WHERE user_id=p_user_id RETURNING * INTO w;
  END IF;
 ELSIF p_revoked AND NOT t.revoked THEN
  withdraw:=least(w.purchased_balance,t.coins);
  UPDATE public.coin_wallets SET balance=balance-withdraw,purchased_balance=purchased_balance-withdraw,
   purchase_debt=purchase_debt+t.coins-withdraw,updated_at=now() WHERE user_id=p_user_id RETURNING * INTO w;
  UPDATE public.apple_coin_transactions SET revoked=true WHERE transaction_id=p_transaction_id;
 END IF;
 RETURN jsonb_build_object('transactionId',p_transaction_id,'status',CASE WHEN p_revoked OR coalesce(t.revoked,false) THEN 'revoked' ELSE 'fulfilled' END,
 'wallet',jsonb_build_object('balance',w.balance::text,'lifetime_earned',w.lifetime_earned::text,'purchase_debt',w.purchase_debt::text));
END $$;
REVOKE ALL ON FUNCTION public.apple_coin_fulfill(uuid,text,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apple_coin_fulfill(uuid,text,text,text,boolean) TO service_role;
COMMENT ON COLUMN public.coin_wallets.purchased_balance IS 'Nonredeemable purchased coins included in balance. Never eligible for cash, gift cards, crypto or transfers. All redemption remains disabled, including rewards from paid plays.';
