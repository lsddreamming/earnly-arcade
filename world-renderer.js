/* Original Earnly isometric canvas art. No external sprite packs. */
(()=>{
 const images=new Map(),sprites=new Map();
 function image(src){if(!/^cosmetic-[a-z0-9-]+\.svg$/.test(src))return null;if(!images.has(src)){const i=new Image();i.src=src;images.set(src,i);}return images.get(src);}
 function poly(c,points,color,stroke){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}}
 function shade(hex,n){const rgb=String(hex).match(/^rgb\((\d+),(\d+),(\d+)\)$/),v=parseInt((hex||'#78bed1').slice(1),16),channels=rgb?rgb.slice(1).map(Number):[v>>16,(v>>8)&255,v&255];return 'rgb('+channels.map(c=>Math.max(0,Math.min(255,c+n))).join(',')+')';}
 function box(c,x,y,w,l,h,color){const a=[x,y-h],b=[x+w*18,y+w*9-h],d=[x-l*18,y+l*9-h],e=[x+(w-l)*18,y+(w+l)*9-h];poly(c,[a,b,e,d],shade(color,22),'#172333');poly(c,[d,e,[e[0],e[1]+h],[d[0],d[1]+h]],shade(color,-24),'#172333');poly(c,[b,e,[e[0],e[1]+h],[b[0],b[1]+h]],color,'#172333');}
 function decor(c,item,x,y){const color=item.color||'#67d1cc',s=item.sprite||item.sprite_id||'table';c.save();c.translate(Math.round(x),Math.round(y));if(item.rotation===2||item.rotation===6)c.scale(-1,1);
  if(s==='rug'){poly(c,[[0,0],[36,18],[0,36],[-36,18]],shade(color,-35),'#94dcd1');poly(c,[[0,4],[28,18],[0,32],[-28,18]],color,'#b6ece0');}
  else if(s==='sofa'||s==='bed'){
    const w=s==='sofa'?2:1,l=s==='bed'?2:1;box(c,0,0,w,l,9,shade(color,-24));box(c,-2,-7,w,l,8,color);box(c,-14,-7,.18,l,22,shade(color,-3));
    if(s==='sofa'){box(c,0,-10,w,.18,24,shade(color,-8));box(c,30,7,.23,1,13,color);poly(c,[[0,-9],[12,-3],[0,3],[-12,-3]],shade(color,28));}
    else{box(c,0,-8,1,.55,6,'#e6ebe5');poly(c,[[0,1],[17,10],[-5,22],[-21,13]],shade(color,18));}
  }else if(s==='chair'){box(c,0,0,1,1,10,shade(color,-25));box(c,0,-8,1,1,4,color);box(c,0,-8,1,.18,22,color);}
  else if(s==='plant'){box(c,0,0,.7,.7,12,'#e0ac7d');for(const [dx,dy] of [[0,-24],[-9,-20],[9,-22],[0,-35]]){poly(c,[[dx,dy+14],[dx-7,dy],[dx,dy-8],[dx+6,dy+3]],dy===-35?'#9bdd8b':'#519b77','#2f6652');}}
  else if(s==='lamp'){box(c,0,0,.65,.65,4,'#354459');c.fillStyle='#86bac2';c.fillRect(-1,-31,3,31);poly(c,[[-10,-30],[0,-45],[12,-24],[1,-18]],color,'#f0dcff');c.fillStyle='#fff0cc';c.fillRect(0,-27,2,8);}
  else if(s==='arcade'){box(c,0,0,1,1,32,shade(color,-38));box(c,0,-27,1,1,17,color);poly(c,[[1,-40],[16,-32],[16,-18],[1,-26]],'#152b45','#8ceaf1');c.fillStyle='#7efcd6';c.fillRect(5,-31,3,3);c.fillStyle='#e28be8';c.fillRect(11,-25,3,3);poly(c,[[1,-18],[20,-8],[15,-4],[-3,-13]],'#547383','#142a39');c.fillStyle='#ec9eac';c.fillRect(6,-12,3,3);}
  else if(s==='speaker'){box(c,0,0,1,1,29,'#314155');for(const yy of [-18,-7]){c.fillStyle='#151e31';c.beginPath();c.ellipse(8,yy,6,7,.3,0,7);c.fill();c.strokeStyle=color;c.stroke();}}
  else if(s==='trophy'){box(c,0,0,.8,.8,6,'#58637c');c.fillStyle=color;c.fillRect(-1,-26,4,22);poly(c,[[0,-40],[8,-27],[5,-17],[-4,-17],[-8,-27]],color,'#a77c42');c.fillStyle='#fff2ad';c.fillRect(-2,-31,3,8);}
  else {box(c,0,0,1,1,s==='plinth'?18:13,color);if(s==='table')box(c,0,-12,1.1,1.1,4,shade(color,15));}
 c.restore();}
 function avatar(c,user,x,y){const equipped=user.equipped||{avatar:{id:'cyber-starter',imageUrl:'cosmetic-cyber-starter.svg'},outfit:{imageUrl:'cosmetic-starter-suit.svg'},shoes:{imageUrl:'cosmetic-canvas-shoes.svg'}};
  const parts=window.EarnlyPotatoRig?.compose(equipped)||[];let drew=false;
  c.save();c.translate(Math.round(x),Math.round(y));c.fillStyle='#0b172a77';c.beginPath();c.ellipse(0,1,11,5,0,0,7);c.fill();
  if(user.facing==='left')c.scale(-1,1);
  if(user.state==='sit')c.translate(0,7);if(user.state==='lay'){c.translate(-12,-10);c.rotate(Math.PI/2);}if(user.state==='wlk')c.translate(0,Math.sin(performance.now()/75)>0?-1:0);
  const key=JSON.stringify(parts.map(p=>p.imageUrl));let sprite=sprites.get(key);
  if(!sprite){const loaded=parts.map(p=>image(p.imageUrl));if(loaded.length&&loaded.every(i=>i?.complete&&i.naturalWidth)){sprite=document.createElement('canvas');sprite.width=32;sprite.height=48;const sc=sprite.getContext('2d');for(const img of loaded)sc.drawImage(img,0,0,32,48);sprites.set(key,sprite);}}
  if(sprite){c.drawImage(sprite,-16,-46,32,48);drew=true;}
  if(!drew){c.fillStyle='#173f58';c.fillRect(-8,-20,16,17);c.fillStyle='#7ef0d6';c.fillRect(-8,-19,16,2);c.fillStyle='#ad855d';c.fillRect(-10,-37,20,19);c.fillStyle='#ecc898';c.fillRect(-8,-40,16,20);c.fillStyle='#fff3cf';c.fillRect(-5,-34,4,6);c.fillRect(3,-34,4,6);c.fillStyle='#1e495b';c.fillRect(-4,-32,2,4);c.fillRect(4,-32,2,4);c.fillStyle='#645448';c.fillRect(-2,-25,5,2);c.fillStyle='#73c292';c.fillRect(0,-44,3,5);c.fillStyle='#263447';c.fillRect(-8,-4,6,5);c.fillRect(3,-4,6,5);}
 c.restore();}
 class WorldRenderer{
  constructor(canvas,onTap){this.canvas=canvas;this.c=canvas.getContext('2d');this.onTap=onTap;this.scene=null;this.users=new Map();this.offset={x:0,y:0};this.zoom=1;this.hit=[];this.selected=null;this.bubbles=new Map();
    new ResizeObserver(()=>this.resize()).observe(canvas);this.resize();
    canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);this.drag={x:e.clientX,y:e.clientY,ox:this.offset.x,oy:this.offset.y,moved:false};});
    canvas.addEventListener('pointermove',e=>{if(this.drag){const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;if(Math.hypot(dx,dy)>8)this.drag.moved=true;if(this.drag.moved){this.offset={x:this.drag.ox+dx,y:this.drag.oy+dy};}}});
    canvas.addEventListener('pointerup',e=>{if(this.drag&&!this.drag.moved){const r=canvas.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;const x=(px-this.cx)/this.scale,y=(py-this.cy)/this.scale;const person=[...this.hit].reverse().find(h=>Math.abs(x-h.x)<15&&y>h.y-47&&y<h.y+4);if(person)this.onTap({user:person.user});else{const tx=Math.floor((x/18+y/9)/2),ty=Math.floor((y/9-x/18)/2);this.selected={x:tx,y:ty};this.onTap({x:tx,y:ty});}}this.drag=null;});canvas.addEventListener('pointercancel',()=>this.drag=null);
    this.running=true;const loop=()=>{if(!this.running)return;this.draw();requestAnimationFrame(loop);};requestAnimationFrame(loop);
  }
  resize(){const r=this.canvas.getBoundingClientRect();this.canvas.width=Math.round(r.width);this.canvas.height=Math.round(r.height);this.c.imageSmoothingEnabled=false;}
  setScene(scene){this.scene=scene;this.offset={x:0,y:0};}
  setUsers(users){this.users.clear();users.forEach(u=>this.updateUser(u));}
  updateUser(u){const previous=this.users.get(u.userId);this.users.set(u.userId,{...previous,...u,old:previous?.position||u.position,at:performance.now(),facing:previous&&u.position.x<previous.position.x?'left':'right'});}
  bubble(packet){this.bubbles.set(packet.userId,{text:packet.text,until:performance.now()+6000,mode:packet.mode});}
  draw(){const c=this.c,w=this.canvas.width,h=this.canvas.height;c.clearRect(0,0,w,h);if(!this.scene)return;const floor=this.scene.heightmap.split('\n'),n=floor[0].length,m=floor.length;
    this.scale=Math.min(w/((n+m)*18+70),h/((n+m)*9+150))*this.zoom;this.cx=w/2+(m-n)*9*this.scale+this.offset.x;this.cy=(h-(n+m)*9*this.scale)/2+44*this.scale+this.offset.y;c.save();c.translate(this.cx,this.cy);c.scale(this.scale,this.scale);c.imageSmoothingEnabled=false;
    // Original mint/slate walls, window panels and neon lighting.
    poly(c,[[0,0],[-m*18,m*9],[-m*18,m*9-58],[0,-58]],'#6d9397','#1d3b4d');poly(c,[[0,0],[n*18,n*9],[n*18,n*9-58],[0,-58]],'#91a5af','#284155');
    for(let i=1;i<n-1;i+=3){const x=i*18,y=i*9;poly(c,[[x,y-43],[x+30,y-28],[x+30,y-10],[x,y-25]],'#234864','#cee5dc');poly(c,[[x+3,y-40],[x+27,y-28],[x+27,y-24],[x+3,y-36]],'#71e6d4');}
    poly(c,[[0,-55],[-m*18,m*9-55],[-m*18,m*9-52],[0,-52]],'#86f4d6');poly(c,[[0,-55],[n*18,n*9-55],[n*18,n*9-52],[0,-52]],'#c1adf2');
    for(let y=0;y<m;y++)for(let x=0;x<n;x++){if(/[xX]/.test(floor[y][x]))continue;const z=Number(floor[y][x]),px=(x-y)*18,py=(x+y)*9-z*12;poly(c,[[px,py],[px+18,py+9],[px,py+18],[px-18,py+9]],(x+y)%2?'#b0b7aa':'#a5afa5','#8c9b9a');if(y===m-1||x===n-1){poly(c,[[px-18,py+9],[px,py+18],[px+18,py+9],[px+18,py+17],[px,py+26],[px-18,py+17]],'#54717b','#264655');}}
    if(this.selected){const {x,y}=this.selected;if(x>=0&&y>=0&&x<n&&y<m){const px=(x-y)*18,py=(x+y)*9;poly(c,[[px,py],[px+18,py+9],[px,py+18],[px-18,py+9]],'#7cf2ce88','#b9fff0');}}
    const nodes=(this.scene.items||[]).map(item=>({depth:item.x+item.y+(item.width+item.length)/2-.3,item}));for(const u of this.users.values())nodes.push({depth:u.position.x+u.position.y+1,user:u});nodes.sort((a,b)=>a.depth-b.depth);this.hit=[];
    for(const node of nodes){if(node.item){const i=node.item;decor(c,i,(i.x-i.y)*18,(i.x+i.y)*9-i.z*12);}else{const u=node.user,t=Math.min(1,(performance.now()-u.at)/220),px=u.old.x+(u.position.x-u.old.x)*t,py=u.old.y+(u.position.y-u.old.y)*t;const x=(px-py)*18,y=(px+py)*9+9-u.position.z*12;avatar(c,u,x,y);this.hit.push({x,y,user:u});c.font='7px monospace';c.textAlign='center';const name=u.username||'You';c.fillStyle='#132436d9';c.fillRect(x-name.length*2.3-4,y+4,name.length*4.6+8,11);c.fillStyle='#edfff5';c.fillText(name,x,y+12);}}
    for(const hit of this.hit){const bubble=this.bubbles.get(hit.user.userId);if(bubble&&bubble.until>performance.now()){const text=bubble.text.length>36?bubble.text.slice(0,35)+'…':bubble.text;c.font=(bubble.mode==='shout'?'bold ':'')+'8px monospace';const width=c.measureText(text).width+12;c.fillStyle='#f2f4e6';c.fillRect(hit.x-width/2,hit.y-63,width,14);poly(c,[[hit.x,hit.y-49],[hit.x+5,hit.y-49],[hit.x,hit.y-44]],'#f2f4e6');c.fillStyle='#23384a';c.textAlign='center';c.fillText(text,hit.x,hit.y-53);}}
    c.restore();
  }
 }
 function thumbnail(canvas,item){canvas.width=160;canvas.height=105;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.translate(80,75);c.scale(1.8,1.8);decor(c,item,0,0);}
 window.EarnlyWorldRenderer={WorldRenderer,thumbnail};
})();
