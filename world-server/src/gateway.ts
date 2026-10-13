import type { Server, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { RoomRuntime } from './room-runtime.ts';
import type { Identity } from './room-runtime.ts';
import type { XY } from './grid.ts';

export interface WorldAccess {
  /** Verify signature/session expiry AND current account eligibility. Never decode-only. */
  authenticate(token:string):Promise<Identity>;
  /** Check room permissions and return the one authoritative runtime for this room. */
  enter(identity:Identity,roomId:string):Promise<{room:RoomRuntime;spawn:XY;username?:string}>;
  /** Recheck account bans, session validity and room permissions for active sockets. */
  revalidate(token:string,identity:Identity,roomId:string):Promise<boolean>;
}
/** JSON v1 transport for the first single-worker deployment. TLS terminates at the
 * HTTPS server or trusted reverse proxy. Do not expose a plaintext listener publicly.
 * Social/economy intents are deliberately unavailable until their adapters are wired.
 */
export function attachWorldGateway(server:Server,access:WorldAccess,origins:ReadonlySet<string>){
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
    let authenticating=false,joined=false,windowStart=performance.now(),count=0;
    const deadline=setTimeout(()=>ws.terminate(),5000);
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
      if(now-windowStart>=1000){windowStart=now;count=0;}
      if(++count>20||binary){ws.close(1008,'Invalid traffic');return;}
      let p:Record<string,unknown>;
      try{p=JSON.parse(data.toString());if(!p||typeof p!=='object'||Array.isArray(p))throw new Error();}
      catch{ws.close(1008,'Invalid packet');return;}
      if(!joined){
        if(authenticating||p.type!=='JOIN'||p.version!==1||typeof p.token!=='string'||p.token.length<1||p.token.length>6000||typeof p.roomId!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(p.roomId)||Object.keys(p).some(k=>!['type','version','token','roomId'].includes(k))){ws.close(1008,'Invalid join');return;}
        authenticating=true;
        let reserved:string|undefined;
        try{
          const identity=await access.authenticate(p.token);
          if(ws.readyState!==WebSocket.OPEN)return;
          if(reservations.has(identity.userId))throw new Error('Already connected');
          reserved=identity.userId;reservations.add(reserved);
          const {room,spawn,username}=await access.enter(identity,p.roomId);
          const resolvedIdentity={...identity,username:username??identity.username};
          if(ws.readyState!==WebSocket.OPEN){reservations.delete(reserved);return;}
          // Register before join so a close caused by backpressure releases membership.
          active.set(ws,{token:p.token,identity:resolvedIdentity,roomId:p.roomId,room,checking:false,alive:true});
          room.join(resolvedIdentity,spawn,send);joined=true;clearTimeout(deadline);
        }catch{
          if(reserved)reservations.delete(reserved);
          active.delete(ws);ws.close(1008,'Entry denied');
        }
        return;
      }
      const session=active.get(ws);
      if(!session||session.checking)return;
      if(p.type==='MOVE_TO')session.room.receive(session.identity.userId,p,now);
      else send({type:'ERROR',code:'UNSUPPORTED_INTENT'});
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
      void Promise.race([access.revalidate(s.token,s.identity,s.roomId),new Promise<boolean>(resolve=>{const timer=setTimeout(()=>resolve(false),5000);timer.unref();})])
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
