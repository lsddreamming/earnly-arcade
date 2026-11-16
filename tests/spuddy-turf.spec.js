const {test,expect}=require('@playwright/test');
async function frozenClock(page){
  // install() alone still follows real time between runFor calls and input/screenshot work.
  await page.clock.install({time:new Date('2026-01-01T00:00:00Z')});
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
}
async function practice(page){await page.goto('/spuddy-turf.html');await page.locator('[data-mode="practice"]').click();await page.locator('#start').click();await expect(page.locator('#status')).toHaveText('SAFE AT HOME');}
test('phone onboarding fits without a nested scrollbar and pad has 44px targets',async({page},info)=>{for(const width of [320,390,440]){await page.setViewportSize({width,height:844});await page.goto('/spuddy-turf.html');await expect(page.locator('#start')).toBeInViewport();expect(await page.locator('#intro').evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);for(const button of await page.locator('[data-dir]').all()){const r=await button.boundingBox();expect(r.width).toBeGreaterThanOrEqual(44);expect(r.height).toBeGreaterThanOrEqual(44);}await page.screenshot({path:info.outputPath('spuddy-turf-'+width+'.png')});}});
test('practice starts, pauses without advancing, resumes and offers one results screen',async({page},info)=>{const errors=[];page.on('pageerror',e=>errors.push(e.message));await practice(page);await expect(page.locator('#time')).not.toHaveText('3:00');await page.locator('#pause').click();await expect(page.locator('#pausePanel')).toBeVisible();const clock=await page.locator('#time').innerText();await page.waitForTimeout(500);await expect(page.locator('#time')).toHaveText(clock);await page.locator('#resume').click();await expect(page.locator('#pausePanel')).toBeHidden();await page.locator('[data-dir="1"]').click();await expect(page.locator('#time')).not.toHaveText(clock);await page.locator('#pause').click();await page.locator('#quit').click();await expect(page.locator('#result')).toBeVisible();await expect(page.locator('#pausePanel')).toBeHidden();await expect(page.locator('#reason')).toContainText('Match ended');await page.locator('#replay').click();await expect(page.locator('#result')).toBeHidden();await expect(page.locator('#status')).toHaveText('SAFE AT HOME');await page.locator('#pause').click();await page.screenshot({path:info.outputPath('spuddy-turf-paused.png')});expect(errors).toEqual([]);});
test('swipe input and background pause remain usable',async({page})=>{await practice(page);const box=await page.locator('#turf').boundingBox();await page.mouse.move(box.x+120,box.y+100);await page.mouse.down();await page.mouse.move(box.x+120,box.y+160);await page.mouse.up();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await expect(page.locator('#pausePanel')).toBeVisible();await page.locator('#resume').click();await expect(page.locator('#pausePanel')).toBeHidden();await expect(page.locator('#time')).not.toHaveText('3:00');});
test('landscape keeps canvas and pause controls accessible',async({page},info)=>{await page.setViewportSize({width:844,height:390});await practice(page);await expect(page.locator('#pause')).toBeInViewport();await expect(page.locator('#turf')).toBeInViewport();await page.locator('#pause').click();await expect(page.locator('#resume')).toBeInViewport();await page.screenshot({path:info.outputPath('spuddy-turf-landscape.png')});});
test('catalog search finds the free solo game',async({page})=>{await page.goto('/games.html');await page.locator('[data-filter=all]').click();const card=page.locator('[data-game="spuddyTurf"]');await expect(card).toBeVisible();await expect(card.locator('a[href="spuddy-turf.html"]')).toBeVisible();});
test('keyboard closes a real loop and banks coverage in the result',async({page},info)=>{await frozenClock(page);await page.goto('/spuddy-turf.html');await page.locator('[data-mode="practice"]').click();await page.locator('#start').click();await expect(page.locator('#status')).toHaveText('Get ready');await page.clock.fastForward(2100);await expect(page.locator('#status')).toHaveText('SAFE AT HOME');await page.clock.runFor(1440);await page.keyboard.press('ArrowDown');await page.clock.runFor(1260);await page.keyboard.press('ArrowLeft');await page.clock.runFor(1440);await page.keyboard.press('ArrowUp');await page.clock.runFor(1260);await page.screenshot({path:info.outputPath('spuddy-turf-active-capture.png')});await page.locator('#pause').click();const patch=parseFloat(await page.locator('#land').innerText());expect(patch).toBeGreaterThan(4);await page.screenshot({path:info.outputPath('spuddy-turf-claimed.png')});await page.locator('#quit').click();expect(parseFloat(await page.locator('#resultLand').innerText())).toBeGreaterThan(4);await expect(page.locator('#best')).toContainText('1 loop closed');});
test('sound preference persists and modes keep separate local bests',async({page})=>{await page.goto('/spuddy-turf.html');await page.locator('#sound').click();await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','true');await page.reload();await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','true');await practice(page);await page.locator('#pause').click();await page.locator('#quit').click();await expect(page.locator('#best')).toContainText('Practice best:');await page.locator('#modes').click();await page.locator('[data-mode="classic"]').click();await page.locator('#start').click();await page.locator('#pause').click();await page.locator('#quit').click();await expect(page.locator('#best')).toContainText('Battle best:');});

test('active controls fit completely in short desktop and phone viewports',async({page})=>{for(const [width,height]of [[1280,720],[390,667],[320,568]]){await page.setViewportSize({width,height});await practice(page);for(const selector of ['#pause','[data-dir=\"0\"]','[data-dir=\"1\"]','[data-dir=\"2\"]','[data-dir=\"3\"]']){const b=await page.locator(selector).boundingBox();expect(b.y).toBeGreaterThanOrEqual(0);expect(b.y+b.height).toBeLessThanOrEqual(height);}await page.locator('#pause').click();}});

test('countdown uses elapsed time after a delayed frame and preserves paused time',async({page})=>{
  await frozenClock(page);await page.goto('/spuddy-turf.html');
  await page.locator('[data-mode="practice"]').click();await page.locator('#start').click();
  await expect(page.locator('#status')).toHaveText('Get ready');
  await page.clock.fastForward(2100);
  await expect(page.locator('#status')).toHaveText('SAFE AT HOME');
  await expect(page.locator('#time')).toHaveText('3:00');
  await page.locator('#pause').click();await page.locator('#quit').click();await page.locator('#modes').click();
  await expect(page.locator('.public-footer')).toBeVisible();
  await page.locator('#start').click();await page.clock.runFor(500);await page.locator('#pause').click();
  await page.clock.fastForward(10000);await page.locator('#resume').click();
  await expect(page.locator('#pausePanel')).toBeHidden();
  await page.clock.runFor(500);await expect(page.locator('#status')).toHaveText('Get ready');
  await page.clock.fastForward(1100);await expect(page.locator('#status')).toHaveText('SAFE AT HOME');
  await expect(page.locator('.public-footer')).toBeHidden();
});


test('live Turf trail cues point toward owned land, pause safely and keep phone controls accessible',async({page},info)=>{
 await frozenClock(page);
 await page.setViewportSize({width:390,height:844});
 await page.goto('/spuddy-turf.html');
 await expect(page.locator('#trailGuide')).toContainText('Leave blue land');
 await page.locator('[data-mode="practice"]').click();
 await page.locator('#start').click();
 await expect(page.locator('#status')).toHaveText('Get ready');
 await page.clock.fastForward(2100);
 await expect(page.locator('#status')).toHaveText('SAFE AT HOME');
 await page.clock.runFor(1250);
 await expect(page.locator('#status')).toHaveText('TRAIL EXPOSED');
 await expect(page.locator('#trailGuide')).toContainText('Blue land');
 await expect(page.locator('#arena')).toHaveClass(/trail-exposed/);
 await page.screenshot({path:info.outputPath('spuddy-turf-trail-guide.png')});
 const pad=await page.locator('.dpad').boundingBox();
 const pause=await page.locator('#pause').boundingBox();
 expect(pad.y+pad.height).toBeLessThanOrEqual(844);
 expect(pause.y+pause.height).toBeLessThanOrEqual(844);
 await page.locator('#pause').click();
 await expect(page.locator('#status')).toHaveText('Paused');
 const frozen=await page.locator('#trailGuide').innerText();
 await page.clock.fastForward(5000);
 await expect(page.locator('#trailGuide')).toHaveText(frozen);
 await page.locator('#resume').click();
 await expect(page.locator('#pausePanel')).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
