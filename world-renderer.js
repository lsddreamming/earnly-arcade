/* Original Earnly isometric canvas art. No external sprite packs. */
(()=>{
 const images=new Map(),sprites=new Map(),reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
 function image(src){if(!/^cosmetic-[a-z0-9-]+\.svg$/.test(src))return null;if(!images.has(src)){const i=new Image();i.src=src;images.set(src,i);}return images.get(src);}
 function poly(c,points,color,stroke){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}}
 function shade(hex,n){const rgb=String(hex).match(/^rgb\((\d+),(\d+),(\d+)\)$/),v=parseInt((hex||'#78bed1').slice(1),16),channels=rgb?rgb.slice(1).map(Number):[v>>16,(v>>8)&255,v&255];return 'rgb('+channels.map(c=>Math.max(0,Math.min(255,c+n))).join(',')+')';}
 function box(c,x,y,w,l,h,color){const a=[x,y-h],b=[x+w*18,y+w*9-h],d=[x-l*18,y+l*9-h],e=[x+(w-l)*18,y+(w+l)*9-h];poly(c,[a,b,e,d],shade(color,22),'#172333');poly(c,[d,e,[e[0],e[1]+h],[d[0],d[1]+h]],shade(color,-24),'#172333');poly(c,[b,e,[e[0],e[1]+h],[b[0],b[1]+h]],color,'#172333');}
 // Small, original pixel-scale details stay legible both in rooms and the catalog.
 function decor(c,item,x,y){
  const color=item.color||'#67d1cc',s=item.sprite||item.sprite_id||'table';
  const dims={sofa:[2,1],bed:[1,2],rug:[2,2],divider:[2,1]},[w,l]=dims[s]||[item.width||1,item.length||1];
  c.save();c.translate(Math.round(x),Math.round(y));
  if(item.rotation===2||item.rotation===6)c.scale(-1,1);
  const point=(u,v,z=0)=>[(u-v)*18,(u+v)*9-z];
  const cube=(u,v,a,b,h,z,tint)=>{const [px,py]=point(u,v,z);box(c,px,py,a,b,h,tint);};
  const line=(points,tint,width=1)=>{c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.strokeStyle=tint;c.lineWidth=width;c.stroke();};
  const tile=(u,v,a,b,z,tint,edge)=>poly(c,[point(u,v,z),point(u+a,v,z),point(u+a,v+b,z),point(u,v+b,z)],tint,edge);
  const panel=(u,v,a,z,h,fill,edge)=>poly(c,[point(u,v,z+h),point(u+a,v,z+h),point(u+a,v,z),point(u,v,z)],fill,edge);
  tile(.04,.05,w,.98*l,0,'#14273735');
  const legs=(a,b)=>{for(const [u,v] of [[.12,.12],[a-.23,.12],[.12,b-.23],[a-.23,b-.23]])cube(u,v,.12,.12,6,0,'#334455');};
  if(s==='counter'||s==='bar'){
   cube(0,0,w,l,25,0,shade(color,-22));cube(-.05,-.05,w+.1,l+.1,4,25,color);
   for(let u=.12;u<w-.4;u+=.75){panel(u,l+.01,.6,3,16,shade(color,-33),'#e5bd81');panel(u+.08,l+.02,.44,5,12,shade(color,-14));}
   line([point(.1,l,21),point(w-.1,l,21)],'#f6d6a0',2);
   tile(.12,.08,w-.24,l-.16,29,'#e5d1aa');
   if(s==='counter'){const [sx,sy]=point(w-.8,.5,31);c.fillStyle='#fff1bf';c.fillRect(sx-3,sy-5,7,5);c.fillStyle='#ac8146';c.fillRect(sx-1,sy-7,3,2);}
   if(s==='bar'){for(let u=.3;u<w;u+=.7){cube(u,.25,.15,.15,7,29,'#9ee0cc');cube(u+.22,.55,.14,.14,4,29,'#f6d69c');}}
   else{cube(.4,.25,.4,.3,8,29,'#344f63');cube(w-.6,.5,.18,.18,3,29,'#f6d69c');}
  }else if(s==='umbrella'){
   legs(1,1);cube(0,0,1,1,4,13,'#c3a77d');line([point(.5,.5,0),point(.5,.5,57)],'#75634f',2);
   const [ux,uy]=point(.5,.5,57);poly(c,[[ux,uy-7],[ux+27,uy+12],[ux,uy+19],[ux-27,uy+5]],color,'#786e58');line([[ux,uy-7],[ux,uy+19]],shade(color,35));
  }else if(s==='rug'){
   tile(0,0,2,2,1,shade(color,-38),'#254a55');tile(.13,.13,1.74,1.74,1,color,'#c4f4e1');
   tile(.28,.28,1.44,1.44,1,shade(color,-13));tile(.72,.72,.56,.56,1,shade(color,40));
   for(let i=.22;i<1.9;i+=.22){line([point(i,0,1),point(i,-.1,1)],'#d7ead5');line([point(i,2,1),point(i,2.1,1)],'#d7ead5');}
  }else if(s==='sofa'){
   legs(2,1);cube(0,0,2,1,7,5,shade(color,-32));
   cube(.02,0,1.96,.18,23,10,shade(color,-12));
   for(let u=.2;u<1.8;u+=.81){cube(u,.2,.77,.68,5,12,color);cube(u,.06,.77,.14,13,16,shade(color,8));
    line([point(u+.04,.84,17),point(u+.72,.84,17)],shade(color,48));}
   cube(0,.15,.18,.85,12,10,color);cube(1.82,.15,.18,.85,12,10,color);
   for(const u of [.38,.69,1.19,1.5]){const [bx,by]=point(u,.205,25);c.fillStyle=shade(color,-42);c.fillRect(bx,by,2,2);line([[bx-2,by-2],[bx,by],[bx+2,by-2]],shade(color,28));}
   for(const u of [.05,1.86]){cube(u,.18,.09,.7,3,22,shade(color,30));}
   panel(.19,1.01,1.62,6,2,'#b68a52');
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
  }else if(s==='palm'||s==='tree'||s==='flowers'){
   cube(.23,.23,.54,.54,10,1,'#b78469');cube(.18,.18,.64,.64,3,11,'#e1b494');tile(.23,.23,.54,.54,15,'#413c35');
   line([[-5,0],[-5,-5]],'#f3cead',2);
   if(s==='palm'){
    line([[0,-5],[2,-25],[0,-42]],'#8b7251',4);line([[-1,-7],[1,-26],[-1,-40]],'#d0b481');
    for(const [dx,dy] of [[-22,-36],[-16,-52],[0,-57],[18,-51],[23,-34],[-9,-31]]){
     poly(c,[[0,-40],[dx*.6,dy-5],[dx,dy],[dx*.6,dy+5]],color,'#356a50');line([[0,-40],[dx*.6,dy],[dx,dy]],'#b1db8d');
    }
   }else if(s==='tree'){
    line([[0,-4],[0,-36]],'#88694d',4);line([[0,-20],[-9,-34]],'#88694d',2);
    for(const [dx,dy,r,k] of [[-10,-34,10,-22],[10,-36,10,-13],[0,-47,12,0],[-6,-43,9,14],[8,-46,8,22]]){
     c.fillStyle=shade(color,k);c.beginPath();c.arc(dx,dy,r,0,Math.PI*2);c.fill();
     c.fillStyle=shade(color,k+30);c.fillRect(dx-3,dy-r+4,4,2);
    }
   }else{
    for(const [dx,dy,tint] of [[-8,-24,color],[7,-29,'#ffe4a1'],[0,-37,color]]){
     line([[0,-5],[dx,dy]],'#528960',2);poly(c,[[dx,dy+12],[dx-7,dy+6],[dx-8,dy+12]],'#78b883');
     for(let i=0;i<5;i++){const a=i*Math.PI*2/5;c.fillStyle=tint;c.beginPath();c.arc(dx+Math.cos(a)*4,dy+Math.sin(a)*4,3,0,7);c.fill();}
     c.fillStyle='#ffe6a4';c.fillRect(dx-2,dy-2,4,4);
    }
   }
  }else if(s==='bookshelf'){
   cube(.05,.05,.9,.75,42,1,shade(color,-25));
   for(const z of [4,18,32]){
    for(let i=0;i<4;i++)cube(.12+i*.18,.6,.13,.2,10,z,['#7eb8b3','#e5bd7a','#b096c5','#d28d90'][i]);
    cube(.02,.57,.96,.32,2,z-1,color);
   }
   cube(0,0,1,.9,3,43,color);cube(-.04,-.04,1.08,.98,2,46,shade(color,20));
   for(const u of [.04,.87]){cube(u,.73,.09,.13,39,3,shade(color,20));const [bx,by]=point(u+.04,.88,42);c.fillStyle='#e8c387';c.fillRect(bx-1,by-1,3,3);}
   panel(.14,.9,.7,2,2,'#e5ba7a');
  }else if(s==='aquarium'){
   cube(.05,.05,.9,.9,12,0,'#3e5667');cube(0,0,1,1,24,12,'#4da3b4');
   tile(.08,.08,.84,.84,37,'#a0e3e4','#d0fbf1');
   poly(c,[point(.05,1,34),point(.95,1,34),point(.95,1,15),point(.05,1,15)],'#71d4d5');
   for(const [u,z,tint] of [[.28,26,'#ffcf7e'],[.68,22,'#ed9caf']]){
    const [fx,fy]=point(u,1.01,z);poly(c,[[fx-4,fy],[fx,fy-2],[fx+4,fy+2],[fx,fy+3]],tint);poly(c,[[fx+3,fy+1],[fx+6,fy-2],[fx+6,fy+5]],tint);
   }
   line([point(.13,1,17),point(.17,1,25),point(.12,1,29)],'#398b72',2);
   line([point(.1,1,33),point(.1,1,29)],'#e4ffff',2);cube(0,0,1,1,2,37,'#344b5c');
  }else if(s==='clock'){
   cube(.15,.1,.7,.7,4,0,shade(color,-30));cube(.22,.18,.56,.5,45,4,color);
   panel(.3,.69,.4,10,22,'#3c3e42','#dfb56e');line([point(.5,.7,31),point(.5,.7,16)],'#ecc77a',2);
   const [px,py]=point(.5,.72,15);c.fillStyle='#d8ad58';c.beginPath();c.ellipse(px,py,3,4,.2,0,7);c.fill();
   cube(.12,.08,.76,.72,3,49,shade(color,20));cube(.2,.16,.6,.56,3,52,color);
   const [fx,fy]=point(.5,.7,42);c.save();c.translate(fx,fy);c.transform(1,.5,0,1,0,0);c.fillStyle='#fff0bd';c.beginPath();c.arc(0,0,6,0,7);c.fill();c.strokeStyle='#b88c4d';c.stroke();
   for(let i=0;i<12;i++){const a=i*Math.PI/6;c.fillStyle='#6c5142';c.fillRect(Math.sin(a)*4.5-.5,-Math.cos(a)*4.5-.5,1,1);}line([[0,-4],[0,0],[3,1]],'#584437');c.restore();
  }else if(s==='television'){
   legs(1,1);cube(.04,.08,.92,.85,15,5,color);panel(.14,.94,.7,8,9,shade(color,-25),'#e3b879');
   for(const u of [.3,.66]){const [px,py]=point(u,.95,13);c.fillStyle='#e8c782';c.fillRect(px,py,2,2);}
   cube(.04,.13,.92,.65,21,21,shade(color,-14));panel(.12,.79,.61,25,13,'#172f44','#dbc09a');panel(.17,.8,.51,27,9,'#628e8c');
   panel(.19,.81,.16,28,6,'#cbe3bd');panel(.4,.81,.25,28,4,'#b3bca2');
   for(const z of [29,36]){const [px,py]=point(.84,.8,z);c.fillStyle='#d9be84';c.fillRect(px-1,py-1,3,3);}
   line([point(.5,.4,43),point(.22,.2,52)],'#9aabb0');line([point(.5,.4,43),point(.81,.4,53)],'#9aabb0');
  }else if(s==='fountain'){
   cube(.06,.06,.88,.88,6,0,shade(color,-25));cube(0,0,1,1,4,6,color);tile(.12,.12,.76,.76,10,'#56b7c5','#e2eee0');
   cube(.4,.4,.2,.2,20,9,shade(color,15));cube(.25,.25,.5,.5,3,27,color);tile(.3,.3,.4,.4,30,'#a9e8e6');
   for(const [u,v] of [[.27,.5],[.73,.5],[.5,.27],[.5,.73]]){line([point(.5,.5,34),point(u,v,28),point(u,v,12)],'#b7f7f0');const [px,py]=point(u,v,11);line([[px-2,py],[px+2,py]],'#e3ffed');}
   const [fx,fy]=point(.5,.5,35);c.fillStyle='#c8fff4';c.fillRect(fx-1,fy-2,2,4);
  }else if(s==='divider'){
   for(let u=0;u<2;u+=.66){cube(u,.33,.62,.16,36,5,color);panel(u+.07,.5,.48,10,27,'#7b9d86','#ebcf94');
    for(let z=13;z<36;z+=6)line([point(u+.1,.51,z),point(u+.51,.51,z)],'#a9c1a3');
    cube(u,.25,.09,.32,6,0,shade(color,-25));cube(u+.53,.25,.09,.32,6,0,shade(color,-25));}
  }else if(s==='column'){
   cube(.08,.08,.84,.84,5,0,shade(color,-20));cube(.2,.2,.6,.6,4,5,color);cube(.29,.29,.42,.42,43,9,color);
   for(const u of [.33,.46,.59])line([point(u,.72,49),point(u,.72,12)],shade(color,-30));
   cube(.2,.2,.6,.6,4,52,shade(color,12));cube(.08,.08,.84,.84,4,56,color);
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
  if(user.state==='lay'){c.translate(-12,-10);c.rotate(Math.PI/2);}if(user.state==='wlk'&&!reducedMotion.matches)c.translate(0,Math.sin(performance.now()/75)>0?-1:0);
  const key=JSON.stringify(parts.map(p=>p.imageUrl));let sprite=sprites.get(key);
  if(!sprite){const loaded=parts.map(p=>image(p.imageUrl));if(loaded.length&&loaded.every(i=>i?.complete&&i.naturalWidth)){sprite=document.createElement('canvas');sprite.width=48;sprite.height=64;const sc=sprite.getContext('2d');for(const img of loaded)sc.drawImage(img,0,0,48,64);sprites.set(key,sprite);}}
  if(user.isStaff){
   const host=user.staffId==='staff-host'||user.role==='Patio host',bar=user.staffId==='staff-bartender'||user.role==='Bartender';
   const suit=user.color||'#427c88',skin=host?'#b67d59':bar?'#dbab83':'#efc79d',hair=host?'#553b30':bar?'#392e42':'#6c4736';
   // Rounded face, shaded uniform and distinct job accessories remain readable at room scale.
   c.fillStyle='#253748';c.fillRect(-7,-9,5,9);c.fillRect(3,-9,5,9);c.fillStyle='#182b3b';c.fillRect(-8,-2,7,3);c.fillRect(2,-2,8,3);
   poly(c,[[-8,-25],[8,-25],[10,-10],[-9,-10]],suit,'#263c4a');
   c.fillStyle=shade(suit,22);c.fillRect(-8,-23,3,12);c.fillStyle=shade(suit,-23);c.fillRect(7,-22,3,13);
   c.fillStyle=skin;c.fillRect(-11,-14,4,5);c.fillRect(8,-14,4,5);
   c.fillStyle=bar?'#eee5d1':'#e8f2e5';c.fillRect(-3,-25,6,13);
   if(host){c.fillStyle='#e2c492';c.fillRect(-6,-18,12,8);c.fillStyle='#a98a60';c.fillRect(-2,-15,5,4);}
   else if(bar){poly(c,[[-5,-24],[0,-22],[-5,-20]],'#6a405b');poly(c,[[5,-24],[0,-22],[5,-20]],'#6a405b');}
   else{poly(c,[[0,-24],[2,-21],[1,-14],[-1,-14],[-2,-21]],'#e4b964');}
   c.fillStyle='#ffe7a4';c.fillRect(5,-21,3,2);
   c.fillStyle=shade(skin,-24);c.fillRect(-3,-28,6,4);
   c.fillStyle=skin;c.beginPath();c.ellipse(0,-35,10,12,0,0,7);c.fill();
   c.fillStyle=shade(skin,18);c.fillRect(-7,-39,3,8);
   poly(c,[[-10,-37],[-10,-43],[-5,-48],[4,-48],[10,-43],[9,-37],[5,-42],[-3,-42],[-7,-39]],hair);
   c.fillStyle='#fff5de';c.fillRect(-5,-37,4,4);c.fillRect(3,-37,4,4);c.fillStyle='#263c48';c.fillRect(-3,-36,2,3);c.fillRect(5,-36,2,3);
   c.fillStyle=shade(skin,-32);c.fillRect(0,-32,2,2);c.fillStyle='#8c534c';c.fillRect(-2,-28,5,1);c.fillStyle='#e8ad96';c.fillRect(-7,-31,3,2);
   if(host){c.fillStyle='#dfc690';c.fillRect(-11,-44,23,3);c.fillRect(-6,-50,13,6);c.fillStyle='#7d9b70';c.fillRect(-6,-45,13,2);}
   drew=true;
  }
  if(sprite&&!user.isStaff){
   // Keep every equipped cosmetic, with a larger raster and natural 3:4 proportions.
   if(user.state==='sit'){c.drawImage(sprite,0,0,48,48,-18,-42,36,34);c.drawImage(sprite,0,48,48,16,-13,-8,36,10);}
   else if(user.state==='wlk'&&!reducedMotion.matches){const step=Math.sin(performance.now()/100)*2;c.drawImage(sprite,0,0,48,48,-18,-48,36,36);c.drawImage(sprite,0,48,24,16,-18,-12+step,18,12);c.drawImage(sprite,24,48,24,16,0,-12-step,18,12);}
   else c.drawImage(sprite,-18,-48,36,48);drew=true;
  }
  if(!drew){c.fillStyle='#173f58';c.fillRect(-8,-20,16,17);c.fillStyle='#7ef0d6';c.fillRect(-8,-19,16,2);c.fillStyle='#ad855d';c.fillRect(-10,-37,20,19);c.fillStyle='#ecc898';c.fillRect(-8,-40,16,20);c.fillStyle='#fff3cf';c.fillRect(-5,-34,4,6);c.fillRect(3,-34,4,6);c.fillStyle='#1e495b';c.fillRect(-4,-32,2,4);c.fillRect(4,-32,2,4);c.fillStyle='#645448';c.fillRect(-2,-25,5,2);c.fillStyle='#73c292';c.fillRect(0,-44,3,5);c.fillStyle='#263447';c.fillRect(-8,-4,6,5);c.fillRect(3,-4,6,5);}
 c.restore();}
 class WorldRenderer{
  constructor(canvas,onTap){this.canvas=canvas;this.c=canvas.getContext('2d');this.onTap=onTap;this.scene=null;this.users=new Map();this.staff=new Map();this.offset={x:0,y:0};this.zoom=1;this.viewMode='close';this.localUserId=null;this.hit=[];this.selected=null;this.bubbles=new Map();
    new ResizeObserver(()=>this.resize()).observe(canvas);this.resize();
    const point=e=>{const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left-this.cx)/this.scale,y=(e.clientY-r.top-this.cy)/this.scale;const tile=this.floorAt(x,y);return {x,y,tx:tile?.x??Math.floor((x/18+y/9)/2),ty:tile?.y??Math.floor((y/9-x/18)/2)};};
    const resetTap=()=>{clearTimeout(this.tapTimer);this.lastTap=null;};
    canvas.addEventListener('pointerdown',e=>{
     if(this.drag||e.isPrimary===false||e.button!==0)return;
     canvas.setPointerCapture(e.pointerId);const p=point(e);
     this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,tx:p.tx,ty:p.ty,ox:this.offset.x,oy:this.offset.y,px:this.placement?.x,py:this.placement?.y,moved:false};
    });
    canvas.addEventListener('pointermove',e=>{
     const d=this.drag;if(!d||d.id!==e.pointerId)return;
     const dx=e.clientX-d.x,dy=e.clientY-d.y;
     if(Math.hypot(dx,dy)>8){d.moved=true;resetTap();}
     if(!d.moved)return;
     if(this.placement){if(!this.placement.saving){const p=point(e);this.placement.x=d.px+p.tx-d.tx;this.placement.y=d.py+p.ty-d.ty;}}
     else this.offset={x:d.ox+dx,y:d.oy+dy};
    });
    canvas.addEventListener('pointerup',e=>{
     const d=this.drag;if(!d||d.id!==e.pointerId)return;this.drag=null;
     if(d.moved)return;
     const p=point(e),now=performance.now(),last=this.lastTap;
     const twice=last&&now-last.at<360&&Math.hypot(e.clientX-last.x,e.clientY-last.y)<28;
     if(this.placement){
      if(this.placement.saving)return;
      if(twice){resetTap();this.onPlacementDrop?.();}else this.lastTap={at:now,x:e.clientX,y:e.clientY};
      return;
     }
     const item=this.pickItem(p.x,p.y);
     if(item&&this.canEditItem?.(item)){
      if(twice&&last.itemId===item.id){resetTap();this.onTap({x:p.tx,y:p.ty,item,doubleTap:true});}
      else{resetTap();this.lastTap={at:now,x:e.clientX,y:e.clientY,itemId:item.id};this.tapTimer=setTimeout(()=>{this.lastTap=null;this.onTap({x:p.tx,y:p.ty,item});},360);}
      return;
     }
     resetTap();const person=[...this.hit].reverse().find(h=>Math.abs(p.x-h.x)<19&&p.y>h.y-50&&p.y<h.y+4);
     if(person)this.onTap(person.user.isStaff?{staff:person.user}:{user:person.user});
     else{this.selected={x:p.tx,y:p.ty};this.onTap({x:p.tx,y:p.ty,item});}
    });
    const cancelPointer=()=>{this.drag=null;resetTap();};
    canvas.addEventListener('pointercancel',cancelPointer);canvas.addEventListener('lostpointercapture',()=>{if(this.drag)cancelPointer();});
    this.running=true;const loop=()=>{if(!this.running)return;this.draw();requestAnimationFrame(loop);};requestAnimationFrame(loop);
  }
  floorAt(px,py){
   const rows=this.scene?.heightmap.split('\n')||[];
   // Reverse painter order resolves raised floor diamonds before tiles behind them.
   for(let y=rows.length-1;y>=0;y--)for(let x=rows[y].length-1;x>=0;x--){
    if(!/[0-9]/.test(rows[y][x]))continue;
    const cx=(x-y)*18,cy=(x+y)*9-Number(rows[y][x])*12+9;
    if(Math.abs(px-cx)/18+Math.abs(py-cy)/9<=1)return {x,y};
   }
   return null;
  }
  pickItem(x,y){
    // Hit-test the original sprite pixels, including tall decor above its floor tile.
    const canvas=this.pickCanvas||(this.pickCanvas=document.createElement('canvas'));canvas.width=canvas.height=1;
    const c=canvas.getContext('2d',{willReadFrequently:true});
    const items=[...(this.scene?.items||[])].sort((a,b)=>(a.x+a.y+(a.width+a.length)/2)-(b.x+b.y+(b.width+b.length)/2));
    for(const item of items.reverse()){c.clearRect(0,0,1,1);decor(c,item,(item.x-item.y)*18-x,(item.x+item.y)*9-item.z*12-y);if(c.getImageData(0,0,1,1).data[3]>0)return item;}
    return null;
  }
  resize(){const r=this.canvas.getBoundingClientRect();this.width=Math.round(r.width);this.height=Math.round(r.height);this.dpr=Math.min(2,window.devicePixelRatio||1);this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);this.c.imageSmoothingEnabled=false;}
  setView(mode){this.viewMode=mode;this.zoom=1;this.offset={x:0,y:0};}
  focusMe(){this.setView('close');}
  setZoom(amount){this.zoom=Math.max(.6,Math.min(2.2,amount));}

  setScene(scene){if(!this.scene||this.scene.roomId!==scene.roomId){this.placement=null;this.drag=null;clearTimeout(this.tapTimer);this.lastTap=null;this.setView('close');this.bubbles.clear();}this.scene=scene;}
  clearPlacement(){this.placement=null;this.drag=null;this.lastTap=null;clearTimeout(this.tapTimer);}
  placementResult(){const p=this.placement;return p?EarnlyWorldPlacement.placementCheck(this.scene,p.item,{x:p.x,y:p.y,rotation:p.rotation},[...this.users.values()]):null;}
  setStaff(staff){const old=this.staff;this.staff=new Map(staff.map(s=>[s.staffId,{...s,old:old.get(s.staffId)?.position||s.position,at:performance.now()}]));}
  setUsers(users){this.users.clear();users.forEach(u=>this.updateUser(u));}
  updateUser(u){const previous=this.users.get(u.userId);this.users.set(u.userId,{...previous,...u,old:previous?.position||u.position,at:performance.now(),facing:previous&&u.position.x-u.position.y!==previous.position.x-previous.position.y?(u.position.x-u.position.y<previous.position.x-previous.position.y?'left':'right'):(previous?.facing||'right')});}
  bubble(packet){this.bubbles.set(packet.userId,{text:packet.text,until:performance.now()+6000,mode:packet.mode});}
  draw(){const c=this.c,w=this.width||this.canvas.width,h=this.height||this.canvas.height;c.setTransform(this.dpr||1,0,0,this.dpr||1,0,0);c.clearRect(0,0,w,h);if(!this.scene)return;const floor=this.scene.heightmap.split('\n'),n=floor[0].length,m=floor.length;
    const fit=Math.min(w/((n+m)*18+70),h/((n+m)*9+150));
    this.scale=(this.viewMode==='close'?Math.max(fit,Math.min(1.65,w/290)):fit)*this.zoom;
    this.cx=w/2+(m-n)*9*this.scale+this.offset.x;this.cy=(h-(n+m)*9*this.scale)/2+44*this.scale+this.offset.y;
    const me=this.users.get(this.localUserId);
    if(this.viewMode==='close'&&me){const t=Math.min(1,(performance.now()-me.at)/220),px=me.old.x+(me.position.x-me.old.x)*t,py=me.old.y+(me.position.y-me.old.y)*t,z=me.old.z+(me.position.z-me.old.z)*t;
     this.cx=w/2-(px-py)*18*this.scale+this.offset.x;this.cy=h*.55-((px+py)*9+9-z*12-20)*this.scale+this.offset.y;
    }
    c.save();c.translate(this.cx,this.cy);c.scale(this.scale,this.scale);c.imageSmoothingEnabled=false;
    const theme=this.scene.theme,outside=theme==='rooftop'||theme==='patio';
    // Ground the floating room with a soft, inexpensive ambient shadow.
    c.save();c.translate((n-m)*9,(n+m)*4.5+12);c.scale(1,.42);const ambient=c.createRadialGradient(0,0,15,0,0,(n+m)*10);ambient.addColorStop(0,'#030b20aa');ambient.addColorStop(1,'#030b2000');c.fillStyle=ambient;c.fillRect(-(n+m)*11,-(n+m)*11,(n+m)*22,(n+m)*22);c.restore();
    if(outside){
     c.fillStyle=theme==='rooftop'?'#19243c':'#405e58';c.fillRect(-m*18-10,-100,(n+m)*18+20,100);
     if(theme==='rooftop')for(let i=0;i<12;i++){const x=-m*18+i*36,height=24+(i*17)%55;c.fillStyle=i%2?'#293b57':'#324867';c.fillRect(x,-height,28,height);c.fillStyle='#d1b77d';for(let y=-height+7;y<-9;y+=12)c.fillRect(x+6,y,4,4);}
    }
    // Original mint/slate walls, window panels and neon lighting.
    if(!outside){
    const wallHeight=58+Math.max(...floor.flatMap(row=>[...row].filter(v=>/[0-9]/.test(v)).map(Number)))*12;
    const leftWall=c.createLinearGradient(0,-58,-m*18,m*9);leftWall.addColorStop(0,theme==='lobby'?'#c8ae7b':'#527b89');leftWall.addColorStop(1,theme==='lobby'?'#86654b':'#294c64');
    const rightWall=c.createLinearGradient(0,-58,n*18,n*9);rightWall.addColorStop(0,theme==='lobby'?'#f0d5a0':'#8da3b9');rightWall.addColorStop(1,theme==='lobby'?'#bb946c':'#586b8b');
    poly(c,[[0,0],[-m*18,m*9],[-m*18,m*9-wallHeight],[0,-wallHeight]],leftWall,'#203c53');poly(c,[[0,0],[n*18,n*9],[n*18,n*9-wallHeight],[0,-wallHeight]],rightWall,'#304359');
    // Recessed wall panels and skirting add depth without covering the floor.
    for(let i=1;i<m-1;i+=2){const x=-i*18,y=i*9;poly(c,[[x,y-46],[x-27,y-32.5],[x-27,y+6],[x,y-7.5]],'#16394d18','#8dcac21c');}
    poly(c,[[0,-5],[-m*18,m*9-5],[-m*18,m*9],[0,0]],'#2b4558');poly(c,[[0,-5],[n*18,n*9-5],[n*18,n*9],[0,0]],'#40526d');
    for(let i=1;i<n-1;i+=3){const x=i*18,y=i*9-Number(floor[0][i]||0)*12;poly(c,[[x,y-43],[x+30,y-28],[x+30,y-10],[x,y-25]],'#234864','#cee5dc');poly(c,[[x+3,y-40],[x+27,y-28],[x+27,y-24],[x+3,y-36]],'#71e6d4');poly(c,[[x+4,y-33],[x+26,y-22],[x+26,y-14],[x+4,y-25]],'#102d4e');poly(c,[[x+14,y-35],[x+15,y-34.5],[x+15,y-19],[x+14,y-19.5]],'#b4d6de');}
    if(theme==='lobby'){
     for(const side of [-1,1])for(let i=1;i<(side===1?n:m)-2;i+=3){
      const wx=i*18*side,wy=i*9;
      poly(c,[[wx,wy-21],[wx+side*36,wy-3],[wx+side*36,wy+12],[wx,wy-6]],'#77503c','#e0b982');
      poly(c,[[wx+side*4,wy-16],[wx+side*32,wy-2],[wx+side*32,wy+7],[wx+side*4,wy-7]],'#a27851','#c59a64');
      if(side===1){for(const u of [0,27])poly(c,[[wx+u,wy-46+u/2],[wx+u+5,wy-43.5+u/2],[wx+u+5,wy-16+u/2],[wx+u,wy-21+u/2]],'#914c51','#d4a36d');}
     }
    }
    poly(c,[[0,-wallHeight+3],[-m*18,m*9-wallHeight+3],[-m*18,m*9-wallHeight+6],[0,-wallHeight+6]],theme==='lobby'?'#ecd19c':'#86f4d6');poly(c,[[0,-wallHeight+3],[n*18,n*9-wallHeight+3],[n*18,n*9-wallHeight+6],[0,-wallHeight+6]],theme==='lobby'?'#ffe2a7':'#c1adf2');
    }else{
     poly(c,[[0,0],[-m*18,m*9],[-m*18,m*9-16],[0,-16]],theme==='patio'?'#967e5d':'#65768f','#253b4c');
     poly(c,[[0,0],[n*18,n*9],[n*18,n*9-16],[0,-16]],theme==='patio'?'#b29a72':'#8391a7','#253b4c');
     for(let i=0;i<=n;i++){const x=i*18,y=i*9;c.fillStyle='#fae5a6';c.fillRect(x-2,y-24,4,5);c.fillRect(-x-2,y-24,4,5);}
    }
    const occupied=(x,y)=>x>=0&&y>=0&&x<n&&y<m&&!/[xX]/.test(floor[y][x]);
    for(let y=0;y<m;y++)for(let x=0;x<n;x++){
     if(!occupied(x,y))continue;
     const z=Number(floor[y][x]),px=(x-y)*18,py=(x+y)*9-z*12;
     const tint=theme==='patio'?((x+y)%2?'#adbb94':'#a2b28a'):theme==='rooftop'?((x+y)%2?'#929eb8':'#8490aa'):theme==='lobby'?((x+y)%2?'#dfceb2':'#d1bea0'):((x+y)%2?'#bdccca':'#afc2c1');
     poly(c,[[px,py],[px+18,py+9],[px,py+18],[px-18,py+9]],tint,'#7e989f');
     poly(c,[[px,py+1],[px+16,py+9],[px,py+17],[px-16,py+9]],'#ffffff06','#e9f8ec28');
     if(theme==='lobby'){
      const lounge=(x>=1&&x<=10&&y>=5&&y<=9)||(x>=15&&x<=20&&y>=12&&y<=17)||(x>=13&&x<=19&&y>=18&&y<=22);
      if(lounge){poly(c,[[px,py],[px+18,py+9],[px,py+18],[px-18,py+9]],'#985354','#b87b67');poly(c,[[px,py+5],[px+8,py+9],[px,py+13],[px-8,py+9]],'#c5926d');}
      else if((x+y)%4===0)poly(c,[[px,py+6],[px+6,py+9],[px,py+12],[px-6,py+9]],'#bda078');
     }else if(outside){
      // Fine decking with staggered joints, garden paths and a slate bar apron.
      const deck=theme==='rooftop'||(x>1&&x<11&&y>1&&y<11);
      if(deck){poly(c,[[px,py],[px+18,py+9],[px,py+18],[px-18,py+9]],theme==='patio'?'#b59c73':'#9a87a4','#665e71');
       for(const q of [.25,.5,.75]){c.beginPath();c.moveTo(px+q*18,py+q*9);c.lineTo(px+(q-1)*18,py+(q+1)*9);c.strokeStyle=theme==='patio'?'#d3ba8d':'#b8a5bc';c.lineWidth=.6;c.stroke();}}
      else if((x*7+y*11)%5===0){c.fillStyle='#d2d9aa';c.fillRect(px-1,py+8,2,2);}
     }
     if(x===0||y===0)poly(c,[[px,py],[px+18,py+9],[px,py+18],[px-18,py+9]],'#18344e18');
     // Visible risers make real walkable height transitions read as broad stairs.
     const south=occupied(x,y+1)?Math.max(0,z-Number(floor[y+1][x]))*12:8+z*12;
     const east=occupied(x+1,y)?Math.max(0,z-Number(floor[y][x+1]))*12:8+z*12;
     if(south)poly(c,[[px-18,py+9],[px,py+18],[px,py+18+south],[px-18,py+9+south]],'#436478','#203e54');
     if(east)poly(c,[[px,py+18],[px+18,py+9],[px+18,py+9+east],[px,py+18+east]],'#597c91','#29495e');
     if(south&&occupied(x,y+1))poly(c,[[px-18,py+8],[px,py+17],[px,py+19],[px-18,py+10]],'#d3e8db');
    }

    if(this.selected){const {x,y}=this.selected;if(occupied(x,y)){const px=(x-y)*18,py=(x+y)*9-Number(floor[y][x])*12;poly(c,[[px,py],[px+18,py+9],[px,py+18],[px-18,py+9]],'#7cf2ce88','#b9fff0');}}
    const preview=this.placement;
    if(preview){
     const check=this.placementResult();preview.valid=check.valid;preview.z=check.z;preview.reason=check.reason;
     const turned=preview.rotation===2||preview.rotation===6,pw=turned?preview.item.length:preview.item.width,pl=turned?preview.item.width:preview.item.length;
     const tint=check.valid?'#54f09a88':'#ff526f99',edge=check.valid?'#a6ffd0':'#ffb3bf';
     for(let y=preview.y;y<preview.y+pl;y++)for(let x=preview.x;x<preview.x+pw;x++){const px=(x-y)*18,py=(x+y)*9-check.z*12;poly(c,[[px,py],[px+18,py+9],[px,py+18],[px-18,py+9]],tint,edge);}
    }
    const nodes=(this.scene.items||[]).filter(i=>i.id!==preview?.item.id).map(item=>({depth:item.x+item.y+(item.width+item.length)/2-.3,item}));for(const u of [...this.users.values(),...this.staff.values()]){let depth=u.position.x+u.position.y+1;if(u.state==='sit'||u.state==='lay'){const seat=nodes.find(n=>{const i=n.item;if(!i)return false;const turned=i.rotation===2||i.rotation===6;return u.position.x>=i.x&&u.position.y>=i.y&&u.position.x<i.x+(turned?i.length:i.width)&&u.position.y<i.y+(turned?i.width:i.length);});if(seat)depth=Math.max(depth,seat.depth+.1);}nodes.push({depth,user:u});}nodes.sort((a,b)=>a.depth-b.depth);this.hit=[];
    for(const node of nodes){if(node.item){const i=node.item;decor(c,i,(i.x-i.y)*18,(i.x+i.y)*9-i.z*12);}else{const u=node.user,t=Math.min(1,(performance.now()-u.at)/220),px=u.old.x+(u.position.x-u.old.x)*t,py=u.old.y+(u.position.y-u.old.y)*t;const x=(px-py)*18,y=(px+py)*9+9-(u.old.z+(u.position.z-u.old.z)*t)*12;if(u.userId===this.localUserId){c.strokeStyle='#93ffe1';c.lineWidth=1.5;c.beginPath();c.ellipse(x,y,13,5,0,0,Math.PI*2);c.stroke();}avatar(c,u,x,y);this.hit.push({x,y,user:u});}}
    if(preview){c.save();c.globalAlpha=.65;decor(c,{...preview.item,x:preview.x,y:preview.y,z:preview.z,rotation:preview.rotation},(preview.x-preview.y)*18,(preview.x+preview.y)*9-preview.z*12-5);c.restore();}
    c.restore();
    // Labels and speech use screen pixels, so they remain readable at every zoom.
    const bubbles=[];
    for(const hit of this.hit){const x=this.cx+hit.x*this.scale,y=this.cy+hit.y*this.scale;
     if(x<-40||x>w+40||y<-10||y>h+65)continue;
     const name=(hit.user.username||'You').slice(0,18)+(hit.user.isStaff?' · NPC':'');c.font='600 11px system-ui';c.textAlign='center';const labelWidth=c.measureText(name).width+12;
     c.fillStyle='#122c3ee6';c.fillRect(x-labelWidth/2,y+5,labelWidth,17);c.fillStyle=hit.user.isStaff?'#ffe0a0':hit.user.userId===this.localUserId?'#9bffe3':'#f2fff8';c.fillText(name,x,y+17);
     const bubble=this.bubbles.get(hit.user.userId);if(!bubble||bubble.until<=performance.now())continue;
     c.font=(bubble.mode==='shout'?'bold ':'')+'12px system-ui';const limit=Math.min(226,w-48),lines=[];let line='';
     for(const word of bubble.text.split(/\s+/)){if(line&&c.measureText(line+' '+word).width>limit){lines.push(line);line='';}if(line)line+=' ';for(const char of word){if(c.measureText(line+char).width>limit){lines.push(line);line='';}line+=char;}}if(line)lines.push(line);
     if(lines.length>3){lines.length=3;lines[2]=lines[2].slice(0,-2)+'…';}
     const bw=Math.max(40,...lines.map(t=>c.measureText(t).width+16)),bh=lines.length*16+12,bx=Math.max(8,Math.min(w-bw-8,x-bw/2));let by=Math.max(62,y-52*this.scale-bh-8);
     for(const prior of bubbles){if(bx<prior.x+prior.w+4&&bx+bw>prior.x-4&&by<prior.y+prior.h+4&&by+bh>prior.y-4)by=Math.max(62,prior.y-bh-5);}
     bubbles.push({x:bx,y:by,w:bw,h:bh});c.fillStyle='#f8f0d9';c.fillRect(bx,by,bw,bh);c.strokeStyle='#364c55';c.lineWidth=1;c.strokeRect(bx+.5,by+.5,bw-1,bh-1);const tail=Math.max(bx+6,Math.min(bx+bw-12,x));poly(c,[[tail,by+bh],[tail+8,by+bh],[tail+3,by+bh+6]],'#f8f0d9');c.fillStyle='#203745';c.textAlign='left';lines.forEach((text,i)=>c.fillText(text,bx+8,by+19+i*16));
    }

  }
 }
 function thumbnail(canvas,item){canvas.width=160;canvas.height=128;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.translate(80,(item.sprite||item.sprite_id)==='rug'?60:['palm','tree','flowers','plant','bookshelf','aquarium','clock','television','column','divider','fountain'].includes(item.sprite||item.sprite_id)?88:76);c.scale(1.5,1.5);decor(c,item,0,0);}
 function roomThumbnail(canvas,heightmap){
  canvas.width=300;canvas.height=210;
  const preview=Object.create(WorldRenderer.prototype);
  Object.assign(preview,{canvas,c:canvas.getContext('2d'),scene:{heightmap,items:[]},users:new Map(),staff:new Map(),bubbles:new Map(),offset:{x:0,y:0},zoom:1,hit:[]});preview.draw();
 }
 window.EarnlyWorldRenderer={WorldRenderer,thumbnail,roomThumbnail};
})();
