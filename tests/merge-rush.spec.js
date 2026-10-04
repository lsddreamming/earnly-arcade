const {test,expect}=require('@playwright/test');
const Rules=require('../mergerush-rules.js');
const rngFor=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
function value(b){const log=b.map(v=>v?Math.log2(v):0);let rough=0,mono=0;for(let n=0;n<4;n++)for(let k=0;k<3;k++){rough+=Math.abs(log[n*4+k]-log[n*4+k+1])+Math.abs(log[k*4+n]-log[(k+1)*4+n]);mono+=Math.max(0,log[n*4+k+1]-log[n*4+k])+Math.max(0,log[(k+1)*4+n]-log[k*4+n]);}return b.filter(v=>!v).length*8-rough*.8-mono*2+(b[0]===Math.max(...b)?10:0);}
function choose(b){let best=-Infinity,dir='left';for(const d of Rules.directions){const m=Rules.slide(b,d);if(!m.changed)continue;const future=Math.max(...Rules.directions.map(d2=>value(Rules.slide(m.board,d2).board)));const rating=value(m.board)+future*.7;if(rating>best){best=rating;dir=d;}}return dir;}
test('Merge Rush equal pairs merge once per swipe and preserve tile mass',()=>{
 const board=[2,2,2,2,4,4,8,0,16,0,16,0,0,0,0,0];
 const out=Rules.slide(board,'left');expect(out.board).toEqual([4,4,0,0,8,8,0,0,32,0,0,0,0,0,0,0]);expect(out.merges).toBe(4);expect(out.biggest).toBe(32);expect(out.board.reduce((a,b)=>a+b)).toBe(board.reduce((a,b)=>a+b));expect(board[0]).toBe(2);
});
test('Merge Rush random swiping loses to a deliberate corner and space strategy in 3000 runs',()=>{
 let randomWins=0,validRandomWins=0,plannedWins=0,randomMax=0;
 for(let seed=1;seed<=1000;seed++)for(const bot of ['random','valid-random','planned']){
  const game=Rules.create(rngFor(seed)),actions=rngFor(seed+12345);let s=game.snapshot();
  const randomMove=()=>{const dirs=bot==='valid-random'?Rules.directions.filter(d=>Rules.slide(s.board,d).changed):Rules.directions;return dirs[Math.floor(actions()*dirs.length)];};
  while(!s.over&&!s.cleared)s=game.move(bot==='planned'?choose(s.board):randomMove());
  if(bot==='planned')plannedWins+=s.cleared>0;else{if(bot==='random')randomWins+=s.cleared>0;else validRandomWins+=s.cleared>0;while(!s.over)s=game.move(randomMove());randomMax=Math.max(randomMax,s.score);}
 }
 expect(randomWins).toBeLessThan(250);expect(plannedWins).toBeGreaterThan(700);expect(plannedWins).toBeGreaterThan(randomWins*4);expect(plannedWins).toBeGreaterThan(validRandomWins*2);expect(randomMax).toBeLessThan(1000);
 console.log('Merge Rush first-target simulations:',{runs:3000,randomWins,validRandomWins,plannedWins,randomMax});
});
test('Merge Rush targets bank points, extend the budget, and exhausted runs cannot continue',()=>{
 const game=Rules.create(rngFor(2));let s=game.snapshot(),found=false;
 for(let i=0;i<48&&!s.over;i++){const previous=s;s=game.move(choose(s.board));if(!s.cleared)expect(s.score).toBe(0);if(s.clearedNow){found=true;expect(s.score).toBe(100);expect(s.target).toBe(128);expect(s.left).toBe(80);expect(previous.target).toBe(64);break;}}
 expect(found).toBe(true);for(let i=0;i<1000&&!s.over;i++)s=game.move('left');expect(s.over).toBe(true);const before=game.snapshot();game.move('right');expect(game.snapshot()).toEqual(before);
});
test('Merge Rush every swipe costs a move and snapshots cannot alter the board',()=>{
 const game=Rules.create(()=>0);let s=game.snapshot();s.board.fill(1024);expect(game.snapshot().board.some(v=>v===1024)).toBe(false);
 let previous=game.snapshot();s=game.move('left');expect(s.left).toBe(previous.left-1);previous=s;s=game.move('left');expect(s.left).toBe(previous.left-1);expect(s.score).toBe(0);
});
test('Merge Rush displays its objective, swipe budget and distinct tile colors on mobile',async({page})=>{
 await page.goto('/mini.html?game=mergeRush');if(await page.locator('#startButton').isVisible())await page.locator('#startButton').click();else await page.locator('#surface').click({position:{x:120,y:120}});await expect(page.locator('#gameStatus')).toHaveText('Running',{timeout:10000});
 await expect(page.locator('.merge-goal')).toContainText('Make 64');await expect(page.locator('.merge-callout')).toContainText('Equal numbers merge');await expect(page.locator('.merge-progress')).toContainText('swipes left');await expect(page.locator('#miniGameExit')).not.toBeVisible();
 const before=Number(await page.locator('.merge-wrap').getAttribute('data-swipes'));await page.keyboard.press('ArrowLeft');await expect(page.locator('.merge-wrap')).toHaveAttribute('data-swipes',String(before-1));
 for(const dir of ['ArrowDown','ArrowRight','ArrowUp','ArrowLeft','ArrowDown','ArrowLeft','ArrowUp','ArrowLeft','ArrowDown','ArrowLeft'])await page.keyboard.press(dir);
 const tiles=await page.locator('.merge-tile[data-value]').evaluateAll(els=>els.map(e=>({value:e.dataset.value,background:getComputedStyle(e).backgroundImage})));
 for(const tile of tiles)expect(tile.background).toContain('linear-gradient');
 if(test.info().project.name==='mobile-webkit'){const goal=await page.locator('.merge-goal').boundingBox(),pause=await page.locator('#earnlyPauseButton').boundingBox();expect(goal.y+goal.height).toBeLessThan(pause.y);}
 const pair=tiles.find(t=>t.value!==tiles[0].value);if(pair)expect(pair.background).not.toBe(tiles[0].background);
 expect(Number(await page.locator('#score').textContent())).toBe(0);
 await page.screenshot({path:'test-results/merge-rush-'+test.info().project.name+'.png'});
});
