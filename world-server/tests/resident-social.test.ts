import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NaturalSocial,residentReply} from '../src/resident-social.ts';
import {RoomRuntime} from '../src/room-runtime.ts';
import {RoomGrid,parseHeightmap} from '../src/grid.ts';
test('Natural greetings enforce startup delay, global player throttle, room throttle and 10–15 minute resident cooldown',()=>{
 const social=new NaturalSocial(()=>0);
 assert.equal(social.greeting('a','room','jax',0),false);
 assert.equal(social.greeting('a','room','jax',29999),false);
 assert.equal(social.greeting('a','room','jax',30000),true);
 assert.equal(social.greeting('a','other-room','blitz',30001),false);
 assert.equal(social.greeting('b','room','blitz',30000),false);
 assert.equal(social.greeting('b','room','blitz',60000),true);
 assert.equal(social.greeting('a','other-room','jax',210000),false);
 assert.equal(social.greeting('a','other-room','blitz',210000),true);
 assert.equal(social.greeting('a','room','jax',629999),false);
 assert.equal(social.greeting('a','room','jax',630000),true);
 const slow=new NaturalSocial(()=>1);slow.greeting('a','r','jax',0);
 assert.equal(slow.greeting('a','r','jax',90000),true);assert.equal(slow.greeting('a','r','jax',989999),false);assert.equal(slow.greeting('a','r','jax',990000),true);
});
test('Quiet suppresses proactive greetings but manual chat stays available and rate limited',()=>{
 const s=new NaturalSocial(()=>0);s.setQuiet('a',true,0);assert.equal(s.greeting('a','r','jax',900000),false);
 s.chat('a',900000);assert.throws(()=>s.chat('a',900001),/moment/);s.chat('a',902000);
 s.setQuiet('a',false,902000);assert.equal(s.greeting('a','r','jax',902000),true);
});
test('tap-to-chat rejects forged residents, remote users and invalid topics without broadcasting private replies',()=>{
 const r=new RoomRuntime(new RoomGrid(parseHeightmap(Array(12).fill('000000000000').join('\n'))));r.enableResidents();r.enableSocial(new NaturalSocial(),'room');
 const packets:any[]=[];r.join({userId:'u',username:'U'},{x:0,y:0},p=>packets.push(p));for(let i=0;i<10;i++)r.tick();
 assert.throws(()=>r.residentChat('u','forged','hello',0),/near/);assert.throws(()=>r.residentChat('outsider','jax','hello',0),/near/);
 const jax=r.spuds.snapshots()[0],near={x:jax.position.x+1,y:jax.position.y};if(near.x>=12)near.x-=2;
 if(!r.staff().some(s=>s.position.x===near.x&&s.position.y===near.y)){
  r.join({userId:'near',username:'Near'},near,()=>{});const before=packets.length;
  assert.throws(()=>r.residentChat('near',jax.residentId,'erase_all',0),/topic/);
  assert.equal(r.residentChat('near',jax.residentId,'joke',0).isAI,true);assert.equal(packets.length,before);
 }
});
test('core personalities have distinct safe contextual dialogue',()=>{
 const replies=['jax','blitz','mochi','zippy'].map(id=>residentReply(id as any,'hello'));assert.equal(new Set(replies).size,4);
 assert.match(residentReply('jax','room',undefined,'Cloud Sofa'),/Cloud Sofa/);
});

test('opening a resident profile walks the player closer and holds the resident until leaving',()=>{
 const r=new RoomRuntime(new RoomGrid(parseHeightmap(Array(12).fill('000000000000').join('\n'))));r.enableSocial(new NaturalSocial(),'test-room');
 r.join({userId:'owner',username:'Owner'},{x:1,y:1},()=>{});r.inviteResident('owner','jax');
 const spud=r.spuds.snapshots()[0],candidates=[];for(let y=0;y<12;y++)for(let x=0;x<12;x++)if(Math.hypot(x-spud.position.x,y-spud.position.y)>3&&Math.hypot(x-spud.position.x,y-spud.position.y)<7)candidates.push({x,y});
 const start=candidates.find(p=>p.x!==1||p.y!==1)!;r.join({userId:'visitor',username:'Visitor'},start,()=>{});
 assert.throws(()=>r.residentFocus('outsider','jax',true,0),/resident/);assert.throws(()=>r.residentFocus('visitor','forged',true,0),/resident/);
 assert.equal(r.residentFocus('visitor','jax',true,1000).ready,false);const position={...spud.position};for(let i=0;i<20;i++)r.tick();
 assert.deepEqual(r.spuds.snapshots()[0].position,position);assert.equal(r.residentNearby('visitor','jax'),true);assert.equal(r.residentChat('visitor','jax','hello',3000).isAI,true);
 r.leave('visitor');assert.notEqual(r.spuds.snapshots()[0].activity,'chatting');
});

function publicRoom(){
 const r=new RoomRuntime(new RoomGrid(parseHeightmap(Array(20).fill('0'.repeat(20)).join('\n'))));r.enableSocial(new NaturalSocial(()=>0),'public-test');
 const packets=new Map<string,any[]>();const add=(id:string,p:{x:number;y:number})=>{const list:any[]=[];packets.set(id,list);r.join({userId:id,username:id},p,v=>list.push(v));};
 add('owner',{x:0,y:0});r.inviteResident('owner','jax');r.spuds.focus('test-hold','jax');
 const at=r.spuds.snapshots()[0].position;
 const free=(min:number,max:number)=>{for(let y=0;y<20;y++)for(let x=0;x<20;x++){const d=Math.hypot(x-at.x,y-at.y);if(d>=min&&d<=max&&!r.members().some(m=>m.position.x===x&&m.position.y===y)&&!(at.x===x&&at.y===y))return {x,y};}throw new Error('No free test position');};
 add('speaker',free(1,1.5));add('listener',free(1,2));add('blocked',free(1,2));add('far',free(10,20));
 const chats=(id:string)=>packets.get(id)!.filter(p=>p.type==='CHAT'&&p.isAI);const ticks=(n:number)=>{for(let i=0;i<n;i++)r.tick();};
 return {r,at,add,free,chats,ticks,packets};
}
test('public resident replies reach approved nearby listeners, allow another speaker, and never expose saved memories',()=>{
 const {r,chats,ticks,at}=publicRoom();
 r.setResidentMemory('speaker',{quiet:false,relations:[{residentId:'jax',friend:true,remember:true,visits:3,favoriteGame:'SECRET_PRIVATE_GAME'}]});
 assert.equal(r.queueResidentReply('outsider','hello',['speaker']),false);
 assert.equal(r.queueResidentReply('far','hello',['far'],'jax'),false);
 assert.equal(r.queueResidentReply('speaker','hello',['speaker','listener','far'],'forged'),false);
 assert.equal(r.queueResidentReply('speaker','Jax hello',['speaker','listener','far']),true);
 assert.equal(r.queueResidentReply('listener','hello',['speaker','listener']),false,'one reply at a time');ticks(3);assert.equal(chats('speaker').length,0);ticks(1);
 assert.equal(chats('speaker').length,1);assert.deepEqual(chats('speaker'),chats('listener'));assert.equal(chats('blocked').length,0);assert.equal(chats('far').length,0);
 assert.equal(chats('speaker')[0].userId,'ai-jax');assert.deepEqual(r.spuds.snapshots()[0].position,at);
 ticks(12);assert.equal(r.queueResidentReply('listener','what do you remember about me',['speaker','listener']),true);ticks(4);
 assert.match(chats('listener').at(-1).text,/memories are private/);assert.ok(!JSON.stringify(chats('listener')).includes('SECRET_PRIVATE_GAME'));
 ticks(12);assert.equal(r.queueResidentReply('listener','something else',['speaker','listener']),true,'nearby players can join the ongoing group conversation');
});
test('a pending public reply is cancelled when its speaker leaves; public focus never changes movement',()=>{
 const {r,chats,ticks,free}=publicRoom();
 const goal=free(2,4);assert.equal(r.receive('speaker',{type:'MOVE_TO',...goal},1000),true);
 assert.equal(r.residentFocus('speaker','jax',true,1001,true).ready,true);ticks(24);
 assert.deepEqual(r.members().find(m=>m.userId==='speaker')!.position,{...goal,z:0});
 assert.equal(r.queueResidentReply('speaker','hello',['speaker','listener'],'jax'),true);r.leave('speaker');ticks(4);assert.equal(chats('listener').length,0);
});
test('ambient resident conversations use two public speakers, respect Quiet, and stay bounded',t=>{
 t.mock.method(Math,'random',()=>0.2);const r=new RoomRuntime(new RoomGrid(parseHeightmap(Array(8).fill('00000000').join('\n'))));r.enableSocial(new NaturalSocial(()=>0),'ambient');
 const events=new Map<string,any[]>();for(const [id,p]of [['host',{x:0,y:0}],['other',{x:1,y:0}],['quiet',{x:2,y:0}]] as const){events.set(id,[]);r.join({userId:id,username:id},p,v=>events.get(id)!.push(v));}
 r.inviteResident('host','jax');r.inviteResident('other','blitz');r.residentQuiet('quiet',true,performance.now());
 // Keep pair adjacent and within range without preventing their social participation.
 for(let i=0;i<4000;i++)r.tick();
 const audible=events.get('host')!.filter(p=>p.type==='CHAT'&&p.ambient);assert.ok(audible.length>=2,'occasional authored exchanges occur');assert.ok(audible.length<=24,'no constant chatter');assert.deepEqual(new Set(audible.map(p=>p.residentId)),new Set(['jax','blitz']));assert.equal(events.get('quiet')!.filter(p=>p.type==='CHAT'&&p.ambient).length,0);
 const empty=new RoomRuntime(new RoomGrid(parseHeightmap(Array(8).fill('00000000').join('\n'))));empty.enableResidents();for(let i=0;i<1000;i++)empty.tick();assert.ok(empty.spuds.snapshots().every(s=>s.activity!=='chatting'));
});
