/* Original Earnly isometric canvas art. No external sprite packs. */
(()=>{
 const images=new Map(),sprites=new Map();
 function image(src){if(!/^cosmetic-[a-z0-9-]+\.svg$/.test(src))return null;if(!images.has(src)){const i=new Image();i.src=src;images.set(src,i);}return images.get(src);}
 function poly(c,points,color,stroke){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}}
 function shade(hex,n){const rgb=String(hex).match(/^rgb\((\d+),(\d+),(\d+)\)$/),v=parseInt((hex||'#78bed1').slice(1),16),channels=rgb?rgb.slice(1).map(Number):[v>>16,(v>>8)&255,v&255];return 'rgb('+channels.map(c=>Math.max(0,Math.min(255,c+n))).join(',')+')';}
 function box(c,x,y,w,l,h,color){const a=[x,y-h],b=[x+w*18,y+w*9-h],d=[x-l*18,y+l*9-h],e=[x+(w-l)*18,y+(w+l)*9-h];poly(c,[a,b,e,d],shade(color,22),'#172333');poly(c,[d,e,[e[0],e[1]+h],[d[0],d[1]+h]],shade(color,-24),'#172333');poly(c,[b,e,[e[0],e[1]+h],[b[0],b[1]+h]],color,'#172333');}
 // Small, original pixel-scale details stay legible both in rooms and the catalog.
 function decor(c,item,x,y){
  const color=item.color||'#67d1cc',s=item.sprite||item.sprite_id||'table';
  const dims={sofa:[2,1],bed:[1,2],rug:[2,2]},[w,l]=dims[s]||[1,1];
  c.save();c.translate(Math.round(x),Math.round(y));
  if(item.rotation===2||item.rotation===6)c.scale(-1,1);
  const point=(u,v,z=0)=>[(u-v)*18,(u+v)*9-z];
  const cube=(u,v,a,b,h,z,tint)=>{const [px,py]=point(u,v,z);box(c,px,py,a,b,h,tint);};
  const line=(points,tint,width=1)=>{c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.strokeStyle=tint;c.lineWidth=width;c.stroke();};
  const tile=(u,v,a,b,z,tint,edge)=>poly(c,[point(u,v,z),point(u+a,v,z),point(u+a,v+b,z),point(u,v+b,z)],tint,edge);
  tile(.04,.05,w,.98*l,0,'#14273735');
  const legs=(a,b)=>{for(const [u,v] of [[.12,.12],[a-.23,.12],[.12,b-.23],[a-.23,b-.23]])cube(u,v,.12,.12,6,0,'#334455');};
  if(s==='rug'){
   tile(0,0,2,2,1,shade(color,-38),'#254a55');tile(.13,.13,1.74,1.74,1,color,'#c4f4e1');
   tile(.28,.28,1.44,1.44,1,shade(color,-13));tile(.72,.72,.56,.56,1,shade(color,40));
   for(let i=.22;i<1.9;i+=.22){line([point(i,0,1),point(i,-.1,1)],'#d7ead5');line([point(i,2,1),point(i,2.1,1)],'#d7ead5');}
  }else if(s==='sofa'){
   legs(2,1);cube(0,0,2,1,7,5,shade(color,-32));
   cube(.02,0,1.96,.18,23,10,shade(color,-12));
   for(let u=.2;u<1.8;u+=.81){cube(u,.2,.77,.68,5,12,color);cube(u,.06,.77,.14,13,16,shade(color,8));
    line([point(u+.04,.84,17),point(u+.72,.84,17)],shade(color,48));}
   cube(0,.15,.18,.85,12,10,color);cube(1.82,.15,.18,.85,12,10,color);
   cube(.29,.31,.32,.3,6,17,'#ffe5a1');cube(1.34,.3,.3,.3,6,17,shade(color,-42));
   line([point(.05,1,12),point(1.95,1,12)],shade(color,26));
  }else if(s==='bed'){
   legs(1,2);cube(0,0,1,2,6,5,'#866754');cube(0,0,1,.14,26,5,shade(color,-24));
   cube(.04,.15,.92,1.8,7,11,'#eef0db');cube(.09,.25,.82,.43,4,18,'#fff7e5');
   cube(.04,.84,.92,1.11,3,18,color);tile(.04,.84,.92,.18,22,shade(color,34));
   for(let v=1.15;v<1.9;v+=.24)line([point(.15,v,22),point(.85,v,22)],shade(color,15));
  }else if(s==='chair'){
   legs(1,1);cube(.05,.05,.9,.9,4,6,shade(color,-32));cube(.04,.04,.92,.92,5,10,color);
   cube(.06,.02,.88,.15,23,9,shade(color,-12));tile(.16,.24,.68,.57,15,shade(color,21));
   line([point(.18,.03,28),point(.82,.03,28)],shade(color,46));
  }else if(s==='plant'){
   cube(.2,.2,.6,.6,11,1,'#c88f6b');cube(.15,.15,.7,.7,3,11,'#edbc90');tile(.22,.22,.56,.56,15,'#493e37');
   const base=point(.5,.5,15);line([base,[0,-35]],'#3e795c',2);
   for(const [dx,dy,k] of [[-13,-17,0],[14,-22,1],[-10,-32,1],[8,-40,0],[0,-47,1]]){
    line([base,[dx,dy]],'#477d5b');poly(c,[[0,dy+12],[dx-6,dy+2],[dx,dy-5],[dx+6,dy+2]],k?'#8bcf83':'#4eaa78','#32684d');line([[0,dy+12],[dx,dy-2]],'#b5e599');}
  }else if(s==='lamp'){
   cube(.17,.17,.66,.66,4,0,'#3e5268');line([point(.5,.5,4),point(.5,.5,39)],'#9bced1',3);
   cube(.12,.12,.76,.76,13,34,shade(color,-7));tile(.2,.2,.6,.6,47,shade(color,45),'#e5efdd');
   line([point(.16,.88,36),point(.84,.88,36)],'#fff3bf',2);tile(.28,.28,.44,.44,5,'#f6dda24d');
  }else if(s==='arcade'){
   cube(.05,.08,.9,.9,28,0,shade(color,-50));cube(0,0,1,.78,25,25,color);
   // Screen and controls are on the front-facing plane, with a recessed bezel.
   poly(c,[point(.12,.79,44),point(.88,.79,44),point(.88,.79,30),point(.12,.79,30)],'#102b41','#d5f7e9');
   poly(c,[point(.2,.8,40),point(.42,.8,40),point(.42,.8,34),point(.2,.8,34)],'#7ff0d8');
   line([point(.55,.8,34),point(.66,.8,39),point(.78,.8,34)],'#e8b0fa',2);
   cube(0,.76,1,.28,4,22,'#436579');line([point(.24,.93,27),point(.24,.93,32)],'#1b2736',2);
   const joy=point(.24,.93,32);c.fillStyle='#f29cba';c.fillRect(joy[0]-2,joy[1]-2,4,3);
   for(const u of [.64,.82]){const p=point(u,.94,27);c.fillStyle='#ffde82';c.fillRect(p[0]-1,p[1]-1,3,2);}
   line([point(.16,.79,47),point(.83,.79,47)],'#fff0b4',2);line([point(.43,.99,11),point(.66,.99,11)],'#bed5d9',2);
  }else if(s==='speaker'){
   cube(.08,.08,.84,.84,34,1,'#33495e');
   for(const [z,r] of [[26,4],[13,7]]){const [px,py]=point(.5,.94,z);c.save();c.translate(px,py);c.transform(1,.5,0,1,0,0);c.fillStyle='#122536';c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.fill();c.strokeStyle=color;c.stroke();c.fillStyle='#6f8899';c.fillRect(-1,-1,2,2);c.restore();}
   line([point(.19,.94,3),point(.8,.94,3)],color);
  }else if(s==='trophy'){
   cube(.1,.1,.8,.8,5,0,'#354c68');cube(.28,.28,.44,.44,3,5,'#b59151');
   const [cx,cy]=point(.5,.5);c.save();c.translate(cx,cy);
   line([[-6,-28],[-12,-30],[-12,-20],[-5,-16]],'#d49a45',2);line([[6,-28],[12,-30],[12,-20],[5,-16]],'#d49a45',2);
   c.fillStyle='#dcaa50';c.fillRect(-2,-20,4,13);poly(c,[[-8,-33],[8,-33],[6,-21],[0,-17],[-6,-21]],color,'#9b723e');
   line([[-5,-30],[-4,-23]],'#fff3b3',2);c.fillStyle='#fce4a0';c.fillRect(-4,-10,8,2);c.restore();
  }else if(s==='plinth'){
   cube(.03,.03,.94,.94,3,0,shade(color,-32));cube(.13,.13,.74,.74,19,3,color);cube(0,0,1,1,4,22,shade(color,12));
   line([point(.25,.88,18),point(.25,.88,7)],shade(color,34));
  }else{
   legs(1,1);cube(.06,.06,.88,.88,6,5,shade(color,-35));cube(0,0,1,1,4,11,color);tile(.1,.1,.8,.8,15,shade(color,25));
   line([point(.18,.25,15),point(.8,.25,15)],shade(color,42));
  }
  c.restore();
 }
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
    canvas.addEventListener('pointerup',e=>{if(this.drag&&!this.drag.moved){const r=canvas.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;const x=(px-this.cx)/this.scale,y=(py-this.cy)/this.scale;const person=[...this.hit].reverse().find(h=>Math.abs(x-h.x)<15&&y>h.y-47&&y<h.y+4);if(person)this.onTap({user:person.user});else{const tx=Math.floor((x/18+y/9)/2),ty=Math.floor((y/9-x/18)/2);this.selected={x:tx,y:ty};this.onTap({x:tx,y:ty,item:this.pickItem(x,y)});}}this.drag=null;});canvas.addEventListener('pointercancel',()=>this.drag=null);
    this.running=true;const loop=()=>{if(!this.running)return;this.draw();requestAnimationFrame(loop);};requestAnimationFrame(loop);
  }
  pickItem(x,y){
    // Hit-test the original sprite pixels, including tall decor above its floor tile.
    const canvas=this.pickCanvas||(this.pickCanvas=document.createElement('canvas'));canvas.width=canvas.height=1;
    const c=canvas.getContext('2d',{willReadFrequently:true});
    const items=[...(this.scene?.items||[])].sort((a,b)=>(a.x+a.y+(a.width+a.length)/2)-(b.x+b.y+(b.width+b.length)/2));
    for(const item of items.reverse()){c.clearRect(0,0,1,1);decor(c,item,(item.x-item.y)*18-x,(item.x+item.y)*9-item.z*12-y);if(c.getImageData(0,0,1,1).data[3]>0)return item;}
    return null;
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
 function thumbnail(canvas,item){canvas.width=160;canvas.height=128;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.translate(80,(item.sprite||item.sprite_id)==='rug'?60:76);c.scale(1.5,1.5);decor(c,item,0,0);}
 window.EarnlyWorldRenderer={WorldRenderer,thumbnail};
})();
