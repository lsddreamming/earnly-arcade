const {test,expect}=require('@playwright/test');
async function open(page,path='/stardefender.html',motion='no-preference'){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:motion});
 await page.addInitScript(()=>localStorage.setItem('arcadeOnboardingSeen','1'));
 await page.route('https://**',r=>r.abort());
 await page.route('**/stardefender.html*',async route=>{
   const response=await route.fetch(),html=(await response.text()).replace('    function finish(finalize=false)',`    window.starTest={
     state:()=>({elapsed,score,kills,lives,wave,shipX,rapid,shield,bosses,paused,running,particles:particles.length,rings:rings.length,scorePops:scorePops.length,bullets:bullets.length,shots:enemyShots.length,aliens:aliens.map(a=>({...a}))}),
     freeze:()=>{cancelAnimationFrame(raf);raf=0;},
     tick:n=>{for(let i=0;i<n&&running;i++)move(1/60);draw();},
     boss:()=>{wave=3;aliens=[];nextWaveIn=0;move(1/60);draw();},
     kill:(prior=0)=>{kills=prior;score=prior*10;aliens=[{x:165,anchor:165,y:120,hp:1,maxHp:1,phase:0,color:'#ff69c8'}];bullets=[{x:165,y:120},{x:165,y:120},{x:165,y:120}];move(1/60);draw();},
     hit:()=>{invincible=0;enemyShots=[{x:shipX,y:shipY-1,vx:0}];move(1/60);draw();},
     end:()=>{score=320;kills=20;wave=4;bosses=1;finish(true);},
     expire:()=>{elapsed=44.99;move(1/60);},
     finalize:()=>finish(true)
   };
    function finish(finalize=false)`);
   await route.fulfill({response,body:html});
 });
 await page.goto(path);await expect(page.locator('#starHangar')).toBeVisible();
 await expect(page.locator('#startButton')).toBeVisible();
 expect((await page.locator('#startButton').boundingBox()).y).toBeLessThan(340);
 await page.evaluate(()=>{Arcade.countdown=fn=>fn();});
 await page.locator('#startButton').click();
 await expect(page.locator('#gameStatus')).toHaveText('Running');
 return errors;
}
for(const path of ['/stardefender.html','/www/stardefender.html'])test('Star Defender saves flight goals, cosmetic colors and one unchanged reward '+path,async({page})=>{
 const errors=await open(page,path);await expect(page.locator('#starHangar')).toBeHidden();
 await page.evaluate(()=>{starTest.freeze();window.starAwards=[];Arcade.earn=(...args)=>starAwards.push(args);starTest.end();starTest.finalize();});
 await expect(page.locator('dialog.game-result-dialog')).toBeVisible();
 await expect(page.locator('.result-outcome')).toContainText('Solar');
 await expect(page.locator('.star-flight-report')).toContainText('20Defeated4Wave');
 await expect(page.locator('.star-result-unlock')).toContainText('Nova color · 55 more defeats');
 expect(await page.evaluate(()=>starAwards)).toEqual([[16,'Star Defender',{kind:'game',game:'starDefender',metric:320,aux:20}]]);
 await page.screenshot({path:test.info().outputPath('star-defender-flight-result.png')});
 await page.getByRole('button',{name:'Ship colors & flight log',exact:true}).click();
 await expect(page.locator('dialog.game-result-dialog')).toBeHidden();
 await expect(page.locator('#starHangar')).toBeVisible();await expect(page.locator('#starGoalHeading')).toContainText('3/3 complete');
 const solar=page.getByRole('button',{name:'Solar ship',exact:true});await expect(solar).toBeEnabled();await solar.click();await expect(solar).toHaveAttribute('aria-pressed','true');
 await page.reload();await expect(page.getByRole('button',{name:'Solar ship',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.evaluate(()=>localStorage.setItem('earnlyLocalProgressOwner','different-test-player'));
 await page.getByRole('button',{name:'Solar ship',exact:true}).click();
 await expect(page.locator('#starUnlock')).toContainText('0/20');await page.reload();
 await expect(page.locator('#starGoalHeading')).toContainText('0/3 complete');await expect(page.locator('#starUnlock')).toContainText('0/20');
 expect(errors).toEqual([]);
});
test('Star Defender boosts, shields and commander are real combat states',async({page})=>{
 const errors=await open(page);await page.evaluate(()=>{starTest.freeze();starTest.kill(4);});
 let s=await page.evaluate(()=>starTest.state());expect(s.kills).toBe(5);expect(s.score).toBe(50);expect(s.rapid).toBeGreaterThan(4.9);
 // Three overlapping bullets must award this one enemy only once.
 expect(s.aliens).toHaveLength(0);
 await page.evaluate(()=>{starTest.kill(9);starTest.hit();});s=await page.evaluate(()=>starTest.state());expect(s.lives).toBe(3);expect(s.shield).toBe(0);
 await page.evaluate(()=>starTest.hit());expect((await page.evaluate(()=>starTest.state())).lives).toBe(2);
 await page.evaluate(()=>starTest.boss());s=await page.evaluate(()=>starTest.state());expect(s.wave).toBe(4);expect(s.aliens[0].boss).toBe(true);expect(s.aliens[0].hp).toBe(12);
 await page.screenshot({path:test.info().outputPath('star-defender-commander.png')});
 expect(errors).toEqual([]);
});
test('Star Defender pause freezes the run, timer settles once, replay clears boosts',async({page})=>{
 const errors=await open(page);await page.locator('#earnlyPauseButton').click();
 const before=await page.evaluate(()=>starTest.state());await page.waitForTimeout(250);await page.keyboard.press('ArrowLeft');
 const after=await page.evaluate(()=>starTest.state());expect(after.elapsed).toBe(before.elapsed);expect(after.shipX).toBe(before.shipX);
 await page.getByRole('button',{name:/Resume/}).click();
 await page.evaluate(()=>{starTest.freeze();window.starAwards=0;Arcade.earn=()=>starAwards++;starTest.expire();starTest.finalize();});
 expect(await page.evaluate(()=>starAwards)).toBe(1);
 await page.locator('dialog.game-result-dialog').getByRole('button',{name:/Play Again/}).click();
 const s=await page.evaluate(()=>starTest.state());expect(s.score).toBe(0);expect(s.shield).toBe(0);expect(s.rapid).toBe(0);expect(s.lives).toBe(3);
 expect(errors).toEqual([]);
});
for(const motion of ['reduce','no-preference'])test('Star Defender phone combat and hangar preview '+motion,async({page})=>{
 await page.setViewportSize({width:390,height:740});const errors=await open(page,'/stardefender.html',motion);
 await page.evaluate(()=>{starTest.freeze();starTest.kill(4);starTest.boss();});
 const box=await page.locator('#game').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(390);
 const quit=await page.locator('#earnlyQuitButton').boundingBox();expect(quit.y+quit.height).toBeLessThanOrEqual(741);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await expect(page.locator('#earnlyCompactLeaderboard')).toBeHidden();
 const effects=await page.evaluate(()=>starTest.state());
 expect(effects.rings).toBeLessThanOrEqual(12);expect(effects.scorePops).toBeLessThanOrEqual(8);
 if(motion==='reduce'){expect(effects.particles).toBe(0);expect(effects.rings).toBe(0);expect(effects.scorePops).toBe(0);}else{expect(effects.rings).toBeGreaterThan(0);expect(effects.scorePops).toBeGreaterThan(0);}
 await page.screenshot({path:test.info().outputPath('star-defender-phone-'+motion+'.png')});
 await page.evaluate(()=>starTest.end());await page.reload();
 const hangar=await page.locator('#starHangar').boundingBox();expect(hangar.height).toBeLessThan(350);
 await expect(page.locator('#starFlightDetails')).not.toHaveAttribute('open','');
 await page.locator('#starGoalHeading').click();await expect(page.locator('#starGoals')).toBeVisible();
 await page.screenshot({path:test.info().outputPath('star-defender-hangar-'+motion+'.png')});
 expect(errors).toEqual([]);
});
