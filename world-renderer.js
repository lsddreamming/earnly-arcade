/* Original Earnly isometric canvas art. No external sprite packs. */
(()=>{
 const images=new Map(),sprites=new Map(),reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
 function image(src){if(!/^cosmetic-[a-z0-9-]+\.svg$/.test(src))return null;if(!images.has(src)){const i=new Image();i.src=src;images.set(src,i);}return images.get(src);}
 function poly(c,points,color,stroke){if(c.__capture){c.__face(points.map(p=>c.__convert(p)),color,true);return;}c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}}
 function shade(hex,n){const rgb=String(hex).match(/^rgb\((\d+),(\d+),(\d+)\)$/),v=parseInt((hex||'#78bed1').slice(1),16),channels=rgb?rgb.slice(1).map(Number):[v>>16,(v>>8)&255,v&255];return 'rgb('+channels.map(c=>Math.max(0,Math.min(255,c+n))).join(',')+')';}
 function box(c,x,y,w,l,h,color){const a=[x,y-h],b=[x+w*18,y+w*9-h],d=[x-l*18,y+l*9-h],e=[x+(w-l)*18,y+(w+l)*9-h];poly(c,[a,b,e,d],shade(color,22),'#172333');poly(c,[d,e,[e[0],e[1]+h],[d[0],d[1]+h]],shade(color,-24),'#172333');poly(c,[b,e,[e[0],e[1]+h],[b[0],b[1]+h]],color,'#172333');
  // Fine bevels preserve the chunky silhouette while separating material planes.
  if(w>.25&&l>.25&&h>2){c.beginPath();c.moveTo(d[0]+1,d[1]-.5);c.lineTo(e[0],e[1]-1);c.lineTo(b[0]-1,b[1]-.5);c.strokeStyle=shade(color,48);c.lineWidth=.55;c.stroke();
   c.beginPath();c.moveTo(e[0],e[1]+1);c.lineTo(e[0],e[1]+h-1);c.strokeStyle=shade(color,-42);c.lineWidth=.6;c.stroke();}
 }
 // Small, original pixel-scale details stay legible both in rooms and the catalog.

 // BSP ordering clips intersecting planes so backrests correctly hide cushions.
 const furnitureFaces=new Map();
 function orderFaces(faces){
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const make=f=>{const [a,b,c]=f.p,u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n);if(len<1e-8)return null;return {n:n.map(x=>x/len),d:dot(n,a)/len,faces:[f],front:null,back:null};};
  const insert=(node,f)=>{if(!node)return make(f);const ds=f.p.map(p=>dot(node.n,p)-node.d),front=ds.some(d=>d>1e-5),back=ds.some(d=>d< -1e-5);if(!front&&!back){node.faces.push(f);return node;}if(!back){node.front=insert(node.front,f);return node;}if(!front){node.back=insert(node.back,f);return node;}
   const a=[],b=[];for(let i=0;i<f.p.length;i++){const p=f.p[i],q=f.p[(i+1)%f.p.length],d=ds[i],e=ds[(i+1)%ds.length];if(d>=-1e-5)a.push(p);if(d<=1e-5)b.push(p);if(d*e<0&&Math.abs(d)>1e-5&&Math.abs(e)>1e-5){const t=d/(d-e),cut=p.map((v,j)=>v+(q[j]-v)*t);a.push(cut);b.push(cut);}}
   if(a.length>=3)node.front=insert(node.front,{...f,p:a,cut:true});if(b.length>=3)node.back=insert(node.back,{...f,p:b,cut:true});return node;};
  let root=null;for(const f of faces)root=insert(root,f);const ordered=[];const walk=n=>{if(!n)return;const front=dot(n.n,[1,1,18])>=0;walk(front?n.back:n.front);ordered.push(...n.faces);walk(front?n.front:n.back);};walk(root);return ordered;
 }
 const furnitureDepth=i=>i.x+i.y+(i.width+i.length)/2+(i.centered?1:0)+(i.z||0)*.01-(i.walkable&&i.itemHeight<=.5?10000:0);
 // Furniture is built in tile coordinates so all four orientations have real backs.
 function solidDecor(c,item,x,y){
  const id=item.definitionId||item.definition_id||item.id;
  const aliases={'boardwalk-sofa':'boardwalk-seat','boardwalk-lamp':'boardwalk-light','boardwalk-table':'boardwalk-table','rose-sofa':'rose-chaise','ruby-sofa':'ruby-tufted','sunset-sofa':'sunset-futon','sage-chair':'sage-slatted','amber-lantern':'amber-hanging','walnut-table':'walnut-nesting','blossom-tree':'blossom-boughs','boardwalk-rug':'sunset-woven-rug','lavender-rug':'lavender-mosaic-rug'};
  const s=aliases[id]||item.sprite||item.sprite_id,color=item.color||'#81c8c4';
  const key=JSON.stringify([s,color,item.width,item.length,item.rotation||0]);
  const paint=art=>{c.drawImage(art.canvas,x+art.left,y+art.top,art.width,art.height);return true;};
  if(furnitureFaces.has(key))return paint(furnitureFaces.get(key));
  const beds=['cabin-bed','velvet-bed','bunk-bed','poster-bed','round-bed','capsule-bed','racer-bed','platform-bed'];

  const defaults={sofa:[2,1],bed:[1,2],rug:[2,2],divider:[2,1],'diner-booth':[2,1],'pod-bed':[1,2]};
  const w=item.width||defaults[s]?.[0]||1,l=item.length||defaults[s]?.[1]||1,r=((item.rotation||0)%8+8)%8,faces=[];
  const turn=(u,v,z)=>r===2?[l-v,u,z]:r===4?[w-u,l-v,z]:r===6?[v,w-u,z]:[u,v,z];
  const face=(vertices,tint,doubleSided=false)=>{const p=vertices.map(q=>turn(...q));const a=p[0],b=p[1],d=p[2];const normal=[(b[1]-a[1])*(d[2]-a[2])-(b[2]-a[2])*(d[1]-a[1]),(b[2]-a[2])*(d[0]-a[0])-(b[0]-a[0])*(d[2]-a[2]),(b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0])];
   if(!doubleSided&&normal[0]+normal[1]+normal[2]*18<=0)return;
   faces.push({p,tint:doubleSided?tint:shade(tint,normal[2]>0?22:normal[0]>0?0:-22),depth:p.reduce((n,q)=>n+q[0]+q[1]+q[2]/18,0)/p.length});};
  const block=(u,v,a,b,h,z,tint)=>{face([[u,v,z+h],[u+a,v,z+h],[u+a,v+b,z+h],[u,v+b,z+h]],tint);face([[u,v,z],[u+a,v,z],[u+a,v,z+h],[u,v,z+h]],tint);face([[u+a,v+b,z],[u,v+b,z],[u,v+b,z+h],[u+a,v+b,z+h]],tint);face([[u,v+b,z],[u,v,z],[u,v,z+h],[u,v+b,z+h]],tint);face([[u+a,v,z],[u+a,v+b,z],[u+a,v+b,z+h],[u+a,v,z+h]],tint);};
  // Fine material marks are real surfaces: they rotate and occlude with the furniture.
  // Keep their edges unoutlined so small fabric/leaf details do not become black grids.
  const detail=(p,tint)=>{const start=faces.length;face(p,tint,true);for(let i=start;i<faces.length;i++)faces[i].detail=true;};
  const ribbon=(a,b,tint,width=.018)=>{const dx=b[0]-a[0],dy=b[1]-a[1],n=Math.hypot(dx,dy);if(n<.0001){detail([[a[0]-width,a[1],a[2]],[a[0]+width,a[1],a[2]],[b[0]+width,b[1],b[2]],[b[0]-width,b[1],b[2]]],tint);return;}const ox=-dy/n*width,oy=dx/n*width;detail([[a[0]+ox,a[1]+oy,a[2]],[b[0]+ox,b[1]+oy,b[2]],[b[0]-ox,b[1]-oy,b[2]],[a[0]-ox,a[1]-oy,a[2]]],tint);};
  const fabric=(u,v,a,d,z,tint)=>{for(const x of [u+.03,u+a-.03])ribbon([x,v+.04,z],[x,v+d-.04,z],shade(tint,30),.008);for(const y of [v+.04,v+d-.04])ribbon([u+.03,y,z],[u+a-.03,y,z],shade(tint,-22),.008);for(let j=0;j<3;j++){const x=u+a*(.24+j*.25);ribbon([x,v+d-.06,z+.01],[x+.045,v+d-.27,z+.01],shade(tint,16),.012);}};
  const foliage=(u,v,z,du,dv,lift,tint=color)=>{const tip=[u+du,v+dv,z+lift],mid=[u+du*.48,v+dv*.48,z+lift*.68+2],n=Math.hypot(du,dv)||1,ox=-dv/n*.095,oy=du/n*.095;detail([[u,v,z],[mid[0]+ox,mid[1]+oy,mid[2]],tip],shade(tint,18));detail([[u,v,z],tip,[mid[0]-ox,mid[1]-oy,mid[2]]],shade(tint,-12));ribbon([u,v,z+.12],tip,shade(tint,36),.008);};
  const mattress=(z=9,width=w)=>{block(.08,.18,width-.16,1.72,7,z,'#eee8dc');block(.09,.78,width-.18,1.1,3,z+7,color);block(.09,.77,width-.18,.16,1,z+10,shade(color,35));fabric(.09,.78,width-.18,1.1,z+10.04,color);for(let u=.14;u<width-.25;u+=.87){const a=Math.min(.65,width-.28);block(u,.27,a,.36,4,z+7,'#fff3db');fabric(u,.27,a,.36,z+11.04,'#fff3db');}ribbon([.085,.2,z+2],[.085,1.87,z+2],'#d2cabb',.009);};
  // Original themed furniture, built as volumes for correct front/back rotation.
  const themeModel=s.startsWith('theme-')?s.slice(6):null;
  const cylinder=(u,v,r,z,h,tint,n=12)=>{const top=[];for(let j=0;j<n;j++){const a=j*Math.PI*2/n,b=(j+1)*Math.PI*2/n,p=[u+Math.cos(a)*r,v+Math.sin(a)*r],q=[u+Math.cos(b)*r,v+Math.sin(b)*r];top.push([...p,z+h]);face([[...p,z],[...q,z],[...q,z+h],[...p,z+h]],tint);}face(top,tint);};
  const gem=(u,v,z,r,h,tint)=>{for(let j=0;j<6;j++){const a=j*Math.PI/3,b=(j+1)*Math.PI/3,p=[u+Math.cos(a)*r,v+Math.sin(a)*r,z+h*.4],q=[u+Math.cos(b)*r,v+Math.sin(b)*r,z+h*.4];face([[u,v,z+h],p,q],shade(tint,j%2?18:-8),true);face([[u,v,z],q,p],shade(tint,-24),true);}};
  const ring=(u,v,r,z,tint)=>{for(let j=0;j<24;j++){const a=j*Math.PI/12,b=(j+1)*Math.PI/12;ribbon([u+Math.cos(a)*r,v+Math.sin(a)*r,z],[u+Math.cos(b)*r,v+Math.sin(b)*r,z],tint,.015);}};
  if(s==='pet-toy-dog'||s==='pet-toy-cat'){
   cylinder(.5,.5,.4,0,.6,shade(color,-35),24);
   const point=(a,b)=>[.5+Math.cos(a)*Math.sin(b)*.19,.5+Math.sin(a)*Math.sin(b)*.19,4.8+Math.cos(b)*4];
   for(let j=0;j<16;j++)for(let k=0;k<8;k++){const a=j*Math.PI/8,b=k*Math.PI/8;face([point(a,b),point(a+Math.PI/8,b),point(a+Math.PI/8,b+Math.PI/8),point(a,b+Math.PI/8)],shade(color,Math.cos(a)*12+Math.cos(b)*18),true);}
   for(const b of [Math.PI*.3,Math.PI*.5,Math.PI*.7])for(let j=0;j<32;j++)ribbon(point(j*Math.PI/16,b),point((j+1)*Math.PI/16,b),s==='pet-toy-cat'?'#f1c6d7':'#eaf3cd',.009);
   if(s==='pet-toy-cat'){ribbon([.64,.6,1],[.81,.72,.8],color,.02);ribbon([.81,.72,.8],[.6,.83,.8],color,.02);}
  }else if(s==='vip-throne'){
   const gold='#d9b76e',dark='#493563';
   for(const u of [.12,.78])for(const v of [.14,.76])block(u,v,.12,.12,7,0,gold);
   block(.04,.06,.92,.88,7,6,dark);block(.07,.08,.86,.83,1,12,gold);
   block(.08,.05,.84,.18,38,12,gold);block(.16,.24,.68,.035,29,16,dark);
   for(let row=0;row<3;row++)for(let col=0;col<3;col++){const u=.19+col*.21,z=19+row*8;block(u,.28,.18,.055,6,z,shade(color,col%2?8:-4));gem(u+.09,.34,z+2,.025,2,'#ffe6ab');}
   block(.16,.32,.68,.55,5,13,color);fabric(.16,.32,.68,.55,18.05,color);
   for(const u of [.02,.85]){block(u,.15,.13,.76,12,12,gold);block(u+.02,.23,.09,.6,2,24,dark);gem(u+.065,.19,24,.075,7,'#a4f7e5');}
   for(const v of [.04,.24])detail([[.08,v,50],[.18,v,56],[.34,v,52],[.5,v,61],[.66,v,52],[.82,v,56],[.92,v,50]],gold);
   gem(.5,.27,49,.09,7,'#9df3df');ribbon([.12,.95,10],[.88,.95,10],'#9cf6e2',.018);
   for(const u of [.12,.8])block(u,.03,.06,.02,29,17,dark);
  }else if(s==='vip-fountain'){
   cylinder(.5,.5,.49,0,5,'#493e68');cylinder(.5,.5,.46,5,2,'#e5c789');cylinder(.5,.5,.41,7,4,'#766296');cylinder(.5,.5,.35,11,1,'#65cbc8');ring(.5,.5,.38,12,'#e7d49b');
   gem(.5,.5,16,.23,35,color);
   for(let j=0;j<4;j++){const a=j*Math.PI/2,u=.5+Math.cos(a)*.28,v=.5+Math.sin(a)*.28;gem(u,v,12,.08,10,'#c4aff2');let last=[.5,.5,31];for(let k=1;k<=8;k++){const t=k/8,p=[.5+Math.cos(a)*.31*t,.5+Math.sin(a)*.31*t,31+12*t-31*t*t];ribbon(last,p,'#c5fff0',.016);last=p;}}
   for(const z of [24,37])ring(.5,.5,.43,z,'#e3c68e');
   for(const [u,v]of [[.24,.3],[.72,.65]])ring(u,v,.06,12.2,'#e3fff4');
  }else if(s==='vip-bloom'){
   block(.06,.06,.88,.88,6,0,'#514269');block(.02,.02,.96,.96,2,6,'#dfbf7d');block(.12,.12,.76,.76,3,8,'#667568');
   for(const u of [.08,.89])for(const v of [.08,.89]){block(u,v,.035,.035,38,8,'#b7ddcc');gem(u+.017,v+.017,46,.04,3,'#edce87');}
   for(const v of [.1,.9]){ribbon([.1,v,46],[.5,v,56],'#e6ca8a',.025);ribbon([.5,v,56],[.9,v,46],'#e6ca8a',.025);}
   ribbon([.5,.1,56],[.5,.9,56],'#e6ca8a',.025);
   for(const [u,v,z]of [[.3,.32,29],[.68,.38,34],[.48,.68,41]]){ribbon([.5,.5,11],[u,v,z],'#8bcdb0',.025);foliage(u,v,z-9,.22,.05,3,'#83c7ab');foliage(u,v,z-15,-.18,.1,4,'#9ed9ba');for(let j=0;j<6;j++){const a=j*Math.PI/3,b=a+.7;detail([[u,v,z],[u+Math.cos(a)*.24,v+Math.sin(a)*.24,z+4],[u+Math.cos(b)*.22,v+Math.sin(b)*.22,z+5]],shade(color,j%2?30:4));}gem(u,v,z,.045,4,'#ffe4a2');}
   for(const v of [.09,.92]){detail([[.1,v,10],[.9,v,10],[.9,v,46],[.1,v,46]],'#c8ffef12');ribbon([.16,v,37],[.28,v,42],'#ddfff680',.018);}
  }else if(s==='show-racer'){
   block(.03,.05,.94,1.9,4,0,'#293d56');block(.08,.06,.84,.48,28,4,color);block(.15,.55,.7,.06,17,17,'#172839');block(.2,.615,.6,.01,11,20,'#7ad7e2');
   for(let j=0;j<3;j++)ribbon([.35+j*.15,.63,21],[.41+j*.09,.63,30],'#f5dc8f',.012);
   block(.12,.64,.76,.22,3,16,'#d5dce0');cylinder(.5,.76,.13,19,2,'#263747');block(.2,1.3,.6,.5,6,5,color);block(.2,1.73,.6,.12,19,7,color);fabric(.2,1.3,.6,.5,11.05,color);
   for(const u of [.04,.9])ribbon([u,.1,4.1],[u,1.88,4.1],'#8ef5e2',.02);
  }else if(s==='show-airhockey'){
   for(const u of [.15,.78])for(const v of [.16,1.7])block(u,v,.09,.12,16,0,'#34465d');block(0,0,1,2,5,16,color);block(.08,.08,.84,1.84,1,21,'#e4eee2');
   for(const u of [0,.94])block(u,0,.06,2,3,21,'#516b89');for(const v of [0,1.94])block(0,v,1,.06,3,21,'#516b89');ribbon([.08,1,22.1],[.92,1,22.1],'#d17a88',.014);ring(.5,1,.23,22.1,'#d17a88');
   for(const [u,v,t]of [[.33,.4,'#df8f9e'],[.68,1.6,'#78bfc9']]){cylinder(u,v,.1,22,1,t);cylinder(u,v,.04,23,3,t);}cylinder(.6,.85,.06,22,1,'#3d4e65');
  }else if(s==='show-ticket'){
   block(.08,.12,.84,.76,36,2,color);block(.03,.08,.94,.84,4,38,'#f0d69b');block(.18,.89,.64,.02,15,20,'#20374e');for(let j=0;j<4;j++)block(.23+j*.14,.92,.08,.02,6,24,'#a3f1ce');block(.24,.9,.52,.04,3,11,'#20374e');
   detail([[.37,.95,13],[.63,.95,13],[.63,1.08,7],[.37,1.08,7]],'#fff0cb');for(const z of [8,10])ribbon([.4,1.08,z],[.6,1.08,z],'#b27a67',.008);for(const u of [.14,.78])block(u,.13,.07,.7,2,3,'#3e5469');
  }else if(s==='show-gumball'){
   cylinder(.5,.5,.36,0,4,'#3f5068');cylinder(.5,.5,.25,4,15,color);cylinder(.5,.5,.38,19,3,'#e4c487');
   for(let j=0;j<15;j++){const a=j*2.4,r=.12+(j%3)*.07;gem(.5+Math.cos(a)*r,.5+Math.sin(a)*r,23+Math.floor(j/5)*5,.085,5,['#e99dbb','#9ce0ca','#e7cf86'][j%3]);}
   for(let j=0;j<12;j++){const a=j*Math.PI/6,b=(j+1)*Math.PI/6;detail([[.5+Math.cos(a)*.33,.5+Math.sin(a)*.33,22],[.5+Math.cos(b)*.33,.5+Math.sin(b)*.33,22],[.5+Math.cos(b)*.29,.5+Math.sin(b)*.29,40],[.5+Math.cos(a)*.29,.5+Math.sin(a)*.29,40]],'#b5f3f620');}cylinder(.5,.5,.3,40,3,color);gem(.5,.5,43,.07,4,'#e4c487');block(.4,.76,.2,.04,5,9,'#263b4d');block(.47,.81,.06,.03,2,14,'#e4c487');
  }else if(s==='show-meteor'){
   block(.08,.08,.84,.84,4,0,'#34475c');block(.16,.16,.68,.68,13,4,color);block(.1,.1,.8,.8,2,17,'#e0ca91');gem(.5,.5,20,.3,24,'#76d7ce');for(let j=0;j<3;j++)gem(.25+j*.23,.65,19,.08,8,'#bd9de0');block(.34,.85,.32,.02,3,8,'#f0d8a4');
  }else if(s==='show-aquarium'){
   block(.02,.05,1.96,.9,5,0,'#344b5b');block(.08,.12,1.84,.76,11,5,color);block(0,0,2,1,3,16,'#d7c494');block(.08,.08,1.84,.84,2,19,'#bdba8f');
   for(const u of [.25,1.65])for(let j=0;j<3;j++)foliage(u,.4,21,Math.cos(j*2)*.18,Math.sin(j*2)*.18,12+j*3,'#6db49c');
   for(const [u,v,z,t]of [[.65,.6,32,'#f1bf79'],[1.3,.45,37,'#d8ade5']]){gem(u,v,z,.13,4,t);detail([[u+.1,v,z+2],[u+.3,v,z+5],[u+.3,v,z-1]],t);}
   for(const v of [.05,.95])detail([[.05,v,20],[1.95,v,20],[1.95,v,46],[.05,v,46]],'#8ddbe32a');for(const u of [.05,1.95])detail([[u,.05,20],[u,.95,20],[u,.95,46],[u,.05,46]],'#8ddbe320');block(0,0,2,1,3,46,'#344b5b');ribbon([.25,.96,28],[.6,.96,42],'#d6fff880',.022);
  }else if(s==='show-orrery'){
   cylinder(.5,.5,.4,0,4,'#3e4868');cylinder(.5,.5,.28,4,12,color);cylinder(.5,.5,.43,16,3,'#dbc28b');block(.47,.47,.06,.06,24,19,'#dbc28b');gem(.5,.5,34,.17,12,'#efcd7e');
   for(const [r,z]of [[.26,28],[.44,24]])ring(.5,.5,r,z,'#e2cc98');for(const [u,v,z,t]of [[.24,.5,27,'#a4d8dd'],[.5,.94,23,'#c9abe5'],[.85,.23,23,'#da9b8f']])gem(u,v,z,.07,6,t);
  }else if(s==='show-gallery'){
   block(.04,.1,1.92,.8,5,0,'#3d4d63');for(const u of [.1,1.85])block(u,.15,.05,.7,40,5,'#d5ba83');for(const z of [5,22,43])block(.08,.15,1.84,.7,2,z,color);
   gem(.48,.45,25,.16,15,'#98e1d4');gem(1.35,.45,25,.14,12,'#c7ace8');cylinder(.5,.48,.19,7,3,'#d9bd80');cylinder(1.4,.48,.19,7,9,'#c3d2d8');
   for(const v of [.16,.86])detail([[.12,v,7],[1.88,v,7],[1.88,v,43],[.12,v,43]],'#bde9ea12');for(const u of [.4,1.25])block(u,.88,.3,.01,2,20,'#e5d3a5');
  }else
  if(s==='rose-chaise'){
   for(const u of [.12,1.75])for(const v of [.15,.75])block(u,v,.12,.12,6,0,'#b3916e');block(.05,.1,1.9,.85,8,6,color);block(.05,.1,.2,.85,22,6,color);block(.05,.1,1.4,.12,18,6,color);block(.35,.25,.45,.5,5,14,'#f2dbd3');
  }else if(s==='ruby-tufted'){
   block(.05,.05,1.9,.15,28,4,color);block(.05,.2,1.9,.75,8,8,color);for(const u of [.02,1.76])block(u,.1,.22,.85,18,5,color);for(let u=.32;u<1.8;u+=.32)for(const z of [18,25])block(u,.21,.05,.03,2,z,'#e0bd8d');for(const u of [.12,1.76])for(const v of [.12,.8])block(u,v,.12,.12,5,0,'#94734e');
  }else if(s==='sunset-futon'){
   block(.05,.05,1.9,.9,4,4,'#66594d');for(const u of [.05,1.85])block(u,.05,.1,.9,5,0,'#66594d');block(.12,.4,1.76,.55,5,8,color);block(.12,.05,1.76,.18,20,8,color);for(let u=.25;u<1.8;u+=.3)block(u,.24,.025,.02,16,10,'#ead5af');
  }else if(s==='sage-slatted'){
   for(const u of [.12,.8])for(const v of [.12,.8])block(u,v,.08,.08,13,0,'#735f4a');for(let v=.15;v<.9;v+=.15)block(.1,v,.8,.1,3,13,color);for(const u of [.1,.82])block(u,.12,.08,.08,31,0,'#735f4a');for(const z of [20,27])block(.1,.12,.8,.1,4,z,color);
  }else if(s==='amber-hanging'){
   block(.15,.15,.7,.7,3,0,'#57616a');block(.1,.15,.08,.08,46,0,'#57616a');block(.1,.15,.65,.08,3,46,'#57616a');block(.68,.15,.04,.04,9,37,'#57616a');block(.45,.08,.5,.5,15,21,color);for(const u of [.45,.9])for(const v of [.08,.53])block(u,v,.05,.05,19,19,'#57616a');block(.43,.06,.54,.54,2,38,'#57616a');
  }else if(s==='walnut-nesting'){
   for(const [u,v,a,z]of [[0,0,.7,18],[.42,.4,.58,11]]){for(const x of [u,u+a-.07])for(const y of [v,v+a-.07])block(x,y,.07,.07,z,0,'#5b4d45');block(u,v,a,a,3,z,color);}
  }else if(s==='blossom-boughs'){
   block(.2,.2,.6,.6,8,0,'#ba9876');block(.17,.17,.66,.66,2,8,'#d5b18c');block(.45,.45,.1,.1,27,8,'#89654c');
   // Overlapping rounded blossom clusters restore the fluffy canopy from every side.
   const puff=(u,v,z,r,h,tint)=>{const at=(a,b)=>[u+Math.cos(a)*Math.sin(b)*r,v+Math.sin(a)*Math.sin(b)*r,z+Math.cos(b)*h];for(let j=0;j<6;j++)for(let k=0;k<12;k++){const a=k*Math.PI/6,b=j*Math.PI/6;const points=j===0?[at(a,b),at(a,b+Math.PI/6),at(a+Math.PI/6,b+Math.PI/6)]:j===5?[at(a,b),at(a,b+Math.PI/6),at(a+Math.PI/6,b)]:[at(a,b),at(a,b+Math.PI/6),at(a+Math.PI/6,b+Math.PI/6),at(a+Math.PI/6,b)];detail(points,shade(tint,Math.round(Math.cos(b+.26)*13+Math.cos(a+.26)*5)));}};
   for(const [u,v,z,r,h,tint]of [[.2,.2,34,.4,10,-16],[.8,.22,36,.42,11,-6],[.5,.48,45,.46,12,12],[.18,.72,36,.43,11,0],[.75,.75,38,.44,11,20]])puff(u,v,z,r,h,shade(color,tint));
  }else if(s==='sunset-woven-rug'||s==='lavender-mosaic-rug'){
   block(.02,.02,1.96,1.96,1,0,color);if(s==='sunset-woven-rug'){for(let j=0;j<8;j++)block(.08,.08+j*.23,1.84,.1,.3,1,j%2?'#e8cba3':'#ac7868');for(let j=0;j<10;j++){block(.05+j*.19,0,.08,.1,.5,.4,'#e6d5b5');block(.05+j*.19,1.9,.08,.1,.5,.4,'#e6d5b5');}}else{for(let u=0;u<4;u++)for(let v=0;v<4;v++)if((u+v)%2===0)block(.08+u*.46,.08+v*.46,.38,.38,.3,1,'#ddd5ef');}
  }else
  if(themeModel){
   const b=block,wood='#916747',metal='#46515d',cream='#eee0c9';
   const legs=(a=w,d=l,h=18)=>{for(const u of [.1,a-.18])for(const v of [.1,d-.18])b(u,v,.08,.08,h,0,wood);};
   const top=(z=18,a=w,d=l)=>{legs(a,d,z);b(0,0,a,d,3,z,color);};
   const pot=(u=.25,v=.25,z=0)=>{b(u,v,.5,.5,7,z,'#ae7e59');b(u+.04,v+.04,.42,.42,1,z+7,'#574c3c');};
   const leaf=(u,v,z,a=.5,d=.3)=>face([[u,v,z],[u+a*.45,v-d,z+7],[u+a,v,z+3],[u+a*.45,v+d,z-2]],color,true);
   const round=(u,v,r,z,h,tint)=>{const pts=[];for(let j=0;j<16;j++){const a=j*Math.PI/8,q=(j+1)*Math.PI/8,p=[u+Math.cos(a)*r,v+Math.sin(a)*r],t=[u+Math.cos(q)*r,v+Math.sin(q)*r];pts.push([...p,z+h]);face([[...p,z],[...t,z],[...t,z+h],[...p,z+h]],tint);}face(pts,tint);};
   switch(themeModel){
    case 'seat': for(const u of [.05,.8])b(u,.08,.15,.85,22,0,wood);b(.1,.1,.8,.16,35,0,wood);b(.15,.28,.65,.65,6,12,color);for(let u=.05;u<1;u+=.2)leaf(u,.13,32,.3,.18);break;
    case 'arch':for(const u of [.05,1.7]){b(u,.15,.25,.7,43,0,wood);for(let z=9;z<44;z+=9)leaf(u,.4,z,.4,.2);}b(.05,.2,1.9,.3,5,43,wood);for(let u=.2;u<1.9;u+=.25)leaf(u,.4,46,.3,.2);break;
    case 'waterfall':b(0,0,2,1,6,0,color);for(let k=0;k<4;k++)b(k*.45,.05,.48,.3,28+k%2*8,6,'#7e9186');b(.5,.37,.8,.1,29,6,'#8ed9d6');b(.1,.45,1.8,.5,1,6,'#73b8bd');for(let k=0;k<5;k++)b(.58+k*.14,.48,.04,.02,26,7,'#d7f5e6');break;
    case 'fern':pot();for(let j=0;j<8;j++){const a=j*Math.PI/4,du=Math.cos(a)*.5,dv=Math.sin(a)*.5;for(let k=1;k<5;k++){const t=k/5,u=.5+du*t,v=.5+dv*t,z=12+Math.sin(t*Math.PI)*9;for(const side of [-1,1])foliage(u,v,z,du*.16-dv*.32*side,dv*.16+du*.32*side,2,shade(color,j%2?8:-8));}ribbon([.5,.5,11],[.5+du,.5+dv,15],shade(color,28),.014);}break;
    case 'orchid':pot();ribbon([.48,.48,8],[.46,.48,34],'#65825a',.026);ribbon([.46,.48,34],[.76,.48,42],'#65825a',.025);for(let j=0;j<4;j++)foliage(.5,.5,10,Math.cos(j*1.6)*.4,Math.sin(j*1.6)*.4,6);for(let k=0;k<4;k++){const u=.28+k*.15,z=25+k*5;for(let j=0;j<5;j++){const a=j*Math.PI*2/5;detail([[u,.5,z],[u+Math.cos(a)*.13,.5,z+Math.sin(a)*3.5],[u+Math.cos(a+.9)*.13,.5,z+Math.sin(a+.9)*3.5]],j%2?'#f3bedc':'#cb82b3');}b(u-.025,.51,.05,.025,1,z,'#f6d79b');}break;
    case 'banana':pot(.2,.2);b(.4,.4,.14,.14,29,7,'#a9aa68');for(let j=0;j<7;j++){const a=j*Math.PI*2/7;foliage(.47,.47,34,Math.cos(a)*.65,Math.sin(a)*.6,j%2?1:9,shade(color,j%3*8));}for(let k=0;k<5;k++){const u=.6+k*.045;b(u,.6,.045,.08,7,21+k%2,'#efcb70');b(u,.6,.045,.045,1,28+k%2,'#8d7540');}break;
    case 'bridge':for(let j=0;j<8;j++)b(j*.25,.08,.22,.84,3,5+Math.abs(j-3.5),color);for(const u of [0,1.9])for(const v of [.05,.9])b(u,v,.09,.09,29,0,wood);for(const v of [.08,.9])for(let j=0;j<8;j++)b(j*.25,v,.26,.03,1,22+Math.abs(j-3.5),'#e1c99d');break;
    case 'trunk':b(.08,.08,.84,.84,18,0,color);b(.05,.05,.9,.9,4,18,wood);for(const u of [.2,.7])b(u,.04,.08,.92,1,22,'#d4b773');b(.44,.94,.12,.03,5,13,'#e5bf79');break;
    case 'mask':b(.38,.4,.24,.2,43,0,wood);b(.15,.2,.7,.2,27,16,color);for(const u of [.24,.62])b(u,.42,.14,.04,5,32,'#e7d3a0');b(.43,.44,.14,.12,9,24,'#b87552');b(.3,.44,.4,.03,3,20,cream);break;
    case 'nest':b(.08,.08,.84,.84,4,0,wood);b(.45,.1,.1,.1,48,0,wood);b(.45,.1,.1,.5,3,48,wood);round(.5,.55,.37,12,5,color);for(let j=0;j<9;j++){const a=Math.PI+j*Math.PI/8,u=.5+Math.cos(a)*.38,v=.55+Math.sin(a)*.38;b(u,v,.035,.035,16+10*Math.sin(j*Math.PI/8),17,wood);}b(.48,.5,.035,.035,13,35,wood);break;
    case 'daybed':b(.05,.05,.9,1.9,8,0,wood);b(.1,.1,.8,1.8,7,8,color);for(let v=.2;v<1.8;v+=.3)leaf(.05,v,16,.9,.18);b(.15,.15,.7,.4,4,16,cream);break;
    case 'fan':b(.2,.35,1.6,.3,5,0,wood);for(let j=0;j<9;j++){const u=.1+j*.21;b(u,.42,.06,.07,18+22*Math.sin(j*Math.PI/8),5,color);}b(.1,.44,1.8,.08,3,17,wood);break;
    case 'terrarium':b(.05,.05,.9,.9,5,0,wood);for(const u of [.08,.86])for(const v of [.08,.86])b(u,v,.05,.05,32,5,metal);face([[.1,.1,37],[.5,.1,47],[.9,.1,37]],'#b6d2c3',true);face([[.1,.1,37],[.5,.1,47],[.5,.9,47],[.1,.9,37]],'#b6d2c3',true);face([[.5,.1,47],[.9,.1,37],[.9,.9,37],[.5,.9,47]],'#a1c1b7',true);b(.1,.1,.8,.8,2,5,'#658b64');pot(.2,.3,7);leaf(.1,.5,20,.7,.23);break;
    case 'idol':b(.1,.1,.8,.8,5,0,'#687d75');b(.22,.25,.56,.5,20,5,'#82958a');b(.13,.2,.74,.6,13,25,color);for(const u of [.22,.64])b(u,.82,.12,.03,3,33,'#294b45');b(.43,.82,.14,.09,6,26,wood);break;
    case 'fire':for(let j=0;j<8;j++){const a=j*Math.PI/4;b(.45+Math.cos(a)*.4,.45+Math.sin(a)*.4,.14,.14,3+j%2,0,shade(color,-25+j%3*10));}for(const v of [.25,.61]){b(.13,v,.74,.14,5,2,wood);ribbon([.16,v+.15,4],[.84,v+.15,4],'#c19362',.012);}for(const u of [.22,.43,.63]){face([[u,.5,5],[u-.03,.5,12],[u+.1,.5,25-u*8],[u+.16,.5,14],[u+.22,.5,7]],'#e8984f',true);detail([[u+.04,.505,6],[u+.1,.505,18-u*5],[u+.16,.505,7]],'#ffe7a0');}break;
    case 'fruit':top(17);for(const u of [.15,1.6])round(u,.88,.16,0,5,metal);for(let u=.15;u<1.9;u+=.3)for(const v of [.25,.65])b(u,v,.22,.22,5,21,u<1?'#dbb85d':'#cc8566');b(.05,.05,1.9,.08,10,20,wood);break;
    case 'rocker':for(const u of [.08,.84])b(u,0,.08,1,3,0,wood);legs(1,1,13);b(.08,.15,.84,.75,4,13,color);for(let u=.12;u<.9;u+=.18)b(u,.12,.05,.08,25,14,wood);b(.08,.12,.84,.1,3,39,wood);break;
    case 'logbench':for(const u of [.2,1.5])b(u,.2,.25,.6,10,0,'#72523e');b(.02,.08,1.96,.84,11,10,color);for(let u=.2;u<1.9;u+=.25)b(u,.1,.03,.8,.5,21,'#d6b687');break;
    case 'trestle':for(const u of [.3,1.5]){b(u,0,.18,1,3,0,wood);b(u,.35,.18,.3,19,3,wood);}b(.3,.4,1.4,.12,4,8,wood);b(0,0,2,1,4,22,color);for(let v=.15;v<1;v+=.22)b(0,v,2,.02,.2,26,cream);break;
    case 'rolltop':top(20);for(const u of [0,1.6])b(u,.05,.4,.8,18,2,wood);for(let j=0;j<6;j++)b(.4,.05+j*.07,1.2,.07,3,35-j*2,color);b(.55,.65,.5,.25,1,24,cream);break;
    case 'stove':legs(1,1,6);b(.15,.15,.7,.7,24,6,color);b(.4,.25,.2,.2,20,30,metal);b(.25,.87,.5,.03,13,12,'#e8a35e');for(let u=.3;u<.7;u+=.1)b(u,.91,.04,.02,13,12,metal);break;
    case 'woodpile':for(const u of [.05,.86])b(u,.05,.07,.9,27,0,metal);for(let j=0;j<3;j++)for(let k=0;k<3-j;k++)b(.15+k*.24+j*.1,.12,.2,.75,7,j*8,color);break;
    case 'barrel':round(.5,.5,.43,0,29,color);for(const z of [4,23])round(.5,.5,.45,z,3,metal);for(let u=.2;u<.85;u+=.15)b(u,.1,.02,.8,.5,29,wood);break;
    case 'canoe':face([[.05,.4,5],[.05,.4,35],[.5,.4,53],[.95,.4,35],[.95,.4,5]],wood,true);for(const z of [8,21,34])b(.12,.4,.76,.4,2,z,color);for(let j=0;j<4;j++)b(.2+j*.14,.55,.1,.2,9,10,j%2?cream:'#7896a1');break;
    case 'coat':b(.08,.08,.84,.84,3,0,wood);b(.46,.46,.08,.08,44,3,color);for(const z of [25,36]){b(.1,.45,.8,.08,3,z,wood);for(const u of [.1,.82])b(u,.45,.08,.08,6,z,wood);}break;
    case 'ladder':for(const u of [.15,.8])b(u,.3,.06,.16,43,0,wood);for(const z of [9,19,29,39])b(.15,.3,.7,.12,2,z,wood);b(.25,.38,.5,.05,18,16,color);for(let u=.3;u<.75;u+=.1)b(u,.44,.03,.02,17,16,cream);break;
    case 'tripod':for(const [u,v]of [[.15,.2],[.75,.2],[.45,.75]])b(u,v,.1,.1,18,0,wood);round(.5,.5,.42,18,4,color);break;
    case 'tub':b(.05,.05,1.9,.9,5,0,wood);for(const v of [.05,.8])b(.05,v,1.9,.15,19,5,color);for(const u of [.05,1.8])b(u,.05,.15,.9,19,5,color);b(.2,.2,1.6,.6,1,17,'#91bfc2');break;
    case 'washstand':top(19);round(.5,.5,.35,22,4,cream);b(.62,.22,.2,.2,12,23,'#e0cda9');b(.58,.2,.3,.1,2,34,'#e0cda9');break;
    case 'pendulum':b(.15,.15,.7,.7,4,0,wood);b(.24,.25,.52,.5,47,4,color);b(.17,.2,.66,.6,4,51,wood);b(.33,.77,.34,.02,18,10,'#384957');b(.48,.8,.03,.03,16,16,'#d4af70');b(.38,.8,.24,.04,4,13,'#d4af70');b(.28,.77,.44,.02,13,35,cream);b(.49,.8,.03,.02,7,40,metal);break;
    case 'quilt':legs(2,1,22);b(0,0,2,1,2,22,wood);for(let u=0;u<4;u++)for(let v=0;v<2;v++)b(.1+u*.45,.1+v*.4,.43,.38,.5,24,(u+v)%2?color:cream);break;
    case 'drawers':b(0,0,2,1,29,0,wood);for(let u=0;u<4;u++)for(let z=0;z<3;z++){b(.06+u*.48,.95,.43,.05,8,1+z*9,color);b(.22+u*.48,1,.1,.03,2,4+z*9,'#e0bb78');}break;
    case 'batseat':legs(1,1,10);b(.15,.15,.7,.75,7,10,color);face([[.05,.15,17],[0,.15,42],[.25,.15,34],[.5,.15,46],[.75,.15,34],[1,.15,42],[.95,.15,17]],color,true);for(const u of [.05,.85])b(u,.2,.1,.7,7,20,metal);break;
    case 'coffin':face([[.2,.2,0],[.05,.2,35],[.25,.2,48],[.75,.2,48],[.95,.2,35],[.8,.2,0]],'#554359',true);for(const z of [5,18,31])b(.22,.2,.56,.65,2,z,color);for(let j=0;j<3;j++)b(.3+j*.14,.5,.09,.2,9,20,j%2?cream:'#976f87');break;
    case 'organ':b(0,0,2,1,19,0,color);for(let j=0;j<9;j++)b(.1+j*.2,.15,.12,.2,24+12*Math.sin(j*Math.PI/8),19,'#b5afbd');b(.05,.65,1.9,.3,2,21,cream);for(let j=0;j<14;j++)b(.1+j*.13,.65,.04,.16,1,23,metal);break;
    case 'candles':round(.5,.5,.35,0,3,color);b(.46,.46,.08,.08,30,3,color);for(let j=0;j<5;j++){let u=.08+j*.2,z=23+8*(1-Math.abs(j-2)/2);b(u,.46,.06,.06,z,3,metal);b(u-.02,.44,.1,.1,8,z,cream);b(u,.47,.04,.04,3,z+8,'#efc578');}break;
    case 'gargoyle':b(.1,.1,.8,.8,6,0,'#646170');b(.3,.3,.4,.4,20,6,color);b(.22,.25,.56,.5,9,26,'#91899b');for(const side of [-1,1])face([[.5,.2,23],[.5+side*.6,.2,40],[.5+side*.55,.2,25],[.5+side*.25,.2,29]],color,true);b(.3,.78,.12,.03,2,31,'#d5b77e');break;
    case 'raven':b(.15,.15,.7,.7,4,0,metal);b(.47,.47,.06,.06,34,4,wood);b(.2,.47,.6,.07,3,32,wood);b(.3,.35,.4,.3,9,35,color);b(.62,.36,.18,.2,7,40,'#3f4053');b(.78,.39,.15,.1,2,42,'#c3b68a');break;
    case 'orb':round(.5,.5,.36,0,4,metal);b(.36,.36,.28,.28,19,4,color);for(let j=0;j<5;j++)round(.5,.5,.12+.2*Math.sin(j*Math.PI/4),23+j*3,3,'#a9cfdf');break;
    case 'lectern':b(.1,.1,.8,.8,3,0,wood);b(.42,.42,.16,.16,23,3,color);b(.1,.15,.8,.65,3,26,wood);face([[.15,.2,30],[.5,.2,33],[.5,.75,33],[.15,.75,30]],cream,true);face([[.5,.2,33],[.85,.2,30],[.85,.75,30],[.5,.75,33]],cream,true);break;
    case 'gate':for(let j=0;j<9;j++){let u=.08+j*.22;b(u,.35,.06,.15,35,0,metal);face([[u-.04,.4,35],[u+.03,.4,43],[u+.1,.4,35]],color,true);}for(const z of [8,28])b(.08,.35,1.82,.1,2,z,metal);break;
    case 'roses':for(let j=0;j<7;j++){b(.08+j*.29,.3,.05,.1,39,0,metal);b(.12+j*.27,.38,.16,.14,5,12+j%3*10,color);}for(const z of [12,25,38])b(.05,.3,1.9,.08,2,z,metal);break;
    case 'cauldron':for(const u of [.15,.75])b(u,.2,.1,.6,5,0,metal);round(.5,.5,.32,5,4,metal);round(.5,.5,.43,9,9,metal);round(.5,.5,.39,18,5,metal);round(.5,.5,.41,23,2,color);round(.5,.5,.37,25,.5,'#97c394');break;
    case 'potions':b(.1,.1,.8,.15,44,0,'#5e4b64');for(const u of [.1,.8])b(u,.1,.1,.8,44,0,color);for(const z of [0,14,28,42])b(.1,.1,.8,.8,2,z,wood);for(const z of [2,16,30])for(let j=0;j<3;j++){b(.23+j*.2,.4,.13,.17,8,z,j%2?'#b59bd5':'#85bdb0');b(.27+j*.2,.44,.05,.08,3,z+8,cream);}break;
    case 'mirror':b(.12,.2,.76,.5,3,0,metal);b(.2,.25,.6,.12,39,3,color);face([[.25,.39,8],[.25,.39,36],[.5,.39,47],[.75,.39,36],[.75,.39,8]],'#9fb7ca',true);break;
    case 'crypt':for(const u of [.15,1.6])b(u,.15,.25,.7,15,0,'#706779');b(0,0,2,1,6,15,color);for(let j=0;j<7;j++)b(.1+j*.27,.95,.15,.05,3,17,'#c5b3c6');break;
    case 'mobile':b(.1,.1,.8,.8,3,0,color);b(.45,.45,.1,.1,46,3,metal);b(.1,.45,.8,.06,2,45,metal);for(let j=0;j<4;j++){b(.15+j*.23,.45,.02,.02,13+j%2*7,25,metal);round(.16+j*.23,.46,.09,23+j%2*4,3,'#dbca92');}break;
    case 'stained':for(let j=0;j<3;j++){let u=.05+j*.65;b(u,.2,.06,.5,46,0,metal);face([[u+.08,.4,3],[u+.08,.4,35],[u+.3,.4,47],[u+.56,.4,35],[u+.56,.4,3]],j%2?'#a5b9ce':color,true);b(u+.08,.41,.48,.02,2,20,'#d9bb85');}break;
    case 'espresso':b(0,0,2,1,23,0,wood);b(0,0,2,1,3,23,cream);b(.15,.1,1.2,.5,16,26,color);for(let j=0;j<3;j++){b(.3+j*.35,.65,.06,.06,8,30,metal);round(.33+j*.35,.75,.1,26,4,cream);}break;
    case 'roaster':{
     b(.1,.1,1.8,.8,8,0,metal);
     const front=[],back=[];for(let j=0;j<16;j++){const a=j*Math.PI/8,t=(j+1)*Math.PI/8,p=[.65+Math.cos(a)*.45,22+Math.sin(a)*12],q=[.65+Math.cos(t)*.45,22+Math.sin(t)*12];front.push([p[0],.85,p[1]]);back.push([p[0],.15,p[1]]);face([[p[0],.15,p[1]],[q[0],.15,q[1]],[q[0],.85,q[1]],[p[0],.85,p[1]]],color,true);}
     face(front,'#b67c53',true);face(back,metal,true);b(.55,.87,.2,.07,4,20,metal);b(1.2,.2,.55,.55,15,8,metal);b(.4,.25,.5,.5,8,34,'#d0ae79');break;
    }
    case 'grinder':top(17);b(.3,.3,.4,.4,15,20,metal);round(.5,.5,.3,35,11,'#a38a70');b(.36,.7,.28,.08,4,28,metal);round(.5,.8,.12,20,4,cream);break;
    case 'cups':b(.1,.1,.8,.8,3,0,wood);b(.47,.47,.06,.06,34,3,metal);for(let j=0;j<3;j++){let z=10+j*10;b(.2,.45,.6,.07,2,z,metal);for(const u of [.18,.72])round(u,.5,.1,z,5,j%2?cream:color);}break;
    case 'menu':for(const u of [.12,.82])b(u,.15,.07,.65,3,0,wood);b(.1,.2,.8,.15,38,3,color);b(.17,.36,.66,.02,28,9,'#345752');for(let j=0;j<5;j++)b(.24,.39,.45-j%2*.15,.01,1,13+j*5,cream);break;
    case 'cake':b(.08,.08,.84,.84,7,0,color);for(const z of [8,23,38])b(.1,.1,.8,.8,2,z,cream);for(const u of [.1,.85])for(const v of [.1,.85])b(u,v,.04,.04,32,8,metal);for(const z of [10,25]){round(.5,.5,.26,z,8,'#c9957e');round(.5,.5,.27,z+8,2,cream);}break;
    case 'basket':top(16);b(.12,.12,.76,.76,8,19,'#b68b5b');for(let j=0;j<3;j++)b(.2+j*.21,.3,.17,.4,5,27,'#e6bd7c');break;
    case 'sacks':round(.35,.35,.28,0,20,'#b29b78');round(.65,.65,.29,0,24,color);for(const [u,v,z]of [[.35,.35,20],[.65,.65,24]])round(u,v,.2,z,2,'#6e4a37');break;
    case 'banquette':b(0,0,2,.65,12,0,wood);b(0,0,.65,2,12,0,wood);b(0,0,2,.15,27,4,color);b(0,0,.15,2,27,4,color);for(let j=0;j<3;j++){b(.18+j*.6,.18,.55,.42,5,12,cream);b(.18,.78+j*.4,.42,.35,5,12,cream);}break;
    case 'roundtable':round(.5,.5,.34,0,3,metal);b(.45,.45,.1,.1,20,3,metal);round(.5,.5,.48,23,3,color);round(.65,.5,.1,26,4,cream);break;
    case 'wirechair':legs(1,1,14);round(.5,.5,.36,14,3,color);for(const u of [.2,.75])b(u,.2,.04,.04,33,0,metal);b(.2,.2,.59,.05,2,33,metal);for(let j=0;j<4;j++)b(.26+j*.14,.2,.025,.025,14,18,metal);break;
    case 'trolley':for(const z of [6,23])b(.05,.05,1.9,.9,3,z,color);for(const u of [.1,1.8])for(const v of [.1,.8]){b(u,v,.05,.05,28,0,metal);round(u,v,.09,0,3,metal);}round(.6,.5,.22,26,8,cream);for(const u of [1.1,1.5])round(u,.5,.1,26,4,cream);break;
    case 'pourover':top(18);for(const u of [.2,.75])b(u,.3,.06,.06,24,21,wood);b(.2,.3,.61,.1,2,45,wood);for(let j=0;j<4;j++)round(.5,.5,.1+j*.045,33+j*2,2,cream);round(.5,.5,.16,21,10,'#a3bcc3');break;
    case 'bottlefridge':b(.05,.05,.9,.9,43,0,metal);b(.13,.95,.74,.02,35,4,'#8fbbb9');for(const z of [6,18,30])for(let j=0;j<3;j++){b(.22+j*.21,.98,.1,.02,8,z,j%2?color:'#d7b676');b(.25+j*.21,.98,.04,.02,3,z+8,cream);}b(.84,.99,.04,.03,17,15,cream);break;
    case 'papers':for(const u of [.1,.85])b(u,.2,.05,.6,23,0,color);for(let j=0;j<3;j++){b(.15,.2+j*.2,.7,.08,17,4,cream);for(let k=0;k<4;k++)b(.23,.29+j*.2,.5,.01,.7,7+k*3,metal);}break;
    case 'awning':for(const u of [.05,1.85])b(u,.1,.08,.08,44,0,wood);for(let j=0;j<8;j++)b(j*.25,.05,.25,.9,3,44,j%2?cream:color);for(let j=0;j<8;j++)b(j*.25,.9,.25,.05,5,39,j%2?cream:color);break;
   }
  }else
 if(s==='boardwalk-seat'){
   block(.08,.08,1.84,.84,8,4,'#956d50');for(let u=.06;u<2;u+=.24)block(u,.04,.1,.14,25,5,'#d0aa77');for(const u of [.02,1.82])block(u,.2,.16,.76,14,5,'#b88d60');for(const u of [.22,1.02])block(u,.22,.75,.68,6,12,color);block(.36,.3,.35,.3,7,18,'#e78d7b');block(1.2,.24,.4,.15,11,18,'#82bbba');
  }else if(s==='boardwalk-light'){
   block(.1,.1,.8,.8,3,0,'#8d6c55');block(.44,.44,.12,.12,36,3,'#c69d67');block(.1,.1,.8,.8,13,37,color);for(const u of [.12,.84])for(const v of [.12,.84])block(u,v,.05,.05,13,37,'#a37856');block(.08,.08,.84,.84,2,50,'#ac7a56');
  }else if(s==='boardwalk-table'){
   block(.12,.12,.76,.76,4,1,'#99724e');for(const u of [.13,.79])for(const v of [.13,.79])block(u,v,.08,.08,17,4,'#c49a6e');block(0,0,1,1,3,21,color);for(let v=.15;v<1;v+=.23)block(.02,v,.96,.02,.3,24,'#9d7855');block(.25,.25,.5,.45,1,8,'#88aba9');
  }else if(s==='round-bed'){
   // An actual circular platform, with a segmented cylindrical sidewall.
   const disk=(radius,z,h,tint)=>{const top=[];for(let i=0;i<24;i++){const a=i*Math.PI/12,b=(i+1)*Math.PI/12,p=[1+Math.cos(a)*radius,1+Math.sin(a)*radius],q=[1+Math.cos(b)*radius,1+Math.sin(b)*radius];top.push([...p,z+h]);face([[...p,z],[...q,z],[...q,z+h],[...p,z+h]],tint);}face(top,tint);};
   disk(.97,1,7,'#566b88');disk(.89,8,7,'#e9e4ef');disk(.85,15,2,color);block(.4,.25,.52,.35,5,17,'#f8ebdf');block(1.06,.25,.52,.35,5,17,'#f8ebdf');block(.78,.78,.44,.4,2,17,'#c5a3cf');
  }else if(s==='bunk-bed'){
   for(const z of [5,36]){block(0,0,1,2,4,z,'#5e7e91');mattress(z+4);}
   for(const u of [0,.92])for(const v of [0,1.92])block(u,v,.08,.08,61,0,'#658593');
   for(const u of [0,.94])block(u,.04,.06,1.85,4,56,color);
   for(const v of [1.08,1.75])block(.95,v,.05,.07,54,0,'#ddbd89');for(let z=5;z<52;z+=8)block(.95,1.08,.05,.74,2,z,'#ddbd89');
  }else if(s==='capsule-bed'){
   block(0,0,1,2,9,0,'#475c77');block(0,0,1,.22,37,9,'#7c94ae');block(0,.05,.13,1.9,25,9,'#6f88a4');block(.87,.05,.13,1.9,25,9,'#6f88a4');mattress(9);block(0,0,1,.7,5,43,'#9cb9cc');block(.08,.2,.84,.05,2,39,color);for(const u of [0,.94])block(u,.76,.06,1.14,2,34,color);
  }else if(s==='racer-bed'){
   block(0,0,1,2,9,4,color);mattress(9);for(const u of [0,.86]){block(u,.12,.14,1.82,9,14,color);for(const v of [.3,1.5])block(u-.03,v,.2,.3,8,0,'#304052');}block(0,1.82,1,.18,5,22,color);block(.12,1.98,.2,.02,3,10,'#ffe2a0');block(.68,1.98,.2,.02,3,10,'#ffe2a0');block(.43,1.84,.14,.15,1,27,'#f8e8c9');
  }else if(beds.includes(s)){
   const timber=s==='cabin-bed'?'#a57952':s==='poster-bed'?'#796078':s==='platform-bed'?'#b89573':'#88667c';
   block(0,0,w,2,s==='platform-bed'?5:8,2,timber);mattress(s==='platform-bed'?7:10);
   if(s==='platform-bed'){block(0,0,w,.13,14,7,'#ad977a');for(let u=.18;u<w;u+=.27)block(u,.02,.03,.13,12,9,'#d1bd97');}
   else {block(0,0,w,.14,s==='velvet-bed'?34:28,7,timber);if(s==='velvet-bed'){for(let u=.12;u<w;u+=.35)block(u,.14,.28,.07,22,16,color);}else for(let u=.12;u<w;u+=.24)block(u,.14,.08,.05,19,12,'#d2ab7d');}
   if(s==='poster-bed'){for(const u of [0,w-.1])for(const v of [0,1.9]){block(u,v,.1,.1,59,0,'#ad8b63');block(u-.02,v-.02,.14,.14,3,59,'#e2bf88');}for(const u of [0,w-.1])block(u,0,.1,2,3,56,'#ad8b63');for(const v of [0,1.9])block(0,v,w,.1,3,56,'#ad8b63');}
   if(s==='cabin-bed')block(0,1.88,w,.12,13,4,timber);
   if(s==='platform-bed')for(let v=1;v<1.8;v+=.17)block(.1,v,w-.2,.025,.2,17.2,'#d6dfbf');
  }
  else {
   // Reuse the established furniture geometry, now projected and occluded in 3D.
   // Canvas-only ornaments are rebuilt below where their surfaces need a back.
   let anchor=[0,0,0],matrix=new DOMMatrix(),stack=[],path=[];
   const flat=['range','koi-pond','listening-console'].includes(s);
   const convert=p=>{if(p.world)return p.world;const q=matrix.transformPoint({x:p[0],y:p[1]}),[u,v,z]=anchor,dx=q.x-(u-v)*18,dy=q.y-((u+v)*9-z);return flat?[u+dx/36+dy/18,v-dx/36+dy/18,z]:[u+dx/18,v,z+dx/2-dy];};
   const stroke=(points,tint,width=1)=>{for(let i=1;i<points.length;i++){const a=convert(points[i-1]),b=convert(points[i]),d=Math.max(.012,width/36);const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];if(Math.abs(dx)+Math.abs(dy)<.001)block(a[0]-d/2,a[1]-d/2,d,d,Math.max(.1,Math.abs(dz)),Math.min(a[2],b[2]),tint);else{const n=Math.hypot(dx,dy),ox=-dy/n*d/2,oy=dx/n*d/2;face([[a[0]+ox,a[1]+oy,a[2]+.3],[b[0]+ox,b[1]+oy,b[2]+.3],[b[0]-ox,b[1]-oy,b[2]-.3],[a[0]-ox,a[1]-oy,a[2]-.3]],tint,true);}}};
   const ctx={__capture:true,__face:face,__block:block,__convert:convert,__anchor:p=>{anchor=p;},__line:stroke,fillStyle:'#ffffff',strokeStyle:'#ffffff',lineWidth:1,
    save(){stack.push({matrix:matrix.toString(),fillStyle:this.fillStyle,strokeStyle:this.strokeStyle,lineWidth:this.lineWidth});},restore(){const old=stack.pop();if(old){matrix=new DOMMatrix(old.matrix);Object.assign(this,{fillStyle:old.fillStyle,strokeStyle:old.strokeStyle,lineWidth:old.lineWidth});}},
    translate(x,y){matrix=matrix.translate(x,y);},scale(x,y){matrix=matrix.scale(x,y);},rotate(a){matrix=matrix.rotate(a*180/Math.PI);},transform(a,b,c,d,e,f){matrix=matrix.multiply(new DOMMatrix([a,b,c,d,e,f]));},
    beginPath(){path=[];},moveTo(x,y){path.push([x,y]);},lineTo(x,y){path.push([x,y]);},closePath(){if(path.length)path.push(path[0]);},
    ellipse(x,y,rx,ry,rotation,start,end){const count=Math.max(4,Math.ceil(Math.abs(end-start)*5));for(let i=0;i<=count;i++){const a=start+(end-start)*i/count,dx=Math.cos(a)*rx,dy=Math.sin(a)*ry;path.push([x+dx*Math.cos(rotation)-dy*Math.sin(rotation),y+dx*Math.sin(rotation)+dy*Math.cos(rotation)]);}},
    arc(x,y,r,start,end){this.ellipse(x,y,r,r,0,start,Math.min(end,start+Math.PI*2));},
    fill(){if(path.length>=3)face(path.map(convert),this.fillStyle,true);},stroke(){stroke(path,this.strokeStyle,this.lineWidth);},
    fillRect(x,y,w,h){face([[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(convert),this.fillStyle,true);}
   };
   const capture=new Proxy(ctx,{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
   decor(capture,{...item,rotation:0},0,0);

  }
  // Hand-finished surfaces preserve silhouettes, palettes and existing light effects.
  if(themeModel){
   if(['seat','arch','trunk','bridge','daybed','fruit','fan'].includes(themeModel)){
    const grain=(u,v,a,z,h)=>{for(let j=0;j<3;j++){const x=u+a*(.2+j*.28);ribbon([x,v,z],[x+.02,v,z+h*.45],'#b58960',.008);ribbon([x+.02,v,z+h*.45],[x-.015,v,z+h],'#73543e',.007);}};
    if(themeModel==='seat'){grain(.1,.265,.8,18,14);fabric(.15,.28,.65,.65,18.04,color);for(const u of [.05,.8])grain(u,.935,.15,2,17);for(let j=0;j<5;j++)foliage(.15+j*.16,.13,33,.1,.15,5);}
    if(themeModel==='arch'){for(const u of [.05,1.7]){grain(u,.855,.25,2,38);for(let j=0;j<5;j++)foliage(u+.1,.86,8+j*7,j%2?.15:-.12,.02,4);}for(let j=0;j<7;j++)foliage(.15+j*.26,.5,46,.16,.1,-5);}
    if(themeModel==='trunk'){grain(.08,.925,.84,2,13);for(const u of [.2,.7]){block(u,.925,.08,.015,18,0,'#c5a16c');block(u,.04,.08,.015,18,0,'#c5a16c');}for(const u of [.12,.82])for(const z of [3,15])block(u,.945,.025,.02,.8,z,'#ead5a5');block(.46,.98,.07,.02,2,14,'#70583d');ribbon([.1,.94,18],[.9,.94,18],'#423f38',.012);}
    if(themeModel==='bridge'){for(let j=0;j<8;j++)ribbon([j*.25+.04,.18,8.2+Math.abs(j-3.5)],[j*.25+.08,.8,8.2+Math.abs(j-3.5)],shade(color,28),.009);for(const u of [.045,1.945])for(const v of [.05,.9])for(const z of [22,24])block(u-.05,v-.03,.11,.12,.7,z,'#e8cfa2');}
    if(themeModel==='daybed'){fabric(.1,.1,.8,1.8,15.05,color);fabric(.15,.15,.7,.4,20.05,'#eee0c9');for(let j=0;j<5;j++)foliage(.15,.55+j*.25,16,.65,.14,0,shade(color,j%2?10:-8));grain(.05,1.955,.9,1,5);}
    if(themeModel==='fruit'){for(let u=.15;u<1.9;u+=.3)for(const v of [.25,.65]){ribbon([u+.03,v+.03,26.05],[u+.18,v+.17,26.05],'#f3d28b',.014);block(u+.09,v+.08,.025,.025,2,26,'#668554');}grain(.05,.135,1.9,22,6);}
    if(themeModel==='fan')for(const z of [8,15,22,29])for(let j=0;j<9;j++){const u=.1+j*.21,h=18+22*Math.sin(j*Math.PI/8);if(z<h)block(u-.008,.493,.076,.01,.65,z,shade(color,35));}
   }
   if(themeModel==='waterfall'){for(let k=0;k<4;k++){const u=k*.45;for(const z of [13,23])ribbon([u+.04,.355,z],[u+.4,.355,z+1],'#546e66',.012);}for(let j=0;j<7;j++){const u=.2+j*.24;ribbon([u,.6,7.1],[u+.14,.7,7.1],'#d6f8e8',.015);}for(const [u,z]of [[.1,22],[1.7,30],[.1,9]])foliage(u,.4,z,.25,.05,3);}
   if(themeModel==='mask'){for(const u of [.24,.62]){block(u+.04,.466,.055,.02,2,33,'#304e43');ribbon([u-.02,.45,38],[u+.17,.45,36],'#e6c58f',.025);}for(let j=0;j<4;j++)block(.32+j*.09,.48,.04,.02,2,20,'#8d5740');for(const side of [0,1])for(let j=0;j<3;j++)ribbon([.19+side*.55,.43,23+j*3],[.28+side*.37,.43,24+j*3],'#c7dba0',.012);}
   if(themeModel==='idol'){for(const u of [.2,.62])block(u,.83,.18,.03,2,37,'#a7bba0');block(.3,.84,.4,.015,1.5,28,'#35544c');for(let j=0;j<5;j++)detail([[.15+j*.12,.81,37],[.2+j*.12,.81,35],[.23+j*.12,.81,38]],shade(color,20));ribbon([.3,.755,9],[.34,.755,20],'#667d73',.012);}
   if(themeModel==='terrarium'){for(const v of [.09,.91])detail([[.1,v,7],[.9,v,7],[.9,v,37],[.1,v,37]],'#b7ebdb18');for(const u of [.09,.91])detail([[u,.1,7],[u,.9,7],[u,.9,37],[u,.1,37]],'#b7ebdb12');for(let j=0;j<5;j++)foliage(.45,.5,18,Math.cos(j*1.25)*.3,Math.sin(j*1.25)*.3,6);ribbon([.2,.92,32],[.42,.92,23],'#d7f3df80',.025);}
   if(themeModel==='nest'){for(const z of [20,25,30]){let last;for(let j=0;j<=8;j++){const a=Math.PI+j*Math.PI/8,p=[.5+Math.cos(a)*.38,.55+Math.sin(a)*.38,z];if(last)ribbon(last,p,'#c6a272',.018);last=p;}}fabric(.28,.38,.44,.34,17.1,color);}
   if(['fern','orchid','banana'].includes(themeModel)){const u=themeModel==='banana'?.2:.25;block(u-.02,u-.02,.54,.54,1.4,6,'#d4aa79');for(let j=0;j<3;j++)ribbon([u+.08+j*.13,u+.505,1],[u+.08+j*.13,u+.505,5],'#c49567',.009);}
  }
  if(['bentwood-chair','woven-seat'].includes(s)){fabric(.18,.27,.64,.53,15.1,s==='woven-seat'?'#e9d5aa':'#e3e4b9');if(s==='woven-seat')for(let u=.21;u<.8;u+=.1)ribbon([u,.3,15.12],[u,.77,15.12],'#b3976b',.007);}
  if(s==='diner-booth')for(const u of [.1,1.02])fabric(u,.22,.88,.72,16.05,color);
  if(s==='pod-bed'){fabric(.1,.8,.8,1.06,20.05,color);fabric(.12,.2,.76,.38,21.05,'#fff4d2');}
  if(['coffee-station','bistro-table'].includes(s)){const z=s==='coffee-station'?25:21;for(let j=0;j<3;j++)ribbon([.08,.16+j*.23,z+.05],[.9,.18+j*.23,z+.05],'#f1dfb935',.009);}
  if(s==='vine-screen')for(let j=0;j<6;j++){const u=.2+j*.3;for(let k=0;k<3;k++)foliage(u,.22,15+k*8,(j+k)%2?.18:-.15,.015,4);}
  if(s==='plant-house')for(const [u,v,z]of [[.3,.3,26],[.65,.45,33],[.4,.7,21]])for(const side of [-1,1])foliage(u,v,z-5,side*.25,.08,3);
  if(s==='holo-table'){for(const z of [24,30,36])ribbon([.4,.51,z],[.6,.51,z],'#d4fff480',.012);}
  if(s==='vending')for(const z of [19,27,35])for(const u of [.19,.38,.57])block(u,.995,.1,.008,.8,z+3,'#f6f2dc');
  if(s==='racer-bed'){for(const u of [-.031,1.031])for(const v of [.3,1.5])detail([[u,v+.06,2],[u,v+.24,2],[u,v+.24,6],[u,v+.06,6]],'#8d9fa9');for(const u of [.02,.9])ribbon([u,1.15,23.05],[u,1.76,23.05],'#fff0c8',.025);}
  const ordered=orderFaces(faces).map(f=>({...f,p:f.p.map(([u,v,z])=>[(u-v)*18,(u+v)*9-z])}));
  const points=ordered.flatMap(f=>f.p),left=Math.floor(Math.min(...points.map(p=>p[0])))-2,top=Math.floor(Math.min(...points.map(p=>p[1])))-2,width=Math.ceil(Math.max(...points.map(p=>p[0])))-left+2,height=Math.ceil(Math.max(...points.map(p=>p[1])))-top+2;
  const canvas=document.createElement('canvas');canvas.width=width*3;canvas.height=height*3;const ctx=canvas.getContext('2d');ctx.scale(3,3);ctx.translate(-left,-top);for(const f of ordered)poly(ctx,f.p,f.tint,f.cut||f.detail?null:'#263547');
  const art={canvas,left,top,width,height};if(furnitureFaces.size>128)furnitureFaces.clear();furnitureFaces.set(key,art);return paint(art);
 }

 function decor(c,item,x,y){
  if(item.centered&&!c.__capture)y+=9;
  if(!c.__capture&&solidDecor(c,item,x,y))return;
  const color=item.color||'#67d1cc',s=item.sprite||item.sprite_id||'table';
  const dims={'diner-booth':[2,1],'pod-bed':[1,2],sofa:[2,1],bed:[1,2],rug:[2,2],divider:[2,1]},[w,l]=dims[s]||[item.width||1,item.length||1];
  c.save();c.translate(x,y);
  if(item.rotation===2||item.rotation===6)c.scale(-1,1);
  const point=(u,v,z=0)=>{const p=[(u-v)*18,(u+v)*9-z];p.world=[u,v,z];if(c.__capture)c.__anchor(p.world);return p;};
  const cube=(u,v,a,b,h,z,tint)=>{if(c.__capture){c.__block(u,v,a,b,h,z,tint);return;}const [px,py]=point(u,v,z);box(c,px,py,a,b,h,tint);};
  const line=(points,tint,width=1)=>{if(c.__capture){c.__line(points,tint,width);return;}c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.strokeStyle=tint;c.lineWidth=width;c.stroke();};
  const tile=(u,v,a,b,z,tint,edge)=>poly(c,[point(u,v,z),point(u+a,v,z),point(u+a,v+b,z),point(u,v+b,z)],tint,edge);
  const panel=(u,v,a,z,h,fill,edge)=>poly(c,[point(u,v,z+h),point(u+a,v,z+h),point(u+a,v,z),point(u,v,z)],fill,edge);
  // Layered contact shadow stays inside the existing furniture footprint.
  tile(.04,.05,w,.98*l,0,'#14273718');
  tile(.12,.12,Math.max(.1,w-.16),Math.max(.1,l-.16),0,'#14273724');
  tile(.22,.22,Math.max(.1,w-.36),Math.max(.1,l-.36),0,'#14273726');
  const legs=(a,b)=>{for(const [u,v] of [[.12,.12],[a-.23,.12],[.12,b-.23],[a-.23,b-.23]])cube(u,v,.12,.12,6,0,'#334455');};
  if(s.startsWith('pet-toy-')){
   tile(.08,.08,.84,.84,.5,shade(color,-30),shade(color,10));
   if(s==='pet-toy-rabbit'){
    // A fabric roof with open ends gives rabbits a real tunnel silhouette.
    for(let j=0;j<8;j++){const a=j*Math.PI/8,b=(j+1)*Math.PI/8,v=.5+Math.cos(a)*.38,v2=.5+Math.cos(b)*.38,z=2+Math.sin(a)*21,z2=2+Math.sin(b)*21;poly(c,[point(.12,v,z),point(.81,v,z),point(.81,v2,z2),point(.12,v2,z2)],shade(color,j<4?15:-12));}
    for(const u of [.12,.35,.58,.81]){line([point(u,.12,1),point(u,.12,15),point(u,.28,23),point(u,.7,23),point(u,.88,15),point(u,.88,1)],color,3);}
    for(const v of [.12,.88])line([point(.12,v,14),point(.81,v,14)],shade(color,20),2);
   }else{
    const q=point(.5,.5,5);cube(.34,.34,.32,.32,6,1,color);
    for(let i=0;i<4;i++)line([point(.35,.36+i*.08,7.1),point(.65,.36+i*.08,7.1)],s==='pet-toy-cat'?'#f8d8df':'#f5edd0',.6);
    if(s==='pet-toy-cat')line([point(.6,.5,2),point(.8,.67,1),point(.62,.8,1)],color,1);
   }
  }else if(s.startsWith('pet-bed-')){
   cube(.05,.05,.9,.9,2,0,shade(color,-30));
   cube(.09,.09,.82,.82,2,2,color);
   cube(.1,.1,.8,.12,5,3,shade(color,15));cube(.1,.1,.12,.8,5,3,shade(color,8));
   cube(.23,.24,.61,.6,1.5,4,shade(color,34));
   for(let i=0;i<5;i++)line([point(.25+i*.11,.27,5.6),point(.25+i*.11,.81,5.6)],shade(color,20),.4);
   if(s==='pet-bed-dog'){cube(.35,.25,.28,.2,2,5,'#e8d2ae');line([point(.4,.35,7.1),point(.58,.35,7.1)],'#b58b64',2);}
   if(s==='pet-bed-cat'){cube(.25,.22,.2,.23,2,5,'#d9c8ee');line([point(.29,.27,7.1),point(.39,.37,7.1)],'#a488c3',1.5);}
   if(s==='pet-bed-rabbit'){for(let i=0;i<6;i++)line([point(.26+i*.08,.27,5.8),point(.3+i*.08,.73,5.8)],'#e7d6a0',1);}
  }else if(s==='hammock'){
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
   line([[-2,-4],[-2,-37]],shade(color,20),.65);line([[2,-4],[2,-37]],shade(color,-18),.65);
   for(const [x,y]of [[-12,-21],[-12,-28],[11,-29],[11,-34],[0,-15],[0,-27]])line([[x-1.5,y],[x+1,y-.8]],'#d4e1af',.5);
   for(const u of [.26,.45,.64])line([point(u,.8,3),point(u,.8,10)],'#dfaa7d',.6);
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
   for(const u of [.16,.83])for(const z of [5,31])panel(u,.95,.025,z,.7,'#b7c9cb');
   for(let z=8;z<31;z+=2)line([point(.2,.955,z),point(.8,.955,z)],'#b1c7d51a',.35);
  }else if(s==='trophy'){
   cube(.1,.1,.8,.8,5,0,'#354c68');cube(.28,.28,.44,.44,3,5,'#b59151');
   const [cx,cy]=point(.5,.5);c.save();c.translate(cx,cy);
   line([[-6,-28],[-12,-30],[-12,-20],[-5,-16]],'#d49a45',2);line([[6,-28],[12,-30],[12,-20],[5,-16]],'#d49a45',2);
   c.fillStyle='#dcaa50';c.fillRect(-2,-20,4,13);poly(c,[[-8,-33],[8,-33],[6,-21],[0,-17],[-6,-21]],color,'#9b723e');
   line([[-5,-30],[-4,-23]],'#fff3b3',2);c.fillStyle='#fce4a0';c.fillRect(-4,-10,8,2);c.restore();
  }else if(s==='plinth'){
   cube(.03,.03,.94,.94,3,0,shade(color,-32));cube(.13,.13,.74,.74,19,3,color);cube(0,0,1,1,4,22,shade(color,12));
   line([point(.25,.88,18),point(.25,.88,7)],shade(color,34));
   for(const z of [5,20])line([point(.16,.89,z),point(.86,.89,z)],shade(color,28),.65);
  }else{
   legs(1,1);cube(.06,.06,.88,.88,6,5,shade(color,-35));cube(0,0,1,1,4,11,color);tile(.1,.1,.8,.8,15,shade(color,25));
   line([point(.18,.25,15),point(.8,.25,15)],shade(color,42));
  }
  c.restore();
 }
 function animal(c,u,x,y){
  const rabbit=u.species==='rabbit',cat=u.species==='cat',gait=u.gait||0,phase=u.phase||0,t=u.state==='play'?(performance.now()-(u.playAt??performance.now()))/1000:performance.now()/1000;
  const happy=u.state==='play'||(u.happyUntil||0)>performance.now(),coat=u.color||'#cc965c',step=Math.sin(phase)*gait*2.3,hop=(rabbit?Math.abs(step)*.65:Math.abs(step)*.13)+(happy?Math.abs(Math.sin(t*8))*(rabbit?1.5:.5):0);
  c.save();c.translate(x,y);
  const oval=(x,y,rx,ry,color,angle=0)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fill();};
  const fur=(x,y,rx,ry,color,angle=0)=>{const g=c.createLinearGradient(x-rx,y-ry,x+rx,y+ry);g.addColorStop(0,shade(color,28));g.addColorStop(.45,color);g.addColorStop(1,shade(color,-35));oval(x,y,rx,ry,g,angle);};
  oval(0,1,12,3.6,'#07172433');oval(0,1,8,2,'#07172430');
  if(u.facing==='left')c.scale(-1,1);
  if(u.state==='sleep'){
   const breath=Math.sin(t*1.6)*.28;
   fur(-1,-5,10.5,5.7+breath,coat);fur(7,-4,5,4.1,shade(coat,14));
   if(rabbit){fur(1,-8,6.5,1.9,coat,-.15);fur(4,-10,6,1.7,shade(coat,10),-.1);fur(-10,-5,3.5,3,'#fff5e7');}
   else if(cat){poly(c,[[4,-6],[4,-11],[8,-7]],shade(coat,-12));poly(c,[[9,-7],[12,-10],[12,-4]],coat);c.strokeStyle=shade(coat,-22);c.lineWidth=3;c.beginPath();c.moveTo(-9,-3);c.bezierCurveTo(-4,2,5,2,7,-1);c.stroke();}
   else{fur(3,-4,2.6,4.5,shade(coat,-28),-.5);fur(-10,-4,4,1.8,coat,Math.sin(t)*.08);}
   c.strokeStyle='#4c4145';c.lineWidth=.8;c.beginPath();c.moveTo(6,-4);c.quadraticCurveTo(7.5,-3,9,-4);c.stroke();oval(11,-2.5,1,.7,cat||rabbit?'#c67e93':'#283544');
   c.restore();c.save();c.translate(x,y);c.font='600 6px system-ui';c.fillStyle='#d9eced';c.textAlign='center';c.globalAlpha=.65+Math.sin(t)*.15;c.fillText('Zzz',3,-18-Math.sin(t*.7));c.restore();return;
  }
  if(u.state==='play'&&!rabbit){
   const bx=cat?13+Math.sin(t*5)*2:17+Math.abs(Math.sin(t*3))*3,by=-1-Math.abs(Math.sin(t*5))*.7;
   fur(bx,by,3.1,3.1,cat?'#d68fa8':'#79cbb6');c.strokeStyle=cat?'#f7d5df':'#e9f6d2';c.lineWidth=.55;
   for(let i=0;i<3;i++){c.beginPath();c.ellipse(bx,by,1+i*.6,2.6,t*2+i*.5,0,Math.PI*2);c.stroke();}
   if(cat){fur(9+Math.sin(t*5),-4,2,3,coat,.6+Math.sin(t*5)*.4);}
  }
  // Far legs are shaded; curved paws stay grounded between deliberate walks.
  for(const [px,sign] of [[-6,1],[6,-1]]){fur(px+step*sign,-4-hop,2.2,4.6,shade(coat,-28));oval(px+step*sign+1,0-Math.max(0,step*sign),2.5,1.5,shade(coat,-18));}
  c.save();c.translate(0,-hop);
  c.lineCap='round';c.lineJoin='round';
  if(rabbit)fur(-10,-10,4,3.8,'#fff5e7');
  else{c.strokeStyle=shade(coat,-18);c.lineWidth=cat?3.3:4;c.beginPath();c.moveTo(-9,-10);c.bezierCurveTo(-16,-12,-17,-18+Math.sin(t*(happy?12:1.4))*(happy?4:1.2),-14,cat?-24:-17);c.stroke();c.strokeStyle=shade(coat,20);c.lineWidth=1.1;c.stroke();}
  fur(-1,-10,10.8,7.1,coat,-.08);oval(-1,-11,7.3,4.2,shade(coat,14),-.1);
  if(cat){c.strokeStyle=shade(coat,-30);c.lineWidth=1.2;for(const px of [-5,-1,3]){c.beginPath();c.moveTo(px,-16);c.lineTo(px+1,-13);c.stroke();}}
  for(const [px,sign] of [[-5,-1],[7,1]]){fur(px+step*sign,-4,2.2,4.5,coat);oval(px+step*sign+1,.2-Math.max(0,step*sign),rabbit?3.3:2.8,1.5,shade(coat,18));}
  if(cat&&gait<.1&&!happy&&Math.sin(t*.17)>.97){fur(9,-12,2,4,coat,Math.sin(t*6)*.25);c.rotate(Math.sin(t*6)*.025);}
  c.translate(0,Math.sin(t*1.8)*.22);
  if(rabbit){fur(4,-27,2.7,10,coat,-.12+(gait<.1&&Math.sin(t*.23)>.96?Math.sin(t*9)*.07:0));fur(11,-29,2.8,11,coat,.12);oval(4,-28,1.15,7,'#dba6ad',-.12);oval(11,-30,1.15,7.5,'#dba6ad',.12);}
  else if(cat){poly(c,[[1,-20],[2,-29],[8,-23]],shade(coat,-12));poly(c,[[9,-24],[15,-29],[16,-19]],shade(coat,-15));poly(c,[[3,-24],[3,-27],[6,-23]],'#dea7b1');poly(c,[[11,-24],[14,-27],[14,-22]],'#dea7b1');}
  else fur(12,-22,3.2,5.4,shade(coat,-22),-.2);
  fur(8,-17,7.9,7.5,coat);oval(9,-14,5.8,4.4,rabbit?'#fff5e7':shade(coat,32));
  if(!cat&&!rabbit){fur(2,-18,3.4,7.4,shade(coat,-36),-.12);oval(1.4,-19,1.2,4,shade(coat,-20),-.12);}
  const blink=Math.sin(t*1.3+(cat?2:rabbit?4:0))>.998;
  for(const [ex,ey,rx] of [[7,-19,1.8],[12,-19.6,1.45]]){
   if(blink){c.strokeStyle='#293344';c.lineWidth=.8;c.beginPath();c.moveTo(ex-rx,ey);c.lineTo(ex+rx,ey);c.stroke();}
   else{oval(ex,ey,rx,2.4,'#fff9ef');oval(ex+.4,ey+.2,rx*.68,1.9,cat?'#59796b':'#594638');oval(ex+.6,ey+.1,rx*.4,1.55,'#202b38');oval(ex+.15,ey-.65,.48,.65,'#ffffff');}
  }
  oval(14,-14.8,1.6,1.15,cat||rabbit?'#c67e93':'#283544');oval(13.6,-15.2,.5,.3,'#ffffff77');
  c.strokeStyle='#654b4c';c.lineWidth=.55;c.beginPath();c.moveTo(14,-13.8);c.quadraticCurveTo(13,-11.7,11.5,-13);c.stroke();
  if(cat||rabbit){c.strokeStyle='#f8eee0bb';c.lineWidth=.45;for(const dy of [-1,1]){c.beginPath();c.moveTo(12,-13);c.lineTo(18,-13+dy*1.7);c.stroke();}}
  if(!rabbit){c.strokeStyle=cat?'#76c7ba':'#648fe1';c.lineWidth=2;c.beginPath();c.moveTo(5,-10);c.quadraticCurveTo(9,-8,13,-11);c.stroke();fur(10,-7.8,1.7,1.9,'#e7bb53');oval(9.6,-8.4,.5,.6,'#fff3b6');}
  c.restore();c.restore();
 }
 function avatar(c,user,x,y){if(user.species){animal(c,user,x,y);return;}const equipped=user.equipped||{avatar:{id:'cyber-starter',imageUrl:'cosmetic-cyber-starter.svg'},outfit:{imageUrl:'cosmetic-starter-suit.svg'},shoes:{imageUrl:'cosmetic-canvas-shoes.svg'}};
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
  constructor(canvas,onTap){this.canvas=canvas;this.c=canvas.getContext('2d');this.onTap=onTap;this.scene=null;this.users=new Map();this.staff=new Map();this.offset={x:0,y:0};this.zoom=1;this.viewRotation=0;this.viewMode='room';this.localUserId=null;this.hit=[];this.selected=null;this.bubbles=new Map();this.pointers=new Map();
    new ResizeObserver(()=>this.resize()).observe(canvas);this.resize();
    const point=e=>{const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left-this.cx)/this.scale,y=(e.clientY-r.top-this.cy)/this.scale;const tile=this.floorAt(x,y)||this.fromView({x:Math.floor((x/18+y/9)/2),y:Math.floor((y/9-x/18)/2)});return {x,y,tx:tile.x,ty:tile.y};};
    const resetTap=()=>{clearTimeout(this.tapTimer);this.lastTap=null;};
    const cancelHold=()=>{clearTimeout(this.holdTimer);this.holdTimer=null;};
    canvas.addEventListener('pointerdown',e=>{
     if(e.button!==0)return;
     this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);
     if(this.pointers.size>=2){cancelHold();resetTap();this.drag=null;const [a,b]=[...this.pointers.values()];const r=canvas.getBoundingClientRect();this.pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom:this.zoom,worldX:((a.x+b.x)/2-r.left-this.cx)/this.scale,worldY:((a.y+b.y)/2-r.top-this.cy)/this.scale};this.gestureLock=true;return;}
     if(this.gestureLock||this.drag)return;
     canvas.setPointerCapture(e.pointerId);const p=point(e);
     this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,tx:p.tx,ty:p.ty,ox:this.offset.x,oy:this.offset.y,px:this.placement?.x,py:this.placement?.y,moved:false};
     cancelHold();const item=!this.placement&&this.pickItem(p.x,p.y),d=this.drag,roomId=this.scene?.roomId;
     if(item&&this.canEditItem?.(item)){
      clearTimeout(this.tapTimer);
      this.holdTimer=setTimeout(()=>{
       if(this.drag!==d||d.moved||this.pointers.size!==1||this.scene?.roomId!==roomId||!this.canEditItem?.(item))return;
       resetTap();d.held=true;this.onTap({x:p.tx,y:p.ty,item,longPress:true});
       if(this.placement){d.px=this.placement.x;d.py=this.placement.y;this.drag=d;}
      },500);
     }
    });
    canvas.addEventListener('pointermove',e=>{
     if(this.pointers.has(e.pointerId))this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
     if(this.pinch&&this.pointers.size>=2){const [a,b]=[...this.pointers.values()],r=canvas.getBoundingClientRect();this.setZoom(this.pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/this.pinch.distance);this.offset.x+=(a.x+b.x)/2-r.left-(this.cx+this.pinch.worldX*this.scale);this.offset.y+=(a.y+b.y)/2-r.top-(this.cy+this.pinch.worldY*this.scale);this.draw();return;}
     const d=this.drag;if(this.gestureLock||!d||d.id!==e.pointerId)return;
     const dx=e.clientX-d.x,dy=e.clientY-d.y;
     if(Math.hypot(dx,dy)>8){d.moved=true;cancelHold();resetTap();}
     if(!d.moved)return;
     if(this.placement){if(!this.placement.saving){const p=point(e);this.placement.x=d.px+p.tx-d.tx;this.placement.y=d.py+p.ty-d.ty;}}
     else this.offset={x:d.ox+dx,y:d.oy+dy};
    });
    canvas.addEventListener('pointerup',e=>{
     cancelHold();
     this.pointers.delete(e.pointerId);
     if(this.gestureLock){this.pinch=null;if(!this.pointers.size)this.gestureLock=false;resetTap();return;}
     const d=this.drag;if(!d||d.id!==e.pointerId)return;this.drag=null;
     if(d.moved||d.held)return;
     const p=point(e),now=performance.now(),last=this.lastTap;
     const twice=last&&now-last.at<360&&Math.hypot(e.clientX-last.x,e.clientY-last.y)<28;
     if(this.placement){
      if(this.placement.saving)return;
      const preview=this.placement,check=this.placementResult();
      const onFurniture=this.pickItem(p.x,p.y,[{...preview.item,x:preview.x,y:preview.y,z:check.z??preview.item.z,rotation:preview.rotation}]);
      if(twice||!onFurniture){const next=this.pickItem(p.x,p.y,(this.scene?.items||[]).filter(i=>i.id!==preview.item.id));resetTap();this.onPlacementDrop?.(next&&this.canEditItem?.(next)?next:null);}else this.lastTap={at:now,x:e.clientX,y:e.clientY};
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
    const cancelPointer=e=>{cancelHold();this.pointers.delete(e.pointerId);this.pinch=null;this.drag=null;this.gestureLock=this.pointers.size>0;resetTap();};
    canvas.addEventListener('pointercancel',cancelPointer);canvas.addEventListener('lostpointercapture',e=>{if(this.pointers.has(e.pointerId))cancelPointer(e);});
    canvas.addEventListener('wheel',e=>{e.preventDefault();cancelHold();resetTap();const r=canvas.getBoundingClientRect();this.setZoom(this.zoom*Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.002),{x:e.clientX-r.left,y:e.clientY-r.top});},{passive:false});
    for(const type of ['gesturestart','gesturechange','gestureend','contextmenu'])canvas.addEventListener(type,e=>e.preventDefault());
    this.running=true;const loop=()=>{if(!this.running)return;this.draw();requestAnimationFrame(loop);};requestAnimationFrame(loop);
  }
  // Camera coordinates are presentation-only; scene and network positions stay unchanged.
  cameraSize(){if(this.sizeCache?.heightmap!==this.scene.heightmap){const rows=this.scene.heightmap.split('\n');this.sizeCache={heightmap:this.scene.heightmap,n:rows[0].length,m:rows.length};}return this.sizeCache;}
  toView(p){const {n,m}=this.cameraSize(),q=this.viewRotation||0;return {...p,...(q===1?{x:m-1-p.y,y:p.x}:q===2?{x:n-1-p.x,y:m-1-p.y}:q===3?{x:p.y,y:n-1-p.x}:{x:p.x,y:p.y})};}
  fromView(p){const {n,m}=this.cameraSize(),q=this.viewRotation||0;return {...p,...(q===1?{x:p.y,y:m-1-p.x}:q===2?{x:n-1-p.x,y:m-1-p.y}:q===3?{x:n-1-p.y,y:p.x}:{x:p.x,y:p.y})};}
  viewItem(item){if(!this.viewRotation)return item;const turned=item.rotation===2||item.rotation===6,w=(turned?item.length:item.width)+(item.centered?1:0),l=(turned?item.width:item.length)+(item.centered?1:0),a=this.toView(item),b=this.toView({x:item.x+(w||1)-1,y:item.y+(l||1)-1});return {...item,x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),rotation:((item.rotation||0)+this.viewRotation*2)%8,sourceItem:item};}
  cameraScene(){
   if(!this.viewRotation)return this.scene;
   if(this.viewCache?.source===this.scene&&this.viewCache.rotation===this.viewRotation)return this.viewCache.scene;
   const rows=this.scene.heightmap.split('\n'),n=rows[0].length,m=rows.length,odd=this.viewRotation%2,grid=Array.from({length:odd?n:m},()=>Array(odd?m:n).fill('x'));
   for(let y=0;y<m;y++)for(let x=0;x<n;x++){const p=this.toView({x,y});grid[p.y][p.x]=rows[y][x];}
   const scene={...this.scene,heightmap:grid.map(r=>r.join('')).join('\n'),items:(this.scene.items||[]).map(i=>this.viewItem(i))};
   this.viewCache={source:this.scene,rotation:this.viewRotation,scene};return scene;
  }
  rotateView(step){
   if(!this.scene||this.placement?.saving||this.pointers?.size)return;
   clearTimeout(this.holdTimer);clearTimeout(this.tapTimer);this.lastTap=null;this.drag=null;this.pinch=null;this.pointers?.clear();this.gestureLock=false;
   this.viewRotation=((this.viewRotation||0)+step+4)%4;this.offset={x:0,y:0};this.draw();
   this.turnAnimation?.cancel();
   if(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)this.turnAnimation=this.canvas.animate?.([{opacity:.65},{opacity:1}],{duration:180,easing:'ease-out'});
  }
  floorAt(px,py){
   const rows=this.cameraScene()?.heightmap.split('\n')||[];
   // Reverse painter order resolves raised floor diamonds before tiles behind them.
   for(let y=rows.length-1;y>=0;y--)for(let x=rows[y].length-1;x>=0;x--){
    if(!/[0-9]/.test(rows[y][x]))continue;
    const cx=(x-y)*18,cy=(x+y)*9-Number(rows[y][x])*12+9;
    if(Math.abs(px-cx)/18+Math.abs(py-cy)/9<=1)return this.fromView({x,y});
   }
   return null;
  }
  pickItem(x,y,source=this.scene?.items||[]){
    // Hit-test the original sprite pixels, including tall decor above its floor tile.
    const canvas=this.pickCanvas||(this.pickCanvas=document.createElement('canvas'));canvas.width=canvas.height=1;
    const c=canvas.getContext('2d',{willReadFrequently:true});
    const items=source.map(i=>this.viewItem(i)).sort((a,b)=>furnitureDepth(a)-furnitureDepth(b));
    for(const item of items.reverse()){c.clearRect(0,0,1,1);decor(c,item,(item.x-item.y)*18-x,(item.x+item.y)*9-item.z*12-y);if(c.getImageData(0,0,1,1).data[3]>0)return item.sourceItem||item;}
    return null;
  }
  resize(){const r=this.canvas.getBoundingClientRect();this.width=Math.round(r.width);this.height=Math.round(r.height);this.dpr=Math.min(2,window.devicePixelRatio||1);this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);this.c.imageSmoothingEnabled=false;}
  setView(mode){this.viewMode=mode;this.zoom=1;this.offset={x:0,y:0};}
  resetView(){if(this.placement?.saving||this.pointers?.size)return;this.rotateView(-(this.viewRotation||0));this.setView('room');this.draw();}
  focusMe(){this.setView('close');}
  setZoom(amount,anchor){const before=this.zoom;this.zoom=Math.max(.6,Math.min(2.2,amount));if(anchor&&this.scene&&this.scale){const x=(anchor.x-this.cx)/this.scale,y=(anchor.y-this.cy)/this.scale;this.draw();this.offset.x+=anchor.x-(this.cx+x*this.scale);this.offset.y+=anchor.y-(this.cy+y*this.scale);}if(before!==this.zoom)this.draw();}
  sample(u,now=performance.now()){const t=Math.max(0,Math.min(1,(now-u.at)/(u.species?700:250)));return {x:u.old.x+(u.position.x-u.old.x)*t,y:u.old.y+(u.position.y-u.old.y)*t,z:u.old.z+(u.position.z-u.old.z)*t};}
  animate(u,now){const p=this.sample(u,now),last=u.visual||p,dt=Math.min(.05,Math.max(0,(now-(u.frameAt||now))/1000)),distance=Math.hypot(p.x-last.x,p.y-last.y);const moving=distance>.00001&&u.state!=='sit'&&u.state!=='lay';u.phase=(u.phase||0)+distance*Math.PI*2;u.gait=(u.gait||0)+((moving?1:0)-(u.gait||0))*(1-Math.exp(-dt*18));u.visual=p;u.frameAt=now;return p;}

  setScene(scene){this.placementCache=null;if(!this.scene||this.scene.roomId!==scene.roomId){this.turnAnimation?.cancel();clearTimeout(this.holdTimer);this.placement=null;this.drag=null;this.pointers?.clear();this.pinch=null;this.gestureLock=false;clearTimeout(this.tapTimer);this.lastTap=null;this.viewRotation=0;this.viewCache=null;this.setView('room');this.bubbles.clear();}this.scene=scene;}
  clearPlacement(){clearTimeout(this.holdTimer);this.placement=null;this.drag=null;this.lastTap=null;clearTimeout(this.tapTimer);}
  placementResult(){
   const p=this.placement;if(!p)return null;
   const users=[...this.users.values()],key=JSON.stringify([p.x,p.y,p.rotation,users.map(u=>[u.position.x,u.position.y,u.position.z])]);
   const cached=this.placementCache;if(cached?.scene===this.scene&&cached.item===p.item&&cached.key===key)return cached.result;
   const result=EarnlyWorldPlacement.placementCheck(this.scene,p.item,{x:p.x,y:p.y,rotation:p.rotation},users);
   this.placementCache={scene:this.scene,item:p.item,key,result};return result;
  }
  setStaff(staff){const old=this.staff,now=performance.now();this.staff=new Map(staff.map(s=>{const previous=old.get(s.staffId),changed=!previous||['x','y','z'].some(k=>s.position[k]!==previous.position[k]),from=previous?this.sample(previous,now):s.position,dx=s.position.x-from.x,dy=s.position.y-from.y;return [s.staffId,{...previous,...s,playAt:s.state==='play'?now-(s.playElapsed||0):undefined,old:changed?from:previous.old,at:changed?now:previous.at,facing:Math.abs(dx-dy)>.001?(dx-dy<0?'left':'right'):(previous?.facing||'right')}];}));}
  setUsers(users){const present=new Set(users.map(u=>u.userId));for(const id of this.users.keys())if(!present.has(id))this.users.delete(id);users.forEach(u=>this.updateUser(u));}
  updateUser(u){const previous=this.users.get(u.userId),now=performance.now();
   // Chat, look and standing packets must not restart an in-flight step.
   const changed=!previous||['x','y','z'].some(k=>u.position[k]!==previous.position[k]);
   const from=previous?this.sample(previous,now):u.position,dx=u.position.x-from.x,dy=u.position.y-from.y;
   const teleport=Math.hypot(dx,dy)>4;
   this.users.set(u.userId,{...previous,...u,old:changed?(teleport?u.position:from):previous.old,at:changed?now:previous.at,
    ...(teleport?{visual:u.position,gait:0,phase:0,frameAt:now}:{}),
    facing:changed&&Math.abs(dx-dy)>.001?(dx-dy<0?'left':'right'):(previous?.facing||'right')});}

  petReaction(packet){const pet=this.staff.get(packet.staffId);if(!pet||!pet.species||packet.reaction!=='happy')return;pet.happyUntil=performance.now()+4000;this.bubble({userId:packet.staffId,text:'♥',mode:'pet'});}
  bubble(packet){this.bubbles.set(packet.userId,{text:packet.text,until:performance.now()+6000,mode:packet.mode});}
  draw(){
   if(!this.scene)return this.drawScene();
   const now=performance.now();for(const u of [...this.users.values(),...this.staff.values()])this.animate(u,now);
   if(!this.viewRotation)return this.drawScene();
   // Reuse cached room/furniture geometry. Only live avatar coordinates change per frame.
   const view=Object.create(this),mapUsers=source=>new Map([...source].map(([id,u])=>{const visual=this.toView(u.visual||u.position),old=this.toView(u.old),position=this.toView(u.position),dx=position.x-old.x,dy=position.y-old.y;return [id,{...u,visual,old,position,facing:Math.abs(dx-dy)>.001?(dx-dy<0?'left':'right'):u.facing,sourceUser:u}];}));
   view.sourceScene=this.scene;view.scene=this.cameraScene();view.worldTile=(x,y)=>this.fromView({x,y});view.users=mapUsers(this.users);view.staff=mapUsers(this.staff);view.selected=this.selected?this.toView(this.selected):null;
   view.placementResult=()=>this.placementResult();
   if(this.placement){const p=this.placement,check=this.placementResult(),item=this.viewItem({...p.item,x:p.x,y:p.y,z:check.z,rotation:p.rotation});Object.assign(p,{valid:check.valid,z:check.z,reason:check.reason});view.placement={...p,x:item.x,y:item.y,rotation:item.rotation};}
   view.drawScene();for(const key of ['cx','cy','scale','doorHit'])this[key]=view[key];this.hit=view.hit.map(h=>({...h,user:h.user.sourceUser||h.user}));
  }
  // Boundary vertices rotate with the floor, unlike tile centers (which use n - 1).
  roomVertex(x,y){const source=this.sourceScene||this.scene,rows=source.heightmap.split('\n'),n=rows[0].length,m=rows.length,q=this.viewRotation||0;
   const p=q===1?{x:m-y,y:x}:q===2?{x:n-x,y:m-y}:q===3?{x:y,y:n-x}:{x,y};return {x:(p.x-p.y)*18,y:(p.x+p.y)*9};
  }
  roomEdge(side){const origin=this.roomVertex(0,0),end=this.roomVertex(side===1?1:0,side===-1?1:0),a=(end.x-origin.x)/(side*18),b=(end.y-origin.y)/(side*18)-side*.5;
   return {a,b,x:origin.x,y:origin.y,front:a<0};
  }
  drawRoomShell(front){const c=this.c,source=this.sourceScene||this.scene,floor=source.heightmap.split('\n'),n=floor[0].length,m=floor.length,theme=source.theme,outside=theme==='rooftop'||theme==='patio';
   const height=58+Math.max(...floor.flatMap(row=>[...row].filter(v=>/[0-9]/.test(v)).map(Number)))*12;
   for(const side of [-1,1]){const edge=this.roomEdge(side);if(edge.front!==front)continue;
    const span=side===-1?m:n;c.save();c.transform(edge.a,edge.b,0,1,edge.x,edge.y);
    // Keep foreground walls attached, but translucent so players can see inside.
    if(front)c.globalAlpha=.28;
    if(!outside){
     const gradient=c.createLinearGradient(0,-58,side*span*18,span*9);
     gradient.addColorStop(0,theme==='lobby'?(side<0?'#c8ae7b':'#f0d5a0'):(side<0?'#527b89':'#8da3b9'));
     gradient.addColorStop(1,theme==='lobby'?(side<0?'#86654b':'#bb946c'):(side<0?'#294c64':'#586b8b'));
     poly(c,[[0,0],[side*span*18,span*9],[side*span*18,span*9-height],[0,-height]],gradient,side<0?'#203c53':'#304359');
     poly(c,[[0,-5],[side*span*18,span*9-5],[side*span*18,span*9],[0,0]],side<0?'#2b4558':'#40526d');
     if(side<0)for(let i=1;i<m-1;i+=2){const x=-i*18,y=i*9;poly(c,[[x,y-46],[x-27,y-32.5],[x-27,y+6],[x,y-7.5]],'#16394d18','#8dcac21c');}
     else for(let i=1;i<n-1;i+=3){const x=i*18,y=i*9-Number(floor[0][i]||0)*12;poly(c,[[x,y-43],[x+30,y-28],[x+30,y-10],[x,y-25]],'#234864','#cee5dc');poly(c,[[x+3,y-40],[x+27,y-28],[x+27,y-24],[x+3,y-36]],'#71e6d4');poly(c,[[x+4,y-33],[x+26,y-22],[x+26,y-14],[x+4,y-25]],'#102d4e');poly(c,[[x+14,y-35],[x+15,y-34.5],[x+15,y-19],[x+14,y-19.5]],'#b4d6de');}
     if(theme==='lobby')for(let i=1;i<span-2;i+=3){const wx=i*18*side,wy=i*9;
      poly(c,[[wx,wy-21],[wx+side*36,wy-3],[wx+side*36,wy+12],[wx,wy-6]],'#77503c','#e0b982');poly(c,[[wx+side*4,wy-16],[wx+side*32,wy-2],[wx+side*32,wy+7],[wx+side*4,wy-7]],'#a27851','#c59a64');
      if(side===1)for(const u of [0,27])poly(c,[[wx+u,wy-46+u/2],[wx+u+5,wy-43.5+u/2],[wx+u+5,wy-16+u/2],[wx+u,wy-21+u/2]],'#914c51','#d4a36d');
     }
     poly(c,[[0,-height+3],[side*span*18,span*9-height+3],[side*span*18,span*9-height+6],[0,-height+6]],theme==='lobby'?(side<0?'#ecd19c':'#ffe2a7'):(side<0?'#86f4d6':'#c1adf2'));
    }else{
     poly(c,[[0,0],[side*span*18,span*9],[side*span*18,span*9-16],[0,-16]],theme==='patio'?(side<0?'#967e5d':'#b29a72'):(side<0?'#65768f':'#8391a7'),'#253b4c');
     c.beginPath();c.moveTo(0,-31);c.quadraticCurveTo(side*span*9,span*4.5-17,side*span*18,span*9-31);c.strokeStyle='#354652';c.lineWidth=1;c.stroke();
     for(let i=0;i<=span;i++){const t=i/span,x=side*i*18,y=i*9-31+28*t*(1-t);c.fillStyle='#fae5a61a';c.beginPath();c.arc(x,y+3,6,0,Math.PI*2);c.fill();c.fillStyle=i%3===0?'#b6f4df':'#fae5a6';c.fillRect(x-1.5,y,3,4);}
    }
    if(side===-1){const row=floor.findIndex(row=>/[0-9]/.test(row)),col=row<0?-1:floor[row].search(/[0-9]/);
     if(col>=0){const dx=(col-row)*18,dy=(col+row)*9-Number(floor[row][col])*12;
      this.doorHit={x:edge.a*(dx-12)+edge.x,y:edge.b*(dx-12)+dy+edge.y};
      poly(c,[[dx,dy-49],[dx-25,dy-36.5],[dx-25,dy+12.5],[dx,dy]],'#d8c59a','#203b4b');poly(c,[[dx-3,dy-43],[dx-22,dy-33.5],[dx-22,dy+8.5],[dx-3,dy-1]],'#173b4b','#81e8ce');
      c.fillStyle='#f7d891';c.beginPath();c.arc(dx-7,dy-14,1.8,0,Math.PI*2);c.fill();
     }
    }
    c.restore();
   }
  }
  drawScene(){const c=this.c,w=this.width||this.canvas.width,h=this.height||this.canvas.height;c.setTransform(this.dpr||1,0,0,this.dpr||1,0,0);c.clearRect(0,0,w,h);if(!this.scene)return;const floor=this.scene.heightmap.split('\n'),n=floor[0].length,m=floor.length;
    const fit=Math.min(w/((n+m)*18+70),h/((n+m)*9+150));
    this.scale=(this.viewMode==='close'?Math.max(fit,Math.min(1.65,w/290)):fit)*this.zoom;
    this.cx=w/2+(m-n)*9*this.scale+this.offset.x;this.cy=(h-(n+m)*9*this.scale)/2+44*this.scale+this.offset.y;
    const me=this.users.get(this.localUserId);
    if(this.viewMode==='close'&&me){const {x:px,y:py,z}=me.visual;
     this.cx=w/2-(px-py)*18*this.scale+this.offset.x;this.cy=h*.55-((px+py)*9+9-z*12-20)*this.scale+this.offset.y;
    }
    c.save();c.translate(this.cx,this.cy);c.scale(this.scale,this.scale);c.imageSmoothingEnabled=false;
    const theme=this.scene.theme,outside=theme==='rooftop'||theme==='patio';
    // Ground the floating room with a soft, inexpensive ambient shadow.
    c.save();c.translate((n-m)*9,(n+m)*4.5+12);c.scale(1,.42);const ambient=c.createRadialGradient(0,0,15,0,0,(n+m)*10);ambient.addColorStop(0,'#030b20aa');ambient.addColorStop(1,'#030b2000');c.fillStyle=ambient;c.fillRect(-(n+m)*11,-(n+m)*11,(n+m)*22,(n+m)*22);c.restore();
    if(outside){
     // Scenery belongs to the two receding room edges, never a screen-wide banner.
     // Transparent atmosphere fades back into the canvas at every zoom and pan.
     const glow=c.createRadialGradient(0,-22,8,0,-22,Math.max(n,m)*20);
     glow.addColorStop(0,theme==='patio'?'#719d6625':'#8199d326');glow.addColorStop(1,'#45607000');
     c.fillStyle=glow;c.fillRect(-Math.max(n,m)*22,-Math.max(n,m)*22,Math.max(n,m)*44,Math.max(n,m)*44);
     if(theme==='rooftop'){
      // Separate, dimensional city silhouettes follow the terrace perspective.
      for(const side of [-1,1]){const span=side<0?m:n;
       for(let i=span-1;i>=2;i-=3){const bx=side*(i*18+30),by=i*9-24,height=20+(i*13+(side+1)*7)%34;
        c.save();c.globalAlpha=.30+(i%3)*.04;box(c,bx,by,1.1,.85,height,i%2?'#516c8d':'#435b7c');
        for(let z=8;z<height-3;z+=8)for(let q=0;q<2;q++){
         const wx=bx-12+q*6,wy=by+10+q*3-z;c.fillStyle=(i+q+z)%3?'#d8c493':'#93c8ce';c.fillRect(wx,wy,2,2.5);
        }c.restore();
       }
      }
      // A transparent crescent avoids a dark cutout patch on the sky.
      c.save();c.translate(65,-79);c.fillStyle='#e8d8b2';c.beginPath();c.arc(0,0,9,.45*Math.PI,1.55*Math.PI);c.quadraticCurveTo(-1,0,9*Math.cos(.45*Math.PI),9*Math.sin(.45*Math.PI));c.fill();c.restore();
      c.fillStyle='#bdd9e580';for(const [x,y]of [[-85,-82],[-36,-65],[20,-91],[112,-61],[-130,-48]])c.fillRect(x,y,1,1);
     }else{
      // Layered garden crowns are rooted just outside the diagonal boundary.
      for(const side of [-1,1]){const span=side<0?m:n;
       for(let i=span-1;i>=2;i-=3){
        const x=side*(i*18+18+(i*7)%9),base=i*9-7,scale=.72+((i*7)%5)*.065,top=base-45*scale;
        c.save();c.translate(x,top);c.scale(scale,scale);
        c.fillStyle='#69594a';c.fillRect(-2,24,4,21);c.strokeStyle='#69594a';c.lineWidth=2;c.beginPath();c.moveTo(0,39);c.lineTo(-10,25);c.moveTo(0,34);c.lineTo(11,19);c.stroke();
        const crown=[[-24,23],[-20,10],[-10,7],[-7,-3],[6,-7],[17,1],[20,13],[27,19],[24,32],[11,39],[-7,37],[-20,32]];
        poly(c,crown,i%2?'#355e50':'#294d45','#25453e');
        poly(c,[[-18,16],[-7,9],[-4,1],[5,-2],[12,5],[10,15],[-1,22],[-15,25]],'#47785c');
        poly(c,[[3,25],[13,17],[21,22],[17,31],[5,34]],'#3b6852');
        c.fillStyle='#69936d';for(const [dx,dy]of [[-10,14],[0,7],[8,14],[-14,23],[12,27]])c.fillRect(dx,dy,3,2);
        c.restore();
       }
      }
     }
    }
    this.drawRoomShell(false);
    const occupied=(x,y)=>x>=0&&y>=0&&x<n&&y<m&&!/[xX]/.test(floor[y][x]);
    for(let y=0;y<m;y++)for(let x=0;x<n;x++){
     if(!occupied(x,y))continue;
     const {x:ox,y:oy}=this.worldTile?.(x,y)||{x,y};
     const z=Number(floor[y][x]),px=(x-y)*18,py=(x+y)*9-z*12;
     const tint=theme==='patio'?((ox+oy)%2?'#adbb94':'#a2b28a'):theme==='rooftop'?((ox+oy)%2?'#929eb8':'#8490aa'):theme==='lobby'?((ox+oy)%2?'#dfceb2':'#d1bea0'):((ox+oy)%2?'#bdccca':'#afc2c1');
     poly(c,[[px,py],[px+18,py+9],[px,py+18],[px-18,py+9]],tint,'#7e989f');
     poly(c,[[px,py+1],[px+16,py+9],[px,py+17],[px-16,py+9]],'#ffffff06','#e9f8ec28');
     // Two restrained facets read as ceramic rather than a flat checkerboard.
     poly(c,[[px,py+1],[px+16,py+9],[px,py+10],[px-16,py+9]],'#ffffff0b');
     poly(c,[[px-16,py+10],[px,py+17],[px+16,py+10],[px,py+15]],'#18344e09');
     if(theme==='lobby'){
      const lounge=(ox>=1&&ox<=10&&oy>=5&&oy<=9)||(ox>=15&&ox<=20&&oy>=12&&oy<=17)||(ox>=13&&ox<=19&&oy>=18&&oy<=22);
      if(lounge){poly(c,[[px,py],[px+18,py+9],[px,py+18],[px-18,py+9]],'#985354','#b87b67');poly(c,[[px,py+5],[px+8,py+9],[px,py+13],[px-8,py+9]],'#c5926d');}
      else if((ox+oy)%4===0)poly(c,[[px,py+6],[px+6,py+9],[px,py+12],[px-6,py+9]],'#bda078');
     }else if(outside){
      // Fine decking with staggered joints, garden paths and a slate bar apron.
      const deck=theme==='rooftop'||(ox>1&&ox<11&&oy>1&&oy<11);
      if(deck){poly(c,[[px,py],[px+18,py+9],[px,py+18],[px-18,py+9]],theme==='patio'?'#b59c73':'#9a87a4','#665e71');
       for(const q of [.25,.5,.75]){c.beginPath();c.moveTo(px+q*18,py+q*9);c.lineTo(px+(q-1)*18,py+(q+1)*9);c.strokeStyle=theme==='patio'?'#d3ba8d':'#b8a5bc';c.lineWidth=.6;c.stroke();}}
      else if((x*7+y*11)%5===0){c.fillStyle='#d2d9aa';c.fillRect(px-1,py+8,2,2);}
     }
     if(ox===0||oy===0)poly(c,[[px,py],[px+18,py+9],[px,py+18],[px-18,py+9]],'#18344e18');
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
    const playingToys=new Set([...this.staff.values()].filter(u=>u.state==='play'&&u.species!=='rabbit').map(u=>u.toyId));const nodes=(this.scene.items||[]).filter(i=>i.id!==preview?.item.id&&!playingToys.has(i.id)).map(item=>({depth:furnitureDepth(item)-.3,item}));for(const u of [...this.users.values(),...this.staff.values()]){let depth=(u.visual||u.position).x+(u.visual||u.position).y+1;if(u.state==='sit'||u.state==='lay'){const seat=nodes.find(n=>{const i=n.item;if(!i)return false;const turned=i.rotation===2||i.rotation===6;return u.position.x>=i.x&&u.position.y>=i.y&&u.position.x<i.x+(turned?i.length:i.width)&&u.position.y<i.y+(turned?i.width:i.length);});if(seat)depth=Math.max(depth,seat.depth+.1);}nodes.push({depth,user:u});}nodes.sort((a,b)=>a.depth-b.depth);this.hit=[];
    const local=nodes.find(n=>n.user&&n.user.userId===this.localUserId),localPos=local?.user?.visual;
    for(const node of nodes){if(node.item){const i=node.item,ix=(i.x-i.y)*18,iy=(i.x+i.y)*9-i.z*12;
     // Fade foreground foliage only while it overlaps your avatar; collision and picking stay intact.
     const foliage=['palm','tree','plant','vine-screen'].includes(i.sprite||i.sprite_id),lx=localPos?(localPos.x-localPos.y)*18:0,ly=localPos?(localPos.x+localPos.y)*9+9-localPos.z*12:0;
     const obscures=foliage&&local&&node.depth>local.depth&&Math.abs(ix-lx)<29&&ly>iy-82&&ly-38<iy+18;
     c.save();if(obscures)c.globalAlpha=.28;decor(c,i,ix,iy);c.restore();
    }else{const u=node.user,{x:px,y:py,z}=u.visual;const x=(px-py)*18,y=(px+py)*9+9-z*12;if(u.userId===this.localUserId){c.strokeStyle='#93ffe1';c.lineWidth=1.5;c.beginPath();c.ellipse(x,y,13,5,0,0,Math.PI*2);c.stroke();}avatar(c,u,x,y);this.hit.push({x,y,user:u});}}
    if(preview){c.save();c.globalAlpha=.65;decor(c,{...preview.item,x:preview.x,y:preview.y,z:preview.z,rotation:preview.rotation},(preview.x-preview.y)*18,(preview.x+preview.y)*9-preview.z*12-5);c.restore();}
    this.drawRoomShell(true);
    c.restore();
    // Labels and speech use screen pixels, so they remain readable at every zoom.
    const bubbles=[];
    for(const hit of this.hit){const x=this.cx+hit.x*this.scale,y=this.cy+hit.y*this.scale;
     if(x<-40||x>w+40||y<-10||y>h+65)continue;
     if(!hit.user.species){
     const name=(hit.user.username||'You').slice(0,18)+(hit.user.species?' · '+hit.user.species:hit.user.isStaff?' · NPC':'');c.font='600 11px system-ui';c.textAlign='center';const labelWidth=c.measureText(name).width+12;
     c.fillStyle='#122c3ee6';c.fillRect(x-labelWidth/2,y+5,labelWidth,17);c.fillStyle=hit.user.isStaff?'#ffe0a0':hit.user.userId===this.localUserId?'#9bffe3':'#f2fff8';c.fillText(name,x,y+17);
     }
     const bubble=this.bubbles.get(hit.user.staffId||hit.user.userId);if(!bubble||bubble.until<=performance.now())continue;
     c.font=(bubble.mode==='shout'?'bold ':'')+'12px system-ui';const limit=Math.min(226,w-48);
     if(!bubble.layout||bubble.layout.limit!==limit){const lines=[];let line='';
      for(const word of bubble.text.split(/\s+/)){if(line&&c.measureText(line+' '+word).width>limit){lines.push(line);line='';}if(line)line+=' ';for(const char of word){if(c.measureText(line+char).width>limit){lines.push(line);line='';}line+=char;}}if(line)lines.push(line);
      if(lines.length>3){lines.length=3;lines[2]=lines[2].slice(0,-2)+'…';}
      bubble.layout={limit,lines,bw:Math.max(40,...lines.map(t=>c.measureText(t).width+16))};
     }
     const {lines,bw}=bubble.layout,bh=lines.length*16+12,bx=Math.max(8,Math.min(w-bw-8,x-bw/2));let by=Math.max(62,y-(hit.user.species?38:52)*this.scale-bh-8);
     for(const prior of bubbles){if(bx<prior.x+prior.w+4&&bx+bw>prior.x-4&&by<prior.y+prior.h+4&&by+bh>prior.y-4)by=Math.max(62,prior.y-bh-5);}
     bubbles.push({x:bx,y:by,w:bw,h:bh});c.fillStyle='#f8f0d9';c.fillRect(bx,by,bw,bh);c.strokeStyle='#364c55';c.lineWidth=1;c.strokeRect(bx+.5,by+.5,bw-1,bh-1);const tail=Math.max(bx+6,Math.min(bx+bw-12,x));poly(c,[[tail,by+bh],[tail+8,by+bh],[tail+3,by+bh+6]],'#f8f0d9');c.fillStyle='#203745';c.textAlign='left';lines.forEach((text,i)=>c.fillText(text,bx+8,by+19+i*16));
    }

  }
 }
 // Fit the complete rendered silhouette, including backs and tall details.
 const thumbnailStage=document.createElement('canvas');thumbnailStage.width=256;thumbnailStage.height=256;
 function thumbnail(canvas,item){
  canvas.width=160;canvas.height=128;
  const stage=thumbnailStage.getContext('2d');stage.setTransform(1,0,0,1,0,0);stage.clearRect(0,0,256,256);
  stage.imageSmoothingEnabled=false;stage.translate(128,152);stage.scale(1.5,1.5);decor(stage,item,0,0);
  const pixels=stage.getImageData(0,0,256,256).data;let left=256,top=256,right=-1,bottom=-1;
  for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(pixels[(y*256+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  if(right<left)return;
  const width=right-left+1,height=bottom-top+1,scale=Math.min(1,148/width,116/height),c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
  c.drawImage(thumbnailStage,left,top,width,height,(160-width*scale)/2,(128-height*scale)/2,width*scale,height*scale);
 }
 function roomThumbnail(canvas,heightmap,items=[],theme){
  canvas.width=300;canvas.height=210;
  const preview=Object.create(WorldRenderer.prototype);
  Object.assign(preview,{canvas,c:canvas.getContext('2d'),scene:{heightmap,items,theme},users:new Map(),staff:new Map(),bubbles:new Map(),offset:{x:0,y:0},zoom:1,hit:[]});preview.draw();
 }
 function decorPreview(canvas,item,options={}){canvas.width=360;canvas.height=220;const c=canvas.getContext('2d');c.fillStyle='#12243b';c.fillRect(0,0,360,220);c.save();c.translate(180,70);c.scale(1.5,1.5);for(let y=0;y<4;y++)for(let x=0;x<4;x++){const px=(x-y)*18,py=(x+y)*9;poly(c,[[px,py],[px+18,py+9],[px,py+18],[px-18,py+9]],(options.tone==='warm'?['#bda989','#d5c6a6']:options.tone==='garden'?['#739887','#91b39c']:['#78999d','#89abad'])[(x+y)%2],'#517780');}decor(c,{...item,x:1,y:1,z:0,rotation:item.rotation||0},0,18);c.restore();}
 function petPreview(canvas,pet){canvas.width=180;canvas.height=140;const c=canvas.getContext('2d');c.clearRect(0,0,180,140);c.save();c.translate(90,112);c.scale(2.8,2.8);animal(c,{...pet,facing:'right',gait:0},0,0);c.restore();}
 window.EarnlyWorldRenderer={WorldRenderer,thumbnail,roomThumbnail,decorPreview,petPreview};
})();
