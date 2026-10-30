import {test} from 'node:test';
import assert from 'node:assert/strict';
import {conversations,authoredConversationLines,continuedResidentReply} from '../src/resident-conversations.ts';
import {programmedResidentReply} from '../src/resident-programmed.ts';
import {OpenAIResidentDialogue} from '../src/resident-ai.ts';
import type {DialogueRequest,DialogueLine} from '../src/resident-ai.ts';
const base:DialogueRequest={residentId:'mochi',context:[],addressed:true,ambient:false,activity:'sitting',companions:[]};
const ask=(text:string,context:DialogueLine[]=[],extra:Partial<DialogueRequest>={})=>programmedResidentReply({...base,...extra,context:[...context,{speaker:'Alex',text}]});
test('thirty reviewed conversation branches have bounded original lines',()=>{
 assert.equal(conversations.length,30);assert.ok(authoredConversationLines.length>=350);
 for(const text of authoredConversationLines){assert.ok(text&&text.length<=240,text);assert.doesNotMatch(text,/\b(furni|bobba|habbo|HC|norm|P2S|P2K)\b/i);}
 assert.equal(new Set(conversations.map(c=>c.question)).size,30,'each branch has its own question');
});
test('multi-turn preferences, opinions and explanations remain local and contextual',()=>{
 const context:DialogueLine[]=[];
 for(const text of ['I like pizza','thin crust','what about you','why?','tell me more']){
  const reply=ask(text,context);assert.ok(reply,text);context.push({speaker:'Alex',text},{speaker:'Mochi',text:reply});
 }
 assert.match(context[3].text,/crisp|toppings/i);assert.match(context[5].text,/thin crust/i);assert.match(context[7].text,/crisp|toppings/i);
});
test('unsupported, mixed, sensitive and unrelated messages still route to AI',()=>{
 for(const text of ['pizza but why was my payment declined','I hate pizza','I like music but I feel unsafe','Tell me about my medical report','What is my password','Why did my chair disappear?','Do you like pizza or are you spying on me?','What was my score yesterday?','why?','thin crust','wbu'])assert.equal(ask(text),null,text);
 assert.equal(ask('I like pizza',[],{addressed:false}),null);
});
test('another player cannot inherit a short-answer branch or a stale conversation',()=>{
 const opener=ask('pizza')!;
 const other=[{speaker:'Other player',text:'pizza'},{speaker:'Mochi',text:opener}];
 for(const text of ['thin crust','why','what about you','tell me more'])assert.equal(ask(text,other),null,text);
 assert.equal(ask('thin crust',[{speaker:'Alex',text:'pizza'},{speaker:'Mochi',text:opener},{speaker:'Other',text:'hello'}]),null);
});
test('opening variants avoid repeats and exhausted branches fall back',()=>{
 const used:string[]=[];
 for(let i=0;i<3;i++){
  const reply=continuedResidentReply({...base,residentId:'fern',avoidReplies:used},'pizza');assert.ok(reply);assert.ok(!used.includes(reply));used.push(reply);
 }
 assert.equal(continuedResidentReply({...base,residentId:'fern',avoidReplies:used},'pizza'),null);
});
test('each authored topic answers a concrete short choice and a public opinion follow-up',()=>{
 const examples=[['pizza','I prefer thin crust'],['music','mellow'],['movies','comedy'],['pets','dogs'],['weekend','quiet'],['school','chat'],['drawing','characters'],['books','mystery'],['snacks','sweet'],['weather','sunny'],['gaming','puzzles'],['snake','planning'],['bubble pop','quickly'],['tap rush','accuracy'],['neon slice','careful'],['coin catch','one coin'],['decorating','cozy'],['sports','playing'],['fashion','matching'],["I'm bored",'game idea'],['ice cream','vanilla'],['cooking','experiment'],['photography','details'],['halloween','silly'],['travel','beach'],['board games','strategy'],['coding','game'],["I'm tired",'space'],['work','quiet'],['plants','flowers']];
 for(const [topic,choice] of examples){
  const first=ask(topic)!;assert.ok(first,topic);
  const context=[{speaker:'Alex',text:topic},{speaker:'Mochi',text:first}];
  const next=ask(choice,context);assert.ok(next,topic+': '+choice);
  context.push({speaker:'Alex',text:choice},{speaker:'Mochi',text:next});
  assert.ok(ask('what about you',context),topic+': opinion');
 }
});
test('new casual wording and core resident voices use the programmed route',()=>{
 for(const text of ['Do you like music?','Tell me about photography','I just got home from school','I just got back from work','I’m hungry','Im sleepy','I like coding','I love fashion','I like Bubble Pop','I play Snake'])assert.ok(ask(text),text);
 const voices=['jax','blitz','mochi','zippy'].map(residentId=>ask('pizza',[],{residentId:residentId as DialogueRequest['residentId']}));assert.equal(new Set(voices).size,4);
});
test('five-turn conversation spends no generation budget; unfamiliar question uses AI',async()=>{
 let reserves=0,responses=0,moderations=0;
 const ai=new OpenAIResidentDialogue({OPENAI_API_KEY:'test-only',WORLD_AI_ENABLED:'true'},async()=>{reserves++;return true;},{fetch:async url=>{
  if(String(url).endsWith('/moderations')){moderations++;return Response.json({results:[{flagged:false}]});}
  responses++;return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'I would compare the two ideas before choosing.'}]}]});
 }});
 const context:DialogueLine[]=[];
 for(const text of ['music','mellow','what about you','why','tell me more']){
  context.push({speaker:'Alex',text});const reply=await ai.reply({...base,context});assert.ok(reply);context.push({speaker:'Mochi',text:reply});
 }
 assert.equal(reserves,0);assert.equal(responses,0);assert.equal(moderations,10);
 assert.equal(ai.status().scriptedReplies,5);assert.equal(ai.status().conversationTopics,30);
 context.push({speaker:'Alex',text:'How would you blend jazz and a chiptune melody?'});assert.ok(await ai.reply({...base,context}));assert.equal(reserves,1);assert.equal(responses,1);
});
test('new branches remain available at the daily cap and moderation still fails closed',async()=>{
 let reserve=0;const ai=new OpenAIResidentDialogue({OPENAI_API_KEY:'test-only',WORLD_AI_ENABLED:'true'},async()=>{reserve++;return 'daily_limit';},{fetch:async()=>Response.json({results:[{flagged:false}]})});
 assert.ok(await ai.reply({...base,context:[{speaker:'Alex',text:'Do you like music?'}]}));assert.equal(reserve,0);
 const blocked=new OpenAIResidentDialogue({OPENAI_API_KEY:'test-only',WORLD_AI_ENABLED:'true'},async()=>{throw Error('no generation');},{fetch:async()=>Response.json({results:[{flagged:true}]})});
 assert.equal(await blocked.reply({...base,context:[{speaker:'Alex',text:'Do you like music?'}]}),null);
});
