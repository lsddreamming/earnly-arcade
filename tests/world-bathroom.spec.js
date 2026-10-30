const {test,expect}=require('@playwright/test');
test('Bathroom collection has nine distinct, recolorable, unclipped models in four directions',async({page})=>{
 await page.route('https://**',r=>r.abort());await page.goto('/world.html?catalog=Bathroom');
 await expect(page.locator('#panelContent')).toContainText('Porcelain Toilet');
 const result=await page.evaluate(()=>{
  const problems=[],art=new Set();const items=EarnlyWorldCollections.bathroomItems;
  const render=(item,rotation,color)=>{const c=document.createElement('canvas');EarnlyWorldRenderer.thumbnail(c,{...item,rotation,color});const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let count=0,edge=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(p[(y*c.width+x)*4+3]){count++;if(!x||!y||x===c.width-1||y===c.height-1)edge++;}if(count<50||edge)problems.push(item.id+' clipped/empty '+rotation);return c.toDataURL();};
  for(const item of items){const views=[0,2,4,6].map(r=>render(item,r,item.color));if(views.every((v,i)=>v===render(item,i*2,'#d9a0b5')))problems.push(item.id+' color');art.add(views.join('|'));}
  return {count:items.length,unique:art.size,problems};
 });expect(result).toEqual({count:9,unique:9,problems:[]});
 await page.screenshot({path:'test-results/bathroom-catalog.png',fullPage:true});
});

 test('Bathroom catalog stays readable on narrow phones',async({page})=>{
 await page.setViewportSize({width:320,height:740});await page.route('https://**',r=>r.abort());await page.goto('/world.html?catalog=Bathroom');
 await expect(page.locator('#panelContent')).toContainText('Porcelain Toilet');
 expect(await page.locator('#worldPanel').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 await page.screenshot({path:'test-results/bathroom-rounded-phone.png',fullPage:true});
 });
