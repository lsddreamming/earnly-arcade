(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ArcadePolish=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function bag(random=Math.random){const items=[0,1,2,3,4,5,6];for(let i=6;i>0;i--){const n=Number(random());const j=Math.min(i,Math.max(0,Math.floor((Number.isFinite(n)?n:0)*(i+1))));[items[i],items[j]]=[items[j],items[i]]}return items}
  function rallySpeed(speed){return Math.min(18,Math.max(1,speed)*1.045)}
  // Reflect the connected maze while retaining the four corner spawn tiles.
  function sectorMap(base,sector){const variant=(Math.max(1,sector)-1)%4;let rows=base.slice();if(variant&1)rows=rows.map(row=>[...row].reverse().join(''));if(variant&2)rows.reverse();return rows}
  return {bag,rallySpeed,sectorMap};
});
