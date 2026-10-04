const {test,expect}=require('@playwright/test');
test('Neon Dodger close passes chain once, expire, and persist a replay target',async({page})=>{
 await page.goto('/dodger.html');
 const report=await page.evaluate(()=>{
  running=true;startTime=1000;nextSpawnAt=999999;lastFrame=0;player.x=149;
  function pass(t,gap=9){obstacles=[{x:player.x+player.w+gap,y:420,w:48,h:62,speed:8.2,color:'#ef4444'}];for(let i=0;i<18;i++){loop(t+i*16.667);cancelAnimationFrame(animation);}}
  pass(1000);const first={nearPasses,combo,styleScore};
  pass(1600);const second={nearPasses,combo,styleScore};updateStyle(3);const chainCopy=document.getElementById('levelCareer').textContent;
  pass(8000);const expired={nearPasses,combo,styleScore};
  pass(9000,35);const wide={nearPasses,styleScore};
  finishGame(9);return {first,second,expired,wide,chainCopy,crashed:document.body.classList.contains('run-crashed'),best:localStorage.getItem('arcadeDodgerStyleBest')};
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
   obstacles=[];spawn(1000+(wave%120)*1000);
   const groups=new Map();for(const o of obstacles){const cars=groups.get(o.y)||[];cars.push(o);groups.set(o.y,cars);if(o.w>=o.h||o.w>52)problem='car proportions';}
   for(const cars of groups.values()){rows++;const safe=[55,165,275].some(center=>cars.every(o=>!intersects({x:center-player.w/2,y:o.y,w:player.w,h:player.h},o)));if(!safe)problem='no clear lane';}
  }
  running=true;setStatus('Running','running');updateLevel(44);combo=3;lastNearSecond=43;styleScore=630;updateStyle(44);obstacles=[{x:25,y:90,w:48,h:70,color:'#67e8f9'},{x:245,y:145,w:48,h:78,color:'#fb89cf'},{x:130,y:270,w:48,h:62,color:'#ffd77c'}];draw();document.body.classList.add('game-active');return {problem,rows};
 });
 expect(report.problem).toBeNull();expect(report.rows).toBeGreaterThan(500);
 await page.screenshot({path:'test-results/dodger-style-'+test.info().project.name+'.png'});
});
test('Neon Dodger collision still ends a run with smaller cars',async({page})=>{
 await page.goto('/dodger.html');
 const report=await page.evaluate(()=>{running=true;startTime=1000;nextSpawnAt=99999;lastFrame=0;obstacles=[{x:player.x,y:player.y-10,w:48,h:70,speed:8.2,color:'#ef4444'}];loop(1100);cancelAnimationFrame(animation);return {running,nearPasses};});
 expect(report).toEqual({running:false,nearPasses:0});
});
