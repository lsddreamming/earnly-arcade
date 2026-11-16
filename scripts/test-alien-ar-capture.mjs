import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const capture=fileURLToPath(new URL('./capture-alien-ar-review.sh',import.meta.url));
async function run(t,scenario){
  const root=await mkdtemp(path.join(tmpdir(),'earnly-ar-capture-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const bin=path.join(root,'bin'), docs=path.join(root,'data/Documents');
  await mkdir(bin); await mkdir(docs,{recursive:true});
  // A previous successful launch must never hide a failed new launch.
  await writeFile(path.join(docs,'visual-review.json'),JSON.stringify({layoutPass:true,anchorsStable:true,audioPass:true,soundControlPass:true,physicalARVerified:false,mode:'stale'}));
  await symlink('/usr/bin/true',path.join(bin,'xcodebuild'));
  await writeFile(path.join(bin,'sleep'),'#!/bin/sh\n/bin/sleep 0.02\n',{mode:0o755});
  await writeFile(path.join(bin,'xcrun'),`#!/usr/bin/env python3
import json, os, pathlib, sys, time
a=sys.argv[1:]; root=pathlib.Path(os.environ['CAPTURE_FIXTURE']); scenario=os.environ['CAPTURE_SCENARIO']
command=a[1]
if command=='list':
    print(json.dumps({'devices':{'iOS':[{'name':'iPhone SE','udid':'fixture-phone'}]}}))
elif command=='get_app_container': print(root/'data')
elif command=='launch':
    assert '--console-pty' in a, 'host console capture is required'
    if scenario=='crash':
        print('launch failed before review'); sys.exit(1)
    time.sleep(.03)
    result={'layoutPass':True,'anchorsStable':True,'audioPass':scenario!='audio-fail','soundControlPass':True,'physicalARVerified':False,'mode':a[-1]}
    (root/'data/Documents/visual-review.json').write_text(json.dumps(result))
    if scenario=='shader': print('Error Domain=SCNErrorDomain: compilation failed',file=sys.stderr)
    elif scenario!='empty': print('Simulator review ready: '+a[-1])
elif command=='io': pathlib.Path(a[-1]).write_bytes(b'fixture screenshot')
`,{mode:0o755});
  const result=spawnSync('bash',[capture],{cwd:root,encoding:'utf8',timeout:15000,env:{...process.env,PATH:bin+path.delimiter+process.env.PATH,CAPTURE_FIXTURE:root,CAPTURE_SCENARIO:scenario}});
  assert.ifError(result.error);
  return {...result,root,artifacts:path.join(root,'test-results/alien-native')};
}

test('capture waits for fresh results and preserves host console for all 16 modes',async t=>{
  const r=await run(t,'success'); assert.equal(r.status,0,r.stdout+r.stderr);
  const files=await readdir(r.artifacts), results=files.filter(f=>f.endsWith('.json'));
  assert.equal(results.length,16);
  for(const file of results){
    const mode=file.slice(0,-5), data=JSON.parse(await readFile(path.join(r.artifacts,file),'utf8'));
    assert.equal(data.mode,mode);
    assert.match(await readFile(path.join(r.artifacts,mode+'-console.log'),'utf8'),/Simulator review ready/);
    assert.ok(files.includes(mode+'.png'));
  }
});
for(const [scenario,message] of [['shader',/SceneKit shader errors/],['crash',/No native visual review result/],['audio-fail',/AssertionError/],['empty',/console capture is empty/]]){
  test('capture fails closed for '+scenario,async t=>{
    const r=await run(t,scenario); assert.notEqual(r.status,0); assert.match(r.stdout+r.stderr,message);
    assert.ok((await readdir(r.artifacts)).includes('Air-console.log'),'retain diagnostics even on failure');
  });
}
