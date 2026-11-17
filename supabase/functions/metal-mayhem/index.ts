import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import {handleMetalMayhem} from './handler.ts';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(req=>handleMetalMayhem(req,db,Deno.env.get('METAL_MAYHEM_ENABLED')==='1'));
