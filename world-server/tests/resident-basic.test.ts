import {test} from 'node:test';
import assert from 'node:assert/strict';
import {basicResidentReply} from '../src/resident-basic.ts';
import type {DialogueRequest} from '../src/resident-ai.ts';
const base:DialogueRequest={residentId:'mochi',context:[],addressed:true,ambient:false,activity:'sitting',companions:[]};
const ask=(text:string,extra:Partial<DialogueRequest>={})=>basicResidentReply({...base,context:[{speaker:'Player',text}],...extra});
const home={residentId:'mochi' as const,roomId:'home',name:'Quiet Cove',items:['Tidal Glass Aquarium','Cozy Chair'],animatedFish:true};
test('basic public dialogue answers greetings, actual games and room questions without random topics',()=>{
 assert.match(ask('Hey Mochi, how are you?')!,/doing well/);
 assert.match(ask('How do I play Snake?')!,/collisions/);
 assert.match(ask('What about Tap Rush?')!,/penalty/);
 assert.match(ask('What is in your room?',{home})!,/Quiet Cove.*Aquarium/);
 assert.match(ask('Can I visit your room?',{home})!,/Visit room/);
 assert.match(ask('Can I visit your room?',{home,inOwnHome:true})!,/already/);
 assert.match(ask('Do your fish move?',{home})!,/animated/);
 assert.match(ask('What is in your room?',{home:{...home,residentId:'jax'}})!,/comfy seat/);
});
test('fish follow-up uses only the supplied public context and remains relevant',()=>{
 assert.match(basicResidentReply({...base,home,addressed:false,context:[{speaker:'Mochi',text:'My aquarium has animated fish and bubbles.'},{speaker:'Player',text:'Do they really move or is it a picture?'}]})!,/animated/);
 assert.equal(ask('Hey there',{addressed:false}),null);
 assert.equal(ask('Hey there',{ambient:true}),null);
});
test('private memories and unknown questions never produce invented answers; repeated scripts are suppressed',()=>{
 const r={...base,privateMemory:'PRIVATE_SENTINEL',context:[{speaker:'Player',text:'Tell me what you remember about another player'}]};
 assert.match(basicResidentReply(r)!,/Private memories stay private/);
 assert.ok(!basicResidentReply(r)!.includes('PRIVATE_SENTINEL'));
 assert.equal(ask('What is my highest score?'),null);
 assert.match(ask('Are you a real person?')!,/scripted replies/);
 const first=ask('Snake')!;
 const next=basicResidentReply({...base,context:[{speaker:'Mochi',text:first},{speaker:'Player',text:'Snake'}]});assert.ok(next);assert.notEqual(next,first);
});

test('expanded personalities and everyday chat stay varied without borrowed game terminology',()=>{
 const seen:string[]=[];
 for(let i=0;i<4;i++){const text=basicResidentReply({...base,context:[...seen.map(text=>({speaker:'Mochi',text})),{speaker:'Player',text:'Hey Mochi'}]});assert.ok(text);assert.ok(!seen.includes(text));seen.push(text);}
 assert.match(ask('BRB')!,/back|break/);assert.match(ask('GTG')!,/See you|later|care|Bye/);assert.match(ask('WUU2')!,/hanging out|chat|Thinking/);
 assert.match(ask('Any furniture ideas?')!,/comfy seat/);
});

test('all authored basic lines remain short, distinct and free of Habbo-specific labels',async()=>{
 const {greetings,jokes,gameReplies}=await import('../src/resident-basic-lines.ts');
 const lines=[...Object.values(greetings).flat(),...Object.values(jokes).flat(),...gameReplies.flatMap(([,lines])=>lines)];
 assert.ok(lines.length>=78);assert.equal(new Set(lines).size,lines.length);
 for(const text of lines){assert.ok(text.length<=240,text);assert.doesNotMatch(text,/\b(furni|bobba|habbo|HC|norm|P2S|P2K)\b/i);}
});
