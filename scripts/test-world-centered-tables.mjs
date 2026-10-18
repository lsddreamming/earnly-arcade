import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {worldFixture} from './world-test-fixture.mjs';
import {SupabaseWorldAccess} from '../world-server/src/supabase-access.ts';
const {db,users,close}=await worldFixture();
const api=async(action,data={})=>(await db.query('select public.world_api($1,$2,$3::jsonb) result',[users[0],action,JSON.stringify(data)])).rows[0].result;
try{
 for(const name of ['20261018001334_world_furniture_colors','20261018001810_world_center_tables'])await db.exec(await readFile('supabase/migrations/'+name+'.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/20261018001810_world_center_tables.sql','utf8'));
 const identity={userId:users[0],username:'Player0'},access=new SupabaseWorldAccess('https://world-test.invalid','test');const entered=await access.enter(identity,'home'),roomId=entered.roomId;
 const buy=async definitionId=>(await api('buy',{definitionId,requestId:crypto.randomUUID()})).item_id;
 const rug=await buy('mint-rug'),table=await buy('low-table'),chair=await buy('arcade-chair');
 const place=data=>access.perform(identity,roomId,'place',data);
 await place({itemId:rug,x:2,y:2,rotation:0});
 const result=await place({itemId:table,centerOnRug:rug,rotation:0});
 const t=result.data.items.find(i=>i.id===table);assert.equal(t.centered,true);assert.equal(t.x,2);assert.equal(t.y,2);assert.equal(t.z,.25);assert.equal(t.canStack,false);
 for(const [x,y]of [[2,2],[2,3],[3,2],[3,3]])assert.equal(entered.room.grid.tile({x,y}).walkable,false,'Centered table protects all touched tiles');
 await assert.rejects(place({itemId:chair,x:3,y:3,rotation:0}));
 await assert.rejects(place({itemId:rug,pickup:true}),'Cannot remove supporting rug');
 await assert.rejects(place({itemId:chair,centerOnRug:rug,rotation:0}),'Only small tables center');
 await assert.rejects(place({itemId:table,centerOnRug:chair,rotation:0}),'Requires an actual rug');
 const rotated=await place({itemId:table,x:2,y:2,rotation:2});assert.equal(rotated.data.items.find(i=>i.id===table).centered,true);
 const reloaded=await new SupabaseWorldAccess('https://world-test.invalid','test').enter(identity,roomId);assert.equal(reloaded.scene.items.find(i=>i.id===table).centered,true);
 const moved=await place({itemId:table,x:5,y:5,rotation:0,centered:false});assert.equal(moved.data.items.find(i=>i.id===table).centered,false);assert.equal(entered.room.grid.tile({x:3,y:3}).walkable,true);
 await place({itemId:chair,x:3,y:3,rotation:0});await assert.rejects(place({itemId:table,centerOnRug:rug,rotation:0}),'Occupied rugs cannot accept centered tables');
 await place({itemId:chair,pickup:true});await place({itemId:table,centerOnRug:rug,rotation:0});await place({itemId:table,pickup:true});
 assert.equal((await api('bootstrap')).items.find(i=>i.id===table).centered,false);await place({itemId:rug,pickup:true});
 console.log('PASS: rug center placement, rotation/reconnect persistence, touched-tile collision, support protection, table/rug eligibility, occupied rejection and ordinary movement reset.');
}finally{await close();}
