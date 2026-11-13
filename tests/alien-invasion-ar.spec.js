const {test,expect,chromium,devices}=require('@playwright/test');
test.describe('iPhone browser camera preview',()=>{
test.use({userAgent:devices['iPhone 14'].userAgent});
test('camera is requested only after Play and denied permission is recoverable',async({page})=>{
  await page.addInitScript(()=>{window.cameraRequests=0;Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>{window.cameraRequests++;throw new DOMException('denied','NotAllowedError');}},configurable:true});});
  await page.goto('/alien-invasion-ar.html');
  await expect(page.getByText('Camera demo · not spatial AR')).toBeVisible();
  expect(await page.evaluate(()=>window.cameraRequests)).toBe(0);
  await page.getByRole('button',{name:'Play with my camera'}).click();
  await expect(page.getByRole('heading',{name:'Camera needs attention'})).toBeVisible();
  await expect(page.getByText(/Camera permission was blocked/)).toBeVisible();
  expect(await page.evaluate(()=>window.cameraRequests)).toBe(1);
  await page.getByRole('button',{name:'Exit to start'}).click();
  await expect(page.getByRole('button',{name:'Play with my camera'})).toBeVisible();
});
});
for(const device of ['Desktop Chrome','iPad (gen 7)']){
  test(device+' cannot start the game or request camera access',async({browser})=>{
    const context=await browser.newContext({userAgent:devices[device].userAgent});
    const page=await context.newPage();
    try{
      await page.addInitScript(()=>{window.cameraRequests=0;Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>{window.cameraRequests++;throw new Error('Camera must remain unused');}},configurable:true});});
      await page.goto('http://127.0.0.1:4173/alien-invasion-ar.html');
      await expect(page.getByRole('heading',{name:'Bring your iPhone.'})).toBeVisible();
      await expect(page.getByRole('button',{name:'Play with my camera'})).toBeHidden();
      await page.keyboard.press('Space');
      expect(await page.evaluate(()=>window.cameraRequests)).toBe(0);
      expect(await page.locator('video').evaluate(v=>v.srcObject)).toBeNull();
    }finally{await context.close();}
  });
}
test('real media API with Chromium synthetic device: portals, fire, switch, pause, restart and stop tracks',async({},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop-chromium','Chromium fake camera is a CI device, not physical iPhone validation');
  const browser=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  const context=await browser.newContext({userAgent:devices['iPhone 14'].userAgent,viewport:{width:390,height:844},permissions:['camera']});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const requests=[];page.on('request',r=>requests.push({url:r.url(),method:r.method()}));
  try{
    await page.goto('http://127.0.0.1:4173/alien-invasion-ar.html');await page.getByRole('button',{name:'Play with my camera'}).click();
    await expect(page.getByText('Tap a doorway, window or wall to mark a portal')).toBeVisible();
    expect(await page.locator('video').evaluate(v=>v.srcObject.getVideoTracks()[0].readyState)).toBe('live');
    await page.locator('#scene').click({position:{x:195,y:320}});await page.getByRole('button',{name:'Defend · 1 portal'}).click();
    await expect(page.getByRole('button',{name:'Hold to fire'})).toBeVisible();
    await page.getByRole('button',{name:'Hold to fire'}).click();await expect(page.locator('#ammo')).toHaveText('23 / 24');
    // Wait for the first real animation-loop spawn, then defeat it through the canvas.
    await page.waitForTimeout(900);
    await page.locator('#scene').click({position:{x:195,y:325}});
    await page.waitForTimeout(200);
    await page.locator('#scene').click({position:{x:195,y:325}});
    await expect(page.locator('#stats')).toContainText('1 KILLS');
    await page.locator('#weapon').click();await expect(page.locator('#weaponName')).toHaveText('Alien Zapper ⇄');
    await page.getByRole('button',{name:'Pause game'}).click();await expect(page.getByRole('heading',{name:'Invasion paused'})).toBeVisible();
    await page.getByRole('button',{name:'Resume',exact:true}).click();
    await page.getByRole('button',{name:'Pause game'}).click();await page.getByRole('button',{name:'Restart waves'}).click();await expect(page.locator('#ammo')).toHaveText('24 / 24');
    await page.waitForTimeout(1200);
    await page.screenshot({path:testInfo.outputPath('alien-camera-gameplay.png')});
    await page.evaluate(()=>window.trackForTest=document.getElementById('camera').srcObject.getVideoTracks()[0]);
    await page.getByRole('button',{name:'Exit game',exact:true}).click();expect(await page.evaluate(()=>window.trackForTest.readyState)).toBe('ended');
    expect(errors).toEqual([]);expect(requests.filter(r=>r.method!=='GET')).toEqual([]);
  }finally{await browser.close();}
});
