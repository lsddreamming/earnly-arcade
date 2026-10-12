-- Shop 2.0 extends the existing currency and inventory. No cash-out endpoints.
ALTER TABLE public.cosmetic_items ADD COLUMN collection text NOT NULL DEFAULT 'essentials',
 ADD COLUMN available_from timestamptz, ADD COLUMN available_until timestamptz,
 ADD COLUMN vip_only boolean NOT NULL DEFAULT false,
 ADD CHECK(available_until IS NULL OR available_from IS NULL OR available_until>available_from);
ALTER TABLE public.cosmetic_items DROP CONSTRAINT cosmetic_items_slot_check;
ALTER TABLE public.cosmetic_items ADD CONSTRAINT cosmetic_items_slot_check CHECK(slot IN ('avatar','outfit','weapon','shoes','backpack','face','beard','head','eyes','brows','nose','mouth','hair','marks','pet','frame','pose','effect','army','commander','building','battlefx'));
ALTER TABLE public.cosmetic_loadouts DROP CONSTRAINT cosmetic_loadouts_slot_check;
ALTER TABLE public.cosmetic_loadouts ADD CONSTRAINT cosmetic_loadouts_slot_check CHECK(slot IN ('avatar','outfit','weapon','shoes','backpack','face','beard','head','eyes','brows','nose','mouth','hair','marks','pet','frame','pose','effect','army','commander','building','battlefx'));

CREATE TABLE public.arcade_pass_transactions (
 provider text NOT NULL CHECK(provider IN ('apple','stripe')),
 transaction_id text NOT NULL, subscription_id text NOT NULL,
 user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 expires_at timestamptz NOT NULL, revoked boolean NOT NULL DEFAULT false,
 observed_at timestamptz NOT NULL, PRIMARY KEY(provider,transaction_id)
);
CREATE INDEX arcade_pass_subscription_idx ON public.arcade_pass_transactions(provider,subscription_id);
CREATE INDEX arcade_pass_user_idx ON public.arcade_pass_transactions(user_id,expires_at);
ALTER TABLE public.arcade_pass_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.arcade_pass_transactions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.arcade_pass_transactions TO service_role;
CREATE FUNCTION public.arcade_pass_active(p_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.arcade_pass_transactions WHERE user_id=p_user_id AND NOT revoked AND expires_at>now())
$$;
CREATE FUNCTION public.arcade_pass_record(p_user_id uuid,p_provider text,p_transaction_id text,p_subscription_id text,p_expires_at timestamptz,p_revoked boolean,p_observed_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE old public.arcade_pass_transactions;
BEGIN
 IF p_expires_at IS NULL OR p_observed_at IS NULL OR length(p_transaction_id)>200 OR length(p_subscription_id)>200 THEN RAISE EXCEPTION 'INVALID_TRANSACTION'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_provider||':'||p_subscription_id,0));
 IF EXISTS(SELECT 1 FROM public.arcade_pass_transactions WHERE provider=p_provider AND subscription_id=p_subscription_id AND user_id IS DISTINCT FROM p_user_id) THEN RAISE EXCEPTION 'TRANSACTION_OWNER_MISMATCH'; END IF;
 SELECT * INTO old FROM public.arcade_pass_transactions WHERE provider=p_provider AND transaction_id=p_transaction_id FOR UPDATE;
 IF FOUND AND old.user_id IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'TRANSACTION_OWNER_MISMATCH'; END IF;
 INSERT INTO public.arcade_pass_transactions VALUES(p_provider,p_transaction_id,p_subscription_id,p_user_id,p_expires_at,p_revoked,p_observed_at)
 ON CONFLICT(provider,transaction_id) DO UPDATE SET
 revoked=arcade_pass_transactions.revoked OR EXCLUDED.revoked,
 expires_at=CASE WHEN EXCLUDED.observed_at>=arcade_pass_transactions.observed_at THEN EXCLUDED.expires_at ELSE arcade_pass_transactions.expires_at END,
 observed_at=greatest(arcade_pass_transactions.observed_at,EXCLUDED.observed_at);
 RETURN jsonb_build_object('active',public.arcade_pass_active(p_user_id));
END $$;
CREATE OR REPLACE FUNCTION public.cosmetic_item_json(i public.cosmetic_items) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('id',i.id,'name',i.name,'slot',i.slot,'coinPrice',i.coin_price,'rarity',i.rarity,'imageUrl',i.asset_path,
 'collection',i.collection,'availableFrom',i.available_from,'availableUntil',i.available_until,'vipOnly',i.vip_only)
$$;
-- Filter expired subscription equipment on every authoritative read, not just at login.
CREATE OR REPLACE FUNCTION public.cosmetic_loadout_json(p_user_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_object_agg(s.slot,public.cosmetic_item_json(i))
 FROM public.cosmetic_items s LEFT JOIN public.cosmetic_loadouts l ON l.user_id=p_user_id AND l.slot=s.slot
 LEFT JOIN public.cosmetic_items chosen ON chosen.id=l.item_id
 JOIN public.cosmetic_items i ON i.id=CASE WHEN chosen.vip_only AND NOT public.arcade_pass_active(p_user_id) THEN s.id ELSE COALESCE(l.item_id,s.id) END WHERE s.is_starter
$$;
-- Keep existing RPC signatures, inventory, purchase-first debit trigger, and retry semantics.
ALTER FUNCTION public.cosmetic_buy(uuid,text,uuid) RENAME TO cosmetic_buy_legacy;
CREATE FUNCTION public.cosmetic_buy(p_user_id uuid,p_item_id text,p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE item public.cosmetic_items;
BEGIN
 PERFORM public.cosmetic_lock_player(p_user_id);
 SELECT * INTO item FROM public.cosmetic_items WHERE id=p_item_id;
 IF NOT EXISTS(SELECT 1 FROM public.cosmetic_receipts WHERE user_id=p_user_id AND request_id=p_request_id) THEN
  IF item.vip_only THEN RAISE EXCEPTION 'VIP_ITEM'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.cosmetic_inventory WHERE user_id=p_user_id AND item_id=p_item_id) AND
    (item.available_from>now() OR item.available_until<=now()) THEN RAISE EXCEPTION 'COLLECTION_UNAVAILABLE'; END IF;
 END IF;
 RETURN public.cosmetic_buy_legacy(p_user_id,p_item_id,p_request_id);
END $$;
ALTER FUNCTION public.cosmetic_equip(uuid,text) RENAME TO cosmetic_equip_legacy;
CREATE FUNCTION public.cosmetic_equip(p_user_id uuid,p_item_id text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE item public.cosmetic_items;
BEGIN
 PERFORM public.cosmetic_lock_player(p_user_id);
 SELECT * INTO item FROM public.cosmetic_items WHERE id=p_item_id;
 IF item.vip_only THEN
  IF NOT public.arcade_pass_active(p_user_id) THEN RAISE EXCEPTION 'PASS_REQUIRED'; END IF;
  INSERT INTO public.cosmetic_inventory(user_id,item_id) VALUES(p_user_id,p_item_id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN public.cosmetic_equip_legacy(p_user_id,p_item_id);
END $$;
REVOKE ALL ON FUNCTION public.arcade_pass_active(uuid),public.arcade_pass_record(uuid,text,text,text,timestamptz,boolean,timestamptz),public.cosmetic_buy(uuid,text,uuid),public.cosmetic_equip(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.arcade_pass_active(uuid),public.arcade_pass_record(uuid,text,text,text,timestamptz,boolean,timestamptz),public.cosmetic_buy(uuid,text,uuid),public.cosmetic_equip(uuid,text) TO service_role;
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,is_starter) VALUES('no-pet','Default pet','pet',0,'common','cosmetic-no-pet.svg',true);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,is_starter) VALUES('no-frame','Default frame','frame',0,'common','cosmetic-no-frame.svg',true);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,is_starter) VALUES('no-pose','Default pose','pose',0,'common','cosmetic-no-pose.svg',true);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,is_starter) VALUES('no-effect','Default effect','effect',0,'common','cosmetic-no-effect.svg',true);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,is_starter) VALUES('no-army','Default army','army',0,'common','cosmetic-no-army.svg',true);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,is_starter) VALUES('no-commander','Default commander','commander',0,'common','cosmetic-no-commander.svg',true);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,is_starter) VALUES('no-building','Default building','building',0,'common','cosmetic-no-building.svg',true);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,is_starter) VALUES('no-battlefx','Default battlefx','battlefx',0,'common','cosmetic-no-battlefx.svg',true);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,collection,available_from,available_until,vip_only) VALUES('pulse-outfit','Pulse Racer','outfit',250,'rare','cosmetic-pulse-outfit.svg','neon',NULL,NULL,false);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,collection,available_from,available_until,vip_only) VALUES('orbit-pet','Orbit Bot','pet',200,'rare','cosmetic-orbit-pet.svg','neon',NULL,NULL,false);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,collection,available_from,available_until,vip_only) VALUES('nova-crown','Nova Crown','head',200,'rare','cosmetic-nova-crown.svg','neon',NULL,NULL,false);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,collection,available_from,available_until,vip_only) VALUES('prism-frame','Prism Frame','frame',150,'rare','cosmetic-prism-frame.svg','neon',NULL,NULL,false);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,collection,available_from,available_until,vip_only) VALUES('champion-pose','Champion Salute','pose',150,'rare','cosmetic-champion-pose.svg','neon',NULL,NULL,false);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,collection,available_from,available_until,vip_only) VALUES('starlight-effect','Starlight Aura','effect',150,'rare','cosmetic-starlight-effect.svg','neon',NULL,NULL,false);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,collection,available_from,available_until,vip_only) VALUES('ion-army','Ion Legion','army',300,'rare','cosmetic-ion-army.svg','crystal',NULL,NULL,false);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,collection,available_from,available_until,vip_only) VALUES('ion-commander','Ion Commander','commander',200,'rare','cosmetic-ion-commander.svg','crystal',NULL,NULL,false);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,collection,available_from,available_until,vip_only) VALUES('ion-building','Ion Citadel','building',250,'rare','cosmetic-ion-building.svg','crystal',NULL,NULL,false);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,collection,available_from,available_until,vip_only) VALUES('ion-battlefx','Ion Trails','battlefx',150,'rare','cosmetic-ion-battlefx.svg','crystal',NULL,NULL,false);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,collection,available_from,available_until,vip_only) VALUES('pumpkin-pet','Pumpkin Pal','pet',200,'rare','cosmetic-pumpkin-pet.svg','halloween','2026-10-01T00:00:00Z','2026-11-02T00:00:00Z',false);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,collection,available_from,available_until,vip_only) VALUES('phantom-frame','Haunted Portal','frame',150,'rare','cosmetic-phantom-frame.svg','halloween','2026-10-01T00:00:00Z','2026-11-02T00:00:00Z',false);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,collection,available_from,available_until,vip_only) VALUES('snow-pet','Snow Sprite','pet',200,'rare','cosmetic-snow-pet.svg','christmas','2026-12-01T00:00:00Z','2027-01-06T00:00:00Z',false);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,collection,available_from,available_until,vip_only) VALUES('frost-frame','Frost Halo','frame',150,'rare','cosmetic-frost-frame.svg','christmas','2026-12-01T00:00:00Z','2027-01-06T00:00:00Z',false);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,collection,available_from,available_until,vip_only) VALUES('vip-frame','VIP Marquee','frame',1,'rare','cosmetic-vip-frame.svg','vip',NULL,NULL,true);
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,collection,available_from,available_until,vip_only) VALUES('vip-effect','VIP Aurora','effect',1,'rare','cosmetic-vip-effect.svg','vip',NULL,NULL,true);
CREATE OR REPLACE FUNCTION public.cosmetic_me(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET statement_timeout='5s' AS $$
BEGIN
 PERFORM public.cosmetic_lock_player(p_user_id);
 IF public.arcade_pass_active(p_user_id) THEN
  INSERT INTO public.cosmetic_inventory(user_id,item_id) SELECT p_user_id,id FROM public.cosmetic_items WHERE vip_only ON CONFLICT DO NOTHING;
 END IF;
 RETURN jsonb_build_object('user',public.cosmetic_user_state(p_user_id));
END $$;
-- Proposed new prices; existing order snapshots and Apple transaction quantities are unchanged.
UPDATE public.coin_packs SET price_cents=CASE id WHEN 'starter' THEN 99 WHEN 'plus' THEN 299 WHEN 'vault' THEN 499 END WHERE id IN ('starter','plus','vault');
CREATE TABLE public.arcade_pass_checkout (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL, customer_id text, session_id text, subscription_id text,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.arcade_pass_checkout ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.arcade_pass_checkout FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.arcade_pass_checkout TO service_role;
CREATE FUNCTION public.arcade_pass_reserve(p_user_id uuid,p_request_id uuid) RETURNS public.arcade_pass_checkout
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE entry public.arcade_pass_checkout;
BEGIN
 PERFORM public.cosmetic_lock_player(p_user_id);
 IF public.arcade_pass_active(p_user_id) THEN RAISE EXCEPTION 'PASS_ALREADY_ACTIVE'; END IF;
 INSERT INTO public.arcade_pass_checkout(user_id,request_id) VALUES(p_user_id,p_request_id) ON CONFLICT DO NOTHING;
 SELECT * INTO entry FROM public.arcade_pass_checkout WHERE user_id=p_user_id FOR UPDATE;
 -- One checkout per account. Expired sessions are explicitly reconciled before reset.
 RETURN entry;
END $$;
REVOKE ALL ON FUNCTION public.arcade_pass_reserve(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.arcade_pass_reserve(uuid,uuid) TO service_role;
