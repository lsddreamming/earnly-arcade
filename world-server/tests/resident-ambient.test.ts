import {test} from 'node:test';
import assert from 'node:assert/strict';
import {residentAmbientReply,ambientCombinationCount} from '../src/resident-ambient.ts';
import {OpenAIResidentDialogue} from '../src/resident-ai.ts';
import type {DialogueRequest,DialogueLine} from '../src/resident-ai.ts';
const request:DialogueRequest={residentId:'jax',context:[],addressed:false,ambient:true,activity:'sitting',companions:['Blitz'],ambientTurn:0};
test('ambient exchanges are coherent, finite, varied, and never echo arbitrary or private context',()=>{
 const first=residentAmbientReply(request)!;assert.ok(first);
 const second=residentAmbientReply({...request,residentId:'blitz',ambientTurn:1,context:[{speaker:'Jax',text:first}]})!;assert.ok(second);
 const third=residentAmbientReply({...request,residentId:'mochi',ambientTurn:2,context:[{speaker:'Jax',text:first},{speaker:'Blitz',text:second}]})!;assert.ok(third);
 assert.equal(residentAmbientReply({...request,ambientTurn:3}),null);
 assert.equal(residentAmbientReply({...request,ambientTurn:1,context:[{speaker:'Jax',text:'PRIVATE_SENTINEL'}]}),null);
 assert.equal(residentAmbientReply({...request,companions:[]}),null);
 assert.equal(residentAmbientReply({...request,ambient:false}),null);
 let history:DialogueLine[]=[];const topics=new Set<string>();
 for(let i=0;i<360;i++){
  const start=residentAmbientReply({...request,context:history})!;assert.ok(start);assert.ok(!history.some(l=>l.text===start));topics.add(start);
  const follow=residentAmbientReply({...request,ambientTurn:1,context:[{speaker:'Jax',text:start}]})!;
  history=[...history,{speaker:'Jax',text:start},{speaker:'Blitz',text:follow}].slice(-12);
 }
 assert.equal(topics.size,180);assert.equal(ambientCombinationCount,2500);
});
test('ambient scripts use no API calls, no spending reservations and no paid request slots',async()=>{
 const ai=new OpenAIResidentDialogue({OPENAI_API_KEY:'test-only',WORLD_AI_ENABLED:'true'},async()=>{throw Error('must not reserve');},{fetch:async()=>{throw Error('must not fetch');}});
 const first=await ai.reply(request);assert.ok(first);
 assert.equal(ai.status().requests,0);assert.equal(ai.status().errors,0);assert.equal(ai.status().ambientReplies,1);
});
