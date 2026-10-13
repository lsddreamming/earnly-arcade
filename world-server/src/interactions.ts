import { RoomGrid, tileKey, validXY } from './grid.ts';
import type { XY, XYZ } from './grid.ts';
import { findPath } from './pathfinding.ts';
import type { PathOptions } from './pathfinding.ts';
export type InteractionPlan = Readonly<{
  status:'ok'; action:'sit'|'lay'; itemId:string; revision:number;
  path:readonly XYZ[]; approach:XYZ; destination:XYZ; cost:number;
}>;
export type InteractionFailure = {status:'invalid'|'blocked'|'unreachable'|'budget_exceeded'};
const orthogonal = [[0,-1],[1,0],[0,1],[-1,0]] as const;
function neighbors(p:XY):XY[]{return orthogonal.map(([x,y])=>({x:p.x+x,y:p.y+y}));}
function reachableHeight(from:number,to:number,options:PathOptions):boolean {
  const up=options.maxStepUp??1,down=options.maxStepDown??1;
  return Number.isFinite(up)&&Number.isFinite(down)&&up>=0&&down>=0&&up<=64&&down<=64&&to-from<=up&&from-to<=down;
}
/** Chairs/beds are interaction destinations, never walk-through shortcuts. */
export function findInteraction(grid:RoomGrid,start:XY,target:XY,action:'sit'|'lay',options:PathOptions={}):InteractionPlan|InteractionFailure {
  if(!validXY(start)||!validXY(target)||!['sit','lay'].includes(action))return {status:'invalid'};
  const tile=grid.tile(target);
  if(!tile?.itemId||!(action==='sit'?tile.canSit:tile.canLay)||options.occupied?.has(tileKey(target)))return {status:'blocked'};
  let best:InteractionPlan|undefined;
  let budgetHit=false;
  for(const point of neighbors(target)){
    const surface=grid.tile(point);
    if(!surface?.walkable||!reachableHeight(surface.z,tile.z,options))continue;
    const route=findPath(grid,start,point,options);
    if(route.status==='budget_exceeded'){budgetHit=true;continue;}
    if(route.status!=='ok')continue;
    const plan:InteractionPlan={status:'ok',action,itemId:tile.itemId,revision:grid.revision,path:route.path,approach:{...point,z:surface.z},destination:{...target,z:tile.z},cost:route.cost+1};
    if(!best||plan.cost<best.cost)best=plan;
  }
  // Do not report an optimal plan if a cheaper approach could have exceeded its budget.
  return budgetHit?{status:'budget_exceeded'}:best??{status:'unreachable'};
}
/** Invoke on the server AFTER walking the path, with current occupants/grid. */
export function completeInteraction(grid:RoomGrid,current:XYZ,plan:InteractionPlan,options:PathOptions={}):{position:XYZ;state:'sit'|'lay'}|null {
  if(grid.revision!==plan.revision||current.x!==plan.approach.x||current.y!==plan.approach.y||current.z!==plan.approach.z)return null;
  const from=grid.tile(current),tile=grid.tile(plan.destination);
  if(!from?.walkable||from.z!==current.z||!tile||tile.itemId!==plan.itemId||tile.z!==plan.destination.z||!(plan.action==='sit'?tile.canSit:tile.canLay)||options.occupied?.has(tileKey(plan.destination))||!reachableHeight(current.z,tile.z,options)||Math.abs(current.x-plan.destination.x)+Math.abs(current.y-plan.destination.y)!==1)return null;
  return {position:{...plan.destination},state:plan.action};
}
/** A seated avatar first steps onto a free orthogonal tile, then follows A*. */
export function findInteractionExit(grid:RoomGrid,current:XYZ,goal:XY,options:PathOptions={}):{status:'ok';path:XYZ[];cost:number;revision:number}|InteractionFailure {
  const seat=grid.tile(current);
  if(!seat||seat.z!==current.z||!(seat.canSit||seat.canLay)||!validXY(goal))return {status:'invalid'};
  let best:{status:'ok';path:XYZ[];cost:number;revision:number}|undefined;let budgetHit=false;
  for(const p of neighbors(current)){
    const tile=grid.tile(p);if(!tile?.walkable||options.occupied?.has(tileKey(p))||!reachableHeight(current.z,tile.z,options))continue;
    const route=findPath(grid,p,goal,options);
    if(route.status==='budget_exceeded'){budgetHit=true;continue;}
    if(route.status!=='ok')continue;
    if(!best||route.cost+1<best.cost)best={status:'ok',path:[{...p,z:tile.z},...route.path],cost:route.cost+1,revision:grid.revision};
  }
  return budgetHit?{status:'budget_exceeded'}:best??{status:'unreachable'};
}

/** Revalidate the special first step out of a seat/bed on the room tick. */
export function completeInteractionExit(grid:RoomGrid,current:XYZ,next:XYZ,plannedRevision:number,options:PathOptions={}):{position:XYZ;state:'std'}|null {
  const seat=grid.tile(current),floor=grid.tile(next);
  if(grid.revision!==plannedRevision||!seat||!(seat.canSit||seat.canLay)||seat.z!==current.z||!floor?.walkable||floor.z!==next.z||Math.abs(current.x-next.x)+Math.abs(current.y-next.y)!==1||options.occupied?.has(tileKey(next))||!reachableHeight(current.z,next.z,options))return null;
  return {position:{...next},state:'std'};
}
