const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{
 await page.route('https://**',r=>r.abort());
 await page.addInitScript(()=>{localStorage.setItem('arcadeOnboardingSeen','1');localStorage.setItem('arcadeSound','off');});
});
for(const path of ['/safecracker.html','/www/safecracker.html']){
 test('Safe Cracker new reward climb and real two-pin vault '+path,async({page})=>{
  await page.goto(path);await page.clock.install();
  const first=await page.evaluate(()=>{
   reset();running=true;score=11;completedLocks=9;newTarget(performance.now());marker=targetX+targetW/2;attempt();attempt();
   return {score,pinStep,completedLocks,perfectPins,locked:roundLocked,cue:feedbackText,reward33:rewardFor(33),reward200:rewardFor(200)};
  });
  expect(first).toEqual({score:11,pinStep:1,completedLocks:9,perfectPins:1,locked:true,cue:'PERFECT · PIN 1 SET',reward33:14,reward200:100});
  await page.clock.runFor(225);
  const second=await page.evaluate(()=>{
   loop(performance.now());cancelAnimationFrame(animation);marker=targetX+targetW/2;attempt();attempt();
   return {score,completedLocks,pinStep,perfectPins,cue:feedbackText};
  });
  expect(second).toEqual({score:12,completedLocks:10,pinStep:0,perfectPins:2,cue:'VAULT BREACHED!'});
 });
 test('Safe Cracker deadline, double taps, repeated keys and settlement stay guarded '+path,async({page})=>{
  await page.goto(path);
  const state=await page.evaluate(()=>{
   localStorage.setItem('safeCrackerBest','80');reset();running=true;newTarget(performance.now());roundStartedAt=performance.now()-roundLimit;marker=targetX+targetW/2;attempt();attempt();
   const timeout={score,lives};
   reset();running=true;newTarget(performance.now());marker=targetX+targetW/2;
   document.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',repeat:true,bubbles:true}));
   const held=score;attempt();attempt();const duplicate=score;
   score=33;let awards=[],screens=[];Arcade.earn=(amount,label,evidence)=>awards.push({amount,evidence});Arcade.gameResult=x=>screens.push(x);finish();finish();
   return {timeout,held,duplicate,awards,best:Arcade.best('safeCracker').value,result:{score:screens[0].score,coins:screens[0].coins},settlements:screens.length};
  });
  expect(state.timeout).toEqual({score:0,lives:2});expect(state.held).toBe(0);expect(state.duplicate).toBe(1);
  expect(state.awards).toEqual([{amount:14,evidence:{kind:'game',game:'safeCracker',metric:33}}]);expect(state.best).toBe(80);expect(state.result).toEqual({score:33,coins:14});expect(state.settlements).toBe(1);
 });
}
test('Safe Cracker countdown starts a fresh round and pause freezes the pin clock',async({page})=>{
 await page.clock.install({time:new Date('2026-11-01T10:00:00Z')});
 await page.goto('/safecracker.html');await page.clock.pauseAt(new Date('2026-11-01T10:02:00Z'));
 await page.locator('#startButton').click();await page.clock.runFor(2300);
 await expect(page.locator('#gameStatus')).toHaveText('Running');
 expect(await page.evaluate(()=>performance.now()-roundStartedAt)).toBeLessThan(100);
 const before=await page.evaluate(()=>{document.getElementById('earnlyPauseButton').click();return {elapsed:performance.now()-roundStartedAt,lives,score};});
 await page.clock.runFor(10000);
 const after=await page.evaluate(()=>{
  const lifeBefore=lives;attempt();document.getElementById('earnlyPauseButton').click();
  return {elapsed:performance.now()-roundStartedAt,lives,score,lifeBefore,paused:document.body.classList.contains('earnly-game-paused')};
 });
 expect(after.elapsed).toBeCloseTo(before.elapsed,1);expect(after.lives).toBe(before.lives);expect(after.score).toBe(before.score);expect(after.paused).toBe(false);
});
test('Safe Cracker controls and vault artwork fit phones, landscape and desktop',async({page})=>{
 await page.goto('/safecracker.html');
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:440,height:956},{width:667,height:375},{width:1363,height:936},{width:1024,height:600}]){
  await page.setViewportSize(viewport);
  await expect(page.locator('#startButton')).toBeVisible();expect((await page.locator('#startButton').boundingBox()).y).toBeLessThan(340);
  await page.evaluate(()=>{
   reset();running=true;score=11;completedLocks=9;pinStep=1;newTarget(performance.now());marker=targetX+targetW/2;
   scoreEl.textContent=score;refreshReward();safeRoundTimer.textContent='3.2s to set this pin';safeTimerTrack.value=.8;setStatus('Running','running');draw();
  });
  await expect(page.locator('#earnlyPauseButton')).toBeInViewport();await expect(page.locator('#safeCrackerExit')).toBeInViewport();await expect(page.locator('#safeTapZone')).toBeInViewport();
  expect(await page.locator('#earnlyQuitButton').count()).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const board=await page.locator('#game').boundingBox(),tap=await page.locator('#safeTapZone').boundingBox();expect(board.width).toBeGreaterThan(130);expect(board.height).toBeGreaterThan(130);
  const overlap=board.x<tap.x+tap.width&&board.x+board.width>tap.x&&board.y<tap.y+tap.height&&board.y+board.height>tap.y;expect(overlap).toBe(false);
  await page.locator('#earnlyPauseButton').click();await expect(page.locator('#gameStatus')).toHaveText('Paused');await page.locator('#earnlyPauseButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running');
  await page.evaluate(()=>{cancelAnimationFrame(animation);animation=null;running=false;setStatus('Ready');});
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>reset());await page.screenshot({path:test.info().outputPath('safe-cracker-launch.png')});
 await page.evaluate(()=>{reset();running=true;completedLocks=19;score=23;pinStep=1;newTarget(performance.now());marker=targetX+targetW/2;scoreEl.textContent=score;refreshReward();setStatus('Running','running');draw();});
 await page.screenshot({path:test.info().outputPath('safe-cracker-phone-vault.png')});
});
