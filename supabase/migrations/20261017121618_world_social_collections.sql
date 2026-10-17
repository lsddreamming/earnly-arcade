-- Original Earnly furniture. Existing ownership, prices and wallets stay unchanged.
insert into earnly_world.item_definitions(id,name,sprite_id,item_height,price,width,length,can_sit,can_lay,can_stack,walkable,tradeable,category,color) values
('bramble-coffee','Bramble Coffee Station','coffee-station',1.5,180,1,1,false,false,false,false,true,'Bramble Cafe','#dcad79'),
('bramble-bistro','Bramble Bistro Table','bistro-table',0.5,85,1,1,false,false,false,false,true,'Bramble Cafe','#d3a778'),
('bramble-chair','Bramble Bentwood Chair','bentwood-chair',0.5,65,1,1,true,false,false,false,true,'Bramble Cafe','#8ab9a6'),
('bramble-pastry','Bramble Pastry Counter','pastry-counter',1.5,210,2,1,false,false,false,false,true,'Bramble Cafe','#cba57e'),
('morrow-jukebox','Morrow Record Jukebox','record-jukebox',1.5,240,1,1,false,false,false,false,true,'Morrow Lounge','#b39bd9'),
('morrow-console','Morrow Listening Console','listening-console',1.5,185,2,1,false,false,false,false,true,'Morrow Lounge','#b58b74'),
('morrow-bench','Morrow Channel Sofa','channel-sofa',0.5,195,2,1,true,false,false,false,true,'Morrow Lounge','#718bb5'),
('morrow-light','Morrow Crescent Light','crescent-light',1.5,95,1,1,false,false,false,false,true,'Morrow Lounge','#e4c286'),
('dewglass-house','Dewglass Plant House','plant-house',1.5,170,1,1,false,false,false,false,true,'Dewglass Garden','#8dc7b1'),
('dewglass-basin','Dewglass Lily Basin','lily-basin',0.5,145,1,1,false,false,false,false,true,'Dewglass Garden','#9ebbb0'),
('dewglass-trellis','Dewglass Vine Screen','vine-screen',1.5,125,2,1,false,false,false,false,true,'Dewglass Garden','#9dbb8d'),
('dewglass-seat','Dewglass Woven Seat','woven-seat',0.5,75,1,1,true,false,false,false,true,'Dewglass Garden','#ceb68b')
on conflict (id) do nothing;

-- Refresh public room accents in place: keep all tile coordinates and collision footprints.
-- Private rooms and player inventory are never touched.
with choices(room_name,item_id,definition_id) as (values
('Hotel Lobby','lobby-table-a','bramble-bistro'),
('Hotel Lobby','lobby-table-b','bramble-coffee'),
('Rooftop Lounge','roof-speaker','morrow-jukebox'),
('Rooftop Lounge','roof-sofa-a','morrow-bench'),
('Rooftop Lounge','roof-sofa-b','morrow-bench'),
('Rooftop Lounge','roof-lamp-a','morrow-light'),
('Rooftop Lounge','roof-lamp-b','morrow-light'),
('Patio Hangout','patio-palm-d','dewglass-house'),
('Patio Hangout','heritage-2','dewglass-basin'),
('Patio Hangout','patio-chair-a','dewglass-seat'),
('Patio Hangout','patio-chair-b','dewglass-seat'),
('Patio Hangout','patio-chair-c','dewglass-seat'),
('Patio Hangout','patio-chair-d','dewglass-seat')
), refreshed as (
 select r.id,jsonb_agg(case when d.id is null then p.item else p.item || jsonb_build_object('definitionId',d.id,'name',d.name,'sprite',d.sprite_id,'color',d.color,'itemHeight',d.item_height) end order by p.ord) as decor
 from earnly_world.rooms r
 cross join lateral jsonb_array_elements(r.public_items) with ordinality p(item,ord)
 left join choices m on m.room_name=r.name and m.item_id=p.item->>'id'
 left join earnly_world.item_definitions d on d.id=m.definition_id and d.width=(p.item->>'width')::int and d.length=(p.item->>'length')::int and d.can_sit=(p.item->>'canSit')::boolean and d.walkable=(p.item->>'walkable')::boolean
 where r.owner_id is null and r.name in ('Hotel Lobby','Rooftop Lounge','Patio Hangout') group by r.id
)
update earnly_world.rooms r set public_items=f.decor,revision=r.revision+1 from refreshed f where r.id=f.id and r.public_items is distinct from f.decor;
