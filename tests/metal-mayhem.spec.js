const{test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){let uid='owner',fail=false,version=2,calls=[];const client={auth:{getSession:async()=>({data:{session:uid?{user:{id:uid}}:null}})},functions:{invoke:async(name,{body})=>{calls.push(body);if(fail){fail=false;return{error:Error('network')};}return {data:body.action==='start'?{id:'round',userId:uid,seed:17,engineVersion:version}:{sequence:body.sequence+1,earned:5,finished:!!body.final,wallet:{balance:'5'}}};}}};let wallets=[];const window={MetalMayhem:{VERSION:2},CrystalSupabase:{createClient:()=>client},Arcade:{applyServerWallet:x=>wallets.push(x)}};vm.runInNewContext(fs.readFileSync('metal-mayhem-rewards.js','utf8'),{window});return {api:window.MetalMayhemRewards,calls,wallets,setUser:x=>uid=x,setVersion:x=>version=x,fail:()=>fail=true};}
test('practice sends no inputs or claims; quantization bounds client input',async()=>{const t=setup(),s=t.api.createSession(null);const v=s.record({x:10,z:-10,yaw:25,attack:1});assert.equal(v.x,1);assert.equal(v.z,-1);assert(Math.abs(v.yaw)<3.142);await s.flush(true);assert.equal(t.calls.length,0);assert.equal(s.status().practice,true);});
test('failed checkpoint preserves inputs and retries the same sequence exactly once',async()=>{const t=setup(),ticket=await t.api.start(),s=t.api.createSession(ticket);s.record({x:1,yaw:.5,attack:true});t.fail();await assert.rejects(s.flush());assert(s.status().error);await s.flush(true);assert.equal(t.calls[1].sequence,0);assert.equal(t.calls[2].sequence,0);assert.deepEqual(t.calls[1].steps,t.calls[2].steps);assert.equal(t.wallets.length,1);assert.equal(s.status().earned,5);await s.flush(true);assert.equal(t.wallets.length,1);});
test('account switching rejects verification before sending or applying a wallet',async()=>{const t=setup(),ticket=await t.api.start(),s=t.api.createSession(ticket);s.record({attack:true});t.setUser('another-owner');await assert.rejects(s.flush(true),/SIGN_IN_REQUIRED/);assert.equal(t.calls.length,1);assert.equal(t.wallets.length,0);});

test('incompatible verifier falls back to practice before recording a run',async()=>{const t=setup();t.setVersion(1);assert.equal(await t.api.start(),null);assert.equal(t.calls[0].engineVersion,2);const s=t.api.createSession(null);s.record({jump:true,attack:true});await s.flush(true);assert.equal(t.calls.length,1);assert.equal(t.wallets.length,0);});

test('Metal Mayhem camera keeps the robot visible during fast wall and pylon turns',async({page},info)=>{
 await open(page);await page.locator('#start').click();await expect(page.locator('#hud')).toBeVisible();
 const failures=await page.evaluate(()=>{
  const s=__metalMayhem.state,v=__metalMayhem.view;s.player.invulnerable=100;s.enemies=[];s.queue=['blade'];s.spawnTimer=100;
  const failures=[];
  for(const [x,z] of [[0,17.7],[17.7,0],[-7,-3.95],[9.05,-6]]){
   s.player.x=x;s.player.z=z;
   for(let i=0;i<24;i++){
    v.render(s,1/60,i*1.3,.4);const c=v.camera.position,t={x,y:s.player.y+1.35,z};
    if(Math.hypot(c.x,c.z)>18.651)failures.push('outside wall');
    for(let j=0;j<=100;j++){const k=j/100,px=x+(c.x-x)*k,py=t.y+(c.y-t.y)*k,pz=z+(c.z-z)*k;if(py<4.2&&MetalMayhem.OBSTACLES.some(o=>Math.hypot(px-o.x,pz-o.z)<1.72))failures.push('blocked by pylon');}
   }
  }
  // The spectator decks must be outside the fighting area, including their inner vertices.
  v.scene.traverse(mesh=>{const attr=mesh.geometry?.attributes?.position;if(!attr)return;for(let i=0;i<attr.count;i++){const p=v.camera.position.clone().fromBufferAttribute(attr,i).applyMatrix4(mesh.matrixWorld),r=Math.hypot(p.x,p.z);if(r>14&&r<20&&p.y>3.3&&p.y<5.3)failures.push('overhanging arena deck');}});
  s.player.x=0;s.player.z=17.7;return failures;
 });
 expect(failures).toEqual([]);await page.screenshot({path:info.outputPath('metal-mayhem-clear-wall-camera.png')});
});
test('Metal Mayhem Jump then Strike starts an overhead attack',async({page})=>{
 await open(page);await page.locator('#start').click();await expect(page.locator('#hud')).toBeVisible();
 await page.evaluate(()=>{__metalMayhem.state.player.cooldown=0;__metalMayhem.state.player.invulnerable=100;});
 await page.keyboard.down('Space');await expect.poll(()=>page.evaluate(()=>__metalMayhem.state.player.y)).toBeGreaterThan(.1);
 await page.mouse.move(180,220);await page.mouse.down();
 await expect.poll(()=>page.evaluate(()=>__metalMayhem.state.player.attack?.mode)).toBe(2);
 expect(await page.evaluate(()=>__metalMayhem.state.player.combo)).toBe(1);
 await page.mouse.up();await page.keyboard.up('Space');await page.locator('#pause').click();
});
