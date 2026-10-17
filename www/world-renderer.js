/* Original Earnly isometric canvas art. No external sprite packs. */
(()=>{
 const images=new Map(),sprites=new Map(),reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
 function image(src){if(!/^cosmetic-[a-z0-9-]+\.svg$/.test(src))return null;if(!images.has(src)){const i=new Image();i.src=src;images.set(src,i);}return images.get(src);}
 function poly(c,points,color,stroke){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}}
 function shade(hex,n){const rgb=String(hex).match(/^rgb\((\d+),(\d+),(\d+)\)$/),v=parseInt((hex||'#78bed1').slice(1),16),channels=rgb?rgb.slice(1).map(Number):[v>>16,(v>>8)&255,v&255];return 'rgb('+channels.map(c=>Math.max(0,Math.min(255,c+n))).join(',')+')';}
 function box(c,x,y,w,l,h,color){const a=[x,y-h],b=[x+w*18,y+w*9-h],d=[x-l*18,y+l*9-h],e=[x+(w-l)*18,y+(w+l)*9-h];poly(c,[a,b,e,d],shade(color,22),'#172333');poly(c,[d,e,[e[0],e[1]+h],[d[0],d[1]+h]],shade(color,-24),'#172333');poly(c,[b,e,[e[0],e[1]+h],[b[0],b[1]+h]],color,'#172333');
  // Fine bevels preserve the chunky silhouette while separating material planes.
  if(w>.25&&l>.25&&h>2){c.beginPath();c.moveTo(d[0]+1,d[1]-.5);c.lineTo(e[0],e[1]-1);c.lineTo(b[0]-1,b[1]-.5);c.strokeStyle=shade(color,48);c.lineWidth=.55;c.stroke();
   c.beginPath();c.moveTo(e[0],e[1]+1);c.lineTo(e[0],e[1]+h-1);c.strokeStyle=shade(color,-42);c.lineWidth=.6;c.stroke();}
 }
 // Small, original pixel-scale details stay legible both in rooms and the catalog.
 function decor(c,item,x,y){
  const color=item.color||'#67d1cc',s=item.sprite||item.sprite_id||'table';
  const dims={'diner-booth':[2,1],'pod-bed':[1,2],sofa:[2,1],bed:[1,2],rug:[2,2],divider:[2,1]},[w,l]=dims[s]||[item.width||1,item.length||1];
  c.save();c.translate(x,y);
  if(item.rotation===2||item.rotation===6)c.scale(-1,1);
  const point=(u,v,z=0)=>[(u-v)*18,(u+v)*9-z];
  const cube=(u,v,a,b,h,z,tint)=>{const [px,py]=point(u,v,z);box(c,px,py,a,b,h,tint);};
  const line=(points,tint,width=1)=>{c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.strokeStyle=tint;c.lineWidth=width;c.stroke();};
  const tile=(u,v,a,b,z,tint,edge)=>poly(c,[point(u,v,z),point(u+a,v,z),point(u+a,v+b,z),point(u,v+b,z)],tint,edge);
  const panel=(u,v,a,z,h,fill,edge)=>poly(c,[point(u,v,z+h),point(u+a,v,z+h),point(u+a,v,z),point(u,v,z)],fill,edge);
  // Layered contact shadow stays inside the existing furniture footprint.
  tile(.04,.05,w,.98*l,0,'#14273718');
  tile(.12,.12,Math.max(.1,w-.16),Math.max(.1,l-.16),0,'#14273724');
  tile(.22,.22,Math.max(.1,w-.36),Math.max(.1,l-.36),0,'#14273726');
  const legs=(a,b)=>{for(const [u,v] of [[.12,.12],[a-.23,.12],[.12,b-.23],[a-.23,b-.23]])cube(u,v,.12,.12,6,0,'#334455');};
  if(s==='hammock'){
   for(const u of [.08,1.82]){cube(u,.1,.1,.8,4,0,'#856b51');line([point(u,.5,3),point(u,.5,35)],'#c9aa79',3);}
   poly(c,[point(.1,.5,32),point(.45,.15,20),point(1.55,.15,20),point(1.9,.5,32),point(1.55,.9,14),point(.45,.9,14)],color,'#e5e1bd');
   for(let u=.45;u<1.6;u+=.2)line([point(u,.18,20),point(u,.87,14)],'#e7e5bb');cube(.4,.3,.3,.4,3,20,'#f6dbb5');
  }else if(s==='surf-rack'){
   cube(.05,.1,.9,.8,5,0,'#9c7756');for(const [u,tint,h] of [[.2,color,49],[.53,'#80cfce',44],[.79,'#e4a0bc',39]]){const q=point(u,.4,0);poly(c,[[q[0]-3,q[1]-5],[q[0]-5,q[1]-h+9],[q[0],q[1]-h],[q[0]+5,q[1]-h+9],[q[0]+3,q[1]-5]],tint,'#24384b');line([[q[0],q[1]-10],[q[0],q[1]-h+6]],'#fff0cc');}
  }else if(s==='shell-light'){
   cube(.25,.25,.5,.5,4,0,'#a78c72');line([point(.5,.5,4),point(.5,.5,27)],'#b7a482',2);const q=point(.5,.5,30);for(let a=0;a<7;a++){const t=Math.PI+a*Math.PI/6;line([[q[0],q[1]+7],[q[0]+Math.cos(t)*14,q[1]+Math.sin(t)*16]],a%2?color:'#ffe7bd',5);}c.fillStyle='#fff0ca';c.beginPath();c.arc(q[0],q[1]+4,4,0,7);c.fill();
  }else if(s==='cooler'){
   cube(.05,.08,.9,.85,16,0,color);cube(.02,.05,.96,.91,4,16,'#edf0db');panel(.42,.95,.16,8,7,'#eff5e0');line([point(.15,.1,22),point(.15,.1,28),point(.8,.1,28),point(.8,.1,22)],'#3e6271',2);cube(.2,.3,.18,.18,5,20,'#e6b379');
  }else if(s==='pinball'){
   legs(1,2);cube(.02,.1,.96,1.85,10,12,color);tile(.1,.2,.8,1.65,23,'#203a58','#97f3d8');for(const [u,v,t] of [[.3,.5,'#efc27e'],[.7,.8,'#db98d1'],[.4,1.2,'#8edcd0']])cube(u,v,.16,.18,3,23,t);line([point(.2,1.65,25),point(.45,1.5,25)],'#fff0c2',2);line([point(.8,1.65,25),point(.55,1.5,25)],'#fff0c2',2);cube(0,0,1,.15,23,22,color);panel(.12,.16,.76,28,12,'#18394e','#98f4dd');panel(.27,.17,.46,32,3,'#f2d18a');
  }else if(s==='prize-crane'){
   cube(.04,.04,.92,.92,12,0,color);cube(.02,.02,.96,.96,3,44,color);for(const u of [.06,.94])line([point(u,.08,12),point(u,.08,44),point(u,.94,44),point(u,.94,12)],'#bdece4',1.5);panel(.08,.95,.84,12,31,'#b5e8e31c','#bbe5df');for(const [u,v,t]of [[.3,.4,'#f8ce8d'],[.6,.65,'#a6b8ed'],[.3,.75,'#91d5b8']]){cube(u,v,.22,.22,5,12,t);cube(u+.03,v+.03,.16,.16,5,17,t);}line([point(.5,.5,43),point(.5,.5,30),point(.32,.5,27)],'#e5eddb');line([point(.5,.5,30),point(.68,.5,27)],'#e5eddb');panel(.18,.97,.4,3,5,'#334556');
  }else if(s==='dance-floor'){
   cube(0,0,2,2,2,0,'#344c64');for(let u=0;u<4;u++)for(let v=0;v<4;v++)tile(u*.5+.03,v*.5+.03,.44,.44,3,['#87dfd1','#d4a4e8','#f3bf8d'][(u+v)%3],'#b2dce2');
  }else if(s==='speaker-stack'){
   for(const z of [0,23]){cube(.08,.1,.84,.8,22,z,'#38475c');panel(.15,.91,.7,z+3,16,shade(color,-30),'#a2c6cb');const q=point(.5,.93,z+11);c.fillStyle='#1a293c';c.beginPath();c.arc(q[0],q[1],6,0,7);c.fill();c.strokeStyle=color;c.stroke();c.fillStyle='#b9d9df';c.fillRect(q[0]-1,q[1]-1,2,2);}line([point(.08,.96,2),point(.08,.96,44)],color,2);
  }else if(s==='range'){
   cube(.04,.04,.92,.92,24,0,color);tile(0,0,1,1,25,'#d7e1d8','#45616b');for(const [u,v]of [[.25,.25],[.7,.25],[.25,.7],[.7,.7]]){const q=point(u,v,26);c.strokeStyle='#3d5263';c.lineWidth=2;c.beginPath();c.ellipse(q[0],q[1],4,2,0,0,7);c.stroke();}panel(.18,.97,.64,4,13,'#324d5e','#e7d1ad');line([point(.2,.99,18),point(.8,.99,18)],'#f3e7cd',2);for(const u of [.2,.4,.6,.8])panel(u,.98,.06,21,2,'#506b72');
  }else if(s==='fridge'){
   cube(.04,.05,.92,.9,47,0,color);panel(.1,.96,.8,3,28,shade(color,10),'#d8ebe1');panel(.1,.96,.8,32,12,shade(color,17),'#d8ebe1');for(const z of [18,36])line([point(.76,.98,z),point(.76,.98,z+6)],'#edf1dd',2);panel(.23,.98,.16,22,5,'#eac28e');
  }else if(s==='kitchen-island'){
   cube(.03,.03,1.94,.94,24,0,color);cube(0,0,2,1,3,24,'#ece4d1');for(const u of [.13,1.04]){panel(u,.98,.81,3,18,shade(color,-7),'#dbc5a1');line([point(u+.26,.99,17),point(u+.55,.99,17)],'#5c6670',1.5);}tile(.2,.2,.65,.55,28,'#a8c6c1');cube(1.25,.25,.3,.3,5,27,'#d49775');cube(1.65,.55,.16,.2,4,27,'#a8b695');
  }else if(s==='stool'){
   for(const [u,v]of [[.2,.2],[.7,.2],[.2,.7],[.7,.7]])cube(u,v,.1,.1,18,0,'#765e50');cube(.08,.08,.84,.84,5,18,color);line([point(.25,.8,8),point(.75,.8,8)],'#af9673',2);
  }else if(s==='canopy-bed'){
   legs(1,2);cube(0,0,1,2,8,5,'#8d789a');cube(.04,.15,.92,1.75,7,13,'#eee1d3');tile(.06,.65,.88,1.23,21,color);cube(.12,.2,.76,.35,5,20,'#fff0da');for(const [u,v]of [[0,0],[1,0],[0,2],[1,2]])line([point(u,v,5),point(u,v,49)],'#c4b292',2);tile(-.03,-.03,1.06,2.06,49,'#d3c4e768','#e7d6e9');for(const u of [0,1])panel(u-.04,.1,.12,22,27,'#d9c8e491');
  }else if(s==='nightstand'){
   legs(1,1);cube(.05,.05,.9,.9,15,5,color);cube(0,0,1,1,3,20,'#ead8cf');for(const z of [8,15]){panel(.15,.96,.7,z-2,5,shade(color,12),'#e9d3ca');panel(.43,.98,.14,z,1,'#fae2a4');}cube(.2,.2,.28,.3,2,23,'#a4b8c7');
  }else if(s==='wardrobe'){
   cube(.03,.04,1.94,.92,44,0,color);cube(0,0,2,1,3,44,'#e6d5ce');for(const u of [.12,1.03]){panel(u,.97,.85,3,38,shade(color,12),'#eee0d7');panel(u+.15,.98,.55,8,27,'#b4c1d357','#d8d9df');}for(const u of [.86,1.12])line([point(u,.99,19),point(u,.99,26)],'#f0d79e',2);
  }else if(s==='vanity'){
   legs(1,1);cube(0,0,1,1,6,19,color);cube(.12,.04,.76,.13,24,25,'#c9ac8a');panel(.19,.18,.62,29,17,'#9dc7d1','#ffebc7');line([point(.25,.19,43),point(.6,.19,32)],'#e4ffff',1.5);cube(.15,.6,.12,.12,5,25,'#cca1d7');cube(.7,.65,.14,.14,3,25,'#edc88c');
  }else if(s==='workbench'){
   legs(2,1);cube(.02,.02,1.96,.96,4,20,color);tile(.12,.15,1.76,.72,25,'#c8ae83');cube(.2,.3,.55,.25,3,25,'#8ca8af');line([point(.4,.7,26),point(1,.7,26)],'#344c5b',3);cube(1.35,.2,.35,.4,8,24,'#557c87');cube(1.4,.25,.25,.25,3,32,'#b1c6be');
  }else if(s==='easel'){
   for(const u of [.15,.85])line([point(u,.2,0),point(.5,.3,48)],'#ae825e',2.5);line([point(.5,.85,0),point(.5,.3,40)],'#89694f',2.5);panel(.08,.35,.84,17,26,'#f4e6ca','#c5a174');panel(.17,.36,.66,21,17,'#87b7bd');poly(c,[point(.17,.37,21),point(.38,.37,34),point(.65,.37,23),point(.83,.37,31),point(.83,.37,21)],'#709178');cube(.05,.32,.9,.22,2,16,color);
  }else if(s==='sewing-desk'){
   legs(2,1);cube(0,0,2,1,4,20,'#c5a37d');tile(.2,.2,.65,.7,25,'#dba7c2');cube(1,.2,.65,.5,3,24,color);cube(1.45,.22,.18,.45,13,27,color);cube(1.05,.22,.55,.4,5,36,color);line([point(1.12,.42,36),point(1.12,.42,28)],'#ebead8');cube(1.47,.3,.1,.12,4,41,'#e8c69a');
  }else if(s==='tool-stand'){
   cube(.03,.08,.94,.8,10,0,color);cube(.03,.06,.94,.14,35,10,'#9c8265');panel(.1,.21,.8,17,23,'#d8ba8c','#745d4c');for(const [u,z]of [[.22,32],[.48,28],[.75,35]]){line([point(u,.23,z-9),point(u,.23,z)],'#4d6b76',2);line([point(u-.09,.23,z),point(u+.09,.23,z)],'#b8c9c5',2);}panel(.2,.9,.6,3,4,'#785c4c');
  }else if(s==='bonsai'){
   cube(.08,.08,.84,.84,7,0,'#ae8869');tile(.15,.15,.7,.7,8,'#586a55');line([point(.5,.5,8),point(.35,.4,20),point(.6,.4,32)],'#957450',4);for(const [u,v,z,a]of [[.25,.4,25,.6],[.5,.4,34,.5],[.55,.65,21,.45]]){cube(u-.15,v-.1,a,.4,6,z,color);tile(u-.15,v-.1,a,.4,z+7,shade(color,18));}
  }else if(s==='stone-lantern'){
   cube(.13,.13,.74,.74,5,0,shade(color,-20));cube(.36,.36,.28,.28,20,5,color);cube(.12,.12,.76,.76,3,25,color);cube(.23,.23,.54,.54,10,28,'#f2d494');for(const u of [.2,.75])line([point(u,.2,28),point(u,.2,39),point(u,.75,39),point(u,.75,28)],'#8a9e92',2);cube(.05,.05,.9,.9,3,39,color);cube(.3,.3,.4,.4,4,42,color);
  }else if(s==='koi-pond'){
   cube(.02,.02,1.96,1.96,6,0,'#98aaa0');tile(.15,.15,1.7,1.7,7,'#4c8992','#c4d2bc');tile(.27,.27,1.46,1.46,8,'#77b6b4');for(const [u,v,t]of [[.55,.6,'#efd5a1'],[1.2,1.15,'#efaa83']]){const q=point(u,v,9);c.fillStyle=t;c.beginPath();c.ellipse(q[0],q[1],5,2,.4,0,7);c.fill();poly(c,[[q[0]-5,q[1]],[q[0]-8,q[1]-3],[q[0]-8,q[1]+2]],t);}for(const [u,v]of [[.3,1.4],[1.4,.4]])tile(u,v,.3,.25,9,'#709b73');
  }else if(s==='bamboo-screen'){
   cube(0,.1,2,.75,5,0,'#897a5c');for(let u=.1;u<2;u+=.18){const h=34+Math.sin(u*4)*5;cube(u,.25,.12,.15,h,5,color);for(const z of [14,24,34])line([point(u,.41,z),point(u+.12,.41,z)],'#dfd3a3',1);}for(const z of [10,30])line([point(.06,.45,z),point(1.94,.45,z)],'#967d59',2);
  }else if(s==='coffee-station'){
   cube(.04,.04,.92,.92,22,0,'#82634f');cube(0,0,1,1,3,22,color);
   panel(.12,.98,.76,3,15,'#ab8662','#e3c7a0');line([point(.5,.99,5),point(.5,.99,17)],'#6f5544');
   cube(.12,.1,.7,.42,16,25,'#668e89');panel(.2,.53,.54,29,9,'#294957','#a6d8cc');
   for(const u of [.29,.57]){cube(u,.55,.15,.18,4,25,'#fff0d3');line([point(u+.07,.54,35),point(u+.07,.54,31)],'#e1d4ae',2);}
   cube(.74,.68,.16,.17,5,25,'#ecc28c');tile(.16,.12,.6,.32,42,'#d3e4d6');
   for(const u of [.24,.48])cube(u,.17,.12,.12,3,42,'#fff2d6');
  }else if(s==='bistro-table'){
   cube(.38,.38,.24,.24,15,2,'#657f79');tile(.12,.12,.76,.76,2,'#435b58','#263d42');cube(.02,.02,.96,.96,3,17,color);
   tile(.09,.09,.82,.82,21,'#e7d5ae');tile(.16,.25,.3,.4,21,'#8bbba6');
   cube(.25,.32,.14,.17,4,21,'#fff0d6');cube(.68,.2,.13,.13,5,21,'#799e91');
   line([point(.75,.26,26),point(.76,.25,34)],'#547a55',1.2);const q=point(.76,.25,34);poly(c,[[q[0],q[1]-3],[q[0]+3,q[1]],[q[0],q[1]+2],[q[0]-3,q[1]]],'#f2be91');
  }else if(s==='bentwood-chair'||s==='woven-seat'){
   legs(1,1);cube(.07,.08,.86,.84,4,10,color);cube(.12,.06,.76,.12,21,10,shade(color,-20));
   for(let u=.2;u<.85;u+=.15)line([point(u,.2,15),point(u,.2,29)],shade(color,35),1.3);
   for(const u of [.05,.86])cube(u,.22,.09,.64,3,19,shade(color,-12));
   tile(.18,.27,.64,.53,15,s==='woven-seat'?'#e9d5aa':'#e3e4b9');
   if(s==='woven-seat')for(let v=.3;v<.8;v+=.12)line([point(.18,v,15.5),point(.82,v,15.5)],'#b3976b',.7);
  }else if(s==='pastry-counter'){
   cube(0,0,2,1,20,0,color);cube(-.02,-.02,2.04,1.04,3,20,'#e5d5b6');
   for(let u=.15;u<1.9;u+=.28)panel(u,1.01,.12,3,14,shade(color,-17));
   tile(.12,.12,1.76,.76,24,'#577d7b');
   for(let u=.3;u<1.8;u+=.45){cube(u,.3,.25,.22,3,24,'#dfa56d');cube(u,.61,.25,.2,3,24,'#b57665');tile(u+.03,.62,.19,.13,28,'#f3cf9e');}
   for(const u of [.08,1.92])line([point(u,.08,24),point(u,.08,40),point(u,.92,40),point(u,.92,24)],'#c8e9dd');
   tile(.08,.08,1.84,.84,40,'#b8eee124','#c0e9df');panel(.08,.93,1.84,24,16,'#c3f1df24','#a8d2cb');
   line([point(.18,.94,38),point(.62,.94,26)],'#e2fff07a',1.3);
  }else if(s==='record-jukebox'){
   cube(.06,.08,.88,.84,43,0,'#655779');cube(.04,.06,.92,.88,3,43,color);
   panel(.15,.94,.7,23,17,'#20384d','#e8c58b');
   const q=point(.5,.95,32);c.fillStyle='#101e30';c.beginPath();c.arc(q[0],q[1],6,0,7);c.fill();c.strokeStyle='#8696b6';c.stroke();c.fillStyle='#e5b87b';c.fillRect(q[0]-2,q[1]-2,4,4);
   panel(.16,.95,.68,3,16,shade(color,-28),'#d9ba84');for(let u=.22;u<.81;u+=.12)line([point(u,.96,5),point(u,.96,17)],'#a793bd');
   for(const u of [.07,.89])line([point(u,.97,4),point(u,.97,42)],'#b4f3db',2);panel(.3,.96,.4,20,2,'#ffe5a1');
  }else if(s==='listening-console'){
   legs(2,1);cube(0,0,2,1,19,5,color);cube(-.02,-.02,2.04,1.04,3,24,'#e2c8a6');
   for(const u of [.12,1.35]){panel(u,1.01,.53,8,13,'#445267','#d9b68d');for(let a=u+.08;a<u+.5;a+=.1)line([point(a,1.02,9),point(a,1.02,19)],'#88939e',.6);}
   panel(.76,1.01,.48,8,13,'#614e4b');for(let u=.8;u<1.23;u+=.09)line([point(u,1.02,9),point(u,1.02,18)],u<1?'#afd3b7':'#e5bb8a',1.2);
   tile(.14,.2,.75,.62,28,'#3c485c');const q=point(.51,.51,29);c.fillStyle='#152337';c.beginPath();c.ellipse(q[0],q[1],9,4,.2,0,7);c.fill();c.fillStyle='#e9c586';c.fillRect(q[0]-1,q[1]-1,3,2);line([point(.8,.3,30),point(.66,.52,30)],'#d6e2df');cube(1.3,.3,.4,.4,2,28,'#729d92');
  }else if(s==='channel-sofa'){
   legs(2,1);cube(0,0,2,1,8,4,'#536277');cube(.04,.02,1.92,.2,24,10,color);
   for(let u=.14;u<1.85;u+=.28){panel(u,.23,.23,15,18,shade(color,14),'#526984');cube(u,.26,.23,.65,5,12,color);}
   for(const u of [0,1.85])cube(u,.2,.15,.8,10,13,shade(color,-10));line([point(.08,1,9),point(1.92,1,9)],'#dbbd89',2);cube(.32,.3,.33,.25,6,18,'#d8b88e');
  }else if(s==='crescent-light'){
   cube(.26,.26,.48,.48,3,0,'#8b7967');line([point(.5,.5,3),point(.5,.5,37)],'#cdb17e',2);
   const q=point(.5,.5,39);c.strokeStyle=color;c.lineWidth=5;c.beginPath();c.arc(q[0],q[1],12,-1.4,1.8);c.stroke();c.strokeStyle='#fff0c6';c.lineWidth=2;c.stroke();
   line([[q[0]+2,q[1]-12],[q[0]+2,q[1]+12]],'#bba377',.7);
  }else if(s==='plant-house'){
   cube(.03,.03,.94,.94,7,0,'#8f8065');tile(.1,.1,.8,.8,8,'#586c54');
   for(const [u,v,z] of [[.3,.3,26],[.65,.45,33],[.4,.7,21]]){line([point(u,v,8),point(u,v,z)],'#698e64',1.5);for(const side of [-1,1]){const q=point(u,v,z-3);poly(c,[[q[0],q[1]+6],[q[0]+side*8,q[1]-3],[q[0]+side*7,q[1]+4]],color,'#507a62');}}
   for(const u of [.03,.97])line([point(u,.03,8),point(u,.03,38),point(u,.97,38),point(u,.97,8)],'#d6dfc2');
   tile(.03,.03,.94,.94,38,'#b7ebdb20','#bde2d0');panel(.03,.98,.94,8,30,'#b7ebdb18','#add4c3');line([point(.15,.99,35),point(.43,.99,15)],'#e6fff057',1.4);
  }else if(s==='lily-basin'){
   cube(.03,.03,.94,.94,9,0,color);cube(0,0,1,1,3,9,shade(color,22));tile(.13,.13,.74,.74,13,'#467e86','#cfddc5');tile(.2,.2,.6,.6,13,'#79b7b1');
   for(const [u,v] of [[.35,.35],[.6,.65]]){tile(u,v,.23,.2,14,'#76a875');const q=point(u+.1,v+.1,16);poly(c,[[q[0]-4,q[1]],[q[0],q[1]-4],[q[0]+4,q[1]],[q[0],q[1]+2]],'#efd2d9');}line([point(.22,.7,14),point(.44,.8,14)],'#c3e5d5');
  }else if(s==='vine-screen'){
   cube(0,.12,2,.65,9,0,'#a28b6c');tile(.08,.2,1.84,.47,10,'#536d54');
   for(let u=.12;u<2;u+=.29)line([point(u,.15,10),point(u,.15,43)],'#d1bd8c',1.2);
   for(const z of [16,26,36,43])line([point(.1,.15,z),point(1.9,.15,z)],'#baa47b');
   for(let u=.2;u<1.9;u+=.34){const q=point(u,.2,22+Math.sin(u*5)*12);poly(c,[[q[0],q[1]+7],[q[0]-6,q[1]],[q[0],q[1]-5],[q[0]+5,q[1]]],color,'#648469');}
  }else if(s==='vip-throne'){
   legs(1,1);cube(0,0,1,1,7,5,'#7154a8');cube(.06,.03,.88,.16,37,10,'#b08bea');
   panel(.16,.2,.68,17,24,'#48315f','#ffe8a6');cube(.15,.24,.7,.65,5,13,'#bd9df0');
   for(const u of [.02,.84]){cube(u,.15,.14,.8,9,14,'#e6bf71');line([point(u+.07,.2,24),point(u+.07,.85,24)],'#a4ffe8',1.4);}
   const [cx,cy]=point(.5,.1,45);poly(c,[[cx-11,cy],[cx-12,cy-8],[cx-5,cy-4],[cx,cy-13],[cx+5,cy-4],[cx+12,cy-8],[cx+11,cy]],'#ffd77e','#fff1bd');
   for(const z of [23,32]){const [px,py]=point(.5,.21,z);poly(c,[[px,py-3],[px+3,py],[px,py+3],[px-3,py]],'#a6ffea');}
   line([point(.08,1,9),point(.92,1,9)],'#a2ffe9',2);
  }else if(s==='vip-fountain'){
   cube(.03,.03,.94,.94,6,0,'#63558d');cube(0,0,1,1,4,6,'#e2c789');tile(.12,.12,.76,.76,11,'#397d96','#b7fff1');
   tile(.22,.22,.56,.56,12,'#79e4de');const top=point(.5,.5,48),bottom=point(.5,.5,16),left=point(.1,.5,30),right=point(.9,.5,30);
   poly(c,[top,left,bottom],'#91f4dc','#dbfff5');poly(c,[top,right,bottom],'#a394e3','#e5ddff');line([left,right],'#f7efff');
   for(const u of [.18,.82])line([point(.5,.5,38),point(u,.5,27),point(u,.5,12)],'#d5fff2',1.3);
   for(const z of [22,35]){const [px,py]=point(.5,.5,z);c.beginPath();c.ellipse(px,py,15,4,-.25,0,Math.PI*2);c.strokeStyle='#f8d796';c.lineWidth=.8;c.stroke();}
  }else if(s==='vip-bloom'){
   cube(.05,.05,.9,.9,8,0,'#49416c');cube(0,0,1,1,3,8,'#e7c782');tile(.12,.12,.76,.76,12,'#566b78');
   for(const [dx,dy] of [[-11,-24],[10,-30],[0,-43]]){line([[0,1],[dx,dy]],'#b6f3e0',2);poly(c,[[dx,dy-7],[dx+6,dy],[dx,dy+5],[dx-6,dy]],'#d2abf5','#fff0fc');line([[dx-4,dy],[dx+4,dy]],'#ffe8ac');}
   for(const u of [.08,.92])line([point(u,.08,12),point(u,.08,48),point(u,.92,48),point(u,.92,12)],'#a3eade',.8);
   tile(.08,.08,.84,.84,48,'#b6eaff20','#c3fff0');panel(.08,.92,.84,12,36,'#a9e9ec15','#b3dfe370');
  }else if(s==='diner-booth'){
   legs(2,1);cube(0,0,2,1,8,4,'#3a5365');cube(.02,.02,1.96,.16,27,9,color);
   for(const u of [.1,1.02]){cube(u,.22,.88,.72,6,10,color);panel(u,.19,.88,17,16,shade(color,-12),'#ffd8bc');
    for(let a=u+.12;a<u+.8;a+=.2)line([point(a,.2,19),point(a,.2,31)],shade(color,32),.7);}
   line([point(0,1,8),point(2,1,8)],'#7affdf',2);line([point(.08,.05,36),point(1.92,.05,36)],'#fff1cd',2);
   for(const u of [0,1.91])cube(u,.12,.09,.84,3,18,'#bddbe1');
  }else if(s==='vending'){
   cube(.05,.05,.9,.9,44,1,color);cube(0,0,1,1,3,45,'#c2e7e7');
   panel(.12,.96,.56,15,26,'#152b42','#a0f4e3');panel(.73,.96,.16,19,19,'#293c54');
   for(let z=19;z<39;z+=8){for(let u=.19;u<.62;u+=.19){panel(u,.98,.11,z,5,['#91f6ce','#f6b193','#cab6ff'][Math.round(z/8)%3]);}line([point(.14,.99,z-1),point(.66,.99,z-1)],'#8eacbb');}
   for(const z of [22,27,32])panel(.78,.99,.06,z,2,'#ffdc91');panel(.17,.98,.48,5,5,'#162737','#d4e9df');
   panel(.14,.97,.5,42,2,'#baffdf');line([point(.16,.99,38),point(.49,.99,17)],'#ffffff35',2);
  }else if(s==='holo-table'){
   cube(.08,.08,.84,.84,7,1,'#354e66');cube(0,0,1,1,3,9,'#a4c7cf');tile(.15,.15,.7,.7,13,'#235d68');
   for(const z of [14,18,22])tile(.3,.3,.4,.4,z,'#72f4d329');
   const top=point(.5,.5,42),left=point(.12,.5,29),right=point(.88,.5,29),bottom=point(.5,.5,18);
   poly(c,[top,left,bottom], '#68e3d080','#b5fff1');poly(c,[top,right,bottom],'#a5b9ff70','#b5fff1');line([left,right],'#b4fff1');
   for(const u of [.15,.45,.75])tile(u,.9,.08,.05,13,'#7affd5');
  }else if(s==='pod-bed'){
   cube(0,0,1,2,7,4,'#34475f');cube(.04,.06,.92,1.88,5,12,'#d9ece6');cube(.12,.2,.76,.38,4,17,'#fff4d2');
   cube(.1,.8,.8,1.06,3,17,color);cube(0,0,1,.13,32,5,shade(color,-18));
   for(const u of [0,.9]){cube(u,.13,.1,1.82,5,15,shade(color,-15));line([point(u+.05,.2,21),point(u+.05,1.85,21)],'#8bffe4',1.5);}
   panel(.15,.14,.7,24,8,'#263b51','#89e8df');line([point(.2,.15,28),point(.65,.15,28)],'#d4e0ff');
   tile(.14,1.1,.72,.08,21,'#d7d2ff');
  }else if(s==='cactus'){
   cube(.21,.21,.58,.58,11,1,'#bd8367');cube(.16,.16,.68,.68,3,11,'#efc89e');tile(.23,.23,.54,.54,15,'#6e5946');
   line([[0,0],[0,-39]],shade(color,-28),9);line([[-1,-1],[-1,-39]],color,6);
   line([[0,-17],[-12,-17],[-12,-30]],color,6);line([[1,-24],[11,-24],[11,-36]],color,6);
   for(const [x,y] of [[-2,-32],[1,-22],[-12,-25],[11,-32],[-1,-9]])line([[x-1,y],[x+2,y-2]],'#e1e8a9',.7);
   poly(c,[[-4,-40],[0,-45],[4,-40],[0,-37]],'#f2a6c3','#fbd7d5');
  }else if(s==='counter'||s==='bar'){
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
   // Upholstered inset, piping and button tufting instead of a flat slab.
   panel(.16,.181,.68,14,14,shade(color,6),shade(color,-28));
   line([point(.18,.19,27),point(.8,.19,27)],shade(color,50),.6);
   for(const u of [.34,.66]){const [bx,by]=point(u,.19,22);line([[bx-1.5,by-1],[bx,by],[bx+1.5,by-1]],shade(color,-38),.7);}
   line([point(.12,.92,14),point(.88,.92,14)],shade(color,55),.7);
   tile(.2,.3,.6,.05,15,'#ffffff16');
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
   // Shallow basin ripples, inset stonework and split water highlights.
   tile(.17,.17,.66,.66,10,'#3c9eaf');tile(.22,.22,.56,.56,10,'#71d9d4');
   for(const [u,v] of [[.22,.65],[.68,.66],[.18,.23]]){const [rx,ry]=point(u,v,10.5);c.beginPath();c.ellipse(rx,ry,3,1.2,0,0,Math.PI*1.7);c.strokeStyle='#d2fff0';c.lineWidth=.55;c.stroke();}
   cube(.4,.4,.2,.2,20,9,shade(color,15));cube(.25,.25,.5,.5,3,27,color);tile(.3,.3,.4,.4,30,'#a9e8e6');
   for(const [u,v] of [[.27,.5],[.73,.5],[.5,.27],[.5,.73]]){line([point(.5,.5,34),point(u,v,28),point(u,v,12)],'#b7f7f0');const [px,py]=point(u,v,11);line([[px-2,py],[px+2,py]],'#e3ffed');}
   for(const u of [.19,.5,.81])line([point(u,1.01,7),point(u,1.01,9)],shade(color,-35),.6);
   line([point(.43,.61,13),point(.43,.61,26)],'#ebfff2',.7);
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
   // Marquee, CRT scan lines and cabinet venting keep the original arcade palette.
   panel(.12,.795,.76,45,4,shade(color,-35));
   line([point(.18,.8,47),point(.78,.8,47)],'#fff0b4',1.2);
   for(let z=32;z<44;z+=2)line([point(.15,.805,z),point(.85,.805,z)],'#9fffe51f',.5);
   line([point(.15,.81,42),point(.15,.81,33)],'#c7fff6',.7);
   panel(.17,.991,.66,3,4,shade(color,-72));
   for(let u=.23;u<.8;u+=.12)line([point(u,.995,4),point(u,.995,6)],'#93b3bc',.5);
   poly(c,[point(1.005,.16,40),point(1.005,.58,32),point(1.005,.58,28),point(1.005,.16,36)],'#fff0b455');
   line([point(.43,.99,11),point(.66,.99,11)],'#bed5d9',2);
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
  c.save();c.translate(x,y);c.fillStyle='#0b172a77';c.beginPath();c.ellipse(0,1,11,5,0,0,7);c.fill();
  // The portrait has two pixels of transparent padding below the soles.
  c.translate(0,2);if(user.facing==='left')c.scale(-1,1);
  if(user.state==='lay'){c.translate(-12,-10);c.rotate(Math.PI/2);}
  const key=JSON.stringify(parts.map(p=>p.imageUrl));let sprite=sprites.get(key);
  if(!sprite){const loaded=parts.map(p=>image(p.imageUrl));if(loaded.length&&loaded.every(i=>i?.complete&&i.naturalWidth)){sprite=document.createElement('canvas');sprite.width=192;sprite.height=256;const sc=sprite.getContext('2d');for(const img of loaded)sc.drawImage(img,0,0,192,256);if(sprites.size>=64)sprites.delete(sprites.keys().next().value);sprites.set(key,sprite);}}
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
   // Cache SVG equipment at 4x resolution; preserve the exact logical rig/feet.
   c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
   const slice=(sx,sy,sw,sh,...dest)=>c.drawImage(sprite,sx*4,sy*4,sw*4,sh*4,...dest);
   // Keep every equipped cosmetic, with a larger raster and natural 3:4 proportions.
   if(user.state==='sit'){slice(0,0,48,48,-18,-42,36,34);slice(0,48,48,16,-13,-8,36,10);}
   else if(user.gait>.001){
    // Partition the composed outfit, keeping every cosmetic pixel exactly once.
    // Feet pivot at the hips; opposite arms counter-swing. One foot stays grounded.
    // Footsteps communicate locomotion even with Reduce Motion; omit body bob and soften swings.
    const stride=Math.sin(user.phase)*user.gait*(reducedMotion.matches ? .65 : 1), bob=reducedMotion.matches?0:(1-Math.cos(user.phase*2))*.25*user.gait;
    const limb=(sx,sy,sw,sh,dx,dy,pivotX,pivotY,angle,lift=0)=>{c.save();c.translate(pivotX,pivotY-lift);c.rotate(angle);slice(sx,sy,sw,sh,dx-pivotX,dy-pivotY,sw*.75,sh*.75);c.restore();};
    limb(0,46,24,18,-18,-13.5,-4,-13.5,stride*.17,Math.max(0,stride)*1.4);
    limb(24,46,24,18,0,-13.5,4,-13.5,-stride*.17,Math.max(0,-stride)*1.4);
    c.save();c.translate(0,-bob);
    slice(0,0,48,30,-18,-48,36,22.5);
    slice(16,30,16,16,-6,-25.5,12,12);
    limb(0,30,16,16,-18,-25.5,-6,-25.5,-stride*.12);
    limb(32,30,16,16,6,-25.5,6,-25.5,stride*.12);c.restore();
   }
   else c.drawImage(sprite,-18,-48,36,48);drew=true;
  }
  if(!drew){c.fillStyle='#173f58';c.fillRect(-8,-20,16,17);c.fillStyle='#7ef0d6';c.fillRect(-8,-19,16,2);c.fillStyle='#ad855d';c.fillRect(-10,-37,20,19);c.fillStyle='#ecc898';c.fillRect(-8,-40,16,20);c.fillStyle='#fff3cf';c.fillRect(-5,-34,4,6);c.fillRect(3,-34,4,6);c.fillStyle='#1e495b';c.fillRect(-4,-32,2,4);c.fillRect(4,-32,2,4);c.fillStyle='#645448';c.fillRect(-2,-25,5,2);c.fillStyle='#73c292';c.fillRect(0,-44,3,5);c.fillStyle='#263447';c.fillRect(-8,-4,6,5);c.fillRect(3,-4,6,5);}
 c.restore();}
 class WorldRenderer{
  constructor(canvas,onTap){this.canvas=canvas;this.c=canvas.getContext('2d');this.onTap=onTap;this.scene=null;this.users=new Map();this.staff=new Map();this.offset={x:0,y:0};this.zoom=1;this.viewMode='room';this.localUserId=null;this.hit=[];this.selected=null;this.bubbles=new Map();this.pointers=new Map();
    new ResizeObserver(()=>this.resize()).observe(canvas);this.resize();
    const point=e=>{const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left-this.cx)/this.scale,y=(e.clientY-r.top-this.cy)/this.scale;const tile=this.floorAt(x,y);return {x,y,tx:tile?.x??Math.floor((x/18+y/9)/2),ty:tile?.y??Math.floor((y/9-x/18)/2)};};
    const resetTap=()=>{clearTimeout(this.tapTimer);this.lastTap=null;};
    canvas.addEventListener('pointerdown',e=>{
     if(e.button!==0)return;
     this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);
     if(this.pointers.size>=2){resetTap();this.drag=null;const [a,b]=[...this.pointers.values()];const r=canvas.getBoundingClientRect();this.pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom:this.zoom,worldX:((a.x+b.x)/2-r.left-this.cx)/this.scale,worldY:((a.y+b.y)/2-r.top-this.cy)/this.scale};this.gestureLock=true;return;}
     if(this.gestureLock||this.drag)return;
     canvas.setPointerCapture(e.pointerId);const p=point(e);
     this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,tx:p.tx,ty:p.ty,ox:this.offset.x,oy:this.offset.y,px:this.placement?.x,py:this.placement?.y,moved:false};
    });
    canvas.addEventListener('pointermove',e=>{
     if(this.pointers.has(e.pointerId))this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
     if(this.pinch&&this.pointers.size>=2){const [a,b]=[...this.pointers.values()],r=canvas.getBoundingClientRect();this.setZoom(this.pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/this.pinch.distance);this.offset.x+=(a.x+b.x)/2-r.left-(this.cx+this.pinch.worldX*this.scale);this.offset.y+=(a.y+b.y)/2-r.top-(this.cy+this.pinch.worldY*this.scale);this.draw();return;}
     const d=this.drag;if(this.gestureLock||!d||d.id!==e.pointerId)return;
     const dx=e.clientX-d.x,dy=e.clientY-d.y;
     if(Math.hypot(dx,dy)>8){d.moved=true;resetTap();}
     if(!d.moved)return;
     if(this.placement){if(!this.placement.saving){const p=point(e);this.placement.x=d.px+p.tx-d.tx;this.placement.y=d.py+p.ty-d.ty;}}
     else this.offset={x:d.ox+dx,y:d.oy+dy};
    });
    canvas.addEventListener('pointerup',e=>{
     this.pointers.delete(e.pointerId);
     if(this.gestureLock){this.pinch=null;if(!this.pointers.size)this.gestureLock=false;resetTap();return;}
     const d=this.drag;if(!d||d.id!==e.pointerId)return;this.drag=null;
     if(d.moved)return;
     const p=point(e),now=performance.now(),last=this.lastTap;
     const twice=last&&now-last.at<360&&Math.hypot(e.clientX-last.x,e.clientY-last.y)<28;
     if(this.placement){
      if(this.placement.saving)return;
      if(twice){resetTap();this.onPlacementDrop?.();}else this.lastTap={at:now,x:e.clientX,y:e.clientY};
      return;
     }
     if(this.doorHit&&Math.abs(p.x-this.doorHit.x)<22&&p.y>this.doorHit.y-52&&p.y<this.doorHit.y+8){resetTap();this.onTap({door:true});return;}
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
    const cancelPointer=e=>{this.pointers.delete(e.pointerId);this.pinch=null;this.drag=null;this.gestureLock=this.pointers.size>0;resetTap();};
    canvas.addEventListener('pointercancel',cancelPointer);canvas.addEventListener('lostpointercapture',e=>{if(this.pointers.has(e.pointerId))cancelPointer(e);});
    canvas.addEventListener('wheel',e=>{e.preventDefault();resetTap();const r=canvas.getBoundingClientRect();this.setZoom(this.zoom*Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.002),{x:e.clientX-r.left,y:e.clientY-r.top});},{passive:false});
    for(const type of ['gesturestart','gesturechange','gestureend','contextmenu'])canvas.addEventListener(type,e=>e.preventDefault());
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
  setZoom(amount,anchor){const before=this.zoom;this.zoom=Math.max(.6,Math.min(2.2,amount));if(anchor&&this.scene&&this.scale){const x=(anchor.x-this.cx)/this.scale,y=(anchor.y-this.cy)/this.scale;this.draw();this.offset.x+=anchor.x-(this.cx+x*this.scale);this.offset.y+=anchor.y-(this.cy+y*this.scale);}if(before!==this.zoom)this.draw();}
  sample(u,now=performance.now()){const t=Math.max(0,Math.min(1,(now-u.at)/250));return {x:u.old.x+(u.position.x-u.old.x)*t,y:u.old.y+(u.position.y-u.old.y)*t,z:u.old.z+(u.position.z-u.old.z)*t};}
  animate(u,now){const p=this.sample(u,now),last=u.visual||p,dt=Math.min(.05,Math.max(0,(now-(u.frameAt||now))/1000)),distance=Math.hypot(p.x-last.x,p.y-last.y);const moving=distance>.00001&&u.state!=='sit'&&u.state!=='lay';u.phase=(u.phase||0)+distance*Math.PI*2;u.gait=(u.gait||0)+((moving?1:0)-(u.gait||0))*(1-Math.exp(-dt*18));u.visual=p;u.frameAt=now;return p;}

  setScene(scene){if(!this.scene||this.scene.roomId!==scene.roomId){this.placement=null;this.drag=null;this.pointers?.clear();this.pinch=null;this.gestureLock=false;clearTimeout(this.tapTimer);this.lastTap=null;this.setView('room');this.bubbles.clear();}this.scene=scene;}
  clearPlacement(){this.placement=null;this.drag=null;this.lastTap=null;clearTimeout(this.tapTimer);}
  placementResult(){const p=this.placement;return p?EarnlyWorldPlacement.placementCheck(this.scene,p.item,{x:p.x,y:p.y,rotation:p.rotation},[...this.users.values()]):null;}
  setStaff(staff){const old=this.staff;this.staff=new Map(staff.map(s=>[s.staffId,{...s,old:old.get(s.staffId)?.position||s.position,at:performance.now()}]));}
  setUsers(users){this.users.clear();users.forEach(u=>this.updateUser(u));}
  updateUser(u){const previous=this.users.get(u.userId),now=performance.now();
   // Chat, look and standing packets must not restart an in-flight step.
   const changed=!previous||['x','y','z'].some(k=>u.position[k]!==previous.position[k]);
   const from=previous?this.sample(previous,now):u.position,dx=u.position.x-from.x,dy=u.position.y-from.y;
   const teleport=Math.hypot(dx,dy)>4;
   this.users.set(u.userId,{...previous,...u,old:changed?(teleport?u.position:from):previous.old,at:changed?now:previous.at,
    facing:changed&&Math.abs(dx-dy)>.001?(dx-dy<0?'left':'right'):(previous?.facing||'right')});}

  bubble(packet){this.bubbles.set(packet.userId,{text:packet.text,until:performance.now()+6000,mode:packet.mode});}
  draw(){const c=this.c,w=this.width||this.canvas.width,h=this.height||this.canvas.height;c.setTransform(this.dpr||1,0,0,this.dpr||1,0,0);c.clearRect(0,0,w,h);if(!this.scene)return;const floor=this.scene.heightmap.split('\n'),n=floor[0].length,m=floor.length;
    const fit=Math.min(w/((n+m)*18+70),h/((n+m)*9+150));
    this.scale=(this.viewMode==='close'?Math.max(fit,Math.min(1.65,w/290)):fit)*this.zoom;
    this.cx=w/2+(m-n)*9*this.scale+this.offset.x;this.cy=(h-(n+m)*9*this.scale)/2+44*this.scale+this.offset.y;
    const now=performance.now();for(const u of [...this.users.values(),...this.staff.values()])this.animate(u,now);
    const me=this.users.get(this.localUserId);
    if(this.viewMode==='close'&&me){const {x:px,y:py,z}=me.visual;
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
    if(outside){
     // Static atmosphere: no extra animation loop or particle work on phones.
     if(theme==='rooftop'){
      c.fillStyle='#e8d8b2';c.beginPath();c.arc(75,-77,10,0,Math.PI*2);c.fill();c.fillStyle='#19243c';c.beginPath();c.arc(80,-80,9,0,Math.PI*2);c.fill();
      c.fillStyle='#bdd9e5';for(const [x,y] of [[-85,-82],[-36,-65],[20,-91],[112,-61],[-130,-48]])c.fillRect(x,y,1.5,1.5);
     }else{
      for(let i=0;i<9;i++){
       const x=-m*18+i*(n+m)*4.5,top=-50-(i%3)*7;
       c.fillStyle='#69594a';c.fillRect(x-2,top+24,4,31);c.strokeStyle='#69594a';c.lineWidth=2;c.beginPath();c.moveTo(x,top+42);c.lineTo(x-10,top+25);c.moveTo(x,top+36);c.lineTo(x+11,top+19);c.stroke();
       const crown=[[x-24,top+23],[x-20,top+10],[x-10,top+7],[x-7,top-3],[x+6,top-7],[x+17,top+1],[x+20,top+13],[x+27,top+19],[x+24,top+32],[x+11,top+39],[x-7,top+37],[x-20,top+32]];
       poly(c,crown,i%2?'#355e50':'#294d45','#25453e');
       poly(c,[[x-18,top+16],[x-7,top+9],[x-4,top+1],[x+5,top-2],[x+12,top+5],[x+10,top+15],[x-1,top+22],[x-15,top+25]],'#47785c');
       poly(c,[[x+3,top+25],[x+13,top+17],[x+21,top+22],[x+17,top+31],[x+5,top+34]],'#3b6852');
       c.fillStyle='#69936d';for(const [dx,dy] of [[-10,14],[0,7],[8,14],[-14,23],[12,27]])c.fillRect(x+dx,top+dy,3,2);
      }
     }
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
     for(const side of [-1,1]){const span=side<0?m:n;c.beginPath();c.moveTo(0,-31);c.quadraticCurveTo(side*span*9,span*4.5-17,side*span*18,span*9-31);c.strokeStyle='#354652';c.lineWidth=1;c.stroke();
      for(let i=0;i<=span;i++){const t=i/span,x=side*i*18,y=i*9-31+28*t*(1-t);c.fillStyle='#fae5a61a';c.beginPath();c.arc(x,y+3,6,0,Math.PI*2);c.fill();c.fillStyle=i%3===0?'#b6f4df':'#fae5a6';c.fillRect(x-1.5,y,3,4);}
     }
    }
    const occupied=(x,y)=>x>=0&&y>=0&&x<n&&y<m&&!/[xX]/.test(floor[y][x]);
    for(let y=0;y<m;y++)for(let x=0;x<n;x++){
     if(!occupied(x,y))continue;
     const z=Number(floor[y][x]),px=(x-y)*18,py=(x+y)*9-z*12;
     const tint=theme==='patio'?((x+y)%2?'#adbb94':'#a2b28a'):theme==='rooftop'?((x+y)%2?'#929eb8':'#8490aa'):theme==='lobby'?((x+y)%2?'#dfceb2':'#d1bea0'):((x+y)%2?'#bdccca':'#afc2c1');
     poly(c,[[px,py],[px+18,py+9],[px,py+18],[px-18,py+9]],tint,'#7e989f');
     poly(c,[[px,py+1],[px+16,py+9],[px,py+17],[px-16,py+9]],'#ffffff06','#e9f8ec28');
     // Two restrained facets read as ceramic rather than a flat checkerboard.
     poly(c,[[px,py+1],[px+16,py+9],[px,py+10],[px-16,py+9]],'#ffffff0b');
     poly(c,[[px-16,py+10],[px,py+17],[px+16,py+10],[px,py+15]],'#18344e09');
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

    // Every layout has a wall-mounted doorway, including outdoor rooms.
    const doorRow=floor.findIndex(row=>/[0-9]/.test(row)),doorCol=doorRow<0?-1:floor[doorRow].search(/[0-9]/);
    if(doorCol>=0){const dx=(doorCol-doorRow)*18,dy=(doorCol+doorRow)*9-Number(floor[doorRow][doorCol])*12;
     this.doorHit={x:dx-12,y:dy};
     poly(c,[[dx,dy-49],[dx-25,dy-36.5],[dx-25,dy+12.5],[dx,dy]],'#d8c59a','#203b4b');
     poly(c,[[dx-3,dy-43],[dx-22,dy-33.5],[dx-22,dy+8.5],[dx-3,dy-1]],'#173b4b','#81e8ce');
     c.fillStyle='#f7d891';c.beginPath();c.arc(dx-7,dy-14,1.8,0,Math.PI*2);c.fill();
     poly(c,[[dx,dy],[dx-25,dy+12.5],[dx-15,dy+17.5],[dx+10,dy+5]],'#73d8ba','#b9f7df');
    }
    if(this.selected){const {x,y}=this.selected;if(occupied(x,y)){const px=(x-y)*18,py=(x+y)*9-Number(floor[y][x])*12;poly(c,[[px,py],[px+18,py+9],[px,py+18],[px-18,py+9]],'#7cf2ce88','#b9fff0');}}
    const preview=this.placement;
    if(preview){
     const check=this.placementResult();preview.valid=check.valid;preview.z=check.z;preview.reason=check.reason;
     const turned=preview.rotation===2||preview.rotation===6,pw=turned?preview.item.length:preview.item.width,pl=turned?preview.item.width:preview.item.length;
     const tint=check.valid?'#54f09a88':'#ff526f99',edge=check.valid?'#a6ffd0':'#ffb3bf';
     for(let y=preview.y;y<preview.y+pl;y++)for(let x=preview.x;x<preview.x+pw;x++){const px=(x-y)*18,py=(x+y)*9-check.z*12;poly(c,[[px,py],[px+18,py+9],[px,py+18],[px-18,py+9]],tint,edge);}
    }
    const nodes=(this.scene.items||[]).filter(i=>i.id!==preview?.item.id).map(item=>({depth:item.x+item.y+(item.width+item.length)/2-.3,item}));for(const u of [...this.users.values(),...this.staff.values()]){let depth=(u.visual||u.position).x+(u.visual||u.position).y+1;if(u.state==='sit'||u.state==='lay'){const seat=nodes.find(n=>{const i=n.item;if(!i)return false;const turned=i.rotation===2||i.rotation===6;return u.position.x>=i.x&&u.position.y>=i.y&&u.position.x<i.x+(turned?i.length:i.width)&&u.position.y<i.y+(turned?i.width:i.length);});if(seat)depth=Math.max(depth,seat.depth+.1);}nodes.push({depth,user:u});}nodes.sort((a,b)=>a.depth-b.depth);this.hit=[];
    const local=nodes.find(n=>n.user&&n.user.userId===this.localUserId),localPos=local?.user?.visual;
    for(const node of nodes){if(node.item){const i=node.item,ix=(i.x-i.y)*18,iy=(i.x+i.y)*9-i.z*12;
     // Fade foreground foliage only while it overlaps your avatar; collision and picking stay intact.
     const foliage=['palm','tree','plant','vine-screen'].includes(i.sprite||i.sprite_id),lx=localPos?(localPos.x-localPos.y)*18:0,ly=localPos?(localPos.x+localPos.y)*9+9-localPos.z*12:0;
     const obscures=foliage&&local&&node.depth>local.depth&&Math.abs(ix-lx)<29&&ly>iy-82&&ly-38<iy+18;
     c.save();if(obscures)c.globalAlpha=.28;decor(c,i,ix,iy);c.restore();
    }else{const u=node.user,{x:px,y:py,z}=u.visual;const x=(px-py)*18,y=(px+py)*9+9-z*12;if(u.userId===this.localUserId){c.strokeStyle='#93ffe1';c.lineWidth=1.5;c.beginPath();c.ellipse(x,y,13,5,0,0,Math.PI*2);c.stroke();}avatar(c,u,x,y);this.hit.push({x,y,user:u});}}
    if(preview){c.save();c.globalAlpha=.65;decor(c,{...preview.item,x:preview.x,y:preview.y,z:preview.z,rotation:preview.rotation},(preview.x-preview.y)*18,(preview.x+preview.y)*9-preview.z*12-5);c.restore();}
    c.restore();
    // Labels and speech use screen pixels, so they remain readable at every zoom.
    const bubbles=[];
    for(const hit of this.hit){const x=this.cx+hit.x*this.scale,y=this.cy+hit.y*this.scale;
     if(x<-40||x>w+40||y<-10||y>h+65)continue;
     const name=(hit.user.username||'You').slice(0,18)+(hit.user.isStaff?' · NPC':'');c.font='600 11px system-ui';c.textAlign='center';const labelWidth=c.measureText(name).width+12;
     c.fillStyle='#122c3ee6';c.fillRect(x-labelWidth/2,y+5,labelWidth,17);c.fillStyle=hit.user.isStaff?'#ffe0a0':hit.user.userId===this.localUserId?'#9bffe3':'#f2fff8';c.fillText(name,x,y+17);
     const bubble=this.bubbles.get(hit.user.userId);if(!bubble||bubble.until<=performance.now())continue;
     c.font=(bubble.mode==='shout'?'bold ':'')+'12px system-ui';const limit=Math.min(226,w-48);
     if(!bubble.layout||bubble.layout.limit!==limit){const lines=[];let line='';
      for(const word of bubble.text.split(/\s+/)){if(line&&c.measureText(line+' '+word).width>limit){lines.push(line);line='';}if(line)line+=' ';for(const char of word){if(c.measureText(line+char).width>limit){lines.push(line);line='';}line+=char;}}if(line)lines.push(line);
      if(lines.length>3){lines.length=3;lines[2]=lines[2].slice(0,-2)+'…';}
      bubble.layout={limit,lines,bw:Math.max(40,...lines.map(t=>c.measureText(t).width+16))};
     }
     const {lines,bw}=bubble.layout,bh=lines.length*16+12,bx=Math.max(8,Math.min(w-bw-8,x-bw/2));let by=Math.max(62,y-52*this.scale-bh-8);
     for(const prior of bubbles){if(bx<prior.x+prior.w+4&&bx+bw>prior.x-4&&by<prior.y+prior.h+4&&by+bh>prior.y-4)by=Math.max(62,prior.y-bh-5);}
     bubbles.push({x:bx,y:by,w:bw,h:bh});c.fillStyle='#f8f0d9';c.fillRect(bx,by,bw,bh);c.strokeStyle='#364c55';c.lineWidth=1;c.strokeRect(bx+.5,by+.5,bw-1,bh-1);const tail=Math.max(bx+6,Math.min(bx+bw-12,x));poly(c,[[tail,by+bh],[tail+8,by+bh],[tail+3,by+bh+6]],'#f8f0d9');c.fillStyle='#203745';c.textAlign='left';lines.forEach((text,i)=>c.fillText(text,bx+8,by+19+i*16));
    }

  }
 }
 function thumbnail(canvas,item){canvas.width=160;canvas.height=128;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.translate(80,['rug','dance-floor','koi-pond'].includes(item.sprite||item.sprite_id)?60:['surf-rack','shell-light','pinball','prize-crane','speaker-stack','fridge','canopy-bed','wardrobe','vanity','easel','tool-stand','stone-lantern','bamboo-screen','coffee-station','pastry-counter','record-jukebox','listening-console','crescent-light','plant-house','vine-screen','vip-throne','vip-fountain','vip-bloom','vending','cactus','palm','tree','flowers','plant','bookshelf','aquarium','clock','television','column','divider','fountain'].includes(item.sprite||item.sprite_id)?88:76);c.scale(1.5,1.5);decor(c,item,0,0);}
 function roomThumbnail(canvas,heightmap,items=[],theme){
  canvas.width=300;canvas.height=210;
  const preview=Object.create(WorldRenderer.prototype);
  Object.assign(preview,{canvas,c:canvas.getContext('2d'),scene:{heightmap,items,theme},users:new Map(),staff:new Map(),bubbles:new Map(),offset:{x:0,y:0},zoom:1,hit:[]});preview.draw();
 }
 function decorPreview(canvas,item,options={}){canvas.width=360;canvas.height=220;const c=canvas.getContext('2d');c.fillStyle='#12243b';c.fillRect(0,0,360,220);c.save();c.translate(180,70);c.scale(1.5,1.5);for(let y=0;y<4;y++)for(let x=0;x<4;x++){const px=(x-y)*18,py=(x+y)*9;poly(c,[[px,py],[px+18,py+9],[px,py+18],[px-18,py+9]],(options.tone==='warm'?['#bda989','#d5c6a6']:options.tone==='garden'?['#739887','#91b39c']:['#78999d','#89abad'])[(x+y)%2],'#517780');}decor(c,{...item,x:1,y:1,z:0,rotation:item.rotation||0},0,18);c.restore();}
 window.EarnlyWorldRenderer={WorldRenderer,thumbnail,roomThumbnail,decorPreview};
})();
