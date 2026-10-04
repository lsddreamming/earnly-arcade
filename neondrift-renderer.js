/* Canvas artwork: road ribbons, city lights, tire trails and layered cars. */
window.NeonDriftRenderer={create(canvas){
  const ctx=canvas.getContext('2d'),E=NeonDriftEngine;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let particles=[],smokeTime=0;
  function reset(){particles=[];smokeTime=0;}
  function event(e,s){if(motion.matches)return;if(e.type!=='crash'&&e.type!=='near')return;const count=e.type==='crash'?28:12;for(let i=0;i<count;i++){const a=i/count*Math.PI*2;particles.push({x:s.x,y:E.PLAYER_Y,vx:Math.cos(a)*(45+i%5*20),vy:Math.sin(a)*70,life:.45+i%4*.1,max:.75,size:e.type==='crash'?2:1.4,color:e.type==='crash'?'#ffd18a':'#83fff0',smoke:false});}particles=particles.slice(-100);}
  function line(points,color,width){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
  function car(x,y,angle,color,player=false){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    ctx.fillStyle='#0008';ctx.fillRect(-17,-23,36,52);
    ctx.fillStyle='#050914';for(const sx of [-17,12]){ctx.fillRect(sx,-15,5,12);ctx.fillRect(sx,11,5,12);}
    ctx.shadowColor=color;ctx.shadowBlur=player?13:5;
    ctx.beginPath();ctx.moveTo(-11,-25);ctx.lineTo(11,-25);ctx.lineTo(15,-14);ctx.lineTo(15,21);ctx.lineTo(10,27);ctx.lineTo(-10,27);ctx.lineTo(-15,21);ctx.lineTo(-15,-14);ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.shadowBlur=0;
    const grad=ctx.createLinearGradient(-14,0,14,0);grad.addColorStop(0,'#ffffff66');grad.addColorStop(.4,'#ffffff08');grad.addColorStop(1,'#001b3888');ctx.fillStyle=grad;ctx.fill();
    ctx.fillStyle='#101c37';ctx.beginPath();ctx.moveTo(-9,-12);ctx.lineTo(9,-12);ctx.lineTo(11,-2);ctx.lineTo(-11,-2);ctx.closePath();ctx.fill();ctx.fillRect(-9,10,18,7);
    ctx.strokeStyle='#e5ffff88';ctx.lineWidth=.7;ctx.strokeRect(-8,-10,16,7);ctx.fillStyle='#c2fffa66';ctx.fillRect(-10,-20,4,6);ctx.fillRect(6,-20,4,6);
    ctx.fillStyle='#092038';for(const side of [-12,9])for(let n=0;n<3;n++)ctx.fillRect(side,2+n*2,3,1);
    ctx.fillStyle='#d4ffff';ctx.fillRect(-11,-24,6,3);ctx.fillRect(5,-24,6,3);ctx.fillStyle='#ff4779';ctx.fillRect(-12,22,7,3);ctx.fillRect(5,22,7,3);
    ctx.fillStyle='#04162488';ctx.fillRect(-2,-24,4,48);ctx.fillStyle=color;ctx.fillRect(-17,18,34,3);
    if(player){ctx.globalAlpha=.15;ctx.fillStyle='#aafff7';for(const x of [-8,8]){ctx.beginPath();ctx.moveTo(x-3,-25);ctx.lineTo(x-17,-100);ctx.lineTo(x+17,-100);ctx.lineTo(x+3,-25);ctx.fill();}}
    ctx.restore();
  }
  function render(s,{idle=false,dt=0}={}){
    const reduced=motion.matches;dt=Math.min(.05,Math.max(0,dt));if(reduced)particles=[];
    const ratio=Math.min(2,devicePixelRatio||1),width=Math.round(400*ratio),height=Math.round(520*ratio);
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,400,520);
    const d=E.difficulty(s.time),dist=idle?700:s.distance;
    const palette=[['#5affec','#f94caf'],['#ffe39b','#ff7769'],['#ba9cff','#f078e9'],['#80e8ff','#638cff'],['#ff9d7b','#ff4a87']][Math.min(4,s.stage-1)];
    const roadX=y=>E.road(dist+E.PLAYER_Y-y);
    const bg=ctx.createLinearGradient(0,0,400,520);bg.addColorStop(0,'#09172a');bg.addColorStop(1,'#130d28');ctx.fillStyle=bg;ctx.fillRect(0,0,400,520);
    // Deterministic roadside city panels scroll independently of the racing surface.
    for(let i=-1;i<9;i++){const y=((i*88+dist*.8)%704+704)%704-90;for(const side of [0,1]){const x=side?357:7;ctx.fillStyle=i%2?'#16223d':'#10243b';ctx.fillRect(x,y,35,69);ctx.strokeStyle='#324766';ctx.strokeRect(x,y,35,69);ctx.fillStyle=palette[(i+10)%2];ctx.globalAlpha=.4;for(let n=0;n<4;n++)for(let col=0;col<3;col++)if((n+col+i+10)%3)ctx.fillRect(x+5+col*9,y+10+n*13,4,5);ctx.fillStyle='#ffffff1a';ctx.fillRect(x+3,y+3,29,2);ctx.globalAlpha=1;}}
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
    if(idle){car(roadX(125)-72,125,.03,'#f975a8');car(roadX(20)+72,20,-.04,'#fdbf6a');car(roadX(400),400,-.15,'#5affec',true);}
    else{
      for(const c of s.traffic){const y=E.PLAYER_Y-(c.z-s.distance);if(y< -60||y>580)continue;const angle=Math.atan2(E.road(c.z+10)-E.road(c.z),10);car(E.road(c.z)+c.lane*72,y,angle,['#ff648a','#fac66c','#9e9bff'][c.color]);}
      if(!reduced&&Math.abs(s.vx)>48&&s.hurt===0){smokeTime+=dt;while(smokeTime>.045){smokeTime-=.045;for(const side of [-1,1])particles.push({x:s.x+side*11,y:E.PLAYER_Y+20,vx:-s.vx*.22+side*7,vy:50,life:.7,max:.7,size:3,color:'#b3d1db',smoke:true});}}else smokeTime=0;
      particles=particles.filter(p=>p.life>0).slice(-100);for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;ctx.globalAlpha=Math.max(0,p.life/p.max)*(p.smoke?.22:1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.smoke?p.size+(1-p.life/p.max)*9:p.size,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
      if(Math.abs(s.vx)>48&&s.hurt===0){ctx.strokeStyle='#5affec55';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(s.x,E.PLAYER_Y+12,23,27,Math.atan2(s.vx,d.speed)*.75,.15,Math.PI-.15);ctx.stroke();}
      if(s.hurt>0)ctx.globalAlpha=reduced?.7:(Math.floor(s.time*12)%2?.45:1);
      car(s.x,E.PLAYER_Y,Math.atan2(s.vx,d.speed)*.75,'#5affec',true);ctx.globalAlpha=1;
      ctx.fillStyle='#050d22bc';ctx.fillRect(13,13,115,27);ctx.fillStyle='#c6d6e9';ctx.font='bold 10px monospace';ctx.fillText('SECTOR 0'+s.stage+' / 05',23,31);
      const remain=Math.max(0,1-s.time/E.DURATION);ctx.fillStyle='#ffffff18';ctx.fillRect(145,24,238,3);ctx.fillStyle=palette[0];ctx.fillRect(145,24,238*remain,3);
      if(s.comboTime>0){ctx.fillStyle='#081a2bd9';ctx.fillRect(132,475,136,27);ctx.fillStyle='#8ffff1';ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.fillText('CLOSE CALL CHAIN ×'+s.combo,200,492);ctx.textAlign='left';ctx.fillStyle='#5affec';ctx.fillRect(132,503,136*s.comboTime/5,2);}
      if(s.hull===1){ctx.strokeStyle='#ff837b77';ctx.lineWidth=3;ctx.strokeRect(4,4,392,512);}
      if(s.hurt>1.2){ctx.strokeStyle='#ff557799';ctx.lineWidth=10;ctx.strokeRect(0,0,400,520);}
    }
    const vignette=ctx.createLinearGradient(0,0,0,520);vignette.addColorStop(0,'#05091888');vignette.addColorStop(.2,'#05091800');vignette.addColorStop(.85,'#05091800');vignette.addColorStop(1,'#05091888');ctx.fillStyle=vignette;ctx.fillRect(0,0,400,520);
  }
  return {render,event,reset};
}};
