const {test,expect}=require('@playwright/test');
const E=require('../crystal-command-engine');
function advance(s,seconds){for(let i=0;i<Math.round(seconds/E.STEP)&&!s.ended;i++)E.tick(s)}
test('workers deliver finite crystals and two armies start hidden',()=>{const s=E.create();expect(s.entities.filter(e=>e.side===0&&e.type==='worker')).toHaveLength(4);expect(E.view(s,0).entities.some(e=>e.side===1)).toBe(false);const total=s.crystals.reduce((n,c)=>n+c.left,0);advance(s,20);expect(s.players[0].mined).toBeGreaterThan(0);expect(s.crystals.reduce((n,c)=>n+c.left,0)+s.entities.reduce((n,e)=>n+e.carry,0)+s.players.reduce((n,p)=>n+p.mined,0)).toBe(total)});
test('construction, unit prerequisites and supply prevent button-spam armies',()=>{const s=E.create();const base=s.entities.find(e=>e.side===0&&e.type==='base');expect(E.command(s,0,{type:'train',id:base.id,kind:'siege'}).ok).toBe(false);expect(E.command(s,0,{type:'build',kind:'factory',x:9,y:6}).ok).toBe(true);expect(E.command(s,0,{type:'build',kind:'factory',x:9,y:6}).ok).toBe(false);const f=s.entities.find(e=>e.side===0&&e.type==='factory');expect(E.command(s,0,{type:'train',id:f.id,kind:'laser'}).ok).toBe(false);advance(s,12);s.players[0].crystals=10000;expect(E.command(s,0,{type:'train',id:f.id,kind:'siege'}).ok).toBe(false);for(let i=0;i<20;i++)E.command(s,0,{type:'train',id:f.id,kind:'laser'});expect(f.queue.length).toBe(5);advance(s,40);for(let i=0;i<20;i++)E.command(s,0,{type:'train',id:f.id,kind:'laser'});expect(E.supply(s,0).used).toBeLessThanOrEqual(16)});
test('orders validate owner, fog, coordinates and payload size',()=>{const s=E.create();const enemy=s.entities.find(e=>e.side===1&&e.type==='worker');expect(E.command(s,0,{type:'move',ids:[enemy.id],x:10,y:10}).ok).toBe(false);expect(E.command(s,0,{type:'build',kind:'base',x:33,y:33}).ok).toBe(false);expect(E.command(s,0,{type:'move',ids:Array(100).fill(1),x:NaN,y:1}).ok).toBe(false);expect(E.command(s,0,{type:'train',id:1,kind:'toString'}).ok).toBe(false);expect(E.command(s,0,{type:'build',kind:'toString',x:9,y:6}).ok).toBe(false);expect(Number.isFinite(s.players[0].crystals)).toBe(true)});
test('scouting reveals units and attack-move can destroy a rival base',()=>{const s=E.create();const army=s.entities.find(e=>e.side===0&&e.type==='worker');army.type='siege';army.hp=250;army.x=31;army.y=31;advance(s,.1);expect(E.view(s,0).entities.some(e=>e.side===1)).toBe(true);E.command(s,0,{type:'attack',ids:[army.id],x:33,y:33});advance(s,130);expect(s.ended).toBe(true);expect(s.winner).toBe(0)});
test('mining and combat produce deterministic state and idle practice loses',()=>{const a=E.create({practice:true}),b=E.create({practice:true});advance(a,140);advance(b,140);expect(E.view(a,0)).toEqual(E.view(b,0));expect(a.ended).toBe(true);expect(a.winner).toBe(1);expect(a.time).toBeLessThan(140)});
test('tactical paths avoid rocks and exhausted crystals cannot mint income',()=>{const s=E.create();const p=E.path(s,{x:10,y:12},{x:14,y:12});expect(p.length).toBeGreaterThan(4);expect(p.some(t=>s.rocks.some(r=>r.x===Math.floor(t.x)&&r.y===Math.floor(t.y)))).toBe(false);s.crystals.forEach(n=>n.left=0);advance(s,10);expect(s.players[0].crystals).toBe(250)});
test('mobile strategy controls, pause and quit confirmation work',async({page})=>{
 await page.goto('/crystal-command.html');await page.getByRole('button',{name:'▶ Practice battle'}).click();await expect(page.locator('#lobby')).toBeHidden();await expect(page.locator('.public-footer')).toBeHidden();await expect(page.locator('#crystals')).not.toHaveText('250',{timeout:15000});await page.getByRole('button',{name:'Build',exact:true}).click();await page.locator('#palette').getByRole('button',{name:/War factory/}).click();await expect(page.locator('#context')).toContainText('Place War factory');await expect(page.locator('[data-kind=factory]')).toHaveAttribute('aria-pressed','true');await page.locator('#pause').click();const tick=await page.evaluate(()=>CrystalGame.view.tick);await page.waitForTimeout(300);expect(await page.evaluate(()=>CrystalGame.view.tick)).toBe(tick);await page.locator('#pause').click();await page.locator('#quit').click();await expect(page.locator('#confirm')).toBeVisible();await page.getByRole('button',{name:'Keep playing'}).click();await expect(page.locator('#confirm')).toBeHidden();expect(await page.evaluate(()=>CrystalGame.running)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/crystal-command-${test.info().project.name}.png`});await page.locator('#quit').click();await page.getByRole('button',{name:'Quit battle',exact:true}).click();await expect(page.locator('#results')).toBeVisible();await expect(page.locator('#resultStats > div')).toHaveCount(3);await expect(page.locator('.public-footer')).toBeVisible();
});
test('friend rooms show a useful sign-in requirement to guests',async({page})=>{await page.goto('/crystal-command.html');await page.locator('#createRoom').click();await expect(page.locator('#lobbyError')).toContainText('Sign in');await expect(page.locator('#authLink')).toBeVisible()});

test('polished command deck fits small phones and rendered factories remain selectable',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>localStorage.setItem('crystalSound','off'));
 await page.setViewportSize({width:320,height:568});await page.goto('/crystal-command.html');
 await expect(page.locator('.cc-dock')).toBeHidden();await expect(page.locator('#authLink')).toBeHidden();
 await page.getByRole('button',{name:'▶ Practice battle'}).click();
 await page.getByRole('button',{name:'Build',exact:true}).click();
 for(const button of await page.locator('#palette button').all()){const box=await button.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(320)}
 const quit=await page.locator('#quit').boundingBox();expect(quit.y+quit.height).toBeLessThanOrEqual(568);
 await page.locator('#pause').click();
 const at=await page.evaluate(()=>{const s=CrystalGame.state;s.players[0].crystals=1000;const result=CrystalCommand.command(s,0,{type:'build',kind:'factory',x:9,y:6});if(!result.ok)throw Error(result.message);for(let i=0;i<210;i++)CrystalCommand.tick(s);return s.tick});
 await page.locator('#pause').click();await page.waitForFunction(tick=>CrystalGame.view.tick>tick,at);
 const scale=await page.evaluate(()=>CrystalGame.renderer.point(10,6).x-CrystalGame.renderer.point(9,6).x);await page.getByRole('button',{name:'Zoom in',exact:true}).click();await expect.poll(()=>page.evaluate(()=>CrystalGame.renderer.point(10,6).x-CrystalGame.renderer.point(9,6).x)).toBeGreaterThan(scale);
 const target=await page.evaluate(()=>CrystalGame.renderer.point(9,6,.4));
 expect(await page.evaluate(p=>CrystalGame.renderer.minimap(p.x,p.y),target)).toBe(false);
 await page.locator('#battle').click({position:target});
 await expect(page.locator('#context')).toContainText('War factory selected');await expect(page.locator('#palette')).toContainText('Striker');await expect(page.locator('#selectionName')).toHaveText('War factory');await expect(page.locator('#palette svg')).toHaveCount(2);
 await page.locator('#palette').getByRole('button',{name:/Striker/}).click();await expect(page.locator('#context')).toContainText('queued');
 expect(errors).toEqual([]);
});

test('expanded mineral lines last through an established economy and remain mirrored',()=>{
 const s=E.create(),home=s.crystals.filter(n=>n.field==='Home field 0');expect(home).toHaveLength(6);expect(home.reduce((sum,n)=>sum+n.left,0)).toBe(14400);
 for(const n of s.crystals)expect(s.crystals.some(m=>m.x===39-n.x&&m.y===39-n.y&&m.left===n.left&&m.rich===n.rich)).toBe(true);
 const worker=s.entities.find(e=>e.type==='worker'&&e.side===0);for(let i=0;i<8;i++)s.entities.push({...worker,id:s.next++,x:5+i%3*.2,y:8+Math.floor(i/3)*.2,path:[],queue:[]});
 const total=s.crystals.reduce((sum,n)=>sum+n.left,0);advance(s,300);expect(home.reduce((sum,n)=>sum+n.left,0)).toBeGreaterThan(6000);expect(new Set(s.entities.filter(e=>e.side===0&&e.type==='worker').map(e=>e.patch)).size).toBe(6);
 expect(s.crystals.reduce((n,c)=>n+c.left,0)+s.entities.reduce((n,e)=>n+e.carry,0)+s.players.reduce((n,p)=>n+p.mined,0)).toBe(total);
});
test('one patch saturates and unseen reserves retain their last observed amount',()=>{
 const s=E.create(),node=s.crystals.find(n=>n.field==='Home field 0'),worker=s.entities.find(e=>e.type==='worker'&&e.side===0);s.crystals.forEach(n=>n.left=n.id===node.id?2400:0);s.entities=s.entities.filter(e=>e.type!=='worker');
 for(let i=0;i<12;i++)s.entities.push({...worker,id:s.next++,x:node.x+.1,y:node.y+.1,patch:node.id,path:[],queue:[],order:{type:'mine',x:node.x,y:node.y,target:node.id}});
 advance(s,12);expect(2400-node.left).toBeGreaterThan(0);expect(2400-node.left).toBeLessThanOrEqual(56);
 const observed=E.view(s,0).crystals.find(n=>n.id===node.id).left;s.entities.filter(e=>e.side===0).forEach(e=>{e.x=20;e.y=35;e.path=[];e.order={type:'stop'}});node.left=123;advance(s,.1);
 expect(E.view(s,0).crystals.find(n=>n.id===node.id).left).toBe(observed);
 s.entities.find(e=>e.side===0&&e.type==='base').x=node.x;s.entities.find(e=>e.side===0&&e.type==='base').y=node.y;advance(s,.1);expect(E.view(s,0).crystals.find(n=>n.id===node.id).left).toBe(123);
});
test('rally orders route new Miners to fields and only accept owned production buildings',()=>{
 const s=E.create(),base=s.entities.find(e=>e.side===0&&e.type==='base'),enemy=s.entities.find(e=>e.side===1&&e.type==='base'),node=s.crystals.find(n=>n.field==='Home field 0');
 expect(E.command(s,0,{type:'rally',id:enemy.id,x:3,y:3}).ok).toBe(false);expect(E.command(s,0,{type:'rally',id:base.id,x:NaN,y:3}).ok).toBe(false);
 expect(E.command(s,0,{type:'rally',id:base.id,x:node.x,y:node.y,target:node.id}).ok).toBe(true);const last=s.next;expect(E.command(s,0,{type:'train',id:base.id,kind:'worker'}).ok).toBe(true);advance(s,4.1);
 expect(s.entities.find(e=>e.id===last).order.target).toBe(node.id);
 expect(E.view(s,1).entities.filter(e=>e.side===0).every(e=>e.rally===null)).toBe(true);
});
test('research takes time, blocks duplicate projects and cancels with its Tech core',()=>{
 const s=E.create();s.players[0].crystals=3000;expect(E.command(s,0,{type:'build',kind:'lab',x:9,y:10}).ok).toBe(true);advance(s,12.1);const lab=s.entities.find(e=>e.type==='lab');
 expect(E.command(s,0,{type:'upgrade',id:lab.id,kind:'weapons'}).ok).toBe(true);expect(s.players[0].upgrade).toBe(0);const paid=s.players[0].crystals;
 expect(E.command(s,0,{type:'upgrade',id:lab.id,kind:'weapons'}).ok).toBe(false);expect(s.players[0].crystals).toBe(paid);advance(s,17);expect(s.players[0].upgrade).toBe(0);advance(s,1.1);expect(s.players[0].upgrade).toBe(1);
 expect(E.command(s,0,{type:'upgrade',id:lab.id,kind:'armor'}).ok).toBe(true);advance(s,16.1);expect(s.players[0].armor).toBe(1);
 expect(E.command(s,0,{type:'upgrade',id:lab.id,kind:'armor'}).ok).toBe(true);lab.hp=0;advance(s,30);expect(s.players[0].armor).toBe(1);
 const quiet=E.create();advance(quiet,600);expect(quiet.ended).toBe(false);advance(quiet,601);expect(quiet.reason).toContain('Twenty-minute');
});
test('phone economy controls inspect reserves, set rallies and show timed research',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('crystalSound','off'));await page.setViewportSize({width:320,height:568});await page.goto('/crystal-command.html');await page.locator('#practice').click();
 await expect(page.locator('#selectionDetail')).toContainText('crystals nearby');await page.evaluate(()=>CrystalGame.issue({type:'stop',ids:CrystalGame.view.entities.filter(e=>e.side===0&&e.type==='worker').map(e=>e.id)}));await page.locator('#setRally').click();const node=await page.evaluate(()=>{const n=CrystalGame.view.crystals.find(n=>n.field==='Home field 0');return{id:n.id,p:CrystalGame.renderer.point(n.x,n.y,.5)}});await page.locator('#battle').click({position:node.p});
 expect(await page.evaluate(()=>CrystalGame.state.entities.find(e=>e.type==='base'&&e.side===0).rally.target)).toBe(node.id);await expect(page.locator('#setRally')).toHaveAttribute('aria-pressed','false');
 await page.locator('#battle').click({position:node.p});await expect(page.locator('#selectionName')).toHaveText('Crystal patch');await expect(page.locator('#selectionDetail')).toContainText('remaining');
 await page.locator('#pause').click();const tick=await page.evaluate(()=>{const s=CrystalGame.state;s.players[0].crystals=3000;const r=CrystalCommand.command(s,0,{type:'build',kind:'lab',x:9,y:10});if(!r.ok)throw Error(r.message);for(let i=0;i<245;i++)CrystalCommand.tick(s);return s.tick});await page.locator('#pause').click();await page.waitForFunction(t=>CrystalGame.view.tick>t,tick);await page.evaluate(()=>CrystalGame.renderer.center(9,10));
 await expect.poll(()=>page.evaluate(()=>{const p=CrystalGame.renderer.point(9,10,.4),r=document.getElementById('battle').getBoundingClientRect();return Math.abs(p.x-r.width/2)})).toBe(0);
 const at=await page.evaluate(()=>CrystalGame.renderer.point(9,10,.4));await page.locator('#battle').click({position:at});await expect(page.locator('#palette')).toContainText('Weapons 1');await expect(page.locator('#palette')).toContainText('Armor 1');await page.locator('[data-research=weapons]').click();await expect(page.locator('#selectionDetail')).toContainText('Research');expect(await page.evaluate(()=>CrystalGame.view.player.upgrade)).toBe(0);await expect(page.locator('[data-research=weapons]')).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const quit=await page.locator('#quit').boundingBox();expect(quit.y+quit.height).toBeLessThanOrEqual(568);expect(errors).toEqual([]);
});
