const {test,expect}=require('@playwright/test');
async function open(page,path='/mini.html?game=bounceRun'){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('arcadeOnboardingSeen','1');});
  await page.route('https://**',route=>route.abort());
  await page.route('**/bounce-run-engine.js',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:await response.text()+`;const originalBounceCreate=BounceRunEngine.create;BounceRunEngine.create=(...args)=>{
      const engine=originalBounceCreate(...args);
      // Isolate controls/rewards from random waves before the first frame.
      // Actual generated-wave reachability is covered by test-bounce-run.cjs.
      engine.state.wait=Number.MAX_SAFE_INTEGER;
      window.testBounce=engine;
      return engine;
    };`});
  });
  await page.goto(path);
  await page.evaluate(()=>{Arcade.countdown=fn=>fn();});
  const start=page.locator('#startButton');
  if(await start.isVisible())await start.click();
  else await page.locator('#surface').tap({position:{x:120,y:120}});
  await expect(page.locator('#surface canvas')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.testBounce?.state.ticks||0)).toBeGreaterThan(0);
  return errors;
}
for(const path of ['/mini.html?game=bounceRun','/www/mini.html?game=bounceRun']){
 test('Bounce Run one tap jumps, pauses safely, and preserves result rewards '+path,async({page})=>{
  const errors=await open(page,path);
  expect(await page.evaluate(()=>testBounce.state.alive)).toBe(true);
  expect(await page.evaluate(()=>testBounce.state.jumps)).toBe(0);
  if(test.info().project.name==='mobile-webkit')await page.locator('#surface canvas').tap();
  else await page.locator('#surface canvas').click();
  await expect.poll(()=>page.evaluate(()=>testBounce.state.jumps)).toBe(1);
  await expect.poll(()=>page.evaluate(()=>testBounce.state.lands)).toBe(1);
  await page.keyboard.press('ArrowUp');
  await expect.poll(()=>page.evaluate(()=>testBounce.state.jumps)).toBe(2);
  await page.locator('#earnlyPauseButton').click();
  const ticks=await page.evaluate(()=>testBounce.state.ticks);
  const travel=await page.evaluate(()=>testBounce.state.travel);
  await page.waitForTimeout(300);
  expect(await page.evaluate(()=>testBounce.state.ticks)).toBe(ticks);
  expect(await page.evaluate(()=>testBounce.state.travel)).toBe(travel);
  await page.getByRole('button',{name:/Resume/}).click();
  await expect.poll(()=>page.evaluate(()=>testBounce.state.ticks)).toBeGreaterThan(ticks);
  await expect(page.locator('dialog.game-result-dialog')).toBeHidden();
  expect(await page.evaluate(()=>testBounce.state.alive)).toBe(true);
  await page.evaluate(()=>{
    window.bounceAward=null;Arcade.earn=(amount,label,evidence)=>window.bounceAward={amount,label,evidence};
    Object.assign(testBounce.state,{y:349,vy:0,buffer:0,distance:430,obstacles:[{x:80,w:20,speed:1}]});
  });
  const dialog=page.locator('dialog.game-result-dialog');await expect(dialog).toBeVisible();
  await expect(dialog.locator('.result-tip')).toContainText('A close pair takes one jump');
  await expect(dialog.locator('.result-outcome')).not.toBeEmpty();
  expect(await page.evaluate(()=>bounceAward)).toEqual({amount:20,label:'Bounce Run',evidence:{kind:'game',game:'bounceRun',metric:430}});
  const stopped=await page.evaluate(()=>testBounce.state.ticks);await page.waitForTimeout(150);
  expect(await page.evaluate(()=>testBounce.state.ticks)).toBe(stopped);
  await dialog.getByRole('button',{name:/Play Again/}).click();
  await expect.poll(()=>page.evaluate(()=>testBounce.state.alive)).toBe(true);
  expect(await page.evaluate(()=>testBounce.state.cleared)).toBe(0);
  expect(await page.evaluate(()=>testBounce.state.travel)).toBeLessThan(10);
  await page.locator('#earnlyQuitButton').click();
  await page.locator('.earnly-quit-dialog [data-quit]').click();
  await expect(page).toHaveURL(/games.html/);
  expect(errors).toEqual([]);
 });
}
for(const path of ['/mini.html?game=bounceRun','/www/mini.html?game=bounceRun']){
 test('Bounce Run cleared crystal remains drawn behind the ball '+path,async({page})=>{
  const errors=await open(page,path);
  await page.evaluate(()=>{
    Object.assign(testBounce.state,{y:250,vy:0,obstacles:[{x:51,w:20,speed:2}],wait:10000});
    const step=testBounce.step;let cleared=false;
    testBounce.step=()=>{if(!cleared){step();cleared=testBounce.state.cleared===1;}};
  });
  await expect.poll(()=>page.evaluate(()=>testBounce.state.cleared)).toBe(1);
  expect(await page.evaluate(()=>{
    const o=testBounce.state.obstacles[0];
    if(!o?.passed)return false;
    const pixels=document.querySelector('#surface canvas').getContext('2d').getImageData(0,340,150,1).data;
    let red=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>pixels[i+1]*1.5&&pixels[i]>pixels[i+2])red++;
    return o.x+o.w<70&&red>=o.w*.6;
  })).toBe(true);
  await page.screenshot({path:test.info().outputPath('bounce-run-passed-crystal.png')});
  expect(errors).toEqual([]);
 });
}
for(const motion of ['reduce','no-preference'])test('Bounce Run rolling and track follow course travel '+motion,async({page})=>{
 await page.emulateMedia({reducedMotion:motion});
 const errors=await open(page);
 await page.evaluate(()=>{testBounce.step=()=>{};Object.assign(testBounce.state,{travel:0,y:349,vy:0});});
 await page.waitForTimeout(100);
 const sample=()=>page.evaluate(()=>{
   const ctx=document.querySelector('#surface canvas').getContext('2d');
   return {track:Array.from(ctx.getImageData(0,360,360,16).data),ball:Array.from(ctx.getImageData(70,335,8,8).data)};
 });
 const before=await sample();
 await page.evaluate(()=>{testBounce.state.travel=11;});await page.waitForTimeout(100);
 const after=await sample();
 if(motion==='reduce')expect(after).toEqual(before);
 else{expect(after.track).not.toEqual(before.track);expect(after.ball).not.toEqual(before.ball);}
 await page.screenshot({path:test.info().outputPath('bounce-run-rolling-'+motion+'.png')});
 expect(errors).toEqual([]);
});
for(const motion of ['reduce','no-preference'])test('Bounce Run leap travels forward while course HUD stays steady '+motion,async({page})=>{
 await page.emulateMedia({reducedMotion:motion});
 const errors=await open(page);
 await page.evaluate(()=>{testBounce.step=()=>{};Object.assign(testBounce.state,{travel:0,y:349,vy:0,obstacles:[]});});
 await page.waitForTimeout(100);
 const sample=()=>page.evaluate(()=>{
   const ctx=document.querySelector('#surface canvas').getContext('2d'),pixels=ctx.getImageData(40,190,120,165).data;
   let total=0,x=0,y=0;
   for(let i=0;i<pixels.length;i+=4){
     const [r,g,b]=pixels.slice(i,i+3);
     if(r>210&&g>100&&g<200&&b<120){total++;x+=40+(i/4)%120;y+=190+Math.floor(i/4/120);}
   }
   return {x:x/total,y:y/total,total,hud:Array.from(ctx.getImageData(14,14,182,60).data)};
 });
 const grounded=await sample();expect(grounded.total).toBeGreaterThan(15);
 await page.screenshot({path:test.info().outputPath('bounce-run-camera-ground-'+motion+'.png')});
 await page.evaluate(()=>{testBounce.state.y=259;});await page.waitForTimeout(100);
 const airborne=await sample();expect(airborne.total).toBeGreaterThan(15);
 expect(grounded.y-airborne.y).toBeGreaterThan(80);
 if(motion==='reduce')expect(Math.abs(airborne.x-grounded.x)).toBeLessThan(2);
 else expect(airborne.x-grounded.x).toBeGreaterThan(15);
 expect(airborne.hud).toEqual(grounded.hud);
 await page.screenshot({path:test.info().outputPath('bounce-run-camera-leap-'+motion+'.png')});
 expect(errors).toEqual([]);
});
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

for(const height of [640,740])test('Bounce Run phone controls stay below the jump area at '+height,async({page})=>{
 await page.setViewportSize({width:390,height});
 const errors=await open(page);
 const jump=page.locator('.bounce-tap-zone');
 const pause=page.locator('.bounce-session-controls #earnlyPauseButton');
 const quit=page.locator('.bounce-session-controls #earnlyQuitButton');
 await expect(jump).toBeVisible();await expect(pause).toBeVisible();await expect(quit).toBeVisible();
 expect(await jump.evaluate(el=>getComputedStyle(el).webkitUserSelect||getComputedStyle(el).userSelect)).toBe('none');
 if(test.info().project.name==='mobile-webkit')expect(await jump.locator('small').evaluate(el=>getComputedStyle(el).webkitTouchCallout)).toBe('none');
 expect(await jump.evaluate(el=>{
   const menu=new Event('contextmenu',{bubbles:true,cancelable:true});el.dispatchEvent(menu);return menu.defaultPrevented;
 })).toBe(true);
 const j=await jump.boundingBox(),p=await pause.boundingBox(),q=await quit.boundingBox();
 expect(p.y).toBeGreaterThanOrEqual(j.y+j.height+4);
 expect(q.y).toBeGreaterThanOrEqual(j.y+j.height+4);
 expect(p.y+p.height).toBeLessThanOrEqual(height);
 expect(q.x).toBeGreaterThanOrEqual(p.x+p.width+4);
 await expect(page.locator('#earnlyCompactLeaderboard')).toBeHidden();
 await pause.click();await page.getByRole('button',{name:/Resume/}).click();
 await page.screenshot({path:test.info().outputPath('bounce-run-phone-'+height+'.png')});
 expect(errors).toEqual([]);
});

