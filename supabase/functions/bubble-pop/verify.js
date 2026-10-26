/* Replay only server-issued seeds; never trust client scores, stars or goals. */
(function(root){
 function verifyRound(round,steps){
  if(!Array.isArray(steps)||steps.length<1||steps.length>40)throw Error('INVALID_STEPS');
  const E=root.BubblePopEngine,g=E.create(E.seededRandom(Number(round.seed)),round.level);
  for(let i=0;i<steps.length;i++){
   const step=steps[i];
   if(step==='assist'&&i===0){g.assist();continue;}
   if(!Array.isArray(step)||step.length!==2||!step.every(Number.isInteger)||!g.swap(...step).valid)throw Error('INVALID_STEPS');
  }
  const s=g.state();if(s.status!=='won')throw Error('LEVEL_NOT_WON');
  return {stars:s.moves>=8?3:s.moves>=3?2:1,turns:steps.filter(Array.isArray).length};
 }
 root.BubblePopVerify=verifyRound;if(typeof module!=='undefined')module.exports=verifyRound;
})(globalThis);
