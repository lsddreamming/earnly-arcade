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
