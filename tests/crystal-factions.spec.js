const {test,expect}=require('@playwright/test');
const E=require('../crystal-command-engine');
const races=Object.keys(E.FACTIONS);
function advance(s,seconds){for(let i=0;i<Math.ceil(seconds/E.STEP)&&!s.ended;i++)E.tick(s)}
function add(s,type,side,x,y){const faction=s.players[side].faction,d=E.typeFor(type,faction),shield=faction==='prism'&&type!=='worker'?Math.round(d.hp*.25):0,e={id:s.next++,type,side,faction,x,y,hp:d.hp-shield,maxHp:d.hp-shield,shield,maxShield:shield,lastDamage:-100,build:0,queue:[],incubation:[],brood:type==='base'&&faction==='verdant'?3:0,broodAt:0,progress:0,cool:0,path:[],order:null,carry:0,mine:0,patch:null,home:null,research:null,rally:null};s.entities.push(e);return e}
for(const faction of races){
 test(`${faction}: equal opening economy, unique names and protected lesson`,()=>{
  const s=E.create({factions:[faction,faction]});const base=s.entities.find(e=>e.side===0&&e.type==='base');
  expect(base.hp+base.shield).toBe(1600);expect(E.supply(s,0)).toEqual({used:4,cap:16});expect(s.players[0].crystals).toBe(250);
  const starting=s.crystals.reduce((n,e)=>n+e.left,0);advance(s,20);expect(s.players[0].mined).toBe(s.players[1].mined);
  expect(s.crystals.reduce((n,e)=>n+e.left,0)+s.entities.reduce((n,e)=>n+e.carry,0)+s.players.reduce((n,p)=>n+p.mined,0)).toBe(starting);
  expect(E.view(s,0).entities.every(e=>e.side===0)).toBe(true);expect(E.view(s,0).factions).toEqual([faction,faction]);
  for(const kind of Object.keys(E.TYPES)){const d=E.typeFor(kind,faction);expect(d.cost).toBe(E.TYPES[kind].cost);expect(d.supply).toBe(E.TYPES[kind].supply);if(faction!=='human')expect(d.name).not.toBe(E.TYPES[kind].name)}
  expect(E.create({learning:true,practice:true,factions:[faction,faction]}).players.map(p=>p.faction)).toEqual(['human','human']);
 });
 test(`${faction}: AI builds legal armies and wins against an idle opponent`,()=>{
  const s=E.create({practice:true,difficulty:'normal',factions:['human',faction]});advance(s,300);
  expect(s.winner).toBe(1);expect(s.players[1].crystals).toBeGreaterThanOrEqual(0);expect(s.entities.some(e=>e.side===1&&e.type==='factory')).toBe(true);
 });
}
test('human baseline remains unchanged and invalid factions cannot inject data',()=>{
 expect(E.typeFor('laser','human')).toEqual(E.TYPES.laser);expect(E.TYPES.laser).toMatchObject({hp:120,damage:15,speed:2.2,cost:100,time:7});
 const s=E.create({factions:['__proto__','toString']});expect(s.players.map(p=>p.faction)).toEqual(['human','human']);expect(E.command(s,0,{type:'build',kind:'__proto__',x:9,y:6}).ok).toBe(false);
});
test('brood recruitment requires race structures and grows three paid creatures concurrently',()=>{
 const s=E.create({factions:['verdant','human']}),b=s.entities.find(e=>e.side===0&&e.type==='base');s.players[0].crystals=2000;
 expect(E.command(s,0,{type:'train',id:b.id,kind:'laser'}).message).toContain('Thorn garden');
 expect(E.command(s,0,{type:'build',kind:'factory',x:9,y:6}).ok).toBe(true);advance(s,11);const f=s.entities.find(e=>e.side===0&&e.type==='factory');
 expect(E.command(s,0,{type:'train',id:f.id,kind:'laser'}).ok).toBe(false);
 const before=s.players[0].crystals;for(let i=0;i<3;i++)expect(E.command(s,0,{type:'train',id:b.id,kind:'laser'}).ok).toBe(true);
 expect(s.players[0].crystals).toBe(before-300);expect(E.supply(s,0).used).toBe(10);advance(s,7.1);
 expect(s.entities.filter(e=>e.side===0&&e.type==='laser')).toHaveLength(3);expect(b.queue).toHaveLength(0);expect(b.brood).toBeLessThanOrEqual(3);
});
test('race fields constrain placement equally in full state and fog view',()=>{
 for(const faction of ['verdant','prism']){const s=E.create({factions:[faction,'human']});s.players[0].crystals=2000;const w=s.entities.find(e=>e.type==='worker'&&e.side===0);w.x=22;w.y=6;advance(s,.05);const before=s.players[0].crystals;
  expect(E.placement(s,0,'factory',22,6).ok).toBe(false);expect(E.placement(E.view(s,0),0,'factory',22,6)).toEqual(E.placement(s,0,'factory',22,6));
  expect(E.command(s,0,{type:'build',kind:'factory',x:22,y:6}).ok).toBe(false);expect(s.players[0].crystals).toBe(before);
  expect(E.command(s,0,{type:'build',kind:'relay',x:22,y:6}).ok).toBe(true);advance(s,7.1);w.x=22;w.y=6;advance(s,.05);
  expect(E.placement(s,0,'factory',25,6).ok).toBe(true);expect(E.placement(E.view(s,0),0,'factory',25,6).ok).toBe(true);
 }
});
test('destroying a power source pauses crystal production until restored',()=>{
 const s=E.create({factions:['prism','human']});s.players[0].crystals=1000;
 const relay=add(s,'relay',0,22,6),f=add(s,'factory',0,25,6);expect(E.command(s,0,{type:'train',id:f.id,kind:'laser'}).ok).toBe(true);advance(s,1);relay.hp=0;advance(s,.1);const progress=f.progress;advance(s,3);expect(f.progress).toBe(progress);expect(f.powered).toBe(false);
 expect(E.command(s,0,{type:'train',id:f.id,kind:'laser'}).message).toContain('Power lost');add(s,'relay',0,22,6);advance(s,7);expect(s.entities.some(e=>e.side===0&&e.type==='laser')).toBe(true);
});
test('fire punishes brood bodies, ion resistance counters crystal attacks, acid breaks shields',()=>{
 function shot(attackerFaction,targetFaction,kind){const s=E.create({factions:[attackerFaction,targetFaction]});s.rocks=[];const a=add(s,kind,0,25,25),b=add(s,'laser',1,26,25);b.order={type:'move',x:50,y:50};const before=b.hp+b.shield;advance(s,.05);return {lost:before-b.hp-b.shield,b,a,s}}
 const fire=shot('human','verdant','siege');expect(fire.lost).toBeCloseTo(30*1.15,5);
 const ion=shot('prism','verdant','laser');expect(ion.lost).toBeCloseTo(15*1.08*.9,5);
 const acid=shot('verdant','prism','laser');expect(acid.lost).toBeCloseTo(15*1.3,5);expect(acid.b.hp).toBe(acid.b.maxHp);
});
test('shields and organic recovery require eight seconds out of combat',()=>{
 const s=E.create({factions:['prism','verdant']}),p=add(s,'laser',0,6,8),v=add(s,'laser',1,57,55);p.shield=0;p.hp-=10;v.hp-=10;p.lastDamage=v.lastDamage=s.time;
 advance(s,7);expect(p.shield).toBe(0);expect(v.hp).toBe(v.maxHp-10);advance(s,3);expect(p.shield).toBeGreaterThan(0);expect(p.hp).toBe(p.maxHp-10);expect(v.hp).toBeGreaterThan(v.maxHp-10);
});
for(const faction of ['verdant','prism'])test(`${faction}: phone selection, unique palette, graphics and lesson`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:320,height:568});await page.goto('/crystal-command.html');await page.locator('#faction').selectOption(faction);await page.locator('#opponentFaction').selectOption(faction==='prism'?'verdant':'prism');await page.locator('#practice').click();
 expect(await page.evaluate(()=>CrystalGame.view.player.faction)).toBe(faction);await expect(page.locator('#selectionName')).toHaveText(E.typeFor('base',faction).name);
 const first=page.locator('#palette [data-kind=worker]');expect((await first.boundingBox()).width).toBeGreaterThan(90);await expect(first).toContainText(E.typeFor('worker',faction).name);await first.click();await expect(page.locator('#trainingQueue')).toBeVisible();
 await page.locator('#buildTab').click();await expect(page.locator('[data-kind=factory]')).toContainText(E.typeFor('factory',faction).name);await page.locator('[data-kind=factory]').click();await expect(page.locator('#context')).toContainText(E.typeFor('factory',faction).name);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const quit=await page.locator('#quit').boundingBox();expect(quit.y+quit.height).toBeLessThanOrEqual(568);
 await page.locator('#quit').click();await page.locator('#confirmQuit').click();await page.locator('#again').click();await page.locator('#learn').click();expect(await page.evaluate(()=>CrystalGame.view.player.faction)).toBe('human');expect(errors).toEqual([]);
});
test('friend host locks its race and starts with the guest race from handshake',async({page})=>{
 await page.route('**/crystal-command-network.js*',r=>r.fulfill({contentType:'application/javascript',body:`window.CrystalNetwork={action:async()=>({side:0,id:'test',code:'TESTROOM'}),connect:(room,on,status)=>{window.injectPeer=on;window.sent=[];status(true);return{send:async p=>window.sent.push(p),close:async()=>{}}}};`}));
 await page.goto('/crystal-command.html');await page.locator('#faction').selectOption('prism');await page.locator('#createRoom').click();await expect(page.locator('#faction')).toBeDisabled();await page.evaluate(()=>injectPeer({type:'heartbeat',visible:true,ready:true,gameVersion:CrystalCommand.VERSION,faction:'verdant'}));
 await expect(page.locator('#lobby')).toBeHidden();expect(await page.evaluate(()=>CrystalGame.state.players.map(p=>p.faction))).toEqual(['prism','verdant']);
 await expect.poll(()=>page.evaluate(()=>window.sent.some(p=>p.type==='snapshot'&&p.view.factions[1]==='verdant'&&p.view.player.faction==='verdant'))).toBe(true);
});

test('equal-cost infantry, mixed and air engagements leave every race competitive',()=>{
 const results=require('../scripts/crystal-faction-balance.cjs').runBalance();expect(results).toHaveLength(18);
 for(const faction of races){const matches=results.filter(r=>r.factions.includes(faction)),wins=matches.filter(r=>r.winner===faction);expect(wins.length).toBeGreaterThan(0);expect(wins.length).toBeLessThan(matches.length);}
 for(const match of results)for(const remaining of match.remaining)expect(Number.isFinite(remaining)&&remaining>=0).toBe(true);
});
