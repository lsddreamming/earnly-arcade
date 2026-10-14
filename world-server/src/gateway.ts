import type { Server, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomRuntime } from './room-runtime.ts';
import type { Identity } from './room-runtime.ts';
import type { XY } from './grid.ts';
import {WorldAccessError} from './access-error.ts';

export interface WorldAccess {
  /** Verify signature/session expiry AND current account eligibility. Never decode-only. */
  authenticate(token:string):Promise<Identity>;
  /** Check room permissions and return the one authoritative runtime for this room. */
  enter(identity:Identity,roomId:string):Promise<{room:RoomRuntime;spawn:XY;username?:string;roomId?:string;equipped?:Record<string,unknown>;scene?:unknown;bootstrap?:unknown}>;
  perform?(identity:Identity,roomId:string,action:string,data:Record<string,unknown>):Promise<{data:unknown;deliveries?:{userIds:string[];roomId?:string;packet:Record<string,unknown>}[]}>;
  /** Recheck account bans, session validity and room permissions for active sockets. */
  revalidate(token:string,identity:Identity,roomId:string):Promise<boolean>;
}
/** JSON v1 transport for the first single-worker deployment. TLS terminates at the
 * HTTPS server or trusted reverse proxy. Do not expose a plaintext listener publicly.
 * All actions are routed through the authenticated session and server adapters.
 */
type GatewayOptions={joinTimeoutMs?:number;admissionTimeoutMs?:number;diagnostic?:(event:{event:string;stage:string;reason?:string})=>void};
export function attachWorldGateway(server:Server,access:WorldAccess,origins:ReadonlySet<string>,options:GatewayOptions={}){
  if(!origins.size)throw new Error('An explicit origin allowlist is required');
  const wss=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});
  const active=new Map<WebSocket,{token:string;identity:Identity;roomId:string;room:RoomRuntime;checking:boolean;alive:boolean}>();
  const reservations=new Set<string>();
  const upgrade=(request:IncomingMessage,socket:Duplex,head:Buffer)=>{
    if(request.url!=='/world'||!origins.has(request.headers.origin??'')||wss.clients.size>=200){socket.destroy();return;}
    wss.handleUpgrade(request,socket,head,ws=>wss.emit('connection',ws,request));
  };
  server.on('upgrade',upgrade);
  wss.on('connection',ws=>{
    let authenticating=false,joined=false,busy=false,operations=0,windowStart=performance.now(),count=0;
    let stage='awaiting_join';
    const diagnose=(event:string)=>options.diagnostic?.({event,stage});
    const expire=()=>{diagnose('world_entry_timeout');ws.close(1013,'Room loading timed out');};
    let deadline=setTimeout(expire,options.joinTimeoutMs??5000);
    const send=(packet:Record<string,unknown>)=>{
      if(ws.readyState!==WebSocket.OPEN)return;
      if(ws.bufferedAmount>128*1024){ws.terminate();return;}
      ws.send(JSON.stringify(packet),error=>{if(error)ws.terminate();});
    };
    ws.on('error',()=>ws.terminate());
    ws.on('pong',()=>{const s=active.get(ws);if(s)s.alive=true;});
    ws.on('close',()=>{
      clearTimeout(deadline);const s=active.get(ws);
      if(s){active.delete(ws);reservations.delete(s.identity.userId);s.room.leave(s.identity.userId);}
    });
    ws.on('message',async(data,binary)=>{
      const now=performance.now();
      if(now-windowStart>=1000){windowStart=now;count=0;operations=0;}
      if(++count>20||binary){ws.close(1008,'Invalid traffic');return;}
      let p:Record<string,unknown>;
      try{p=JSON.parse(data.toString());if(!p||typeof p!=='object'||Array.isArray(p))throw new Error();}
      catch{ws.close(1008,'Invalid packet');return;}
      if(!joined){
        if(authenticating||p.type!=='JOIN'||p.version!==1||typeof p.token!=='string'||p.token.length<1||p.token.length>6000||typeof p.roomId!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(p.roomId)||Object.keys(p).some(k=>!['type','version','token','roomId'].includes(k))){ws.close(1008,'Invalid join');return;}
        authenticating=true;
        // A prompt JOIN is required, but authentication plus bootstrap and snapshot
        // can each take up to four seconds. Give those bounded requests their own budget.
        clearTimeout(deadline);deadline=setTimeout(expire,options.admissionTimeoutMs??15000);
        stage='authentication';
        let reserved:string|undefined;
        try{
          const identity=await access.authenticate(p.token);
          if(ws.readyState!==WebSocket.OPEN)return;
          if(reservations.has(identity.userId))throw new Error('Already connected');
          reserved=identity.userId;reservations.add(reserved);
          stage='room_loading';
          const {room,spawn,username,roomId,equipped,scene,bootstrap}=await access.enter(identity,p.roomId);
          const resolvedIdentity={...identity,username:username??identity.username,equipped};
          if(ws.readyState!==WebSocket.OPEN){reservations.delete(reserved);return;}
          // Register before join so a close caused by backpressure releases membership.
          active.set(ws,{token:p.token,identity:resolvedIdentity,roomId:roomId??p.roomId,room,checking:false,alive:true});
          room.join(resolvedIdentity,spawn,send);joined=true;clearTimeout(deadline);
          if(scene)send({type:'WELCOME',userId:identity.userId,roomId:roomId??p.roomId,scene,bootstrap});
          stage='admitted';diagnose('world_entry_ready');
        }catch(error){
          const reason=error instanceof WorldAccessError?error.reason:undefined;
          options.diagnostic?.({event:'world_entry_denied',stage,...(reason?{reason}:{})});
          if(reserved)reservations.delete(reserved);
          active.delete(ws);
          if(reason==='server_configuration')ws.close(1011,'World service configuration');
          else if(reason==='sign_in_required')ws.close(4001,'Sign in required');
          else if(reason==='confirmed_account_required')ws.close(4003,'Confirmed account required');
          else ws.close(1008,'Entry denied');
        }
        return;
      }
      const session=active.get(ws);
      if(!session||session.checking)return;
      if(p.type==='MOVE_TO'||p.type==='INTERACT')session.room.receive(session.identity.userId,p,now);
      else if(p.type==='ACTION'&&access.perform){
        if(typeof p.requestId!=='string'||p.requestId.length>64||typeof p.action!=='string'||!p.data||typeof p.data!=='object'||Array.isArray(p.data)){ws.close(1008,'Invalid action');return;}
        if(busy||++operations>5){send({type:'RESULT',requestId:p.requestId,error:'Please wait for the current action'});return;}
        busy=true;
        try{
          const result=await access.perform(session.identity,session.roomId,p.action,p.data as Record<string,unknown>);
          send({type:'RESULT',requestId:p.requestId,data:result.data});
          for(const delivery of result.deliveries??[])for(const [peer,binding] of active){
            if((delivery.roomId&&binding.roomId!==delivery.roomId)||!delivery.userIds.includes(binding.identity.userId)||peer.readyState!==WebSocket.OPEN)continue;
            if(peer.bufferedAmount>128*1024){peer.terminate();continue;}
            peer.send(JSON.stringify(delivery.packet),error=>{if(error)peer.terminate();});
          }
        }catch(error){send({type:'RESULT',requestId:p.requestId,error:error instanceof Error?error.message:'Action unavailable',definite:!!(error&&typeof error==='object'&&'definite' in error&&error.definite===true)});}
        finally{busy=false;}
      }else send({type:'ERROR',code:'UNSUPPORTED_INTENT'});
    });
  });
  const ticks=setInterval(()=>{
    for(const room of new Set([...active.values()].map(s=>s.room)))room.tick();
  },250);
  const heartbeat=setInterval(()=>{
    for(const [ws,s] of active){
      if(!s.alive){ws.terminate();continue;}
      s.alive=false;ws.ping();
      if(s.checking)continue;
      s.checking=true;
      void Promise.race([access.revalidate(s.token,s.identity,s.roomId),new Promise<boolean>(resolve=>{const timer=setTimeout(()=>resolve(false),10000);timer.unref();})])
        .then(ok=>{if(!ok)ws.close(1008,'Session expired');})
        .catch(()=>ws.close(1011,'Session unavailable'))
        .finally(()=>{s.checking=false;});
    }
  },15000);
  return {close:async()=>{
    clearInterval(ticks);clearInterval(heartbeat);server.off('upgrade',upgrade);
    for(const ws of wss.clients)ws.terminate();
    await new Promise<void>(resolve=>wss.close(()=>resolve()));
  }};
}
