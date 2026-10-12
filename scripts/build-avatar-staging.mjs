// Add cosmetics to the existing isolated coin sandbox. Never apply to production.
import {readFileSync,writeFileSync} from 'node:fs';
const project='wphqfogbnpdsfkquvdsu';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
let sql=`
CREATE TABLE public.profiles(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, username text UNIQUE NOT NULL);
CREATE TABLE public.leaderboard_scores(user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,game text,score bigint,achieved_at timestamptz DEFAULT now(),PRIMARY KEY(user_id,game));
CREATE TABLE public.leaderboard_bans(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE public.coin_ledger(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,source_type text,game text);
`;
for(const table of ['profiles','leaderboard_scores','leaderboard_bans','coin_ledger']) sql+=`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY; REVOKE ALL ON public.${table} FROM PUBLIC,anon,authenticated; GRANT ALL ON public.${table} TO service_role;\n`;
for(const name of ['20261007152428_avatar_studio.sql','20261007153231_cosmetic_loadout_ownership_index.sql','20261007162312_mascot_accessory_slots.sql','20261007183740_avatar_atelier.sql','20261008154100_potato_personality.sql','20261012165849_arcade_shop_two.sql'])sql+=read('supabase/migrations/'+name)+'\n';
let runtime=read('supabase/functions/avatars/index.ts');
runtime=runtime.replace('const admin =',`if(url!=='https://${project}.supabase.co')throw new Error('STAGING_PROJECT_REQUIRED');\nconst admin =`)
 .replace('sb_publishable_wnizO81RYGI9LRO2R0Exgg_53T55AxZ','sb_publishable_kyez8nhpp8htaPAdh7Hmfw_5NCyK6RI')
 .replace('const id=auth.user.id;',`const id=auth.user.id;
    // Test accounts get an isolated zero-balance wallet, never a production profile.
    const {error:walletError}=await admin.from('coin_wallets').upsert({user_id:id},{onConflict:'user_id',ignoreDuplicates:true});
    if(walletError)throw walletError;
    const {error:profileError}=await admin.from('profiles').upsert({user_id:id,username:'T_'+id.replaceAll('-','').slice(0,16)},{onConflict:'user_id',ignoreDuplicates:true});
    if(profileError)throw profileError;`);
writeFileSync('/tmp/earnly-avatar-staging.json',JSON.stringify({project,sql,files:[{name:'avatars/index.ts',content:runtime}]}));
console.log('Built isolated cosmetics sandbox for '+project);
