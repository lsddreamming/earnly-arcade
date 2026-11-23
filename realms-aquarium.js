// All aquarium geometry and shading are generated locally. Tank units are metres.
import * as T from "./realms-three.js";

const PI = Math.PI;
const palettes = {
  Reef: {
    deep: 0x093b61,
    light: 0x47e8da,
    sand: 0x98bd95,
    metal: 0x214249,
    trim: 0xd8ad63,
  },
  Midnight: {
    deep: 0x11133e,
    light: 0x6488ed,
    sand: 0x596a9b,
    metal: 0x292443,
    trim: 0xb6abdc,
  },
  Lagoon: {
    deep: 0x086d75,
    light: 0x9ce8b3,
    sand: 0xe5cf91,
    metal: 0x2f4942,
    trim: 0xc2c3a2,
  },
};

function randomStream(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Merge vertex-coloured primitives into one indexed draw per reef or animal.
function builder() {
  const pos = [],
    colors = [],
    indices = [];
  const tint = new T.Color();
  function vertex(x, y, z, color, light = 1) {
    tint.set(color);
    colors.push(tint.r * light, tint.g * light, tint.b * light);
    pos.push(x, y, z);
    return pos.length / 3 - 1;
  }
  function grid(uCount, vCount, point) {
    const start = pos.length / 3;
    for (let v = 0; v <= vCount; v++) {
      for (let u = 0; u <= uCount; u++) {
        const p = point(u / uCount, v / vCount);
        vertex(...p);
        if (!u || !v) continue;
        const n = start + v * (uCount + 1) + u;
        indices.push(
          n - uCount - 2,
          n - uCount - 1,
          n,
          n - uCount - 2,
          n,
          n - 1,
        );
      }
    }
  }
  function oval(x, y, z, rx, ry, rz, color, rings = 8) {
    grid(rings * 2, rings, (u, v) => {
      const s = Math.sin(PI * v);
      return [
        x + rx * Math.cos(2 * PI * u) * s,
        y + ry * Math.cos(PI * v),
        z + rz * Math.sin(2 * PI * u) * s,
        color,
      ];
    });
  }
  function finish() {
    const g = new T.BufferGeometry();
    g.setIndex(indices);
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }
  return { grid, oval, finish };
}

const species = [
  {
    name: "Emperor angelfish",
    skin: 0x2175d9,
    fin: 0xffc938,
    pattern: "emperor",
    height: 0.32,
  },
  {
    name: "Clownfish",
    skin: 0xff8434,
    fin: 0xb14c23,
    pattern: "clown",
    height: 0.24,
  },
  {
    name: "Blue tang",
    skin: 0x3579ef,
    fin: 0xffdf34,
    pattern: "tang",
    height: 0.26,
  },
  {
    name: "Blacktip reef shark",
    skin: 0x7594a4,
    fin: 0x38586a,
    pattern: "shark",
    height: 0.15,
  },
  { name: "Spotted eagle ray", skin: 0x426c88, fin: 0x83c0c7, pattern: "ray" },
  {
    name: "Bottlenose dolphin",
    skin: 0x829eb2,
    fin: 0x748caa,
    pattern: "dolphin",
    height: 0.18,
  },
  {
    name: "Lyretail anthias",
    skin: 0xff559b,
    fin: 0xfcac46,
    pattern: "anthias",
    height: 0.22,
  },
];

function animal(spec) {
  const g = builder();
  const { pattern, skin, fin } = spec;
  const ray = pattern === "ray";
  if (ray) {
    g.grid(28, 22, (u, v) => {
      const wing = v * 2 - 1;
      const chord = Math.pow(1 - Math.abs(wing), 0.75);
      const x = 0.02 - 0.35 * Math.abs(wing) + (u - 0.45) * chord;
      const spots =
        Math.sin(43 * x + Math.sin(wing * 11)) * Math.cos(wing * 35) > 0.77;
      return [
        x,
        Math.sin(PI * u) * chord * 0.12,
        wing * 0.68,
        spots ? 0xceece3 : skin,
        0.78 + 0.22 * chord,
      ];
    });
    g.grid(9, 18, (u, v) => [
      -0.29 - v * 0.83,
      0.03 + 0.065 * Math.sin(v * PI) + Math.cos(u * 2 * PI) * 0.033 * (1 - v),
      Math.sin(u * 2 * PI) * 0.033 * (1 - v),
      fin,
    ]);
    g.oval(0.33, 0.04, 0, 0.19, 0.1, 0.12, skin);
  } else {
    // Taper the rear trunk to a narrow peduncle, keeping the forehead rounded.
    const h = spec.height;
    g.grid(34, 20, (u, v) => {
      const x = -0.55 + u * 1.06;
      const fullness = Math.pow(
        Math.max(0, Math.sin(PI * Math.pow(u, 1.35))),
        0.65,
      );
      const a = v * 2 * PI;
      const y = Math.cos(a) * fullness * h + 0.025 * Math.sin(u * PI);
      const z =
        Math.sin(a) *
        fullness *
        (pattern === "shark" || pattern === "dolphin" ? 0.145 : 0.11);
      let color = skin;
      if (pattern === "clown") {
        const stripe = Math.min(
          ...[0.24, 0.56, 0.79].map((center) =>
            Math.abs(u - center + 0.035 * Math.cos(a)),
          ),
        );
        if (stripe < 0.065) color = stripe < 0.041 ? 0xfff0d3 : 0x4c3437;
      } else if (pattern === "emperor") {
        if (Math.cos(y * 72 + 2.2 * u * u) > 0.16 && u < 0.8) color = fin;
        if (u > 0.7 && u < 0.83) color = 0x17375c;
      } else if (
        pattern === "tang" &&
        Math.abs(y - Math.sin(u * PI) * 0.12) < 0.056 &&
        u < 0.8
      )
        color = 0x102f65;
      else if (
        (pattern === "shark" || pattern === "dolphin") &&
        Math.cos(a) < -0.22
      )
        color = 0xc5dbdc;
      return [x, y, z, color, 0.85 + 0.15 * fullness];
    });
    function sail(start, middle, end, height, width, color) {
      g.grid(8, 5, (u, v) => {
        const taper = Math.sin(PI * u);
        return [
          start + (end - start) * u + middle * v * taper,
          height * v * taper + (height > 0 ? 0.07 : -0.06),
          width * v * taper,
          color,
          0.7 + 0.3 * v,
        ];
      });
    }
    sail(-0.43, -0.11, 0.23, pattern === "shark" ? 0.31 : h * 1.19, 0, fin);
    sail(-0.31, -0.11, 0.08, -h * 0.97, 0, fin);
    for (const side of [-1, 1])
      sail(
        -0.05,
        -0.13,
        0.34,
        -0.11,
        side * (pattern === "shark" ? 0.29 : 0.15),
        fin,
      );
    g.grid(12, 8, (u, v) => {
      const span = v * 2 - 1;
      const x = -0.47 - u * (0.14 + 0.23 * Math.abs(span));
      const spread = span * (0.023 + 0.23 * u);
      return [
        x,
        pattern === "dolphin" ? 0.012 : spread,
        pattern === "dolphin" ? spread : 0.014 * Math.sin(PI * v),
        fin,
      ];
    });
    if (pattern === "dolphin")
      g.oval(0.46, -0.015, 0, 0.18, 0.048, 0.076, skin);
  }
  for (const side of [-1, 1]) {
    const x = ray ? 0.37 : 0.3,
      y = ray ? 0.09 : 0.067,
      z = side * (ray ? 0.08 : 0.102);
    g.oval(x, y, z, 0.031, 0.032, 0.02, 0xffce70, 5);
    g.oval(x + 0.005, y, z + side * 0.011, 0.022, 0.023, 0.015, 0x101e29, 5);
  }
  return g.finish();
}

function reef(palette, random) {
  const g = builder();
  const height = (x, z) =>
    -0.85 + 0.025 * Math.sin(6 * x + 4 * z) + 0.05 * Math.cos(3 * x - 2 * z);
  g.grid(60, 12, (u, v) => {
    const x = 3.5 * (u - 0.5),
      z = -0.39 + v * 0.68;
    return [
      x,
      height(x, z),
      z,
      palette.sand,
      0.76 + 0.2 * Math.sin(x * 26 + z * 19) ** 4,
    ];
  });
  const coral = [0xff6f67, 0xdb6596, 0xefae54, 0x937dc6, 0x48b8ab];
  function branch(x, y, z, dx, dy, dz, r, color, depth) {
    g.grid(7, 4, (u, v) => {
      const a = u * 2 * PI,
        radius = r * (1 - 0.68 * v);
      return [
        x + v * dx + Math.cos(a) * radius,
        y + v * dy,
        z + v * dz + Math.sin(a) * radius,
        color,
        0.65 + v * 0.35,
      ];
    });
    if (depth > 0) {
      for (const side of [-1, 1])
        branch(
          x + dx,
          y + dy,
          z + dz,
          dx * 0.5 + side * dy * (0.23 + random() * 0.34),
          dy * (0.59 + random() * 0.14),
          (random() - 0.5) * dy * 0.5,
          r * 0.62,
          color,
          depth - 1,
        );
    }
  }
  for (let i = 0; i < 58; i++) {
    const x = (random() - 0.5) * 3.43,
      z = random() * 0.48 - 0.3;
    const y = height(x, z),
      edge = Math.abs(x) / 1.74;
    const size = (0.04 + random() * 0.1) * (0.35 + edge);
    g.oval(x, y, z, size * 1.8, size, size, i % 3 ? 0x607b78 : 0x8a8882, 5);
    if (i % 3 === 0)
      branch(
        x,
        y,
        z,
        (random() - 0.5) * size,
        size * 1.2,
        0.01,
        size * 0.19,
        coral[i % coral.length],
        3,
      );
    else if (i % 3 === 1) {
      for (let j = 0; j < 4; j++) {
        const sway = random() * 5,
          h = size * (1 + random() * 2.2);
        g.grid(3, 12, (u, v) => [
          x +
            Math.sin(v * 4 + sway) * v * 0.055 +
            (u - 0.5) * size * 0.45 * Math.sin(PI * v),
          y + v * h,
          z + j * 0.008 + v * Math.cos(sway) * 0.07,
          j % 2 ? 0x278b77 : 0x64bf81,
          0.5 + 0.5 * v,
        ]);
      }
    }
  }
  const landscape = g.finish();
  const position = landscape.attributes.position;
  for (let i = 0; i < position.count; i++) {
    position.setXYZ(
      i,
      T.MathUtils.clamp(position.getX(i), -1.748, 1.748),
      Math.max(-0.9, position.getY(i)),
      T.MathUtils.clamp(position.getZ(i), -0.36, 0.34),
    );
  }
  return landscape;
}

const colouredVertex = `
attribute vec3 color;
varying vec3 vColor;
uniform float beat;
uniform float wing;
void main(){
  vec3 p=position;
  float rear=clamp((-p.x+.14)*1.4,0.,1.);
  p.z+=sin(beat+p.x*5.)*.135*rear*rear;
  p.y+=wing*sin(beat*.58+abs(p.z)*3.)*p.z*p.z*.75;
  vec3 n=normalize(normalMatrix*normal);
  vColor=color*(.67+.36*max(n.y,0.)+.19*abs(n.z));
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
const colouredFragment = `
varying vec3 vColor;
void main(){
  gl_FragColor=vec4(vColor,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function openWater(palette) {
  return new T.ShaderMaterial({
    uniforms: {
      clock: { value: 0 },
      deep: { value: new T.Color(palette.deep) },
      light: { value: new T.Color(palette.light) },
    },
    vertexShader:
      "varying vec2 coord;void main(){coord=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `
    varying vec2 coord;uniform float clock;uniform vec3 deep,light;
    float ridge(float x,float f){return .06*sin(x*f)+.035*sin(x*(f*2.8))+.012*cos(x*f*8.);}
    void main(){
      vec2 p=coord;float t=clock*.19;float surface=pow(p.y,2.);
      vec3 c=mix(deep*.40,light,.08+.61*surface);
      float sweep=p.x*9.+(1.-p.y)*1.45+.12*sin(p.y*7.+t);
      float rays=pow(max(0.,sin(sweep*2.+.45*sin(t+sweep))),8.)*.15+pow(max(0.,cos(sweep*6.-t*.7)),10.)*.07;
      c+=light*rays*(.25+p.y*.75);
      float caustic=pow(max(0.,sin(p.x*47.+p.y*31.+sin(p.y*17.+t))*cos(p.y*23.-t+sin(p.x*17.))),6.);
      c+=light*caustic*surface*.18;
      c=mix(c,deep*.74,1.-smoothstep(.0,.014,p.y-.28-ridge(p.x,18.)));
      c=mix(c,deep*.42,1.-smoothstep(.0,.009,p.y-.14-ridge(p.x+.28,27.)));
      c*=.84+.16*sin(p.x*3.14159);
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  });
}

export function createAquarium(style = "Reef") {
  const palette = palettes[style] || palettes.Reef;
  const random = randomStream(6243);
  const group = new T.Group();
  group.name = "Living aquarium";
  function mesh(geometry, material, x = 0, y = 0, z = 0) {
    const item = new T.Mesh(geometry, material);
    item.position.set(x, y, z);
    group.add(item);
    return item;
  }
  const backdrop = openWater(palette);
  mesh(new T.PlaneGeometry(3.54, 1.83), backdrop, 0, 0, -0.38);
  const shell = new T.MeshStandardMaterial({
    color: palette.metal,
    roughness: 0.34,
    metalness: 0.45,
  });
  const gold = new T.MeshStandardMaterial({
    color: palette.trim,
    roughness: 0.28,
    metalness: 0.38,
  });
  for (const side of [-1, 1]) {
    mesh(new T.BoxGeometry(3.62, 0.063, 0.74), shell, 0, side * 0.926);
    mesh(new T.BoxGeometry(0.062, 1.85, 0.74), shell, side * 1.78);
    mesh(new T.BoxGeometry(3.53, 0.012, 0.016), gold, 0, side * 0.901, 0.37);
    mesh(new T.BoxGeometry(0.012, 1.8, 0.016), gold, side * 1.753, 0, 0.37);
  }
  const seabed = new T.ShaderMaterial({
    side: T.DoubleSide,
    vertexShader: `
      attribute vec3 color;varying vec3 hue,norm,point;
      void main(){hue=color;norm=normal;point=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
    `,
    fragmentShader: `
      varying vec3 hue,norm,point;
      void main(){
        vec3 n=normalize(norm);
        float sun=.44+.57*max(0.,dot(n,normalize(vec3(-.32,.86,.41))))+.10*abs(n.z);
        float flecks=.96+.055*sin(point.x*137.+point.y*69.)*cos(point.z*223.+point.y*77.);
        gl_FragColor=vec4(hue*sun*flecks+vec3(.005,.015,.019),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  mesh(reef(palette, random), seabed);
  const actors = [],
    hits = [];
  const swimmingSpace = new T.Group();
  swimmingSpace.scale.z = 0.5;
  group.add(swimmingSpace);
  const geometries = new Map();
  const roster = [3, 4, 5, 0, 1, 2, 6, 0, 1, 2, 6, 6, 6, 2, 0];
  let elapsed = 0;
  roster.forEach((type, i) => {
    if (!geometries.has(type)) geometries.set(type, animal(species[type]));
    const mat = new T.ShaderMaterial({
      vertexShader: colouredVertex,
      fragmentShader: colouredFragment,
      side: T.DoubleSide,
      uniforms: { beat: { value: 0 }, wing: { value: type === 4 ? 1 : 0 } },
    });
    const fish = mesh(geometries.get(type), mat);
    swimmingSpace.add(fish);
    fish.name = species[type].name;
    const size = i < 3 ? [0.65, 0.43, 0.53][i] : 0.14 + random() * 0.15;
    fish.scale.setScalar(size);
    const a = {
      fish,
      type,
      size,
      phase: (i * 2.399963 + 0.4 * random()) % (2 * PI),
      speed: 0.15 + random() * 0.15,
      level: i < 3 ? [0.51, -0.29, 0.15][i] : (random() - 0.5) * 1.22,
      reactAt: -20,
    };
    actors.push(a);
    hits.push(fish);
  });
  const dustGeometry = new T.BufferGeometry();
  const dots = [];
  for (let i = 0; i < 95; i++)
    dots.push((random() - 0.5) * 3.38, random(), (random() - 0.5) * 0.49);
  dustGeometry.setAttribute("position", new T.Float32BufferAttribute(dots, 3));
  const particles = new T.ShaderMaterial({
    uniforms: { clock: { value: 0 } },
    transparent: true,
    depthWrite: false,
    vertexShader: `uniform float clock;varying float fade;void main(){
      vec3 p=position;float life=fract(p.y+clock*(.037+.015*sin(p.x*19.)));
      fade=.7*sin(life*3.14159);p.y=life*1.7-.85;
      p.x+=.024*sin(clock+p.y*6.+p.z*18.);vec4 view=modelViewMatrix*vec4(p,1.);
      gl_Position=projectionMatrix*view;gl_PointSize=clamp((5.+4.*sin(position.y*48.))/max(.6,-view.z),1.2,5.5);
    }`,
    fragmentShader: `varying float fade;void main(){float d=length(gl_PointCoord-.5)*2.;
      gl_FragColor=vec4(.74,.97,1.,fade*(1.-smoothstep(.72,1.,d))*(.25+.75*smoothstep(.35,.72,d)));
    }`,
  });
  const bubbles = new T.Points(dustGeometry, particles);
  bubbles.frustumCulled = false;
  group.add(bubbles);
  const glass = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader:
      "varying vec2 coord;void main(){coord=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec2 coord;void main(){float edge=pow(abs(coord.x-.5)*2.,16.);float s=coord.x+coord.y*.25;
    float glare=exp(-pow((s-.33)*24.,2.))+.45*exp(-pow((s-.39)*70.,2.));
    gl_FragColor=vec4(.65,.92,1.,.018+.045*edge+.043*glare);}`,
  });
  mesh(new T.PlaneGeometry(3.5, 1.8), glass, 0, 0, 0.354).renderOrder = 2;
  function update(time) {
    elapsed = time;
    backdrop.uniforms.clock.value = time;
    particles.uniforms.clock.value = time;
    actors.forEach(({ fish, type, size, phase, speed, level, reactAt }) => {
      const t = time * speed + phase;
      const reaction = Math.max(0, 1 - Math.abs(time - reactAt - 1.1) / 1.1);
      const zLane = -0.02 + 0.055 * Math.sin(t);
      fish.position.set(
        (1.59 - size * 0.5) * Math.sin(t),
        level + 0.085 * Math.sin(t * 2 + phase),
        zLane + reaction * 0.11,
      );
      // Rotate through the turn, with enough depth for a readable silhouette.
      fish.rotation.set(
        (type === 4 ? 0.42 : 0) + 0.12 * Math.sin(t),
        -Math.atan2(-0.24 * Math.sin(t) + 0.7 * reaction, Math.cos(t)),
        0.055 * Math.cos(t * 2 + phase),
      );
      fish.material.uniforms.beat.value =
        time * (type === 4 ? 3.3 : 5.2) + phase + 5 * reaction;
    });
  }
  function interact(raycaster) {
    const hit = raycaster.intersectObjects(hits, false)[0];
    if (!hit) return null;
    const actor = actors.find((a) => a.fish === hit.object);
    actor.reactAt = elapsed;
    return actor.fish.name;
  }
  update(0);
  return { group, update, interact };
}
