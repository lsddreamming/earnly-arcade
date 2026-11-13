/* Original code-drawn Spuddy characters and scenery. Cosmetic only. */
(()=>{'use strict';const E=globalThis.SpuddyDefense;
 function circle(c,x,y,r,fill,stroke){c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
 function round(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
 function path(c,pts,width,color){c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.strokeStyle=color;c.stroke();}
 function mapArt(c,m){c.fillStyle=m.colors[0];c.fillRect(0,0,960,600);
  for(let i=0;i<170;i++){const n=E.hash(m.id+i),x=n%960,y=(n>>>10)%600;c.globalAlpha=.13;circle(c,x,y,2+(n%3),m.colors[1]);if(i%3===0)path(c,[[x-4,y],[x,y-5],[x+3,y]],1.5,m.colors[1]);}c.globalAlpha=1;
  path(c,m.path,76,m.colors[1]);path(c,m.path,64,m.colors[3]);path(c,m.path,54,m.colors[2]);
  const g=E.geometry(m);for(let d=35;d<g.length;d+=38){const p=E.point(g,d);c.globalAlpha=.16;circle(c,p.x+3,p.y+2,1.5,m.colors[3]);}c.globalAlpha=1;
  for(const [x,y,r] of m.props){c.save();c.translate(x,y);circle(c,7,10,r+6,'#122f3828');
   if(m.id==='city'||m.id==='factory'){round(c,-r,-r,r*2,r*2+8,9,m.id==='city'?'#29465a':'#6c9eaf');round(c,-r,-r-8,r*2,r*2,8,m.id==='city'?'#acc4c8':'#edf8ff');for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)round(c,i*r*.5-5,j*r*.5-10,10,10,2,'#638ba6');}
   else if(m.id==='neon'){c.shadowColor='#ae6eff';c.shadowBlur=16;c.fillStyle='#b68cf9';c.beginPath();c.moveTo(0,-r);c.lineTo(r*.7,6);c.lineTo(0,r);c.lineTo(-r*.7,6);c.closePath();c.fill();path(c,[[0,-r],[0,r]],2,'#f0ccff');}
   else{round(c,-6,0,12,r,4,'#8d694c');for(const [dx,dy,k]of [[0,-r*.35,1],[-r*.5,0,.72],[r*.5,2,.7]]){circle(c,dx,dy,r*k,'#2a7753');circle(c,dx-2,dy-5,r*k*.88,m.id==='tropical'?'#43ac79':'#4caa61');circle(c,dx-7,dy-10,r*k*.53,'#67c777');}}
   c.restore();}
  const start=m.path[0],end=m.path[m.path.length-1];c.font='bold 13px DejaVu Sans, sans-serif';c.textAlign='left';c.fillStyle='#fff';c.fillText('IN →',10,start[1]-43);
  round(c,end[0]-52,end[1]-31,43,62,10,'#fff3d4','#3a604d');c.fillStyle='#907956';c.beginPath();c.moveTo(end[0]-60,end[1]-25);c.lineTo(end[0]-30,end[1]-50);c.lineTo(end[0],end[1]-25);c.fill();round(c,end[0]-39,end[1]+5,18,26,5,'#7b654c');circle(c,end[0]-30,end[1]-9,8,'#9fdcf2');
 }
 function tower(c,t,ghost=false,turn=0){const d=E.TOWERS[t.type],level=(t.a||0)+(t.b||0),r=19+level*.6;c.save();c.translate(t.x,t.y);c.rotate(-turn);if(ghost)c.globalAlpha=.7;circle(c,0,10,r+6,'#132e3e40');circle(c,0,4,r+5,'#365866');circle(c,0,0,r+5,'#c4d8cf');circle(c,0,0,r+1,d.color);c.lineWidth=2;
  for(let i=0;i<level;i++){const a=i*1.05;circle(c,Math.cos(a)*(r+3),Math.sin(a)*(r+3),2.8,'#fff4b2');}
  c.save();c.rotate((t.angle||0)+turn);const recoil=t.flash?3:0;
  if(d.kind==='frost'){circle(c,0,0,14,'#377c9b');for(let i=0;i<4;i++){c.save();c.rotate(i*Math.PI/2+(t.flash||0)*.2);round(c,1,-4,19,8,4,'#d7f8ff');c.restore();}circle(c,0,0,5,'#7fdcff');}
  else if(d.kind==='arc'){for(let i=0;i<3;i++){c.strokeStyle=['#9873cd','#e5ceff','#fff'][i];c.lineWidth=3;c.beginPath();c.ellipse(-3+i*3,0,5,15-i*3,0,0,Math.PI*2);c.stroke();}circle(c,7,0,6,'#f7e9ff');}
  else{const width=d.kind==='mortar'?17:d.kind==='blast'?14:d.kind==='command'?12:8;round(c,3-recoil,-width/2,27,width,3,'#294e5b');round(c,4-recoil,-width/2,21,width-3,3,d.color);round(c,24-recoil,-width/2-2,7,width+4,2,'#eff1c7');if(d.kind==='rapid'||d.kind==='command')round(c,4,-10,22,5,2,'#536f7d');}
  c.restore();if(!['arc','frost','mortar'].includes(d.kind)){circle(c,-5,-1,11,'#e8ba6f');circle(c,-8,-3,1.6,'#3c3c49');circle(c,-1,-3,1.6,'#3c3c49');path(c,[[-7,2],[-4,4],[-1,2]],1.4,'#785944');round(c,-16,-12,21,7,4,d.color);}
  if(t.flash){c.globalAlpha=.65;circle(c,Math.cos((t.angle||0)+turn)*32,Math.sin((t.angle||0)+turn)*32,5,'#fff8d8');}c.restore();
 }
 function enemy(c,e,time,turn=0){const d=E.ENEMIES.find(v=>v.id===e.type),r=d.boss?33:d.id==='nest'||d.id==='chrome'?18:13+Math.min(5,d.hp/60),bob=Math.sin(time*5+e.id)*2;c.save();c.translate(e.x,e.y);c.rotate(-turn);circle(c,1,r*.6+5,r*.8,'#17304425');c.translate(0,bob);if(d.stealth)c.globalAlpha=.56;
  const grad=c.createRadialGradient(-r*.35,-r*.4,1,0,0,r);grad.addColorStop(0,'#ffffff');grad.addColorStop(.24,d.color);grad.addColorStop(1,d.boss?'#8f45ba':d.color);c.lineWidth=2;circle(c,0,0,r,grad,'#ffffff95');
  if(d.armor){c.strokeStyle='#536979';c.lineWidth=5;c.beginPath();c.arc(0,0,r*.88,Math.PI,Math.PI*2);c.stroke();round(c,-r,-3,r*2,5,2,'#607f92');}
  if(d.boss){c.fillStyle='#ffdc70';c.beginPath();c.moveTo(-20,-r+4);c.lineTo(-23,-r-14);c.lineTo(-10,-r-7);c.lineTo(0,-r-23);c.lineTo(10,-r-7);c.lineTo(23,-r-14);c.lineTo(20,-r+4);c.closePath();c.fill();circle(c,0,-r-7,4,'#ef7cbc');}
  if(d.regen){c.fillStyle='#368f59';c.font='bold 13px DejaVu Sans, sans-serif';c.textAlign='center';c.fillText('+',0,-r-2);}
  circle(c,-r*.3,-2,2.5,'#25364d');circle(c,r*.3,-2,2.5,'#25364d');c.strokeStyle='#4a4056';c.lineWidth=2;c.beginPath();c.arc(0,3,4,0,Math.PI);c.stroke();circle(c,-r*.47,4,3,'#ffb9ca66');circle(c,r*.47,4,3,'#ffb9ca66');
  if(e.shield>0){c.lineWidth=2;circle(c,0,0,r+5,null,'#c2f6ff');}if(e.slow<1){c.lineWidth=2;circle(c,0,0,r+2,null,'#79eaff');}
  if(e.hp<e.maxHp){round(c,-r,-r-8,r*2,4,2,'#21354b');round(c,-r,-r-8,Math.max(0,e.hp/e.maxHp)*r*2,4,2,d.boss?'#ffc95b':'#a4f9b4');}c.restore();
 }
 function create(canvas){const c=canvas.getContext('2d',{alpha:false});let mapCanvas=null,mapId='',transform={scale:1,x:0,y:0},camera={zoom:1,x:480,y:300};
  function resize(){const b=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(b.width*d)||canvas.height!==Math.round(b.height*d)){canvas.width=Math.round(b.width*d);canvas.height=Math.round(b.height*d);}return {w:b.width,h:b.height,d};}
  function render(game,view={}){const {w,h,d}=resize(),m=game.map,s=game.state;if(m.id!==mapId){mapId=m.id;mapCanvas=document.createElement('canvas');mapCanvas.width=960;mapCanvas.height=600;mapArt(mapCanvas.getContext('2d'),m);}
   c.setTransform(d,0,0,d,0,0);c.fillStyle=m.colors[1];c.fillRect(0,0,w,h);const turn=h>w*1.05?Math.PI/2:0,scale=Math.min(w/(turn?600:960),h/(turn?960:600))*camera.zoom;transform={scale,x:w/2,y:h/2,turn};c.translate(w/2,h/2);c.rotate(turn);c.scale(scale,scale);c.translate(-camera.x,-camera.y);c.drawImage(mapCanvas,0,0);
   if(view.selected||view.placement){const t=view.selected||{type:view.placement.type,a:0,b:0,x:view.placement.x,y:view.placement.y},st=E.stats(t);c.globalAlpha=.16;circle(c,t.x,t.y,st.range,view.placement&&!game.canPlace(t.x,t.y)?'#ff405b':'#ecffff');c.globalAlpha=1;c.lineWidth=2;circle(c,t.x,t.y,st.range,null,view.placement&&!game.canPlace(t.x,t.y)?'#ff6d7f':'#ffffff99');if(st.minRange){c.setLineDash([5,5]);circle(c,t.x,t.y,st.minRange,null,'#ffce81');c.setLineDash([]);}}
   const time=performance.now()/1000;s.towers.forEach(t=>tower(c,t,false,turn));s.enemies.forEach(e=>enemy(c,e,time,turn));
   for(const f of s.effects){c.save();c.globalAlpha=f.life/12;c.lineWidth=3;if(['pop','burst','clear','leak'].includes(f.kind)){for(let i=0;i<7;i++){const a=i*6.283/7,r=(13-f.life)*f.r/12;circle(c,f.x+Math.cos(a)*r,f.y+Math.sin(a)*r,Math.max(1,f.life/4),f.color);}}
    else if(f.kind==='arc'){const mx=(f.x+f.tx)/2,my=(f.y+f.ty)/2;path(c,[[f.x,f.y],[mx-6,my+9],[mx+5,my-7],[f.tx,f.ty]],3,f.color);}
    else if(['blast','mortar','command','frost'].includes(f.kind)){circle(c,f.tx,f.ty,(13-f.life)*f.r/12,null,f.color);circle(c,f.tx,f.ty,Math.max(2,f.life*.7),f.color);}
    else{const q=1-f.life/12;path(c,[[f.x+(f.tx-f.x)*q,f.y+(f.ty-f.y)*q],[f.tx,f.ty]],f.kind==='laser'?3:2,f.color);}c.restore();}
   if(view.placement){tower(c,{...view.placement,angle:0},true,turn);const valid=game.canPlace(view.placement.x,view.placement.y);c.lineWidth=3;circle(c,view.placement.x,view.placement.y,27,null,valid?'#ecfff2':'#ff5577');}
   if(view.selected){c.lineWidth=3;circle(c,view.selected.x,view.selected.y,29,null,'#fff9b5');}
  }
  return {render,reset(){camera={zoom:1,x:480,y:300};},zoom(delta){camera.zoom=Math.max(1,Math.min(2.5,camera.zoom+delta));if(camera.zoom===1){camera.x=480;camera.y=300;}},pan(dx,dy){const r=transform.turn||0,c=Math.cos(r),s=Math.sin(r);camera.x=Math.max(180,Math.min(780,camera.x-(c*dx+s*dy)/transform.scale));camera.y=Math.max(120,Math.min(480,camera.y-(-s*dx+c*dy)/transform.scale));},point(x,y){const b=canvas.getBoundingClientRect(),r=b.height>b.width*1.05?Math.PI/2:0,scale=Math.min(b.width/(r?600:960),b.height/(r?960:600))*camera.zoom,dx=(x-b.left-b.width/2)/scale,dy=(y-b.top-b.height/2)/scale;return {x:Math.round(Math.cos(r)*dx+Math.sin(r)*dy+camera.x),y:Math.round(-Math.sin(r)*dx+Math.cos(r)*dy+camera.y)};}};
 }
 globalThis.SpuddyDefenseArt={create,mapArt,tower};
})();
