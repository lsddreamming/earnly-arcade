(function(root){
 'use strict';
 const E=typeof module==='object'?require('./engine.js'):root.MetalMayhem;
 const upgrades=['edge','tempo','armor','speed','dodge','regen','force','repair','pulse'];
 function verify(round,steps){
  if(!Array.isArray(steps)||steps.length<1||steps.length>900)throw Error('INVALID_STEPS');
  const s=round.snapshot?E.restore(round.snapshot):E.create(Number(round.seed)),before=s.tick;
  for(const v of steps){
   if(!Array.isArray(v)||v.length!==5||!v.every(Number.isInteger)||Math.abs(v[0])>1000||Math.abs(v[1])>1000||Math.abs(v[2])>3142||v[3]<0||v[3]>15||v[4]<0||v[4]>9||s.phase==='dead')throw Error('INVALID_STEPS');
   const upgrade=v[4]?upgrades[v[4]-1]:null;
   if(s.phase==='upgrade'?!upgrade||!s.choices.includes(upgrade):upgrade)throw Error('INVALID_STEPS');
   E.step(s,{x:v[0]/1000,z:v[1]/1000,yaw:v[2]/1000,attack:!!(v[3]&1),block:!!(v[3]&2),jump:!!(v[3]&4),dodge:!!(v[3]&8),upgrade});
  }
  if(!Number.isSafeInteger(s.score)||s.score<0||s.score>2147483647||s.tick>1000000000)throw Error('INVALID_RUN');
  return {snapshot:E.snapshot(s),ticks:s.tick-before,score:s.score,wave:s.wave,kills:s.kills,time:s.time,finished:s.phase==='dead'};
 }
 if(typeof module==='object')module.exports=verify;else root.MetalMayhemVerify=verify;
})(globalThis);
