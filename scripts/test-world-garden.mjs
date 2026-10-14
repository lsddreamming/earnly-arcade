import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {worldFixture} from './world-test-fixture.mjs';
import {canStep} from '../world-server/src/pathfinding.ts';
import {RoomGrid,parseHeightmap} from '../world-server/src/grid.ts';
const fixture=await worldFixture(),[owner]=fixture.users;
const api=async(action,data={})=>(await fixture.db.query('select public.world_api($1,$2,$3::jsonb) result',[owner,action,JSON.stringify(data)])).rows[0].result;
try{
 const initial=await api('bootstrap');assert.equal(initial.catalog.length,30);
 for(const id of ['palm-tree','ficus-tree','blossom-tree','flower-pot']){
  const d=initial.catalog.find(d=>d.id===id);assert.deepEqual([d.width,d.length,d.walkable,d.can_sit,d.can_stack],[1,1,false,false,false]);
  const requestId=randomUUID(),purchase=await api('buy',{definitionId:id,requestId});
  assert.equal((await api('buy',{definitionId:id,requestId})).item_id,purchase.item_id,'Purchase retries must not charge twice');
  const grid=new RoomGrid(parseHeightmap('000\n000\n000'),[{id:purchase.item_id,x:1,y:1,z:0,width:d.width,length:d.length,itemHeight:d.item_height,rotation:0,walkable:d.walkable,canStack:d.can_stack}],0);
  assert.equal(grid.tile({x:1,y:1}).walkable,false);assert.equal(grid.tile({x:2,y:1}).walkable,true,'A tree must occupy exactly one floor tile');
 }
 assert.equal(Number((await api('bootstrap')).balance),Number(initial.balance)-480);
 for(const id of ['heirloom-clock','retro-tv','courtyard-fountain','woven-divider','marble-column','ruby-sofa']){
  const d=initial.catalog.find(d=>d.id===id);assert.ok(d);const requestId=randomUUID();const bought=await api('buy',{definitionId:id,requestId});assert.equal((await api('buy',{definitionId:id,requestId})).item_id,bought.item_id);
 }
 assert.equal(Number((await api('bootstrap')).balance),Number(initial.balance)-1520);
 const rooms=(await fixture.db.query('select heightmap,public_items from earnly_world.rooms where owner_id is null')).rows;
 assert.equal(rooms.length,4);for(const r of rooms)assert.ok(r.public_items.some(i=>['tree','palm'].includes(i.sprite)&&i.width===1&&i.length===1));
 for(const r of rooms){
  const used=new Set();for(const i of r.public_items.filter(i=>!i.walkable))for(let y=i.y;y<i.y+i.length;y++)for(let x=i.x;x<i.x+i.width;x++){assert.ok(!used.has(x+','+y),'Public furniture must not overlap');used.add(x+','+y);}
  const grid=new RoomGrid(parseHeightmap(r.heightmap),r.public_items,0),seen=new Set(['0,0']),queue=[[0,0]];
  while(queue.length){const [x,y]=queue.shift();for(const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]])if(!seen.has(nx+','+ny)&&canStep(grid,{x,y},{x:nx,y:ny})){seen.add(nx+','+ny);queue.push([nx,ny]);}}
  for(let y=0;y<24;y++)for(let x=0;x<24;x++)if(grid.tile({x,y}).walkable)assert.ok(seen.has(x+','+y),'Every public floor tile must remain reachable');
 }
 console.log('Garden catalog: 30 items, four single-tile plants, idempotent purchases, exact charges, and greenery in every furnished public room passed.');
}finally{await fixture.close();}
