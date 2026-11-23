// Camera-image tracking is local. Retain the initial feature positions so estimates
// always map back to the original wall patch rather than accumulating transforms.
import * as T from "./realms-three.js";
import { createAquarium } from "./realms-aquarium.js";
import { surfaceMaterial, animateAsset } from "./realms-assets.js";
import "./realms-vision.js";
const J = window.jsfeat;
const project = (h, x, y) => {
  const d = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d];
};

export function tracker(width, height) {
  const pyramid = () => {
    const p = new J.pyramid_t(3);
    p.allocate(width, height, J.U8C1_t);
    return p;
  };
  let source = pyramid(),
    current = pyramid(),
    original,
    coords,
    count = 0;
  const read = (data, p) => {
    J.imgproc.grayscale(data, width, height, p.data[0]);
    p.build(p.data[0], true);
  };
  function lock(data, box) {
    read(data, source);
    const points = Array.from({ length: width * height }, () => ({
      x: 0,
      y: 0,
      score: 0,
    }));
    J.fast_corners.set_threshold(15);
    const n = J.fast_corners.detect(source.data[0], points, 4);
    const picks = [],
      occupied = new Set();
    for (const p of points.slice(0, n).sort((a, b) => b.score - a.score)) {
      if (
        p.x < box.x ||
        p.x > box.x + box.w ||
        p.y < box.y ||
        p.y > box.y + box.h
      )
        continue;
      const cell = (p.x >> 3) + ":" + (p.y >> 3);
      if (occupied.has(cell)) continue;
      occupied.add(cell);
      picks.push(p);
      if (picks.length === 100) break;
    }
    count = picks.length;
    original = picks;
    coords = new Float32Array(picks.flatMap((p) => [p.x, p.y]));
    return count >= 12;
  }
  function locate(data) {
    if (count < 12) return null;
    read(data, current);
    const next = new Float32Array(count * 2),
      back = new Float32Array(count * 2),
      ok = new Uint8Array(count),
      backOK = new Uint8Array(count);
    J.optical_flow_lk.track(
      source,
      current,
      coords,
      next,
      count,
      15,
      24,
      ok,
      0.02,
      0.0001,
    );
    J.optical_flow_lk.track(
      current,
      source,
      next,
      back,
      count,
      15,
      24,
      backOK,
      0.02,
      0.0001,
    );
    const from = [],
      to = [];
    for (let i = 0; i < count; i++)
      if (
        ok[i] &&
        backOK[i] &&
        Math.hypot(
          back[i * 2] - coords[i * 2],
          back[i * 2 + 1] - coords[i * 2 + 1],
        ) < 1.3
      ) {
        from.push(original[i]);
        to.push({ x: next[i * 2], y: next[i * 2 + 1] });
      }
    if (from.length < 10) return null;
    const h = new J.matrix_t(3, 3, J.F32C1_t),
      mask = new J.matrix_t(from.length, 1, J.U8C1_t);
    const fit = J.motion_estimator.ransac(
      new J.ransac_params_t(4, 1.8, 0.45, 0.99),
      new J.motion_model.homography2d(),
      from,
      to,
      from.length,
      h,
      mask,
      100,
    );
    if (!fit) return null;
    const support = from.filter((_, i) => mask.data[i]);
    if (support.length < Math.max(10, count * 0.25, from.length * 0.55))
      return null;
    const span = (set, k) =>
      Math.max(...set.map((p) => p[k])) - Math.min(...set.map((p) => p[k]));
    if (
      span(support, "x") < span(original, "x") * 0.42 ||
      span(support, "y") < span(original, "y") * 0.42
    )
      return null;
    return h.data;
  }
  return { lock, locate };
}

export async function openCamera({ world, exit }) {
  const ui = document.createElement("section");
  ui.className = "camera-room";
  ui.innerHTML =
    '<video autoplay muted playsinline></video><canvas class="wall-art"></canvas><div class="wall-guide"></div><div class="camera-top"><b>My room</b><button data-close>Exit</button></div><div class="camera-tools"><p role="status">Opening your rear camera…</p><select aria-label="Room effect"><option>Aquarium</option><option>Castle stone</option><option>Living forest</option><option>Marble</option><option>Lava</option></select> <button data-place>Place here</button></div>';
  document.body.append(ui);
  const el = (s) => ui.querySelector(s),
    video = el("video"),
    canvas = el("canvas"),
    guide = el(".wall-guide"),
    status = el("p"),
    place = el("[data-place]"),
    select = el("select");
  let stream,
    renderer,
    closed = false,
    raf,
    tracked = false,
    box,
    vision,
    textureMesh,
    aqua,
    scene,
    cam,
    last = 0,
    lastVideo = -1;
  const grab = document.createElement("canvas"),
    ctx = grab.getContext("2d", { willReadFrequently: true });
  function close() {
    if (closed) return;
    closed = true;
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    document.removeEventListener("visibilitychange", hidden);
    window.removeEventListener("resize", resize);
    if (renderer) {
      const mats = new Set(),
        geos = new Set();
      scene.traverse((n) => {
        if (n.geometry) geos.add(n.geometry);
        if (n.material) mats.add(n.material);
      });
      mats.forEach((m) => m.dispose());
      geos.forEach((g) => g.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    }
    ui.remove();
    exit();
  }
  function hidden() {
    if (document.hidden) close();
  }
  el("[data-close]").onclick = close;
  document.addEventListener("visibilitychange", hidden);
  function resize() {
    if (!video.videoWidth) return;
    grab.width = Math.round(
      (320 * innerWidth) / Math.max(innerWidth, innerHeight),
    );
    grab.height = Math.round(
      (320 * innerHeight) / Math.max(innerWidth, innerHeight),
    );
    vision = tracker(grab.width, grab.height);
    reset();
  }
  function reset() {
    tracked = false;
    canvas.hidden = true;
    guide.hidden = false;
    place.textContent = "Place here";
    status.textContent =
      "Aim at a textured wall or floor. Tap the camera to move the frame, then place your effect.";
  }
  function pixels() {
    const w = grab.width,
      h = grab.height,
      s = Math.max(w / video.videoWidth, h / video.videoHeight);
    ctx.drawImage(
      video,
      (w - video.videoWidth * s) / 2,
      (h - video.videoHeight * s) / 2,
      s * video.videoWidth,
      s * video.videoHeight,
    );
    return ctx.getImageData(0, 0, w, h).data;
  }
  function pose(h) {
    const pts = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ].map(([x, y]) => project(h, box.x + box.w * x, box.y + box.h * y));
    const target = pts.map(([x, y]) => ({
      x: (x * ui.clientWidth) / grab.width,
      y: (y * ui.clientHeight) / grab.height,
    }));
    const w = 400,
      ht = 215,
      model = new J.matrix_t(3, 3, J.F32C1_t);
    if (
      target.some((p) => !Number.isFinite(p.x + p.y)) ||
      !new J.motion_model.homography2d().run(
        [
          { x: 0, y: 0 },
          { x: w, y: 0 },
          { x: w, y: ht },
          { x: 0, y: ht },
        ],
        target,
        model,
        4,
      )
    )
      return false;
    const a = model.data;
    canvas.style.transform =
      "matrix3d(" +
      [
        a[0],
        a[3],
        0,
        a[6],
        a[1],
        a[4],
        0,
        a[7],
        0,
        0,
        1,
        0,
        a[2],
        a[5],
        0,
        a[8],
      ].join(",") +
      ")";
    return true;
  }
  function apply() {
    const kind = select.value;
    aqua.group.visible = kind === "Aquarium";
    textureMesh.visible = !aqua.group.visible;
    if (textureMesh.visible) {
      textureMesh.material.dispose();
      textureMesh.material = surfaceMaterial(
        ["Marble", "Lava"].includes(kind) ? "floor" : "wall",
        { "Castle stone": "Stone", "Living forest": "Forest" }[kind] || kind,
      );
    }
  }
  canvas.hidden = true;
  place.disabled = true;
  select.disabled = true;
  try {
    if (!navigator.mediaDevices?.getUserMedia)
      throw Error(
        "Camera access is unavailable here. Open this link directly in Safari.",
      );
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    if (closed) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    video.srcObject = stream;
    await video.play();
    if (closed) return;
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(600, 322, false);
    scene = new T.Scene();
    cam = new T.OrthographicCamera(-1.84, 1.84, 0.99, -0.99, 0.01, 12);
    cam.position.z = 4;
    scene.add(new T.HemisphereLight(0xffffff, 0x7ca7a1, 2.5));
    aqua = createAquarium(world.style);
    scene.add(aqua.group);
    textureMesh = new T.Mesh(
      new T.PlaneGeometry(3.68, 1.98),
      new T.MeshBasicMaterial(),
    );
    scene.add(textureMesh);
    apply();
    select.onchange = apply;
    resize();
    window.addEventListener("resize", resize);
    place.disabled = select.disabled = false;
    video.onclick = (e) => {
      if (tracked) return;
      guide.style.left =
        Math.max(
          guide.offsetWidth / 2,
          Math.min(innerWidth - guide.offsetWidth / 2, e.clientX),
        ) + "px";
      guide.style.top =
        Math.max(
          guide.offsetHeight / 2,
          Math.min(innerHeight - guide.offsetHeight / 2, e.clientY),
        ) + "px";
    };
    place.onclick = () => {
      if (tracked) {
        reset();
        return;
      }
      const r = guide.getBoundingClientRect();
      box = {
        x: (r.left * grab.width) / ui.clientWidth,
        y: (r.top * grab.height) / ui.clientHeight,
        w: (r.width * grab.width) / ui.clientWidth,
        h: (r.height * grab.height) / ui.clientHeight,
      };
      if (!vision.lock(pixels(), box)) {
        status.textContent =
          "Too little detail to track. Frame a picture, patterned wall, or floor with visible edges.";
        return;
      }
      tracked = true;
      guide.hidden = true;
      place.textContent = "Reposition";
      status.textContent = "Placed · keep the surface in view.";
    };
    function draw(t) {
      if (closed) return;
      raf = requestAnimationFrame(draw);
      if (
        !tracked ||
        t - last < 60 ||
        video.readyState < 2 ||
        lastVideo === video.currentTime
      )
        return;
      last = t;
      lastVideo = video.currentTime;
      const h = vision.locate(pixels());
      canvas.hidden = !h || !pose(h);
      status.textContent = canvas.hidden
        ? "Tracking lost. Look back at the original spot or tap Reposition."
        : "Placed · keep the surface in view.";
      if (!canvas.hidden) {
        aqua.update(t / 1000);
        animateAsset(textureMesh, t / 1000);
        renderer.render(scene, cam);
      }
    }
    raf = requestAnimationFrame(draw);
  } catch (e) {
    stream?.getTracks().forEach((t) => t.stop());
    guide.hidden = true;
    status.textContent =
      e.name === "NotAllowedError"
        ? "Camera permission was denied. Allow Camera for this site in Safari, then reopen My room."
        : e.message ||
          "Camera unavailable. Open this link in Safari and try again.";
  }
}
