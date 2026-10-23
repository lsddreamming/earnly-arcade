-- Independent jewelry uses the existing authoritative purchase and loadout flow.
ALTER TABLE public.cosmetic_items DROP CONSTRAINT cosmetic_items_slot_check;
ALTER TABLE public.cosmetic_items ADD CONSTRAINT cosmetic_items_slot_check CHECK(slot IN ('avatar','outfit','weapon','shoes','backpack','face','beard','head','eyes','brows','nose','mouth','hair','marks','pet','frame','pose','effect','army','commander','building','battlefx','jewelry'));
ALTER TABLE public.cosmetic_loadouts DROP CONSTRAINT cosmetic_loadouts_slot_check;
ALTER TABLE public.cosmetic_loadouts ADD CONSTRAINT cosmetic_loadouts_slot_check CHECK(slot IN ('avatar','outfit','weapon','shoes','backpack','face','beard','head','eyes','brows','nose','mouth','hair','marks','pet','frame','pose','effect','army','commander','building','battlefx','jewelry'));
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,is_starter,collection) VALUES
('no-jewelry','No Jewelry','jewelry',0,'common','cosmetic-no-jewelry.svg',true,'essentials'),
('silver-chain','Silver Link Chain','jewelry',600,'rare','cosmetic-silver-chain.svg',false,'essentials'),
('gold-chain','Gold Link Chain','jewelry',900,'rare','cosmetic-gold-chain.svg',false,'essentials'),
('spud-pendant','Spud Gem Pendant','jewelry',1400,'legendary','cosmetic-spud-pendant.svg',false,'essentials')
ON CONFLICT (id) DO NOTHING;
