const {test,expect}=require('@playwright/test');
const fs=require('fs');
const E=require('../neondrift-engine.js');
const seeded=seed=>()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);

test('Neon Drift handles 1000 seeded drives with bounded traffic, valid scores and frozen endings',()=>{
  let crashes=0,finishes=0;
  for(let seed=1;seed<=1000;seed++){
    const s=E.create(seeded(seed));
    for(let i=0;i<1900&&!s.ended;i++){
      const target=E.road(s.distance+55)+Math.sin(i/35+seed)*65;
      const input=Math.max(-1,Math.min(1,(target-s.x)*.05-s.vx*.008));
      E.tick(s,.05,input);
      if(!Number.isFinite(s.x)||!Number.isFinite(s.score)||s.traffic.length>16||s.hull<0||s.score<0)throw Error('Invalid run '+seed);
    }
    expect(s.ended).toBe(true);if(s.hull===0)crashes++;else finishes++;
    const before=JSON.stringify(s);E.tick(s,.1,1);expect(JSON.stringify(s)).toBe(before);
  }
  expect(crashes).toBeGreaterThan(0);console.log('Neon Drift simulations: 1000 runs, '+crashes+' wrecks, '+finishes+' finishes');
});
test('Neon Drift collision cooldown and near-miss scoring cannot award twice',()=>{
 const s=E.create(()=>.5);s.traffic=[{z:0,lane:0,speed:0,passed:false,close:Infinity,color:0}];E.tick(s,.05);expect(s.hull).toBe(2);E.tick(s,.05);expect(s.hull).toBe(2);expect(s.nearMisses).toBe(0);
 const n=E.create(()=>.5);n.x=E.road(0)+40;n.traffic=[{z:0,lane:0,speed:0,passed:false,close:Infinity,color:0}];for(let i=0;i<12;i++)E.tick(n,.05);expect(n.hull).toBe(3);expect(n.nearMisses).toBe(1);expect(n.combo).toBe(2);expect(n.score).toBeGreaterThanOrEqual(120);for(let i=0;i<10;i++)E.tick(n,.05);expect(n.nearMisses).toBe(1);
});
test('Neon Drift steering has controllable inertia and later sectors add traffic and tighter bends',()=>{
 const s=E.create();E.tick(s,.1,1);expect(s.vx).toBeGreaterThan(0);const moving=s.vx;E.tick(s,.1,0);expect(s.vx).toBeLessThan(moving);expect(s.vx).toBeGreaterThan(0);for(let i=0;i<20;i++)E.tick(s,.05,-1);expect(s.vx).toBeLessThan(0);
 const easy=E.difficulty(0),hard=E.difficulty(80);expect(hard.speed).toBeGreaterThan(easy.speed);expect(hard.halfWidth).toBeLessThan(easy.halfWidth);expect(hard.interval).toBeLessThan(easy.interval);expect(hard.pairs).toBe(true);
 const run=E.create(seeded(5));run.time=60;for(let i=0;i<250;i++){run.hurt=2;E.tick(run,.05);const groups=new Map();for(const c of run.traffic){const key=Math.round((c.z-c.speed*(run.time-60))*100);groups.set(key,(groups.get(key)||0)+1);}expect(run.traffic.length).toBeLessThanOrEqual(12);}
});
test('Neon Drift web assets and 1.1 mirror stay identical',()=>{for(const file of ['neondrift.html','neondrift.css','neondrift.js','neondrift-engine.js','neondrift-renderer.js'])expect(fs.readFileSync('www/'+file,'utf8')).toBe(fs.readFileSync(file,'utf8'));});

test.beforeEach(async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.addInitScript(()=>{localStorage.setItem('arcadeSound','off');localStorage.setItem('arcadeOnboardingSeen','1');});
});
async function ready(page){await page.goto('/neondrift.html');await page.locator('#startButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:10000});}

test('Neon Drift replaces Block Grid throughout the catalog and preserves old saves',async({page})=>{
 await page.goto('/games.html');await page.locator('#gameSearch').fill('Neon Drift');await expect(page.locator('#games a[href="neondrift.html"]')).toBeVisible();await page.locator('#gameSearch').fill('Block Grid');await expect(page.locator('#games a.game-card')).toHaveCount(0);
 await page.goto('/neondrift.html');const data=await page.evaluate(()=>{localStorage.setItem('blockGridBest','900');localStorage.setItem('blockGridGamesPlayed','2');return {old:Arcade.snapshotData().data.blockGridBest,oldPlays:Arcade.snapshotData().data.blockGridGamesPlayed,newBest:Arcade.best('neonDrift').value,newPlays:Arcade.remaining('neonDrift')};});expect(data).toEqual({old:'900',oldPlays:'2',newBest:0,newPlays:3});
 for(const prefix of ['','/www']){await page.goto(prefix+'/mini.html?game=blockGrid');await expect(page).toHaveURL(new RegExp(prefix+'/neondrift.html'));await expect(page.locator('#plays')).toHaveText('3');}
});
test('Neon Drift pauses, resumes from steering and confirms quit without spending another play',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);await expect(page.locator('#plays')).toHaveText('2');await page.locator('#earnlyPauseButton').click();await expect(page.locator('#gameStatus')).toHaveText('Paused');const score=await page.locator('#score').textContent();await page.waitForTimeout(400);await expect(page.locator('#score')).toHaveText(score);
 await page.locator('#leftButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running');await expect(page.locator('#plays')).toHaveText('2');await page.locator('#earnlyQuitButton').click();await expect(page.locator('.earnly-quit-dialog')).toBeVisible();await page.getByRole('button',{name:'Keep Playing',exact:true}).click();await expect(page.locator('#gameStatus')).toHaveText('Running');await page.locator('#earnlyQuitButton').click();await page.getByRole('button',{name:'Quit Game',exact:true}).click();await expect(page).toHaveURL(/games.html/);expect(errors).toEqual([]);
});
test('Neon Drift controls release on pointer cancellation and background pause',async({page})=>{
 await ready(page);const button=page.locator('#rightButton'),box=await button.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await expect(button).toHaveClass(/held/);await button.dispatchEvent('pointercancel',{pointerId:1});await expect(button).not.toHaveClass(/held/);await page.mouse.up();await page.keyboard.down('ArrowLeft');await expect(page.locator('#leftButton')).toHaveClass(/held/);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await expect(page.locator('#gameStatus')).toHaveText('Paused');await expect(page.locator('#leftButton')).not.toHaveClass(/held/);await page.keyboard.up('ArrowLeft');
});
test('Neon Drift awards a run once and replay costs one play',async({page})=>{
 await page.goto('/neondrift.html');await page.evaluate(()=>{const original=NeonDriftEngine.create;NeonDriftEngine.create=()=>{const s=original();s.time=89.99;s.points=400;NeonDriftEngine.create=original;return s;};});await page.locator('#startButton').click();await expect(page.locator('dialog.game-result-dialog')).toBeVisible({timeout:10000});await expect(page.locator('#balance')).toHaveText('4');await page.waitForTimeout(300);await expect(page.locator('#balance')).toHaveText('4');await page.locator('dialog').getByRole('button',{name:/Play Again/}).click();await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:10000});await expect(page.locator('#plays')).toHaveText('1');
});
test('Neon Drift refuses a start with no plays',async({page})=>{
 await page.goto('/neondrift.html');await page.evaluate(async()=>{for(let i=0;i<3;i++){Arcade.consume('neonDrift');await new Promise(requestAnimationFrame);}});await expect.poll(()=>page.evaluate(()=>Arcade.remaining('neonDrift'))).toBe(0);await page.locator('#startButton').click();await expect(page.locator('#gameStatus')).toHaveText('Ready');await expect(page.getByRole('dialog')).toBeVisible();
});
test('Neon Drift fits small phones and landscape with actions below steering',async({page})=>{
 await page.setViewportSize({width:390,height:664});await ready(page);
 for(const viewport of [{width:390,height:664},{width:430,height:932},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(100);
  const boxes=await page.locator('#leftButton,#rightButton,#earnlyPauseButton,#earnlyQuitButton').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {id:n.id,x:r.x,y:r.y,w:r.width,h:r.height};}));
  for(const b of boxes){expect(b.x,b.id).toBeGreaterThanOrEqual(0);expect(b.y+b.h,b.id).toBeLessThanOrEqual(viewport.height);expect(b.x+b.w,b.id).toBeLessThanOrEqual(viewport.width);expect(b.h,b.id).toBeGreaterThanOrEqual(38);}
  expect(boxes[2].y).toBeGreaterThanOrEqual(boxes[0].y+boxes[0].h);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  await page.screenshot({path:`test-results/neondrift-${test.info().project.name}-${viewport.width}.png`});
 }
});

test('Neon Drift can be completed by a traffic-aware driver across 200 seeded roads',()=>{
 let finishes=0;
 for(let seed=1;seed<=200;seed++){
  const s=E.create(seeded(seed));
  for(let i=0;i<1900&&!s.ended;i++){
   const ahead=s.traffic.filter(c=>c.z-s.distance> -40&&c.z-s.distance<210);
   const cost=lane=>Math.abs(E.road(s.distance+60)+lane-s.x)*.12+ahead.reduce((sum,c)=>sum+(Math.abs(lane-c.lane*72)<40?1000/(1+Math.max(0,c.z-s.distance)/100):0),0);
   const lane=[-72,0,72].sort((a,b)=>cost(a)-cost(b))[0];
   E.tick(s,.05,Math.max(-1,Math.min(1,(E.road(s.distance+65)+lane-s.x)*.04-s.vx*.006)));
  }
  if(s.hull>0)finishes++;
 }
 expect(finishes).toBeGreaterThan(100);console.log('Traffic-aware driver: '+finishes+'/200 completed');
});
test('Neon Drift countdown rejects repeated start input and mini fallback remains playable',async({page})=>{
 await page.goto('/neondrift.html');await page.evaluate(()=>{const b=document.getElementById('startButton');b.click();b.click();b.click();});await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:10000});await expect(page.locator('#plays')).toHaveText('2');
 await page.goto('/mini.html?game=unknown');await expect(page.locator('#gameTitle')).toHaveText('Merge Rush');if(await page.locator('#startButton').isVisible())await page.locator('#startButton').click();else await page.locator('#surface').click();await expect(page.locator('.merge-grid')).toBeVisible({timeout:10000});
});
