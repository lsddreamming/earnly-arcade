import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {configureNativeEnvironment,nativeEnvironment} from './native-environment.mjs';

test('unknown environment fails closed instead of silently selecting production',()=>{
  assert.throws(()=>nativeEnvironment('sandboox'),/Unknown/);
});
test('sandbox isolates auth, purchases, avatars, plays and game networking together',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'earnly-environment-'));
  try {
    const names=['cloud.js','coin-shop.js','paid-plays.js','avatar-config.js','cosmetic-ui.js','crystal-command-network.js'];
    for(const name of names) await writeFile(path.join(dir,name),await readFile(new URL('../'+name,import.meta.url)));
    await writeFile(path.join(dir,'index.html'),'<body class="app">App</body>');
    await configureNativeEnvironment(dir,'sandbox');
    for(const name of names){
      const source=await readFile(path.join(dir,name),'utf8');
      assert.ok(source.includes('wphqfogbnpdsfkquvdsu'),name);
      assert.ok(!source.includes('zdwziebtbpuolusztede'),name);
      assert.ok(!source.includes('sb_publishable_wnizO81RYGI9LRO2R0Exgg_53T55AxZ'),name);
    }
    assert.match(await readFile(path.join(dir,'index.html'),'utf8'),/SANDBOX/);
    assert.equal(JSON.parse(await readFile(path.join(dir,'native-build-environment.json'))).purchaseEnvironment,'Sandbox');
  } finally {await rm(dir,{recursive:true,force:true});}
});
test('production remains unchanged and has no sandbox banner',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'earnly-production-'));
  try {
    const source='<body>https://zdwziebtbpuolusztede.supabase.co</body>';
    await writeFile(path.join(dir,'index.html'),source);
    await configureNativeEnvironment(dir,'production');
    assert.equal(await readFile(path.join(dir,'index.html'),'utf8'),source);
  } finally {await rm(dir,{recursive:true,force:true});}
});
