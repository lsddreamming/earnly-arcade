const {test,expect}=require('@playwright/test');

test('Arcade Empire renders its interactive floor and preserves sales after reload',async({page})=>{
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  // WebKit can return a context whose GPU process has already been lost.
  const supportsWebGL = await page.evaluate(() => {
    const probe = document.createElement('canvas');
    probe.width = probe.height = 1;
    const gl = probe.getContext('webgl2', {antialias:true, powerPreference:'low-power'});
    if (!gl || gl.isContextLost()) return false;
    const pixel = new Uint8Array(4);
    gl.clearColor(1, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const rendered = pixel[0] === 255 && !gl.isContextLost();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return rendered;
  });
  await page.goto('/spuds-arcade-empire.html');
  const floor=page.locator('figure canvas');
  await expect(floor).toBeVisible();
  if(supportsWebGL){
    await expect.poll(()=>floor.evaluate(el=>el.getAttribute('data-renderer'))).toBe('three');
  } else {
    // Accept a recovered GPU, otherwise require visible pixels on the fallback.
    await expect.poll(() => floor.evaluate(el => {
      if (el.dataset.renderer === 'three') return true;
      if (!document.querySelector('script[src="empire-floor.js"]')) return false;
      const ctx = el.getContext('2d');
      return !!ctx && ctx.getImageData(el.width >> 1, el.height >> 1, 1, 1).data[3] > 0;
    })).toBe(true);
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

test('a returning counter worker opens and keeps the app workshop',async({page})=>{
  // Seed the returning save before the game starts its pagehide checkpoint.
  await page.route('**/empire-save-fixture', route => route.fulfill({contentType:'text/html',body:'<!doctype html>'}));
  await page.goto('/empire-save-fixture');
  await page.evaluate(()=>localStorage.setItem('earnly.empire.guest.v1',JSON.stringify({
    levels:[1,0,0,0,0],venue:0,served:15,cash:450,lifetime:450
  })));
  await page.goto('/spuds-arcade-empire.html');
  await page.getByRole('button',{name:'Studio',exact:true}).click();
  await page.getByRole('button',{name:'$450',exact:true}).click();
  await expect(page.locator('#cash')).toHaveText('$0');
  await expect(page.getByText('App Workshop · Developer')).toBeVisible();
  await page.getByRole('button',{name:'Work shift'}).click();
  await page.reload();
  await page.getByRole('button',{name:'Studio',exact:true}).click();
  await expect(page.getByText('App Workshop · Developer')).toBeVisible();
});
