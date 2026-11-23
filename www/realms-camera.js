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
  function lock(data, box, polygon) {
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
      if (
        polygon &&
        !polygon.every(([x, y], i) => {
          const [u, v] = polygon[(i + 1) % 4];
          return (u - x) * (p.y - y) - (v - y) * (p.x - x) >= 0;
        })
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
    const destinations = to.filter((_, i) => mask.data[i]);
    if (
      !new J.motion_model.homography2d().run(
        support,
        destinations,
        h,
        support.length,
      )
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
    '<video autoplay muted playsinline></video><canvas hidden></canvas><div class="wall-guide"></div><div class="camera-top"><b>My room</b><button data-close>Exit</button></div><div class="camera-tools"><p role="status">Opening your rear camera…</p><select aria-label="Room effect"><option>Aquarium</option><option>Castle stone</option><option>Living forest</option><option>Marble</option><option>Lava</option></select> <button data-place>Place here</button></div>';
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
      surfaceMaterials.forEach((m) => mats.add(m));
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
    for (const key of slots.keys()) removeSlot(key);
    reset();
  }
  const slots = new Map();
  const surfaceMaterials = new Map();
  let outlining = false,
    corners = [],
    frozenPixels = null;
  const freeze = document.createElement("canvas");
  freeze.className = "camera-outline";
  freeze.hidden = true;
  ui.insertBefore(freeze, guide);
  function isFloor() {
    return ["Marble", "Lava"].includes(select.value);
  }
  function slotKey() {
    return isFloor() ? "floor" : select.value === "Aquarium" ? "tank" : "wall";
  }
  function reset() {
    outlining = false;
    corners = [];
    freeze.hidden = true;
    frozenPixels = null;
    guide.hidden = isFloor();
    place.textContent = isFloor() ? "Outline floor" : "Place here";
    status.textContent = isFloor()
      ? "Point down at the floor. Outline the area you want to change."
      : "Aim at a textured wall and tap to position the frame.";
  }
  function removeSlot(key) {
    const slot = slots.get(key);
    if (slot) {
      slot.layer.remove();
      slots.delete(key);
    }
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
  function pose(h, slot) {
    const target = slot.corners.map(([a, b]) => {
      const [x, y] = project(h, a, b);
      return {
        x: (x * ui.clientWidth) / grab.width,
        y: (y * ui.clientHeight) / grab.height,
      };
    });
    // Reject folded and implausibly stretched estimates before they reach the compositor.
    for (let i = 0; i < 4; i++) {
      const a = target[i],
        b = target[(i + 1) % 4],
        c = target[(i + 2) % 4];
      if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) < 2)
        return false;
    }
    const area =
      target.reduce(
        (sum, p, i) =>
          sum + p.x * target[(i + 1) % 4].y - p.y * target[(i + 1) % 4].x,
        0,
      ) / 2;
    if (area < slot.area * 0.25 || area > slot.area * 4) return false;
    if (slot.last) {
      const motion = Math.max(
        ...target.map((p, i) =>
          Math.hypot(p.x - slot.last[i].x, p.y - slot.last[i].y),
        ),
      );
      const weight = motion < 1.2 ? 0 : Math.min(1, 0.18 + motion / 28);
      target.forEach((p, i) => {
        p.x = slot.last[i].x + (p.x - slot.last[i].x) * weight;
        p.y = slot.last[i].y + (p.y - slot.last[i].y) * weight;
      });
    }
    slot.last = target;
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
    slot.layer.style.transform =
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
  function apply(kind) {
    aqua.group.visible = kind === "Aquarium";
    textureMesh.visible = !aqua.group.visible;
    if (textureMesh.visible && textureMesh.userData.kind !== kind) {
      textureMesh.userData.kind = kind;
      if (!surfaceMaterials.size) textureMesh.material.dispose();
      if (!surfaceMaterials.has(kind))
        surfaceMaterials.set(
          kind,
          surfaceMaterial(
            ["Marble", "Lava"].includes(kind) ? "floor" : "wall",
            { "Castle stone": "Stone", "Living forest": "Forest" }[kind] ||
              kind,
          ),
        );
      textureMesh.material = surfaceMaterials.get(kind);
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
    select.onchange = () => {
      reset();
      const slot = slots.get(slotKey());
      if (slot) {
        slot.effect = select.value;
        place.textContent = "Reposition";
        guide.hidden = true;
        status.textContent = "Using the existing " + slotKey() + " placement.";
      }
    };
    resize();
    window.addEventListener("resize", resize);
    place.disabled = select.disabled = false;
    video.onclick = (e) => {
      if (isFloor() || slots.has(slotKey())) return;
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
    function install(data, points) {
      const xs = points.map((p) => p[0]),
        ys = points.map((p) => p[1]);
      const x = Math.min(...xs),
        y = Math.min(...ys);
      const v = tracker(grab.width, grab.height);
      if (
        !v.lock(
          data,
          { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y },
          points,
        )
      ) {
        reset();
        status.textContent =
          "Too little surface detail. Include more visible edges and try again.";
        return;
      }
      const layer = document.createElement("canvas");
      layer.className = "wall-art";
      layer.width = 600;
      layer.height = 322;
      layer.hidden = true;
      ui.insertBefore(layer, freeze);
      const area =
        ((((points.reduce(
          (sum, p, i) =>
            sum + p[0] * points[(i + 1) % 4][1] - p[1] * points[(i + 1) % 4][0],
          0,
        ) /
          2) *
          ui.clientWidth) /
          grab.width) *
          ui.clientHeight) /
        grab.height;
      removeSlot(slotKey());
      slots.set(slotKey(), {
        vision: v,
        corners: points,
        layer,
        ctx: layer.getContext("2d"),
        area,
        effect: select.value,
      });
      reset();
      guide.hidden = true;
      place.textContent = "Reposition";
      status.textContent = "Placed. Keep the surface in view.";
    }
    place.onclick = () => {
      if (slots.has(slotKey())) {
        removeSlot(slotKey());
        reset();
        return;
      }
      if (isFloor()) {
        if (outlining && corners.length === 4) {
          install(
            frozenPixels,
            corners.map(([x, y]) => [
              (x * grab.width) / ui.clientWidth,
              (y * grab.height) / ui.clientHeight,
            ]),
          );
          return;
        }
        if (outlining) {
          reset();
          return;
        }
        frozenPixels = pixels();
        freeze.width = ui.clientWidth;
        freeze.height = ui.clientHeight;
        const s = Math.max(
          freeze.width / video.videoWidth,
          freeze.height / video.videoHeight,
        );
        freeze
          .getContext("2d")
          .drawImage(
            video,
            (freeze.width - video.videoWidth * s) / 2,
            (freeze.height - video.videoHeight * s) / 2,
            video.videoWidth * s,
            video.videoHeight * s,
          );
        outlining = true;
        corners = [];
        freeze.hidden = false;
        place.textContent = "Cancel";
        status.textContent =
          "Tap four corners around the floor area, in order.";
        return;
      }
      const r = guide.getBoundingClientRect();
      install(
        pixels(),
        [
          [r.left, r.top],
          [r.right, r.top],
          [r.right, r.bottom],
          [r.left, r.bottom],
        ].map(([x, y]) => [
          (x * grab.width) / ui.clientWidth,
          (y * grab.height) / ui.clientHeight,
        ]),
      );
    };
    freeze.onclick = (e) => {
      if (!outlining) return;
      if (corners.length === 4) {
        reset();
        place.click();
        return;
      }
      const p = [e.clientX, e.clientY],
        ctx = freeze.getContext("2d");
      if (corners.length) {
        ctx.beginPath();
        ctx.moveTo(...corners.at(-1));
        ctx.lineTo(...p);
        ctx.strokeStyle = "#aaffdf";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(...p, 6, 0, Math.PI * 2);
      ctx.fillStyle = "#aaffdf";
      ctx.fill();
      corners.push(p);
      if (corners.length < 4) {
        status.textContent =
          "Tap floor corner " + (corners.length + 1) + " of 4.";
        return;
      }
      const turns = corners.map(([x, y], i) => {
        const [u, v] = corners[(i + 1) % 4],
          [a, b] = corners[(i + 2) % 4];
        return (u - x) * (b - v) - (v - y) * (a - u);
      });
      if (turns.every((n) => n < 0)) corners.reverse();
      else if (!turns.every((n) => n > 0)) {
        reset();
        status.textContent =
          "Trace the floor outline in order without crossing edges.";
        return;
      }
      ctx.beginPath();
      corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = "rgba(88,235,192,.27)";
      ctx.fill();
      ctx.stroke();
      place.textContent = "Confirm floor";
      status.textContent =
        "Check the highlighted floor. Confirm to apply, or tap the image to redraw.";
    };
    function draw(t) {
      if (closed) return;
      raf = requestAnimationFrame(draw);
      if (
        !slots.size ||
        outlining ||
        t - last < 32 ||
        video.readyState < 2 ||
        lastVideo === video.currentTime
      )
        return;
      last = t;
      lastVideo = video.currentTime;
      const data = pixels();
      for (const [key, slot] of slots) {
        const h = slot.vision.locate(data);
        slot.layer.hidden = !h || !pose(h, slot);
        if (slot.layer.hidden) {
          slot.last = null;
          if (key === slotKey())
            status.textContent =
              "Tracking lost. Look back at the selected surface.";
          continue;
        }
        if (key === slotKey())
          status.textContent =
            "Placed · " + (key === "tank" ? "aquarium wall" : key);
        apply(slot.effect);
        aqua.update(t / 1000);
        animateAsset(textureMesh, t / 1000);
        renderer.render(scene, cam);
        slot.ctx.clearRect(0, 0, 600, 322);
        slot.ctx.drawImage(canvas, 0, 0);
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
