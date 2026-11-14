import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';

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
  const source=await Promise.all(['native/AlienInvasionAR/Sources/World.swift','native/AlienInvasionAR/Sources/PortalPlacement.swift','native/AlienInvasionAR/Sources/AlienVisuals.swift','native/AlienInvasionAR/Sources/GameViewController.swift','native/AlienInvasionBridge.swift'].map(read));
  let plist=await read(app+'Info.plist');
  if(!/<\/dict>\s*<\/plist>\s*$/.test(plist))throw new Error('Invalid application plist; preview injection stopped.');
  if(!plist.includes('<key>NSCameraUsageDescription</key>')){
    plist=plist.replace(/\s*<\/dict>\s*<\/plist>\s*$/,'\n<key>NSCameraUsageDescription</key>\n<string>Show your room and track alien portals in 3D. Camera footage stays on your device.</string>\n</dict>\n</plist>\n');
  }
  await writeFile(path.join(root,delegatePath),delegate+'\n\n// EARNLY ALIEN AR PREVIEW\n'+source.join('\n'));
  await writeFile(path.join(root,app+'Info.plist'),plist);
  const publicDir=path.join(root,app,'public');await mkdir(publicDir,{recursive:true});
  // Short positional zap, generated locally. No recording or network assets.
  const samples=4400, wav=Buffer.alloc(44+samples*2);
  wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(22050,24);wav.writeUInt32LE(44100,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);
  for(let i=0;i<samples;i++)wav.writeInt16LE(Math.round(8000*(1-i/samples)**2*Math.sin(2*Math.PI*(900*i/22050-550*(i/22050)**2))),44+i*2);
  await writeFile(path.join(publicDir,'alien-ar-zap.wav'),wav);
  console.log('Enabled native AR game inside the existing Earnly Arcade preview app.');
}
