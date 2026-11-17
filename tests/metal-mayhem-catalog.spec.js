const {test,expect}=require('@playwright/test');
for(const prefix of ['/','/www/'])test(`Metal Mayhem is searchable in Games and in big adventures ${prefix}`,async({page})=>{await page.route('**/functions/v1/**',r=>r.fulfill({status:503,body:'{}'}));await page.route('**/auth/v1/**',r=>r.abort());await page.goto(prefix+'games.html',{waitUntil:'domcontentloaded'});await page.locator('#gameSearch').fill('Metal Mayhem');const tile=page.locator('[data-game="metalMayhem"]');await expect(tile).toHaveCount(1);await expect(tile.getByRole('link',{name:'Play Metal Mayhem'})).toHaveAttribute('href','metal-mayhem.html');await expect(tile).toContainText('3D robot combat');await page.locator('#gameSearch').fill('');await page.locator('[data-path="deep-session"]').click();await expect(tile).toBeVisible();});
for(const prefix of ['/','/www/'])test(`Metal Mayhem appears in Home rotation ${prefix}`,async({page})=>{
 const catalog=require('../home-featured.js').catalog;
 await page.addInitScript(items=>localStorage.setItem('earnly.home.featured.queue.v2',JSON.stringify({signature:items.map(x=>x.key).sort().join('|'),remaining:['metalMayhem','snake'],previous:[]})),catalog);
 await page.goto(prefix+'index.html',{waitUntil:'domcontentloaded'});
 const card=page.locator('#homeFeaturedGames [data-game="metalMayhem"]');
 await expect(card).toHaveAttribute('href','metal-mayhem.html');
 await expect(card).toContainText('Metal Mayhem');
 await expect(card.locator('img')).toHaveAttribute('src','game-preview-metal-mayhem.svg');
});
