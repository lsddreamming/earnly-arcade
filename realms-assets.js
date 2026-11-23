// Original procedural assets. Surface maps use periodic noise so adjacent tiles join cleanly.
import * as THREE from "./realms-three.js";

const TAU = Math.PI * 2;
const SIZE = 512;
const maps = new Map();
const palette = {
  Stone: ["#323b45", "#7d8792"],
  Ruins: ["#353e36", "#737b61"],
  Luxury: ["#184348", "#548582"],
  Glass: ["#174756", "#408da0"],
  Spacecraft: ["#273b48", "#83939d"],
  Forest: ["#193a32", "#42614e"],
  Marble: ["#9bafac", "#e6e4cf"],
  Slate: ["#304044", "#647572"],
  Crystal: ["#263956", "#6f83af"],
  Water: ["#11636d", "#359f9b"],
  Lava: ["#211b22", "#60514f"],
  Galaxy: ["#101a35", "#3c315c"],
  Clouds: ["#749bb8", "#e1e7dc"],
  Sunset: ["#805e91", "#ffc086"],
  Ocean: ["#0a3548", "#29798b"],
};

function random(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const grid = new Float32Array(256 * 256);
const rand = random(27182);
for (let i = 0; i < grid.length; i++) grid[i] = rand();

function noise(u, v, frequency) {
  const x = u * frequency,
    y = v * frequency;
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const a = x - ix,
    b = y - iy;
  const s = a * a * (3 - 2 * a),
    t = b * b * (3 - 2 * b);
  const wrap = (n) => ((n % frequency) + frequency) % frequency;
  const at = (i, j) => grid[wrap(j) * 256 + wrap(i)];
  return (
    (at(ix, iy) * (1 - s) + at(ix + 1, iy) * s) * (1 - t) +
    (at(ix, iy + 1) * (1 - s) + at(ix + 1, iy + 1) * s) * t
  );
}
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, f) => a + (b - a) * Math.max(0, Math.min(1, f));

function texture(kind, name) {
  const key = kind + name;
  if (maps.has(key)) return maps.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  const pixels = ctx.createImageData(SIZE, SIZE);
  const [lo, hi] = (palette[name] || palette.Stone).map(rgb);
  const brick = name === "Ruins" || name === "Stone";
  const sky = kind === "ceiling";
  const water = name === "Water" || name === "Ocean" || name === "Glass";
  const rng = random(6441);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE,
        v = y / SIZE;
      const coarse = noise(u, v, 4),
        medium = noise(u, v, 16),
        fine = noise(u, v, 64);
      const terrain = coarse * 0.6 + medium * 0.25 + fine * 0.15;
      let shade = terrain + (rng() - 0.5) * 0.09,
        light = 0,
        tint = [255, 243, 204];
      if (brick) {
        const row = Math.floor(v * 6);
        const ax = (u * 3 + (row % 2) * 0.5) % 1,
          ay = (v * 6) % 1;
        const edge = Math.min(ax, 1 - ax, ay * 0.5, (1 - ay) * 0.5);
        shade +=
          0.19 *
          noise((Math.floor(u * 3 + (row % 2) * 0.5) % 3) / 3, row / 6, 6);
        shade -= 0.45 * Math.max(0, 1 - edge * 65);
        if (name === "Ruins" && coarse + medium * 0.5 > 0.97) {
          light = 0.4 * fine;
          tint = [99, 137, 67];
        }
      } else if (
        name === "Marble" ||
        name === "Luxury" ||
        name === "Crystal" ||
        name === "Lava"
      ) {
        const vein = Math.abs(
          Math.sin(TAU * (u + v + coarse * 1.5 + medium * 0.17 + fine * 0.035)),
        );
        const seam = Math.max(0, 1 - vein * (name === "Lava" ? 5 : 10));
        shade += 0.14 * Math.sin(TAU * (u + coarse));
        light = seam ** 1.6;
        tint =
          name === "Lava"
            ? [255, 143 + 80 * fine, 50]
            : name === "Marble"
              ? [80, 104, 108]
              : [161, 224, 221];
      } else if (water) {
        const wav = Math.abs(
          Math.sin(TAU * (u + v + coarse + medium * 0.12)) +
            0.55 * Math.cos(TAU * (v * 2 - u + coarse * 0.8)),
        );
        light = 0.48 * Math.max(0, 1 - wav * 7) ** 2;
        tint = [176, 253, 232];
      } else if (name === "Slate" || name === "Spacecraft") {
        const ax = (u * 2 + Math.floor(v * 3) * 0.5) % 1,
          ay = (v * 3) % 1;
        const edge = Math.min(ax, 1 - ax, ay * 0.66, (1 - ay) * 0.66);
        shade -= 0.36 * Math.max(0, 1 - edge * 80);
        if (
          name === "Spacecraft" &&
          ay > 0.15 &&
          ay < 0.84 &&
          ax > 0.09 &&
          ax < 0.1
        ) {
          light = 0.88;
          tint = [122, 232, 236];
        }
      } else if (name === "Forest") {
        shade += 0.2 * Math.cos(TAU * (u * 8 + coarse * 0.64));
      } else if (sky) {
        shade =
          name === "Sunset"
            ? 0.45 + 0.48 * Math.cos(TAU * v) + 0.2 * terrain
            : terrain;
        if (name === "Galaxy") {
          light =
            Math.max(
              0,
              1 - Math.abs(Math.sin(TAU * (v - u + coarse * 0.3))) * 2,
            ) *
            terrain *
            0.62;
          tint = [124, 111, 181];
        }
      }
      const i = (y * SIZE + x) * 4;
      for (let channel = 0; channel < 3; channel++)
        pixels.data[i + channel] = mix(
          mix(lo[channel], hi[channel], shade),
          tint[channel],
          light,
        );
      pixels.data[i + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  if (name === "Galaxy") {
    for (let i = 0; i < 420; i++) {
      ctx.fillStyle = "rgba(220,244,255," + (0.25 + rng() * 0.7) + ")";
      const r = 0.3 + rng() ** 4 * 1.2;
      ctx.beginPath();
      ctx.arc(rng() * SIZE, rng() * SIZE, r, 0, TAU);
      ctx.fill();
    }
  }
  if (name === "Ruins" || name === "Forest") {
    for (let i = 0; i < 7; i++) {
      const origin = rng() * SIZE,
        phase = rng() * TAU;
      ctx.beginPath();
      for (let y = 0; y <= SIZE; y += 4) {
        const x = origin + Math.sin((y / SIZE) * TAU + phase) * 16;
        if (y === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "#375337";
      ctx.lineWidth = 2;
      ctx.stroke();
      for (let y = 4; y < SIZE; y += 10 + rng() * 12) {
        const x = origin + Math.sin((y / SIZE) * TAU + phase) * 16;
        ctx.fillStyle = rng() > 0.5 ? "#667e4a" : "#546b42";
        ctx.beginPath();
        ctx.ellipse(x, y, 2, 5, rng() - 0.5, 0, TAU);
        ctx.fill();
      }
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.repeat.set(sky ? 1 : 2, sky ? 1 : 2);
  maps.set(key, map);
  return map;
}

export function surfaceMaterial(kind, name) {
  const map = texture(kind, name);
  const liquid = ["Water", "Lava", "Ocean"].includes(name);
  const polished = ["Glass", "Marble", "Crystal", "Luxury"].includes(name);
  const emissive = liquid || kind === "ceiling";
  const mat = new THREE.MeshStandardMaterial({
    map,
    roughness: liquid ? 0.24 : polished ? 0.32 : 0.86,
    metalness: name === "Spacecraft" ? 0.48 : polished ? 0.18 : 0.02,
    emissive: emissive ? 0xffffff : 0,
    emissiveMap: emissive ? map : null,
    emissiveIntensity: name === "Lava" ? 0.68 : 0.39,
    side: THREE.DoubleSide,
  });
  mat.userData.surface = name;
  return mat;
}

const material = (color, roughness = 0.63, metalness = 0.05, glow = 0) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive: glow,
  });
function mesh(group, geo, mat, x, y, z) {
  const item = new THREE.Mesh(geo, mat);
  item.position.set(x, y, z);
  group.add(item);
  return item;
}
function ring(group, r, tube, mat, y) {
  const item = mesh(
    group,
    new THREE.TorusGeometry(r, tube, 8, 48),
    mat,
    0,
    y,
    0,
  );
  item.rotation.x = Math.PI / 2;
  return item;
}
function batch(group, geo, mat, records) {
  const inst = new THREE.InstancedMesh(geo, mat, records.length);
  const dummy = new THREE.Object3D();
  records.forEach(([p, r, s, color], i) => {
    dummy.position.set(...p);
    dummy.rotation.set(...r);
    dummy.scale.set(...s);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
    if (color) inst.setColorAt(i, new THREE.Color(color));
  });
  group.add(inst);
  return inst;
}
function tree(group, fern) {
  const rng = random(fern ? 72 : 337);
  const bark = material(0x765646);
  const leaves = [],
    stems = [];
  const axis = new THREE.Vector3(0, 1, 0);
  function stem(a, b, radius) {
    const direction = new THREE.Vector3().subVectors(b, a);
    const q = new THREE.Quaternion().setFromUnitVectors(
      axis,
      direction.clone().normalize(),
    );
    const rot = new THREE.Euler().setFromQuaternion(q);
    stems.push([
      a.clone().lerp(b, 0.5).toArray(),
      [rot.x, rot.y, rot.z],
      [radius, direction.length(), radius],
    ]);
  }
  if (!fern)
    stem(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.04, 1.39, 0), 0.065);
  for (let j = 0; j < (fern ? 15 : 17); j++) {
    const angle = j * 2.4,
      c = Math.cos(angle),
      s = Math.sin(angle);
    const y = fern ? 0.02 : 0.68 + rng() * 0.6;
    const extent = fern ? 0.32 + rng() * 0.24 : 0.28 + rng() * 0.28;
    const rise = fern ? 0.35 + rng() * 0.32 : 0.22 + rng() * 0.19;
    let prev = new THREE.Vector3(0, y, 0);
    for (let k = 1; k <= 7; k++) {
      const t = k / 7;
      const p = new THREE.Vector3(
        c * t * extent,
        y + rise * Math.sin(t * 1.95),
        s * t * extent,
      );
      stem(prev, p, (fern ? 0.009 : 0.023) * (1 - t * 0.75));
      prev = p;
      for (const sign of [-1, 1]) {
        const len =
          (fern ? 0.14 : 0.18) * Math.sin((t * 0.76 + 0.12) * Math.PI);
        leaves.push([
          [
            p.x - s * sign * len * 0.42,
            p.y + len * 0.2,
            p.z + c * sign * len * 0.42,
          ],
          [0.27, -angle + sign * 0.8, sign * 1.04],
          [len * 0.41, len, len * 0.22],
          ["#388876", "#81b66c", "#547e50", "#a5c786"][Math.floor(rng() * 4)],
        ]);
      }
    }
  }
  batch(group, new THREE.CylinderGeometry(0.72, 1, 1, 5), bark, stems);
  batch(group, new THREE.OctahedronGeometry(1), material(0xffffff), leaves);
}

export function decoration(name) {
  const group = new THREE.Group();
  const stone = material(0x5e777c),
    bronze = material(0xc4a370, 0.32, 0.67);
  if (name === "Tree" || name === "Fern") {
    tree(group, name === "Fern");
  } else if (name === "Fountain") {
    const aqua = material(0x5cd6db, 0.17, 0.25, 0x164e5c);
    mesh(
      group,
      new THREE.CylinderGeometry(0.54, 0.43, 0.16, 48),
      stone,
      0,
      0.08,
      0,
    );
    mesh(
      group,
      new THREE.CylinderGeometry(0.48, 0.48, 0.012, 48),
      aqua,
      0,
      0.151,
      0,
    );
    ring(group, 0.505, 0.036, bronze, 0.16);
    mesh(
      group,
      new THREE.CylinderGeometry(0.06, 0.16, 0.62, 12),
      stone,
      0,
      0.39,
      0,
    );
    mesh(
      group,
      new THREE.CylinderGeometry(0.23, 0.08, 0.11, 32),
      bronze,
      0,
      0.73,
      0,
    );
    const drops = [];
    for (let j = 0; j < 8; j++) {
      const angle = (j * TAU) / 8;
      const path = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, 0.82, 0),
        new THREE.Vector3(0.24 * Math.cos(angle), 1.09, 0.24 * Math.sin(angle)),
        new THREE.Vector3(0.41 * Math.cos(angle), 0.16, 0.41 * Math.sin(angle)),
      );
      mesh(
        group,
        new THREE.TubeGeometry(path, 16, 0.008, 4, false),
        aqua,
        0,
        0,
        0,
      );
      const drop = mesh(
        group,
        new THREE.SphereGeometry(0.02, 6, 4),
        aqua,
        0,
        0,
        0,
      );
      drops.push({ path, drop, phase: j / 8 });
    }
    group.userData.animate = (t) =>
      drops.forEach(({ path, drop, phase }) =>
        path.getPoint((t * 0.82 + phase) % 1, drop.position),
      );
  } else if (name === "Portal") {
    const edge = material(0x89e7df, 0.24, 0.24, 0x1b837d);
    mesh(
      group,
      new THREE.CylinderGeometry(0.36, 0.43, 0.09, 8),
      stone,
      0,
      0.045,
      0,
    );
    const frame = mesh(
      group,
      new THREE.TorusGeometry(0.43, 0.046, 8, 64),
      bronze,
      0,
      0.7,
      0,
    );
    frame.scale.y = 1.42;
    const halo = mesh(
      group,
      new THREE.TorusGeometry(0.385, 0.013, 8, 64),
      edge,
      0,
      0.7,
      0.012,
    );
    halo.scale.y = 1.42;
    const veil = mesh(
      group,
      new THREE.CircleGeometry(0.385, 64),
      new THREE.MeshBasicMaterial({
        map: texture("ceiling", "Galaxy"),
        color: 0x8ae4eb,
        side: THREE.DoubleSide,
      }),
      0,
      0.7,
      0,
    );
    veil.scale.y = 1.42;
    group.userData.animate = (t) => {
      edge.emissiveIntensity = 0.85 + 0.22 * Math.sin(t * 1.8);
    };
  } else {
    mesh(
      group,
      new THREE.CylinderGeometry(0.26, 0.32, 0.13, 8),
      stone,
      0,
      0.065,
      0,
    );
    const sculpture = new THREE.Group();
    group.add(sculpture);
    sculpture.position.y = 0.57;
    for (let j = 0; j < 3; j++) {
      const orbit = mesh(
        sculpture,
        new THREE.TorusGeometry(0.3, 0.018, 8, 48),
        bronze,
        0,
        0,
        0,
      );
      orbit.rotation.set(j * 0.74, j * 0.91, j * 0.52);
    }
    mesh(
      sculpture,
      new THREE.IcosahedronGeometry(0.14, 0),
      material(0x9bd3d0, 0.2, 0.36, 0x205555),
      0,
      0,
      0,
    );
    group.userData.animate = (t) => {
      sculpture.rotation.y = t * 0.23;
      sculpture.position.y = 0.57 + 0.018 * Math.sin(t * 1.4);
    };
  }
  return group;
}

export function animateAsset(object, time) {
  if (!object) return;
  object.userData?.animate?.(time);
  const mat = object.isMaterial ? object : object.material;
  if (!mat?.map) return;
  const speed = { Water: 0.021, Lava: 0.009, Ocean: 0.012 }[
    mat.userData.surface
  ];
  if (speed) mat.map.offset.set((time * speed) % 1, (time * speed * 0.35) % 1);
}
