const { test, expect } = require('@playwright/test');
test('Star Defender uses relative finger travel, not tap teleport or sluggish target chasing',async({page})=>{
 await page.goto('/stardefender.html');
 const html=await page.locator('html').evaluate(e=>e.outerHTML);
 expect(html).toContain('dragLastX=boardX(e.clientX)');
 expect(html).toContain('shipX+x-dragLastX');
 expect(html).toContain('e.clientX<r.left||e.clientX>r.right');
 expect(html).not.toContain('steer(e.clientX)');
});
test('Star Defender root and www copies stay identical',async({request})=>{
 const a=await request.get('/stardefender.html'),b=await request.get('/www/stardefender.html');
 expect(a.ok()).toBeTruthy();expect(b.ok()).toBeTruthy();
 expect(await a.text()).toBe(await b.text());
});