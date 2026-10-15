const {test,expect}=require('@playwright/test');
const uid='00000000-0000-4000-8000-000000000001';
async function setup(page,{status='purchased',fail=false,recovery=false,noProducts=false,rejectedFirst=false,restricted=false}={}){
 await page.addInitScript(({uid,status,recovery,noProducts,rejectedFirst,restricted})=>{
  window.Capacitor={isNativePlatform:()=>true};window.finished=[];window.buyCalls=[];
  window.EarnlyApplePurchases={products:async()=>({products:noProducts?[]:[{id:'com.earnly.arcade.coins.starter',displayPrice:'€1.99'}]}),purchase:async args=>{window.buyCalls.push(args);return {status,signedTransaction:'signed'};},pending:async()=>({transactions:recovery?['signed']:[]}),finish:async args=>window.finished.push(args),addListener:async()=>({remove(){}})};
  if(rejectedFirst||restricted)window.EarnlyApplePurchases.pending=async()=>({transactions:restricted?['old-account']:['old-account','signed']});
 },{uid,status,recovery,noProducts,rejectedFirst,restricted});
 await page.route('**/cloud.js',r=>r.fulfill({contentType:'text/javascript',body:`window.EarnlyCloud={session:async()=>({access_token:'valid',user:{id:'${uid}'}}),client:{auth:{onAuthStateChange:()=>({})}},syncServerRewards:async()=>({})};`}));
 await page.route('**/avatar-studio.js',r=>r.fulfill({contentType:'text/javascript',body:''}));
 await page.route('**/coin-shop/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({credits:[]})}));
 let verifies=0;
 await page.route('**/apple-coins/**',r=>{
  if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'POST,GET'}});
  const config=r.request().url().endsWith('/config');if(!config)verifies++;
  if(!config&&r.request().postDataJSON()?.signedTransaction==='old-account')return r.fulfill({status:restricted?403:503,contentType:'application/json',body:JSON.stringify({error:{message:'Purchase could not be verified.',...(restricted?{code:'SANDBOX_TEST_ACCOUNT_REQUIRED'}:{})}})});
  return r.fulfill({status:!config&&fail?503:200,headers:{'Access-Control-Allow-Origin':'*'},contentType:'application/json',body:JSON.stringify(config?{available:true,packs:[{id:'starter',productId:'com.earnly.arcade.coins.starter',coins:500}]}:fail?{error:{message:'Verification unavailable. Reopen to retry.'}}:{status:'fulfilled',transactionId:'123',wallet:{balance:'1750',lifetime_earned:'1250'}})});
 });
 await page.goto('/avatars.html');return {verifies:()=>verifies};
}
test('iPhone shop uses Apple localized prices and finishes only verified delivery',async({page})=>{
 const f=await setup(page);const buy=page.getByRole('button',{name:'Buy 500 Arcade Coins for €1.99'});await expect(buy).toBeEnabled();await buy.click();await expect(page.locator('#coin-status')).toContainText('Purchase confirmed');
 expect(await page.evaluate(()=>window.buyCalls[0])).toEqual({productId:'com.earnly.arcade.coins.starter',accountToken:uid});expect(await page.evaluate(()=>window.finished)).toEqual([{transactionId:'123'}]);expect(f.verifies()).toBe(1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('failed verification leaves Apple transaction unfinished for recovery',async({page})=>{await setup(page,{fail:true});await page.getByRole('button',{name:'Buy 500 Arcade Coins for €1.99'}).click();await expect(page.locator('#coin-status')).toContainText('Verification unavailable');expect(await page.evaluate(()=>window.finished)).toEqual([]);});
for(const status of ['pending','cancelled'])test(`Apple ${status} never credits or finishes`,async({page})=>{const f=await setup(page,{status});await page.getByRole('button',{name:'Buy 500 Arcade Coins for €1.99'}).click();await expect(page.locator('#coin-status')).toContainText(status==='pending'?'Waiting for Apple':'Purchase cancelled');expect(f.verifies()).toBe(0);expect(await page.evaluate(()=>window.finished)).toEqual([]);});
test('unfinished purchases recover when the shop opens',async({page})=>{await setup(page,{recovery:true});await expect.poll(()=>page.evaluate(()=>window.finished.length)).toBe(1);await expect(page.locator('#coin-status')).toContainText('Purchase confirmed');});
test('a rejected pending purchase does not block delivery of the next purchase',async({page})=>{
 const f=await setup(page,{rejectedFirst:true});
 await expect(page.locator('#coin-status')).toContainText('1 could not be verified and remain pending');
 expect(f.verifies()).toBe(2);
 expect(await page.evaluate(()=>window.finished)).toEqual([{transactionId:'123'}]);
});
test('missing StoreKit products never expose an enabled price placeholder',async({page})=>{
 await setup(page,{noProducts:true});await expect(page.locator('#coin-packs button')).toBeDisabled();await expect(page.locator('#coin-packs button')).toContainText('Coming soon');
});

test('ineligible old test purchases stay unfinished and do not block a fresh purchase',async({page})=>{
 await setup(page,{restricted:true});
 await expect(page.locator('#coin-status')).toContainText('ineligible test account');
 expect(await page.evaluate(()=>window.finished)).toEqual([]);
 await page.getByRole('button',{name:'Buy 500 Arcade Coins for €1.99'}).click();
 await expect(page.locator('#coin-status')).toContainText('Purchase confirmed');
 expect(await page.evaluate(()=>window.finished)).toEqual([{transactionId:'123'}]);
});
