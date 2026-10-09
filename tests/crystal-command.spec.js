const {test,expect}=require('@playwright/test');
const E=require('../crystal-command-engine');
function advance(s,seconds){for(let i=0;i<Math.round(seconds/E.STEP)&&!s.ended;i++)E.tick(s)}
test('workers deliver finite crystals and two armies start hidden',()=>{const s=E.create();expect(s.entities.filter(e=>e.side===0&&e.type==='worker')).toHaveLength(4);expect(E.view(s,0).entities.some(e=>e.side===1)).toBe(false);const total=s.crystals.reduce((n,c)=>n+c.left,0);advance(s,20);expect(s.players[0].mined).toBeGreaterThan(0);expect(s.crystals.reduce((n,c)=>n+c.left,0)+s.entities.reduce((n,e)=>n+e.carry,0)+s.players.reduce((n,p)=>n+p.mined,0)).toBe(total)});
test('construction, unit prerequisites and supply prevent button-spam armies',()=>{const s=E.create();const base=s.entities.find(e=>e.side===0&&e.type==='base');expect(E.command(s,0,{type:'train',id:base.id,kind:'siege'}).ok).toBe(false);expect(E.command(s,0,{type:'build',kind:'factory',x:9,y:6}).ok).toBe(true);expect(E.command(s,0,{type:'build',kind:'factory',x:9,y:6}).ok).toBe(false);const f=s.entities.find(e=>e.side===0&&e.type==='factory');expect(E.command(s,0,{type:'train',id:f.id,kind:'laser'}).ok).toBe(false);advance(s,12);s.players[0].crystals=10000;expect(E.command(s,0,{type:'train',id:f.id,kind:'siege'}).ok).toBe(false);for(let i=0;i<20;i++)E.command(s,0,{type:'train',id:f.id,kind:'laser'});expect(f.queue.length).toBe(5);advance(s,40);for(let i=0;i<20;i++)E.command(s,0,{type:'train',id:f.id,kind:'laser'});expect(E.supply(s,0).used).toBeLessThanOrEqual(16)});
test('orders validate owner, fog, coordinates and payload size',()=>{const s=E.create();const enemy=s.entities.find(e=>e.side===1&&e.type==='worker');expect(E.command(s,0,{type:'move',ids:[enemy.id],x:10,y:10}).ok).toBe(false);expect(E.command(s,0,{type:'build',kind:'base',x:33,y:33}).ok).toBe(false);expect(E.command(s,0,{type:'move',ids:Array(100).fill(1),x:NaN,y:1}).ok).toBe(false);expect(E.command(s,0,{type:'train',id:1,kind:'toString'}).ok).toBe(false);expect(E.command(s,0,{type:'build',kind:'toString',x:9,y:6}).ok).toBe(false);expect(Number.isFinite(s.players[0].crystals)).toBe(true)});
test('scouting reveals units and attack-move can destroy a rival base',()=>{const s=E.create();const army=s.entities.find(e=>e.side===0&&e.type==='worker');army.type='siege';army.hp=250;army.x=E.SIZE-9;army.y=E.SIZE-9;advance(s,.1);expect(E.view(s,0).entities.some(e=>e.side===1)).toBe(true);E.command(s,0,{type:'attack',ids:[army.id],x:E.SIZE-7,y:E.SIZE-7});advance(s,130);expect(s.ended).toBe(true);expect(s.winner).toBe(0)});
test('mining and combat produce deterministic state and idle practice loses',()=>{const a=E.create({practice:true}),b=E.create({practice:true});advance(a,190);advance(b,190);expect(E.view(a,0)).toEqual(E.view(b,0));expect(a.ended).toBe(true);expect(a.winner).toBe(1);expect(a.time).toBeLessThan(190)});
test('tactical paths avoid rocks and exhausted crystals cannot mint income',()=>{const s=E.create();const p=E.path(s,{x:10,y:12},{x:14,y:12});expect(p.length).toBeGreaterThan(4);expect(p.some(t=>s.rocks.some(r=>r.x===Math.floor(t.x)&&r.y===Math.floor(t.y)))).toBe(false);s.crystals.forEach(n=>n.left=0);advance(s,10);expect(s.players[0].crystals).toBe(250)});
test('mobile strategy controls, pause and quit confirmation work',async({page})=>{
 await page.goto('/crystal-command.html');await page.getByRole('button',{name:'▶ Practice melee'}).click();await expect(page.locator('#lobby')).toBeHidden();await expect(page.locator('.public-footer')).toBeHidden();await expect(page.locator('#crystals')).not.toHaveText('250',{timeout:15000});await page.getByRole('button',{name:'Build',exact:true}).click();await page.locator('#palette').getByRole('button',{name:/War factory/}).click();await expect(page.locator('#context')).toContainText('Place War factory');await expect(page.locator('[data-kind=factory]')).toHaveAttribute('aria-pressed','true');await page.locator('#pause').click();const tick=await page.evaluate(()=>CrystalGame.view.tick);await page.waitForTimeout(300);expect(await page.evaluate(()=>CrystalGame.view.tick)).toBe(tick);await page.locator('#pause').click();await page.locator('#quit').click();await expect(page.locator('#confirm')).toBeVisible();await page.getByRole('button',{name:'Keep playing'}).click();await expect(page.locator('#confirm')).toBeHidden();expect(await page.evaluate(()=>CrystalGame.running)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/crystal-command-${test.info().project.name}.png`});await page.locator('#quit').click();await page.getByRole('button',{name:'Quit battle',exact:true}).click();await expect(page.locator('#results')).toBeVisible();await expect(page.locator('#resultStats > div')).toHaveCount(3);await expect(page.locator('.public-footer')).toBeVisible();
});
test('friend rooms show a useful sign-in requirement to guests',async({page})=>{await page.goto('/crystal-command.html');await page.locator('#createRoom').click();await expect(page.locator('#lobbyError')).toContainText('Sign in');await expect(page.locator('#authLink')).toBeVisible()});

test('polished command deck fits small phones and rendered factories remain selectable',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>localStorage.setItem('crystalSound','off'));
 await page.setViewportSize({width:320,height:568});await page.goto('/crystal-command.html');
 await expect(page.locator('.cc-dock')).toBeHidden();await expect(page.locator('#authLink')).toBeHidden();
 await page.getByRole('button',{name:'▶ Practice melee'}).click();
 await page.getByRole('button',{name:'Build',exact:true}).click();
 await expect(page.locator('#palette [data-kind=factory]')).toBeVisible();for(const box of await page.locator('#palette button').evaluateAll(buttons=>buttons.map(button=>{const r=button.getBoundingClientRect();return{x:r.x,width:r.width}}))){expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(320)}
 const quit=await page.locator('#quit').boundingBox();expect(quit.y+quit.height).toBeLessThanOrEqual(568);
 await page.locator('#pause').click();
 const at=await page.evaluate(()=>{const s=CrystalGame.state;s.players[0].crystals=1000;const result=CrystalCommand.command(s,0,{type:'build',kind:'factory',x:9,y:6});if(!result.ok)throw Error(result.message);for(let i=0;i<210;i++)CrystalCommand.tick(s);return s.tick});
 await page.locator('#pause').click();await page.waitForFunction(tick=>CrystalGame.view.tick>tick,at);
 const scale=await page.evaluate(()=>CrystalGame.renderer.point(10,6).x-CrystalGame.renderer.point(9,6).x);await page.getByRole('button',{name:'Zoom in',exact:true}).click();await expect.poll(()=>page.evaluate(()=>CrystalGame.renderer.point(10,6).x-CrystalGame.renderer.point(9,6).x)).toBeGreaterThan(scale);
 const target=await page.evaluate(()=>CrystalGame.renderer.point(9,6,.4));
 expect(await page.evaluate(p=>CrystalGame.renderer.minimap(p.x,p.y),target)).toBe(false);
 await page.locator('#battle').click({position:target});
 await expect(page.locator('#context')).toContainText('War factory selected');await expect(page.locator('#palette')).toContainText('Striker');await expect(page.locator('#selectionName')).toHaveText('War factory');await expect(page.locator('#palette svg')).toHaveCount(3);
 await page.locator('#palette').getByRole('button',{name:/Striker/}).click();await expect(page.locator('#context')).toContainText('queued');
 expect(errors).toEqual([]);
});

test('expanded mineral lines last through an established economy and remain mirrored',()=>{
 const s=E.create(),home=s.crystals.filter(n=>n.field==='Home field 0');expect(home).toHaveLength(6);expect(home.reduce((sum,n)=>sum+n.left,0)).toBe(14400);
 for(const n of s.crystals)expect(s.crystals.some(m=>m.x===E.SIZE-1-n.x&&m.y===E.SIZE-1-n.y&&m.left===n.left&&m.rich===n.rich)).toBe(true);
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
 const quiet=E.create();advance(quiet,600);expect(quiet.ended).toBe(false);advance(quiet,601);expect(quiet.ended).toBe(false);
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

test('practice difficulty changes opening pressure without changing player resources',()=>{
 const attacks={};for(const difficulty of ['easy','normal','hard']){const s=E.create({practice:true,difficulty});expect(s.players[0].crystals).toBe(250);expect(s.crystals.filter(n=>n.field==='Home field 0').reduce((n,c)=>n+c.left,0)).toBe(14400);for(let i=0;i<4100;i++){E.tick(s);if(s.entities.some(e=>e.side===1&&e.order?.type==='attack')){attacks[difficulty]=s.time;break}}expect(attacks[difficulty]).toBeGreaterThan(0)}expect(attacks.easy).toBeGreaterThanOrEqual(95);expect(attacks.hard).toBeLessThan(attacks.normal);expect(attacks.normal).toBeLessThan(attacks.easy);expect(E.create({difficulty:'toString'}).difficulty).toBe('normal');expect(E.view(E.create(),0).difficulty).toBe(null);
});
test('focus fire validates visibility and pursues only the last known enemy position',()=>{
 const s=E.create(),a=s.entities.find(e=>e.side===0&&e.type==='worker'),enemy=s.entities.find(e=>e.side===1&&e.type==='base');a.type='laser';a.x=enemy.x-4;a.y=enemy.y;a.order={type:'stop'};advance(s,.1);
 expect(E.command(s,0,{type:'attack',ids:[a.id],x:a.x,y:a.y,target:a.id}).ok).toBe(false);expect(E.command(s,0,{type:'attack',ids:[a.id],x:enemy.x,y:enemy.y,target:enemy.id}).ok).toBe(true);
 const prior=enemy.hp;advance(s,1);expect(enemy.hp).toBeLessThan(prior);expect(E.view(s,1).player.alerts.base.tick).toBeGreaterThan(0);expect(E.view(s,0).player.alerts.base).toBeUndefined();const known={x:a.order.x,y:a.order.y};enemy.x=5;enemy.y=35;advance(s,.1);expect(a.order.x).toBe(known.x);expect(a.order.y).toBe(known.y);expect(E.command(s,0,{type:'attack',ids:[a.id],x:enemy.x,y:enemy.y,target:enemy.id}).ok).toBe(false);
});
test('phone squads save survivors, select multiple fighters and issue visible enemy targets',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('crystalSound','off'));await page.setViewportSize({width:320,height:568});await page.goto('/crystal-command.html');await expect(page.getByRole('radio',{name:/Easy/})).toHaveAttribute('aria-checked','true');await page.getByRole('radio',{name:/Hard/}).click();await page.locator('#practice').click();expect(await page.evaluate(()=>CrystalGame.state.difficulty)).toBe('hard');await page.locator('#pause').click();
 const harness=await page.evaluate(()=>{const s=CrystalGame.state;const workers=s.entities.filter(e=>e.side===0&&e.type==='worker');workers.slice(0,2).forEach((e,i)=>{e.type='laser';e.x=8+i*2;e.y=8;e.hp=e.maxHp=120;e.order={type:'stop'}});const enemy=s.entities.find(e=>e.side===1&&e.type==='worker');enemy.x=11;enemy.y=10;enemy.hp=enemy.maxHp=100000;enemy.order={type:'stop'};CrystalCommand.tick(s);return{tick:s.tick,ids:workers.slice(0,2).map(e=>e.id),enemy:enemy.id}});await page.locator('#pause').click();await page.waitForFunction(t=>CrystalGame.view.tick>t,harness.tick);await page.evaluate(()=>CrystalGame.renderer.center(9,8));await page.locator('#selectArmy').click();await expect(page.locator('#palette')).toHaveAttribute('data-mode','army');await page.locator('[data-save="0"]').click();await expect(page.locator('[data-recall="0"]')).toContainText('2');await page.keyboard.press('Shift+Digit2');await expect(page.locator('[data-recall="1"]')).toContainText('2');await page.keyboard.press('Digit2');await expect(page.locator('#selectionName')).toHaveText('2 units');await page.locator('[data-multi]').click();await expect(page.locator('[data-multi]')).toHaveAttribute('aria-pressed','true');
 const p=await page.evaluate(id=>{const e=CrystalGame.view.entities.find(e=>e.id===id);return CrystalGame.renderer.point(e.x,e.y,.4)},harness.ids[1]);await page.locator('#battle').click({position:p});await expect(page.locator('#selectionName')).toHaveText('Striker');await page.locator('[data-save="1"]').click();await expect(page.locator('[data-recall="1"]')).toContainText('1');await page.locator('[data-recall="0"]').click();await expect(page.locator('#selectionName')).toHaveText('2 units');
 const target=await page.evaluate(id=>{const e=CrystalGame.view.entities.find(e=>e.id===id);return CrystalGame.renderer.point(e.x,e.y,.4)},harness.enemy);await page.locator('#battle').click({position:target});expect(await page.evaluate(ids=>ids.every(id=>CrystalGame.state.entities.find(e=>e.id===id).order.target!==undefined),harness.ids)).toBe(true);await page.locator('[data-stop]').click();expect(await page.evaluate(ids=>ids.every(id=>CrystalGame.state.entities.find(e=>e.id===id).order.type==='stop'),harness.ids)).toBe(true);
 await page.locator('#pause').click();const death=await page.evaluate(id=>{CrystalGame.state.entities.find(e=>e.id===id).hp=0;CrystalCommand.tick(CrystalGame.state);return CrystalGame.state.tick},harness.ids[1]);await page.locator('#pause').click();await page.waitForFunction(t=>CrystalGame.view.tick>t,death);await page.locator('[data-recall="0"]').click();await expect(page.locator('#selectionName')).toHaveText('Striker');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const quit=await page.locator('#quit').boundingBox();expect(quit.y+quit.height).toBeLessThanOrEqual(568);expect(errors).toEqual([]);await page.locator('#quit').click();await page.locator('#confirmQuit').click();await page.locator('#again').click();await page.locator('#practice').click();await page.locator('#selectArmy').click();await expect(page.locator('[data-recall="0"]')).toBeDisabled();
});
test('battle alerts locate attacks and do not repeat each render frame',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('crystalSound','off'));await page.goto('/crystal-command.html');await page.locator('#practice').click();await page.locator('#pause').click();const t=await page.evaluate(()=>{const s=CrystalGame.state,base=s.entities.find(e=>e.side===0&&e.type==='base');s.players[0].alerts.base={tick:s.tick,time:s.time,x:base.x,y:base.y};CrystalCommand.tick(s);return s.tick});await page.locator('#pause').click();await page.waitForFunction(tick=>CrystalGame.view.tick>tick,t);await expect(page.locator('#battleAlert')).toContainText('Base under attack');await page.evaluate(()=>CrystalGame.renderer.center(20,20));await page.locator('#battleAlert').click();expect(await page.evaluate(()=>Math.abs(CrystalGame.renderer.point(6,6).x-document.getElementById('battle').getBoundingClientRect().width/2))).toBe(0);await page.waitForTimeout(7000);await expect(page.locator('#battleAlert')).toBeHidden();
});

test('destruction effects respect fog and are emitted once',()=>{
 const s=E.create(),enemy=s.entities.find(e=>e.side===1&&e.type==='worker');enemy.hp=0;E.tick(s);
 expect(s.events.filter(e=>e.type==='destroyed')).toHaveLength(1);expect(E.view(s,0).events.some(e=>e.type==='destroyed')).toBe(false);expect(E.view(s,1).events.some(e=>e.type==='destroyed')).toBe(true);
 E.tick(s);expect(s.events.some(e=>e.type==='destroyed')).toBe(false);expect(E.view(s,1).visualEvents.some(e=>e.type==='destroyed')).toBe(true);expect(E.view(s,0).visualEvents.some(e=>e.type==='destroyed')).toBe(false);advance(s,1);expect(E.view(s,1).visualEvents).toHaveLength(0);
 const own=s.entities.find(e=>e.side===0&&e.type==='worker');own.hp=0;E.tick(s);expect(E.view(s,0).events.find(e=>e.type==='destroyed')).toMatchObject({kind:'worker',x:own.x,y:own.y});
});
test('battlefield art freezes with game time and supports crowded reduced-motion scenes',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/crystal-command.html');
 const result=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.style.cssText='width:440px;height:500px';document.body.append(canvas);const r=CrystalRenderer.create(canvas),s=CrystalCommand.create(),v=CrystalCommand.view(s,0);v.tick=100;v.time=10;v.visible.fill(1);v.seen.fill(1);
  const sample=v.entities.find(e=>e.type==='worker');for(let i=0;i<120;i++)v.entities.push({...sample,id:1000+i,type:['worker','scout','laser','siege'][i%4],x:2+i%12*.6,y:2+Math.floor(i/12)*.6,hp:15,maxHp:100,carry:i%3?8:0,mine:i%3?0:1,order:{type:'move',x:8,y:8}});
  for(const [type,x,y,build]of [['factory',9,6,0],['lab',9,10,5],['relay',5,9,0],['turret',10,3,0]])v.entities.push({...sample,id:2000+v.entities.length,type,x,y,build,queue:type==='factory'?['laser']:[],progress:4});
  delete v.visualEvents;v.events=[{type:'shot',side:0,x:6,y:6,tx:8,ty:7,kind:'siege'},{type:'destroyed',side:0,x:5,y:5,kind:'laser'}];const before=JSON.stringify(v);r.render(v);const first=canvas.toDataURL();r.render(v);const frozen=canvas.toDataURL()===first;const timings=[];for(let i=0;i<30;i++){const t=performance.now();r.render(v);timings.push(performance.now()-t)}timings.sort((a,b)=>a-b);const unchanged=before===JSON.stringify(v);canvas.remove();return{frozen,unchanged,p95:timings[28]};
 });expect(result.frozen).toBe(true);expect(result.unchanged).toBe(true);expect(errors).toEqual([]);console.log('Crowded battlefield render p95 (ms):',result.p95.toFixed(1));
});

async function boxFixture(page){
 await page.addInitScript(()=>localStorage.setItem('crystalSound','off'));await page.setViewportSize({width:440,height:956});await page.goto('/crystal-command.html');await page.locator('#practice').click();await page.locator('#pause').click();
 const fixture=await page.evaluate(()=>{const s=CrystalGame.state,sample=s.entities.find(e=>e.side===0&&e.type==='worker');s.entities=s.entities.filter(e=>e.type!=='worker');const ids=[];for(const [side,type,x,y]of [[0,'laser',7,7],[0,'siege',8,7],[0,'worker',7,8],[1,'laser',8,8],[0,'laser',12,9]]){const e={...sample,id:s.next++,side,type,x,y,hp:100000,maxHp:100000,carry:0,mine:0,path:[],queue:[],order:{type:'stop'}};s.entities.push(e);ids.push(e.id)}CrystalCommand.tick(s);return{ids,tick:s.tick}});
 await page.locator('#pause').click();await page.waitForFunction(t=>CrystalGame.view.tick>t,fixture.tick);return fixture;
}
async function pointer(page,type,x,y,extra={}){await page.locator('#battle').dispatchEvent(type,{pointerId:91,pointerType:'touch',button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:y,isPrimary:true,...extra});}
async function touchBox(page,start,end,{double=false,cancel=false}={}){
 // Deliver a synthetic gesture in one browser task. Separate protocol round trips
 // can exceed the real 280ms double-tap window on a busy WebKit runner.
 await page.locator('#battle').evaluate((canvas,{start,end,double,cancel})=>{
  const capture=canvas.setPointerCapture;
  canvas.setPointerCapture=function(id){try{capture.call(this,id)}catch{}};
  try{
   const b=canvas.getBoundingClientRect();
   const send=(type,p)=>canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:91,pointerType:'touch',button:0,buttons:type==='pointerup'?0:1,clientX:b.x+p.x,clientY:b.y+p.y,isPrimary:true}));
   if(double){send('pointerdown',start);send('pointerup',start)}
   send('pointerdown',start);send('pointermove',end);
   send(cancel?'pointercancel':'pointerup',end);
  }finally{canvas.setPointerCapture=capture}
 },{start,end,double,cancel});
}

test('yellow boxes select owned fighters, support additive groups, miners and cancellation',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const f=await boxFixture(page);
 // Use screen bounds around the projected unit centers, rather than world-axis corners.
 const area=await page.evaluate(ids=>{const ps=CrystalGame.view.entities.filter(e=>ids.slice(0,4).includes(e.id)).map(e=>CrystalGame.renderer.point(e.x,e.y,.4));return{start:{x:Math.min(...ps.map(p=>p.x))-12,y:Math.min(...ps.map(p=>p.y))-12},end:{x:Math.max(...ps.map(p=>p.x))+12,y:Math.max(...ps.map(p=>p.y))+12}}},f.ids);
 await page.locator('#boxSelect').click();await expect(page.locator('#boxSelect')).toHaveAttribute('aria-pressed','true');
 const b=await page.locator('#battle').boundingBox();await page.mouse.move(b.x+area.start.x,b.y+area.start.y);await page.mouse.down();await page.mouse.move(b.x+area.end.x,b.y+area.end.y,{steps:5});await page.waitForTimeout(70);
 expect(await page.evaluate(()=>!!CrystalGame.selectionBox)).toBe(true);await expect.poll(()=>page.locator('#battle').evaluate((c,box)=>{const r=c.width/c.getBoundingClientRect().width,data=c.getContext('2d').getImageData(Math.floor((box.start.x-2)*r),Math.floor(((box.start.y+box.end.y)/2-2)*r),Math.ceil(5*r),Math.ceil(5*r)).data;for(let i=0;i<data.length;i+=4)if(data[i]>200&&data[i+1]>170&&data[i+2]<160)return true;return false},area)).toBe(true);await page.mouse.up();expect(await page.evaluate(()=>CrystalGame.selection)).toEqual(f.ids.slice(0,2));await expect(page.locator('#boxSelect')).toHaveAttribute('aria-pressed','false');expect(await page.evaluate(ids=>ids.slice(0,3).every(id=>CrystalGame.state.entities.find(e=>e.id===id).order.type==='stop'),f.ids)).toBe(true);
 await page.locator('[data-multi]').click();const extra=await page.evaluate(id=>{const e=CrystalGame.view.entities.find(e=>e.id===id),p=CrystalGame.renderer.point(e.x,e.y,.4);return{start:{x:p.x-10,y:p.y-10},end:{x:p.x+10,y:p.y+10}}},f.ids[4]);await page.locator('#boxSelect').click();await touchBox(page,extra.start,extra.end);expect((await page.evaluate(()=>CrystalGame.selection)).sort()).toEqual([f.ids[0],f.ids[1],f.ids[4]].sort());
 await page.locator('#boxSelect').click();await touchBox(page,area.start,area.end,{cancel:true});expect(await page.evaluate(()=>CrystalGame.selectionBox)).toBeNull();expect((await page.evaluate(()=>CrystalGame.selection)).sort()).toEqual([f.ids[0],f.ids[1],f.ids[4]].sort());
 const worker=await page.evaluate(id=>{const e=CrystalGame.view.entities.find(e=>e.id===id),p=CrystalGame.renderer.point(e.x,e.y,.4);return{start:{x:p.x-5,y:p.y-5},end:{x:p.x+5,y:p.y+5}}},f.ids[2]);await touchBox(page,worker.start,worker.end);expect(await page.evaluate(()=>CrystalGame.selection)).toEqual([f.ids[2]]);
 await page.locator('#boxSelect').click();await touchBox(page,{x:20,y:150},{x:45,y:180});expect(await page.evaluate(()=>CrystalGame.selection)).toEqual([]);expect(errors).toEqual([]);
});
test('phone double-tap drag selects without ordering and ordinary drags still pan',async({page})=>{
 const f=await boxFixture(page);await page.locator('#selectArmy').click();const area=await page.evaluate(ids=>{const ps=CrystalGame.view.entities.filter(e=>ids.slice(0,2).includes(e.id)).map(e=>CrystalGame.renderer.point(e.x,e.y,.4));return{start:{x:Math.min(...ps.map(p=>p.x))-28,y:Math.min(...ps.map(p=>p.y))-28},end:{x:Math.max(...ps.map(p=>p.x))+12,y:Math.max(...ps.map(p=>p.y))+12}}},f.ids);
 await touchBox(page,area.start,area.end,{double:true});expect(await page.evaluate(()=>CrystalGame.selection)).toEqual(f.ids.slice(0,2));await page.waitForTimeout(350);expect(await page.evaluate(ids=>ids.slice(0,2).every(id=>CrystalGame.state.entities.find(e=>e.id===id).order.type==='stop'),f.ids)).toBe(true);
 const before=await page.evaluate(()=>CrystalGame.renderer.point(6,6).x);await touchBox(page,{x:30,y:160},{x:90,y:190});expect(await page.evaluate(()=>CrystalGame.renderer.point(6,6).x)).not.toBe(before);expect(await page.evaluate(()=>CrystalGame.selection)).toEqual(f.ids.slice(0,2));
});
test('radar taps command all troops, drags look around, and large groups use bounded orders',async({page})=>{
 const f=await boxFixture(page);await page.locator('#selectArmy').click();const mini=await page.evaluate(()=>CrystalGame.renderer.minimapBounds),target={x:mini.x+mini.w*.8,y:mini.y+mini.h*.75};await page.locator('#battle').click({position:target});expect(await page.evaluate(ids=>ids.filter((id,i)=>i<2||i===4).every(id=>CrystalGame.state.entities.find(e=>e.id===id).order.type==='attack'),f.ids)).toBe(true);expect(await page.evaluate(ids=>CrystalGame.state.entities.find(e=>e.id===ids[2]).order.type,f.ids)).toBe('stop');
 await page.locator('#orderMode').click();await page.locator('#battle').click({position:{x:mini.x+mini.w*.6,y:mini.y+mini.h*.5}});expect(await page.evaluate(ids=>ids.slice(0,2).every(id=>CrystalGame.state.entities.find(e=>e.id===id).order.type==='move'),f.ids)).toBe(true);const orders=await page.evaluate(()=>JSON.stringify(CrystalGame.state.entities.filter(e=>e.side===0&&e.type!=='base').map(e=>e.order)));await touchBox(page,{x:mini.x+10,y:mini.y+10},{x:mini.x+30,y:mini.y+30});expect(await page.evaluate(()=>JSON.stringify(CrystalGame.state.entities.filter(e=>e.side===0&&e.type!=='base').map(e=>e.order)))).toBe(orders);
 await page.locator('#pause').click();const t=await page.evaluate(()=>{const s=CrystalGame.state,sample=s.entities.find(e=>e.type==='laser'&&e.side===0);for(let i=0;i<90;i++)s.entities.push({...sample,id:s.next++,x:6,y:6,order:{type:'stop'},path:[],queue:[]});CrystalCommand.tick(s);return s.tick});await page.locator('#pause').click();await page.waitForFunction(tick=>CrystalGame.view.tick>tick,t);await page.locator('#selectArmy').click();await page.locator('#battle').click({position:target});expect(await page.evaluate(()=>CrystalGame.state.entities.filter(e=>e.side===0&&e.type==='laser').every(e=>e.order.type==='move'))).toBe(true);
 await page.locator('#home').click();await page.locator('#setRally').click();await page.locator('#battle').click({position:target});expect(await page.evaluate(()=>CrystalGame.state.entities.find(e=>e.side===0&&e.type==='base').rally.x)).toBeCloseTo(E.SIZE*.8,0);await page.locator('#home').click();const now=await page.evaluate(()=>CrystalGame.renderer.minimapBounds);await page.locator('#battle').click({position:{x:now.x+now.w*.5,y:now.y+now.h*.5}});expect(await page.evaluate(()=>Math.abs(CrystalGame.renderer.point(20,20).x-220))).toBeLessThan(7);
});

test('placement preview agrees with build validation and never mutates a fog-filtered view',()=>{
 const s=E.create(),before=JSON.stringify(s),v=E.view(s,0),viewBefore=JSON.stringify(v);
 for(const [kind,x,y]of [['factory',9,6],['factory',6,6],['relay',3,3],['turret',12,12],['lab',33,33],['factory',NaN,6],['worker',9,6]]){
  const site=E.placement(v,0,kind,x,y),full=E.placement(s,0,kind,x,y);expect(site.ok).toBe(full.ok);expect(site.message).toBe(full.message);
 }
 expect(JSON.stringify(s)).toBe(before);expect(JSON.stringify(v)).toBe(viewBefore);expect(E.placement(v,0,'factory',9,6).ok).toBe(true);
 v.player.crystals=0;expect(E.placement(v,0,'factory',9,6).message).toContain('crystals');v.player.crystals=1000;v.entities=v.entities.filter(e=>e.type!=='worker');expect(E.placement(v,0,'factory',9,6).message).toContain('Miner');
 const result=E.command(s,0,{type:'build',kind:'factory',x:9,y:6});expect(result.ok).toBe(true);expect(s.players[0].crystals).toBe(70);expect(E.placement(E.view(s,0),0,'factory',9,6).ok).toBe(false);
});

test('drag blueprints and map ghosts turn red or green, drop once and preserve the camera',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('crystalSound','off'));await page.setViewportSize({width:440,height:956});await page.goto('/crystal-command.html');await page.locator('#practice').click();await page.locator('#buildTab').click();
 await page.evaluate(()=>CrystalGame.issue({type:'stop',ids:CrystalGame.view.entities.filter(e=>e.side===0&&e.type==='worker').map(e=>e.id)}));
 const before=await page.evaluate(()=>({funds:CrystalGame.state.players[0].crystals,point:CrystalGame.renderer.point(6,6)})),b=await page.locator('[data-kind=factory]').boundingBox(),c=await page.locator('#battle').boundingBox();const bad=await page.evaluate(()=>CrystalGame.renderer.point(6,6));
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(c.x+bad.x,c.y+bad.y,{steps:8});await expect.poll(()=>page.evaluate(()=>CrystalGame.placementPreview?.ok)).toBe(false);await expect.poll(()=>page.evaluate(()=>CrystalGame.placementPreview?.message)).toContain('clear');await page.screenshot({path:`test-results/crystal-build-red-${test.info().project.name}.png`});await page.mouse.up();
 expect(await page.evaluate(()=>CrystalGame.state.entities.filter(e=>e.side===0&&e.type==='factory').length)).toBe(0);expect(await page.evaluate(()=>CrystalGame.state.players[0].crystals)).toBe(before.funds);await expect(page.locator('#cancelBuild')).toBeVisible();
 const good=await page.evaluate(()=>CrystalGame.renderer.point(9,6));await page.mouse.move(c.x+bad.x,c.y+bad.y);await page.mouse.down();await page.mouse.move(c.x+good.x,c.y+good.y,{steps:8});await expect.poll(()=>page.evaluate(()=>CrystalGame.placementPreview?.ok)).toBe(true);expect(await page.evaluate(()=>CrystalGame.renderer.point(6,6))).toEqual(before.point);await page.screenshot({path:`test-results/crystal-build-green-${test.info().project.name}.png`});await page.mouse.up();
 expect(await page.evaluate(()=>CrystalGame.state.entities.filter(e=>e.side===0&&e.type==='factory').length)).toBe(1);expect(await page.evaluate(()=>CrystalGame.state.players[0].crystals)).toBe(before.funds-180);await expect(page.locator('#cancelBuild')).toBeHidden();await expect(page.locator('#message')).toContainText('assembling');expect(await page.evaluate(()=>CrystalGame.placementPreview)).toBeNull();
 expect(errors).toEqual([]);
});

test('touch blueprint drops outside the field and canceled map gestures spend no crystals',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('crystalSound','off'));await page.setViewportSize({width:320,height:568});await page.goto('/crystal-command.html');await page.locator('#practice').click();await page.locator('#buildTab').click();
 await page.locator('[data-kind=factory]').evaluate(b=>{const original=b.setPointerCapture.bind(b);b.setPointerCapture=id=>{try{original(id)}catch{}}});
 const pos=await page.locator('[data-kind=factory]').boundingBox();await page.locator('[data-kind=factory]').dispatchEvent('pointerdown',{pointerId:96,pointerType:'touch',button:0,clientX:pos.x+pos.width/2,clientY:pos.y+pos.height/2});await page.locator('[data-kind=factory]').dispatchEvent('pointermove',{pointerId:96,pointerType:'touch',button:0,clientX:10,clientY:pos.y+20});await page.locator('[data-kind=factory]').dispatchEvent('pointerup',{pointerId:96,pointerType:'touch',button:0,clientX:10,clientY:pos.y+20});
 expect(await page.evaluate(()=>CrystalGame.state.entities.some(e=>e.type==='factory'&&e.side===0))).toBe(false);await expect(page.locator('#cancelBuild')).toBeVisible();await expect(page.locator('#message')).toContainText('battlefield');
 const p=await page.evaluate(()=>CrystalGame.renderer.point(9,6));await touchBox(page,p,{x:p.x+5,y:p.y+5},{cancel:true});expect(await page.evaluate(()=>CrystalGame.placementPreview)).toBeNull();await page.locator('#cancelBuild').click();await expect(page.locator('#cancelBuild')).toBeHidden();expect(await page.evaluate(()=>CrystalGame.state.entities.some(e=>e.type==='factory'&&e.side===0))).toBe(false);const quit=await page.locator('#quit').boundingBox();expect(quit.y+quit.height).toBeLessThanOrEqual(568);
 await page.evaluate(()=>CrystalGame.issue({type:'stop',ids:CrystalGame.view.entities.filter(e=>e.side===0&&e.type==='worker').map(e=>e.id)}));const funds=await page.evaluate(()=>CrystalGame.state.players[0].crystals),field=await page.locator('#battle').boundingBox(),site=await page.evaluate(()=>CrystalGame.renderer.point(9,6));
 await page.locator('[data-kind=factory]').dispatchEvent('pointerdown',{pointerId:97,pointerType:'touch',button:0,clientX:pos.x+pos.width/2,clientY:pos.y+pos.height/2});await page.locator('[data-kind=factory]').dispatchEvent('pointermove',{pointerId:97,pointerType:'touch',button:0,clientX:field.x+site.x,clientY:field.y+site.y});expect(await page.evaluate(()=>CrystalGame.placementPreview?.ok)).toBe(true);await page.locator('[data-kind=factory]').dispatchEvent('pointerup',{pointerId:97,pointerType:'touch',button:0,clientX:field.x+site.x,clientY:field.y+site.y});expect(await page.evaluate(()=>CrystalGame.state.entities.filter(e=>e.type==='factory'&&e.side===0).length)).toBe(1);expect(await page.evaluate(()=>CrystalGame.state.players[0].crystals)).toBe(funds-180);
});

// Expanded forces: tech, aircraft, support, phone selection and AI.
function add(s,type,side,x,y){const sample=s.entities.find(e=>e.type==='worker')||s.entities[0],d=E.TYPES[type],e={...sample,id:s.next++,type,side,x,y,hp:d.hp,maxHp:d.hp,build:0,path:[],queue:[],order:{type:'stop'},rally:null,research:null,cool:0,carry:0,mine:0};s.entities.push(e);return e}
test('expanded production requires completed owned tech and reserves air supply',()=>{
 const s=E.create();s.players[0].crystals=10000;const base=s.entities.find(e=>e.side===0&&e.type==='base');
 expect(E.placement(s,0,'starport',9,6).message).toContain('War factory');const f=add(s,'factory',0,9,6);f.build=2;expect(E.placement(s,0,'starport',9,10).ok).toBe(false);f.build=0;
 expect(E.command(s,0,{type:'build',kind:'starport',x:9,y:10}).ok).toBe(true);const port=s.entities.find(e=>e.side===0&&e.type==='starport');expect(E.command(s,0,{type:'train',id:port.id,kind:'interceptor'}).ok).toBe(false);advance(s,15);
 const bay=add(s,'barracks',0,6,10);expect(E.command(s,0,{type:'train',id:base.id,kind:'interceptor'}).ok).toBe(false);expect(E.command(s,0,{type:'train',id:f.id,kind:'guardian'}).message).toContain('Arsenal');expect(E.command(s,0,{type:'train',id:port.id,kind:'bomber'}).message).toContain('Arsenal');
 const arsenal=add(s,'armory',1,35,29);expect(E.command(s,0,{type:'train',id:f.id,kind:'guardian'}).ok).toBe(false);arsenal.side=0;expect(E.command(s,0,{type:'train',id:port.id,kind:'cruiser'}).message).toContain('Tech core');add(s,'lab',0,10,3);for(let i=0;i<3;i++)add(s,'relay',0,20+i*2,4);
 for(const [id,kind]of [[bay.id,'raider'],[bay.id,'medic'],[f.id,'guardian'],[port.id,'interceptor'],[port.id,'bomber'],[port.id,'cruiser']])expect(E.command(s,0,{type:'train',id,kind}).ok).toBe(true);
 expect(E.supply(s,0).used).toBe(21);expect(E.command(s,0,{type:'rally',id:port.id,x:12,y:12}).ok).toBe(true);expect(E.command(s,0,{type:'rally',id:f.id,x:12,y:12}).ok).toBe(false);advance(s,45);
 for(const type of ['raider','medic','guardian','interceptor','bomber','cruiser'])expect(s.entities.some(e=>e.type===type&&e.side===0)).toBe(true);expect(E.supply(s,0).used).toBe(21);
 s.entities=s.entities.filter(e=>e.side!==0||e.type!=='relay');expect(E.command(s,0,{type:'train',id:port.id,kind:'cruiser'}).message).toContain('Supply');
});
test('air crosses rocks and ground-only units cannot focus or splash aircraft',()=>{
 const s=E.create(),fighter=add(s,'interceptor',0,10,12),siege=add(s,'siege',0,10,10),enemyAir=add(s,'interceptor',1,11,10),enemyGround=add(s,'raider',1,11,10);enemyAir.cool=enemyGround.cool=100;
 E.tick(s);expect(E.command(s,0,{type:'attack',ids:[siege.id],x:enemyAir.x,y:enemyAir.y,target:enemyAir.id}).message).toContain('cannot attack air');siege.cool=0;const hp=enemyAir.hp;advance(s,.1);expect(enemyAir.hp).toBe(hp);expect(enemyGround.hp).toBeLessThan(enemyGround.maxHp);
 E.command(s,0,{type:'move',ids:[fighter.id],x:12.5,y:12.5});advance(s,1);expect(fighter.x).toBeCloseTo(12.5);expect(fighter.y).toBeCloseTo(12.5);expect(fighter.path).toEqual([]);
 const bomber=add(s,'bomber',0,10,10);expect(E.canTarget(bomber,enemyAir)).toBe(false);expect(E.canTarget(bomber,enemyGround)).toBe(true);expect(E.canTarget(add(s,'flak',0,15,15),enemyGround)).toBe(false);expect(E.canTarget(add(s,'guardian',0,15,15),enemyAir)).toBe(true);
});
test('medics heal ground allies only, never overheal or prevent move-only orders',()=>{
 const s=E.create(),medic=add(s,'medic',0,9,6),patient=add(s,'laser',0,9,7),air=add(s,'interceptor',0,9,7),base=s.entities.find(e=>e.side===0&&e.type==='base');patient.hp=50;air.hp=50;base.hp=800;advance(s,2.2);expect(patient.hp).toBe(74);expect(air.hp).toBe(50);expect(base.hp).toBe(800);expect(E.view(s,0).visualEvents.some(e=>e.type==='heal')).toBe(true);
 patient.hp=119;advance(s,2);expect(patient.hp).toBe(120);patient.hp=50;E.command(s,0,{type:'move',ids:[medic.id],x:15,y:8});const before=medic.x;advance(s,1);expect(medic.x).toBeGreaterThan(before);expect(patient.hp).toBe(50);
});
test('air remains hidden outside vision and its combat events identify both layers',()=>{
 const s=E.create(),hidden=add(s,'cruiser',1,33,32);expect(E.view(s,0).version).toBe(E.VERSION);expect(E.view(s,0).entities.some(e=>e.id===hidden.id)).toBe(false);
 const a=add(s,'interceptor',0,9,6),b=add(s,'interceptor',1,10,6);b.cool=100;E.tick(s);const shot=s.events.find(e=>e.type==='shot'&&e.kind==='interceptor'&&e.side===0);expect(shot.air).toBe(true);expect(shot.targetAir).toBe(true);expect(b.hp).toBe(b.maxHp-E.TYPES.interceptor.airDamage);expect(E.view(s,0).entities.some(e=>e.id===hidden.id)).toBe(false);
});
test('phone advanced deck, aircraft production, elevated box selection and radar orders work',async({page})=>{
 test.setTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:320,height:568});await page.goto('/crystal-command.html');await page.locator('#practice').click();await page.locator('#buildTab').click();await page.locator('[data-group=advanced]').click();await expect(page.locator('[data-kind=starport]')).toBeDisabled();await expect(page.locator('[data-kind=starport]')).toContainText('Needs War factory');await expect(page.locator('#palette button')).toHaveCount(4);
 for(const r of await page.locator('#palette button').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return{x:r.x,right:r.right}})))expect(r.x>=0&&r.right<=320).toBe(true);expect((await page.locator('#quit').boundingBox()).y+(await page.locator('#quit').boundingBox()).height).toBeLessThanOrEqual(568);
 await page.locator('#pause').click();const tick=await page.evaluate(()=>{const s=CrystalGame.state;s.botAt=Infinity;s.players[0].crystals=10000;for(const [kind,x,y]of [['factory',9,6],['lab',6,10],['relay',10,3]]){const r=CrystalCommand.command(s,0,{type:'build',kind,x,y});if(!r.ok)throw Error(r.message)}for(let i=0;i<330;i++)CrystalCommand.tick(s);return s.tick});await page.locator('#pause').click();await page.waitForFunction(t=>CrystalGame.view.tick>t,tick);await expect(page.locator('[data-kind=starport]')).toBeEnabled();
 const card=await page.locator('[data-kind=starport]').boundingBox(),canvas=await page.locator('#battle').boundingBox(),spot=await page.evaluate(()=>CrystalGame.renderer.point(9,10));await page.mouse.move(card.x+card.width/2,card.y+card.height/2);await page.mouse.down();await page.mouse.move(canvas.x+spot.x,canvas.y+spot.y,{steps:5});await page.waitForFunction(()=>CrystalGame.placementPreview?.ok);await page.mouse.up();await page.waitForFunction(()=>CrystalGame.state.entities.some(e=>e.type==='starport'&&!e.build),{},{timeout:20000});await page.evaluate(()=>CrystalGame.renderer.center(9,10));const port=await page.evaluate(()=>CrystalGame.renderer.point(9,10,.4));await page.locator('#battle').click({position:port});await expect(page.locator('#selectionName')).toHaveText('Star hangar');await expect(page.locator('#palette svg')).toHaveCount(3);await expect(page.locator('#setRally')).toBeVisible();await expect(page.locator('[data-kind=bomber]')).toBeDisabled();await expect(page.locator('[data-kind=cruiser]')).toContainText('Needs Arsenal');
 await page.locator('[data-kind=interceptor]').click();await page.waitForFunction(()=>CrystalGame.view.entities.some(e=>e.type==='interceptor'),{},{timeout:15000});const unit=await page.evaluate(()=>CrystalGame.view.entities.find(e=>e.type==='interceptor'));await page.evaluate(u=>CrystalGame.renderer.center(u.x,u.y),unit);await page.locator('#boxSelect').click();const p=await page.evaluate(u=>CrystalGame.renderer.point(u.x,u.y,1.4),unit),field=await page.locator('#battle').boundingBox();await page.mouse.move(field.x+p.x-12,field.y+p.y-12);await page.mouse.down();await page.mouse.move(field.x+p.x+12,field.y+p.y+12,{steps:4});await page.mouse.up();expect(await page.evaluate(id=>CrystalGame.selection.includes(id),unit.id)).toBe(true);await expect(page.locator('#selectionDetail')).toContainText('AIR');
 await page.screenshot({path:`test-results/crystal-air-${test.info().project.name}.png`});const mini=await page.evaluate(()=>CrystalGame.renderer.minimapBounds);await page.locator('#battle').click({position:{x:mini.x+mini.w*.3,y:mini.y+mini.h*.3}});await page.waitForFunction(id=>CrystalGame.state.entities.find(e=>e.id===id).order?.type==='attack',unit.id);expect(errors).toEqual([]);
});
test('expanded models and healing effects render cleanly and freeze with pause',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:440,height:956});await page.goto('/crystal-command.html');await page.locator('#practice').click();await page.locator('#pause').click();const tick=await page.evaluate(()=>{const s=CrystalGame.state,sample=s.entities.find(e=>e.type==='worker');s.botAt=Infinity;for(const [type,x,y]of [['raider',5,8],['medic',7,8],['guardian',9,8],['interceptor',5,6],['bomber',7,6],['cruiser',9,6],['starport',10,3],['armory',6,11],['barracks',3,10],['flak',10,11]]){const d=CrystalCommand.TYPES[type];s.entities.push({...sample,id:s.next++,type,side:0,x,y,hp:d.hp,maxHp:d.hp,order:{type:'stop'},path:[],queue:[],build:0})}const patient=s.entities.find(e=>e.type==='raider');patient.hp=50;CrystalCommand.tick(s);return s.tick});await page.locator('#pause').click();await page.waitForFunction(t=>CrystalGame.view.tick>t,tick);await page.locator('#zoomOut').click();await page.locator('#zoomOut').click();await page.screenshot({path:`test-results/crystal-expanded-forces-${test.info().project.name}.png`});await page.locator('#pause').click();await page.waitForTimeout(100);const image=await page.locator('#battle').evaluate(c=>c.toDataURL());await page.waitForTimeout(200);expect(await page.locator('#battle').evaluate(c=>c.toDataURL())).toBe(image);expect(errors).toEqual([]);
});
test('practice tech branches find clear sites and include aircraft within the Easy army cap',()=>{
 const s=E.create({practice:true,difficulty:'easy'});s.entities.find(e=>e.side===0&&e.type==='base').hp=100000000;advance(s,330);expect(s.entities.some(e=>e.side===1&&e.type==='starport'&&!e.build)).toBe(true);expect(s.entities.some(e=>e.side===1&&E.TYPES[e.type].flying)).toBe(true);expect(s.entities.filter(e=>e.side===1&&E.TYPES[e.type].supply&&e.type!=='worker').length+s.entities.filter(e=>e.side===1).reduce((n,e)=>n+e.queue.filter(k=>k!=='worker').length,0)).toBeLessThanOrEqual(E.DIFFICULTIES.easy.armyCap);
});

test('guided learning stays safe beyond the battle limit without changing ordinary or online games',()=>{
 const lesson=E.create({practice:true,difficulty:'easy',learning:true});expect(lesson.learning).toBe(true);expect(lesson.entities.filter(e=>e.side===1)).toHaveLength(1);expect(lesson.entities.find(e=>e.side===1)).toMatchObject({type:'base',x:20,y:6,hp:350});advance(lesson,1201);expect(lesson.ended).toBe(false);expect(lesson.entities.some(e=>e.side===1&&e.order?.type==='attack')).toBe(false);expect(E.view(lesson,0).learning).toBe(true);
 const online=E.create({learning:true});expect(online.learning).toBe(false);expect(online.entities.filter(e=>e.side===1)).toHaveLength(5);expect(online.entities.find(e=>e.side===1&&e.type==='base').hp).toBe(1600);
 const ordinary=E.create({practice:true,difficulty:'easy'});advance(ordinary,190);expect(ordinary.entities.some(e=>e.side===1&&e.order?.type==='attack')).toBe(true);
});

test('new players complete a guided first win on a small phone using real construction and training',async({page})=>{
 test.setTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('crystalSound','off'));await page.setViewportSize({width:320,height:568});await page.goto('/crystal-command.html');await expect(page.locator('#learn')).toHaveClass(/primary/);await page.locator('#learn').click();await expect(page.locator('#lessonTitle')).toHaveText('Crystals pay for your army');await expect(page.locator('#lessonHelp')).toBeDisabled();await expect(page.locator('#learn')).toBeHidden();await expect(page.locator('#lessonHelp')).toBeEnabled({timeout:15000});await page.locator('#lessonHelp').click();await expect(page.locator('#lessonStep')).toContainText('STEP 2');await expect(page.locator('#palette [data-kind]')).toHaveCount(2);await expect(page.locator('[data-kind=factory]')).toHaveClass(/cc-lesson-target/);
 const dragBuild=async(kind,x,y)=>{const c=await page.locator('[data-kind='+kind+']').boundingBox(),r=await page.locator('#battle').boundingBox(),p=await page.evaluate(({x,y})=>CrystalGame.renderer.point(x,y),{x,y});await page.mouse.move(c.x+c.width/2,c.y+c.height/2);await page.mouse.down();await page.mouse.move(r.x+p.x,r.y+p.y,{steps:6});await page.waitForFunction(()=>CrystalGame.placementPreview?.ok);await page.mouse.up()};
 await dragBuild('factory',9,6);await expect(page.locator('#lessonText')).toContainText('Factory building');await expect(page.locator('#lessonStep')).toContainText('STEP 3',{timeout:15000});await page.locator('#lessonHelp').click();await expect(page.locator('#palette [data-kind]')).toHaveCount(1);await expect(page.locator('[data-kind=laser]')).toHaveClass(/cc-lesson-target/);for(let i=0;i<3;i++){await expect(page.locator('[data-kind=laser]')).toBeEnabled({timeout:15000});await page.locator('[data-kind=laser]').click()}
 await page.locator('#pause').click();await expect(page.locator('#lessonHelp')).toBeDisabled();const tick=await page.evaluate(()=>CrystalGame.state.tick);await page.waitForTimeout(400);expect(await page.evaluate(()=>CrystalGame.state.tick)).toBe(tick);await page.locator('#pause').click();await expect(page.locator('#lessonStep')).toContainText('STEP 4',{timeout:30000});await page.locator('#lessonHelp').click();await expect(page.locator('[data-kind=relay]')).toHaveClass(/cc-lesson-target/);await expect(page.locator('[data-kind=relay]')).toBeEnabled({timeout:15000});await dragBuild('relay',6,10);await expect(page.locator('#lessonStep')).toContainText('STEP 5',{timeout:15000});await expect(page.locator('#supply')).toHaveText('10 / 28');await page.locator('#lessonHelp').click();expect(await page.evaluate(()=>CrystalGame.selection.length)).toBe(3);await expect(page.locator('#lessonMarker')).toBeVisible();const m=await page.locator('#lessonMarker').boundingBox();await page.mouse.click(m.x+m.width/2,m.y+m.height*.75);await expect(page.locator('#lessonText')).toContainText('Good order!');await expect(page.locator('#resultTitle')).toHaveText('FIRST WIN!',{timeout:25000});expect(await page.evaluate(()=>localStorage.getItem('crystalLessonComplete'))).toBe('1');await expect(page.locator('#lesson')).toBeHidden();await expect(page.locator('#lessonReplay')).toBeVisible();await page.locator('#lessonReplay').click();await expect(page.locator('#lessonStep')).toContainText('STEP 1');await page.locator('#quit').click();await expect(page.locator('#confirm')).toBeVisible();await page.locator('#confirmQuit').click();await page.locator('#again').click();await expect(page.locator('#learn')).toBeVisible();await page.locator('#learn').click();
 // Complete the replay deterministically to verify the handoff resets the protected scenario.
 await page.evaluate(()=>{const s=CrystalGame.state;s.entities.find(e=>e.side===1).hp=0;CrystalCommand.tick(s)});await expect(page.locator('#again')).toHaveText('Play an Easy battle');await page.locator('#again').click();expect(await page.evaluate(()=>CrystalGame.state.learning)).toBe(false);expect(await page.evaluate(()=>CrystalGame.state.difficulty)).toBe('easy');await expect(page.locator('#lesson')).toBeHidden();await expect(page.locator('#buildGroups')).toBeHidden();expect(await page.evaluate(()=>CrystalGame.state.entities.filter(e=>e.side===1).length)).toBe(5);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const q=await page.locator('#quit').boundingBox();expect(q.y+q.height).toBeLessThanOrEqual(568);expect(errors).toEqual([]);
});

test('radar viewport matches battlefield corners after zoom and camera moves',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:440,height:956});await page.goto('/crystal-command.html');await page.locator('#practice').click();
 const inspect=()=>page.evaluate(()=>{const r=CrystalGame.renderer,canvas=document.querySelector('#battle').getBoundingClientRect();return{corners:r.viewport().map(p=>r.point(p.x,p.y)),width:canvas.width,height:canvas.height,span:r.viewport()[1].x-r.viewport()[0].x}});
 const check=async()=>{const v=await inspect();for(const [i,p]of v.corners.entries()){expect(p.x).toBeCloseTo([0,v.width,v.width,0][i],3);expect(p.y).toBeCloseTo([0,0,v.height,v.height][i],3)}return v};
 const before=await check();await page.locator('#zoomIn').click();await expect.poll(async()=>(await inspect()).span).toBeLessThan(before.span);await check();
 await page.evaluate(()=>CrystalGame.renderer.center(22,17));await page.waitForTimeout(100);await check();
 await page.setViewportSize({width:320,height:568});await page.waitForTimeout(100);await check();expect(errors).toEqual([]);
});

test('Frontier map has mirrored expansions, connected lanes and space beyond the old boundary',()=>{
 const s=E.create();expect(E.SIZE).toBe(64);expect(s.players[0].seen).toHaveLength(4096);expect(s.crystals).toHaveLength(64);
 const bases=s.entities.filter(e=>e.type==='base');expect(bases.map(e=>[e.x,e.y])).toEqual([[6,6],[57,57]]);
 for(const n of s.crystals.filter(n=>!n.rich))expect(s.crystals.some(m=>m.x===E.SIZE-1-n.x&&m.y===E.SIZE-1-n.y&&m.left===n.left)).toBe(true);
 const miner=s.entities.find(e=>e.side===0&&e.type==='worker');expect(E.command(s,0,{type:'move',ids:[miner.id],x:60,y:58}).ok).toBe(true);
 expect(E.command(s,0,{type:'move',ids:[miner.id],x:64,y:58}).ok).toBe(false);
 for(const target of [{x:57,y:57},{x:60,y:58},{x:32,y:32}]){const route=E.path(s,bases[0],target);expect(route.length).toBeGreaterThan(0);expect(route.some(t=>s.rocks.some(r=>r.x===Math.floor(t.x)&&r.y===Math.floor(t.y)))).toBe(false)}
});
test('far-side miners and buildings work across the expanded map',()=>{
 const s=E.create();advance(s,20);expect(s.players[1].mined).toBeGreaterThan(0);s.players[1].crystals=1000;
 expect(E.command(s,1,{type:'build',kind:'factory',x:54,y:56}).ok).toBe(true);advance(s,11);
 const f=s.entities.find(e=>e.side===1&&e.type==='factory');expect(f.build).toBe(0);expect(E.command(s,1,{type:'train',id:f.id,kind:'laser'}).ok).toBe(true);advance(s,8);expect(s.entities.some(e=>e.side===1&&e.type==='laser'&&e.x>40)).toBe(true);
});
test('Frontier radar reaches both far edges on a phone',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:440,height:956});await page.goto('/crystal-command.html');await page.locator('#practice').click();await page.locator('#pause').click();
 const point=await page.evaluate(()=>{const r=CrystalGame.renderer,m=r.minimapBounds,p=r.minimapPoint(m.x+m.w*.95,m.y+m.h*.95);r.center(p.x,p.y);return p});expect(point.x).toBeGreaterThan(60);expect(point.y).toBeGreaterThan(60);await page.locator('#home').click();expect(await page.evaluate(()=>CrystalGame.selection.length)).toBe(1);expect(errors).toEqual([]);
});

for(const map of Object.keys(E.MAPS)){
 test(`strategic map ${map} preserves fair resources and connected expansion routes`,()=>{
  const s=E.create({map});expect(s.map).toBe(map);expect(E.view(s,1).map).toBe(map);
  for(const n of s.crystals){expect(s.crystals.some(m=>m.x===63-n.x&&m.y===63-n.y&&m.left===n.left)).toBe(true);expect(s.rocks.some(r=>r.x===n.x&&r.y===n.y)).toBe(false);}
  for(const r of s.rocks)expect(s.rocks.some(m=>m.x===63-r.x&&m.y===63-r.y)).toBe(true);
  for(const side of [0,1]){const b=s.entities.find(e=>e.side===side&&e.type==='base');for(const n of s.crystals)expect(E.path(s,b,n).length).toBeGreaterThan(0);}
  expect(E.create({map,practice:true,learning:true}).map).toBe('frontier');
 });
 test(`commander ${map} scouts and establishes working expansions with earned resources`,()=>{
  test.setTimeout(90000);const s=E.create({practice:true,difficulty:'normal',map});s.entities.find(e=>e.side===0&&e.type==='base').hp=1e8;advance(s,330);
  const bases=s.entities.filter(e=>e.side===1&&e.type==='base'&&!e.build);expect(bases.length).toBeGreaterThan(1);
  expect(s.players[1].crystals).toBeGreaterThanOrEqual(0);expect(s.players[1].mined).toBeGreaterThan(5000);
  expect(Object.keys(s.players[1].knownCrystals).length).toBeGreaterThan(6);
  expect(s.entities.some(e=>e.side===1&&e.type==='worker'&&e.home!==bases[0].id)).toBe(true);
  expect(s.entities.some(e=>e.side===1&&e.type==='starport')).toBe(true);
 });
}
function tacticalArmy(s,type,count,x,y,side=1){const template=s.entities.find(e=>e.type==='worker'),out=[];for(let i=0;i<count;i++){const e={...template,id:s.next++,side,type,x:x+i*.2,y,hp:E.TYPES[type].hp,maxHp:E.TYPES[type].hp,queue:[],path:[],order:null};s.entities.push(e);out.push(e);}return out;}
test('commander remembers sightings without tracking hidden movement',()=>{
 const s=E.create({practice:true,difficulty:'normal'});s.time=100;s.players[1].crystals=0;const army=tacticalArmy(s,'laser',5,20,20);const enemy=s.entities.find(e=>e.side===0&&e.type==='base');enemy.x=23;enemy.y=20;E.tick(s);expect(s.botMemory.structures[enemy.id]).toMatchObject({x:23,y:20});
 enemy.x=4;enemy.y=45;s.botAt=0;s.botMemory.tacticsAt=0;s.botAttackAt=0;E.tick(s);expect(s.botMemory.structures[enemy.id]).toBeUndefined();expect(army[0].order.x).not.toBe(4);expect(E.view(s,0).botMemory).toBeUndefined();
});
test('commanders defend expansions, raid visible miners and retreat from superior forces',()=>{
 const s=E.create({practice:true,difficulty:'hard'});s.time=200;s.players[1].crystals=0;
 const army=tacticalArmy(s,'laser',6,46,46),expansion=tacticalArmy(s,'base',1,44,44)[0],intruder=tacticalArmy(s,'laser',1,45,44,0)[0];E.tick(s);expect(army[0].order.type).toBe('attack');expect(army[0].order.x).toBeCloseTo(intruder.x-1,0);
 s.entities=s.entities.filter(e=>e.id!==intruder.id&&e.id!==expansion.id);army.forEach(e=>{e.x=25;e.y=25;});tacticalArmy(s,'cruiser',8,26,25,0);s.botAt=0;s.botMemory.tacticsAt=0;E.tick(s);expect(s.botMemory.retreatUntil).toBeGreaterThan(s.time);expect(army[0].order.type).toBe('move');expect(army[0].order.x).toBeGreaterThan(50);
 const raid=E.create({practice:true,difficulty:'hard'});raid.time=200;raid.players[1].crystals=0;const raiders=tacticalArmy(raid,'raider',3,20,20);tacticalArmy(raid,'laser',3,21,20);const miner=tacticalArmy(raid,'worker',1,22,20,0)[0];E.tick(raid);expect(raiders[0].order.target).toBe(miner.id);
});
test('battlefield selection persists on phones and learning keeps its safe map',async({page})=>{
 await page.setViewportSize({width:320,height:568});await page.goto('/crystal-command.html');await page.locator('#battleMap').selectOption('crossing');await expect(page.locator('#mapDescription')).toContainText('Three passages');await page.reload();await expect(page.locator('#battleMap')).toHaveValue('crossing');await page.locator('#practice').click();expect(await page.evaluate(()=>CrystalGame.view.map)).toBe('crossing');await expect(page.locator('#hint')).toContainText('Shattered Crossing');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('#quit').click();await page.getByRole('button',{name:'Quit battle',exact:true}).click();await page.locator('#again').click();await page.locator('#learn').click();expect(await page.evaluate(()=>CrystalGame.view.map)).toBe('frontier');
});

// Standard melee eliminates structures, including unfinished foundations, not armies.
test('melee survives base loss but ends when the last structure is destroyed',()=>{
 const s=E.create(),factory=add(s,'factory',0,10,10);factory.build=5;
 s.entities.find(e=>e.side===0&&e.type==='base').hp=0;E.tick(s);
 expect(s.ended).toBe(false);factory.hp=0;E.tick(s);
 expect(s.entities.some(e=>e.side===0&&e.type==='worker')).toBe(true);
 expect(s.ended).toBe(true);expect(s.winner).toBe(1);expect(s.reason).toContain('structures');
});
test('simultaneous structure elimination draws and the guided lesson stays base-focused',()=>{
 const s=E.create();for(const e of s.entities)if(!E.TYPES[e.type].supply)e.hp=0;E.tick(s);expect(s.ended).toBe(true);expect(s.winner).toBe(null);
 const lesson=E.create({practice:true,learning:true});add(lesson,'relay',1,40,40);lesson.entities.find(e=>e.side===1&&e.type==='base').hp=0;E.tick(lesson);expect(lesson.winner).toBe(0);
});
