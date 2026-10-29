import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SpudResidents,SPUDS} from '../src/spud-residents.ts';
import {RoomGrid,parseHeightmap,tileKey} from '../src/grid.ts';
import {RoomRuntime} from '../src/room-runtime.ts';
const floor=()=>parseHeightmap(Array(12).fill('000000000000').join('\n'));
function random(){let x=19;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/2**32;};}
test('5–10 distinct Spuds adapt to real occupancy; snapshots never count as players',()=>{
 const room=new RoomRuntime(new RoomGrid(floor()));room.enableResidents();
 room.join({userId:'u',username:'Tester'},{x:0,y:0},()=>{});
 for(let i=0;i<10;i++)room.tick();
 assert.equal(room.spuds.snapshots().length,5);assert.equal(room.memberCount,1);assert.equal(room.members().length,1);
 assert.deepEqual(room.spuds.snapshots().slice(0,4).map(s=>s.username),['Jax','Blitz','Mochi','Zippy']);
 for(const s of room.spuds.snapshots()){assert.equal(s.isAI,true);assert.ok(s.equipped.avatar.imageUrl.startsWith('cosmetic-'));}
 const group=new SpudResidents(random()),grid=new RoomGrid(floor());for(let i=0;i<10;i++)group.tick(grid,new Set(),15,true);
 assert.equal(group.snapshots().length,10);for(let i=0;i<80;i++)group.tick(grid,new Set(),1,true);assert.equal(group.snapshots().length,5);
});
test('bounded simulation wanders, sits, dances and admires without overlapping or entering solid furniture',()=>{
 const chair={id:'chair',x:5,y:5,z:0,width:1,length:1,rotation:0 as const,itemHeight:1,walkable:false,canStack:false,canSit:true};
 const grid=new RoomGrid(floor(),[chair]),group=new SpudResidents(random()),occupied=new Set(['0,0','1,0','2,0']);
 const activities=new Set<string>(),places=new Set<string>();
 for(let i=0;i<12000;i++){
  group.tick(grid,occupied,2,true);const snapshots=group.snapshots();assert.equal(new Set(snapshots.map(s=>tileKey(s.position))).size,snapshots.length);
  for(const s of snapshots){assert.ok(!occupied.has(tileKey(s.position)));assert.ok(s.state==='sit'?grid.tile(s.position)?.canSit:grid.tile(s.position)?.walkable);activities.add(s.activity);places.add(tileKey(s.position));}
 }
 for(const activity of ['wandering','sitting','dancing','admiring'])assert.ok(activities.has(activity),activity);
 assert.ok(places.size>40);assert.equal(SPUDS.length,10);
});
test('private rooms stay empty; invitation expires and only its owner can dismiss',()=>{
 const grid=new RoomGrid(floor()),group=new SpudResidents(random());for(let i=0;i<100;i++)group.tick(grid,new Set(),1,false);assert.equal(group.snapshots().length,0);
 group.invite(grid,new Set(),'jax','owner');assert.equal(group.dismiss('stranger'),false);assert.equal(group.snapshots().length,1);
 for(let i=0;i<2401;i++)group.tick(grid,new Set(),1,false);assert.equal(group.snapshots().length,0);
});
test('tiny and disconnected rooms fail safely instead of stacking residents',()=>{
 const group=new SpudResidents(random()),grid=new RoomGrid(parseHeightmap('00xx0000\n00xx0000'));
 for(let i=0;i<100;i++)group.tick(grid,new Set(),1,true);assert.equal(group.snapshots().length,0);
});
