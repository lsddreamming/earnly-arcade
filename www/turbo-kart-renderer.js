/* Earnly's original canvas art: perspective circuits, toy racers and course scenery.
   Everything is drawn locally. No Nintendo characters, textures or downloaded assets. */
const TurboKartRenderer=(()=>{
 const E=TurboKartEngine,TAU=Math.PI*2;
 function create(canvas){const ctx=canvas.getContext('2d',{alpha:false});let cameraAngle=null,lastTime=-1,lastTrack=null;const scenery=new Map();let driver=null;const poses=new WeakMap();let skidMarks=[];let skidTime=-1;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 function poly(points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();}
 function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fill();}
 function box(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
 function text(t,x,y,size,color,align='center'){ctx.fillStyle=color;ctx.font=`900 ${size}px system-ui`;ctx.textAlign=align;ctx.fillText(t,x,y);}
 function line(x,y,x2,y2,color,width){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
 function kart(r,scale,x,y,s,isPlayer){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);const turn=r.heading;ctx.rotate(turn*.28);
  const motion=reduced.matches?0:1,lean=(r.steer||0)*(r.drifting? .18:.10)*motion;
  let pose=poses.get(r);if(!pose){pose={drifting:false,hopAt:-1};poses.set(r,pose);}if(r.drifting&&!pose.drifting)pose.hopAt=s.time;pose.drifting=r.drifting;
  const hopAge=s.time-pose.hopAt,hop=hopAge>=0&&hopAge<.24?Math.sin(hopAge/.24*Math.PI)*3:0;
  ctx.translate(0,(-hop+(r.boost>0?-1.5:0))*motion);
  ellipse(0,0,27,6,'#10203866');
  if(r.boost>0||r.coinSurge>0){for(const side of [-1,1]){poly([{x:side*12-5,y:-4},{x:side*12+5,y:-4},{x:side*12,y:20+Math.sin(s.time*42)*5}],r.boost>0?'#7ffcff':'#ffd96d');poly([{x:side*12-3,y:-4},{x:side*12+3,y:-4},{x:side*12,y:11}],'#fffbaf');}}
  if(r.drifting){const color=['#d9faff','#59deff','#ffc15d','#e59aff'][E.tier(r.charge)];for(const side of [-1,1]){line(side*23,-5,side*30,4,color,2);for(let i=0;i<4;i++)ellipse(side*(25+i*3),4+(Math.sin(s.time*30+i)*5),1.8,1.8,color);}}
  // Chunky treaded tires, pearlescent body panels and a separate rear wing.
  for(const side of [-1,1]){box(side<0?-22:13,-33,9,14,3,'#16253a');box(side<0?-27:15,-19,12,20,4,'#142239');line(side*21,-16,side*21,-3,'#44536b',2);}
  poly([{x:-19,y:-30},{x:17,y:-30},{x:24,y:-7},{x:18,y:0},{x:-18,y:0},{x:-24,y:-7}],r.color);
  poly([{x:17,y:-30},{x:24,y:-7},{x:18,y:0},{x:15,y:-8}],'#173b5550');
  line(-18,-12,-14,-24,'#e4fff9',1.5);
  poly([{x:-19,y:-10},{x:19,y:-10},{x:17,y:-3},{x:-17,y:-3}],'#243754');
  poly([{x:-16,y:-30},{x:-4,y:-35},{x:7,y:-33},{x:17,y:-30},{x:10,y:-14},{x:-11,y:-14}],'#efffff');
  box(-13,-33,26,18,6,'#283854');box(-11,-36,22,19,7,r.color);line(-8,-31,8,-31,'#efffff',2);
  if(isPlayer&&driver){
   ctx.save();ctx.translate(0,-23);ctx.rotate(lean);ctx.translate((r.steer||0)*2*motion,r.boost>0?2*motion:0);
   // Feet and lap sit inside the cockpit; the back, hair, hat and pack face us.
   ctx.drawImage(driver.canvas,0,0,300,300,-29,-39,58,50);ctx.restore();
  }else{
  // Original little robot driver: two aerials, rounded helmet and turquoise visor.
  ellipse(turn*5,-42,12,12,'#19364d');ellipse(turn*5-1,-44,11,11,'#fff5df');ellipse(turn*5-1,-46,8,7,r.color);
  line(turn*5-1,-52,turn*5-1,-37,'#ffffff',2);box(turn*5-5,-39,8,3,1,'#7595a6');line(turn*5-4,-56,turn*5-4,-60,'#35445d',2);ellipse(turn*5-4,-61,2,2,r.color);
  }
  line(-15,-18,-18,-29,'#273c58',3);line(15,-18,18,-29,'#273c58',3);box(-25,-25,50,6,2,'#1c3450');box(-24,-26,48,3,1,r.color);
  box(-16,-9,7,3,1,'#ff5d76');box(9,-9,7,3,1,'#ff5d76');box(-5,-9,10,6,1,'#e9fff1');text(isPlayer?'E':r.name[0],0,-4,5,'#283c58');
  if(r.shield>0){ctx.strokeStyle='#a4fdff';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(0,-28,34,39,0,0,TAU);ctx.stroke();}
  if(r.slow>0){text('✦',-24,-49,12,'#ffe078');text('✦',23,-54,9,'#ffe078');}
  ctx.restore();
 }
 function prop(type,x,y,k,scene,index){ctx.save();ctx.translate(x,y);ctx.scale(k,k);ellipse(0,0,13,3,'#183b4b33');
  if(type==='tree'){if(scene==='harbor'){line(0,0,3,-37,'#bc8271',5);for(let j=0;j<5;j++){const a=j*1.2;poly([{x:3,y:-39},{x:Math.cos(a)*25,y:-39+Math.sin(a)*12},{x:Math.cos(a+.4)*12,y:-30+Math.sin(a)*9}],'#299b82');}}else{line(0,0,0,-31,'#50586f',4);for(let j=0;j<3;j++)ellipse((j-1)*8,-30-j*7,14,17,scene==='garden'?['#eaa4ec','#b6a1ff','#ffcee8'][j]:['#70bc77','#7fce83','#a5dd90'][j]);}}
  if(type==='rock'){poly([{x:-26,y:0},{x:-21,y:-35},{x:-12,y:-50},{x:10,y:-47},{x:24,y:-22},{x:29,y:0}],'#c97a83');poly([{x:-21,y:-35},{x:-12,y:-50},{x:10,y:-47},{x:3,y:-20},{x:-24,y:-16}],'#f8b18b');line(-20,-16,17,-12,'#ffc196',4);}
  if(type==='arch'){ctx.strokeStyle='#ce7d80';ctx.lineWidth=13;ctx.beginPath();ctx.moveTo(-23,0);ctx.lineTo(-23,-26);ctx.bezierCurveTo(-23,-57,23,-57,23,-26);ctx.lineTo(23,0);ctx.stroke();ctx.strokeStyle='#f9b88f';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-29,-2);ctx.lineTo(-29,-26);ctx.bezierCurveTo(-29,-61,25,-61,28,-29);ctx.stroke();}
  if(type==='tower'){box(-13,-45,26,45,2,scene==='garden'?'#414b86':'#f9d2aa');poly([{x:-17,y:-45},{x:0,y:-58},{x:17,y:-45}],scene==='garden'?'#a2a2ff':'#f37d8e');for(let j=0;j<3;j++){box(-8,-37+j*12,5,6,1,'#73e5ef');box(3,-37+j*12,5,6,1,'#73e5ef');}}
  if(type==='crystal'){poly([{x:0,y:-38},{x:12,y:-17},{x:0,y:1},{x:-12,y:-17}],'#8bfbea');poly([{x:0,y:-38},{x:0,y:1},{x:-12,y:-17}],'#ae9cff');}
  if(type==='umbrella'){line(0,0,0,-22,'#fff1d7',2);poly([{x:-23,y:-22},{x:0,y:-37},{x:23,y:-22}],index%2?'#ff9dac':'#aaffdc');ellipse(0,-1,10,2,'#ffdeaa');}
  ctx.restore();
 }
 function render(s,{idle=false}={}){const rect=canvas.getBoundingClientRect(),w=Math.max(1,rect.width),h=Math.max(1,rect.height),dpr=Math.min(window.devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);
  const t=s.track,p=s.racers[0],pos=E.sample(p.d,p.lane,t),target=pos.angle+p.heading*.38;
  if(cameraAngle===null||s.time<lastTime||lastTrack!==t.id)cameraAngle=target;
  const delta=Math.max(0,Math.min(.1,s.time-lastTime));cameraAngle+=Math.atan2(Math.sin(target-cameraAngle),Math.cos(target-cameraAngle))*(1-Math.exp(-delta*9));lastTime=s.time;lastTrack=t.id;
  const f=Math.min(w*.92,h*.88)*(p.boost>0&&!reduced.matches?.94:1),horizon=h*.30,back=58,camHeight=h*.54*back/f;
  const forward={x:Math.cos(cameraAngle),y:Math.sin(cameraAngle)},right={x:-forward.y,y:forward.x},cam={x:pos.x-forward.x*back,y:pos.y-forward.y*back};
  function project(v,z=0){const dx=v.x-cam.x,dy=v.y-cam.y,depth=dx*forward.x+dy*forward.y,k=f/Math.max(depth,1);return {x:w/2+(dx*right.x+dy*right.y)*k,y:horizon+(camHeight-z)*k,k,depth};}
  const sky=ctx.createLinearGradient(0,0,0,horizon);sky.addColorStop(0,t.sky[0]);sky.addColorStop(1,t.sky[1]);ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);ellipse(w*.74,horizon*.48,25,25,t.scene==='garden'?'#fff3dc':'#fff4c6');
  if(t.scene==='garden'){for(let i=0;i<32;i++)ellipse((i*97)%w,12+(i*41)%Math.max(20,horizon*.8),1,1,'#ffe7ff');}
  else{for(let i=0;i<5;i++){const x=((i*w*.31-cameraAngle*35)%(w+180)+w+180)%(w+180)-80,y=30+(i%3)*horizon*.18;ellipse(x,y,32,10,'#ffffffb0');ellipse(x+18,y-7,23,14,'#ffffffb0');}}
  for(let layer=0;layer<2;layer++){const points=[{x:0,y:horizon+10}];for(let x=0;x<=w+20;x+=20)points.push({x,y:horizon-12-layer*10-Math.sin(x*.012+cameraAngle+layer*3)*(18+layer*6)-Math.cos(x*.029+layer)*10});points.push({x:w+20,y:horizon+25});poly(points,t.scene==='canyon'?['#d48d98','#e6a48c'][layer]:t.scene==='garden'?['#6460a0','#727cb3'][layer]:['#6fbbaf','#98d3b8'][layer]);}
  ctx.fillStyle=t.ground;ctx.fillRect(0,horizon+14,w,h-horizon);
  if(t.scene==='harbor'){ctx.fillStyle='#58c4d7';ctx.fillRect(0,horizon+12,w,Math.max(10,h*.1));for(let i=0;i<8;i++)line((i*89+s.time*2)%w,horizon+23+i*4,(i*89+s.time*2)%w+35,horizon+23+i*4,'#a9e9de',1);}
  // Flat ground is a separate pass: a wide, near road quad must never cover a kart.
  if(s.time<skidTime||s.time===0){skidMarks=[];skidTime=-1;}if(s.time>skidTime){for(const r of s.racers)if(r.drifting)skidMarks.push({d:r.d,lane:r.lane,time:s.time});skidTime=s.time;}skidMarks=skidMarks.filter(v=>s.time-v.time<1.3).slice(-240);
  const ground=[],decals=[],queue=[],labels=[];let roadLayer=null;
  function add(depth,draw,layer=queue){if(depth>4&&depth<820)layer.push({depth,draw});}
  function ribbon(d1,d2,left,rightOffset,color){const a=project(E.sample(d1,left,t)),b=project(E.sample(d1,rightOffset,t)),c=project(E.sample(d2,rightOffset,t)),d=project(E.sample(d2,left,t));if(Math.min(a.depth,b.depth,c.depth,d.depth)<4)return;const draw=()=>{poly([a,b,c,d],color);if(left===-51&&rightOffset===51){ctx.strokeStyle=color;ctx.lineWidth=1.6;ctx.stroke();}};if(roadLayer)roadLayer.push(draw);else add((a.depth+c.depth)/2,draw,decals);}
  const segment=10,start=Math.floor((p.d-70)/segment)*segment;
  for(let i=0;i<78;i++){const d=start+i*segment,next=d+segment,alt=Math.floor(d/20)%2===0;roadLayer=[];
   ribbon(d,next,-65,65,alt?t.ground:(t.scene==='canyon'?'#edb781':t.scene==='garden'?'#3c918b':'#69c16c'));
   ribbon(d,next,-57,57,alt?'#fff2e4':t.curb);const boardwalk=t.scene==='harbor'&&((d%t.length+t.length)%t.length)/t.length>.43&&((d%t.length+t.length)%t.length)/t.length<.56;ribbon(d,next,-51,51,boardwalk?(alt?'#b88d83':'#ad8077'):t.road);
   ribbon(d,next,-49,-48,'#fff3d9');ribbon(d,next,48,49,'#fff3d9');
   if(Math.floor(d/25)%2===0)for(const lane of [-17,17])ribbon(d,next,lane-.45,lane+.45,'#d1dae29c');
   const mod=((d%t.length)+t.length)%t.length;if(mod<15){for(let cell=0;cell<10;cell++)ribbon(d,next,-50+cell*10,-40+cell*10,(cell+i)%2?'#f3ffef':'#253047');}
   const layers=roadLayer;roadLayer=null;add(project(E.sample(d+5,0,t)).depth,()=>{for(const draw of layers)draw();},ground);
  }
  for(const mark of skidMarks)for(const side of [-1,1]){const q=project(E.sample(mark.d,mark.lane+side*9,t)),tail=project(E.sample(mark.d-2,mark.lane+side*9,t));add(q.depth,()=>line(q.x,q.y,tail.x,tail.y,'#17263a38',Math.max(.5,1.2*q.k)),decals);}
  // Curbs, booster strips and airborne pickups all share the road's projection.
  for(const pad of s.pads){const d=p.d+((pad.d-p.d)%t.length+t.length)%t.length;ribbon(d-12,d+12,pad.lane-17,pad.lane+17,'#2c7c88');for(let j=0;j<3;j++){const q=project(E.sample(d-8+j*8,pad.lane,t));add(q.depth,()=>text('❯❯',q.x,q.y,Math.max(2,8*q.k),'#c7ff8b'),decals);}}
  for(const item of s.pickups){let d=p.d+((item.d-p.d)%t.length+t.length)%t.length;if(item.takenLap===Math.floor(d/t.length))continue;const q=project(E.sample(d,item.lane,t),5+Math.sin(s.time*3+item.d)*1.5);add(q.depth,()=>{const size=5.5*q.k;if(q.x<-size||q.x>w+size)return;if(item.type==='coin'){ellipse(q.x,q.y,size*.7,size,'#ffd96d');ellipse(q.x,q.y,size*.45,size*.72,'#ffed9b');text('◇',q.x,q.y+size*.4,size*1.2,'#b5754b');}else{poly([{x:q.x,y:q.y-size*1.4},{x:q.x+size,y:q.y},{x:q.x,y:q.y+size*1.4},{x:q.x-size,y:q.y}],'#a4ffed');poly([{x:q.x,y:q.y-size*1.4},{x:q.x,y:q.y+size*1.4},{x:q.x-size,y:q.y}],'#9479eb');text('ϟ',q.x,q.y+size*.45,size*1.3,'#fff9d7');}});}
  // Keep every prop clear of the whole circuit, including the inside of hairpins.
  // Cache placement once; the extra clearance also leaves room to recover off-road.
  if(!scenery.has(t.id)){const props=[];for(let i=0;i<84;i++){const d=i*t.length/84,offset=(i%2?1:-1)*(124+(i%3)*33),v=E.sample(d,offset,t);if(t.points.some(q=>Math.hypot(v.x-q.x,v.y-q.y)<112))continue;const type=t.scene==='canyon'?['rock','tower','rock','arch','rock','tower','rock'][i%7]:t.scene==='garden'?(i%4?'tree':'crystal'):(i%5===0?'tower':i%3===0?'umbrella':'tree');props.push({d,v,type,index:i,size:.58+(i%5)*.065});}scenery.set(t.id,props);}
  for(const v of scenery.get(t.id)){const gap=((v.d-p.d)%t.length+t.length)%t.length;if(gap>650)continue;const q=project(v.v);add(q.depth,()=>{if(q.x>-60*q.k&&q.x<w+60*q.k)prop(v.type,q.x,q.y,q.k*v.size,t.scene,v.index);});}
  // Trackside arrow boards make the upcoming corner readable without watching the map.
  for(let i=0;i<14;i++){const d=i*t.length/14,gap=((d-p.d)%t.length+t.length)%t.length,bend=E.curvature(d,t);if(Math.abs(bend)<.002||gap>500)continue;const q=project(E.sample(p.d+gap,-Math.sign(bend)*69,t),6);add(q.depth,()=>{box(q.x-12*q.k,q.y-13*q.k,24*q.k,13*q.k,2*q.k,'#233e61');text(bend>0?'››':'‹‹',q.x,q.y-2*q.k,15*q.k,'#fff5ac');});}
  for(const h of s.hazards){const q=project(E.sample(h.d,h.lane,t));add(q.depth,()=>{ellipse(q.x,q.y,14*q.k,4*q.k,'#382e78');ellipse(q.x-4*q.k,q.y-q.k,7*q.k,2*q.k,'#aa89e7');},decals);}
  for(const v of s.projectiles){const q=project(E.sample(v.d,v.lane,t),7);add(q.depth,()=>{ellipse(q.x,q.y,5*q.k,5*q.k,'#91fcff');text('ϟ',q.x,q.y+3*q.k,10*q.k,'#fff4cc');});}
  for(const v of s.effects){const q=project(E.sample(v.d,v.lane,t),2);add(q.depth,()=>{if(v.type==='coin'){const age=.5-v.life;for(let i=0;i<8;i++){const a=i*TAU/8;ellipse(q.x+Math.cos(a)*age*36*q.k,q.y-12*q.k+Math.sin(a)*age*20*q.k,Math.max(.5,v.life*3*q.k),Math.max(.5,v.life*3*q.k),'#ffe790');}return;}ctx.strokeStyle='#e3b9ff';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(q.x,q.y,(.7-v.life)*90*q.k,(.7-v.life)*20*q.k,0,0,TAU);ctx.stroke();});}
  for(let i=0;i<s.racers.length;i++){const r=s.racers[i],q=project(E.sample(r.d,r.lane,t));add(q.depth,()=>{if(q.x<-60*q.k||q.x>w+60*q.k)return;kart(r,q.k*.43,q.x,q.y,s,i===0);if(i&&q.depth>80&&q.depth<320)labels.push({name:r.name,x:q.x,y:q.y-28*q.k,size:Math.max(9,3*q.k),depth:q.depth});});}
  for(const layer of [ground,decals,queue]){layer.sort((a,b)=>b.depth-a.depth);for(const entry of layer)entry.draw();}
  // Keep the nearest readable names; omit farther labels that collide on screen.
  // Screen-space bounds matter here because separated world positions still project
  // to the same few pixels near the horizon.
  const occupied=[];
  for(const label of labels.sort((a,b)=>a.depth-b.depth)){
   ctx.font=`900 ${label.size}px system-ui`;
   const width=ctx.measureText(label.name).width+10,height=label.size+8;
   const bounds={left:label.x-width/2,right:label.x+width/2,top:label.y-label.size-4,bottom:label.y+4};
   if(bounds.left<4||bounds.right>w-4||bounds.top<Math.max(105,h*.22)||bounds.bottom>h-40||occupied.some(b=>bounds.left<b.right+5&&bounds.right>b.left-5&&bounds.top<b.bottom+5&&bounds.bottom>b.top-5))continue;
   occupied.push(bounds);box(bounds.left,bounds.top,width,height,4,'#142640c9');text(label.name,label.x,label.y,label.size,'#fff9ee');
  }
  if(p.boost>0&&!reduced.matches){for(let i=0;i<9;i++){const side=i%2?1:-1,x=w/2+side*(w*.35+i*7),y=h*.48+(i*53+s.time*240)%(h*.5);line(x,y,x+side*12,y+30,'#e1fffd85',2);}}
  // Compact whole-course map, with a clear player marker and finish flag.
  const mw=Math.min(100,w*.24),mh=mw*.82,ox=w-mw-12,oy=14;box(ox,oy,mw,mh,12,'#142640b8');ctx.save();ctx.translate(ox+mw/2,oy+mh/2);const scale=mw/1050;ctx.scale(scale,scale);ctx.beginPath();t.points.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.closePath();ctx.lineWidth=18;ctx.strokeStyle='#f0f5ec90';ctx.stroke();for(let i=4;i>=0;i--){const q=E.sample(s.racers[i].d,0,t);ellipse(q.x,q.y,i?23:34,i?23:34,i?s.racers[i].color:'#fffce5');if(!i)ellipse(q.x,q.y,17,17,'#49dabe');}ctx.restore();
  if(!idle&&!(s.callout&&s.time<=s.calloutUntil)){const bend=E.curvature(p.d+95,t);if(Math.abs(bend)>.003){const label=bend>0?'RIGHT BEND ›':'‹ LEFT BEND',size=Math.max(10,Math.min(13,w/35));box(w/2-64,horizon*.68-size-4,128,size+12,9,'#142640c9');text(label,w/2,horizon*.68,size,'#fff5d8');}}
 }
 return {render,setDriver(value){driver=value;}};
 }return {create};
})();
