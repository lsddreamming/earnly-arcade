(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.TowerStackEngine=value})(typeof globalThis==='object'?globalThis:this,()=>{
  const speedFor=floors=>Math.min(6.3,2.6+Math.max(0,floors)*.09);
  function placement(previous,moving){
    const left=Math.max(previous.x,moving.x),right=Math.min(previous.x+previous.w,moving.x+moving.w);
    if(right<=left)return {miss:true};
    if(Math.abs(moving.x-previous.x)<=5)return {miss:false,perfect:true,x:previous.x,w:previous.w,cut:null};
    const cut=moving.x<previous.x?{x:moving.x,w:left-moving.x}:{x:right,w:moving.x+moving.w-right};
    return {miss:false,perfect:false,x:left,w:right-left,cut};
  }
  function advance(x,width,viewWidth,direction,speed,dt){
    const distance=speed*Math.max(0,dt)/(1000/60),cycle=viewWidth+width;
    return ((x+width+distance*direction)%cycle+cycle)%cycle-width;
  }
  const districts=[{at:0,name:'Harbor Lights',next:10,sky:'#142c48',accent:'#62dacf'},{at:10,name:'City Rise',next:25,sky:'#252655',accent:'#9d9aff'},{at:25,name:'Cloudline',next:50,sky:'#193d58',accent:'#70d9ff'},{at:50,name:'Stratosphere',next:100,sky:'#3b2255',accent:'#f2a8ec'},{at:100,name:'Orbit',next:null,sky:'#101c3d',accent:'#ffda83'}];
  function district(floors){return districts.filter(d=>floors>=d.at).at(-1)||districts[0]}
  return {placement,advance,speedFor,district,districts};
});
