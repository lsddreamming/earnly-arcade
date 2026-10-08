import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
const sql=readFileSync(new URL('../supabase/migrations/20261008180805_jungle_hopper_gold_rewards.sql',import.meta.url),'utf8');
const oldBranch=sql.match(/\$old\$([\s\S]*?)\$old\$/)[1];
const db=new PGlite();
// Baseline harness uses the old production branch and parameter clamps. The
// migration must update that branch in place and preserve neighboring games.
await db.exec(`CREATE FUNCTION public.claim_coin_reward(p_event_id text,p_kind text,p_game text,p_metric integer,p_aux integer,p_challenge_id text,p_source text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_metric integer:=greatest(0,least(coalesce(p_metric,0),10000)); v_aux integer:=greatest(0,least(coalesce(p_aux,0),10000)); v_amount integer;
BEGIN CASE p_game
${oldBranch}
WHEN 'sentinel' THEN v_amount:=17;
ELSE RAISE EXCEPTION 'Unknown game'; END CASE;
RETURN jsonb_build_object('amount',v_amount,'aux',v_aux);END;$$;`);
await db.exec(sql);await db.exec(sql); // safe retry
let count=0;
for(const metric of [0,1,2,4,5,9,10,19,20,29,30,100,10000]) {
  for(const aux of [null,-1,0,1,2,6,25,9999]) {
    const result=(await db.query("SELECT claim_coin_reward('test','game','jungleHopper',$1,$2,null,null) AS r",[metric,aux])).rows[0].r;
    const bounded=Math.min(Math.max(0,aux??0),Math.floor((metric+1)/2)+Math.floor((metric+1)/6),25);
    const base=Math.floor(metric/2)+(metric>=10?2:0)+(metric>=20?3:0)+(metric>=30?5:0);
    assert.equal(result.amount,Math.min(base+bounded,25));assert.equal(result.aux,bounded);count++;
  }
}
assert.equal((await db.query("SELECT claim_coin_reward('test','game','sentinel',0,0,null,null) AS r")).rows[0].r.amount,17);
await db.close();console.log(`PASS: ${count} gold reward cases, neighboring game preserved, migration retry safe`);
