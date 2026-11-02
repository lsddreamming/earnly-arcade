const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{
 await page.route('https://**',route=>route.abort());
 await page.addInitScript(()=>{localStorage.setItem('arcadeOnboardingSeen','1');localStorage.setItem('arcadeSound','off')});
 await page.goto('/colormatch.html');await page.clock.install();await page.clock.pauseAt(new Date('2026-11-02T14:00:00Z'));
});
async function start(page){await page.clock.runFor(10);await page.evaluate(()=>{Arcade.countdown=done=>done();startGame()});await expect(page.locator('#gameStatus')).toHaveText('Running')}
async function correct(page){const answer=await page.evaluate(()=>lastRound.ink);await page.locator('[data-color="'+answer+'"]').click();await page.clock.runFor(150)}
for(const path of ['/colormatch.html','/www/colormatch.html']){
 test('Prism run uses ink, holds feedback, and counts one point per prompt '+path,async({page})=>{
  await page.goto(path);await start(page);
  const answer=await page.evaluate(()=>lastRound.ink);
  await page.locator('[data-color="'+answer+'"]').click();
  await expect(page.locator('#score')).toHaveText('1');await expect(page.locator('#colorFeedback')).toContainText('Correct');
  expect(await page.evaluate(()=>answerLocked)).toBe(true);
  await page.locator('[data-color="'+answer+'"]').click();await expect(page.locator('#score')).toHaveText('1');
  await page.clock.runFor(150);expect(await page.evaluate(()=>answerLocked)).toBe(false);
  const expected=await page.evaluate(()=>answer);
  const wrong=await page.evaluate(()=>colors.find(c=>c[0]!==answer)[0]);
  await page.locator('[data-color="'+wrong+'"]').click();
  await expect(page.locator('#colorFeedback')).toContainText('Ink was '+expected);
  await expect(page.locator('[data-color="'+expected+'"]')).toHaveClass(/correct-flash/);
  await expect(page.locator('#score')).toHaveText('1');await expect(page.locator('#streak')).toHaveText('0');
 });
}
test('streak, stage and next reward progress preserve existing coin milestones',async({page})=>{
 await start(page);for(let i=0;i<8;i++)await correct(page);
 await expect(page.locator('#colorStage')).toContainText('Flow');await expect(page.locator('#streakLabel')).toHaveText('8 IN A ROW');
 expect(await page.evaluate(()=>({score,attempts,bestStreak,conflict:lastRound.word!==lastRound.ink}))).toEqual({score:8,attempts:8,bestStreak:8,conflict:true});
 expect(await page.evaluate(()=>[rewardFor(4),rewardFor(15),rewardFor(100)])).toEqual([4,20,88]);
 await expect(page.locator('#rewardPreview')).toHaveText('8');await expect(page.locator('#nextReward')).toContainText('12 matches');
});
test('pause freezes the countdown and the feedback transition',async({page})=>{
 await start(page);const answer=await page.evaluate(()=>lastRound.ink);await page.locator('[data-color="'+answer+'"]').click();
 await page.locator('#earnlyPauseButton').click();const before=await page.evaluate(()=>({word:wordEl.textContent,time:timeEl.textContent,score}));
 await page.clock.runFor(10000);expect(await page.evaluate(()=>({word:wordEl.textContent,time:timeEl.textContent,score}))).toEqual(before);
 await page.locator('#earnlyPauseButton').click();await page.clock.runFor(150);expect(await page.evaluate(()=>answerLocked)).toBe(false);
 await expect(page.locator('#time')).toHaveText('25');
});
test('deadline settles exactly once; replay resets accuracy, score, stages and streak',async({page})=>{
 await start(page);await correct(page);
 await page.evaluate(()=>{window.saves=0;const record=Arcade.recordResult;Arcade.recordResult=(...args)=>{window.saves++;return record(...args)}});
 await page.clock.runFor(25000);await expect(page.locator('dialog[open]')).toContainText('Correct Matches');
 expect(await page.evaluate(()=>saves)).toBe(1);await page.evaluate(()=>{choose('RED');finish();finish()});expect(await page.evaluate(()=>saves)).toBe(1);
 await expect(page.locator('dialog[open]')).toContainText('100% accuracy');
 await page.clock.resume();await page.locator('dialog[open]').getByRole('button',{name:/Play Again/}).click();
 await expect.poll(()=>page.evaluate(()=>({score,streak,attempts,bestStreak,stage:lastRound.stage.name,timeLeft}))).toEqual({score:0,streak:0,attempts:0,bestStreak:0,stage:'Focus',timeLeft:25});
});
test('keyboard shortcuts answer the displayed position and ignore held-key repeats',async({page})=>{
 await start(page);const key=String(await page.evaluate(()=>lastRound.position+1));
 await page.locator('body').press(key);await expect(page.locator('#score')).toHaveText('1');await page.clock.runFor(150);
 await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:String(lastRound.position+1),repeat:true,bubbles:true})));
 await expect(page.locator('#score')).toHaveText('1');
});
test('ready, live and paused layouts fit phone and landscape controls',async({page},testInfo)=>{
 for(const [width,height] of [[320,568],[390,664],[390,844],[440,956],[667,375],[844,390]]){
  await page.evaluate(()=>localStorage.clear());await page.setViewportSize({width,height});await page.goto('/colormatch.html');await start(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const board=await page.locator('#board').boundingBox(),choices=await page.locator('#choices').boundingBox(),quit=await page.locator('#colorMatchExit').boundingBox(),pause=await page.locator('#earnlyPauseButton').boundingBox();
  expect(choices.y).toBeGreaterThanOrEqual(0);expect(choices.y+choices.height).toBeLessThan(Math.min(quit.y,pause.y));expect(board.y+board.height).toBeLessThan(Math.min(quit.y,pause.y));
  await expect(page.locator('#earnlyQuitButton')).toHaveCount(0);
  await page.screenshot({path:testInfo.outputPath('color-match-'+width+'x'+height+'.png')});
  await page.locator('#earnlyPauseButton').click();await expect(page.locator('#colorMatchExit')).toBeVisible();
 }
});
test('Quit returns directly to Games and invalidates a pending countdown',async({page})=>{
 await page.evaluate(()=>{window.launch=null;Arcade.countdown=done=>{window.launch=done};startGame();quitColorRun();launch()});
 expect(await page.evaluate(()=>({running,starting}))).toEqual({running:false,starting:false});
 await page.reload();await start(page);await page.locator('#colorMatchExit').click();await page.locator('.earnly-quit-dialog [data-quit]').click();await expect(page).toHaveURL(/\/games.html$/);
});
