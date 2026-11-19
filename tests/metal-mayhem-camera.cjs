const {test}=require('node:test'),assert=require('node:assert/strict');
const E=require('../metal-mayhem-engine.js');
const camera=import('../metal-mayhem-camera.mjs');
function clear(target,p){
 assert([p.x,p.y,p.z].every(Number.isFinite));assert(Math.hypot(p.x,p.z)<=18.65001);
 assert(Math.hypot(p.x-target.x,p.y-target.y,p.z-target.z)>=1.79);
 // Independently sample the rendered sight line against the visible pylon bodies/caps.
 for(let i=0;i<=200;i++){
  const t=i/200,x=target.x+(p.x-target.x)*t,y=target.y+(p.y-target.y)*t,z=target.z+(p.z-target.z)*t;
  if(y<4.2)for(const o of E.OBSTACLES)assert(Math.hypot(x-o.x,z-o.z)>1.72,'pylon obstructed the robot');
 }
}
test('smoothed camera cannot leave a pylon between the camera and robot',async()=>{
 const {followCamera}=await camera,target={x:-7,y:1.35,z:-3.95};
 const p=followCamera(target,{x:-7,y:4.85,z:2.45},{x:-7,y:3,z:-10},1/60,E.OBSTACLES);clear(target,p);
});
test('fast spins, jumps, and changes of direction stay inside the arena and clear of pylons',async()=>{
 const {followCamera,cameraFraming}=await camera;
 const positions=[[0,17.7],[17.7,0],[0,-17.7],[-17.7,0]];
 for(const o of E.OBSTACLES)for(let a=0;a<8;a++)positions.push([o.x+Math.sin(a*Math.PI/4)*2.05,o.z+Math.cos(a*Math.PI/4)*2.05]);
 for(const [x,z] of positions)for(const h of [0,1.3])for(const mode of ['close','wide','far']){
  const target={x,y:h+1.35,z};let p={x:0,y:6,z:15};
  for(let i=0;i<40;i++){
   const yaw=i*1.7,f=cameraFraming(.46,mode),desired={x:x-Math.sin(yaw)*f.distance,y:target.y+f.height,z:z+Math.cos(yaw)*f.distance};
   p=followCamera(target,desired,p,i%2?1/120:1/15,E.OBSTACLES);clear(target,p);
  }
 }
});
test('camera returns to its normal behind-robot distance in open space',async()=>{
 const {followCamera}=await camera,target={x:0,y:1.35,z:0},desired={x:0,y:4.85,z:6.8};let p={x:0,y:6.35,z:0};
 for(let i=0;i<120;i++)p=followCamera(target,desired,p,1/60,E.OBSTACLES);
 assert(Math.hypot(p.x-desired.x,p.y-desired.y,p.z-desired.z)<.001);
});
