-- Additive bathroom collection. No wallet, ownership, or existing item changes.
insert into earnly_world.item_definitions (id,name,sprite_id,price,color,width,length,category,item_height,can_sit,can_lay,can_stack,walkable,tradeable,supply_limit,minted) values
 ('bath-toilet','Porcelain Toilet','bath-toilet',100,'#80c9b5',1,1,'Bathroom',0.5,false,false,false,false,true,null,0),
 ('bath-sink','Mint Vanity Sink','bath-sink',160,'#80c9b5',1,1,'Bathroom',1.5,false,false,false,false,true,null,0),
 ('bath-shower','Glass Shower','bath-shower',240,'#80c9b5',1,1,'Bathroom',2,false,false,false,false,true,null,0),
 ('bath-tub','Soaking Bathtub','bath-tub',280,'#80c9b5',1,2,'Bathroom',1,false,false,false,false,true,null,0),
 ('bath-mirror','Standing Bathroom Mirror','bath-mirror',90,'#80c9b5',1,1,'Bathroom',2,false,false,false,false,true,null,0),
 ('bath-towels','Freestanding Towel Rack','bath-towels',75,'#80c9b5',1,1,'Bathroom',1.5,false,false,false,false,true,null,0),
 ('bath-cabinet','Bathroom Storage Cabinet','bath-cabinet',140,'#80c9b5',1,1,'Bathroom',2,false,false,false,false,true,null,0),
 ('bath-hamper','Woven Laundry Hamper','bath-hamper',65,'#80c9b5',1,1,'Bathroom',1,false,false,false,false,true,null,0),
 ('bath-mat','Soft Bath Mat','bath-mat',35,'#80c9b5',1,2,'Bathroom',0.25,false,false,true,true,true,null,0)
on conflict (id) do nothing;
