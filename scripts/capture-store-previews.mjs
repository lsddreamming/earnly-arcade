import {webkit, devices} from 'playwright';
import {mkdir, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

// Review drafts from the real web UI. Final App Store assets must be recaptured
// from the exact native release candidate, including signed-in World scenes.
const out='app-store-previews';
await mkdir(out,{recursive:true});
const browser=await webkit.launch();
try {
 const context=await browser.newContext({...devices['iPhone 14 Pro Max'],viewport:{width:440,height:956},deviceScaleFactor:3});
 const page=await context.newPage();
 const manifest={kind:'WEB REVIEW DRAFT — NOT NATIVE RELEASE SCREENSHOTS',commit:process.env.GITHUB_SHA??'local',files:[]};
 for(const [name,path,ready] of [
  ['03-home','index.html','.home-primary-play'],
  ['04-games','games.html','.game-browser-tools'],
  ['05-bubble-pop','bubble-pop.html','#play'],
  ['06-avatar-shop','avatars.html','body']
 ]){
  // Cosmetics API restricts browser origins; use the actual production origin
  // rather than faking catalog responses for marketing screenshots.
  const source=path==='avatars.html'?'https://earnlyarcade.com/'+path:'http://127.0.0.1:4173/'+path;
  await page.goto(source);
  await page.locator(ready).waitFor({state:'visible'});
  if(path==='avatars.html')await page.locator('#character-stage svg').first().waitFor({state:'visible',timeout:45000});
  if(path==='bubble-pop.html')await page.locator('#play').click();
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(1500);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),path+' overflows');
  await page.screenshot({path:out+'/'+name+'.png',animations:'disabled'});
  manifest.files.push({file:name+'.png',source,width:1320,height:2868});
 }
 await writeFile(out+'/provenance.json',JSON.stringify(manifest,null,2));
} finally {await browser.close();}
