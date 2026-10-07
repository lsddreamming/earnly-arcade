(() => { 'use strict';
// Procedural art stays crisp at every phone resolution without downloading textures.
function create(ctx,point,box,line,poly,tile){
 let glowBudget=0;const beginFrame=()=>{glowBudget=32};
 const tones=new Map();
 function tint(color,amount){const key=color+':'+amount;if(tones.has(key))return tones.get(key);const n=parseInt(color.slice(1,7),16),v=[n>>16,(n>>8)&255,n&255].map(k=>Math.round(amount>0?k+(255-k)*amount:k*(1+amount)));const result='#'+v.map(k=>Math.max(0,Math.min(255,k)).toString(16).padStart(2,'0')).join('');tones.set(key,result);return result}
 function metal(points,color,top=false){const xs=points.map(p=>p.x),ys=points.map(p=>p.y),g=ctx.createLinearGradient(Math.min(...xs),Math.min(...ys),Math.max(...xs)+1,Math.max(...ys)+1);g.addColorStop(0,tint(color,top?.38:.15));g.addColorStop(.42,color);g.addColorStop(1,tint(color,top?-.18:-.32));poly(points,g,top?'#d2e8f077':'#64859b44')}
 function aura(p,c,rx,ry,power=.22){if(rx<=0||ry<=0)return;ctx.save();ctx.translate(p.x,p.y);ctx.scale(rx,ry);const g=ctx.createRadialGradient(-.15,-.1,0,0,0,1);g.addColorStop(0,c+'88');g.addColorStop(.35,c+'44');g.addColorStop(1,c+'00');ctx.globalAlpha*=power;ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore()}
 function sphere(p,rx,ry,color){ctx.save();const g=ctx.createRadialGradient(p.x-rx*.35,p.y-ry*.4,1,p.x,p.y,Math.max(rx,ry));g.addColorStop(0,tint(color,.65));g.addColorStop(.36,tint(color,.18));g.addColorStop(1,tint(color,-.65));ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#d8f4ff55';ctx.lineWidth=.7;ctx.stroke();ctx.restore()}

 const ring=(p,x,y,c,w=1)=>{ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.ellipse(p.x,p.y,x,y,0,0,Math.PI*2);ctx.stroke()};
 const light=(p,c,r=2)=>{if(r<=0)return;ctx.save();if(glowBudget-->0)aura(p,c,r*4,r*4,.65);ctx.fillStyle=c;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.restore()};
 const raised=(x,y,r,h,color,z=0)=>{
  const a=point(x-r,y-r,z),b=point(x+r,y-r,z),c=point(x+r,y+r,z),d=point(x-r,y+r,z),aa=point(x-r,y-r,h+z),bb=point(x+r,y-r,h+z),cc=point(x+r,y+r,h+z),dd=point(x-r,y+r,h+z);
  if(r>=.16){metal([b,c,cc,bb],'#29465d');metal([c,d,dd,cc],'#152d43');metal([aa,bb,cc,dd],color,true)}else{poly([b,c,cc,bb],'#29465d','#64859b44');poly([c,d,dd,cc],'#152d43','#64859b44');poly([aa,bb,cc,dd],color,'#d2e8f077')}line(aa,bb,'#e4f6ff99');line(bb,cc,'#c1dae555');if(r>.3){tile(x,y,r*.82,null,'#d3ecf52b',h+z+.005);line(point(x-r*.82,y+r,h+z-.08),point(x+r*.82,y+r,h+z-.08),'#020b1866')}
 };
 // Sparse surface detail uses world coordinates, so it remains stable while panning.
 function hull(x,y,r,h,color,z=0){
  const cut=r*.3,shape=[[-r,-r+cut],[-r+cut,-r],[r-cut,-r],[r,-r+cut],[r,r-cut],[r-cut,r],[-r+cut,r],[-r,r-cut]],bottom=shape.map(([a,b])=>point(x+a,y+b,z)),top=shape.map(([a,b])=>point(x+a,y+b,z+h));
  for(let j=2;j<7;j++){const k=(j+1)%8;metal([bottom[j],bottom[k],top[k],top[j]],j<4?'#38556a':'#203b50');line(point(x+shape[j][0],y+shape[j][1],z+h*.72),point(x+shape[k][0],y+shape[k][1],z+h*.72),'#a9ccd04d')}
  metal(top,color,true);poly(shape.map(([a,b])=>point(x+a*.88,y+b*.88,z+h+.015)),null,'#d7eef655');line(top[0],top[1],'#e1faff88',1.5);line(top[1],top[2],'#e1faff88',1.5);
 }
 function terrain(x,y){
  const h=(x*29+y*17)%47;
  // Broad floor plates and worn seams replace the prominent checkerboard.
  if(x%4===0&&y%4===0){tile(x+1.8,y+1.8,1.72,null,'#91b5c214');line(point(x+.18,y+.2),point(x+3.4,y+.2),'#bcdce519')}
  if(h===31){const q=point(x+.5,y+.5);aura(q,'#8ab0c0',12,5,.07)}

  if(h<3){tile(x+.5,y+.5,.36,'#29425466','#65899533');for(let j=0;j<3;j++)line(point(x+.24,y+.3+j*.18),point(x+.76,y+.3+j*.18),'#07172299',1)}
  if(h===7){line(point(x+.1,y+.2),point(x+.6,y+.4),'#06111b',1.5);line(point(x+.6,y+.4),point(x+.85,y+.75),'#06111b',1.5);line(point(x+.12,y+.17),point(x+.62,y+.37),'#819bab22')}
  if(x%8===0&&y%4===0){for(const d of [.15,.85]){line(point(x+d-.055,y+d),point(x+d+.055,y+d),'#b4cdd54d',1);line(point(x+d,y+d-.055),point(x+d,y+d+.055),'#b4cdd54d',1)}}
  if(h===14){tile(x+.5,y+.5,.27,'#101e2c','#415a6d55');tile(x+.5,y+.5,.16,'#20384a','#89d6e02b');line(point(x+.4,y+.45),point(x+.6,y+.45),'#85e8f766')}
  // Maintenance lanes and inset plates break up the floor without hiding units.
  if(y%10===4){line(point(x+.08,y+.5),point(x+.7,y+.5),'#799bac22');if(x%3===0)tile(x+.85,y+.5,.035,'#bcce9d55')}
  if(h===23){for(const side of [-1,1]){const q=point(x+.5+side*.3,y+.5);ctx.fillStyle='#a1bdc333';ctx.fillRect(q.x,q.y,1,1)}}
 }
 function crystal(o,t,zoom){
  const bright=o.rich?'#ffc7f7':'#c9ffff',mid=o.rich?'#dd70dc':'#65d9ee',dark=o.rich?'#7a318f':'#17728f';
  for(let j=0;j<3;j++){
   const q=point(o.x+(j-1)*.27,o.y+(j%2)*.25),h=zoom*(j===1?1.13:.78),r=zoom*.19;
   const tip={x:q.x-r*.12,y:q.y-h},left={x:q.x-r,y:q.y-h*.56},right={x:q.x+r,y:q.y-h*.6},foot={x:q.x,y:q.y};
   poly([tip,left,{x:q.x-r*.8,y:q.y},foot],dark,mid);metal([tip,foot,{x:q.x+r*.8,y:q.y},right],mid,true);
   poly([tip,left,{x:q.x+r*.2,y:q.y-h*.42},right],o.rich?'#f6a8ec':'#a2f4fa',bright);
   line(tip,foot,bright,1);line({x:q.x+r*.3,y:q.y-h*.35},{x:q.x+r*.45,y:q.y-h*.16},bright+'88');
   tile(o.x+(j-1)*.27,o.y+(j%2)*.25,.13,'#0a202dcc',null,.015);
  }
  for(let j=0;j<3;j++){const q=point(o.x+Math.sin(t*.5+j)*.45,o.y+Math.cos(t*.5+j)*.35,.15+(t*.2+j*.3)%1);ctx.fillStyle=bright+'aa';ctx.fillRect(q.x,q.y,1.5,1.5)}
 }
 function machinery(o,c){
  const r=CrystalCommand.TYPES[o.type].radius;
  // Recessed front panels give every structure a readable industrial facade.
  if(r>=.65){for(let j=0;j<3;j++){const x=o.x-r*.52+j*r*.5,y=o.y+r*.83;
   poly([point(x-.07,y,.24),point(x+.07,y,.24),point(x+.07,y,.38),point(x-.07,y,.38)],'#071424','#7599b455');
   line(point(x-.055,y,.32),point(x+.055,y,.32),c+'99');
  }for(const side of [-1,1]){line(point(o.x+side*r*.88,o.y+r*.3,.1),point(o.x+side*r*.88,o.y+r*.66,.1),'#c8dfdf88',2)}}
  if(o.type==='base'||o.type==='factory'){
   for(const side of [-1,1]){const x=o.x+side*(o.type==='base'?.52:.57),y=o.y+(o.type==='base'?.79:.81);for(let j=0;j<3;j++)line(point(x-.08,y,.32+j*.06),point(x+.08,y,.32+j*.06),'#102534',1.5)}
   for(const side of [-1,1]){tile(o.x+side*r*.77,o.y+r*.72,.045,'#cbe3ec',null,.03);line(point(o.x+side*r*.7,o.y+r+.16),point(o.x+side*r*.3,o.y+r+.16),c+'88',1.5)}
   for(let j=0;j<3;j++)line(point(o.x-.28+j*.19,o.y-.25,.85),point(o.x-.28+j*.19,o.y+.12,.85),'#10273988',2);
  }
  if(o.type==='relay'){for(const d of [-.2,.2]){line(point(o.x+d,o.y,.25),point(o.x+d,o.y,.72),c+'77');tile(o.x+d,o.y+.12,.045,'#d0e6f0',null,.12)}}
  if(o.type==='lab'){for(const d of [-.3,.3]){raised(o.x+d,o.y+.3,.09,.35,'#6f9cae',.2);light(point(o.x+d,o.y+.3,.58),'#d4a0ff',1.7)}}
 }
 function aircraft(o,c,t){
  const aim=o.aim||{x:o.x+.8,y:o.y-.2},a=Math.atan2(aim.y-o.y,aim.x-o.x),dx=Math.cos(a),dy=Math.sin(a),z=1.35+Math.sin(t*2+o.id)*.04;
  const P=(f,w,h=0)=>point(o.x+dx*f-dy*w,o.y+dy*f+dx*w,z+h),heavy=o.type==='cruiser',bomb=o.type==='bomber',len=heavy?1.15:bomb?.8:.72,wing=heavy?.72:bomb?1.05:.68;
  metal([P(len,0),P(.05,wing),P(-len*.7,wing*.82),P(-len*.45,0),P(-len*.7,-wing*.82),P(.05,-wing)],heavy?'#627d92':bomb?'#648d9f':'#7fa7b9',true);
  poly([P(len,0),P(-len*.65,.2),P(-len*.9,0),P(-len*.65,-.2)],'#abc7d5','#e0f6ff');
  poly([P(len*.5,0,.06),P(-.08,.13,.14),P(-.25,0,.14),P(-.08,-.13,.14)],'#173d57',c);
  for(const side of [-1,1]){line(P(.02,side*wing*.45,.02),P(-len*.6,side*wing*.7,.02),'#314e63',2);line(P(.04,side*wing*.7,.03),P(-len*.45,side*wing*.8,.03),c,1.4);light(P(-len*.65,side*wing*.6),c,heavy?3:2);if(o.moving){line(P(-len*.7,side*wing*.6),P(-len*(1.25+Math.sin(t*13)*.06),side*wing*.6,-.02),c+'77',3);line(P(-len*.7,side*wing*.6),P(-len*1.1,side*wing*.6), '#e4ffff',1)}if(bomb){poly([P(-.1,side*.65,-.05),P(.3,side*.65,-.05),P(.3,side*.82,-.05),P(-.1,side*.82,-.05)],'#334d68','#88a4ba');light(P(.3,side*.73,-.05),'#ffdf98',1.4)}}
  if(heavy){for(const side of [-1,1]){poly([P(.65,side*.25,.09),P(-.7,side*.25,.09),P(-.85,side*.46,.09),P(.35,side*.46,.09)],'#446780','#8ba8bc');line(P(.55,side*.33,.14),P(.92,side*.33,.14),'#c7e9f2',2);light(P(.92,side*.33,.14),c,2)}for(let j=0;j<3;j++)line(P(-.3-j*.17,-.13,.16),P(-.3-j*.17,.13,.16),'#294759',1.5)}
  for(const side of [-1,1]){sphere(P(-len*.45,side*wing*.6,.03),3,2,'#40586a');light(P(-len*.62,side*wing*.6,.03),c,2)}light(P(len*.56,0,.1),c,1.8);
 }
 function unitFinish(o,c){if(CrystalCommand.TYPES[o.type].flying)return;const scale=Math.abs(point(o.x+1,o.y).x-point(o.x,o.y).x)/.85;
  if(['laser','raider','medic','guardian'].includes(o.type)){const head=point(o.x,o.y,.72);sphere(head,scale*.15,scale*.12,'#8eacbd');line({x:head.x-scale*.11,y:head.y+1},{x:head.x+scale*.11,y:head.y+1},c,2);for(const side of [-1,1])sphere(point(o.x+side*.29,o.y,.45),scale*.09,scale*.085,'#6c8b9f')}
  if(o.type==='siege'){sphere(point(o.x,o.y,.63),scale*.2,scale*.13,'#7897ab');for(const side of [-1,1])light(point(o.x+side*.45,o.y+.24,.26),c,1.5)}
  if(o.type==='worker')sphere(point(o.x-.08,o.y-.08,.55),scale*.13,scale*.1,'#92b4c5');
 }
 function robot(o,c,t){
  const walking=o.moving,step=walking?Math.sin(t*11+o.id)*.13:0;
  const aim=o.aim||{x:o.x+.8,y:o.y-.2},length=Math.hypot(aim.x-o.x,aim.y-o.y)||1,dx=(aim.x-o.x)/length,dy=(aim.y-o.y)/length;
  if(walking&&!CrystalCommand.TYPES[o.type].flying){ctx.save();for(let j=0;j<2;j++){const life=(t*1.8+o.id*.17+j*.5)%1,q=point(o.x-dx*(.3+life*.5),o.y-dy*(.3+life*.5),.03);ctx.globalAlpha=(1-life)*.16;ctx.fillStyle='#b4d5df';ctx.beginPath();ctx.ellipse(q.x,q.y,1+life*4,1+life*2,0,0,Math.PI*2);ctx.fill()}ctx.restore()}
  const barrel=(z,r,w)=>{line(point(o.x,o.y,z),point(o.x+dx*r,o.y+dy*r,z),'#cde4ef',w);line(point(o.x,o.y,z),point(o.x+dx*r,o.y+dy*r,z),c,1);light(point(o.x+dx*r,o.y+dy*r,z),c,1.5)};
  if(CrystalCommand.TYPES[o.type].flying){aircraft(o,c,t);return}
  if(o.type==='worker'){
   for(const s of [-1,1]){line(point(o.x+s*.18,o.y,.25),point(o.x+s*.32,o.y+.15,.12),'#b8cdd8',2.5);line(point(o.x+s*.32,o.y+.15,.12),point(o.x+s*.32,o.y+.28+step*s),'#6b8d9f',2);raised(o.x+s*.32,o.y+.28+step*s,.09,.08,'#4e697f')}
   raised(o.x,o.y,.24,.24,'#7b9bad',.2);raised(o.x-.08,o.y-.08,.13,.14,'#a3bdc8',.44);line(point(o.x-.12,o.y+.12,.53),point(o.x+.12,o.y+.12,.53),c,2);light(point(o.x,o.y,.5),c,2);line(point(o.x-.12,o.y-.12,.59),point(o.x-.12,o.y-.12,.82),'#aecbd9',1);light(point(o.x-.12,o.y-.12,.82),c,1);
   line(point(o.x+.23,o.y,.4),point(o.x+.48,o.y+.12,.24+(o.mine?Math.sin(t*24)*.06:0)),'#d1e2eb',2);light(point(o.x+.48,o.y+.12,.24+(o.mine?Math.sin(t*24)*.06:0)),'#ffdb86',1.5);
   if(o.carry){for(const j of [-1,1]){const p=point(o.x-.15+j*.08,o.y-.18,.76);light(p,c,3);poly([{x:p.x,y:p.y-6},{x:p.x+3,y:p.y},{x:p.x,y:p.y+3},{x:p.x-3,y:p.y}],c,'#d8ffff')}}
  }else if(o.type==='scout'){
   const z=.34+Math.sin(t*5+o.id)*.025;poly([point(o.x,o.y-.48,z),point(o.x+.34,o.y+.27,z),point(o.x,o.y+.12,z),point(o.x-.34,o.y+.27,z)],'#587b92','#a2d5e4');raised(o.x,o.y,.13,.12,'#b3cbd6',z);for(const dx of [-.3,.3])line(point(o.x+dx,o.y+.1,z),point(o.x+dx,o.y+.45,z-.08),c+'66',2);light(point(o.x,o.y-.13,z+.12),c,2);for(const dx of [-.23,.23])light(point(o.x+dx,o.y+.25,z),c,2.5);
  }else if(['laser','raider','medic','guardian'].includes(o.type)){
   const medic=o.type==='medic',guard=o.type==='guardian';if(medic)c='#91ffbe';
   for(const dx of [-.17,.17]){raised(o.x+dx,o.y+step*Math.sign(dx),.1,.12,'#4b6b81');line(point(o.x+dx,o.y,.12),point(o.x+dx,o.y-.05,.38),'#9bb2c4',3)}
   raised(o.x,o.y,.22,.25,'#7499ab',.27);for(const dx of [-.3,.3])raised(o.x+dx,o.y,.11,.16,'#507b92',.4);raised(o.x,o.y,.14,.15,'#afc8d3',.56);tile(o.x,o.y,.1,'#314e62',c,.715);line(point(o.x-.14,o.y+.23,.37),point(o.x+.14,o.y+.23,.37),'#d0e4ec',1);line(point(o.x-.12,o.y+.14,.67),point(o.x+.12,o.y+.14,.67),c,2);light(point(o.x,o.y,.48),c,2);for(const dx of [-.3,.3])line(point(o.x+dx-.06,o.y+.12,.51),point(o.x+dx+.06,o.y+.12,.51),c,2);if(!medic)barrel(.58,o.type==='raider'?.5:.72,3);else{const q=point(o.x,o.y,.8);line({x:q.x-4,y:q.y},{x:q.x+4,y:q.y},'#e9fff1',2);line({x:q.x,y:q.y-4},{x:q.x,y:q.y+4},'#e9fff1',2)}if(o.type==='raider'){for(const side of [-1,1]){line(point(o.x+side*.2,o.y-.2,.5),point(o.x+side*.3,o.y-.4,.73),'#ffdf96',2);light(point(o.x+side*.3,o.y-.4,.73),'#ffdf96',1.2)}}if(guard){for(const side of [-1,1]){raised(o.x+side*.36,o.y-.12,.14,.28,'#9bafc0',.55);for(const j of [-.06,.06])light(point(o.x+side*.36+j,o.y+.03,.74),'#ffdb91',1.5)}}for(const j of [-1,1])line(point(o.x+j*.17,o.y+step*j,.12),point(o.x+j*.22,o.y-step*j,.32),'#b4d3e0',2);
  }else{
   for(const dx of [-.38,.38]){raised(o.x+dx,o.y,.23,.19,'#405a70');for(let j=0;j<4;j++)line(point(o.x+dx-.16,o.y-.2+((j*.13+(walking?t*.18:0))%.52),.13),point(o.x+dx+.16,o.y-.2+((j*.13+(walking?t*.18:0))%.52),.13),'#8b9eaf',1.5)}
   raised(o.x,o.y,.35,.24,'#7a96a9',.16);raised(o.x,o.y,.23,.18,'#adbec9',.4);for(const d of [-.25,.25]){tile(o.x+d,o.y,.075,c+'77',null,.405);line(point(o.x+d,o.y-.2,.41),point(o.x+d,o.y+.2,.41),'#e2f2f9',1)}barrel(.65,.95,6);raised(o.x-dx*.12,o.y-dy*.12,.16,.1,'#536f87',.6);light(point(o.x-.18,o.y+.24,.43),c,2.5);for(const dy of [-.2,.2])light(point(o.x+.48,o.y+dy,.22),'#ffe4ac',1.3);
  }
  unitFinish(o,c);
 }
 function building(o,c,t){
  if(o.type==='base'){
   for(let j=0;j<4;j++){const q=(j+t*.45)%4;tile(o.x-1.3+q*.65,o.y+1.35,.055,c,null,.04)}
   hull(o.x,o.y,.94,.5,'#648b9b',.22);hull(o.x,o.y,.77,.045,'#abc5ce',.72);hull(o.x,o.y,.36,.35,'#426b87',.765);
   for(const [dx,dy]of [[-1,-1],[1,-1],[1,1],[-1,1]]){raised(o.x+dx,o.y+dy,.22,.55,'#5c7b92',.12);raised(o.x+dx,o.y+dy,.12,.15,'#92b1c0',.67);light(point(o.x+dx,o.y+dy,.85),c,2)}
   const reactor=point(o.x,o.y,1.12),scale=Math.abs(point(o.x+1,o.y).x-point(o.x,o.y).x)/.85;sphere(reactor,scale*.34,scale*.23,'#4d7c92');aura(reactor,c,scale*.6,scale*.4,.35);ring(reactor,scale*.26,scale*.12,c+'99',1);
   ring(point(o.x,o.y,1.24),9,4,c,2);light(point(o.x,o.y,1.24),c,5+Math.sin(t*2)*.4);line(point(o.x,o.y,1.2),point(o.x,o.y,1.65),c,1.5);light(point(o.x,o.y,1.65),c,2);
   for(let j=0;j<4;j++)line(point(o.x-.6+j*.4,o.y+.78,.43),point(o.x-.6+j*.4,o.y+.78,.6),c,2);
  }else if(o.type==='factory'){
   hull(o.x,o.y,.86,.6,'#5d8194',.22);hull(o.x,o.y,.71,.035,'#9fb9c5',.82);raised(o.x+.53,o.y-.45,.17,.67,'#647d96',.6);raised(o.x-.45,o.y-.43,.2,.3,'#788ea2',.85);
   for(const dx of [-.35,0,.35]){const q=point(o.x+dx,o.y-.18,.85);sphere(q,4.5,2.4,'#38546b');ring(q,3.2,1.4,'#b0c9d466');line({x:q.x-3,y:q.y},{x:q.x+3,y:q.y},'#0a1b28',1)}
   const opening=o.spawnFlash?1:o.queue.length?Math.max(0,(o.progress/CrystalCommand.TYPES[o.queue[0]].time-.78)/.22):0;
   poly([point(o.x-.38,o.y+.82,.24),point(o.x+.38,o.y+.82,.24),point(o.x+.38,o.y+.82,.63),point(o.x-.38,o.y+.82,.63)],'#040d19',c);
   for(const side of [-1,1]){const edge=side*.38,inner=side*opening*.35;poly([point(o.x+edge,o.y+.84,.25),point(o.x+inner,o.y+.84,.25),point(o.x+inner,o.y+.84,.61),point(o.x+edge,o.y+.84,.61)],'#52758b','#91b5c7');line(point(o.x+inner,o.y+.85,.27),point(o.x+inner,o.y+.85,.59),c,1)}
   if(o.queue.length){for(const j of [-1,1]){const swing=Math.sin(t*4)*.15;line(point(o.x+j*.45,o.y-.1,.93),point(o.x+j*.25,o.y+swing,1.12),'#b8cfdb',2);line(point(o.x+j*.25,o.y+swing,1.12),point(o.x,o.y+swing,.98),c,1.5)}}
   for(let j=0;j<3;j++)line(point(o.x-.25+j*.25,o.y+.86,.28),point(o.x-.25+j*.25,o.y+.86,.57),'#62eaff44');
   for(let j=0;j<4;j++)tile(o.x-.6+j*.35,o.y+.98,.08,j%2?'#ffdb86':'#283645',null,.04);light(point(o.x+.53,o.y-.45,1.31),'#ffdb86',2);for(let j=0;j<3;j++){const life=(t*.35+j/3)%1,p=point(o.x+.53-life*.18,o.y-.45,1.35+life*.7);ctx.save();ctx.globalAlpha=(1-life)*.18;ctx.fillStyle='#c7dfe8';ctx.beginPath();ctx.ellipse(p.x,p.y,2+life*4,1+life*3,0,0,Math.PI*2);ctx.fill();ctx.restore()}if(o.queue.length){const p=point(o.x,o.y+.83,.47);line({x:p.x-8,y:p.y},{x:p.x+8,y:p.y},c,2);light(p,c,2+Math.sin(t*7)*.6)}
  }else if(o.type==='starport'){
   hull(o.x,o.y,.95,.3,'#658da0',.22);tile(o.x,o.y,.81,'#18384e',c,.54);tile(o.x,o.y,.56,null,'#e6f7ff88',.55);line(point(o.x-.55,o.y,.56),point(o.x+.55,o.y,.56),'#bfefff99',2);line(point(o.x,o.y-.55,.56),point(o.x,o.y+.55,.56),'#bfefff99',2);
   for(const side of [-1,1]){raised(o.x+side*.83,o.y-.74,.16,.65,'#7a9fb1',.32);light(point(o.x+side*.83,o.y-.74,1.02),c,2.5);for(let j=0;j<3;j++)tile(o.x+side*.83,o.y-.36+j*.36,.05,c,null,.56)}
   if(o.queue.length){ctx.save();ctx.globalAlpha=.25;tile(o.x,o.y,.65,null,c,.6+(t*.3%1));ctx.restore();aircraft({x:o.x,y:o.y,type:o.queue[0],id:o.id},c,t)}
  }else if(o.type==='barracks'){
   for(const side of [-1,1]){hull(o.x+side*.42,o.y,.34,.55,'#6c8fa5',.22);tile(o.x+side*.42,o.y,.25,'#a7c4d2',null,.78);poly([point(o.x+side*.42-.18,o.y+.35,.26),point(o.x+side*.42+.18,o.y+.35,.26),point(o.x+side*.42+.18,o.y+.35,.62),point(o.x+side*.42-.18,o.y+.35,.62)],'#091b2b',c)}
   raised(o.x,o.y-.58,.23,.65,'#547c96',.22);const p=point(o.x,o.y-.58,.9);line({x:p.x-5,y:p.y},{x:p.x+5,y:p.y},c,2);line({x:p.x,y:p.y-4},{x:p.x,y:p.y+4},c,2);for(const side of [-1,1])light(point(o.x+side*.7,o.y+.35,.75),o.queue.length?'#ffdd94':c,1.8);
  }else if(o.type==='armory'){
   hull(o.x,o.y,.68,.48,'#728da5',.22);for(const side of [-1,1]){raised(o.x+side*.48,o.y-.3,.16,.5,'#8fabc0',.7);line(point(o.x+side*.48,o.y-.3,1.2),point(o.x+side*.25,o.y,1.45),'#bad9e4',2)}tile(o.x,o.y,.32,'#28425b','#d1b0ff',.72);light(point(o.x,o.y,.8),'#d1a4ff',4);for(let j=0;j<3;j++)line(point(o.x-.35+j*.3,o.y+.69,.35),point(o.x-.35+j*.3,o.y+.69,.6),c,2);
  }else if(o.type==='flak'){
   raised(o.x,o.y,.32,.8,'#799bb2',.2);const a=o.aim?Math.atan2(o.aim.y-o.y,o.aim.x-o.x):t*.45;for(const side of [-1,1]){raised(o.x+side*.23,o.y,.16,.22,'#b2c7d4',1);line(point(o.x+side*.23,o.y,1.1),point(o.x+side*.23+Math.cos(a)*.45,o.y+Math.sin(a)*.45,1.35),'#c6e3ed',3)}ring(point(o.x,o.y,1.38),9,4,c,1);light(point(o.x,o.y,1.38),c,2);
  }else if(o.type==='turret'){
   raised(o.x,o.y,.32,.56,'#7695ac',.2);raised(o.x,o.y,.28,.2,'#b1c7d4',.76);const a=o.aim?Math.atan2(o.aim.y-o.y,o.aim.x-o.x):t*.3;for(const side of [-1,1]){const dx=Math.cos(a)*.7,dy=Math.sin(a)*.7;line(point(o.x-Math.sin(a)*side*.12,o.y+Math.cos(a)*side*.12,.9),point(o.x+dx-Math.sin(a)*side*.12,o.y+dy+Math.cos(a)*side*.12,.9),'#c7e0eb',3)}light(point(o.x+Math.cos(a)*.7,o.y+Math.sin(a)*.7,.9),c,2);
  }else if(o.type==='relay'){
   raised(o.x,o.y,.22,.65,'#86a5b8',.2);ring(point(o.x,o.y,1.06),13,6,c,2);line(point(o.x,o.y,.9),point(o.x,o.y,1.4),'#d1e7f0',2);light(point(o.x,o.y,1.4),c,2.5);ring(point(o.x,o.y,1.06),16+t%2*4,7+t%2*2,'#63eaff33');
  }else{
   raised(o.x,o.y,.4,.32,'#6b82a6',.22);const p=point(o.x,o.y,.95);light(p,'#dd96ff',5);for(let j=0;j<3;j++){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(t*.4+j*Math.PI/3);ring({x:0,y:0},16,6,j%2?c:'#cf9fff',1.4);ctx.restore()}
  }
  machinery(o,c);if(['base','factory','starport','lab'].includes(o.type)){const q=point(o.x,o.y+.6,.06);aura(q,c,24,9,.18)}
 }
 function construction(o,c,t){
  const d=CrystalCommand.TYPES[o.type],progress=1-o.build/d.time,r=d.radius*.8,h=.3+progress*.9;
  raised(o.x,o.y,r,.12,'#38526b');
  for(const [dx,dy]of [[-r,-r],[r,-r],[r,r],[-r,r]]){line(point(o.x+dx,o.y+dy,.15),point(o.x+dx,o.y+dy,h),'#9cb4c4',2);line(point(o.x+dx,o.y+dy,h),point(o.x-dx,o.y+dy,h),'#658699',1)}
  if(progress>.35)raised(o.x,o.y,r*.65,progress*.5,'#567990',.15);for(const d of [-1,1]){line(point(o.x+d*r,o.y-r,.2),point(o.x-d*r,o.y-r,h),'#88c8dc88');light(point(o.x+d*r,o.y+r,h),c,1.4)}tile(o.x,o.y,r*.9,null,c+'66',.2+progress*.5);line(point(o.x-r,o.y+r,.12),point(o.x-r+2*r*progress,o.y+r,.12),c,2);
  ctx.save();ctx.setLineDash([3,3]);tile(o.x,o.y,r,null,c,h);ctx.restore();
  const q=point(o.x+Math.sin(t*3)*r*.6,o.y+Math.cos(t*3)*r*.6,.2+progress*.5);light(q,'#ffde91',2);line(q,{x:q.x+Math.sin(t*19)*7,y:q.y-5},'#ffeab9',1);
 }
 function smoke(o,t){
  for(let j=0;j<3;j++){const life=(t*.45+j/3+o.id*.17)%1,q=point(o.x-life*.3,o.y,.8+life*1.2);ctx.save();ctx.globalAlpha=(1-life)*.32;ctx.fillStyle='#748392';ctx.beginPath();ctx.ellipse(q.x,q.y,2+life*8,2+life*5,0,0,Math.PI*2);ctx.fill();ctx.restore()}
  if(o.hp/o.maxHp<.3)light(point(o.x+.18,o.y,.4),'#ffad60',2+Math.sin(t*9)*.5);
 }
 return{beginFrame,aura,terrain,crystal,robot,building,construction,smoke,light,ring,raised};
}
const icons={raider:'M8 8h16v9H8z M12 3h8v5 M6 17h20 M11 17v11 M21 17v11 M24 11h6 M4 21h4',medic:'M10 5h12v10H10z M6 16h20v9H6z M16 17v7 M12 20h8 M10 25v5 M22 25v5',guardian:'M7 13h18v10H7z M11 7h10v6 M3 5h6v10H3z M23 5h6v10h-6z M10 23v7 M22 23v7',interceptor:'M16 2 20 13 29 23 20 21 16 27 12 21 3 23 12 13Z M16 8v10 M8 25v4 M24 25v4',bomber:'M16 4 20 14 29 15v9l-10-3-3 7-3-7-10 3v-9l10-1Z M16 10v10 M7 17v4 M25 17v4',cruiser:'M16 2 21 11v12l-5 7-5-7V11Z M11 12 4 16v10l7-4 M21 12l7 4v10l-7-4 M16 9v12',barracks:'M3 28V12h10v16 M19 28V12h10v16 M13 28V7h6v21 M6 17h4 M22 17h4 M16 3v4',starport:'M3 24 16 30 29 24 16 18Z M6 22V8h4v12 M22 20V8h4v14 M13 24h6 M16 21v6 M4 5h8 M20 5h8',armory:'M5 28V14h22v14Z M9 14V5h5v9 M18 14V5h5v9 M12 22l4-5 4 5-4 5Z',flak:'M12 29V14h8v15 M6 10h8v8H6z M18 10h8v8h-8z M9 10V3 M23 10V3 M8 29h16',worker:'M9 7h14v11H9z M12 10h8 M12 18v6H7v3h8v-7 M20 18v6h5v3h-8v-7 M9 12H5v7 M23 12h4v7 M16 7V3',scout:'M16 3 28 26 16 21 4 26Z M16 10v8 M10 25v4 M22 25v4',laser:'M11 4h10v7H11z M13 7h6 M8 13h16v9H8z M11 22v7 M21 22v7 M5 13v9 M27 13v10h3',siege:'M5 15h22v10H5z M9 10h13v9H9z M20 12h10 M3 18v10h7 M29 18v10h-7 M10 23h12',factory:'M3 28V13l8 4V10l9 6V7h7v21Z M8 23h4 M16 23h4 M23 10h4',relay:'M12 29h8 M16 29V13 M6 9a10 10 0 0 0 20 0 M16 13V3 M11 4h10',turret:'M8 29h16 M12 29V16h8v13 M8 10h16v7H8z M20 10V4 M25 11V5',lab:'M8 27h16v-7H8z M16 5v15 M4 11h24 M8 4l16 14 M24 4 8 18',base:'M4 29V17h6v12 M22 29V17h6v12 M10 26V12h12v14 M12 12V7h8v5 M16 7V2 M14 18h4'};
function icon(type){return '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(icons[type]||icons.base)+'"/></svg>'}
window.CrystalArt={create,icon};
})();
