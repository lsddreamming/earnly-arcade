/* Original Earnly collections. Geometry is drawn by world-renderer.js. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EarnlyWorldCollections=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 const items=[
 ['bramble-coffee','Bramble Coffee Station','coffee-station',180,'#dcad79',1,1,'Bramble Cafe',1.5],
 ['bramble-bistro','Bramble Bistro Table','bistro-table',85,'#d3a778',1,1,'Bramble Cafe',.5],
 ['bramble-chair','Bramble Bentwood Chair','bentwood-chair',65,'#8ab9a6',1,1,'Bramble Cafe',.5,true],
 ['bramble-pastry','Bramble Pastry Counter','pastry-counter',210,'#cba57e',2,1,'Bramble Cafe',1.5],
 ['morrow-jukebox','Morrow Record Jukebox','record-jukebox',240,'#b39bd9',1,1,'Morrow Lounge',1.5],
 ['morrow-console','Morrow Listening Console','listening-console',185,'#b58b74',2,1,'Morrow Lounge',1.5],
 ['morrow-bench','Morrow Channel Sofa','channel-sofa',195,'#718bb5',2,1,'Morrow Lounge',.5,true],
 ['morrow-light','Morrow Crescent Light','crescent-light',95,'#e4c286',1,1,'Morrow Lounge',1.5],
 ['dewglass-house','Dewglass Plant House','plant-house',170,'#8dc7b1',1,1,'Dewglass Garden',1.5],
 ['dewglass-basin','Dewglass Lily Basin','lily-basin',145,'#9ebbb0',1,1,'Dewglass Garden',.5],
 ['dewglass-trellis','Dewglass Vine Screen','vine-screen',125,'#9dbb8d',2,1,'Dewglass Garden',1.5],
 ['dewglass-seat','Dewglass Woven Seat','woven-seat',75,'#ceb68b',1,1,'Dewglass Garden',.5,true]
 ].map(([id,name,sprite_id,price,color,width,length,category,item_height,can_sit=false])=>({id,name,sprite_id,price,color,width,length,category,item_height,can_sit,can_lay:false,can_stack:false,walkable:false,tradeable:true,supply_limit:null,minted:0}));
 const collections=[
 {name:'Bramble Cafe',tag:'A LITTLE EVERYDAY MAGIC',description:'Warm wood, fresh pastries and a seat for a friend.',color:'#dcad79',ids:items.slice(0,4).map(i=>i.id)},
 {name:'Morrow Lounge',tag:'YOUR AFTER-HOURS CORNER',description:'Soft blue seats, vinyl details and a warm crescent glow.',color:'#b39bd9',ids:items.slice(4,8).map(i=>i.id)},
 {name:'Dewglass Garden',tag:'LET YOUR ROOM BREATHE',description:'Glass, woven textures and a quiet lily-water corner.',color:'#8dc7b1',ids:items.slice(8).map(i=>i.id)}
 ];
 function vignette(collection,catalog=items){const positions=[[1,1],[3,1],[1,3],[3,3]];return collection.ids.map((id,i)=>{const d=catalog.find(d=>d.id===id);return d?{...d,sprite:d.sprite_id,x:positions[i][0],y:positions[i][1],z:0,rotation:0}:null;}).filter(Boolean);}
 return {items,collections,vignette};
});
