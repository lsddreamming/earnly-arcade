import {test} from 'node:test';
import assert from 'node:assert/strict';
import {programmedResidentReply,programmedCombinationCount} from '../src/resident-programmed.ts';
import {topics,followups} from '../src/resident-topics.ts';
import {ambientExchanges} from '../src/resident-ambient-lines.ts';
import {OpenAIResidentDialogue} from '../src/resident-ai.ts';
import type {DialogueRequest} from '../src/resident-ai.ts';
const base:DialogueRequest={residentId:'mochi',context:[],addressed:true,ambient:false,activity:'sitting',companions:[]};
const ask=(text:string,extra:Partial<DialogueRequest>={})=>programmedResidentReply({...base,context:[{speaker:'Player',text}],...extra});
test('whole-message routing handles ordinary conversation but sends ambiguous or unsupported questions to AI',()=>{
 assert.match(ask('Hey Mochi, how are you?')!,/doing well/);
 for(const text of ['I’m good thanks','I’m not good','I’m tired','I like blue','I like drawing','I’m bored','BRB','I’m new here','Can we chat','How do I play Snake?','I like pizza','Tell me about cats','What do you think about music','My favorite food is pizza','hru','wyd','What is your favorite game?','What is your favorite color?','What do you do for fun?'])assert.ok(ask(text),text);
 for(const text of ['Hey Mochi can you explain why my chair disappeared?','How do I get free money in Snake?','What was my score yesterday?','What does blue mean in my medical report?','Tell me my private password','Why is it like that?'])assert.equal(ask(text),null,text);
 assert.equal(ask('I like blue',{addressed:false}),null);
});
test('follow-ups use only public conversation, and uncertain yes/no replies go to AI',()=>{
 const prior={speaker:'Mochi',text:'Would you like a joke or a calm chat?'};
 assert.match(ask('yes',{addressed:false,context:[prior,{speaker:'Player',text:'yes'}]})!,/combo|surprise|plant|quiet/i);
 assert.equal(ask('yes',{context:[{speaker:'Mochi',text:'What color would you start with?'},{speaker:'Player',text:'yes'}]}),null);
 assert.ok(ask('blue',{addressed:false,context:[{speaker:'Mochi',text:'What color would you start with?'},{speaker:'Player',text:'blue'}]}));
});
test('thousands of topic-specific combinations and hundreds of ambient lines are bounded and avoid borrowed branding',()=>{
 assert.equal(programmedCombinationCount,5280);assert.equal(ambientExchanges.length,100);
 const lines=new Set<string>();
 for(const topic of topics)for(const body of topic.bodies)for(const tail of ['',...followups[topic.family]]){
  const text=tail?body+' '+tail:body;assert.ok(text.length<=240,text);assert.doesNotMatch(text,/\b(furni|bobba|habbo|HC|norm|P2S|P2K)\b/i);lines.add(text);
 }
 assert.equal(lines.size,programmedCombinationCount,'count unique meaningful combinations, not duplicated entries');
 for(const exchange of ambientExchanges){assert.equal(exchange.length,3);for(const line of exchange){assert.ok(line.length<=240);assert.doesNotMatch(line,/\b(furni|bobba|habbo|HC|norm|P2S|P2K)\b/i);}}
});
test('programmed topic replies do not repeat a body just by changing the follow-up',()=>{
 const context:{speaker:string;text:string}[]=[];
 for(let i=0;i<6;i++){const response=programmedResidentReply({...base,context:[...context,{speaker:'Player',text:'I like blue'}]});assert.ok(response);assert.ok(!context.some(l=>l.text===response));context.push({speaker:'Mochi',text:response});}
 assert.equal(programmedResidentReply({...base,context:[...context,{speaker:'Player',text:'I like blue'}]}),null,'ask AI when local variations have been used');
});
test('programmed-first routing spends no Responses allowance and escalates only when needed',async()=>{
 let reserves=0,responses=0,moderations=0;
 const ai=new OpenAIResidentDialogue({OPENAI_API_KEY:'test-only',WORLD_AI_ENABLED:'true'},async()=>{reserves++;return true;},{fetch:async url=>{
  if(String(url).endsWith('/moderations')){moderations++;return Response.json({results:[{flagged:false}]});}
  responses++;return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'A blue seat beside a plant could bring both themes together.'}]}]});
 }});
 assert.match((await ai.reply({...base,context:[{speaker:'Player',text:'Hey Mochi, how are you?'}]}))!,/doing well/);
 assert.equal(reserves,0);assert.equal(responses,0);assert.equal(moderations,2);assert.equal(ai.status().scriptedReplies,1);
 assert.match((await ai.reply({...base,context:[{speaker:'Player',text:'How would you combine a beach theme with a reading corner?'}]}))!,/both themes/);
 assert.equal(reserves,1);assert.equal(responses,1);assert.equal(moderations,4);
});
test('scripted-first replies still fail closed on moderation and never fall through to paid AI',async()=>{
 let reserves=0;const ai=new OpenAIResidentDialogue({OPENAI_API_KEY:'test-only',WORLD_AI_ENABLED:'true'},async()=>{reserves++;return true;},{fetch:async()=>Response.json({results:[{flagged:true}]})});
 assert.equal(await ai.reply({...base,context:[{speaker:'Player',text:'Hi Mochi'}]}),null);assert.equal(reserves,0);assert.equal(ai.status().scriptedReplies,0);
});

test('hearing questions never promote a home, and identity never fabricates human personal facts',()=>{
 assert.match(ask('Can you hear me from over here?')!,/can hear you/);assert.doesNotMatch(ask('Can you hear me from over here?')!,/visit/i);
 assert.match(ask('How old are you?')!,/AI resident/);assert.match(ask('Who are you?')!,/Mochi/);
});
