-- Add independent accessories without resetting any purchased item or wallet.
ALTER TABLE public.cosmetic_items DROP CONSTRAINT cosmetic_items_slot_check;
ALTER TABLE public.cosmetic_items ADD CONSTRAINT cosmetic_items_slot_check
 CHECK (slot IN ('avatar','outfit','weapon','shoes','backpack','face','beard'));
ALTER TABLE public.cosmetic_loadouts DROP CONSTRAINT cosmetic_loadouts_slot_check;
ALTER TABLE public.cosmetic_loadouts ADD CONSTRAINT cosmetic_loadouts_slot_check
 CHECK (slot IN ('avatar','outfit','weapon','shoes','backpack','face','beard'));

INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,is_starter) VALUES
 ('cozy-hoodie','Cozy Hoodie','outfit',0,'common','cosmetic-cozy-hoodie.svg',false),
 ('trail-boots','Trail Boots','shoes',0,'common','cosmetic-trail-boots.svg',true),
 ('canvas-shoes','Canvas Sneakers','shoes',0,'common','cosmetic-canvas-shoes.svg',false),
 ('neon-kicks','Neon Kicks','shoes',300,'rare','cosmetic-neon-kicks.svg',false),
 ('no-backpack','No Backpack','backpack',0,'common','cosmetic-no-backpack.svg',true),
 ('canvas-pack','Canvas Backpack','backpack',0,'common','cosmetic-canvas-pack.svg',false),
 ('reactor-pack','Reactor Pack','backpack',550,'legendary','cosmetic-reactor-pack.svg',false),
 ('no-facewear','No Facewear','face',0,'common','cosmetic-no-facewear.svg',true),
 ('round-glasses','Round Glasses','face',0,'common','cosmetic-round-glasses.svg',false),
 ('sport-shades','Sport Shades','face',0,'common','cosmetic-sport-shades.svg',false),
 ('star-goggles','Star Goggles','face',200,'rare','cosmetic-star-goggles.svg',false),
 ('no-beard','Clean Shaven','beard',0,'common','cosmetic-no-beard.svg',true),
 ('short-beard','Short Beard','beard',0,'common','cosmetic-short-beard.svg',false),
 ('explorer-beard','Explorer Beard','beard',0,'common','cosmetic-explorer-beard.svg',false),
 ('frost-beard','Frost Beard','beard',250,'rare','cosmetic-frost-beard.svg',false)
ON CONFLICT(id) DO NOTHING;

-- Free essentials are automatically owned. Defaults are only inserted when a
-- slot is missing, preserving every previously equipped avatar/outfit/weapon.
CREATE OR REPLACE FUNCTION public.cosmetic_lock_player(p_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET statement_timeout='5s' AS $$
BEGIN
 PERFORM 1 FROM public.coin_wallets WHERE user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_UNAVAILABLE' USING ERRCODE='P0001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=p_user_id AND username IS NOT NULL) THEN
  RAISE EXCEPTION 'PROFILE_REQUIRED' USING ERRCODE='P0001'; END IF;
 INSERT INTO public.cosmetic_inventory(user_id,item_id)
  SELECT p_user_id,id FROM public.cosmetic_items WHERE active AND coin_price=0 ON CONFLICT DO NOTHING;
 INSERT INTO public.cosmetic_loadouts(user_id,slot,item_id)
  SELECT p_user_id,slot,id FROM public.cosmetic_items WHERE is_starter ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.cosmetic_lock_player(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cosmetic_lock_player(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.cosmetic_item_json(i public.cosmetic_items) RETURNS jsonb
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT jsonb_build_object('id',i.id,'name',i.name,'slot',i.slot,'coinPrice',i.coin_price,'rarity',i.rarity,'imageUrl',i.asset_path,'isStarter',i.is_starter)
$$;
REVOKE ALL ON FUNCTION public.cosmetic_item_json(public.cosmetic_items) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cosmetic_item_json(public.cosmetic_items) TO service_role;
