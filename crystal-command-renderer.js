(()=>{'use strict';
const E=CrystalCommand;
function create(canvas){const ctx=canvas.getContext('2d');let width=400,height=430,zoom=32,camera={x:6,y:6},selected=new Set(),mini={x:0,y:0,w:96,h:96};
 const colors={ally:'#55edff',enemy:'#ff9160',gold:'#ffdc82'};
 function point(x,y,z=0){return{x:width/2+(x-y-camera.x+camera.y)*zoom*.85,y:height*.46+(x+y-camera.x-camera.y)*zoom*.43-z*zoom}}
 function world(x,y){const a=(x-width/2)/(zoom*.85),b=(y-height*.46)/(zoom*.43);return{x:camera.x+(a+b)/2,y:camera.y+(b-a)/2}}
 function poly(points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
 function tile(x,y,r,fill,stroke,z=0){poly([point(x-r,y-r,z),point(x+r,y-r,z),point(x+r,y+r,z),point(x-r,y+r,z)],fill,stroke)}
 function box(x,y,r,h,color){const a=point(x-r,y-r),b=point(x+r,y-r),c=point(x+r,y+r),d=point(x-r,y+r),aa=point(x-r,y-r,h),bb=point(x+r,y-r,h),cc=point(x+r,y+r,h),dd=point(x-r,y+r,h);poly([b,c,cc,bb],'#182536','#344b63');poly([c,d,dd,cc],'#0b1524','#24394f');poly([aa,bb,cc,dd],color,'#60738c')}
 function line(a,b,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}
 function label(s,x,y,color,size=10){ctx.font=`600 ${size}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#020611';ctx.fillText(s,x+1,y+1);ctx.fillStyle=color;ctx.fillText(s,x,y)}
 function render(v,{selection=[],build=null,pointer=null,paused=false}={}){
  selected=new Set(selection);const ratio=Math.min(2,window.devicePixelRatio||1),r=canvas.getBoundingClientRect();width=r.width;height=r.height;zoom=width>700?48:36;const bw=Math.round(width*ratio),bh=Math.round(height*ratio);if(canvas.width!==bw||canvas.height!==bh){canvas.width=bw;canvas.height=bh}ctx.setTransform(ratio,0,0,ratio,0,0);ctx.fillStyle='#050a15';ctx.fillRect(0,0,width,height);
  const grad=ctx.createRadialGradient(width/2,height*.4,10,width/2,height*.4,width);grad.addColorStop(0,'#142336');grad.addColorStop(1,'#030812');ctx.fillStyle=grad;ctx.fillRect(0,0,width,height);
  for(let y=0;y<40;y++)for(let x=0;x<40;x++){const p=point(x+.5,y+.5),i=y*40+x;if(p.x< -zoom||p.x>width+zoom||p.y< -zoom||p.y>height+zoom)continue;const seen=v.seen[i],vis=v.visible[i],hash=(x*13+y*7)%5;tile(x+.5,y+.5,.5,!seen?'#080e1a':vis?['#1a2938','#1d2d3c','#182737','#223140','#1b2a3a'][hash]:'#101b29',!seen?'#0b1320':'#233648');if(vis&&(x+y)%13===0)line(point(x+.2,y+.5),point(x+.7,y+.5),'#365169',1)}
  const objects=[...v.rocks.map(o=>({...o,rock:true})),...v.crystals.map(o=>({...o,crystal:true})),...v.entities].sort((a,b)=>a.x+a.y-b.x-b.y);
  for(const o of objects){const i=Math.floor(o.y)*40+Math.floor(o.x);if(!v.seen[i])continue;const p=point(o.x,o.y);if(p.x< -100||p.x>width+100||p.y< -100||p.y>height+100)continue;
   ctx.save();ctx.globalAlpha=v.visible[i]?1:.3;
   ctx.fillStyle='#02061188';ctx.beginPath();ctx.ellipse(p.x,p.y+5,zoom*.5,zoom*.2,0,0,Math.PI*2);ctx.fill();
   if(o.rock){box(o.x+.5,o.y+.5,.45,.7,'#43556c');box(o.x+.25,o.y+.4,.22,1.1,'#536982')}
   else if(o.crystal){if(o.left<=0){tile(o.x,o.y,.4,'#172837','#3b5a64')}else{for(let j=0;j<3;j++){const q=point(o.x+(j-1)*.25,o.y+(j%2)*.25);const h=zoom*(j===1?1.1:.75);poly([{x:q.x-zoom*.17,y:q.y},{x:q.x-zoom*.2,y:q.y-h*.55},{x:q.x,y:q.y-h},{x:q.x+zoom*.2,y:q.y-h*.6},{x:q.x+zoom*.18,y:q.y}],o.rich?'#d957cf':'#36bce0',o.rich?'#ffb3f7':'#9af8ff');line({x:q.x,y:q.y-h},{x:q.x,y:q.y},'#d3ffff',1)}if(o.rich&&v.time%12>9){ctx.strokeStyle='#fa7dce';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,zoom*2,zoom*.85,0,0,Math.PI*2);ctx.stroke()}}}
   else{const d=E.TYPES[o.type],c=o.side===v.side?colors.ally:colors.enemy;
    if(selected.has(o.id)){ctx.strokeStyle=c;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y+5,zoom*(d.radius||.5),zoom*(d.radius||.5)*.43,0,0,Math.PI*2);ctx.stroke()}
    if(d.supply){const size=o.type==='siege'?.45:o.type==='laser'?.25:.2;box(o.x,o.y,size,o.type==='siege'?.4:.35,o.side===v.side?'#537a8b':'#9c6454');const top=point(o.x,o.y,.6);ctx.fillStyle=c;ctx.fillRect(top.x-zoom*.1,top.y,zoom*.2,zoom*.1);if(o.type==='worker'){const wobble=Math.sin(v.time*5+o.id)*2;line({x:top.x-7,y:top.y+4},{x:top.x-10,y:top.y+9+wobble},'#b2bed0',2);line({x:top.x+7,y:top.y+4},{x:top.x+10,y:top.y+9-wobble},'#b2bed0',2);if(o.carry){ctx.fillStyle='#5aecff';ctx.fillRect(top.x-3,top.y-5,6,5)}if(o.mine>0){const n=v.crystals.find(n=>Math.hypot(o.x-n.x,o.y-n.y)<1);if(n)line(top,point(n.x,n.y,.4),'#86fcff',1)}}else{line(top,{x:top.x+11,y:top.y-3},c,o.type==='siege'?4:2)}}
    else{tile(o.x,o.y,d.radius+.2,'#182333',c);box(o.x,o.y,d.radius*.8,.4,'#314a61');
     if(o.type==='base'){box(o.x,o.y,.75,1,'#45677d');for(const [dx,dy]of [[-1,-1],[1,-1],[1,1],[-1,1]]){box(o.x+dx,o.y+dy,.2,.8,'#314b68');const t=point(o.x+dx,o.y+dy,.9);ctx.fillStyle=c;ctx.fillRect(t.x-3,t.y-3,6,4)}const core=point(o.x,o.y,1.4);ctx.fillStyle=c;ctx.shadowBlur=12;ctx.shadowColor=c;ctx.beginPath();ctx.arc(core.x,core.y,7+Math.sin(v.time*2)*1,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;label('COMMAND',p.x,p.y+27,c,9)}
     else if(o.type==='factory'){box(o.x,o.y,.75,.9,'#3d566f');box(o.x-.4,o.y-.4,.15,1.4,'#536c82');const q=point(o.x+.35,o.y+.35,.8);ctx.fillStyle=c;ctx.fillRect(q.x-8,q.y,16,3);label('FACTORY',p.x,p.y+21,c,8)}
     else if(o.type==='turret'){box(o.x,o.y,.3,1.1,'#617184');const q=point(o.x,o.y,1.1);line(q,{x:q.x+14,y:q.y-5},c,5)}
     else if(o.type==='relay'){box(o.x,o.y,.2,1.1,'#4c657c');line(point(o.x-.45,o.y,.95),point(o.x+.45,o.y,.95),c,3)}
     else if(o.type==='lab'){const q=point(o.x,o.y,1);ctx.strokeStyle=c;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(q.x,q.y,15,9,v.time*.5,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#dc96ff';ctx.beginPath();ctx.arc(q.x,q.y,5,0,Math.PI*2);ctx.fill()}
    }
    if(o.hp<o.maxHp||selected.has(o.id)||o.build){const q=point(o.x,o.y,d.supply?1:1.9);ctx.fillStyle='#020813';ctx.fillRect(q.x-17,q.y-7,34,4);ctx.fillStyle=o.build?'#ffd780':c;ctx.fillRect(q.x-17,q.y-7,34*(o.build?1-o.build/d.time:o.hp/o.maxHp),4);if(o.build)label(Math.ceil(o.build)+'s',q.x,q.y-11,'#ffd780',9)}
   }ctx.restore();
  }
  for(const e of v.events||[]){if(e.type!=='shot')continue;line(point(e.x,e.y,.5),point(e.tx,e.ty,.35),e.side===v.side?'#9bfcff':'#ffad71',e.kind==='siege'?3:1.5)}
  if(build&&pointer){const at=world(pointer.x,pointer.y);tile(at.x,at.y,E.TYPES[build].radius,'#4acddd44','#8ffaff')}
  // Tactical minimap shows only explored land and visible opponents.
  mini={x:width-102,y:height-105,w:94,h:94};ctx.fillStyle='#060d1ce8';ctx.fillRect(mini.x-4,mini.y-4,mini.w+8,mini.h+8);ctx.strokeStyle='#4b7790';ctx.strokeRect(mini.x-4,mini.y-4,mini.w+8,mini.h+8);
  for(let y=0;y<40;y++)for(let x=0;x<40;x++)if(v.seen[y*40+x]){ctx.fillStyle=v.visible[y*40+x]?'#254458':'#142538';ctx.fillRect(mini.x+x/40*94,mini.y+y/40*94,2.5,2.5)}
  for(const n of v.crystals){ctx.fillStyle=n.rich?'#ff87dc':'#93f4ff';ctx.fillRect(mini.x+n.x/40*94,mini.y+n.y/40*94,2,2)}for(const e of v.entities){ctx.fillStyle=e.side===v.side?colors.ally:colors.enemy;ctx.fillRect(mini.x+e.x/40*94-1,mini.y+e.y/40*94-1,e.type==='base'?4:2,e.type==='base'?4:2)}
  ctx.strokeStyle='#dbeafc';ctx.strokeRect(mini.x+camera.x/40*94-9,mini.y+camera.y/40*94-9,18,18);
  if(paused){ctx.fillStyle='#02081577';ctx.fillRect(0,0,width,height);label('BATTLE PAUSED',width/2,height*.4,'#ffffff',22)}
 }
 function pan(dx,dy){const a=dx/(zoom*.85),b=dy/(zoom*.43);camera.x=Math.max(1,Math.min(39,camera.x-(a+b)/2));camera.y=Math.max(1,Math.min(39,camera.y-(b-a)/2))}
 function center(x,y){camera={x,y}}
 function hit(v,x,y){const near=v.entities.filter(e=>{const p=point(e.x,e.y,.4);return Math.hypot(p.x-x,p.y-y)<(E.TYPES[e.type].supply?19:35)}).sort((a,b)=>{const pa=point(a.x,a.y,.4),pb=point(b.x,b.y,.4);return Math.hypot(pa.x-x,pa.y-y)-Math.hypot(pb.x-x,pb.y-y)});return near[0]}
 function minimap(x,y){if(x>=mini.x&&x<=mini.x+mini.w&&y>=mini.y&&y<=mini.y+mini.h){center((x-mini.x)/mini.w*40,(y-mini.y)/mini.h*40);return true}return false}
 return{render,world,pan,center,hit,minimap,point};
}
window.CrystalRenderer={create};})();
