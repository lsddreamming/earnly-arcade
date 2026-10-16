import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RoomGrid,parseHeightmap} from '../src/grid.ts';
import {RoomRuntime} from '../src/room-runtime.ts';
test('intents cannot impersonate or move before server tick; collisions stay exclusive',()=>{
 const room=new RoomRuntime(new RoomGrid(parseHeightmap('000\n000')));
 const a:Record<string,unknown>[]=[],b:Record<string,unknown>[]=[];
 room.join({userId:'a',username:'A'},{x:0,y:0},p=>a.push(p));
 room.join({userId:'b',username:'B'},{x:2,y:0},p=>b.push(p));
 assert.equal(room.receive('a',{type:'MOVE_TO',x:1,y:0,userId:'b'},0),false);
 assert.equal(room.receive('a',{type:'MOVE_TO',x:1,y:0},100),true);
 assert.equal(room.receive('b',{type:'MOVE_TO',x:1,y:0},100),true);
 assert.equal(a.some(p=>p.type==='ROOM_DELTA'),false);
 room.tick();
 const delta=a.find(p=>p.type==='ROOM_DELTA')!;
 const users=delta.users as {userId:string;position:{x:number}}[];
 assert.equal(users.find(u=>u.userId==='a')!.position.x,1);
 assert.equal(users.find(u=>u.userId==='b')!.position.x,2);
});
test('whispers reach only sender and adjacent target and respect reciprocal blocks',()=>{
 const room=new RoomRuntime(new RoomGrid(parseHeightmap('000')));
 const packets:Record<string,unknown>[][]=[[],[],[]];
 ['a','b','c'].forEach((id,x)=>room.join({userId:id,username:id},{x,y:0},p=>packets[x].push(p)));
 assert.equal(room.chat('a','private','whisper','c',0,()=>false),false);
 assert.equal(room.chat('a','private','whisper','b',0,()=>false),true);
 assert.equal(packets[2].some(p=>p.type==='CHAT'),false);
 assert.equal(packets[1].filter(p=>p.type==='CHAT').length,1);
 room.chat('a','blocked','normal',undefined,5000,(a,b)=>a==='b'&&b==='a');
 assert.equal(packets[1].filter(p=>p.type==='CHAT').length,1);
});

test('seat and bed interactions reserve occupied tiles and exit on server ticks',()=>{
 const grid=new RoomGrid(parseHeightmap('0000\n0000\n0000'),[{id:'seat',x:1,y:1,z:0,width:1,length:1,rotation:0,itemHeight:.5,walkable:false,canStack:false,canSit:true,canLay:true}]);
 const room=new RoomRuntime(grid);
 room.join({userId:'a',username:'A'},{x:0,y:1},()=>{});
 room.join({userId:'b',username:'B'},{x:2,y:1},()=>{});
 assert.equal(room.receive('a',{type:'INTERACT',action:'sit',x:1,y:1},0),true);
 assert.equal(room.receive('b',{type:'INTERACT',action:'lay',x:1,y:1},0),false);
 assert.equal(room.members()[0].state,'std');room.tick();
 assert.equal(room.members()[0].state,'sit');assert.equal(room.members()[1].state,'std');
 assert.equal(room.receive('a',{type:'MOVE_TO',x:0,y:1},250),true);room.tick();
 assert.deepEqual(room.members()[0].position,{x:0,y:1,z:0});
 assert.equal(room.receive('b',{type:'INTERACT',action:'lay',x:1,y:1},500),true);room.tick();
 assert.equal(room.members()[1].state,'lay');
});

for(const seats of [2,3])for(const rotation of [0,2,4,6] as const)test(`${seats}-tile sofa rotation ${rotation} seats concurrent players separately`,()=>{
 const turned=rotation===2||rotation===6;
 const room=new RoomRuntime(new RoomGrid(parseHeightmap(Array(8).fill('00000000').join('\n')),[{id:'sofa',x:2,y:2,z:0,width:seats,length:1,rotation,itemHeight:.5,walkable:false,canStack:false,canSit:true}]));
 for(let i=0;i<seats+1;i++)room.join({userId:String(i),username:String(i)},turned?{x:1,y:2+i}:{x:2+i,y:1},()=>{});
 // All players tap the same sofa tile before any of them sits.
 for(let i=0;i<seats;i++)assert.equal(room.receive(String(i),{type:'INTERACT',action:'sit',x:2,y:2},0),true);
 assert.equal(room.receive(String(seats),{type:'INTERACT',action:'sit',x:2,y:2},0),false);
 for(let tick=0;tick<30;tick++)room.tick();
 const seated=room.members().filter(m=>m.state==='sit');assert.equal(seated.length,seats);
 assert.equal(new Set(seated.map(m=>m.position.x+','+m.position.y)).size,seats);
 room.leave('0');
 assert.equal(room.receive(String(seats),{type:'INTERACT',action:'sit',x:2,y:2},1000),true);
 for(let tick=0;tick<30;tick++)room.tick();
 assert.equal(room.members().filter(m=>m.state==='sit').length,seats);
});
