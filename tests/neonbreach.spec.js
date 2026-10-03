const {test,expect}=require('@playwright/test');
const E=require('../neonbreach-engine.js');
test('Expanded sector is connected and every spawn has a route to the player',()=>{
 const s=E.create();E.navigation(s);let floor=0;
 for(let y=0;y<E.MAP.length;y++)for(let x=0;x<E.MAP[y].length;x++)if(E.MAP[y][x]==='0'){floor++;expect(s.nav[y*E.MAP[0].length+x]).toBeGreaterThanOrEqual(0)}
 expect(floor).toBeGreaterThan(210);
 for(const wave of [1,4,7,10,16]){const run=E.create(()=>.37);run.wave=wave-1;E.spawn(run);expect(run.enemies).toHaveLength(E.difficulty(wave).count);for(const e of run.enemies){expect(E.clear(e.x,e.y)).toBe(true);expect(Math.hypot(e.x-run.player.x,e.y-run.player.y)).toBeGreaterThan(3)}}
});
test('Robots navigate around cover instead of getting trapped in the expanded map',()=>{
 for(const pos of [[2.5,2.5],[12.5,2.5],[14.5,8.5],[5.5,12.5],[15.5,15.5]]){
  const s=E.create();s.hurt=1000;s.wave=3;s.enemies=[{x:pos[0],y:pos[1],type:'rusher',hp:1,attack:1,phase:0}];
  let closest=Infinity;for(let i=0;i<1600;i++){E.tick(s,.05);const e=s.enemies[0];expect(E.clear(e.x,e.y)).toBe(true);closest=Math.min(closest,Math.hypot(e.x-s.player.x,e.y-s.player.y));if(closest<.7)break}
  expect(closest,`robot from ${pos} never reached player`).toBeLessThan(.7);
 }
});
test('Higher waves pursue faster, fire more often and leave less recovery time',()=>{
 const observed=[];
 for(const wave of [2,7,12]){
  const s=E.create();s.wave=wave;s.player={x:8.5,y:10.5,a:0,hp:100};s.hurt=1000;s.enemies=[{x:8.5,y:5.5,type:'rusher',hp:1,attack:1,phase:0}];
  for(let i=0;i<20;i++)E.tick(s,.05);const distance=10.5-s.enemies[0].y;
  s.enemies=[{x:6,y:10.5,type:'sentry',hp:2,attack:0,phase:0}];s.shots=[];E.tick(s,.01);const bolt=s.shots[0];
  observed.push({distance,delay:s.enemies[0].attack,bolt:Math.hypot(bolt.vx,bolt.vy),rest:E.difficulty(wave).rest,count:E.difficulty(wave).count});
 }
 for(let i=1;i<observed.length;i++){expect(observed[i].distance).toBeLessThan(observed[i-1].distance);expect(observed[i].delay).toBeLessThan(observed[i-1].delay);expect(observed[i].bolt).toBeGreaterThan(observed[i-1].bolt);expect(observed[i].rest).toBeLessThan(observed[i-1].rest);expect(observed[i].count).toBeGreaterThan(observed[i-1].count)}
 expect(E.difficulty(100).rusher*1.06).toBeLessThan(2.4);
});
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
  const session={type:'auto'};Object.defineProperty(navigator,'audioSession',{value:session,configurable:true});
  window.AudioContext=function(){return {state:'running',sampleRate:16000,currentTime:0,destination:offline.destination,suspend:()=>Promise.resolve(),createGain:()=>offline.createGain(),createBuffer:(...a)=>offline.createBuffer(...a),createBufferSource:()=>offline.createBufferSource(),createOscillator:()=>offline.createOscillator(),createBiquadFilter:()=>offline.createBiquadFilter()}};
  NeonBreachAudio.unlock();NeonBreachAudio.effect('fire');const spoke=NeonBreachAudio.voice('acquired',true);const overlap=NeonBreachAudio.voice('heavy',true);
  const buffer=await offline.startRendering(),samples=buffer.getChannelData(0);let energy=0,peak=0;for(const n of samples){energy+=n*n;peak=Math.max(peak,Math.abs(n))}
  const activeType=session.type;NeonBreachAudio.suspend();localStorage.setItem('arcadeSound','off');NeonBreachAudio.unlock();
  return {spoke,overlap,peak,rms:Math.sqrt(energy/samples.length),clips:Object.keys(NeonBreachVoices.clips).length,activeType,mutedType:session.type};
 });
 expect(result.spoke).toBe(true);expect(result.overlap).toBe(false);expect(result.clips).toBe(10);expect(result.peak).toBeGreaterThan(.15);expect(result.peak).toBeLessThan(1);expect(result.rms).toBeGreaterThan(.015);
 expect(result.activeType).toBe('playback');expect(result.mutedType).toBe('auto');
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
 await page.locator('#voiceButton').focus();await page.keyboard.press(' ');await expect(page.locator('#voiceButton')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#gameStatus')).toHaveText('Paused');
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

test('Textured arena hides robots behind cover and rendering never changes combat state',async({page})=>{
 await page.goto('/neonbreach.html');
 const result=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=400;canvas.height=440;
  const renderer=NeonBreachRenderer.create(canvas),ctx=canvas.getContext('2d');
  const s=NeonBreachEngine.create();s.player={x:2.5,y:3.5,a:0,hp:100};
  renderer.render(s);const empty=ctx.getImageData(90,100,220,200).data.slice();
  s.enemies=[{x:5.5,y:3.5,type:'tank',elite:true,hp:5,maxHp:5,phase:0}];
  const before=JSON.stringify(s);renderer.render(s,{dt:.016,running:true});
  const covered=ctx.getImageData(90,100,220,200).data;
  const same=empty.every((value,i)=>value===covered[i]);
  const unchanged=before===JSON.stringify(s);
  s.player={x:5.5,y:5.5,a:0,hp:100};s.enemies[0].x=7.5;s.enemies[0].y=5.5;
  renderer.render(s);const visible=ctx.getImageData(90,100,220,200).data.slice();
  s.enemies=[];renderer.render(s);const clear=ctx.getImageData(90,100,220,200).data;
  return {same,unchanged,visiblePixels:visible.reduce((n,value,i)=>n+(value!==clear[i]?1:0),0)};
 });
 expect(result.same).toBe(true);expect(result.unchanged).toBe(true);expect(result.visiblePixels).toBeGreaterThan(300);
});

test('High-density graphics remain bounded and preserve the canvas aspect ratio after rotation',async({page})=>{
 await ready(page);
 for(const viewport of [{width:430,height:932},{width:932,height:430},{width:320,height:568}]){
  await page.setViewportSize(viewport);
  await expect.poll(()=>page.locator('#game').evaluate(c=>{const r=c.getBoundingClientRect();return Math.abs(c.height/c.width-r.height/r.width)})).toBeLessThan(.003);
  const size=await page.locator('#game').evaluate(c=>({width:c.width,height:c.height}));
  expect(size.width).toBeGreaterThanOrEqual(400);expect(size.width).toBeLessThanOrEqual(800);expect(size.height).toBeGreaterThan(0);
 }
});
