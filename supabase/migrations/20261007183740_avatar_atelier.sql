-- Add headwear and the Atelier collection. Existing IDs, wallets and ownership stay intact.
ALTER TABLE public.cosmetic_items DROP CONSTRAINT cosmetic_items_slot_check;
ALTER TABLE public.cosmetic_items ADD CONSTRAINT cosmetic_items_slot_check
 CHECK(slot IN ('avatar','outfit','weapon','shoes','backpack','face','beard','head'));
ALTER TABLE public.cosmetic_loadouts DROP CONSTRAINT cosmetic_loadouts_slot_check;
ALTER TABLE public.cosmetic_loadouts ADD CONSTRAINT cosmetic_loadouts_slot_check
 CHECK(slot IN ('avatar','outfit','weapon','shoes','backpack','face','beard','head'));
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,is_starter) VALUES
 ('no-headwear','No Headwear','head',0,'common','cosmetic-no-headwear.svg',true),
 ('ribbed-beanie','Ribbed Beanie','head',0,'common','cosmetic-ribbed-beanie.svg',false),
 ('arcade-cap','Arcade Cap','head',0,'common','cosmetic-arcade-cap.svg',false),
 ('comms-headset','Comms Headset','head',350,'rare','cosmetic-comms-headset.svg',false),
 ('sun-crown','Sun Crown','head',700,'legendary','cosmetic-sun-crown.svg',false),
 ('high-tops','Rose High-Tops','shoes',0,'common','cosmetic-high-tops.svg',false),
 ('comet-sneakers','Comet Sneakers','shoes',650,'rare','cosmetic-comet-sneakers.svg',false),
 ('radiant-boots','Radiant Boots','shoes',800,'legendary','cosmetic-radiant-boots.svg',false),
 ('storm-coat','Storm Explorer','outfit',450,'rare','cosmetic-storm-coat.svg',false),
 ('solar-jacket','Solar Bomber','outfit',650,'rare','cosmetic-solar-jacket.svg',false),
 ('aurora-armor','Aurora Armor','outfit',1400,'legendary','cosmetic-aurora-armor.svg',false),
 ('amber-goggles','Amber Goggles','face',300,'rare','cosmetic-amber-goggles.svg',false),
 ('braided-beard','Braided Beard','beard',350,'rare','cosmetic-braided-beard.svg',false),
 ('adventure-pack','Adventure Pack','backpack',400,'rare','cosmetic-adventure-pack.svg',false),
 ('aurora-pack','Aurora Pack','backpack',850,'legendary','cosmetic-aurora-pack.svg',false),
 ('orb-scepter','Aurora Scepter','weapon',900,'legendary','cosmetic-orb-scepter.svg',false)
ON CONFLICT(id) DO NOTHING;
