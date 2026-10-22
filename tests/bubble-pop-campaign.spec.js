const {test,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const E=require('../bubble-pop-engine');
function rng(seed){let n=seed;return ()=>((n=Math.imul(n,1664525)+1013904223>>>0)/4294967296);}
function choices(game){return game.state().board.map((c,i)=>({i,size:c.power?10:game.group(i).length})).filter(c=>c.size>=2);}
function solution(level){for(let seed=1;seed<=100;seed++){const g=E.create(rng(seed),level),steps=[];while(!g.state().done){const pick=choices(g).sort((a,b)=>b.size-a.size)[0];steps.push(pick.i);g.pop(pick.i);}if(g.state().status==='won')return {seed,steps};}throw Error('No deterministic win fixture for level '+level);}

test('1000 campaign levels have bounded objectives, exact ice and star counts, and repeatable layouts',()=>{
 assert.equal(E.LEVELS.length,6);assert.equal(E.CAMPAIGN_LEVELS,1000);
 const layouts=new Set(),goals=new Set();
 for(let level=0;level<E.CAMPAIGN_LEVELS;level++){
  const rules=E.levelRules(level),a=E.create(rng(37),level).state(),b=E.create(rng(37),level).state();
  assert.deepEqual(a,b);assert.equal(a.level,level);assert.equal(a.levelCount,1000);
  assert.equal(a.ice.filter(Boolean).length,rules.ice);assert.equal(a.board.filter(c=>c.star).length,rules.stars);
  assert(rules.moves>=20&&rules.moves<=31);assert(rules.ice>=0&&rules.ice<=20);assert(rules.collect>=0&&rules.collect<=32);assert(rules.stars>=0&&rules.stars<=4);
  assert(rules.collect+rules.ice+rules.stars>0);assert(rules.color>=0&&rules.color<4);
  if(level>=6){layouts.add(a.ice.map(Number).join('')+'|'+a.board.map(c=>Number(c.star)).join(''));goals.add([rules.color,rules.collect,rules.ice,rules.stars].join(','));}
 }
 assert(layouts.size>50);assert(goals.size>30);
 console.log(`Bubble Pop campaign: 1000 level definitions, ${layouts.size} ice/star layouts, ${goals.size} objective combinations checked.`);
});

test('3000 seeded campaign rounds preserve valid turns, stars, score and retry isolation',()=>{
 let turns=0,wins=0;
 for(let level=0;level<1000;level++)for(let seed=1;seed<=3;seed++){
  const random=rng(level*100+seed),g=E.create(random,level);
  while(!g.state().done){
   const before=g.state(),available=choices(g);assert(available.length);
   const result=g.pop(available[Math.floor(random()*available.length)].i);turns++;
   assert(result.valid);assert.equal(result.moves,before.moves-1);assert(result.score>before.score);
   assert.equal(result.board.length,56);assert.equal(new Set(result.board.map(c=>c.id)).size,56);
   assert.equal(result.board.filter(c=>c.star).length+result.goals.delivered,E.levelRules(level).stars);
   assert(result.goals.iceLeft<=before.goals.iceLeft);assert(result.goals.collected>=before.goals.collected);
   for(const c of result.board)assert(c.star||c.power||Number.isInteger(c.color)&&c.color>=0&&c.color<4);
   assert.equal(result.falls.length,56);assert.equal(new Set(result.cleared).size,result.cleared.length);
  }
  const end=g.state();assert.equal(g.pop(0).valid,false);assert.deepEqual(g.state(),end);
  if(end.status==='won'){wins++;assert.equal(end.goals.iceLeft,0);assert(end.goals.collected>=end.goals.collect);assert.equal(end.goals.delivered,end.goals.stars);}
  else assert.equal(end.moves,0);
  g.restart();assert.equal(g.state().level,level);assert.equal(g.state().score,0);assert.equal(g.state().moves,E.levelRules(level).moves);
 }
 assert(wins>0);console.log(`Bubble Pop campaign: 3000 seeded rounds, ${turns} valid turns, ${wins} random-policy wins. Not a human difficulty assessment.`);
});

test('corrupt saves are bounded and progression crosses level six without erasing score',()=>{
 for(const value of [NaN,Infinity,-Infinity,'bad',-50])assert.equal(E.create(rng(1),value).state().level,0);
 assert.equal(E.create(rng(1),999999).state().level,999);assert.equal(E.create(rng(1),6.9).state().level,6);
 const fixture=solution(5),g=E.create(rng(fixture.seed),5);assert.equal(g.next(),false);for(const i of fixture.steps)g.pop(i);
 const won=g.state();assert.equal(won.status,'won');const next=g.next();assert.equal(next.level,6);assert.equal(next.score,won.score);
 g.pop(0);g.restart();assert.equal(g.state().level,6);assert.equal(g.state().score,won.score);
 const finalFixture=solution(999),last=E.create(rng(finalFixture.seed),999);for(const i of finalFixture.steps)last.pop(i);assert.equal(last.state().status,'won');assert.equal(last.next(),false);
});

async function tapCell(page,i){
 const b=await page.locator('#board').boundingBox(),size=Math.min((b.width-12)/7,(b.height-12)/8);
 await page.locator('#board').click({position:{x:(b.width-size*7)/2+(i%7+.5)*size,y:(b.height-size*8)/2+(Math.floor(i/7)+.5)*size}});
}
test('level six offers level seven, saves the checkpoint, and never changes the coin wallet',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 const fixture=solution(5);await page.addInitScript(seed=>{let n=seed;Math.random=()=>((n=Math.imul(n,1664525)+1013904223>>>0)/4294967296);if(localStorage.getItem('earnlyBubblePopLevel')===null)localStorage.setItem('earnlyBubblePopLevel','5');if(localStorage.getItem('points')===null)localStorage.setItem('points','123');if(localStorage.getItem('arcadePlays')===null)localStorage.setItem('arcadePlays','untouched');},fixture.seed);
 await page.goto('/bubble-pop.html');await page.locator('#play').click();
 for(const i of fixture.steps){const moves=Number(await page.locator('#moves').textContent());await tapCell(page,i);await expect(page.locator('#moves')).toHaveText(String(moves-1));await page.waitForTimeout(20);}
 await expect(page.locator('#resultTitle')).toHaveText('Level cleared!');await expect(page.locator('#play')).toHaveText('Next level →');
 await page.locator('#play').click();await expect(page.locator('#levelLabel')).toHaveText('LEVEL 7 / 1000');await expect(page.locator('#levelName')).toHaveText(E.levelRules(6).name);
 expect(await page.evaluate(()=>localStorage.getItem('earnlyBubblePopLevel'))).toBe('6');
 expect(await page.evaluate(()=>localStorage.getItem('points'))).toBe('123');expect(await page.evaluate(()=>localStorage.getItem('arcadePlays'))).toBe('untouched');
 await page.reload();await expect(page.locator('#levelLabel')).toHaveText('LEVEL 7 / 1000');
});
test('a saved late campaign level reloads and fits a narrow phone',async({page})=>{
 await page.setViewportSize({width:320,height:568});await page.goto('/bubble-pop.html');await page.evaluate(()=>localStorage.setItem('earnlyBubblePopLevel','999'));await page.reload();
 await expect(page.locator('#levelLabel')).toHaveText('LEVEL 1000 / 1000');await page.locator('#play').click();
 const box=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,bottom:document.querySelector('.actions').getBoundingClientRect().bottom,height:innerHeight}));
 expect(box.scroll).toBeLessThanOrEqual(box.width);expect(box.bottom).toBeLessThanOrEqual(box.height);
 await page.reload();await expect(page.locator('#levelLabel')).toHaveText('LEVEL 1000 / 1000');
});
