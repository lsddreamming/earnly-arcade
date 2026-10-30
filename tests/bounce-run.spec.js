const {test,expect}=require('@playwright/test');
async function open(page,path='/mini.html?game=bounceRun'){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('arcadeOnboardingSeen','1');});
  await page.route('https://**',route=>route.abort());
  await page.route('**/bounce-run-engine.js',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:await response.text()+`;const originalBounceCreate=BounceRunEngine.create;BounceRunEngine.create=(...args)=>window.testBounce=originalBounceCreate(...args);`});
  });
  await page.goto(path);
  await page.evaluate(()=>{Arcade.countdown=fn=>fn();});
  await page.locator('#startButton').click();
  await page.waitForTimeout(2000);
  return errors;
}
for(const path of ['/mini.html?game=bounceRun','/www/mini.html?game=bounceRun']){
 test('Bounce Run one tap jumps, pauses safely, and preserves result rewards '+path,async({page})=>{
  const errors=await open(page,path);
  await page.evaluate(()=>{testBounce.state.wait=10000;});
  if(test.info().project.name==='mobile-webkit')await page.locator('#surface canvas').tap();
  else await page.locator('#surface canvas').click();
  await expect.poll(()=>page.evaluate(()=>testBounce.state.jumps)).toBe(1);
  await expect.poll(()=>page.evaluate(()=>testBounce.state.lands)).toBe(1);
  await page.keyboard.press('ArrowUp');
  await expect.poll(()=>page.evaluate(()=>testBounce.state.jumps)).toBe(2);
  await page.locator('#earnlyPauseButton').click();
  const ticks=await page.evaluate(()=>testBounce.state.ticks);
  await page.waitForTimeout(300);
  expect(await page.evaluate(()=>testBounce.state.ticks)).toBe(ticks);
  await page.getByRole('button',{name:/Resume/}).click();
  await expect.poll(()=>page.evaluate(()=>testBounce.state.ticks)).toBeGreaterThan(ticks);
  await page.evaluate(()=>{
    window.bounceAward=null;Arcade.earn=(amount,label,evidence)=>window.bounceAward={amount,label,evidence};
    Object.assign(testBounce.state,{y:349,vy:0,buffer:0,distance:430,obstacles:[{x:80,w:20,speed:1}]});
  });
  const dialog=page.locator('dialog.game-result-dialog');await expect(dialog).toBeVisible();
  expect(await page.evaluate(()=>bounceAward)).toEqual({amount:20,label:'Bounce Run',evidence:{kind:'game',game:'bounceRun',metric:430}});
  const stopped=await page.evaluate(()=>testBounce.state.ticks);await page.waitForTimeout(150);
  expect(await page.evaluate(()=>testBounce.state.ticks)).toBe(stopped);
  await dialog.getByRole('button',{name:/Play Again/}).click();
  await expect.poll(()=>page.evaluate(()=>testBounce.state.alive)).toBe(true);
  expect(await page.evaluate(()=>testBounce.state.cleared)).toBe(0);
  await page.locator('#earnlyQuitButton').click();
  await page.locator('.earnly-quit-dialog [data-quit]').click();
  await expect(page).toHaveURL(/games.html/);
  expect(errors).toEqual([]);
 });
}
for(const motion of ['reduce','no-preference'])test('Bounce Run landscape and reachable double preview '+motion,async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:motion});
 const errors=await open(page);
 await page.evaluate(()=>{
  Object.assign(testBounce.state,{cleared:12,distance:200,wait:10000});
  const w=BounceRunEngine.wave(12,()=>.1);testBounce.state.obstacles=w.obstacles.map(o=>({...o,x:o.x-140}));
 });
 await page.waitForTimeout(100);
 const canvas=page.locator('#surface canvas'),box=await canvas.boundingBox();
 expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(391);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:test.info().outputPath('bounce-run-'+motion+'.png')});
 expect(errors).toEqual([]);
});
