const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function harness({remote,known,local={points:'100'},error=null}={}){
 const storage=new Map([['earnlyLocalProgressOwner','player'],['arcadeCloudAutoSync','off']]);
 if(known)storage.set('arcadeLastCloudSave',known);
 storage.set('arcadeCloudConflict',JSON.stringify({reason:'old-warning'}));
 const events=[],writes=[];let reads=0,owner='player';
 const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
 const client={auth:{getSession:async()=>({data:{session:{user:{id:owner}}}}),onAuthStateChange(){}},from:table=>({select(){return this},eq(){return this},maybeSingle:async()=>{reads++;return {data:remote,error}},upsert(data){writes.push({table,data});return this},single:async()=>({data:{updated_at:'2026-11-03T12:00:00Z',device_id:'local'}})})};
 const window={supabase:{createClient:()=>client},dispatchEvent:e=>events.push(e.type),addEventListener(){}};
 const Arcade={deviceId:()=> 'local',snapshotData:()=>({app:'Earnly Arcade',schemaVersion:1,data:{...local}}),appStatus:()=>({deviceId:'local',version:'test'}),pendingSyncEvents:()=>[],clearSyncEvents(){},syncStatus:()=>({pending:0})};
 const context={window,Arcade,localStorage,sessionStorage:localStorage,URLSearchParams,location:{search:'',hash:'',pathname:'/account.html'},navigator:{onLine:true},document:{addEventListener(){}},CustomEvent:class{constructor(type){this.type=type}},setTimeout(){},clearTimeout(){},console};
 vm.runInNewContext(fs.readFileSync('cloud.js','utf8'),context);
 return {api:window.EarnlyCloud,storage,events,writes,local,reads:()=>reads,changeOwner:()=>{owner='other';storage.set('earnlyLocalProgressOwner','other')}};
}
const newer={updated_at:'2026-11-03T10:00:00Z',device_id:'other-browser',payload:{app:'Earnly Arcade',schemaVersion:1,data:{points:'100'}}};
test('known save from another browser does not prompt or restore local progress',async()=>{
 const h=harness({remote:newer,known:newer.updated_at,local:{points:'105'}});
 assert.equal(await h.api.checkSaveConflict(),null);assert.equal(h.storage.has('arcadeCloudConflict'),false);assert.equal(h.local.points,'105');assert.equal(h.reads(),1);assert.equal(h.writes.length,0);
});
test('identical data under a new browser ID resolves automatically without writing either copy',async()=>{
 const h=harness({remote:newer});assert.equal(await h.api.checkSaveConflict(),null);assert.equal(h.storage.get('arcadeLastCloudSave'),newer.updated_at);assert.equal(h.storage.has('arcadeCloudConflict'),false);assert.equal(h.writes.length,0);assert.equal(h.events.filter(x=>x==='earnly-cloud-conflict-cleared').length,1);
});
test('genuinely different progress stays protected and repeated checks do not loop events',async()=>{
 const h=harness({remote:newer,local:{points:'120'}});assert.ok(await h.api.checkSaveConflict());assert.ok(await h.api.checkSaveConflict());assert.equal(h.events.filter(x=>x==='earnly-cloud-conflict').length,1);assert.equal(h.local.points,'120');assert.equal(h.writes.length,0);
 await assert.rejects(h.api.saveProgress({skipRewardSync:true}),e=>e.code==='EARNLY_CLOUD_CONFLICT');assert.equal(h.writes.length,0);
});
test('same-browser stale warning clears and unchanged save does not leave a warning',async()=>{
 const h=harness({remote:{...newer,device_id:'local'}});await h.api.saveProgress({skipRewardSync:true});h.storage.set('arcadeCloudConflict','{"reason":"stale"}');
 const r=await h.api.saveProgress({skipRewardSync:true,skipIfUnchanged:true});assert.equal(r.skipped,'unchanged');assert.equal(h.storage.has('arcadeCloudConflict'),false);
});
test('network errors preserve unresolved warnings and both copies',async()=>{
 const h=harness({remote:newer,error:new Error('offline')});await assert.rejects(h.api.checkSaveConflict(),/offline/);assert.equal(h.storage.has('arcadeCloudConflict'),true);assert.equal(h.writes.length,0);
});
test('missing or malformed remote payload cannot be treated as an identical save',async()=>{
 for(const payload of [null,{app:'wrong',data:{points:'100'}},{app:'Earnly Arcade',data:{}}]){const h=harness({remote:{...newer,payload}});assert.ok(await h.api.checkSaveConflict());assert.equal(h.writes.length,0);}
});
