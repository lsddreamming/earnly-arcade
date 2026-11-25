'use strict';
(()=>{
const canvas=document.querySelector('canvas'),g=canvas.getContext('2d');
const project=(x,y,z=0)=>[320+(x-y)*29,104+(x+y)*13-z];
function face(points,color){g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=color;g.fill()}
function block(x,y,w,d,z,h,top,left,right){const p=(a,b,c)=>project(x+a,y+b,z+c);face([p(0,d,h),p(w,d,h),p(w,d,0),p(0,d,0)],left);face([p(w,d,h),p(w,0,h),p(w,0,0),p(w,d,0)],right);face([p(0,0,h),p(w,0,h),p(w,d,h),p(0,d,h)],top)}
function oval(x,y,a,b,c){g.beginPath();g.ellipse(x,y,a,b,0,0,Math.PI*2);g.fillStyle=c;g.fill()}
function spud(x,y,t,shirt,staff){const [u,v]=project(x,y),step=Math.sin(t)*1.6;oval(u,v,12,4,'#13282d77');oval(u-5,v-2+step,4,3,'#2e3840');oval(u+5,v-2-step,4,3,'#2e3840');const h=v-16-Math.abs(step);let skin=g.createRadialGradient(u-4,h-6,1,u,h,16);skin.addColorStop(0,'#ffdfa0');skin.addColorStop(1,'#bc7844');oval(u,h,11,15,skin);oval(u,h+6,11,6,shirt);oval(u-4,h-2,1.5,2,'#232329');oval(u+3,h-2,1.5,2,'#232329');oval(u+6,h+1,2,1,'#df936b');if(staff){oval(u,h-12,12,4,shirt);oval(u,h-15,8,4,shirt)}}
function cabinet(x,y,i,t){const color=['#ffae64','#92e7cf','#da98dd'][i%3];block(x,y,1.1,.75,0,33,color,'#414568','#28364d');block(x,y,1.1,.55,32,21,color,'#172c41','#33475b');block(x+.1,y+.55,.9,.025,36,14,'#81ffdb','#39717b','#174554');const [u,v]=project(x+.48,y+.59,43);oval(u+Math.sin(t*2+i)*6,v,3,2,color);block(x,y,1.1,.62,53,6,color,color,'#716b83');block(x,y+.54,1.1,.4,26,5,'#768ba6','#3e4e64','#364156');const [a,b]=project(x+.3,y+.77,33);oval(a,b,2.5,3,'#fb6263');}
function draw(ms){requestAnimationFrame(draw);if(document.hidden||ms-(draw.last||0)<32)return;draw.last=ms;
const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2),w=Math.round(r.width*d),h=Math.round(r.height*d);if(!w||!h)return;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}g.setTransform(w/640,0,0,h/388,0,0);g.clearRect(0,0,640,388);g.translate(320,200);g.scale(zoom,zoom);g.translate(-320,-200);const t=ms/1000,L=state.levels;
block(0,0,9,8,-12,12,'#55717a','#25404a','#1b333e');
for(let y=0;y<8;y++)for(let x=0;x<9;x++)block(x,y,.98,.98,0,1,(x+y)%2?'#45646c':'#507179','#45656b','#45656b');
block(-.18,0,.18,8,0,63,'#739a9c','#35545f','#32505c');block(0,-.18,9,.18,0,63,'#91aeaa','#40626c','#334e5a');
block(0,-.01,9,.03,48,3,'#ffcf80','#ffc578','#ffb074');block(-.01,0,.03,8,48,3,'#8effd7','#73dcb8','#73dcb8');
const [a,b]=project(3,0,46);g.save();g.translate(a,b);g.transform(1,.448,0,1,0,0);g.fillStyle='#1b303e';g.fillRect(-44,-16,88,22);g.fillStyle='#ffcb7d';g.font='bold 14px system-ui';g.textAlign='center';g.fillText('SPUDCADE',0,0);g.restore();
const objects=[];function add(x,y,paint){objects.push([x+y,paint])}
const n=Math.min(6,1+Math.floor((L[0]+1)/5));for(let i=0;i<n;i++){const x=.5+i%3*2.55,y=1+Math.floor(i/3)*2.3;add(x+1,y+.8,()=>cabinet(x,y,i,t))}
for(let i=0;i<Math.min(5,1+L[3]);i++){const y=3+i*.8;add(.6,y,()=>block(.1,y,.6,.6,0,9,'#e79577','#ad6461','#874a51'))}
add(7.5,5,()=>{block(6.5,4.4,1.7,1,0,21,'#f4b77d','#9b6c5c','#774e47');block(7,4.5,.55,.4,21,10,'#b7dad3','#294b51','#203d45')});
if(L[1])add(7,4,()=>spud(7,4,t,'#58bcae',true));
for(let i=0;i<Math.min(12,3+L[0]+L[3]);i++){const f=(t*.064+i*.157)%1;const stops=[[3.5,7.7],[2,2.45],[2,2.45],[6.6,5.8],[7.8,7.4],[3.5,7.7]],part=f*5,j=Math.floor(part),k=part-j;const x=stops[j][0]*(1-k)+stops[j+1][0]*k,y=stops[j][1]*(1-k)+stops[j+1][1]*k;add(x,y,()=>spud(x,y,t*6+i,['#f3a264','#98c7ee','#b992dd','#92c992'][i%4],false))}
objects.sort((a,b)=>a[0]-b[0]).forEach(o=>o[1]());const dt=t-lastSale;if(dt>=0&&dt<1){const [x,y]=project(7.3,5,45+dt*25);g.fillStyle='#ffe995';g.font='bold 17px system-ui';g.fillText('+$'+fmt(ticket()),x,y)}
}requestAnimationFrame(draw)
})();
