import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HANGOUTS,HANGOUT_FLOOR,hangoutAnimals} from '../src/public-hangouts.ts';
import {RoomGrid,parseHeightmap,tileKey} from '../src/grid.ts';
import {RoomRuntime} from '../src/room-runtime.ts';
for(const h of HANGOUTS)test(h.name+' companion is synchronized, walks on free floor and remains separate from players',()=>{
 const animals=hangoutAnimals({ownerId:null,name:h.name}),grid=new RoomGrid(parseHeightmap(HANGOUT_FLOOR),h.items);
 const room=new RoomRuntime(grid,40,[...h.staff,...animals]);
 const a:Record<string,unknown>[]=[],b:Record<string,unknown>[]=[];
 room.join({userId:'a',username:'A'},room.availableSpawn(),p=>a.push(p));
 room.join({userId:'b',username:'B'},room.availableSpawn(),p=>b.push(p));
 a.length=0;b.length=0;const seen=new Set<string>();let previous=room.staff().find(s=>s.species)!;
 for(let i=0;i<1200;i++){
  room.tick();const pet=room.staff().find(s=>s.species)!;seen.add(tileKey(pet.position));
  assert(grid.tile(pet.position)?.walkable);assert(Math.abs(previous.position.x-pet.position.x)+Math.abs(previous.position.y-pet.position.y)<=1);
  assert(!room.members().some(m=>tileKey(m.position)===tileKey(pet.position)));previous=pet;
 }
 assert.equal(seen.size,animals[0].path.length);assert.equal(room.memberCount,2);
 assert.deepEqual(a.filter(p=>p.type==='NPC_SNAPSHOT'),b.filter(p=>p.type==='NPC_SNAPSHOT'));
 assert.equal(room.talkToStaff('a',animals[0].id).name,animals[0].name);
 assert.equal(room.receive('a',{type:'MOVE_PET',x:0,y:0},1000),false);
 assert.deepEqual(hangoutAnimals({ownerId:'a',name:h.name}),[]);
});
test('animals wait for occupied tiles, resume, and cannot be covered with furniture',()=>{
 const h=HANGOUTS[0],pets=hangoutAnimals({ownerId:null,name:h.name});
 const grid=new RoomGrid(parseHeightmap(HANGOUT_FLOOR),h.items),room=new RoomRuntime(grid,40,pets);
 room.join({userId:'a',username:'A'},pets[0].path[1],()=>{});
 for(let i=0;i<40;i++)room.tick();assert.deepEqual(room.staff()[0].position,{...pets[0].path[0],z:0});
 room.leave('a');for(let i=0;i<4;i++)room.tick();assert.deepEqual(room.staff()[0].position,{...pets[0].path[1],z:0});
 const p=room.staff()[0].position;
 assert.equal(room.canReplace(new RoomGrid(parseHeightmap(HANGOUT_FLOOR),[{id:'obstacle',...p,width:1,length:1,rotation:0,itemHeight:1,walkable:false,canStack:false}])),false);
});
