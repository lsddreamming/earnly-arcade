-- Toys use the established catalog, atomic purchases and furniture ownership.
INSERT INTO earnly_world.item_definitions(id,name,sprite_id,item_height,price,width,length,can_sit,can_lay,can_stack,walkable,category,color) VALUES
('cloud-pup-ball','Cloud Pup Play Ball','pet-toy-dog',0.25,90,1,1,false,false,false,true,'Pet Toys','#79cbb6'),
('moon-cat-yarn','Moon Cat Yarn Ball','pet-toy-cat',0.25,90,1,1,false,false,false,true,'Pet Toys','#d68fa8'),
('meadow-bunny-tunnel','Meadow Bunny Tunnel','pet-toy-rabbit',0.25,150,1,1,false,false,false,true,'Pet Toys','#c4a777')
ON CONFLICT(id) DO NOTHING;
