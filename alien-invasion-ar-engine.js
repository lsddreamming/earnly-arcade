(function(root){
  'use strict';
  const types=[{name:'Runner',hp:2,speed:.065,color:'#93f857',dark:'#275f3c',score:100},{name:'Armored',hp:5,speed:.038,color:'#ba8bff',dark:'#49327d',score:220},{name:'Brute',hp:10,speed:.027,color:'#ffb65c',dark:'#a04f47',score:400}];
  class Game{
    constructor(){this.portals=[];this.reset();}
    reset(){this.enemies=[];this.health=100;this.score=0;this.kills=0;this.wave=1;this.spawned=0;this.timer=.4;this.break=0;this.time=0;this.weapon=0;this.ammo=[24,8];this.reload=0;this.cooldown=0;this.state='setup';this.nextID=1;}
    get target(){return [6,9,12][this.wave-1]}
    get capacity(){return this.weapon?8:24}
    addPortal(x,y){if(this.portals.length<4)this.portals.push({x:Math.max(.1,Math.min(.9,x)),y:Math.max(.2,Math.min(.65,y))});}
    start(){if(!this.portals.length)return false;this.state='playing';return true;}
    changeWeapon(){if(!this.reload)this.weapon=1-this.weapon;}
    beginReload(){if(!this.reload&&this.ammo[this.weapon]<this.capacity)this.reload=1.15;}
    update(dt){
      if(this.state!=='playing')return;
      this.time+=dt;this.cooldown=Math.max(0,this.cooldown-dt);
      if(this.reload){this.reload=Math.max(0,this.reload-dt);if(!this.reload)this.ammo[this.weapon]=this.capacity;}
      if(this.break>0){this.break=Math.max(0,this.break-dt);return;}
      this.timer-=dt;
      if(this.spawned<this.target&&this.timer<=0){
        const p=this.portals[this.spawned%this.portals.length];const type=this.wave===1?(this.spawned===5?1:0):(this.spawned+this.wave)%3;
        this.enemies.push({id:this.nextID++,type,hp:types[type].hp,depth:0,age:0,hit:0,attack:1,x:p.x,y:p.y,drift:(this.spawned%3-1)*.13});
        this.spawned++;this.timer=Math.max(.7,1.9-this.wave*.27);
      }
      for(const a of this.enemies){a.age+=dt;a.hit=Math.max(0,a.hit-dt);a.depth=Math.min(1,a.depth+types[a.type].speed*dt);if(a.depth===1){a.attack-=dt;if(a.attack<=0){this.health=Math.max(0,this.health-[5,8,12][a.type]);a.attack=1.5;}}}
      if(this.health<=0){this.state='lost';return;}
      if(this.spawned===this.target&&!this.enemies.length){if(this.wave===3)this.state='won';else{this.wave++;this.spawned=0;this.break=2.5;this.timer=.2;this.health=Math.min(100,this.health+15);this.ammo=[24,8];}}
    }
    bounds(a,w,h){const d=a.depth;const size=(28+78*d)*(a.type===2?1.3:a.type===1?1.05:.85)*Math.min(w/390,h/760,1.25);return{x:(a.x+a.drift*d)*w,y:(a.y+(.68-a.y)*d)*h+Math.sin(a.age*6)*3,r:size};}
    shoot(x,y,w,h){
      if(this.state!=='playing'||this.cooldown>0||this.reload||!this.ammo[this.weapon])return {fired:false};
      this.ammo[this.weapon]--;this.cooldown=this.weapon?.48:.14;
      const hits=this.enemies.filter(a=>{const b=this.bounds(a,w,h);return ((x-b.x)/(b.r*.72))**2+((y-b.y)/(b.r*1.1))**2<1.2;}).sort((a,b)=>b.depth-a.depth);
      const a=hits[0];if(!a)return{fired:true};a.hp-=this.weapon?4:1;a.hit=.13;
      const killed=a.hp<=0;const b=this.bounds(a,w,h);
      if(killed){this.enemies=this.enemies.filter(e=>e.id!==a.id);this.kills++;this.score+=types[a.type].score;}
      return{fired:true,hit:true,killed,x:b.x,y:b.y,color:types[a.type].color};
    }
  }
  const api={Game,types};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.AlienDemo=api;
})(typeof window!=='undefined'?window:globalThis);
