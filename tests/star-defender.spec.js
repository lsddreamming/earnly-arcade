const {test,expect}=require('@playwright/test');
async function open(page,path='/stardefender.html',motion='no-preference'){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:motion});
 await page.addInitScript(()=>localStorage.setItem('arcadeOnboardingSeen','1'));
 await page.route('https://**',r=>r.abort());
 await page.route('**/stardefender.html*',async route=>{
   const response=await route.fetch(),html=(await response.text()).replace('    function finish(finalize=false)',`    window.starTest={
     state:()=>({elapsed,score,kills,lives,wave,shipX,rapid,shield,bosses,paused,running,pointer,starting,layout:scene.layout(),particles:particles.length,rings:rings.length,scorePops:scorePops.length,bullets:bullets.length,shots:enemyShots.length,aliens:aliens.map(a=>({...a}))}),
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
 // Game readiness is the parsed DOM plus visible controls; optional resources can delay load in WebKit.
 await page.goto(path,{waitUntil:'domcontentloaded'});await expect(page.locator('#starHangar')).toBeVisible();
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
 await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('#starHangar')).toBeVisible();await expect(page.getByRole('button',{name:'Solar ship',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.evaluate(()=>localStorage.setItem('earnlyLocalProgressOwner','different-test-player'));
 await page.getByRole('button',{name:'Solar ship',exact:true}).click();
 await expect(page.locator('#starUnlock')).toContainText('0/20');await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('#starHangar')).toBeVisible();
 await expect(page.locator('#starGoalHeading')).toContainText('0/3 complete');await expect(page.locator('#starUnlock')).toContainText('0/20');
 expect(errors).toEqual([]);
});

for(const viewport of [{width:320,height:568},{width:390,height:844},{width:440,height:956},{width:844,height:390}])test('Star Defender fills the viewport and keeps controls readable '+viewport.width+'x'+viewport.height,async({page})=>{
 await page.setViewportSize(viewport);const errors=await open(page);
 await page.locator('#earnlyPauseButton').click();
 const state=await page.evaluate(()=>starTest.state());
 const before=state.elapsed;
 const layout=await page.evaluate(()=>{
   const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
   return {board:rect(document.querySelector('#game')),header:rect(document.querySelector('.page-header')),mission:rect(document.querySelector('#starMission')),controls:rect(document.querySelector('#starControls')),buttons:['#earnlyPauseButton','#earnlyQuitButton'].map(s=>rect(document.querySelector(s))),stats:[...document.querySelectorAll('.game-meta .meta-pill:not(.star-plays)')].map(e=>({font:parseFloat(getComputedStyle(e).fontSize),width:e.clientWidth,scroll:e.scrollWidth})),pixels:[game.width,game.height],dpr:devicePixelRatio,overflow:document.documentElement.scrollWidth};
 });
 expect(layout.board.x).toBe(0);expect(layout.board.y).toBe(0);expect(layout.board.width).toBe(viewport.width);expect(layout.board.height).toBe(viewport.height);
 expect(layout.overflow).toBeLessThanOrEqual(viewport.width);
 for(const button of layout.buttons){expect(button.width).toBeGreaterThanOrEqual(44);expect(button.height).toBeGreaterThanOrEqual(44);expect(button.x).toBeGreaterThanOrEqual(0);expect(button.right).toBeLessThanOrEqual(viewport.width);expect(button.bottom).toBeLessThanOrEqual(viewport.height);}
 for(const stat of layout.stats){expect(stat.font).toBeGreaterThanOrEqual(11);expect(stat.scroll).toBeLessThanOrEqual(stat.width+1);}
 expect(layout.mission.y).toBeGreaterThanOrEqual(layout.header.bottom-3);
 expect(state.layout.y).toBeGreaterThan(layout.mission.bottom);expect(state.layout.y+state.layout.h).toBeLessThan(layout.controls.y);
 expect(layout.pixels[0]).toBe(Math.round(viewport.width*Math.min(2,layout.dpr)));expect(layout.pixels[1]).toBe(Math.round(viewport.height*Math.min(2,layout.dpr)));
 await page.waitForTimeout(150);expect((await page.evaluate(()=>starTest.state())).elapsed).toBe(before);
 await page.screenshot({path:test.info().outputPath('star-defender-immersive-'+viewport.width+'.png')});
 await page.getByRole('button',{name:/Resume/}).click();await expect(page.locator('#gameStatus')).toHaveText('Running');
 await page.keyboard.down('ArrowLeft');await page.waitForTimeout(100);await page.keyboard.up('ArrowLeft');
 expect((await page.evaluate(()=>starTest.state())).shipX).toBeLessThan(state.shipX);
 await page.locator('#earnlyQuitButton').click();await expect(page).toHaveURL(/games\.html/);expect(errors).toEqual([]);
});

test('Star Defender relative drag stays one-to-one after rotation and ignores canceled pointers',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);await page.evaluate(()=>starTest.freeze());
 let state=await page.evaluate(()=>starTest.state());
 await page.mouse.move(300,450);await page.mouse.down();
 expect((await page.evaluate(()=>starTest.state())).shipX).toBe(state.shipX);
 await page.mouse.move(340,450);
 let moved=await page.evaluate(()=>starTest.state());
 expect((moved.shipX-state.shipX)*state.layout.sx).toBeCloseTo(40,1);
 await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointercancel',{pointerId:starTest.state().pointer,bubbles:true})));
 await page.mouse.move(360,450);expect((await page.evaluate(()=>starTest.state())).shipX).toBe(moved.shipX);await page.mouse.up();
 await page.setViewportSize({width:844,height:390});
 await expect.poll(async()=> (await page.evaluate(()=>starTest.state())).layout.width).toBe(844);
 state=await page.evaluate(()=>starTest.state());await page.mouse.move(450,200);await page.mouse.down();await page.mouse.move(420,200);await page.mouse.up();
 moved=await page.evaluate(()=>starTest.state());expect((moved.shipX-state.shipX)*state.layout.sx).toBeCloseTo(-30,1);
});

test('Star Defender pauses on interruption during combat and countdown',async({page})=>{
 await open(page);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
 await expect(page.locator('#gameStatus')).toHaveText('Paused');const before=await page.evaluate(()=>starTest.state());
 await page.waitForTimeout(150);expect((await page.evaluate(()=>starTest.state())).elapsed).toBe(before.elapsed);
 await page.getByRole('button',{name:/Resume/}).click();await expect(page.locator('#gameStatus')).toHaveText('Running');
 await page.evaluate(()=>{starTest.end();Arcade.countdown=fn=>{window.pendingStarCountdown=fn};});
 await page.locator('dialog.game-result-dialog').getByRole('button',{name:/Play Again/}).click();
 await expect(page.locator('#gameStatus')).toHaveText('Get Ready');
 await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));pendingStarCountdown();});
 await expect(page.locator('#gameStatus')).toHaveText('Paused');
 const pausedState=await page.evaluate(()=>starTest.state());expect(pausedState.elapsed).toBe(0);expect(pausedState.running).toBe(true);
 await page.getByRole('button',{name:/Resume/}).click();await expect(page.locator('#gameStatus')).toHaveText('Running');
});

test('Star Defender rendering and cache assets match the native mirror',async({request})=>{
 for(const file of ['stardefender.html','star-defender.css','star-defender-scene.js','star-defender-flight.js','service-worker.js']){
  const [root,native]=await Promise.all([request.get('/'+file),request.get('/www/'+file)]);expect(root.ok()).toBe(true);expect(native.ok()).toBe(true);expect(await native.text(),file).toBe(await root.text());
 }
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
 await page.evaluate(()=>starTest.end());await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('#starHangar')).toBeVisible();
 const hangar=await page.locator('#starHangar').boundingBox();expect(hangar.height).toBeLessThan(350);
 await expect(page.locator('#starFlightDetails')).not.toHaveAttribute('open','');
 await page.locator('#starGoalHeading').click();await expect(page.locator('#starGoals')).toBeVisible();
 await page.screenshot({path:test.info().outputPath('star-defender-hangar-'+motion+'.png')});
 expect(errors).toEqual([]);
});
