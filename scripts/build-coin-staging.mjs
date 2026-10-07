// Isolated Stripe sandbox deployment. Never deploy this bundle to production.
import {readFileSync,writeFileSync} from 'node:fs';
const project='wphqfogbnpdsfkquvdsu';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function replaceOnce(source,from,to){if(source.split(from).length!==2)throw new Error('Source changed: '+from);return source.replace(from,to);}
let runtime=read('supabase/functions/_shared/coin-runtime.ts');
runtime=replaceOnce(runtime,'/^(sk|rk)_live_/','/^(sk|rk)_test_/');
runtime=replaceOnce(runtime,"const secret=",`if(Deno.env.get('SUPABASE_URL')!=='https://${project}.supabase.co')throw new Error('STAGING_PROJECT_REQUIRED');\nconst secret=`);
runtime=replaceOnce(runtime,"return error?null:data.user;","if(error||!data.user||data.user.is_anonymous)return null; const {error:walletError}=await db.from('coin_wallets').upsert({user_id:data.user.id},{onConflict:'user_id',ignoreDuplicates:true}); if(walletError)throw walletError; return data.user;");
let commerce=read('supabase/functions/_shared/coin-commerce.ts');
commerce=replaceOnce(commerce,"if(!event.livemode)return json({received:true,credited:false}); // Sandbox payments never mint production coins.","if(event.livemode!==false)return json({received:true,credited:false}); // This isolated ledger accepts sandbox events only.");
commerce=replaceOnce(commerce,"if(!session.livemode)throw new Error('PAYMENT_NOT_LIVE_PAID');","if(session.livemode!==false)throw new Error('SANDBOX_PAYMENT_REQUIRED');");
commerce=replaceOnce(commerce,"if(session.payment_status!=='paid')return null;","if(session.livemode!==false)throw new Error('SANDBOX_PAYMENT_REQUIRED');\n    if(session.payment_status!=='paid')return null;");
// Sandbox returns must never land on the production storefront.
commerce=replaceOnce(commerce,"success_url:'https://earnlyarcade.com/avatars.html?coin_order='+order.id+'#coin-shop',cancel_url:'https://earnlyarcade.com/avatars.html?coin_cancelled=1#coin-shop',","success_url:'https://earnlyarcade.com/coin-sandbox.html?test_order='+order.id,cancel_url:'https://earnlyarcade.com/coin-sandbox.html?cancelled=1',");
commerce=replaceOnce(commerce,"path==='/plays'||","path==='/wallet'||path==='/plays'||");
commerce=replaceOnce(commerce,"if(path==='/plays'&&req.method==='GET') {","if(path==='/wallet'&&req.method==='GET') { const wallet=unwrap(await db.from('coin_wallets').select('balance,lifetime_earned,purchased_balance').eq('user_id',user.id).single()); return json({wallet}); }\n      if(path==='/plays'&&req.method==='GET') {");
let sql=read('supabase/migrations/20261007183756_website_coin_checkout.sql');
sql=replaceOnce(sql,'p_live IS DISTINCT FROM true','p_live IS DISTINCT FROM false');
sql=sql.replaceAll('PAYMENT_NOT_LIVE_PAID','SANDBOX_PAYMENT_REQUIRED');
sql=`CREATE TABLE public.coin_wallets(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, balance bigint NOT NULL DEFAULT 0 CHECK(balance>=0), lifetime_earned bigint NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.coin_wallets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coin_wallets FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.coin_wallets TO service_role;
`+sql;
const files=[{name:'_shared/coin-runtime.ts',content:runtime},{name:'_shared/coin-commerce.ts',content:commerce},...['coin-shop','coin-webhook'].map(name=>({name:name+'/index.ts',content:"import {handler} from '../_shared/coin-runtime.ts';\nDeno.serve(handler);\n"}))];
writeFileSync('/tmp/earnly-coin-staging.json',JSON.stringify({project,files,sql}));
console.log('Built isolated sandbox bundle for '+project);
