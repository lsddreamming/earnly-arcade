-- Additive catalog only: no wallets, receipts, ownership, pricing of existing items or permissions change.
INSERT INTO public.cosmetic_items(id,name,slot,coin_price,rarity,asset_path,collection) VALUES
('boardwalk-jacket','Boardwalk Light Jacket','outfit',260,'rare','cosmetic-boardwalk-jacket.svg','neon'),
('boardwalk-cap','Afterglow Cap','head',120,'rare','cosmetic-boardwalk-cap.svg','neon'),
('boardwalk-sneakers','Boardwalk Lightsteps','shoes',140,'rare','cosmetic-boardwalk-sneakers.svg','neon'),
('boardwalk-hair','Electric Side Sweep','hair',90,'rare','cosmetic-boardwalk-hair.svg','neon'),
('boardwalk-aura','Boardwalk Signal Aura','effect',180,'rare','cosmetic-boardwalk-aura.svg','neon')
ON CONFLICT(id) DO NOTHING;
INSERT INTO earnly_world.item_definitions(id,name,sprite_id,item_height,price,width,length,can_sit,can_lay,can_stack,walkable,category,color) VALUES
('boardwalk-sofa','Boardwalk Cloud Sofa','sofa',0.5,180,2,1,true,false,false,false,'Neon Boardwalk','#63dcd6'),
('boardwalk-lamp','Afterglow Floor Lamp','lamp',1.5,90,1,1,false,false,false,false,'Neon Boardwalk','#e2a0ed'),
('boardwalk-rug','Boardwalk Sunset Rug','rug',0.25,40,2,2,false,false,true,true,'Neon Boardwalk','#c18bd5'),
('boardwalk-table','Boardwalk Side Table','table',0.5,80,1,1,false,false,true,false,'Neon Boardwalk','#80bfc9')
ON CONFLICT(id) DO NOTHING;
