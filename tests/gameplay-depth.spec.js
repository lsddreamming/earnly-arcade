const {test,expect}=require('@playwright/test');

async function open(page,path,{countdown=false}={}){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-11-13T12:00:00Z')});
  await page.route('https://**',r=>r.abort());
  await page.route('**/cloud.js',r=>r.fulfill({contentType:'text/javascript',body:'window.EarnlyCloud={ready:true,session:async()=>null};'}));
  await page.addInitScript(()=>{localStorage.setItem('arcadeOnboardingSeen','1');localStorage.setItem('arcadeSound','off');});
  await page.goto(path);
  await page.clock.pauseAt(new Date('2026-11-13T12:02:00Z'));
  if(!countdown)await page.evaluate(()=>{Arcade.countdown=fn=>fn();});
  await page.locator('#startButton').click();
  if(!countdown)await page.clock.runFor(50);
  return errors;
}
async function correct(page){
  const name=await page.locator('.fit-shape').getAttribute('data-base');
  return page.locator('.fit-answer[data-base="'+name+'"]');
}
async function checkFits(page,selectors){
  const result=await page.evaluate(selectors=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,boxes:selectors.flatMap(q=>[...document.querySelectorAll(q)].map(el=>{const r=el.getBoundingClientRect();return {q,x:r.x,y:r.y,w:r.width,h:r.height};}))}),selectors);
  expect(result.scrollWidth).toBeLessThanOrEqual(result.width+1);
  for(const r of result.boxes){expect(r.w,r.q).toBeGreaterThan(0);expect(r.x,r.q).toBeGreaterThanOrEqual(-1);expect(r.y,r.q).toBeGreaterThanOrEqual(-1);expect(r.x+r.w,r.q).toBeLessThanOrEqual(result.width+1);expect(r.y+r.h,r.q).toBeLessThanOrEqual(result.height+1);}
  return result.boxes;
}

for(const prefix of ['/','/www/']){
  test('Shape Fit freezes timers and delayed answers, settles once and replays '+prefix,async({page})=>{
    const errors=await open(page,prefix+'mini.html?game=shapeFit');
    await (await correct(page)).evaluate(el=>{el.click();el.click();});
    await expect(page.locator('#score')).toHaveText('1');
    await page.locator('#earnlyPauseButton').click();await page.clock.runFor(20000);
    await expect(page.locator('.fit-wrap')).toHaveAttribute('data-round','1');
    await page.getByRole('button',{name:/Resume/}).click();await page.clock.runFor(200);
    await expect(page.locator('.fit-wrap')).toHaveAttribute('data-round','1');
    await page.clock.runFor(250);await expect(page.locator('.fit-wrap')).toHaveAttribute('data-round','2');
    await page.clock.runFor(1000);const time=await page.locator('.fit-clock span').textContent();
    await page.evaluate(()=>document.dispatchEvent(new Event('pause')));
    const plays=await page.locator('#plays').textContent();
    await page.clock.runFor(30000);await expect(page.locator('.fit-clock span')).toHaveText(time);
    await (await correct(page)).evaluate(el=>el.click());await page.keyboard.press('1');await expect(page.locator('#score')).toHaveText('1');
    await page.evaluate(()=>document.dispatchEvent(new Event('resume')));await expect(page.locator('body')).toHaveClass(/earnly-game-paused/);
    await page.getByRole('button',{name:/Resume/}).click();await page.clock.runFor(100);await expect(page.locator('#plays')).toHaveText(plays);
    const after=parseFloat(await page.locator('.fit-clock span').textContent());expect(after).toBeGreaterThan(parseFloat(time)-.3);
    await page.evaluate(()=>{window.depthAwards=[];Arcade.earn=(amount,label,evidence)=>depthAwards.push({amount,evidence});});
    for(let life=2;life>=0;life--){
      const name=await page.locator('.fit-shape').getAttribute('data-base');
      await page.locator('.fit-answer:not([data-base="'+name+'"])').first().evaluate(el=>{el.click();el.click();});
      await expect(page.locator('.fit-stage small')).toContainText(life+' of 3 lives');
      await expect(page.locator('.fit-answer.correct')).toHaveCount(1);await expect(page.locator('.fit-wrap')).toHaveClass(/fit-miss/);
      await page.clock.runFor(700);
    }
    const dialog=page.locator('dialog.game-result-dialog');await expect(dialog).toBeVisible();
    expect(await page.evaluate(()=>depthAwards)).toEqual([{amount:await page.evaluate(()=>Arcade.gameReward('shapeFit',1)),evidence:{kind:'game',game:'shapeFit',metric:1}}]);
    await page.clock.runFor(20000);expect(await page.evaluate(()=>depthAwards.length)).toBe(1);
    await dialog.getByRole('button',{name:/Play Again/}).click();await page.clock.runFor(50);
    await expect(page.locator('#score')).toHaveText('0');await expect(page.locator('.fit-stage small')).toContainText('3 of 3 lives');expect(errors).toEqual([]);
  });
  test('Lane Runner steering, interrupted gestures and play time survive pause '+prefix,async({page})=>{
    const errors=await open(page,prefix+'lanerunner.html');
    await page.getByRole('button',{name:'Move left',exact:true}).click();await expect(page.locator('#lanePosition')).toHaveText('LEFT LANE');
    await page.keyboard.press('ArrowRight');await expect(page.locator('#lanePosition')).toHaveText('CENTER LANE');
    await page.evaluate(()=>document.querySelector('#game').dispatchEvent(new PointerEvent('pointerdown',{pointerId:7,isPrimary:true,clientX:100,clientY:100,pointerType:'touch',button:0,bubbles:true,cancelable:true})));
    await page.evaluate(()=>document.dispatchEvent(new Event('pause')));
    const before=await page.locator('#time').textContent();await page.clock.runFor(30000);
    await page.getByRole('button',{name:'Move right',exact:true}).evaluate(el=>el.click());
    await page.keyboard.press('ArrowRight');await expect(page.locator('#lanePosition')).toHaveText('CENTER LANE');await expect(page.locator('#time')).toHaveText(before);
    await page.getByRole('button',{name:/Resume/}).click();
    await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointermove',{pointerId:7,clientX:200,clientY:100,bubbles:true,cancelable:true})));
    await expect(page.locator('#lanePosition')).toHaveText('CENTER LANE');await page.clock.runFor(1000);
    expect(Number(await page.locator('#time').textContent())).toBe(Number(before)+1);
    await expect(page.locator('#plays')).toHaveText('2');expect(errors).toEqual([]);
  });
  for(const game of ['lanerunner.html','mini.html?game=shapeFit'])test('Countdown interruption starts paused without a second play '+prefix+game,async({page})=>{
    const errors=await open(page,prefix+game,{countdown:true});
    await page.evaluate(()=>document.dispatchEvent(new Event('pause')));await page.clock.runFor(3500);
    await expect(page.locator('body')).toHaveClass(/earnly-game-paused/);await expect(page.locator('#plays')).toHaveText('2');
    await page.getByRole('button',{name:/Resume/}).click();await page.clock.runFor(100);await expect(page.locator('body')).not.toHaveClass(/earnly-game-paused/);expect(errors).toEqual([]);
  });
}

test('Shape Fit eight choices fit phones and landscape; keyboard and urgency stay readable',async({page})=>{
  const errors=await open(page,'/mini.html?game=shapeFit');
  for(let round=1;round<14;round++){
    const name=await page.locator('.fit-shape').getAttribute('data-base');
    const shortcut=await page.locator('.fit-answer[data-base="'+name+'"]').getAttribute('aria-keyshortcuts');
    await page.keyboard.press(shortcut);await expect(page.locator('#score')).toHaveText(String(round));
    await expect(page.locator('.fit-wrap')).toHaveClass(/fit-success/);await page.clock.runFor(400);
    await expect(page.locator('.fit-wrap')).toHaveAttribute('data-round',String(round+1));
  }
  await expect(page.locator('.fit-stage strong')).toHaveText('Quick Match');await expect(page.locator('.fit-answer')).toHaveCount(8);
  await page.clock.runFor(2500);await expect(page.locator('.fit-title')).toHaveClass(/urgent/);
  await page.locator('#earnlyPauseButton').click();
  for(const size of [{width:320,height:568},{width:390,height:844},{width:440,height:956},{width:844,height:390}]){
    await page.setViewportSize(size);await page.clock.runFor(50);
    const boxes=await checkFits(page,['.fit-shape','.fit-answer','#earnlyPauseButton','#earnlyQuitButton']);
    const dock=boxes.filter(b=>b.q.startsWith('#'));for(const b of boxes.filter(b=>b.q==='.fit-answer')){expect(b.h).toBeGreaterThanOrEqual(44);expect(b.w).toBeGreaterThanOrEqual(44);expect(b.y+b.h).toBeLessThan(Math.min(...dock.map(b=>b.y)));}
    expect(await page.locator('.fit-answers').evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1);
    await page.screenshot({path:test.info().outputPath('gameplay-depth-shape-'+size.width+'.png')});
  }
  expect(errors).toEqual([]);
});
test('Lane Runner perspective road and steering fit phones and landscape',async({page})=>{
  const errors=await open(page,'/lanerunner.html');
  await page.evaluate(()=>{obstacles=[{lane:0,y:180,speed:4,variant:2},{lane:2,y:300,speed:4,variant:3}];draw();});
  await page.locator('#earnlyPauseButton').click();
  for(const size of [{width:320,height:568},{width:390,height:844},{width:440,height:956},{width:844,height:390}]){
    await page.setViewportSize(size);await page.clock.runFor(50);
    const boxes=await checkFits(page,['#game','#laneLeft','#laneRight','#earnlyPauseButton','#earnlyQuitButton']);
    expect(boxes[0].h).toBeGreaterThan(250);for(const b of boxes.slice(1)){expect(b.w).toBeGreaterThanOrEqual(44);expect(b.h).toBeGreaterThanOrEqual(44);}
    await page.screenshot({path:test.info().outputPath('gameplay-depth-lane-'+size.width+'.png')});
  }
  expect(errors).toEqual([]);
});
