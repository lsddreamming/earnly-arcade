import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {worldFixture} from './world-test-fixture.mjs';
const f=await worldFixture();
try{
 await f.db.exec(await readFile(new URL('../supabase/migrations/20261029180854_world_ai_budget.sql',import.meta.url),'utf8'));
 const reserve=async(d=1,m=10)=>(await f.db.query('select public.world_ai_reserve($1,$2) ok',[d,m])).rows[0].ok;
 assert.equal(await reserve(0,10),false);assert.equal(await reserve(2,10),false);assert.equal(await reserve(null,10),false);
 assert.equal(await reserve(.004,10),true);assert.equal(await reserve(.004,10),true);assert.equal(await reserve(.004,10),false);
 assert.equal(await reserve(1,.004),false,'monthly cap independent of daily limit');
 // A new server uses the same persisted rows; no process reset can clear spent reservations.
 assert.equal((await f.db.query("select reserved_usd from earnly_world.ai_budget where bucket like 'day:%'")).rows[0].reserved_usd,'0.004000');
 for(let i=0;i<10;i++)assert.equal(await reserve(),true);assert.equal(await reserve(),false,'12/min database-wide');
 await f.db.exec('set role authenticated');await assert.rejects(reserve(),/permission denied/);await assert.rejects(f.db.query('select * from earnly_world.ai_budget'),/permission denied/);await f.db.exec('reset role');
 await f.db.exec('set role service_role');assert.equal(await reserve(),false);await f.db.exec('reset role');
 const permissions=(await f.db.query("select has_function_privilege('anon','public.world_ai_reserve(numeric,numeric)','EXECUTE') anon,has_function_privilege('authenticated','public.world_ai_reserve(numeric,numeric)','EXECUTE') authenticated,has_function_privilege('service_role','public.world_ai_reserve(numeric,numeric)','EXECUTE') service")).rows[0];assert.deepEqual(permissions,{anon:false,authenticated:false,service:true});
 await f.db.exec(await readFile(new URL('../supabase/migrations/20261029203632_world_ai_budget_fallback.sql',import.meta.url),'utf8'));
 const status=async(d=1,m=10)=>(await f.db.query('select public.world_ai_reserve_status($1,$2) status',[d,m])).rows[0].status;
 assert.equal(await status(),'rate_limit');
 await f.db.exec("delete from earnly_world.ai_budget where bucket like 'minute:%'");
 assert.equal(await status(0,10),'disabled');
 assert.equal(await status(.024,10),'daily_limit');
 assert.equal(await status(1,.024),'monthly_limit');
 assert.equal((await f.db.query("select reserved_usd from earnly_world.ai_budget where bucket like 'day:%'")).rows[0].reserved_usd,'0.024000','scripts spend no reserved allowance');
 assert.equal(await status(),'reserved');
 for(let i=0;i<9;i++)assert.equal(await status(.024,10),'daily_limit');
 assert.equal(await status(.024,10),'rate_limit','scripts share the database-wide rate cap');
 await f.db.exec("delete from earnly_world.ai_budget where bucket like 'minute:%'; update earnly_world.ai_budget set bucket='day:2000-01-01' where bucket like 'day:%'");
 assert.equal(await status(.024,10),'reserved','new UTC day resumes AI with monthly allowance intact');
 const roles=(await f.db.query("select has_function_privilege('anon','public.world_ai_reserve_status(numeric,numeric)','EXECUTE') anon,has_function_privilege('authenticated','public.world_ai_reserve_status(numeric,numeric)','EXECUTE') authenticated,has_function_privilege('service_role','public.world_ai_reserve_status(numeric,numeric)','EXECUTE') service")).rows[0];assert.deepEqual(roles,{anon:false,authenticated:false,service:true});
 console.log('AI budget: persistent day/month caps, shared rate limit, fail-closed configuration and role isolation passed');
}finally{await f.close();}
