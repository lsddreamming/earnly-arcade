const {test,expect}=require('@playwright/test');
const API='https://zdwziebtbpuolusztede.supabase.co/functions/v1/coin-shop';
async function setup(page,{native=false,retry=false}={}){
 let consumes=0,keys=[],credits=3;
 await page.addInitScript(({native})=>{if(native)window.Capacitor={isNativePlatform:()=>true};},{native});
 await page.route('**/cloud.js',route=>route.fulfill({contentType:'text/javascript',body:`window.EarnlyCloud={session:async()=>({access_token:'test',user:{id:'qa-paid-player'}}),client:{auth:{onAuthStateChange:()=>({})}},syncServerRewards:async()=>({})};window.dispatchEvent(new CustomEvent('earnly-cloud-ready'));`}));
 await page.route(API+'/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname.split('/coin-shop')[1];
  const respond=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(data)});
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type,idempotency-key','Access-Control-Allow-Methods':'GET,POST'}});
  if(path==='/config')return respond({available:true,packs:[{id:'starter',coins:500,priceCents:199}]});
  if(path==='/plays')return respond({credits:[{game:'snake',remaining:credits}]});
  if(path==='/plays/consume'){keys.push(req.headers()['idempotency-key']);consumes++;if(retry&&consumes===1)return route.abort();credits--;return respond({remaining:credits,requestId:keys.at(-1),game:'snake'});}
  return respond({error:{message:'Not configured'}},503);
 });
 return {keys,consumes:()=>consumes};
}
test('Paid plays prepare online, consume once and do not change daily free counters',async({page})=>{
 await setup(page);await page.goto('/snake.html');await expect.poll(()=>page.evaluate(()=>window.EarnlyPaidPlays?.remaining('snake'))).toBe(3);
 await page.evaluate(()=>{Arcade.remaining('snake');localStorage.setItem('snakeGamesPlayed','3');localStorage.setItem('snakeBonusPlays','0');});
 expect(await page.evaluate(()=>Arcade.consume('snake'))).toBe(false);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('earnly-paid-run:qa-paid-player:snake')||'null')?.ready)).toBe(true);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 expect(await page.evaluate(()=>Arcade.consume('snake'))).toBe(true);
 expect(await page.evaluate(()=>localStorage.getItem('snakeGamesPlayed'))).toBe('3');
 expect(await page.evaluate(()=>Arcade.remaining('snake'))).toBe(2);
});
test('Uncertain paid-play requests retry with the same receipt ID',async({page})=>{
 const f=await setup(page,{retry:true});await page.goto('/snake.html');await expect.poll(()=>page.evaluate(()=>window.EarnlyPaidPlays?.remaining('snake'))).toBe(3);
 await page.evaluate(()=>{Arcade.remaining('snake');localStorage.setItem('snakeGamesPlayed','3');Arcade.consume('snake');});
 await expect.poll(()=>f.consumes()).toBe(1);await page.waitForTimeout(300);
 await page.evaluate(()=>Arcade.consume('snake'));await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('earnly-paid-run:qa-paid-player:snake')||'null')?.ready)).toBe(true);
 expect(f.keys).toHaveLength(2);expect(f.keys[0]).toBe(f.keys[1]);
});
test('Native runtimes do not load website paid-play purchases',async({page})=>{
 await setup(page,{native:true});await page.goto('/snake.html');expect(await page.evaluate(()=>typeof window.EarnlyPaidPlays)).toBe('undefined');
});
