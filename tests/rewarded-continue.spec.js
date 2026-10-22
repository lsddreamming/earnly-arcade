const { test, expect } = require('@playwright/test');

async function offer(page, outcome) {
  await page.goto('/snake.html');
  await page.evaluate(outcome => {
    window.continueCalls = 0; window.finishCalls = 0; window.adCalls = 0;
    window.EarnlyNativeAds = { isNative:true, showRewarded:async () => {
      window.adCalls++;
      if(outcome==='error') throw new Error('offline');
      return {earned:outcome==='earned'};
    }};
    Arcade.offerAdContinue({message:'Keep your score. One life per run.',
      onContinue:()=>window.continueCalls++, onFinish:()=>window.finishCalls++});
  }, outcome);
}

test('completed ad resumes once without granting or charging plays or coins', async ({page}) => {
  await offer(page, 'earned');
  const before = await page.evaluate(()=>({plays:Arcade.remaining('snake'),coins:Arcade.number('points')}));
  await page.getByRole('button',{name:'Watch Ad · Continue'}).click();
  await expect.poll(()=>page.evaluate(()=>window.continueCalls)).toBe(1);
  expect(await page.evaluate(()=>({plays:Arcade.remaining('snake'),coins:Arcade.number('points')}))).toEqual(before);
  expect(await page.evaluate(()=>window.adCalls)).toBe(1);
});
for(const outcome of ['closed','error']) test(outcome+' keeps run pending and allows finishing without reward', async({page})=>{
  await offer(page,outcome);
  await page.getByRole('button',{name:'Watch Ad · Continue'}).click();
  await expect(page.getByRole('button',{name:'Finish run'})).toBeVisible();
  expect(await page.evaluate(()=>window.continueCalls)).toBe(0);
  await page.getByRole('button',{name:'Finish run'}).click();
  await expect.poll(()=>page.evaluate(()=>window.finishCalls)).toBe(1);
});
test('web does not offer a simulated rewarded life', async({page})=>{
  await page.goto('/snake.html');
  expect(await page.evaluate(()=>{window.EarnlyNativeAds={isNative:false};return Arcade.offerAdContinue({});})).toBe(false);
});

for(const game of ['snake','stardefender']) test(game+' preserves progress and offers only one life before final payout', async({page})=>{
  if(game==='stardefender') await page.route('**/stardefender.html*',async route=>{
    const response=await route.fetch();
    const html=(await response.text()).replace('    function finish(finalize=false)', `    window.lifeTest={die:()=>{score=240;wave=3;lives=0;elapsed=20;aliens=[{x:100,y:50,hp:2,phase:0,color:'#fff'}];running=true;finish()},used:()=>bonusLifeUsed,score:()=>score,end:()=>{lives=0;finish()}};
    function finish(finalize=false)`);
    await route.fulfill({response,body:html});
  });
  await page.goto('/'+game+'.html'+(game==='stardefender'?'?sd=20260925d':''));
  await page.evaluate(game=>{
    window.EarnlyNativeAds={isNative:true,showRewarded:async()=>({earned:true})};
    window.payouts=0; Arcade.earn=()=>window.payouts++;
    Arcade.countdown=fn=>fn();
    if(game==='snake'){
      score=12;snake=Array.from({length:13},(_,i)=>({x:0,y:i*20}));food={x:100,y:100};
      window.eval('game=setInterval(()=>{},10000);gameOver("Hit wall")');
    }else{
      window.lifeTest.die();
    }
  },game);
  expect(await page.evaluate(()=>window.payouts)).toBe(0);
  await page.getByRole('button',{name:'Watch Ad · Continue'}).click();
  await expect.poll(()=>page.evaluate(game=>game==='snake'?bonusLifeUsed:window.lifeTest.used(),game)).toBe(true);
  expect(await page.evaluate(game=>game==='snake'?score:window.lifeTest.score(),game)).toBe(game==='snake'?12:240);
  if(game==='snake') expect(await page.evaluate(()=>snake.length)).toBe(13);
  await page.evaluate(game=>{if(game==='snake') gameOver('Hit wall');else window.lifeTest.end();},game);
  await expect.poll(()=>page.evaluate(()=>window.payouts)).toBe(1);
  await expect(page.getByRole('button',{name:'Watch Ad · Continue'})).toHaveCount(0);
});

test('Snake respawns every length as a connected body with twelve safe forward moves',async({page})=>{
 await page.goto('/snake.html');
 expect(await page.evaluate(()=>{
   for(let length=1;length<400;length++){
     const body=safeContinueSnake(length);
     if(body.length!==length||new Set(body.map(p=>p.x+','+p.y)).size!==length)return 'length '+length;
     for(let i=0;i<body.length;i++){
       const p=body[i];
       if(p.x<0||p.x>=400||p.y<0||p.y>=400)return 'bounds '+length;
       if(i&&Math.abs(p.x-body[i-1].x)+Math.abs(p.y-body[i-1].y)!==20)return 'disconnected '+length;
     }
     for(let step=0;step<12;step++){
       const next={x:body[0].x+20,y:body[0].y};
       if(next.x>=400||body.slice(0,-1).some(p=>p.x===next.x&&p.y===next.y))return 'unsafe '+length;
       body.pop();body.unshift(next);
     }
   }
   return 'safe';
 })).toBe('safe');
});

test('Snake paints the full safe respawn before countdown without moving or changing score',async({page})=>{
 await page.goto('/snake.html');
 await page.evaluate(()=>{
   window.EarnlyNativeAds={isNative:true,showRewarded:async()=>({earned:true})};
   window.resumeSnake=null;Arcade.countdown=fn=>window.resumeSnake=fn;
   score=12;snake=Array.from({length:13},(_,i)=>({x:380,y:380-i*20}));
   food={x:120,y:200};direction=nextDirection='DOWN';queuedDirections.push('LEFT');
   window.paints=0;const paint=ctx.clearRect.bind(ctx);ctx.clearRect=(...args)=>{window.paints++;paint(...args);};
   window.eval('game=setInterval(()=>{},10000);gameOver("Hit wall")');
 });
 await page.getByRole('button',{name:'Watch Ad · Continue'}).click();
 await expect.poll(()=>page.evaluate(()=>!!window.resumeSnake)).toBe(true);
 const restored=await page.evaluate(()=>({length:snake.length,score,head:snake[0],direction,queue:queuedDirections.length,paints:window.paints,foodClear:!snake.some(p=>p.x===food.x&&p.y===food.y),starting,game}));
 expect(restored).toEqual({length:13,score:12,head:{x:120,y:200},direction:'RIGHT',queue:0,paints:1,foodClear:true,starting:true,game:null});
 await page.evaluate(()=>{window.resumeSnake();clearInterval(game);for(let i=0;i<10;i++)draw();});
 expect(await page.evaluate(()=>({length:snake.length,used:bonusLifeUsed,starting}))).toMatchObject({used:true,starting:false});
 expect(await page.evaluate(()=>snake.length)).toBeGreaterThanOrEqual(13);
});
