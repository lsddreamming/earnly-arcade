/* Original Earnly cookout simulation. Shared with the authoritative replay verifier. */
(function(root,factory){const api=factory();root.NeonSliceEngine=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  function distance(x,y,a,b){const dx=b.x-a.x,dy=b.y-a.y;const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);}
  class Game{
    constructor(random=Math.random,version=2){this.version=version;this.random=random;this.reset();}
    reset(){this.state='ready';this.score=0;this.misses=0;this.time=0;this.wave=0;this.nextWave=.4;this.items=[];this.effects=[];this.id=0;this.strokeHits=0;this.strokeStart=null;this.lastMotion=null;this.strokeDirection=null;this.strokeLength=0;this.completedCombos=[];this.bestCombo=0;this.continued=false;this.reason='';this.sliced=0;this.burgers=0;}
    start(){this.reset();this.state='running';}
    pause(){if(this.state==='running'){this.endStroke();this.state='paused';}}
    resume(){if(this.state==='paused')this.state='running';}
    end(reason){this.state='over';this.reason=reason;this.endStroke();this.completedCombos=[];}
    continue(){if(this.state!=='over'||this.continued)return false;this.continued=true;this.items=[];this.misses=0;this.nextWave=1.4;this.state='running';return true;}
    spawn(){
      this.wave++;const count=this.version>=3?Math.min(4,1+Math.floor(this.time/10)+(this.random()<.4?1:0)):Math.min(4,1+Math.floor(this.time/14)+(this.wave%3===0?1:0));
      // Keep the opening gentle, then shorten airtime without lowering the apex.
      const pressure=Math.min(1,Math.max(0,(this.time-12)/90)),gravity=530+190*pressure;
      const pattern=this.wave%3,spacing=78,center=180+(this.random()-.5)*16;
      const drift=(this.random()-.5)*16*pressure,launch=(-545-this.random()*(30+35*pressure))*Math.sqrt(gravity/530);
      const wave=[];
      for(let i=0;i<count;i++){
        const lane=i-(count-1)/2,x=center+lane*spacing;
        wave.push({id:++this.id,x,y:580,vx:drift,vy:launch+(pattern===1?lane*18:pattern===2?Math.abs(lane)*14:0),gravity,r:23+this.random()*5,angle:this.random()*6,spin:(this.random()-.5)*3,type:this.random()<.06?7:[0,1,2,3,4,5,6,8,9,10,11][Math.floor(this.random()*11)],bomb:this.time>=12&&this.wave>4&&i===count-1&&this.random()<.16+.29*pressure});
      }
      // V3 distributes each wave across shuffled full-width lanes, with varied
      // heights and bounded sideways travel. Legacy ticket physics stay exact.
      if(this.version>=3){
        const lanes=[40,110,180,250,320];
        for(let i=lanes.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[lanes[i],lanes[j]]=[lanes[j],lanes[i]];}
        wave.forEach((item,i)=>{
          item.x=lanes[i]+(this.random()-.5)*16;
          item.vy=launch+(this.random()-.5)*70;
          const flight=-2*item.vy/gravity;
          item.vx=Math.max((30-item.x)/flight,Math.min((330-item.x)/flight,(this.random()-.5)*65));
        });
      }
      // Version 1 remains replayable for old clients and pending rewards.
      // Swap the hazard into a random formation lane before spacing checks.
      if(this.version>=2){const bomb=wave.find(item=>item.bomb);if(bomb){const target=wave[Math.floor(this.random()*wave.length)];[bomb.x,target.x]=[target.x,bomb.x];[bomb.vy,target.vy]=[target.vy,bomb.vy];}}
      if(this.version>=3)for(const item of wave){const flight=-2*item.vy/gravity;item.vx=Math.max((30-item.x)/flight,Math.min((330-item.x)/flight,item.vx));}
      // Keep a clear slicing window around each food apex, including earlier waves.
      const overlaps=(a,b)=>{for(let t=0;t<=3;t+=.04){const ay=a.y+a.vy*t+.5*(a.gravity||530)*t*t,by=b.y+b.vy*t+.5*(b.gravity||530)*t*t;if(Math.abs(b.vy+(b.gravity||530)*t)>110)continue;if(ay< -a.r||ay>540+a.r||by< -b.r||by>540+b.r)continue;if(Math.hypot(a.x+a.vx*t-b.x-b.vx*t,ay-by)<a.r+b.r+16)return true;}return false;};
      for(const item of wave){if(item.bomb){const food=[...this.items,...wave].filter(other=>other!==item&&!other.bomb);let safe=!food.some(other=>overlaps(item,other));
          for(let attempt=0;!safe&&attempt<10;attempt++){const candidate={...item,x:36+((attempt+this.wave)%5)*72,vx:0,vy:launch*(attempt<5?.8:1.05),r:22};if(!food.some(other=>overlaps(candidate,other))){Object.assign(item,candidate);safe=true;}}
          if(!safe)item.bomb=false;}
        if(!item.bomb&&this.items.some(other=>other.bomb&&overlaps(other,item)))continue;
        this.items.push(item);}
    }
    step(dt){if(this.state!=='running')return;dt=Math.min(.04,Math.max(0,dt));this.time+=dt;this.expireStroke();this.nextWave-=dt;if(this.nextWave<=0){this.spawn();const pressure=Math.min(1,Math.max(0,(this.time-12)/90));this.nextWave=1.7-.85*pressure+(this.random()-.5)*.2*pressure;}
      for(const item of this.items){item.x+=item.vx*dt;item.y+=item.vy*dt;item.vy+=(item.gravity||530)*dt;item.angle+=item.spin*dt;if(item.y>620&&item.vy>0){item.gone=true;if(!item.bomb&&++this.misses>=3)this.end('Three ingredients missed');}}
      this.items=this.items.filter(x=>!x.gone);for(const e of this.effects){e.life-=dt;e.x+=e.vx*dt;e.y+=e.vy*dt;e.vy+=(e.half?530:230)*dt;e.stillY+=(e.fallVy||40)*dt;e.fallVy=(e.fallVy||40)+530*dt;if(e.half)e.angle+=(e.spin||0)*dt;}this.effects=this.effects.filter(e=>e.life>0);
    }

    // Combo timing uses simulation time so pausing cannot extend an active cut.
    closeTimedStroke(){const combo=this.endStroke();if(combo)this.completedCombos.push(combo);}
    expireStroke(){if(this.strokeStart!==null&&(this.time-this.strokeStart>=.5||this.time-this.lastMotion>=.14))this.closeTimedStroke();}
    slice(a,b){if(this.state!=='running')return [];
      this.expireStroke();const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
      if(length<2)return []; // A parked finger (or held Space) is not a blade.
      const direction={x:dx/length,y:dy/length};
      if(this.strokeDirection&&(direction.x*this.strokeDirection.x+direction.y*this.strokeDirection.y<-.25||this.strokeLength+length>500))this.closeTimedStroke();
      if(this.strokeStart===null)this.strokeStart=this.time;
      this.lastMotion=this.time;this.strokeDirection=direction;this.strokeLength+=length;
      const hits=[];for(const item of this.items){if(item.gone||distance(item.x,item.y,a,b)>item.r)continue;if(item.bomb){item.gone=true;this.end('Bomb hit');hits.push(item);break;}item.gone=true;this.score+=item.type===7?50:10;this.sliced++;if(item.type===7)this.burgers++;this.strokeHits++;hits.push(item);const cutAngle=Math.atan2(dy,dx),nx=-dy/length,ny=dx/length;
      for(let i=0;i<10;i++){const angle=i*Math.PI*2/10,speed=65+this.random()*100;this.effects.push({x:item.x,y:item.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-35,life:.65,type:item.type,size:3+this.random()*3,stillX:item.x+Math.cos(angle)*(item.r+12),stillY:item.y+Math.sin(angle)*(item.r+12)});}
      for(const side of [-1,1])this.effects.push({...item,x:item.x+nx*side*3,y:item.y+ny*side*3,vx:nx*side*95,vy:35+ny*side*35,life:1.35,half:side,stillX:item.x+nx*side*9,stillY:item.y+ny*side*9,stillAngle:item.angle||0,spin:side*2,localCutAngle:cutAngle-(item.angle||0)});
      this.effects=this.effects.slice(-180);}this.items=this.items.filter(x=>!x.gone);return hits;}
    endStroke(){const n=this.strokeHits;this.strokeHits=0;this.strokeStart=null;this.lastMotion=null;this.strokeDirection=null;this.strokeLength=0;if(this.state==='running'&&n>=3){const bonus=Math.min(100,(n-1)*5);this.score+=bonus;this.bestCombo=Math.max(n,this.bestCombo);return {hits:n,bonus};}return null;}
  }
  function seededRandom(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
  // Replay only bounded, integer-tick input. Never trust a client-supplied score.
  function verify(seed,events,ticks,version=2){
    if(![1,2,3].includes(version))throw Error('INVALID_RUN');
    if(!Number.isInteger(seed)||seed<1||seed>4294967295||!Number.isInteger(ticks)||ticks<1||ticks>10800||!Array.isArray(events)||events.length>18000)throw Error('INVALID_RUN');
    const g=new Game(seededRandom(seed),version);g.start();let tick=0,previous=0;
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
