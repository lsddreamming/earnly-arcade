const {test,expect}=require('@playwright/test');
for(const path of ['/coincatch.html','/www/coincatch.html']){
 test('Coin Catch Sky Vault relative drag, pause and device medals '+path,async({page})=>{
  await page.route('https://**',r=>r.abort());
  await page.addInitScript(()=>localStorage.setItem('arcadeOnboardingSeen','1'));
  await page.goto(path);
  await expect(page.locator('#catchGoalName')).toHaveText('First Spark');
  const state=await page.evaluate(()=>{
   reset();running=true;setStatus('Running','running');
   const rect=canvas.getBoundingClientRect(),before=basket.x;
   const pointer=(type,x)=>canvas.dispatchEvent(new PointerEvent(type,{pointerId:111,pointerType:'touch',isPrimary:true,bubbles:true,cancelable:true,clientX:x,clientY:rect.top+100}));
   pointer('pointerdown',rect.right-8);const touched=basket.x;
   pointer('pointermove',rect.right-48);const moved=basket.x;
   pointer('pointerup',rect.right-48);
   document.body.classList.add('earnly-game-paused');
   document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));const paused=basket.x;
   document.body.classList.remove('earnly-game-paused');
   return {before,touched,moved,paused,expected:before-40*canvas.width/rect.width};
  });
  expect(state.touched).toBe(state.before);expect(state.moved).toBeCloseTo(state.expected,3);expect(state.paused).toBe(state.moved);
  const medals=await page.evaluate(()=>{
   let earned=0;Arcade.earn=()=>earned++;Arcade.gameResult=()=>{};
   runOwner=medalOwner();score=10;bestStreak=5;finish();
   const p=Rules.load(localStorage,medalOwner());refreshJourney();return {p,earned};
  });
  expect(medals.p).toEqual({score:10,streak:5,runs:1});expect(medals.earned).toBe(1);
  await expect(page.locator('#catchGoalName')).toHaveText('Gold Gatherer');
  await page.reload();await expect(page.locator('#catchGoalName')).toHaveText('Gold Gatherer');
  await page.evaluate(()=>{localStorage.setItem('earnlyLocalProgressOwner','another-account');refreshJourney();});
  await expect(page.locator('#catchGoalName')).toHaveText('First Spark');
 });
 test('Coin Catch Sky Vault launch and live phone preview '+path,async({page})=>{
  await page.route('https://**',r=>r.abort());await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>localStorage.setItem('arcadeOnboardingSeen','1'));await page.goto(path);
  await page.screenshot({path:test.info().outputPath('coin-catch-sky-vault-launch.png')});
  await page.evaluate(()=>{
   reset();running=true;score=28;streak=12;bestStreak=12;level=3;misses=1;
   scoreEl.textContent=score;levelEl.textContent=level;missesEl.textContent=misses;refreshReward();refreshChase();setStatus('Running','running');
   drops=[{x:62,y:90,r:12,speed:4,bomb:false},{x:270,y:160,r:13,speed:4,bomb:true},{x:145,y:265,r:12,speed:4,bomb:false}];rimBurst(180);draw();showLiveTip('Swipe anywhere · Catch coins · Avoid bombs',60000);
  });
  await expect(page.locator('#catchChase')).toBeVisible();await expect(page.locator('#catchCombo')).toHaveText('Streak 12 / 15');
  await expect(page.locator('#coinCatchExit')).toBeInViewport();
  await page.screenshot({path:test.info().outputPath('coin-catch-sky-vault-live.png')});
 });
}
