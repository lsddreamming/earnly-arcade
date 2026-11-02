const {test,expect}=require('@playwright/test');

test.beforeEach(async({page})=>{
  await page.route('https://**',route=>route.abort());
  await page.goto('/brickbreaker.html');
  await page.waitForFunction(()=>typeof collideBrick==='function');
});

test('swept collisions catch fast crossings and reflect the impacted face once',async({page})=>{
  const result=await page.evaluate(()=>{
    const brick=()=>({x:100,y:100,w:30,h:17,hp:2,maxHp:2,alive:true,color:'#fff'});
    bricks=[brick()];
    let ball={x:115,y:140,r:7,dx:0,dy:60};
    const vertical=collideBrick(ball,115,70);
    const top={hit:vertical,hp:bricks[0].hp,dx:ball.dx,dy:ball.dy,y:ball.y};
    bricks=[brick()];ball={x:140,y:108,r:7,dx:60,dy:0};
    const horizontal=collideBrick(ball,70,108);
    const side={hit:horizontal,hp:bricks[0].hp,dx:ball.dx,dy:ball.dy,x:ball.x};
    const repeated=collideBrick(ball,ball.x,ball.y);
    bricks=[brick()];ball={x:250,y:140,r:7,dx:0,dy:60};
    return {top,side,repeated,distant:collideBrick(ball,250,70)};
  });
  expect(result.top).toMatchObject({hit:true,hp:1,dx:0,dy:-60});
  expect(result.top.y).toBeLessThan(93);
  expect(result.side).toMatchObject({hit:true,hp:1,dx:-60,dy:0});
  expect(result.side.x).toBeLessThan(93);
  expect(result.repeated).toBe(false);
  expect(result.distant).toBe(false);
});

test('fire pierces armor while streak feedback never multiplies coin payouts',async({page})=>{
  const r=await page.evaluate(()=>{
    fireUntil=performance.now()+10000;
    bricks=[{x:100,y:100,w:30,h:17,hp:3,maxHp:3,alive:true,color:'#fff'}];
    const ball={x:115,y:140,r:7,dx:0,dy:60};
    collideBrick(ball,115,70);
    const first={alive:bricks[0].alive,dy:ball.dy,broken:totalBroken};
    combo=20;bestCombo=20;
    const reward=currentReward();combo=0;
    return {first,reward,withoutCombo:currentReward(),bestCombo};
  });
  expect(r.first).toEqual({alive:false,dy:60,broken:1});
  expect(r.reward).toBe(r.withoutCombo);
});

test('every sector has a catchable bonus and late boards add distinct patterns',async({page})=>{
  const stages=await page.evaluate(()=>Array.from({length:14},(_,i)=>{
    level=i+1;resetBricks();
    return {name:layoutName,bonus:bricks.filter(b=>b.special).length,count:bricks.length,
      valid:bricks.every(b=>b.x>=0&&b.x+b.w<=360&&b.y+b.h<300)};
  }));
  expect(new Set(stages.map(s=>s.name)).size).toBe(14);
  for(const s of stages){expect(s.bonus).toBe(1);expect(s.count).toBeGreaterThan(0);expect(s.valid).toBe(true);}
});

test('paddle follows each drag delta once, clamps to edges, and stops on cancellation',async({page})=>{
  const r=await page.evaluate(()=>{
    running=true;paddle.x=100;
    const rect=canvas.getBoundingClientRect();
    const event=(name,x)=>canvas.dispatchEvent(new PointerEvent(name,{pointerId:91,pointerType:'touch',isPrimary:true,bubbles:true,cancelable:true,clientX:x,clientY:rect.top+200}));
    event('pointerdown',rect.left+100);event('pointermove',rect.left+100+rect.width/36);
    const moved=paddle.x;
    event('pointermove',2000);const edge=paddle.x;
    event('pointercancel',2000);event('pointermove',0);
    const afterCancel=paddle.x;
    document.body.classList.add('earnly-game-paused');
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
    event('pointerdown',2000);event('pointermove',0);
    return {moved,edge,afterCancel,paused:paddle.x};
  });
  expect(r.moved).toBeCloseTo(110,3);
  expect(r.edge).toBe(270);expect(r.afterCancel).toBe(270);expect(r.paused).toBe(270);
});

test('arena renders streaks and armored damage without errors or mobile overflow',async({page},testInfo)=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.evaluate(()=>{
    level=8;resetBricks();levelBroken=12;totalBroken=60;running=true;
    levelEl.textContent=level;bricksEl.textContent=levelBroken;rewardPreviewEl.textContent=currentReward();
    bricks[0].hp=1;combo=7;bestCombo=7;comboUntil=performance.now()+2200;
    balls=[makeBall(190,320)];balls[0].trail=[{x:175,y:345},{x:180,y:337},{x:185,y:329}];
    setStatus('Running · Level 8','running');draw();
  });
  await expect(page.locator('#game')).toBeVisible();
  const geometry=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth,board:canvas.getBoundingClientRect().toJSON()}));
  expect(geometry.width).toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.board.top).toBeGreaterThanOrEqual(0);
  if(testInfo.project.name==='mobile-webkit')expect(geometry.board.bottom).toBeLessThan(844-65);
  await page.screenshot({path:testInfo.outputPath('brickbreaker-neon-arena.png'),fullPage:true});
  expect(errors).toEqual([]);
});


test('late-stage paddle width survives power expiry and Continue snapshots preserve run stats',async({page})=>{
  const r=await page.evaluate(()=>{
    level=7;running=true;advanceLevel();
    bestCombo=9;paddleHits=15;saveContinue('brick_polish');
    const saved=savedContinue();
    return {width:paddle.w,base:paddle.baseW,combo:saved.bestCombo,saves:saved.paddleHits};
  });
  expect(r).toEqual({width:74,base:74,combo:9,saves:15});
});

test('phone sizes keep the active board above the controls',async({page})=>{
  for(const [width,height] of [[320,740],[390,664],[390,844],[440,956]]){
    await page.setViewportSize({width,height});
    await page.evaluate(()=>{running=true;setStatus('Running · Level 1','running');draw();});
    const box=await page.locator('#game').boundingBox();
    const pause=await page.locator('#earnlyPauseButton').boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y+box.height).toBeLessThan(pause.y);
    expect(box.width).toBeGreaterThan(200);
  }
});
