(()=>{'use strict';
const E=CrystalCommand;
function create(canvas){const ctx=canvas.getContext('2d');let width=400,height=430,zoom=32,camera={x:6,y:6},selected=new Set(),mini={x:0,y:0,w:96,h:96};
 const colors={ally:'#67edff',enemy:'#ff9160',gold:'#ffdc82'};let lastTick=-1,effects=[],zoomLevel=1;const motion=matchMedia('(prefers-reduced-motion: reduce)');
 const art=CrystalArt.create(ctx,point,box,line,poly,tile);
 function point(x,y,z=0){return{x:width/2+(x-y-camera.x+camera.y)*zoom*.85,y:height*.46+(x+y-camera.x-camera.y)*zoom*.43-z*zoom}}
 function world(x,y){const a=(x-width/2)/(zoom*.85),b=(y-height*.46)/(zoom*.43);return{x:camera.x+(a+b)/2,y:camera.y+(b-a)/2}}
 function poly(points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
 function tile(x,y,r,fill,stroke,z=0){poly([point(x-r,y-r,z),point(x+r,y-r,z),point(x+r,y+r,z),point(x-r,y+r,z)],fill,stroke)}
 function box(x,y,r,h,color){const a=point(x-r,y-r),b=point(x+r,y-r),c=point(x+r,y+r),d=point(x-r,y+r),aa=point(x-r,y-r,h),bb=point(x+r,y-r,h),cc=point(x+r,y+r,h),dd=point(x-r,y+r,h);poly([b,c,cc,bb],'#182536','#344b63');poly([c,d,dd,cc],'#0b1524','#24394f');poly([aa,bb,cc,dd],color,'#60738c')}
 function line(a,b,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
 function label(s,x,y,color,size=10){ctx.font=`600 ${size}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#020611';ctx.fillText(s,x+1,y+1);ctx.fillStyle=color;ctx.fillText(s,x,y)}
 function render(v,{selection=[],build=null,pointer=null,paused=false}={}){
  const artTime=motion.matches?0:v.time;selected=new Set(selection);const ratio=Math.min(2,window.devicePixelRatio||1),r=canvas.getBoundingClientRect();width=r.width;height=r.height;zoom=(width>700?46:34)*zoomLevel;const bw=Math.round(width*ratio),bh=Math.round(height*ratio);if(canvas.width!==bw||canvas.height!==bh){canvas.width=bw;canvas.height=bh}ctx.setTransform(ratio,0,0,ratio,0,0);ctx.fillStyle='#050a15';ctx.fillRect(0,0,width,height);
  const grad=ctx.createRadialGradient(width/2,height*.4,10,width/2,height*.4,width);grad.addColorStop(0,'#19374a');grad.addColorStop(1,'#030812');ctx.fillStyle=grad;ctx.fillRect(0,0,width,height);
  for(let j=0;j<32;j++){ctx.fillStyle=j%4?'#9abbd522':'#5df4ff44';ctx.fillRect((j*137.3)%width,(j*83.7)%height,j%7===0?2:1,1)}
  for(let y=0;y<40;y++)for(let x=0;x<40;x++){const p=point(x+.5,y+.5),i=y*40+x;if(p.x< -zoom||p.x>width+zoom||p.y< -zoom||p.y>height+zoom)continue;const seen=v.seen[i],vis=v.visible[i],hash=(x*13+y*7)%5;tile(x+.5,y+.5,.5,!seen?'#080e1a':vis?['#1a2938','#1d2d3c','#182737','#223140','#1b2a3a'][hash]:'#101b29',!seen?'#0b1320':'#38526555');if(vis&&(x+y)%13===0){line(point(x+.2,y+.5),point(x+.7,y+.5),'#6e94a544',1);line(point(x+.25,y+.2),point(x+.25,y+.33),'#82ddf255',1)}if(vis&&hash===3&&x%3===0){ctx.fillStyle='#07152255';ctx.beginPath();ctx.ellipse(p.x,p.y,zoom*.28,zoom*.1,0,0,Math.PI*2);ctx.fill()}}
  for(const o of v.entities)if(o.type==='base'){for(const dy of [-1.7,1.7]){tile(o.x,o.y+dy,.12,'#234357','#477686',.01);line(point(o.x-1.8,o.y+dy),point(o.x+1.8,o.y+dy),'#5adffb22',2)}}
  const objects=[...v.rocks.map(o=>({...o,rock:true})),...v.crystals.map(o=>({...o,crystal:true})),...v.entities].sort((a,b)=>a.x+a.y-b.x-b.y);
  for(const o of objects){const i=Math.floor(o.y)*40+Math.floor(o.x);if(!v.seen[i])continue;const p=point(o.x,o.y);if(p.x< -100||p.x>width+100||p.y< -100||p.y>height+100)continue;
   ctx.save();ctx.globalAlpha=v.visible[i]?1:.3;
   ctx.fillStyle='#02061188';ctx.beginPath();ctx.ellipse(p.x,p.y+5,zoom*.5,zoom*.2,0,0,Math.PI*2);ctx.fill();
   if(o.rock){const x=o.x+.5,y=o.y+.5;poly([point(x-.5,y-.4),point(x-.25,y-.4,.7),point(x+.1,y-.1,.9),point(x+.45,y+.2,.2),point(x,y+.5),point(x-.45,y+.2)],'#4b6275','#7e94a5');poly([point(x-.5,y-.4),point(x-.25,y-.4,.7),point(x+.1,y-.1,.9),point(x+.35,y-.5,.35)],'#7b8fa0','#a2b1bc');line(point(x-.25,y-.4,.7),point(x+.1,y-.1,.9),'#bfd7e555')}
   else if(o.crystal){art.ring(p,zoom*.65,zoom*.24,o.rich?'#ff8fdf44':'#67eaff33');if(o.left<=0){tile(o.x,o.y,.4,'#172837','#3b5a64')}else{for(let j=0;j<3;j++){const q=point(o.x+(j-1)*.25,o.y+(j%2)*.25);const h=zoom*(j===1?1.1:.75);poly([{x:q.x-zoom*.17,y:q.y},{x:q.x-zoom*.2,y:q.y-h*.55},{x:q.x,y:q.y-h},{x:q.x+zoom*.2,y:q.y-h*.6},{x:q.x+zoom*.18,y:q.y}],o.rich?'#d957cf':'#36bce0',o.rich?'#ffb3f7':'#9af8ff');line({x:q.x,y:q.y-h},{x:q.x,y:q.y},'#d3ffff',1)}for(let j=0;j<3;j++){const q=point(o.x+Math.sin(v.time*.5+j)*.45,o.y+Math.cos(v.time*.5+j)*.35,.15+(v.time*.2+j*.3)%1);ctx.fillStyle=o.rich?'#ff9be7aa':'#98fcffaa';ctx.fillRect(q.x,q.y,1.5,1.5)}if(o.rich&&v.time%12>9){ctx.strokeStyle='#fa7dce';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,zoom*2,zoom*.85,0,0,Math.PI*2);ctx.stroke()}}}
   else{const d=E.TYPES[o.type],c=o.side===v.side?colors.ally:colors.enemy;
    if(selected.has(o.id)){ctx.strokeStyle=c;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y+5,zoom*(d.radius||.5),zoom*(d.radius||.5)*.43,0,0,Math.PI*2);ctx.stroke();ctx.save();ctx.setLineDash([5,4]);ctx.lineDashOffset=-v.time*9;art.ring({x:p.x,y:p.y+5},zoom*(d.radius||.5)+3,zoom*(d.radius||.5)*.43+2,c+'77');ctx.restore()}
    if(d.supply){art.robot(o,c,artTime);if(o.type==='worker'&&o.mine>0){const n=v.crystals.find(n=>Math.hypot(o.x-n.x,o.y-n.y)<1);if(n){ctx.save();ctx.shadowColor=c;ctx.shadowBlur=6;line(point(o.x,o.y,.5),point(n.x,n.y,.4),c,1.5);ctx.restore();art.light(point(n.x,n.y,.4),colors.gold,2+Math.sin(v.time*20)*.5)}}}
    else{tile(o.x,o.y,d.radius+.2,'#142639','#56798d');tile(o.x,o.y,d.radius+.08,null,c,.04);art.raised(o.x,o.y,d.radius*.82,.22,'#3c5b73');art.building(o,c,artTime);if(selected.has(o.id)||o.type==='base')label(o.type==='base'?'COMMAND':d.name.toUpperCase(),p.x,p.y+27,c,8);
     if(o.queue.length){const q=point(o.x,o.y,2.05);label('TRAINING '+E.TYPES[o.queue[0]].name.toUpperCase(),q.x,q.y-13,colors.gold,8);ctx.fillStyle='#06111c';ctx.fillRect(q.x-22,q.y-7,44,3);ctx.fillStyle=colors.gold;ctx.fillRect(q.x-22,q.y-7,44*Math.min(1,o.progress/E.TYPES[o.queue[0]].time),3)}
     if(o.build){ctx.save();ctx.globalAlpha=.4;tile(o.x,o.y,d.radius,null,colors.gold,1.4*(1-o.build/d.time));ctx.restore()}
    }
    if(o.hp<o.maxHp||selected.has(o.id)||o.build){const q=point(o.x,o.y,d.supply?1:1.9);ctx.fillStyle='#020813';ctx.fillRect(q.x-17,q.y-7,34,4);ctx.fillStyle=o.build?'#ffd780':c;ctx.fillRect(q.x-17,q.y-7,34*(o.build?1-o.build/d.time:o.hp/o.maxHp),4);if(o.build)label(Math.ceil(o.build)+'s',q.x,q.y-11,'#ffd780',9)}
   }ctx.restore();
  }
  const now=performance.now();if(v.tick!==lastTick){if(v.tick<lastTick)effects=[];lastTick=v.tick;for(const e of v.events||[])effects.push({...e,born:now});effects=effects.slice(-80)}
  effects=effects.filter(e=>now-e.born<(e.type==='shot'?180:600));for(const e of effects){const age=(now-e.born)/600,c=e.side===v.side?colors.ally:colors.enemy;ctx.save();ctx.globalAlpha=1-age;
   if(e.type==='shot'){ctx.shadowColor=c;ctx.shadowBlur=8;line(point(e.x,e.y,.5),point(e.tx,e.ty,.35),c,e.kind==='siege'?3:1.5);line(point(e.x,e.y,.5),point(e.tx,e.ty,.35),'#e9ffff',.7);art.light(point(e.tx,e.ty,.35),e.kind==='siege'?colors.gold:c,e.kind==='siege'?5:2.5)}
   else{const q=point(e.x,e.y,.6);art.ring(q,5+age*18,2+age*8,e.type==='deposit'?colors.gold:colors.ally);for(let j=0;j<4;j++){const a=j*Math.PI/2+age*2;ctx.fillStyle=colors.gold;ctx.fillRect(q.x+Math.cos(a)*age*18,q.y+Math.sin(a)*age*12,2,2)}}ctx.restore()
  }
  for(const o of v.entities)if(selected.has(o.id)&&o.order&&['move','attack'].includes(o.order.type)){const target=point(o.order.x,o.order.y);ctx.save();ctx.setLineDash([3,5]);line(point(o.x,o.y),target,'#73eaff66');ctx.restore();art.ring(target,8,4,colors.ally)}
  if(build&&pointer){const at=world(pointer.x,pointer.y),d=E.TYPES[build];ctx.save();ctx.globalAlpha=.5;tile(at.x,at.y,d.radius+.1,'#4acddd44','#8ffaff');art.raised(at.x,at.y,d.radius*.82,.22,'#3c5b73');art.building({x:at.x,y:at.y,type:build,queue:[]},colors.ally,artTime);ctx.restore();label('PLACE '+d.name.toUpperCase(),pointer.x,pointer.y+30,colors.ally,8)}
  // Tactical minimap shows only explored land and visible opponents.
  mini={x:width-102,y:height-105,w:94,h:94};ctx.fillStyle='#060d1ce8';ctx.fillRect(mini.x-4,mini.y-4,mini.w+8,mini.h+8);ctx.strokeStyle='#4b7790';ctx.strokeRect(mini.x-4,mini.y-4,mini.w+8,mini.h+8);
  label('RADAR',mini.x+47,mini.y-9,'#a2c6d5',7);
  for(let y=0;y<40;y++)for(let x=0;x<40;x++)if(v.seen[y*40+x]){ctx.fillStyle=v.visible[y*40+x]?'#254458':'#142538';ctx.fillRect(mini.x+x/40*94,mini.y+y/40*94,2.5,2.5)}
  for(const n of v.crystals){ctx.fillStyle=n.rich?'#ff87dc':'#93f4ff';ctx.fillRect(mini.x+n.x/40*94,mini.y+n.y/40*94,2,2)}for(const e of v.entities){ctx.fillStyle=e.side===v.side?colors.ally:colors.enemy;ctx.fillRect(mini.x+e.x/40*94-1,mini.y+e.y/40*94-1,e.type==='base'?4:2,e.type==='base'?4:2)}
  ctx.strokeStyle='#dbeafc';ctx.strokeRect(mini.x+camera.x/40*94-9,mini.y+camera.y/40*94-9,18,18);
  if(paused){ctx.fillStyle='#02081577';ctx.fillRect(0,0,width,height);label('BATTLE PAUSED',width/2,height*.4,'#ffffff',22)}
 }
 function pan(dx,dy){const a=dx/(zoom*.85),b=dy/(zoom*.43);camera.x=Math.max(1,Math.min(39,camera.x-(a+b)/2));camera.y=Math.max(1,Math.min(39,camera.y-(b-a)/2))}
 function center(x,y){camera={x,y}}
 function hit(v,x,y){const near=v.entities.filter(e=>{const p=point(e.x,e.y,.4);return Math.hypot(p.x-x,p.y-y)<(E.TYPES[e.type].supply?19:35)}).sort((a,b)=>{const pa=point(a.x,a.y,.4),pb=point(b.x,b.y,.4);return Math.hypot(pa.x-x,pa.y-y)-Math.hypot(pb.x-x,pb.y-y)});return near[0]}
 function minimap(x,y){if(x>=mini.x&&x<=mini.x+mini.w&&y>=mini.y&&y<=mini.y+mini.h){center((x-mini.x)/mini.w*40,(y-mini.y)/mini.h*40);return true}return false}
 function zoomBy(delta){zoomLevel=Math.max(.7,Math.min(1.7,zoomLevel+delta));return zoomLevel}
 return{render,world,pan,center,hit,minimap,point,zoomBy};
}
window.CrystalRenderer={create};})();
