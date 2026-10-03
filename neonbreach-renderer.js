/* Canvas raycaster: shaded panels, animated robot silhouettes and bounded hit effects. */
(()=>{
  'use strict';
  const E=NeonBreachEngine,FOV=1.25,TAU=Math.PI*2;
  const colors={rusher:'#45e3ff',sentry:'#ff66bc',tank:'#b59aff',health:'#64ffc4',shield:'#69bcff',overdrive:'#ffdf78'};
  function create(canvas){
    const c=canvas.getContext('2d');let effects=[],hit=0,kill=0,banner=0,bannerText='',motion=0;
    const reduced=()=>window.Arcade?.reducedMotionEnabled?.();
    function reset(){effects=[];hit=kill=banner=motion=0}
    function event(e){
      if(e.type==='wave'){banner=2;bannerText=`WAVE ${String(e.wave).padStart(2,'0')}`}
      if(e.type==='impact'){
        hit=.18;kill=e.killed?.65:kill;
        effects.push({...e,life:e.killed?.65:.22,total:e.killed?.65:.22});
        if(effects.length>16)effects.shift();
      }
    }
    function polygon(points,fill,stroke){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.stroke()}}
    function text(value,x,y,size,color='#d6f6ff',align='left'){c.font=`${size>18?800:600} ${size}px system-ui`;c.fillStyle=color;c.textAlign=align;c.fillText(value,x,y)}
    function robot(s,x,y,size,time){
      c.save();c.translate(x,y);c.scale(size,size);c.lineWidth=.012;
      const color=s.hit?'#fff':colors[s.type],tank=s.type==='tank',step=reduced()?0:Math.sin(time*8+s.phase)*.035;
      c.fillStyle='#0007';c.beginPath();c.ellipse(0,.98,.37,.075,0,0,TAU);c.fill();
      // Articulated legs, plated feet, suspended torso and shoulder armor.
      for(const side of [-1,1]){
        c.fillStyle='#111b35';c.fillRect(side*.18-.06,.69,.12,.24+step*side);
        c.fillStyle=color;c.fillRect(side*.18-.062,.72,.124,.05);
        polygon([[side*.18-.1,.89+step*side],[side*.18+.08,.89+step*side],[side*.18+.10,1+step*side],[side*.18-.12,1+step*side]],'#243857',color);
      }
      c.translate(0,reduced()?0:Math.sin(time*4+s.phase)*.018);
      for(const side of [-1,1]){
        c.save();c.translate(side*(tank?.37:.32),.38);c.rotate(side*step*2);
        polygon([[-.075,-.035],[.075,-.035],[.085,.27],[-.065,.3]],'#182942',color);
        c.fillStyle=color;c.fillRect(-.075,.01,.15,.08);c.fillStyle='#0b1426';c.fillRect(-.06,.23,.12,.065);c.restore();
      }
      polygon([[-.26,.31],[.26,.31],[.31,.42],[.24,.73],[-.24,.73],[-.31,.42]],'#263e60',color);
      polygon([[-.2,.36],[.2,.36],[.15,.66],[-.15,.66]],'#0b182a');
      c.strokeStyle='#56738b';c.lineWidth=.012;c.beginPath();c.moveTo(-.27,.47);c.lineTo(-.16,.49);c.moveTo(.27,.47);c.lineTo(.16,.49);c.stroke();
      c.shadowColor=color;c.shadowBlur=9;c.fillStyle=color;c.beginPath();c.arc(0,.5,tank?.095:.072,0,TAU);c.fill();c.shadowBlur=0;c.fillStyle='#ecffff';c.beginPath();c.arc(0,.5,.032,0,TAU);c.fill();
      c.fillStyle='#708da2';c.fillRect(-.05,.25,.1,.06);
      polygon([[-.21,.02],[.16,.02],[.23,.09],[.20,.25],[-.20,.25],[-.24,.08]],'#294363',color);
      c.fillStyle='#030c1b';c.fillRect(-.183,.089,.365,.096);
      c.shadowColor=color;c.shadowBlur=7;c.fillStyle=s.type==='sentry'&&s.attack<.65?'#ffed93':color;
      if(tank)c.fillRect(-.125,.122,.25,.028);
      else{c.fillRect(-.12,.119,.075,.035);c.fillRect(.045,.119,.075,.035)}
      c.shadowBlur=0;c.fillStyle='#95adc0';for(let i=0;i<3;i++)c.fillRect(-.04+i*.029,.205,.013,.008);
      c.strokeStyle='#618aa8';c.lineWidth=.012;c.beginPath();c.moveTo(.1,.01);c.lineTo(.13,-.065);c.stroke();c.fillStyle=color;c.beginPath();c.arc(.13,-.065,.018,0,TAU);c.fill();
      if(tank){c.fillStyle=color;c.fillRect(-.28,.34,.085,.035);c.fillRect(.195,.34,.085,.035)}
      c.restore();
    }
    function render(s,{running=false,dt=0,moving=false}={}){
      const w=canvas.width,h=canvas.height,p=s.player,horizon=h*.46,projection=w/(2*Math.tan(FOV/2)),depth=[],stride=2;
      hit=Math.max(0,hit-dt);kill=Math.max(0,kill-dt);banner=Math.max(0,banner-dt);if(moving)motion+=dt*9;
      effects.forEach(e=>e.life-=dt);effects=effects.filter(e=>e.life>0);
      c.save();
      const sky=c.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,'#050916');sky.addColorStop(1,'#1b214a');c.fillStyle=sky;c.fillRect(0,0,w,horizon);
      for(let i=0;i<38;i++){const x=((i*107.1-p.a*23)%w+w)%w,y=20+(i*43.7)%(horizon*.8);c.fillStyle=i%3?'#5180a333':'#83e5ff66';c.fillRect(x,y,1,1)}
      const floor=c.createLinearGradient(0,horizon,0,h);floor.addColorStop(0,'#11162d');floor.addColorStop(1,'#061d2c');c.fillStyle=floor;c.fillRect(0,horizon,w,h-horizon);
      const view=(x,y)=>({z:(x-p.x)*Math.cos(p.a)+(y-p.y)*Math.sin(p.a),x:-(x-p.x)*Math.sin(p.a)+(y-p.y)*Math.cos(p.a)});
      function floorLine(ax,ay,bx,by){let a=view(ax,ay),b=view(bx,by);if(a.z<.12&&b.z<.12)return;if(a.z<.12){const t=(.12-a.z)/(b.z-a.z);a={z:.12,x:a.x+t*(b.x-a.x)}}if(b.z<.12){const t=(.12-b.z)/(a.z-b.z);b={z:.12,x:b.x+t*(a.x-b.x)}}c.beginPath();c.moveTo(w/2+a.x/a.z*projection,horizon+projection*.5/a.z);c.lineTo(w/2+b.x/b.z*projection,horizon+projection*.5/b.z);c.stroke()}
      c.strokeStyle='#2999b023';c.lineWidth=1;for(let i=1;i<=11;i++){floorLine(i,1,i,11);floorLine(1,i,11,i)}
      for(let x=0;x<w;x+=stride){
        const offset=Math.atan((x-w/2)/projection),a=p.a+offset,raw=E.ray(p.x,p.y,a),d=raw*Math.cos(offset);depth[x/stride]=d;
        const height=projection/Math.max(.1,d),top=horizon-height/2,hx=p.x+Math.cos(a)*raw,hy=p.y+Math.sin(a)*raw;
        const fx=Math.min(hx%1,1-hx%1),fy=Math.min(hy%1,1-hy%1),edge=fx<fy?fy:fx,side=fx<fy;
        c.fillStyle=`hsl(${side?218:231},43%,${Math.max(9,27-d*1.5)-(side?3:0)}%)`;c.fillRect(x,top,stride,height);
        c.fillStyle='#030a1855';c.fillRect(x,top+height*.15,stride,height*.68);
        if(edge<.025){c.fillStyle=`rgba(36,218,255,${Math.max(.13,.7-d*.035)})`;c.fillRect(x,top,stride,height)}
        c.fillStyle='#6ddaff';c.globalAlpha=Math.max(.12,.75-d*.05);c.fillRect(x,top+height*.09,stride,Math.max(1,height*.018));
        c.fillStyle='#cb62dd';c.fillRect(x,top+height*.91,stride,Math.max(1,height*.012));c.globalAlpha=1;
        c.fillStyle='#51819d33';c.fillRect(x,top+height*.34,stride,1);c.fillRect(x,top+height*.66,stride,1);
        if(edge>.17&&edge<.23){c.fillStyle='#9aceef44';c.fillRect(x,top+height*.21,stride,height*.015);c.fillRect(x,top+height*.74,stride,height*.035)}
      }
      const sprites=[...s.enemies.map(e=>({...e,kind:'robot'})),...s.shots.map(e=>({...e,kind:'shot'})),...s.pickups.map(e=>({...e,kind:'pickup'})),...effects.map(e=>({...e,kind:'effect'}))].map(e=>({...e,...view(e.x,e.y)}));
      // view() returns camera x; retain world data in the simulation, never mutate it.
      sprites.sort((a,b)=>b.z-a.z);
      for(const e of sprites){
        if(e.z<.12)continue;const sx=w/2+e.x/e.z*projection,size=Math.min(h*2,projection/e.z*(e.kind==='robot'?.78:e.kind==='effect'?.65:.21)),top=horizon-size*.49+(e.kind==='pickup'?projection*.3/e.z:0);
        if(sx+size<0||sx-size>w)continue;
        c.save();c.beginPath();for(let x=Math.max(0,Math.floor((sx-size*.65)/stride)*stride);x<Math.min(w,sx+size*.65);x+=stride)if(e.z<depth[Math.floor(x/stride)]+.05)c.rect(x,0,stride,h);c.clip();
        if(e.kind==='robot'){
          robot(e,sx,top,size,s.time);
          if(e.hp>1||e.hit){const max=e.type==='tank'?4:e.type==='sentry'?2:1;c.fillStyle='#030917';c.fillRect(sx-size*.26,top-size*.13,size*.52,3);c.fillStyle=colors[e.type];c.fillRect(sx-size*.26,top-size*.13,size*.52*Math.max(0,e.hp)/max,3)}
        }else if(e.kind==='effect'){
          const age=1-e.life/e.total;c.globalAlpha=1-age;c.strokeStyle=colors[e.robot];c.fillStyle='#e9fbff';c.lineWidth=2;
          for(let i=0;i<(reduced()?4:9);i++){const a=i*2.4,r=size*(.08+age*.5),x=sx+Math.cos(a)*r,y=top+size*.5+Math.sin(a)*r;c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(a)*size*.08,y+Math.sin(a)*size*.08);c.stroke()}
          if(e.killed)text('+'+e.points,sx,top-age*24,14,'#c4fff1','center');
        }else{
          const color=e.kind==='shot'?'#ff63b7':colors[e.type],cy=top+size*.5+(reduced()?0:Math.sin(s.time*4)*3);c.shadowColor=color;c.shadowBlur=13;c.fillStyle=color;
          if(e.kind==='shot'){c.beginPath();c.arc(sx,cy,size*.34,0,TAU);c.fill();c.fillStyle='#fff1fa';c.beginPath();c.arc(sx,cy,size*.12,0,TAU);c.fill()}
          else{c.save();c.translate(sx,cy);c.rotate(Math.PI/4);c.fillRect(-size*.3,-size*.3,size*.6,size*.6);c.restore();c.shadowBlur=0;text(e.type==='health'?'+':e.type==='shield'?'S':'↯',sx,cy+size*.18,Math.max(10,size*.55),'#082135','center')}
        }c.restore();
      }
      // Vignette frames action without a strobing full-screen hit flash.
      const vignette=c.createRadialGradient(w/2,h*.48,w*.22,w/2,h*.48,h*.82);vignette.addColorStop(0,'#0000');vignette.addColorStop(1,'#010410aa');c.fillStyle=vignette;c.fillRect(0,0,w,h);
      const recoil=reduced()?0:s.flash/.1*8,bob=reduced()||!moving?0:Math.sin(motion)*2,gx=w*.53+bob,gy=h-12+recoil;
      c.save();c.translate(gx,gy);c.lineWidth=1;
      polygon([[-66,15],[-51,-40],[-29,-60],[29,-60],[54,-36],[72,15]],'#142840','#416079');
      polygon([[-32,16],[-27,-76],[-17,-96],[18,-96],[29,-73],[39,16]],'#263c57','#6b8396');
      polygon([[-15,-86],[14,-86],[20,-30],[-20,-30]],'#071526','#22c7e5');
      c.shadowColor=s.overdrive>0?'#ffcb54':'#49e9ff';c.shadowBlur=12;c.fillStyle=s.overdrive>0?'#ffe68a':'#5df5ff';c.fillRect(-10,-87,20,6);c.fillRect(-23,-48,4,39);c.fillRect(25,-48,4,39);c.shadowBlur=0;
      polygon([[-12,-22],[15,-22],[20,12],[-15,12]],'#d55bba','#fe95e9');c.fillStyle='#311b48';for(let i=0;i<3;i++)c.fillRect(-7,-15+i*8,19,3);
      c.fillStyle='#041320';c.fillRect(-10,-66,20,23);text('01',0,-51,8,'#71e8ff','center');
      c.restore();
      if(s.flash>0){
        const alpha=s.flash/.1;c.globalAlpha=alpha;c.strokeStyle=s.overdrive>0?'#fff0ac':'#9effff';c.lineWidth=3;c.beginPath();c.moveTo(gx,gy-92);c.lineTo(w/2,horizon);c.stroke();c.lineWidth=9;c.globalAlpha=alpha*.18;c.stroke();c.globalAlpha=alpha;
        c.fillStyle='#ddffff';c.beginPath();c.arc(gx,gy-95,4+alpha*7,0,TAU);c.fill();c.globalAlpha=1;
      }
      const spread=7+(s.flash/.1)*3;c.strokeStyle=hit>0?'#fff0a9':'#bfe7ef';c.lineWidth=1.5;c.beginPath();for(let i=0;i<4;i++){const a=i*Math.PI/2;c.moveTo(w/2+Math.cos(a)*spread,horizon+Math.sin(a)*spread);c.lineTo(w/2+Math.cos(a)*(spread+5),horizon+Math.sin(a)*(spread+5))}c.stroke();c.fillStyle='#dfffff';c.fillRect(w/2-1,horizon-1,2,2);
      if(hit>0){c.strokeStyle=kill>0?'#ffdf79':'#fff';c.lineWidth=2;c.beginPath();for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2;c.moveTo(w/2+Math.cos(a)*5,horizon+Math.sin(a)*5);c.lineTo(w/2+Math.cos(a)*11,horizon+Math.sin(a)*11)}c.stroke()}
      if(s.hurt>0){c.strokeStyle=s.shield>0?'#80d9ff':`rgba(255,77,108,${s.hurt*1.6})`;c.lineWidth=7;c.strokeRect(3,3,w-6,h-6)}
      // Compact HUD remains legible in portrait and landscape.
      c.fillStyle='#030c1bbd';c.fillRect(9,9,112,40);text(`WAVE ${String(Math.max(1,s.wave)).padStart(2,'0')}`,18,25,11,'#80e8fb');text(`${s.enemies.length} HOSTILES`,18,40,9,'#97b2c7');
      const seconds=Math.max(0,Math.ceil(180-s.time));text(`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`,w-16,29,16,seconds<30?'#ffc997':'#d3edf5','right');
      const healthColor=p.hp<=25?'#ff7b92':s.shield>0?'#76cfff':'#78f4ce';text(s.shield>0?'SHIELD':'HULL',16,h-39,9,healthColor);text(`${p.hp}`,16,h-20,17,healthColor);c.fillStyle='#162e40';c.fillRect(16,h-12,85,3);c.fillStyle=healthColor;c.fillRect(16,h-12,85*p.hp/100,3);
      let by=h-39;for(const key of ['shield','overdrive'])if(s[key]>0){text(`${key==='shield'?'SHIELD':'RAPID FIRE'} ${Math.ceil(s[key])}s`,w-16,by,9,colors[key],'right');c.fillStyle='#263142';c.fillRect(w-91,by+6,75,3);c.fillStyle=colors[key];c.fillRect(w-91,by+6,75*s[key]/8,3);by-=29}
      if(banner>0&&running){c.globalAlpha=Math.min(1,banner*2);text(bannerText,w/2,Math.min(horizon*.55,95),24,'#c5f9ff','center');text(s.wave===1?'BREACH THE PERIMETER':'REINFORCEMENTS DETECTED',w/2,Math.min(horizon*.55,95)+18,9,'#70cddd','center');c.globalAlpha=1}
      if(!s.enemies.length&&running&&banner===0)text(s.wave?'SECTOR CLEAR · RECHARGING':'SCANNING FOR HOSTILES',w/2,65,10,'#88f8d7','center');
      c.restore();
    }
    return {render,event,reset};
  }
  window.NeonBreachRenderer={create};
})();
