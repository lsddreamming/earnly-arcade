const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{
 await page.route('https://**',r=>r.abort());
 await page.addInitScript(()=>{localStorage.setItem('arcadeOnboardingSeen','1');localStorage.setItem('arcadeSound','off');});
});
for(const prefix of ['', '/www']){
 test('Lifetime earned stays independent from purchases and furniture spending '+prefix,async({page})=>{
  await page.addInitScript(()=>{if(localStorage.getItem('lifetimePoints')===null){localStorage.setItem('points','5000');localStorage.setItem('lifetimePoints','1000');}});
  await page.goto(prefix+'/rewards.html');
  await expect(page.locator('#lifetimeEarned')).toHaveText('1,000');
  await expect(page.locator('#balance')).toHaveText('5,000');
  await page.evaluate(()=>{Arcade.applyServerWallet({balance:'4500',lifetime_earned:'1000'});Arcade.repairLifetimeCounters();});
  await expect(page.locator('#lifetimeEarned')).toHaveText('1,000');
  await expect(page.locator('#balance')).toHaveText('4,500');
  await page.evaluate(()=>Arcade.applyServerWallet({balance:'9500',lifetime_earned:'1000'}));
  await expect(page.locator('#lifetimeEarned')).toHaveText('1,000');
  await page.evaluate(()=>Arcade.applyServerWallet({balance:'9510',lifetime_earned:'1010'}));
  await expect(page.locator('#lifetimeEarned')).toHaveText('1,010');
  await page.reload();await expect(page.locator('#lifetimeEarned')).toHaveText('1,010');
  expect(await page.evaluate(()=>Arcade.dailyCoinStatus().lifetime)).toBe(1010);
 });
}
test('Wallet refresh respects zero earnings and partial responses without mixing accounts',async({page})=>{
 await page.goto('/rewards.html');
 await page.evaluate(()=>Arcade.applyServerWallet({balance:'6000',lifetime_earned:'0'}));
 await expect(page.locator('#lifetimeEarned')).toHaveText('0');
 await page.evaluate(()=>{Arcade.applyServerWallet({balance:'200',lifetime_earned:'40'});Arcade.applyServerWallet({balance:'150'});});
 await expect(page.locator('#lifetimeEarned')).toHaveText('40');
 await page.evaluate(()=>Arcade.applyServerWallet({balance:'100',lifetime_earned:'5'}));
 await expect(page.locator('#lifetimeEarned')).toHaveText('5');
});
test('Tower Stack rewards continue through and beyond the reported 33-floor run',async({page})=>{
 await page.setViewportSize({width:320,height:568});await page.goto('/towerstack.html');
 await page.evaluate(()=>{localStorage.setItem('towerStackBest','46');Arcade.countdown=fn=>fn();});
 if(await page.locator('#startButton').isVisible())await page.locator('#startButton').click();else await page.locator('#game').click();
 await expect(page.locator('#gameStatus')).toHaveText('Running');
 await page.evaluate(async()=>{for(let i=0;i<33;i++){moving.x=blocks[blocks.length-1].x;canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',isPrimary:true,bubbles:true,cancelable:true}));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}});
 await expect(page.locator('#floors')).toHaveText('33');
 await expect(page.locator('#rewardPreview')).toHaveText('16');
 await expect(page.locator('#rewardTarget')).toHaveText('Next floor Coin at floor 36');
 await page.evaluate(async()=>{for(let i=0;i<3;i++){moving.x=blocks[blocks.length-1].x;canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerType:'touch',isPrimary:true,bubbles:true,cancelable:true}));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}});
 await expect(page.locator('#rewardPreview')).toHaveText('17');
 const control=await page.locator('#earnlyPauseButton').boundingBox();expect(control.y+control.height).toBeLessThanOrEqual(568);
 await page.evaluate(()=>finishGame());
 await expect(page.locator('.result-stat').first()).toContainText('+17');
 expect(await page.evaluate(()=>localStorage.getItem('towerStackBest'))).toBe('46');
});
