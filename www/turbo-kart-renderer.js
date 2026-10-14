/* Canvas artwork drawn specifically for Earnly Turbo Kart. */
const TurboKartRenderer=(()=>{
 function create(canvas){let ctx=canvas.getContext('2d');const E=TurboKartEngine;let background=null;
 const scenery=Array.from({length:75},(_,i)=>({x:Math.sin(i*29.7)*640,y:Math.cos(i*13.1)*520,size:10+(i%5)*4}));
 function path(){ctx.beginPath();E.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}
 function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
 function label(text,x,y,size,color){ctx.fillStyle=color;ctx.font=`800 ${size}px system-ui`;ctx.textAlign='center';ctx.fillText(text,x,y);}
 function render(s,{idle=false}={}){
 const rect=canvas.getBoundingClientRect(),w=Math.max(1,rect.width),h=Math.max(1,rect.height),dpr=Math.min(window.devicePixelRatio||1,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const p=s.racers[0],pos=E.sample(p.d,p.lane),scale=idle?Math.min(w/1080,h/980):Math.min(w/480,h/480);
 ctx.fillStyle='#173f48';ctx.fillRect(0,0,w,h);ctx.save();ctx.translate(w/2,h*(idle?.49:.55));ctx.scale(scale,scale);ctx.translate(idle?0:-pos.x,idle?0:-pos.y);
 if(!background){const display=ctx;background=document.createElement('canvas');background.width=1800;background.height=1600;ctx=background.getContext('2d');ctx.translate(900,800);ctx.fillStyle='#173f48';ctx.fillRect(-900,-800,1800,1600);
 // Harbor water, ripples and the circuit island.
 ctx.strokeStyle='#23515b';ctx.lineWidth=2;for(let y=-850;y<850;y+=30){ctx.beginPath();for(let x=-1000;x<1000;x+=20){const yy=y+Math.sin(x*.02+y)*3; x===-1000?ctx.moveTo(x,yy):ctx.lineTo(x,yy);}ctx.stroke();}
 path();ctx.fillStyle='#32675a';ctx.fill();ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='#1b3037';ctx.lineWidth=180;ctx.stroke();ctx.strokeStyle='#d2b586';ctx.lineWidth=166;ctx.stroke();ctx.strokeStyle='#759877';ctx.lineWidth=150;ctx.stroke();
 // Infield plaza and clubhouse.
 ctx.fillStyle='#b3a780';ctx.fillRect(-190,-140,220,190);ctx.fillStyle='#6f9a7c';ctx.fillRect(-177,-128,194,166);
 for(let i=0;i<3;i++){ctx.fillStyle='#173f43';ctx.fillRect(-126+i*53,-83,40,62);ctx.fillStyle=['#e8b584','#9cc1b0','#c5aed0'][i];ctx.fillRect(-131+i*53,-92,40,58);ctx.fillStyle='#426e70';ctx.fillRect(-124+i*53,-83,26,18);}
 label('EARNLY',-75,8,23,'#daecc6');label('MOTOR CLUB',-75,27,10,'#d3dfc3');circle(122,-105,48,'#234b4d');circle(122,-109,42,'#579b9a');circle(122,-110,26,'#77bbaf');
 for(const t of scenery){let nearest=Infinity;for(let j=0;j<E.points.length;j+=6)nearest=Math.min(nearest,Math.hypot(t.x-E.points[j].x,t.y-E.points[j].y));if(nearest<96||Math.abs(t.x)<210&&Math.abs(t.y)<150||Math.abs(t.x)>470||Math.abs(t.y)>380)continue;
 circle(t.x+4,t.y+7,t.size,'#193e3b');circle(t.x,t.y,t.size,'#377b5b');circle(t.x-4,t.y-4,t.size*.7,'#67a56d');}
 // Red/cream curbs, asphalt, and broken lane markers.
 path();ctx.strokeStyle='#f1d6ac';ctx.lineWidth=118;ctx.stroke();ctx.setLineDash([16,16]);ctx.strokeStyle='#c96f68';ctx.stroke();ctx.setLineDash([]);path();ctx.strokeStyle='#34474d';ctx.lineWidth=104;ctx.stroke();path();ctx.strokeStyle='#4a6063';ctx.lineWidth=86;ctx.stroke();path();ctx.strokeStyle='#9eafa1';ctx.lineWidth=2;ctx.setLineDash([14,22]);ctx.stroke();ctx.setLineDash([]);
 const start=E.sample(0);ctx.save();ctx.translate(start.x,start.y);ctx.rotate(start.angle);for(let i=0;i<8;i++)for(let j=0;j<2;j++){ctx.fillStyle=(i+j)%2?'#17343d':'#edf2d6';ctx.fillRect(j*8-8,i*13-52,8,13);}ctx.restore();
 for(const pad of s.pads){const t=E.sample(pad.d,pad.lane);ctx.save();ctx.translate(t.x,t.y);ctx.rotate(t.angle);ctx.fillStyle='#346b60';ctx.fillRect(-22,-20,44,40);ctx.strokeStyle='#b8ff70';ctx.lineWidth=4;for(let x=-12;x<=12;x+=12){ctx.beginPath();ctx.moveTo(x-4,-12);ctx.lineTo(x+4,0);ctx.lineTo(x-4,12);ctx.stroke();}ctx.restore();}
ctx=display;}
 ctx.drawImage(background,-900,-800);
 const lap=Math.max(0,Math.floor(p.d/E.length));for(const pick of s.pickups){if(pick.takenLap===lap)continue;const t=E.sample(pick.d,pick.lane);if(pick.type==='coin'){circle(t.x,t.y,10,'#a06b37');circle(t.x,t.y-2,9,'#ffdc82');label('◇',t.x,t.y+2,13,'#8c632c');}else{ctx.save();ctx.translate(t.x,t.y);ctx.rotate(Math.PI/4);ctx.fillStyle='#78e8d5';ctx.fillRect(-11,-11,22,22);ctx.restore();label('?',t.x,t.y+5,16,'#1e525b');}}
 for(let i=4;i>=0;i--){const r=s.racers[i],t=E.sample(r.d,r.lane);ctx.save();ctx.translate(t.x,t.y);ctx.rotate(t.angle+(i===0&&s.wasDrifting?Math.sign(r.lane)*.23:0));
 if(r.boost>0){ctx.fillStyle='#b8ff70';ctx.beginPath();ctx.moveTo(-14,-7);ctx.lineTo(-30-Math.sin(s.time*30)*6,0);ctx.lineTo(-14,7);ctx.fill();}
 if(r.shield>0){ctx.strokeStyle='#a3e9ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,24,0,7);ctx.stroke();}
 ctx.fillStyle='#142b30';ctx.fillRect(-14,-14,9,7);ctx.fillRect(6,-14,8,7);ctx.fillRect(-14,7,9,7);ctx.fillRect(6,7,8,7);ctx.fillStyle=r.color;ctx.beginPath();ctx.roundRect(-17,-9,35,18,6);ctx.fill();ctx.fillStyle='#21494c';ctx.fillRect(5,-7,5,14);circle(-3,0,7,'#f1c69a');circle(-2,0,5,i?'#334b58':'#faf4df');ctx.fillStyle='#eef7dc';ctx.fillRect(15,-7,3,4);ctx.fillRect(15,3,3,4);ctx.restore();
 label(r.name,t.x,t.y-27,9,i?'#e2eee3':'#beff83');if(i===0){ctx.fillStyle='#b8ff70';ctx.beginPath();ctx.moveTo(t.x-4,t.y-23);ctx.lineTo(t.x+4,t.y-23);ctx.lineTo(t.x,t.y-18);ctx.fill();}}
 ctx.restore();
 if(!idle){ // Whole-course minimap keeps upcoming turns legible with the follow camera.
 const mw=100,mh=80;ctx.save();ctx.translate(12,12);ctx.fillStyle='#082a32df';ctx.beginPath();ctx.roundRect(0,0,mw,mh,10);ctx.fill();ctx.translate(mw/2,mh/2);ctx.scale(.105,.105);path();ctx.strokeStyle='#7faca4';ctx.lineWidth=17;ctx.stroke();for(let i=4;i>=0;i--){const t=E.sample(s.racers[i].d);circle(t.x,t.y,i?19:28,s.racers[i].color);}ctx.restore();}
 }
 return {render};
 }return {create};
})();
