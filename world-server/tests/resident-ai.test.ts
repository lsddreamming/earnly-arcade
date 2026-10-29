import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OpenAIResidentDialogue,dialogueInput,repeatedReply} from '../src/resident-ai.ts';
import type {DialogueRequest} from '../src/resident-ai.ts';
const request:DialogueRequest={residentId:'mochi',context:[{speaker:'Player',text:'Hey Mochi, how are you?'}],addressed:true,ambient:false,activity:'sitting',companions:[]};
const env={OPENAI_API_KEY:'test-secret-not-real',WORLD_AI_ENABLED:'true'};
const result=(text='I’m doing well. This is a cozy spot to take a break.')=>({status:'completed',usage:{input_tokens:700,output_tokens:20},output:[{type:'message',role:'assistant',content:[{type:'output_text',text}]}]});
test('Responses API uses public context, no storage/tools, bounded output and two-sided moderation',async()=>{
 const calls:any[]=[];const logs:any[]=[];let reserved=0;
 const ai=new OpenAIResidentDialogue(env,async(d,m)=>{assert.equal(d,1);assert.equal(m,10);reserved++;return true;},{fetch:async(url,options)=>{assert.equal(reserved,1);calls.push({url,body:JSON.parse(options!.body as string)});return Response.json(String(url).endsWith('/moderations')?{results:[{flagged:false}]}:result());},log:e=>logs.push(e)});
 assert.match((await ai.reply(request))!,/doing well/);assert.equal(calls.length,3);
 assert.ok(calls[0].url.endsWith('/moderations'));assert.ok(calls[2].url.endsWith('/moderations'));
 assert.equal(calls[1].body.model,'gpt-6-luna');assert.equal(calls[1].body.store,false);assert.equal(calls[1].body.max_output_tokens,256);assert.equal(calls[1].body.tools,undefined);
 assert.match(calls[1].body.input,/Hey Mochi/);assert.equal(ai.status().completed,1);
 assert.ok(!JSON.stringify(logs).includes('test-secret'));assert.ok(!JSON.stringify(logs).includes('Hey Mochi'));
 assert.ok(!dialogueInput({...request,privateMemory:'PRIVATE_SENTINEL'} as any).includes('PRIVATE_SENTINEL'));
});
test('missing keys, kill switch, unknown model and exhausted durable budget fail closed',async()=>{
 for(const e of [{},{...env,WORLD_AI_ENABLED:'false'},{...env,OPENAI_API_KEY:''},{...env,WORLD_AI_MODEL:'expensive-unknown'},{...env,WORLD_AI_DAILY_USD:'NaN'}]){
  const ai=new OpenAIResidentDialogue(e,async()=>{throw new Error('must not reserve');},{fetch:async()=>{throw new Error('must not fetch');}});assert.equal(await ai.reply(request),null);
 }
 let calls=0;const ai=new OpenAIResidentDialogue(env,async()=>false,{fetch:async()=>{calls++;return Response.json({});}});assert.equal(await ai.reply(request),null);assert.equal(calls,0);
});
test('moderation failure, malformed provider output and provider outage never fall back to scripts',async()=>{
 for(const scenario of ['input-flag','output-flag','invalid','refusal','incomplete','error']){
  let calls=0;const ai=new OpenAIResidentDialogue(env,async()=>true,{fetch:async(url)=>{calls++;if(scenario==='error')throw new Error('secret-provider-body');if(String(url).endsWith('/moderations'))return Response.json({results:[{flagged:scenario==='input-flag'||scenario==='output-flag'&&calls===3}]});return Response.json(scenario==='incomplete'?{...result(),status:'incomplete'}:scenario==='refusal'?{status:'completed',output:[{type:'message',role:'assistant',content:[{type:'refusal',refusal:'no'}]}]}:result(scenario==='invalid'?'<script>bad</script>':'A pleasant day.'));}});
  assert.equal(await ai.reply(request),null,scenario);
  if(scenario==='input-flag')assert.equal(calls,1);
  if(scenario==='error'){assert.equal(await ai.reply(request),null);assert.equal(calls,1,'circuit breaker prevents retries');}
 }
});
test('concurrency is limited before async reservations and rate limit cannot be bypassed',async()=>{
 let release!:()=>void;let count=0;const wait=new Promise<void>(r=>release=r);
 const ai=new OpenAIResidentDialogue(env,async()=>{count++;await wait;return false;});
 const a=ai.reply(request),b=ai.reply(request);assert.equal(await ai.reply(request),null);assert.equal(count,2);release();await Promise.all([a,b]);
 for(let i=0;i<15;i++)await ai.reply(request);assert.equal(count,12);
});
test('near-identical replies are suppressed, different short answers are kept',()=>{
 assert.equal(repeatedReply('Hello there!', ['hello there']),true);
 assert.equal(repeatedReply('I like the blue sofa by that window.', ['I like the blue sofa by that window!']),true);
 assert.equal(repeatedReply('The green rug.', ['The blue sofa.']),false);
});
