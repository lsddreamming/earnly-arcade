import test from 'node:test';
import assert from 'node:assert/strict';
import {worldOrigins} from '../src/origins.ts';
test('web and bundled iOS clients can reach authenticated gateway',()=>{
 const origins=worldOrigins('https://earnlyarcade.com,https://www.earnlyarcade.com');
 assert.ok(origins.has('capacitor://localhost'));assert.ok(origins.has('https://earnlyarcade.com'));
 for(const bad of ['null','capacitor://attacker','https://attacker.example','http://localhost'])assert.ok(!origins.has(bad));
});
test('reject malformed and wildcard origin configuration',()=>{
 for(const bad of ['', '*','null','http://earnlyarcade.com','https://earnlyarcade.com/path','capacitor://attacker'])assert.throws(()=>worldOrigins(bad));
});
