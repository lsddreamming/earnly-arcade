// Camera clearance uses the full sight line, including the position after smoothing.
// Keep the near plane inside the arena gates and away from the pylon caps.
export const CAMERA_BOUND=18.65;
export function clipCamera(target,candidate,obstacles){
 const dx=candidate.x-target.x,dy=candidate.y-target.y,dz=candidate.z-target.z;
 const horizontal=dx*dx+dz*dz,length=Math.hypot(dx,dy,dz);let fraction=1;
 if(horizontal>1e-10){
  const b=target.x*dx+target.z*dz,c=target.x*target.x+target.z*target.z-CAMERA_BOUND*CAMERA_BOUND;
  const exit=(-b+Math.sqrt(Math.max(0,b*b-horizontal*c)))/horizontal;
  fraction=Math.min(fraction,Math.max(0,exit));
 }
 for(const o of obstacles){
  const x=target.x-o.x,z=target.z-o.z,r=o.r+.4,c=x*x+z*z-r*r;
  let enter=-Infinity,exit=Infinity;
  if(horizontal<1e-10){if(c>0)continue;}else{
   const b=x*dx+z*dz,disc=b*b-horizontal*c;if(disc<0)continue;
   enter=(-b-Math.sqrt(disc))/horizontal;exit=(-b+Math.sqrt(disc))/horizontal;
  }
  if(Math.abs(dy)<1e-10){if(target.y<0||target.y>4.5)continue;}else{
   const a=-target.y/dy,b=(4.5-target.y)/dy;enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
  }
  if(Math.max(0,enter)<=Math.min(1,exit))fraction=Math.min(fraction,Math.max(0,enter-.12/(length||1)));
 }
 return {x:target.x+dx*fraction,y:target.y+dy*fraction,z:target.z+dz*fraction};
}
export function clearCamera(target,candidate,obstacles){
 const safe=clipCamera(target,candidate,obstacles);
 // At close quarters, look down from above the robot instead of squeezing into it.
 return Math.hypot(safe.x-target.x,safe.y-target.y,safe.z-target.z)<1.8
  ?{x:target.x,y:target.y+5,z:target.z}:safe;
}
export function followCamera(target,desired,previous,dt,obstacles){
 const goal=clearCamera(target,desired,obstacles),a=Math.max(.08,1-Math.exp(-Math.max(0,dt)*14));
 return clearCamera(target,{x:previous.x+(goal.x-previous.x)*a,y:previous.y+(goal.y-previous.y)*a,z:previous.z+(goal.z-previous.z)*a},obstacles);
}
