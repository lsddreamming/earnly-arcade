// One permanent studio serves every arcade location. Times are seconds of staffed work.
const studioJobs = [
  {room:'App Workshop', role:'Developer', sign:'BUILD', color:'#42beab', cost:450, time:90, goal:15},
  {room:'Test Lab', role:'QA tester', sign:'TEST', color:'#699dec', cost:1250, time:120, goal:4},
  {room:'Ad Sales', role:'Account executive', sign:'SELL', color:'#ee9962', cost:2800, time:180, goal:6}
];
function studioSave(value = {}) {
  const safe = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
  return {rooms:Math.min(3,safe(value?.rooms)), work:studioJobs.map((_,i)=>safe(value?.work?.[i])),
    stock:studioJobs.map((_,i)=>Math.min(40,safe(value?.stock?.[i]))), deals:safe(value?.deals)};
}
// Each second can finish one step per department. Unfinished work stays on its bench.
function staffStudio(studio,seconds) {
  const before=studio.deals;
  for(let tick=0;tick<seconds;tick++){
    for(let i=studio.rooms-1;i>=0;i--){
      if(i<2 && studio.stock[i]>=40 || i>0 && !studio.stock[i-1]) continue;
      if(++studio.work[i]<studioJobs[i].time) continue;
      studio.work[i]=0;
      if(i>0) studio.stock[i-1]--;
      if(i===2) studio.deals++;
      else studio.stock[i]++;
    }
  }
  return studio.deals-before;
}
