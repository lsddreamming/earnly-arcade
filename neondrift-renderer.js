/* Canvas artwork: road ribbons, city lights, tire trails and layered cars. */
window.NeonDriftRenderer={create(canvas){
  const ctx=canvas.getContext('2d'),E=NeonDriftEngine;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let particles=[],smokeTime=0;
  function reset(){particles=[];smokeTime=0;}
  function event(e,s){if(motion.matches)return;if(!['crash','near','pickup','boost'].includes(e.type))return;const count=e.type==='crash'?28:12;for(let i=0;i<count;i++){const a=i/count*Math.PI*2;particles.push({x:s.x,y:E.PLAYER_Y,vx:Math.cos(a)*(45+i%5*20),vy:Math.sin(a)*70,life:.45+i%4*.1,max:.75,size:e.type==='crash'?2:1.4,color:e.type==='crash'?'#ffd18a':e.type==='pickup'?'#ffd477':'#83fff0',smoke:false});}particles=particles.slice(-100);}
  function line(points,color,width){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
  function car(x,y,angle,color,player=false,variant=0){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    const touring=!player&&variant===1,roof=touring?5:0;
    // All silhouettes remain within the same collision footprint.
    ctx.fillStyle='#0008';ctx.beginPath();ctx.ellipse(2,5,20,29,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#050914';for(const sx of [-17,12]){ctx.fillRect(sx,-16,5,11);ctx.fillRect(sx,12,5,11);}
    ctx.beginPath();ctx.moveTo(-9,-25);ctx.quadraticCurveTo(-14,-24,-15,-14);ctx.lineTo(-15,19);ctx.quadraticCurveTo(-14,27,-9,27);ctx.lineTo(9,27);ctx.quadraticCurveTo(14,27,15,19);ctx.lineTo(15,-14);ctx.quadraticCurveTo(14,-24,9,-25);ctx.closePath();
    ctx.fillStyle=color;ctx.fill();
    const metal=ctx.createLinearGradient(-15,0,15,0);metal.addColorStop(0,'#07182e88');metal.addColorStop(.18,'#ffffff66');metal.addColorStop(.44,'#ffffff08');metal.addColorStop(.8,'#00112d55');metal.addColorStop(1,'#fff8');ctx.fillStyle=metal;ctx.fill();
    ctx.strokeStyle='#f0ffff55';ctx.lineWidth=.7;ctx.stroke();
    ctx.fillStyle='#071b2d';ctx.beginPath();ctx.moveTo(-9,-11);ctx.lineTo(9,-11);ctx.lineTo(11,-3);ctx.lineTo(-11,-3);ctx.closePath();ctx.fill();
    ctx.fillRect(-9,10+roof,18,6-roof/2);
    const glass=ctx.createLinearGradient(-8,-11,9,-2);glass.addColorStop(0,'#87d4e4bb');glass.addColorStop(1,'#133752');ctx.fillStyle=glass;ctx.fillRect(-8,-10,16,6);
    ctx.fillStyle='#f5ffff44';ctx.fillRect(-7,-9,2,4);ctx.fillStyle='#091629';ctx.fillRect(-12,-1,2,11+roof);ctx.fillRect(10,-1,2,11+roof);
    if(player){ctx.fillStyle='#102d43bb';ctx.fillRect(-5,-23,3,11);ctx.fillRect(2,-23,3,11);ctx.fillRect(-5,18,3,6);ctx.fillRect(2,18,3,6);ctx.fillStyle=color;ctx.fillRect(-19,-5,5,3);ctx.fillRect(14,-5,5,3);}
    if(touring){ctx.strokeStyle='#101b2d';ctx.lineWidth=1.5;line([[-7,0],[-7,13]],'#101b2d',1.5);line([[7,0],[7,13]],'#101b2d',1.5);}
    else{ctx.fillStyle='#091629';ctx.fillRect(-13,19,26,3);ctx.fillStyle='#d9f5ff44';ctx.fillRect(-12,19,24,1);}
    ctx.fillStyle='#e3ffff';ctx.fillRect(-11,-23,7,2);ctx.fillRect(4,-23,7,2);ctx.fillStyle='#ff4f70';ctx.fillRect(-11,23,7,2);ctx.fillRect(4,23,7,2);
    ctx.fillStyle='#06101e';ctx.fillRect(-6,25,12,1);ctx.fillRect(-10,26,3,2);ctx.fillRect(7,26,3,2);
    if(player){const beam=ctx.createLinearGradient(0,-25,0,-106);beam.addColorStop(0,'#bdfff230');beam.addColorStop(1,'#bdfff200');ctx.fillStyle=beam;for(const side of [-8,8]){ctx.beginPath();ctx.moveTo(side-3,-25);ctx.lineTo(side-17,-106);ctx.lineTo(side+17,-106);ctx.lineTo(side+3,-25);ctx.fill();}}
    ctx.restore();
  }
  function city(dist,palette,stage){
    // Repeatable blocks with rooftop equipment, shopfronts and pocket gardens.
    for(let i=-1;i<8;i++){
      const y=((i*98+dist*.65)%882+882)%882-100;
      for(const side of [0,1]){
        const x=side?361:3,kind=(i+9+side+stage)%3;
        if(kind===2){ctx.fillStyle='#102c30';ctx.fillRect(x,y,36,80);for(let n=0;n<3;n++){ctx.fillStyle=n%2?'#22534b':'#193f3b';ctx.beginPath();ctx.arc(x+18,y+13+n*24,10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#39806a55';ctx.beginPath();ctx.arc(x+15,y+10+n*24,5,0,Math.PI*2);ctx.fill();}continue;}
        ctx.fillStyle='#030b16';ctx.fillRect(x+3,y+5,35,80);
        ctx.fillStyle=kind?'#233248':'#1b3041';ctx.fillRect(x,y,34,74);
        ctx.strokeStyle='#466078';ctx.lineWidth=1;ctx.strokeRect(x+1,y+1,32,72);
        ctx.fillStyle='#0d1b2d';ctx.fillRect(x+5,y+7,24,48);
        ctx.fillStyle='#3c5165';ctx.fillRect(x+9,y+13,15,12);ctx.fillStyle='#182b3e';ctx.fillRect(x+11,y+15,11,8);
        for(let n=0;n<3;n++)line([[x+10,y+31+n*5],[x+24,y+31+n*5]],'#486075',1);
        ctx.fillStyle=palette[side];ctx.globalAlpha=.65;ctx.fillRect(x+4,y+62,26,3);ctx.globalAlpha=1;
        for(let n=0;n<4;n++){ctx.fillStyle=n%2?'#d7e5ba77':palette[1-side]+'77';ctx.fillRect(x+5+n*6,y+68,3,3);}
      }
    }
  }
  function render(s,{idle=false,dt=0}={}){
    const reduced=motion.matches;dt=Math.min(.05,Math.max(0,dt));if(reduced)particles=[];
    const ratio=Math.min(2,devicePixelRatio||1),width=Math.round(400*ratio),height=Math.round(520*ratio);
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,400,520);
    const d=E.difficulty(s.time),dist=idle?700:s.distance;
    const palette=[['#5affec','#f94caf'],['#ffe39b','#ff7769'],['#ba9cff','#f078e9'],['#80e8ff','#638cff'],['#ff9d7b','#ff4a87'],['#caff7a','#64deff']][Math.min(5,s.stage-1)];
    const paintSector=Math.max(s.stage,s.paintSector||1),paint=paintSector>=5?'#ffdc8a':paintSector>=3?'#bf9cff':'#5affec';
    const roadX=y=>E.road(dist+E.PLAYER_Y-y);
    const bg=ctx.createLinearGradient(0,0,400,520);bg.addColorStop(0,'#09172a');bg.addColorStop(1,'#130d28');ctx.fillStyle=bg;ctx.fillRect(0,0,400,520);
    city(dist,palette,s.stage);
    const left=[],right=[];for(let y=-20;y<=540;y+=8){left.push([roadX(y)-d.halfWidth,y]);right.push([roadX(y)+d.halfWidth,y]);}
    ctx.beginPath();left.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));right.slice().reverse().forEach(([x,y])=>ctx.lineTo(x,y));ctx.closePath();const asphalt=ctx.createLinearGradient(0,0,400,0);asphalt.addColorStop(0,'#10192a');asphalt.addColorStop(.5,'#20283b');asphalt.addColorStop(1,'#10192a');ctx.fillStyle=asphalt;ctx.fill();
    ctx.save();ctx.clip();for(let i=0;i<100;i++){const y=(i*53+dist)%540;const x=(i*83)%400;line([[x,y],[x+1,y+3]],'#b3bfd414',1);}ctx.restore();
    line(left,palette[1]+'22',15);line(right,palette[0]+'22',15);line(left,palette[1],3);line(right,palette[0],3);
    for(let y=-30;y<550;y+=6){if(((dist+410-y)%70+70)%70>37)continue;for(const off of [-36,36])line([[roadX(y)+off,y],[roadX(y+6)+off,y+6]],'#8496b044',2);}
    for(let y=-30;y<550;y+=10){if(((dist+410-y)%90+90)%90<26){line([[roadX(y)-d.halfWidth+7,y],[roadX(y)-d.halfWidth+7,y+7]],'#ffc2e477',4);line([[roadX(y)+d.halfWidth-7,y],[roadX(y)+d.halfWidth-7,y+7]],'#c1fff977',4);}}
    if(!idle){for(const p of s.skids){const y=E.PLAYER_Y+s.distance-p.z;ctx.globalAlpha=.5;for(const off of [-11,11])line([[p.x+off,y],[p.x+off-Math.sin(p.a)*10,y+10]],'#040613',3);}ctx.globalAlpha=1;}
    // Pools of street light stay outside the playable road.
    for(let i=0;i<6;i++){const y=(i*115+dist)%690-85;for(const side of [-1,1]){const x=roadX(y)+side*(d.halfWidth+14);ctx.fillStyle=palette[side>0?0:1]+'0c';ctx.beginPath();ctx.ellipse(x,y,25,43,0,0,Math.PI*2);ctx.fill();line([[x,y-17],[x,y]],'#8ab0c277',2);ctx.fillStyle='#d3fbff';ctx.fillRect(x-3,y-18,6,3);}}
    // Roadside arrows give the next bend a visible direction before the player enters it.
    const turn=roadX(25)-roadX(230);for(const y of [70,106,142]){const x=turn>0?roadX(y)-d.halfWidth+16:roadX(y)+d.halfWidth-16;const sign=turn>0?1:-1;line([[x-sign*3,y-5],[x+sign*3,y],[x-sign*3,y+5]],'#e9fbff88',2);}
    if(!idle){
      for(const p of s.pickups){const y=E.PLAYER_Y-(p.z-s.distance);if(y< -25||y>550)continue;const x=E.road(p.z)+p.lane*72;ctx.save();ctx.translate(x,y);ctx.shadowColor='#ffd477';ctx.shadowBlur=reduced?0:15;ctx.fillStyle='#ffd477';ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(10,0);ctx.lineTo(0,13);ctx.lineTo(-10,0);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#fff5c9';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#99600d';ctx.fillRect(-1,-6,2,12);ctx.restore();}
      if(!reduced){ctx.strokeStyle=s.boost>0?'#8ffff155':'#8dcdff22';for(let i=0;i<10;i++){const y=(i*67+s.distance*1.3)%540;const side=i%2?1:-1;const x=roadX(y)+side*(d.halfWidth+7);line([[x,y],[x,y+(s.boost>0?35:16)]],ctx.strokeStyle,1);}}
    }
    if(idle){car(roadX(125)-72,125,.03,'#f975a8');car(roadX(20)+72,20,-.04,'#fdbf6a');car(roadX(400),400,-.15,paint,true);}
    else{
      for(const c of s.traffic){const y=E.PLAYER_Y-(c.z-s.distance);if(y< -60||y>580)continue;const angle=Math.atan2(E.road(c.z+10)-E.road(c.z),10);car(E.road(c.z)+c.lane*72,y,angle,['#ff648a','#fac66c','#9e9bff'][c.color],false,c.color);}
      if(!reduced&&Math.abs(s.vx)>48&&s.hurt===0){smokeTime+=dt;while(smokeTime>.045){smokeTime-=.045;for(const side of [-1,1])particles.push({x:s.x+side*11,y:E.PLAYER_Y+20,vx:-s.vx*.22+side*7,vy:50,life:.7,max:.7,size:3,color:'#b3d1db',smoke:true});}}else smokeTime=0;
      particles=particles.filter(p=>p.life>0).slice(-100);for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;ctx.globalAlpha=Math.max(0,p.life/p.max)*(p.smoke?.22:1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.smoke?p.size+(1-p.life/p.max)*9:p.size,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
      if(Math.abs(s.vx)>48&&s.hurt===0){ctx.strokeStyle='#5affec55';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(s.x,E.PLAYER_Y+12,23,27,Math.atan2(s.vx,d.speed)*.75,.15,Math.PI-.15);ctx.stroke();}
      if(s.hurt>0)ctx.globalAlpha=reduced?.7:(Math.floor(s.time*12)%2?.45:1);
      if(s.boost>0){ctx.save();ctx.translate(s.x,E.PLAYER_Y);ctx.rotate(Math.atan2(s.vx,d.speed)*.75);for(const side of [-8,8]){const length=reduced?13:16+Math.sin(s.time*28)*5;ctx.fillStyle='#ffd477aa';ctx.beginPath();ctx.moveTo(side-3,25);ctx.lineTo(side,25+length);ctx.lineTo(side+3,25);ctx.fill();ctx.fillStyle='#edffff';ctx.fillRect(side-1,25,2,6);}ctx.restore();}
      car(s.x,E.PLAYER_Y,Math.atan2(s.vx,d.speed)*.75,s.boost>0?'#ffe59b':paint,true);ctx.globalAlpha=1;
      // A small ring conveys combo expiry; labels live in the cockpit below.
      if(s.comboTime>0){ctx.strokeStyle='#83fff099';ctx.lineWidth=2;ctx.beginPath();ctx.arc(s.x,E.PLAYER_Y,33,-Math.PI/2,-Math.PI/2+Math.PI*2*s.comboTime/5);ctx.stroke();}
      if(s.hull===1){ctx.strokeStyle='#ff837b77';ctx.lineWidth=3;ctx.strokeRect(4,4,392,512);}
      if(s.hurt>1.2){ctx.strokeStyle='#ff557799';ctx.lineWidth=10;ctx.strokeRect(0,0,400,520);}
    }
    const vignette=ctx.createLinearGradient(0,0,0,520);vignette.addColorStop(0,'#05091888');vignette.addColorStop(.2,'#05091800');vignette.addColorStop(.85,'#05091800');vignette.addColorStop(1,'#05091888');ctx.fillStyle=vignette;ctx.fillRect(0,0,400,520);
  }
  return {render,event,reset};
}};
