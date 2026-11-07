(() => {
  'use strict';

  const element = id => document.getElementById(id);
  const canvas = element('city');
  const context = canvas.getContext('2d');
  if (!context) {
    element('description').textContent = 'This browser could not initialize the game canvas.';
    element('start').disabled = true;
    return;
  }

  const size = 108;
  const roads = [12, 40, 68, 96];
  const garage = { x: 96, z: 91 };
  const blocks = [];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const x = roads[column];
      const z = roads[row];
      const shade = (row * 3 + column) % 4;
      blocks.push({ x: x + 9, z: z + 7, w: 11, d: 6, h: 6 + shade * 1.1, shade });
      blocks.push({ x: x + 7, z: z + 17, w: 13, d: 5, h: 5 + shade, shade: (shade + 2) % 4 });
    }
  }

  const keys = new Set();
  const pointers = new Map();
  const bindings = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  };
  const player = { x: 12, z: 43, angle: 0 };
  const car = { x: 12, z: 32, angle: 0, speed: 0 };
  const patrol = { x: 40, z: 56, angle: 0 };
  const lastSeen = { x: car.x, z: car.z };
  const camera = { x: player.x, z: player.z, angle: 0, distance: 11 };
  let phase = 'ready';
  let inCar = false;
  let stolen = false;
  let lost = false;
  let elapsed = 0;
  let unseen = 0;
  let caught = 0;
  let path = [];
  let rethink = 0;
  let lastTime = 0;

  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const facing = angle => ({ x: Math.sin(angle), z: -Math.cos(angle) });
  const held = action => keys.has(action) || [...pointers.values()].includes(action);

  function blocked(x, z, radius) {
    return x < radius + 2 || x > size - radius - 2 || z < radius + 2 || z > size - radius - 2
      || blocks.some(b => x + radius > b.x && x - radius < b.x + b.w
        && z + radius > b.z && z - radius < b.z + b.d);
  }

  function move(actor, dx, dz, radius) {
    let hit = false;
    if (blocked(actor.x + dx, actor.z, radius)) hit = true;
    else actor.x += dx;
    if (blocked(actor.x, actor.z + dz, radius)) hit = true;
    else actor.z += dz;
    return hit;
  }

  function visible(a, b) {
    const steps = Math.ceil(distance(a, b));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      if (blocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0)) return false;
    }
    return true;
  }

  function route(from, to) {
    const step = 4;
    const width = size / step;
    const id = actor => clamp(Math.round(actor.z / step), 1, width - 1) * width
      + clamp(Math.round(actor.x / step), 1, width - 1);
    const point = cell => ({ x: (cell % width) * step, z: Math.floor(cell / width) * step });
    const start = id(from);
    const goal = id(to);
    const parents = new Map([[start, start]]);
    const queue = [start];
    let nearest = start;
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (distance(point(current), to) < distance(point(nearest), to)) nearest = current;
      if (current === goal) break;
      const x = current % width;
      const neighbors = [current - width, current + width];
      if (x > 1) neighbors.push(current - 1);
      if (x < width - 1) neighbors.push(current + 1);
      for (const next of neighbors) {
        if (next < 0 || next >= width * width || parents.has(next)) continue;
        const p = point(next);
        if (blocked(p.x, p.z, 1.25)) continue;
        parents.set(next, current);
        queue.push(next);
      }
    }
    const result = [];
    while (nearest !== start) {
      result.push(point(nearest));
      nearest = parents.get(nearest);
    }
    return result.reverse();
  }

  function clearControls() {
    keys.clear();
    pointers.clear();
  }

  function reset() {
    Object.assign(player, { x: 12, z: 43, angle: 0 });
    Object.assign(car, { x: 12, z: 32, angle: 0, speed: 0 });
    Object.assign(patrol, { x: 40, z: 56, angle: 0 });
    Object.assign(camera, { x: player.x, z: player.z, angle: 0, distance: 11 });
    inCar = stolen = lost = false;
    elapsed = unseen = caught = rethink = 0;
    path = [];
    run();
  }

  function run() {
    phase = 'playing';
    clearControls();
    element('overlay').hidden = true;
    element('pause').disabled = false;
    updateHud();
  }

  function overlay(next, title, description, action) {
    phase = next;
    clearControls();
    element('title').textContent = title;
    element('description').textContent = description;
    element('start').textContent = action;
    element('overlay').hidden = false;
    element('pause').disabled = true;
    element('interact').disabled = true;
    if (!document.hidden) element('start').focus();
  }

  function pause() {
    if (phase === 'playing') {
      overlay('paused', 'Mission paused', 'Your timer is frozen. Ready to get back to the harbor?', 'Resume mission');
    } else if (phase === 'paused') run();
  }

  function interact() {
    if (phase !== 'playing') return;
    if (inCar) {
      if (Math.abs(car.speed) > 2) return;
      const side = facing(car.angle + Math.PI / 2);
      for (const sign of [1, -1]) {
        const x = car.x + side.x * 2.1 * sign;
        const z = car.z + side.z * 2.1 * sign;
        if (blocked(x, z, 0.45)) continue;
        Object.assign(player, { x, z, angle: car.angle });
        car.speed = 0;
        inCar = false;
        break;
      }
    } else if (distance(player, car) < 3.4) {
      if (!stolen) Object.assign(lastSeen, { x: car.x, z: car.z });
      inCar = true;
      stolen = true;
    }
    updateHud();
  }

  function updateHud() {
    const seconds = Math.max(0, Math.ceil(180 - elapsed));
    element('clock').textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    element('heat').textContent = lost ? 'CLEAR' : !stolen ? 'ON FOOT'
      : caught > 0 ? 'PATROL ON YOU' : unseen > 0 ? 'LOSING PATROL' : 'WANTED';
    element('speed').hidden = !inCar;
    element('speed').textContent = Math.round(Math.abs(car.speed) * 3.6) + ' km/h';
    const objective = !stolen ? 'Find the marked getaway car.' : !inCar ? 'Get back in the getaway car.'
      : lost ? 'Drive to the garage.' : 'Use the blocks and alleys to lose the patrol.';
    if (element('objective').textContent !== objective) element('objective').textContent = objective;
    element('interact').disabled = phase !== 'playing'
      || (inCar ? Math.abs(car.speed) > 2 : distance(player, car) >= 3.4);
    element('interact').textContent = inCar ? 'Exit car' : 'Enter car';
  }

  function update(dt) {
    elapsed += dt;
    const horizontal = Number(held('right')) - Number(held('left'));
    const vertical = Number(held('down')) - Number(held('up'));
    if (inCar) {
      if (vertical) {
        const acceleration = vertical > 0 && car.speed > 0 ? 24 : 13;
        car.speed = clamp(car.speed - vertical * acceleration * dt, -7, 20);
      } else car.speed *= Math.exp(-2.3 * dt);
      const steering = Math.min(1, Math.abs(car.speed) / 3);
      car.angle += horizontal * Math.sign(car.speed) * steering * 1.9 * dt;
      const direction = facing(car.angle);
      if (move(car, direction.x * car.speed * dt, direction.z * car.speed * dt, 1.22)) car.speed *= 0.35;
    } else if (horizontal || vertical) {
      player.angle = Math.atan2(horizontal, -vertical);
      const direction = facing(player.angle);
      move(player, direction.x * 7 * dt, direction.z * 7 * dt, 0.45);
    }

    const active = inCar ? car : player;
    if (stolen && !lost) {
      const separation = distance(active, patrol);
      const seen = separation < 30 && visible(patrol, active);
      if (seen) Object.assign(lastSeen, { x: active.x, z: active.z });
      unseen = !seen && separation > 12 ? unseen + dt : 0;
      caught = separation < 3 && Math.abs(car.speed) < 4 ? caught + dt : 0;
      if (unseen >= 5) lost = true;
      else {
        rethink -= dt;
        if (rethink <= 0) {
          path = seen ? [] : route(patrol, lastSeen);
          rethink = 0.55;
        }
        if (path.length && distance(patrol, path[0]) < 1) path.shift();
        const target = seen ? active : path[0];
        if (target) {
          patrol.angle = Math.atan2(target.x - patrol.x, patrol.z - target.z);
          const direction = facing(patrol.angle);
          const speed = Math.min(separation, seen ? 13.5 : 10);
          move(patrol, direction.x * speed * dt, direction.z * speed * dt, 1.2);
        }
      }
    }

    if (inCar && lost && distance(car, garage) < 4) {
      overlay('finished', 'Clean getaway', 'You lost the patrol and delivered the coupe with ' + Math.max(0, Math.ceil(180 - elapsed)) + ' seconds left.', 'Play again');
    } else if (caught >= 2 || elapsed >= 180) {
      overlay('finished', caught >= 2 ? 'Busted' : 'Time’s up', 'Try cutting through a different block to break line of sight.', 'Try again');
    }

    const smoothing = 1 - Math.exp(-8 * dt);
    camera.x += (active.x - camera.x) * smoothing;
    camera.z += (active.z - camera.z) * smoothing;
    const turn = (inCar ? car.angle : 0) - camera.angle;
    camera.angle += Math.atan2(Math.sin(turn), Math.cos(turn)) * smoothing;
    const forward = facing(camera.angle);
    const targetDistance = inCar ? 11 + Math.abs(car.speed) * 0.16 : 11;
    let clearance = targetDistance;
    for (let offset = 2; offset < targetDistance; offset += 0.5) {
      const x = camera.x - forward.x * offset;
      const z = camera.z - forward.z * offset;
      if (blocks.some(b => x > b.x - 0.4 && x < b.x + b.w + 0.4
        && z > b.z - 0.4 && z < b.z + b.d + 0.4)) {
        clearance = Math.max(1.5, offset - 0.75);
        break;
      }
    }
    camera.distance = Math.min(clearance, camera.distance + 12 * dt);
    updateHud();
  }

  const roofs = ['#997674', '#7097ab', '#957daf', '#64958a'];
  const walls = ['#594751', '#38546b', '#554669', '#365b58'];
  const darkWalls = ['#413642', '#283f53', '#403650', '#294743'];
  const lamps = roads.flatMap(x => roads.map(z => ({ x: x + 5.2, z: z + 5.2 })));
  const eye = { x: 0, y: 0, z: 0, cosine: 1, sine: 0, pitchCosine: 1, pitchSine: 0 };
  let width = 0;
  let height = 0;
  let focal = 0;
  let faces = [];

  function cameraPoint([x, y, z]) {
    const dx = x - eye.x;
    const dy = y - eye.y;
    const dz = z - eye.z;
    const forward = dx * eye.sine - dz * eye.cosine;
    return [
      dx * eye.cosine + dz * eye.sine,
      dy * eye.pitchCosine + forward * eye.pitchSine,
      forward * eye.pitchCosine - dy * eye.pitchSine,
    ];
  }

  function project([x, y, depth]) {
    return [width / 2 + focal * x / depth, height * 0.51 - focal * y / depth];
  }

  function polygon(points, color, ground = false) {
    const view = points.map(cameraPoint);
    const clipped = [];
    const near = 1;
    for (let i = 0; i < view.length; i += 1) {
      const a = view[i];
      const b = view[(i + 1) % view.length];
      if (a[2] >= near) clipped.push(a);
      if ((a[2] >= near) !== (b[2] >= near)) {
        const t = (near - a[2]) / (b[2] - a[2]);
        clipped.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, near]);
      }
    }
    if (clipped.length < 3) return;
    const projected = clipped.map(project);
    if (projected.every(p => p[0] < 0) || projected.every(p => p[0] > width)
      || projected.every(p => p[1] < 0) || projected.every(p => p[1] > height)) return;
    if (ground) fill(projected, color);
    else faces.push({ points: projected, color, depth: view.reduce((sum, p) => sum + p[2], 0) / view.length });
  }

  function fill(points, color) {
    context.fillStyle = color;
    context.beginPath();
    points.forEach(([x, y], i) => i ? context.lineTo(x, y) : context.moveTo(x, y));
    context.closePath();
    context.fill();
  }

  function flat(x, z, w, d, color) {
    polygon([[x, 0, z], [x + w, 0, z], [x + w, 0, z + d], [x, 0, z + d]], color, true);
  }

  function box(x, z, w, d, h, angle, colors, base = 0) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const point = (dx, y, dz) => [x + dx * cosine - dz * sine, y + base, z + dx * sine + dz * cosine];
    const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
    const top = corners.map(([dx, dz]) => point(dx, h, dz));
    const bottom = corners.map(([dx, dz]) => point(dx, 0, dz));
    for (let i = 0; i < 4; i += 1) {
      const next = (i + 1) % 4;
      const a = bottom[i];
      const b = bottom[next];
      if ((b[2] - a[2]) * (eye.x - a[0]) - (b[0] - a[0]) * (eye.z - a[2]) > 0) {
        polygon([a, b, top[next], top[i]], colors[1 + i % 2]);
      }
    }
    polygon(top, colors[0]);
  }

  function groundGlow(x, z, radius, color) {
    for (const scale of [1, 0.75, 0.5]) {
      const ring = Array.from({ length: 12 }, (_, index) => {
        const angle = index / 12 * Math.PI * 2;
        return [x + Math.cos(angle) * radius * scale, 0, z + Math.sin(angle) * radius * scale];
      });
      polygon(ring, color, true);
    }
  }

  function drawCar(actor, police) {
    const colors = police ? ['#c9d7ec', '#34435b', '#263249'] : ['#79f1c6', '#218c7f', '#176052'];
    box(actor.x, actor.z, 2.15, 3.65, 0.75, actor.angle, colors, 0.24);
    box(actor.x, actor.z, 1.55, 1.85, 0.55, actor.angle, ['#263a50', '#1c2d42', '#1a2738'], 0.99);
    const front = facing(actor.angle);
    box(actor.x - front.x * 1.83, actor.z - front.z * 1.83, 1.8, 0.1, 0.14,
      actor.angle, ['#ff7366', '#fd535b', '#cc4050'], 0.64);
    if (police) box(actor.x, actor.z, 1.32, 0.32, 0.16, actor.angle,
      elapsed % 0.55 < 0.275 ? ['#ff6179', '#a42541', '#a42541'] : ['#69baff', '#345fae', '#345fae'], 1.54);
  }

  function pin(actor, y, color) {
    const point = cameraPoint([actor.x, y, actor.z]);
    if (point[2] < 1) return;
    const [x, screenY] = project(point);
    fill([[x - 7, screenY - 10], [x + 7, screenY - 10], [x, screenY]], color);
  }

  function minimap(active) {
    const mapSize = Math.min(94, width * 0.25);
    const scale = mapSize / size;
    const x = width - mapSize - 10;
    const y = height - mapSize - 10;
    context.fillStyle = '#111b2de8';
    context.fillRect(x, y, mapSize, mapSize);
    context.strokeStyle = '#698097';
    context.strokeRect(x, y, mapSize, mapSize);
    context.fillStyle = '#354459';
    for (const b of blocks) context.fillRect(x + b.x * scale, y + b.z * scale, b.w * scale, b.d * scale);
    const dots = [[active, '#ffffff']];
    if (!stolen) dots.push([car, '#79f1c6']);
    if (stolen && !lost) dots.push([patrol, '#ff6179']);
    if (lost) dots.push([garage, '#ffd373']);
    for (const [point, color] of dots) {
      context.beginPath();
      context.fillStyle = color;
      context.arc(x + point.x * scale, y + point.z * scale, 3, 0, Math.PI * 2);
      context.fill();
    }
  }

  function render() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(rect.width * dpr);
    const pixelHeight = Math.round(rect.height * dpr);
    if (!pixelWidth || !pixelHeight) return;
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    width = rect.width;
    height = rect.height;
    focal = Math.min(width * 0.88, height * 0.91);
    eye.cosine = Math.cos(camera.angle);
    eye.sine = Math.sin(camera.angle);
    eye.x = camera.x - eye.sine * camera.distance;
    eye.z = camera.z + eye.cosine * camera.distance;
    eye.y = Math.min(5, 2.6 + camera.distance * 0.19);
    const pitch = Math.atan2(eye.y - 1.5, camera.distance + 1);
    eye.pitchCosine = Math.cos(pitch);
    eye.pitchSine = Math.sin(pitch);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#0b1124');
    sky.addColorStop(0.5, '#34415b');
    sky.addColorStop(1, '#172e41');
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);
    flat(-110, -110, 320, 330, '#244656');
    flat(0, 0, size, size, '#576571');
    for (const road of roads) {
      flat(road - 4.6, 0, 9.2, size, '#344051');
      flat(0, road - 4.6, size, 9.2, '#344051');
      for (let offset = 2; offset < size - 2; offset += 5) {
        if (roads.some(cross => Math.abs(cross - offset) < 5)) continue;
        flat(road - 0.09, offset, 0.18, 2.1, '#a79b70');
        flat(offset, road - 0.09, 2.1, 0.18, '#a79b70');
      }
    }
    flat(garage.x - 3.5, garage.z - 3.5, 7, 7, lost ? '#a78248' : '#455165');
    const nearbyLamps = lamps.filter(lamp => distance(lamp, camera) < 52);
    for (const lamp of nearbyLamps) groundGlow(lamp.x, lamp.z, 5.4, '#ffc4781c');
    const front = facing(car.angle);
    groundGlow(car.x - front.x * 2.4, car.z - front.z * 2.4, 2.4, '#ff455827');
    if (inCar) groundGlow(car.x + front.x * 4.2, car.z + front.z * 4.2, 3.2, '#a6e3ff20');
    faces = [];
    for (const lamp of nearbyLamps) {
      box(lamp.x, lamp.z, 0.18, 0.18, 4.6, 0, ['#576981', '#3d5064', '#293f54']);
      box(lamp.x, lamp.z, 0.6, 0.45, 0.18, 0, ['#ffd795', '#ffca7a', '#d49753'], 4.55);
    }
    for (const b of blocks) {
      box(b.x + b.w / 2, b.z + b.d / 2, b.w, b.d, b.h, 0,
        [roofs[b.shade], walls[b.shade], darkWalls[b.shade]]);
      for (let x = b.x + 1.5; x < b.x + b.w - 1; x += 2) {
        const z = b.z + b.d + 0.015;
        if (eye.z > z) {
          polygon([[x, 2.1, z], [x + 0.65, 2.1, z], [x + 0.65, 3.1, z], [x, 3.1, z]], '#d5ab7f');
        }
      }
    }
    drawCar(car, false);
    drawCar(patrol, true);
    if (!inCar) {
      box(player.x, player.z, 0.65, 0.48, 1.08, player.angle, ['#f1bd71', '#ce694a', '#9d493f']);
      box(player.x, player.z, 0.46, 0.45, 0.48, player.angle, ['#ffe2b6', '#d99e76', '#aa6e56'], 1.08);
    }
    faces.sort((a, b) => b.depth - a.depth);
    for (const face of faces) fill(face.points, face.color);
    if (!stolen || !inCar) pin(car, 3.8, '#79f1c6');
    if (lost) pin(garage, 4, '#ffd373');
    minimap(inCar ? car : player);
  }

  function frame(time) {
    const dt = Math.min((time - (lastTime || time)) / 1000, 0.05);
    lastTime = time;
    if (phase === 'playing') update(dt);
    render();
    requestAnimationFrame(frame);
  }

  document.addEventListener('keydown', event => {
    const action = bindings[event.code];
    if (action && phase === 'playing') {
      event.preventDefault();
      keys.add(action);
    } else if (event.code === 'KeyE' && !event.repeat) interact();
    else if (event.code === 'Escape' && !event.repeat) pause();
  });
  document.addEventListener('keyup', event => keys.delete(bindings[event.code]));
  window.addEventListener('blur', () => {
    clearControls();
    pauseOnExit();
  });
  function pauseOnExit() {
    if (phase === 'playing') pause();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseOnExit();
  });
  document.querySelectorAll('[data-key]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      if (phase !== 'playing' || event.button !== 0) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, button.dataset.key);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(type, event => pointers.delete(event.pointerId));
    }
  });
  element('start').addEventListener('click', () => phase === 'paused' ? run() : reset());
  element('interact').addEventListener('click', interact);
  element('pause').addEventListener('click', pause);
  element('pause').disabled = true;
  updateHud();
  requestAnimationFrame(frame);
})();
