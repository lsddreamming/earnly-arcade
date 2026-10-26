import {test} from 'node:test';import assert from 'node:assert/strict';
import {handleBubblePop} from '../supabase/functions/bubble-pop/handler.ts';
const E=(globalThis as any).BubblePopEngine;
const uid='00000000-0000-4000-8000-000000000001',id='11111111-1111-4111-8111-111111111111';
function fixture(){for(let seed=1;seed<200;seed++){const g=E.create(E.seededRandom(seed)),steps:any[]=[],random=E.seededRandom(seed+9000);while(!g.state().done){const a=g.legalMoves(),s=a[Math.floor(random()*a.length)];steps.push(s);g.swap(...s);}if(g.state().status==='won')return {seed,steps};}throw Error('fixture');}
const f=fixture();
const req=(body:any,token='test')=>new Request('https://test/bubble-pop',{method:'POST',headers:token?{Authorization:'Bearer '+token}:{},body:JSON.stringify(body)});
function db(){
 const calls:any[]=[];
 const query:any={select:()=>query,eq:(field:string,value:string)=>{calls.push([field,value]);return query;},maybeSingle:async()=>({data:{id,user_id:uid,level:0,seed:f.seed}})};
 return {calls,auth:{getUser:async(token:string)=>({data:{user:token==='test'?{id:uid}:null}})},from:()=>query,rpc:async(name:string,args:any)=>{calls.push([name,args]);return {data:{ok:true}};}};
}
test('auth, bounded requests and replay gate before minting',async()=>{
 for(const token of ['', 'invalid']){const d=db(),r=await handleBubblePop(req({action:'start',level:0},token),d);assert.equal(r.status,401);assert.equal(d.calls.length,0);}
 for(const level of [-1,1000,1.5,'0'])assert.equal((await handleBubblePop(req({action:'start',level}),db())).status,400);
 const d=db();assert.equal((await handleBubblePop(req({action:'claim',id,steps:[]}),d)).status,409);assert(!d.calls.some(c=>c[0]==='bubble_pop_claim'));
 assert.equal((await handleBubblePop(req({action:'claim',id,steps:f.steps,stars:99,amount:100000}),d)).status,200);
 const claim=d.calls.find(c=>c[0]==='bubble_pop_claim');assert.equal(claim[1].p_user_id,uid);assert(claim[1].p_stars<=3);assert(!('amount' in claim[1]));assert(d.calls.some(c=>c[0]==='user_id'&&c[1]===uid));
 const r=await handleBubblePop(req({action:'start',level:999}),d);assert.equal(r.status,200);const args=d.calls.find(c=>c[0]==='bubble_pop_start')[1];assert.equal(args.p_level,999);assert(args.p_seed>0&&args.p_seed<=4294967295);
 assert.equal((await handleBubblePop(new Request('https://test',{method:'OPTIONS'}),d)).status,200);
});
