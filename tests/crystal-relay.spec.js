const {test,expect}=require('@playwright/test');
const E=require('../crystal-command-engine');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const demo=path.resolve(__dirname,'../test-results/Crystal_Command_Mini_RTS-'+process.pid+'.html');
test.beforeAll(()=>execFileSync('python3',[path.resolve(__dirname,'../scripts/build-mini-rts.py'),demo]));
test('relay reserves become available only on completion and explain blocked production',()=>{
 const s=E.create(),base=s.entities.find(e=>e.side===0&&e.type==='base'),worker=s.entities.find(e=>e.side===0&&e.type==='worker');s.players[0].crystals=2000;
 for(let i=0;i<12;i++)s.entities.push({...worker,id:s.next++,queue:[],path:[]});
 expect(E.command(s,0,{type:'train',id:base.id,kind:'worker'}).message).toContain('+12 slots');
 expect(E.command(s,0,{type:'build',kind:'relay',x:9,y:6}).ok).toBe(true);expect(E.supply(s,0).cap).toBe(16);
 for(let i=0;i<142;i++)E.tick(s);expect(E.supply(s,0).cap).toBe(28);
 expect(E.command(s,0,{type:'train',id:base.id,kind:'worker'}).ok).toBe(true);expect(E.supply(s,0).used).toBe(17);
 s.entities.find(e=>e.type==='relay').hp=0;E.tick(s);expect(E.supply(s,0).cap).toBe(16);
});
test('troop-space help explains relays and opens the blueprint without spending crystals',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('crystalSound','off'));await page.setViewportSize({width:320,height:568});await page.goto('/crystal-command.html');await page.locator('#practice').click();await page.locator('#supplyHelp').click();
 await expect(page.locator('[data-kind=relay]')).toContainText('+12 troop slots');await expect(page.locator('#message')).toContainText('Queued troops use slots too');
 expect(await page.evaluate(()=>CrystalGame.view.entities.some(e=>e.type==='relay'&&e.side===0))).toBe(false);
 await page.locator('[data-kind=relay]').click();await expect(page.locator('#context')).toContainText('16 → 28');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const q=await page.locator('#quit').boundingBox();expect(q.y+q.height).toBeLessThanOrEqual(568);
});
test('single-file offline RTS mines, selects a box, right-clicks orders, trains and wins',async({page})=>{
 const errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url())});
 await page.setViewportSize({width:1280,height:800});await page.goto('file://'+demo);await page.locator('#practice').click();await page.locator('#sound').click();
 const canvas=await page.locator('#battle').boundingBox(),dock=await page.locator('.cc-dock').boundingBox();expect(dock.x).toBeGreaterThanOrEqual(canvas.x+canvas.width);
 await expect.poll(()=>page.evaluate(()=>CrystalGame.view.player.mined),{timeout:15000}).toBeGreaterThan(0);
 const points=await page.evaluate(()=>{const g=CrystalGame,w=g.view.entities.filter(e=>e.side===0&&e.type==='worker');g.issue({type:'stop',ids:w.map(e=>e.id)});return w.map(e=>g.renderer.point(e.x,e.y,.2))});
 const min={x:Math.min(...points.map(p=>p.x))-18,y:Math.min(...points.map(p=>p.y))-18},max={x:Math.max(...points.map(p=>p.x))+18,y:Math.max(...points.map(p=>p.y))+18};
 await page.mouse.move(canvas.x+min.x,canvas.y+min.y);await page.mouse.down();await page.mouse.move(canvas.x+max.x,canvas.y+max.y,{steps:8});await page.mouse.up();expect(await page.evaluate(()=>CrystalGame.selection.length)).toBe(4);
 const destination=await page.evaluate(()=>CrystalGame.renderer.point(10,8));await page.locator('#battle').click({position:destination,button:'right'});
 expect(await page.evaluate(()=>CrystalGame.selection.every(id=>CrystalGame.state.entities.find(e=>e.id===id).order.type==='attack'))).toBe(true);
 await page.locator('#home').click();await expect(page.locator('[data-kind=worker]')).toContainText('Worker');await page.evaluate(()=>{CrystalGame.state.players[0].crystals=1000});await expect(page.locator('[data-kind=worker]')).toBeEnabled();await page.locator('[data-kind=worker]').click();expect(await page.evaluate(()=>CrystalGame.state.entities.find(e=>e.side===0&&e.type==='base').queue.includes('worker'))).toBe(true);
 await page.evaluate(()=>{const s=CrystalGame.state;for(const e of s.entities)if(e.side===1&&!CrystalCommand.TYPES[e.type].supply)e.hp=0});await expect(page.locator('#results')).toBeVisible();await expect(page.locator('#resultText')).toContainText('All enemy structures destroyed');await expect(page.locator('#resultTitle')).toHaveText('VICTORY');await page.locator('#again').click();await expect(page.locator('#practice')).toBeVisible();expect(errors).toEqual([]);expect(network).toEqual([]);
});

test('live HUD preserves mobile button labels and tutorial highlights between taps',async({page})=>{
 await page.setViewportSize({width:320,height:568});await page.goto('/crystal-command.html');await page.locator('#learn').click();await expect(page.locator('#lessonHelp')).toBeEnabled({timeout:15000});
 await page.evaluate(()=>{window.controlNodes=['pause','lessonHelp'].map(id=>document.getElementById(id).firstChild);window.highlightChanges=0;window.highlightObserver=new MutationObserver(records=>{window.highlightChanges+=records.length});window.highlightObserver.observe(document.getElementById('crystals'),{attributes:true,attributeFilter:['class']})});
 await page.waitForTimeout(1000);
 expect(await page.evaluate(()=>['pause','lessonHelp'].every((id,i)=>document.getElementById(id).firstChild===window.controlNodes[i]))).toBe(true);expect(await page.evaluate(()=>window.highlightChanges)).toBe(0);
 await page.locator('#lessonHelp').click();await expect(page.locator('#lessonStep')).toContainText('STEP 2');await page.locator('#pause').click();await expect(page.locator('#pause')).toHaveText('Resume');await page.locator('#pause').click();await expect(page.locator('#pause')).toHaveText('Pause');
});
