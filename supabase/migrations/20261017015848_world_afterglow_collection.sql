-- Original optional furniture; existing items, prices, wallets and rooms remain intact.
insert into earnly_world.item_definitions(id,name,sprite_id,item_height,price,width,length,can_sit,can_lay,can_stack,walkable,category,color) values
('afterglow-booth','Afterglow Diner Booth','diner-booth',0.5,200,2,1,true,false,false,false,'Afterglow District','#ef829b'),
('orbit-vending','Orbit Soda Display','vending',1.5,260,1,1,false,false,false,false,'Afterglow District','#749aeb'),
('holo-table','Starlight Hologram Table','holo-table',1,180,1,1,false,false,false,false,'Afterglow District','#66e6d2'),
('moon-pod','Moonrise Pod Bed','pod-bed',0.5,280,1,2,false,true,false,false,'Afterglow District','#9c98e9'),
('desert-cactus','Desert Bloom Cactus','cactus',1.5,75,1,1,false,false,false,false,'Afterglow District','#76bd8c');
