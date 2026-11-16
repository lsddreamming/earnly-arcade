import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);(globalThis as any).BigFishEnergy=require('../supabase/functions/big-fish-energy/engine.js');(globalThis as any).BigFishVerify=require('../supabase/functions/big-fish-energy/verify.js');
const {handleBigFish}=await import('../supabase/functions/big-fish-energy/handler.ts');
const uid='00000000-0000-4000-8000-000000000001',id='11111111-1111-4111-8111-111111111111';
const req=(body:any,token='test')=>new Request('https://test/big-fish-energy',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body:JSON.stringify(body)});
function db(){const calls:any[]=[];const query:any={select:()=>query,eq:(field:string,value:string)=>{calls.push([field,value]);return query;},maybeSingle:async()=>({data:{id,user_id:uid,seed:17,mode:'endless',sequence:0,snapshot:null}})};return {calls,auth:{getUser:async(token:string)=>({data:{user:token==='test'?{id:uid}:null}})},from:()=>query,rpc:async(name:string,args:any)=>{calls.push([name,args]);return {data:{ok:true}};}};}
test('Big Fish authenticates ownership and only sends server simulation metrics',async()=>{
 for(const token of ['', 'invalid']){const d=db(),r=await handleBigFish(req({action:'start',mode:'endless'},token),d);assert.equal(r.status,401);assert.equal(d.calls.length,0);}
 for(const mode of ['',null,'cheat'])assert.equal((await handleBigFish(req({action:'start',mode}),db())).status,400);
 const d=db();assert.equal((await handleBigFish(req({action:'checkpoint',id,sequence:0,steps:[]}),d)).status,409);assert(!d.calls.some(c=>c[0]==='big_fish_checkpoint'));
 const r=await handleBigFish(req({action:'checkpoint',id,sequence:0,steps:[[0,0,0]],snapshot:{hacked:true},size:999999,amount:100000,userId:'victim'},),d);assert.equal(r.status,200);
 const call=d.calls.find(c=>c[0]==='big_fish_checkpoint')[1];assert.equal(call.p_user_id,uid);assert.equal(call.p_size,.3);assert.equal(call.p_ticks,1);assert(!('amount'in call));assert(!call.p_snapshot.hacked);assert(d.calls.some(c=>c[0]==='user_id'&&c[1]===uid));
 assert.equal((await handleBigFish(req({action:'checkpoint',id,sequence:7,steps:[[0,0,0]]}),d)).status,409);
 assert.equal((await handleBigFish(req({action:'list'},''),d)).status,200);
 assert.equal((await handleBigFish(req({action:'start',mode:'endless'}),d)).status,200);
 const args=d.calls.find(c=>c[0]==='big_fish_start')[1];assert(args.p_seed>0&&args.p_seed<=4294967295);
 assert.equal((await handleBigFish(new Request('https://test',{method:'POST',body:'{'}),d)).status,400);
 assert.equal((await handleBigFish(req({a:'x'.repeat(50001)}),d)).status,413);
});
