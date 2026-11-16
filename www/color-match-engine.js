(function(root,factory){const engine=factory();if(typeof module==='object'&&module.exports)module.exports=engine;else root.ColorMatchEngine=engine})(typeof globalThis==='object'?globalThis:this,()=>{
  const colors=[['RED','#ff637d'],['BLUE','#58a6ff'],['GREEN','#58e0ae'],['YELLOW','#ffcf5c']];
  const stages=[{at:0,name:'Focus',next:8},{at:8,name:'Flow',next:18},{at:18,name:'Overdrive',next:30},{at:30,name:'Prism',next:null}];
  function stage(score){return stages.filter(s=>score>=s.at).at(-1)||stages[0]}
  function nextRound(previous=null,score=0,random=Math.random){
    const pick=list=>list[Math.min(list.length-1,Math.max(0,Math.floor((Number(random())||0)*list.length)))];
    const eligible=colors.filter(c=>!previous||previous.inkRun<2||c[0]!==previous.ink);
    const ink=pick(eligible);
    const conflict=score>=8 || random()<.7;
    let words=colors.filter(c=>(!conflict||c[0]!==ink[0])&&(!previous||ink[0]!==previous.ink||c[0]!==previous.word));
    if(!words.length)words=colors.filter(c=>c[0]!==ink[0]);
    const word=pick(words)[0];
    const choices=colors.map(c=>[...c]);
    for(let i=choices.length-1;i>0;i--){const selected=pick(Array.from({length:i+1},(_,n)=>n));[choices[i],choices[selected]]=[choices[selected],choices[i]]}
    let position=choices.findIndex(c=>c[0]===ink[0]);
    if(previous?.positionRun>=2&&position===previous.position){const other=(position+1)%4;[choices[position],choices[other]]=[choices[other],choices[position]];position=other}
    return {ink:ink[0],hex:ink[1],word,choices,position,inkRun:previous?.ink===ink[0]?previous.inkRun+1:1,positionRun:previous?.position===position?previous.positionRun+1:1,stage:stage(score)};
  }
  return {colors,stages,stage,nextRound};
});
