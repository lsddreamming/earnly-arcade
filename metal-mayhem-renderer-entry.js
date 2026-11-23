import * as THREE from 'three';
import {followCamera,clearCamera,cameraFraming} from './metal-mayhem-camera.mjs';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/* Original procedural artwork. All resources local; bounded debris and spark pools. */
const E=window.MetalMayhem;
const venues = [
 {name:'The Crucible', sky:0x364e62, floor:0x708b99, ink:'#579bb5'},
 {name:'Copperworks', sky:0x927869, floor:0xb19a81, ink:'#bc673c'},
 {name:'Aurora Relay', sky:0x586e8a, floor:0x93aec2, ink:'#526da4'}
];
function venueIndex(wave){return Math.floor((Math.max(1,wave)-1)/2)%venues.length;}
export class ArenaView {
 constructor(canvas){
  this.canvas=canvas;this.mobile=matchMedia('(pointer:coarse)').matches;this.low=this.mobile;this.reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  this.renderer=new THREE.WebGLRenderer({canvas,antialias:!this.mobile,alpha:false,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.mobile?1.45:1.8));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.35;
  this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x364e62);this.scene.fog=new THREE.Fog(0x364e62,24,65);
  this.camera=new THREE.PerspectiveCamera(58,1,.08,95);this.camera.position.set(0,6,15);
  this.scene.add(new THREE.HemisphereLight(0x8cceff,0x8896a3,2.6));
  const sun=new THREE.DirectionalLight(0xe5f4ff,3.5);sun.position.set(5,16,8);sun.castShadow=true;sun.shadow.mapSize.set(this.mobile?1024:2048,this.mobile?1024:2048);Object.assign(sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:1,far:60});sun.shadow.bias=-.001;sun.shadow.normalBias=.03;this.scene.add(sun);
  const rim=new THREE.DirectionalLight(0x27b5ff,2);rim.position.set(-8,5,-15);this.scene.add(rim);
  this.cameraMode="wide";this.fragments=[];this.flashMaterial=new THREE.MeshBasicMaterial({color:0xd8fcff});this.materials=new Map();this.models=new Map();this.debris=[];this.sparks=[];this.rings=[];this.shake=0;this.frame=0;this.elapsed=0;this.slow=0;
  this.unitBox=this.beveled();this.cylinder=new THREE.CylinderGeometry(1,1,1,10);this.sphere=new THREE.IcosahedronGeometry(1,1);
  this.arena();this.mergeStatic(this.scene);this.venueLayers=[];this.pool();this.resize();
 }
 beveled(){const s=new THREE.Shape(),c=.12;s.moveTo(-.5+c,-.5);s.lineTo(.5-c,-.5);s.lineTo(.5,-.5+c);s.lineTo(.5,.5-c);s.lineTo(.5-c,.5);s.lineTo(-.5+c,.5);s.lineTo(-.5,.5-c);s.lineTo(-.5,-.5+c);s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:.8,bevelEnabled:true,bevelThickness:.1,bevelSize:.055,bevelSegments:1,steps:1});g.translate(0,0,-.4);g.computeVertexNormals();return g;}
 material(color,glow=false){const key=color+':'+glow;if(!this.materials.has(key))this.materials.set(key,new THREE.MeshStandardMaterial({color,metalness:glow?.2:.32,roughness:glow?.4:.56,emissive:glow?color:0,emissiveIntensity:glow?1.6:0}));return this.materials.get(key);}
 mergeStatic(parent){parent.updateMatrixWorld(true);const inverse=parent.matrixWorld.clone().invert(),groups=new Map();parent.traverse(m=>{if(!m.isMesh||m.isInstancedMesh||m.material.transparent)return;const key=m.material.uuid+':'+m.castShadow+':'+m.receiveShadow;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m);});for(const list of groups.values()){if(list.length<2)continue;const geometries=list.map(m=>(()=>{const g=m.geometry.clone().applyMatrix4(inverse.clone().multiply(m.matrixWorld));return g.index?g.toNonIndexed():g;})());const merged=mergeGeometries(geometries);for(const g of geometries)g.dispose();if(!merged)continue;const mesh=new THREE.Mesh(merged,list[0].material);mesh.castShadow=list[0].castShadow;mesh.receiveShadow=list[0].receiveShadow;for(const m of list)m.removeFromParent();parent.add(mesh);}}
 box(parent,x,y,z,w,h,d,color,glow=false){const m=new THREE.Mesh(this.unitBox,this.material(color,glow));m.position.set(x,y,z);m.scale.set(w,h,d);m.castShadow=!glow;m.receiveShadow=!glow;parent.add(m);return m;}
 tube(parent,x,y,z,r,h,color){const m=new THREE.Mesh(this.cylinder,this.material(color));m.position.set(x,y,z);m.scale.set(r,h,r);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 text(label,color='#a6dfff',size=512){const c=document.createElement('canvas');c.width=size;c.height=128;const x=c.getContext('2d');x.fillStyle=color;x.font='800 66px system-ui';x.textAlign='center';x.fillText(label,size/2,86);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(6,1.5),mat);return mesh;}
 arena(){
  const floor=new THREE.Mesh(new THREE.CylinderGeometry(26,26,.65,64),this.material(0x536c7d));floor.position.y=-.4;floor.receiveShadow=true;this.scene.add(floor);
  const plateMat=this.material(0x708b99),geo=new THREE.CylinderGeometry(1.96,1.96,.07,6),tiles=[];
  for(let ix=-6;ix<=6;ix++)for(let iz=-6;iz<=6;iz++){const x=ix*3.46,z=iz*4+(ix%2?2:0);if(Math.hypot(x,z)<24.5)tiles.push({x,z});}
  const grid=new THREE.InstancedMesh(geo,plateMat,tiles.length),dummy=new THREE.Object3D();tiles.forEach((p,i)=>{dummy.position.set(p.x,-.035,p.z);dummy.updateMatrix();grid.setMatrixAt(i,dummy.matrix);grid.setColorAt(i,new THREE.Color(i%5?0x8da6bd:0xb3c4cf));});grid.receiveShadow=true;this.scene.add(grid);this.floorTiles=grid;this.tileCenters=tiles;
  for(const radius of [5.3,13.8,19.5]){const ring=new THREE.Mesh(new THREE.RingGeometry(radius-.04,radius+.04,96),new THREE.MeshBasicMaterial({color:radius===19.5?0xff8c45:0x397386,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.011;this.scene.add(ring);}
  for(let i=0;i<32;i++){const a=i/32*Math.PI*2,g=new THREE.Group();g.position.set(Math.sin(a)*21,0,-Math.cos(a)*21);g.rotation.y=-a;this.box(g,0,.8,0,3.7,1.6,1.3,0x547082);this.box(g,0,1.65,0,3.8,.13,1.4,0x4d6779);this.box(g,0,1.25,-.72,2.8,.07,.07,i%4?0x43c9e5:0xffad56,true);this.box(g,0,3.5,-2,3.9,.3,4,0x465f72);this.box(g,0,5,-4,3.9,.3,4,0x465f72);this.scene.add(g);}
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2,g=new THREE.Group();g.position.set(Math.sin(a)*23,0,-Math.cos(a)*23);g.rotation.y=-a;this.box(g,0,5,0,.9,10,1.5,0x354a5e);this.box(g,0,5,-.83,.13,8,.05,0x30bcdf,true);this.box(g,0,9,-1.5,2,.55,3,0x566f81);this.box(g,0,8.7,-2.2,1.4,.1,1.2,0xd1edff,true);this.scene.add(g);}
  for(const o of E.OBSTACLES){const g=new THREE.Group();g.position.set(o.x,0,o.z);this.tube(g,0,.18,0,1.85,.36,0x0c1d2b);this.tube(g,0,2,0,1.45,3.8,0x425367);this.tube(g,0,3.9,0,1.62,.28,0x71879a);this.tube(g,0,.6,0,1.55,.23,0xc48a48);for(let i=0;i<4;i++){const a=i*Math.PI/2;const stripe=this.box(g,Math.sin(a)*1.46,2,-Math.cos(a)*1.46,.14,2.4,.09,0x78dff1,true);stripe.rotation.y=-a;}this.scene.add(g);}
  const sign=this.text('METAL MAYHEM','#7fedff',1024);sign.position.set(0,6.8,-21);sign.scale.set(2.5,2.5,2.5);this.scene.add(sign);
  for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2,g=new THREE.Group();g.position.set(Math.sin(a)*19.4,0,-Math.cos(a)*19.4);g.rotation.y=-a;this.box(g,-1.5,1.5,0,.32,3,.5,0xffa04d,true);this.box(g,1.5,1.5,0,.32,3,.5,0xffa04d,true);this.box(g,0,3,0,3.3,.25,.5,0xffa04d,true);this.scene.add(g);}
 }
 venueName(wave){return venues[venueIndex(wave)].name;}
 createVenue(index){
  const venue=venues[index], layer=new THREE.Group();
  const label=this.text(venue.name.toUpperCase(),venue.ink,768);
  label.rotation.x=-Math.PI/2;
  label.position.set(0,.025,1.8);
  label.scale.setScalar(1.5);
  layer.add(label);
  // All skyline geometry sits beyond the arena wall and the camera collision boundary.
  for(let i=0;index!==0 && i<8;i++){
   const angle=i*Math.PI/4, bay=new THREE.Group();
   bay.position.set(Math.sin(angle)*28,0,-Math.cos(angle)*28);
   bay.rotation.y=-angle;
   layer.add(bay);
   if(index===1){
    const height=i%2?12:15;
    this.tube(bay,0,height/2,0,1.6,height,0x76584d);
    for(const y of [5,height-2,height])this.tube(bay,0,y,0,1.8,.55,0xd19158);
    this.tube(bay,0,height+.25,0,1.2,.16,0xffad53);
    this.box(bay,3.1,6,0,5.6,.8,.9,0x966642);
   }else{
    for(const side of [-1,1]){
     const fin=this.box(bay,side*2.2,7,0,1,10,.85,0xb3cbd8);
     fin.rotation.z=-side*.31;
     const strip=this.box(bay,side*2.2,7,.47,.17,9,.12,0x83ffe3,true);
     strip.rotation.z=fin.rotation.z;
    }
    this.tube(bay,0,7.2,0,.3,9,0x577699);
    this.box(bay,0,12,0,1.25,1.25,1.25,0xa9a4ff,true).rotation.z=Math.PI/4;
   }
  }
  this.mergeStatic(layer);
  this.scene.add(layer);
  return layer;
 }
 setVenue(wave){
  const index=venueIndex(wave);
  if(index===this.activeVenue)return;
  if(this.activeVenue!==undefined)this.venueLayers[this.activeVenue].visible=false;
  this.activeVenue=index;
  const layer=this.venueLayers[index]??(this.venueLayers[index]=this.createVenue(index));
  layer.visible=true;
  const venue=venues[index];
  this.scene.background.setHex(venue.sky);
  this.scene.fog.color.copy(this.scene.background);
  this.floorTiles.material.color.setHex(venue.floor);
  const tint=new THREE.Color();
  this.tileCenters.forEach(({x,z},i)=>{
   // Foundry service lanes and the relay's radial sectors stay below combat effects.
   let color=i%5?0x8da6bd:0xb3c4cf;
   if(index===1)color=Math.abs(x)>5 && Math.abs(x)<9?0xe8c58d:0xc4bbac;
   if(index===2)color=Math.cos(4*Math.atan2(z,x))>.55?0xacc8df:0xd2dee4;
   this.floorTiles.setColorAt(i,tint.setHex(color));
  });
  this.floorTiles.instanceColor.needsUpdate=true;
 }
 robot(a){
  const color=a.type==='player'?0x41c4e6:E.TYPES[a.type].color,steel=a.type==='player'?0xd1e2ee:0x8796a8,dark=0x152330,eye=a.type==='player'?0xc3fdff:0xffe1a1;
  const root=new THREE.Group(),parts={};this.scene.add(root);
  for(const part of ['core','head','leftArm','rightArm','leftLeg','rightLeg']){const g=new THREE.Group();parts[part]=g;root.add(g);
   if(part==='core'){
    this.box(g,0,0,0,.78,.72,.46,steel);this.box(g,0,.08,-.28,.68,.39,.12,color);this.box(g,0,.06,-.36,.14,.25,.035,eye,true);this.box(g,0,-.33,0,.55,.18,.38,dark);this.box(g,0,.04,.32,.46,.55,.25,dark);for(let i=-1;i<=1;i++)this.box(g,i*.15,.06,.47,.06,.32,.04,color,true);
    if(a.type==='hammer'||a.type==='giant'){this.box(g,0,-.05,-.38,.9,.3,.18,dark);this.box(g,0,-.07,-.49,.64,.05,.04,color,true);}
   }else if(part==='head'){
    this.box(g,0,0,0,.51,.43,.46,steel);this.box(g,0,-.035,-.26,.47,.18,.08,dark);this.box(g,-.12,-.01,-.31,.14,.055,.025,eye,true);this.box(g,.12,-.01,-.31,.14,.055,.025,eye,true);this.box(g,0,.24,.01,.27,.08,.4,color);this.box(g,-.3,0,.02,.08,.22,.2,color);this.box(g,.3,0,.02,.08,.22,.2,color);
    if(a.type==='speed'){this.box(g,0,.36,.02,.08,.3,.16,color);}
    if(a.type==='giant'){for(const x of [-.35,.35])this.box(g,x,.3,0,.13,.48,.15,0xffc16a,true);}
   }else if(part.endsWith('Arm')){
    this.box(g,0,0,0,.29,.6,.3,steel);this.box(g,0,.25,0,.47,.29,.46,color);this.box(g,0,-.25,-.02,.33,.25,.34,dark);this.box(g,0,.24,-.25,.24,.055,.04,eye,true);
    if(a.type==='armored')this.box(g,part==='leftArm'?-.12:.12,0,-.17,.48,.77,.19,color);
   }else{
    this.box(g,0,.05,0,.3,.72,.32,steel);this.box(g,0,-.08,-.2,.28,.33,.13,color);this.box(g,0,-.35,-.13,.37,.2,.63,dark);this.box(g,0,-.04,-.29,.19,.055,.03,eye,true);
   }
  }
  for(const part of Object.values(parts))this.mergeStatic(part);
  const weapon=new THREE.Group();const blade=this.box(weapon,0,0,0,.095,1,.075,a.type==='player'?0x79eeff:color,true);const spine=this.box(weapon,0,0,.04,.035,1,.06,steel);const guard=this.box(weapon,0,-.36,0,.38,.07,.18,dark);
  if(a.type==='hammer'||a.type==='giant')this.box(weapon,0,.36,0,.55,.27,.4,color);
  if(a.type==='archer'){blade.visible=false;spine.visible=false;this.box(weapon,0,0,0,.18,.6,.22,dark);this.box(weapon,0,.1,0,.8,.06,.15,color);for(const x of [-.4,.4])this.box(weapon,x,.18,0,.08,.22,.13,color);this.box(weapon,0,.19,-.13,.52,.018,.018,eye,true);}
  root.add(weapon);
  const telegraph=new THREE.Mesh(new THREE.RingGeometry(.55,.68,40),new THREE.MeshBasicMaterial({color:0xff6446,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));telegraph.rotation.x=-Math.PI/2;root.add(telegraph);
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.7,24),new THREE.MeshBasicMaterial({color:0x020912,transparent:true,opacity:.38,depthWrite:false}));shadow.rotation.x=-Math.PI/2;root.add(shadow);
  // Ground warning is visual only; actual contact still uses the swept weapon.
  const attackZone=new THREE.Group(),r=a.type==='archer'?12:((E.TYPES[a.type]?.reach||2.4)/a.scale),half=a.type==='archer'?.09:1.25;
  const fan=new THREE.Mesh(new THREE.RingGeometry(.4,r,32,1,Math.PI/2-half,half*2),new THREE.MeshBasicMaterial({color:0xff763a,transparent:true,opacity:.15,side:THREE.DoubleSide,depthWrite:false}));fan.rotation.x=-Math.PI/2;attackZone.add(fan);root.add(attackZone);
  for(const part of Object.values(parts))part.traverse(mesh=>{if(mesh.isMesh)mesh.restMaterial=mesh.material;});
  const model={root,parts,weapon,blade,spine,guard,telegraph,shadow,color,attackZone,fan};this.models.set(a.id,model);return model;
 }
 pool(){
  this.debrisMesh=new THREE.InstancedMesh(this.unitBox,this.material(0xa4b3c3),100);this.debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.debrisMesh.count=0;this.debrisMesh.castShadow=true;this.debrisMesh.frustumCulled=false;this.scene.add(this.debrisMesh);
  this.sparkMesh=new THREE.InstancedMesh(this.sphere,new THREE.MeshBasicMaterial({color:0xffffff}),180);this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.sparkMesh.count=0;this.sparkMesh.frustumCulled=false;this.scene.add(this.sparkMesh);
  this.boltMesh=new THREE.InstancedMesh(this.sphere,new THREE.MeshBasicMaterial({color:0xff668a}),36);this.boltMesh.frustumCulled=false;this.scene.add(this.boltMesh);
  this.dummy=new THREE.Object3D();
  this.trailPositions=new Float32Array(20*6*3);this.trailGeometry=new THREE.BufferGeometry();this.trailGeometry.setAttribute('position',new THREE.BufferAttribute(this.trailPositions,3).setUsage(THREE.DynamicDrawUsage));this.trailGeometry.setDrawRange(0,0);this.trail=new THREE.Mesh(this.trailGeometry,new THREE.MeshBasicMaterial({color:0x71f5ff,transparent:true,opacity:.38,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));this.trail.frustumCulled=false;this.scene.add(this.trail);this.trailHistory=[];
 }
 releaseFragment(f){f.mesh.removeFromParent();f.mesh.traverse(m=>{if(m.isMesh)m.geometry.dispose();});}
 detach(e){
  const model=this.models.get(e.id),source=e.type==='weapon'?model?.weapon:model?.parts[e.part];
  if(!source)return false;
  if(this.fragments.length>=24)this.releaseFragment(this.fragments.shift());
  const rest=[];source.traverse(m=>{if(m.isMesh)rest.push(m.restMaterial||m.material);});
  const mesh=source.clone(true);mesh.visible=true;let materialIndex=0;
  mesh.traverse(m=>{if(m.isMesh){m.geometry=m.geometry.clone();m.material=rest[materialIndex++];}});
  // Keep the original armor, silhouette and weapon, with independent geometry lifetime.
  if(e.type!=='weapon')mesh.position.set(e.x,e.y??1,e.z);
  this.scene.add(mesh);this.fragments.push({mesh,part:e.part||'weapon',scale:mesh.scale.clone(),vx:(Math.random()-.5)*5,vy:3+Math.random()*3,vz:(Math.random()-.5)*5,spinX:(Math.random()-.5)*7,spinZ:(Math.random()-.5)*7,life:4.5});return true;
 }
 effects(events){for(const e of events){
  if((e.type==='sever'||e.type==='weapon')&&!this.detach(e)){const leg=e.part?.endsWith('Leg'),core=e.part==='core';this.debris.push({x:e.x,y:e.y||1,z:e.z,vx:(Math.random()-.5)*6,vy:3+Math.random()*4,vz:(Math.random()-.5)*6,rx:Math.random()*3,rz:Math.random()*3,w:core?.6:leg?.25:.32,h:core?.6:leg?.65:.4,d:.3,life:4.8,color:e.color});}
  if(e.type==='sever'||(e.type==='armor'&&e.broken)){for(let i=0;i<6;i++)this.debris.push({x:e.x,y:e.y??1,z:e.z,vx:(Math.random()-.5)*7,vy:2+Math.random()*4,vz:(Math.random()-.5)*7,rx:Math.random()*3,rz:Math.random()*3,w:.10+Math.random()*.1,h:.12,d:.1,life:1.5+Math.random(),color:e.color||0xc7d9e7});}
  if(['hit','destroy','parry','armor','spark','sever','shoot'].includes(e.type)){const n=e.type==='destroy'?22:e.type==='parry'?18:8;for(let i=0;i<n;i++)this.sparks.push({x:e.x||0,y:e.y||1,z:e.z||0,vx:(Math.random()-.5)*8,vy:Math.random()*6,vz:(Math.random()-.5)*8,life:.3+Math.random()*.4,color:e.type==='parry'?0x7af6ff:0xffc164});}
  if(!this.mobile&&!this.reduced&&(e.type==='hit'||e.type==='destroy'))this.shake=Math.min(.15,e.type==='destroy'?.15:.065);
  if(e.type==='pulse')for(let i=0;i<32;i++){const a=i/32*Math.PI*2;this.sparks.push({x:e.x,y:.2,z:e.z,vx:Math.sin(a)*8,vy:1,vz:Math.cos(a)*8,life:.5,color:0x66ddff});}
 }this.debris=this.debris.slice(-100);this.sparks=this.sparks.slice(-180);}
 resize(){const w=this.canvas.clientWidth||innerWidth,h=this.canvas.clientHeight||innerHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.fov=cameraFraming(w/h,this.cameraMode).fov;this.camera.updateProjectionMatrix();}
 setCameraMode(mode){this.cameraMode=['wide','far','close'].includes(mode)?mode:'wide';this.resize();}
 render(s,dt,yaw=0,pitch=.4,intro=false){
  this.setVenue(s.wave);
  this.elapsed+=dt;this.frame++;const ids=new Set();
  for(const a of [s.player,...s.enemies]){if(!a.alive)continue;ids.add(a.id);const m=this.models.get(a.id)||this.robot(a);m.root.visible=true;
   for(const name of Object.keys(m.parts)){m.parts[name].visible=false;m.parts[name].traverse(mesh=>{if(mesh.isMesh)mesh.material=a.hitFlash>.07?this.flashMaterial:mesh.restMaterial;});}
   for(const part of E.segments(a)){const g=m.parts[part.name];g.visible=true;g.position.set(part.x,part.y,part.z);g.scale.setScalar(a.scale*(a.spawn>0?Math.max(.1,1-a.spawn/.8):1));g.rotation.set(0,-a.yaw,0);if(part.name.endsWith('Leg'))g.rotation.x=Math.sin(a.walk+(part.name==='leftLeg'?0:Math.PI))*.22;if(part.name==='core')g.rotation.z=Math.sin(a.walk*.5)*.035;}
   let blade=E.blade(a);
   if(a.telegraph>0&&a.type!=='archer'){
    const length=Math.hypot(blade.b.x-blade.a.x,blade.b.y-blade.a.y,blade.b.z-blade.a.z);
    blade=E.blade({...a,attack:{mode:a.combo%3,elapsed:0,duration:1}},0);
    const dx=blade.b.x-blade.a.x,dz=blade.b.z-blade.a.z,horizontal=Math.hypot(dx,dz)||1;
    blade.b={x:blade.a.x+dx/horizontal*length*Math.cos(.7),y:blade.a.y+length*Math.sin(.7),z:blade.a.z+dz/horizontal*length*Math.cos(.7)}; // Raise without stretching the weapon.
   }
   const start=new THREE.Vector3(blade.a.x,blade.a.y,blade.a.z),end=new THREE.Vector3(blade.b.x,blade.b.y,blade.b.z),v=end.clone().sub(start);m.weapon.visible=a.id===0?(a.hp.leftArm>0||a.hp.rightArm>0):a.hp.rightArm>0;m.weapon.position.copy(start).addScaledVector(v,.5);m.weapon.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize());m.weapon.scale.set(a.scale,v.length(),a.scale);
   m.telegraph.visible=a.telegraph>0||a.block||a.spawn>0;m.telegraph.position.set(a.x,.04,a.z);m.telegraph.scale.setScalar(a.scale*(1.2+(a.telegraph>0?Math.sin(this.elapsed*15)*.08:0)));m.telegraph.material.color.setHex(a.block?0x80efff:a.spawn>0?0xffbc67:0xff493b);
   m.attackZone.visible=a.id!==0&&a.telegraph>0&&a.hp.rightArm>0;m.attackZone.position.set(a.x,.035,a.z);m.attackZone.rotation.y=-a.yaw;m.attackZone.scale.setScalar(a.scale);m.fan.material.opacity=.12+.22*(1-Math.min(1,a.telegraph/(E.TYPES[a.type]?.windup||1)));
   m.shadow.position.set(a.x,.015,a.z);m.shadow.scale.setScalar(a.scale*(1-a.y*.07));
  }
  for(const [id,m]of this.models)if(!ids.has(id))m.root.visible=false;
  // Clear obsolete model trees at wave transitions; shared geometries/materials stay cached.
  if(this.models.size>30)for(const [id,m]of this.models)if(!ids.has(id)){this.scene.remove(m.root);for(const part of Object.values(m.parts))part.traverse(mesh=>{if(mesh.isMesh&&![this.unitBox,this.cylinder,this.sphere].includes(mesh.geometry))mesh.geometry.dispose();});m.fan.geometry.dispose();m.fan.material.dispose();m.telegraph.geometry.dispose();m.telegraph.material.dispose();m.shadow.geometry.dispose();m.shadow.material.dispose();this.models.delete(id);}
  for(let i=this.fragments.length-1;i>=0;i--){const f=this.fragments[i];f.life-=dt;if(f.life<=0){this.releaseFragment(f);this.fragments.splice(i,1);continue;}f.vy-=dt*14;f.mesh.position.x+=f.vx*dt;f.mesh.position.y+=f.vy*dt;f.mesh.position.z+=f.vz*dt;if(f.mesh.position.y<.25){f.mesh.position.y=.25;f.vy=Math.abs(f.vy)*.22;f.vx*=.85;f.vz*=.85;}f.mesh.rotation.x+=f.spinX*dt;f.mesh.rotation.z+=f.spinZ*dt;f.mesh.scale.copy(f.scale).multiplyScalar(Math.min(1,f.life));}
  const d=this.dummy;
  for(const arr of [this.debris,this.sparks])for(const p of arr){p.life-=dt;p.vy-=dt*14;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<.12){p.y=.12;p.vy=Math.abs(p.vy)*.28;p.vx*=.88;p.vz*=.88;}if(p.w){p.rx+=dt*2;p.rz+=dt*3;}}
  this.debris=this.debris.filter(p=>p.life>0);this.sparks=this.sparks.filter(p=>p.life>0);
  this.debrisMesh.count=this.debris.length;this.debris.forEach((p,i)=>{d.position.set(p.x,p.y,p.z);d.rotation.set(p.rx,0,p.rz);d.scale.set(p.w,p.h,p.d).multiplyScalar(Math.min(1,p.life));d.updateMatrix();this.debrisMesh.setMatrixAt(i,d.matrix);this.debrisMesh.setColorAt(i,new THREE.Color(p.color));});this.debrisMesh.instanceMatrix.needsUpdate=true;if(this.debrisMesh.instanceColor)this.debrisMesh.instanceColor.needsUpdate=true;
  this.sparkMesh.count=this.sparks.length;this.sparks.forEach((p,i)=>{d.position.set(p.x,p.y,p.z);d.rotation.set(0,0,0);d.scale.set(.035,.035+Math.min(.15,Math.abs(p.vy)*.015),.035);d.updateMatrix();this.sparkMesh.setMatrixAt(i,d.matrix);this.sparkMesh.setColorAt(i,new THREE.Color(p.color));});this.sparkMesh.instanceMatrix.needsUpdate=true;if(this.sparkMesh.instanceColor)this.sparkMesh.instanceColor.needsUpdate=true;
  this.boltMesh.count=s.projectiles.length;s.projectiles.forEach((p,i)=>{d.position.set(p.x,p.y,p.z);d.scale.set(.1,.1,.32);d.rotation.y=Math.atan2(p.vx,p.vz);d.updateMatrix();this.boltMesh.setMatrixAt(i,d.matrix);});this.boltMesh.instanceMatrix.needsUpdate=true;
  if(s.player.attack){const b=E.blade(s.player);this.trailHistory.push(b);this.trailHistory=this.trailHistory.slice(-5);}else this.trailHistory=[];
  let n=0;for(let i=1;i<this.trailHistory.length;i++){const a=this.trailHistory[i-1],b=this.trailHistory[i];for(const p of [a.a,a.b,b.b,a.a,b.b,b.a]){this.trailPositions[n++]=p.x;this.trailPositions[n++]=p.y;this.trailPositions[n++]=p.z;}}this.trailGeometry.attributes.position.needsUpdate=true;this.trailGeometry.setDrawRange(0,n/3);
  const p=s.player,target=new THREE.Vector3(p.x,p.y+1.35,p.z),framing=cameraFraming(this.camera.aspect,this.cameraMode),dist=framing.distance;
  const offset=new THREE.Vector3(-Math.sin(yaw)*dist,framing.height+(this.mobile?0:(pitch-.4)*3),Math.cos(yaw)*dist);
  if(intro){target.set(0,1.3,4);offset.set(-5,3.1,8);}
  const desired=target.clone().add(offset);
  this.camera.position.copy(followCamera(target,desired,this.camera.position,dt,E.OBSTACLES));
  for(const e of s.enemies)if(e.alive&&Math.hypot(this.camera.position.x-e.x,this.camera.position.z-e.z)<e.scale*.8&&this.camera.position.y<e.y+2.4*e.scale)this.camera.position.y=e.y+2.4*e.scale;
  if(this.shake>0&&dt){this.camera.position.x+=(Math.random()-.5)*this.shake;this.camera.position.y+=(Math.random()-.5)*this.shake;this.shake*=Math.exp(-18*dt);}
  this.camera.position.copy(clearCamera(target,this.camera.position,E.OBSTACLES));
  const overhead=Math.max(0,1-Math.hypot(this.camera.position.x-target.x,this.camera.position.z-target.z)/1.2);
  this.camera.up.set(Math.sin(yaw)*overhead,1-overhead,-Math.cos(yaw)*overhead);
  this.camera.lookAt(target);
  this.renderer.render(this.scene,this.camera);
 }
 reset(){for(const f of this.fragments)this.releaseFragment(f);this.fragments=[];for(const m of this.models.values())m.root.visible=false;this.debris=[];this.sparks=[];this.trailHistory=[];}
 setQuality(low){this.low=low;this.renderer.setPixelRatio(low?1:Math.min(devicePixelRatio,this.mobile?1.45:1.8));this.renderer.shadowMap.enabled=!low;this.resize();}
 stats(){return {drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,debris:this.debris.length,fragments:this.fragments.length,sparks:this.sparks.length,models:this.models.size};}
}
window.MetalMayhemView=ArenaView;
