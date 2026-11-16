const {test,expect}=require('@playwright/test');
for(const prefix of ['', '/www']){
 test('Neon Breach visibly offers separate arena and extended sector missions '+prefix,async({page})=>{
  await page.setViewportSize({width:375,height:720});
  await page.goto(prefix+'/neonbreach.html');
  const arena=page.locator('[data-mode="arena"]'),sector=page.locator('[data-mode="sector"]');
  await expect(arena).toBeVisible();await expect(sector).toBeVisible();
  await expect(arena).toHaveAttribute('aria-pressed','true');
  await sector.click();
  await expect(sector).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#breachMode')).toHaveValue('sector');
  await expect(page.locator('#breachModeNote')).toContainText('extended chambers');
  const box=await sector.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(375);
 });
}
test('Extended mission preserves mandatory door, reachable objectives and changing enemy positions',async({page})=>{
 await page.goto('/neonbreach.html');
 const result=await page.evaluate(()=>{
  const E=NeonBreachEngine;
  function path(map,a,b){const w=map[0].length,seen=new Set([Math.floor(a.y)*w+Math.floor(a.x)]),queue=[[Math.floor(a.x),Math.floor(a.y)]];
   for(let i=0;i<queue.length;i++){const [x,y]=queue[i];if(x===Math.floor(b.x)&&y===Math.floor(b.y))return true;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,id=ny*w+nx;
     if(map[ny]?.[nx]!=='0'||seen.has(id))continue;seen.add(id);queue.push([nx,ny]);}
   }return false;
  }
  const layouts=[];
  for(let seed=1;seed<=32;seed++){let n=seed;const rand=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296};
   const s=E.createSector(rand);const key=s.supplies.find(i=>i.type==='key');const closed=path(s.map,s.player,s.exit);const toKey=path(s.map,s.player,key);
   const open=s.map.slice();open[13]=open[13].slice(0,8)+'0'+open[13].slice(9);
   layouts.push({size:s.map.length,enemies:s.enemies.length,valid:s.enemies.every(e=>E.clear(e.x,e.y,.24,s.map)),closed,toKey,toExit:path(open,{x:7.5,y:13.5},s.exit),spawn:s.enemies.map(e=>e.x+':'+e.y).join('|')});
  }
  return layouts;
 });
 expect(result.every(x=>x.size>=26&&x.enemies>=10&&x.valid&&x.toKey&&x.toExit&&!x.closed)).toBeTruthy();
 expect(new Set(result.map(x=>x.spawn)).size).toBeGreaterThan(20);
});
test('Root and web mirrors match for Sector Run files',async({request})=>{
 for(const file of ['neonbreach.html','neonbreach.js','neonbreach.css','neonbreach-sector.js']){
  const root=await request.get('/'+file),mirror=await request.get('/www/'+file);
  expect(root.ok()).toBeTruthy();expect(mirror.ok()).toBeTruthy();
  expect(await root.text()).toBe(await mirror.text());
 }
});