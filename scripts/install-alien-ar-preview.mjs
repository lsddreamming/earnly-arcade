import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

// Called only by an explicitly selected preview build. Ordinary Earnly builds
// retain their existing native plugins, camera permissions and home page.
export async function installAlienARPreview(root=process.cwd()) {
  const read=p=>readFile(path.join(root,p),'utf8');
  const app='ios/App/App/';
  const delegatePath=app+'AppDelegate.swift';
  let delegate=await read(delegatePath);
  delegate=delegate.split('// EARNLY ALIEN AR PREVIEW')[0].trimEnd();
  delegate=delegate.replace('; bridge?.registerPluginInstance(AlienInvasionPlugin())','');
  const registration='bridge?.registerPluginInstance(ArcadePurchasesPlugin())';
  if(!delegate.includes(registration))throw new Error('Earnly bridge registration point missing; preview injection stopped.');
  delegate=delegate.replace(registration,registration+'; bridge?.registerPluginInstance(AlienInvasionPlugin())');
  const source=await Promise.all(['native/AlienInvasionAR/Sources/World.swift','native/AlienInvasionAR/Sources/PortalPlacement.swift','native/AlienInvasionAR/Sources/AlienVisuals.swift','native/AlienInvasionAR/Sources/AlienAudio.swift','native/AlienInvasionAR/Sources/GameViewController.swift','native/AlienInvasionBridge.swift'].map(read));
  let plist=await read(app+'Info.plist');
  if(!/<\/dict>\s*<\/plist>\s*$/.test(plist))throw new Error('Invalid application plist; preview injection stopped.');
  if(!plist.includes('<key>NSCameraUsageDescription</key>')){
    plist=plist.replace(/\s*<\/dict>\s*<\/plist>\s*$/,'\n<key>NSCameraUsageDescription</key>\n<string>Show your room and track alien portals in 3D. Camera footage stays on your device.</string>\n</dict>\n</plist>\n');
  }
  await writeFile(path.join(root,delegatePath),delegate+'\n\n// EARNLY ALIEN AR PREVIEW\n'+source.join('\n'));
  await writeFile(path.join(root,app+'Info.plist'),plist);
  const publicDir=path.join(root,app,'public');await mkdir(publicDir,{recursive:true});
  // One shared offline generator keeps the standalone and embedded clips identical.
  execFileSync('python3',[path.join(root,'native/AlienInvasionAR/audio_assets.py'),publicDir,'--prefix','alien-ar-']);
  console.log('Enabled native AR game inside the existing Earnly Arcade preview app.');
}
