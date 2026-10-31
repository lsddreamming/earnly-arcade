/* Device-local flight goals and cosmetic liveries. Never grants currency. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StarDefenderFlight=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const liveries=[
    {id:'comet',name:'Comet',color:'#62e8ff',accent:'#d5fbff',at:0},
    {id:'solar',name:'Solar',color:'#ffc76b',accent:'#fff0ca',at:20},
    {id:'nova',name:'Nova',color:'#c596ff',accent:'#f0ddff',at:75},
    {id:'jade',name:'Jade',color:'#72f3b8',accent:'#d8ffeb',at:150}
  ];
  const count=x=>Math.max(0,Math.min(10000000,Math.floor(Number(x)||0)));
  function day(date=new Date()){return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');}
  function normalize(raw,today=day()){
    const p=raw&&typeof raw==='object'?raw:{};
    const daily=p.day===today&&p.daily&&typeof p.daily==='object'?p.daily:{};
    const total=count(p.totalKills),selected=liveries.find(l=>l.id===p.selected&&l.at<=total)?.id||'comet';
    return {day:today,totalKills:total,runs:count(p.runs),selected,daily:{kills:count(daily.kills),wave:count(daily.wave),score:count(daily.score),bosses:count(daily.bosses)}};
  }
  function goals(progress){
    const seed=Number(progress.day.replace(/-/g,''))%3;
    return [
      {key:'kills',label:'Defeat '+[10,12,15][seed]+' aliens in one run',target:[10,12,15][seed]},
      seed===2?{key:'bosses',label:'Defeat a commander',target:1}:{key:'wave',label:'Reach wave 4',target:4},
      {key:'score',label:'Score '+[200,250,300][seed]+' in one run',target:[200,250,300][seed]}
    ].map(g=>({...g,value:Math.min(g.target,progress.daily[g.key]),done:progress.daily[g.key]>=g.target}));
  }
  function record(raw,run,today=day()){
    const p=normalize(raw,today),before=goals(p).filter(g=>g.done).length;
    const unlocked=liveries.filter(l=>l.at>p.totalKills);
    p.totalKills=count(p.totalKills+count(run.kills));p.runs=count(p.runs+1);
    for(const key of ['kills','wave','score','bosses'])p.daily[key]=Math.max(p.daily[key],count(run[key]));
    return {progress:p,newGoals:goals(p).filter(g=>g.done).length-before,unlocked:unlocked.filter(l=>l.at<=p.totalKills)};
  }
  function key(owner){return 'starDefenderFlight:v1:'+String(owner||'guest');}
  function load(storage,owner,today=day()){try{return normalize(JSON.parse(storage.getItem(key(owner))||'null'),today);}catch{return normalize(null,today);}}
  function save(storage,owner,progress){try{storage.setItem(key(owner),JSON.stringify(progress));return true;}catch{return false;}}
  return {liveries,day,normalize,goals,record,key,load,save};
});
