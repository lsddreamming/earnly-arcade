// A transparent WebGL scene shares camera pose and projection with the ARKit camera underneath.
import * as T from "./realms-three.js";
import { createAquarium } from "./realms-aquarium.js";
import {
  surfaceMaterial,
  animateAsset,
  seatStyles,
  seatModel,
} from "./realms-assets.js";

function roomDepth(scene) {
  const bytes = new Uint8Array(96 * 96 * 2);
  const tex = new T.DataTexture(bytes, 96, 96, T.RGFormat);
  tex.minFilter = tex.magFilter = T.NearestFilter;
  tex.needsUpdate = true;
  const material = new T.ShaderMaterial({
    glslVersion: T.GLSL3,
    colorWrite: false,
    depthWrite: true,
    depthTest: true,
    uniforms: { depthMap: { value: tex } },
    vertexShader: `out vec2 screenUV; void main(){screenUV=vec2(uv.x,1.-uv.y);gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader: `uniform mat4 projectionMatrix;uniform sampler2D depthMap;in vec2 screenUV;
    void main(){vec2 b=texture(depthMap,screenUV).rg*255.;float z=(b.r+256.*b.g)*.01;
      if(z<.1)discard;z+=.04;vec4 clip=projectionMatrix*vec4(0.,0.,-z,1.);
      gl_FragDepth=clip.z/clip.w*.5+.5;}`,
  });
  const mesh = new T.Mesh(new T.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.visible = false;
  scene.add(mesh);
  return {
    update(data) {
      mesh.visible = !!data;
      if (!data) return;
      const decoded = atob(data);
      if (decoded.length !== bytes.length) {
        mesh.visible = false;
        return;
      }
      for (let i = 0; i < bytes.length; i++) bytes[i] = decoded.charCodeAt(i);
      tex.needsUpdate = true;
    },
    dispose() {
      tex.dispose();
    },
  };
}
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
  function floorMesh(data, target = floor) {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(data.vertices, 3));
    const uv = [];
    for (let i = 0; i < data.vertices.length; i += 3)
      uv.push(data.vertices[i], -data.vertices[i + 2]);
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setIndex(data.indices);
    g.computeVertexNormals();
    target.geometry.dispose();
    target.geometry = g;
  }
  aquarium.group.position.z = 0.34;
  const stored = JSON.parse(
    localStorage.getItem("earnly.realms.ar." + world.id) || "null",
  );
  const result = await plugin.open({ id: world.id });
  const depth = roomDepth(scene),
    seats = new Map(),
    wallAnchor = new T.Group();
  wallAnchor.matrixAutoUpdate = false;
  wallAnchor.visible = false;
  scene.add(wallAnchor);
  const paintedWall = new T.Mesh(
    new T.BufferGeometry(),
    surfaceMaterial("wall", stored?.wallFinish || world.wall),
  );
  wallAnchor.add(paintedWall);
  let wallData = result.restoring ? stored?.wallGeometry : null,
    chosenSeat = null;
  if (wallData) floorMesh(wallData, paintedWall);
  function mountSeat(id, style, angle = 0, fit = 1) {
    const root = new T.Group(),
      model = seatModel(style);
    model.position.y = -0.49;
    const pivot = new T.Group();
    pivot.add(model);
    pivot.rotation.y = angle;
    pivot.scale.setScalar(fit);
    root.add(pivot);
    root.matrixAutoUpdate = false;
    root.visible = false;
    scene.add(root);
    seats.set(id, { root, pivot, style });
  }
  if (result.restoring)
    for (const item of stored?.seats || [])
      if (seatStyles.includes(item.style))
        mountSeat(item.id, item.style, item.angle, item.fit);
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
  for (const v of [
    "Aquarium",
    "Wall",
    "Floor",
    ...(result.hasDepth ? ["Chair"] : []),
  ])
    select.add(new Option(v, v));
  controls.append(select);
  select.onchange = () => {
    mode = select.value;
    size.value = String(mode === "Chair" ? 1 : scale);
    if (pendingFloor) {
      pendingFloor = null;
      floorData = confirmedFloor;
      if (floorData) floorMesh(floorData);
    }
    chosenSeat = null;
    status.textContent =
      mode === "Chair"
        ? "Choose a seat style, then tap the center of the real cushion."
        : "Tap the surface you want to change.";
  };
  let placed = !!result.restoring && !!stored && (stored.tankPlaced ?? true),
    movingTank = false;
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
      if (mode === "Chair") {
        const hit = await plugin.place({ surface: "seat", x, y });
        chosenSeat = hit.id;
        mountSeat(hit.id, chairSelect.value);
        size.value = "1";
        status.textContent =
          "Seat anchored. Adjust its size or turn it to fit.";
        return;
      }
      if (mode === "Wall") {
        wallData = await plugin.place({ surface: "wallFinish", x, y });
        floorMesh(wallData, paintedWall);
        status.textContent =
          "Wall finish anchored. Tap another wall to move it.";
        return;
      }
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
      movingTank = false;
      wallMode = mode;
      aquarium.group.visible = mode === "Aquarium";
      wall.visible = mode === "Wall";
      status.textContent =
        "Aquarium anchored. Use Move aquarium to choose a different wall spot.";
    } catch (e) {
      status.textContent = e.message;
    }
  }
  const placeButton = action("Place", () => {
    if (mode === "Aquarium" && placed) {
      movingTank = true;
      status.textContent = "Tap the new wall position.";
      return;
    }
    place(false);
  });
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
  const chairSelect = document.createElement("select");
  chairSelect.setAttribute("aria-label", "Replacement chair");
  seatStyles.forEach((name) => chairSelect.add(new Option(name, name)));
  controls.append(chairSelect);
  chairSelect.onchange = () => {
    const seat = seats.get(chosenSeat);
    if (!seat) return;
    const old = seat.pivot.children[0];
    seat.pivot.remove(old);
    const materials = new Set();
    old.traverse((n) => {
      n.geometry?.dispose();
      if (n.material) materials.add(n.material);
    });
    materials.forEach((m) => m.dispose());
    const next = seatModel(chairSelect.value);
    next.position.y = -0.49;
    seat.pivot.add(next);
    seat.style = chairSelect.value;
  };
  const rotate = action("Turn chair", () => {
    const seat = seats.get(chosenSeat);
    if (seat) seat.pivot.rotation.y += Math.PI / 12;
  });
  const restore = action("Restore real chair", async () => {
    const seat = seats.get(chosenSeat);
    if (!seat) return;
    try {
      await plugin.removeSeat({ id: chosenSeat });
      scene.remove(seat.root);
      const mats = new Set();
      seat.root.traverse((n) => {
        n.geometry?.dispose();
        if (n.material) mats.add(n.material);
      });
      mats.forEach((m) => m.dispose());
      seats.delete(chosenSeat);
      chosenSeat = null;
      status.textContent = "Original chair visible.";
    } catch (e) {
      status.textContent = e.message;
    }
  });
  const wallSelect = document.createElement("select");
  wallSelect.setAttribute("aria-label", "Wall finish");
  for (const name of [
    "Stone",
    "Ruins",
    "Luxury",
    "Forest",
    "Glass",
    "Spacecraft",
  ])
    wallSelect.add(new Option(name, name));
  wallSelect.value = stored?.wallFinish || world.wall;
  controls.append(wallSelect);
  wallSelect.onchange = () => {
    paintedWall.material.dispose();
    paintedWall.material = surfaceMaterial("wall", wallSelect.value);
  };
  const size = document.createElement("input");
  Object.assign(size, {
    type: "range",
    min: ".2",
    max: "1.3",
    step: ".02",
    value: scale,
  });
  size.setAttribute("aria-label", "Physical size");
  size.oninput = () => {
    if (mode === "Chair")
      seats.get(chosenSeat)?.pivot.scale.setScalar(Number(size.value));
    else scale = Number(size.value);
  };
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
      depth.dispose();
      mats.forEach((m) => m.dispose());
      exit();
    }
  }
  function background() {
    if (document.hidden) close();
  }
  let identifying = false;
  action("Identify object", () => {
    identifying = true;
    status.textContent = "Tap the center of a chair, TV or other object.";
  });
  async function pick(e) {
    if (identifying) {
      identifying = false;
      try {
        const { suggestions } = await plugin.identify({
          x: e.clientX / innerWidth,
          y: e.clientY / innerHeight,
        });
        status.textContent = suggestions?.length
          ? "Possible match: " + suggestions.join(", ")
          : "No confident match. Try a closer view.";
      } catch (e) {
        status.textContent = e.message;
      }
      return;
    }

    const ray = new T.Raycaster();
    ray.setFromCamera(
      new T.Vector2(
        (e.clientX / innerWidth) * 2 - 1,
        1 - (e.clientY / innerHeight) * 2,
      ),
      camera,
    );
    if (mode === "Chair") {
      for (const [id, seat] of seats)
        if (seat.root.visible && ray.intersectObject(seat.root, true).length) {
          chosenSeat = id;
          chairSelect.value = seat.style;
          size.value = String(seat.pivot.scale.x);
          status.textContent = "Seat selected. Choose a new style or turn it.";
          return;
        }
    }
    if (placed && mode === "Aquarium" && !movingTank) {
      const species = aquarium.interact(ray);
      if (species) {
        status.textContent = species;
        return;
      }
      return;
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
          tankPlaced: placed,
          wallGeometry: wallData,
          wallFinish: wallSelect.value,
          seats: Array.from(seats, ([id, { pivot, style }]) => ({
            id,
            style,
            angle: pivot.rotation.y,
            fit: pivot.scale.x,
          })),
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
        depth.update(f.depth);
        if (wallData && f.wallAnchor && f.tracking) wallAnchor.visible = true;
        if (wallAnchor.visible && f.wallAnchor && f.tracking) {
          wallAnchor.matrix.fromArray(f.wallAnchor);
          wallAnchor.matrixWorldNeedsUpdate = true;
        }
        for (const [id, seat] of seats) {
          const pose = f.seats?.[id];
          if (pose && f.tracking) {
            seat.root.visible = true;
            seat.root.matrix.fromArray(pose);
            seat.root.matrixWorldNeedsUpdate = true;
          }
        }
        if (f.anchor && f.tracking) {
          anchor.visible = placed;
          anchor.matrix.fromArray(f.anchor);
          anchor.matrixWorldNeedsUpdate = true;
        }
        const floorPose = pendingFloor?.pose || f.floorAnchor;
        if (!pendingFloor && !floorData) floor.visible = false;
        if (floorPose && (pendingFloor || floorData) && f.tracking) {
          floor.visible = true;
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
            : mode === "Chair"
              ? "Place on seat"
              : mode === "Aquarium" && placed
                ? "Move aquarium"
                : "Place on wall";
        manualButton.hidden = mode !== "Aquarium";
        chairSelect.hidden = rotate.hidden = mode !== "Chair";
        wallSelect.hidden = mode !== "Wall";
        restore.hidden = mode !== "Chair" || !chosenSeat;
        rotate.disabled = !chosenSeat;
        size.max = mode === "Chair" ? "2" : "1.3";
        materialSelect.hidden = mode !== "Floor";
        size.hidden = mode === "Floor" || mode === "Wall";
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
