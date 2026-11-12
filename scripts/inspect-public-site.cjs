#!/usr/bin/env node
// Read-only guest inspection. Never click rewards, account, purchase, or chat actions.
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium, webkit } = require('playwright');
const { allowInspectionRequest } = require('./inspection-readonly-policy.cjs');
const origin = new URL(process.env.INSPECT_BASE_URL || 'https://earnlyarcade.com');
if (!['https://earnlyarcade.com', 'http://127.0.0.1:4173'].includes(origin.origin) || origin.pathname !== '/') {
  throw new Error('Use the Earnly public origin or an isolated localhost preview.');
}
const routes = ['index.html','games.html','world.html','stats.html','rewards.html','profile.html','leaderboards.html','avatars.html','settings.html','game-guides.html','support.html','about.html'];
const output = path.resolve(process.env.INSPECT_OUTPUT || 'inspection-results');
(async () => {
  await fs.mkdir(output, { recursive: true });
  const report = { timestamp: new Date().toISOString(), origin: origin.origin, checkoutSha: require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), scope: 'guest static page load and layout with network writes/third-party requests blocked; not gameplay or authenticated verification', results: [] };
  for (const device of [{ name:'desktop', engine:chromium, viewport:{width:1440,height:900} }, { name:'iphone', engine:webkit, viewport:{width:390,height:844}, isMobile:true, hasTouch:true }, { name:'narrow', engine:webkit, viewport:{width:320,height:568}, isMobile:true, hasTouch:true }, { name:'landscape', engine:webkit, viewport:{width:844,height:390}, isMobile:true, hasTouch:true }]) {
    let browser;
    try {
      browser = await device.engine.launch();
      const context = await browser.newContext({ viewport:device.viewport, isMobile:!!device.isMobile, hasTouch:!!device.hasTouch, serviceWorkers:'block', extraHTTPHeaders:{DNT:'1','Sec-GPC':'1'} });
      await context.addInitScript(() => {
        try { Object.defineProperty(navigator,'globalPrivacyControl',{configurable:true,value:true}); } catch (_) {}
      });
      // Same-origin static reads only: GET can otherwise invoke analytics APIs.
      // WebSockets may mutate multiplayer presence and are blocked separately.
      await context.route('**/*', route => allowInspectionRequest(route.request(), origin.origin) ? route.continue() : route.abort());
      await context.routeWebSocket('**/*', ws => ws.close());
      for (const route of routes) {
        const page = await context.newPage();
        const result = { device:device.name, route, errors:0 };
        page.on('pageerror', () => result.errors++);
        try {
          const response = await page.goto(new URL(route, origin).href, {waitUntil:'load',timeout:30000});
          result.status = response?.status();
          await page.evaluate(() => document.fonts.ready);
          result.layout = await page.evaluate(() => ({
            width:innerWidth, scrollWidth:document.documentElement.scrollWidth,
            title:document.title,
            visibleContentCharacters:(document.body?.innerText || '').trim().length,
            brokenImages:[...document.images].filter(i=>i.complete && i.naturalWidth===0).length
          }));
          result.capturedAt = new Date().toISOString();
          result.screenshot = `${device.name}-${route}.png`;
          await page.screenshot({path:path.join(output,result.screenshot),fullPage:true,timeout:15000});
          result.needsReview = result.status >= 400 || result.errors > 0 || result.layout.scrollWidth > result.layout.width + 1 || result.layout.brokenImages > 0 || result.layout.visibleContentCharacters < 20;
        } catch (error) { result.blocked = error.name; result.needsReview=true; }
        report.results.push(result);
        await fs.writeFile(path.join(output,'report.json'), JSON.stringify(report,null,2));
        await page.close();
      }
      await context.close();
    } catch (error) {
      report.results.push({device:device.name,blocked:error.name,message:error.message.split('\n')[0],reason:'Browser could not launch; inspect runtime or browser installation. This is not a website failure.'});
    } finally { if(browser) await browser.close(); }
  }
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  if (report.results.some(r=>r.blocked || r.needsReview)) process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
