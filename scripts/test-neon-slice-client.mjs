import vm from 'node:vm';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const source=await readFile('neon-slice-rewards.js','utf8');
let user={id:'alice'},failure=false,switchAccount=false,calls=[],wallets=[],startResult;const storage=new Map();
const client={auth:{getSession:async()=>({data:{session:{user}}})},functions:{invoke:async(name,{body})=>{calls.push(body);if(body.action==='start')return {data:startResult};if(failure)return {error:{}};if(switchAccount)user={id:'bob'};return {data:{amount:2,wallet:{balance:'102',lifetime_earned:'2'}}};}}};
const window={CrystalSupabase:{createClient:()=>client},Arcade:{applyServerWallet:w=>wallets.push(w)}};
vm.runInNewContext(source,{window,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},CustomEvent:class{}});
const round={id:'round1',userId:'alice'};failure=true;await assert.rejects(window.NeonSliceRewards.claim(round,[[1]],600));assert.equal(wallets.length,0);assert.equal(JSON.parse(storage.get('earnlyNeonSlicePending')).length,1);
failure=false;user={id:'bob'};await window.NeonSliceRewards.retry();assert.equal(calls.length,1);assert.equal(wallets.length,0);
user={id:'alice'};await window.NeonSliceRewards.retry();assert.equal(wallets.length,1);assert.equal(wallets[0].balance,'102');assert.equal(JSON.parse(storage.get('earnlyNeonSlicePending')).length,0);
switchAccount=true;await assert.rejects(window.NeonSliceRewards.claim({id:'round2',userId:'alice'},[],600));assert.equal(wallets.length,1);
console.log('PASS: persisted offline retry, account-scoped queues, no speculative wallet changes, server wallet application, and sign-out race protection.');

user={id:'alice'};switchAccount=false;startResult={id:'v2-round',engineVersion:3};
assert.equal((await window.NeonSliceRewards.start()).id,'v2-round');assert.equal(calls.at(-1).engineVersion,3);
startResult={id:'old-round'};await assert.rejects(window.NeonSliceRewards.start(),/ENGINE_VERSION/);
console.log('PASS: new rounds request v3 and reject incompatible server tickets.');

// Standalone reward screens must keep cumulative earnings separate from balance.
for(const [file,api] of [['neon-slice-rewards.js','NeonSliceRewards'],['bubble-pop-rewards.js','BubblePopRewards']]){
 const store=new Map(),events=[];let responseWallet={balance:'5000',lifetime_earned:'1000'};
 const c={auth:{getSession:async()=>({data:{session:{user:{id:'owner'}}}})},functions:{invoke:async()=>({data:{wallet:responseWallet}})}};
 const w={CrystalSupabase:{createClient:()=>c},dispatchEvent:e=>events.push(e)};
 vm.runInNewContext(await readFile(file,'utf8'),{window:w,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}});
 await new Promise(resolve=>setTimeout(resolve,0));
 for(const [index,wallet] of [{balance:'5000',lifetime_earned:'1000'},{balance:'4500',lifetime_earned:'1000'},{balance:'9500',lifetime_earned:'1000'},{balance:'9510',lifetime_earned:'1010'}].entries()){
  responseWallet=wallet;await w[api].claim({id:'round-'+index,userId:'owner',level:0},[],60);
  assert.equal(store.get('points'),wallet.balance);assert.equal(store.get('lifetimePoints'),wallet.lifetime_earned);assert.equal(events.at(-1).detail.lifetime,Number(wallet.lifetime_earned));
 }
}
console.log('PASS: both standalone reward clients preserve cumulative earnings across spending and purchases.');
