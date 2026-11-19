const {test,expect}=require('@playwright/test');
test.use({launchOptions:{args:process.env.METAL_MAYHEM_CHROMIUM_3D==='1'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]}});
test.setTimeout(120000);
async function open(page,prefix='/'){
 await page.route('**/functions/v1/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"PREVIEW_ONLY"}'}));
 await page.route('**/auth/v1/**',route=>route.abort());
 await page.goto(prefix+'metal-mayhem.html?qa=1',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#start')).toBeEnabled({timeout:25000});
}
async function visibility(page,hidden){
 await page.evaluate(hidden=>{
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});
  document.dispatchEvent(new Event('visibilitychange'));
 },hidden);
}
for(const prefix of ['/','/www/'])test(`Metal Mayhem focus changes clear controls without a mobile pause loop ${prefix}`,async({page})=>{
 await open(page,prefix);await page.locator('#start').click();await expect(page.locator('#hud')).toBeVisible();
 const coarse=await page.evaluate(()=>matchMedia('(pointer:coarse)').matches);
 for(let i=0;i<2;i++){
  await page.keyboard.down('KeyW');expect(await page.evaluate(()=>__metalMayhem.input.z)).toBe(-1);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  expect(await page.evaluate(()=>__metalMayhem.input.z)).toBe(0);
  await page.keyboard.up('KeyW');
  expect(await page.evaluate(()=>__metalMayhem.paused)).toBe(!coarse);
  if(coarse){
   await expect(page.locator('#pauseScreen')).toBeHidden();
   const tick=await page.evaluate(()=>__metalMayhem.state.tick);
   await expect.poll(()=>page.evaluate(()=>__metalMayhem.state.tick)).toBeGreaterThan(tick);
   // Deliberate pause still works, and another blur after Resume must not reopen it.
   await page.locator('#pause').click();
  }
  await expect(page.locator('#pauseScreen')).toBeVisible();await page.locator('#resume').click();
 }
});
test('Metal Mayhem hidden pages stay paused until a visible Resume, including pagehide',async({page})=>{
 await open(page);await page.locator('#start').click();await expect(page.locator('#hud')).toBeVisible();
 await visibility(page,true);await expect(page.locator('#pauseScreen')).toBeVisible();
 const tick=await page.evaluate(()=>__metalMayhem.state.tick);
 await page.evaluate(()=>document.getElementById('resume').click());
 expect(await page.evaluate(()=>__metalMayhem.paused)).toBe(true);
 await page.waitForTimeout(200);expect(await page.evaluate(()=>__metalMayhem.state.tick)).toBe(tick);
 await visibility(page,false);expect(await page.evaluate(()=>__metalMayhem.paused)).toBe(true);
 await page.locator('#resume').click();await expect.poll(()=>page.evaluate(()=>__metalMayhem.state.tick)).toBeGreaterThan(tick);
 await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
 await expect(page.locator('#pauseScreen')).toBeVisible();
 await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
 expect(await page.evaluate(()=>__metalMayhem.paused)).toBe(true);
 await page.locator('#resume').click();await expect(page.locator('#pauseScreen')).toBeHidden();
});
test('Metal Mayhem backgrounding during arena entry does not start combat offscreen',async({page})=>{
 await open(page);
 await page.evaluate(()=>{
  window.MetalMayhemRewards.start=()=>new Promise(resolve=>{window.finishArenaEntry=resolve;});
  document.getElementById('start').click();
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
  document.dispatchEvent(new Event('visibilitychange'));
  window.finishArenaEntry(null);
 });
 await expect(page.locator('#pauseScreen')).toBeVisible();
 expect(await page.evaluate(()=>__metalMayhem.state.tick)).toBe(0);
 await visibility(page,false);await page.locator('#resume').click();
 await expect.poll(()=>page.evaluate(()=>__metalMayhem.state.tick)).toBeGreaterThan(0);
});
for(const prefix of ['/','/www/'])test(`Metal Mayhem real WebGL loads, moves, pauses and restarts ${prefix}`,async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page,prefix);await page.screenshot({path:info.outputPath('metal-mayhem-menu.png')});await page.locator('#start').click();await expect(page.locator('#hud')).toBeVisible();
 const start=await page.evaluate(()=>__metalMayhem.state.player.z);await page.keyboard.down('KeyW');await expect.poll(()=>page.evaluate(()=>__metalMayhem.state.player.z),{timeout:15000}).toBeLessThan(start-1);await page.keyboard.up('KeyW');
 await page.locator('#pause').click();const tick=await page.evaluate(()=>__metalMayhem.state.tick);await page.waitForTimeout(200);expect(await page.evaluate(()=>__metalMayhem.state.tick)).toBe(tick);await page.locator('#resume').click();await expect.poll(()=>page.evaluate(()=>__metalMayhem.state.tick)).toBeGreaterThan(tick);
 await page.locator('#pause').click();await page.locator('#restart').click();await expect(page.locator('#hud')).toBeVisible();expect(await page.evaluate(()=>__metalMayhem.state.wave)).toBe(1);await page.screenshot({path:info.outputPath('metal-mayhem-combat.png')});expect(errors).toEqual([]);
});
test('Metal Mayhem physical touch targets support joystick plus camera plus attack',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await open(page);await page.locator('#start').click();await expect(page.locator('#hud')).toBeVisible();
 await page.addStyleTag({content:'#controls{display:block!important}'});
 // Chromium exercises genuine simultaneous touches; WebKit exercises real pointer hit-testing.
 if(info.project.name==='desktop-chromium'){
  const cdp=await page.context().newCDPSession(page);const j=await page.locator('#joystick').boundingBox();const a=await page.locator('#attack').boundingBox();
  // A test-only CSS media override reveals the same controls on desktop.
  if(!j||!a){await page.addStyleTag({content:'#controls{display:block!important}'});}
  const stick=await page.locator('#joystick').boundingBox(),attack=await page.locator('#attack').boundingBox();
  const touch=(x,y,id)=>({x,y,id});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(stick.x+stick.width/2,stick.y+stick.height/2,1)]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(stick.x+stick.width/2,stick.y+10,1)]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(stick.x+stick.width/2,stick.y+10,1),touch(300,350,2),touch(attack.x+40,attack.y+40,3)]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(stick.x+stick.width/2,stick.y+10,1),touch(340,350,2),touch(attack.x+40,attack.y+40,3)]});
  await expect.poll(()=>page.evaluate(()=>__metalMayhem.state.player.z),{timeout:15000}).toBeLessThan(7);expect(await page.evaluate(()=>__metalMayhem.yaw)).toBeGreaterThan(.1);expect(await page.evaluate(()=>__metalMayhem.input.attack)).toBe(true);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});expect(await page.evaluate(()=>__metalMayhem.input.attack)).toBe(false);expect(await page.evaluate(()=>__metalMayhem.input.x)).toBe(0);
 }else{
  const j=await page.locator('#joystick').boundingBox();await page.mouse.move(j.x+j.width/2,j.y+j.height/2);await page.mouse.down();await page.mouse.move(j.x+j.width/2,j.y+8);await expect.poll(()=>page.evaluate(()=>__metalMayhem.state.player.z),{timeout:15000}).toBeLessThan(7);await page.mouse.up();expect(await page.evaluate(()=>__metalMayhem.input.z)).toBe(0);await page.locator('#attack').tap();
 }
 await page.locator('#pause').click();expect(await page.evaluate(()=>__metalMayhem.input.attack)).toBe(false);await page.screenshot({path:info.outputPath('metal-mayhem-phone-pause.png')});
});
test('Metal Mayhem wave clear, upgrade, death, records and safe practice mode',async({page},info)=>{
 await open(page);await page.locator('#start').click();await expect(page.locator('#hud')).toBeVisible();await page.evaluate(()=>{const s=__metalMayhem.state;s.queue=[];for(const e of s.enemies)e.alive=false;});await expect(page.locator('#upgradeChoices button')).toHaveCount(3);await page.screenshot({path:info.outputPath('metal-mayhem-upgrades.png')});await page.locator('#upgradeChoices button').first().click();await expect(page.locator('#upgradeScreen')).toBeHidden();expect(await page.evaluate(()=>__metalMayhem.state.wave)).toBe(2);
 await page.evaluate(()=>{const s=__metalMayhem.state;MetalMayhem.damage(s,s.player,'core',10000,{id:1,x:0,z:0},s.player);});
 // The actual frame loop must detect externally observed deaths as well as its own tick deaths.
 await expect(page.locator('#resultScreen')).toBeVisible();await expect(page.locator('#rewardStatus')).toContainText('Practice');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('earnly.metalMayhem.best.v1')).wave)).toBe(2);await page.locator('#replay').click();await expect(page.locator('#resultScreen')).toBeHidden();
});
test('Metal Mayhem layouts and controls fit portrait, landscape and narrow phones',async({page},info)=>{
 for(const [width,height]of [[320,568],[390,844],[844,390]]){await page.setViewportSize({width,height});await open(page);await page.screenshot({path:info.outputPath(`metal-mayhem-intro-${width}.png`)});await page.locator('#start').click();await expect(page.locator('#hud')).toBeVisible();await page.addStyleTag({content:'#controls{display:block!important}'});for(const id of ['pause','joystick','turnPad','attack','block','dodge','jump']){const r=await page.locator('#'+id).boundingBox();expect(r.x).toBeGreaterThanOrEqual(0);expect(r.y).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(width);expect(r.y+r.height).toBeLessThanOrEqual(height);}expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);await page.screenshot({path:info.outputPath(`metal-mayhem-play-${width}.png`)});}
});
test('Metal Mayhem bounded crowded renderer and context loss recovery',async({page},info)=>{await open(page);await page.locator('#start').click();await expect(page.locator('#hud')).toBeVisible();await page.evaluate(()=>{const s=__metalMayhem.state;s.queue=[];s.player.invulnerable=100;for(let i=0;i<12;i++){const e=MetalMayhem.actor(100+i,Object.keys(MetalMayhem.TYPES)[i%6],Math.sin(i)*10,Math.cos(i)*10,15);s.enemies.push(e);}});await page.waitForTimeout(600);const stats=await page.evaluate(()=>__metalMayhem.stats());console.log('Metal Mayhem crowded renderer:',stats);expect(stats.debris).toBeLessThanOrEqual(100);expect(stats.sparks).toBeLessThanOrEqual(180);expect(stats.drawCalls).toBeLessThan(1100);await page.screenshot({path:info.outputPath('metal-mayhem-crowded.png')});await page.evaluate(()=>document.getElementById('arenaCanvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true})));await expect(page.locator('#errorTitle')).toHaveText('Graphics were interrupted.');});

test('Metal Mayhem turn pad stays anchored and spins without tilting on touch',async({page},info)=>{
 test.skip(info.project.name!=='mobile-webkit','Mobile camera and viewport contract');
 await open(page);await page.locator('#start').click();await expect(page.locator('#controls')).toBeVisible();
 await page.evaluate(()=>{__metalMayhem.state.player.invulnerable=100;});
 const box=await page.locator('#turnPad').boundingBox();
 await page.mouse.move(box.x+box.width-12,box.y+box.height/2);await page.mouse.down();
 await expect.poll(()=>page.evaluate(()=>__metalMayhem.yaw),{timeout:10000}).toBeGreaterThan(Math.PI*2);
 await page.mouse.up();const yaw=await page.evaluate(()=>__metalMayhem.yaw);await page.waitForTimeout(150);
 expect(await page.evaluate(()=>__metalMayhem.yaw)).toBe(yaw);expect(await page.evaluate(()=>__metalMayhem.pitch)).toBe(.4);
 const after=await page.locator('#turnPad').boundingBox();expect(after).toEqual(box);
 expect(await page.evaluate(()=>({x:scrollX,y:scrollY,scale:visualViewport.scale}))).toEqual({x:0,y:0,scale:1});
 for(const id of ['attack','jump','block','dodge']){const a=await page.locator('#'+id).boundingBox();expect(box.y+box.height).toBeLessThan(a.y);}
 await page.screenshot({path:info.outputPath('metal-mayhem-steady-touch-controls.png')});
});

test('Metal Mayhem camera keeps the robot visible during fast wall and pylon turns',async({page},info)=>{
 await open(page);await page.locator('#start').click();await expect(page.locator('#hud')).toBeVisible();
 const failures=await page.evaluate(()=>{
  const s=__metalMayhem.state,v=__metalMayhem.view;s.player.invulnerable=100;s.enemies=[];s.queue=['blade'];s.spawnTimer=100;
  const failures=[];
  for(const [x,z] of [[0,17.7],[17.7,0],[-7,-3.95],[9.05,-6]]){
   s.player.x=x;s.player.z=z;
   for(let i=0;i<24;i++){
    v.render(s,1/60,i*1.3,.4);const c=v.camera.position,t={x,y:s.player.y+1.35,z};
    if(Math.hypot(c.x,c.z)>18.651)failures.push('outside wall');
    for(let j=0;j<=100;j++){const k=j/100,px=x+(c.x-x)*k,py=t.y+(c.y-t.y)*k,pz=z+(c.z-z)*k;if(py<4.2&&MetalMayhem.OBSTACLES.some(o=>Math.hypot(px-o.x,pz-o.z)<1.72))failures.push('blocked by pylon');}
   }
  }
  // The spectator decks must be outside the fighting area, including their inner vertices.
  v.scene.traverse(mesh=>{const attr=mesh.geometry?.attributes?.position;if(!attr)return;for(let i=0;i<attr.count;i++){const p=v.camera.position.clone().fromBufferAttribute(attr,i).applyMatrix4(mesh.matrixWorld),r=Math.hypot(p.x,p.z);if(r>14&&r<20&&p.y>3.3&&p.y<5.3)failures.push('overhanging arena deck');}});
  s.player.x=0;s.player.z=17.7;return failures;
 });
 expect(failures).toEqual([]);await page.screenshot({path:info.outputPath('metal-mayhem-clear-wall-camera.png')});
});
test('Metal Mayhem Jump then Strike starts an overhead attack',async({page})=>{
 await open(page);await page.locator('#start').click();await expect(page.locator('#hud')).toBeVisible();
 // Exercise the real Strike button on both projects, without entering desktop pointer lock.
 await page.addStyleTag({content:'#controls{display:block!important}'});
 const strike=await page.locator('#attack').boundingBox();await page.mouse.move(strike.x+strike.width/2,strike.y+strike.height/2);
 await page.evaluate(()=>{
  __metalMayhem.state.player.cooldown=0;__metalMayhem.state.player.invulnerable=100;window.firstChop=null;
  const observe=()=>{const p=__metalMayhem.state.player;if(p.attack)window.firstChop={mode:p.attack.mode,combo:p.combo,height:p.y};else requestAnimationFrame(observe);};requestAnimationFrame(observe);
 });
 await page.keyboard.down('Space');await expect.poll(()=>page.evaluate(()=>__metalMayhem.state.player.y)).toBeGreaterThan(.1);
 await page.mouse.down();await expect.poll(()=>page.evaluate(()=>window.firstChop?.mode)).toBe(2);
 expect(await page.evaluate(()=>window.firstChop.combo)).toBe(1);expect(await page.evaluate(()=>window.firstChop.height)).toBeGreaterThan(0);
 await page.mouse.up();await page.keyboard.up('Space');await page.locator('#pause').click();await expect(page.locator('#pauseScreen')).toBeVisible();
});


test('Metal Mayhem wider framing shows more arena and camera preference survives reload',async({page},info)=>{
 await open(page);await page.locator('#start').click();await expect(page.locator('#hud')).toBeVisible();
 expect(await page.evaluate(()=>__metalMayhem.view.cameraMode)).toBe('wide');
 for(const [width,height] of [[390,844],[844,390]]){
  await page.setViewportSize({width,height});
  const sizes=await page.evaluate(()=>{
   const {state:s,view:v}=__metalMayhem;s.player.x=0;s.player.z=0;s.player.invulnerable=100;s.enemies=[];s.queue=['blade'];s.spawnTimer=100;
   const sizes={};for(const mode of ['close','wide','far']){v.setCameraMode(mode);for(let i=0;i<100;i++)v.render(s,1/60,0,.4);const top=v.camera.position.clone().set(0,2.2,0).project(v.camera),foot=v.camera.position.clone().set(0,0,0).project(v.camera);sizes[mode]=Math.abs(top.y-foot.y);}
   v.setCameraMode('wide');for(let i=0;i<100;i++)v.render(s,1/60,0,.4);return sizes;
  });
  expect(sizes.wide).toBeLessThan(sizes.close*.8);expect(sizes.far).toBeLessThan(sizes.wide*.9);
  await page.screenshot({path:info.outputPath(`metal-mayhem-wide-${width}.png`)});
 }
 await page.locator('#pause').click();await page.locator('#cameraDistance').click();await expect(page.locator('#cameraDistance')).toHaveText('Camera: far');
 expect(await page.evaluate(()=>__metalMayhem.view.cameraMode)).toBe('far');await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('#start')).toBeEnabled({timeout:25000});
 expect(await page.evaluate(()=>__metalMayhem.view.cameraMode)).toBe('far');
});

test('Metal Mayhem shows attack windups and recognizable severed limbs with bounded cleanup',async({page},info)=>{
 await open(page);await page.locator('#start').click();await expect(page.locator('#hud')).toBeVisible();
 const result=await page.evaluate(()=>{
  const {state:s,view:v}=__metalMayhem;s.player.x=0;s.player.z=3;s.player.invulnerable=100;s.queue=['blade'];s.spawnTimer=100;
  const e=MetalMayhem.actor(800,'blade',0,0);e.cooldown=99;s.enemies=[e];v.render(s,1/60,0,.4);
  const m=v.models.get(e.id),idle=m.weapon.position.y;e.telegraph=.5;v.render(s,1/60,0,.4);
  const warning=m.attackZone.visible&&m.fan.material.opacity>.12,raised=m.weapon.position.y>idle+.2; e.telegraph=0;
  const source=[];m.parts.rightArm.traverse(x=>{if(x.isMesh)source.push(x.geometry.uuid);});
  s.events=[];MetalMayhem.damage(s,e,'rightArm',100,s.player,e);v.effects(s.events);v.render(s,1/60,0,.4);
  const arm=v.fragments.find(f=>f.part==='rightArm'),weapon=v.fragments.find(f=>f.part==='weapon');let detailed=0,valid=true,independent=true;
  arm.mesh.traverse(x=>{if(x.isMesh){detailed++;valid&&=!!x.material.isMaterial;independent&&=!source.includes(x.geometry.uuid);}});
  const removed=!m.parts.rightArm.visible&&!m.weapon.visible,detached=arm.mesh.visible&&!!weapon;
  // Many real damage events can arrive together. The rendered fragment pool must stay bounded.
  const events=s.events.slice();for(let i=0;i<35;i++)v.effects(events);v.render(s,1/60,0,.4);
  return {warning,raised,detailed,valid,independent,removed,detached,stats:v.stats()};
 });
 expect(result.warning).toBe(true);expect(result.raised).toBe(true);expect(result.detailed).toBeGreaterThan(1);expect(result.valid).toBe(true);expect(result.independent).toBe(true);expect(result.removed).toBe(true);expect(result.detached).toBe(true);
 expect(result.stats.fragments).toBeLessThanOrEqual(24);expect(result.stats.debris).toBeLessThanOrEqual(100);expect(result.stats.sparks).toBeLessThanOrEqual(180);expect(result.stats.drawCalls).toBeLessThan(1100);
 await page.screenshot({path:info.outputPath('metal-mayhem-severed-armor.png')});
 const cleaned=await page.evaluate(()=>{const {state:s,view:v}=__metalMayhem;for(let i=0;i<150;i++)v.render(s,1/30,0,.4);return v.stats().fragments;});expect(cleaned).toBe(0);
});
