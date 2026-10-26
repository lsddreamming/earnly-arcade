/* Original Earnly cookout simulation. Shared with the authoritative replay verifier. */
(function(root,factory){const api=factory();root.NeonSliceEngine=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  function distance(x,y,a,b){const dx=b.x-a.x,dy=b.y-a.y;const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);}
  class Game{
    constructor(random=Math.random){this.random=random;this.reset();}
    reset(){this.state='ready';this.score=0;this.misses=0;this.time=0;this.wave=0;this.nextWave=.4;this.items=[];this.effects=[];this.id=0;this.strokeHits=0;this.bestCombo=0;this.continued=false;this.reason='';this.sliced=0;this.burgers=0;}
    start(){this.reset();this.state='running';}
    pause(){if(this.state==='running'){this.endStroke();this.state='paused';}}
    resume(){if(this.state==='paused')this.state='running';}
    end(reason){this.state='over';this.reason=reason;this.strokeHits=0;}
    continue(){if(this.state!=='over'||this.continued)return false;this.continued=true;this.items=[];this.misses=0;this.nextWave=1.4;this.state='running';return true;}
    spawn(){this.wave++;const count=Math.min(4,1+Math.floor(this.time/12)+(this.wave%3===0?1:0));for(let i=0;i<count;i++){const x=65+this.random()*230;this.items.push({id:++this.id,x,y:580,vx:(180-x)*.24+(this.random()-.5)*75,vy:-530-this.random()*75,r:23+this.random()*5,angle:this.random()*6,spin:(this.random()-.5)*3,type:this.random()<.06?7:[0,1,2,3,4,5,6,8,9,10,11][Math.floor(this.random()*11)],bomb:this.wave>4&&i===count-1&&this.random()<Math.min(.34,.1+this.time/220)});}}
    step(dt){if(this.state!=='running')return;dt=Math.min(.04,Math.max(0,dt));this.time+=dt;this.nextWave-=dt;if(this.nextWave<=0){this.spawn();this.nextWave=Math.max(.72,1.65-this.time*.006);}
      for(const item of this.items){item.x+=item.vx*dt;item.y+=item.vy*dt;item.vy+=530*dt;item.angle+=item.spin*dt;if(item.y>620&&item.vy>0){item.gone=true;if(!item.bomb&&++this.misses>=3)this.end('Three ingredients missed');}}
      this.items=this.items.filter(x=>!x.gone);for(const e of this.effects){e.life-=dt;e.x+=e.vx*dt;e.y+=e.vy*dt;e.vy+=230*dt;}this.effects=this.effects.filter(e=>e.life>0);
    }
    slice(a,b){if(this.state!=='running')return [];const hits=[];for(const item of this.items){if(item.gone||distance(item.x,item.y,a,b)>item.r)continue;if(item.bomb){item.gone=true;this.end('Bomb hit');hits.push(item);break;}item.gone=true;this.score+=item.type===7?50:10;this.sliced++;if(item.type===7)this.burgers++;this.strokeHits++;hits.push(item);for(let i=0;i<12;i++)this.effects.push({x:item.x,y:item.y,vx:(this.random()-.5)*220,vy:(this.random()-.5)*220,life:.6,type:item.type});for(const side of [-1,1])this.effects.push({...item,vx:side*85,vy:-100,life:.7,half:side});}this.items=this.items.filter(x=>!x.gone);return hits;}
    endStroke(){const n=this.strokeHits;this.strokeHits=0;if(this.state==='running'&&n>=2){const bonus=Math.min(100,(n-1)*5);this.score+=bonus;this.bestCombo=Math.max(n,this.bestCombo);return {hits:n,bonus};}return null;}
  }
  function seededRandom(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
  // Replay only bounded, integer-tick input. Never trust a client-supplied score.
  function verify(seed,events,ticks){
    if(!Number.isInteger(seed)||seed<1||seed>4294967295||!Number.isInteger(ticks)||ticks<1||ticks>10800||!Array.isArray(events)||events.length>18000)throw Error('INVALID_RUN');
    const g=new Game(seededRandom(seed));g.start();let tick=0,previous=0;
    for(const e of events){
      if(!Array.isArray(e)||![1,5].includes(e.length)||!Number.isInteger(e[0])||e[0]<previous||e[0]>ticks)throw Error('INVALID_RUN');
      while(tick<e[0]){if(g.state!=='running')throw Error('INVALID_RUN');g.step(1/60);tick++;}
      if(g.state!=='running')throw Error('INVALID_RUN');
      if(e.length===1)g.endStroke();else{
        if(e.slice(1).some((n,i)=>!Number.isInteger(n)||n<0||n>(i%2?540:360)))throw Error('INVALID_RUN');
        g.slice({x:e[1],y:e[2]},{x:e[3],y:e[4]});
      }previous=e[0];
    }
    while(tick<ticks){if(g.state!=='running')throw Error('INVALID_RUN');g.step(1/60);tick++;}
    // A three-minute round ends cleanly; continues never create another reward.
    if(ticks===10800&&g.state==='running')g.end('Cookout complete');
    if(g.state!=='over')throw Error('RUN_NOT_FINISHED');
    return {score:g.score,ticks,coins:Math.min(30,Math.floor(g.score/50))};
  }
  return {Game,distance,seededRandom,verify};
});
