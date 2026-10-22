import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {worldFixture} from './world-test-fixture.mjs';
const f=await worldFixture(),[owner,other]=f.users;
try{
 const files=await readdir(new URL('../supabase/migrations/',import.meta.url));
 await f.db.exec(await readFile(new URL('../supabase/migrations/'+files.find(n=>n.endsWith('_world_room_rename.sql')),import.meta.url),'utf8'));
 const room=(await f.db.query("select public.world_api($1,'create_room','{\"name\":\"Before\",\"layout\":\"corner\"}') r",[owner])).rows[0].r.roomId;
 const before=(await f.db.query('select * from earnly_world.rooms where id=$1',[room])).rows[0];
 const rename=(actor,name)=>f.db.query('select public.world_rename_room($1,$2,$3) r',[actor,room,name]);
 assert.equal((await rename(owner,'  Shrimpy’s Retreat  ')).rows[0].r.name,'Shrimpy’s Retreat');
 const after=(await f.db.query('select * from earnly_world.rooms where id=$1',[room])).rows[0];
 assert.deepEqual({...after,name:before.name},before);
 await assert.rejects(rename(other,'Stolen'),/Room unavailable/);
 for(const name of ['', ' ', 'a'.repeat(41), 'bad\nname', null])await assert.rejects(rename(owner,name),/Choose a room name/);
 await rename(owner,'A new name');
 const snapshot=(await f.db.query('select public.world_room_snapshot($1,$2) r',[other,room])).rows[0].r;
 assert.equal(snapshot.name,'A new name');
 await f.db.exec('set role authenticated');await assert.rejects(rename(owner,'Impersonated'),/permission denied/);
 console.log('Room rename: repeat edits, persistence, visitor snapshot, owner-only authorization, validation and RPC permissions passed.');
}finally{await f.close();}
