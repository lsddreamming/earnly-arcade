/* Coin Catch route planning and device-local medals. No currency or leaderboard writes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CoinCatchRules=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const medals=[{name:'First Spark',score:10,streak:5},{name:'Gold Gatherer',score:25,streak:10},{name:'Sky Collector',score:50,streak:15},{name:'Storm Rider',score:100,streak:20},{name:'Vault Legend',score:200,streak:30}];
  const count=n=>Math.max(0,Math.min(1e7,Math.floor(Number(n)||0)));
  function normalize(p){return {score:count(p?.score),streak:count(p?.streak),runs:count(p?.runs)};}
  function goal(raw){const p=normalize(raw);return medals.find(m=>p.score<m.score||p.streak<m.streak)||null;}
  function record(raw,score,streak){const p=normalize(raw);return {score:Math.max(p.score,count(score)),streak:Math.max(p.streak,count(streak)),runs:count(p.runs+1)};}
  const key=owner=>'coinCatchMedals:v1:'+String(owner||'guest');
  function load(storage,owner){try{return normalize(JSON.parse(storage.getItem(key(owner))||'null'));}catch{return normalize(null);}}
  function save(storage,owner,p){try{storage.setItem(key(owner),JSON.stringify(normalize(p)));}catch{}}
  // A conservative route through ALL pending rim arrivals. Coins require a
  // central catch; bombs reserve more than a full basket's collision footprint.
  // Leave 100ms between maneuvers and assume only 650 logical pixels/second.
  // This rejects impossible coin/bomb sandwiches, overtakes and cross-board pairs.
  function route(drops,basket,width=360){
    let ranges=[[basket.x+basket.w/2,basket.x+basket.w/2]],previous=0;
    const min=basket.w/2,max=width-min,rim=basket.y-7;
    const events=drops.filter(d=>d.y+d.r<=rim).map(d=>({...d,eta:(rim-d.r-d.y)/(d.speed/16.67)})).sort((a,b)=>a.eta-b.eta);
    for(const d of events){
      const reach=Math.max(0,d.eta-previous-100)*.65;
      const expanded=ranges.map(([a,b])=>[Math.max(min,a-reach),Math.min(max,b+reach)]);
      const allowed=d.bomb?[[min,d.x-64],[d.x+64,max]]:[[d.x-18,d.x+18]];
      ranges=[];
      for(const [a,b] of expanded)for(const [c,e] of allowed){const lo=Math.max(a,c,min),hi=Math.min(b,e,max);if(lo<=hi)ranges.push([lo,hi]);}
      if(!ranges.length)return false;
      // Merge overlapping intervals to keep planning bounded at late levels.
      ranges.sort((a,b)=>a[0]-b[0]);const merged=[];
      for(const r of ranges){const last=merged[merged.length-1];if(last&&r[0]<=last[1])last[1]=Math.max(last[1],r[1]);else merged.push(r);}
      ranges=merged;previous=d.eta;
    }
    return true;
  }
  function plan(drops,basket,level,random=Math.random){
    const bomb=random()<Math.min(.46,.10+(level-1)*.05);
    const speed=3.2+Math.min(6,(level-1)*.65)+random()*.7;
    for(let retry=0;retry<18;retry++){
      const candidate={x:18+random()*324,y:-20,r:bomb?13:12,bomb,speed};
      if(route([...drops,candidate],basket))return candidate;
    }
    // A skipped drop gives breathing room; never force an unsafe fallback.
    return null;
  }
  return {medals,normalize,goal,record,load,save,route,plan};
});
