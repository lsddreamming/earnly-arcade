/* Original Earnly arcade preview. Pure simulation: no wallet or play writes. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.NeonSliceEngine=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  function distance(x,y,a,b){const dx=b.x-a.x,dy=b.y-a.y;const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);}
  class Game{
    constructor(random=Math.random){this.random=random;this.reset();}
    reset(){this.state='ready';this.score=0;this.misses=0;this.time=0;this.wave=0;this.nextWave=.4;this.items=[];this.effects=[];this.id=0;this.strokeHits=0;this.strokeStart=null;this.lastMotion=null;this.strokeDirection=null;this.strokeLength=0;this.completedCombos=[];this.bestCombo=0;this.continued=false;this.reason='';this.sliced=0;this.burgers=0;}
    start(){this.reset();this.state='running';}
    pause(){if(this.state==='running'){this.endStroke();this.state='paused';}}
    resume(){if(this.state==='paused')this.state='running';}
    end(reason){this.state='over';this.reason=reason;this.endStroke();this.completedCombos=[];}
    continue(){if(this.state!=='over'||this.continued)return false;this.continued=true;this.items=[];this.misses=0;this.nextWave=1.4;this.state='running';return true;}
    spawn(){
      this.wave++;const count=Math.min(4,1+Math.floor(this.time/14)+(this.wave%3===0?1:0));
      // Wide, readable lanes converge gently near the apex. Each wave alternates
      // a flat group, a diagonal and a shallow fan without increasing food count.
      const pattern=this.wave%3,spacing=66,center=180+(this.random()-.5)*30,launch=-545-this.random()*30;
      for(let i=0;i<count;i++){
        const lane=i-(count-1)/2,x=center+lane*spacing;
        this.items.push({id:++this.id,x,y:580,vx:-lane*(pattern===2?5:9),vy:launch+(pattern===1?lane*18:pattern===2?Math.abs(lane)*14:0),r:23+this.random()*5,angle:this.random()*6,spin:(this.random()-.5)*3,type:this.random()<.06?7:[0,1,2,3,4,5,6,8,9,10,11][Math.floor(this.random()*11)],bomb:this.wave>4&&i===count-1&&this.random()<Math.min(.34,.1+this.time/220)});
      }
    }
    step(dt){if(this.state!=='running')return;dt=Math.min(.04,Math.max(0,dt));this.time+=dt;this.expireStroke();this.nextWave-=dt;if(this.nextWave<=0){this.spawn();this.nextWave=Math.max(.68,1.7-this.time*.007);}
      for(const item of this.items){item.x+=item.vx*dt;item.y+=item.vy*dt;item.vy+=530*dt;item.angle+=item.spin*dt;if(item.y>620&&item.vy>0){item.gone=true;if(!item.bomb&&++this.misses>=3)this.end('Three ingredients missed');}}
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
  return {Game,distance};
});
