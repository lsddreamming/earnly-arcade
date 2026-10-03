/* Perspective-textured sector, cached robot animation, and bounded combat effects. */
(()=>{
  'use strict';
  const E=NeonBreachEngine,FOV=1.25,TAU=Math.PI*2;
  const colors={rusher:'#45e3ff',sentry:'#ff66bc',tank:'#b59aff',health:'#64ffc4',shield:'#69bcff',overdrive:'#ffdf78'};
  function create(canvas){
    const c=canvas.getContext('2d'),art=NeonBreachArt.create(),plane=document.createElement('canvas'),pc=plane.getContext('2d');
    let planeImage;let effects=[],hit=0,kill=0,banner=0,bannerText='',motion=0,laser=null,damageFrom=null,streak=0,streakClock=0,streakBanner=0,sway=0,lastAngle=null;
    const lamps=[{x:2.5,y:5.5,color:'#ffc17c'},{x:8.5,y:9.5,color:'#61e4f0'},{x:14.5,y:12.5,color:'#b896ff'}];
    const reduced=()=>typeof Arcade!=='undefined'&&Arcade.reducedMotionEnabled();
    function reset(){effects=[];hit=kill=banner=motion=streak=streakClock=streakBanner=sway=0;laser=damageFrom=null;lastAngle=null}
    function event(e){
      if(e.type==='wave'){banner=2;bannerText=`WAVE ${String(e.wave).padStart(2,'0')}`;streakClock=0}
      if(e.type==='fire')laser={x:e.x,y:e.y};
      if(e.type==='damage')damageFrom={x:e.x,y:e.y,shield:e.shield,life:.8};
      if(e.type==='impact'){
        hit=.18;kill=e.killed?.7:kill;
        effects.push({...e,life:e.killed?.7:.22,total:e.killed?.7:.22});
        if(e.killed){streak=streakClock>0?streak+1:1;streakClock=2.5;if(streak>=2)streakBanner=1.25}
      }
      if(e.type==='wall-impact')effects.push({...e,life:1.2,total:1.2});
      if(effects.length>24)effects.shift();
    }
    function polygon(points,fill,stroke){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.stroke()}}
    function text(value,x,y,size,color='#d6f6ff',align='left'){c.font=`${size>18?800:600} ${size}px system-ui`;c.fillStyle=color;c.textAlign=align;c.fillText(value,x,y)}
    // Exact grid intersections prevent wall textures swimming while the player turns.
    function cast(px,py,dx,dy){
      let mx=Math.floor(px),my=Math.floor(py),side=0;
      const ddx=Math.abs(1/dx),ddy=Math.abs(1/dy),stepX=dx<0?-1:1,stepY=dy<0?-1:1;
      let tx=(dx<0?px-mx:mx+1-px)*ddx,ty=(dy<0?py-my:my+1-py)*ddy;
      for(let i=0;i<64;i++){
        if(tx<ty){tx+=ddx;mx+=stepX;side=0}else{ty+=ddy;my+=stepY;side=1}
        if(E.MAP[my]?.[mx]!=='0')break;
      }
      const distance=Math.max(.001,side?ty-ddy:tx-ddx),hit=side?px+distance*dx:py+distance*dy;
      let u=hit-Math.floor(hit);if((!side&&dx<0)||(side&&dy>0))u=1-u;
      return {distance,u,side,mx,my};
    }
    function planes(p,w,h,horizon,projection,flash){
      // Bounded surfaces keep the texture cost fixed on high-density phones.
      const pw=320,ph=Math.ceil(h*.8);
      if(plane.width!==pw||plane.height!==ph){plane.width=pw;plane.height=ph;planeImage=pc.createImageData(pw,ph)}
      const data=planeImage.data,ca=Math.cos(p.a),sa=Math.sin(p.a);
      for(let y=0;y<ph;y++){
        const sy=(y+.5)*h/ph,ceiling=sy<horizon,d=Math.min(48,projection*.5/Math.max(1,Math.abs(sy-horizon)));
        const footprint=Math.max(d*w/projection/pw,d*d*2/projection*h/ph)*256;
        const lod=Math.max(0,Math.min(8,Math.floor(Math.log2(Math.max(1,footprint)))));
        const mip=(ceiling?art.ceiling:art.floor)[lod],texture=mip.data,ts=mip.size;
        const fog=Math.min(.92,d/24),shade=(ceiling?.62:.88)*(1-fog);
        const spread=w/(2*projection),stepX=-sa*2*spread*d/pw,stepY=ca*2*spread*d/pw;
        let wx=p.x+ca*d+sa*spread*d,wy=p.y+sa*d-ca*spread*d;
        const muzzle=ceiling?0:Math.max(0,1-d/4)*flash*2.1;
        for(let x=0;x<pw;x++,wx+=stepX,wy+=stepY){
          const u=Math.floor(wx*ts)&(ts-1),v=Math.floor(wy*ts)&(ts-1),k=(v*ts+u)*4,i=(y*pw+x)*4;
          // Small embedded runway lamps follow world coordinates as the camera moves.
          const guide=!ceiling&&d<7&&u/ts<.02&&(Math.floor(wx)&3)===0&&v/ts>.3&&v/ts<.7;
          const warm=wx<5.5?.13:0,violet=wx>12?.12:0;
          data[i]=texture[k]*shade*(1+warm+violet)+12*fog+muzzle*12+(guide?12:0);
          data[i+1]=texture[k+1]*shade*(1-violet*.5)+25*fog+muzzle*46+(guide?76:0);
          data[i+2]=texture[k+2]*shade*(1-warm*.7+violet)+39*fog+muzzle*60+(guide?89:0);data[i+3]=255;
        }
      }
      pc.putImageData(planeImage,0,0);c.drawImage(plane,0,0,w,h);
    }
    function robot(s,x,y,size,time){
      const calm=reduced(),cycle=s.stride??time*(s.type==='tank'?5:9),frame=calm?0:Math.floor((cycle+(s.phase||0))/TAU*8)%8;
      const sprite=art.robot(s.type,s.elite,frame),accent=s.elite?'#ffcf78':colors[s.type],spawn=Math.min(1,(s.spawn||0)/.55),charge=s.charge||0;
      const recoil=calm?0:(s.firing||0)*.18,lean=calm?0:Math.sin(cycle)*.012*(s.motion??1)+(s.hit?-.025:0);
      c.fillStyle='#0008';c.beginPath();c.ellipse(x,y+size*1.018,size*(s.type==='tank'?.38:.29),size*.065,0,0,TAU);c.fill();
      c.save();c.translate(x,y+size);c.rotate(lean);c.translate(0,-size);c.scale(1,1-recoil);
      c.globalAlpha=1-spawn*.55;
      c.drawImage(sprite,-size*.666,-size*.15,size*1.333,size*1.333);
      if(s.hit){c.save();c.globalAlpha=Math.min(.65,s.hit*5);c.globalCompositeOperation='screen';c.drawImage(sprite,-size*.666,-size*.15,size*1.333,size*1.333);c.restore()}
      c.globalAlpha=1;
      if(s.hp/(s.maxHp||1)<=.5){
        c.strokeStyle='#07111d';c.lineWidth=Math.max(1,size*.012);c.beginPath();c.moveTo(-size*.15,size*.33);c.lineTo(-size*.09,size*.38);c.lineTo(-size*.13,size*.42);c.lineTo(-size*.06,size*.46);c.stroke();
        if(!calm&&Math.sin(time*13+(s.phase||0))>.5){c.strokeStyle='#ffdf96';c.lineWidth=1;c.beginPath();c.moveTo(-size*.09,size*.4);c.lineTo(-size*.19,size*.44);c.lineTo(-size*.13,size*.46);c.stroke()}
      }
      if(charge>0||s.firing>0){
        const strength=s.firing>0?1:charge,radius=size*(s.firing>0?.13:.035+charge*.035);
        for(const side of [-1,1]){
          const cx=side*size*(s.type==='tank'?.38:.285),cy=size*(s.type==='sentry'?.622:.67),glint=c.createRadialGradient(cx,cy,0,cx,cy,radius);
          glint.addColorStop(0,'#fff4dfee');glint.addColorStop(.24,s.type==='sentry'?'#ff8ebdcc':'#ffc26bbb');glint.addColorStop(1,'#ff905500');
          c.save();c.globalAlpha=strength;c.fillStyle=glint;c.fillRect(cx-radius,cy-radius,radius*2,radius*2);c.restore();
        }
        c.strokeStyle='#ffdca2';c.globalAlpha=.3+charge*.7;c.lineWidth=1;c.beginPath();c.arc(0,size*.471,size*(.08+charge*.045),0,TAU);c.stroke();c.globalAlpha=1;
      }
      c.restore();
      if(spawn>0){
        c.strokeStyle=accent;c.globalAlpha=spawn*.7;c.lineWidth=1;c.beginPath();c.ellipse(x,y+size*1.01,size*.45,size*.09,0,0,TAU);c.stroke();
        if(!calm){const scan=y+size*(1-spawn);c.beginPath();c.moveTo(x-size*.36,scan);c.lineTo(x+size*.36,scan);c.stroke()}c.globalAlpha=1;
      }
      if(s.elite){c.fillStyle=accent;c.beginPath();c.moveTo(x,y-size*.12);c.lineTo(x-3,y-size*.12-4);c.lineTo(x+3,y-size*.12-4);c.fill()}
    }
    function render(s,{running=false,dt=0,moving=false}={}){
      const scale=canvas.width/400,w=400,h=canvas.height/scale,p=s.player,horizon=h*.46,projection=w/(2*Math.tan(FOV/2)),depth=[],stride=1;
      hit=Math.max(0,hit-dt);kill=Math.max(0,kill-dt);banner=Math.max(0,banner-dt);streakClock=Math.max(0,streakClock-dt);streakBanner=Math.max(0,streakBanner-dt);if(moving)motion+=dt*9;
      if(damageFrom){damageFrom.life-=dt;if(damageFrom.life<=0)damageFrom=null}
      if(dt>0){const turn=lastAngle===null?0:E.angle(p.a-lastAngle);sway+=(Math.max(-5,Math.min(5,-turn*42))-sway)*Math.min(1,dt*12)}lastAngle=p.a;
      effects.forEach(e=>e.life-=dt);effects=effects.filter(e=>e.life>0);
      c.save();
      c.scale(scale,scale);
      planes(p,w,h,horizon,projection,s.flash);
      const ca=Math.cos(p.a),sa=Math.sin(p.a);
      const view=(x,y)=>({z:(x-p.x)*ca+(y-p.y)*sa,x:-(x-p.x)*sa+(y-p.y)*ca});
      for(let x=0;x<w;x+=stride){
        const cameraX=(x+.5-w/2)/projection,ray=cast(p.x,p.y,ca-sa*cameraX,sa+ca*cameraX),d=ray.distance;
        depth[x]=d;
        const height=projection/Math.max(.08,d),top=horizon-height/2;
        const material=[1,0,1,3,1,2][Math.abs(ray.mx*3+ray.my*5+ray.side)%6];
        const tx=Math.min(255,Math.floor(ray.u*256));
        c.drawImage(art.walls[material],tx,0,1,256,x,top,stride,height);
        c.fillStyle='#020a16';c.globalAlpha=Math.min(.8,.12+d*.035+(ray.side?.12:0));c.fillRect(x,top,stride,height);c.globalAlpha=1;
        if(ray.mx<5||ray.mx>12){c.fillStyle=ray.mx<5?'#ef9c54':'#9a64ed';c.globalAlpha=.055;c.fillRect(x,top,stride,height);c.globalAlpha=1}
        if(s.flash>0&&d<4){c.fillStyle=`rgba(90,230,255,${s.flash*Math.max(0,1-d/4)})`;c.fillRect(x,top,stride,height)}
      }
      const sprites=[...lamps.map(e=>({...e,kind:'lamp'})),...s.enemies.map(e=>({...e,kind:'robot'})),...s.shots.map(e=>({...e,kind:'shot'})),...s.pickups.map(e=>({...e,kind:'pickup'})),...effects.map(e=>({...e,kind:e.type==='wall-impact'?'wall-impact':'effect'}))].map(e=>({...e,...view(e.x,e.y)}));
      // view() returns camera x; retain world data in the simulation, never mutate it.
      sprites.sort((a,b)=>b.z-a.z);
      for(const e of sprites){
        if(e.z<.12)continue;const sx=w/2+e.x/e.z*projection,size=Math.min(h*2,projection/e.z*(e.kind==='robot'?.82:e.kind==='lamp'?1.3:e.kind==='effect'?.65:.28)),top=e.kind==='robot'?horizon+projection*.5/e.z-size*1.015:horizon-size*.49+(e.kind==='pickup'?projection*.3/e.z:0);
        if(sx+size<0||sx-size>w)continue;
        const clipRadius=e.kind==='effect'&&e.killed?size:size*.65;
        // Merge visible columns into spans: complex per-pixel clip paths are costly on WebKit.
        const left=Math.max(0,Math.floor(sx-clipRadius)),right=Math.min(w,Math.ceil(sx+clipRadius)),spans=[];let open=-1;
        for(let x=left;x<right;x++){
          const visible=e.z<depth[x]+.05;
          if(visible&&open<0)open=x;
          if(!visible&&open>=0){spans.push([open,x-open]);open=-1}
        }
        if(open>=0)spans.push([open,right-open]);if(!spans.length)continue;
        c.save();c.beginPath();for(const [x,width] of spans)c.rect(x,0,width,h);c.clip();
        if(e.kind==='lamp'){
          const height=projection/e.z,ceiling=horizon-height*.5,light=art.lamp(e.color);
          c.drawImage(light,sx-height*192/260,ceiling-height*20/260,height*384/260,height*320/260);
        }else if(e.kind==='wall-impact'){
          const age=1-e.life/e.total,cy=horizon;
          c.globalAlpha=Math.min(1,e.life*2);c.fillStyle='#050b11';c.beginPath();c.ellipse(sx,cy,Math.max(1,size*.10),Math.max(1,size*.14),.4,0,TAU);c.fill();
          if(age<.3){c.globalAlpha=1-age/.3;c.strokeStyle='#ffcfa2';c.lineWidth=1.2;for(let i=0;i<(reduced()?3:6);i++){const a=i*2.4,r=size*(.08+age*1.4);c.beginPath();c.moveTo(sx+Math.cos(a)*r,cy+Math.sin(a)*r);c.lineTo(sx+Math.cos(a)*(r+size*.12),cy+Math.sin(a)*(r+size*.12));c.stroke()}}
        }else if(e.kind==='robot'){
          robot(e,sx,top,size,s.time);
          if(e.hp>1||e.hit){const max=e.maxHp||(e.type==='tank'?4:e.type==='sentry'?2:1);c.fillStyle='#030917';c.fillRect(sx-size*.26,top-size*.13,size*.52,3);c.fillStyle=e.elite?'#ffcf78':colors[e.type];c.fillRect(sx-size*.26,top-size*.13,size*.52*Math.max(0,e.hp)/max,3)}
        }else if(e.kind==='effect'){
          const age=1-e.life/e.total;
          if(e.killed&&age<.65&&!reduced()){
            const bodySize=projection/e.z*.82,ground=horizon+projection*.5/e.z,sprite=art.robot(e.robot,e.elite,0);
            c.save();c.globalAlpha=(1-age/.65)*.65;c.translate(sx,ground);c.rotate(Math.sin(e.phase||1)*age*.65);c.scale(1,Math.max(.2,1-age*.8));c.drawImage(sprite,-bodySize*.666,-bodySize*1.165,bodySize*1.333,bodySize*1.333);c.restore();
          }
          c.globalAlpha=1-age;c.strokeStyle=colors[e.robot];c.fillStyle='#e9fbff';c.lineWidth=2;
          const count=reduced()?4:e.killed?12:7;
          for(let i=0;i<count;i++){
            const a=i*2.4,r=size*(.07+age*(e.killed?.64:.27)),px=sx+Math.cos(a)*r,py=top+size*.5+Math.sin(a)*r+age*age*size*.25;
            c.strokeStyle=i%3?colors[e.robot]:'#ffe5ab';c.lineWidth=i%3?1.5:2.5;c.beginPath();c.moveTo(px,py);c.lineTo(px+Math.cos(a)*size*.075,py+Math.sin(a)*size*.075);c.stroke();
            if(e.killed&&i%3===0){c.save();c.translate(px,py);c.rotate(a+age*3);c.fillStyle='#9fb7c6';c.fillRect(-size*.025,-size*.014,size*.05,size*.028);c.restore()}
          }
          c.strokeStyle=colors[e.robot];c.lineWidth=1;c.beginPath();c.ellipse(sx,top+size*.5,size*(.08+age*.5),size*(.035+age*.18),0,0,TAU);c.stroke();
          c.fillStyle='#eeffff';c.beginPath();c.arc(sx,top+size*.5,Math.max(0,size*.035*(1-age)),0,TAU);c.fill();
          if(e.killed)text('+'+e.points,sx,top-age*24,14,'#c4fff1','center');
        }else{
          const color=e.kind==='shot'?'#ff63b7':colors[e.type],ground=horizon+projection*.5/e.z;
          const cy=e.kind==='shot'?horizon:ground-size*.85+(reduced()?0:Math.sin(s.time*3)*size*.04);
          if(e.kind==='shot'){
            const angle=Math.atan2(e.vy||0,e.vx||0)-p.a,tailX=sx-Math.sin(angle)*size*1.4;
            c.strokeStyle='#ff6cbd88';c.lineWidth=Math.max(1,size*.12);c.beginPath();c.moveTo(tailX,cy+size*.12);c.lineTo(sx,cy);c.stroke();
            c.shadowColor=color;c.shadowBlur=12;c.fillStyle=color;c.beginPath();c.arc(sx,cy,size*.24,0,TAU);c.fill();c.fillStyle='#fff1fa';c.beginPath();c.arc(sx,cy,size*.095,0,TAU);c.fill();
          }else{
            c.strokeStyle=color+'66';c.lineWidth=1;c.beginPath();c.ellipse(sx,ground,size*.48,size*.13,0,0,TAU);c.stroke();
            c.fillStyle=color+'15';c.fill();c.beginPath();c.moveTo(sx,ground);c.lineTo(sx,cy-size*.65);c.stroke();
            const left=sx-size*.33,right=sx+size*.33;
            polygon([[sx,cy-size*.48],[right,cy-size*.27],[right,cy+size*.21],[sx,cy+size*.44],[left,cy+size*.21],[left,cy-size*.27]],'#0b2639',color);
            polygon([[sx,cy-size*.48],[right,cy-size*.27],[sx,cy-size*.08],[left,cy-size*.27]],color+'55',color);
            c.shadowColor=color;c.shadowBlur=7;c.fillStyle=color;
            if(e.type==='health'){c.fillRect(sx-size*.055,cy-size*.14,size*.11,size*.36);c.fillRect(sx-size*.17,cy-size*.015,size*.34,size*.11)}
            else if(e.type==='shield')polygon([[sx,cy-size*.17],[sx+size*.15,cy-size*.12],[sx+size*.12,cy+size*.10],[sx,cy+size*.23],[sx-size*.12,cy+size*.10],[sx-size*.15,cy-size*.12]],color);
            else polygon([[sx+size*.04,cy-size*.20],[sx-size*.15,cy+size*.04],[sx-size*.015,cy+size*.04],[sx-size*.055,cy+size*.23],[sx+size*.17,cy-size*.02],[sx+size*.04,cy-size*.02]],color);
            c.shadowBlur=0;
            if(e.z<2.8)text(e.type==='health'?'REPAIR':e.type==='shield'?'SHIELD':'OVERDRIVE',sx,ground+size*.38,Math.max(7,Math.min(10,size*.16)),color,'center');
          }
        }c.restore();
      }
      // Vignette frames action without a strobing full-screen hit flash.
      const vignette=c.createRadialGradient(w/2,h*.48,w*.3,w/2,h*.48,h*.9);vignette.addColorStop(0,'#0000');vignette.addColorStop(1,'#01041088');c.fillStyle=vignette;c.fillRect(0,0,w,h);
      const recoil=reduced()?0:s.flash/.1*8,bob=reduced()||!moving?0:Math.sin(motion)*2,gx=w*.53+bob+(reduced()?0:sway),gy=h-12+recoil;
      c.save();c.translate(gx,gy);c.lineWidth=1;
      const metal=c.createLinearGradient(-40,-100,42,5);metal.addColorStop(0,'#a2b8c4');metal.addColorStop(.32,'#57778d');metal.addColorStop(.48,'#263d54');metal.addColorStop(1,'#0c1b2d');
      const energy=s.overdrive>0?'#ffcf65':'#64eaf7';
      // Armored gloves frame a beveled receiver, ribbed barrel, and illuminated coils.
      polygon([[-91,18],[-73,-13],[-57,-24],[-35,-17],[-24,17]],'#162838','#41586c');
      polygon([[89,18],[76,-12],[58,-23],[38,-12],[31,18]],'#162838','#41586c');
      for(const side of [-1,1]){polygon([[side*54,-17],[side*68,-10],[side*73,4],[side*51,7]],'#304657','#647886');c.strokeStyle='#0c1825';c.beginPath();c.moveTo(side*57,-8);c.lineTo(side*67,-2);c.moveTo(side*55,-2);c.lineTo(side*65,4);c.stroke()}
      polygon([[-46,15],[-47,-40],[-28,-69],[27,-69],[46,-40],[49,15]],metal,'#7e9aa9');
      polygon([[-29,-21],[-25,-78],[-17,-100],[15,-100],[25,-78],[30,-21]],metal,'#8faebb');
      polygon([[-13,-98],[12,-98],[17,-80],[-17,-80]],'#081521','#a3bfca');
      c.fillStyle='#101d2d';c.fillRect(-11,-96,20,7);c.fillStyle=energy;c.fillRect(-8,-93,14,3);
      polygon([[-14,-79],[14,-79],[19,-29],[-19,-29]],'#101e2e','#3c647e');
      for(let i=0;i<5;i++){c.fillStyle='#849da9';c.fillRect(-12-i*.6,-75+i*8,24+i*1.2,2);c.fillStyle='#233c4c';c.fillRect(-13-i*.6,-72+i*8,26+i*1.2,2)}
      c.shadowColor=energy;c.shadowBlur=9;c.fillStyle=energy;
      polygon([[-25,-68],[-21,-70],[-19,-29],[-24,-25]],energy);
      polygon([[22,-69],[25,-65],[27,-25],[22,-29]],energy);c.shadowBlur=0;
      polygon([[-38,-22],[-28,-30],[-25,12],[-40,12]],'#193249','#476d85');
      polygon([[28,-30],[39,-20],[43,12],[28,12]],'#193249','#476d85');
      c.fillStyle='#081522';for(const side of [-1,1])for(let i=0;i<4;i++)c.fillRect(side*34-3,-15+i*6,7,3);
      polygon([[-17,-26],[17,-26],[22,12],[-20,12]],'#627f91','#a3bcc6');
      polygon([[-12,-19],[12,-19],[14,5],[-13,5]],'#05131e',energy);
      text(s.overdrive>0?'OVR':'P-07',0,-8,7,energy,'center');
      c.fillStyle=energy;for(let i=0;i<5;i++)c.fillRect(-8+i*4,-3,2,4);
      for(const side of [-1,1]){c.fillStyle='#adc2c9';c.beginPath();c.arc(side*27,-17,1.6,0,TAU);c.fill()}
      c.restore();
      if(s.flash>0){
        const alpha=s.flash/.1,endpoint=laser?view(laser.x,laser.y):null,endX=endpoint&&endpoint.z>.08?w/2+endpoint.x/endpoint.z*projection:w/2;c.globalAlpha=alpha;c.strokeStyle=s.overdrive>0?'#fff0ac':'#9effff';c.lineWidth=3;c.beginPath();c.moveTo(gx,gy-92);c.lineTo(Math.max(0,Math.min(w,endX)),horizon);c.stroke();c.lineWidth=9;c.globalAlpha=alpha*.18;c.stroke();c.globalAlpha=alpha;
        c.fillStyle='#ddffff';c.beginPath();c.arc(gx,gy-95,4+alpha*7,0,TAU);c.fill();c.globalAlpha=1;
      }
      const spread=7+(s.flash/.1)*3;c.strokeStyle=hit>0?'#fff0a9':'#bfe7ef';c.lineWidth=1.5;c.beginPath();for(let i=0;i<4;i++){const a=i*Math.PI/2;c.moveTo(w/2+Math.cos(a)*spread,horizon+Math.sin(a)*spread);c.lineTo(w/2+Math.cos(a)*(spread+5),horizon+Math.sin(a)*(spread+5))}c.stroke();c.fillStyle='#dfffff';c.fillRect(w/2-1,horizon-1,2,2);
      if(hit>0){c.strokeStyle=kill>0?'#ffdf79':'#fff';c.lineWidth=2;c.beginPath();for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2;c.moveTo(w/2+Math.cos(a)*5,horizon+Math.sin(a)*5);c.lineTo(w/2+Math.cos(a)*11,horizon+Math.sin(a)*11)}c.stroke()}
      if(s.hurt>0){c.strokeStyle=s.shield>0?'#80d9ff':`rgba(255,77,108,${s.hurt*1.6})`;c.lineWidth=7;c.strokeRect(3,3,w-6,h-6)}
      if(damageFrom){
        const a=E.angle(Math.atan2(damageFrom.y-p.y,damageFrom.x-p.x)-p.a),dx=Math.sin(a),dy=-Math.cos(a);
        c.save();c.globalAlpha=Math.min(1,damageFrom.life*2);c.translate(w/2+dx*w*.39,horizon+dy*Math.min(h*.30,105));c.rotate(a);
        polygon([[-8,7],[0,-5],[8,7],[0,3]],damageFrom.shield?'#7cdfff':'#ffb384');c.restore();
      }
      // Compact HUD remains legible in portrait and landscape.
      c.fillStyle='#030c1bbd';c.fillRect(9,9,112,40);text(`WAVE ${String(Math.max(1,s.wave)).padStart(2,'0')}`,18,25,11,'#80e8fb');text(`${s.enemies.length} HOSTILES`,18,40,9,'#97b2c7');
      const seconds=Math.max(0,Math.ceil(180-s.time));text(`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`,w-16,29,16,seconds<30?'#ffc997':'#d3edf5','right');
      // North-up radar makes the expanded routes and nearby threats readable.
      const radar=57,rx=w-radar-14,ry=43,cell=radar/E.MAP.length;
      c.fillStyle='#030d1cbb';c.fillRect(rx-3,ry-3,radar+6,radar+6);
      for(let y=0;y<E.MAP.length;y++)for(let x=0;x<E.MAP[y].length;x++)if(E.MAP[y][x]==='1'){c.fillStyle='#38566f';c.fillRect(rx+x*cell,ry+y*cell,Math.max(1,cell-.5),Math.max(1,cell-.5))}
      for(const enemy of s.enemies)if(Math.hypot(enemy.x-p.x,enemy.y-p.y)<6.5){c.fillStyle=enemy.elite?'#ffcf78':colors[enemy.type];c.fillRect(rx+enemy.x*cell-1,ry+enemy.y*cell-1,2,2)}
      c.save();c.translate(rx+p.x*cell,ry+p.y*cell);c.rotate(p.a);polygon([[3,0],[-2,-2],[-2,2]],'#e9ffff');c.restore();
      if(s.wave>=6)text(s.wave>=10?'THREAT: EXTREME':'THREAT: HIGH',18,62,8,'#ffcf78');
      const healthColor=p.hp<=25?'#ff7b92':s.shield>0?'#76cfff':'#78f4ce';text(s.shield>0?'SHIELD':'HULL',16,h-39,9,healthColor);text(`${p.hp}`,16,h-20,17,healthColor);c.fillStyle='#162e40';c.fillRect(16,h-12,85,3);c.fillStyle=healthColor;c.fillRect(16,h-12,85*p.hp/100,3);
      let by=h-39;for(const key of ['shield','overdrive'])if(s[key]>0){text(`${key==='shield'?'SHIELD':'RAPID FIRE'} ${Math.ceil(s[key])}s`,w-16,by,9,colors[key],'right');c.fillStyle='#263142';c.fillRect(w-91,by+6,75,3);c.fillStyle=colors[key];c.fillRect(w-91,by+6,75*s[key]/8,3);by-=29}
      if(banner>0&&running){c.globalAlpha=Math.min(1,banner*2);text(bannerText,w/2,Math.min(horizon*.55,95),24,'#c5f9ff','center');text(s.wave===1?'BREACH THE PERIMETER':'REINFORCEMENTS DETECTED',w/2,Math.min(horizon*.55,95)+18,9,'#70cddd','center');c.globalAlpha=1}
      if(streakBanner>0&&banner===0&&running){c.globalAlpha=Math.min(1,streakBanner*3);text(streak===2?'DOUBLE TAKEDOWN':streak===3?'TRIPLE TAKEDOWN':`${streak} / SYSTEM WIPE`,w/2,78,12,'#ffdc9a','center');c.globalAlpha=1}
      if(!s.enemies.length&&running&&banner===0&&streakBanner===0)text(s.wave?'SECTOR CLEAR · RECHARGING':'SCANNING FOR HOSTILES',w/2,65,10,'#88f8d7','center');
      c.restore();
    }
    return {render,event,reset};
  }
  window.NeonBreachRenderer={create};
})();
