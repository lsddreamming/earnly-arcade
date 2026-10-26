const {test,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const E=require('../bubble-pop-engine');
const fs=require('node:fs');
// Practice fixtures isolate the auth client so its own randomness cannot advance the seeded board RNG.
test.beforeEach(async({page})=>{await page.route('**/crystal-command-vendor.js',route=>route.fulfill({contentType:'application/javascript',body:'window.CrystalSupabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}})}})};'}));});
const rng=seed=>()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
function solution(level,win=true){for(let seed=1;seed<=150;seed++){const g=E.create(rng(seed),level),steps=[],choose=rng(seed+9000);while(!g.state().done){const available=g.legalMoves(),move=available[Math.floor(choose()*available.length)];steps.push(move);g.swap(...move);}if((g.state().status==='won')===win)return {seed,steps};}throw Error('No fixture '+level);}
function fixture(changes){const colors=Array.from({length:56},(_,i)=>(i%7+Math.floor(i/7)*2)%5);for(const [i,c] of Object.entries(changes))colors[i]=c;let n=0;const r=rng(9);return E.create(()=>n<56?(colors[n++]+.1)/5:r());}

test('rules: invalid swaps are atomic; three, four, five and T matches create distinct outcomes',()=>{
 const g=E.create(rng(3)),before=g.state();for(const pair of [[-1,0],[1.5,2],[0,55],[6,7]]){assert.equal(g.swap(...pair).valid,false);assert.deepEqual(g.state(),before);}
 const legal=g.legalMoves();let rejected=false;for(let i=0;i<56&&!rejected;i++)for(const j of E.neighbors(i)){if(legal.some(p=>p.includes(i)&&p.includes(j)))continue;assert.equal(g.swap(i,j).valid,false);assert.deepEqual(g.state(),before);rejected=true;break;}assert(rejected);
 for(const [changes,pair,power] of [
  [{28:3,29:3,30:1,23:3},[23,30],null],
  [{28:3,29:3,30:1,31:3,23:3},[23,30],'horizontal'],
  [{28:3,29:3,30:1,31:3,32:3,23:3},[23,30],'prism'],
  [{29:3,30:1,31:3,23:3,37:3,44:3},[23,30],'bomb']
 ]){const f=fixture(changes);assert.equal(E.matches(f.state().board).length,0);const r=f.swap(...pair);assert(r.valid);const specials=r.waves[0].board.filter(c=>c.power);if(power)assert(specials.some(c=>c.power===power),JSON.stringify(specials));else assert.equal(specials.length,0);assert.equal(r.moves,21);}
});

test('rules: power combination chains once, cascades cost one move, assistance is explicit and bounded',()=>{
 const g=E.create(rng(8),4),before=g.state(),r=g.swap(49,50);assert(r.valid);assert.equal(r.powerCombo,'rocket-bomb');assert.equal(r.moves,before.moves-1);assert(r.count>=21);assert(r.waves.length>=1);
 for(const wave of r.waves){assert.equal(new Set(wave.cleared).size,wave.cleared.length);assert.equal(new Set(wave.blasts.map(b=>b.index)).size,wave.blasts.length);}
 const a=E.create(rng(51)),b=E.create(rng(51));const original=a.state();assert(a.assist());assert.equal(a.state().moves,original.moves+3);assert.equal(a.assist(),false);assert.deepEqual(a.state().board,b.state().board);
 const move=a.legalMoves()[0],x=a.swap(...move),y=b.swap(...move);assert.deepEqual(x.board,y.board);assert.equal(x.score,y.score);assert.equal(x.moves,y.moves+3);assert.equal(x.assisted,true);
});

test('rules: final-move wins, terminal states, retry isolation and final campaign boundary',()=>{
 let finalWin=false;for(let seed=1;seed<=150&&!finalWin;seed++){const g=E.create(rng(seed));while(!g.state().done){const r=g.swap(...g.legalMoves()[0]);if(r.status==='won'&&r.moves===0)finalWin=true;}}assert(finalWin);
 for(const level of [0,5,999]){const f=solution(level),g=E.create(rng(f.seed),level);assert.equal(g.next(),false);for(const move of f.steps)g.swap(...move);const end=g.state();assert.equal(end.status,'won');assert.equal(g.swap(0,1).valid,false);assert.equal(g.assist(),false);assert.deepEqual(g.state(),end);if(level===999)assert.equal(g.next(),false);else {assert.equal(g.next().level,level+1);const score=g.state().score;g.swap(...g.legalMoves()[0]);g.restart();assert.equal(g.state().score,score);}}
});

test('rules: root and packaged preview sources are identical',()=>{for(const file of ['bubble-pop-engine.js','bubble-pop.js','bubble-pop.css','bubble-pop.html','bubble-pop-rewards.js'])assert.equal(fs.readFileSync(file,'utf8'),fs.readFileSync('www/'+file,'utf8'));});

async function setup(page,{level=0,seed=3,reduced=true,path='/bubble-pop.html'}={}){
 await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
 await page.addInitScript(({level,seed})=>{let n=seed;Math.random=()=>((n=Math.imul(n,1664525)+1013904223>>>0)/4294967296);if(localStorage.getItem('earnlyBubblePopLevel')===null)localStorage.setItem('earnlyBubblePopLevel',String(level));localStorage.setItem('points','123');localStorage.setItem('arcadePlays','untouched');window.framesRequested=0;const raf=requestAnimationFrame;window.requestAnimationFrame=fn=>{window.framesRequested++;return raf(fn);};},{level,seed});
 await page.goto(path);await page.locator('#play').click();return E.create(rng(seed),level);
}
async function cellPoint(page,i){const b=await page.locator('#board').boundingBox(),size=Math.min((b.width-12)/7,(b.height-12)/8);return {x:(b.width-size*7)/2+(i%7+.5)*size,y:(b.height-size*8)/2+(Math.floor(i/7)+.5)*size};}
async function tapSwap(page,a,b){for(const i of [a,b]){const p=await cellPoint(page,i);if(await page.evaluate(()=>navigator.maxTouchPoints>0)){const box=await page.locator('#board').boundingBox();await page.touchscreen.tap(box.x+p.x,box.y+p.y);}else await page.locator('#board').click({position:p});}}
async function gesture(page,a,b,cancel=false){const box=await page.locator('#board').boundingBox(),start=await cellPoint(page,a),end=await cellPoint(page,b);await page.locator('#board').dispatchEvent('pointerdown',{pointerId:7,clientX:box.x+start.x,clientY:box.y+start.y,pointerType:'touch'});await page.locator('#board').dispatchEvent(cancel?'pointercancel':'pointerup',{pointerId:7,clientX:box.x+end.x,clientY:box.y+end.y,pointerType:'touch'});}

test('touch: tap neighbors and swipe each spend one move; cancellation, pause, restart and quit are safe',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const g=await setup(page),first=g.legalMoves()[0];await page.locator('#hint').click();await expect(page.locator('#moves')).toHaveText('22');await expect(page.locator('#feedback')).toContainText('outlined');await gesture(page,...first,true);await expect(page.locator('#moves')).toHaveText('22');await tapSwap(page,...first);g.swap(...first);await expect(page.locator('#moves')).toHaveText('21');const second=g.legalMoves()[0];await gesture(page,...second);g.swap(...second);await expect(page.locator('#moves')).toHaveText('20');
 await page.locator('#pause').click();await expect(page.locator('#resultTitle')).toHaveText('Take a breather.');await page.locator('#play').click();await page.locator('#restart').click();await page.locator('#cancel').click();await expect(page.locator('#moves')).toHaveText('20');await page.locator('#restart').click();await page.locator('#play').click();await expect(page.locator('#moves')).toHaveText('22');await expect(page.locator('#score')).toHaveText('0');
 await page.getByRole('link',{name:'Quit',exact:true}).click();await page.locator('#cancel').click();await expect(page.locator('#overlay')).toBeHidden();expect(errors).toEqual([]);expect(await page.evaluate(()=>[localStorage.getItem('points'),localStorage.getItem('arcadePlays')])).toEqual(['123','untouched']);
});

test('progress: wins wait for Next, migrate checkpoint, replay unlocked levels and preserve wallet',async({page})=>{
 await page.setViewportSize({width:320,height:568});const f=solution(5);await setup(page,{level:5,seed:f.seed});await expect(page.locator('#journey')).toBeHidden();for(const move of f.steps)await tapSwap(page,...move);await expect(page.locator('#resultTitle')).toHaveText('Level cleared!');await expect(page.locator('#levelLabel')).toHaveText('LEVEL 6 / 1000');await page.waitForTimeout(450);await expect(page.locator('#levelLabel')).toHaveText('LEVEL 6 / 1000');await page.locator('#play').click();await expect(page.locator('#levelLabel')).toHaveText('LEVEL 7 / 1000');await page.reload();await expect(page.locator('#levelLabel')).toHaveText('LEVEL 7 / 1000');await expect(page.locator('#journey')).toBeVisible();await page.getByRole('button',{name:'Level 5 cleared',exact:true}).click();await expect(page.locator('#levelLabel')).toHaveText('LEVEL 5 / 1000');expect(await page.evaluate(()=>localStorage.getItem('earnlyBubblePopUnlocked'))).toBe('6');expect(await page.evaluate(()=>localStorage.getItem('points'))).toBe('123');
});

test('help: three losses offer optional free +3 retry moves and honest remaining progress',async({page})=>{
 const f=solution(0,false);await page.addInitScript(()=>localStorage.setItem('earnlyBubblePopRetries',JSON.stringify({0:2})));await setup(page,{seed:f.seed});for(const move of f.steps)await tapSwap(page,...move);await expect(page.locator('#assist')).toBeVisible();await expect(page.locator('#resultText')).toContainText('% of your goals complete');await page.locator('#assist').click();await expect(page.locator('#moves')).toHaveText('25');await expect(page.locator('#feedback')).toContainText('assisted round');await expect(page.locator('#overlay')).toBeHidden();
});

test('render: keyboard, blocked storage, reduced motion and idle rendering',async({page})=>{
 await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('blocked')};Storage.prototype.setItem=()=>{throw Error('blocked')};let n=3;Math.random=()=>((n=Math.imul(n,1664525)+1013904223>>>0)/4294967296);window.framesRequested=0;const raf=requestAnimationFrame;window.requestAnimationFrame=fn=>{window.framesRequested++;return raf(fn);};});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/bubble-pop.html');await page.locator('#play').click();const g=E.create(rng(3)),[a,b]=g.legalMoves()[0];await page.locator('#board').focus();for(let i=0;i<Math.floor(a/7);i++)await page.keyboard.press('ArrowDown');for(let i=0;i<a%7;i++)await page.keyboard.press('ArrowRight');await page.keyboard.press('Shift+'+(b-a===1?'ArrowRight':'ArrowDown'));await expect(page.locator('#moves')).toHaveText('21');const n=await page.evaluate(()=>framesRequested);await page.waitForTimeout(200);expect(await page.evaluate(()=>framesRequested)).toBe(n);
});

test('render: animated cascades lock input, settle on pause/background, and stop when idle',async({page})=>{
 const g=await setup(page,{reduced:false});const move=g.legalMoves()[0];await gesture(page,...move);await gesture(page,...move);await expect(page.locator('#moves')).toHaveText('21');await page.locator('#pause').click();await expect(page.locator('#resultTitle')).toHaveText('Take a breather.');await page.locator('#play').click();await page.waitForTimeout(100);const n=await page.evaluate(()=>framesRequested);await page.waitForTimeout(200);expect(await page.evaluate(()=>framesRequested)).toBe(n);g.swap(...move);await gesture(page,...g.legalMoves()[0]);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await expect(page.locator('#resultTitle')).toHaveText('Take a breather.');await expect(page.locator('#moves')).toHaveText('20');
});

test('layout: phone sizes, packaged source and late levels remain usable',async({page},info)=>{
 for(const [width,height] of [[390,844],[390,664],[320,568],[844,390]]){await page.setViewportSize({width,height});await page.goto('/bubble-pop.html');await page.locator('#play').click();const m=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,bottom:document.querySelector('.actions').getBoundingClientRect().bottom,height:innerHeight}));expect(m.scroll).toBeLessThanOrEqual(m.width);if(height>400)expect(m.bottom).toBeLessThanOrEqual(m.height);await page.screenshot({path:`test-results/bubble-pop-${info.project.name}-${width}x${height}.png`});}
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>localStorage.setItem('earnlyBubblePopLevel','999'));await page.goto('/www/bubble-pop.html');await expect(page.locator('#levelLabel')).toHaveText('LEVEL 1000 / 1000');await page.locator('#play').click();await page.screenshot({path:'test-results/bubble-pop-'+info.project.name+'.png',fullPage:true});await page.reload();await expect(page.locator('#levelLabel')).toHaveText('LEVEL 1000 / 1000');
});

test('opening: public free game teaches a goal match and appears in the catalog',async({page})=>{
 await setup(page);
 await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
 await expect(page.locator('#feedback')).toContainText('arrow direction');
 await expect(page.locator('#goals')).toContainText('18 left');
 await expect(page.locator('#journey')).toBeHidden();
 // The suggested move is playable, and the live goal tracks the same engine outcome.
 await page.locator('#hint').click();
 // Seed 3 has a green match when swapping row 1/2, column 4.
 await tapSwap(page,3,10);
 await expect(page.locator('#goals')).toContainText('15 left');
 await expect(page.locator('#moves')).toHaveText('21');
 await page.goto('/games.html');await expect(page.locator('[data-game="bubblePop"] a[href="bubble-pop.html"]')).toHaveText('Play · Earn Coins');
});

test('onboarding: collect, ice and star goals are introduced separately before mixed goals',()=>{
 for(let level=0;level<3;level++){const r=E.levelRules(level);expect(r.collect).toBeGreaterThan(0);expect(r.ice+r.stars).toBe(0);}
 expect(E.levelRules(3).ice).toBeGreaterThan(0);expect(E.levelRules(3).collect+E.levelRules(3).stars).toBe(0);
 // Later procedural chapters retain their original goal order and balance.
 expect(E.levelRules(7)).toMatchObject({collect:0,ice:10,stars:0,moves:26});
 expect(E.levelRules(8)).toMatchObject({collect:0,ice:0,stars:2,moves:28});
 expect(E.levelRules(4).stars).toBeGreaterThan(0);expect(E.levelRules(4).collect+E.levelRules(4).ice).toBe(0);
});
