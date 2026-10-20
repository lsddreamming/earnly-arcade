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
test('kart web and native assets match',()=>{for(const file of ['turbo-kart.html','turbo-kart.css','turbo-kart.js','turbo-kart-engine.js','turbo-kart-renderer.js','turbo-kart-driver.js'])expect(fs.readFileSync('www/'+file,'utf8')).toBe(fs.readFileSync(file,'utf8'));});
test.beforeEach(async({page})=>{await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());await page.addInitScript(()=>{localStorage.setItem('arcadeOnboardingSeen','1');localStorage.setItem('arcadeSound','off');});});
async function start(page){await page.goto('/turbo-kart.html');await page.locator('#startButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:10000});}
test('unlisted catalog entry and archived touch controls preserve the play lifecycle',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/games.html');await page.locator('#gameSearch').fill('Turbo Kart');await expect(page.locator('a[href="turbo-kart.html"]')).toHaveCount(0);await page.goto('/turbo-kart.html');await page.locator('#startButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:10000});await expect(page.locator('#plays')).toHaveText('2');
 await page.locator('#earnlyPauseButton').click();await expect(page.locator('#gameStatus')).toHaveText('Paused');const t=await page.locator('#time').textContent();await page.waitForTimeout(250);await expect(page.locator('#time')).toHaveText(t);await page.locator('#leftButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running');
 const box=await page.locator('#rightButton').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.locator('#rightButton').dispatchEvent('pointercancel',{pointerId:1});await expect(page.locator('#rightButton')).not.toHaveClass(/held/);await page.mouse.up();
 await page.locator('#earnlyQuitButton').click();await page.getByRole('button',{name:'Quit Game',exact:true}).click();await expect(page).toHaveURL(/games.html/);expect(await page.evaluate(()=>Number(localStorage.getItem('points')))).toBe(0);expect(errors).toEqual([]);
});
test('finish awards once, passes identical server metrics, and replay spends one play',async({page})=>{
 await page.goto('/turbo-kart.html');await page.evaluate(()=>{const original=TurboKartEngine.create;TurboKartEngine.create=()=>{const s=original();s.time=70;s.racers[0].d=TurboKartEngine.length*3-.1;s.racers[0].speed=96;s.coins=4;TurboKartEngine.create=original;return s;};});await page.locator('#startButton').click();await expect(page.locator('dialog.game-result-dialog')).toBeVisible({timeout:10000});await expect(page.locator('#balance')).toHaveText('24');await expect(page.locator('dialog.game-result-dialog')).toContainText('20 finish + 4 pickup bonus = 24 Arcade Coins');await expect(page.locator('dialog.game-result-dialog')).toContainText('Next race:');await page.waitForTimeout(250);await expect(page.locator('#balance')).toHaveText('24');
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
 const boosts=[];for(const seconds of [.8,1.5,2.2]){const s=E.create();Object.assign(s.racers[0],{speed:100,heading:.15,lane:-30});s.racers.slice(1).forEach(r=>r.d=-500);for(let i=0;i<seconds*60;i++)E.tick(s,1/60,{steer:.25,drift:true});E.tick(s,1/60,{});expect(s.drifts).toBe(1);boosts.push(s.racers[0].boost);}
 expect(boosts[1]).toBeGreaterThan(boosts[0]);expect(boosts[2]).toBeGreaterThan(boosts[1]);
 const idle=E.create();for(let i=0;i<10;i++)E.tick(idle,1/60,{steer:1,drift:true});E.tick(idle,1/60,{});expect(idle.drifts).toBe(0);
 const grass=E.create();Object.assign(grass.racers[0],{speed:100,lane:70,charge:2.5,drifting:true});E.tick(grass,1/60,{});expect(grass.drifts).toBe(0);expect(grass.driftCharge).toBe(0);
});
test('steering changes heading and line; releasing input settles steering and corners push an unsteered kart outward',()=>{
 const s=E.create();s.racers.slice(1).forEach(r=>r.d=-500);Object.assign(s.racers[0],{speed:100,lane:0});const angle=s.racers[0].heading;for(let i=0;i<30;i++)E.tick(s,1/60,{steer:1});expect(s.racers[0].heading).toBeGreaterThan(angle+.1);expect(s.racers[0].lane).toBeGreaterThan(3);
 for(let i=0;i<60;i++)E.tick(s,1/60,{});expect(Math.abs(s.racers[0].steer)).toBeLessThan(.01);
 const coast=E.create();coast.racers.slice(1).forEach(r=>r.d=-500);Object.assign(coast.racers[0],{d:450,speed:100,lane:0});for(let i=0;i<60;i++)E.tick(coast,1/60,{});expect(Math.abs(coast.racers[0].lane)).toBeGreaterThan(2);expect(Math.abs(coast.racers[0].lane)).toBeLessThan(6);
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

test('long holds cannot select race labels or open callouts, including Pause and the Quit link',async({page})=>{
 test.setTimeout(60000);
 await start(page);
 // Playwright uses macOS WebKit; the callout extension exists only on iOS Safari.
 const targets=['#leftButton','#rightButton','#driftButton','#driftButton span','#driftButton small','#itemButton','#earnlyPauseButton','#earnlyQuitButton','#game','#position'];
 const guards=await page.evaluate(targets=>targets.map(selector=>{const node=document.querySelector(selector),css=getComputedStyle(node);return {selector,select:css.userSelect||css.webkitUserSelect,callout:css.getPropertyValue('-webkit-touch-callout'),supportsCallout:CSS.supports('-webkit-touch-callout','none'),context:!node.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true})),selection:!node.dispatchEvent(new Event('selectstart',{bubbles:true,cancelable:true})),drag:!node.dispatchEvent(new Event('dragstart',{bubbles:true,cancelable:true}))};}),targets);for(const guard of guards){const selector=guard.selector;expect(guard.select,selector).toBe('none');if(guard.supportsCallout)expect(guard.callout,selector).toBe('none');expect(guard.context,selector).toBe(true);expect(guard.selection,selector).toBe(true);expect(guard.drag,selector).toBe(true);}
 // Reproduce an existing native selection on Quit, then begin a real held gesture.
 await page.locator('#earnlyQuitButton').evaluate(node=>{const range=document.createRange();range.selectNodeContents(node);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);});
 const right=await page.locator('#rightButton').boundingBox();await page.mouse.move(right.x+right.width/2,right.y+right.height/2);await page.mouse.down();await page.waitForTimeout(800);await expect(page.locator('#rightButton')).toHaveClass(/held/);expect(await page.evaluate(()=>getSelection().rangeCount)).toBe(0);await page.mouse.up();await expect(page.locator('#rightButton')).not.toHaveClass(/held/);
 const quit=await page.locator('#earnlyQuitButton').boundingBox();await page.mouse.move(quit.x+quit.width/2,quit.y+quit.height/2);await page.mouse.down();await page.waitForTimeout(800);await page.mouse.move(5,5);await page.mouse.up();expect(await page.evaluate(()=>getSelection().toString())).toBe('');await expect(page.locator('#gameStatus')).toHaveText('Running');
 await page.locator('#earnlyPauseButton').click();await expect(page.locator('#gameStatus')).toHaveText('Paused');await page.locator('#earnlyPauseButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running');await page.locator('#earnlyQuitButton').click();await expect(page.getByRole('button',{name:'Quit Game',exact:true})).toBeVisible();
 // Selection guards must not swallow events in the separate confirmation dialog.
 expect(await page.getByRole('button',{name:'Quit Game',exact:true}).evaluate(node=>node.dispatchEvent(new Event('selectstart',{bubbles:true,cancelable:true})))).toBe(true);
});

test('one thumb can hold and slide Drift, with readable feedback and clean cancellation',async({page})=>{
 await page.setViewportSize({width:430,height:932});await page.goto('/turbo-kart.html');await page.evaluate(()=>{const create=TurboKartEngine.create;TurboKartEngine.create=(...args)=>(window.kartTestState=create(...args));});await page.locator('#startButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:10000});await page.evaluate(()=>{Object.assign(kartTestState.racers[0],{speed:100,heading:.15,lane:-30});kartTestState.racers.slice(1).forEach(r=>r.d=-500);});
 const drift=page.locator('#driftButton'),b=await drift.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await expect(drift).toHaveClass(/held/);await expect(page.locator('#rightButton')).not.toHaveClass(/held/);await page.mouse.move(b.x+b.width/2+24,b.y+b.height/2);await expect(page.locator('#rightButton')).toHaveClass(/held/);await expect.poll(()=>page.evaluate(()=>kartTestState.racers[0].drifting)).toBe(true);
 const colors=await drift.evaluate(node=>({text:getComputedStyle(node).color,small:getComputedStyle(node.querySelector('small')).color,background:getComputedStyle(node).backgroundColor}));expect(colors.text).toBe('rgb(16, 44, 57)');expect(colors.small).toBe(colors.text);expect(colors.background).toBe('rgb(158, 255, 223)');
 await page.screenshot({path:`test-results/turbo-kart-drift-held-${test.info().project.name}.png`});await page.mouse.move(b.x+b.width/2-24,b.y+b.height/2);await expect(page.locator('#leftButton')).toHaveClass(/held/);await expect(page.locator('#rightButton')).not.toHaveClass(/held/);await drift.dispatchEvent('pointercancel',{pointerId:1});await expect(drift).not.toHaveClass(/held/);await expect(page.locator('#leftButton')).not.toHaveClass(/held/);await page.mouse.up();
 await page.locator('#earnlyPauseButton').click();await expect(page.locator('#gameStatus')).toHaveText('Paused');await page.locator('#driftButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running');await expect(drift).not.toHaveClass(/held/);
});

test('road and boost strips never cut through the rear body on hairpins or the verge',async({page})=>{
 await page.setViewportSize({width:430,height:932});await start(page);await page.locator('#earnlyPauseButton').click();
 const samples=await page.evaluate(()=>{const canvas=document.querySelector('#game'),E=TurboKartEngine,results=[];for(const course of E.courses)for(let step=0;step<24;step++)for(const lane of [-70,0,70]){const s=E.create(course.id);Object.assign(s.racers[0],{d:s.track.length*step/24,lane,heading:0,shield:6});s.pickups=[];s.racers.slice(1).forEach(r=>{r.d=s.racers[0].d;r.lane=1000;});const frame=TurboKartRenderer.create(canvas);frame.render(s);const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,rect=canvas.getBoundingClientRect(),scale=Math.min(rect.width*.92,rect.height*.88)/58*.43*w/rect.width;const x=Math.round(w/2),y=Math.round(h*.84-1.5*scale);const pixel=[...ctx.getImageData(x,y,1,1).data];results.push({course:course.id,step,lane,pixel});}return results;});
 for(const sample of samples)expect(sample.pixel,JSON.stringify(sample)).toEqual([101,245,220,255]);
 for(const course of ['harbor','canyon','garden']){await page.evaluate(course=>{const s=TurboKartEngine.create(course);s.racers[0].d=s.track.length*.36;s.racers[0].lane=-38;s.racers[0].heading=.25;s.racers[0].shield=6;TurboKartRenderer.create(document.querySelector('#game')).render(s);document.querySelector('#kartCallout').hidden=true;document.querySelector('#courseName').textContent=s.track.name.toUpperCase();},course);await page.screenshot({path:`test-results/turbo-kart-polish-${course}-${test.info().project.name}.png`});}
});

test('saved rear driver uses owned gear and omits front facial layers',async({page})=>{
 await page.goto('/turbo-kart.html');
 const result=await page.evaluate(async()=>{
  const e={avatar:{id:'rose-potato'},outfit:{imageUrl:'cosmetic-starter-suit.svg'},head:{imageUrl:'cosmetic-hair-sprout.svg'},backpack:{imageUrl:'cosmetic-adventure-pack.svg'},eyes:{imageUrl:'cosmetic-eyes-classic.svg'},weapon:{imageUrl:'https://untrusted.example/image.svg'}};
  const d=await TurboKartDriver.compose(e);return {parts:d.parts,pixels:d.canvas.getContext('2d').getImageData(130,80,1,1).data[3]};
 });
 expect(result.parts.map(p=>p.slot)).toEqual(['avatar','outfit','head','backpack']);expect(result.parts[0].src).toBe('cosmetic-rose-potato-body.svg');expect(result.pixels).toBeGreaterThan(0);
});
test('account change discards a late profile response and keeps wallet unchanged',async({page})=>{
 await page.goto('/turbo-kart.html');
 const result=await page.evaluate(async()=>{
  const before=localStorage.getItem('points'),seen=[];let release;
  TurboKartDriver.compose=async e=>{seen.push(e.avatar.id);const c=document.createElement('canvas');c.width=300;c.height=400;const x=c.getContext('2d');x.fillStyle=e.avatar.id==='rose-potato'?'#ff0088':'#0088ff';x.fillRect(0,0,300,400);return {canvas:c};};
  window.EarnlyCloud={session:async()=>({access_token:'test-only'})};
  const fetchOriginal=window.fetch;window.fetch=(url,opts)=>String(url).includes('/avatars/api/me')?new Promise(resolve=>release=()=>resolve({ok:true,json:async()=>({user:{equipped:{avatar:{id:'rose-potato'}}}})})):fetchOriginal(url,opts);
  window.dispatchEvent(new Event('earnly-cloud-auth-change'));await new Promise(r=>setTimeout(r,10));
  window.EarnlyCloud.session=async()=>null;window.dispatchEvent(new Event('earnly-cloud-auth-change'));await new Promise(r=>setTimeout(r,30));const signedOut=document.getElementById('game').toDataURL();release();await new Promise(r=>setTimeout(r,30));const afterLate=document.getElementById('game').toDataURL();
  return {seen,before,after:localStorage.getItem('points'),sameDriver:signedOut===afterLate};
 });
 expect(result.sameDriver).toBe(true);expect(result.seen).toContain('cyber-starter');expect(result.before).toBe(result.after);
});
test('tiny track movements stay neutral; drag cancellation releases steering',async({page})=>{
 await start(page);const canvas=page.locator('#game');
 const b=await canvas.boundingBox();await page.mouse.move(b.x+150,b.y+b.height*.6);await page.mouse.down();
 await page.mouse.move(b.x+153,b.y+b.height*.6);
 await expect(page.locator('#rightButton')).not.toHaveClass(/held/);
 await page.mouse.move(b.x+210,b.y+b.height*.6);
 await expect(page.locator('#rightButton')).toHaveClass(/held/);
 await page.mouse.up();await expect(page.locator('#rightButton')).not.toHaveClass(/held/);
});

test('every coin gives a surge after the wallet bonus is capped, without duplicate pickup credit',()=>{
 const s=E.create();s.coins=5;s.pickupCount=5;s.racers.slice(1).forEach(r=>r.d=-500);
 const pick=s.pickups.find(p=>p.type==='coin'),p=s.racers[0];Object.assign(p,{d:pick.d-1,lane:pick.lane,speed:96});E.tick(s,.05);
 expect(s.coins).toBe(5);expect(s.pickupCount).toBe(6);expect(p.coinSurge).toBe(.65);expect(s.callout).toContain('COIN SURGE');E.tick(s,.05);expect(s.pickupCount).toBe(6);expect(p.coinSurge).toBeLessThan(.65);
 s.ended=true;s.finished=true;s.place=1;expect(E.rewards(s)).toBe(25);
});
test('collision immunity never allows a pack to interpenetrate or repeatedly slow racers',()=>{
 const s=E.create();s.pickups=[];s.racers.forEach((r,i)=>Object.assign(r,{d:300,lane:i*.1,speed:90,cooldown:1,slow:0}));
 for(let tick=0;tick<20;tick++){E.tick(s,1/60);for(let i=0;i<5;i++)for(let j=i+1;j<5;j++)if(Math.abs(s.racers[i].d-s.racers[j].d)<18)expect(Math.abs(s.racers[i].lane-s.racers[j].lane)).toBeGreaterThan(22);}
 expect(s.racers[0].slow).toBe(0);expect(s.racers.every(r=>Math.abs(r.lane)<=75)).toBe(true);
});

test('race gestures block zoom across nested controls and gaps without swallowing session actions',async({page})=>{
 await page.goto('/turbo-kart.html');await page.evaluate(()=>{const create=TurboKartEngine.create;TurboKartEngine.create=(...args)=>{const s=create(...args);s.pickups=[];window.kartTestState=s;return s;};});await page.locator('#startButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:10000});
 const gestures=await page.evaluate(()=>({
  styles:['.kart-shell','#kartControls','#driftButton small','.drift-meter','#sessionControls','#itemButton'].map(selector=>({selector,value:getComputedStyle(document.querySelector(selector)).touchAction})),
  events:['#leftButton','#driftButton small','#kartControls','.drift-meter','#itemButton'].flatMap(selector=>['touchstart','touchend','touchmove','gesturestart','gesturechange','gestureend','dblclick'].map(type=>({selector,type,blocked:!document.querySelector(selector).dispatchEvent(new Event(type,{bubbles:true,cancelable:true}))})))
 }));
 for(const result of gestures.styles)expect(result.value,result.selector).toBe('none');
 for(const result of gestures.events)expect(result.blocked,result.selector+' '+result.type).toBe(true);
 await page.evaluate(()=>{kartTestState.item='shield';});await expect(page.locator('#itemButton')).toBeEnabled();
 expect(await page.locator('#itemButton').evaluate(n=>n.dispatchEvent(new Event('touchend',{bubbles:true,cancelable:true})))).toBe(true);
 await page.locator('#itemButton').click();await expect(page.locator('#itemButton')).toBeDisabled();
 expect(await page.evaluate(()=>kartTestState.racers[0].shield)).toBeGreaterThan(0);
 // Pause and Quit still receive their normal click activation after touch events.
 expect(await page.locator('#earnlyPauseButton').evaluate(n=>n.dispatchEvent(new Event('touchend',{bubbles:true,cancelable:true})))).toBe(true);
 await page.locator('#earnlyPauseButton').click();await expect(page.locator('#gameStatus')).toHaveText('Paused');
 await page.locator('#earnlyPauseButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running');
 await page.locator('#earnlyQuitButton').click();const quit=page.getByRole('button',{name:'Quit Game',exact:true});await expect(quit).toBeVisible();
 expect(await quit.evaluate(n=>n.dispatchEvent(new Event('gesturestart',{bubbles:true,cancelable:true})))).toBe(true);
});

test('two simultaneous controls, repeated taps and cancellation release cleanly',async({page})=>{
 await start(page);
 await page.evaluate(()=>{
  // Synthetic pointer IDs have no browser capture; stub capture only for this
  // input-state test. Existing mouse tests exercise actual pointer capture.
  for(const id of ['leftButton','driftButton'])document.getElementById(id).setPointerCapture=()=>{};
 });
 await page.locator('#leftButton').dispatchEvent('pointerdown',{pointerId:31,pointerType:'touch',button:0});
 await page.locator('#driftButton').dispatchEvent('pointerdown',{pointerId:32,pointerType:'touch',button:0});
 await expect(page.locator('#leftButton')).toHaveClass(/held/);await expect(page.locator('#driftButton')).toHaveClass(/held/);
 await page.locator('#leftButton').dispatchEvent('pointerup',{pointerId:31});await expect(page.locator('#leftButton')).not.toHaveClass(/held/);await expect(page.locator('#driftButton')).toHaveClass(/held/);
 await page.locator('#driftButton').dispatchEvent('pointercancel',{pointerId:32});await expect(page.locator('#driftButton')).not.toHaveClass(/held/);
 for(let i=0;i<6;i++){await page.locator('#leftButton').dispatchEvent('pointerdown',{pointerId:40+i,pointerType:'touch',button:0});await page.locator('#leftButton').dispatchEvent('pointerup',{pointerId:40+i});}
 await expect(page.locator('#leftButton')).not.toHaveClass(/held/);
});

test('rival labels stay readable when a pack projects into the same screen area',async({page})=>{
 await page.goto('/turbo-kart.html');
 const frames=await page.evaluate(()=>{
  const canvas=document.getElementById('game'),ctx=canvas.getContext('2d'),original=ctx.fillText,frames=[];
  for(const size of [[390,640],[780,480]]){
   canvas.getBoundingClientRect=()=>({width:size[0],height:size[1]});
   for(const distance of [90,130,190]){
    const s=TurboKartEngine.create();s.pickups=[];s.racers.slice(1).forEach((r,i)=>{r.name='RIVAL'+i;r.d=distance+i*3;r.lane=i*2;});const labels=[];
    ctx.fillText=function(t,x,y){if(String(t).startsWith('RIVAL')){const fontSize=parseFloat(this.font.match(/([\d.]+)px/)[1]),width=this.measureText(t).width;labels.push({left:x-width/2,right:x+width/2,top:y-fontSize,bottom:y});}return original.apply(this,arguments);};
    TurboKartRenderer.create(canvas).render(s);frames.push(labels);
   }
  }ctx.fillText=original;return frames;
 });
 expect(frames.flat().length).toBeGreaterThan(0);
 for(const labels of frames)for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++)expect(labels[i].right<=labels[j].left||labels[j].right<=labels[i].left||labels[i].bottom<=labels[j].top||labels[j].bottom<=labels[i].top).toBe(true);
});

test('racing keeps layout and wallet reads out of the frame hot path',async({page})=>{
 await start(page);
 const counts=await page.evaluate(async()=>{
  const canvas=document.getElementById('game'),rect=canvas.getBoundingClientRect.bind(canvas),remaining=Arcade.remaining,sample=TurboKartEngine.sample;
  let layout=0,account=0,samples=0,frames=0;
  canvas.getBoundingClientRect=()=>{layout++;return rect();};
  Arcade.remaining=(...args)=>{account++;return remaining(...args);};
  TurboKartEngine.sample=(...args)=>{samples++;return sample(...args);};
  const end=performance.now()+1200;
  await new Promise(resolve=>{function frame(){frames++;if(performance.now()<end)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
  canvas.getBoundingClientRect=rect;Arcade.remaining=remaining;TurboKartEngine.sample=sample;
  return {layout,account,samples,frames};
 });
 expect(counts.frames).toBeGreaterThan(2);
 expect(counts.layout).toBeLessThanOrEqual(3);
 expect(counts.account).toBeLessThanOrEqual(3);
 expect(counts.samples/counts.frames).toBeLessThan(650);
 await page.setViewportSize({width:667,height:375});
 // Both adaptive phone resolutions must preserve the resized canvas aspect ratio.
 await expect.poll(()=>page.locator('#game').evaluate(c=>{
  const rect=c.getBoundingClientRect(),caps=matchMedia('(pointer: coarse)').matches?[0.8,0.6]:[2];
  return rect.width>0&&rect.height>0&&caps.some(cap=>{
   const ratio=Math.min(devicePixelRatio,cap);
   return Math.abs(c.width-rect.width*ratio)<=1&&Math.abs(c.height-rect.height*ratio)<=1;
  });
 })).toBe(true);
});

test('slow renderer loading keeps Start disabled until the first tap can start a race',async({page})=>{
 let release;
 const ready=new Promise(resolve=>release=resolve);
 await page.route('**/turbo-kart-renderer.js*',async route=>{await ready;await route.continue();});
 await page.goto('/turbo-kart.html',{waitUntil:'commit'});
 try{
  await expect(page.locator('#startButton')).toBeVisible();
  await expect(page.locator('#startButton')).toBeDisabled();
  await expect(page.locator('#gameStatus')).toHaveText('Loading');
 }finally{release();}
 await expect(page.locator('#startButton')).toBeEnabled();
 await expect(page.locator('#plays')).toHaveText('3');
 await page.locator('#startButton').click();
 await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:10000});
 await expect(page.locator('#plays')).toHaveText('2');
});

test('race distance and final seconds stay clear without narrowing the circuit',async({page})=>{
 await page.goto('/turbo-kart.html');await page.evaluate(()=>{const create=TurboKartEngine.create;TurboKartEngine.create=(...args)=>(window.kartTestState=create(...args));});
 await page.locator('#startButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running');
 await page.evaluate(()=>{kartTestState.racers[0].d=kartTestState.track.length*1.5;kartTestState.time=76;});
 await expect(page.getByRole('progressbar',{name:'Race distance'})).toHaveAttribute('aria-valuenow','50');
 await expect(page.locator('#time').locator('..')).toHaveClass(/time-low/);
 await page.locator('#earnlyPauseButton').click();
 const progress=await page.getByRole('progressbar',{name:'Race distance'}).getAttribute('aria-valuenow');await page.waitForTimeout(150);
 await expect(page.getByRole('progressbar',{name:'Race distance'})).toHaveAttribute('aria-valuenow',progress);
 for(const viewport of [{width:1280,height:720},{width:390,height:664}]){
  await page.setViewportSize(viewport);const hud=await page.locator('.kart-hud').boundingBox(),stage=await page.locator('.kart-stage').boundingBox();
  expect(Math.abs(hud.width-stage.width)).toBeLessThanOrEqual(2);
  await page.screenshot({path:`test-results/turbo-kart-polished-${test.info().project.name}-${viewport.width}.png`});
 }
});

test('Reduce Motion freezes decorative water and pickup bobbing without changing race state',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/turbo-kart.html');
 const results=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.getBoundingClientRect=()=>({width:390,height:500});
  const renderer=TurboKartRenderer.create(canvas),s=TurboKartEngine.create('harbor');
  s.time=1;renderer.render(s);const first=canvas.toDataURL();
  s.time=10;const before=JSON.stringify(s);renderer.render(s);
  return {same:first===canvas.toDataURL(),untouched:JSON.stringify(s)===before,transition:getComputedStyle(document.getElementById('raceProgress')).transitionDuration};
 });
 expect(results.same).toBe(true);expect(results.untouched).toBe(true);expect(results.transition).toBe('0s');
});

test('release settles promptly and countersteering reverses without a lingering slide',()=>{
 for(const reverse of [false,true]){const s=E.create();s.pickups=[];s.racers.slice(1).forEach(r=>r.d=-500);Object.assign(s.racers[0],{lane:0,speed:100});for(let i=0;i<20;i++)E.tick(s,1/60,{steer:.7});const lane=s.racers[0].lane;let reversedAt=Infinity;for(let i=0;i<30;i++){E.tick(s,1/60,{steer:reverse?-.7:0});if(s.racers[0].heading<0)reversedAt=Math.min(reversedAt,i/60);}if(reverse)expect(reversedAt).toBeLessThanOrEqual(.15);else expect(Math.abs(s.racers[0].lane-lane)).toBeLessThan(2);}
});

test('phone rendering has bounded road work and world-space boats pass through the view',async({page})=>{
 await page.goto('/turbo-kart.html');
 const result=await page.evaluate(()=>{
  const c=document.createElement('canvas');c.getBoundingClientRect=()=>({width:390,height:560});const ctx=c.getContext('2d'),fill=ctx.fill.bind(ctx),line=ctx.lineTo.bind(ctx);let fills=0,lines=0,boats=[];
  ctx.fill=(...args)=>{fills++;if(ctx.fillStyle==='#fff4dc'){const m=ctx.getTransform();const ratio=c.width/390;const x=m.e/ratio,y=m.f/ratio;if(x>15&&x<375&&y>0&&y<560)boats.push({x,y});}return fill(...args);};ctx.lineTo=(...args)=>{lines++;return line(...args);};
  const renderer=TurboKartRenderer.create(c),s=TurboKartEngine.create();renderer.render(s);fills=lines=0;
  const frames=[];for(let i=0;i<24;i++){s.racers[0].d=s.track.length*i/24;s.time=-i-1;boats=[];renderer.render(s);frames.push(boats);}
  return {fills:fills/24,lines:lines/24,pixels:c.width*c.height,coarse:matchMedia('(pointer: coarse)').matches,cap:390*560*Math.min(devicePixelRatio,matchMedia('(pointer: coarse)').matches?1:2)**2,frames};
 });
 expect(result.fills).toBeLessThan(result.coarse?220:450);expect(result.lines).toBeLessThan(result.coarse?650:1400);expect(result.pixels).toBeLessThanOrEqual(result.cap+1500);
 const xs=result.frames.flat().map(b=>Math.round(b.x));expect(new Set(xs).size).toBeGreaterThan(6);expect(result.frames.some(f=>!f.length)).toBe(true);expect(result.frames.filter(f=>f.length>0).length).toBeGreaterThan(4);expect(Math.max(...xs)-Math.min(...xs)).toBeGreaterThan(150);
 await page.setViewportSize({width:390,height:700});await start(page);await page.locator('#earnlyPauseButton').click();
 for(const [label,fraction]of [['bay',0],['reverse-view',.35]]){await page.evaluate(f=>{const s=TurboKartEngine.create();s.racers[0].d=s.track.length*f;TurboKartRenderer.create(document.getElementById('game')).render(s);},fraction);await page.screenshot({path:`test-results/turbo-kart-${label}-${test.info().project.name}.png`});}
});

test('sustained late phone frames lower rendering cost without changing the race',async({page})=>{
 await page.goto('/turbo-kart.html');
 const result=await page.evaluate(()=>{
  const c=document.createElement('canvas');c.getBoundingClientRect=()=>({width:390,height:560});
  const renderer=TurboKartRenderer.create(c),s=TurboKartEngine.create(),before=JSON.stringify(s);
  renderer.render(s);const initial=c.width*c.height;
  renderer.noteFrame(33);renderer.noteFrame(2000);
  for(let i=0;i<60;i++)renderer.noteFrame(1000/60);
  renderer.render(s);const recovered=c.width*c.height;
  for(let i=0;i<30;i++)renderer.noteFrame(1000/30);
  renderer.render(s);const fallback=c.width*c.height;
  for(let i=0;i<60;i++)renderer.noteFrame(1000/60);
  renderer.render(s);
  return {initial,recovered,fallback,stable:c.width*c.height,unchanged:JSON.stringify(s)===before,coarse:matchMedia('(pointer: coarse)').matches};
 });
 expect(result.recovered).toBe(result.initial);expect(result.unchanged).toBe(true);
 if(result.coarse)expect(result.fallback).toBeLessThan(result.initial*.7);else expect(result.fallback).toBe(result.initial);
 expect(result.stable).toBe(result.fallback);
});

test('120Hz callbacks do not redraw unchanged racing frames',async({page})=>{
 await page.goto('/turbo-kart.html');await expect(page.locator('#startButton')).toBeEnabled();
 const result=await page.evaluate(()=>{
  const originalRAF=window.requestAnimationFrame;let callback;
  window.requestAnimationFrame=fn=>{if(fn.name==='loop'){callback=fn;return 999999;}return originalRAF(fn);};
  Arcade.countdown=fn=>fn();
  document.getElementById('startButton').click();
  const ctx=document.getElementById('game').getContext('2d'),transform=ctx.setTransform.bind(ctx),tick=TurboKartEngine.tick;let draws=0,ticks=0;
  ctx.setTransform=(...args)=>{draws++;return transform(...args);};TurboKartEngine.tick=(...args)=>{ticks++;return tick(...args);};
  const begin=performance.now();for(let frame=1;frame<=120;frame++)callback(begin+frame*1000/120);
  ctx.setTransform=transform;TurboKartEngine.tick=tick;window.requestAnimationFrame=originalRAF;
  return {draws,ticks};
 });
 expect(result.ticks).toBeGreaterThanOrEqual(59);expect(result.ticks).toBeLessThanOrEqual(62);
 expect(result.draws).toBeGreaterThanOrEqual(59);expect(result.draws).toBeLessThanOrEqual(62);
});


test('ramps launch once per crossing and landing grants speed without extra coins',()=>{
 for(const course of E.courses){const s=E.create(course.id),p=s.racers[0],ramp=s.ramps[0];s.racers.slice(1).forEach(r=>r.d=-500);s.pickups=[];
 Object.assign(p,{d:ramp.d-.5,lane:ramp.lane,speed:100});E.tick(s,1/60);expect(s.jumps).toBe(1);expect(p.air).toBe(.75);
 for(let i=0;i<46;i++)E.tick(s,1/60);expect(p.air).toBe(0);expect(p.boost).toBeGreaterThan(.7);expect(s.jumps).toBe(1);expect(s.coins).toBe(0);
 Object.assign(p,{d:ramp.d+s.track.length-.5,lane:ramp.lane,speed:100});E.tick(s,1/60);expect(s.jumps).toBe(2);
 }
});
test('narrow shortcuts reward holding the lane and count each section once per lap',()=>{
 for(const course of E.courses){const s=E.create(course.id),p=s.racers[0],cut=s.cuts[0];s.racers.slice(1).forEach(r=>r.d=-500);s.pickups=[];
 Object.assign(p,{d:cut.start+10,lane:cut.lane,speed:108});E.tick(s,1/60);expect(p.speed).toBeGreaterThan(108);expect(s.cutsTaken).toBe(1);
 p.lane=cut.lane+12;E.tick(s,1/60);expect(p.cutActive).toBe(false);expect(p.speed).toBeLessThan(108);
 p.lane=cut.lane;E.tick(s,1/60);expect(s.cutsTaken).toBe(1);
 Object.assign(p,{d:cut.start+s.track.length+10,lane:cut.lane});E.tick(s,1/60);expect(s.cutsTaken).toBe(2);expect(s.coins).toBe(0);
 }
});
test('a stalled racing frame resumes with bounded catch-up and no wallet polling',async({page})=>{
 await page.goto('/turbo-kart.html');await expect(page.locator('#startButton')).toBeEnabled();
 const result=await page.evaluate(()=>{
  const originalRAF=window.requestAnimationFrame;let callback;
  window.requestAnimationFrame=fn=>{if(fn.name==='loop'){callback=fn;return 999999;}return originalRAF(fn);};Arcade.countdown=fn=>fn();document.getElementById('startButton').click();
  const tick=TurboKartEngine.tick,remaining=Arcade.remaining;let ticks=0,reads=0;
  TurboKartEngine.tick=(...args)=>{ticks++;return tick(...args);};Arcade.remaining=(...args)=>{reads++;return remaining(...args);};
  const begin=performance.now();callback(begin+2000);const recovery=ticks;callback(begin+2000+1000/60);const resumed=ticks>recovery;
  TurboKartEngine.tick=tick;Arcade.remaining=remaining;window.requestAnimationFrame=originalRAF;
  return {recovery,resumed,reads};
 });
 expect(result.recovery).toBeLessThanOrEqual(3);expect(result.recovery).toBeGreaterThan(0);expect(result.resumed).toBe(true);expect(result.reads).toBe(0);
});

test('a resting track touch does not block drift steering and both touches release cleanly',async({page})=>{
 await start(page);
 await page.evaluate(()=>{for(const id of ['game','driftButton'])document.getElementById(id).setPointerCapture=()=>{};});
 await page.locator('#game').dispatchEvent('pointerdown',{pointerId:81,pointerType:'touch',button:0,clientX:100});
 await page.locator('#driftButton').dispatchEvent('pointerdown',{pointerId:82,pointerType:'touch',button:0,clientX:150});
 await page.locator('#driftButton').dispatchEvent('pointermove',{pointerId:82,pointerType:'touch',clientX:180});
 await expect(page.locator('#rightButton')).toHaveClass(/held/);await expect(page.locator('#driftButton')).toHaveClass(/held/);
 await page.locator('#driftButton').dispatchEvent('pointermove',{pointerId:82,pointerType:'touch',clientX:120});await expect(page.locator('#leftButton')).toHaveClass(/held/);
 await page.locator('#driftButton').dispatchEvent('pointercancel',{pointerId:82});await expect(page.locator('#leftButton')).not.toHaveClass(/held/);await expect(page.locator('#driftButton')).not.toHaveClass(/held/);
 await page.locator('#game').dispatchEvent('pointerup',{pointerId:81});
});

async function observeKartDriver(page,{hold=false}={}){
 await page.route('**/turbo-kart.js*',r=>r.fulfill({contentType:'application/javascript',body:`
 window.driverChanges=[];window.driverCompositions=0;
 const originalCreate=TurboKartRenderer.create;
 TurboKartRenderer.create=(...args)=>{const renderer=originalCreate(...args),set=renderer.setDriver;renderer.setDriver=d=>{window.driverChanges.push(d?d.marker:null);return set(d);};return renderer;};
 TurboKartDriver.compose=async()=>{const marker=++window.driverCompositions;if(${hold}&&marker===1)await new Promise(resolve=>window.releaseDriver=resolve);const canvas=document.createElement('canvas');canvas.width=300;canvas.height=400;return {canvas,marker};};
 `+fs.readFileSync('turbo-kart.js','utf8')}));
 await page.goto('/turbo-kart.html');await expect(page.locator('#startButton')).toBeEnabled();await page.evaluate(()=>Arcade.countdown=fn=>fn());
}

test('profile refresh keeps the equipped driver until the race ends; account changes clear it',async({page})=>{
 await observeKartDriver(page);await expect.poll(()=>page.evaluate(()=>driverChanges.at(-1))).toBe(1);
 await page.locator('#startButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running');
 await page.evaluate(()=>{dispatchEvent(new Event('earnly-public-profile-updated'));dispatchEvent(new Event('earnly-cloud-ready'));});
 expect(await page.evaluate(()=>({changes:driverChanges,compositions:driverCompositions}))).toEqual({changes:[1],compositions:1});
 await page.evaluate(()=>{const tick=TurboKartEngine.tick;TurboKartEngine.tick=(s,...args)=>{tick(s,...args);s.ended=true;TurboKartEngine.tick=tick;};});
 await expect(page.locator('#gameStatus')).toHaveText('Race over');await expect.poll(()=>page.evaluate(()=>driverChanges.at(-1))).toBe(2);
 await page.locator('dialog').getByRole('button',{name:/Play Again/}).click();await expect(page.locator('#gameStatus')).toHaveText('Running');
 await page.evaluate(()=>dispatchEvent(new Event('earnly-cloud-auth-change')));expect(await page.evaluate(()=>driverChanges.at(-1))).toBeNull();
});

test('a driver composition finishing after Start waits until racing ends',async({page})=>{
 await observeKartDriver(page,{hold:true});await expect.poll(()=>page.evaluate(()=>typeof window.releaseDriver)).toBe('function');
 await page.locator('#startButton').click();await expect(page.locator('#gameStatus')).toHaveText('Running');
 await page.evaluate(async()=>{window.releaseDriver();await Promise.resolve();await Promise.resolve();});expect(await page.evaluate(()=>driverChanges)).toEqual([]);
 await page.evaluate(()=>{const tick=TurboKartEngine.tick;TurboKartEngine.tick=(s,...args)=>{tick(s,...args);s.ended=true;TurboKartEngine.tick=tick;};});
 await expect.poll(()=>page.evaluate(()=>driverChanges.at(-1))).toBe(2);
});

test('pause immediately disables held item and resume restores its action',async({page})=>{
 await page.goto('/turbo-kart.html');await expect(page.locator('#startButton')).toBeEnabled();
 await page.evaluate(()=>{Arcade.countdown=fn=>fn();const tick=TurboKartEngine.tick;TurboKartEngine.tick=(s,...args)=>{tick(s,...args);s.item='shield';};});
 await page.locator('#startButton').click();await expect(page.locator('#itemButton')).toBeEnabled();
 await page.locator('#earnlyPauseButton').click();await expect(page.locator('#itemButton')).toBeDisabled();await expect(page.locator('#kartCallout')).toContainText('PAUSED');
 await page.locator('#leftButton').click();await expect(page.locator('#itemButton')).toBeEnabled();await expect(page.locator('#kartCallout')).not.toContainText('PAUSED');
});

test('last selected course survives reload without spending plays',async({page})=>{
 await page.goto('/turbo-kart.html');const plays=await page.locator('#plays').textContent();
 await page.locator('[data-course="canyon"]').click();await page.reload();
 await expect(page.locator('[data-course="canyon"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#courseName')).toHaveText(E.courses.find(c=>c.id==='canyon').name.toUpperCase());
 await expect(page.locator('#plays')).toHaveText(plays);
 await page.evaluate(()=>localStorage.setItem('earnlyKartCourse','unknown-course'));await page.reload();
 await expect(page.locator('[data-course="harbor"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#startButton')).toBeEnabled();
});
test('course selection works when device storage is blocked',async({page})=>{
 await page.addInitScript(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(k){if(k==='earnlyKartCourse')throw new Error('blocked');return get.call(this,k);};Storage.prototype.setItem=function(k,v){if(k==='earnlyKartCourse')throw new Error('blocked');return set.call(this,k,v);};});
 await page.goto('/turbo-kart.html');await page.locator('[data-course="garden"]').click();
 await expect(page.locator('[data-course="garden"]')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#startButton')).toBeEnabled();
});

test('Timed out kart results explain progress and do not promise pickup rewards',async({page})=>{
 await page.goto('/turbo-kart.html');await page.evaluate(()=>{const create=TurboKartEngine.create;TurboKartEngine.create=(...args)=>{const s=create(...args);s.time=TurboKartEngine.LIMIT-.001;s.racers[0].d=s.track.length*1.5;s.coins=4;return s;};});
 await page.locator('#startButton').click();const result=page.locator('dialog.game-result-dialog');await expect(result).toBeVisible({timeout:10000});await expect(result).toContainText('50% of 3 laps completed');await expect(result).toContainText('No finish reward');await expect(result).not.toContainText('pickup bonus =');await expect(page.locator('#balance')).toHaveText('0');
});

test('energy stations give one item per row, bank a reserve and never overwrite a full loadout',()=>{
 for(const course of E.courses){const s=E.create(course.id),p=s.racers[0];s.racers.slice(1).forEach(r=>r.d=-500);
 const rows=[...new Set(s.pickups.filter(q=>q.type==='item').map(q=>q.d))];expect(rows).toHaveLength(10);
 const cross=d=>{Object.assign(p,{d:d-.5,lane:9,heading:0,speed:100});E.tick(s,1/60);};
 cross(rows[0]);const first=s.item;expect(first).toBeTruthy();expect(s.reserveItem).toBeNull();expect(s.itemsCollected).toBe(1);
 cross(rows[1]);const second=s.reserveItem;expect(second).toBeTruthy();expect(s.item).toBe(first);expect(s.itemsCollected).toBe(2);
 cross(rows[2]);expect([s.item,s.reserveItem]).toEqual([first,second]);expect(s.itemsCollected).toBe(2);
 E.useItem(s);expect(s.item).toBe(second);expect(s.reserveItem).toBeNull();E.useItem(s);expect(s.item).toBeNull();
 cross(rows[3]);expect(s.item).toBeTruthy();expect(s.itemsCollected).toBe(3);expect(s.coins).toBe(0);
 }
});
test('reserve HUD and course switching preserve the play and reward lifecycle',async({page})=>{
 await page.goto('/turbo-kart.html');await page.evaluate(()=>{Arcade.countdown=fn=>fn();const create=TurboKartEngine.create;TurboKartEngine.create=(...args)=>(window.energyState=create(...args));});
 await page.locator('#startButton').click();await page.evaluate(()=>{energyState.item='shield';energyState.reserveItem='boost';});
 await expect(page.locator('#reserveItem')).toHaveText('NEXT: Turbo Cell');await page.locator('#itemButton').click();await expect(page.locator('#itemName')).toHaveText('Turbo Cell');await expect(page.locator('#reserveItem')).toHaveText('RESERVE EMPTY');
 await page.evaluate(()=>{energyState.ended=true;});await expect(page.locator('#kartChooseCourse')).toBeVisible();const plays=await page.locator('#plays').textContent(),balance=await page.locator('#balance').textContent();
 await page.locator('#kartChooseCourse').click();await expect(page.locator('dialog.game-result-dialog')).not.toBeVisible();await page.locator('[data-course="garden"]').click();await expect(page.locator('#plays')).toHaveText(plays);await expect(page.locator('#balance')).toHaveText(balance);await expect(page.locator('[data-course="garden"]')).toHaveAttribute('aria-pressed','true');
});
