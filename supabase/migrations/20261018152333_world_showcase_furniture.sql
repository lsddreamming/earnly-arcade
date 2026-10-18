-- Original Earnly furniture. Additive catalog rows; existing ownership and VIP awards are unchanged.
insert into earnly_world.item_definitions (id,name,sprite_id,price,color,width,length,category,item_height,can_sit,can_lay,can_stack,walkable,tradeable,supply_limit,minted) values
 ('arcade-racer','Neon Sprint Racing Cabinet','show-racer',390,'#8ba9e2',1,2,'Arcade',1.5,false,false,false,false,true,null,0),
 ('arcade-airhockey','Rally Air Hockey','show-airhockey',280,'#9a91d2',1,2,'Arcade',1.5,false,false,false,false,true,null,0),
 ('arcade-ticket','Prize Ticket Kiosk','show-ticket',160,'#dca17e',1,1,'Arcade',1.5,false,false,false,false,true,null,0),
 ('arcade-gumball','Candy Orbit Dispenser','show-gumball',125,'#c891ba',1,1,'Arcade',1.5,false,false,false,false,true,null,0),
 ('collector-meteor','Prismatic Meteor Display','show-meteor',260,'#8b80b4',1,1,'Collectors',1.5,false,false,false,false,true,null,0),
 ('collector-aquarium','Tidal Glass Aquarium','show-aquarium',340,'#7faea7',2,1,'Collectors',1.5,false,false,false,false,true,null,0),
 ('collector-orrery','Celestial Orbit Sculpture','show-orrery',290,'#877baf',1,1,'Collectors',1.5,false,false,false,false,true,null,0),
 ('collector-gallery','Curiosity Glass Cabinet','show-gallery',230,'#9b91b9',2,1,'Collectors',1.5,false,false,false,false,true,null,0)
on conflict (id) do nothing;
