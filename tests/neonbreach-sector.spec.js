const {test,expect}=require('@playwright/test');
for(const prefix of ['', '/www']){
test('Sector Run can be selected, completed, and replayed '+prefix,async({page,hasTouch})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto(prefix+'/neonbreach.html');
 await page.locator('#breachMode').selectOption('sector');
 await expect(page.locator('#arenaMessage')).toContainText('Find the key');
 await page.evaluate(()=>{const create=NeonBreachEngine.createSector;NeonBreachEngine.createSector=(...args)=>{const s=create(...args);window.sectorTest=s;return s}});
 await page.locator('#startButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:10000});
 await expect(page.locator('#breachMode')).toBeDisabled();
 await expect(page.locator('#sectorObjective')).toHaveText('Find the gold access key');
 await page.evaluate(()=>{sectorTest.enemies=[];sectorTest.player.x=5.5;sectorTest.player.y=11.5});
 await expect(page.locator('#breachWeapon')).toHaveText('Scattergun · 8 shells');
 const weapon=page.locator('#breachWeapon');
 if(hasTouch)await weapon.tap();else await weapon.click();
 await expect(weapon).toContainText('Carbine');
 if(!hasTouch){await page.keyboard.press('e');await expect(weapon).toHaveText('Scattergun · 8 shells');}
 await page.evaluate(()=>{sectorTest.player.x=3.5;sectorTest.player.y=2.5});
 await expect.poll(()=>page.evaluate(()=>sectorTest.key)).toBe(true);
 await expect(page.locator('#sectorObjective')).toHaveText('Open the gold door on your radar');
 await page.evaluate(()=>{sectorTest.player.x=7.4;sectorTest.player.y=13.5});
 await expect.poll(()=>page.evaluate(()=>sectorTest.doorOpen)).toBe(true);
 await expect(page.locator('#sectorObjective')).toContainText('Defeat the Sector Warden');
 await page.evaluate(()=>{sectorTest.player.x=sectorTest.exit.x;sectorTest.player.y=sectorTest.exit.y});
 await expect.poll(()=>page.evaluate(()=>sectorTest.ended)).toBe(false);
 await page.evaluate(()=>{sectorTest.enemies=sectorTest.enemies.filter(e=>e.boss);sectorTest.player.x=14.5;sectorTest.player.y=7.5;sectorTest.player.a=-Math.PI/2;for(let i=0;i<16;i++){sectorTest.cooldown=0;NeonBreachEngine.fire(sectorTest)}});
 await expect.poll(()=>page.evaluate(()=>sectorTest.bossDefeated)).toBe(true);
 await expect(page.locator('#sectorObjective')).toHaveText('Reach the green exit beacon');
 await page.evaluate(()=>{sectorTest.player.x=sectorTest.exit.x;sectorTest.player.y=sectorTest.exit.y});
 await expect(page.getByText('Sector Secured',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Play Again/i}).last().click();
 await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:10000});
 expect(await page.evaluate(()=>sectorTest.key)).toBe(false);
 expect(errors).toEqual([]);
});
test('Sector controls stay within a short phone '+prefix,async({page})=>{
 await page.setViewportSize({width:375,height:667});await page.goto(prefix+'/neonbreach.html');
 await page.locator('#breachMode').selectOption('sector');
 await page.locator('#startButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:10000});
 for(const id of ['game','movePad','fireButton']){
 const b=await page.locator('#'+id).boundingBox();expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(375);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.y+b.height).toBeLessThanOrEqual(667);
 }
 await page.screenshot({path:'test-results/neonbreach-sector-'+(prefix?'native':'web')+'.png'});
});
}
