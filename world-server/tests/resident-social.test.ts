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
  assert.throws(()=>r.residentChat('near','jax','erase_all',0),/topic/);
  assert.equal(r.residentChat('near','jax','joke',0).isAI,true);assert.equal(packets.length,before);
 }
});
test('core personalities have distinct safe contextual dialogue',()=>{
 const replies=['jax','blitz','mochi','zippy'].map(id=>residentReply(id as any,'hello'));assert.equal(new Set(replies).size,4);
 assert.match(residentReply('jax','room',undefined,'Cloud Sofa'),/Cloud Sofa/);
});
