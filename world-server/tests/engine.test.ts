import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomGrid,parseHeightmap,tileKey} from '../src/grid.ts';
import type {ItemPlacement} from '../src/grid.ts';
import {findPath,canStep} from '../src/pathfinding.ts';
import {findInteraction,completeInteraction,findInteractionExit,completeInteractionExit} from '../src/interactions.ts';
import {MovementController,parseMoveIntent} from '../src/movement.ts';
const grid=(map:string,items:ItemPlacement[]=[],revision=0)=>new RoomGrid(parseHeightmap(map),items,revision);
const item=(overrides:Partial<ItemPlacement>={}):ItemPlacement=>({id:'chair',x:1,y:1,z:0,width:1,length:1,rotation:0,itemHeight:1,walkable:false,canStack:true,canSit:true,...overrides});
test('strict heightmap parses holes, elevations and CRLF; rejects malformed/unbounded input',()=>{
 assert.deepEqual(parseHeightmap('01\r\n2x'),[[0,1],[2,null]]);
 for(const map of ['', '00\n0','0?',' '.repeat(4),'0'.repeat(65),'0\n'.repeat(65),'00\n'])assert.throws(()=>parseHeightmap(map));
 assert.throws(()=>new RoomGrid([[NaN]]));assert.throws(()=>new RoomGrid([[.5]]));
});
test('optimal diagonal route has authoritative Z and excludes start',()=>{
 const g=grid('000\n000\n000');const p=findPath(g,{x:0,y:0},{x:2,y:2});assert.equal(p.status,'ok');if(p.status!=='ok')return;
 assert.deepEqual(p.path,[{x:1,y:1,z:0},{x:2,y:2,z:0}]);assert.equal(p.cost,2*Math.SQRT2);
 assert.deepEqual(findPath(g,{x:0,y:0},{x:0,y:0}).path,[]);
});
test('corner cutting is blocked by void, solid decor, occupants and elevated side tiles',()=>{
 assert.equal(findPath(grid('0x\nx0'),{x:0,y:0},{x:1,y:1}).status,'unreachable');
 assert.equal(canStep(grid('000\n000\n000',[item({x:1,y:0})]),{x:0,y:0},{x:1,y:1}),false);
 assert.equal(canStep(grid('00\n00'),{x:0,y:0},{x:1,y:1},{occupied:new Set(['1,0'])}),false);
 assert.equal(canStep(grid('09\n00'),{x:0,y:0},{x:1,y:1}),false);
});
test('stair steps support asymmetric climb/descent; cliffs remain blocked',()=>{
 const g=grid('012');assert.equal(findPath(g,{x:0,y:0},{x:2,y:0}).status,'ok');
 assert.equal(findPath(g,{x:2,y:0},{x:0,y:0},{maxStepDown:0}).status,'unreachable');
 assert.equal(findPath(grid('02'),{x:0,y:0},{x:1,y:0}).status,'unreachable');
});
test('stack height is floor plus supported item heights; multi-tile rotation changes footprint',()=>{
 const g=grid('000\n000\n000',[item({id:'base',itemHeight:.5,walkable:true}),item({id:'top',z:.5,itemHeight:.5,walkable:true})]);
 assert.equal(g.tile({x:1,y:1})?.z,1);
 const rotated=grid('000\n000\n000',[item({x:0,y:0,width:2,length:1,rotation:2})]);
 assert.equal(rotated.tile({x:0,y:1})?.walkable,false);assert.equal(rotated.tile({x:1,y:0})?.walkable,true);
 for(const items of [[item({z:1})],[item(),item({id:'overlap',z:.5})],[item({canStack:false}),item({id:'top',z:1})],[item({x:2,width:2})],[item(),item()]])assert.throws(()=>grid('000\n000\n000',items));
});
test('bad coordinates, blocked goals and bounded searches fail explicitly',()=>{
 const g=grid('000\n000\n000');
 assert.equal(findPath(g,{x:NaN,y:0},{x:0,y:0}).status,'invalid');
 assert.equal(findPath(g,{x:0,y:0},{x:3,y:0}).status,'invalid');
 assert.equal(findPath(g,{x:0,y:0},{x:2,y:2},{maxExpanded:1}).status,'budget_exceeded');
 assert.equal(findPath(g,{x:0,y:0},{x:2,y:2},{occupied:new Set(['2,2'])}).status,'blocked');
 assert.equal(findPath(g,{x:0,y:0},{x:2,y:2},{maxStepUp:Infinity}).status,'invalid');
});
test('seat interaction approaches adjacent tile, checks occupancy and completes at seat height',()=>{
 const g=grid('000\n000\n000',[item()],2);const plan=findInteraction(g,{x:0,y:0},{x:1,y:1},'sit');assert.equal(plan.status,'ok');if(plan.status!=='ok')return;
 assert.ok(plan.path.every(p=>p.x!==1||p.y!==1));
 assert.deepEqual(completeInteraction(g,plan.approach,plan),{position:{x:1,y:1,z:1},state:'sit'});
 assert.equal(completeInteraction(g,plan.approach,plan,{occupied:new Set(['1,1'])}),null);
 assert.equal(completeInteraction(grid('000\n000\n000',[item()],3),plan.approach,plan),null);
 assert.equal(findInteraction(g,{x:0,y:0},{x:1,y:1},'lay').status,'blocked');
 assert.equal(findInteractionExit(g,{x:1,y:1,z:1},{x:0,y:0}).status,'ok');
});
test('bed interaction handles rotated footprints and rejects unreachable raised seats',()=>{
 const g=grid('0000\n0000\n0000',[item({id:'bed',width:2,canSit:false,canLay:true})]);
 const plan=findInteraction(g,{x:0,y:0},{x:2,y:1},'lay');assert.equal(plan.status,'ok');if(plan.status==='ok')assert.equal(completeInteraction(g,plan.approach,plan)?.state,'lay');
 assert.equal(findInteraction(grid('000\n000\n000',[item({itemHeight:3})]),{x:0,y:0},{x:1,y:1},'sit').status,'unreachable');
});
test('move intents reject client position, z, clock, speed and noninteger coordinates',()=>{
 assert.deepEqual(parseMoveIntent({type:'MOVE_TO',x:1,y:2}),{x:1,y:2});
 for(const extra of [{z:99},{speed:99},{userId:'other'},{timestamp:1}])assert.equal(parseMoveIntent({type:'MOVE_TO',x:1,y:2,...extra}),null);
 assert.equal(parseMoveIntent({type:'MOVE_TO',x:1.5,y:2}),null);
});
test('server movement stops for new obstacles and room edits; repeats cannot add speed',()=>{
 const g=grid('000\n000\n000',[],1),m=new MovementController(g,{x:0,y:0});m.moveTo(g,{type:'MOVE_TO',x:2,y:0});
 for(let n=0;n<30;n++)m.moveTo(g,{type:'MOVE_TO',x:2,y:0});assert.deepEqual(m.position,{x:0,y:0,z:0});
 assert.equal(m.tick(g).position.x,1);assert.equal(m.tick(g,new Set(['2,0'])).stopped,true);assert.equal(m.position.x,1);
 m.moveTo(g,{type:'MOVE_TO',x:2,y:0});assert.equal(m.tick(grid('000\n000\n000',[],2)).stopped,true);
});
test('A* costs match an independent Dijkstra oracle over 100 deterministic obstacle maps',()=>{
 let seed=17;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let n=0;n<100;n++){
  const floor=Array.from({length:6},()=>Array.from({length:6},()=>random()<.22?null:0));floor[0][0]=0;floor[5][5]=0;const g=new RoomGrid(floor);
  const distances=new Map([['0,0',0]]),pending=[{x:0,y:0,cost:0}];let expected=Infinity;
  while(pending.length){pending.sort((a,b)=>a.cost-b.cost);const p=pending.shift()!;if(p.cost!==distances.get(tileKey(p)))continue;if(p.x===5&&p.y===5){expected=p.cost;break;}
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const q={x:p.x+dx,y:p.y+dy};if(!g.tile(q)?.walkable)continue;if(dx&&dy&&(!g.tile({x:p.x+dx,y:p.y})?.walkable||!g.tile({x:p.x,y:p.y+dy})?.walkable))continue;const cost=p.cost+(dx&&dy?Math.SQRT2:1);if(cost<(distances.get(tileKey(q))??Infinity)){distances.set(tileKey(q),cost);pending.push({...q,cost});}}
  }
  const result=findPath(g,{x:0,y:0},{x:5,y:5});if(expected===Infinity)assert.equal(result.status,'unreachable');else{assert.equal(result.status,'ok');if(result.status==='ok')assert.ok(Math.abs(result.cost-expected)<1e-10);}
 }
});

test('seat exit validates a fresh free neighbor and revision',()=>{
 const g=grid('000\n000\n000',[item()],4);
 assert.deepEqual(completeInteractionExit(g,{x:1,y:1,z:1},{x:1,y:0,z:0},4),{position:{x:1,y:0,z:0},state:'std'});
 assert.equal(completeInteractionExit(g,{x:1,y:1,z:1},{x:1,y:0,z:0},4,{occupied:new Set(['1,0'])}),null);
 assert.equal(completeInteractionExit(g,{x:1,y:1,z:1},{x:0,y:0,z:0},4),null);
 assert.equal(completeInteractionExit(g,{x:1,y:1,z:1},{x:1,y:0,z:0},3),null);
});
