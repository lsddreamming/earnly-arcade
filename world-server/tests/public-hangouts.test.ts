import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HANGOUTS,HANGOUT_FLOOR,hangoutFor} from '../src/public-hangouts.ts';
import {RoomGrid,parseHeightmap} from '../src/grid.ts';
import {RoomRuntime} from '../src/room-runtime.ts';
for(const h of HANGOUTS)test(h.name+' staff stay bounded, separate from players and inventory',()=>{
 const room=new RoomRuntime(new RoomGrid(parseHeightmap(HANGOUT_FLOOR),h.items),40,h.staff);
 const packets:Record<string,unknown>[]=[];
 room.join({userId:'real',username:'Real'},room.availableSpawn(),p=>packets.push(p));
 assert.equal(room.memberCount,1);assert.equal(room.members().length,1);
 assert.equal(room.talkToStaff('real',h.staff[0].id).name,h.staff[0].name);
 assert.throws(()=>room.talkToStaff('real','other-room-staff'));
 assert.throws(()=>room.talkToStaff('absent',h.staff[0].id));
 assert.equal(room.receive(h.staff[0].id,{type:'MOVE_TO',x:11,y:11},1000),false);
 const seen=new Set<string>();
 for(let i=0;i<320;i++){room.tick();for(const s of room.staff()){assert(h.staff[0].path.some(p=>p.x===s.position.x&&p.y===s.position.y));seen.add(JSON.stringify(s.position));}}
 assert.equal(seen.size,h.staff[0].path.length);
 assert.equal(packets.some(p=>p.type==='NPC_SNAPSHOT'),true);
 assert.deepEqual(room.chatViewers('real','shout'),['real']);
 assert.equal(hangoutFor({ownerId:'real',name:h.name}),undefined);
});
test('staff wait instead of walking through a player',()=>{
 const h=HANGOUTS[1],room=new RoomRuntime(new RoomGrid(parseHeightmap(HANGOUT_FLOOR),h.items),40,h.staff);
 room.join({userId:'real',username:'Real'},h.staff[0].path[1],()=>{});
 for(let i=0;i<64;i++)room.tick();
 assert.equal(room.staff()[0].position.x,4);
});
