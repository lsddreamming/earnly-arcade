const {test,expect}=require('@playwright/test');
test.use({launchOptions:{args:process.env.METAL_MAYHEM_CHROMIUM_3D==='1'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]}});
test.setTimeout(120000);
async function open(page,prefix='/'){
 await page.route('**/functions/v1/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"PREVIEW_ONLY"}'}));
 await page.route('**/auth/v1/**',route=>route.abort());
 await page.goto(prefix+'metal-mayhem.html?qa=1',{waitUntil:'domcontentloaded'});
 await expect(page.locator('#start')).toBeEnabled({timeout:25000});
}
for(const prefix of ['/','/www/'])test(`Metal Mayhem real WebGL loads, moves, pauses and restarts ${prefix}`,async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page,prefix);await page.screenshot({path:info.outputPath('metal-mayhem-menu.png')});await page.locator('#start').click();await expect(page.locator('#hud')).toBeVisible();
 const start=await page.evaluate(()=>__metalMayhem.state.player.z);await page.keyboard.down('KeyW');await expect.poll(()=>page.evaluate(()=>__metalMayhem.state.player.z),{timeout:15000}).toBeLessThan(start-1);await page.keyboard.up('KeyW');
 await page.locator('#pause').click();const tick=await page.evaluate(()=>__metalMayhem.state.tick);await page.waitForTimeout(200);expect(await page.evaluate(()=>__metalMayhem.state.tick)).toBe(tick);await page.locator('#resume').click();await expect.poll(()=>page.evaluate(()=>__metalMayhem.state.tick)).toBeGreaterThan(tick);
 await page.locator('#pause').click();await page.locator('#restart').click();await expect(page.locator('#hud')).toBeVisible();expect(await page.evaluate(()=>__metalMayhem.state.wave)).toBe(1);await page.screenshot({path:info.outputPath('metal-mayhem-combat.png')});expect(errors).toEqual([]);
});
test('Metal Mayhem physical touch targets support joystick plus camera plus attack',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await open(page);await page.locator('#start').click();
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
 await open(page);await page.locator('#start').click();await page.evaluate(()=>{const s=__metalMayhem.state;s.queue=[];for(const e of s.enemies)e.alive=false;});await expect(page.locator('#upgradeChoices button')).toHaveCount(3);await page.screenshot({path:info.outputPath('metal-mayhem-upgrades.png')});await page.locator('#upgradeChoices button').first().click();await expect(page.locator('#upgradeScreen')).toBeHidden();expect(await page.evaluate(()=>__metalMayhem.state.wave)).toBe(2);
 await page.evaluate(()=>{const s=__metalMayhem.state;MetalMayhem.damage(s,s.player,'core',10000,{id:1,x:0,z:0},s.player);});
 // The actual frame loop must detect externally observed deaths as well as its own tick deaths.
 await expect(page.locator('#resultScreen')).toBeVisible();await expect(page.locator('#rewardStatus')).toContainText('Practice');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('earnly.metalMayhem.best.v1')).wave)).toBe(2);await page.locator('#replay').click();await expect(page.locator('#resultScreen')).toBeHidden();
});
test('Metal Mayhem layouts and controls fit portrait, landscape and narrow phones',async({page},info)=>{
 for(const [width,height]of [[320,568],[390,844],[844,390]]){await page.setViewportSize({width,height});await open(page);await page.screenshot({path:info.outputPath(`metal-mayhem-intro-${width}.png`)});await page.locator('#start').click();await page.addStyleTag({content:'#controls{display:block!important}'});for(const id of ['pause','joystick','attack','block','dodge','jump']){const r=await page.locator('#'+id).boundingBox();expect(r.x).toBeGreaterThanOrEqual(0);expect(r.y).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(width);expect(r.y+r.height).toBeLessThanOrEqual(height);}expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);await page.screenshot({path:info.outputPath(`metal-mayhem-play-${width}.png`)});}
});
test('Metal Mayhem bounded crowded renderer and context loss recovery',async({page},info)=>{await open(page);await page.locator('#start').click();await page.evaluate(()=>{const s=__metalMayhem.state;s.queue=[];s.player.invulnerable=100;for(let i=0;i<12;i++){const e=MetalMayhem.actor(100+i,Object.keys(MetalMayhem.TYPES)[i%6],Math.sin(i)*10,Math.cos(i)*10,15);s.enemies.push(e);}});await page.waitForTimeout(600);const stats=await page.evaluate(()=>__metalMayhem.stats());expect(stats.debris).toBeLessThanOrEqual(100);expect(stats.sparks).toBeLessThanOrEqual(180);expect(stats.drawCalls).toBeLessThan(1100);await page.screenshot({path:info.outputPath('metal-mayhem-crowded.png')});await page.evaluate(()=>document.getElementById('arenaCanvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true})));await expect(page.locator('#errorTitle')).toHaveText('Graphics were interrupted.');});
