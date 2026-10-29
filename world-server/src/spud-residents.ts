import {RoomGrid,tileKey} from './grid.ts';
import type {XY,XYZ} from './grid.ts';
import {canStep,findPath} from './pathfinding.ts';
import {findInteraction,completeInteraction,findInteractionExit,completeInteractionExit} from './interactions.ts';
import type {InteractionPlan} from './interactions.ts';

export const SPUDS=[
 {id:'jax',name:'Jax',personality:'comedian',color:'#dba969'},
 {id:'blitz',name:'Blitz',personality:'competitive gamer',color:'#699cf0'},
 {id:'mochi',name:'Mochi',personality:'shy',color:'#c9aae9'},
 {id:'zippy',name:'Zippy',personality:'energetic',color:'#83d4a2'},
 {id:'fern',name:'Sprout',personality:'garden lover',color:'#80ba83'},
 {id:'nova',name:'Nova',personality:'stargazer',color:'#9e9fe5'},
 {id:'pip',name:'Pixel',personality:'creative',color:'#e598b7'},
 {id:'rio',name:'Rio',personality:'music lover',color:'#dfa176'},
 {id:'sage',name:'Sage',personality:'bookworm',color:'#a1c8b0'},
 {id:'bea',name:'Bea',personality:'collector',color:'#d9bc75'},
] as const;
export type SpudId=typeof SPUDS[number]['id'];
export const spudDefinition=(id:unknown)=>SPUDS.find(s=>s.id===id);
function equipment(index:number){
 const part=(id:string)=>({id,imageUrl:'cosmetic-'+id+'.svg'});
 return {avatar:part(['russet-potato','cream-potato','rose-potato'][index%3]),outfit:part(['cozy-hoodie','neon-jacket','boardwalk-jacket','pulse-outfit','solar-jacket'][index%5]),shoes:part(['canvas-shoes','comet-sneakers','boardwalk-sneakers'][index%3]),eyes:part(['eyes-happy','eyes-green','eyes-lashes','eyes-amber'][index%4]),mouth:part(['mouth-grin','mouth-smirk','mouth-soft','mouth-smile'][index%4]),hair:part(['hair-curls','hair-sweep','hair-bob','hair-sprout'][index%4]),...(index%2===0?{head:part(index%4===0?'arcade-cap':'ribbed-beanie')}:{})};
}
type Actor={id:SpudId;position:XYZ;state:'std'|'sit'|'dance';activity:'resting'|'wandering'|'sitting'|'dancing'|'admiring'|'chatting';next:number;route:XYZ[];plan?:InteractionPlan;itemId?:string;invitedBy?:string;expires?:number};
/** One bounded, server-authoritative simulation; no timers, model calls or player targets.
 * Think at most once per resident per 8–20s, move every 750ms. Never pursue a player.
 */
export class SpudResidents{
 #actors:Actor[]=[];#ticks=0;#random:()=>number;#cursor=0;
 #roster=[...SPUDS];#quietPopulation=5;#conversations=new Map<string,{id:SpudId;until:number}>();
 constructor(random:()=>number=Math.random){this.#random=random;this.#shuffle(random);}
 #shuffle(random:()=>number){for(let i=this.#roster.length-1;i>0;i--){const j=Math.min(i,Math.floor(random()*(i+1)));[this.#roster[i],this.#roster[j]]=[this.#roster[j],this.#roster[i]];}}
 setRoomKey(key:string){let seed=2166136261;for(const c of key)seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;this.#quietPopulation=4+(seed%2);this.#roster=[...SPUDS];this.#shuffle(()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;});}
 #held(a:Actor){return [...this.#conversations.values()].some(c=>c.id===a.id&&c.until>this.#ticks);}
 focus(user:string,id:SpudId){const a=this.#actors.find(a=>a.id===id);if(!a)return false;this.release(user);this.#conversations.set(user,{id,until:this.#ticks+180});a.route=[];if(a.state!=='sit'){a.plan=undefined;a.state='std';}a.activity='chatting';return true;}
 release(user:string,id?:SpudId){const c=this.#conversations.get(user);if(!c||(id!==undefined&&c.id!==id))return;this.#conversations.delete(user);const a=this.#actors.find(a=>a.id===c.id);if(a&&!this.#held(a)){a.activity=a.state==='sit'?'sitting':'resting';a.next=this.#ticks+8;}}

 snapshots(){return this.#actors.map(a=>{const i=SPUDS.findIndex(s=>s.id===a.id),d=SPUDS[i];return {staffId:'ai-'+a.id,residentId:a.id,username:d.name,role:d.personality+' · AI resident',isAI:true,isStaff:true,color:d.color,equipped:equipment(i),position:{...a.position},state:a.state,activity:a.activity,itemId:a.itemId,invitedBy:a.invitedBy};});}
 occupied(){return new Set(this.#actors.flatMap(a=>[tileKey(a.position),...(a.plan?[tileKey(a.plan.destination)]:[])]));}
 #occupied(external:Set<string>,except?:Actor){const set=new Set(external);for(const a of this.#actors)if(a!==except){set.add(tileKey(a.position));if(a.plan)set.add(tileKey(a.plan.destination));}return set;}
 #pick<T>(items:T[]):T|undefined{return items[Math.floor(this.#random()*items.length)];}
 #pause(a:Actor){a.next=this.#ticks+32+Math.floor(this.#random()*49);a.route=[];a.plan=undefined;}
 #floor(grid:RoomGrid,occupied:Set<string>){
  // Flood from the actual entrance; avoid isolated pockets, rollers, toys and the doorway.
  let entry:XY|undefined;for(let y=0;y<grid.length&&!entry;y++)for(let x=0;x<grid.width;x++)if(grid.tile({x,y})?.walkable){entry={x,y};break;}
  if(!entry)return [];
  const seen=new Set([tileKey(entry)]),queue=[entry],free:XYZ[]=[];
  for(let i=0;i<queue.length;i++){const p=queue[i],t=grid.tile(p)!;if(!occupied.has(tileKey(p))&&t.roller===undefined&&!t.petBed&&!t.petToy&&Math.abs(p.x-entry.x)+Math.abs(p.y-entry.y)>=3)free.push({...p,z:t.z});for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const q={x:p.x+dx,y:p.y+dy};if(!seen.has(tileKey(q))&&canStep(grid,p,q,{diagonal:false})){seen.add(tileKey(q));queue.push(q);}}}
  return free;
 }
 #add(grid:RoomGrid,external:Set<string>,id:SpudId,invitedBy?:string){
  if(this.#actors.some(a=>a.id===id))return false;
  const p=this.#pick(this.#floor(grid,this.#occupied(external)));if(!p)return false;
  this.#actors.push({id,position:p,state:'std',activity:'resting',route:[],next:this.#ticks+4+this.#actors.length*7,invitedBy,expires:invitedBy?this.#ticks+2400:undefined});return true;
 }
 prepareIdle(grid:RoomGrid,external:Set<string>){
  for(const d of this.#roster){if(this.#actors.length>=this.#quietPopulation)break;this.#add(grid,external,d.id);}
 }
 invite(grid:RoomGrid,external:Set<string>,id:SpudId,owner:string){
  if(this.#actors.some(a=>a.invitedBy===owner))throw new Error('Dismiss your current AI visitor first');
  if(!this.#add(grid,external,id,owner))throw new Error('Clear some floor space for this AI visitor');
 }
 dismiss(owner:string,id?:SpudId){const before=this.#actors.length;this.#actors=this.#actors.filter(a=>a.invitedBy!==owner||(id!==undefined&&a.id!==id));return before!==this.#actors.length;}
 canReplace(grid:RoomGrid){return this.#actors.every(a=>{const t=grid.tile(a.position);return t?.z===a.position.z&&(a.state==='sit'?t.canSit:t.walkable);});}
 tick(grid:RoomGrid,external:Set<string>,players:number,publicRoom:boolean){
  ++this.#ticks;let changed=false;
  for(const [user,c] of this.#conversations)if(c.until<=this.#ticks){this.release(user);changed=true;}
  const remaining=this.#actors.filter(a=>!a.expires||a.expires>this.#ticks);if(remaining.length!==this.#actors.length){this.#actors=remaining;changed=true;}
  if(publicRoom&&(this.#ticks<=10||this.#ticks%80===0)){
   const quietPopulation=this.#quietPopulation;
   const target=Math.max(0,quietPopulation-Math.floor(Math.max(0,players-2)/2));
   if(this.#actors.length>target){let retiring=this.#actors.length-1;while(retiring>=0&&this.#held(this.#actors[retiring]))retiring--;if(retiring>=0){this.#actors.splice(retiring,1);changed=true;}}
   // Each room has its own stable shuffled lineup; at most one spawn per tick.
   for(const d of this.#roster){if(this.#actors.length>=target)break;if(this.#add(grid,external,d.id)){changed=true;break;}}
  }
  // Stagger expensive path searches: at most one new plan in a room tick.
  const planner=this.#actors.length?this.#actors[this.#cursor++%this.#actors.length]:undefined;
  for(const a of this.#actors){
   if(this.#held(a)||this.#ticks<a.next)continue;
   const occupied=this.#occupied(external,a);
   if(a.state==='sit'){
    const exit=findInteractionExit(grid,a.position,a.plan?.approach??a.position,{occupied,maxExpanded:256,diagonal:false});
    if(exit.status==='ok'){const step=completeInteractionExit(grid,a.position,exit.path[0],exit.revision,{occupied});if(step){a.position=step.position;a.state='std';a.activity='resting';a.plan=undefined;this.#pause(a);changed=true;}}continue;
   }
   if(a.route.length){const next=a.route.shift()!;if(canStep(grid,a.position,next,{occupied,diagonal:false})){a.position=next;a.next=this.#ticks+3;if(!a.route.length&&!a.plan){a.next=this.#ticks+32+Math.floor(this.#random()*49);}changed=true;}else{this.#pause(a);a.activity='resting';changed=true;}continue;}
   if(a.plan){const seat=completeInteraction(grid,a.position,a.plan,{occupied});if(seat){a.position=seat.position;a.state='sit';a.activity='sitting';a.next=this.#ticks+80;changed=true;continue;}a.plan=undefined;}
   if(a!==planner)continue;
   a.state='std';a.itemId=undefined;const activity=this.#random();
   if(activity<.22){a.state='dance';a.activity='dancing';this.#pause(a);changed=true;continue;}
   const furniture:XY[]=[];for(let y=0;y<grid.length;y++)for(let x=0;x<grid.width;x++){const t=grid.tile({x,y});if(t?.itemId&&Math.hypot(x-a.position.x,y-a.position.y)<8)furniture.push({x,y});}
   const target=this.#pick(furniture);
   if(target&&activity<.65){
    const t=grid.tile(target)!;
    if(t.canSit){const plan=findInteraction(grid,a.position,target,'sit',{occupied,maxExpanded:128,diagonal:false});if(plan.status==='ok'){a.plan=plan;a.route=[...plan.path];a.activity='wandering';a.itemId=t.itemId;a.next=this.#ticks+3;changed=true;continue;}}
    const goals=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:target.x+dx,y:target.y+dy}));
    for(const goal of goals){const route=findPath(grid,a.position,goal,{occupied,maxExpanded:128,diagonal:false});if(route.status==='ok'&&route.path.length<=12){a.route=route.path;a.activity='admiring';a.itemId=t.itemId;a.next=this.#ticks+3;changed=true;break;}}
    if(a.route.length)continue;
   }
   const free=this.#floor(grid,occupied).filter(p=>Math.hypot(p.x-a.position.x,p.y-a.position.y)<=8),goal=this.#pick(free);
   if(goal){const route=findPath(grid,a.position,goal,{occupied,maxExpanded:256,diagonal:false});if(route.status==='ok'&&route.path.length<=14){a.route=route.path;a.activity='wandering';}}
   a.next=this.#ticks+(a.route.length?3:40);changed=true;
  }
  return changed;
 }
}
