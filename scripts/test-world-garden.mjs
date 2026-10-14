import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {worldFixture} from './world-test-fixture.mjs';
import {RoomGrid,parseHeightmap} from '../world-server/src/grid.ts';
const fixture=await worldFixture(),[owner]=fixture.users;
const api=async(action,data={})=>(await fixture.db.query('select public.world_api($1,$2,$3::jsonb) result',[owner,action,JSON.stringify(data)])).rows[0].result;
try{
 const initial=await api('bootstrap');assert.equal(initial.catalog.length,24);
 for(const id of ['palm-tree','ficus-tree','blossom-tree','flower-pot']){
  const d=initial.catalog.find(d=>d.id===id);assert.deepEqual([d.width,d.length,d.walkable,d.can_sit,d.can_stack],[1,1,false,false,false]);
  const requestId=randomUUID(),purchase=await api('buy',{definitionId:id,requestId});
  assert.equal((await api('buy',{definitionId:id,requestId})).item_id,purchase.item_id,'Purchase retries must not charge twice');
  const grid=new RoomGrid(parseHeightmap('000\n000\n000'),[{id:purchase.item_id,x:1,y:1,z:0,width:d.width,length:d.length,itemHeight:d.item_height,rotation:0,walkable:d.walkable,canStack:d.can_stack}],0);
  assert.equal(grid.tile({x:1,y:1}).walkable,false);assert.equal(grid.tile({x:2,y:1}).walkable,true,'A tree must occupy exactly one floor tile');
 }
 assert.equal(Number((await api('bootstrap')).balance),Number(initial.balance)-480);
 const rooms=(await fixture.db.query('select public_items from earnly_world.rooms where owner_id is null')).rows;
 assert.equal(rooms.length,4);for(const r of rooms)assert.ok(r.public_items.some(i=>['tree','palm'].includes(i.sprite)&&i.width===1&&i.length===1));
 console.log('Garden catalog: 24 items, four single-tile plants, idempotent purchases, exact charges, and greenery in every furnished public room passed.');
}finally{await fixture.close();}
