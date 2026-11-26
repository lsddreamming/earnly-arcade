const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const Engine=require('../supabase/functions/patch-cup/engine.js');

test('Cup verifier uses the exact shipped defense simulation',()=>{
  const engine=fs.readFileSync('supabase/functions/patch-cup/engine.js','utf8').trim();
  for(const prefix of ['','www/'])expect(fs.readFileSync(prefix+'spuddy-defense.html','utf8').includes(engine)).toBe(true);
});

test('Weekly Cup opens the right defense and preserves the best replay',async({page})=>{
  await page.route('**/functions/v1/patch-cup',route=>route.fulfill({json:{entries:[]}}));
  await page.goto('/spuddy-defense.html');
  await page.locator('#leaderboards').click();
  await expect(page.getByText('Be the first defender on this week’s board.')).toBeVisible();
  await page.getByRole('button',{name:'Play this week’s patch'}).click();
  await expect(page.locator('#difficultyLabel')).toHaveText('WEEKLY CHALLENGE');
  expect(await page.locator('.tower-choice canvas').evaluateAll(cs=>new Set(cs.map(c=>c.toDataURL())).size)).toBe(8);
  const record=await page.evaluate(()=>{
    const ch=SpuddyDefense.challenge('weekly'), game=SpuddyDefense.create({...ch,challenge:ch});
    const action={kind:'wave'};
    game.action(action);PatchCup.record(game.state,action);
    while(game.state.phase==='wave')game.step();
    PatchCup.finish(game.state);
    return PatchCup.read();
  });
  const ch=Engine.challenge('weekly',record.week.split(':')[1]), replay=Engine.create({...ch,challenge:ch});
  for(const move of record.moves)expect(replay.action(move.action)).toBe(true);
  for(let i=0;i<record.ticks;i++)replay.step();
  expect([record.waves,record.lives,record.cash]).toEqual([1,replay.state.lives,replay.state.money]);
});
