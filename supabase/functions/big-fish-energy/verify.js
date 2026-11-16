(function(root){
 'use strict';
 const E=typeof module==='object'&&module.exports?require('./engine.js'):root.BigFishEnergy;
 function verify(round,steps){
  if(!Array.isArray(steps)||steps.length<1||steps.length>1800)throw Error('INVALID_STEPS');
  const g=round.snapshot?E.create({snapshot:round.snapshot}):E.create({seed:Number(round.seed),mode:round.mode});
  for(const v of steps){
   if(!Array.isArray(v)||v.length!==3||!Number.isInteger(v[0])||!Number.isInteger(v[1])||Math.abs(v[0])>1000||Math.abs(v[1])>1000||![0,1].includes(v[2])||g.state.dead||g.state.won)throw Error('INVALID_STEPS');
   g.step(1/30,{x:v[0]/1000,y:v[1]/1000,boost:!!v[2]});
  }
  const s=g.state;
  if(!Number.isFinite(s.player.size)||s.player.size<.3||s.player.size>1e100)throw Error('INVALID_RUN');
  return {snapshot:g.exportState(),ticks:steps.length,size:s.player.size,eaten:s.eaten,time:s.time,finished:s.dead||s.won};
 }
 if(typeof module==='object'&&module.exports)module.exports=verify;else root.BigFishVerify=verify;
})(globalThis);
