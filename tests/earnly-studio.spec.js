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
