const {test,expect} = require('@playwright/test');

test('Studio preview saves device drafts, restores and remixes them without sending a generation',async ({page}) => {
  const requests = [];
  page.on('request',req => {
    if (req.method() === 'POST') requests.push(req.url());
  });
  await page.goto('/earnly-studio.html');
  await page.getByRole('button',{name:'Comedy Mooncake mishap'}).click();
  await expect(page.getByLabel('Style')).toHaveValue('Comedy');
  await expect(page.getByRole('button',{name:'Generate',exact:true})).toBeDisabled();
  const prompt = page.getByRole('textbox',{name:'Your prompt'});
  await prompt.fill('Spuddy flips a moon pancake.');
  await page.getByRole('button',{name:'Save draft'}).click();
  await expect(page.getByRole('heading',{name:'Device drafts'})).toBeVisible();
  await page.reload();
  const draft = page.locator('#drafts article');
  await expect(draft).toHaveCount(1);
  await draft.getByRole('button',{name:'Edit'}).click();
  await expect(prompt).toHaveValue('Spuddy flips a moon pancake.');
  await prompt.fill('Spuddy flips two moon pancakes.');
  await page.getByRole('button',{name:'Save changes'}).click();
  await expect(draft).toHaveCount(1);
  await expect(draft.locator('p')).toHaveText('Spuddy flips two moon pancakes.');
  await draft.getByRole('button',{name:'Remix'}).click();
  await prompt.fill('A tiny moon rolls into a diner.');
  await page.getByRole('button',{name:'Save draft'}).click();
  await expect(draft).toHaveCount(2);
  page.once('dialog',dialog => dialog.accept('Lunar diner'));
  await draft.first().getByRole('button',{name:'Rename'}).click();
  await expect(draft.first().getByRole('heading')).toHaveText('Lunar diner');
  page.once('dialog',dialog => dialog.accept());
  await draft.first().getByRole('button',{name:'Delete'}).click();
  await expect(draft).toHaveCount(1);
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('authenticated Studio fixture reuses the same reservation after an ambiguous response',async ({page})=>{
  // Serve only the local checkout under its integrated origin. No live RPCs.
  const path=require('node:path');
  const {readFile}=require('node:fs/promises');
  await page.route('https://earnlyarcade.com/**',async route=>{
    const name=path.basename(new URL(route.request().url()).pathname);
    if(!/^(earnly-studio\.(html|js|css)|game-preview-[\w-]+\.webp)$/.test(name))return route.abort();
    const type={html:'text/html',js:'application/javascript',css:'text/css',webp:'image/webp'}[name.split('.').at(-1)];
    return route.fulfill({contentType:type,body:await readFile(path.join(__dirname,'..',name))});
  });
  await page.addInitScript(()=>{
    const calls=[],jobs=[];
    window.studioFixtureRequests=calls;
    window.EarnlyCloud={user:async()=>({id:'test-user'}),client:{functions:{invoke:async(_name,{body})=>{
      if(body.action==='library')return {data:{prices:{video:10,image:1},credits:20,enabled:true,jobs}};
      if(body.action==='generate'){
        calls.push(body);
        if(calls.length===1)return {error:new Error('Connection lost after send')};
        jobs.push({id:'fixture-job',prompt:body.prompt,kind:body.kind,ratio:body.ratio,state:'review'});
        return {data:{id:'fixture-job'}};
      }
      throw Error('Unexpected fixture call');
    }}}};
  });
  await page.goto('https://earnlyarcade.com/earnly-studio.html#create');
  await expect(page.locator('#cost')).toHaveText('10 Studio Credits');
  await page.locator('#prompt').fill('A tiny potato pilots a toy helicopter.');
  await expect(page.locator('#generate')).toBeDisabled();
  await page.locator('#consent').check();
  await page.locator('#generate').click();
  await expect(page.locator('#notice')).toContainText('Could not confirm');
  await page.locator('#generate').click();
  await expect(page.locator('#jobs article')).toHaveCount(1);
  const calls=await page.evaluate(()=>window.studioFixtureRequests);
  expect(calls.length).toBe(2);
  expect(calls[0].request_id).toBe(calls[1].request_id);
  expect(calls[1].consent_version).toBe('2026-11-27');
  expect(calls[1].expected_credits).toBe(10);
});

test('Studio can use equipped Spuddy artwork for a private animation draft',async({page})=>{
  const path=require('node:path');
  const {readFile}=require('node:fs/promises');
  await page.route('https://earnlyarcade.com/**',async route=>{
    const name=path.basename(new URL(route.request().url()).pathname);
    if(!/^(earnly-studio\.(html|js|css)|potato-rig\.js|cosmetic-cyber-starter\.svg|game-preview-[\w-]+\.webp)$/.test(name))return route.abort();
    const type={html:'text/html',js:'text/javascript',css:'text/css',webp:'image/webp',svg:'image/svg+xml'}[name.split('.').at(-1)];
    return route.fulfill({contentType:type,body:await readFile(path.join(__dirname,'..',name))});
  });
  await page.addInitScript(()=>{
    window.EarnlyCloud={user:async()=>({id:'fixture-owner'}),client:{functions:{invoke:async(name,{body})=>{
      if(name==='avatars/api/me')return {data:{user:{equipped:{avatar:{id:'cyber-starter',imageUrl:'cosmetic-cyber-starter.svg'}}}}};
      if(body.action==='library')return {data:{enabled:true,credits:80,prices:{image:1,video:10,animation:60},jobs:[]}};
      throw Error('Unexpected submission');
    }}}};
  });
  await page.goto('https://earnlyarcade.com/earnly-studio.html#create');
  await page.locator('#animationChoice').click();
  await page.locator('#useSpuddy').click();
  await expect(page.locator('#sourcePreview')).toBeVisible();
  await expect(page.locator('#prompt')).toHaveValue(/superhero/);
  await expect(page.locator('#cost')).toHaveText('60 Studio Credits');
  await expect(page.locator('#generate')).toBeDisabled();
  await page.locator('#save').click();
  const draft=await page.evaluate(()=>localStorage.getItem('earnlyStudioDrafts:fixture-owner'));
  expect(draft).toContain('superhero');
  expect(draft).not.toContain('base64');
});
