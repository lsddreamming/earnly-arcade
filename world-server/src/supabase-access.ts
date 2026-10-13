import {RoomGrid,parseHeightmap} from './grid.ts';
import type {ItemPlacement} from './grid.ts';
import {RoomRuntime} from './room-runtime.ts';
import type {Identity} from './room-runtime.ts';
import type {WorldAccess} from './gateway.ts';
/** Server-only credentials. Do not import this module into the website bundle. */
export class SupabaseWorldAccess implements WorldAccess {
  #url:string;#key:string;
  #rooms=new Map<string,RoomRuntime>();
  constructor(url:string,serviceKey:string){
    const parsed=new URL(url);
    if(parsed.protocol!=='https:'||!serviceKey)throw new Error('Secure Supabase configuration required');
    this.#url=parsed.origin;this.#key=serviceKey;
  }
  async #request(path:string,token:string,body?:unknown):Promise<any>{
    const response=await fetch(this.#url+path,{method:body===undefined?'GET':'POST',headers:{apikey:this.#key,Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(4000)});
    // Never include API responses, headers or bearer tokens in client errors/logs.
    if(!response.ok)throw new Error('World account or room unavailable');
    return response.json();
  }
  async authenticate(token:string):Promise<Identity>{
    const user=await this.#request('/auth/v1/user',token);
    if(typeof user?.id!=='string'||user.is_anonymous||!user.email_confirmed_at)throw new Error('Confirmed account required');
    // Room snapshot supplies the canonical profile name before rendering.
    return {userId:user.id,username:user.id};
  }
  async #snapshot(userId:string,roomId:string){
    return this.#request('/rest/v1/rpc/world_room_snapshot',this.#key,{p_actor:userId,p_room:roomId});
  }
  async enter(identity:Identity,roomId:string){
    const snapshot=await this.#snapshot(identity.userId,roomId);
    if(typeof snapshot.username!=='string'||snapshot.roomId!==roomId)throw new Error('Invalid room snapshot');
    let room=this.#rooms.get(roomId);
    if(room&&room.grid.revision!==snapshot.revision){
      if(room.memberCount)throw new Error('Room layout changed; reconnect after occupants leave');
      this.#rooms.delete(roomId);room=undefined;
    }
    if(!room){
      if(this.#rooms.size>=100)throw new Error('World capacity reached');
      const grid=new RoomGrid(parseHeightmap(snapshot.heightmap),snapshot.items as ItemPlacement[],snapshot.revision);
      room=new RoomRuntime(grid,snapshot.capacity);this.#rooms.set(roomId,room);
    }
    return {room,spawn:room.availableSpawn(),username:snapshot.username};
  }
  async revalidate(token:string,identity:Identity,roomId:string){
    const current=await this.authenticate(token);
    if(current.userId!==identity.userId)return false;
    const snapshot=await this.#snapshot(identity.userId,roomId);
    return snapshot.revision===this.#rooms.get(roomId)?.grid.revision;
  }
}
