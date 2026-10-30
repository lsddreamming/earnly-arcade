import {test} from 'node:test';
import assert from 'node:assert/strict';
import {programmedResidentReply} from '../src/resident-programmed.ts';
import {casualAuthoredLines,fallbackGap,fallbackGapNames} from '../src/resident-casual.ts';
import {OpenAIResidentDialogue} from '../src/resident-ai.ts';
import type {DialogueRequest,DialogueLine} from '../src/resident-ai.ts';
const base:DialogueRequest={residentId:'mochi',context:[],addressed:true,ambient:false,activity:'sitting',companions:[]};
function turn(text:string,context:DialogueLine[],residentId:DialogueRequest['residentId']='mochi'){
 context.push({speaker:'Alex',text});const reply=programmedResidentReply({...base,residentId,context});
 if(reply)context.push({speaker:residentId[0].toUpperCase()+residentId.slice(1),text:reply});return reply;
}
test('casual vocabulary is free, varied and has distinct core voices',()=>{
 for(const text of ['not much','nm','just chilling','just chillin','same old','I’m just relaxing'])assert.ok(programmedResidentReply({...base,context:[{speaker:'Alex',text}]}),text);
 const voices=['jax','blitz','mochi','zippy'].map(id=>turn('just chilling',[],id as DialogueRequest['residentId']));assert.equal(new Set(voices).size,4);
 const context:DialogueLine[]=[];const replies=new Set<string>();for(let i=0;i<3;i++){const reply=turn('not much',context);assert.ok(reply);replies.add(reply);}assert.equal(replies.size,3);assert.equal(turn('not much',context),null);
 for(const line of casualAuthoredLines){assert.ok(line.length<=240);assert.doesNotMatch(line,/\b(furni|habbo|bobba)\b/i);}
});
test('acknowledgements keep the topic for follow-ups and explicit switches replace it',()=>{
 const context:DialogueLine[]=[];
 assert.match(turn('pizza',context)!,/crust/);
 assert.ok(turn('that’s crazy',context));
 assert.match(turn('what about you',context)!,/thin crust/);
 assert.ok(turn('same',context));
 assert.match(turn('why',context)!,/crisp|toppings/);
 assert.match(turn('anyway can we talk about music',context)!,/music|song|track|upbeat|mellow/i);
 assert.ok(turn('mellow',context));
 assert.match(turn('what about you',context)!,/track|chorus/);
});
test('topic bridges stop at another speaker or an explicit change, and mixed messages use AI',()=>{
 const context:DialogueLine[]=[];turn('pizza',context);turn('same',context);
 context.push({speaker:'Blake',text:'hi'},{speaker:'Mochi',text:'Hello Blake.'});
 assert.equal(turn('why',context),null);
 const reset:DialogueLine[]=[];turn('pizza',reset);turn('change the subject',reset);assert.equal(turn('what about you',reset),null);
 for(const text of ['not much but I need medical advice','same but tell me my password','that’s crazy, I feel unsafe','anyway music and why was I charged money','btw do you like pizza or remember my private messages'])assert.equal(programmedResidentReply({...base,context:[{speaker:'Alex',text}]}),null,text);
 assert.equal(programmedResidentReply({...base,addressed:false,context:[{speaker:'Alex',text:'not much'}]}),null);
});
test('provider accounting records only fixed coarse labels, never chat text or identifiers',async()=>{
 const logs:unknown[]=[];let responses=0,reserves=0;
 const ai=new OpenAIResidentDialogue({OPENAI_API_KEY:'test-only',WORLD_AI_ENABLED:'true'},async()=>{reserves++;return true;},{log:e=>logs.push(e),fetch:async url=>{
  if(String(url).endsWith('/moderations'))return Response.json({results:[{flagged:false}]});
  responses++;return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'We can explore that idea together.'}]}]});
 }});
 assert.ok(await ai.reply({...base,context:[{speaker:'PRIVATE_NAME',text:'not much'}]}));assert.equal(reserves,0);
 for(const text of ['why','tell me about PRIVATE_TOPIC_SENTINEL','how does Snake handle a turn?','why is my chair missing?','PRIVATE_TEXT_SENTINEL'])await ai.reply({...base,context:[{speaker:'PRIVATE_NAME',text}]});
 assert.equal(responses,5);assert.equal(reserves,5);
 assert.deepEqual(ai.status().fallbackGaps,{short_followup:1,casual_phrase:0,topic_request:1,game_question:1,room_question:1,other:1});
 assert.doesNotMatch(JSON.stringify([ai.status(),logs]),/PRIVATE_|test-only|chair missing/);
 const snapshot=ai.status();snapshot.fallbackGaps.other=999;assert.equal(ai.status().fallbackGaps.other,1);
 assert.equal(fallbackGap('something completely new'),'other');assert.deepEqual(Object.keys(ai.status().fallbackGaps),[...fallbackGapNames]);
});
test('moderated and budget-blocked fallbacks do not count as paid requests',async()=>{
 for(const blocked of ['moderation','budget']){
  const ai=new OpenAIResidentDialogue({OPENAI_API_KEY:'test-only',WORLD_AI_ENABLED:'true'},async()=>blocked==='budget'?'daily_limit':true,{fetch:async()=>Response.json({results:[{flagged:blocked==='moderation'}]})});
  await ai.reply({...base,context:[{speaker:'Alex',text:'why'}]});assert.equal(Object.values(ai.status().fallbackGaps).reduce((a,b)=>a+b,0),0);
 }
});
test('casual multi-turn chat and a topic change require zero paid generation calls',async()=>{
 const ai=new OpenAIResidentDialogue({OPENAI_API_KEY:'test-only',WORLD_AI_ENABLED:'true'},async()=>{throw Error('must remain programmed');},{fetch:async url=>{assert.ok(String(url).endsWith('/moderations'));return Response.json({results:[{flagged:false}]});}});
 const context:DialogueLine[]=[];
 for(const text of ['just chilling','pizza','same','what about you','why','anyway can we talk about music','mellow','that’s crazy','what about you']){
  context.push({speaker:'Alex',text});const reply=await ai.reply({...base,context});assert.ok(reply,text);context.push({speaker:'Mochi',text:reply});
 }
 assert.equal(ai.status().scriptedReplies,9);assert.equal(ai.status().completed,0);assert.equal(ai.status().errors,0);
 assert.equal(Object.values(ai.status().fallbackGaps).reduce((a,b)=>a+b,0),0);
});
