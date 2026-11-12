/* Original Big Fish Energy artwork and 2.5D presentation. No downloaded assets. */
(function (root) {
  'use strict';
  const palettes = [
    ['#087f9d','#06465d','#032c41','#43dfcc'],
    ['#086d9a','#06395d','#06263f','#56caf5'],
    ['#165989','#092e4b','#081d32','#88badc'],
    ['#1b355c','#101d3c','#080e25','#b58dff'],
    ['#2a2456','#171434','#0a0c23','#ff92dc'],
    ['#19264e','#0c1430','#050a1c','#69f3e5']
  ];
  const TAU = Math.PI * 2;
  const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const mix = (a,b,t) => a + (b-a)*t;
  function create(canvas, state) {
    let ctx = canvas.getContext('2d', { alpha:false });
    if (!ctx) throw new Error('Canvas graphics unavailable');
    let width=1,height=1,dpr=1,time=0,alive=true;
    const camera={x:state.player.x,y:state.player.y,zoom:1};
    const sparks=[],growthRings=[];
    const initialSize = Math.max(.01,state.player.size || 1);
    let initialized=false,biteUntil=0,drawCost=0,slowFrames=0,reduced=false;
    const sprites=new Map();
    function resize() {
      const box=canvas.getBoundingClientRect(); width=Math.max(1,box.width);height=Math.max(1,box.height);
      dpr=Math.min(reduced?1:(width<800?1.5:2),window.devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    function project(x,y) { return {x:(x-camera.x)*camera.zoom+width*.5,y:(y-camera.y)*camera.zoom+height*.53}; }
    function direction(clientX,clientY) {
      const box=canvas.getBoundingClientRect(),p=project(state.player.x,state.player.y);
      const dx=clientX-box.left-p.x,dy=clientY-box.top-p.y,dist=Math.hypot(dx,dy);
      if (dist<9) return {x:0,y:0};
      const amount=Math.min(1,(dist-9)/36);return {x:dx/dist*amount,y:dy/dist*amount};
    }
    function burst(x,y,hue) {
      biteUntil=time+.2;
      growthRings.push({life:.55,max:.55});if(growthRings.length>4)growthRings.shift();
      for(let i=0;i<12;i++) {const a=TAU*i/12; sparks.push({x,y,vx:Math.cos(a)*26/camera.zoom,vy:Math.sin(a)*26/camera.zoom,life:.65,max:.65,hue:hue??43,r:2+hash(i+time)*3});}
      if(sparks.length>120)sparks.splice(0,sparks.length-120);
    }
    function ellipse(x,y,rx,ry,fill,angle) {ctx.beginPath();ctx.ellipse(x,y,rx,ry,angle||0,0,TAU);ctx.fillStyle=fill;ctx.fill();}
    function path(points,fill) {ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
    function water(zone) {
      const p=palettes[zone]||palettes[5];
      const bg=ctx.createLinearGradient(0,0,0,height);bg.addColorStop(0,p[0]);bg.addColorStop(.5,p[1]);bg.addColorStop(1,p[2]);ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
      // Distant shafts of light: screen-space so scenery never jitters at vast sizes.
      ctx.save();ctx.globalCompositeOperation='screen';
      for(let i=0;i<(reduced?3:5);i++) { const x=width*(i*.29-.2)+Math.sin(time*.09+i)*25;const g=ctx.createLinearGradient(x,0,x+90,height);g.addColorStop(0,'rgba(117,232,239,.12)');g.addColorStop(.75,'rgba(100,215,255,0)');path([[x,0],[x+width*.075,0],[x+width*.45,height],[x+width*.11,height]],g); }
      ctx.restore();
      // Suspended motes in two parallax layers; bounded draw count on phones.
      for(let i=0;i<(reduced?24:44);i++){const deep=i%2,drift=deep?.17:.34;const x=((hash(i+1)*width-camera.x*camera.zoom*drift+time*(deep?2:4))%width+width)%width;
        const y=((hash(i+93)*height-camera.y*camera.zoom*drift-time*(3+hash(i)*8))%height+height)%height;
        ctx.globalAlpha=deep?.15:.29;ellipse(x,y,deep?1:1.7,deep?1:1.7,p[3]);if(i%7===0){ctx.strokeStyle='rgba(170,245,255,.6)';ctx.lineWidth=.7;ctx.beginPath();ctx.arc(x,y,3.5,0,TAU);ctx.stroke();}}
      ctx.globalAlpha=1;
      // Offset reef shelves and plants give distinct depth without covering play space.
      if(!reduced)scenery(zone,.10,.40,0);scenery(zone,.22,.8,1);
      const v=ctx.createRadialGradient(width*.5,height*.48,Math.min(width,height)*.2,width*.5,height*.48,Math.max(width,height)*.8);v.addColorStop(0,'rgba(0,4,22,0)');v.addColorStop(1,'rgba(0,4,22,.37)');ctx.fillStyle=v;ctx.fillRect(0,0,width,height);
    }
    function scenery(zone,parallax,alpha,layer) {
      const period=310,shift=camera.x*camera.zoom*parallax;
      const dy=Math.sin(camera.y*camera.zoom*.001)*34;
      ctx.save();ctx.globalAlpha=alpha;
      for(let i=-1;i<Math.ceil(width/period)+2;i++){
        const index=i+Math.floor(shift/period),x=i*period-((shift%period)+period)%period;
        const y=height+25-(layer?0:45)+dy;
        const h=40+hash(index+61)*65;
        ellipse(x+120,y,150,h,zone<3?'#073f4d':'#131c3c');
        ellipse(x+120,y-12,99,h*.5,zone<3?'#0c5660':'#22264b');
        for(let j=0;j<5;j++){
          const px=x+40+j*47,ph=35+hash(index*7+j)*76;
          ctx.strokeStyle=zone<3?(j%2?'#259d94':'#197b7c'):(j%2?'#564c9b':'#374979');
          ctx.lineWidth=5+hash(j+index)*4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(px,y);
          ctx.bezierCurveTo(px-12,y-ph*.35,px+14+Math.sin(time*.8+j+index)*10,y-ph*.6,px+Math.sin(time*.7+j+index)*13,y-ph);ctx.stroke();
          if(j%2===0){ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(px,y-ph*.35);ctx.quadraticCurveTo(px-17,y-ph*.6,px-19,y-ph*.7);ctx.moveTo(px+2,y-ph*.58);ctx.quadraticCurveTo(px+20,y-ph*.75,px+23,y-ph*.85);ctx.stroke();}
        }
        if(layer){
          for(let j=0;j<3;j++){const cx=x+85+j*13,cy=y-25;ctx.strokeStyle=zone<3?['#ef8c82','#f3af7d','#ce6da9'][j]:['#866bce','#5aaac8','#bc6cce'][j];ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx-3,cy-30-j*5);ctx.moveTo(cx-2,cy-15);ctx.lineTo(cx-15,cy-26);ctx.lineTo(cx-14,cy-38);ctx.moveTo(cx-2,cy-23);ctx.lineTo(cx+11,cy-33);ctx.lineTo(cx+10,cy-44);ctx.stroke();}
          if(zone>=3){for(let j=0;j<4;j++)ellipse(x+90+j*15,y-65-j%2*8,2.5,2.5,'#b9f9ef');}
        }
      }ctx.restore();
    }
    function fish(entity,isPlayer,buildingSprite=false) {
      const p=buildingSprite?{x:80,y:64}:project(entity.x,entity.y),raw=buildingSprite?64:entity.size*camera.zoom;
      // size is body length in world units; renderer uses half-length for body radius.
      const r=Math.max(1.3,raw*.5);
      if(!buildingSprite&&(p.x+r*2<0||p.x-r*2>width||p.y+r*2<0||p.y-r*2>height))return;
      const edible=!isPlayer&&entity.size<state.player.size;
      const kind=isPlayer?(state.zone>=4?'leviathan':state.zone>=2?'shark':state.zone>=1?'tuna':'tropical'):(entity.kind||'fish'),shark=/shark|barracuda|predator|tuna/i.test(kind),squid=/squid/i.test(kind),monster=/monster|leviathan|boss|abyss/i.test(kind),angler=/angler/i.test(kind);
      const hue=isPlayer?36:(Number.isFinite(entity.hue)?entity.hue:(shark?199:monster?281:angler?261:((entity.id||0)*47+170)%360));
      const angle=Number.isFinite(entity.angle)?entity.angle:0,flip=Math.cos(angle)<0;
      const bodyHeight=r*(shark?.39:squid?.5:monster?.6:.63);
      if(!isPlayer&&!buildingSprite&&!edible&&entity.behavior==='hunt'){
        // Heading cone is presentation only: it does not change collision or AI.
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);
        ctx.fillStyle='rgba(255,127,96,.075)';ctx.strokeStyle='rgba(255,161,119,.35)';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(r*.7,0);ctx.lineTo(r*2.5,-r*.65);ctx.quadraticCurveTo(r*2.8,0,r*2.5,r*.65);ctx.closePath();ctx.fill();
        for(let j=0;j<2;j++){const x=r*(1.4+j*.43);ctx.beginPath();ctx.moveTo(x-r*.12,-r*.13);ctx.lineTo(x,0);ctx.lineTo(x-r*.12,r*.13);ctx.stroke();}ctx.restore();
      }
      if(!isPlayer&&!buildingSprite){
        // Bounded four-pose sprite cache retains original shaded artwork while
        // replacing dozens of paths/gradients per NPC with one GPU-friendly blit.
        const phase=Math.floor((time*6+(entity.id||0))/(Math.PI/2))%4;
        const color=Math.round(hue/30)*30,key=kind+':'+color+':'+phase;
        let sprite=sprites.get(key);
        if(!sprite){
          sprite=document.createElement('canvas');sprite.width=160;sprite.height=128;
          const main=ctx,clock=time;ctx=sprite.getContext('2d');time=phase*Math.PI/12;
          fish({...entity,angle:0,id:0,hue:color},false,true);ctx=main;time=clock;
          if(sprites.size>=96)sprites.delete(sprites.keys().next().value);
          sprites.set(key,sprite);
        }
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(flip?angle-Math.PI:angle);ctx.scale(flip?-1:1,1);
        ctx.drawImage(sprite,-80*r/32,-64*r/32,160*r/32,128*r/32);ctx.restore();
      } else {
      ctx.save();ctx.translate(p.x,p.y);
      // Soft shadow beneath the fish provides depth while keeping hit area legible.
      ellipse(0,r*.45,r*.95,r*.23,'rgba(0,5,25,.17)');
      if(isPlayer&&state.boosting){ctx.save();ctx.rotate(entity.angle||0);for(let i=0;i<5;i++){ctx.globalAlpha=(1-i/5)*.3;ellipse(-r*(1.3+i*.35),Math.sin(time*20+i)*r*.1,r*.3,r*.17,'#c5f9ff');}ctx.restore();}
      ctx.rotate(flip?angle-Math.PI:angle);ctx.scale(flip?-1:1,1);
      const wag=Math.sin(time*(isPlayer?10:6)+(entity.id||0))*r*.15;
      if(isPlayer&&monster){
        // Golden identity persists through the luminous, original abyss form.
        const pulse=.7+Math.sin(time*2.5)*.15;
        ctx.strokeStyle=`rgba(125,255,235,${pulse})`;ctx.lineWidth=Math.max(1,r*.055);
        for(let side of [-1,1]){ctx.beginPath();ctx.moveTo(-r*.28,side*bodyHeight*.5);ctx.bezierCurveTo(-r*.8,side*r*.95,-r*1.4,side*r*.8+wag,-r*1.65,side*r*.4+wag);ctx.stroke();}
      }
      const grad=ctx.createLinearGradient(0,-bodyHeight,0,bodyHeight);grad.addColorStop(0,`hsl(${hue},${isPlayer?100:65}%,${isPlayer?76:68}%)`);grad.addColorStop(.42,`hsl(${hue},${isPlayer?96:66}%,${isPlayer?56:48}%)`);grad.addColorStop(1,`hsl(${hue},65%,${isPlayer?31:24}%)`);
      if(squid){
        for(let n=0;n<5;n++){ctx.strokeStyle=`hsl(${hue+n*4},60%,${42+n*4}%)`;ctx.lineWidth=Math.max(1,r*.09);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-r*.5,(n-2)*r*.15);ctx.bezierCurveTo(-r*1.1,(n-2)*r*.2+wag,-r*1.4,(n-2)*r*.27-wag,-r*1.8,(n-2)*r*.2+wag);ctx.stroke();}
        path([[-r*.4,-r*.2],[r*.2,-r*.85],[r*.6,-r*.15]],`hsl(${hue},60%,41%)`);
        path([[-r*.4,r*.2],[r*.2,r*.85],[r*.6,r*.15]],`hsl(${hue},60%,35%)`);
      } else {
        path([[-r*.69,0],[-r*1.43,-r*.65+wag],[-r*1.28,wag],[-r*1.43,r*.65+wag]],`hsl(${hue+12},72%,${isPlayer?49:40}%)`);
        path([[-r*.4,-bodyHeight*.65],[-r*.12,-bodyHeight*(shark?2.1:1.55)],[r*.32,-bodyHeight*.6]],`hsl(${hue+5},70%,${isPlayer?55:37}%)`);
        path([[-r*.35,bodyHeight*.6],[-r*.2,bodyHeight*1.35],[r*.3,bodyHeight*.65]],`hsl(${hue+5},65%,33%)`);
      }
      ctx.beginPath();ctx.moveTo(r,0);ctx.bezierCurveTo(r*.96,-bodyHeight*.8,r*.07,-bodyHeight*1.32,-r*.83,-bodyHeight*.32);ctx.quadraticCurveTo(-r*.98,0,-r*.83,bodyHeight*.32);ctx.bezierCurveTo(r*.02,bodyHeight*1.3,r*.95,bodyHeight*.7,r,0);ctx.fillStyle=grad;ctx.fill();
      if(monster){for(let j=0;j<5;j++){const x=-r*.65+j*r*.29;path([[x,-bodyHeight*.7],[x+r*.07,-bodyHeight*(1.35+Math.sin(j)*.15)],[x+r*.2,-bodyHeight*.8]],isPlayer?'#a5fff0':`hsl(${hue+28},67%,63%)`);}}
      if(isPlayer&&monster){
        ctx.strokeStyle='#b2fff1';ctx.lineWidth=Math.max(1,r*.045);ctx.beginPath();ctx.moveTo(-r*.75,-bodyHeight*.1);ctx.bezierCurveTo(-r*.22,-bodyHeight*.65,r*.12,-bodyHeight*.47,r*.42,-bodyHeight*.2);ctx.stroke();
        for(let j=0;j<5;j++)ellipse(-r*.5+j*r*.18,bodyHeight*(.14+Math.sin(j)*.16),r*.045,r*.045,'#bdfff4');
      }
      ctx.save();ctx.globalAlpha=.25;ellipse(r*.08,-bodyHeight*.38,r*.57,bodyHeight*.23,'#e8ffff',-.12);ctx.restore();
      if(!shark&&!squid&&!monster){ctx.strokeStyle=`hsla(${hue+70},80%,90%,.43)`;ctx.lineWidth=Math.max(1,r*.13);for(let j=0;j<2;j++){ctx.beginPath();ctx.moveTo(-r*.35+j*r*.32,-bodyHeight*.75);ctx.quadraticCurveTo(-r*.52+j*r*.32,0,-r*.35+j*r*.32,bodyHeight*.75);ctx.stroke();}}
      // Animated pectoral fin, gill, expressive eye and mouth.
      path([[r*.03,0],[-r*.35,bodyHeight*(.74+Math.sin(time*8)*.11)],[r*.19,bodyHeight*.36]],`hsla(${hue+12},75%,78%,.6)`);
      ctx.strokeStyle=`hsla(${hue},70%,18%,.4)`;ctx.lineWidth=Math.max(.7,r*.025);ctx.beginPath();ctx.arc(r*.28,0,bodyHeight*.65,-1.1,1.1);ctx.stroke();
      const eyeR=Math.max(1.5,r*(isPlayer?.16:.12));ellipse(r*.62,-bodyHeight*.2,eyeR,eyeR*1.1,'#f7ffff');ellipse(r*.66,-bodyHeight*.18,eyeR*.54,eyeR*.7,'#071b29');ellipse(r*.7,-bodyHeight*.24,eyeR*.2,eyeR*.22,'white');
      if(isPlayer&&time<biteUntil)ellipse(r*.88,bodyHeight*.1,r*.17,r*.18,'#64362c');
      ctx.strokeStyle='#173041';ctx.lineWidth=Math.max(1,r*.025);ctx.beginPath();ctx.moveTo(r*.79,bodyHeight*.2);ctx.quadraticCurveTo(r*.92,bodyHeight*.3,r*.98,bodyHeight*.07);ctx.stroke();
      if(shark||monster){for(let j=0;j<3;j++){const x=r*(.73+j*.08);path([[x,bodyHeight*.12],[x+r*.04,bodyHeight*.29],[x+r*.06,bodyHeight*.09]],'#e5fbf6');}}
      if(angler){ctx.strokeStyle='#a3c4ea';ctx.lineWidth=Math.max(1,r*.035);ctx.beginPath();ctx.moveTo(r*.35,-bodyHeight*.8);ctx.quadraticCurveTo(r*.8,-r*1.2,r*1.05,-r*.7);ctx.stroke();ellipse(r*1.05,-r*.7,r*.13,r*.13,'#c0fff1');}
      ctx.restore();
      }
      // Symbols accompany color, useful for color-blind players and tiny screens.
      if(!isPlayer&&!buildingSprite&&r>6){
        ctx.save();ctx.translate(p.x,p.y-bodyHeight-9);ctx.globalAlpha=.9;
        const warning=entity.behavior==='hunt'&&!edible;
        ctx.fillStyle=edible?'#a8ffbc':warning?'#ffd0ad':'#ffc8ac';ctx.font='bold '+Math.max(9,Math.min(13,r*.28))+'px system-ui';ctx.textAlign='center';
        if(entity.boss){
          path([[-9,-16],[-9,-24],[-4,-20],[0,-27],[4,-20],[9,-24],[9,-16]],edible?'#a8ffbc':'#ffcf75');
          ctx.fillText(edible?'FEAST':'BOSS',0,-2);
        }else ctx.fillText(edible?'•':warning?'HUNTING !':'!',0,0);
        ctx.restore();
      }
      if(isPlayer){ctx.strokeStyle='rgba(255,228,136,.3)';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(p.x,p.y,r*1.65,r*1.18,0,0,TAU);ctx.stroke();}
    }
    function draw(dt) {
      if(!alive)return;const began=performance.now();dt=Math.min(.12,Math.max(0,Number(dt)||0));time+=dt;
      const p=state.player,size=Math.max(.0001,p.size),growth=Math.max(0,Math.log2(size/initialSize));
      const targetPixels=Math.min(Math.min(width,height)*.17,62+growth*5);
      const targetZoom=targetPixels/size;
      if(!initialized){camera.x=p.x;camera.y=p.y;camera.zoom=targetZoom;initialized=true;}
      const a=1-Math.exp(-dt*7);camera.x=mix(camera.x,p.x,a);camera.y=mix(camera.y,p.y,a);camera.zoom=Math.min(targetZoom*1.5,mix(camera.zoom,targetZoom,1-Math.exp(-dt*3)));
      // Bound lag in screen units; extreme growth/boost cannot leave the player offscreen.
      const maxLagX=width*.2/camera.zoom,maxLagY=height*.2/camera.zoom;
      camera.x=p.x+Math.max(-maxLagX,Math.min(maxLagX,camera.x-p.x));
      camera.y=p.y+Math.max(-maxLagY,Math.min(maxLagY,camera.y-p.y));
      ctx.setTransform(dpr,0,0,dpr,0,0);water(Math.min(5,Math.max(0,Number(state.zone)||0)));
      const list=state.fish||[];
      for(let i=0;i<list.length;i++)if(!list[i].dead&&list[i].size<size)fish(list[i],false);
      fish(p,true);
      for(let i=0;i<list.length;i++)if(!list[i].dead&&list[i].size>=size)fish(list[i],false);
      for(let i=growthRings.length-1;i>=0;i--){
        const ring=growthRings[i];ring.life-=dt;if(ring.life<=0){growthRings.splice(i,1);continue;}
        const progress=1-ring.life/ring.max,q=project(p.x,p.y),radius=p.size*camera.zoom*(.65+progress*.75);
        ctx.globalAlpha=(1-progress)*.65;ctx.strokeStyle=state.zone>=4?'#acffef':'#ffe6a2';ctx.lineWidth=3*(1-progress)+.5;
        ctx.beginPath();ctx.ellipse(q.x,q.y,radius,radius*.75,0,0,TAU);ctx.stroke();
      }ctx.globalAlpha=1;
      for(let i=sparks.length-1;i>=0;i--){const s=sparks[i];s.life-=dt;if(s.life<=0){sparks.splice(i,1);continue;}s.x+=s.vx*dt;s.y+=s.vy*dt;const q=project(s.x,s.y);ctx.globalAlpha=s.life/s.max;ellipse(q.x,q.y,s.r,s.r,`hsl(${s.hue},95%,76%)`);}ctx.globalAlpha=1;
      drawCost=drawCost*.9+(performance.now()-began)*.1;
      if(drawCost>14)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);
      if(!reduced&&slowFrames>12){reduced=true;resize();}
    }
    resize();
    return {resize,draw,direction,burst,camera,destroy(){alive=false;sparks.length=0;growthRings.length=0;sprites.clear();}};
  }
  root.BigFishRenderer={create};
})(typeof window!=='undefined'?window:globalThis);
