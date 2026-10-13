import { RoomGrid, tileKey, validXY } from './grid.ts';
import type { XY, XYZ } from './grid.ts';
import { MovementController } from './movement.ts';
import {findInteraction,completeInteraction,findInteractionExit,completeInteractionExit} from './interactions.ts';
import type {InteractionPlan} from './interactions.ts';

export type Identity = Readonly<{ userId:string; username:string; equipped?:Record<string,unknown> }>;
export type Send = (packet:Record<string,unknown>)=>void;
type Member = {identity:Identity; movement:MovementController; send:Send; lastIntent:number; lastChat:number;seat?:{position:XYZ;state:'sit'|'lay'};plan?:InteractionPlan;exit?:{next:XYZ;revision:number;goal:XY}};
/** Transport-independent authoritative room. Only the authenticated gateway may join users.
 * The gateway must enforce room access, account bans and message byte limits before dispatch.
 * Tick once per 250ms; client packets can never advance the simulation clock.
 */
export class RoomRuntime {
  #members = new Map<string,Member>();
  #sequence = 0;
  grid:RoomGrid;
  paused=false;
  readonly capacity:number;
  constructor(grid:RoomGrid, capacity=25) {
    this.grid=grid;this.capacity=capacity;
    if(!Number.isInteger(capacity)||capacity<1||capacity>100)throw new Error('Invalid capacity');
  }
  #position(m:Member):XYZ{return m.seat?.position??m.movement.position;}
  members(){return [...this.#members.values()].map(m=>({...m.identity,position:this.#position(m),state:m.seat?.state??'std'}));}
  chatViewers(userId:string,mode:string,target?:string){
    const sender=this.#members.get(userId);if(!sender)throw new Error('Player unavailable');
    const from=this.#position(sender);
    if(!['normal','shout','whisper'].includes(mode))throw new Error('Invalid chat mode');
    const nearby=[...this.#members.values()].filter(m=>Math.hypot(from.x-this.#position(m).x,from.y-this.#position(m).y)<=(mode==='whisper'?1:8));
    if(mode==='whisper'&&!nearby.some(m=>m.identity.userId===target))throw new Error('Move beside this player to whisper');
    return (mode==='shout'?[...this.#members.values()]:nearby).filter(m=>mode!=='whisper'||m.identity.userId===userId||m.identity.userId===target).map(m=>m.identity.userId);
  }
  canReplace(grid:RoomGrid){return this.members().every(m=>{const tile=grid.tile(m.position);return !!tile&&tile.z===m.position.z&&(tile.walkable||(m.state==='sit'&&tile.canSit)||(m.state==='lay'&&tile.canLay));});}
  replaceGrid(grid:RoomGrid){if(!this.canReplace(grid))throw new Error('A player is standing there');this.grid=grid;}
  get memberCount(){return this.#members.size;}
  availableSpawn():XY {
    const occupied=this.#occupied();
    for(let y=0;y<this.grid.length;y++)for(let x=0;x<this.grid.width;x++){
      if(this.grid.tile({x,y})?.walkable&&!occupied.has(tileKey({x,y})))return {x,y};
    }
    throw new Error('No free spawn');
  }
  #occupied(except?:string){return new Set([...this.#members].filter(([id])=>id!==except).map(([,m])=>tileKey(this.#position(m))));}
  #broadcast(packet:Record<string,unknown>){for(const m of this.#members.values())m.send(packet);}
  join(identity:Identity,spawn:XY,send:Send){
    if(!identity.userId||!identity.username||this.#members.has(identity.userId))throw new Error('Duplicate or invalid member');
    if(this.#members.size>=this.capacity||this.#occupied().has(tileKey(spawn)))throw new Error('Room full or spawn occupied');
    const member:Member={identity:{...identity},movement:new MovementController(this.grid,spawn),send,lastIntent:-Infinity,lastChat:-Infinity};
    this.#members.set(identity.userId,member);
    send({type:'ROOM_SNAPSHOT',revision:this.grid.revision,sequence:this.#sequence,users:[...this.#members.values()].map(m=>({...m.identity,position:this.#position(m),state:m.seat?.state??'std'}))});
    this.#broadcast({type:'USER_JOINED',...member.identity,position:this.#position(member)});
  }
  leave(userId:string){if(this.#members.delete(userId))this.#broadcast({type:'USER_LEFT',userId});}
  /** userId comes from the socket binding, never from a packet. now is server monotonic time. */
  receive(userId:string,packet:unknown,now:number){
    const m=this.#members.get(userId);
    if(this.paused||!m||!Number.isFinite(now)||!packet||typeof packet!=='object'||Array.isArray(packet))return false;
    const p=packet as Record<string,unknown>;const interactionAction=p.action;
    if(p.type==='MOVE_TO'){
      if(now-m.lastIntent<100)return false;
      m.lastIntent=now;
      m.plan=undefined;
      if(m.seat){
        if(!validXY(p)||Object.keys(p).some(k=>!['type','x','y'].includes(k)))return false;
        const route=findInteractionExit(this.grid,m.seat.position,p,{occupied:this.#occupied(userId)});
        if(route.status==='ok')m.exit={next:route.path[0],revision:route.revision,goal:{x:p.x,y:p.y}};
        return route.status==='ok';
      }
      const result=m.movement.moveTo(this.grid,p,this.#occupied(userId));
      m.send({type:'MOVE_RESULT',...result});return result.status==='ok';
    }
    if(p.type==='INTERACT'&&!m.seat&&validXY(p)&&['sit','lay'].includes(String(interactionAction))&&!Object.keys(p).some(k=>!['type','x','y','action'].includes(k))){
      if(now-m.lastIntent<100)return false;m.lastIntent=now;
      const plan=findInteraction(this.grid,this.#position(m),p,interactionAction as 'sit'|'lay',{occupied:this.#occupied(userId)});
      if(plan.status!=='ok')return false;
      const result=m.movement.moveTo(this.grid,{type:'MOVE_TO',x:plan.approach.x,y:plan.approach.y},this.#occupied(userId));
      if(result.status==='ok')m.plan=plan;return result.status==='ok';
    }
    return false;
  }
  /** Call only after text moderation and block-list filtering. Whisper recipients are
   * selected here on the server; private text is never broadcast to the room. */
  chat(userId:string,text:string,mode:'normal'|'shout'|'whisper',target:string|undefined,now:number,blocked:(a:string,b:string)=>boolean){
    const m=this.#members.get(userId);
    if(!m||!Number.isFinite(now)||now-m.lastChat<5000||!['normal','shout','whisper'].includes(mode)||typeof text!=='string'||!text.trim()||text.length>280||/[\x00-\x1f\x7f]/.test(text))return false;
    const destination=target?this.#members.get(target):undefined;
    const distance=(other:Member)=>Math.hypot(this.#position(m).x-this.#position(other).x,this.#position(m).y-this.#position(other).y);
    if(mode==='whisper'&&(!destination||target===userId||distance(destination)>1||(blocked(userId,target!)||blocked(target!,userId))))return false;
    m.lastChat=now;
    for(const [id,other] of this.#members){
      if(blocked(userId,id)||blocked(id,userId))continue;
      const d=distance(other);
      if(mode==='whisper'&&id!==userId&&id!==target)continue;
      if(mode==='normal'&&d>8)continue;
      other.send({type:'CHAT',userId,text:text.trim(),mode,opacity:mode==='normal'?Math.max(.25,1-d/10):1});
    }
    return true;
  }
  tick(){
    if(this.paused)return;
    const changes=[];
    // Stable join order plus fresh occupancy prevents two actors entering one tile.
    for(const [id,m] of this.#members){
      const before=this.#position(m);
      if(m.seat){
        if(m.exit){const exit=completeInteractionExit(this.grid,m.seat.position,m.exit.next,m.exit.revision,{occupied:this.#occupied(id)});const goal=m.exit.goal;m.exit=undefined;if(exit){m.seat=undefined;m.movement=new MovementController(this.grid,exit.position);m.movement.moveTo(this.grid,{type:'MOVE_TO',...goal},this.#occupied(id));changes.push({userId:id,...exit});}}
        continue;
      }
      if(m.plan){const seated=completeInteraction(this.grid,before,m.plan,{occupied:this.#occupied(id)});if(seated){m.seat=seated;m.plan=undefined;changes.push({userId:id,...seated});continue;}if(m.plan.revision!==this.grid.revision)m.plan=undefined;}
      const next=m.movement.tick(this.grid,this.#occupied(id));
      if(before.x!==next.position.x||before.y!==next.position.y||next.stopped)changes.push({userId:id,...next});
    }
    if(changes.length)this.#broadcast({type:'ROOM_DELTA',sequence:++this.#sequence,revision:this.grid.revision,users:changes});
  }
}
