import {spudDefinition} from './spud-residents.ts';
import {NaturalSocial,residentReply} from './resident-social.ts';
import {hangoutFor,hangoutAnimals} from './public-hangouts.ts';
import {RoomGrid,parseHeightmap} from './grid.ts';
import type {ItemPlacement} from './grid.ts';
import {RoomRuntime} from './room-runtime.ts';
import type {Identity,RoomPet} from './room-runtime.ts';
import type {WorldAccess} from './gateway.ts';
import {WorldAccessError} from './access-error.ts';
type Snapshot={pets?:RoomPet[];roomId:string;username:string;name:string;ownerId:string|null;access:string;equipped:Record<string,unknown>;heightmap:string;revision:number;capacity:number;items:(ItemPlacement&{definitionId:string;sprite:string;color:string;name:string})[]};
type Bootstrap={rooms:{id:string;name:string;ownerId:string|null}[];catalog:Record<string,any>[];items:Record<string,any>[];friends:Record<string,any>[]};
/** Server-only credentials; never import into the website bundle. */
export class SupabaseWorldAccess implements WorldAccess {
  #social=new NaturalSocial();
  #memoryReady=new Set<string>();
  async #residentState(uid:string,roomId:string,action:string,data:unknown={}){return this.#request('/rest/v1/rpc/world_residents',this.#key,{p_actor:uid,p_room:roomId,p_action:action,p_data:data});}
  #url:string;#key:string;
  #rooms=new Map<string,RoomRuntime>();
  #retired=new Set<string>();
  #queues=new Map<string,Promise<unknown>>();
  constructor(url:string,serviceKey:string){
    const parsed=new URL(url.trim());
    if(parsed.protocol!=='https:'||!serviceKey.trim())throw new Error('Secure Supabase configuration required');
    this.#url=parsed.origin;this.#key=serviceKey.trim();
  }
  async #request(path:string,token:string,body?:unknown):Promise<any>{
    const response=await fetch(this.#url+path,{method:body===undefined?'GET':'POST',headers:{apikey:this.#key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(4000)});
    if(!response.ok){const rejected=await response.json().catch(()=>({}));
      // The gateway can reject the server API key while the player's JWT is valid.
      if(response.headers.get('sb-error-code')==='UNAUTHORIZED_INVALID_API_KEY'||rejected.message==='Invalid API key')throw new WorldAccessError('server_configuration');
      if(path==='/auth/v1/user'&&(response.status===401||response.status===403))throw new WorldAccessError('sign_in_required');
      const safeMessages=['Not enough Arcade Coins','Pet unavailable','Pet collection full','Visit the room containing this pet first','Use 1 to 18 letters or numbers for a pet name','Only your own room can hold your pets','Up to three pets can roam in a room','Item unavailable','Backpack full','Wallet unavailable','Accept the chat rules first','Please slow down','Please edit that message','Private messages are for accepted friends','Player unavailable','Both offers must be locked','Trade closed or expired','Stale trade revision','Items unavailable','Visit another player’s open room to react','Open this room to visitors before inviting','Decorate your open room with at least 3 pieces this week'];const message=safeMessages.includes(rejected.message)?rejected.message:'Action unavailable. Refresh and try again.';throw Object.assign(new Error(message),{definite:response.status===400&&rejected.code==='P0001'});}
    return response.json();
  }
  async authenticate(token:string):Promise<Identity>{
    const user=await this.#request('/auth/v1/user',token);
    if(typeof user?.id!=='string'||user.is_anonymous||!user.email_confirmed_at)throw new WorldAccessError('confirmed_account_required');
    return {userId:user.id,username:user.id};
  }
  async #api(userId:string,action:string,data:unknown={}):Promise<any>{return this.#request('/rest/v1/rpc/world_api',this.#key,{p_actor:userId,p_action:action,p_data:data});}
  async #snapshot(userId:string,roomId:string):Promise<Snapshot>{return this.#request('/rest/v1/rpc/world_room_snapshot',this.#key,{p_actor:userId,p_room:roomId});}
  #grid(s:Snapshot){return new RoomGrid(parseHeightmap(s.heightmap),s.items.map(item=>({...item,roller:item.sprite==='play-neon-roller'?item.rotation:undefined,furnitureUse:['play-neon-dice','play-clockwork-dice'].includes(item.sprite)?'dice' as const:item.sprite==='play-soft-serve'?'serve' as const:undefined,petToy:({'pet-toy-dog':'dog','pet-toy-cat':'cat','pet-toy-rabbit':'rabbit'} as Record<string,string>)[item.sprite],petBed:({'pet-bed-dog':'dog','pet-bed-cat':'cat','pet-bed-rabbit':'rabbit'} as Record<string,string>)[item.sprite]})),s.revision);}
  #roomCounts(rooms:Record<string,any>[]){return rooms.filter(r=>!this.#retired.has(r.id)).map(r=>({...r,occupancy:this.#rooms.get(r.id)?.memberCount??0}));}
  async enter(identity:Identity,roomId:string){
    let bootstrap:Bootstrap=await this.#api(identity.userId,'bootstrap');
    if(roomId==='home'||roomId==='choose-home'||roomId.startsWith('starter-')){
      const home=bootstrap.rooms.find(r=>r.ownerId===identity.userId);
      if(home)roomId=home.id;
      else if(roomId==='choose-home')throw new WorldAccessError('room_choice_required');
      else{
        const layout=roomId==='home'?'classic':roomId.slice(8);
        if(!['classic','studio','square','loft','corner','courtyard'].includes(layout))throw new Error('Invalid room layout');
        const created=await this.#api(identity.userId,'create_room',{name:'My Room',layout,firstRoom:true});
        roomId=created.roomId;
        bootstrap=await this.#api(identity.userId,'bootstrap');
      }
    }
    if(roomId==='plaza')roomId=bootstrap.rooms.find(r=>r.ownerId===null&&r.name==='Earnly Plaza')?.id??'';
    if(this.#retired.has(roomId))throw new Error('Room unavailable');
    const snapshot=await this.#snapshot(identity.userId,roomId);
    if(this.#retired.has(roomId))throw new Error('Room unavailable');
    if(typeof snapshot.username!=='string'||snapshot.roomId!==roomId)throw new Error('Invalid room snapshot');
    let room=this.#rooms.get(roomId);
    if(room&&room.grid.revision!==snapshot.revision){if(room.memberCount)throw new Error('Room changed; reconnect');this.#rooms.delete(roomId);room=undefined;}
    if(!room){if(this.#rooms.size>=100){const idle=[...this.#rooms].find(([,r])=>r.memberCount===0);if(idle)this.#rooms.delete(idle[0]);else throw new Error('World capacity reached');}room=new RoomRuntime(this.#grid(snapshot),snapshot.capacity,[...(hangoutFor(snapshot)?.staff||[]),...hangoutAnimals(snapshot)],snapshot.pets||[]);if(snapshot.ownerId===null)room.enableResidents();room.enableSocial(this.#social,roomId);this.#rooms.set(roomId,room);}
    let aiMemory;try{aiMemory=await this.#residentState(identity.userId,roomId,'read');room.setResidentMemory(identity.userId,aiMemory);if(this.#memoryReady.size>=2000)this.#memoryReady.delete(this.#memoryReady.values().next().value!);this.#memoryReady.add(identity.userId);}catch{this.#memoryReady.delete(identity.userId);}
    return {room,roomId,spawn:room.availableSpawn(),username:snapshot.username,equipped:snapshot.equipped,scene:{...snapshot,theme:hangoutFor(snapshot)?.theme},bootstrap:{...bootstrap,aiResidents:true,aiMemory:!!aiMemory,residentQuiet:this.#social.quiet(identity.userId,performance.now()),personalPets:true,petInteractions:true,dailyMissions:true,socialDiscovery:true}};
  }
  async recordEntry(identity:Identity,roomId:string,occupancy:number){
    await Promise.allSettled([this.#request('/rest/v1/rpc/activity_record',this.#key,{p_actor:identity.userId,p_id:crypto.randomUUID(),p_kind:'world_join',p_room:roomId,p_occupancy:occupancy}),this.#request('/rest/v1/rpc/world_daily_visit',this.#key,{p_actor:identity.userId,p_room:roomId}),this.#request('/rest/v1/rpc/world_track_step',this.#key,{p_actor:identity.userId,p_step:'join',p_room:roomId})]);
  }
  async recordWalk(identity:Identity,roomId:string){await this.#request('/rest/v1/rpc/world_track_step',this.#key,{p_actor:identity.userId,p_step:'walk',p_room:roomId});}
  async revalidate(token:string,identity:Identity,roomId:string){
    const current=await this.authenticate(token);if(current.userId!==identity.userId)return false;
    if(this.#retired.has(roomId))throw new Error('Room unavailable');
    const snapshot=await this.#snapshot(identity.userId,roomId);
    if(this.#retired.has(roomId))throw new Error('Room unavailable');
    return snapshot.revision===this.#rooms.get(roomId)?.grid.revision;
  }
  async perform(identity:Identity,roomId:string,action:string,data:Record<string,unknown>){
    const uid=identity.userId,room=this.#rooms.get(roomId);if(!room)throw new Error('Room unavailable');
    // Recheck current permissions and suspensions before every write/read operation.
    const currentSnapshot=await this.#snapshot(uid,roomId);
    let result:any;let deliveries:{userIds:string[];roomId?:string;packet:Record<string,unknown>}[]=[];
    if(action==='resident_invite'||action==='resident_dismiss'){
      if(currentSnapshot.ownerId!==uid)throw new Error('Enter your own room to invite or dismiss an AI resident');
      const d=spudDefinition(data.residentId);if(!d)throw new Error('Unknown AI resident');
      if(action==='resident_invite'){if(!this.#memoryReady.has(uid))throw new Error('AI friendships are not available yet');const state=await this.#residentState(uid,roomId,'read');if(!state.relations.some((r:any)=>r.residentId===d.id&&r.friend))throw new Error('Add this AI resident as a friend first');room.inviteResident(uid,d.id);}
      else if(!room.dismissResident(uid,d.id))throw new Error('This AI visitor is not in your room');
      result={residentId:d.id,isAI:true,visiting:action==='resident_invite'};
    }else if(action==='resident_chat'){result=room.residentChat(uid,data.residentId,data.topic,performance.now());
      if(this.#memoryReady.has(uid)){const state=await this.#residentState(uid,roomId,'touch',{residentId:result.residentId,topic:data.topic,...(data.favoriteGame!==undefined?{favoriteGame:data.favoriteGame}:{})});room.setResidentMemory(uid,state);const memory=state.relations.find((r:any)=>r.residentId===result.residentId);const position=room.spuds.snapshots().find(s=>s.residentId===result.residentId)?.position;const nearby=position?currentSnapshot.items.find(item=>Math.hypot(item.x-position.x,item.y-position.y)<=4):undefined;result.text=residentReply(result.residentId,data.topic as string,memory,nearby?.name?.slice(0,64));}
    }else if(['resident_memory','resident_settings','resident_friend','resident_forget'].includes(action)){
      if(!this.#memoryReady.has(uid))throw new Error('AI memory is not available yet. Reconnect later.');
      const clean:Record<string,unknown>={};for(const k of ['residentId','quiet','remember','friend'])if(data[k]!==undefined)clean[k]=data[k];
      result=await this.#residentState(uid,roomId,action.slice(9)==='memory'?'read':action.slice(9),clean);room.setResidentMemory(uid,result);
    }else if(action==='resident_mode'){if(typeof data.quiet!=='boolean')throw new Error('Choose Natural or Quiet mode');if(this.#memoryReady.has(uid)){const state=await this.#residentState(uid,roomId,'settings',{quiet:data.quiet});room.setResidentMemory(uid,state);}result=room.residentQuiet(uid,data.quiet,performance.now());
    }else if(['reactions','react','featured','invite','invites','dismiss_invite','weekly','weekly_enter'].includes(action)){
      const clean:Record<string,unknown>={};
      if(action==='react'){if(data.reaction!==null&&!['heart','thumb'].includes(String(data.reaction)))throw new Error('Invalid reaction');clean.reaction=data.reaction;}
      if(action==='invite'||action==='dismiss_invite'){const key=action==='invite'?'userId':'id';if(typeof data[key]!=='string'||!/^[0-9a-f-]{36}$/i.test(String(data[key])))throw new Error('Player unavailable');clean[key]=data[key];}
      result=await this.#request('/rest/v1/rpc/world_social',this.#key,{p_actor:uid,p_room:roomId,p_action:action,p_data:clean});
      if(action==='featured')result=this.#roomCounts(result);
      if(action==='invite'&&!result.duplicate)deliveries.push({userIds:[result.recipient],packet:{type:'ROOM_INVITE'}});
    }else if(action==='daily_missions'){
      if(data.claim!==undefined&&!['visit','decorate','game'].includes(String(data.claim)))throw new Error('Unknown daily mission');
      result=await this.#request('/rest/v1/rpc/world_daily_missions',this.#key,{p_actor:uid,p_claim:data.claim??null});
    }else if(action==='rename_room'){
      const target=typeof data.roomId==='string'?data.roomId:'';
      const name=typeof data.name==='string'?data.name.trim():'';
      if(!/^[0-9a-f-]{36}$/i.test(target))throw new Error('Room unavailable');
      if(!name||[...name].length>40||/[\x00-\x1f\x7f]/.test(name))throw new Error('Use 1–40 characters for your room name');
      result=await this.#request('/rest/v1/rpc/world_rename_room',this.#key,{p_actor:uid,p_room:target,p_name:name});
      const targetRoom=this.#rooms.get(target);
      deliveries.push({roomId:target,userIds:targetRoom?.members().map(m=>m.userId)??[],packet:{type:'ROOM_NAME',roomId:target,name:result.name}});
    }else if(action==='delete_room'){
      const target=String(data.roomId??'');
      if(data.confirm!==true)throw new Error('Confirm room deletion first');
      if(this.#retired.has(target))throw new Error('Room unavailable');
      // Block admission before awaiting ownership or persistence. Retain successful
      // tombstones so an already-pending snapshot cannot resurrect the runtime.
      this.#retired.add(target);
      const targetRoom=this.#rooms.get(target);
      try{
        if(targetRoom?.members().some(m=>m.userId!==uid)||targetRoom?.memberCount&&target!==roomId)throw new Error('Ask visitors to leave this room before deleting it');
        if(this.#queues.has(target))throw new Error('Wait for furniture changes to finish');
        const snapshot=await this.#snapshot(uid,target);
        if(snapshot.ownerId!==uid)throw new Error('Only your own rooms can be deleted');
        if(targetRoom?.members().some(m=>m.userId!==uid))throw new Error('Ask visitors to leave this room before deleting it');
        if(targetRoom)targetRoom.paused=true;
        result=await this.#request('/rest/v1/rpc/world_delete_room',this.#key,{p_actor:uid,p_room:target});
        this.#rooms.delete(target);
      }catch(error){this.#retired.delete(target);if(targetRoom)targetRoom.paused=false;throw error;}
    }else if(action==='friend_rooms'){
      if(typeof data.userId!=='string'||!/^[0-9a-f-]{36}$/i.test(data.userId))throw new Error('Player unavailable');
      const rooms=await this.#request('/rest/v1/rpc/world_friend_rooms',this.#key,{p_actor:uid,p_friend:data.userId});
      result=this.#roomCounts(rooms);
    }else if(action==='room_explore'){
      const query=typeof data.query==='string'?data.query.trim().slice(0,80):'';
      const offset=typeof data.offset==='number'&&Number.isSafeInteger(data.offset)&&data.offset>=0?data.offset:0;
      const directory=await this.#request('/rest/v1/rpc/world_explore_rooms',this.#key,{p_actor:uid,p_query:query,p_offset:offset});
      result={...directory,rooms:this.#roomCounts(directory.rooms)};
    }else if(action==='room_directory'){
      const directory=await this.#api(uid,'bootstrap');result=this.#roomCounts(directory.rooms);
    }else if(action==='pet_interact'){if(data.kind!=='pet'&&data.kind!=='call')throw new Error('Unknown pet interaction');result=room.petInteract(uid,data.staffId,data.kind);
    }else if(action==='staff_talk'){result=room.talkToStaff(uid,data.staffId);
    }else if(['pet_buy','pet_place','pet_pickup','pet_rename'].includes(action)){
      const previous=this.#queues.get(roomId)??Promise.resolve();
      const task=previous.catch(()=>{}).then(async()=>{
        room.paused=true;let safe=true;
        try{
          if(action==='pet_place'){
            const snapshot=await this.#snapshot(uid,roomId);
            if(snapshot.ownerId!==uid)throw new Error('Only your own room can hold your pets');
            if(!(snapshot.pets||[]).some(p=>p.id===data.petId)){
              if((snapshot.pets||[]).length>=3)throw new Error('Up to three pets can roam in a room');
              try{room.availableSpawn();}catch{throw new Error('Clear some floor space for your pet first');}
            }
          }
          const reply=await this.#request('/rest/v1/rpc/world_pets',this.#key,{p_actor:uid,p_room:roomId,p_action:action.slice(4),p_data:data});
          const snapshot=await this.#snapshot(uid,roomId);room.setPets(snapshot.pets||[]);
          return reply;
        }catch(error){
          try{const snapshot=await this.#snapshot(uid,roomId);room.setPets(snapshot.pets||[]);}catch{safe=false;}
          throw error;
        }finally{room.paused=!safe;}
      });
      this.#queues.set(roomId,task);try{result=await task;}finally{if(this.#queues.get(roomId)===task)this.#queues.delete(roomId);}
      deliveries.push({roomId,userIds:room.members().map(m=>m.userId),packet:{type:'NPC_SNAPSHOT',staff:room.staff()}});
    }else if(action==='place'){
      const previous=this.#queues.get(roomId)??Promise.resolve();
      const task=previous.catch(()=>{}).then(async()=>{
        room.paused=true;let safe=true;
        try{
          const snapshot=await this.#snapshot(uid,roomId);if(snapshot.ownerId!==uid)throw new Error('Only your own room can be decorated');
          if(snapshot.revision!==room.grid.revision)throw new Error('Room changed; reconnect');
          const bootstrap:Bootstrap=await this.#api(uid,'bootstrap');
          const item=bootstrap.items.find(i=>i.id===data.itemId);if(!item||item.room_id&&item.room_id!==roomId)throw new Error('Item unavailable');
          const definition=bootstrap.catalog.find(d=>d.id===item.definition_id);if(!definition)throw new Error('Item unavailable');
          let items=snapshot.items.filter(i=>i.id!==item.id);
          // First verify removing this item does not leave an unsupported stack.
          const base=new RoomGrid(parseHeightmap(snapshot.heightmap),items,snapshot.revision);
          let z=0,centered=false,placeX=data.x,placeY=data.y;
          if(!data.pickup){
            centered=typeof data.centerOnRug==='string'||item.centered===true&&data.x===item.x&&data.y===item.y&&data.centered!==false;
            if(centered){
              if(definition.width!==1||definition.length!==1||!['table','bistro-table','holo-table'].includes(definition.sprite_id))throw new Error('Only small tables can be centered');
              const rug=snapshot.items.find(i=>(data.centerOnRug?i.id===data.centerOnRug:i.x===item.x&&i.y===item.y)&&i.sprite==='rug'&&i.width===2&&i.length===2&&i.walkable&&i.canStack);
              if(!rug)throw new Error('Choose a rug in this room');placeX=rug.x;placeY=rug.y;
            }
            const x=placeX,y=placeY,rotation=data.rotation;
            if(!Number.isInteger(x)||!Number.isInteger(y)||![0,2,4,6].includes(rotation as number))throw new Error('Choose a floor tile');
            const tile=base.tile({x:x as number,y:y as number});if(!tile)throw new Error('Choose a floor tile');z=tile.z;
            items=[...items,{id:item.id,x:x as number,y:y as number,z,rotation:rotation as 0|2|4|6,width:definition.width,length:definition.length,itemHeight:Number(definition.item_height),walkable:definition.walkable,canStack:centered?false:definition.can_stack,centered,canSit:definition.can_sit,canLay:definition.can_lay,definitionId:definition.id,sprite:definition.sprite_id,color:item.color??definition.color,name:definition.name}];
          }
          const next=this.#grid({...snapshot,items,revision:snapshot.revision+1});
          if(!room.canReplace(next))throw new Error('Move away from the item before placing it');
          await this.#api(uid,'place',{roomId,revision:snapshot.revision,itemId:item.id,x:placeX,y:placeY,z,rotation:data.rotation,centered,pickup:!!data.pickup});
          room.replaceGrid(next);
          return {...snapshot,items,revision:next.revision};
        }catch(error){
          // Ambiguous DB failures require fresh admission, not continued stale movement.
          try{const fresh=await this.#snapshot(uid,roomId);if(fresh.revision!==room.grid.revision)room.replaceGrid(this.#grid(fresh));}catch{safe=false;throw error;}
          throw error;
        }finally{room.paused=!safe;}
      });
      this.#queues.set(roomId,task);try{result=await task;}finally{if(this.#queues.get(roomId)===task)this.#queues.delete(roomId);}
      deliveries.push({roomId,userIds:room.members().map(m=>m.userId),packet:{type:'SCENE',scene:result}});
    }else if(action==='say'){
      const viewers=room.chatViewers(uid,String(data.mode),typeof data.userId==='string'?data.userId:undefined);
      result=await this.#api(uid,'say',{text:data.text,requestId:data.requestId,mode:data.mode,viewers,roomId});
      if(!result.duplicate)deliveries.push({roomId,userIds:result.viewers,packet:{type:'CHAT',...result,viewers:undefined,username:identity.username}});
    }else if(action==='trade_create'){
      if(!room.members().some(m=>m.userId===data.userId))throw new Error('Trade with someone in this room');
      result=await this.#api(uid,action,data);deliveries.push({userIds:[uid,String(data.userId)],packet:{type:'TRADE',trade:result}});
    }else if(action==='trade_action'){
      if(!['edit','lock','confirm','cancel'].includes(String(data.action)))throw new Error('Invalid trade action');
      const before=await this.#api(uid,'trade_read',{tradeId:data.tradeId});if(!before)throw new Error('Trade unavailable');
      const other=before.player_a===uid?before.player_b:before.player_a;
      if(data.action!=='cancel'&&!room.members().some(m=>m.userId===other))throw new Error('Your trading partner left');
      await this.#request('/rest/v1/rpc/world_trade_action',this.#key,{p_actor:uid,p_trade:data.tradeId,p_revision:data.revision,p_action:data.action,p_items:data.items??[]});
      result=await this.#api(uid,'trade_read',{tradeId:data.tradeId});
      deliveries.push({userIds:[uid,other],packet:{type:'TRADE',trade:result}});
    }else if(['bootstrap','create_room','room_access','buy','accept_chat','friend_request','friend_accept','friend_remove','block','private_feed','private_send','report','trade_read'].includes(action)){
      if(action==='room_access'&&data.roomId!==roomId)throw new Error('Enter your room first');
      result=await this.#api(uid,action,data);
      if(action==='private_send'&&!result.duplicate)deliveries.push({userIds:result.viewers,packet:{type:'PRIVATE',...result,viewers:undefined,username:identity.username}});
      if(action==='bootstrap'){result.aiResidents=true;result.aiMemory=this.#memoryReady.has(uid);result.personalPets=true;result.petInteractions=true;result.dailyMissions=true;result.socialDiscovery=true;result.rooms=this.#roomCounts(result.rooms);result.friends=result.friends.map((f:any)=>({...f,online:[...this.#rooms.values()].some(r=>r.members().some(m=>m.userId===f.userId))}));}
    }else throw new Error('Unknown action');
    return {data:result,deliveries};
  }
}
