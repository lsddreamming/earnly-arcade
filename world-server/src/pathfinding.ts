import { RoomGrid, tileKey, validXY } from './grid.ts';
import type { XY, XYZ } from './grid.ts';
export type PathOptions = Readonly<{ diagonal?: boolean; maxStepUp?: number; maxStepDown?: number; maxExpanded?: number; occupied?: ReadonlySet<string> }>;
export type PathResult = { status:'ok'; path:XYZ[]; cost:number; expanded:number; revision:number } | { status:'invalid'|'blocked'|'unreachable'|'budget_exceeded'; path:[]; expanded:number; revision:number };
type Limits = { diagonal:boolean; up:number; down:number; occupied:ReadonlySet<string> };
const EMPTY: ReadonlySet<string> = new Set();
function limits(o: PathOptions): Limits | null {
  const up=o.maxStepUp ?? 1, down=o.maxStepDown ?? 1;
  if (!Number.isFinite(up) || !Number.isFinite(down) || up<0 || down<0 || up>64 || down>64 || (o.diagonal !== undefined && typeof o.diagonal !== 'boolean')) return null;
  return { diagonal:o.diagonal ?? true, up, down, occupied:o.occupied ?? EMPTY };
}
function walkable(g: RoomGrid,p: XY,l: Limits): boolean { return g.tile(p)?.walkable === true && !l.occupied.has(tileKey(p)); }
function heightOK(g: RoomGrid,a: XY,b: XY,l: Limits): boolean {
  const from=g.tile(a),to=g.tile(b); if (!from || !to) return false;
  const delta=to.z-from.z;return delta<=l.up && -delta<=l.down;
}
function edge(g: RoomGrid,a: XY,b: XY,l: Limits): boolean {
  const dx=b.x-a.x,dy=b.y-a.y;
  if (!validXY(a)||!validXY(b)||Math.abs(dx)>1||Math.abs(dy)>1||(!dx&&!dy)||!g.tile(a)?.walkable||!walkable(g,b,l)||!heightOK(g,a,b,l)) return false;
  if (dx && dy) {
    if (!l.diagonal) return false;
    const sideX={x:a.x+dx,y:a.y},sideY={x:a.x,y:a.y+dy};
    // Check both orthogonal routes, including elevation: no clipping diagonal ledges.
    return [sideX,sideY].every(p=>walkable(g,p,l)&&heightOK(g,a,p,l)&&heightOK(g,p,b,l));
  }
  return true;
}
/** Also used on EVERY server movement tick, after other users/items have moved. */
export function canStep(g: RoomGrid,a: XY,b: XY,options: PathOptions = {}): boolean {
  const l=limits(options);return l !== null && edge(g,a,b,l);
}
type Entry={id:number;g:number;f:number;h:number;order:number};
class MinHeap {
  #a:Entry[]=[];
  get size(){return this.#a.length;}
  #less(a:Entry,b:Entry){return a.f<b.f || (a.f===b.f && (a.h<b.h || (a.h===b.h && a.order<b.order)));}
  push(v:Entry){const a=this.#a;a.push(v);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(!this.#less(v,a[p]))break;a[i]=a[p];i=p;}a[i]=v;}
  pop():Entry {const a=this.#a,result=a[0],last=a.pop()!;if(a.length){let i=0;while(i*2+1<a.length){let child=i*2+1;if(child+1<a.length&&this.#less(a[child+1],a[child]))child++;if(!this.#less(a[child],last))break;a[i]=a[child];i=child;}a[i]=last;}return result;}
}
function heuristic(a:XY,b:XY,diagonal:boolean){const dx=Math.abs(a.x-b.x),dy=Math.abs(a.y-b.y);return diagonal?Math.max(dx,dy)+(Math.SQRT2-1)*Math.min(dx,dy):dx+dy;}
/** Bounded, deterministic A*. Output excludes start, includes goal, with authoritative Z. */
export function findPath(grid:RoomGrid,start:XY,goal:XY,options:PathOptions={}):PathResult {
  let expanded=0;const fail=(status:'invalid'|'blocked'|'unreachable'|'budget_exceeded'):PathResult=>({status,path:[],expanded,revision:grid.revision});
  const l=limits(options),cap=options.maxExpanded ?? grid.width*grid.length;
  if(!l||!validXY(start)||!validXY(goal)||!grid.inBounds(start)||!grid.inBounds(goal)||!Number.isSafeInteger(cap)||cap<1||cap>4096)return fail('invalid');
  if(!grid.tile(start)?.walkable||!walkable(grid,goal,l))return fail('blocked');
  if(start.x===goal.x&&start.y===goal.y)return {status:'ok',path:[],cost:0,expanded,revision:grid.revision};
  const size=grid.width*grid.length,scores=new Float64Array(size).fill(Infinity),parent=new Int32Array(size).fill(-1),closed=new Uint8Array(size);
  const id=(p:XY)=>p.y*grid.width+p.x,point=(i:number):XY=>({x:i%grid.width,y:Math.floor(i/grid.width)});
  const first=id(start),last=id(goal),open=new MinHeap();let order=0;
  scores[first]=0;const h=heuristic(start,goal,l.diagonal);open.push({id:first,g:0,h,f:h,order:order++});
  const dirs=l.diagonal?[[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]]:[[0,-1],[1,0],[0,1],[-1,0]];
  while(open.size){
    const node=open.pop();if(closed[node.id]||node.g!==scores[node.id])continue;
    if(node.id===last){const path:XYZ[]=[];for(let p=last;p!==first;p=parent[p]){const xy=point(p);path.push({...xy,z:grid.tile(xy)!.z});}path.reverse();return {status:'ok',path,cost:node.g,expanded,revision:grid.revision};}
    if(expanded>=cap)return fail('budget_exceeded');
    expanded++;closed[node.id]=1;const current=point(node.id);
    for(const [dx,dy] of dirs){const next={x:current.x+dx,y:current.y+dy};if(!edge(grid,current,next,l))continue;const n=id(next);if(closed[n])continue;
      const cost=node.g+(dx&&dy?Math.SQRT2:1);if(cost>=scores[n])continue;
      scores[n]=cost;parent[n]=node.id;const h=heuristic(next,goal,l.diagonal);open.push({id:n,g:cost,h,f:cost+h,order:order++});
    }
  }
  return fail('unreachable');
}
