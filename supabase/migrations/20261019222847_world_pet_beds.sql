-- Low, walkable pet cushions use existing atomic purchases and furniture ownership.
INSERT INTO earnly_world.item_definitions(id,name,sprite_id,item_height,price,width,length,can_sit,can_lay,can_stack,walkable,category,color) VALUES
('cloud-pup-bed','Cloud Pup Cushion','pet-bed-dog',0.25,120,1,1,false,false,false,true,'Pet Comfort','#bc926a'),
('moon-cat-bed','Moon Cat Nest','pet-bed-cat',0.25,140,1,1,false,false,false,true,'Pet Comfort','#a493c4'),
('meadow-bunny-bed','Meadow Bunny Bed','pet-bed-rabbit',0.25,100,1,1,false,false,false,true,'Pet Comfort','#9db78b')
ON CONFLICT(id) DO NOTHING;
