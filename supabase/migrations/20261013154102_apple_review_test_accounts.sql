-- Dedicated, newly provisioned test accounts only. No existing player is enrolled.
-- Sandbox and Production transactions have separate receipt namespaces.
CREATE TABLE public.apple_sandbox_accounts (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.apple_sandbox_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apple_sandbox_accounts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.apple_sandbox_accounts TO service_role;
CREATE FUNCTION public.apple_sandbox_account_pristine() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.coin_wallets WHERE user_id=NEW.user_id AND (balance<>0 OR lifetime_earned<>0 OR purchased_balance<>0 OR purchase_debt<>0))
 OR EXISTS(SELECT 1 FROM public.apple_coin_transactions WHERE user_id=NEW.user_id)
 OR EXISTS(SELECT 1 FROM public.coin_orders WHERE user_id=NEW.user_id)
 OR EXISTS(SELECT 1 FROM public.arcade_pass_transactions WHERE user_id=NEW.user_id)
 OR EXISTS(SELECT 1 FROM public.leaderboard_scores WHERE user_id=NEW.user_id)
 THEN RAISE EXCEPTION 'NEW_EMPTY_TEST_ACCOUNT_REQUIRED'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.apple_sandbox_account_pristine() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER apple_sandbox_account_pristine BEFORE INSERT ON public.apple_sandbox_accounts
 FOR EACH ROW EXECUTE FUNCTION public.apple_sandbox_account_pristine();

CREATE TABLE public.apple_sandbox_coin_transactions (
 transaction_id text PRIMARY KEY, user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 product_id text NOT NULL, coins integer NOT NULL CHECK(coins>0),
 revoked boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.apple_sandbox_coin_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apple_sandbox_coin_transactions FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.apple_sandbox_coin_transactions TO service_role;
CREATE FUNCTION public.apple_sandbox_coin_fulfill(p_user_id uuid,p_transaction_id text,p_product_id text,p_environment text,p_revoked boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE w public.coin_wallets; t public.apple_sandbox_coin_transactions; amount integer; credit bigint; settle bigint; withdraw bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.apple_sandbox_accounts WHERE user_id=p_user_id) THEN RAISE EXCEPTION 'SANDBOX_TEST_ACCOUNT_REQUIRED'; END IF;
 IF p_environment IS DISTINCT FROM 'Sandbox' OR p_revoked IS NULL OR p_transaction_id IS NULL OR p_transaction_id !~ '^[0-9]{1,32}$' THEN RAISE EXCEPTION 'INVALID_TRANSACTION'; END IF;
 amount:=CASE p_product_id WHEN 'com.earnly.arcade.coins.starter' THEN 500 WHEN 'com.earnly.arcade.coins.plus' THEN 1500 WHEN 'com.earnly.arcade.coins.vault' THEN 4000 ELSE NULL END;
 IF amount IS NULL THEN RAISE EXCEPTION 'INVALID_PRODUCT'; END IF;
 -- Global transaction lock, then wallet lock: duplicate requests serialize even across accounts.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_transaction_id,0));
 SELECT * INTO t FROM public.apple_sandbox_coin_transactions WHERE transaction_id=p_transaction_id FOR UPDATE;
 IF FOUND AND (t.user_id IS DISTINCT FROM p_user_id OR t.product_id IS DISTINCT FROM p_product_id) THEN RAISE EXCEPTION 'TRANSACTION_OWNER_MISMATCH'; END IF;
 SELECT * INTO w FROM public.coin_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_UNAVAILABLE'; END IF;
 IF t.transaction_id IS NULL THEN
  INSERT INTO public.apple_sandbox_coin_transactions(transaction_id,user_id,product_id,coins,revoked)
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
  UPDATE public.apple_sandbox_coin_transactions SET revoked=true WHERE transaction_id=p_transaction_id;
 END IF;
 RETURN jsonb_build_object('transactionId',p_transaction_id,'status',CASE WHEN p_revoked OR coalesce(t.revoked,false) THEN 'revoked' ELSE 'fulfilled' END,
 'wallet',jsonb_build_object('balance',w.balance::text,'lifetime_earned',w.lifetime_earned::text,'purchase_debt',w.purchase_debt::text));
END $$;
REVOKE ALL ON FUNCTION public.apple_sandbox_coin_fulfill(uuid,text,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apple_sandbox_coin_fulfill(uuid,text,text,text,boolean) TO service_role;

-- Even a direct service invocation cannot grant Sandbox purchases to regular users.
-- Preserve the production ledger and its strict Production-only receipt check.
ALTER FUNCTION public.apple_coin_fulfill(uuid,text,text,text,boolean) RENAME TO apple_coin_fulfill_production;
CREATE FUNCTION public.apple_coin_fulfill(p_user_id uuid,p_transaction_id text,p_product_id text,p_environment text,p_revoked boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.apple_sandbox_accounts WHERE user_id=p_user_id) THEN RAISE EXCEPTION 'PRODUCTION_ACCOUNT_REQUIRED'; END IF;
 RETURN public.apple_coin_fulfill_production(p_user_id,p_transaction_id,p_product_id,p_environment,p_revoked);
END $$;
REVOKE ALL ON FUNCTION public.apple_coin_fulfill(uuid,text,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apple_coin_fulfill(uuid,text,text,text,boolean) TO service_role;

ALTER TABLE public.arcade_pass_transactions DROP CONSTRAINT arcade_pass_transactions_provider_check;
ALTER TABLE public.arcade_pass_transactions ADD CONSTRAINT arcade_pass_transactions_provider_check CHECK(provider IN ('apple','stripe','apple_sandbox'));
ALTER FUNCTION public.arcade_pass_record(uuid,text,text,text,timestamptz,boolean,timestamptz) RENAME TO arcade_pass_record_verified;
CREATE FUNCTION public.arcade_pass_record(p_user_id uuid,p_provider text,p_transaction_id text,p_subscription_id text,p_expires_at timestamptz,p_revoked boolean,p_observed_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE test_account boolean;
BEGIN
 SELECT EXISTS(SELECT 1 FROM public.apple_sandbox_accounts WHERE user_id=p_user_id) INTO test_account;
 IF (p_provider='apple_sandbox') IS DISTINCT FROM test_account THEN RAISE EXCEPTION 'PURCHASE_ENVIRONMENT_ACCOUNT_MISMATCH'; END IF;
 RETURN public.arcade_pass_record_verified(p_user_id,p_provider,p_transaction_id,p_subscription_id,p_expires_at,p_revoked,p_observed_at);
END $$;
REVOKE ALL ON FUNCTION public.arcade_pass_record(uuid,text,text,text,timestamptz,boolean,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.arcade_pass_record(uuid,text,text,text,timestamptz,boolean,timestamptz) TO service_role;

-- Triggers query the private membership table without granting clients SELECT.
CREATE FUNCTION public.apple_sandbox_no_live_checkout() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.apple_sandbox_accounts WHERE user_id=NEW.user_id) THEN RAISE EXCEPTION 'TEST_ACCOUNT_USE_APPLE_SANDBOX'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.apple_sandbox_no_live_checkout() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER apple_sandbox_no_coin_checkout BEFORE INSERT ON public.coin_orders
 FOR EACH ROW EXECUTE FUNCTION public.apple_sandbox_no_live_checkout();
CREATE TRIGGER apple_sandbox_no_pass_checkout BEFORE INSERT ON public.arcade_pass_checkout
 FOR EACH ROW EXECUTE FUNCTION public.apple_sandbox_no_live_checkout();
CREATE FUNCTION public.apple_sandbox_unranked() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.apple_sandbox_accounts WHERE user_id=NEW.user_id) THEN RETURN NULL; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.apple_sandbox_unranked() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER apple_sandbox_unranked BEFORE INSERT OR UPDATE ON public.leaderboard_scores
 FOR EACH ROW EXECUTE FUNCTION public.apple_sandbox_unranked();
