const {test,expect}=require('@playwright/test');

test('Arcade Empire renders its interactive floor and preserves sales after reload',async({page})=>{
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.goto('/spuds-arcade-empire.html');
  const floor=page.locator('figure canvas');
  await expect(floor).toBeVisible();
  const supportsWebGL=await page.evaluate(()=>!!document.createElement('canvas').getContext('webgl2'));
  if(supportsWebGL){
    await expect.poll(()=>floor.evaluate(el=>el.getAttribute('data-renderer'))).toBe('three');
  }
  const serve=page.getByRole('button',{name:'Serve a customer'});
  await serve.click();
  await expect(page.locator('#cash')).toHaveText('$5');
  await page.locator('#zoom').click();
  await expect(page.locator('#zoom')).toHaveText('1.2×');
  await page.reload();
  await expect(page.locator('#cash')).toHaveText('$5');
  expect(errors).toEqual([]);
});
