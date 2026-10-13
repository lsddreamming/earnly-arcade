import { RoomGrid, validXY } from './grid.ts';
import type { XY, XYZ } from './grid.ts';
import { findPath, canStep } from './pathfinding.ts';
/** Call only after authenticating the socket and resolving its room membership. */
export function parseMoveIntent(packet:unknown):XY | null {
  if(!packet||typeof packet!=='object'||Array.isArray(packet))return null;
  const p=packet as Record<string,unknown>;
  if(p.type!=='MOVE_TO'||!validXY(p)||Object.keys(p).some(k=>!['type','x','y'].includes(k)))return null;
  return {x:p.x as number,y:p.y as number};
}
export class MovementController {
  #position:XYZ; #path:XYZ[]=[]; #credit=0; #revision=-1;
  constructor(grid:RoomGrid,spawn:XY){const tile=grid.tile(spawn);if(!tile?.walkable)throw new Error('Invalid spawn');this.#position={...spawn,z:tile.z};this.#revision=grid.revision;}
  get position():XYZ{return {...this.#position};}
  moveTo(grid:RoomGrid,packet:unknown,occupied:ReadonlySet<string>=new Set()){
    const goal=parseMoveIntent(packet);if(!goal)return {status:'invalid' as const};
    const result=findPath(grid,this.#position,goal,{occupied});
    if(result.status==='ok'){this.#path=result.path.map(p=>({...p}));this.#credit=0;this.#revision=grid.revision;}
    return result;
  }
  /** Exactly one call per 250ms SERVER tick. Never driven by client timestamps. */
  tick(grid:RoomGrid,occupied:ReadonlySet<string>=new Set()):{position:XYZ;state:'std'|'wlk';stopped:boolean}{
    const here=grid.tile(this.#position);
    if(!here?.walkable||here.z!==this.#position.z||grid.revision!==this.#revision){this.#path=[];this.#credit=0;return {position:this.position,state:'std',stopped:true};}
    if(!this.#path.length){this.#credit=0;return {position:this.position,state:'std',stopped:false};}
    this.#credit+=1;
    const next=this.#path[0];
    if(!canStep(grid,this.#position,next,{occupied})){this.#path=[];this.#credit=0;return {position:this.position,state:'std',stopped:true};}
    const cost=next.x!==this.#position.x&&next.y!==this.#position.y?Math.SQRT2:1;
    if(this.#credit>=cost){this.#credit-=cost;this.#position={...next};this.#path.shift();}
    return {position:this.position,state:this.#path.length?'wlk':'std',stopped:false};
  }
}
