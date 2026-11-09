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
  expect(errors).toEqual([]);
});
