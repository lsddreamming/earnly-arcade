const {test,expect}=require('@playwright/test');
test('Star Defender touch steering cannot teleport the ship',async({page})=>{
 await page.goto('/stardefender.html');
 const source=await page.locator('html').evaluate(el=>el.outerHTML);
 expect(source).toContain('steerTarget=Math.max(19');
 expect(source).toContain('230*dt');
 expect(source).toContain('Math.min(Math.abs(delta),230*dt)');
 expect(source).not.toContain('shipX=Math.max(19,Math.min(W-19,(clientX-r.left)*W/r.width))');
});
test('Star Defender root and web mirror match',async({request})=>{
 const root=await request.get('/stardefender.html'), mirror=await request.get('/www/stardefender.html');
 expect(root.ok()).toBeTruthy();expect(mirror.ok()).toBeTruthy();
 expect(await root.text()).toBe(await mirror.text());
});