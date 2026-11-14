import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,cp,symlink,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {installAlienARPreview} from './install-alien-ar-preview.mjs';

const repo=fileURLToPath(new URL('../',import.meta.url));
async function fixture(t){
  const root=await mkdtemp(path.join(tmpdir(),'earnly-ar-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,'ios/App/App'),{recursive:true});
  await cp(path.join(repo,'native'),path.join(root,'native'),{recursive:true,filter:source=>!/(DerivedData|\.build|\.xcodeproj)/.test(source)});
  await writeFile(path.join(root,'ios/App/App/AppDelegate.swift'),'import UIKit\n@main class AppDelegate {}\n'+await readFile(path.join(repo,'native/ArcadePurchases.swift'),'utf8'));
  await writeFile(path.join(root,'ios/App/App/Info.plist'),'<plist version="1.0"><dict><key>CFBundleIdentifier</key><string>com.earnly.arcade</string><key>ITSAppUsesNonExemptEncryption</key><false/><key>Unrelated</key><dict><key>keep</key><true/></dict></dict></plist>');
  return {root,read:p=>readFile(path.join(root,p),'utf8')};
}

test('embedding is repeatable and preserves the existing app, StoreKit and plist',async t=>{
  const f=await fixture(t);
  await installAlienARPreview(f.root);
  const first=await f.read('ios/App/App/AppDelegate.swift');
  await installAlienARPreview(f.root);
  assert.equal(await f.read('ios/App/App/AppDelegate.swift'),first);
  assert.equal(first.match(/@main/g).length,1,'do not embed a second application');
  assert.ok(first.includes(await f.read('native/AlienInvasionAR/Sources/AlienVisuals.swift')), 'package the complete alien and weapon renderer');
  assert.equal(first.match(/registerPluginInstance\(ArcadePurchasesPlugin\(\)\)/g).length,1);
  assert.equal(first.match(/registerPluginInstance\(AlienInvasionPlugin\(\)\)/g).length,1);
  const parsed=spawnSync('python3',['-c','import plistlib,json,sys; print(json.dumps(plistlib.load(open(sys.argv[1],"rb"))))',path.join(f.root,'ios/App/App/Info.plist')],{encoding:'utf8'});
  assert.equal(parsed.status,0,parsed.stderr);
  const plist=JSON.parse(parsed.stdout);
  assert.equal(plist.CFBundleIdentifier,'com.earnly.arcade');
  assert.equal(plist.ITSAppUsesNonExemptEncryption,false);
  assert.deepEqual(plist.Unrelated,{keep:true});
  assert.match(plist.NSCameraUsageDescription,/stays on your device/);
  const wav=await readFile(path.join(f.root,'ios/App/App/public/alien-ar-zap.wav'));
  assert.equal(wav.toString('ascii',0,4),'RIFF');
  assert.equal(wav.readUInt32LE(4),wav.length-8);
});

test('missing bridge or invalid plist fails before changing generated source',async t=>{
  const f=await fixture(t);
  await writeFile(path.join(f.root,'ios/App/App/AppDelegate.swift'),'import UIKit\n');
  await assert.rejects(installAlienARPreview(f.root),/registration point missing/);
  assert.equal(await f.read('ios/App/App/AppDelegate.swift'),'import UIKit\n');
  await writeFile(path.join(f.root,'ios/App/App/AppDelegate.swift'),'bridge?.registerPluginInstance(ArcadePurchasesPlugin())');
  await writeFile(path.join(f.root,'ios/App/App/Info.plist'),'invalid');
  await assert.rejects(installAlienARPreview(f.root),/Invalid application plist/);
  assert.equal(await f.read('ios/App/App/AppDelegate.swift'),'bridge?.registerPluginInstance(ArcadePurchasesPlugin())');
});

test('only a selected preview packages the launcher; rebuilding normally removes it',async t=>{
  const f=await fixture(t);
  await symlink(path.join(repo,'node_modules'),path.join(f.root,'node_modules'),'dir');
  const original='<html><body><a href="games.html">Existing games</a></body></html>';
  await writeFile(path.join(f.root,'index.html'),original);
  for(const file of ['native-ads-entry.js','native-purchases-entry.js','native-share-entry.js'])await writeFile(path.join(f.root,file),'window.existingEarnlyFeature=true;');
  await cp(path.join(repo,'native-alien-ar-entry.js'),path.join(f.root,'native-alien-ar-entry.js'));
  for(const flag of ['0','1','0']){
    const run=spawnSync(process.execPath,[path.join(repo,'scripts/build-native-web.mjs')],{cwd:f.root,encoding:'utf8',env:{...process.env,EARNLY_ALIEN_AR_PREVIEW:flag,EARNLY_BACKEND_ENVIRONMENT:'production'}});
    assert.equal(run.status,0,run.stderr);
    assert.equal(await f.read('index.html'),original);
    const built=await f.read('www/index.html');
    if(flag==='1'){
      assert.match(built,/alienARPreviewEntry/);
      assert.match(built,/Existing games/);
      assert.match(await f.read('www/alien-invasion-native.html'),/native-alien-ar.js/);
      assert.match(await f.read('www/native-alien-ar.js'),/AlienInvasion/);
    }else{
      assert.equal(built,original);
      await assert.rejects(access(path.join(f.root,'www/alien-invasion-native.html')));
      await assert.rejects(access(path.join(f.root,'www/native-alien-ar.js')));
    }
  }
});

test('AR upload gate requires a successful integrated app build on the approved main commit',async()=>{
  const workflow=await readFile(path.join(repo,'.github/workflows/ios-v1-13-testflight.yml'),'utf8');
  const section=workflow.split('\n  preview-gate:')[1].split('\n  archive:')[0];
  const script=section.split('          script: |\n')[1].trimEnd().split('\n').map(line=>line.slice(12)).join('\n');
  const execute=new (Object.getPrototypeOf(async function(){}).constructor)('github','context',script);
  async function run({ref='refs/heads/main',event='push',runConclusion='success',jobs=[{name:'earnly-integrated-game',conclusion:'success'}]}={}){
    const github={rest:{actions:{
      listWorkflowRunsForRepo:async args=>{assert.equal(args.head_sha,'candidate');return {data:{workflow_runs:[{id:1,path:'.github/workflows/alien-invasion-ar.yml',head_branch:'main',event,status:'completed',conclusion:runConclusion}]}};},
      listJobsForWorkflowRun:async()=>({data:{jobs}})
    }}};
    await execute(github,{ref,sha:'candidate',repo:{owner:'owner',repo:'repo'}});
  }
  await run();
  await assert.rejects(run({ref:'refs/heads/feature'}),/approved main/);
  await assert.rejects(run({event:'pull_request'}),/before uploading/);
  await assert.rejects(run({runConclusion:'failure'}),/before uploading/);
  await assert.rejects(run({jobs:[{name:'earnly-integrated-game',conclusion:'skipped'}]}),/has not compiled/);
  await assert.rejects(run({jobs:[]}),/has not compiled/);
});
