const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const nodes=new Map(),calls=[];let authenticated=true;
const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,textContent:'',value:'',addEventListener(event,fn){this[event]=fn;}});return nodes.get(id);};
const client={auth:{async getSession(){return {data:{session:authenticated?{}:null}};}},async rpc(name,args){calls.push([name,args]);return {data:name==='harbor_live'?{health:100,peers:[{id:'other',x:14,z:43,angle:0,driving:false,health:100}]}:name==='harbor_fire'?{hit:true,killed:true,amount:100,health:0}:args.p_action==='start'?{token:'token',reward:25}:args.p_action==='claim'?{amount:25}:{stage:args.p_stage}};}};
const window={EarnlyCloud:{client},addEventListener(){}};
vm.runInNewContext(fs.readFileSync(__dirname+'/../harbor-online.js','utf8'),{window,document:{getElementById:node},Date,Math,Number,Array,Promise,Error});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 await node('connect-live').click();window.HarborOnline.tick({x:12,z:43,angle:0,free:true,driving:false});await flush();assert.equal(window.HarborOnline.peers().length,1);
 window.HarborOnline.fire(0,0);await flush();assert.match(node('online-status').textContent,/100 Arcade Coins/);
 await node('connect-live').click();assert.equal(window.HarborOnline.peers().length,0);
 window.HarborOnline.start(0);window.HarborOnline.stage(1,12,12);window.HarborOnline.finish();await flush();assert.deepEqual(calls.filter(c=>c[0]==='harbor_mission').map(c=>c[1].p_action),['start','stage','claim']);assert.match(node('online-status').textContent,/25 Arcade Coins/);
 authenticated=false;await node('connect-live').click();assert.equal(node('harbor-login').hidden,false);
 const count=calls.length;window.HarborOnline.start(1);window.HarborOnline.finish();await flush();assert.equal(calls.length,count);console.log('Live connect/disconnect, signed-out login, ordered mission progress, claim and signed-out reward protection passed');
})();
