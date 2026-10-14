-- Add purchasable decor through the existing server-authoritative economy.
insert into earnly_world.item_definitions(id,name,sprite_id,item_height,price,width,length,can_sit,can_lay,can_stack,walkable,category,color) values
('palm-tree','Sunset Palm','palm',1.5,140,1,1,false,false,false,false,'Garden','#65be86'),
('ficus-tree','Cloud Ficus','tree',1.5,125,1,1,false,false,false,false,'Garden','#71bc80'),
('blossom-tree','Blossom Tree','tree',1.5,160,1,1,false,false,false,false,'Garden','#eea2c2'),
('flower-pot','Starlight Flowers','flowers',1.5,55,1,1,false,false,false,false,'Garden','#eab2ed'),
('oak-bookshelf','Oak Bookshelf','bookshelf',1.5,150,1,1,false,false,false,false,'Essentials','#b88c66'),
('reef-aquarium','Pocket Reef Aquarium','aquarium',1.5,220,1,1,false,false,false,false,'Neon Living','#67cbd7'),
('sunset-sofa','Sunset Sofa','sofa',0.5,180,2,1,true,false,false,false,'Neon Living','#e6a26f'),
('sage-chair','Sage Garden Chair','chair',0.5,60,1,1,true,false,false,false,'Garden','#91bb96'),
('garden-parasol','Garden Parasol Table','umbrella',1.5,160,1,1,false,false,false,false,'Garden','#edbd85'),
('amber-lantern','Amber Lantern','lamp',1.5,90,1,1,false,false,false,false,'Garden','#edc582'),
('lavender-rug','Lavender Tile Rug','rug',0.25,40,2,2,false,false,true,true,'Neon Living','#ac93c8'),
('walnut-table','Walnut Coffee Table','table',0.5,80,1,1,false,false,true,false,'Essentials','#aa8069');

-- Upgrade existing greenery in furnished public rooms, retaining IDs and footprints.
update earnly_world.rooms r set public_items=(select jsonb_agg(case when item->>'sprite'='plant' then item || jsonb_build_object('sprite',case when r.name='Patio Hangout' then 'tree' else 'palm' end,'name',case when r.name='Patio Hangout' then 'Cloud Ficus' else 'Sunset Palm' end,'color','#71bc80') else item end order by ord) from jsonb_array_elements(r.public_items) with ordinality as a(item,ord)),revision=revision+1
where owner_id is null and name in ('Earnly Plaza','Hotel Lobby','Rooftop Lounge','Patio Hangout');
