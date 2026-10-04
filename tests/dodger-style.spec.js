const {test,expect}=require('@playwright/test');
test('Neon Dodger close passes chain once, expire, and persist a replay target',async({page})=>{
 await page.goto('/dodger.html');
 const report=await page.evaluate(()=>{
  running=true;startTime=1000;nextSpawnAt=999999;lastFrame=0;player.x=149;
  function pass(t,gap=9){lastSteerSecond=(t-startTime)/1000;obstacles=[{x:player.x+player.w+gap,y:420,w:48,h:62,speed:8.2,color:'#ef4444'}];for(let i=0;i<18;i++){loop(t+i*16.667);cancelAnimationFrame(animation);}}
  pass(1000);const first={nearPasses,combo,styleScore};
  pass(1600);const second={nearPasses,combo,styleScore};updateStyle(3);const chainCopy=document.getElementById('levelCareer').textContent;
  pass(8000);const expired={nearPasses,combo,styleScore};
  pass(9000,35);const wide={nearPasses,styleScore};
  finishGame(9);return {first,second,expired,wide,chainCopy,crashed:document.body.classList.contains('run-crashed'),best:localStorage.getItem('arcadeDodgerOverdriveBest')};
 });
 expect(report.first).toEqual({nearPasses:1,combo:1,styleScore:110});
 expect(report.second).toEqual({nearPasses:2,combo:2,styleScore:320});expect(report.chainCopy).toContain('×2 COMBO');expect(report.crashed).toBe(true);
 expect(report.expired).toEqual({nearPasses:3,combo:1,styleScore:430});
 expect(report.wide).toEqual({nearPasses:3,styleScore:440});expect(report.best).toBe('440');
 await page.reload();await expect(page.locator('#levelCareer')).toContainText('Score 440');
});
test('Neon Dodger actual traffic has upright cars and a clear lane in 500 sampled waves',async({page})=>{
 await page.goto('/dodger.html');
 const report=await page.evaluate(()=>{
  startTime=1000;let problem=null,rows=0;
  for(let wave=0;wave<500;wave++){
   obstacles=[];lastSteerSecond=wave%120;spawn(1000+(wave%120)*1000);
   const groups=new Map();for(const o of obstacles){const cars=groups.get(o.y)||[];cars.push(o);groups.set(o.y,cars);if(o.w>=o.h||o.w>52)problem='car proportions';}
   for(const cars of groups.values()){rows++;const safe=[55,165,275].some(center=>cars.every(o=>!intersects({x:center-player.w/2,y:o.y,w:player.w,h:player.h},o)));if(!safe)problem='no clear lane';}
  }
  running=true;setStatus('Running','running');updateLevel(44);combo=0;coreStreak=4;coresCollected=4;styleScore=800;updateStyle(44);cores=[{x:55,y:280,r:9},{x:275,y:380,r:9}];obstacles=[{x:25,y:90,w:48,h:70,color:'#67e8f9'},{x:245,y:145,w:48,h:78,color:'#fb89cf'},{x:130,y:270,w:48,h:62,color:'#ffd77c'}];draw();document.body.classList.add('game-active');return {problem,rows};
 });
 expect(report.problem).toBeNull();expect(report.rows).toBeGreaterThan(500);
 await page.screenshot({path:'test-results/dodger-style-'+test.info().project.name+'.png'});
});
test('Neon Dodger collision still ends a run with smaller cars',async({page})=>{
 await page.goto('/dodger.html');
 const report=await page.evaluate(()=>{running=true;startTime=1000;nextSpawnAt=99999;lastFrame=0;obstacles=[{x:player.x,y:player.y-10,w:48,h:70,speed:8.2,color:'#ef4444'}];loop(1100);cancelAnimationFrame(animation);return {running,nearPasses};});
 expect(report).toEqual({running:false,nearPasses:0});
});
test('Neon Dodger rejects camping at all 299 starting positions across three difficulties',async({page})=>{
 test.setTimeout(60000);await page.goto('/dodger.html');
 const report=await page.evaluate(()=>{
  const finish=finishGame,paint=draw,random=Math.random;let seed=441,maxSurvival=0,camping=null,runs=0;
  Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};draw=()=>{};finishGame=()=>{running=false;};
  try{for(const offset of [0,40,100])for(let x=0;x<=298;x++){
   running=true;player.x=x;obstacles=[];cores=[];combo=0;nearPasses=0;styleScore=0;dodged=0;lastSteerSecond=-100;surgeUntil=0;startTime=1000;nextSpawnAt=0;lastFrame=0;lastOpenLane=1;lastSecondShown=-1;
   let frames=0;for(;frames<600&&running;frames++){loop(1000+offset*1000+frames*16.667);cancelAnimationFrame(animation);}
   runs++;maxSurvival=Math.max(maxSurvival,frames/60);if(running||nearPasses!==0)camping={x,offset,running,nearPasses};
  }}finally{draw=paint;finishGame=finish;Math.random=random;running=false;}
  return {runs,maxSurvival,camping};
 });
 expect(report.runs).toBe(897);expect(report.camping).toBeNull();expect(report.maxSurvival).toBeLessThan(10);
});
test('Neon Dodger five cores trigger overdrive and a miss breaks the streak',async({page})=>{
 await page.goto('/dodger.html');
 const report=await page.evaluate(()=>{
  running=true;startTime=1000;nextSpawnAt=99999;lastFrame=0;surgeUntil=0;coreStreak=0;coresCollected=0;styleScore=0;obstacles=[];
  for(let i=0;i<5;i++){cores=[{x:player.x+player.w/2,y:player.y,r:9,speed:8}];loop(1000+i*16.667);cancelAnimationFrame(animation);}
  const five={coreStreak,coresCollected,styleScore,active:surgeUntil>0};
  cores=[{x:player.x+player.w/2,y:player.y,r:9,speed:8}];loop(1100);cancelAnimationFrame(animation);const boostedScore=styleScore;
  cores=[{x:55,y:player.y+player.h+12,r:9,speed:8}];loop(1200);cancelAnimationFrame(animation);
  const missed=coreStreak;loop(6000);cancelAnimationFrame(animation);return {five,boostedScore,missed,expired:document.querySelector('.dodger-level').classList.contains('surge-live')};
 });
 expect(report.five).toEqual({coreStreak:0,coresCollected:5,styleScore:1000,active:true});expect(report.boostedScore).toBe(1400);expect(report.missed).toBe(0);expect(report.expired).toBe(false);
});
test('Neon Dodger an active lane-reading driver can collect cores and survive',async({page})=>{
 await page.goto('/dodger.html');
 const report=await page.evaluate(()=>{
  const paint=draw,finish=finishGame,random=Math.random;let seed=938;
  draw=()=>{};Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};finishGame=()=>{running=false;};
  running=true;player.x=149;startTime=1000;nextSpawnAt=0;lastFrame=0;obstacles=[];cores=[];lastOpenLane=1;surgeUntil=0;coresCollected=0;coreStreak=0;lastSecondShown=-1;
  let frames=0;
  try{for(;frames<3600&&running;frames++){
   const near=obstacles.filter(o=>o.y+o.h>player.y-65&&o.y<player.y+player.h);
   const safe=[0,1,2].filter(lane=>near.every(o=>!intersects({x:laneCenter(lane)+5,y:o.y,w:player.w-10,h:player.h},o)));
   if(safe.length){const closest=cores.filter(c=>c.y>player.y-120&&c.y<player.y+player.h).sort((a,b)=>b.y-a.y)[0];const desired=closest?laneFor(closest.x-player.w/2):laneFor(player.x);player.x=laneCenter(safe.includes(desired)?desired:safe[0]);lastSteerSecond=frames/60;}
   loop(1000+frames*16.667);cancelAnimationFrame(animation);
  }}finally{draw=paint;finishGame=finish;Math.random=random;}
  return {seconds:frames/60,cores:coresCollected};
 });
 expect(report.seconds).toBeGreaterThan(30);expect(report.cores).toBeGreaterThan(5);
});

test('Neon Dodger finger steering stays continuous between lane centers',async({page})=>{
 await page.goto('/dodger.html');
 const report=await page.evaluate(()=>{running=true;startTime=1000;nextSpawnAt=999999;obstacles=[];cores=[];setPlayerX(193);const before=player.x;loop(1100);cancelAnimationFrame(animation);const after=player.x;setPlayerX(-20);const left=player.x;setPlayerX(500);return {before,after,left,right:player.x};});
 expect(report).toEqual({before:193,after:193,left:0,right:298});
});
