import { RoomGrid, tileKey, validXY } from './grid.ts';
import type { XY, XYZ } from './grid.ts';
import {canStep,findPath} from './pathfinding.ts';
import { MovementController } from './movement.ts';
import {findFurnitureSeat,findInteraction,completeInteraction,findInteractionExit,completeInteractionExit} from './interactions.ts';
import type {Staff} from './public-hangouts.ts';
import type {InteractionPlan} from './interactions.ts';

export type RoomPet={id:string;ownerId:string;name:string;species:'dog'|'cat'|'rabbit';color:string};
export type Identity = Readonly<{ userId:string; username:string; equipped?:Record<string,unknown> }>;
export type Send = (packet:Record<string,unknown>)=>void;
type Resident={definition:Staff;index:number;nextWalk?:number;nextVoice?:number;route?:XY[];callOwner?:string;callUntil?:number;lastPet?:number;lastCall?:number;bed?:XY;sleepUntil?:number};
type Member = {identity:Identity; movement:MovementController; send:Send; lastIntent:number; lastChat:number;seat?:{position:XYZ;state:'sit'|'lay'};plan?:InteractionPlan;exit?:{next:XYZ;revision:number;goal:XY}};
/** Transport-independent authoritative room. Only the authenticated gateway may join users.
 * The gateway must enforce room access, account bans and message byte limits before dispatch.
 * Tick once per 250ms; client packets can never advance the simulation clock.
 */
export class RoomRuntime {
  #members = new Map<string,Member>();
  #sequence = 0;
  #staff:Resident[]=[];
  #ticks=0;
  #petRandom=(Math.random()*0x100000000)>>>0;
  grid:RoomGrid;
  paused=false;
  readonly capacity:number;
  constructor(grid:RoomGrid, capacity=25, staff:Staff[]=[],pets:RoomPet[]=[]) {
    this.grid=grid;this.capacity=capacity;
    if(!Number.isInteger(capacity)||capacity<1||capacity>100)throw new Error('Invalid capacity');
    this.#staff=staff.map(definition=>{if(!definition.path.length||definition.path.some((p,i)=>!grid.tile(p)?.walkable||(i>0&&Math.abs(p.x-definition.path[i-1].x)+Math.abs(p.y-definition.path[i-1].y)!==1)))throw new Error('Invalid staff route');return {definition,index:0,...(definition.species?this.#petClock():{})};});
    this.setPets(pets);
  }
  staff(){return this.#staff.map(({definition:d,index,sleepUntil})=>({staffId:d.id,username:d.name,role:d.role,petId:d.petId,ownerId:d.ownerId,species:d.species,color:d.color,isStaff:true,position:{...d.path[index],z:this.grid.tile(d.path[index])!.z},state:sleepUntil?'sleep':'std'}));}
  setPets(pets:RoomPet[]){
    if(pets.length>3)throw new Error('Up to three pets can roam in a room');
    const previous=new Map(this.#staff.filter(s=>s.definition.petId).map(s=>[s.definition.petId!,s]));
    this.#staff=this.#staff.filter(s=>!s.definition.petId);
    for(const pet of pets){
      const old=previous.get(pet.id);let position=old?.definition.path[0];
      if(!position||!this.grid.tile(position)?.walkable||this.#occupied().has(tileKey(position))){
        try{position=this.availableSpawn();}catch{continue;}
      }
      const definition:Staff={id:'pet-'+pet.id,petId:pet.id,ownerId:pet.ownerId,name:pet.name,species:pet.species,color:pet.color,role:'Pet '+pet.species,path:[position],greeting:pet.species==='dog'?'A happy tail wag just for you.':pet.species==='cat'?'A soft purr and a curious glance.':'A little nose wiggle to say hello.',tip:'This pet belongs to the room owner. Its owner can rename it or return it to Backpack.'};
      this.#staff.push({...this.#petClock(),...old,definition,index:0});
    }
  }
  #random(min:number,max:number){this.#petRandom=(Math.imul(this.#petRandom,1664525)+1013904223)>>>0;return min+this.#petRandom%(max-min+1);}
  #petClock(){return {nextWalk:this.#ticks+this.#random(80,240),nextVoice:this.#ticks+this.#random(1080,1320),route:[] as XY[]};}
  #petRoute(s:Resident){
    const d=s.definition,from=d.path[s.index];
    if(!d.petId){const route:XY[]=[];let i=s.index;for(let n=0;n<Math.min(10,d.path.length-1);n++){i=(i+1)%d.path.length;route.push(d.path[i]);}return route;}
    const occupied=this.#occupied(),targets:XY[]=[];
    for(let y=0;y<this.grid.length;y++)for(let x=0;x<this.grid.width;x++){const distance=Math.abs(x-from.x)+Math.abs(y-from.y);if(distance>=4&&distance<=10&&this.grid.tile({x,y})?.walkable&&!occupied.has(tileKey({x,y})))targets.push({x,y});}
    for(let attempt=0;attempt<12&&targets.length;attempt++){const goal=targets.splice(this.#random(0,targets.length-1),1)[0],result=findPath(this.grid,from,goal,{occupied,diagonal:false,maxExpanded:512});if(result.status==='ok'&&result.path.length<=16)return result.path;}
    return [];
  }
  #beside(s:Resident,m:Member){const p=s.definition.path[s.index],a=this.#position(m);return Math.hypot(p.x-a.x,p.y-a.y)<=1.5&&Math.abs(this.grid.tile(p)!.z-a.z)<=1;}
  #callRoute(s:Resident,userId:string){
    const member=this.#members.get(userId);if(!member)return null;
    const a=this.#position(member),from=s.definition.path[s.index],occupied=this.#occupied();occupied.delete(tileKey(from));
    if(this.#beside(s,member))return [];
    let best:XY[]|null=null;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const goal={x:a.x+dx,y:a.y+dy};if(Math.abs((this.grid.tile(goal)?.z??Infinity)-a.z)>1)continue;const result=findPath(this.grid,from,goal,{occupied,diagonal:false,maxExpanded:1024});if(result.status==='ok'&&(!best||result.path.length<best.length))best=result.path;}
    return best;
  }
  #bedRoute(s:Resident){
    if(!s.definition.petId)return false;
    const from=s.definition.path[s.index],occupied=this.#occupied();occupied.delete(tileKey(from));
    const beds:XY[]=[];
    for(let y=0;y<this.grid.length;y++)for(let x=0;x<this.grid.width;x++)if(this.grid.tile({x,y})?.petBed===s.definition.species&&!occupied.has(tileKey({x,y}))&&!this.#staff.some(other=>other!==s&&other.bed?.x===x&&other.bed?.y===y))beds.push({x,y});
    while(beds.length){const goal=beds.splice(this.#random(0,beds.length-1),1)[0],result=findPath(this.grid,from,goal,{occupied,diagonal:false,maxExpanded:1024});if(result.status==='ok'){s.bed=goal;s.route=result.path;return true;}}
    return false;
  }
  #wake(s:Resident){const asleep=!!s.sleepUntil;s.sleepUntil=undefined;s.bed=undefined;if(asleep)this.#broadcast({type:'NPC_SNAPSHOT',staff:this.staff()});}
  #sleep(s:Resident){s.sleepUntil=this.#ticks+this.#random(240,480);s.nextWalk=s.sleepUntil;s.route=[];}
  #rest(s:Resident){this.#wake(s);s.route=[];s.callOwner=undefined;s.callUntil=undefined;s.nextWalk=this.#ticks+this.#random(80,240);}
  petInteract(userId:string,id:unknown,kind:'pet'|'call'){
    const member=this.#members.get(userId),s=this.#staff.find(s=>s.definition.id===id&&s.definition.species);
    if(!member||!s)throw new Error('Pet unavailable in this room');if(this.paused)throw new Error('The room is updating. Try again.');
    if(kind==='call'){
      if(!s.definition.petId||s.definition.ownerId!==userId)throw new Error('Only the owner can call this pet');
      if(this.#ticks-(s.lastCall??-Infinity)<32)throw new Error('Give your pet a moment before calling again');
      const route=this.#callRoute(s,userId);if(route===null)throw new Error('Your pet cannot reach you. Try a clear floor tile.');
      s.lastCall=this.#ticks;
      if(!route.length){this.#rest(s);return {message:s.definition.name+' is already beside you'};}
      this.#wake(s);s.route=route;s.callOwner=userId;s.callUntil=this.#ticks+120;s.nextWalk=this.#ticks+1;
      return {message:s.definition.name+' is coming over'};
    }
    if(kind!=='pet')throw new Error('Unknown pet interaction');
    if(!this.#beside(s,member))throw new Error('Move beside your pet first, or call it over');
    if(this.#ticks-(s.lastPet??-Infinity)<32)throw new Error('Give your pet a moment to enjoy that');
    s.lastPet=this.#ticks;this.#rest(s);this.#broadcast({type:'PET_REACTION',staffId:s.definition.id,reaction:'happy'});
    return {message:s.definition.name+' loves the attention'};
  }
  talkToStaff(userId:string,id:unknown){const member=this.#members.get(userId);if(!member)throw new Error('Player unavailable');const s=this.#staff.find(s=>s.definition.id===id);if(!s)throw new Error('Staff unavailable in this room');const d=s.definition;return {name:d.name,role:d.role,greeting:d.greeting,tip:d.tip,canPet:!!d.species&&this.#beside(s,member),canCall:!!d.petId&&d.ownerId===userId};}
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
  canReplace(grid:RoomGrid){return this.staff().every(s=>{const t=grid.tile(s.position);return !!t?.walkable&&t.z===s.position.z;})&&this.members().every(m=>{const tile=grid.tile(m.position);return !!tile&&tile.z===m.position.z&&(tile.walkable||(m.state==='sit'&&tile.canSit)||(m.state==='lay'&&tile.canLay));});}
  replaceGrid(grid:RoomGrid){if(!this.canReplace(grid))throw new Error('A player is standing there');this.grid=grid;}
  get memberCount(){return this.#members.size;}
  availableSpawn():XY {
    const occupied=this.#occupied();
    for(let y=0;y<this.grid.length;y++)for(let x=0;x<this.grid.width;x++){
      if(this.grid.tile({x,y})?.walkable&&!occupied.has(tileKey({x,y})))return {x,y};
    }
    throw new Error('No free spawn');
  }
  #occupied(except?:string){return new Set([...this.#members].filter(([id])=>id!==except).map(([,m])=>tileKey(this.#position(m))).concat(this.staff().map(s=>tileKey(s.position))));}
  #broadcast(packet:Record<string,unknown>){for(const m of this.#members.values())m.send(packet);}
  join(identity:Identity,spawn:XY,send:Send){
    if(!identity.userId||!identity.username||this.#members.has(identity.userId))throw new Error('Duplicate or invalid member');
    if(this.#members.size>=this.capacity||this.#occupied().has(tileKey(spawn)))throw new Error('Room full or spawn occupied');
    const member:Member={identity:{...identity},movement:new MovementController(this.grid,spawn),send,lastIntent:-Infinity,lastChat:-Infinity};
    this.#members.set(identity.userId,member);
    send({type:'ROOM_SNAPSHOT',revision:this.grid.revision,sequence:this.#sequence,users:[...this.#members.values()].map(m=>({...m.identity,position:this.#position(m),state:m.seat?.state??'std'}))});
    send({type:'NPC_SNAPSHOT',staff:this.staff()});
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
      const occupied=this.#occupied(userId);
      for(const [id,other] of this.#members)if(id!==userId&&other.plan)occupied.add(tileKey(other.plan.destination));
      const plan=interactionAction==='sit'?findFurnitureSeat(this.grid,this.#position(m),p,{occupied}):findInteraction(this.grid,this.#position(m),p,'lay',{occupied});
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
    ++this.#ticks;let moved=false;
    for(const s of this.#staff){
      const d=s.definition;
      if(d.species){
        if(s.bed&&this.grid.tile(s.bed)?.petBed!==d.species){this.#rest(s);moved=true;continue;}
        if(s.sleepUntil){if(this.#ticks<s.sleepUntil)continue;this.#rest(s);moved=true;continue;}
        if(this.#ticks>=s.nextVoice!){this.#broadcast({type:'PET_CHAT',staffId:d.id,text:d.species==='dog'?'Woof!':d.species==='cat'?'Meow!':'*sniff sniff*'});s.nextVoice=this.#ticks+this.#random(1080,1320);}
        if(this.#ticks<s.nextWalk!)continue;
        if(s.callOwner){const route=this.#ticks<s.callUntil!?this.#callRoute(s,s.callOwner):null;if(!route?.length){this.#rest(s);continue;}s.route=route;}
        if(!s.route?.length){if(!(this.#random(0,2)===0&&this.#bedRoute(s)))s.route=this.#petRoute(s);}
        if(s.bed&&!s.route?.length){this.#sleep(s);moved=true;continue;}
        const next=s.route?.shift(),from=d.path[s.index];
        if(next&&canStep(this.grid,from,next,{occupied:this.#occupied(),diagonal:false})){
          if(d.petId)d.path[0]=next;else s.index=d.path.findIndex(p=>p.x===next.x&&p.y===next.y);
          moved=true;if(s.route?.length)s.nextWalk=this.#ticks+3;else if(s.bed){this.#sleep(s);}else this.#rest(s);
        }else{this.#rest(s);}
      }else if(this.#ticks%32===0){
        const next=(s.index+1)%d.path.length,p=d.path[next],from=d.path[s.index];
        if(next!==s.index&&Math.abs(p.x-from.x)+Math.abs(p.y-from.y)===1&&this.grid.tile(p)?.walkable&&!this.#occupied().has(tileKey(p))){s.index=next;moved=true;}
      }
    }
    if(moved)this.#broadcast({type:'NPC_SNAPSHOT',staff:this.staff()});
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
