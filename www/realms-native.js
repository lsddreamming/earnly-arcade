// A transparent WebGL scene shares camera pose and projection with the ARKit camera underneath.
import * as T from "./realms-three.js";
import { createAquarium } from "./realms-aquarium.js";
import { surfaceMaterial, animateAsset } from "./realms-assets.js";

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
  const floorAnchor = new T.Group();
  floorAnchor.matrixAutoUpdate = false;
  scene.add(floorAnchor);
  floorAnchor.add(floor);
  content.add(wall);
  wall.visible = floor.visible = false;
  floor.material.side = T.DoubleSide;
  let floorData = null,
    confirmedFloor = null,
    pendingFloor = null;
  function floorMesh(data) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(data.vertices, 3));
    const uv = [];
    for (let i = 0; i < data.vertices.length; i += 3)
      uv.push(data.vertices[i], -data.vertices[i + 2]);
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setIndex(data.indices);
    g.computeVertexNormals();
    floor.geometry.dispose();
    floor.geometry = g;
  }
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
    if (pendingFloor) {
      pendingFloor = null;
      floorData = confirmedFloor;
      if (floorData) floorMesh(floorData);
    }
    status.textContent = "Aim at the new surface and place it.";
  };
  let placed = !!result.restoring && !!stored;
  if (placed) {
    mode = stored.mode;
    scale = stored.scale;
    select.value = mode;
    aquarium.group.visible = mode === "Aquarium";
    wall.visible = mode === "Wall";
    floor.visible = false;
    status.textContent =
      "Look around the previously saved room to align the map.";
  }
  if (result.restoring && stored?.floor) {
    confirmedFloor = floorData = stored.floor;
    floorMesh(floorData);
  }
  let wallMode = stored?.wallMode || (mode === "Floor" ? "Aquarium" : mode);
  aquarium.group.visible = wallMode === "Aquarium";
  wall.visible = wallMode === "Wall";
  const action = (label, fn) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = fn;
    controls.append(b);
    return b;
  };
  async function place(manual, x = 0.5, y = 0.5) {
    try {
      if (mode === "Floor") {
        if (pendingFloor) {
          await plugin.place({ surface: "floor", confirm: true });
          confirmedFloor = floorData = pendingFloor;
          pendingFloor = null;
          status.textContent = "Floor confirmed.";
          return;
        }
        const data = await plugin.place({ surface: "floor", x, y });
        if (!data.vertices?.length) throw Error("Scan more of the floor.");
        pendingFloor = data;
        floorMesh(data);
        status.textContent =
          "Check the highlighted floor, then tap Confirm floor.";
        return;
      }
      await plugin.place({ surface: "wall", manual, x, y });
      placed = true;
      wallMode = mode;
      aquarium.group.visible = mode === "Aquarium";
      wall.visible = mode === "Wall";
      status.textContent = "Anchored. Tap another wall spot to move it.";
    } catch (e) {
      status.textContent = e.message;
    }
  }
  const placeButton = action("Place", () => place(false));
  const manualButton = action("Manual · 1.7 m", () => place(true));
  const materialSelect = document.createElement("select");
  materialSelect.setAttribute("aria-label", "Floor finish");
  for (const name of ["Marble", "Lava", "Slate", "Crystal", "Water", "Glass"])
    materialSelect.add(new Option(name, name));
  materialSelect.value = stored?.finish || world.floor;
  function finish() {
    floor.material.dispose();
    floor.material = surfaceMaterial("floor", materialSelect.value);
    floor.material.side = T.DoubleSide;
  }
  materialSelect.onchange = finish;
  controls.append(materialSelect);
  finish();
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
  let identifying=false;
  action("Identify object",()=>{identifying=true;status.textContent="Tap the center of a chair, TV or other object."});
  async function pick(e) {
    if(identifying){identifying=false;try{const {suggestions}=await plugin.identify({x:e.clientX/innerWidth,y:e.clientY/innerHeight});
      status.textContent=suggestions?.length?"Possible match: "+suggestions.join(", "):"No confident match. Try a closer view.";
    }catch(e){status.textContent=e.message}return}

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
      if (species) {
        status.textContent = species;
        return;
      }
    }
    if (!pendingFloor)
      place(false, e.clientX / innerWidth, e.clientY / innerHeight);
  }
  canvas.addEventListener("click", pick);
  document.addEventListener("visibilitychange", background);
  action("Save placement", async () => {
    try {
      await plugin.saveMap({});
      localStorage.setItem(
        "earnly.realms.ar." + world.id,
        JSON.stringify({
          mode,
          scale,
          wallMode,
          floor: confirmedFloor,
          finish: materialSelect.value,
        }),
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
        const floorPose = pendingFloor?.pose || f.floorAnchor;
        floor.visible =
          !!floorPose && !!(pendingFloor || floorData) && f.tracking;
        if (floor.visible) {
          floorAnchor.matrix.fromArray(floorPose);
          floorAnchor.matrixWorldNeedsUpdate = true;
          floor.material.transparent = !!pendingFloor;
          floor.material.opacity = pendingFloor ? 0.48 : 1;
          animateAsset(floor, t / 1000);
        }
        placeButton.textContent =
          mode === "Floor"
            ? pendingFloor
              ? "Confirm floor"
              : "Scan floor"
            : "Place on wall";
        manualButton.hidden = mode === "Floor";
        materialSelect.hidden = mode !== "Floor";
        size.hidden = mode === "Floor";
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
