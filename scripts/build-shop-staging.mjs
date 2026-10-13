// Explicitly pinned sandbox adapter. Never deploy these files to production.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['scripts/build-apple-staging.mjs']);
execFileSync(process.execPath,['scripts/build-avatar-staging.mjs']);
const apple=JSON.parse(readFileSync('/tmp/earnly-apple-staging.json','utf8'));
const avatar=JSON.parse(readFileSync('/tmp/earnly-avatar-staging.json','utf8'));
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
let pass=read('supabase/functions/_shared/pass-commerce.ts').replace("t.environment!=='Production'","t.environment!=='Sandbox'");
const runtime=read('supabase/functions/arcade-pass/index.ts').replace('_live_','_test_').replace('passHandler({db,stripe,','passHandler({db,stripe,stripeLive:false,').replace("priceId:Deno.env.get('STRIPE_PASS_PRICE_ID')","priceId:'price_1UPqV8DiPv1t7Me2icvDqvHT'");
const common=apple.files.filter(f=>f.name.startsWith('_shared/')&&f.name!=='_shared/pass-commerce.ts');
writeFileSync('/tmp/earnly-shop-staging.json',JSON.stringify({project:apple.project,functions:[
 {name:'apple-coins',files:apple.files},
 {name:'avatars',files:avatar.files},
 {name:'arcade-pass',files:[{name:'arcade-pass/index.ts',content:runtime},...common,{name:'_shared/pass-commerce.ts',content:pass}]}
]}));
console.log('Built Shop 2.0 testing functions for '+apple.project);
