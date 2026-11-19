import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);(globalThis as any).MetalMayhem=require('../supabase/functions/metal-mayhem/engine.js');(globalThis as any).MetalMayhemVerify=require('../supabase/functions/metal-mayhem/verify.js');
const {handleMetalMayhem:handler}=await import('../supabase/functions/metal-mayhem/handler.ts');
const uid='00000000-0000-4000-8000-000000000001',id='11111111-1111-4111-8111-111111111111';
const req=(body:any,token='test')=>new Request('https://test/metal-mayhem',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body:JSON.stringify(body)});
function db(){const calls:any[]=[];const query:any={select:()=>query,eq:(field:string,value:string)=>{calls.push([field,value]);return query;},maybeSingle:async()=>({data:{id,user_id:uid,seed:17,sequence:0,snapshot:null}})};return {calls,auth:{getUser:async(token:string)=>({data:{user:token==='test'?{id:uid}:token==='anonymous'?{id:uid,is_anonymous:true}:null}})},from:()=>query,rpc:async(name:string,args:any)=>{calls.push([name,args]);return {data:{ok:true}};}};}
test('release defaults disabled and authenticated ownership gates server-replayed scores',async()=>{
 const disabled=db();assert.equal((await handler(req({action:'start'}),disabled)).status,503);assert.equal(disabled.calls.length,0);
 for(const token of ['', 'invalid','anonymous']){const d=db();assert.equal((await handler(req({action:'start'},token),d,true)).status,401);assert.equal(d.calls.length,0);}
 const d=db();assert.equal((await handler(req({action:'checkpoint',id,sequence:0,steps:[]}),d,true)).status,409);assert(!d.calls.some(c=>c[0]==='metal_mayhem_checkpoint'));
 const r=await handler(req({action:'checkpoint',id,sequence:0,steps:[[0,0,0,0,0]],snapshot:{hacked:true},score:999999,amount:100000,userId:'victim'}),d,true);assert.equal(r.status,200);
 const call=d.calls.find(c=>c[0]==='metal_mayhem_checkpoint')[1];assert.equal(call.p_user_id,uid);assert.equal(call.p_score,0);assert.equal(call.p_ticks,1);assert(!('amount'in call));assert(!call.p_snapshot.hacked);assert(d.calls.some(c=>c[0]==='user_id'&&c[1]===uid));
 assert.equal((await handler(req({action:'checkpoint',id,sequence:7,steps:[[0,0,0,0,0]]}),d,true)).status,409);
 assert.equal((await handler(req({action:'list'},''),d,true)).status,200);assert.equal((await handler(req({action:'start',engineVersion:3}),d,true)).status,200);
 const mismatch=db();assert.equal((await handler(req({action:'start',engineVersion:2}),mismatch,true)).status,409);assert.equal(mismatch.calls.length,0);
 const args=d.calls.find(c=>c[0]==='metal_mayhem_start')[1];assert(args.p_seed>0&&args.p_seed<=4294967295);
 assert.equal((await handler(new Request('https://test',{method:'POST',body:'{'}),d,true)).status,400);assert.equal((await handler(req({a:'x'.repeat(50001)}),d,true)).status,413);
});
