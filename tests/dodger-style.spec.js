const {test,expect}=require('@playwright/test');
test('retired Neon Dodger bookmarks open Neon Drift without spending plays or losing saves',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('dodgerBest','83');localStorage.setItem('dodgerGamesPlayed','2');localStorage.setItem('arcadeOnboardingSeen','1');});
 for(const prefix of ['','/www']){
  await page.goto(prefix+'/dodger.html');await expect(page).toHaveURL(new RegExp(prefix+'/neondrift.html$'));
  await expect(page.locator('#gameStatus')).toHaveText('Ready');await expect(page.locator('#plays')).toHaveText('3');
  const data=await page.evaluate(()=>Arcade.snapshotData().data);expect(data.dodgerBest).toBe('83');expect(data.dodgerGamesPlayed).toBe('2');
 }
});
test('active catalog, guides, missions and leaderboard choices retire Neon Dodger',async({page})=>{
 await page.goto('/games.html');await expect(page.locator('#games .game-card')).toHaveCount(23);await expect(page.locator('#games a[href="dodger.html"]')).toHaveCount(0);
 await page.locator('#gameSearch').fill('Neon Drift');await expect(page.locator('#games a[href="neondrift.html"]')).toHaveCount(1);
 for(const path of ['profile.html','stats.html','leaderboards.html','game-guides.html']){await page.goto('/'+path);await expect(page.getByRole('link',{name:'Neon Dodger',exact:true})).toHaveCount(0);}
 const state=await page.evaluate(()=>({names:Arcade.names,backup:Arcade.snapshotData().data}));expect(state.names.dodger).toBeUndefined();
});
