const assert=require('node:assert/strict');
const E=require('../neonbreach-engine.js');global.NeonBreachEngine=E;require('../neonbreach-sector.js');
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name)}
test('Gold door is solid until the key is collected',()=>{const s=E.createSector(()=>.4);s.player.x=7.4;s.player.y=13.5;E.tick(s,.05);assert.equal(s.doorOpen,false);assert.equal(E.wall(8.5,13.5,s.map),true);s.player.x=3.5;s.player.y=2.5;E.tick(s,.05);assert.equal(s.key,true);s.player.x=7.4;s.player.y=13.5;E.tick(s,.05);assert.equal(s.doorOpen,true);assert.equal(E.wall(8.5,13.5,s.map),false)});
test('Navigation cannot cross the locked door but finds the exit after opening',()=>{const s=E.createSector();E.navigation(s);assert.equal(s.nav[3*18+14],-1);s.player.x=3.5;s.player.y=2.5;E.tick(s,.05);s.player.x=7.4;s.player.y=13.5;E.tick(s,.05);E.navigation(s);assert.ok(s.nav[3*18+14]>=0)});
test('One shotgun pickup grants shells once, and ammo is consumed per trigger',()=>{const s=E.createSector();s.player.x=5.5;s.player.y=11.5;E.tick(s,.05);E.tick(s,.05);assert.equal(s.shells,8);assert.equal(s.weapon,'shotgun');s.enemies=[{x:5.5,y:10,type:'tank',hp:4,maxHp:4,spawn:0}];s.player.a=-Math.PI/2;s.cooldown=0;E.fire(s);assert.equal(s.enemies.length,0);assert.equal(s.shells,7);E.fire(s);assert.equal(s.shells,7);assert.equal(s.fired,1);assert.equal(s.hits,1)});
test('Shotgun pellets respect solid cover',()=>{const s=E.createSector();Object.assign(s.player,{x:7.5,y:13.5,a:0});s.weapon='shotgun';s.shells=2;s.enemies=[{x:9.5,y:13.5,type:'tank',hp:4}];E.fire(s);assert.equal(s.enemies[0].hp,4);assert.equal(s.shells,1)});
test('Empty shotgun falls back to the infinite carbine',()=>{const s=E.createSector();s.weapon='shotgun';s.shells=1;s.enemies=[];E.fire(s);assert.equal(s.shells,0);assert.equal(s.weapon,'carbine');s.cooldown=0;E.fire(s);assert.equal(s.shells,0)});
test('Sector has a reachable exit, finite supplies, and a clean replay',()=>{const s=E.createSector();s.enemies=[];s.time=181;E.tick(s,.05);assert.equal(s.ended,false);s.player.x=3.5;s.player.y=2.5;E.tick(s,.05);s.player.x=7.4;s.player.y=13.5;E.tick(s,.05);s.player.x=s.exit.x;s.player.y=s.exit.y;E.tick(s,.05);assert.equal(s.completed,true);assert.equal(s.ended,true);const fresh=E.createSector();assert.equal(fresh.key,false);assert.equal(fresh.doorOpen,false);assert.equal(fresh.shells,0);assert.notEqual(fresh.map,s.map)});
test('Wave Arena retains its original map, spawn loop, and timer',()=>{const s=E.create(()=>.4);for(let i=0;i<40;i++)E.tick(s,.05);assert.ok(s.enemies.length>0);assert.equal(E.MAP[13][8],'0');s.time=180;E.tick(s,.05);assert.equal(s.ended,true)});
function encounter(role,player,enemy){
 const s=E.createSector();
 Object.assign(s.player,player);
 s.enemies=[{type:role==='rail'?'sentry':'rusher',role,hp:4,maxHp:4,attack:0,spawn:0,...enemy}];
 return s;
}
function advance(s,frames,input){
 for(let i=0;i<frames;i++)E.tick(s,.05,input);
}
test('A plasma bolt takes time to arrive and can be sidestepped',()=>{
 const build=()=>encounter('plasma',{x:2.5,y:13.5,a:-Math.PI/2},{x:2.5,y:9.5});
 const still=build();advance(still,1);
 assert.equal(still.shots[0].plasma,true);
 assert.equal(still.player.hp,100);
 advance(still,39);assert.equal(still.player.hp,85);
 const dodging=build();advance(dodging,1);
 advance(dodging,12,{strafe:1});advance(dodging,27);
 assert.equal(dodging.player.hp,100);
});
test('A sentry warns before an instant shot and solid cover blocks it',()=>{
 const build=()=>encounter('rail',{x:2.5,y:9.5,a:0},{x:6.5,y:9.5});
 const still=build();advance(still,1);
 assert.ok(still.enemies[0].railTime>0);
 assert.ok(still.events.some(e=>e.type==='rail-lock'));
 assert.equal(still.player.hp,100);
 advance(still,18);
 assert.equal(still.player.hp,80);
 assert.equal(still.shots.length,0);
 const covered=build();advance(covered,1);
 // Put a solid wall across the locked shot while keeping the player in its path.
 covered.map[9]='100010001000000001';
 advance(covered,18);
 assert.equal(covered.player.hp,100);
 const dodging=build();advance(dodging,1);advance(dodging,18,{strafe:-1});
 assert.equal(dodging.player.hp,100);
});
test('Scattergun fires one visible spread and interrupts a surviving sentry',()=>{
 const s=encounter('rail',{x:2.5,y:9.5,a:0},{x:4,y:9.5,hp:6,maxHp:6});
 advance(s,1);
 assert.ok(s.enemies[0].railTime>0);
 Object.assign(s,{weapon:'shotgun',shells:2});
 assert.equal(E.fire(s),true);
 const shot=s.events.find(e=>e.type==='fire');
 assert.equal(shot.traces.length,7);
 assert.ok(shot.traces[0].y<shot.traces[6].y);
 assert.equal(s.shells,1);
 assert.equal(s.enemies[0].hp,2);
 assert.equal(s.enemies[0].railTime,0);
 assert.ok(s.enemies[0].stagger>0);
});
test('The key is visible through the window while its divider blocks movement and fire',()=>{
 const s=E.createSector();
 const key=s.supplies.find(item=>item.type==='key');
 Object.assign(s.player,{x:3.5,y:5.5,a:-Math.PI/2});
 const distance=s.player.y-key.y;
 assert.ok(E.ray(s.player.x,s.player.y,s.player.a,distance,s.viewMap)>=distance);
 assert.ok(E.ray(s.player.x,s.player.y,s.player.a,distance,s.map)<distance);
 s.enemies=[{...key,type:'sentry',hp:2}];
 assert.equal(E.fire(s),false);
 advance(s,12,{forward:1});
 assert.ok(s.player.y>5);
 assert.equal(s.key,false);
 E.navigation(s);
 assert.ok(s.nav[2*18+3]>=0,'the key must still be reachable around the window');
});
test('The key opens the drone bay once and leaves a route back to cover',()=>{
 const s=E.createSector();
 assert.ok(E.wall(5.5,2.5,s.map));
 Object.assign(s.player,{x:3.5,y:2.5});
 advance(s,2);
 assert.equal(s.enemies.filter(e=>e.ambush).length,2);
 assert.equal(s.events.filter(e=>e.kind==='ambush').length,1);
 assert.equal(E.wall(5.5,2.5,s.map),false);
 assert.equal(E.wall(5.5,2.5,s.viewMap),false);
 assert.equal(s.player.hp,100);
 advance(s,14);
 assert.ok(s.enemies.filter(e=>e.ambush).every(e=>e.spawn===0));
 E.navigation(s);
 assert.ok(s.nav[5*18+3]>=0,'the approach remains reachable after the ambush');
 const replay=E.createSector();
 assert.ok(E.wall(5.5,2.5,replay.map));
 assert.equal(replay.enemies.some(e=>e.ambush),false);
});
console.log(count+' Sector Run checks passed');
