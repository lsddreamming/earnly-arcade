-- Add eight original beds; preserve existing items, ownership and wallets.
INSERT INTO earnly_world.item_definitions(id,name,sprite_id,item_height,price,width,length,can_sit,can_lay,can_stack,walkable,category,color) VALUES
('oak-single','Oak Cabin Single','cabin-bed',0.5,120,1,2,false,true,false,false,'Dream Rooms','#bc9468'),
('velvet-double','Velvet Double','velvet-bed',0.5,270,2,2,false,true,false,false,'Dream Rooms','#ba7f9b'),
('loft-bunk','Loft Bunk Bed','bunk-bed',0.5,310,1,2,false,true,false,false,'Dream Rooms','#7dabb3'),
('royal-poster','Royal Four-Poster','poster-bed',0.5,390,2,2,false,true,false,false,'Dream Rooms','#ac84bd'),
('orbit-round','Orbit Round Bed','round-bed',0.5,330,2,2,false,true,false,false,'Dream Rooms','#84b8cf'),
('nova-capsule','Nova Capsule Bed','capsule-bed',0.5,360,1,2,false,true,false,false,'Dream Rooms','#81d6d5'),
('rally-racer','Rally Racing Bed','racer-bed',0.5,250,1,2,false,true,false,false,'Dream Rooms','#e59176'),
('linen-platform','Linen Platform Bed','platform-bed',0.5,190,2,2,false,true,false,false,'Dream Rooms','#a9ba92')
ON CONFLICT(id) DO NOTHING;
