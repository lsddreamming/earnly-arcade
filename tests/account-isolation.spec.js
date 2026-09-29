const { test, expect } = require('@playwright/test');

test('a second cloud account cannot inherit the first player’s local progress', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', route => route.fulfill({
    contentType:'application/javascript',
    body:`window.supabase={createClient:()=>{
      let current=null;
      const empty={select(){return this},eq(){return this},maybeSingle:async()=>({data:null,error:null})};
      return {
        auth:{
          getSession:async()=>({data:{session:current},error:null}),
          signInWithPassword:async({email})=>{current={user:{id:email,email},access_token:'test'};return {data:current,error:null}},
          signOut:async()=>{current=null;return {error:null}},
          onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})
        },
        from:()=>empty,
        rpc:async()=>({data:{},error:null})
      };
    }};`
  }));
  await page.goto('/account.html');
  await page.evaluate(() => {
    localStorage.setItem('points','1961');
    localStorage.setItem('arcadeUsername','DREAMER');
  });
  await page.evaluate(async () => {
    await EarnlyCloud.signInAndRestore('review@example.com','testpass');
  });
  expect(await page.evaluate(() => ({
    points:localStorage.getItem('points'),
    username:localStorage.getItem('arcadeUsername'),
    owner:localStorage.getItem('earnlyLocalProgressOwner')
  }))).toEqual({points:null,username:null,owner:'review@example.com'});
  await page.evaluate(() => EarnlyCloud.signOut());
  expect(await page.evaluate(() => ({
    points:localStorage.getItem('points'),
    username:localStorage.getItem('arcadeUsername')
  }))).toEqual({points:'1961',username:'DREAMER'});
});

test('email confirmation session keeps existing browser progress out of a new account', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('points','1961');
    localStorage.setItem('arcadeUsername','DREAMER');
  });
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', route => route.fulfill({
    contentType:'application/javascript',
    body:`window.supabase={createClient:()=>{
      const current={user:{id:'review@example.com',email:'review@example.com'},access_token:'test'};
      const empty={select(){return this},eq(){return this},maybeSingle:async()=>({data:null,error:null})};
      return {
        auth:{getSession:async()=>({data:{session:current},error:null}),
          onAuthStateChange:callback=>{setTimeout(()=>callback('INITIAL_SESSION',current),0);
            return {data:{subscription:{unsubscribe(){}}}}}},
        from:()=>empty,rpc:async()=>({data:{},error:null})
      };
    }};`
  }));
  await page.goto('/account.html');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('earnlyLocalProgressOwner')))
    .toBe('review@example.com');
  expect(await page.evaluate(() => ({
    points:localStorage.getItem('points'),
    username:localStorage.getItem('arcadeUsername')
  }))).toEqual({points:null,username:null});
});
