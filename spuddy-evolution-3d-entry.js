import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// All geometry is original and generated locally. No remote textures or models.
function create(canvas, game) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch { return { available: false, draw() {}, resize() {}, burst() {}, guide() {}, rotate() {}, transformInput: v => v }; }
  canvas.dataset.renderer = 'webgl-3d';
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = .95;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#63c8eb');
  scene.fog = new THREE.Fog('#63c8eb', 38, 95);
  const camera = new THREE.OrthographicCamera(-10, 10, 15, -15, .1, 150);
  const hemisphere = new THREE.HemisphereLight('#f3fbff', '#608eb5', 1.4);
  scene.add(hemisphere);
  const rim = new THREE.DirectionalLight('#9edcff', 1.1); rim.position.set(8, 10, -14); scene.add(rim);
  const sun = new THREE.DirectionalLight('#fff3de', 2.4);
  sun.position.set(-12, 24, 12); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -19; sun.shadow.camera.right = 19;
  sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22;
  sun.shadow.camera.near = .5; sun.shadow.camera.far = 70; sun.shadow.normalBias = .08; sun.shadow.bias = -.0003;
  scene.add(sun, sun.target);
  const materials = new Map();
  function mat(color, options = {}) {
    const key = color + JSON.stringify(options);
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .43, metalness: .06, ...options }));
    return materials.get(key);
  }
  const geo = {
    shell: new THREE.DodecahedronGeometry(1, 0), sphere: new THREE.SphereGeometry(1, 18, 12), box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 12), cone: new THREE.ConeGeometry(1, 1, 8),
    ring: new THREE.RingGeometry(.94, 1, 64), disk: new THREE.CircleGeometry(1, 48)
  };
  const basic = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: THREE.DoubleSide, depthWrite: opacity === 1 });
  function mesh(parent, geometry, material, position, scale, shadow = false) {
    const m = new THREE.Mesh(geometry, material); m.position.set(...position); m.scale.set(...scale);
    m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
  }
  const ball = (p, x, y, z, sx, sy, sz, color, shadow = false) => mesh(p, geo.sphere, mat(color), [x, y, z], [sx, sy, sz], shadow);
  const box = (p, x, y, z, sx, sy, sz, color, shadow = false) => mesh(p, geo.box, mat(color), [x, y, z], [sx, sy, sz], shadow);
  function cylinder(p, x, y, z, r, height, color, shadow = false) { return mesh(p, geo.cylinder, mat(color), [x, y, z], [r, height, r], shadow); }
  const up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), start = new THREE.Vector3(), end = new THREE.Vector3();
  function segment(m, a, b, radius) {
    start.set(...a); end.set(...b); tmp.subVectors(end, start); m.position.copy(start).add(end).multiplyScalar(.5);
    m.scale.set(radius, tmp.length(), radius); m.quaternion.setFromUnitVectors(up, tmp.normalize());
  }
  function label(parent, text, x, y, z, color = '#315c52', width = 5) {
    const el = document.createElement('canvas'); el.width = 512; el.height = 88;
    const ctx = el.getContext('2d'); ctx.font = '800 28px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fffef0'; ctx.roundRect(8, 8, 496, 72, 28); ctx.fill(); ctx.fillStyle = color; ctx.fillText(text, 256, 44);
    const texture = new THREE.CanvasTexture(el); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: true, transparent: true }));
    sprite.position.set(x, y, z); sprite.scale.set(width, width * 88 / 512, 1); parent.add(sprite); return sprite;
  }
  function ring(parent, radius, color, opacity = 1) {
    const m = new THREE.Mesh(geo.ring, basic(color, opacity)); m.rotation.x = -Math.PI / 2; m.scale.setScalar(radius); m.position.y = .09; parent.add(m); return m;
  }
  // Cheap ground-contact shadows keep small creatures visually grounded.
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
  const shadowContext = shadowCanvas.getContext('2d');
  const gradient = shadowContext.createRadialGradient(32, 32, 2, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(18,39,57,.38)'); gradient.addColorStop(1, 'rgba(18,39,57,0)');
  shadowContext.fillStyle = gradient; shadowContext.fillRect(0, 0, 64, 64);
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false });
  function contact(parent, size) { const m = mesh(parent, geo.disk, shadowMaterial, [0, .025, 0], [size, size, 1]); m.rotation.x = -Math.PI / 2; return m; }
  const colors = ['#29c76c', '#9760ef', '#19bddb', '#ff853b', '#ec53b2'];
  const floorColors = [['#68b85b', '#71be61'], ['#aca0d9', '#b3a7df'], ['#88d4df', '#94dce5'], ['#d49568', '#dda070'], ['#ba8dc8', '#c397ce']];
  const world = [], gates = [], outposts = [];
  const dummy = new THREE.Object3D();
  const background = box(scene, 0, -.7, -60, 240, .5, 320, '#397f79');
  background.receiveShadow = false;
  function leaf(parent, x, y, z, scale, angle, color) {
    const l = ball(parent, x, y, z, .18 * scale, .62 * scale, .12 * scale, color); l.rotation.z = angle; return l;
  }
  function plant(parent, x, z, size, color) {
    cylinder(parent, x, .22, z, size * .45, .4, '#a4b49b');
    for (let i = 0; i < 4; i++) leaf(parent, x + Math.sin(i * 2.4) * .22 * size, .7 * size, z + Math.cos(i * 2.4) * .22 * size, size, (i - 1.5) * .5, color);
  }
  function crystal(parent, x, z, size, color) {
    const m = mesh(parent, geo.cone, mat(color, { roughness: .2, metalness: .18 }), [x, size * .8, z], [size * .45, size * 1.7, size * .45], true);
    m.rotation.z = .17; m.rotation.y = .4;
    mesh(parent, geo.cone, mat('#d8f7ee'), [x + .4 * size, size * .4, z + .2], [size * .3, size * .8, size * .3]);
  }
  function pod(parent, x, z, color) {
    cylinder(parent, x, .3, z, 1.05, .6, '#718f97', true);
    cylinder(parent, x, 2.2, z, .95, .3, '#e8efee', true);
    mesh(parent, geo.cylinder, mat('#99e9d6', { transparent: true, opacity: .22, depthWrite: false, roughness: .1 }), [x, 1.25, z], [.82, 1.7, .82]);
    ball(parent, x, 1.3, z, .45, .6, .45, color);
    for (const a of [-.75, .75]) box(parent, x + a, 1.3, z, .12, 2, .12, '#a9babd');
    const glow = mat('#62dfc5', { emissive: '#28a994', emissiveIntensity: .6 });
    mesh(parent, geo.cylinder, glow, [x, .65, z], [.87, .08, .87]);
  }
  function nest(parent, x, z, main) {
    const g = new THREE.Group(); parent.add(g); g.position.set(x, 0, z);
    cylinder(g, 0, .08, 0, main ? 2.5 : 2, .18, '#24a66a');
    cylinder(g, 0, .2, 0, main ? 2.1 : 1.6, .2, '#b8ef5a');
    cylinder(g, 0, .34, 0, .85, .4, '#629e87');
    ring(g, main ? 2.7 : 2.2, '#edffe4', .75);
    const clearing = mesh(g, geo.disk, mat('#bdcc8c', {roughness:1}), [0,.015,0], [main ? 3.6 : 2.8, main ? 3.6 : 2.8, 1]); clearing.rotation.x = -Math.PI/2;
    for(let i=0;i<12;i++) {
      const angle=i*Math.PI/6, radius=main ? 3.25 : 2.5;
      const x=Math.sin(angle)*radius,z=Math.cos(angle)*radius;
      ball(g,x,.12,z,.24,.12,.2,i%2 ? '#8ca782':'#a6ba91');
      if(i%3===0) { for(let j=0;j<5;j++){const a=j*Math.PI*2/5;ball(g,x+Math.sin(a)*.16,.28,z+Math.cos(a)*.16,.12,.055,.12,'#ff85b5');}ball(g,x,.31,z,.09,.06,.09,'#ffe77b'); }
    }
    // A carved seed emblem gives the home base its own identity.
    const emblem = new THREE.Group(); g.add(emblem); emblem.position.set(0,.45,-1.8);
    ball(emblem,0,.25,0,.32,.42,.16,'#ffc144',true); leaf(emblem,.17,.74,0,.48,-.6,'#138c63');

    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; ball(g, Math.sin(a) * (main ? 1.9 : 1.4), .4, Math.cos(a) * (main ? 1.9 : 1.4), .28, .2, .3, '#ffd354', true); }
    plant(g, -1, -.5, .9, '#519e75');
    label(g, main ? 'HOME NEST · BANK & HEAL' : 'OUTPOST · BANK & HEAL', 0, .6, 3, '#44725b', 5);
    return g;
  }
  for (let zi = 0; zi < SpuddyEvolution.zones.length; zi++) {
    const zone = SpuddyEvolution.zones[zi], group = new THREE.Group(); scene.add(group); world.push(group);
    // Deterministic surface detail replaces the distracting checkerboard.
    const terrainCanvas = document.createElement('canvas'); terrainCanvas.width = terrainCanvas.height = 256;
    const tc = terrainCanvas.getContext('2d'); tc.fillStyle = floorColors[zi][0]; tc.fillRect(0, 0, 256, 256);
    let seed = zi + 73; const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
    for (let i = 0; i < 480; i++) {
      const x = random() * 256, y = random() * 256; tc.strokeStyle = i % 2 ? '#ffffff12' : '#173f3510'; tc.lineWidth = 1;
      tc.beginPath(); tc.moveTo(x, y); tc.lineTo(x + 2, y - 3 - random() * 4); tc.stroke();
    }
    if (zi === 1 || zi === 3) { tc.strokeStyle = '#44365a24'; tc.lineWidth = 2; tc.strokeRect(3, 3, 250, 250); tc.fillStyle = '#eaf7ff60'; for (const x of [12,244]) for (const y of [12,244]) { tc.beginPath();tc.arc(x,y,2,0,Math.PI*2);tc.fill(); } }
    const terrainTexture = new THREE.CanvasTexture(terrainCanvas); terrainTexture.colorSpace = THREE.SRGBColorSpace;
    terrainTexture.wrapS = terrainTexture.wrapT = THREE.RepeatWrapping; terrainTexture.repeat.set(7,8); terrainTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    mesh(group, geo.box, mat('#ffffff', { map: terrainTexture, roughness: .9 }), [0, -.15, zone.min + 16], [28, .25, 32]);
    // Low ground-cover clusters remain passable and do not hide attack markers.
    const groundCover = new THREE.InstancedMesh(geo.sphere, mat(zi === 0 ? '#ffdc7c' : '#dceaff'), 90);
    for (let i=0;i<90;i++) { const x = (i%2 ? -1:1)*(4.6+random()*6), z=zone.min+2+random()*28; dummy.position.set(x,.04,z); dummy.scale.set(.045+random()*.07,.025,.06);dummy.rotation.set(0,0,0);dummy.updateMatrix();groundCover.setMatrixAt(i,dummy.matrix); } group.add(groundCover);
    for (const x of [-13.5, 13.5]) {
      box(group, x, .6, zone.min + 16, .8, 1.2, 32, '#a8bdb7', true);
      box(group, x, 1.25, zone.min + 16, 1, .16, 32, '#eef2df');
    }
    for (let i = 0; i < 8; i++) {
      const x = i % 2 ? -11.5 : 11.5, z = zone.min + 3 + i * 3.4;
      if (zi === 0 || zi === 4) plant(group, x, z, 1 + i % 3 * .2, zi === 4 ? '#ed42bd' : '#20bd60');
      else crystal(group, x, z, .9 + i % 3 * .25, colors[zi]);
    }
    pod(group, -8.7, zone.min + 13, colors[zi]); pod(group, 8.7, zone.min + 18, colors[zi]);
    for (const x of [-9, 9]) {
      box(group, x, .35, zone.min + 23, 2.1, .7, 1.2, '#96aeb0', true);
      box(group, x, .75, zone.min + 23, 2.3, .12, 1.4, '#edf1e2');
      box(group, x, 1, zone.min + 23, 1.3, .35, .2, colors[zi]);
    }
    // Instanced border details add density without hundreds of draw calls.
    const petals = new THREE.InstancedMesh(geo.sphere, mat(zi === 0 ? '#ff72af' : zi === 4 ? '#ffe363' : colors[zi]), 96);
    const grass = new THREE.InstancedMesh(geo.cone, mat(zi === 0 ? '#239e55' : colors[zi]), 48);
    for (let i = 0; i < 48; i++) {
      const x = (i % 2 ? -1 : 1) * (11.7 + Math.sin(i * 7.3) * .5), z = zone.min + 1 + (i * 1.73 % 30);
      dummy.position.set(x, .28, z); dummy.scale.set(.12, .6, .12); dummy.rotation.set(0, i, .15); dummy.updateMatrix(); grass.setMatrixAt(i, dummy.matrix);
      for (let j = 0; j < 2; j++) { dummy.position.set(x + j * .22, .22, z + .25); dummy.scale.set(.15, .1, .15); dummy.updateMatrix(); petals.setMatrixAt(i * 2 + j, dummy.matrix); }
    }
    group.add(petals, grass);
    for (const x of [-12.8, 12.8]) {
      box(group, x, .08, zone.min + 16, .18, .08, 31, colors[zi]);
      for (let j = 0; j < 4; j++) { cylinder(group, x, .65, zone.min + 4 + j * 8, .22, 1.3, '#36576f'); ball(group, x, 1.35, zone.min + 4 + j * 8, .28, .18, .28, '#fff3a3'); }
    }
    if (zi === 0) {
      nest(group, 0, 9, true);
      box(group, 0, -.28, 20, 28, .35, 8, '#397d58');
      for(let i=0;i<9;i++) {
        const x=-12+i*3, z=17+(i%2)*1.4;
        ball(group,x,.45,z,1.65,.7,1.3,'#248663',true);
        ball(group,x-.45,1,z,1.05,.7,.9,i%2 ? '#36a56a':'#57ba73',true);
        for(let j=0;j<3;j++)ball(group,x+(j-1)*.55,1.5,z,.12,.12,.12,'#ffb6c9');
      }
    }
    else {
      const n = nest(group, -8, zone.max - 6, false); outposts.push({ group: n, zone: zi });
      const gate = new THREE.Group(); scene.add(gate); gate.position.z = zone.max;
      for (const x of [-5, 5]) { box(gate, x, 1.5, 0, 1.5, 3, 1.7, '#a8b8bd', true); box(gate, x, 3.1, 0, 1.8, .25, 2, '#e5c77b'); }
      for (const x of [-9.5, 9.5]) box(gate, x, .9, 0, 7, 1.8, .8, '#bdc8c8', true);
      const field = mesh(gate, geo.box, mat('#64d9cf', { emissive: '#2cafac', emissiveIntensity: .8, transparent: true, opacity: .45 }), [0, 1.4, 0], [8.4, 2.8, .12]);
      const sign = label(gate, zone.name.toUpperCase(), 0, 3.8, 0, '#4d667a', 7);
      gates.push({ group: gate, field, sign, zone: zi });
    }
  }
  function spud(scale = 1, color = '#ffb52b', player = false) {
    const group = new THREE.Group(), rig = new THREE.Group(); group.add(rig);
    contact(group, 1.4);
    const body = ball(rig, 0, 1, 0, .86, 1, .74, color, player);
    for (const x of [-.31, .31]) {
      ball(rig, x, 1.13, .65, .2, .25, .13, '#fffaf0');
      ball(rig, x + .025, 1.12, .77, .094, .13, .055, '#173d39');
      ball(rig, x + .047, 1.17, .814, .03, .038, .02, '#ffffff');
      ball(rig, x * 1.6, .83, .62, .13, .07, .04, '#d68d69');
    }
    const mouth = mesh(rig, new THREE.TorusGeometry(.15, .032, 6, 12, Math.PI), mat('#805f39'), [0, .82, .74], [1, 1, 1]); mouth.rotation.z = Math.PI;
    for (const side of [-1, 1]) for (let i = 0; i < 3; i++) ball(rig, side * (.48 + i * .07), .92 + (i % 2) * .1, .64 - i * .07, .025, .025, .018, '#b96e26');
    const belt = mesh(rig, new THREE.TorusGeometry(.78,.065,6,24), mat('#08735d'), [0,.64,0], [1,1,.92]); belt.rotation.x=Math.PI/2;
    ball(rig,0,.65,.72,.16,.14,.08,'#ffe69b');
    const leaves = [];
    for (let i = 0; i < 4; i++) leaves.push(leaf(rig, (i - 1.5) * .17, 2.04 + (i % 2) * .1, 0, .7, (i - 1.5) * .45, i % 2 ? '#129c57' : '#46d864'));
    const limbs = [];
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      const upper = mesh(group, geo.cylinder, mat('#087c67'), [0, 0, 0], [.1, 1, .1]);
      const lower = mesh(group, geo.cylinder, mat('#1bbf8b'), [0, 0, 0], [.09, 1, .09]);
      const foot = ball(group, 0, .15, 0, .2, .14, .22, '#08745c');
      limbs.push({ a, upper, lower, foot });
    }
    const armor = new THREE.Group(); rig.add(armor);
    for (const x of [-.82, .82]) ball(armor, x, 1.2, 0, .23, .4, .35, '#4faca8', player);
    armor.visible = false;
    for(const side of [-1,1]){const claw=mesh(armor,geo.cone,mat('#ffe9a3'),[side*1.08,.9,.45],[.17,.65,.17]);claw.rotation.z=-side*.8;}
    const crown = new THREE.Group(); rig.add(crown);
    for (let i = 0; i < 5; i++) mesh(crown, geo.cone, mat('#93dfcc', { metalness: .2 }), [(i - 2) * .25, 2, -.2], [.15, .65, .15]);
    for(const side of [-1,1])mesh(crown,geo.shell,mat('#3ce1d0'),[side*.75,.95,.2],[.3,.5,.25]);
    crown.visible = false; group.scale.setScalar(scale);
    return { group, rig, body, limbs, leaves, armor, crown };
  }
  function animateSpud(model, phase, moving, form = 0) {
    model.rig.position.y = Math.sin(phase * 2) * (moving ? .07 : .025);
    model.armor.visible = form >= 1; model.crown.visible = form >= 2;
    for (let i = 0; i < model.limbs.length; i++) {
      const limb = model.limbs[i], a = limb.a, swing = moving ? Math.sin(phase + i * 2) * .23 : 0;
      const x = Math.cos(a) * 1.25, z = Math.sin(a) * 1.05 + swing, y = .14 + Math.max(0, swing);
      segment(limb.upper, [Math.cos(a) * .6, .7, Math.sin(a) * .5], [Math.cos(a) * 1.05, .5, Math.sin(a) * .9], .1);
      segment(limb.lower, [Math.cos(a) * 1.05, .5, Math.sin(a) * .9], [x, y, z], .085); limb.foot.position.set(x, y, z);
    }
    model.leaves.forEach((leaf, i) => { leaf.rotation.x = Math.sin(phase * .6 + i) * .14; });
  }
  const player = spud(1.08, '#ffb52b', true); scene.add(player.group);
  const companion = spud(.5, '#8ac7a1'); scene.add(companion.group);
  const actors = new Map();
  let combinedParts = 0;
  function createActor(e) {
    const group = new THREE.Group(); scene.add(group);
    const bodyColor = e.boss ? ['#375f48','#573376','#265975','#833d29','#70345d'][e.zone] : e.kind === 'hunter' ? '#9e244d' : e.kind === 'runner' ? '#ba5621' : e.kind === 'floater' ? '#62399b' : '#167c70';
    const size = e.boss ? 1.65 + e.zone * .08 : .61;
    const body = ball(group, 0, size, 0, size, size * .8, size * .85, bodyColor, e.boss);
    body.material = body.material.clone();
    const shellColor = e.boss ? '#263441' : e.kind === 'hunter' ? '#421a36' : e.kind === 'runner' ? '#633019' : e.kind === 'floater' ? '#302346' : '#1c4547';
    const glowColor = e.kind === 'floater' ? '#e393ff' : e.kind === 'grazer' ? '#b3ff57' : '#ffb62d';
    const glow = mat(glowColor, {emissive:glowColor,emissiveIntensity:1.25,roughness:.2}).clone();
    const wings = [], tendrils = [], tails = [];
    const profile = e.boss ? [1.08,1,1.08] : e.kind === 'hunter' ? [1.12,.9,1.12] : e.kind === 'runner' ? [.78,1.18,1.05] : e.kind === 'floater' ? [.9,1.08,.9] : [1.22,.82,1.2];
    const cap = mesh(group, geo.shell, mat(shellColor,{roughness:.32,metalness:.18}), [0,size*1.6,-size*.2], [size*.94,size*.24,size*.75],e.boss);
    for (const side of [-1, 1]) {
      ball(group, side * size * .36, size * 1.2, size * .73, size * .3, size * .21, size * .14, '#14212c');
      const eye=mesh(group,geo.sphere,glow,[side*size*.36,size*1.23,size*.86],[size*.22,size*.085,size*.06]);eye.rotation.z=side*.3;
      const brow=box(group,side*size*.36,size*1.4,size*.8,size*.59,size*.13,size*.14,shellColor);brow.rotation.z=side*.3;
    }
    // 1. Sculpted cheek plates and narrow pupils frame the glowing eyes.
    for(const side of [-1,1]) {
      const cheek=box(group,side*size*.65,size*.95,size*.65,size*.32,size*.4,size*.22,shellColor);cheek.rotation.z=side*.35;
      ball(group,side*size*.36,size*1.23,size*.915,size*.035,size*.075,size*.025,'#17131d');
      ball(group,side*size*.1,size*1.04,size*.86,size*.04,size*.035,size*.025,'#111d24');
    }
    const jaw = new THREE.Group(); group.add(jaw); jaw.position.set(0,size*.72,size*.72);
    ball(jaw,0,0,0,size*.55,size*.3,size*.2,'#14212c');
    for(let i=0;i<5;i++) {
      const x=(i-2)*size*.18;
      const tooth=mesh(jaw,geo.cone,mat('#f4e7b4'),[x,size*.13,size*.18],[size*.075,size*(i===0||i===4?.44:i%2?.2:.28),size*.075]);tooth.rotation.z=Math.PI;
      mesh(jaw,geo.cone,mat('#d9cc9d'),[x,-size*.16,size*.17],[size*.06,size*.16,size*.06]);
    }
    // 2. A contrasting lower jaw makes the bite readable from above.
    ball(jaw,0,-size*.24,-size*.035,size*.56,size*.13,size*.22,shellColor);
    // A ridge of angular carapace spikes breaks up the former rounded caps.
    for(let i=0;i<4;i++) {
      const z=(i-1.5)*size*.43;
      mesh(group,geo.cone,mat(i%2 ? shellColor : bodyColor),[0,size*1.88,z],[size*.22,size*(.45+i*.08),size*.24],e.boss);
    }
    // 4. Overlapping side armor with habitat-colored seams.
    for(const side of [-1,1])for(let i=0;i<2;i++) {
      const plate=box(group,side*size*.84,size*(1.05+i*.3),-size*.15,size*.22,size*.29,size*.8,shellColor);plate.rotation.z=-side*.22;
      box(group,side*size*.97,size*(1.12+i*.3),-size*.15,size*.025,size*.035,size*.55,bodyColor);
    }
    const groundShadow = contact(scene, size * 1.6);
    // Silhouettes communicate each monster's role even at phone size.
    if (e.kind === 'hunter' || e.boss) {
      for (const side of [-1, 1]) {
        const horn = mesh(group, geo.cone, mat('#fff0b0'), [side * size * .7, size * 2, -.12], [size * .2, size * 1.1, size * .22], true); horn.rotation.z = -side * .35;
        const tip=mesh(group,geo.cone,mat('#8a6246'),[side*size*.9,size*2.57,-.12],[size*.11,size*.36,size*.11]);tip.rotation.z=-side*.75;
        mesh(group, geo.cone, mat('#fff6df'), [side * size * .27, size * .7, size * .85], [size * .12, size * .3, size * .12]).rotation.z = Math.PI;
      }
    } else if (e.kind === 'runner') {
      for (const side of [-1, 1]) { const horn = mesh(group,geo.cone,mat('#f1ba5b'),[side*size*.5,size*2.15,-size*.2],[size*.16,size*.95,size*.2]);horn.rotation.z=side*.6; }
    } else if (e.kind === 'floater') {
      for (const side of [-1,1]) {
        const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(side*1.6,.7);shape.lineTo(side*1.25,-.15);shape.lineTo(side*.9,.12);shape.lineTo(side*.6,-.4);shape.lineTo(0,0);
        const wing=mesh(group,new THREE.ShapeGeometry(shape),mat('#a75ac6',{side:THREE.DoubleSide}),[side*size*.6,size*1.5,0],[size,size,size]);wing.rotation.x=-.5;wings.push({wing,side});
        const rib=mesh(wing,geo.cylinder,mat('#3a244b'),[0,0,0],[1,1,1]);segment(rib,[0,0,0],[side*1.55,.68,0],.045);
        const rib2=mesh(wing,geo.cylinder,mat('#3a244b'),[0,0,0],[1,1,1]);segment(rib2,[0,0,0],[side*.63,-.38,0],.035);
      }
    } else {
      for(const side of [-1,1])for(let i=0;i<3;i++){const plate=mesh(group,geo.cone,mat('#77bc75'),[side*size*.85,size*1.3,(i-1)*size*.5],[size*.24,size*.55,size*.28]);plate.rotation.z=-side*.9;}
    }
    if(e.kind==='hunter' || e.boss) {
      for(let i=0;i<4;i++) { const tail=mesh(group,geo.cone,mat(i===3?'#eac183':shellColor),[0,0,0],[1,1,1]); tails.push({tail,i}); }
    }
    if(e.kind==='runner') {
      for(const side of [-1,1]) { ball(group,side*size*.7,size*.55,-size*.35,size*.42,size*.43,size*.5,bodyColor); const fin=mesh(group,geo.cone,mat('#ea9b40'),[side*size*.3,size*1.6,-size*.65],[size*.18,size*.8,size*.25]);fin.rotation.x=-.5; }
    }
    if(e.kind==='grazer') {
      for(let i=0;i<3;i++) { const scale=1-i*.12;mesh(group,geo.shell,mat(i%2?'#306a66':'#488f79',{metalness:.15}),[0,size*(1.45+i*.18),-size*.25],[size*scale,size*.25,size*.7*scale]); }
    }
    if(e.kind==='floater') {
      for(let i=0;i<3;i++){const vine=mesh(group,geo.cylinder,mat('#a460c3'),[0,0,0],[1,1,1]);tendrils.push({vine,side:i-1,i,floating:true});}
    }
    if(e.boss) {
      const sigil=mesh(group,geo.shell,glow,[0,size*1.8,size*.65],[size*.21,size*.25,size*.12]);
      for(const side of [-1,1])mesh(group,geo.shell,mat(bodyColor,{metalness:.18}),[side*size*.95,size*1.3,0],[size*.45,size*.5,size*.65],true);
    }
    const legs = [];
    for (let i = 0; i < (e.boss ? 6 : 4); i++) {
      const a = i * Math.PI * 2 / (e.boss ? 6 : 4);
      const leg = mesh(group, geo.cylinder, mat('#293e49'), [0, 0, 0], [1, 1, 1]);
      const shin=mesh(group,geo.cylinder,mat('#40525a'),[0,0,0],[1,1,1]);
      const claw=mesh(group,geo.cone,mat('#e2ca92'),[0,0,0],[size*.11,size*.35,size*.11]);claw.rotation.x=Math.PI/2;claw.rotation.z=-a;
      const joint=ball(group,0,0,0,size*.16,size*.12,size*.16,shellColor);
      legs.push({ leg, shin, a, claw, joint });
    }
    let warning;
    if (e.boss) {
      for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; mesh(group, geo.cone, mat(e.zone === 3 ? '#ffc184' : '#c4eee0'), [Math.sin(a) * size * .8, size * 1.7, Math.cos(a) * size * .65], [.2, .9, .2]); }
      // 10. Boss silhouettes are tied to their habitat rather than recolors.
      for(const side of [-1,1]) {
        if(e.zone===0) { for(let i=0;i<3;i++){const thorn=mesh(group,geo.cone,mat('#96c276'),[side*size*(.95+i*.12),size*(1.6+i*.25),-.3],[.16,.85,.16]);thorn.rotation.z=-side*(.6+i*.12);} }
        if(e.zone===1 || e.zone===2) { const gem=mesh(group,geo.cone,mat(e.zone===1?'#bd7af9':'#85e6f9',{metalness:.25,roughness:.15}),[side*size*.9,size*1.6,0],[size*.38,size*1.35,size*.38],true);gem.rotation.z=-side*.4; }
        if(e.zone===3) { const curl=mesh(group,new THREE.TorusGeometry(size*.48,size*.14,6,14,Math.PI*1.45),mat('#db8f45'),[side*size*.9,size*1.8,0],[1,1,1]);curl.rotation.y=side*.6; }
        if(e.zone===4) { for(let i=0;i<3;i++){const vine=mesh(group,geo.cylinder,mat('#a73886'),[0,0,0],[1,1,1]);tendrils.push({vine,side,i});} }
      }
      warning = mesh(scene, e.zone === 3 ? geo.box : geo.disk, basic('#ef6a5f', .32), [0, .12, 0], [1, 1, 1]);
      if (e.zone !== 3) warning.rotation.x = -Math.PI / 2;
      warning.visible = false;
      label(group, SpuddyEvolution.zones[e.zone].boss.toUpperCase(), 0, size * 2.9, 0, '#6e5662', 6);
    }
    if (!e.boss) {
      warning = mesh(scene, geo.disk, basic('#ff7957', .45), [0, .12, 0], [1, 1, 1]);
      warning.rotation.x = -Math.PI / 2; warning.visible = false;
    }
    const health = new THREE.Group(); group.add(health); health.position.y = size * 2.4;
    mesh(health, geo.box, basic('#263e48', .4), [0, 0, 0], [size * 2, .09, .02]);
    const fill = mesh(health, geo.box, basic(e.boss ? '#e37477' : '#6fb28b'), [0, 0, .02], [size * 2, .09, .02]);
    // Combine only static direct children; articulated parts keep their pivots.
    const movingParts=new Set([body,cap,...wings.map(x=>x.wing),...tendrils.map(x=>x.vine),...tails.map(x=>x.tail),...legs.flatMap(x=>[x.leg,x.shin,x.claw,x.joint])]);
    const batches=new Map();
    for(const child of [...group.children]) if(child.isMesh && !movingParts.has(child)) {
      const key=child.material.uuid+':'+child.castShadow;
      if(!batches.has(key))batches.set(key,[]);batches.get(key).push(child);
    }
    for(const children of batches.values())if(children.length>1) {
      const geometries=children.map(m=>{m.updateMatrix();return m.geometry.clone().applyMatrix4(m.matrix);});
      const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
      if(geometry){const merged=new THREE.Mesh(geometry,children[0].material);merged.castShadow=children[0].castShadow;merged.receiveShadow=true;children.forEach(m=>group.remove(m));group.add(merged);combinedParts+=children.length-1;}
    }
    actors.set(e.id, { group, body, cap, legs, size, fill, health, warning, groundShadow, jaw, glow, wings, tendrils, tails, profile, deathFade: 0, wasDead: false, gait: 0, lastX: e.x, lastZ: e.z, facing: 0 });
  }
  for(const e of game.s.enemies)createActor(e);
  const shots=Array.from({length:32},()=>{const m=mesh(scene,geo.sphere,mat('#e6a1ff',{emissive:'#aa26df',emissiveIntensity:1.3}),[0,0,0],[.23,.23,.23]);m.visible=false;return m;});
  const reach = ring(scene, game.stats().range, '#ffffff', .55), pulseRing = ring(scene, 1, '#7affcf', .8);
  const roots = [];
  for (let i = 0; i < 6; i++) { const pieces = []; for (let j = 0; j < 6; j++) pieces.push(mesh(scene, geo.cylinder, mat('#62ba98', { emissive: '#2d7f68', emissiveIntensity: .25 }), [0, 0, 0], [.06, 1, .06])); roots.push(pieces); }
  const sparks = [];
  for (let i = 0; i < 96; i++) { const m = mesh(scene, geo.sphere, mat('#ffd578', { emissive: '#dda94a', emissiveIntensity: .35 }), [0, -10, 0], [.07, .07, .07]); m.visible = false; sparks.push({ m, life: 0, vx: 0, vz: 0 }); }
  let sparkIndex = 0, guideTime = 0;
  const arrow = mesh(scene, geo.cone, mat('#288e78', { emissive: '#287a66', emissiveIntensity: .4 }), [0, .5, 0], [.3, .7, .15]); arrow.visible = false;
  let yaw = 0, targetYaw = 0, px = game.s.x, pz = game.s.z, contextLost = false;
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    const aspect = innerWidth / innerHeight;
    const halfHeight = aspect < .85 ? 7.2 / aspect : 12;
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect; camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
  }
  resize();
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); contextLost = true; canvas.dispatchEvent(new CustomEvent('evolution-renderer-lost')); });
  canvas.addEventListener('webglcontextrestored', () => { contextLost = false; canvas.dispatchEvent(new CustomEvent('evolution-renderer-restored')); });
  function burst(x, z) {
    for (let i = 0; i < 12; i++) { const p = sparks[sparkIndex++ % sparks.length]; p.life = .8; p.vx = (Math.random() - .5) * 4; p.vz = (Math.random() - .5) * 4; p.m.position.set(x, .7, z); p.m.visible = true; }
  }
  function draw(dt = 0) {
    if (contextLost) return;
    const s = game.s, a = game.stats(), t = s.time;
    shots.forEach((m,i)=>{const p=s.projectiles[i];m.visible=!!p;if(p)m.position.set(p.x,.75,p.z);});
    const smooth = 1 - Math.exp(-Math.max(dt, .016) * 7);
    px += (s.x - px) * smooth; pz += (s.z - pz) * smooth; yaw += (targetYaw - yaw) * smooth;
    camera.position.set(px + Math.sin(yaw) * 19, 24, pz + Math.cos(yaw) * 19); camera.lookAt(px, 0, pz);
    sun.position.set(px - 12, 24, pz + 12); sun.target.position.set(px, 0, pz); sun.target.updateMatrixWorld();
    world.forEach((g, i) => { g.visible = Math.abs((SpuddyEvolution.zones[i].min + 16) - pz) < 48; });
    gates.forEach(g => { g.group.visible = Math.abs(SpuddyEvolution.zones[g.zone].max - pz) < 45; g.field.visible = s.save.unlocked < g.zone; g.field.material.opacity = .38 + Math.sin(t * 2) * .08; });
    outposts.forEach(o => { o.group.visible = o.zone <= s.save.unlocked; });
    const total = Object.values(s.save.levels).reduce((n, v) => n + v, 0), form = Math.min(2, Math.floor(total / 5));
    player.group.position.set(s.x, 0, s.z); player.group.rotation.y = s.heading;
    player.group.scale.setScalar(1.08 + form * .1); animateSpud(player, s.moving ? s.steps : t, s.moving, form);
    companion.group.visible = !!s.save.levels.helper;
    companion.group.position.set(s.x + Math.sin(t * .8) * 1.7, 0, s.z + 1.8); companion.group.rotation.y = s.heading; animateSpud(companion, t * 7, true);
    reach.position.set(s.x, .08, s.z); reach.scale.setScalar(a.range);
    pulseRing.visible = s.pulse > 0; pulseRing.position.set(s.x, .15, s.z); pulseRing.scale.setScalar(a.range * 1.6 * (1 - s.pulse / .6));
    for (const e of s.enemies) {
      if(!actors.has(e.id))createActor(e);
      const actor = actors.get(e.id);
      if(e.dead && !actor.wasDead) actor.deathFade=.24;
      if(!e.dead) actor.deathFade=0;
      actor.wasDead=!!e.dead; actor.deathFade=Math.max(0,actor.deathFade-dt);
      actor.group.visible = (!e.dead || actor.deathFade>0) && Math.abs(e.z-pz)<32;
      actor.groundShadow.visible = actor.group.visible; actor.groundShadow.position.set(e.x, .025, e.z);
      if (actor.warning) {
        actor.warning.visible = !e.dead && e.windup > 0 && actor.group.visible;
        actor.warning.position.set(e.targetX, .13, e.targetZ);
        actor.warning.scale.set(e.zone === 3 ? 3.6 : e.zone === 4 ? 4.2 : 3.4, e.zone === 3 ? .05 : e.zone === 4 ? 4.2 : 3.4, e.zone === 3 ? 10 : 1);
        if (!e.boss) actor.warning.scale.set(e.attackRadius || 1.3, e.attackRadius || 1.3, 1);
      }
      if (!actor.group.visible) continue;
      actor.group.position.set(e.x, e.kind === 'floater' ? .65 + Math.sin(e.phase * 3) * .18 : 0, e.z);
      // 7. Face travel direction, turning smoothly rather than wobbling in place.
      const mx=e.x-actor.lastX,mz=e.z-actor.lastZ;
      const moving=Math.hypot(mx,mz)>.0001; actor.gait+=moving ? Math.hypot(mx,mz)*8 : dt*.5;
      if(e.boss || e.windup>0) actor.facing=Math.atan2(s.x-e.x,s.z-e.z);
      else if(Math.hypot(mx,mz)>.0001) actor.facing=Math.atan2(mx,mz);
      let turn=actor.facing-actor.group.rotation.y;turn=Math.atan2(Math.sin(turn),Math.cos(turn));actor.group.rotation.y+=turn*(1-Math.exp(-Math.max(dt,.016)*8));
      actor.lastX=e.x;actor.lastZ=e.z;
      // 8. Anticipation crouch and stronger eye glow signal an incoming attack.
      const charge=e.windup>0?1:0;
      const fade=e.dead?Math.max(.01,actor.deathFade/.24):1;
      actor.group.scale.set(actor.profile[0]*(1+charge*.06)*fade,actor.profile[1]*(1-charge*.14)*fade,actor.profile[2]*(1+charge*.06)*fade);
      if(e.dead) actor.group.position.y+=(1-fade)*1.1;
      actor.group.rotation.x=charge?-.1:0;
      actor.glow.emissiveIntensity=(e.enraged?2:1.1)+charge*.9+Math.sin(e.phase*2)*.12;
      actor.wings.forEach(({wing,side})=>{wing.rotation.z=side*Math.sin(e.phase*6)*.25;wing.rotation.x=-.5+Math.sin(e.phase*6)*.15;});
      actor.tendrils.forEach(({vine,side,i,floating})=>{
        if(floating)segment(vine,[side*actor.size*.4,actor.size*.65,-.1],[side*actor.size*.55+Math.sin(e.phase*3+i)*.13,-.28,-.1+Math.cos(e.phase*2+i)*.12],.045);
        else segment(vine,[side*actor.size*.7,actor.size*1.3,-i*.4],[side*actor.size*(1.3+i*.18),actor.size*(1.8+Math.sin(e.phase*2+i)*.22),-.5-i*.6],.09);
      });
      actor.tails.forEach(({tail,i})=>{const point=n=>[Math.sin(e.phase*2-n*.4)*actor.size*.12*n,actor.size*(.7+n*.14),-actor.size*(.6+n*.34)];segment(tail,point(i),point(i+1),actor.size*(.18-i*.035));});
      // 9. Small recoil makes captures feel responsive without moving the hitbox.
      actor.group.rotation.z=e.hit>0?Math.sin(e.phase*45)*.065:0;
      actor.body.material.emissive.set(e.hit > 0 ? '#7d4937' : '#000000');
      actor.body.scale.y = actor.size * .8 * (1 + Math.sin(e.phase * 4) * .035);
      actor.cap.position.y = actor.size * 1.6 + Math.sin(e.phase * 4) * .05;
      actor.legs.forEach(({leg,shin,claw,joint,a},i)=>{
        const stride=Math.sin(actor.gait+i*Math.PI)* (moving?.18:.025),lift=Math.max(0,stride);
        const hip=[Math.sin(a)*actor.size*.5,actor.size*.8,Math.cos(a)*actor.size*.5];
        const knee=[Math.sin(a)*actor.size*1.02,actor.size*.48+lift,Math.cos(a)*actor.size*.92+stride];
        const foot=[Math.sin(a)*actor.size*1.35,.1+lift,Math.cos(a)*actor.size*1.3+stride];
        segment(leg,hip,knee,actor.size*.13);segment(shin,knee,foot,actor.size*.085);
        joint.position.set(...knee);claw.position.set(foot[0],foot[1],foot[2]+.1);
      });
      actor.jaw.rotation.x = -.12 - Math.max(0,Math.sin(e.phase*3))*.18 - (e.windup>0?.25:0);
      actor.health.visible = !e.dead && (e.boss || e.hp < e.maxHp); actor.health.quaternion.copy(actor.group.quaternion).invert().multiply(camera.quaternion); actor.fill.scale.x = actor.size * 2 * e.hp / e.maxHp;
      actor.fill.position.x = -actor.size * (1 - e.hp / e.maxHp);
    }
    roots.forEach((pieces, i) => {
      const link = s.links[i]; pieces.forEach(m => { m.visible = !!link; }); if (!link) return;
      for (let j = 0; j < pieces.length; j++) {
        const point = f => [s.x + (link.x - s.x) * f + Math.sin(f * Math.PI) * Math.sin(t * 7 + i) * .2, .8 + Math.sin(f * Math.PI) * .8, s.z + (link.z - s.z) * f];
        segment(pieces[j], point(j / pieces.length), point((j + 1) / pieces.length), .065);
      }
    });
    for (const p of sparks) if (p.life > 0) { p.life -= dt; p.m.position.x += p.vx * dt; p.m.position.z += p.vz * dt; p.m.position.y += dt * 1.3; p.m.scale.setScalar(Math.max(.01, p.life * .13)); p.m.visible = p.life > 0; }
    guideTime = Math.max(0, guideTime - dt); arrow.visible = guideTime > 0;
    if (arrow.visible) { const nest = game.nearestNest(), angle = Math.atan2(nest.x - s.x, nest.z - s.z); arrow.position.set(s.x + Math.sin(angle) * 3, .6, s.z + Math.cos(angle) * 3); arrow.rotation.set(Math.PI / 2, 0, -angle); }
    renderer.render(scene, camera);
  }
  return { available: true, projectPoint: (x,z) => {const v=new THREE.Vector3(x,1.5,z).project(camera);return Math.abs(v.x)>1||Math.abs(v.y)>1?null:{x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};}, diagnostics: () => ({actorCount:actors.size,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,combinedParts}), draw, resize, burst, guide: () => { guideTime = 10; }, rotate: () => { targetYaw += Math.PI / 2; }, transformInput: v => ({ x: v.x * Math.cos(yaw) + v.z * Math.sin(yaw), z: -v.x * Math.sin(yaw) + v.z * Math.cos(yaw) }) };
}
window.EvolutionRenderer = { create };
