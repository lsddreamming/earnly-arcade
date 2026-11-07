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
    KeyQ: 'lookLeft', KeyR: 'lookRight', Space: 'brake',
  };
  const player = { x: 12, z: 43, angle: 0 };
  const car = { x: 12, z: 32, angle: 0, speed: 0 };
  const patrol = { x: 40, z: 56, angle: 0 };
  const lastSeen = { x: car.x, z: car.z };
  const traffic = [
    { route: [[42.5, 42.5], [42.5, 65.5], [65.5, 65.5], [65.5, 42.5]], speed: 5.4, paint: ['#e0a269', '#a06153', '#744654'] },
    { route: [[70.4, 37.6], [70.4, 70.4], [93.6, 70.4], [93.6, 37.6]], speed: 6.1, paint: ['#a0b8df', '#586f9f', '#404e7d'] },
    { route: [[38, 65.5], [38, 42.5], [14.5, 42.5], [14.5, 65.5]], speed: 4.7, paint: ['#db95a4', '#9d5268', '#783a54'] },
  ];
  const workers = [
    { x: 35, z: 47, dx: 0, dz: 15, pace: 0.18, jacket: ['#f7b973', '#c48152', '#a0644c'] },
    { x: 46, z: 63, dx: 16, dz: 0, pace: 0.2, jacket: ['#a4d6ac', '#5c967c', '#40735f'] },
    { x: 73, z: 73.15, dx: 14, dz: 0, pace: 0.17, jacket: ['#c0b3f4', '#8277b5', '#675988'] },
    { x: 90.7, z: 72, dx: 0, dz: 13, pace: 0.23, jacket: ['#edd275', '#ad9356', '#8a7148'] },
  ];
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
  let footView = 0;
  let driveLook = 0;
  let lookPointer = null;
  let lookX = 0;
  let dragTouch = null;
  let walkCycle = 0;
  let walkBlend = 0;
  let bestSeconds = 0;
  try { bestSeconds = Number(window.localStorage?.getItem('harborGetawayBest')) || 0; } catch {}

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
    lookPointer = null;
    dragTouch = null;
  }

  function resetTraffic() {
    for (const vehicle of traffic) {
      const [[x, z], [nextX, nextZ]] = vehicle.route;
      Object.assign(vehicle, { x, z, next: 1, angle: Math.atan2(nextX - x, z - nextZ) });
    }
  }

  function updateTraffic(dt) {
    const active = inCar ? car : player;
    for (const vehicle of traffic) {
      const [x, z] = vehicle.route[vehicle.next];
      const remaining = Math.hypot(x - vehicle.x, z - vehicle.z);
      if (remaining < 0.001) {
        vehicle.next = (vehicle.next + 1) % vehicle.route.length;
        continue;
      }
      const dx = (x - vehicle.x) / remaining;
      const dz = (z - vehicle.z) / remaining;
      const turn = Math.atan2(dx, -dz) - vehicle.angle;
      vehicle.angle += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-12 * dt));
      const ahead = (active.x - vehicle.x) * dx + (active.z - vehicle.z) * dz;
      const beside = Math.abs((active.x - vehicle.x) * dz - (active.z - vehicle.z) * dx);
      if (ahead > -0.5 && ahead < 5 && beside < 1.8) continue;
      const travel = Math.min(remaining, vehicle.speed * dt);
      vehicle.x += dx * travel;
      vehicle.z += dz * travel;
    }
  }

  function reset() {
    Object.assign(player, { x: 12, z: 43, angle: 0 });
    Object.assign(car, { x: 12, z: 32, angle: 0, speed: 0 });
    Object.assign(patrol, { x: 40, z: 56, angle: 0 });
    Object.assign(camera, { x: player.x, z: player.z, angle: 0, distance: 11 });
    inCar = stolen = lost = false;
    elapsed = unseen = caught = rethink = 0;
    footView = driveLook = walkCycle = walkBlend = 0;
    path = [];
    resetTraffic();
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
    element('best').hidden = next !== 'finished' || bestSeconds <= 0;
    element('best').textContent = 'Best getaway · ' + bestSeconds + ' seconds left';
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
        dragTouch = null;
        footView = camera.angle;
        break;
      }
    } else if (distance(player, car) < 3.4) {
      if (!stolen) Object.assign(lastSeen, { x: car.x, z: car.z });
      driveLook = Math.atan2(Math.sin(camera.angle - car.angle), Math.cos(camera.angle - car.angle));
      dragTouch = null;
      pointers.clear();
      inCar = true;
      stolen = true;
    }
    updateHud();
  }

  function updateHud() {
    const seconds = Math.max(0, Math.ceil(180 - elapsed));
    element('clock').textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    const heat = element('heat');
    heat.textContent = lost ? 'CLEAR' : !stolen ? 'ON FOOT'
      : caught > 0 ? 'PATROL ON YOU' : unseen > 0 ? 'LOSING PATROL' : 'WANTED';
    heat.classList.toggle('danger', stolen && !lost && unseen === 0);
    heat.classList.toggle('clear', lost || unseen > 0);
    const meter = element('escape-progress');
    meter.hidden = !stolen || lost;
    meter.value = unseen;
    element('speed').hidden = !inCar;
    element('brake').hidden = !inCar;
    element('drive-hint').hidden = !inCar;
    element('run-hint').hidden = inCar;
    element('speed').textContent = Math.round(Math.abs(car.speed) * 3.6) + ' km/h';
    const target = inCar && lost ? garage : !inCar ? car : null;
    const range = target ? ' · ' + Math.ceil(distance(inCar ? car : player, target)) + ' m' : '';
    const objective = (!stolen ? 'Find the marked getaway car' : !inCar ? 'Get back in the getaway car'
      : lost ? 'Drive to the garage' : 'Use the alleys to lose the patrol') + range;
    if (element('objective').textContent !== objective) element('objective').textContent = objective;
    element('interact').disabled = phase !== 'playing'
      || (inCar ? Math.abs(car.speed) > 2 : distance(player, car) >= 3.4);
    element('interact').textContent = inCar ? 'Exit car' : 'Enter car';
  }

  function lookBy(radians) {
    if (inCar) driveLook = clamp(driveLook + radians, -Math.PI, Math.PI);
    else footView += radians;
  }

  function update(dt) {
    elapsed += dt;
    const horizontal = dragTouch ? dragTouch.dx : Number(held('right')) - Number(held('left'));
    const vertical = dragTouch ? dragTouch.dy : Number(held('down')) - Number(held('up'));
    const look = Number(held('lookRight')) - Number(held('lookLeft'));
    if (look) lookBy(look * 1.8 * dt);
    else if (inCar && lookPointer === null) driveLook *= Math.exp(-2.5 * dt);
    let walking = false;
    if (inCar) {
      const braking = held('brake');
      const steer = dragTouch
        ? Math.sign(horizontal) * clamp((Math.abs(horizontal) - 5) / 35, 0, 1)
        : horizontal;
      const throttle = dragTouch
        ? vertical > 17 ? 1 : Math.hypot(horizontal, vertical) > 8 ? -1 : 0
        : vertical;
      if (braking) car.speed *= Math.exp(-2.8 * dt);
      else if (throttle) {
        const acceleration = throttle > 0 && car.speed > 0 ? 24 : 13;
        const cornerSpeed = dragTouch ? 20 - 8 * Math.abs(steer) : 20;
        car.speed = throttle < 0 && car.speed > cornerSpeed
          ? Math.max(cornerSpeed, car.speed - 12 * dt)
          : clamp(car.speed - throttle * acceleration * dt, -7, throttle < 0 ? cornerSpeed : 20);
      } else car.speed *= Math.exp(-2.3 * dt);
      const steering = Math.min(1, Math.abs(car.speed) / 3);
      car.angle += steer * Math.sign(car.speed) * steering * (braking ? 3.15 : dragTouch ? 2.3 : 1.9) * dt;
      const direction = facing(car.angle);
      const previous = { x: car.x, z: car.z };
      if (move(car, direction.x * car.speed * dt, direction.z * car.speed * dt, 1.22)) car.speed *= 0.35;
      if (traffic.some(vehicle => distance(car, vehicle) < 2.25 && distance(car, vehicle) < distance(previous, vehicle))) {
        Object.assign(car, previous);
        car.speed *= 0.28;
      }
    } else if (dragTouch ? Math.hypot(horizontal, vertical) > 5 : horizontal || vertical) {
      const directionAngle = camera.angle + Math.atan2(horizontal, -vertical);
      const direction = facing(directionAngle);
      const turn = directionAngle - player.angle;
      player.angle += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-18 * dt));
      const oldX = player.x;
      const oldZ = player.z;
      const speed = dragTouch ? 7 * clamp((Math.hypot(horizontal, vertical) - 5) / 20, 0, 1) : 7;
      move(player, direction.x * speed * dt, direction.z * speed * dt, 0.45);
      walking = Math.hypot(player.x - oldX, player.z - oldZ) > dt;
    }
    updateTraffic(dt);
    if (walking) walkCycle += dt * 16;
    walkBlend += (Number(walking) - walkBlend) * (1 - Math.exp(-12 * dt));

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
      const remaining = Math.max(0, Math.ceil(180 - elapsed));
      const record = remaining > bestSeconds;
      if (record) {
        bestSeconds = remaining;
        try { window.localStorage?.setItem('harborGetawayBest', String(remaining)); } catch {}
      }
      overlay('finished', 'Clean getaway', (record ? 'New personal best. ' : '') +
        'You delivered the coupe with ' + remaining + ' seconds left.', 'Play again');
    } else if (caught >= 2 || elapsed >= 180) {
      overlay('finished', caught >= 2 ? 'Busted' : 'Time’s up', 'Try cutting through a different block to break line of sight.', 'Try again');
    }

    const smoothing = 1 - Math.exp(-8 * dt);
    camera.x += (active.x - camera.x) * smoothing;
    camera.z += (active.z - camera.z) * smoothing;
    const turn = (inCar ? car.angle + driveLook : footView) - camera.angle;
    camera.angle += Math.atan2(Math.sin(turn), Math.cos(turn)) * smoothing;
    const forward = facing(camera.angle);
    const targetDistance = inCar ? 8.8 + Math.abs(car.speed) * 0.11 : 11;
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

  const roofs = ['#8d8e86', '#8c9292', '#969086', '#86928c'];
  const walls = ['#a09d8d', '#909a9c', '#a79e90', '#a0a697'];
  const darkWalls = ['#777973', '#69767a', '#807a74', '#737f76'];
  const lamps = roads.flatMap(x => roads.map(z => ({ x: x + 5.2, z: z + 5.2 })));
  const trees = Array.from({ length: 18 }, (_, i) => ({
    x: i < 9 ? 17.45 : 102.05,
    z: 4.5 + (i % 9) * 11.9,
    height: 3.2 + (i * 13 % 8) * 0.24,
    spread: 1.35 + (i * 5 % 7) * 0.13,
  })).filter(tree => !roads.some(road => Math.abs(road - tree.z) < 5.6)
    && !(tree.x > 100 && Math.abs(tree.z - garage.z) < 9));
  const roadWear = roads.flatMap((road, column) => Array.from({ length: 31 }, (_, i) => ({
    road,
    along: 1.5 + i * 3.4,
    across: ((i * 19 + column * 11) % 53 - 26) / 7,
    length: 0.35 + (i * 11 % 17) / 10,
    shade: i % 3 ? '#20263018' : '#d7ddde19',
  })));
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

  function box(x, z, w, d, h, angle, colors, base = 0, taper = 1) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const point = (dx, y, dz) => [x + dx * cosine - dz * sine, y + base, z + dx * sine + dz * cosine];
    const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
    const top = corners.map(([dx, dz]) => point(dx * taper, h, dz * taper));
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
    const center = cameraPoint([x, 0, z]);
    if (center[2] < 2.5) return;
    const [px, py] = project(center);
    const spread = radius * focal / center[2];
    const depthSpread = spread * clamp(eye.y / center[2], 0.08, 0.84);
    if (px + spread < 0 || px - spread > width || py + depthSpread < 0 || py - depthSpread > height) return;
    context.save();
    context.translate(px, py);
    context.scale(spread, depthSpread);
    const light = context.createRadialGradient(0, 0, 0, 0, 0, 1);
    light.addColorStop(0, color);
    light.addColorStop(1, color.slice(0, 7) + '00');
    context.fillStyle = light;
    context.fillRect(-1, -1, 2, 2);
    context.restore();
  }

  function drawCar(actor, police) {
    const paint = actor.paint ?? (police ? ['#e3eaf7', '#536783', '#33465f'] : ['#365957', '#243d3d', '#1c3033']);
    const rubber = ['#263145', '#101723', '#161e2b'];
    const front = facing(actor.angle);
    const side = facing(actor.angle + Math.PI / 2);
    const part = (across, ahead, w, d, h, base, colors, taper = 1) => box(
      actor.x + across * side.x + ahead * front.x, actor.z + across * side.z + ahead * front.z,
      w, d, h, actor.angle, colors, base, taper,
    );
    for (const sign of [-1, 1]) {
      part(sign * 1.02, -1.15, 0.33, 0.68, 0.62, 0.03, rubber);
      part(sign * 1.02, 1.12, 0.33, 0.68, 0.62, 0.03, rubber);
    }
    part(0, 0, 2.12, 3.64, 0.43, 0.27, paint);
    part(0, 0.09, 1.99, 3.34, 0.22, 0.70, paint);
    part(0, 0.05, 1.76, 2.02, 0.48, 0.92, ['#77919b', '#4c6874', '#3a505a'], 0.73);
    part(0, 0.05, 1.29, 1.47, 0.09, 1.40, paint, 0.92);
    if (!police && !actor.paint) part(0, -1.78, 1.94, 0.08, 0.065, 0.78, ['#a9e4ca', '#83bdab', '#618f87']);
    part(0, -1.81, 2.07, 0.16, 0.17, 0.28, ['#657489', '#344256', '#414e64']);
    part(0, -1.89, 0.39, 0.035, 0.14, 0.48, ['#ccdbe9', '#a9bed4', '#a9bed4']);
    for (const sign of [-1, 1]) {
      part(sign * 0.75, -1.83, 0.47, 0.1, 0.13, 0.62, ['#ff9b85', '#ff5d69', '#dc4058']);
      part(sign * 0.75, 1.84, 0.44, 0.08, 0.13, 0.58, ['#e0f8ff', '#b8efff', '#8bc9fa']);
    }
    if (police) {
      const flash = elapsed % 0.55 < 0.275;
      part(-0.39, 0.05, 0.66, 0.32, 0.16, 1.49, flash ? ['#ff9bae', '#f54365', '#a42541'] : ['#80435e', '#602b44', '#602b44']);
      part(0.39, 0.05, 0.66, 0.32, 0.16, 1.49, flash ? ['#416c99', '#334f7e', '#334f7e'] : ['#afe7ff', '#69baff', '#345fae']);
    }
  }

  function drawBuilding(b) {
    const x = b.x + b.w / 2;
    const z = b.z + b.d / 2;
    box(x, z, b.w, b.d, b.h, 0, [roofs[b.shade], walls[b.shade], darkWalls[b.shade]]);
    if (Math.hypot(x - eye.x, z - eye.z) > 47) return;
    if (b.shade % 2 === 0) {
      const strip = b.shade === 0 ? ['#e9a6d4', '#b6609b', '#7b4b81'] : ['#94efee', '#489ab0', '#326d83'];
      box(x, b.z + b.d + 0.06, b.w * 0.48, 0.15, 0.23, 0, strip, 1.55);
      box(x, b.z - 0.06, b.w * 0.48, 0.15, 0.23, 0, strip, 1.55);
    }
    box(x, z, b.w + 0.22, b.d + 0.22, 0.24, 0, ['#647184', '#4c5268', '#3a435b'], b.h - 0.08);
    box(x + 1.1, z - 0.55, 2.3, 1.7, 0.85, 0, ['#71849a', '#4d5b73', '#36465c'], b.h + 0.15);
    const frontZ = eye.z >= z ? b.z + b.d + 0.025 : b.z - 0.025;
    const sideX = eye.x >= x ? b.x + b.w + 0.025 : b.x - 0.025;
    for (let level = 2.1; level < b.h - 1.25; level += 2.1) {
      for (let i = 1.4; i < b.w - 1; i += 2.05) {
        const left = b.x + i;
        const color = Math.floor(i + level + b.x) % 3 ? '#4e5d60' : '#728289';
        polygon([[left, level, frontZ], [left + 0.86, level, frontZ],
          [left + 0.86, level + 0.9, frontZ], [left, level + 0.9, frontZ]], color);
      }
      for (let i = 1; i < b.d - 0.8; i += 1.65) {
        const near = b.z + i;
        polygon([[sideX, level, near], [sideX, level, near + 0.7],
          [sideX, level + 0.85, near + 0.7], [sideX, level + 0.85, near]], '#596a6e');
      }
    }
  }

  function drawTree(tree) {
    const { x, z, height: h, spread: r } = tree;
    box(x, z, 0.22, 0.24, h * 0.7, 0, ['#62594a', '#685847', '#4e493e']);
    const leaves = ['#65794e', '#526a45', '#6c8052', '#485f42', '#798656', '#586d4a', '#697b50'];
    function crown(cx, cy, cz, radius, tint) {
      const peak = [cx + radius * 0.12, cy + radius * 0.8, cz - radius * 0.05];
      const rim = Array.from({ length: 7 }, (_, i) => {
        const angle = i / 7 * Math.PI * 2;
        const span = radius * (0.84 + (i * 13 % 7) * 0.045);
        return [cx + Math.cos(angle) * span, cy - 0.18 + (i % 3) * 0.16, cz + Math.sin(angle) * span];
      });
      const base = [cx - 0.1, cy - radius * 0.69, cz];
      for (let i = 0; i < rim.length; i += 1) {
        const next = rim[(i + 1) % rim.length];
        polygon([peak, rim[i], next], leaves[(i + tint) % leaves.length]);
        polygon([base, next, rim[i]], leaves[(i + tint + 3) % leaves.length]);
      }
    }
    crown(x - r * 0.48, h - 0.18, z + r * 0.18, r * 0.7, 2);
    crown(x + r * 0.48, h + 0.13, z + r * 0.12, r * 0.73, 4);
    crown(x, h + 0.55, z - r * 0.3, r * 0.8, 0);
  }

  function drawViaduct() {
    if (camera.x > 55) return;
    for (let z = 3; z < size; z += 12) {
      if (Math.abs(z - camera.z) > 56) continue;
      box(5.7, z + 5.95, 5.7, 12.1, 0.57, 0, ['#777d81', '#636a70', '#515962'], 5.6);
      for (const x of [3.6, 7.8]) {
        box(x, z + 5.95, 0.24, 12.1, 0.48, 0, ['#b3b6ac', '#949990', '#757c79'], 6.16);
      }
      box(4.4, z, 0.85, 1.12, 5.65, 0, ['#8e958b', '#8b928a', '#6d7776']);
      box(5.5, z, 3.7, 1.35, 0.42, 0, ['#9ba297', '#868e89', '#6e7777'], 5.22);
    }
  }

  function drawDocks() {
    if (camera.x < 48) return;
    box(110, 91, 8, 12, 4.4, 0, ['#415b73', '#263d55', '#30445d']);
    box(105.94, 91, 0.08, 7.5, 3.55, 0,
      lost ? ['#ffd68c', '#cb944c', '#edb866'] : ['#70859b', '#364c65', '#415a73']);
    box(105.85, 91, 0.16, 8.4, 0.28, 0,
      lost ? ['#fff1b6', '#ffcc72', '#ffdf8c'] : ['#7099a9', '#385c70', '#51788c'], 3.68);
    for (let i = 0; i < 6; i += 1) {
      box(111 + (i % 2) * 3.2, 29 + i * 7.4, 2.8, 6.1, 2.8, 0,
        i % 2 ? ['#aa715a', '#814d49', '#643941'] : ['#5d8c99', '#416d80', '#315365']);
    }
    for (const z of [34, 66]) {
      box(120, z, 1.1, 1.2, 13, 0, ['#ccaa84', '#967e69', '#675f66']);
      box(115, z, 11, 1.05, 0.8, 0, ['#c39d76', '#987657', '#695263'], 12.1);
      box(110, z, 0.16, 0.16, 4, 0, ['#9aa7bb', '#586479', '#475163'], 8.2);
    }
  }

  function pin(actor, y, color, label) {
    const point = cameraPoint([actor.x, y, actor.z]);
    const onScreen = point[2] > 1 && Math.abs(point[0]) * focal / point[2] < width * 0.5 - 25;
    const [x, screenY] = onScreen ? project(point) : [
      point[0] < 0 ? 22 : width - 22,
      height * 0.53,
    ];
    const px = clamp(x, 22, width - 22);
    const py = clamp(screenY, Math.min(106, height * 0.39), height - 45);
    fill([[px, py - 17], [px + 13, py - 4], [px, py + 9], [px - 13, py - 4]], '#10192a');
    fill([[px, py - 13], [px + 9, py - 4], [px, py + 5], [px - 9, py - 4]], color);
    const textX = clamp(px, 46, width - 46);
    context.font = '700 10px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillStyle = '#10192a';
    context.fillRect(textX - 37, py - 35, 74, 15);
    context.fillStyle = color;
    context.fillText(label, textX, py - 24);
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
    context.fillStyle = '#263a50';
    for (const road of roads) {
      context.fillRect(x + (road - 3) * scale, y, 6 * scale, mapSize);
      context.fillRect(x, y + (road - 3) * scale, mapSize, 6 * scale);
    }
    const dots = [];
    if (!inCar) dots.push([car, '#79f1c6']);
    if (stolen && !lost) dots.push([patrol, '#ff6179']);
    if (lost) dots.push([garage, '#ffd373']);
    for (const [point, color] of dots) {
      context.beginPath();
      context.fillStyle = color;
      context.arc(x + point.x * scale, y + point.z * scale, 3, 0, Math.PI * 2);
      context.fill();
    }
    const ax = x + active.x * scale;
    const ay = y + active.z * scale;
    const direction = facing(active.angle);
    fill([[ax + direction.x * 6, ay + direction.z * 6],
      [ax - direction.x * 4 - direction.z * 3.5, ay - direction.z * 4 + direction.x * 3.5],
      [ax - direction.x * 4 + direction.z * 3.5, ay - direction.z * 4 - direction.x * 3.5]], '#f3fbff');
  }

  function drawPerson(player, stride, jacket) {
    const forward = facing(player.angle);
    const side = facing(player.angle + Math.PI / 2);
    for (const sign of [-1, 1]) {
      box(player.x + sign * (side.x * 0.16 + forward.x * stride),
        player.z + sign * (side.z * 0.16 + forward.z * stride),
        0.23, 0.31, 0.59, player.angle, ['#8396ad', '#4a617d', '#364b63']);
      box(player.x + sign * (side.x * 0.39 - forward.x * stride * 0.75),
        player.z + sign * (side.z * 0.39 - forward.z * stride * 0.75),
        0.17, 0.23, 0.48, player.angle, ['#f2be92', '#c58764', '#aa6e56'], 0.69);
    }
    box(player.x, player.z, 0.61, 0.42, 0.61, player.angle, jacket, 0.59);
    box(player.x, player.z, 0.43, 0.4, 0.4, player.angle, ['#ffe2b6', '#d99e76', '#aa6e56'], 1.2);
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
    focal = Math.min(width * (inCar ? 0.97 : 0.88), height * 0.95);
    eye.cosine = Math.cos(camera.angle);
    eye.sine = Math.sin(camera.angle);
    eye.x = camera.x - eye.sine * camera.distance;
    eye.z = camera.z + eye.cosine * camera.distance;
    eye.y = Math.min(5, 2.6 + camera.distance * 0.19);
    const pitch = Math.atan2(eye.y - (inCar ? 2.05 : 1.5), camera.distance + 1);
    eye.pitchCosine = Math.cos(pitch);
    eye.pitchSine = Math.sin(pitch);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#879fbb');
    sky.addColorStop(0.36, '#b9c6cf');
    sky.addColorStop(0.66, '#d3d5cd');
    sky.addColorStop(1, '#9dadaf');
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);
    const horizon = height * 0.51 - focal * Math.tan(pitch);
    for (let i = 0; i < 4; i += 1) {
      const x = ((i * 137 - camera.angle * 41) % (width + 150) + width + 150) % (width + 150) - 75;
      context.save();
      context.translate(x, 24 + (i * 31 % 56));
      context.scale(73 + i * 9, 9 + i * 3);
      const cloud = context.createRadialGradient(0, 0, 0, 0, 0, 1);
      cloud.addColorStop(0, '#e8ebed76');
      cloud.addColorStop(1, '#e8ebed00');
      context.fillStyle = cloud;
      context.fillRect(-1, -1, 2, 2);
      context.restore();
    }
    flat(-140, -140, 390, 390, '#65818a');
    for (let i = 0; i < 24; i += 1) {
      const w = width / 14;
      const x = ((i * w * 0.67 - camera.angle * 49) % (width + w) + width + w) % (width + w) - w;
      const h = 8 + (i * 31) % 33;
      context.fillStyle = i % 2 ? '#89969a' : '#929da1';
      context.fillRect(x, horizon - h + 7, w * 0.61, h);
      context.fillStyle = '#a9b2b199';
      context.fillRect(x + w * 0.15, horizon - h + 11, 2, 3);
    }
    flat(0, 0, size, size, '#7d8178');
    flat(0, 0, 6.4, size, '#6c7b52');
    flat(17.2, 0, 1.7, size, '#758352');
    flat(101.2, 0, 6.8, size, '#697c54');
    for (const road of roads) {
      flat(road - 5.15, 0, 10.3, size, '#a3a49a');
      flat(0, road - 5.15, size, 10.3, '#a3a49a');
    }
    for (const road of roads) {
      flat(road - 4.6, 0, 9.2, size, '#676a6b');
      flat(0, road - 4.6, size, 9.2, '#676a6b');
      for (let offset = 2; offset < size - 2; offset += 5) {
        if (roads.some(cross => Math.abs(cross - offset) < 5)) continue;
        flat(road - 0.09, offset, 0.18, 2.1, '#b9b4a0');
        flat(offset, road - 0.09, 2.1, 0.18, '#b9b4a0');
      }
    }
    for (const road of roads) {
      for (const cross of roads) {
        if (Math.hypot(road - camera.x, cross - camera.z) > 45) continue;
        for (let stripe = -3.6; stripe < 4; stripe += 1.05) {
          flat(road + stripe, cross - 5.5, 0.42, 1, '#b8b7ad');
          flat(road + 4.9, cross + stripe, 1, 0.42, '#b8b7ad');
        }
      }
    }
    for (const mark of roadWear) {
      if (Math.abs(mark.road - camera.x) < 35 && Math.abs(mark.along - camera.z) < 43) {
        flat(mark.road + mark.across, mark.along, 0.12, mark.length, mark.shade);
        if (mark.length > 1.55) flat(mark.road + mark.across, mark.along, 0.67, mark.length * 0.84, '#3f464627');
      }
      if (Math.abs(mark.road - camera.z) < 35 && Math.abs(mark.along - camera.x) < 43) {
        flat(mark.along, mark.road + mark.across, mark.length, 0.12, mark.shade);
        if (mark.length > 1.55) flat(mark.along, mark.road + mark.across, mark.length * 0.84, 0.67, '#3f464627');
      }
    }
    for (const tree of trees) {
      if (distance(tree, camera) < 48) groundGlow(tree.x + 0.7, tree.z + 0.8, tree.spread * 1.7, '#26322863');
    }
    flat(garage.x - 3.5, garage.z - 3.5, 7, 7, lost ? '#a78248' : '#455165');
    if (lost) {
      for (let i = -3; i <= 3; i += 1) flat(garage.x + i, garage.z - 3.45, 0.43, 0.63, '#ffe0a0');
      groundGlow(garage.x, garage.z, 5.3, '#ffc27270');
    }
    const nearbyLamps = lamps.filter(lamp => distance(lamp, camera) < 52);

    const front = facing(car.angle);
    groundGlow(car.x, car.z, 1.7, '#0b112659');
    if (!inCar) groundGlow(player.x, player.z, 0.65, '#0b112650');
    if (stolen && !lost) groundGlow(patrol.x, patrol.z, 4.2, elapsed % 0.55 < 0.275 ? '#ff54756d' : '#619cff6d');
    groundGlow(car.x - front.x * 2.4, car.z - front.z * 2.4, 2.8, '#ff45582b');
    if (inCar) groundGlow(car.x + front.x * 4.2, car.z + front.z * 4.2, 3.7, '#e3f3ff1e');
    faces = [];
    for (const lamp of nearbyLamps) {
      box(lamp.x, lamp.z, 0.18, 0.18, 4.6, 0, ['#576981', '#3d5064', '#293f54']);
      box(lamp.x, lamp.z, 0.6, 0.45, 0.18, 0, ['#ffd795', '#ffca7a', '#d49753'], 4.55);
    }
    for (const b of blocks) drawBuilding(b);
    drawViaduct();
    for (const tree of trees) if (distance(tree, camera) < 48) drawTree(tree);
    drawDocks();
    drawCar(car, false);
    drawCar(patrol, true);
    for (const vehicle of traffic) if (distance(vehicle, camera) < 48) drawCar(vehicle, false);
    for (const worker of workers) {
      const cycle = elapsed * worker.pace;
      const progress = (1 - Math.cos(cycle)) / 2;
      const walker = { x: worker.x + worker.dx * progress, z: worker.z + worker.dz * progress,
        angle: Math.atan2(worker.dx, -worker.dz) + (Math.sin(cycle) < 0 ? Math.PI : 0) };
      if (distance(walker, camera) < 36) drawPerson(walker, Math.sin(elapsed * 11) * 0.18, worker.jacket);
    }
    if (!inCar) drawPerson(player, Math.sin(walkCycle) * 0.27 * walkBlend, ['#f1bd71', '#ce694a', '#9d493f']);
    faces.sort((a, b) => b.depth - a.depth);
    for (const face of faces) fill(face.points, face.color);
    if (!stolen || !inCar) pin(car, 3.8, '#79f1c6', 'GETAWAY CAR');
    if (lost) pin(garage, 4, '#ffd373', 'GARAGE');
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
    if (action && phase === 'playing' && !(action === 'brake' && (!inCar || event.target?.closest?.('button, a')))) {
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
  canvas.addEventListener('touchstart', event => {
    if (phase !== 'playing') return;
    event.preventDefault();
    if (dragTouch) return;
    const touch = event.changedTouches[0];
    pointers.clear();
    dragTouch = { id: touch.identifier, x: touch.clientX, y: touch.clientY, dx: 0, dy: 0 };
  }, { passive: false });
  canvas.addEventListener('touchmove', event => {
    if (!dragTouch) return;
    event.preventDefault();
    const touch = Array.from(event.changedTouches).find(item => item.identifier === dragTouch.id);
    if (!touch) return;
    dragTouch.dx = touch.clientX - dragTouch.x;
    dragTouch.dy = touch.clientY - dragTouch.y;
  }, { passive: false });
  function endTouch(event) {
    if (dragTouch && Array.from(event.changedTouches).some(touch => touch.identifier === dragTouch.id)) dragTouch = null;
    if (event.touches.length === 0) {
      pointers.clear();
      lookPointer = null;
      dragTouch = null;
    }
  }
  for (const type of ['touchend', 'touchcancel']) document.addEventListener(type, endTouch, true);

  function clearPointer(event) {
    pointers.delete(event.pointerId);
    if (event.pointerId === lookPointer) lookPointer = null;
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    document.addEventListener(type, clearPointer, true);
  }
  document.addEventListener('contextmenu', event => {
    if (!event.target.closest('.stage, .controls')) return;
    event.preventDefault();
    clearControls();
  });
  canvas.addEventListener('pointerdown', event => {
    if (phase !== 'playing' || lookPointer !== null || event.button !== 0
      || event.pointerType === 'touch') return;
    canvas.setPointerCapture?.(event.pointerId);
    lookPointer = event.pointerId;
    lookX = event.clientX;
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== lookPointer) return;
    lookBy((lookX - event.clientX) * 0.009);
    lookX = event.clientX;
  });
  document.querySelectorAll('[data-key]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      if (phase !== 'playing' || event.button !== 0) return;
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      pointers.set(event.pointerId, button.dataset.key);
    });
  });
  element('start').addEventListener('click', () => phase === 'paused' ? run() : reset());
  element('interact').addEventListener('click', interact);
  element('pause').addEventListener('click', pause);
  element('pause').disabled = true;
  resetTraffic();
  updateHud();
  requestAnimationFrame(frame);
})();
