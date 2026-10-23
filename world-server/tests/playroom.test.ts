import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomGrid,parseHeightmap} from '../src/grid.ts';
import type {ItemPlacement} from '../src/grid.ts';
import {MovementController} from '../src/movement.ts';
import {RoomRuntime} from '../src/room-runtime.ts';
const floor=()=>parseHeightmap('00000\n00000\n00000\n00000\n00000');
const piece=(x:number,y:number,extra:Partial<ItemPlacement>={}):ItemPlacement=>({id:`${x}-${y}`,x,y,z:0,width:1,length:1,rotation:0,itemHeight:.25,walkable:true,canStack:false,...extra});
test('rollers carry two tiles, stop on clear floor, and allow stepping sideways',()=>{
 const grid=new RoomGrid(floor(),[piece(1,2,{roller:2}),piece(2,2,{roller:2})]);
 const rider=new MovementController(grid,{x:1,y:2});
 assert.deepEqual(rider.tick(grid).position,{x:3,y:2,z:0});assert.equal(rider.tick(grid).position.x,3);
 const escape=new MovementController(grid,{x:1,y:2});escape.moveTo(grid,{type:'MOVE_TO',x:1,y:3});assert.deepEqual(escape.tick(grid).position,{x:1,y:3,z:0});
});
test('rollers respect all four orientations, obstacles, players, voids and height limits',()=>{
 for(const [rotation,dx,dy] of [[0,0,-1],[2,1,0],[4,0,1],[6,-1,0]] as const){
  const grid=new RoomGrid(floor(),[piece(2,2,{roller:rotation})]);
  assert.deepEqual(new MovementController(grid,{x:2,y:2}).tick(grid).position,{x:2+dx,y:2+dy,z:0});
 }
 const grid=new RoomGrid(floor(),[piece(1,2,{roller:2}),piece(2,2,{roller:2})]);
 assert.equal(new MovementController(grid,{x:1,y:2}).tick(grid,new Set(['2,2'])).position.x,1);
 assert.equal(new MovementController(grid,{x:1,y:2}).tick(grid,new Set(['3,2'])).position.x,2);
 for(const g of [new RoomGrid(floor(),[piece(1,2,{roller:2}),piece(2,2,{walkable:false})]),new RoomGrid(parseHeightmap('00000\n00000\n00x00\n00000\n00000'),[piece(1,2,{roller:2})]),new RoomGrid(parseHeightmap('00000\n00000\n00900\n00000\n00000'),[piece(1,2,{roller:2})])])assert.equal(new MovementController(g,{x:1,y:2}).tick(g).position.x,1);
});
test('dice uses one server result, cooldown, adjacency, strict packets, join replay and removal cleanup',()=>{
 const grid=new RoomGrid(floor(),[piece(2,2,{walkable:false,itemHeight:1.5,furnitureUse:'dice'})]);
 const room=new RoomRuntime(grid),a:Record<string,unknown>[]=[],b:Record<string,unknown>[]=[];
 room.join({userId:'a',username:'A'},{x:1,y:2},p=>a.push(p));room.join({userId:'b',username:'B'},{x:3,y:2},p=>b.push(p));
 const roll={type:'INTERACT',x:2,y:2,action:'roll'};
 assert.equal(room.receive('a',{...roll,value:6},0),false);
 assert.equal(room.receive('a',roll,100),true);
 const result=a.at(-1)!;assert.deepEqual(result,b.at(-1));assert.ok(Number(result.value)>=1&&Number(result.value)<=6);
 assert.equal(room.receive('b',roll,200),false);assert.equal(room.receive('a',roll,500),false);
 const c:Record<string,unknown>[]=[];room.join({userId:'c',username:'C'},{x:0,y:0},p=>c.push(p));assert.equal(c.find(p=>p.type==='FURNITURE_RESULT')?.value,result.value);
 assert.equal(room.receive('c',roll,4000),false);assert.equal(room.receive('b',roll,4000),true);
 room.grid=new RoomGrid(floor(),[],1);room.tick();assert.equal(room.receive('a',roll,8000),false);
});
test('dispenser is free cosmetic interaction with shared feedback and no dice replay',()=>{
 const room=new RoomRuntime(new RoomGrid(floor(),[piece(2,2,{walkable:false,itemHeight:1.5,furnitureUse:'serve'})]));const a:Record<string,unknown>[]=[];
 room.join({userId:'a',username:'A'},{x:1,y:2},p=>a.push(p));assert.equal(room.receive('a',{type:'INTERACT',x:2,y:2,action:'serve'},0),true);assert.equal(a.at(-1)?.kind,'serve');
 const b:Record<string,unknown>[]=[];room.join({userId:'b',username:'B'},{x:3,y:2},p=>b.push(p));assert.equal(b.some(p=>p.type==='FURNITURE_RESULT'),false);
});
