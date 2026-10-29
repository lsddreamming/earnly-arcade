import {test} from 'node:test';import assert from 'node:assert/strict';
import {handleNeonSlice} from '../supabase/functions/neon-slice/handler.ts';
const E=(globalThis as any).NeonSliceEngine;
const uid='00000000-0000-4000-8000-000000000001',id='11111111-1111-4111-8111-111111111111';
const g=new E.Game(E.seededRandom(17));g.start();let ticks=0;while(g.state==='running'){g.step(1/60);ticks++;}
const req=(body:any,token='test')=>new Request('https://test/neon-slice',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body:JSON.stringify(body)});
function db(version=1){const calls:any[]=[];const query:any={select:()=>query,eq:(field:string,value:string)=>{calls.push([field,value]);return query;},maybeSingle:async()=>({data:{id,user_id:uid,seed:17,engine_version:version}})};return {calls,auth:{getUser:async(token:string)=>({data:{user:token==='test'?{id:uid}:token==='guest'?{id:uid,is_anonymous:true}:null}})},from:()=>query,rpc:async(name:string,args:any)=>{calls.push([name,args]);return {data:{ok:true}};}};}
test('only authenticated, replayed runs can reach wallet settlement',async()=>{
 for(const token of ['', 'invalid','guest']){const d=db(),r=await handleNeonSlice(req({action:'start'},token),d);assert.equal(r.status,401);assert.equal(d.calls.length,0);}
 const d=db();assert.equal((await handleNeonSlice(req({action:'claim',id,events:[],ticks:1}),d)).status,409);assert(!d.calls.some(c=>c[0]==='neon_slice_claim'));
 assert.equal((await handleNeonSlice(req({action:'claim',id,events:[],ticks,score:9999,amount:100000,userId:'other'}),d)).status,200);
 const claim=d.calls.find(c=>c[0]==='neon_slice_claim');assert.equal(claim[1].p_user_id,uid);assert.equal(claim[1].p_score,0);assert(!('amount' in claim[1]));assert(d.calls.some(c=>c[0]==='user_id'&&c[1]===uid));
 assert.equal((await handleNeonSlice(req({action:'start'}),d)).status,200);const args=d.calls.find(c=>c[0]==='neon_slice_start')[1];assert(args.p_seed>0&&args.p_seed<=4294967295);
 assert.equal((await handleNeonSlice(req({action:'claim',id,events:'x'.repeat(600001)}),d)).status,413);
 assert.equal((await handleNeonSlice(new Request('https://test',{method:'OPTIONS'}),d)).status,200);
});

test('tickets select replay rules on the server, not from claim input',async()=>{
 const d=db(2);let selected;const original=E.verify;E.verify=(...args:any[])=>{selected=args[3];return original(...args);};
 try {
  assert.equal((await handleNeonSlice(req({action:'start',engineVersion:2}),d)).status,200);
  assert(d.calls.some(c=>c[0]==='neon_slice_start_v2'));
  assert.equal((await handleNeonSlice(req({action:'start',engineVersion:3}),d)).status,200);assert(d.calls.some(c=>c[0]==='neon_slice_start_v3'));
  assert.equal((await handleNeonSlice(req({action:'start',engineVersion:99}),d)).status,400);
  assert.equal((await handleNeonSlice(req({action:'claim',id,events:[],ticks,engineVersion:1}),d)).status,200);
  assert.equal(selected,2);
  const legacy=db(1);await handleNeonSlice(req({action:'claim',id,events:[],ticks,engineVersion:2}),legacy);assert.equal(selected,1);
 } finally { E.verify=original; }
});
