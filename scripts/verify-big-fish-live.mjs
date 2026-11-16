// Read-only live endpoint boundary checks: never authenticate or mint rewards.
const endpoint='https://zdwziebtbpuolusztede.supabase.co/functions/v1/big-fish-energy';
for(const [action,body,status] of [
 ['list',{action:'list'},200],
 ['start',{action:'start',mode:'endless'},401],
 ['checkpoint',{action:'checkpoint',id:'00000000-0000-4000-8000-000000000000',sequence:0,steps:[[0,0,0]]},401]
]){
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 const data=await response.json();
 if(response.status!==status)throw Error(action+' returned '+response.status+', expected '+status);
 if(action==='list'&&!Array.isArray(data.entries))throw Error('Missing verified leaderboard entries');
 if(action!=='list'&&data.error!=='SIGN_IN_REQUIRED')throw Error('Unsigned run was not rejected');
 console.log('Verified Big Fish '+action+' boundary: '+status);
}
