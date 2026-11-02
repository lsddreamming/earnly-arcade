const {test,expect}=require('@playwright/test');
async function open(page,path='/mini.html?game=trafficEscape'){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-11-01T12:00:00Z')});await page.route('https://**',r=>r.abort());
 await page.addInitScript(()=>{localStorage.setItem('arcadeOnboardingSeen','1');localStorage.setItem('arcadeSound','off');localStorage.setItem('trafficEscapeBest','70');});
 await page.route('**/traffic-escape-engine.js',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+`;const originalTrafficCreate=TrafficEscapeEngine.create;TrafficEscapeEngine.create=(...args)=>{const g=originalTrafficCreate(...args);window.testTraffic=g;return g;};`});});
 await page.goto(path);await page.clock.pauseAt(new Date('2026-11-01T12:02:00Z'));await page.screenshot({path:test.info().outputPath('traffic-escape-launch.png')});await page.evaluate(()=>{Arcade.countdown=fn=>fn();});await page.locator('#startButton').click();await page.clock.runFor(50);await expect(page.locator('.traffic-car')).toHaveCount(6);return errors;
}
async function car(page,clear=true){return page.evaluate(clear=>{const s=testTraffic.state;return s.cars.find(c=>TrafficEscapeEngine.canExit(s.cars,c)===clear).id;},clear);}
for(const path of ['/mini.html?game=trafficEscape','/www/mini.html?game=trafficEscape']){
 test('Traffic Escape responsive car geometry, animation and exactly-once scoring '+path,async({page})=>{
  const errors=await open(page,path),id=await car(page);const button=page.locator('[data-car="'+id+'"]');
  await expect(button.locator('svg')).toBeVisible();expect(await page.locator('.traffic-car.clear-path').count()).toBe(0);
  if(test.info().project.name==='mobile-webkit')await button.tap();else await button.click();
  expect(await page.evaluate(()=>testTraffic.state.phase)).toBe('exit');await page.clock.runFor(220);await expect(page.locator('#score')).toHaveText('1');await expect(page.locator('.traffic-car')).toHaveCount(5);expect(errors).toEqual([]);
 });
 test('Traffic Escape crash settlement, replay and historical best preserve the reward metric '+path,async({page})=>{
  const errors=await open(page,path);await page.evaluate(()=>{window.trafficAwards=[];Arcade.earn=(amount,label,evidence)=>trafficAwards.push({amount,evidence});});
  const valid=await car(page);await page.locator('[data-car="'+valid+'"]').click();await page.clock.runFor(220);
  const blocked=await car(page,false);
  for(let i=0;i<3;i++){await page.locator('[data-car="'+blocked+'"]').click();await page.clock.runFor(350);}
  const dialog=page.locator('dialog.game-result-dialog');await expect(dialog).toBeVisible();await expect(dialog).toContainText('3 CRASHES');expect(await page.evaluate(()=>trafficAwards)).toEqual([{amount:0,evidence:{kind:'game',game:'trafficEscape',metric:1}}]);expect(await page.evaluate(()=>Arcade.best('trafficEscape').value)).toBe(70);
  await page.clock.runFor(2000);expect(await page.evaluate(()=>trafficAwards.length)).toBe(1);await dialog.getByRole('button',{name:/Play Again/}).click();await expect.poll(async()=>{await page.clock.runFor(50);return page.evaluate(()=>testTraffic.state.cleared);}).toBe(0);await expect(page.locator('.traffic-car')).toHaveCount(6);expect(errors).toEqual([]);
 });
}
test('Traffic Escape pause freezes fractional timer and departing vehicles, including keyboard resume',async({page})=>{
 const errors=await open(page);await page.clock.runFor(475);await page.locator('#earnlyPauseButton').focus();await page.keyboard.press('Enter');await expect(page.locator('#gameStatus')).toHaveText('Paused');const before=await page.evaluate(()=>JSON.stringify(testTraffic.state));await page.clock.runFor(10000);expect(await page.evaluate(()=>JSON.stringify(testTraffic.state))).toBe(before);await page.locator('#earnlyPauseButton').focus();await page.keyboard.press('Enter');await expect(page.locator('#gameStatus')).toHaveText('Running');await page.clock.runFor(100);expect(await page.evaluate(()=>testTraffic.state.remaining)).toBeLessThan(16);
 const id=await car(page);await page.locator('[data-car="'+id+'"]').click();await page.locator('#earnlyPauseButton').click();const departing=await page.evaluate(()=>JSON.stringify(testTraffic.state));await page.clock.runFor(10000);expect(await page.evaluate(()=>JSON.stringify(testTraffic.state))).toBe(departing);await page.getByRole('button',{name:/Resume/}).click();await page.clock.runFor(250);expect(await page.evaluate(()=>testTraffic.state.cleared)).toBe(1);expect(errors).toEqual([]);
});
test('Traffic Escape seven districts settle at 59 with clean roads, medals and no bonus currency',async({page})=>{
 const errors=await open(page);await page.evaluate(()=>{window.trafficAwards=[];Arcade.earn=(amount,label,evidence)=>trafficAwards.push({amount,evidence});});
 for(let i=0;i<59;i++){
  const id=await car(page);await page.locator('[data-car="'+id+'"]').click();await page.clock.runFor(220);
  if(await page.evaluate(()=>testTraffic.state.phase==='transition')){await page.screenshot({path:test.info().outputPath('traffic-escape-district.png')});await page.clock.runFor(800);}
 }
 const dialog=page.locator('dialog.game-result-dialog');await expect(dialog).toBeVisible();await expect(dialog).toContainText('CITY MASTER');await expect(dialog.locator('.result-outcome')).toContainText('All seven districts cleared');expect(await page.evaluate(()=>trafficAwards)).toEqual([{amount:21,evidence:{kind:'game',game:'trafficEscape',metric:59}}]);await page.screenshot({path:test.info().outputPath('traffic-escape-results.png')});expect(errors).toEqual([]);
});
test('Traffic Escape board and single Pause Quit dock fit phones, short desktops and landscape',async({page})=>{
 const errors=await open(page);await page.evaluate(()=>{testTraffic.advance=()=>[];});
 for(const size of [{width:320,height:568},{width:390,height:844},{width:440,height:956},{width:568,height:320},{width:667,height:375},{width:956,height:440},{width:1363,height:936},{width:1024,height:600}]){
  await page.setViewportSize(size);await page.clock.runFor(50);await page.screenshot({path:test.info().outputPath('traffic-escape-'+size.width+'x'+size.height+'.png')});
  for(const selector of ['.traffic-grid','#earnlyPauseButton','#earnlyQuitButton']){const c=page.locator(selector);await expect(c).toBeInViewport();const b=await c.boundingBox();expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(size.width);expect(b.y+b.height).toBeLessThanOrEqual(size.height);}
  const board=await page.locator('.traffic-grid').boundingBox();expect(Math.abs(board.width-board.height)).toBeLessThan(2);expect(board.width).toBeGreaterThan(size.height<450?120:200);
  for(const button of await page.locator('.traffic-car').all()){const b=await button.boundingBox();expect(b.x).toBeGreaterThanOrEqual(board.x);expect(b.y).toBeGreaterThanOrEqual(board.y);expect(b.x+b.width).toBeLessThanOrEqual(board.x+board.width);expect(b.y+b.height).toBeLessThanOrEqual(board.y+board.height);}
  await expect(page.locator('#miniGameExit')).toBeHidden();await expect(page.locator('.desktop-nav')).toBeHidden();expect(await page.locator('#earnlyQuitButton').count()).toBe(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width+1);
 }
 expect(errors).toEqual([]);
});

test('Traffic Escape keyboard decisions, clear transition pause and timeout all use active play time',async({page})=>{
 const errors=await open(page);await page.evaluate(()=>{window.trafficAwards=[];Arcade.earn=(amount,label,evidence)=>trafficAwards.push({amount,evidence});});
 const blocked=await car(page,false),button=page.locator('[data-car="'+blocked+'"]');await button.focus();await page.keyboard.down('Enter');await page.clock.runFor(1200);await page.keyboard.up('Enter');expect(await page.evaluate(()=>testTraffic.state.strikes)).toBe(1);
 for(let i=0;i<6;i++){const id=await car(page);await page.locator('[data-car="'+id+'"]').focus();await page.keyboard.press('Space');await page.clock.runFor(220);}
 expect(await page.evaluate(()=>testTraffic.state.phase)).toBe('transition');await page.locator('#earnlyPauseButton').click();const before=await page.evaluate(()=>JSON.stringify(testTraffic.state));await page.clock.runFor(20000);expect(await page.evaluate(()=>JSON.stringify(testTraffic.state))).toBe(before);await page.getByRole('button',{name:/Resume/}).click();await page.clock.runFor(800);expect(await page.evaluate(()=>testTraffic.state.level)).toBe(2);expect(await page.evaluate(()=>testTraffic.state.remaining)).toBeGreaterThan(13.8);
 await page.clock.runFor(14500);await expect(page.locator('dialog.game-result-dialog')).toBeVisible();await expect(page.locator('dialog.game-result-dialog')).toContainText('TIME EXPIRED');expect(await page.evaluate(()=>trafficAwards)).toEqual([{amount:0,evidence:{kind:'game',game:'trafficEscape',metric:6}}]);await page.clock.runFor(2000);expect(await page.evaluate(()=>trafficAwards.length)).toBe(1);expect(errors).toEqual([]);
});
