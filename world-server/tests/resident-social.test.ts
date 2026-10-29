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
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
test('contextual public replies preserve proximity, block audience, follow-ups and memory isolation',async()=>{
 const {r,chats,ticks,at}=publicRoom();const requests:any[]=[];
 r.enableDialogue({reply:async q=>{requests.push(q);return requests.length===1?'Feeling good! How is your day going?':'Saved memories stay private in Resident privacy.';}});
 r.setResidentMemory('speaker',{quiet:false,relations:[{residentId:'jax',friend:true,remember:true,visits:3,favoriteGame:'SECRET_PRIVATE_GAME'}]});
 assert.equal(r.queueResidentReply('outsider','hello',['speaker']),false);
 assert.equal(r.queueResidentReply('far','hello',['far'],'jax'),false);
 assert.equal(r.queueResidentReply('speaker','Hey Mochi, how are you?',['speaker','listener']),false,'do not answer for an absent named resident');
 assert.equal(r.queueResidentReply('speaker','Hey Jax, how are you?',['speaker','listener','far']),true);
 ticks(1);await flush();ticks(4);
 assert.equal(chats('speaker').length,1);assert.deepEqual(chats('speaker'),chats('listener'));assert.equal(chats('blocked').length,0);assert.equal(chats('far').length,0);
 assert.equal(chats('speaker')[0].text,'Feeling good! How is your day going?');assert.deepEqual(r.spuds.snapshots()[0].position,at);
 ticks(12);r.queueResidentReply('listener','What do you remember about me?',['speaker','listener']);ticks(1);await flush();ticks(4);
 assert.equal(requests[1].context.at(-1).text,'What do you remember about me?');assert.ok(requests[1].context.some((l:any)=>l.text.includes('How is your day')));
 assert.ok(!JSON.stringify(requests).includes('SECRET_PRIVATE_GAME'));assert.match(chats('listener').at(-1).text,/private/);
});
test('pending replies are cancelled after leaving or a new block, and public focus preserves movement',async t=>{
 t.mock.method(Math,'random',()=>.2);
 const {r,chats,ticks,free}=publicRoom();r.enableDialogue({reply:async()=> 'A fresh response.'});
 const goal=free(2,4);assert.equal(r.receive('speaker',{type:'MOVE_TO',...goal},1000),true);
 r.residentFocus('speaker','jax',true,1001,true);ticks(24);assert.deepEqual(r.members().find(m=>m.userId==='speaker')!.position,{...goal,z:0});
 r.queueResidentReply('speaker','hello',['speaker','listener'],'jax');ticks(1);await flush();r.invalidateDialogue();ticks(4);assert.equal(chats('listener').length,0);
 r.queueResidentReply('speaker','hello',['speaker','listener'],'jax');ticks(1);await flush();r.leave('speaker');ticks(4);assert.equal(chats('listener').length,0);
});
test('every nearby public message is eligible; single-flight and Quiet suppress unsolicited replies',async()=>{
 const {r,ticks,chats}=publicRoom();let resolve!:(value:string)=>void;let calls=0;
 r.enableDialogue({reply:async()=>{calls++;return new Promise<string>(r=>resolve=r);}});
 r.residentQuiet('speaker',true,0);assert.equal(r.queueResidentReply('speaker','What a beautiful day',['speaker','listener']),false);
 assert.equal(r.queueResidentReply('speaker','Jax what do you think?',['speaker','listener']),true);ticks(1);
 r.queueResidentReply('listener','The blue one looks better',['speaker','listener']);ticks(10);assert.equal(calls,1);
 resolve('The blue one would suit a cozy room.');await flush();ticks(4);assert.equal(chats('speaker').length,1);ticks(12);assert.equal(calls,2);
 resolve('I like the open walking space too.');await flush();ticks(4);assert.equal(chats('speaker').length,2);
});
test('ambient AI turns stay bounded, honor Quiet, and yield to player interruption',async t=>{
 t.mock.method(Math,'random',()=>0.2);const r=new RoomRuntime(new RoomGrid(parseHeightmap(Array(8).fill('00000000').join('\n'))));r.enableSocial(new NaturalSocial(()=>0),'ambient');
 const events=new Map<string,any[]>();for(const [id,p]of [['host',{x:0,y:0}],['other',{x:1,y:0}],['quiet',{x:2,y:0}]] as const){events.set(id,[]);r.join({userId:id,username:id},p,v=>events.get(id)!.push(v));}
 r.inviteResident('host','jax');r.inviteResident('other','blitz');r.residentQuiet('quiet',true,performance.now());
 const requests:any[]=[];r.enableDialogue({reply:async q=>{requests.push(q);return q.residentId==='jax'?'Blitz, what is your strategy for Snake?':'I try to leave room for the next turn.';}});
 for(let i=0;i<1000;i++){r.tick();await flush();}
 const audible=events.get('host')!.filter(p=>p.type==='CHAT'&&p.ambient);assert.equal(audible.length,2);assert.deepEqual(new Set(audible.map(p=>p.residentId)),new Set(['jax','blitz']));assert.equal(events.get('quiet')!.filter(p=>p.type==='CHAT'&&p.ambient).length,0);
 assert.ok(requests[1].context.length>0);assert.ok(requests.length<=4);
});
test('an empty room never calls the model and unavailable direct chat is honest',async()=>{
 const empty=new RoomRuntime(new RoomGrid(parseHeightmap(Array(8).fill('00000000').join('\n'))));let calls=0;empty.enableResidents();empty.enableDialogue({reply:async()=>{calls++;return null;}});for(let i=0;i<2000;i++)empty.tick();assert.equal(calls,0);
 const {r,ticks,packets,chats}=publicRoom();r.enableDialogue({reply:async()=>null});r.queueResidentReply('speaker','Jax hello',['speaker']);ticks(1);await flush();ticks(4);assert.equal(chats('speaker').length,0);assert.ok(packets.get('speaker')!.some(p=>p.type==='RESIDENT_STATUS'));
});

test('exactly eight tiles is eligible, beyond eight is excluded, and stale results cannot follow a player',async()=>{
 const r=new RoomRuntime(new RoomGrid(parseHeightmap(Array(25).fill('0'.repeat(25)).join('\n'))));r.enableSocial(new NaturalSocial(),'boundary');
 r.join({userId:'owner',username:'Owner'},{x:0,y:0},()=>{});r.inviteResident('owner','mochi');r.spuds.focus('hold','mochi');const pos=r.spuds.snapshots()[0].position;
 const dx=pos.x<=12?1:-1;const packets:any[]=[];
 r.join({userId:'edge',username:'Edge'},{x:pos.x+8*dx,y:pos.y},p=>packets.push(p));r.join({userId:'outside',username:'Outside'},{x:pos.x+9*dx,y:pos.y},()=>{});
 let resolve!:(s:string)=>void;r.enableDialogue({reply:()=>new Promise<string>(r=>resolve=r)});
 assert.equal(r.queueResidentReply('outside','Mochi hi',['outside']),false);
 assert.equal(r.queueResidentReply('edge','Hey Mochi, how are you?',['edge']),true);r.tick();
 r.leave('edge');resolve('I am doing well, thanks for asking.');await flush();for(let i=0;i<4;i++)r.tick();assert.equal(packets.filter(p=>p.type==='CHAT').length,0);
});
test('human messages interrupt an in-flight ambient generation without publishing the stale reply',async t=>{
 t.mock.method(Math,'random',()=>.2);const r=new RoomRuntime(new RoomGrid(parseHeightmap(Array(8).fill('00000000').join('\n'))));r.enableSocial(new NaturalSocial(),'interrupt');
 const events:any[]=[];r.join({userId:'a',username:'A'},{x:0,y:0},p=>events.push(p));r.join({userId:'b',username:'B'},{x:1,y:0},()=>{});r.inviteResident('a','jax');r.inviteResident('b','blitz');
 let resolve!:(s:string)=>void;const requests:any[]=[];r.enableDialogue({reply:q=>{requests.push(q);return new Promise<string>(r=>resolve=r);}});
 for(let i=0;i<600&&!requests.length;i++)r.tick();assert.equal(requests.length,1);assert.equal(requests[0].ambient,true);
 assert.equal(r.queueResidentReply('a','Jax how are you?',['a','b']),true);resolve('STALE_AMBIENT');await flush();r.tick();assert.equal(requests.length,2);assert.equal(requests[1].ambient,false);resolve('Doing well! Thanks for asking.');await flush();for(let i=0;i<4;i++)r.tick();assert.ok(!events.some(p=>p.text==='STALE_AMBIENT'));assert.ok(events.some(p=>p.text==='Doing well! Thanks for asking.'));
});
test('per-player provider throttle persists across room changes',()=>{const s=new NaturalSocial();for(let i=0;i<6;i++)assert.equal(s.aiTurn('player',i),true);assert.equal(s.aiTurn('player',10),false);assert.equal(s.aiTurn('other',10),true);assert.equal(s.aiTurn('player',60000),true);});
