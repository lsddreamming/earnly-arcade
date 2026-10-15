const {test,expect}=require('@playwright/test');
const E=require('../turbo-kart-engine.js');
const fs=require('fs');
test('three-lap races finish in order, timeouts earn nothing, and endings are frozen',()=>{
 for(let seed=0;seed<40;seed++){
 const s=E.create();for(let i=0;i<5500&&!s.ended;i++){const p=s.racers[0];E.tick(s,1/60,{steer:Math.max(-1,Math.min(1,(-p.lane+Math.sin(i/90+seed)*20)/15)),drift:i%150<65,item:!!s.item});}
 expect(s.ended).toBe(true);expect(s.racers).toHaveLength(5);expect(s.place).toBeGreaterThanOrEqual(1);expect(s.place).toBeLessThanOrEqual(5);expect(s.time).toBeLessThanOrEqual(90);expect(E.rewards(s)).toBeLessThanOrEqual(25);if(s.finished){expect(s.racers[0].d).toBe(E.length*3);expect(E.rewards(s)).toBeGreaterThanOrEqual(7);}
 const snapshot=JSON.stringify(s);E.tick(s,1,{});E.useItem(s);expect(JSON.stringify(s)).toBe(snapshot);
 }
 const idle=E.create();while(!idle.ended)E.tick(idle,.05);expect(idle.finished).toBe(false);expect(E.rewards(idle)).toBe(0);
});
test('drift release, items, grass and pickup crossing have distinct effects',()=>{
 const s=E.create();s.racers[0].speed=100;s.racers[0].heading=.15;s.racers[0].lane=-30;s.racers.slice(1).forEach(r=>r.d=-500);for(let i=0;i<90;i++)E.tick(s,1/60,{steer:.25,drift:true});E.tick(s,1/60,{});expect(s.drifts).toBe(1);expect(s.racers[0].boost).toBeGreaterThan(1);
 s.item='shield';E.useItem(s);expect(s.racers[0].shield).toBe(6);expect(s.item).toBeNull();s.item='pulse';s.racers[1].d=s.racers[0].d+60;s.racers[1].cooldown=0;s.racers[1].shield=0;E.useItem(s);expect(s.racers[1].slow).toBeGreaterThan(2);
 const c=E.create(),pick=c.pickups.find(p=>p.type==='coin');c.racers[0].d=pick.d-1;c.racers[0].lane=pick.lane;c.racers[0].speed=96;E.tick(c,.05);expect(c.coins).toBe(1);E.tick(c,.05);expect(c.coins).toBe(1);
 const a=E.create(),b=E.create();b.racers[0].lane=74;for(let i=0;i<30;i++){E.tick(a,1/60);E.tick(b,1/60,{steer:1});}expect(a.racers[0].speed).toBeGreaterThan(b.racers[0].speed);
});
test('kart web and native assets match',()=>{for(const file of ['turbo-kart.html','turbo-kart.css','turbo-kart.js','turbo-kart-engine.js','turbo-kart-renderer.js'])expect(fs.readFileSync('www/'+file,'utf8')).toBe(fs.readFileSync(file,'utf8'));});
test.beforeEach(async({page})=>{await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.addInitScript(()=>{localStorage.setItem('arcadeOnboardingSeen','1');localStorage.setItem('arcadeSound','off');});});
async function start(page){await page.goto('/turbo-kart.html');await page.locator('#startButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:10000});}
test('catalog, touch controls, pause and quit preserve the play lifecycle',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/games.html');await page.locator('#gameSearch').fill('Turbo Kart');await page.locator('a[href="turbo-kart.html"]').first().click();await page.locator('#startButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:10000});await expect(page.locator('#plays')).toHaveText('2');
 await page.locator('#earnlyPauseButton').click();await expect(page.locator('#gameStatus')).toHaveText('Paused');const t=await page.locator('#time').textContent();await page.waitForTimeout(250);await expect(page.locator('#time')).toHaveText(t);await page.locator('#leftButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running');
 const box=await page.locator('#rightButton').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.locator('#rightButton').dispatchEvent('pointercancel',{pointerId:1});await expect(page.locator('#rightButton')).not.toHaveClass(/held/);await page.mouse.up();
 await page.locator('#earnlyQuitButton').click();await page.getByRole('button',{name:'Quit Game',exact:true}).click();await expect(page).toHaveURL(/games.html/);expect(await page.evaluate(()=>Number(localStorage.getItem('points')))).toBe(0);expect(errors).toEqual([]);
});
test('finish awards once, passes identical server metrics, and replay spends one play',async({page})=>{
 await page.goto('/turbo-kart.html');await page.evaluate(()=>{const original=TurboKartEngine.create;TurboKartEngine.create=()=>{const s=original();s.time=70;s.racers[0].d=TurboKartEngine.length*3-.1;s.racers[0].speed=96;s.coins=4;TurboKartEngine.create=original;return s;};});await page.locator('#startButton').click();await expect(page.locator('dialog.game-result-dialog')).toBeVisible({timeout:10000});await expect(page.locator('#balance')).toHaveText('24');await page.waitForTimeout(250);await expect(page.locator('#balance')).toHaveText('24');
 const awards=await page.evaluate(()=>Arcade.pendingSyncEvents().filter(e=>e.type==='coin_award'&&e.payload.server?.game==='turboKart'));expect(awards).toHaveLength(1);expect(awards[0].payload.server).toEqual({kind:'game',game:'turboKart',metric:1,aux:4});await page.locator('dialog').getByRole('button',{name:/Play Again/}).click();await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:10000});await expect(page.locator('#plays')).toHaveText('1');
});
test('small phones keep all driving and session controls visible',async({page})=>{
 test.setTimeout(60000);await page.setViewportSize({width:390,height:664});await start(page);for(const viewport of [{width:390,height:664},{width:430,height:932},{width:667,height:375},{width:1280,height:720}]){await page.setViewportSize(viewport);await page.waitForTimeout(100);for(const id of ['leftButton','rightButton','driftButton','itemButton','earnlyPauseButton','earnlyQuitButton']){const b=await page.locator('#'+id).boundingBox();expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y+b.height,id).toBeLessThanOrEqual(viewport.height);expect(b.height,id).toBeGreaterThanOrEqual(44);}expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);await page.screenshot({path:`test-results/turbo-kart-${test.info().project.name}-${viewport.width}.png`});}
});

function drive(s,seed=0){const p=s.racers[0],target=Math.sin(s.time*.7+seed)*9;return {steer:Math.max(-1,Math.min(1,((target-p.lane)*.012-p.heading)*3.3+E.curvature(p.d+25,s.track)*p.speed/1.35)),item:!!s.item};}
test('60 driven races finish across all courses; AI stays competitive and rewards remain capped',()=>{
 for(const course of E.courses)for(let seed=0;seed<20;seed++){
  const s=E.create(course.id);while(!s.ended)E.tick(s,1/60,drive(s,seed));
  expect(s.finished,course.id+' / '+seed).toBe(true);expect(s.time).toBeLessThanOrEqual(90);expect(E.rewards(s)).toBeGreaterThanOrEqual(7);expect(E.rewards(s)).toBeLessThanOrEqual(25);
  expect(Math.max(...s.racers.slice(1).map(r=>r.d))).toBeGreaterThan(s.track.length*2.5);
  for(const r of s.racers){expect(Number.isFinite(r.heading)).toBe(true);expect(Math.abs(r.lane)).toBeLessThanOrEqual(75);}
 }
});
test('blue, gold and violet drift releases grow stronger; stationary and grass drifts cannot farm boosts',()=>{
 const boosts=[];for(const seconds of [1.3,2,2.8]){const s=E.create();Object.assign(s.racers[0],{speed:100,heading:.15,lane:-30});s.racers.slice(1).forEach(r=>r.d=-500);for(let i=0;i<seconds*60;i++)E.tick(s,1/60,{steer:.25,drift:true});E.tick(s,1/60,{});expect(s.drifts).toBe(1);boosts.push(s.racers[0].boost);}
 expect(boosts[1]).toBeGreaterThan(boosts[0]);expect(boosts[2]).toBeGreaterThan(boosts[1]);
 const idle=E.create();for(let i=0;i<10;i++)E.tick(idle,1/60,{steer:1,drift:true});E.tick(idle,1/60,{});expect(idle.drifts).toBe(0);
 const grass=E.create();Object.assign(grass.racers[0],{speed:100,lane:70,charge:2.5,drifting:true});E.tick(grass,1/60,{});expect(grass.drifts).toBe(0);expect(grass.driftCharge).toBe(0);
});
test('steering changes heading and line; releasing input settles steering and corners push an unsteered kart outward',()=>{
 const s=E.create();s.racers.slice(1).forEach(r=>r.d=-500);Object.assign(s.racers[0],{speed:100,lane:0});const angle=s.racers[0].heading;for(let i=0;i<30;i++)E.tick(s,1/60,{steer:1});expect(s.racers[0].heading).toBeGreaterThan(angle+.1);expect(s.racers[0].lane).toBeGreaterThan(3);
 for(let i=0;i<60;i++)E.tick(s,1/60,{});expect(Math.abs(s.racers[0].steer)).toBeLessThan(.01);
 const coast=E.create();coast.racers.slice(1).forEach(r=>r.d=-500);Object.assign(coast.racers[0],{d:450,speed:100,lane:0});for(let i=0;i<60;i++)E.tick(coast,1/60,{});expect(Math.abs(coast.racers[0].lane)).toBeGreaterThan(5);
});
test('Arc Bolt travels to its target, Prism Guard absorbs it, and Ink Patch catches a following rival',()=>{
 for(const shield of [0,6]){const s=E.create();s.racers.slice(2).forEach(r=>r.d=-500);Object.assign(s.racers[0],{d:200,lane:0,speed:100});Object.assign(s.racers[1],{d:250,lane:0,speed:100,shield});s.item='bolt';E.useItem(s);expect(s.projectiles).toHaveLength(1);let struck=false;for(let i=0;i<100;i++){E.tick(s,1/60,drive(s));if(s.racers[1].slow>1){struck=true;break;}}if(shield){expect(struck).toBe(false);expect(s.racers[1].shield).toBe(0);}else expect(struck).toBe(true);expect(s.item).toBeNull();}
 const s=E.create();s.racers[0].d=200;s.racers[0].lane=0;s.item='slick';E.useItem(s);Object.assign(s.racers[1],{d:185,lane:0,speed:100});E.tick(s,1/60,{});expect(s.racers[1].slow).toBeGreaterThan(1);expect(s.hazards).toHaveLength(0);
});
test('course selection, analog dragging, keyboard drift, item UI and original race art work together',async({page})=>{
 test.setTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const course of E.courses){await page.goto('/turbo-kart.html');await page.locator('[data-course="'+course.id+'"]').click();await expect(page.locator('#courseName')).toHaveText(course.name.toUpperCase());await page.evaluate(()=>{const create=TurboKartEngine.create;TurboKartEngine.create=(...a)=>(window.kartTestState=create(...a));});await page.locator('#startButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:10000});
  expect(await page.evaluate(()=>window.kartTestState.track.id)).toBe(course.id);
  await page.evaluate(()=>{const s=window.kartTestState,E=TurboKartEngine;while(s.time<15){const p=s.racers[0];E.tick(s,1/60,{steer:Math.max(-1,Math.min(1,(-p.lane*.012-p.heading)*3.3+E.curvature(p.d+25,s.track)*p.speed/1.35))});}s.item='bolt';});
  await expect(page.locator('#itemName')).toHaveText('Arc Bolt');await page.screenshot({path:`test-results/turbo-kart-course-${course.id}-${test.info().project.name}.png`});
  const b=await page.locator('#game').boundingBox();await page.mouse.move(b.x+b.width*.4,b.y+b.height*.65);await page.mouse.down();await page.mouse.move(b.x+b.width*.6,b.y+b.height*.65);await expect(page.locator('#rightButton')).toHaveClass(/held/);await page.keyboard.down('Shift');await expect(page.locator('#driftButton')).toHaveClass(/held/);await page.mouse.up();await page.keyboard.up('Shift');await expect(page.locator('#rightButton')).not.toHaveClass(/held/);
  await page.locator('#earnlyPauseButton').click();await expect(page.locator('#gameStatus')).toHaveText('Paused');await expect(page.locator('#driftButton')).not.toHaveClass(/held/);
 }
 expect(errors).toEqual([]);
});
