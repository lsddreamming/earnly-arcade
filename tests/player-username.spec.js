const { test, expect } = require('@playwright/test');

async function legacyPlayer(page, taken = false) {
  await page.addInitScript(({ taken }) => {
    localStorage.setItem('earnlyLocalProgressOwner', 'player-1');
    localStorage.setItem('arcadeProfileName', 'Lockhart96');
    localStorage.setItem('arcadeCloudAutoSync', 'off');
    let row = { display_name:'Lockhart96', username:null };
    window.sentScores = [];
    const session = { user:{id:'player-1'}, access_token:'fixture' };
    window.supabase = { createClient:() => ({
      auth:{ getSession:async()=>({data:{session}}), onAuthStateChange(){} },
      functions:{ invoke:async(name, {body}) => {
        if (body?.action === 'submit') {
          window.sentScores.push([row.username, body.game, body.score]);
          return { data:{username:row.username, rank:3} };
        }
        return { data:{entries:[]} };
      }},
      from:() => {
        const query = {
          select:()=>query, eq:()=>query, maybeSingle:async()=>({data:{...row}}),
          update:fields=>({eq:()=>({is:async()=>{
            if (taken) return {error:{code:'23505'}};
            Object.assign(row, fields); return {};
          }})}),
          upsert:fields=>({select:()=>({single:async()=>{
            if (taken && fields.username === 'Lockhart96') return {error:{code:'23505'}};
            Object.assign(row, fields); return {data:{...row}};
          }})})
        };
        return query;
      }
    })};
  }, {taken});
  await page.route('https://cdn.jsdelivr.net/**', route=>route.fulfill({body:'',contentType:'text/javascript'}));
}

test('Coin Catch ranks a saved nickname and personal best without another name entry', async ({page}) => {
  await legacyPlayer(page);
  await page.goto('/coincatch.html');
  await page.evaluate(()=>{
    Arcade.recordResult('coinCatch',281);
    Arcade.gameResult({game:'coinCatch',score:224});
  });
  await expect(page.locator('.result-leaderboard-head')).toContainText('You: #3');
  expect(await page.evaluate(()=>window.sentScores)).toContainEqual(['Lockhart96','coinCatch',281]);
});

test('a taken nickname can be fixed on the results screen and the same best submitted', async ({page}) => {
  await legacyPlayer(page,true);
  await page.goto('/coincatch.html');
  await page.evaluate(()=>{
    Arcade.recordResult('coinCatch',224);
    Arcade.gameResult({game:'coinCatch',score:224});
  });
  const form = page.locator('.arcade-username-form');
  await form.getByRole('button').click();
  await expect(form.getByRole('status')).toHaveText('That username is already taken.');
  await form.getByRole('textbox').fill('Lockhart96_2');
  await form.getByRole('button').click();
  await expect(page.locator('.result-leaderboard-head')).toContainText('You: #3');
  expect(await page.evaluate(()=>window.sentScores)).toContainEqual(['Lockhart96_2','coinCatch',224]);
});

test('World claims the existing nickname before opening its room connection', async ({page}) => {
  await legacyPlayer(page);
  await page.addInitScript(()=>{
    window.WebSocket = class { constructor(){ window.connectedAs = localStorage.getItem('arcadeUsername'); } };
  });
  await page.goto('/world.html');
  await page.locator('#connectWorld').click();
  await expect.poll(()=>page.evaluate(()=>window.connectedAs)).toBe('Lockhart96');
});
