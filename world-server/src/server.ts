import {worldOrigins} from './origins.ts';
import {createServer} from 'node:http';
import {attachWorldGateway} from './gateway.ts';
import {SupabaseWorldAccess} from './supabase-access.ts';

// Bind only loopback. Production needs an HTTPS reverse proxy on the same host.
const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,WORLD_ORIGINS}=process.env;
if(!SUPABASE_URL||!SUPABASE_SERVICE_ROLE_KEY||!WORLD_ORIGINS)throw new Error('World server configuration is incomplete');
const origins=worldOrigins(WORLD_ORIGINS);
const port=Number(process.env.WORLD_PORT??8080);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid port');
const server=createServer((request,response)=>{
 response.setHeader('Cache-Control','no-store');response.setHeader('Content-Type','application/json');
 if(request.url==='/health'){response.writeHead(200);response.end('{"status":"ok"}');}
 else{response.writeHead(404);response.end('{"error":"not_found"}');}
});
const gateway=attachWorldGateway(server,new SupabaseWorldAccess(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY),origins,{
 // Fixed event/stage labels only: never log tokens, account IDs, packets or raw errors.
 diagnostic:event=>console.log(JSON.stringify(event))
});
const host=process.env.WORLD_BIND_HOST??'127.0.0.1';
if(!['127.0.0.1','0.0.0.0'].includes(host))throw new Error('Invalid bind host');
server.listen(port,host,()=>console.log('World server listening'));
let stopping=false;
async function shutdown(){if(stopping)return;stopping=true;await gateway.close();server.close();}
process.on('SIGTERM',()=>void shutdown());process.on('SIGINT',()=>void shutdown());
