// Apple sandbox transactions belong only in the existing isolated sandbox project.
import {readFileSync,writeFileSync} from 'node:fs';
const project='wphqfogbnpdsfkquvdsu';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
let runtime=read('supabase/functions/_shared/apple-runtime.ts');
runtime=runtime.replace("const db=createClient",`if(Deno.env.get('SUPABASE_URL')!=='https://${project}.supabase.co')throw new Error('STAGING_PROJECT_REQUIRED');\nconst db=createClient`).replaceAll('Environment.PRODUCTION','Environment.SANDBOX');
runtime=runtime.replace('return error?null:data.user;',"if(error||!data.user||data.user.is_anonymous)return null;const {error:walletError}=await db.from('coin_wallets').upsert({user_id:data.user.id},{onConflict:'user_id',ignoreDuplicates:true});if(walletError)throw walletError;return data.user;");
const commerce=read('supabase/functions/_shared/apple-commerce.ts').replace("t.environment!=='Production'","t.environment!=='Sandbox'");
const sql=read('supabase/migrations/20261012144324_apple_coin_purchases.sql').replace("p_environment IS DISTINCT FROM 'Production'","p_environment IS DISTINCT FROM 'Sandbox'");
writeFileSync('/tmp/earnly-apple-staging.json',JSON.stringify({project,sql,files:[{name:'apple-coins/index.ts',content:read('supabase/functions/apple-coins/index.ts').replace('apple-review-runtime.ts','apple-runtime.ts')},{name:'_shared/apple-runtime.ts',content:runtime},{name:'_shared/pass-commerce.ts',content:read('supabase/functions/_shared/pass-commerce.ts').replace("t.environment!=='Production'","t.environment!=='Sandbox'")},{name:'_shared/apple-commerce.ts',content:commerce},{name:'_shared/apple-x509-compat.ts',content:read('supabase/functions/_shared/apple-x509-compat.ts')}]}));
console.log('Built Apple sandbox bundle for '+project+'; production wallet is never used.');
