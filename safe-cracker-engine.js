/* Pure timing and fairness rules. Cosmetic precision never changes coin rewards. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SafeCrackerEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const chapters=[{name:'Blue Steel',color:'#71dfff',dark:'#102943'},{name:'Laser Gallery',color:'#b49aff',dark:'#282447'},{name:'Gold Reserve',color:'#ffd685',dark:'#3d2c24'},{name:'Jade Chamber',color:'#80f0c4',dark:'#123c38'},{name:'Core Vault',color:'#ff9ebc',dark:'#3b203c'}];
 function create(score=0,cleared=0,random=Math.random){
  const vault=(cleared+1)%10===0;
  const modes=score<5?['steady']:score<15?['steady','surge']:['steady','surge','pulse'];
  const mode=vault?'vault':modes[Math.floor(random()*modes.length)];
  const initialDir=random()<.5?1:-1,speed=Math.min(290,170+score*1.5)*(vault ? .94 : 1);
  const peak=speed*(mode==='surge'?1.25:mode==='pulse'?1.22:1);
  const width=Math.max(44,96-score*.85,peak*.13)+(vault?6:0);
  let lo=42,hi=318-width;
  if(initialDir>0)lo=Math.max(lo,28+peak*.24);else hi=Math.min(hi,332-peak*.24-width);
  const x=lo+random()*Math.max(0,hi-lo),phase=random()*Math.PI*2;
  const slow=speed*(mode==='surge' ? .8 : mode==='pulse' ? .78 : 1);
  const limit=Math.max(3000,4800-score*20,608/slow*1000+250);
  return {mode,initialDir,speed,width,x,phase,limit,vault,pins:vault?2:1,chapter:Math.floor(cleared/10)+1};
 }
 function distance(c,ms){
  const t=Math.max(0,ms)/1000;
  if(c.mode==='surge')return c.speed*(1.25*t-.45*(1-Math.exp(-t)));
  if(c.mode==='pulse'){const w=2*Math.PI/1.4;return c.speed*(t+.22*(Math.cos(c.phase)-Math.cos(w*t+c.phase))/w);}
  return c.speed*t;
 }
 function sample(c,ms){
  const initial=c.initialDir>0?0:304,path=initial+distance(c,ms),phase=path%608;
  return {marker:28+304-Math.abs(phase-304),dir:phase<304?1:-1,bounces:Math.floor(path/304)-Math.floor(initial/304)};
 }
 function grade(marker,x,width){if(marker<x||marker>x+width)return 'miss';return Math.abs(marker-(x+width/2))<=Math.min(11,width*.15)?'perfect':'clean';}
 function chapter(cleared){return chapters[Math.floor(cleared/10)%chapters.length];}
 return {chapters,create,distance,sample,grade,chapter};
});
