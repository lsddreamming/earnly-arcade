const {test,expect}=require('@playwright/test');
const E=require('../neonbreach-engine.js');
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('arcadeSound','off'))});
test('Neon Breach shots respect cover, closest enemy, and cooldown',()=>{
 const s=E.create();s.player={x:5.5,y:5.5,a:0,hp:100};s.enemies=[{x:7,y:5.5,hp:1,type:'rusher'},{x:9,y:5.5,hp:1,type:'rusher'}];expect(E.fire(s)).toBe(true);expect(s.kills).toBe(1);expect(E.fire(s)).toBe(false);expect(s.enemies).toHaveLength(1);
 const covered=E.create();covered.player={x:2.5,y:3.5,a:0,hp:100};covered.enemies=[{x:5.5,y:3.5,hp:1,type:'rusher'}];expect(E.fire(covered)).toBe(false);expect(covered.kills).toBe(0);
});
test('Neon Breach collision, boosts, and end-state stay stable across 1000 seeded runs',()=>{
 for(let seed=1;seed<=1000;seed++){let n=seed;const random=()=>((n=(n*1664525+1013904223)>>>0)/4294967296);const s=E.create(random);E.spawn(s);expect(s.enemies.length).toBeGreaterThan(0);for(let i=0;i<200;i++){E.tick(s,.05,{forward:1,strafe:Math.sin(i),turn:2,fire:true});if(!E.clear(s.player.x,s.player.y)||!Number.isFinite(s.score))throw new Error('Unstable simulation seed '+seed)}const t=s.time;s.ended=true;E.tick(s,.05,{forward:1,fire:true});expect(s.time).toBe(t)}
 const s=E.create();s.player.hp=40;s.pickups=[{x:s.player.x,y:s.player.y,type:'health',life:3}];E.tick(s,.05);expect(s.player.hp).toBe(70);s.pickups=[{x:s.player.x,y:s.player.y,type:'shield',life:3}];E.tick(s,.05);expect(s.shield).toBe(8);s.time=179.99;E.tick(s,.05);expect(s.ended).toBe(true);
});
async function ready(page){await page.goto('/neonbreach.html');await page.locator('#startButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:10000});}
test('Neon Breach starts, pauses, resumes from controls and confirms quit',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);await expect(page.locator('#plays')).toHaveText('2');await page.locator('#earnlyPauseButton').click();await expect(page.locator('#gameStatus')).toHaveText('Paused');const hp=await page.locator('#health').textContent();await page.waitForTimeout(800);await expect(page.locator('#health')).toHaveText(hp);await page.locator('#fireButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running');await page.locator('#earnlyQuitButton').click();await expect(page.locator('.earnly-quit-dialog')).toBeVisible();await page.getByRole('button',{name:'Keep Playing',exact:true}).click();await expect(page.locator('#gameStatus')).toHaveText('Running');await page.locator('#earnlyQuitButton').click();await page.getByRole('button',{name:'Quit Game',exact:true}).click();await expect(page).toHaveURL(/games.html/);expect(errors).toEqual([]);
});
test('Neon Breach controls fit the viewport and pointer cancellation releases the joystick',async({page})=>{
 await ready(page);const r=await page.locator('#fireButton').boundingBox();expect(r.y+r.height).toBeLessThan(await page.evaluate(()=>innerHeight));const b=await page.locator('#earnlyPauseButton').boundingBox();expect(b.y+b.height).toBeLessThan(await page.evaluate(()=>innerHeight));const pad=page.locator('#movePad');const pr=await pad.boundingBox();await page.mouse.move(pr.x+pr.width/2,pr.y+pr.height/2);await page.mouse.down();await page.mouse.move(pr.x+pr.width/2+20,pr.y+pr.height/2);await pad.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();await expect(page.locator('#moveKnob')).toHaveAttribute('style','');await page.screenshot({path:`test-results/neonbreach-${test.info().project.name}.png`});
});
test('Neon Breach appears in catalog search and New filter',async({page})=>{
 await page.goto('/games.html');await page.locator('#gameSearch').fill('Neon Breach');await expect(page.locator('#games a[href="neonbreach.html"]')).toBeVisible();await page.locator('#gameSearch').fill('');await page.locator('[data-filter="new"]').click();await expect(page.locator('#games a[href="neonbreach.html"]')).toBeVisible();
});
test('Neon Breach awards once and replay consumes one new play',async({page})=>{
 await page.goto('/neonbreach.html');await page.evaluate(()=>{const original=NeonBreachEngine.create;NeonBreachEngine.create=()=>{const s=original();s.time=179.99;s.score=450;s.kills=6;NeonBreachEngine.create=original;return s}});await page.locator('#startButton').click();await expect(page.locator('#gameStatus')).toHaveText('Run Over',{timeout:10000});await expect(page.locator('#balance')).toHaveText('3');await page.waitForTimeout(300);await expect(page.locator('#balance')).toHaveText('3');await page.getByRole('button',{name:/Play Again/}).click();await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:10000});await expect(page.locator('#plays')).toHaveText('1');
});

test('Neon Breach emits one laser per accepted shot and preserves hit accuracy',()=>{
 const s=E.create();E.fire(s);E.fire(s);expect(s.events.filter(e=>e.type==='fire')).toHaveLength(1);expect(s.fired).toBe(1);expect(s.hits).toBe(0);
 s.cooldown=0;s.player={x:5.5,y:5.5,a:0,hp:100};s.enemies=[{x:7,y:5.5,hp:1,type:'rusher'}];E.fire(s);
 expect(s.fired).toBe(2);expect(s.hits).toBe(1);expect(s.events.find(e=>e.type==='impact')).toMatchObject({killed:true,points:75});
 for(let i=0;i<100;i++){s.cooldown=0;E.fire(s)}expect(s.events.length).toBeLessThanOrEqual(48);
});

test('Neon Breach renders audible lasers and robot voice with bounded levels',async({page})=>{
 await page.goto('/neonbreach.html');
 const result=await page.evaluate(async()=>{
  localStorage.setItem('arcadeSound','on');
  const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  const offline=new Offline(1,48000,16000);
  window.AudioContext=function(){return {state:'running',sampleRate:16000,currentTime:0,destination:offline.destination,createGain:()=>offline.createGain(),createBuffer:(...a)=>offline.createBuffer(...a),createBufferSource:()=>offline.createBufferSource(),createOscillator:()=>offline.createOscillator(),createBiquadFilter:()=>offline.createBiquadFilter()}};
  NeonBreachAudio.unlock();NeonBreachAudio.effect('fire');const spoke=NeonBreachAudio.voice('acquired',true);const overlap=NeonBreachAudio.voice('heavy',true);
  const buffer=await offline.startRendering(),samples=buffer.getChannelData(0);let energy=0,peak=0;for(const n of samples){energy+=n*n;peak=Math.max(peak,Math.abs(n))}
  return {spoke,overlap,peak,rms:Math.sqrt(energy/samples.length),clips:Object.keys(NeonBreachVoices.clips).length};
 });
 expect(result.spoke).toBe(true);expect(result.overlap).toBe(false);expect(result.clips).toBe(10);expect(result.peak).toBeGreaterThan(.15);expect(result.peak).toBeLessThan(1);expect(result.rms).toBeGreaterThan(.015);
});

test('Neon Breach sound and voice settings persist and stop playback on pause',async({page})=>{
 await page.goto('/neonbreach.html');
 await page.evaluate(()=>{
  window.audioChecks={effects:[],suspends:0,voices:0,stopped:0};
  const original=NeonBreachAudio.effect;NeonBreachAudio.effect=(...args)=>{audioChecks.effects.push(args[0]);return original(...args)};
  const originalSuspend=NeonBreachAudio.suspend;NeonBreachAudio.suspend=()=>{audioChecks.suspends++;originalSuspend()};
  const originalStop=NeonBreachAudio.stop;NeonBreachAudio.stop=()=>{audioChecks.stopped++;originalStop()};
 });
 await page.locator('#voiceButton').click();await expect(page.locator('#voiceButton')).toHaveAttribute('aria-pressed','false');
 await page.locator('#startButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:10000});
 await page.keyboard.down(' ');await expect.poll(()=>page.evaluate(()=>audioChecks.effects.filter(x=>x==='fire').length)).toBeGreaterThan(1);await page.keyboard.up(' ');
 await page.locator('#earnlyPauseButton').click();const before=await page.evaluate(()=>audioChecks.effects.length);await page.waitForTimeout(350);
 expect(await page.evaluate(()=>audioChecks.effects.length)).toBe(before);expect(await page.evaluate(()=>audioChecks.suspends)).toBeGreaterThan(0);
 expect(await page.evaluate(()=>NeonBreachAudio.voice('acquired',true))).toBe(false);
 await page.locator('#voiceButton').click();await expect(page.locator('#voiceButton')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#gameStatus')).toHaveText('Paused');
 await page.reload();await expect(page.locator('#voiceButton')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#soundButton')).toHaveAttribute('aria-pressed','false');
});

test('Neon Breach phone controls never overlap and remain visible in landscape',async({page})=>{
 await page.setViewportSize({width:390,height:664});await ready(page);
 for(const viewport of [{width:390,height:664},{width:844,height:390}]){
  await page.setViewportSize(viewport);
  const bounds=await page.locator('#fireButton,#earnlyPauseButton,#earnlyQuitButton,#soundButton,#voiceButton').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {id:n.id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}}));
  for(const r of bounds){expect(r.x,r.id).toBeGreaterThanOrEqual(0);expect(r.right,r.id).toBeLessThanOrEqual(viewport.width);expect(r.bottom,r.id).toBeLessThanOrEqual(viewport.height);expect(r.height,r.id).toBeGreaterThanOrEqual(32)}
  for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++){const a=bounds[i],b=bounds[j];expect(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,`${a.id} overlaps ${b.id}`).toBe(true)}
 }
});
