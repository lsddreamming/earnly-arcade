/* Neon Dodger's twenty-second districts. Runs continue until a collision. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DodgerProgression=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 const LEVEL_SECONDS=20;
 const districts=['SIDE STREETS','DOWNTOWN','SWITCHBACKS','NEON EXPRESS','NIGHT GAUNTLET'];
 function progress(seconds){const t=Math.max(0,Number(seconds)||0),level=1+Math.floor(t/LEVEL_SECONDS);return {level,cleared:level-1,remaining:LEVEL_SECONDS-t%LEVEL_SECONDS,fraction:(t%LEVEL_SECONDS)/LEVEL_SECONDS,label:districts[Math.min(4,level-1)],nextUnlock:level<3?'Reach Level 3 · cyan car':level<5?'Reach Level 5 · gold car':'Beat your highest level'};}
 function difficulty(seconds){const p=progress(seconds),ramp=Math.min(1,Math.max(0,seconds)/100);return {level:p.level,label:'LEVEL '+p.level+' · '+p.label,speed:8.2+7.2*ramp,delay:960-340*ramp,pairChance:p.level===1?.8:1,farShiftChance:.4+.35*ramp,blockWidth:48+4*ramp,followUpChance:Math.min(1,.45+(p.level-1)*.25),followUpGapMs:p.level>=4?360:420,thirdRowChance:Math.min(1,.2+(p.level-1)*.3),fourthRowChance:p.level>=4?Math.min(1,.55+(p.level-4)*.25):0};}
 function carColor(bestLevel){return bestLevel>=5?'#ffd76a':bestLevel>=3?'#67e8f9':'#36e57c';}
 return {LEVEL_SECONDS,progress,difficulty,carColor};
});
