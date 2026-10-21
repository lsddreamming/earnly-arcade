const {test,expect}=require('@playwright/test');
const E=require('../bubble-pop-engine');
const assert=require('node:assert/strict');
function rng(seed){let n=seed;return ()=>((n=Math.imul(n,1664525)+1013904223>>>0)/4294967296);}
function fixture(colors,level=0){let n=0;const random=rng(71);return E.create(()=>n<colors.length?(colors[n++]+.1)/4:random(),level);}
function pairFixture(first,second){
 const colors=Array.from({length:56},(_,i)=>(i%7+Math.floor(i/7))%2);
 for(let x=0;x<first;x++)colors[49+x]=3;
 for(let y=7-second;y<7;y++)colors[y*7+1]=2;
 return fixture(colors);
}
test('6000 seeded levels conserve stars, valid boards, move limits and terminal state',()=>{
 let turns=0,wins=0,starWins=0;
 for(let level=0;level<E.LEVELS.length;level++)for(let seed=1;seed<=1000;seed++){
  const random=rng(seed+level*1000),g=E.create(random,level);let previousScore=0;
  while(!g.state().done){
   const s=g.state(),choices=s.board.map((c,i)=>({i,size:c.power?10:g.group(i).length})).filter(c=>c.size>=2);assert(choices.length);
   const r=g.pop(choices[Math.floor(random()*choices.length)].i);assert(r.valid);assert.equal(r.moves,s.moves-1);assert(r.score>previousScore);previousScore=r.score;turns++;
   assert.equal(r.board.length,56);assert.equal(new Set(r.board.map(c=>c.id)).size,56);assert.equal(r.board.filter(c=>c.star).length+r.goals.delivered,E.LEVELS[level].stars);
   assert(r.goals.iceLeft<=s.goals.iceLeft);assert(r.goals.collected>=s.goals.collected);
   for(const c of r.board)assert(c.star||c.power||Number.isInteger(c.color)&&c.color>=0&&c.color<4);
   for(const i of r.cleared)assert(i>=0&&i<56&&!r.old[i].star);
   assert.equal(r.falls.length,56);
  }
  const end=g.state();assert.equal(g.pop(0).valid,false);assert.deepEqual(g.state(),end);
  if(end.status==='won'){wins++;if(level===2)starWins++;assert(end.goals.collected>=end.goals.collect);assert.equal(end.goals.iceLeft,0);assert.equal(end.goals.delivered,end.goals.stars);}else assert.equal(end.moves,0);
  g.restart();assert.equal(g.state().moves,E.LEVELS[level].moves);assert.equal(g.state().score,0);
 }
 assert(wins>0);assert(starWins>0);console.log(`Bubble Pop: 6000 seeded levels, ${turns} turns, ${wins} random-policy wins, ${starWins} star-level wins.`);
});
test('adjacent powers combine, chain once and consume exactly one move',()=>{
 for(const [a,b,combo] of [[5,5,'double-rocket'],[7,5,'rocket-bomb'],[7,7,'double-bomb']]){
  const g=pairFixture(a,b),first=g.pop(49);assert.equal(first.createdPower,a===7?'bomb':'vertical');
  const second=g.pop(50);assert.equal(second.createdPower,b===7?'bomb':'horizontal');
  const before=g.state(),r=g.pop(49);assert.equal(r.powerCombo,combo);assert.equal(r.moves,before.moves-1);assert(r.count>=10);assert(r.detonated>=2);assert.equal(new Set(r.cleared).size,r.cleared.length);
 }
});
test('normal pops create powers, single powers clear their whole row or column',()=>{
 const g=pairFixture(5,5);g.pop(49);const r=g.pop(49);assert.equal(r.powerCombo,null);assert.equal(r.detonated,1);assert.equal(r.count,8);assert(r.cleared.every(i=>i%7===0));
 const colors=Array(56).fill(0),all=fixture(colors);assert.equal(all.pop(10).createdPower,'bomb');assert.equal(all.state().board.filter(c=>c.power).length,1);
});
test('invalid taps do not spend moves; final-move wins and next-level/retry scoring are correct',()=>{
 const g=E.create(()=>.8);const before=g.state();assert.equal(g.pop(-1).valid,false);assert.equal(g.pop(1.5).valid,false);assert.deepEqual(g.state(),before);
 const win=g.pop(0);assert.equal(win.status,'won');assert.equal(g.pop(0).valid,false);const next=g.next();assert.equal(next.level,1);assert.equal(next.score,win.score);g.pop(0);g.restart();assert.equal(g.state().score,win.score);
 const stars=E.create(rng(5),2),i=stars.state().board.findIndex(c=>c.star),starState=stars.state();assert.equal(stars.pop(i).valid,false);assert.deepEqual(stars.state(),starState);
 // Search deterministic real rounds for a last-move win, not a synthetic status override.
 let found=false;
 for(let seed=1;seed<1000&&!found;seed++){const random=rng(seed),run=E.create(random);while(!run.state().done){const s=run.state(),choices=s.board.map((c,i)=>c.power||run.group(i).length>=2?i:-1).filter(i=>i>=0);const r=run.pop(choices[Math.floor(random()*choices.length)]);if(r.status==='won'&&r.moves===0)found=true;}}
 assert(found);
});
async function setup(page){await page.addInitScript(()=>{Math.random=()=>0;localStorage.setItem('points','123');localStorage.setItem('arcadePlays','untouched');});await page.goto('/bubble-pop.html');await page.getByRole('button',{name:'Let’s play'}).click();}
async function firstCell(page){const b=await page.locator('#board').boundingBox(),size=Math.min((b.width-12)/7,(b.height-12)/8);return {x:(b.width-size*7)/2+size/2,y:(b.height-size*8)/2+size/2};}
test('touch pops once, immediate pause settles animation, restart and quit can be cancelled',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await setup(page);
 await page.locator('#board').click({position:await firstCell(page)});await expect(page.locator('#moves')).toHaveText('19');await expect(page.locator('#score')).not.toHaveText('0');
 await page.getByRole('button',{name:'Pause',exact:true}).click();await expect(page.locator('#resultTitle')).toHaveText('Take a breather.');await page.locator('#play').click();await expect(page.locator('#overlay')).toBeHidden();
 await page.getByRole('button',{name:'Restart',exact:true}).click();await page.locator('#cancel').click();await expect(page.locator('#moves')).toHaveText('19');
 await page.getByRole('button',{name:'Restart',exact:true}).click();await page.getByRole('button',{name:'Restart level'}).click();await expect(page.locator('#moves')).toHaveText('20');await expect(page.locator('#score')).toHaveText('0');
 await page.getByRole('link',{name:'Quit',exact:true}).click();await expect(page.locator('#resultTitle')).toHaveText('Leave this round?');await page.locator('#cancel').click();await expect(page.locator('#overlay')).toBeHidden();
 expect(await page.evaluate(()=>localStorage.getItem('points'))).toBe('123');expect(await page.evaluate(()=>localStorage.getItem('arcadePlays'))).toBe('untouched');expect(errors).toEqual([]);
});
test('cleared level waits for Next, persists unlock and shows the ice objective',async({page})=>{
 await page.addInitScript(()=>{Math.random=()=>.8;});await page.goto('/bubble-pop.html');await page.locator('#play').click();await page.locator('#board').click({position:await firstCell(page)});
 await expect(page.locator('#resultTitle')).toHaveText('Level cleared!');await expect(page.locator('#levelLabel')).toHaveText('LEVEL 1 / 6');await page.waitForTimeout(450);await expect(page.locator('#levelLabel')).toHaveText('LEVEL 1 / 6');await page.locator('#play').click();await expect(page.locator('#levelLabel')).toHaveText('LEVEL 2 / 6');await expect(page.locator('#goals')).toContainText('0/12');
 await page.reload();await expect(page.locator('#levelLabel')).toHaveText('LEVEL 2 / 6');await expect(page.locator('#resultText')).toContainText('break 12 ice tiles');
});
test('board and controls fit phones, and goals, ice, stars and powers have review screenshots',async({page},info)=>{
 for(const [width,height] of [[390,844],[390,664],[320,568]]){
  await page.setViewportSize({width,height});await page.goto('/bubble-pop.html');await page.locator('#play').click();const m=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,bottom:document.querySelector('.actions').getBoundingClientRect().bottom,height:innerHeight}));expect(m.scroll).toBeLessThanOrEqual(m.width);expect(m.bottom).toBeLessThanOrEqual(m.height);
 }
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>localStorage.setItem('earnlyBubblePopLevel','4'));await page.reload();await page.locator('#play').click();await page.screenshot({path:'test-results/bubble-pop-'+info.project.name+'.png',fullPage:true});
 await page.addInitScript(()=>{Math.random=()=>0;});await page.evaluate(()=>localStorage.setItem('earnlyBubblePopLevel','0'));await page.reload();await page.locator('#play').click();await page.locator('#board').click({position:await firstCell(page)});await page.waitForTimeout(450);await page.screenshot({path:'test-results/bubble-pop-power-'+info.project.name+'.png',fullPage:true});
});
test('reduced motion, keyboard play, blocked storage and idle rendering remain safe',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.addInitScript(()=>{Math.random=()=>0;Storage.prototype.setItem=()=>{throw Error('blocked')};Storage.prototype.getItem=()=>{throw Error('blocked')};window.framesRequested=0;const raf=requestAnimationFrame;window.requestAnimationFrame=fn=>{window.framesRequested++;return raf(fn);};});await page.goto('/bubble-pop.html');await page.locator('#play').click();await page.locator('#board').focus();await page.keyboard.press('Enter');await expect(page.locator('#moves')).toHaveText('19');await expect(page.locator('#score')).not.toHaveText('0');await page.waitForTimeout(100);const n=await page.evaluate(()=>framesRequested);await page.waitForTimeout(150);expect(await page.evaluate(()=>framesRequested)).toBe(n);
});
test('animated turns ignore repeat taps, sleep when idle and pause when backgrounded',async({page})=>{
 await page.addInitScript(()=>{window.framesRequested=0;const raf=requestAnimationFrame;window.requestAnimationFrame=fn=>{window.framesRequested++;return raf(fn);};});await setup(page);
 const p=await firstCell(page),b=await page.locator('#board').boundingBox();
 await page.locator('#board').dispatchEvent('pointerdown',{clientX:b.x+p.x,clientY:b.y+p.y});await page.locator('#board').dispatchEvent('pointerdown',{clientX:b.x+p.x,clientY:b.y+p.y});await expect(page.locator('#moves')).toHaveText('19');await page.waitForTimeout(500);
 const n=await page.evaluate(()=>framesRequested);expect(n).toBeGreaterThan(0);await page.waitForTimeout(150);expect(await page.evaluate(()=>framesRequested)).toBe(n);
 await page.locator('#board').dispatchEvent('pointerdown',{clientX:b.x+p.x,clientY:b.y+p.y});await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await expect(page.locator('#resultTitle')).toHaveText('Take a breather.');await expect(page.locator('#moves')).toHaveText('18');
});
