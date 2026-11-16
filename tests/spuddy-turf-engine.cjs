const {test}=require('node:test');const assert=require('node:assert/strict');const E=require('../spuddy-turf-engine.js');
function steps(s,n,d){E.turn(s,d);for(let i=0;i<n&&!s.ended;i++)E.step(s);}
test('closing an actual rectangular excursion claims interior and clears the trail',()=>{const s=E.create({mode:'practice'}),before=E.area(s,1);steps(s,8,0);steps(s,7,1);steps(s,8,2);steps(s,7,3);assert.equal(s.ended,false);assert.ok(E.area(s,1)>before+2);assert.equal(s.actors[0].path.length,0);assert.equal(s.trails.some(Boolean),false);assert.equal(s.grid[E.index(14,25)],1);assert.equal(s.grid[E.index(30,30)],0);});
test('reverse input is rejected and queued turns cannot reverse within a tick',()=>{const s=E.create();E.turn(s,2);assert.equal(s.actors[0].next,0);E.turn(s,3);E.turn(s,2);assert.equal(s.actors[0].next,3);});
test('self crossing ends the match with a specific reason',()=>{const s=E.create({mode:'practice'});steps(s,9,0);steps(s,4,1);steps(s,4,2);steps(s,4,3);assert.equal(s.ended,true);assert.match(s.reason,/own trail/);assert.equal(s.trails.some(Boolean),false);});
test('edge collision never writes outside the board',()=>{const s=E.create({mode:'practice'});steps(s,45,0);assert.equal(s.ended,true);assert.match(s.reason,/edge/);assert.equal(s.grid.length,1600);});
test('opponent trail cut removes territory and awards a cut',()=>{const s=E.create(),b=s.actors[1];b.x=32;b.y=8;b.dir=0;b.plan=[0];b.path=[E.index(9,20)];s.trails[b.path[0]]=2;E.step(s);assert.equal(b.alive,false);assert.equal(s.cuts,1);assert.equal(s.grid.includes(2),false);});
test('head collisions are symmetric',()=>{const s=E.create(),b=s.actors[1];b.x=10;b.y=20;b.dir=2;b.plan=[2];E.step(s);assert.equal(s.actors[0].alive,false);assert.equal(b.alive,false);});
test('claimed rival trail eliminates the rival, never hides a live tail',()=>{const s=E.create(),a=s.actors[0],b=s.actors[1];s.grid.fill(0);for(let y=10;y<=16;y++)for(let x=10;x<=16;x++)if(x===10||x===16||y===10||y===16)s.grid[E.index(x,y)]=1;b.path=[E.index(12,12)];s.trails[b.path[0]]=2;E.close(s,a);assert.equal(b.alive,false);assert.equal(s.trails.some(v=>v===2),false);});
test('ended games are immutable, bad dt is ignored and timer is capped',()=>{const s=E.create({mode:'practice'});const t=s.time;E.tick(s,NaN);E.tick(s,-1);assert.equal(s.time,t);s.time=s.limit-.01;E.tick(s,.02);assert.equal(s.time,s.limit);assert.equal(s.ended,true);const snapshot=JSON.stringify(s);E.tick(s,.1);assert.equal(JSON.stringify(s),snapshot);});
test('risk guidance reads closest blue patch without mutating the run',()=>{
 const s=E.create({mode:'practice'}),start=E.trailStatus(s);
 assert.equal(start.risk,'safe');assert.equal(start.exposed,false);
 assert.equal(start.home,null);
 steps(s,8,0);
 const before=JSON.stringify(s);
 const risk=E.trailStatus(s);
 assert.equal(risk.exposed,true);
 assert.equal(risk.risk,'exposed');
 assert.equal(risk.length,6);
 assert.equal(risk.homeDistance,6);
 assert.deepEqual(risk.home,{x:10,y:20});
 assert.equal(risk.homeDirection,'LEFT');
 assert.equal(risk.nearbyRival,false);
 assert.equal(JSON.stringify(s),before,'HUD guidance must not change physics or saves');
 s.actors.push({id:2,x:14,y:21,alive:true,path:[]});
 const danger=E.trailStatus(s);
 assert.equal(danger.nearbyRival,true);
 assert.equal(danger.risk,'danger');
 assert.equal(danger.rivalDistance,1);
 s.actors[1].alive=false;
 assert.equal(E.trailStatus(s).risk,'exposed');
});
test('border warning follows queued heading and remains read-only',()=>{
 const s=E.create({mode:'practice'}),a=s.actors[0];
 a.x=38;a.y=20;a.dir=0;a.next=0;
 assert.equal(E.trailStatus(s).edge,true);
 a.next=3;assert.equal(E.trailStatus(s).edge,false);
 a.y=1;a.next=3;assert.equal(E.trailStatus(s).edge,true);
});

test('seeded bot battles preserve grid and trail invariants over 200 runs',()=>{let totalClaims=0;for(let seed=1;seed<=200;seed++){const s=E.create({seed});for(let frame=0;frame<2400&&!s.ended;frame++){const a=s.actors[0];if(a.path.length>14){const path=E.routeHome(s,a);if(path.length)E.turn(s,path[0]);}else if(frame%12===0){let d=(seed+Math.floor(frame/12))%4;E.turn(s,d);}E.tick(s,.05);if(frame%40===0){assert.ok(s.actors.every(a=>a.x>=0&&a.x<40&&a.y>=0&&a.y<40));assert.ok(s.grid.every(x=>x>=0&&x<=4));for(const a of s.actors){assert.equal(a.path.length,new Set(a.path).size);for(const p of a.path)assert.equal(s.trails[p],a.id);}}totalClaims+=s.events.filter(e=>e.type==='claim').length;}assert.ok(s.peak>=1.5625&&s.peak<=100);}assert.ok(totalClaims>10,'bots must complete actual claims');});
