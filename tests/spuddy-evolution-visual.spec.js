const {test,expect}=require('@playwright/test');
test.use({viewport:{width:390,height:844},launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}});
test('3D phone graphics boot and rotated view',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/spuddy-evolution.html');
  await expect(page.locator('#world')).toHaveAttribute('data-renderer','webgl-3d');
  await expect(page.locator('#start')).toBeEnabled();
  await page.locator('#start').click();
  await page.screenshot({path:info.outputPath('3d-phone-front.png')});
  await page.locator('#camera').click();
  await expect(page.locator('#toast')).toContainText('View rotated');
  await page.waitForTimeout(700);
  await page.screenshot({path:info.outputPath('3d-phone-rotated.png')});
  await page.locator('#upgrades').click();
  await expect(page.locator('#evolutionGoal')).toHaveText('0/5 upgrades to Rootling');
  await expect(page.locator('#evolutionAbility')).toContainText('stronger Root burst');
  await page.screenshot({path:info.outputPath('3d-phone-evolution.png')});
  expect(errors).toEqual([]);
});
test('all five boss designs render with attack poses',async({page},info)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1100,height:1000});
  await page.route('**/monster-gallery.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}canvas{display:block}</style><canvas id="gallery"></canvas><script src="/spuddy-evolution-engine.js"></script><script src="/spuddy-evolution-3d.js"></script>'}));
  await page.goto('/monster-gallery.html');
  await page.evaluate(()=>{
    const g=SpuddyEvolution.create(null,()=>.4);g.s.x=0;g.s.z=-4;g.s.save.unlocked=4;
    g.s.enemies=g.s.enemies.filter(e=>e.boss);
    g.s.enemies.forEach((e,i)=>{e.x=[-8,0,8,-5,5][i];e.z=[-11,-11,-11,1,1][i];e.windup=1;e.targetX=e.x;e.targetZ=e.z+2;});
    const r=EvolutionRenderer.create(document.getElementById('gallery'),g);if(!r.available)throw Error('3D gallery unavailable');
    for(let i=0;i<20;i++){g.s.time+=.05;g.s.enemies.forEach(e=>e.phase+=.05);r.draw(.05);}
    window.galleryRenderer=r; window.galleryDiagnostics=r.diagnostics();
  });
  const diagnostics=await page.evaluate(()=>window.galleryDiagnostics);
  expect(diagnostics.combinedParts).toBeGreaterThan(0);expect(diagnostics.drawCalls).toBeGreaterThan(0);
  console.log('Boss gallery rendering:',JSON.stringify(diagnostics));
  await page.screenshot({path:info.outputPath('five-boss-designs.png')});
  expect(errors).toEqual([]);
});
