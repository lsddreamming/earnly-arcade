// Operator-only. Supply credentials through the process environment, never arguments.
const [action,id]=process.argv.slice(2);
if(!['queue','remove','suspend','restore','prune'].includes(action))throw new Error('Usage: node scripts/world-moderate.mjs queue|remove|suspend|restore|prune [ID]');
if(!['queue','prune'].includes(action)&&!/^[0-9a-f-]{36}$/i.test(id||''))throw new Error('An item or player UUID is required');
const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY}=process.env;
if(!SUPABASE_URL?.startsWith('https://')||!SUPABASE_SERVICE_ROLE_KEY)throw new Error('Server credentials required in environment');
const response=await fetch(new URL('/rest/v1/rpc/world_moderate',SUPABASE_URL),{method:'POST',headers:{apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_id:id||null,p_hours:24}),signal:AbortSignal.timeout(10000)});
if(!response.ok)throw new Error('Moderation request failed');
console.log(JSON.stringify(await response.json(),null,2));
