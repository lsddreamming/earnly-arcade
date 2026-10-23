import {test,mock,beforeEach,afterEach} from 'node:test';
beforeEach(()=>mock.method(Math,'random',()=>0.314159));
afterEach(()=>mock.restoreAll());
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

test('only an owner can call a pet; it walks beside them and rests before roaming',()=>{
 const grid=new RoomGrid(parseHeightmap(Array(12).fill('000000000000').join('\n')),[]),room=new RoomRuntime(grid,25,[],[{id:'p',ownerId:'a',name:'Pup',species:'dog',color:'#cc965c'}]);
 const start=room.staff()[0].position,owner={x:start.x<6?11:0,y:start.y<6?11:0};
 const a:Record<string,unknown>[]=[],b:Record<string,unknown>[]=[];room.join({userId:'a',username:'A'},owner,p=>a.push(p));room.join({userId:'b',username:'B'},room.availableSpawn(),p=>b.push(p));
 assert.throws(()=>room.petInteract('b','pet-p','call'),/owner/);assert.throws(()=>room.petInteract('outsider','pet-p','pet'),/unavailable/);assert.throws(()=>room.petInteract('a','pet-p','pet'),/beside/);
 assert.match(room.petInteract('a','pet-p','call').message,/coming/);assert.throws(()=>room.petInteract('a','pet-p','call'),/moment/);
 let last=room.staff()[0].position,steps=0;
 for(let n=0;n<90;n++){room.tick();const p=room.staff()[0].position;assert(Math.abs(p.x-last.x)+Math.abs(p.y-last.y)<=1);if(tileKey(p)!==tileKey(last))steps++;assert(!room.members().some(m=>tileKey(m.position)===tileKey(p)));last=p;if(room.talkToStaff('a','pet-p').canPet)break;}
 assert(steps>=Math.abs(start.x-owner.x)+Math.abs(start.y-owner.y)-2);assert(room.talkToStaff('a','pet-p').canPet);room.petInteract('a','pet-p','pet');assert.throws(()=>room.petInteract('a','pet-p','pet'),/moment/);
 assert.deepEqual(a.filter(p=>p.type==='PET_REACTION'),b.filter(p=>p.type==='PET_REACTION'));assert.equal(a.filter(p=>p.type==='PET_REACTION').length,1);
 const parked=room.staff()[0].position;for(let n=0;n<79;n++)room.tick();assert.deepEqual(room.staff()[0].position,parked);
});
test('calls respect obstacles and cancel when the owner leaves',()=>{
 const split=new RoomRuntime(new RoomGrid(parseHeightmap('00x00\n00x00\n00x00'),[]),25,[],[{id:'p',ownerId:'a',name:'Cat',species:'cat',color:'#999999'}]);split.join({userId:'a',username:'A'},{x:4,y:2},()=>{});assert.throws(()=>split.petInteract('a','pet-p','call'),/cannot reach/);
 const room=new RoomRuntime(new RoomGrid(parseHeightmap(Array(8).fill('00000000').join('\n')),[]),25,[],[{id:'p',ownerId:'a',name:'Cat',species:'cat',color:'#999999'}]);room.join({userId:'a',username:'A'},{x:7,y:7},()=>{});room.petInteract('a','pet-p','call');room.leave('a');const before=room.staff()[0].position;for(let n=0;n<40;n++)room.tick();assert.deepEqual(room.staff()[0].position,before);
});
test('visitors can pet a nearby companion but cannot spam reactions',()=>{
 const room=new RoomRuntime(new RoomGrid(parseHeightmap('0000\n0000\n0000'),[]),25,[],[{id:'p',ownerId:'a',name:'Bunny',species:'rabbit',color:'#eeeeee'}]);const p=room.staff()[0].position;room.join({userId:'guest',username:'Guest'},{x:p.x===0?1:p.x-1,y:p.y},()=>{});assert.equal(room.talkToStaff('guest','pet-p').canCall,false);assert.equal(room.talkToStaff('guest','pet-p').canPet,true);assert.match(room.petInteract('guest','pet-p','pet').message,/attention/);assert.throws(()=>room.petInteract('guest','pet-p','pet'),/moment/);
});
test('matching beds synchronize sleep, reserve occupancy and wake on owner call',()=>{
 const bed={id:'bed',x:6,y:6,z:0,width:1,length:1,rotation:0 as const,itemHeight:.25,walkable:true,canStack:false,petBed:'dog'};
 const grid=new RoomGrid(parseHeightmap(Array(9).fill('000000000').join('\n')),[bed]);
 const room=new RoomRuntime(grid,25,[],[{id:'dog',ownerId:'owner',name:'Pup',species:'dog',color:'#cc965c'}]);
 const a:Record<string,unknown>[]=[],b:Record<string,unknown>[]=[];
 room.join({userId:'owner',username:'Owner'},{x:1,y:1},p=>a.push(p));room.join({userId:'guest',username:'Guest'},{x:2,y:1},p=>b.push(p));
 let asleep=false;
 for(let i=0;i<20000;i++){room.tick();if(room.staff()[0].state==='sleep'){asleep=true;break;}}
 assert(asleep,'pet eventually chooses its matching bed');assert.deepEqual(room.staff()[0].position,{x:6,y:6,z:.25});
 const start=room.staff()[0].position;for(let i=0;i<100;i++)room.tick();assert.equal(room.staff()[0].state,'sleep');assert.deepEqual(room.staff()[0].position,start);
 assert.deepEqual(a.filter(p=>p.type==='NPC_SNAPSHOT'),b.filter(p=>p.type==='NPC_SNAPSHOT'));
 assert.throws(()=>room.petInteract('guest','pet-dog','call'),/owner/);assert.equal(room.staff()[0].state,'sleep');
 room.petInteract('owner','pet-dog','call');assert.equal(room.staff()[0].state,'std');
 let arrived=false;for(let i=0;i<120;i++){room.tick();const p=room.staff()[0].position;if(Math.hypot(p.x-1,p.y-1)<=1.5){arrived=true;break;}}assert(arrived);
});
test('pets cannot sleep in mismatched beds',()=>{
 const bed={id:'bed',x:3,y:3,z:0,width:1,length:1,rotation:0 as const,itemHeight:.25,walkable:true,canStack:false,petBed:'cat'};
 const room=new RoomRuntime(new RoomGrid(parseHeightmap('00000\n00000\n00000\n00000\n00000'),[bed]),25,[],[{id:'dog',ownerId:'o',name:'Pup',species:'dog',color:'#cc965c'}]);
 for(let i=0;i<3000;i++){room.tick();assert.equal(room.staff()[0].state,'std');}
});

test('a removed destination cancels the nap and two pets never share a bed',()=>{
 const floor=parseHeightmap(Array(8).fill('00000000').join('\n'));
 const bed={id:'bed',x:6,y:6,z:0,width:1,length:1,rotation:0 as const,itemHeight:.25,walkable:true,canStack:false,petBed:'cat'};
 const room=new RoomRuntime(new RoomGrid(floor,[bed]),25,[],[1,2].map(i=>({id:String(i),ownerId:'o',name:'Cat '+i,species:'cat' as const,color:'#aaa'})));
 let naps=0;for(let i=0;i<10000;i++){room.tick();const pets=room.staff();assert.notEqual(tileKey(pets[0].position),tileKey(pets[1].position));assert(pets.filter(p=>p.state==='sleep').length<=1);naps+=pets.some(p=>p.state==='sleep')?1:0;}assert(naps>0);
 // A same-height replacement changes the bed's purpose without displacing a pet.
 room.replaceGrid(new RoomGrid(floor,[{...bed,petBed:undefined}],1));room.tick();assert(room.staff().every(p=>p.state==='std'));
});
for(const species of ['dog','cat','rabbit'] as const)test(species+' toy play is shared, bounded, interruptible and followed by a long rest',()=>{
 const floor=parseHeightmap(Array(10).fill('0000000000').join('\n'));
 const item={id:'toy',x:4,y:4,z:0,width:1,length:1,rotation:0 as const,itemHeight:.25,walkable:true,canStack:false,petToy:species};
 const room=new RoomRuntime(new RoomGrid(floor,[item]),25,[],[{id:'p',ownerId:'o',name:'Pet',species,color:'#aaa'}]);
 const a:Record<string,unknown>[]=[],b:Record<string,unknown>[]=[];
 room.join({userId:'o',username:'Owner'},{x:1,y:1},p=>a.push(p));room.join({userId:'g',username:'Guest'},{x:2,y:1},p=>b.push(p));
 let started=false;for(let i=0;i<20000;i++){room.tick();if(room.staff()[0].state==='play'){started=true;break;}}assert(started);
 assert.equal(room.staff()[0].toyId,'toy');assert.equal(room.staff()[0].playElapsed,0);
 const positions=new Set<string>();for(let i=0;i<35;i++){const before=room.staff()[0].position;room.tick();const p=room.staff()[0];positions.add(tileKey(p.position));assert(Math.abs(p.position.x-before.x)+Math.abs(p.position.y-before.y)<=1);assert(!room.members().some(m=>tileKey(m.position)===tileKey(p.position)));}
 if(species!=='cat')assert(positions.size>=3);assert.equal(room.staff()[0].state,'std');const pos=room.staff()[0].position;for(let i=0;i<200;i++)room.tick();assert.deepEqual(room.staff()[0].position,pos);
 assert.deepEqual(a.filter(p=>p.type==='NPC_SNAPSHOT'),b.filter(p=>p.type==='NPC_SNAPSHOT'));
 for(let i=0;i<20000&&room.staff()[0].state!=='play';i++)room.tick();assert.equal(room.staff()[0].state,'play');
 assert.throws(()=>room.petInteract('g','pet-p','call'),/owner/);room.petInteract('o','pet-p','call');assert.equal(room.staff()[0].state,'std');assert.equal(room.staff()[0].toyId,undefined);
});
test('removed toys cancel play and two pets cannot reserve the same toy',()=>{
 const floor=parseHeightmap(Array(9).fill('000000000').join('\n')),toy={id:'toy',x:4,y:4,z:0,width:1,length:1,rotation:0 as const,itemHeight:.25,walkable:true,canStack:false,petToy:'cat'};
 const room=new RoomRuntime(new RoomGrid(floor,[toy]),25,[],[1,2].map(i=>({id:String(i),ownerId:'o',name:'Cat',species:'cat' as const,color:'#aaa'})));
 let played=false;for(let i=0;i<20000;i++){room.tick();assert(room.staff().filter(s=>s.state==='play').length<=1);if(room.staff().some(s=>s.state==='play')){played=true;break;}}assert(played);
 room.replaceGrid(new RoomGrid(floor,[{...toy,petToy:undefined}],1));room.tick();assert(room.staff().every(s=>s.state==='std'));
});

test('new pets vary across reachable floor, keep entry clear and preserve positions on refresh',()=>{
 const positions=new Set<string>(),floor=parseHeightmap(Array(10).fill('0000000000').join('\n'));
 const pets=[1,2,3].map(i=>({id:String(i),ownerId:'o',name:'Pet '+i,species:'cat' as const,color:'#aaa'}));
 for(let seed=1;seed<=100;seed++){
  mock.restoreAll();mock.method(Math,'random',()=>seed/101);
  const grid=new RoomGrid(floor,[{id:'sofa',x:3,y:3,z:0,width:2,length:1,rotation:0,itemHeight:1,walkable:false,canStack:false}]),room=new RoomRuntime(grid);
  room.join({userId:'o',username:'Owner'},{x:5,y:5},()=>{});room.setPets(pets);
  const before=room.staff();assert.equal(before.length,3);assert.equal(new Set(before.map(p=>tileKey(p.position))).size,3);
  for(const p of before){assert(p.position.x+p.position.y>=3);assert(grid.tile(p.position)?.walkable);assert(!grid.tile(p.position)?.itemId);assert.notEqual(tileKey(p.position),'5,5');positions.add(tileKey(p.position));}
  room.setPets(pets.map(p=>({...p,name:p.name+' renamed'})));assert.deepEqual(room.staff().map(p=>p.position),before.map(p=>p.position));
  assert.deepEqual(room.availableSpawn(),{x:0,y:0});
 }
 assert(positions.size>50,'starts are distributed through the room');
});
test('pet starts exclude sealed floor islands, occupied tiles and the last entrance tile',()=>{
 const pet={id:'p',ownerId:'o',name:'Pet',species:'cat' as const,color:'#aaa'};
 for(let seed=1;seed<=20;seed++){
  mock.restoreAll();mock.method(Math,'random',()=>seed/21);
  const room=new RoomRuntime(new RoomGrid(parseHeightmap('00x000\n00x000\n00x000'),[]),25,[],[pet]);assert(room.staff()[0].position.x<2);
 }
 const tiny=new RoomRuntime(new RoomGrid(parseHeightmap('00'),[]),25,[],[pet]);assert.deepEqual(tiny.staff()[0].position,{x:1,y:0,z:0});assert.deepEqual(tiny.availableSpawn(),{x:0,y:0});
 const full=new RoomRuntime(new RoomGrid(parseHeightmap('0'),[]),25,[],[pet]);assert.equal(full.staff().length,0);assert.deepEqual(full.availableSpawn(),{x:0,y:0});
});
