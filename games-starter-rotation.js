/* Games discovery uses a saved shuffle bag: four different picks on each visit,
   every published title shown before any title repeats. Pure logic is shared
   with browser and contract tests; the page owns optional device storage. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GamesStarterRotation=api;
})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  function nextBatch(items,saved,random=Math.random,size=4){
    const ids=[...new Set(items.map(item=>typeof item==='string'?item:item.key).filter(Boolean))];
    const signature=ids.slice().sort().join('|');
    const allowed=new Set(ids),count=Math.min(size,ids.length);
    const previous=Array.isArray(saved?.previous)?saved.previous.filter(id=>allowed.has(id)).slice(0,count):[];
    const valid=saved?.signature===signature&&Array.isArray(saved.remaining)&&
      saved.remaining.every(id=>allowed.has(id))&&
      new Set(saved.remaining).size===saved.remaining.length;
    let remaining=valid?saved.remaining.slice():[];
    const selected=[];
    while(selected.length<count){
      if(!remaining.length){
        remaining=ids.slice();
        for(let i=remaining.length-1;i>0;i--){
          const draw=Number(random()),sample=Number.isFinite(draw)?draw:0;
          const j=Math.min(i,Math.max(0,Math.floor(sample*(i+1))));
          [remaining[i],remaining[j]]=[remaining[j],remaining[i]];
        }
        // The next cycle must not open on the games just displayed.
        const avoid=new Set([...previous,...selected]);
        remaining=[...remaining.filter(id=>!avoid.has(id)),...remaining.filter(id=>avoid.has(id))];
      }
      const next=remaining.findIndex(id=>!selected.includes(id));
      if(next===-1)break;
      selected.push(remaining.splice(next,1)[0]);
    }
    return {selected,state:{signature,remaining,previous:selected}};
  }
  return {nextBatch};
});
