// A transparent WebGL scene shares camera pose and projection with the ARKit camera underneath.
import * as T from "./realms-three.js";
import { createAquarium } from "./realms-aquarium.js";
import { surfaceMaterial } from "./realms-assets.js";

export async function openRoomTracking({ world, renderer, canvas, exit }) {
  const plugin = window.Capacitor.Plugins.EarnlyRealms;
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(),
    anchor = new T.Group(),
    content = new T.Group();
  camera.matrixAutoUpdate = false;
  anchor.matrixAutoUpdate = false;
  anchor.visible = false;
  anchor.add(content);
  scene.add(anchor);
  const light = new T.HemisphereLight(0xffffff, 0x90acae, 2);
  scene.add(light);
  const aquarium = createAquarium(world.style);
  content.add(aquarium.group);
  const wall = new T.Mesh(
    new T.PlaneGeometry(2, 1.5),
    surfaceMaterial("wall", world.wall),
  );
  const floor = new T.Mesh(
    new T.PlaneGeometry(2, 2),
    surfaceMaterial("floor", world.floor),
  );
  floor.rotation.x = -Math.PI / 2;
  content.add(wall, floor);
  wall.visible = floor.visible = false;
  aquarium.group.position.z = 0.34;
  const stored = JSON.parse(
    localStorage.getItem("earnly.realms.ar." + world.id) || "null",
  );
  const result = await plugin.open({ id: world.id });
  let running = true,
    busy = false,
    mode = "Aquarium",
    scale = 0.62;
  const controls = document.createElement("aside");
  controls.className = "ar-controls";
  document.body.append(controls);
  const status = document.createElement("p");
  status.textContent = "Move slowly to scan. Aim the crosshair at a wall.";
  controls.append(status);
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Placement type");
  for (const v of ["Aquarium", "Wall", "Floor"]) select.add(new Option(v, v));
  controls.append(select);
  select.onchange = () => {
    mode = select.value;
    anchor.visible = false;
    status.textContent = "Aim at the new surface and place it.";
    placed = false;
  };
  let placed = !!result.restoring && !!stored;
  if (placed) {
    mode = stored.mode;
    scale = stored.scale;
    select.value = mode;
    aquarium.group.visible = mode === "Aquarium";
    wall.visible = mode === "Wall";
    floor.visible = mode === "Floor";
    status.textContent =
      "Look around the previously saved room to align the map.";
  }
  const action = (label, fn) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = fn;
    controls.append(b);
  };
  async function place(manual) {
    try {
      await plugin.place({
        surface: mode === "Floor" ? "floor" : "wall",
        manual,
      });
      placed = true;
      aquarium.group.visible = mode === "Aquarium";
      wall.visible = mode === "Wall";
      floor.visible = mode === "Floor";
      status.textContent = "Placed · move around it or adjust size.";
    } catch (e) {
      status.textContent = e.message;
    }
  }
  action("Place", () => place(false));
  action("Manual · 1.7 m", () => place(true));
  const size = document.createElement("input");
  Object.assign(size, {
    type: "range",
    min: ".2",
    max: "1.3",
    step: ".02",
    value: scale,
  });
  size.setAttribute("aria-label", "Physical size");
  size.oninput = () => (scale = Number(size.value));
  controls.append(size);
  const marker = document.createElement("span");
  marker.className = "reticle";
  marker.textContent = "＋";
  document.body.append(marker);
  async function close() {
    if (!running) return;
    running = false;
    try {
      await plugin.close({});
    } finally {
      controls.remove();
      marker.remove();
      document.documentElement.classList.remove("tracking");
      document.removeEventListener("visibilitychange", background);
      canvas.removeEventListener("click", pick);
      const mats = new Set(),
        geos = new Set();
      scene.traverse((v) => {
        if (v.geometry) geos.add(v.geometry);
        if (v.material) mats.add(v.material);
      });
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      exit();
    }
  }
  function background() {
    if (document.hidden) close();
  }
  function pick(e) {
    const ray = new T.Raycaster();
    ray.setFromCamera(
      new T.Vector2(
        (e.clientX / innerWidth) * 2 - 1,
        1 - (e.clientY / innerHeight) * 2,
      ),
      camera,
    );
    if (placed && mode === "Aquarium") {
      const species = aquarium.interact(ray);
      if (species) status.textContent = species;
    }
  }
  canvas.addEventListener("click", pick);
  document.addEventListener("visibilitychange", background);
  action("Save placement", async () => {
    try {
      await plugin.saveMap({});
      localStorage.setItem(
        "earnly.realms.ar." + world.id,
        JSON.stringify({ mode, scale }),
      );
      status.textContent =
        "Placement saved. Save this realm in the editor to reopen it.";
    } catch (e) {
      status.textContent = e.message;
    }
  });
  action("Exit AR", close);
  document.documentElement.classList.add("tracking");
  async function frame(t) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (busy) return;
    busy = true;
    try {
      const f = await plugin.frame({});
      if (!running) return;
      if (f.view) {
        camera.projectionMatrix.fromArray(f.projection);
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        camera.matrix.fromArray(f.view).invert();
        camera.updateMatrixWorld(true);
        if (f.anchor) {
          anchor.matrix.fromArray(f.anchor);
          anchor.matrixWorldNeedsUpdate = true;
        }
        anchor.visible = placed && !!f.anchor && f.tracking;
        light.intensity = T.MathUtils.clamp(f.light / 500, 0.7, 3);
        content.scale.setScalar(scale);
        aquarium.update(t / 1000);
      }
      renderer.setClearColor(0, 0);
      renderer.render(scene, camera);
    } catch (e) {
      status.textContent = e.message;
    } finally {
      busy = false;
    }
  }
  requestAnimationFrame(frame);
}
