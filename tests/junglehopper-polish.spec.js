const {test,expect}=require('@playwright/test');
async function ready(page){
  await page.addInitScript(()=>localStorage.setItem('arcadeOnboardingSeen','1'));
  await page.goto('/junglehopper.html');
  await page.evaluate(()=>{Arcade.countdown=fn=>fn();startGame();cancelAnimationFrame(animation);animation=null;});
}
test('Jungle gold is optional, collected once, and paid with the vine score unchanged',async({page})=>{
  await ready(page);
  const got=await page.evaluate(()=>{
    score=1;
    const o=obstacles[1];o.x=frog.x-obstacleWidth/2;
    frog.y=o.gapY;collectGold(o);const safe=bonusCoins;
    frog.y=o.gold.y;collectGold(o);collectGold(o);
    const collected={safe,bonusCoins,coinsCollected,score,reward:rewardFor(score)};
    finishGame();return collected;
  });
  expect(got).toEqual({safe:0,bonusCoins:1,coinsCollected:1,score:1,reward:1});
  await expect(page.locator('dialog.game-result-dialog')).toContainText('Gold collected: 1');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('arcadeSyncQueue')||'[]').filter(e=>e.type==='coin_award').map(e=>e.payload.server).find(s=>s?.game==='jungleHopper'))).toEqual({kind:'game',game:'jungleHopper',metric:1,aux:1});
});
test('Jungle gold positions stay inside the gap with recovery room at every difficulty',async({page})=>{
  await ready(page);
  const checks=await page.evaluate(()=>{
    let count=0,bad=0;
    for(const level of [0,10,30,60,120,250]){
      score=level;obstacles=[];spawned=0;
      for(let i=0;i<600;i++){
        spawnObstacle();const o=obstacles.at(-1),prev=obstacles.at(-2);
        if(prev&&Math.abs(prev.gapY-o.gapY)>100.001)bad++;
        if(o.gold){count++;if(Math.abs(o.gold.y-o.gapY)+frog.r+13>o.gapSize/2)bad++;}
        if(obstacles.length>2)obstacles.shift();
      }
    }return {count,bad};
  });
  expect(checks).toEqual({count:1800,bad:0});
});
test('Jungle collision ends the run before awarding a nearby coin, rewards stay capped',async({page})=>{
  await ready(page);
  const got=await page.evaluate(()=>{
    const o=obstacles[1];obstacles=[o];o.x=frog.x-obstacleWidth/2;
    frog.y=o.gapY-o.gapSize/2+frog.r-1;frog.vy=0;
    stepGame();const collision={running,bonusCoins};
    bonusCoins=20;return {...collision,cap:rewardFor(100)};
  });
  expect(got).toEqual({running:false,bonusCoins:0,cap:25});
});
test('Jungle pause freezes gold and physics; replay resets the run',async({page,isMobile})=>{
  await ready(page);
  await page.evaluate(()=>{bonusCoins=3;coinsCollected=2;});
  await page.locator('#earnlyPauseButton').click();
  const before=await page.evaluate(()=>({frame,bonusCoins,y:frog.y}));
  await page.waitForTimeout(250);
  expect(await page.evaluate(()=>({frame,bonusCoins,y:frog.y}))).toEqual(before);
  await page.locator('#earnlyPauseButton').click();
  await page.evaluate(()=>{cancelAnimationFrame(animation);finishGame();});
  await page.locator('dialog.game-result-dialog .result-actions button.green').click();
  await expect.poll(()=>page.evaluate(()=>({bonusCoins,coinsCollected}))).toEqual({bonusCoins:0,coinsCollected:0});
  if(isMobile){
    const board=await page.locator('#game').boundingBox(),pause=await page.locator('#earnlyPauseButton').boundingBox();
    expect(pause.y).toBeGreaterThanOrEqual(board.y+board.height);
    expect(pause.y+pause.height).toBeLessThan(page.viewportSize().height);
  }
});
test('Jungle fixed step keeps the same flight at 60 and 120Hz',async({page})=>{
  await ready(page);
  const states=await page.evaluate(()=>{
    const run=hz=>{
      resetGame();running=true;obstacles=[];frog.vy=-6.9;
      for(let n=0;n<=hz/2;n++){loop(n*1000/hz);cancelAnimationFrame(animation);}
      return {y:frog.y,vy:frog.vy,frame};
    };return [run(60),run(120)];
  });
  expect(states[0]).toEqual(states[1]);expect(states[0].frame).toBe(30);
});
test('Jungle edge gold has a survivable tap route on both sides at every speed',async({page})=>{
  await ready(page);
  const routes=await page.evaluate(()=>{
    const outcomes=[];
    for(const level of [0,10,30,60,120,250])for(const side of [-1,1]){
      const {speed,gapSize}=difficultyFor(level),gapY=280;
      const goldY=gapY+side*(gapSize/2-frog.r-14);
      let states=[{y:280,vy:0,cool:0,gold:false}];
      for(let x=210;x+obstacleWidth>frog.x-frog.r&&states.length;x-=speed){
        const next=new Map();
        for(const s of states)for(const tap of [false,true]){
          if(tap&&s.cool>0)continue;
          const vy=(tap?hopPower:s.vy)+gravity,y=s.y+vy;
          if(y-frog.r<=0||y+frog.r>=532)continue;
          if(circleRectCollision(frog.x,y,frog.r,x,0,obstacleWidth,gapY-gapSize/2)||circleRectCollision(frog.x,y,frog.r,x,gapY+gapSize/2,obstacleWidth,560))continue;
          const gold=s.gold||Math.hypot(frog.x-x-obstacleWidth/2,y-goldY)<=frog.r+5;
          const cool=tap?4:Math.max(0,s.cool-1);
          const key=[Math.round(y),Math.round(vy*2),cool,gold].join(':');
          next.set(key,{y,vy,cool,gold});
        }
        states=[...next.values()];
      }
      outcomes.push({level,side,possible:states.some(s=>s.gold)});
    }return outcomes;
  });
  expect(routes.filter(r=>!r.possible)).toEqual([]);
});
