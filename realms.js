import * as T from "./realms-three.js";
import { surfaceMaterial, decoration, animateAsset } from "./realms-assets.js";
import { createAquarium } from "./realms-aquarium.js";

const $ = (id) => document.getElementById(id);
const choices = {
  wall: ["Stone", "Ruins", "Luxury", "Glass", "Spacecraft", "Forest"],
  floor: ["Marble", "Slate", "Crystal", "Glass", "Water", "Lava"],
  ceiling: ["Galaxy", "Clouds", "Sunset", "Ocean"],
};
const themes = {
  "Ocean Kingdom": ["Luxury", "Marble", "Ocean", "Reef", "Fern"],
  "Enchanted Castle": ["Ruins", "Slate", "Galaxy", "Midnight", "Statue"],
  "Space Station": ["Spacecraft", "Glass", "Galaxy", "Midnight", "Portal"],
  "Tropical Paradise": ["Forest", "Water", "Sunset", "Lagoon", "Tree"],
};
const clamp = T.MathUtils.clamp;
const copy = (value) => JSON.parse(JSON.stringify(value));
function starting(theme) {
  const [wall, floor, ceiling, style, prop] = themes[theme];
  return {
    version: 1,
    id: crypto.randomUUID(),
    name: theme,
    theme,
    wall,
    floor,
    ceiling,
    style,
    discoveries: [],
    items: [
      {
        id: "tank",
        name: "Aquarium",
        x: 0,
        y: 1.68,
        z: -2.55,
        angle: 0,
        size: 1,
      },
      { id: "first", name: prop, x: -2.34, y: 0, z: -1.8, angle: 0, size: 1 },
      {
        id: "second",
        name: theme === "Enchanted Castle" ? "Tree" : "Fountain",
        x: 2.35,
        y: 0,
        z: -1.65,
        angle: 0,
        size: 0.85,
      },
    ],
  };
}
const key = "earnly.realms.v1";
function saved() {
  try {
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(list)
      ? list.filter(
          (w) =>
            w.version === 1 &&
            themes[w.theme] &&
            Array.isArray(w.items) &&
            Array.isArray(w.discoveries),
        )
      : [];
  } catch {
    return [];
  }
}
let world = starting("Ocean Kingdom"),
  selected = "tank",
  tab = "",
  surface = "wall",
  editing = false,
  dirty = false;
let undo = [],
  redo = [],
  noticeTimer = 0,
  quality = "Balanced",
  yaw = 0,
  pitch = 0,
  distance = 0;
const ray = new T.Raycaster(),
  camera = new T.PerspectiveCamera(56, 1, 0.03, 50),
  scene = new T.Scene();
const render = new T.WebGLRenderer({
  canvas: $("view"),
  alpha: true,
  antialias: true,
  powerPreference: "low-power",
});
render.outputColorSpace = T.SRGBColorSpace;
render.toneMapping = T.ACESFilmicToneMapping;
render.toneMappingExposure = 1.22;
scene.background = new T.Color(0x102f39);
scene.add(new T.HemisphereLight(0xe3fff8, 0x9e7c60, 2.15));
const sun = new T.DirectionalLight(0xffe5bb, 2.2);
sun.position.set(-2, 4, 3);
scene.add(sun);
const glow = new T.PointLight(0x54f6ff, 13, 8);
glow.position.set(0, 2, -1.8);
scene.add(glow);
const surfaces = [],
  nodes = new Map();
function plane(kind, w, h, x, y, z, rx, ry) {
  const m = new T.Mesh(new T.PlaneGeometry(w, h));
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, 0);
  m.userData.kind = kind;
  scene.add(m);
  surfaces.push(m);
}
plane("wall", 7, 3.7, 0, 1.85, -3, 0, 0);
plane("wall", 10, 3.7, -3.5, 1.85, 2, 0, Math.PI / 2);
plane("wall", 10, 3.7, 3.5, 1.85, 2, 0, -Math.PI / 2);
plane("floor", 7, 10, 0, 0, 2, -Math.PI / 2, 0);
plane("ceiling", 7, 10, 0, 3.7, 2, Math.PI / 2, 0);
function dispose(node) {
  const materials = new Set(),
    geometry = new Set();
  node.traverse((m) => {
    if (m.geometry) geometry.add(m.geometry);
    if (m.material) [].concat(m.material).forEach((v) => materials.add(v));
  });
  geometry.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  scene.remove(node);
}
function sync() {
  for (const s of surfaces) {
    const kind = s.userData.kind;
    if (s.userData.choice !== world[kind]) {
      s.material.dispose();
      s.material = surfaceMaterial(kind, world[kind]);
      s.userData.choice = world[kind];
    }
  }
  for (const [id, n] of nodes) {
    if (
      !world.items.some((i) => i.id === id) ||
      (n.aqua && n.style !== world.style)
    ) {
      dispose(n.group);
      nodes.delete(id);
    }
  }
  for (const i of world.items) {
    let n = nodes.get(i.id);
    if (!n) {
      const aqua = i.name === "Aquarium" ? createAquarium(world.style) : null;
      n = {
        aqua,
        style: world.style,
        group: aqua?.group || decoration(i.name),
      };
      n.group.userData.itemId = i.id;
      scene.add(n.group);
      nodes.set(i.id, n);
    }
    n.group.position.set(i.x, i.y, i.z);
    n.group.rotation.y = (i.angle * Math.PI) / 180;
    n.group.scale.setScalar(i.size);
  }
  $("title").textContent = world.name;
}
function checkpoint() {
  undo.push(copy(world));
  if (undo.length > 40) undo.shift();
  redo = [];
  dirty = true;
}
function mutate(fn) {
  checkpoint();
  fn();
  sync();
  panel();
}
function swap(from, to) {
  if (!from.length) return;
  to.push(copy(world));
  world = from.pop();
  dirty = true;
  sync();
  panel();
}
function show(msg) {
  $("notice").textContent = msg;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => ($("notice").textContent = ""), 3600);
}
function button(parent, label, fn, active = false) {
  const b = document.createElement("button");
  b.textContent = label;
  b.onclick = fn;
  if (active) b.className = "active";
  parent.append(b);
  return b;
}
function row(p) {
  const r = document.createElement("div");
  r.className = "row";
  p.append(r);
  return r;
}
function modal(title, fill) {
  const d = $("dialogBody");
  d.replaceChildren();
  const h = document.createElement("h2");
  h.textContent = title;
  d.append(h);
  fill(d);
  if (!$("dialog").open) $("dialog").showModal();
}
$("close").onclick = () => $("dialog").close();
function enter(w) {
  if (w) {
    world = copy(w);
    undo = [];
    redo = [];
    dirty = false;
    selected = world.items[0]?.id;
    yaw = pitch = distance = 0;
  }
  editing = true;
  $("home").hidden = true;
  $("hud").hidden = false;
  $("dialog").close();
  sync();
  panel();
  show("Drag to look around · tap a fish to discover it");
}
function confirmChange(action) {
  if (!dirty) {
    action();
    return;
  }
  modal("Leave unsaved edits?", (d) =>
    button(d, "Discard edits and continue", action),
  );
}
function environments() {
  modal("Choose an environment", (d) =>
    Object.keys(themes).forEach((t) =>
      button(d, t, () => confirmChange(() => enter(starting(t)))),
    ),
  );
}
$("create").onclick = $("explore").onclick = environments;
$("enter").onclick = () => enter(dirty ? null : saved()[0] || null);
$("homeBtn").onclick = () => {
  if (stereo) leaveStereo();
  editing = false;
  $("hud").hidden = true;
  $("home").hidden = false;
};
function library() {
  modal("My Saved Worlds", (d) => {
    const worlds = saved();
    if (!worlds.length)
      d.append("Saved realms will appear here on this device.");
    worlds.forEach((w) =>
      button(d, w.name, () => confirmChange(() => enter(w))),
    );
  });
}
$("saves").onclick = library;
$("save").onclick = () =>
  modal("Save this realm", (d) => {
    const input = document.createElement("input");
    input.value = world.name;
    input.maxLength = 45;
    input.setAttribute("aria-label", "Realm name");
    d.append(input);
    button(d, "Save world", () => {
      const next = { ...world, name: input.value.trim() || world.theme };
      try {
        localStorage.setItem(
          key,
          JSON.stringify([next, ...saved().filter((w) => w.id !== world.id)]),
        );
        world = next;
        dirty = false;
        sync();
        $("dialog").close();
        show("Saved on this device");
      } catch {
        show("Storage is full or unavailable");
      }
    });
  });
function slider(p, text, field, min, max, step, i) {
  const l = document.createElement("label");
  l.append(text);
  const r = document.createElement("input");
  r.type = "range";
  Object.assign(r, { min, max, step, value: i[field] });
  l.append(r);
  p.append(l);
  let pending = true;
  r.oninput = () => {
    if (pending) {
      checkpoint();
      pending = false;
    }
    i[field] = Number(r.value);
    sync();
  };
  r.onchange = () => (pending = true);
}
function add(name) {
  if (world.items.length >= 16)
    return show("This realm has reached 16 objects");
  mutate(() => {
    selected = crypto.randomUUID();
    world.items.push({
      id: selected,
      name,
      x: 0,
      y: name === "Aquarium" ? 1.7 : 0,
      z: name === "Aquarium" ? -2.55 : -0.8,
      angle: 0,
      size: 1,
    });
    tab = "Arrange";
  });
}
let audio;
async function sound() {
  try {
    if (!audio) {
      audio = new AudioContext();
      const samples = audio.createBuffer(
        1,
        audio.sampleRate * 4,
        audio.sampleRate,
      );
      const wave = samples.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < wave.length; i++) {
        previous = 0.978 * previous + 0.022 * (Math.random() * 2 - 1);
        wave[i] =
          previous * (0.34 + 0.18 * Math.sin((2 * Math.PI * i) / wave.length));
      }
      const tide = audio.createBufferSource();
      tide.buffer = samples;
      tide.loop = true;
      tide.connect(audio.destination);
      tide.start();
    }
    if (audio.state === "running" && sound.on) {
      await audio.suspend();
      sound.on = false;
    } else {
      await audio.resume();
      sound.on = true;
    }
    panel();
  } catch {
    show("Audio unavailable");
  }
}
function discoverySound() {
  if (!sound.on || audio?.state !== "running") return;
  [392, 587, 784].forEach((frequency, i) => {
    const start = audio.currentTime + i * 0.08;
    const tone = audio.createOscillator(),
      volume = audio.createGain();
    tone.frequency.value = frequency;
    volume.gain.setValueAtTime(0.001, start);
    volume.gain.exponentialRampToValueAtTime(0.035, start + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.001, start + 0.55);
    tone.connect(volume).connect(audio.destination);
    tone.onended = () => {
      tone.disconnect();
      volume.disconnect();
    };
    tone.start(start);
    tone.stop(start + 0.56);
  });
}
function panel() {
  const nav = $("nav"),
    p = $("panel");
  nav.replaceChildren();
  p.replaceChildren();
  p.hidden = !tab;
  for (const name of ["Surfaces", "Objects", "Arrange", "World"])
    button(
      nav,
      name,
      () => {
        tab = tab === name ? "" : name;
        panel();
      },
      tab === name,
    );
  if (tab === "Surfaces") {
    let r = row(p);
    Object.keys(choices).forEach((k) =>
      button(
        r,
        k,
        () => {
          surface = k;
          panel();
        },
        surface === k,
      ),
    );
    r = row(p);
    choices[surface].forEach((v) =>
      button(
        r,
        v,
        () => mutate(() => (world[surface] = v)),
        world[surface] === v,
      ),
    );
  }
  if (tab === "Objects") {
    const r = row(p);
    [
      "Aquarium",
      "Fern",
      "Fountain",
      "Tree",
      "Statue",
      "Portal",
      "Throne",
      "Sofa",
      "Recliner",
    ].forEach((n) => button(r, n, () => add(n)));
    if (world.discoveries.length >= 3)
      button(r, "Pearl anemone", () => add("Pearl anemone"));
  }
  if (tab === "Arrange") {
    const i = world.items.find((i) => i.id === selected);
    const pick = document.createElement("select");
    pick.setAttribute("aria-label", "Selected object");
    world.items.forEach((v, j) =>
      pick.add(new Option(v.name + " " + (j + 1), v.id)),
    );
    pick.value = selected || "";
    pick.onchange = () => {
      selected = pick.value;
      panel();
    };
    p.append(pick);
    if (i) {
      for (const args of [
        ["Across", "x", -3, 3, 0.05],
        ["Height", "y", 0, 3, 0.05],
        ["Depth", "z", -2.7, 3, 0.05],
        ["Turn", "angle", -180, 180, 5],
        ["Size", "size", 0.25, 1.75, 0.05],
      ])
        slider(p, ...args, i);
      const r = row(p);
      if (i.name === "Aquarium")
        ["Reef", "Lagoon", "Midnight"].forEach((v) =>
          button(
            r,
            v,
            () => mutate(() => (world.style = v)),
            world.style === v,
          ),
        );
      button(r, "Remove", () =>
        mutate(() => {
          world.items = world.items.filter((v) => v !== i);
          selected = world.items[0]?.id;
        }),
      );
    }
  }
  if (tab === "World") {
    const r = row(p);
    button(r, "Undo", () => swap(undo, redo)).disabled = !undo.length;
    button(r, "Redo", () => swap(redo, undo)).disabled = !redo.length;
    button(r, "Load", library);
    button(r, "New", environments);
    button(r, "Reset", () =>
      modal("Reset this realm?", (d) =>
        button(d, "Restore starting room", () => {
          mutate(() => {
            world = {
              ...starting(world.theme),
              id: world.id,
              name: world.name,
            };
            selected = "tank";
          });
          $("dialog").close();
        }),
      ),
    );
    button(r, "Quality · " + quality, () => {
      quality = quality === "Balanced" ? "High" : "Balanced";
      resize();
      panel();
    });
    button(r, "Sound · " + (sound.on ? "On" : "Off"), sound);
    button(r, "Field journal · " + world.discoveries.length, () =>
      modal("Field journal", (d) =>
        d.append(
          world.discoveries.join(" · ") ||
            "Tap a swimming creature to record a sighting.",
        ),
      ),
    );
    button(r, "Stereo viewer", stereoMode);
    button(r, "Transform my room · Camera", openMyRoom);
  }
}
let stereo = false,
  heading = null,
  baseHeading = null;
function motion(e) {
  if (!stereo || e.alpha == null) return;
  if (baseHeading === null) baseHeading = e.alpha;
  heading = ((baseHeading - e.alpha) * Math.PI) / 180;
}
async function stereoMode() {
  try {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      DeviceOrientationEvent.requestPermission
    )
      await DeviceOrientationEvent.requestPermission();
  } catch {}
  stereo = true;
  baseHeading = heading = null;
  tab = "";
  panel();
  $("tools").hidden = true;
  $("save").hidden = true;
  $("title").textContent = "Stereo · tap scene to exit";
  show("Saved-room view · remain seated");
  window.addEventListener("deviceorientation", motion);
}
function leaveStereo() {
  stereo = false;
  window.removeEventListener("deviceorientation", motion);
  heading = null;
  $("tools").hidden = false;
  $("save").hidden = false;
  sync();
}
let tracking = false;
const arLink = document.createElement("a");
const nativeRoom = !!window.Capacitor?.isPluginAvailable?.("EarnlyRealms");
const furnitureAR = arLink.relList?.supports?.("ar") && !nativeRoom;
if (!nativeRoom) {
  $("cameraRoom").textContent = "Camera preview · 2D tracking";
  document.querySelector("#home p").textContent = furnitureAR
    ? "Place one piece of furniture in your room with Apple AR. Scan and refinish floors and walls in the native iPhone app."
    : "Try the camera preview or design a 3D realm. Room scanning and anchored finishes use the native iPhone app.";
}
if (furnitureAR) {
  const furniture = document.createElement("button");
  furniture.textContent = "Place furniture in AR";
  furniture.className = "primary";
  $("cameraRoom").classList.remove("primary");
  $("cameraRoom").before(furniture);
  furniture.onclick = () =>
    modal("Choose furniture", (d) => {
      for (const name of ["Throne", "Sofa", "Recliner"]) {
        const link = document.createElement("a");
        link.rel = "ar";
        link.href = "realms-" + name.toLowerCase() + ".usdz";
        link.className = "seat-link";
        const img = document.createElement("img");
        img.alt = name;
        img.src = "realms-" + name.toLowerCase() + ".jpg";
        link.append(img);
        d.append(link);
      }
    });
}
$("cameraRoom").onclick = openMyRoom;
if (window.Capacitor?.isPluginAvailable?.("EarnlyRealms")) {
  const scan = document.createElement("button");
  scan.textContent = "Scan furniture & walls";
  $("cameraRoom").after(scan);
  scan.onclick = async () => {
    try {
      const { items } = await window.Capacitor.Plugins.EarnlyRealms.scanRoom(
        {},
      );
      modal("Recognized in this room", (d) =>
        d.append(
          Object.entries(items || {})
            .map(([k, v]) => v + " " + k)
            .join(" · ") || "No objects recognized during this scan.",
        ),
      );
    } catch (e) {
      modal("Room scan unavailable", (d) => d.append(e.message));
    }
  };
}
async function openMyRoom() {
  if (tracking) return;
  if (window.Capacitor?.isPluginAvailable?.("EarnlyRealms")) {
    await nativeMode();
    return;
  }
  tracking = true;
  try {
    const { openCamera } = await import("./realms-camera.js");
    await openCamera({
      world,
      exit: () => {
        tracking = false;
        resize();
      },
    });
  } catch (e) {
    tracking = false;
    modal("Camera unavailable", (d) => d.append(e.message));
  }
}
async function nativeMode() {
  if (tracking) return;
  tracking = true;
  try {
    const { openRoomTracking } = await import("./realms-native.js");
    await openRoomTracking({
      world,
      renderer: render,
      canvas: $("view"),
      exit: () => {
        tracking = false;
        resize();
      },
    });
  } catch (e) {
    tracking = false;
    modal("Room tracking unavailable", (d) =>
      d.append(e.message || "Room tracking unavailable"),
    );
  }
}
const pointers = new Map();
let moved = false,
  origin,
  span = 0;
function gap() {
  const [a, b] = [...pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}
const c = $("view");
c.onpointerdown = (e) => {
  if (!editing || tracking) return;
  c.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    origin = { x: e.clientX, y: e.clientY };
    moved = false;
  } else {
    moved = true;
    span = gap();
  }
};
c.onpointermove = (e) => {
  const prev = pointers.get(e.pointerId);
  if (!prev) return;
  const x = e.clientX,
    y = e.clientY;
  pointers.set(e.pointerId, { x, y });
  if (pointers.size === 2) {
    const next = gap();
    distance = clamp(distance + (span - next) * 0.009, -2, 1.2);
    span = next;
    return;
  }
  if (Math.hypot(x - origin.x, y - origin.y) > 5) moved = true;
  if (moved) {
    yaw = clamp(yaw - (x - prev.x) * 0.003, -1.3, 1.3);
    pitch = clamp(pitch + (y - prev.y) * 0.003, -0.89, 0.89);
  }
};
c.onpointercancel = (e) => pointers.delete(e.pointerId);
c.onpointerup = (e) => {
  if (!pointers.delete(e.pointerId) || moved) return;
  if (stereo) {
    leaveStereo();
    return;
  }
  ray.setFromCamera(
    new T.Vector2(
      (e.clientX / innerWidth) * 2 - 1,
      1 - (e.clientY / innerHeight) * 2,
    ),
    camera,
  );
  const hit = ray.intersectObjects(
    [...nodes.values()].map((n) => n.group).concat(surfaces),
    true,
  )[0];
  if (!hit) return;
  let obj = hit.object;
  while (obj && !obj.userData.itemId) obj = obj.parent;
  if (obj) {
    selected = obj.userData.itemId;
    const species = nodes.get(selected).aqua?.interact(ray);
    if (species) {
      if (!world.discoveries.includes(species)) {
        world.discoveries.push(species);
        discoverySound();
        dirty = true;
      }
      show(species + " · " + world.discoveries.length + " discovered");
      panel();
      return;
    }
    tab = "Arrange";
  } else {
    surface = hit.object.userData.kind;
    tab = "Surfaces";
  }
  panel();
};
function resize() {
  render.setPixelRatio(
    Math.min(devicePixelRatio, quality === "High" ? 2 : 1.4),
  );
  render.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
const eyes = new T.StereoCamera();
eyes.eyeSep = 0.064;
eyes.aspect = 0.5;
function frame(ms) {
  requestAnimationFrame(frame);
  if (document.hidden || tracking) return;
  const t = ms * 0.001;
  const angle = editing ? yaw + 0.0 : Math.sin(t * 0.12) * 0.09;
  const z = clamp(1.15 / Math.max(0.38, camera.aspect), 1.1, 3.3) + distance;
  camera.position.set(Math.sin(angle) * 1.25, 1.62 + (editing ? 0 : 0.12), z);
  camera.rotation.order = "YXZ";
  camera.rotation.set(pitch, angle + (heading || 0), 0);
  if (!editing) camera.lookAt(0, 1.42, -2.6);
  for (const n of nodes.values()) {
    n.aqua?.update(t);
    animateAsset(n.group, t);
  }
  surfaces.forEach((s) => animateAsset(s, t));
  if (stereo) {
    camera.updateMatrixWorld();
    eyes.update(camera);
    render.setScissorTest(true);
    for (const [j, eye] of [eyes.cameraL, eyes.cameraR].entries()) {
      render.setViewport((j * innerWidth) / 2, 0, innerWidth / 2, innerHeight);
      render.setScissor((j * innerWidth) / 2, 0, innerWidth / 2, innerHeight);
      render.render(scene, eye);
    }
    render.setScissorTest(false);
    render.setViewport(0, 0, innerWidth, innerHeight);
  } else render.render(scene, camera);
}
resize();
sync();
c.dataset.ready = "1";
requestAnimationFrame(frame);
