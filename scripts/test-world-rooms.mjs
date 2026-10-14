import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {worldFixture} from './world-test-fixture.mjs';
import {findPath,canStep} from '../world-server/src/pathfinding.ts';
import {RoomGrid,parseHeightmap} from '../world-server/src/grid.ts';
const layouts=createRequire(import.meta.url)('../world-room-layouts.js');
const fixture=await worldFixture(),[owner,other]=fixture.users;
const api=async(action,data={})=>(await fixture.db.query('select public.world_api($1,$2,$3::jsonb) result',[owner,action,JSON.stringify(data)])).rows[0].result;
try{
 const before=(await api('bootstrap')).balance;
 const publicRooms=(await fixture.db.query('select heightmap,public_items from earnly_world.rooms where owner_id is null')).rows;
 for(const room of publicRooms){assert.equal(room.heightmap.split('\n').length,24);assert.equal(room.heightmap.split('\n')[0].length,24);assert.ok(room.public_items.filter(i=>i.canSit).length>=10);assert.ok(new RoomGrid(parseHeightmap(room.heightmap),room.public_items,0));}
 const first=await api('create_room',{name:'First home',layout:'corner',firstRoom:true});
 assert.equal((await api('create_room',{name:'Retry',layout:'studio',firstRoom:true})).roomId,first.roomId);
 for(const layout of layouts){
  const created=await api('create_room',{name:layout.name,layout:layout.id});
  const room=(await fixture.db.query('select * from earnly_world.rooms where id=$1',[created.roomId])).rows[0];
  assert.equal(room.owner_id,owner);assert.equal(room.access_type,'closed');assert.equal(room.heightmap,layout.heightmap);
  const rows=layout.heightmap.split('\n'),grid=new RoomGrid(parseHeightmap(room.heightmap),[],0);
  assert.equal(layout.heightmap.replace(/[^0-9]/g,'').length,64*(layouts.indexOf(layout)+1));
  if(layout.id==='corner'){const down=findPath(grid,{x:3,y:2},{x:3,y:12}),up=findPath(grid,{x:3,y:12},{x:3,y:2});assert.equal(down.status,'ok');assert.equal(up.status,'ok');assert.ok(down.path.some(p=>p.z===1));assert.equal(down.path.at(-1).z,0);assert.equal(up.path.at(-1).z,2);}
  assert.ok(grid); // Parser validates bounded legal heightmaps.
  const seen=new Set(['0,0']),queue=[[0,0]];
  while(queue.length){const [x,y]=queue.shift();for(const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){const key=nx+','+ny;if(canStep(grid,{x,y},{x:nx,y:ny})&&!seen.has(key)){seen.add(key);queue.push([nx,ny]);}}}
  assert.equal(seen.size,layout.heightmap.replace(/[^0-9]/g,'').length,'Every floor tile must be reachable');
  await assert.rejects(fixture.db.query('select public.world_room_snapshot($1,$2)',[other,created.roomId]));
 }
 assert.equal((await api('bootstrap')).rooms.filter(r=>r.ownerId===owner).length,6,'Creation works beyond the old three-room cap');
 assert.equal((await api('bootstrap')).balance,before,'All rooms must be free');
 await assert.rejects(api('create_room',{name:'Invalid',layout:'custom-unbounded'}));
 await fixture.db.exec('set role authenticated');await assert.rejects(api('create_room',{name:'Impersonation',layout:'studio'}));
 console.log('Room choices: five matching connected footprints, private ownership, free creation beyond three rooms, idempotent first choice and restricted RPC passed.');
}finally{await fixture.close();}
