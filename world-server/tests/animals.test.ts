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
 for(let i=0;i<250;i++)room.tick();assert.deepEqual(room.staff()[0].position,{...pets[0].path[0],z:0});
 room.leave('a');let resumed=false;for(let i=0;i<250;i++){room.tick();if(tileKey(room.staff()[0].position)!==tileKey(pets[0].path[0])){resumed=true;break;}}assert(resumed);
 const p=room.staff()[0].position;
 assert.equal(room.canReplace(new RoomGrid(parseHeightmap(HANGOUT_FLOOR),[{id:'obstacle',...p,width:1,length:1,rotation:0,itemHeight:1,walkable:false,canStack:false}])),false);
});

test('personal pets rest 20–60 seconds, take long walks, and share sparse species bubbles',()=>{
 const grid=new RoomGrid(parseHeightmap(Array(12).fill('000000000000').join('\n')),[]);
 const room=new RoomRuntime(grid,25,[],[{id:'dog',ownerId:'a',name:'Biscuit',species:'dog',color:'#cc965c'}]);
 const a:Record<string,unknown>[]=[],b:Record<string,unknown>[]=[];room.join({userId:'a',username:'A'},room.availableSpawn(),p=>a.push(p));room.join({userId:'b',username:'B'},room.availableSpawn(),p=>b.push(p));
 let last=room.staff()[0].position,lastMove=0,firstMove=0,run=0,longest=0;const rests:number[]=[],voices:number[]=[];
 for(let tick=1;tick<=3000;tick++){
  const before=a.length;room.tick();const current=room.staff()[0].position;
  if(tileKey(current)!==tileKey(last)){const gap=tick-lastMove;if(!firstMove)firstMove=tick;else if(gap>3){rests.push(gap);run=0;}run++;longest=Math.max(longest,run);lastMove=tick;last=current;}
  if(a.slice(before).some(p=>p.type==='PET_CHAT'))voices.push(tick);
 }
 assert(firstMove>=80&&firstMove<=240);assert(rests.length>4);assert(rests.every(n=>n>=80&&n<=240));assert(longest>=4);
 assert(voices.length>=2&&voices.length<=3);assert(voices[0]>=1080&&voices[0]<=1320);assert(voices.slice(1).every((t,i)=>t-voices[i]>=1080&&t-voices[i]<=1320));
 assert.deepEqual(a.filter(p=>p.type==='PET_CHAT'),b.filter(p=>p.type==='PET_CHAT'));assert(a.filter(p=>p.type==='PET_CHAT').every(p=>p.text==='Woof!'));
});
