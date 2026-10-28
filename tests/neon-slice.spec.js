const {test,expect}=require('@playwright/test');
const {Game}=require('../neon-slice-engine');
test('slicing scores each fruit once, combos once, and bombs end the run',()=>{const g=new Game(()=>.5);g.start();g.items=[{x:80,y:100,r:24,type:0},{x:160,y:100,r:24,type:1}];g.slice({x:10,y:100},{x:210,y:100});expect(g.score).toBe(20);expect(g.endStroke()).toBeNull();g.endStroke();g.slice({x:10,y:100},{x:210,y:100});expect(g.score).toBe(20);g.items=[{x:100,y:100,r:24,bomb:true}];g.slice({x:0,y:100},{x:200,y:100});expect(g.state).toBe('over');expect(g.continue()).toBe(true);expect(g.score).toBe(20);g.end('Bomb hit');expect(g.continue()).toBe(false);});
test('simulation ends after three misses, pauses safely, ramps and stays bounded',()=>{const g=new Game(()=>.5);g.start();g.pause();g.step(.04);expect(g.time).toBe(0);g.resume();for(let i=0;i<2000&&g.state==='running';i++)g.step(.04);expect(g.state).toBe('over');expect(g.misses).toBeGreaterThanOrEqual(3);expect(g.items.length).toBeLessThan(20);g.start();g.time=90;g.spawn();expect(g.items).toHaveLength(4);expect(g.items.every(x=>Number.isFinite(x.vy))).toBe(true);});
test.beforeEach(async({page})=>{await page.route('https://**',r=>r.abort());await page.addInitScript(()=>localStorage.setItem('arcadeOnboardingSeen','1'));});
test('signed-out free play starts, pauses and resumes without economy changes',async({page})=>{await page.goto('/neon-slice.html');const before=await page.evaluate(()=>({coins:localStorage.getItem('points'),plays:localStorage.getItem('plays')}));await page.getByRole('button',{name:'Play free',exact:true}).click();await expect(page.locator('#sliceOverlay')).toBeHidden();await page.getByRole('button',{name:'Pause',exact:true}).click();await expect(page.locator('#sliceHeading')).toHaveText('Paused');await page.locator('#sliceStart').click();await expect(page.locator('#sliceOverlay')).toBeHidden();await expect(page.locator('#sliceContinue')).toBeHidden();expect(await page.evaluate(()=>({coins:localStorage.getItem('points'),plays:localStorage.getItem('plays')}))).toEqual(before);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(()=>innerWidth));});
test('public game is listed, indexable and mirrored',async({request})=>{for(const f of ['neon-slice.html','neon-slice.js','neon-slice.css','neon-slice-engine.js','neon-slice-rewards.js','neon-slice-presentation.js']){const a=await request.get('/'+f),b=await request.get('/www/'+f);expect(a.ok()).toBe(true);expect(await a.text()).toBe(await b.text());}expect(await(await request.get('/neon-slice.html')).text()).not.toContain('noindex,nofollow');expect(await(await request.get('/games.html')).text()).toContain('neon-slice');});
test('a real drag cuts airborne fruit and keeps a local best after misses',async({page})=>{await page.addInitScript(()=>{Math.random=()=>.5;});await page.goto('/neon-slice.html');await page.evaluate(()=>{const start=NeonSliceEngine.Game.prototype.start;NeonSliceEngine.Game.prototype.start=function(){start.call(this);window.__observedGame=this;};});await page.locator('#sliceStart').click();const box=await page.locator('#sliceCanvas').boundingBox();await page.waitForFunction(()=>window.__observedGame.items.some(o=>!o.bomb&&o.y<400&&o.y>200));await page.mouse.move(box.x+box.width/2,box.y+20);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height-10,{steps:8});await page.mouse.up();await expect.poll(async()=>Number(await page.locator('#sliceScore').innerText())).toBeGreaterThanOrEqual(10);await expect(page.locator('#sliceOverlay')).toBeVisible({timeout:15000});expect(Number(await page.locator('#sliceBest').innerText())).toBeGreaterThanOrEqual(10);await page.reload();expect(Number(await page.locator('#sliceBest').innerText())).toBeGreaterThanOrEqual(10);});
test('ad continue requires an earned reward and is offered once per run',async({page})=>{test.setTimeout(45000);await page.goto('/neon-slice.html');await page.evaluate(()=>{window.EarnlyNativeAds={isNative:true,showRewarded:async()=>({earned:window.__earned===true})};});await page.locator('#sliceStart').click();await expect(page.locator('#sliceContinue')).toBeVisible({timeout:16000});await page.locator('#sliceContinue').click();await page.getByRole('button',{name:'📺 Watch Ad · Continue',exact:true}).click();await expect(page.getByText('Ad closed without a reward.',{exact:false})).toBeVisible();await expect(page.locator('#sliceOverlay')).toBeVisible();await page.evaluate(()=>{window.__earned=true;});await page.getByRole('button',{name:'📺 Watch Ad · Continue',exact:true}).click();await expect(page.locator('#sliceOverlay')).toBeHidden();await expect(page.locator('#sliceMisses')).toHaveText('0 / 3');await expect(page.locator('#sliceOverlay')).toBeVisible({timeout:16000});await expect(page.locator('#sliceContinue')).toBeHidden();});
test('phone arena preserves round fruit and visible controls',async({page})=>{for(const [width,height] of [[320,568],[390,664],[440,844]]){await page.setViewportSize({width,height});await page.goto('/neon-slice.html');const c=await page.locator('#sliceCanvas').boundingBox();expect(c.width/c.height).toBeCloseTo(2/3,1);await expect(page.locator('#sliceStart')).toBeInViewport();await expect(page.locator('#slicePause')).toBeInViewport();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}await page.screenshot({path:'test-results/neon-slice-preview.png'});});
test('transient window blur does not pause swiping, but backgrounding does',async({page})=>{
  await page.goto('/neon-slice.html');await page.locator('#sliceStart').click();
  await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));});
  await expect(page.locator('#sliceOverlay')).toBeHidden();
  await expect(page.locator('#slicePause')).toHaveText('Pause');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.locator('#sliceHeading')).toHaveText('Paused');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.locator('#sliceOverlay')).toBeVisible();
  await page.locator('#sliceStart').click();await expect(page.locator('#sliceOverlay')).toBeHidden();
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  await expect(page.locator('#sliceHeading')).toHaveText('Paused');
});
test('rare burgers score 50 once; regular ingredients score 10 and bombs override bonuses',()=>{
 const g=new Game(()=>.5);g.start();g.items=[{x:80,y:100,r:24,type:7},{x:160,y:100,r:24,type:5}];
 g.slice({x:0,y:100},{x:220,y:100});expect(g.score).toBe(60);g.slice({x:0,y:100},{x:220,y:100});expect(g.score).toBe(60);
 expect(g.endStroke()).toBeNull();g.items=[{x:80,y:100,r:24,type:7,bomb:true}];g.slice({x:0,y:100},{x:220,y:100});expect(g.score).toBe(60);expect(g.state).toBe('over');
 let seed=12345;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const sim=new Game(random);sim.start();let bonus=0,total=0;const kinds=new Set();for(let i=0;i<1000;i++){sim.items=[];sim.spawn();for(const item of sim.items){if(!item.bomb){total++;if(item.type===7)bonus++;else kinds.add(item.type);}}}expect(bonus/total).toBeGreaterThan(.03);expect(bonus/total).toBeLessThan(.09);expect(kinds.size).toBe(11);
});
test('public catalog supports discovery and favorites without spending plays',async({page})=>{
 await page.goto('/games.html');const card=page.locator('[data-game="neonSlice"]');await expect(card).toBeVisible();await expect(card.getByRole('link',{name:/Play Neon Slice/})).toHaveAttribute('href','neon-slice.html');await expect(card).toContainText('Earn up to 30 Coins');
 await card.getByRole('button').click();await page.reload();expect(await page.evaluate(()=>localStorage.getItem('neonSliceCatalogFavorite'))).toBe('1');
});
test('results show readable run totals and preserve best score',async({page})=>{
 await page.goto('/neon-slice.html');await page.evaluate(()=>{NeonSliceEngine.Game.prototype.step=function(){this.score=80;this.sliced=4;this.burgers=1;this.bestCombo=3;this.end('Bomb hit');};});await page.locator('#sliceStart').click();await expect(page.locator('#sliceStats')).toBeVisible();await expect(page.locator('#sliceResultScore')).toHaveText('80');await expect(page.locator('#sliceResultBurgers')).toHaveText('1');await expect(page.locator('#sliceHeading')).toHaveText('New personal best!');await page.setViewportSize({width:320,height:568});await expect(page.locator('#sliceStart')).toBeInViewport();
});
test('signed-in result applies only the server wallet and shows verified Coins',async({page})=>{
 await page.goto('/neon-slice.html');
 await page.evaluate(()=>{window.__claims=[];window.NeonSliceRewards={retry:async()=>[],start:async()=>({id:'round',seed:17,userId:'user',remaining:3}),claim:async(round,events,ticks)=>{window.__claims.push({round,events,ticks});return {amount:24,remaining:2,wallet:{balance:'124'}};}};NeonSliceEngine.Game.prototype.step=function(){this.score=1200;this.sliced=81;this.burgers=4;this.end('Bomb hit');};});
 await page.locator('#sliceStart').click();await expect(page.locator('#sliceReward')).toHaveText('+24 Arcade Coins · 2 rewarded runs left today');
 await expect(page.locator('#sliceReward')).toBeInViewport();expect(await page.evaluate(()=>window.__claims.length)).toBe(1);
 await expect(page.locator('#sliceResultScore')).toHaveText('1200');
 await page.screenshot({path:'test-results/neon-slice-reward-result.png'});
});
test('failed claim remains pending and retry is explicit',async({page})=>{
 await page.goto('/neon-slice.html');await page.evaluate(()=>{window.NeonSliceRewards={retry:async()=>[],start:async()=>({id:'round',seed:17,userId:'user',remaining:3}),claim:async()=>{throw Error('CONNECTION');}};NeonSliceEngine.Game.prototype.step=function(){this.score=100;this.end('Bomb hit');};});
 await page.locator('#sliceStart').click();await expect(page.locator('#sliceReward')).toContainText('Reward pending');await expect(page.locator('#sliceRetry')).toBeVisible();await page.locator('#sliceRetry').click();await expect(page.locator('#sliceReward')).toContainText('No pending rewards for this account');
});
test('recorded signed-in swipe and pause inputs replay to the exact displayed score',async({page})=>{
 await page.goto('/neon-slice.html');await page.evaluate(()=>{const start=NeonSliceEngine.Game.prototype.start;NeonSliceEngine.Game.prototype.start=function(){start.call(this);window.__observedGame=this;};window.NeonSliceRewards={retry:async()=>[],start:async()=>({id:'round',seed:17,userId:'user',remaining:3}),claim:async(round,events,ticks)=>{const r=NeonSliceEngine.verify(round.seed,events,ticks);window.__verifiedRun={...r,events};return {amount:r.coins,remaining:3-(r.coins>0?1:0)};}};});
 await page.locator('#sliceStart').click();const box=await page.locator('#sliceCanvas').boundingBox();
 await page.waitForFunction(()=>window.__observedGame.items.some(o=>!o.bomb&&o.y<380&&o.y>300));await page.mouse.move(box.x+2,box.y+box.height*.64);await page.mouse.down();await page.mouse.move(box.x+box.width-2,box.y+box.height*.64,{steps:12});await page.mouse.up();expect(Number(await page.locator('#sliceScore').innerText())).toBeGreaterThan(0);
 await page.mouse.move(box.x+5,box.y+5);await page.mouse.down();await page.mouse.move(box.x+35,box.y+5,{steps:5});await page.mouse.up();
 await page.locator('#slicePause').click();await page.locator('#sliceStart').click();await expect(page.locator('#sliceStats')).toBeVisible({timeout:16000});
 await expect.poll(()=>page.evaluate(()=>window.__verifiedRun?.score)).toBe(Number(await page.locator('#sliceResultScore').innerText()));await expect(page.locator('#sliceRetry')).toBeHidden();expect(await page.evaluate(()=>window.__verifiedRun.events.some(e=>e.length===5&&e[2]<20&&e[4]<20))).toBe(true);
});

test('cookout sound is opt-in, persists, and the spatula draws during a real swipe',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/neon-slice.html');await expect(page.locator('#sliceSound')).toHaveAttribute('aria-pressed','false');
 await page.locator('#sliceSound').click();await expect(page.locator('#sliceSound')).toHaveAttribute('aria-pressed','true');
 await page.reload();await expect(page.locator('#sliceSound')).toHaveText('Sound on');
 await page.evaluate(()=>{window.__spatulas=0;const draw=NeonSlicePresentation.spatula;NeonSlicePresentation.spatula=(...args)=>{window.__spatulas++;draw(...args);};});
 await page.locator('#sliceStart').click();const b=await page.locator('#sliceCanvas').boundingBox();
 await page.mouse.move(b.x+30,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width-30,b.y+b.height/2,{steps:12});
 await expect.poll(()=>page.evaluate(()=>window.__spatulas)).toBeGreaterThan(0);await page.mouse.up();
 await page.locator('#sliceSound').click();await expect(page.locator('#sliceSound')).toHaveText('Sound off');
 expect(errors).toEqual([]);
 await page.screenshot({path:test.info().outputPath('cookout.png')});
});

test('short swipes reward groups once and expire without lifting a finger',()=>{
 const g=new Game(()=>.5);g.start();g.nextWave=100;
 const food=(x,y=100)=>({x,y,r:8,type:0,vx:0,vy:0,angle:0,spin:0});
 g.items=[food(40),food(80),food(120)];g.slice({x:10,y:100},{x:150,y:100});
 expect(g.score).toBe(30);for(let i=0;i<4;i++)g.step(.04);
 expect(g.completedCombos).toEqual([{hits:3,bonus:10}]);expect(g.score).toBe(40);expect(g.endStroke()).toBeNull();
 // New waves under the same held pointer never join the previous group.
 for(let wave=0;wave<25;wave++){g.items=[food(200)];g.slice({x:160,y:100},{x:240,y:100});for(let i=0;i<5;i++)g.step(.04);}
 expect(g.bestCombo).toBe(3);expect(g.score).toBe(290);
});
test('stationary holds, reversals and prolonged scribbles cannot build a mega combo',()=>{
 const g=new Game(()=>.5);g.start();g.nextWave=100;
 const food=x=>({x,y:100,r:3,type:0});
 g.items=[food(40)];expect(g.slice({x:40,y:100},{x:40,y:100})).toEqual([]);expect(g.score).toBe(0);
 g.items=[food(40),food(70)];g.slice({x:10,y:100},{x:90,y:100});
 g.items=[food(40)];g.slice({x:90,y:100},{x:10,y:100});expect(g.endStroke()).toBeNull();expect(g.bestCombo).toBe(0);
 // Continuously moving for longer than the half-second window splits the combo.
 for(let i=0;i<30;i++){g.items=[food(20+i*5)];g.slice({x:16+i*5,y:100},{x:24+i*5,y:100});g.items=[];g.step(.04);}
 g.endStroke();expect(g.bestCombo).toBeLessThanOrEqual(13);
 // A bomb in the same cut still cancels that cut's combo bonus.
 g.start();g.items=[food(40),food(70),food(100),{...food(130),bomb:true}];g.slice({x:10,y:100},{x:160,y:100});expect(g.score).toBe(30);expect(g.endStroke()).toBeNull();expect(g.state).toBe('over');
});
test('one held pointer across new food groups produces separate combos',async({page})=>{
 await page.goto('/neon-slice.html');await page.evaluate(()=>{const start=NeonSliceEngine.Game.prototype.start;NeonSliceEngine.Game.prototype.start=function(){start.call(this);this.nextWave=100;window.__comboGame=this;};});
 await page.locator('#sliceStart').click();const box=await page.locator('#sliceCanvas').boundingBox();
 const place=()=>page.evaluate(()=>{window.__comboGame.items=[80,180,280].map(x=>({x,y:240,r:20,type:0,vx:0,vy:0,angle:0,spin:0}));});
 await place();await page.mouse.move(box.x+box.width*.1,box.y+box.height*240/540);await page.mouse.down();await page.mouse.move(box.x+box.width*.9,box.y+box.height*240/540,{steps:8});
 await expect(page.locator('#sliceCombo')).toHaveText('3 item combo! +10');
 // Keep the pointer down while another group arrives, then reverse the swipe.
 await place();await page.mouse.move(box.x+box.width*.1,box.y+box.height*240/540,{steps:8});
 await expect(page.locator('#sliceScore')).toHaveText('80');await page.mouse.up();
 expect(await page.evaluate(()=>window.__comboGame.bestCombo)).toBe(3);
});
test('formations stay separated near the apex and cut halves follow the swipe',()=>{
 const g=new Game(()=>.5);g.start();g.time=60;
 const shapes=[];for(let wave=0;wave<3;wave++){g.items=[];g.spawn();expect(g.items).toHaveLength(4);shapes.push(g.items.map(o=>o.vy));const apex=g.items.map(o=>({x:o.x+o.vx,y:o.y+o.vy+265,r:o.r}));for(let i=1;i<apex.length;i++)expect(Math.hypot(apex[i].x-apex[i-1].x,apex[i].y-apex[i-1].y)).toBeGreaterThan(apex[i].r+apex[i-1].r);}
 expect(new Set(shapes.map(s=>JSON.stringify(s))).size).toBe(3);
 g.items=[{x:100,y:100,r:25,type:1,angle:0}];g.slice({x:100,y:40},{x:100,y:160});
 const halves=g.effects.filter(e=>e.half);expect(halves).toHaveLength(2);expect(halves[0].vx*halves[1].vx).toBeLessThan(0);expect(halves[0].localCutAngle).toBeCloseTo(Math.PI/2);
 expect(g.effects.filter(e=>!e.half)).toHaveLength(10);expect(g.effects.every(e=>e.type===1)).toBe(true);
 g.items=[];g.nextWave=100;for(let i=0;i<25;i++)g.step(.04);expect(g.effects).toHaveLength(2);expect(g.effects.every(e=>e.y>350&&e.stillY>350)).toBe(true);for(let i=0;i<10;i++)g.step(.04);expect(g.effects).toHaveLength(0);
});
test('bomb cue is visible without sound, warns once and hides while paused',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/neon-slice.html');
 await page.evaluate(()=>{const start=NeonSliceEngine.Game.prototype.start;NeonSliceEngine.Game.prototype.start=function(){start.call(this);this.nextWave=100;this.items=[{id:99,x:270,y:230,r:25,bomb:true,vx:0,vy:0,angle:0,spin:0},{id:100,x:70,y:220,r:25,type:1,vx:0,vy:0,angle:0,spin:0},{id:101,x:135,y:220,r:25,type:7,vx:0,vy:0,angle:0,spin:0}];};window.__warnings=0;NeonSlicePresentation.warning=()=>window.__warnings++;});
 await page.locator('#sliceStart').click();await expect(page.locator('#sliceWarning')).toBeVisible();expect(await page.evaluate(()=>window.__warnings)).toBe(0);
 await page.screenshot({path:test.info().outputPath('bomb-cue.png')});
 await page.locator('#slicePause').click();await expect(page.locator('#sliceWarning')).toBeHidden();
 await page.reload();await page.evaluate(()=>{const start=NeonSliceEngine.Game.prototype.start;NeonSliceEngine.Game.prototype.start=function(){start.call(this);this.nextWave=100;this.items=[{id:1,x:270,y:200,r:25,bomb:true,vx:0,vy:0,angle:0,spin:0}];};window.__warnings=0;NeonSlicePresentation.warning=()=>window.__warnings++;});
 await page.locator('#sliceSound').click();await page.locator('#sliceStart').click();await expect.poll(()=>page.evaluate(()=>window.__warnings)).toBe(1);await page.waitForTimeout(150);expect(await page.evaluate(()=>window.__warnings)).toBe(1);
});
for(const motion of ['reduce','no-preference'])test('cut halves remain visible with motion '+motion,async({page})=>{
 await page.emulateMedia({reducedMotion:motion});await page.goto('/neon-slice.html');
 await page.evaluate(()=>{const start=NeonSliceEngine.Game.prototype.start;NeonSliceEngine.Game.prototype.start=function(){start.call(this);this.items=[{id:1,x:180,y:240,r:28,type:1,angle:0,spin:0,vx:0,vy:0}];window.__cutGame=this;};window.__advanceCut=NeonSliceEngine.Game.prototype.step;NeonSliceEngine.Game.prototype.step=function(){};const clip=CanvasRenderingContext2D.prototype.clip;window.__halfClips=0;window.__halfYs=[];CanvasRenderingContext2D.prototype.clip=function(...args){window.__halfClips++;window.__halfYs.push(this.getTransform().f);return clip.apply(this,args);};});
 await page.locator('#sliceStart').click();const box=await page.locator('#sliceCanvas').boundingBox();
 await page.mouse.move(box.x+box.width*.2,box.y+box.height*240/540);await page.mouse.down();await page.mouse.move(box.x+box.width*.8,box.y+box.height*240/540,{steps:5});await page.mouse.up();
 await expect(page.locator('#sliceScore')).toHaveText('10');await expect.poll(()=>page.evaluate(()=>window.__halfClips)).toBeGreaterThan(1);
 const halves=await page.evaluate(()=>window.__cutGame.effects.filter(e=>e.half));expect(halves).toHaveLength(2);expect(Math.abs(halves[0].stillY-halves[1].stillY)).toBe(18);
 const before=await page.evaluate(()=>window.__halfYs.slice(-2));
 await page.evaluate(()=>{for(let i=0;i<12;i++)window.__advanceCut.call(window.__cutGame,.04);window.__halfYs=[];});
 await expect.poll(()=>page.evaluate(()=>window.__halfYs.length)).toBeGreaterThan(1);
 const after=await page.evaluate(()=>window.__halfYs.slice(-2));for(let i=0;i<2;i++)expect(after[i]-before[i]).toBeGreaterThan(20);
 const paused=await page.evaluate(()=>{const g=window.__cutGame;g.pause();const y=g.effects.map(e=>e.stillY);window.__advanceCut.call(g,.04);return JSON.stringify(y)===JSON.stringify(g.effects.map(e=>e.stillY));});expect(paused).toBe(true);
 await page.screenshot({path:test.info().outputPath('cut-'+motion+'.png')});
});

test('difficulty ramps gradually with bounded trajectories and separated hazards',()=>{
 const early=new Game(()=>.5);early.start();early.step(.04);early.nextWave=0;early.step(.04);
 const late=new Game(()=>.5);late.start();late.time=110;late.nextWave=0;late.step(.04);
 expect(early.nextWave).toBeGreaterThan(late.nextWave);expect(early.items.every(x=>!x.bomb&&x.gravity===530)).toBe(true);expect(late.items.every(x=>x.gravity===720)).toBe(true);
 let hazards=0;const violations=[];
 for(let seed=1;seed<=20;seed++){
  let n=seed;const g=new Game(()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;});g.start();
  for(let frame=0;frame<3000;frame++){
   g.items=g.items.filter(o=>o.y<=540||o.vy<0);g.step(.04);
   if(g.state!=='running'||g.items.length>=24)violations.push('unbounded wave');
   const visible=g.items.filter(o=>o.y>0&&o.y<540);
   for(const o of visible){if(o.x<=o.r||o.x>=360-o.r)violations.push('offscreen target');if(g.time<12&&o.bomb)violations.push('early bomb');}
   for(const bomb of visible.filter(o=>o.bomb)){hazards++;for(const food of visible.filter(o=>!o.bomb&&Math.abs(o.vy)<80))if(Math.hypot(bomb.x-food.x,bomb.y-food.y)<=bomb.r+food.r)violations.push('blocked apex');}
  }
 }
 expect(hazards).toBeGreaterThan(100);expect(violations).toEqual([]);
});
for(const reason of ['Bomb hit','Three ingredients missed'])test('results explain '+reason+' and clear the arena without losing the best',async({page})=>{
 await page.setViewportSize({width:390,height:750});await page.goto('/neon-slice.html');
 await page.evaluate(()=>{const start=NeonSliceEngine.Game.prototype.start;NeonSliceEngine.Game.prototype.start=function(){start.call(this);window.__resultGame=this;};});
 await page.locator('#sliceStart').click();await page.evaluate(reason=>{const g=window.__resultGame;g.score=1665;g.sliced=105;g.nextWave=100;g.items=[{x:180,y:reason==='Bomb hit'?240:630,r:25,type:1,bomb:reason==='Bomb hit',vx:0,vy:0,angle:0,spin:0}];g.effects=[{x:180,y:240,life:1,type:1,vx:0,vy:0}];if(reason!=='Bomb hit')g.misses=2;},reason);
 if(reason==='Bomb hit'){const box=await page.locator('#sliceCanvas').boundingBox();await page.mouse.move(box.x+box.width*.2,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.8,box.y+box.height*.45,{steps:4});await page.mouse.up();}
 await expect(page.locator('#sliceHeading')).toHaveText('New personal best!');await expect(page.locator('#sliceMessage')).toHaveText(reason==='Bomb hit'?'You hit a bomb. Watch for the glowing fuse.':'You missed three ingredients. Aim for short, precise swipes.');
 expect(await page.evaluate(()=>({items:window.__resultGame.items.length,effects:window.__resultGame.effects.length,best:localStorage.getItem('neonSlicePreviewBest')}))).toEqual({items:0,effects:0,best:'1665'});
 await expect(page.locator('#sliceStart')).toBeInViewport();await page.screenshot({path:test.info().outputPath('results.png')});
 await expect(page.locator('#sliceQuit')).toBeEnabled();
 page.on('dialog',()=>{throw new Error('Finished runs must quit without confirmation');});
 await page.locator('#sliceQuit').click({noWaitAfter:true});
 await expect(page).toHaveURL(/games\.html$/);
 await page.locator('#sliceStart').click();await expect(page.locator('#sliceOverlay')).toBeHidden();await expect(page.locator('#sliceBest')).toHaveText('1665');await expect(page.locator('#sliceScore')).toHaveText('0');
});
