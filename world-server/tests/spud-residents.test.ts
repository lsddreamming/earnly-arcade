import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SpudResidents,SPUDS} from '../src/spud-residents.ts';
import {RoomGrid,parseHeightmap,tileKey} from '../src/grid.ts';
import {RoomRuntime} from '../src/room-runtime.ts';
import {MovementController} from '../src/movement.ts';
const floor=()=>parseHeightmap(Array(12).fill('000000000000').join('\n'));
function random(){let x=19;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/2**32;};}
test('At most five distinct Spuds adapt to real occupancy; snapshots never count as players',()=>{
 const room=new RoomRuntime(new RoomGrid(floor()));room.enableResidents();
 room.join({userId:'u',username:'Tester'},{x:0,y:0},()=>{});
 for(let i=0;i<10;i++)room.tick();
 assert.equal(room.spuds.snapshots().length,5);assert.equal(room.memberCount,1);assert.equal(room.members().length,1);
 assert.equal(new Set(room.spuds.snapshots().map(s=>s.residentId)).size,5);
 for(const s of room.spuds.snapshots()){assert.equal(s.isAI,true);assert.ok(s.equipped.avatar.imageUrl.startsWith('cosmetic-'));}
 const group=new SpudResidents(random()),grid=new RoomGrid(parseHeightmap(Array(20).fill('0'.repeat(20)).join('\n')));for(let i=0;i<10;i++)group.tick(grid,new Set(),1,true);
 assert.equal(group.snapshots().length,5);for(let i=0;i<80;i++)group.tick(grid,new Set(),25,true);assert.equal(group.snapshots().length,4,'crowds retire one resident at a time');for(let i=0;i<800;i++)group.tick(grid,new Set(),25,true);assert.equal(group.snapshots().length,0);for(let i=0;i<400;i++)group.tick(grid,new Set(),1,true);assert.equal(group.snapshots().length,5,'quiet rooms repopulate gradually');
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

test('public rooms have different stable lineups with four or five residents even on large floors',()=>{
 const grid=new RoomGrid(parseHeightmap(Array(20).fill('0'.repeat(20)).join('\n'))),lineups=[];
 for(const key of ['hotel-lobby','rooftop-lounge','patio-hangout']){const group=new SpudResidents(random());group.setRoomKey(key);for(let i=0;i<10;i++)group.tick(grid,new Set(),1,true);const ids=group.snapshots().map(s=>s.residentId).sort();assert.ok(ids.length>=4&&ids.length<=5);const again=new SpudResidents(random());again.setRoomKey(key);for(let i=0;i<10;i++)again.tick(grid,new Set(),1,true);assert.deepEqual(again.snapshots().map(s=>s.residentId).sort(),ids);lineups.push(ids.join(','));}assert.equal(new Set(lineups).size,3);
});
test('conversation leases pause walking, survive crowd taper, support multiple speakers and expire safely',()=>{
 const grid=new RoomGrid(floor()),group=new SpudResidents(random());for(let i=0;i<10;i++)group.tick(grid,new Set(),1,true);const id=group.snapshots()[0].residentId;
 group.focus('one',id);group.focus('two',id);const position=group.snapshots().find(s=>s.residentId===id)!.position;
 for(let i=0;i<100;i++)group.tick(grid,new Set(),25,true);assert.deepEqual(group.snapshots().find(s=>s.residentId===id)!.position,position);
 group.release('one');assert.equal(group.snapshots().find(s=>s.residentId===id)!.activity,'chatting');
 for(let i=0;i<79;i++)group.tick(grid,new Set(),25,true);assert.deepEqual(group.snapshots().find(s=>s.residentId===id)!.position,position);
 group.tick(grid,new Set(),1,true);assert.notEqual(group.snapshots().find(s=>s.residentId===id)!.activity,'chatting');
 for(let i=0;i<800;i++)group.tick(grid,new Set(),1,true);assert.notDeepEqual(group.snapshots().find(s=>s.residentId===id)!.position,position);
});

test('wandering Spuds yield to a player route instead of stepping into the path to a seat',()=>{
 const grid=new RoomGrid(floor()),group=new SpudResidents(random());for(let i=0;i<10;i++)group.tick(grid,new Set(),1,true);
 const movement=new MovementController(grid,{x:0,y:0});assert.equal(movement.moveTo(grid,{type:'MOVE_TO',x:11,y:11},group.occupied()).status,'ok');
 const route=new Set(movement.plannedTiles().map(tileKey));assert.ok(route.size>10);
 for(let i=0;i<400;i++){group.tick(grid,new Set(['0,0',...route]),1,true);for(const s of group.snapshots())assert.ok(!route.has(tileKey(s.position)));}
});
