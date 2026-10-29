import {cleanReply,repeatedReply} from './resident-ai.ts';
import type {ResidentAI,DialogueLine} from './resident-ai.ts';
import type {ResidentMemory} from './resident-social.ts';
import {NaturalSocial,residentReply} from './resident-social.ts';
import type {SpudId} from './spud-residents.ts';
import {spudDefinition,SPUDS} from './spud-residents.ts';
import {SpudResidents} from './spud-residents.ts';
import {randomInt} from 'node:crypto';
import { RoomGrid, tileKey, validXY } from './grid.ts';
import type { XY, XYZ } from './grid.ts';
import {canStep,findPath} from './pathfinding.ts';
import { MovementController } from './movement.ts';
import {findFurnitureSeat,findInteraction,completeInteraction,findInteractionExit,completeInteractionExit} from './interactions.ts';
import type {Staff} from './public-hangouts.ts';
import type {InteractionPlan} from './interactions.ts';

export type RoomPet={id:string;ownerId:string;name:string;species:'dog'|'cat'|'rabbit';color:string};
export type Identity = Readonly<{ userId:string; username:string; equipped?:Record<string,unknown> }>;
type NPCSnapshot={staffId:string;username:string;role:string;position:XYZ;state:string;isStaff:boolean;color:string;isAI?:boolean;residentId?:SpudId;equipped?:Record<string,unknown>;invitedBy?:string;activity?:string;itemId?:string;petId?:string;ownerId?:string;species?:RoomPet['species'];toyId?:string;playElapsed?:number};
export type Send = (packet:Record<string,unknown>)=>void;
type Resident={definition:Staff;index:number;nextWalk?:number;nextVoice?:number;route?:XY[];callOwner?:string;callUntil?:number;lastPet?:number;lastCall?:number;bed?:XY;sleepUntil?:number;toy?:XY;toyId?:string;playUntil?:number;nextPlay?:number};
type Member = {identity:Identity; movement:MovementController; send:Send; lastIntent:number; lastChat:number;lastFurnitureUse?:number;seat?:{position:XYZ;state:'sit'|'lay'};plan?:InteractionPlan;exit?:{next:XYZ;revision:number;goal:XY}};
/** Transport-independent authoritative room. Only the authenticated gateway may join users.
 * The gateway must enforce room access, account bans and message byte limits before dispatch.
 * Tick once per 250ms; client packets can never advance the simulation clock.
 */
export class RoomRuntime {
  readonly spuds=new SpudResidents();
  #publicResidents=false;
  #roomWideChat=false;
  enableRoomWideChat(){this.#roomWideChat=true;}
  get roomWideChat(){return this.#roomWideChat;}
  #social?:NaturalSocial;
  #roomKey='';
  #memories=new Map<string,Map<string,ResidentMemory>>();
  #ai?:ResidentAI;
  #onInteraction?:(uid:string,id:SpudId)=>Promise<void>;
  onResidentInteraction(callback:(uid:string,id:SpudId)=>Promise<void>){this.#onInteraction=callback;}
  #nextPublicReply=0;#lastPublicSpeech=-Infinity;#generation=0;#aiBusy=false;
  #conversation?:{id:SpudId;until:number};
  #history:{line:DialogueLine;heard:Set<SpudId>;allowed:Set<string>;at:number;source?:string}[]=[];
  #pending:{id:SpudId;source:string;allowed:Set<string>;addressed:boolean;at:number}[]=[];
  #ready?:{id:SpudId;text:string;source?:string;allowed:Set<string>;at:number;generation:number;ambient:boolean};
  #recentReplies:string[]=[];#ambientHistory:DialogueLine[]=[];
  #nextAmbient=240+Math.floor(Math.random()*240);
  #exchange?:{ids:SpudId[];turn:number;lines:DialogueLine[];at:number;generation:number};
  enableDialogue(ai:ResidentAI){this.#ai=ai;}
  invalidateDialogue(){this.#generation++;this.#history=[];this.#pending=[];this.#ready=undefined;this.#endExchange();}
  #near(a:XYZ,b:XYZ){return this.#roomWideChat||(Math.hypot(a.x-b.x,a.y-b.y)<=8&&Math.abs(a.z-b.z)<=1);}
  #residentAudience(id:SpudId,allowed?:Set<string>,source?:string,ambient=false){
    const spud=this.spuds.snapshots().find(s=>s.residentId===id);if(!spud)return [];
    const speaker=source?this.#members.get(source):undefined;if(source&&!speaker)return [];
    if(speaker&&!this.#near(this.#position(speaker),spud.position))return [];
    return [...this.#members].filter(([uid,m])=>(!allowed||allowed.has(uid))&&this.#near(this.#position(m),spud.position)&&(!speaker||this.#near(this.#position(m),this.#position(speaker)))&&(!ambient||!this.#social?.quiet(uid,performance.now()))).map(([uid])=>uid);
  }
  #residentSpeech(id:SpudId,text:string,allowed:Set<string>,source?:string,ambient=false){
    const viewers=this.#residentAudience(id,allowed,source,ambient);if(!viewers.length)return false;
    const packet={type:'CHAT',userId:'ai-'+id,residentId:id,username:spudDefinition(id)!.name,isAI:true,text,mode:'normal',ambient};
    for(const uid of viewers)this.#members.get(uid)?.send(packet);
    this.#lastPublicSpeech=this.#ticks;this.#recentReplies.push(text);this.#recentReplies=this.#recentReplies.slice(-12);
    const spud=this.spuds.snapshots().find(s=>s.residentId===id)!;
    this.#rememberPublic({speaker:spud.username,text},new Set(this.spuds.snapshots().filter(s=>this.#near(spud.position,s.position)).map(s=>s.residentId)),new Set(viewers),source);
    return true;
  }
  #rememberPublic(line:DialogueLine,heard:Set<SpudId>,allowed:Set<string>,source?:string){
    this.#history=this.#history.filter(h=>this.#ticks-h.at<480).slice(-23);
    this.#history.push({line,heard,allowed,at:this.#ticks,source});
  }
  #endExchange(){if(this.#exchange)for(const id of this.#exchange.ids)this.spuds.release('ambient-'+id);this.#exchange=undefined;}
  /** Only moderated normal public messages reach this method. Whispers and DMs never do. */
  queueResidentReply(uid:string,text:string,allowed:string[],requested?:unknown){
    const member=this.#members.get(uid);if(!member||this.paused||!this.#ai||typeof text!=='string'||!text.trim())return false;
    this.#lastPublicSpeech=this.#ticks;
    const from=this.#position(member),near=this.spuds.snapshots().filter(s=>this.#near(from,s.position)).sort((a,b)=>Math.hypot(from.x-a.position.x,from.y-a.position.y)-Math.hypot(from.x-b.position.x,from.y-b.position.y));
    const audience=new Set(allowed.filter(id=>this.#members.has(id)));audience.add(uid);
    this.#rememberPublic({speaker:member.identity.username,text:text.slice(0,280)},new Set(near.map(s=>s.residentId)),audience,uid);
    // Human messages cancel unsent ambient turns, never spawn recursive AI calls.
    if(this.#exchange){this.#generation++;this.#endExchange();if(this.#ready?.ambient)this.#ready=undefined;}
    const words=text.toLowerCase().split(/[^a-z]+/),named=near.find(s=>words.includes(s.username.toLowerCase()));
    if(requested===undefined&&!named&&SPUDS.some(s=>words.includes(s.name.toLowerCase())))return false;
    const spud=requested!==undefined?near.find(s=>s.residentId===requested):named??(this.#conversation&&this.#conversation.until>this.#ticks?near.find(s=>s.residentId===this.#conversation!.id):undefined)??near[0];
    if(!spud)return false;
    const addressed=requested!==undefined||!!named;
    if(this.#social?.quiet(uid,performance.now())&&!addressed)return false;
    if(this.#social&&!this.#social.aiTurn(uid,performance.now()))return false;
    const old=this.#pending.findIndex(p=>p.source===uid);if(old>=0)this.#pending.splice(old,1);
    if(this.#pending.length>=8)return false;
    this.#pending.push({id:spud.residentId,source:uid,allowed:audience,addressed,at:this.#ticks});
    this.spuds.focus(uid,spud.residentId);return true;
  }
  #generate(id:SpudId,context:DialogueLine[],allowed:Set<string>,addressed:boolean,ambient:boolean,source?:string,companions:string[]=[]){
    const spud=this.spuds.snapshots().find(s=>s.residentId===id);if(!spud||!this.#ai)return;
    this.#aiBusy=true;const generation=this.#generation,started=this.#ticks;
    void this.#ai.reply({residentId:id,context,addressed,ambient,activity:spud.activity,companions}).then(result=>{
      const text=cleanReply(result);
      if(!text||repeatedReply(text,this.#recentReplies)||generation!==this.#generation||this.paused||this.#ticks-started>120){if(!text&&addressed&&source&&generation===this.#generation)this.#members.get(source)?.send({type:'RESIDENT_STATUS',status:'unavailable'});return;}
      this.#ready={id,text,source,allowed,at:this.#ticks+4,generation,ambient};
    }).catch(()=>{}).finally(()=>{this.#aiBusy=false;if(ambient&&!this.#ready)this.#endExchange();});
  }
  #publicSocialTick(){
    if(!this.#ai||this.paused)return;
    if(this.#ready&&this.#ticks>=this.#ready.at){
      const r=this.#ready;this.#ready=undefined;
      if(r.generation===this.#generation&&this.#residentSpeech(r.id,r.text,r.allowed,r.source,r.ambient)){
        if(r.source&&this.#onInteraction)void this.#onInteraction(r.source,r.id).catch(()=>{});
        this.#nextPublicReply=this.#ticks+12;
        this.#conversation={id:r.id,until:this.#ticks+240};
        if(r.ambient&&this.#exchange){this.#ambientHistory.push({speaker:spudDefinition(r.id)!.name,text:r.text});this.#ambientHistory=this.#ambientHistory.slice(-6);this.#exchange.lines.push({speaker:spudDefinition(r.id)!.name,text:r.text});this.#exchange.turn++;this.#exchange.at=this.#ticks+16;}
      }else if(r.ambient)this.#endExchange();
    }
    if(this.#aiBusy||this.#ready||this.#ticks<this.#nextPublicReply)return;
    while(this.#pending.length){
      const p=this.#pending.shift()!;
      if(this.#ticks-p.at>120||!this.#residentAudience(p.id,p.allowed,p.source).length)continue;
      const history=this.#history.filter(h=>h.heard.has(p.id)&&h.allowed.has(p.source)&&h.at<=p.at&&this.#ticks-h.at<480).slice(-10);
      // A reply can paraphrase any supplied line: intersect its entire context audience.
      const allowed=new Set([...p.allowed].filter(uid=>history.every(h=>h.allowed.has(uid))));
      if(!allowed.has(p.source))continue;
      this.#generate(p.id,history.map(h=>h.line),allowed,p.addressed,false,p.source);return;
    }
    if(this.#exchange){
      const e=this.#exchange;if(e.turn>=e.ids.length||e.generation!==this.#generation){this.#endExchange();return;}
      if(this.#ticks<e.at)return;
      const id=e.ids[e.turn],positions=e.ids.map(id=>this.spuds.snapshots().find(s=>s.residentId===id)?.position);
      if(positions.some(p=>!p)||positions.some(p=>!this.#near(p!,positions[0]!))){this.#endExchange();return;}
      const allowed=new Set(this.#residentAudience(id,undefined,undefined,true).filter(uid=>e.ids.every(other=>this.#residentAudience(other,undefined,undefined,true).includes(uid))));
      if(!allowed.size){this.#endExchange();return;}
      this.#generate(id,e.lines,allowed,false,true,undefined,e.ids.filter(s=>s!==id).map(s=>spudDefinition(s)!.name));return;
    }
    if(this.#ticks<this.#nextAmbient)return;
    this.#nextAmbient=this.#ticks+480+Math.floor(Math.random()*480);
    if(this.#ticks-this.#lastPublicSpeech<240)return;
    const spuds=this.spuds.snapshots().filter(s=>s.activity!=='chatting');
    for(const a of spuds){
      const group=[a];
      for(const b of spuds)if(group.length<3&&!group.includes(b)&&group.every(other=>this.#near(other.position,b.position)))group.push(b);
      if(group.length<2||!this.#residentAudience(a.residentId,undefined,undefined,true).some(uid=>group.every(s=>this.#residentAudience(s.residentId,undefined,undefined,true).includes(uid))))continue;
      const ids=group.map(s=>s.residentId);for(const id of ids)this.spuds.focus('ambient-'+id,id);
      this.#exchange={ids,turn:0,lines:[...this.#ambientHistory],at:this.#ticks+4,generation:this.#generation};return;
    }
  }

  setResidentMemory(uid:string,state:{quiet:boolean;relations:(ResidentMemory&{residentId:string})[]}){this.#social?.setQuiet(uid,state.quiet,performance.now());if(this.#memories.size>=100&&!this.#memories.has(uid))this.#memories.delete(this.#memories.keys().next().value!);this.#memories.set(uid,new Map(state.relations.map(r=>[r.residentId,r])));}
  enableSocial(social:NaturalSocial,roomKey:string){this.#social=social;this.#roomKey=roomKey;this.spuds.setRoomKey(roomKey);}
  residentNearby(userId:string,id:unknown){
    const member=this.#members.get(userId),spud=this.spuds.snapshots().find(s=>s.residentId===id);
    if(!member||!spud)return false;const from=this.#position(member);
    if(Math.hypot(from.x-spud.position.x,from.y-spud.position.y)>2.5||Math.abs(from.z-spud.position.z)>1)return false;
    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const route=findPath(this.grid,from,{x:spud.position.x+dx,y:spud.position.y+dy},{diagonal:false,maxExpanded:64});if(route.status==='ok'&&route.path.length<=2)return true;}return false;
  }
  residentFocus(userId:string,id:unknown,active:unknown,now:number,publicChat=false){
    const d=spudDefinition(id),m=this.#members.get(userId);if(!d||!m||typeof active!=='boolean')throw new Error('Choose a resident in this room');
    if(!active){this.spuds.release(userId,d.id);this.#broadcast({type:'NPC_SNAPSHOT',staff:this.staff()});return {ready:false};}
    const spud=this.spuds.snapshots().find(s=>s.residentId===d.id);if(!spud||this.paused)throw new Error('This resident is not here now');
    const from=this.#position(m);if(publicChat||this.#roomWideChat){if(!this.#near(from,spud.position))throw new Error("Walk closer to this resident to chat");this.spuds.focus(userId,d.id);return {ready:true};}let ready=this.residentNearby(userId,id);
    if(!ready){
      if(Math.hypot(from.x-spud.position.x,from.y-spud.position.y)>8)throw new Error('Walk closer to '+d.name+', then tap their name');
      const goals=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>({x:spud.position.x+dx,y:spud.position.y+dy}));
      const routes=goals.flatMap(goal=>{const path=m.seat?findInteractionExit(this.grid,from,goal,{occupied:this.#occupied(userId),diagonal:false,maxExpanded:256}):findPath(this.grid,from,goal,{occupied:this.#occupied(userId),diagonal:false,maxExpanded:256});return path.status==='ok'&&path.path.length<=12?[{goal,length:path.path.length}]:[];}).sort((a,b)=>a.length-b.length);
      if(!routes.length||!this.receive(userId,{type:'MOVE_TO',...routes[0].goal},now))throw new Error('Clear a path to '+d.name+', then try again');
    }else if(!m.seat)this.receive(userId,{type:'MOVE_TO',x:from.x,y:from.y},now);
    this.spuds.focus(userId,d.id);this.#broadcast({type:'NPC_SNAPSHOT',staff:this.staff()});return {ready};
  }
  residentChat(userId:string,id:unknown,topic:unknown,now:number){
    const d=spudDefinition(id);if(!d||!this.residentNearby(userId,id))throw new Error('Walk near this AI resident to chat');
    if(typeof topic!=='string'||!['hello','games','room','joke','bye','memory'].includes(topic))throw new Error('Choose a conversation topic');
    this.#social?.chat(userId,now);this.spuds.focus(userId,d.id);return {residentId:d.id,name:d.name,isAI:true,text:residentReply(d.id,topic)};
  }
  inviteResident(userId:string,id:SpudId){if(this.paused||!this.#members.has(userId))throw new Error('Connect to your room first');this.spuds.invite(this.grid,this.#occupied(),id,userId);this.#broadcast({type:'NPC_SNAPSHOT',staff:this.staff()});}
  dismissResident(userId:string,id?:SpudId){const changed=this.spuds.dismiss(userId,id);if(changed)this.#broadcast({type:'NPC_SNAPSHOT',staff:this.staff()});return changed;}
  residentQuiet(userId:string,quiet:boolean,now:number){this.#social?.setQuiet(userId,quiet,now);return {quiet};}
  enableResidents(){this.#publicResidents=true;}
  enableResidentHome(id:SpudId){this.enableRoomWideChat();this.#publicResidents=true;this.spuds.setHome(id);}
  prepareResidents(){if(this.#publicResidents&&this.memberCount===0)this.spuds.prepareIdle(this.grid,this.#occupied());}
  #members = new Map<string,Member>();
  #sequence = 0;
  #furnitureResults=new Map<string,{value:number;at:number;x:number;y:number}>();
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
  staff():NPCSnapshot[]{return [...this.#staff.map(({definition:d,index,sleepUntil,playUntil,toyId})=>({staffId:d.id,username:d.name,role:d.role,petId:d.petId,ownerId:d.ownerId,species:d.species,color:d.color,isStaff:true,position:{...d.path[index],z:this.grid.tile(d.path[index])!.z},state:sleepUntil?'sleep':playUntil?'play':'std',toyId:playUntil?toyId:undefined,playElapsed:playUntil?(32-playUntil+this.#ticks)*250:undefined})),...this.spuds.snapshots()];}
  setPets(pets:RoomPet[]){
    if(pets.length>3)throw new Error('Up to three pets can roam in a room');
    const previous=new Map(this.#staff.filter(s=>s.definition.petId).map(s=>[s.definition.petId!,s]));
    this.#staff=this.#staff.filter(s=>!s.definition.petId);
    for(const pet of pets){
      const old=previous.get(pet.id);let position=old?.definition.path[0];
      if(!position||!this.grid.tile(position)?.walkable||this.#occupied().has(tileKey(position))){
        position=this.#petSpawn();if(!position)continue;
      }
      const definition:Staff={id:'pet-'+pet.id,petId:pet.id,ownerId:pet.ownerId,name:pet.name,species:pet.species,color:pet.color,role:'Pet '+pet.species,path:[position],greeting:pet.species==='dog'?'A happy tail wag just for you.':pet.species==='cat'?'A soft purr and a curious glance.':'A little nose wiggle to say hello.',tip:'This pet belongs to the room owner. Its owner can rename it or return it to Backpack.'};
      this.#staff.push({...this.#petClock(),...old,definition,index:0});
    }
  }
  #petSpawn():XY|undefined {
    // Pick only floor connected to the entrance, never a sealed pocket or solid furniture.
    let entrance:XY|undefined;
    for(let y=0;y<this.grid.length&&!entrance;y++)for(let x=0;x<this.grid.width;x++)if(this.grid.tile({x,y})?.walkable){entrance={x,y};break;}
    if(!entrance)return;
    const occupied=this.#occupied(),seen=new Set([tileKey(entrance)]),queue=[entrance],free:XY[]=[];
    for(let i=0;i<queue.length;i++){
      const p=queue[i],tile=this.grid.tile(p)!;
      if(!occupied.has(tileKey(p))&&!tile.canSit&&!tile.canLay&&!tile.roller&&!tile.petBed&&!tile.petToy)free.push(p);
      for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
        const q={x:p.x+dx,y:p.y+dy};
        if(!seen.has(tileKey(q))&&canStep(this.grid,p,q,{diagonal:false})){seen.add(tileKey(q));queue.push(q);}
      }
    }
    // Keep the entrance clear; prefer separation from residents when space permits.
    const away=free.filter(p=>Math.abs(p.x-entrance!.x)+Math.abs(p.y-entrance!.y)>=3);
    const candidates=away.length?away:free.filter(p=>tileKey(p)!==tileKey(entrance!));
    const spaced=candidates.filter(p=>this.staff().every(s=>Math.abs(p.x-s.position.x)+Math.abs(p.y-s.position.y)>=3));
    const pool=spaced.length?spaced:candidates;
    return pool.length?pool[this.#random(0,pool.length-1)]:undefined;
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
  #toyRoute(s:Resident){
    if(!s.definition.petId||this.#ticks<(s.nextPlay??0))return false;
    const from=s.definition.path[s.index],occupied=this.#occupied();occupied.delete(tileKey(from));
    const toys:XY[]=[];
    for(let y=0;y<this.grid.length;y++)for(let x=0;x<this.grid.width;x++)if(this.grid.tile({x,y})?.petToy===s.definition.species&&!occupied.has(tileKey({x,y}))&&!this.#staff.some(other=>other!==s&&other.toy?.x===x&&other.toy?.y===y))toys.push({x,y});
    while(toys.length){const goal=toys.splice(this.#random(0,toys.length-1),1)[0],result=findPath(this.grid,from,goal,{occupied,diagonal:false,maxExpanded:1024});if(result.status==='ok'){s.toy=goal;s.toyId=this.grid.tile(goal)!.itemId;s.route=result.path;return true;}}
    return false;
  }
  #play(s:Resident){
    const from=s.definition.path[s.index];s.playUntil=this.#ticks+32;s.nextPlay=this.#ticks+this.#random(480,960);s.route=[];s.nextWalk=this.#ticks+6;
    // A short out-and-back chase keeps the toy near its placed home. Each step
    // is checked again against live occupancy by the normal movement loop.
    if(s.definition.species!=='cat')for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){
      const a={x:from.x+dx,y:from.y+dy},b={x:from.x+2*dx,y:from.y+2*dy},occupied=this.#occupied();occupied.delete(tileKey(from));
      if(canStep(this.grid,from,a,{occupied,diagonal:false})&&canStep(this.grid,a,b,{occupied,diagonal:false})){s.route=[a,b,a,from];break;}
    }
  }
  #wake(s:Resident){const asleep=!!s.sleepUntil||!!s.playUntil;s.sleepUntil=undefined;s.bed=undefined;s.toy=undefined;s.toyId=undefined;s.playUntil=undefined;if(asleep)this.#broadcast({type:'NPC_SNAPSHOT',staff:this.staff()});}
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
    const nearby=[...this.#members.values()].filter(m=>Math.hypot(from.x-this.#position(m).x,from.y-this.#position(m).y)<=(mode==='whisper'?1:this.#roomWideChat?Infinity:8));
    if(mode==='whisper'&&!nearby.some(m=>m.identity.userId===target))throw new Error('Move beside this player to whisper');
    return (mode==='shout'?[...this.#members.values()]:nearby).filter(m=>mode!=='whisper'||m.identity.userId===userId||m.identity.userId===target).map(m=>m.identity.userId);
  }
  canReplace(grid:RoomGrid){return this.spuds.canReplace(grid)&&this.staff().filter(s=>!s.isAI).every(s=>{const t=grid.tile(s.position);return !!t?.walkable&&t.z===s.position.z;})&&this.members().every(m=>{const tile=grid.tile(m.position);return !!tile&&tile.z===m.position.z&&(tile.walkable||(m.state==='sit'&&tile.canSit)||(m.state==='lay'&&tile.canLay));});}
  replaceGrid(grid:RoomGrid){if(!this.canReplace(grid))throw new Error('A player is standing there');this.grid=grid;}
  get memberCount(){return this.#members.size;}
  availableSpawn():XY {
    const occupied=this.#occupied();
    for(let y=0;y<this.grid.length;y++)for(let x=0;x<this.grid.width;x++){
      if(this.grid.tile({x,y})?.walkable&&!occupied.has(tileKey({x,y})))return {x,y};
    }
    throw new Error('No free spawn');
  }
  #occupied(except?:string){return new Set([...this.#members].filter(([id])=>id!==except).map(([,m])=>tileKey(this.#position(m))).concat(this.staff().map(s=>tileKey(s.position)),[...this.spuds.occupied()]));}
  #broadcast(packet:Record<string,unknown>){for(const m of this.#members.values())m.send(packet);}
  join(identity:Identity,spawn:XY,send:Send){
    if(!identity.userId||!identity.username||this.#members.has(identity.userId))throw new Error('Duplicate or invalid member');
    if(this.#members.size>=this.capacity||this.#occupied().has(tileKey(spawn)))throw new Error('Room full or spawn occupied');
    const member:Member={identity:{...identity},movement:new MovementController(this.grid,spawn),send,lastIntent:-Infinity,lastChat:-Infinity};
    this.#members.set(identity.userId,member);
    send({type:'ROOM_SNAPSHOT',revision:this.grid.revision,sequence:this.#sequence,users:[...this.#members.values()].map(m=>({...m.identity,position:this.#position(m),state:m.seat?.state??'std'}))});
    send({type:'NPC_SNAPSHOT',staff:this.staff()});
    for(const [itemId,result] of this.#furnitureResults)if(result.value>0&&this.grid.tile(result)?.itemId===itemId)send({type:'FURNITURE_RESULT',itemId,value:result.value,kind:'dice',snapshot:true});
    this.#broadcast({type:'USER_JOINED',...member.identity,position:this.#position(member)});
  }
  leave(userId:string){this.#pending=this.#pending.filter(p=>p.source!==userId);this.#history=this.#history.filter(h=>h.source!==userId);this.spuds.release(userId);this.#memories.delete(userId);if(this.#members.delete(userId)){this.dismissResident(userId);this.#broadcast({type:'USER_LEFT',userId});}}
  /** userId comes from the socket binding, never from a packet. now is server monotonic time. */
  receive(userId:string,packet:unknown,now:number){
    const m=this.#members.get(userId);
    if(this.paused||!m||!Number.isFinite(now)||!packet||typeof packet!=='object'||Array.isArray(packet))return false;
    const p=packet as Record<string,unknown>;const interactionAction=p.action;
    if(p.type==='INTERACT'&&['roll','serve'].includes(String(p.action))){
      const reply=(error:string)=>{m.send({type:'FURNITURE_RESULT',error});return false;};
      if(!validXY(p)||Object.keys(p).some(k=>!['type','x','y','action'].includes(k)))return false;
      const tile=this.grid.tile(p),kind=interactionAction==='roll'?'dice':'serve';
      if(!tile?.itemId||tile.furnitureUse!==kind)return reply('This piece cannot be used.');
      const pos=this.#position(m);
      if(m.seat||Math.abs(pos.x-p.x)+Math.abs(pos.y-p.y)!==1||Math.abs(pos.z-tile.z)>2)return reply('Walk beside the piece, then tap Use.');
      if(now-(m.lastFurnitureUse??-Infinity)<3000)return reply('Give it a moment before using again.');
      const last=this.#furnitureResults.get(tile.itemId);
      if(last&&now-last.at<3000)return reply('This piece is already in use.');
      m.lastFurnitureUse=now;
      const value=kind==='dice'?randomInt(1,7):0;
      this.#furnitureResults.set(tile.itemId,{value,at:now,x:p.x,y:p.y});
      this.#broadcast({type:'FURNITURE_RESULT',itemId:tile.itemId,userId,value,kind});return true;
    }
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
      if(mode==='normal'&&!this.#roomWideChat&&d>8)continue;
      other.send({type:'CHAT',userId,text:text.trim(),mode,opacity:mode==='normal'&&!this.#roomWideChat?Math.max(.25,1-d/10):1});
    }
    return true;
  }
  tick(){
    if(this.paused)return;
    ++this.#ticks;let moved=false;
    for(const [id,result] of this.#furnitureResults)if(this.grid.tile(result)?.itemId!==id)this.#furnitureResults.delete(id);
    for(const s of this.#staff){
      const d=s.definition;
      if(d.species){
        if(s.toy&&(this.grid.tile(s.toy)?.petToy!==d.species||this.grid.tile(s.toy)?.itemId!==s.toyId)){this.#rest(s);moved=true;continue;}
        if(s.playUntil&&this.#ticks>=s.playUntil){this.#rest(s);s.nextWalk=this.#ticks+this.#random(240,480);moved=true;continue;}
        if(s.playUntil&&!s.route?.length)continue;
        if(s.bed&&this.grid.tile(s.bed)?.petBed!==d.species){this.#rest(s);moved=true;continue;}
        if(s.sleepUntil){if(this.#ticks<s.sleepUntil)continue;this.#rest(s);moved=true;continue;}
        if(this.#ticks>=s.nextVoice!){this.#broadcast({type:'PET_CHAT',staffId:d.id,text:d.species==='dog'?'Woof!':d.species==='cat'?'Meow!':'*sniff sniff*'});s.nextVoice=this.#ticks+this.#random(1080,1320);}
        if(this.#ticks<s.nextWalk!)continue;
        if(s.callOwner){const route=this.#ticks<s.callUntil!?this.#callRoute(s,s.callOwner):null;if(!route?.length){this.#rest(s);continue;}s.route=route;}
        if(!s.route?.length){const activity=this.#random(0,3);if(!(activity===0&&this.#bedRoute(s))&&!(activity===1&&this.#toyRoute(s)))s.route=this.#petRoute(s);}
        if(s.toy&&!s.playUntil&&!s.route?.length){this.#play(s);moved=true;continue;}
        if(s.bed&&!s.route?.length){this.#sleep(s);moved=true;continue;}
        const next=s.route?.shift(),from=d.path[s.index];
        if(next&&canStep(this.grid,from,next,{occupied:this.#occupied(),diagonal:false})){
          if(d.petId)d.path[0]=next;else s.index=d.path.findIndex(p=>p.x===next.x&&p.y===next.y);
          moved=true;if(s.route?.length)s.nextWalk=this.#ticks+3;else if(s.playUntil){s.nextWalk=s.playUntil;}else if(s.toy){this.#play(s);}else if(s.bed){this.#sleep(s);}else this.#rest(s);
        }else{this.#rest(s);}
      }else if(this.#ticks%32===0){
        const next=(s.index+1)%d.path.length,p=d.path[next],from=d.path[s.index];
        if(next!==s.index&&Math.abs(p.x-from.x)+Math.abs(p.y-from.y)===1&&this.grid.tile(p)?.walkable&&!this.#occupied().has(tileKey(p))){s.index=next;moved=true;}
      }
    }
    const external=new Set([...this.#members.values()].flatMap(m=>[tileKey(this.#position(m)),...m.movement.plannedTiles().map(tileKey),...(m.plan?[tileKey(m.plan.destination)]:[]) ]).concat(this.#staff.map(s=>tileKey(s.definition.path[s.index]))));
    if(this.spuds.tick(this.grid,external,this.memberCount,this.#publicResidents))moved=true;

    this.#publicSocialTick();
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
