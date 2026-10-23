-- Additive original furniture. Activate only after compatible client and server deployment.
insert into earnly_world.item_definitions (id,name,sprite_id,price,color,width,length,category,item_height,can_sit,can_lay,can_stack,walkable,tradeable,supply_limit,minted) values
 ('neon-dice','Neon Dice Pedestal','play-neon-dice',220,'#65dcca',1,1,'Playroom',1.5,false,false,false,false,true,null,0),
 ('clockwork-dice','Clockwork Dice Box','play-clockwork-dice',240,'#d6ab72',1,1,'Playroom',1.5,false,false,false,false,true,null,0),
 ('neon-roller','Neon Floor Roller','play-neon-roller',60,'#81caca',1,1,'Playroom',0.25,false,false,false,true,true,null,0),
 ('soft-serve','Rainbow Soft Serve','play-soft-serve',190,'#d6a0ce',1,1,'Playroom',1.5,false,false,false,false,true,null,0),
 ('star-cabinet','Star Patrol Cabinet','play-star-cabinet',300,'#81aedc',1,1,'Playroom',1.5,false,false,false,false,true,null,0),
 ('rhythm-cabinet','Neon Rhythm Cabinet','play-rhythm-cabinet',300,'#bb8ddd',1,1,'Playroom',1.5,false,false,false,false,true,null,0),
 ('sunflower-vase','Sunbeam Flower Vase','play-sunflower-vase',55,'#e8bd66',1,1,'Botanical Corner',1.5,false,false,false,false,true,null,0),
 ('yucca-planter','Desert Crown Yucca','play-yucca-planter',120,'#84b99a',1,1,'Botanical Corner',2,false,false,false,false,true,null,0),
 ('rose-vase','Velvet Rose Vase','play-rose-vase',55,'#d38fa6',1,1,'Botanical Corner',1.5,false,false,false,false,true,null,0),
 ('cactus-planter','Desert Trio Planter','play-cactus-planter',85,'#8bbb9b',1,1,'Botanical Corner',1,false,false,false,false,true,null,0)
on conflict (id) do nothing;
