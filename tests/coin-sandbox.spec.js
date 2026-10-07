const {test,expect}=require('@playwright/test');
const path=require('node:path');
const base='https://wphqfogbnpdsfkquvdsu.supabase.co';
const uid='00000000-0000-4000-8000-000000000001';
const order='22222222-2222-4222-8222-222222222222';
const token=Buffer.from(JSON.stringify({alg:'HS256'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,exp:4102444800})).toString('base64url')+'.test';
async function setup(page){
 await page.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({path:path.resolve('node_modules/@supabase/supabase-js/dist/umd/supabase.js'),contentType:'text/javascript'}));
 await page.route(base+'/**',route=>{
  const url=route.request().url();let body;
  if(url.includes('/auth/v1/token'))body={access_token:token,token_type:'bearer',expires_in:3600,refresh_token:'test',user:{id:uid,email:'tester@example.com',aud:'authenticated'}};
  else if(url.includes('/config'))body={available:true,packs:[{id:'starter',coins:500,priceCents:199,currency:'usd'}]};
  else if(url.includes('/wallet'))body={wallet:{balance:500}};
  else if(url.includes('/orders/'))body={status:'fulfilled',coins:500};
  else if(url.includes('/checkout'))body={orderId:order,url:'https://checkout.stripe.com/c/pay/cs_test_example'};
  else if(url.includes('/signup'))body={user:{id:uid,email:'tester@example.com'},session:null};
  else body={};
  return route.fulfill({json:body});
 });
}
async function signIn(page){await page.getByLabel('Email',{exact:true}).fill('tester@example.com');await page.getByLabel('Password',{exact:true}).fill('sandbox-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();}
test('sandbox sign-in opens test checkout, with fixed pack and request ID',async({page})=>{
 await setup(page);await page.goto('/coin-sandbox.html');await expect(page.locator('#status')).toContainText('Sign in or create');await signIn(page);
 await expect(page.locator('#balance')).toHaveText('500');
 await page.route('https://checkout.stripe.com/**',route=>route.fulfill({body:'Stripe test checkout',contentType:'text/html'}));
 const req=page.waitForRequest(base+'/functions/v1/coin-shop/checkout');await page.getByRole('button',{name:'Test purchase'}).click();const request=await req;
 expect(request.postDataJSON()).toEqual({packId:'starter'});expect(request.headers()['idempotency-key']).toMatch(/^[a-f0-9-]{36}$/);await expect(page).toHaveURL(/checkout\.stripe\.com/);
});
test('return refresh checks server balance without adding client-side coins',async({page})=>{
 await setup(page);await page.goto('/coin-sandbox.html?test_order='+order);await expect(page.locator('#status')).toContainText('Sign in or create');await signIn(page);
 await expect(page.locator('#status')).toContainText('Payment verified');await expect(page.locator('#balance')).toHaveText('500');await page.getByRole('button',{name:'Refresh balance'}).click();await expect(page.locator('#status')).toContainText('Payment verified');await expect(page.locator('#balance')).toHaveText('500');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('new account waits for email confirmation',async({page})=>{
 await setup(page);await page.goto('/coin-sandbox.html');await expect(page.locator('#status')).toContainText('Sign in or create');await page.getByLabel('Email',{exact:true}).fill('tester@example.com');await page.getByLabel('Password',{exact:true}).fill('sandbox-password');await page.getByRole('button',{name:'Create test account'}).click();await expect(page.locator('#status')).toContainText('Check your email');await expect(page.locator('#shop')).toBeHidden();
});
