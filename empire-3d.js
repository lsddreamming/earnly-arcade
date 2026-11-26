// Share the self-hosted Three.js runtime already shipped with Earnly.
import * as T from './realms-three.js';

const canvas = document.querySelector('figure canvas');
function start() {
  const renderer = new T.WebGLRenderer({canvas, antialias:true, powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  const scene = new T.Scene();
  scene.background = new T.Color(0x272041);
  scene.fog = new T.FogExp2(0x312444, .028);
  const camera = new T.PerspectiveCamera(45,1,.1,65);
  scene.add(new T.HemisphereLight(0xffefea,0x8072ac,2.2));
  const key = new T.DirectionalLight(0xffdbad,2.1);
  key.position.set(-4,7,6); scene.add(key);
  const shapes={box:new T.BoxGeometry(1,1,1),ball:new T.SphereGeometry(.5,16,12),
    drum:new T.CylinderGeometry(.5,.5,1,20),ring:new T.TorusGeometry(.5,.055,8,36)};
  const palette=new Map();
  function mesh(parent,shape,color,x,y,z,w,h,d) {
    if(!palette.has(color))palette.set(color,new T.MeshStandardMaterial({color,roughness:.56}));
    const m=new T.Mesh(shapes[shape],palette.get(color));
    m.position.set(x,y,z);m.scale.set(w,h,d);parent.add(m);return m;
  }
  function panel(parent,x,y,z,w,h,paint) {
    const sheet=document.createElement('canvas');sheet.width=512;sheet.height=256;
    const ctx=sheet.getContext('2d');paint(ctx,0);
    const tex=new T.CanvasTexture(sheet);tex.colorSpace=T.SRGBColorSpace;
    const p=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:tex}));
    p.position.set(x,y,z);parent.add(p);
    return {draw(t){paint(ctx,t);tex.needsUpdate=true},mesh:p};
  }
  function lettering(words,ink,bg){
    return ctx=>{ctx.fillStyle=bg;ctx.fillRect(0,0,512,256);ctx.textAlign='center';
      ctx.font='900 62px system-ui';ctx.fillStyle=ink;ctx.shadowColor=ink;ctx.shadowBlur=12;
      ctx.fillText(words,256,150,482);ctx.shadowBlur=0};
  }
  function screen(ctx,t){
    const sky=ctx.createLinearGradient(0,0,0,256);sky.addColorStop(0,'#231650');sky.addColorStop(1,'#d44887');
    ctx.fillStyle=sky;ctx.fillRect(0,0,512,256);
    ctx.fillStyle='#ffcb73';ctx.beginPath();ctx.arc(340,94,48,0,7);ctx.fill();
    ctx.fillStyle='#38255b';ctx.beginPath();ctx.moveTo(0,152);
    for(let i=0;i<16;i++)ctx.lineTo(i*38,108+Math.sin(i*13)*22);ctx.lineTo(512,256);ctx.lineTo(0,256);ctx.fill();
    ctx.strokeStyle='#55e4df';ctx.lineWidth=2;
    for(let i=-5;i<=5;i++){ctx.beginPath();ctx.moveTo(256+i*10,150);ctx.lineTo(256+i*130,256);ctx.stroke()}
    for(let i=0;i<7;i++){let v=((i+t*.9)%7)/7;ctx.fillRect(0,151+v*v*104,512,1+v)}
    ctx.fillStyle='#ffde7e';ctx.save();ctx.translate(230+Math.sin(t)*72,208);ctx.beginPath();ctx.moveTo(0,-21);ctx.lineTo(30,14);ctx.lineTo(0,7);ctx.lineTo(-30,14);ctx.fill();ctx.restore();
  }
  const box=(...a)=>mesh(scene,'box',...a);
  box('#342d49',1,-.22,0,13,.4,8);
  box('#393451',1,2,-3.6,13,4,.35);
  for(let i=-3;i<5;i++){
    box('#554362',i*1.5+.2,2,-3.36,.09,5,.15);
    box(i%2?'#ffc488':'#7aeadc',i*1.5+.2,3.9,-3.2,1.38,.055,.06);
    box('#57506a',i*1.5+.2,.2,-3.22,1.38,.12,.12);
  }
  panel(scene,0,3.12,-3.16,4.6,1.17,lettering('S P U D C A D E','#ffc577','#352341'));
  // Continuous patterned carpet and contact shadows keep the camera inside the arcade.
  const carpet=panel(scene,1,.002,0,13,8,(ctx)=>{
    ctx.fillStyle='#36304e';ctx.fillRect(0,0,512,256);
    for(let i=0;i<70;i++){let x=(i*193)%510,y=(i*101)%255;ctx.strokeStyle=['#60547d','#865776','#477074'][i%3];
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+5,y-3);ctx.lineTo(x+7,y);ctx.stroke()}
  }).mesh;carpet.rotation.x=-Math.PI/2;carpet.material.map.wrapS=carpet.material.map.wrapT=T.RepeatWrapping;carpet.material.map.repeat.set(5,4);
  function group(x,z){let p=new T.Group();p.position.set(x,0,z);scene.add(p);return p}
  const machines=[],screens=[];
  for(let i=0;i<6;i++){
    const x=[-1.7,.12,1.95,-3.52,3.78,5.6][i],p=group(x,-1.9);
    const color=['#ef8756','#55bebc','#bb68b1'][i%3];
    const part=(shape,c,x,y,z,w,h,d)=>mesh(p,shape,c,x,y,z,w,h,d);
    part('box','#25273d',0,.56,0,1.24,1.12,.86);
    for(const side of [-1,1]){
      part('box',color,side*.62,1.18,0,.09,2.36,.88);
      part('box','#ffdb94',side*.62,1.13,.46,.07,.06,.09);
    }
    part('box','#262438',0,1.65,-.05,1.16,1.02,.65);
    part('box',color,0,2.26,.06,1.35,.31,.99);
    panel(p,0,2.26,.565,1.17,.25,lettering(['STAR PATROL','PIXEL RUN','NOVA DASH'][i%3],'#ffe3a4','#382446'));
    screens.push(panel(p,0,1.64,.295,1.02,.69,screen));
    part('box','#565070',0,1.08,.32,1.29,.17,.85);
    part('drum','#c6bcc8',-.32,1.23,.55,.055,.23,.055);part('ball','#ff5469',-.32,1.37,.55,.16,.16,.16);
    for(let j=0;j<3;j++)part('drum',j===1?'#ffd36b':'#6adbc9',.1+j*.15,1.19,.55,.105,.05,.105);
    panel(p,0,.55,.442,.72,.48,lettering('★','#ffcc7d','#343048'));
    machines.push(p);
  }
  // Each attraction family has its own silhouette and moving playfield.
  const pinballParts=[],claws=[];
  for(let i=0;i<machines.length;i++){
    if(i%3===0)continue;
    const p=machines[i];
    const part=(shape,c,x,y,z,w,h,d)=>mesh(p,shape,c,x,y,z,w,h,d);
    if(i%3===1){
      const deck=part('box','#a85b90',0,.98,.87,1.22,.23,1.42);
      deck.rotation.x=.09;
      for(let side of [-1,1])part('drum','#9facc2',side*.48,.43,1.42,.085,.84,.085);
      for(let j=0;j<5;j++)part('drum',j%2?'#ffd07b':'#75e4cf',Math.sin(j*2)*.39,1.13,.56+j*.13,.18,.09,.18);
      for(let side of [-1,1])part('box','#ffcf8a',side*.24,1.08,1.42,.34,.06,.085).rotation.y=side*.32;
      pinballParts.push(part('ball','#ebf5ff',0,1.19,1,.1,.1,.1));
    }else{
      for(const child of p.children)child.visible=false;
      part('box','#319ba3',0,.44,0,1.32,.88,1.05);
      part('box','#ffa567',0,2.19,0,1.42,.24,1.12);
      for(let x of [-.61,.61])for(let z of [-.44,.44])part('drum','#ffca84',x,1.52,z,.07,1.36,.07);
      panel(p,0,2.19,.568,1.22,.21,lettering('PLUSH CLUB','#ffdf94','#744467'));
      for(let j=0;j<7;j++){
        const x=Math.sin(j*4)*.44,z=Math.cos(j*2)*.29,c=['#f3acbc','#b8afa0','#9ddbd4'][j%3];
        part('ball',c,x,1.01,z,.29,.31,.26);
        for(let d of [-1,1])part('ball',c,x+d*.11,1.14,z,.1,.1,.1);
      }
      const claw=new T.Group();p.add(claw);claws.push(claw);
      mesh(claw,'drum','#c2cedf',0,1.91,0,.033,.34,.033);
      for(let d of [-1,1])mesh(claw,'box','#e4d3ba',d*.08,1.71,0,.046,.19,.045).rotation.z=d*.48;
    }
  }
  const benches=[];
  for(let i=0;i<3;i++){
    const p=group(3.15+i*1.18,-.34);benches.push(p);
    mesh(p,'box','#743e57',0,.37,0,1.08,.38,.52);
    mesh(p,'box','#de7b82',0,.68,-.19,1.08,.48,.18);
  }
  const till=group(1.42,.65);
  mesh(till,'box','#c56c53',0,.51,0,1.68,1,.84);
  mesh(till,'box','#ffcd8e',0,1.04,0,1.83,.16,.95);
  mesh(till,'box','#303748',.38,1.28,0,.5,.32,.3);
  panel(till,.38,1.29,.157,.43,.2,lettering('PAY','#8ef6d5','#214749'));
  panel(till,0,.57,.425,1.33,.45,lettering('TICKETS','#ffe8af','#9c514c'));
  function spud(i){
    const p=group(0,0),body=new T.Group();p.add(body);
    const add=(shape,c,x,y,z,w,h,d)=>mesh(body,shape,c,x,y,z,w,h,d);
    const shirt=['#40adab','#ef8d62','#9469bd','#77a9df'][i%4];
    add('ball','#e5aa70',0,.75,0,.61,.87,.53);
    add('ball',shirt,0,.54,0,.63,.46,.55);
    for(const side of [-1,1]){
      add('ball','#342a30',side*.105,.84,.246,.052,.07,.035);
      add('ball','#ed9a78',side*.19,.775,.2,.08,.04,.03);
      add('ball','#eaba7c',side*.285,.56,.035,.13,.25,.14);
    }
    add('ball','#f9cc8b',0,.78,.264,.095,.085,.07);
    if(i%2===0){add('ball',shirt,0,1.07,0,.56,.29,.52);add('ball',shirt,0,1.04,.18,.49,.07,.46)}
    const feet=[-1,1].map(side=>add('ball','#444056',side*.135,.27,.047,.21,.14,.27));
    mesh(p,'drum','#28253c',0,.024,0,.65,.018,.44);
    body.position.y=-.19;return {p,body,feet};
  }
  const guests=Array.from({length:8},(_,i)=>spud(i));const clerk=spud(8);clerk.p.position.set(1.4,0,.04);
  // A shared corridor connects the arcade to the three production rooms.
  box('#946e5b',1,-.21,4.7,13,.4,1.4);
  const offices=studioJobs.map((job,i)=>{
    const x=-3.3+i*4.3,z=7.6;
    const room=group(x,z);
    const part=(color,dx,y,dz,w,h,d)=>mesh(room,'box',color,dx,y,dz,w,h,d);
    part('#443e52',0,-.18,0,4.28,.35,4.4);
    part(job.color,-2.08,.42,0,.11,.84,4.4);
    part(job.color,-1.45,.4,-2.12,1.28,.8,.12);
    part(job.color,1.35,.4,-2.12,1.45,.8,.12);
    part(job.color,0,.17,2.12,4.2,.35,.15);
    panel(room,0,.62,2.19,1.96,.55,lettering(job.sign,'#fff5d8','#34304b'));
    const fixtures=new T.Group();room.add(fixtures);
    const equipment=(color,dx,y,dz,w,h,d)=>mesh(fixtures,'box',color,dx,y,dz,w,h,d);
    equipment('#845a48',0,.46,.25,2.6,.9,.86);
    equipment('#f4ce9c',0,.94,.25,2.72,.09,1);
    if(i===0){
      equipment('#272943',0,1.34,.16,1.2,.7,.13);
      panel(fixtures,0,1.34,.24,.96,.48,lettering('{ }','#77f5b9','#282645'));
    }else if(i===1){
      for(let n=-1;n<=1;n++)equipment(job.color,n*.62,1.22,.28,.34,.48,.09);
    }else{
      panel(fixtures,0,1.65,-.2,2.2,1.1,lettering('ON AIR','#ffd187','#753f57'));
      equipment('#28223b',.55,1.14,.5,.28,.3,.28);
    }
    const worker=spud(i+10);worker.p.position.set(x,0,z+1.1);
    room.userData.office=i;
    return {room,fixtures,worker};
  });
  const path=[[-3.3,1.2],[-1.7,-.92],[-1.7,-.92],[.52,.85],[1.3,1.45],[3.5,1.65],[3.5,2.45],[-3.3,2.45]];
  let angle=.10,drag=null,screenTime=-1,last=0,camZoom=1;
  canvas.style.touchAction='pan-y';
  canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,a:angle};canvas.setPointerCapture(e.pointerId)};
  canvas.onpointermove=e=>{if(drag)angle=T.MathUtils.clamp(drag.a-(e.clientX-drag.x)*.004,-.65,.65)};
  const picker=new T.Raycaster();
  canvas.onpointercancel=()=>drag=null;
  canvas.onpointerup=e=>{
    const tap=drag && Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<8;
    drag=null;
    if(!tap)return;
    const rect=canvas.getBoundingClientRect();
    picker.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);
    const hit=picker.intersectObjects(offices.map(o=>o.room),true)[0];
    if(hit){
      let room=hit.object;
      while(room.userData.office===undefined)room=room.parent;
      tab='Studio';render();
      document.querySelector('#panel').children[room.userData.office+1+(state.studio.deals>=25?1:0)]?.scrollIntoView({block:'nearest'});
    }
  };
  const cameraTarget=new T.Vector3(1,1.8,2.9);
  let width=0,height=0;
  function frame(ms){
    requestAnimationFrame(frame);if(document.hidden||ms-last<32)return;last=ms;
    const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
    if(w!==width||h!==height){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();width=w;height=h}
    const t=ms*.001,count=Math.min(6,1+Math.floor((state.levels[0]+1)/5));
    offices.forEach(({fixtures,worker},i)=>{fixtures.visible=worker.p.visible=i<state.studio.rooms;worker.body.rotation.z=.045*Math.sin(t*1.8+i)});
    machines.forEach((p,i)=>p.visible=i<count);
    if(t-screenTime>.12){screens.slice(0,count).forEach((s,i)=>s.draw(t+i));screenTime=t}
    benches.forEach((p,i)=>p.visible=state.levels[3]>i);
    pinballParts.forEach((b,i)=>{b.position.x=.32*Math.sin(t*3+i);b.position.z=.96+.34*Math.cos(t*2+i)});
    claws.forEach((c,i)=>{c.position.x=.28*Math.sin(t+i);c.position.y=-.11*(1+Math.cos(t+i))});
    clerk.p.visible=state.levels[1]>0;
    guests.forEach(({p,body,feet},i)=>{
      p.visible=i<Math.min(8,3+Math.floor(state.levels[0]/3)+state.levels[3]);if(!p.visible)return;
      const phase=(t*.23+i*1.31)%path.length,k=Math.floor(phase),a=path[k],b=path[(k+1)%path.length];
      const blend=phase-k;let x=T.MathUtils.lerp(a[0],b[0],blend),z=T.MathUtils.lerp(a[1],b[1],blend);
      p.position.set(x,0,z);p.rotation.y=k===1?Math.PI:Math.atan2(b[0]-a[0],b[1]-a[1]);
      const step=k===1?0:Math.sin(t*7+i);body.position.y=-.19+.025*Math.abs(step);
      feet.forEach((f,j)=>f.position.z=.047+step*(j?-.09:.09));
    });
    camZoom+=(zoom-camZoom)*.12;
    // Fit all eight room corners in perspective, including while orbiting.
    const target = cameraTarget;
    const elevation = .81;
    camera.position.set(Math.sin(angle)*Math.cos(elevation),Math.sin(elevation),Math.cos(angle)*Math.cos(elevation));
    camera.position.add(target);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const axes=camera.matrixWorld.elements;
    const tanY=Math.tan(camera.fov*Math.PI/360);
    let distance=0;
    for(const x of [-6.6,6.6]) for(const y of [-2.4,2.4]) for(const z of [-7.1,7.1]){
      const depth=x*axes[8]+y*axes[9]+z*axes[10];
      const horizontal=Math.abs(x*axes[0]+y*axes[1]+z*axes[2]);
      const vertical=Math.abs(x*axes[4]+y*axes[5]+z*axes[6]);
      distance=Math.max(distance,depth+horizontal/(tanY*camera.aspect),depth+vertical/tanY);
    }
    camera.position.sub(target).multiplyScalar(distance*1.09/camZoom).add(target);
    renderer.render(scene,camera);
    if(!canvas.dataset.renderer)canvas.dataset.renderer='three';
  }
  requestAnimationFrame(frame);
}
try { start(); } catch(error) {
  console.warn('Arcade 3D renderer unavailable',error);
  canvas.replaceWith(canvas.cloneNode(false));
  const fallback=document.createElement('script');fallback.src='empire-floor.js';document.body.append(fallback);
}
