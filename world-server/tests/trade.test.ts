import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TradeSession} from '../src/trade.ts';
test('edits reset both locks and confirmations; duplicate confirms never swap twice',async()=>{
 const t=new TradeSession('trade','a','b');let swaps=0;
 const repo={exchange:async()=>{swaps++;}};
 t.edit('a',0,['chair']);t.lock('a',1);t.lock('b',1);
 await t.confirm('a',1,repo);assert.equal(swaps,0);
 t.edit('b',1,['lamp']);
 assert.ok(t.snapshot().offers.every(o=>!o.locked&&!o.confirmed));
 await assert.rejects(t.confirm('b',1,repo));
 await assert.rejects(t.confirm('b',2,repo));
 t.lock('a',2);t.lock('b',2);await t.confirm('a',2,repo);await t.confirm('b',2,repo);
 await assert.rejects(t.confirm('b',2,repo));assert.equal(swaps,1);
});
test('outsiders cannot edit and ambiguous commits cannot reopen offers',async()=>{
 const t=new TradeSession('trade','a','b');
 assert.throws(()=>t.edit('c',0,[]));t.lock('a',0);t.lock('b',0);
 const repo={exchange:async()=>{throw new Error('timeout');}};
 await t.confirm('a',0,repo);await assert.rejects(t.confirm('b',0,repo));
 assert.equal(t.snapshot().status,'committing');assert.throws(()=>t.edit('a',0,[]));
});
