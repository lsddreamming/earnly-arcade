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

  const size = 340;
  const roads = Array.from({ length: 12 }, (_, i) => 12 + i * 28);
  const garage = { x: 96, z: 91 };
  const blocks = [];
  const sectors = new Map();
  const parks = [];
  for (let row = 0; row < roads.length - 1; row += 1) {
    for (let column = 0; column < roads.length - 1; column += 1) {
      const x = roads[column];
      const z = roads[row];
      const original = row < 3 && column < 3;
      const shade = (row * 3 + column) % 4;
      if (!original && (row * 7 + column * 3) % 8 === 0) {
        parks.push({ x: x + 14, z: z + 14 });
        continue;
      }
      const tall = !original && column >= 4 && column < 8 ? 3 + (row + column) % 4 : 0;
      const first = { x: x + 9, z: z + 7, w: 11, d: 6, h: 6 + shade * 1.1 + tall, shade };
      if (original) first.storefront = row * 3 + column;
      const second = { x: x + 7, z: z + 17, w: 13, d: 5, h: 5 + shade + tall, shade: (shade + 2) % 4 };
      sectors.set(row * roads.length + column, [first, second]);
      blocks.push(first, second);
    }
  }

  const keys = new Set();
  const pointers = new Map();
  const firePointers = new Set();
  const bindings = {
    ShiftLeft: 'sprint', ShiftRight: 'sprint', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    KeyQ: 'lookLeft', KeyR: 'lookRight', Space: 'brake',
  };
  const player = { x: 12, z: 43, angle: 0 };
  const models = {
    coupe: { name: 'Coupe', top: 20, acceleration: 13 },
    muscle: { name: 'Muscle', top: 23, acceleration: 16, paint: ['#9e5350', '#6e393d', '#542b32'] },
    van: { name: 'Cargo van', top: 16.5, acceleration: 10, paint: ['#ad9b76', '#88775b', '#69604f'] },
  };
  const checkpoint = (x, z, label) => ({ kind: 'drive', x, z, label });
  const stop = (x, z, label) => ({ kind: 'park', x, z, label });
  const escape = { kind: 'escape', label: 'Break patrol line of sight' };
  const drill = (x, z, label) => ({ kind: 'shoot', x, z, label });
  const finish = stop(garage.x, garage.z, 'Park at the garage');
  const jobs = [
    { name: 'Coastal Run', time: 120, heat: 1, model: 'coupe', stages: [checkpoint(12,12,'Pass the west checkpoint'),checkpoint(68,12,'Cross the waterfront'),escape,finish] },
    { name: 'Dock Dispatch', time: 95, heat: 0, model: 'van', stages: [stop(40,40,'Stop for the manifest'),stop(68,68,'Deliver the manifest')] },
    { name: 'Signal Check', time: 130, heat: 1, model: 'coupe', stages: [drill(12,28,'Shoot the first signal target'),drill(12,19,'Shoot the second signal target'),escape,finish] },
    { name: 'Industrial Mile', time: 115, heat: 2, model: 'muscle', stages: [checkpoint(40,40,'Pass the depot'),checkpoint(40,68,'Cross the loading yard'),checkpoint(68,68,'Reach the east junction'),escape,finish] },
    { name: 'Parts Run', time: 100, heat: 0, model: 'van', stages: [stop(12,12,'Collect the spare parts'),stop(40,12,'Make the first delivery'),stop(96,40,'Make the final delivery')] },
    { name: 'Under the Tracks', time: 140, heat: 2, model: 'muscle', stages: [checkpoint(12,68,'Head under the tracks'),checkpoint(12,96,'Pass the south crossing'),checkpoint(68,96,'Reach the dock road'),escape,finish] },
    { name: 'Cut the Feed', time: 170, heat: 2, model: 'coupe', stages: [drill(12,28,'Take out the first relay'),checkpoint(40,40,'Reach the second relay'),drill(40,30,'Take out the depot relay'),escape,finish] },
    { name: 'Breakwater Express', time: 95, heat: 2, model: 'muscle', stages: [checkpoint(12,12,'Reach the north road'),checkpoint(96,12,'Cross the breakwater'),checkpoint(96,68,'Reach the docks'),escape,finish] },
    { name: 'Heavy Haul', time: 165, heat: 2, model: 'van', stages: [stop(40,40,'Load the first crate'),stop(68,40,'Load the second crate'),checkpoint(96,40,'Take the east road'),escape,finish] },
    { name: 'Three Alarms', time: 180, heat: 3, model: 'muscle', stages: [drill(12,28,'Disable the west alarm'),checkpoint(40,40,'Reach the depot'),drill(40,30,'Disable the depot alarm'),checkpoint(68,40,'Reach the east gate'),drill(68,31,'Disable the gate alarm'),escape,finish] },
    { name: 'Harbor Lockdown', time: 150, heat: 3, model: 'muscle', stages: [checkpoint(12,96,'Reach the south road'),checkpoint(40,96,'Pass the rail yard'),checkpoint(68,68,'Cross the depot'),checkpoint(68,12,'Take the north road'),escape,finish] },
    { name: 'The Last Crossing', time: 185, heat: 3, model: 'coupe', stages: [stop(40,40,'Pick up the final cargo'),checkpoint(68,40,'Pass the east junction'),checkpoint(96,12,'Cross the breakwater'),checkpoint(96,68,'Return through the port'),escape,finish] },
  ];
  const missionBriefings = [
    ['First getaway','Take the coupe along the waterfront, lose the patrol, then bring it home.','Keep moving through both checkpoints before trying to lose the patrol.'],
    ['Manifest delivery','Collect a shipping manifest and deliver it across town without a scheduled chase.','Brake before each delivery marker; passing through at speed does not count.'],
    ['Signal training','Find two roadside signal targets, fire on foot, then escape in your coupe.','Exit the car and face each target before firing.'],
    ['Industrial pursuit','Drive the muscle car from the depot to South Industrial while police close in.','Use the long boulevards for speed and side streets to break sight.'],
    ['Workshop courier','Collect parts, visit the central workshop, then deliver to East Docks.','Plan for three separate stops and slow down early in the van.'],
    ['Rail corridor escape','Follow West Rail south, cross the district, then hide before the depot handoff.','Stay on the west corridor until the route sends you east.'],
    ['Relay shutdown','Disable the west relay, drive to the depot relay, and shut it down before escaping.','This job alternates on-foot shooting and driving; watch the next objective.'],
    ['Waterfront express','Cross the northern waterfront and follow the eastern shore to a dock handoff.','The long straight is fast, but brake before the turn down East Docks.'],
    ['Cargo under pressure','Load two shipments and take the cargo van to the southeast industrial depot.','The loaded van turns slowly; choose wider streets during the chase.'],
    ['Three-district shutdown','Disable alarms in the west, center, and south, then reach the eastern safehouse.','Stop near each alarm, exit, and shoot before continuing across town.'],
    ['Citywide lockdown','Cross the southwest and southern districts, drive north through East Docks, and disappear.','Three-star patrols require distance and cover; a straight sprint may not lose them.'],
    ['Final harbor circuit','Collect the final cargo and complete a north-east-south circuit before returning to the garage.','Save time on the long crossings, then lose the patrol before the final stop.']
  ];
  jobs.forEach((job,i)=>{ [job.tagline,job.briefing,job.tip]=missionBriefings[i]; });
  // Later jobs graduate from the starter neighborhood to the whole district.
  const expandedRoutes = {
    'Dock Dispatch': [stop(40,68,'Collect the manifest'),stop(152,152,'Deliver to Central City')],
    'Industrial Mile': [checkpoint(96,96,'Cross the depot'),checkpoint(208,96,'Take the eastern boulevard'),checkpoint(208,264,'Reach South Industrial'),escape,stop(292,264,'Park at the industrial drop-off')],
    'Parts Run': [stop(40,12,'Collect spare parts'),stop(152,68,'Deliver to the central workshop'),stop(292,152,'Deliver to East Docks')],
    'Under the Tracks': [checkpoint(12,152,'Follow West Rail'),checkpoint(12,292,'Reach the south rail yard'),checkpoint(152,292,'Cross the southern district'),escape,stop(208,292,'Park at the south depot')],
    'Breakwater Express': [checkpoint(12,12,'Join the waterfront road'),checkpoint(320,12,'Cross the northern waterfront'),checkpoint(320,208,'Follow East Docks'),escape,stop(292,236,'Park at the dock handoff')],
    'Heavy Haul': [stop(68,68,'Load the first crate'),stop(180,152,'Load central cargo'),checkpoint(292,152,'Take the eastern boulevard'),escape,stop(292,292,'Unload in South Industrial')],
    'Three Alarms': [drill(12,28,'Disable the west alarm'),checkpoint(152,152,'Reach Central City'),drill(152,142,'Disable the central alarm'),checkpoint(292,264,'Reach the southern relay'),drill(292,254,'Disable the southern alarm'),escape,stop(320,292,'Park at the east safehouse')],
    'Harbor Lockdown': [checkpoint(12,292,'Reach the southwest corner'),checkpoint(292,292,'Cross the southern district'),checkpoint(292,40,'Head north through East Docks'),escape,stop(152,40,'Park at the northern safehouse')],
    'The Last Crossing': [stop(40,40,'Collect the final cargo'),checkpoint(320,40,'Cross the northern district'),checkpoint(320,320,'Follow the eastern shoreline'),checkpoint(40,320,'Cross the southern harbor'),escape,finish]
  };
  for(const job of jobs) if(expandedRoutes[job.name]) {
    job.stages=expandedRoutes[job.name];
    job.time=Math.max(job.time,job.name==='The Last Crossing'?360:300);
  }
  const spawn = (model, x, z, angle = 0) => ({ ...models[model], x, z, angle, speed: 0 });
  let car = spawn('coupe', 12, 32);
  let vehicles = [car];
  const patrol = { x: 40, z: 56, angle: 0 };
  const backup = { x: 68, z: 40, angle: 0 };
  const displacedDrivers = [];
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
  for (const [column, row] of [[4,1],[8,1],[2,5],[6,5],[9,5],[1,9],[5,9],[9,9]]) {
    const x = roads[column];
    const z = roads[row];
    traffic.push({ route: [[x + 2.2,z + 2.2],[x + 2.2,z + 25.8],[x + 25.8,z + 25.8],[x + 25.8,z + 2.2]],
      speed: 4.8 + (row + column) % 4 * 0.55,
      paint: traffic[(row + column) % 3].paint });
    workers.push({ x: x + 5.35, z: z + 7, dx: 0, dz: 15, pace: 0.17,
      jacket: workers[(row + column) % 4].jacket });
  }
  for (const worker of [...workers]) {
    for (let i = 1; i <= 3; i++) workers.push({ ...worker,
      x: worker.x + (worker.dx ? 0 : (i % 2 ? 0.45 : -0.45)),
      z: worker.z + (worker.dz ? 0 : (i % 2 ? 0.45 : -0.45)),
      pace: worker.pace * (0.82 + i * 0.12), phaseOffset: i * 1.7,
      jacket: workers[i % 4].jacket });
  }
  const camera = { x: player.x, z: player.z, angle: 0, distance: 11 };
  let phase = 'ready';
  let inCar = false;
  let stolen = false;
  let lost = false;
  let elapsed = 0;
  let unseen = 0;
  let caught = 0;
  let activeJob = jobs[0];
  let selectedJob = 0;
  let stageIndex = 0;
  let heatLevel = 0;
  const weapons = [
    {name:'Pistol',damage:50,delay:0.28,range:22},
    {name:'SMG',damage:25,delay:0.12,range:26},
    {name:'Heavy rifle',damage:85,delay:0.55,range:38}
  ];
  let weaponIndex = 0;
  const ownedWeapons = new Set([0]);
  let shotAt = -10;
  let shotConnected = false;
  const weaponPickups = [{x:17,z:40,type:1},{x:40,z:60,type:2},{x:152,z:180,type:2},{x:292,z:264,type:1}];
  let shotFlash = 0;
  let shotTarget = null;
  let won = false;
  let feedbackUntil = 0;
  let audio;
  let soundEnabled = true;
  try { soundEnabled = window.localStorage?.getItem('harborSound') !== 'off'; } catch {}
  let records = {};
  const storageKey = 'harborCampaignV1';
  try {
    const saved = JSON.parse(window.localStorage?.getItem(storageKey) || '{}');
    for (const job of jobs) {
      const time = saved?.[job.name];
      if (Number.isInteger(time) && time > 0 && time <= job.time * 1000) records[job.name] = time;
    }
  } catch {}
  let lastTime = 0;
  let footView = 0;
  let footHeading = null;
  let driveLook = 0;
  let lookPointer = null;
  let lookX = 0;
  let lookY = 0;
  let lookTouch = null;
  let cameraMode = false;
  let manualLookUntil = 0;
  let cameraLift = 0;
  let dragTouch = null;
  let walkCycle = 0;
  let walkBlend = 0;
  let runEnabled = false;
  let footSpeed = 0;
  let actualFootSpeed = 0;
  let visualSpeed = 0;
  let turnLean = 0;
  const stats = { build: 0, muscle: 0.5, endurance: 0.5 };
  try { const saved = JSON.parse(window.localStorage?.getItem('harborFitnessV1') || '{}');
    for (const key of Object.keys(stats)) if (Number.isFinite(saved[key])) stats[key] = Math.max(0,Math.min(1,saved[key]));
  } catch {}
  let stamina = 100, exhausted = false, fitnessSave = 0;
  const footPlants = [null,null];
  function saveFitness() { try { window.localStorage?.setItem('harborFitnessV1',JSON.stringify(stats)); } catch {} }



  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const facing = angle => ({ x: Math.sin(angle), z: -Math.cos(angle) });
  const held = action => keys.has(action) || [...pointers.values()].includes(action);

  function sectorAt(x, z) {
    const column = Math.floor((x - 12) / 28);
    const row = Math.floor((z - 12) / 28);
    if (column < 0 || row < 0 || column >= roads.length - 1 || row >= roads.length - 1) return null;
    return sectors.get(row * roads.length + column);
  }

  function blocked(x, z, radius) {
    if (x < radius + 2 || x > size - radius - 2 || z < radius + 2 || z > size - radius - 2) return true;
    return sectorAt(x, z)?.some(b => x + radius > b.x && x - radius < b.x + b.w
      && z + radius > b.z && z - radius < b.z + b.d) ?? false;
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
    const minX = Math.min(from.x, to.x) - 32;
    const maxX = Math.max(from.x, to.x) + 32;
    const minZ = Math.min(from.z, to.z) - 32;
    const maxZ = Math.max(from.z, to.z) + 32;
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
        if (p.x < minX || p.x > maxX || p.z < minZ || p.z > maxZ || blocked(p.x, p.z, 1.25)) continue;
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

  function vehicleGap(first, second) {
    const a = facing(first.angle);
    const b = facing(second.angle);
    let gap = Infinity;
    for (const t of [-1.12, 0, 1.12]) {
      for (const u of [-1.12, 0, 1.12]) {
        gap = Math.min(gap, Math.hypot(first.x + a.x * t - second.x - b.x * u,
          first.z + a.z * t - second.z - b.z * u));
      }
    }
    return gap;
  }

  function pointToVehicle(point, vehicle) {
    const nose = facing(vehicle.angle);
    const offset = clamp((point.x - vehicle.x) * nose.x + (point.z - vehicle.z) * nose.z, -1.18, 1.18);
    return Math.hypot(point.x - vehicle.x - nose.x * offset, point.z - vehicle.z - nose.z * offset);
  }

  function moveVehicle(actor, dx, dz) {
    const previous = { x: actor.x, z: actor.z, angle: actor.angle };
    const edge = move(actor, dx, dz, 1.22);
    if (!inCar && (actor===patrol || actor===backup) && pointToVehicle(player,actor)<1.35) {
      actor.x=previous.x; actor.z=previous.z; return 'player';
    }
    for (const group of [vehicles, traffic, heatLevel > 1 ? [patrol, backup] : [patrol]]) {
      for (const other of group) {
        if (other.destroyed || actor === other || distance(actor, other) >= 5) continue;
        const gap = vehicleGap(actor, other);
        if (gap < 1.82 && gap < vehicleGap(previous, other) - 0.0001) {
          actor.x = previous.x;
          actor.z = previous.z;
          return 'vehicle';
        }
      }
    }
    if (actor === car && inCar && Math.abs(car.speed) > 4) {
      for (const lamp of lamps) {
        if (lamp.brokenAt !== null || pointToVehicle(lamp,actor) > 1.25) continue;
        lamp.brokenAt = elapsed;
        lamp.fallAngle = actor.angle + (actor.speed < 0 ? Math.PI : 0);
        car.speed *= 0.88;
        notify('Streetlight knocked down');
        cue(170, 35, 0.25, 'triangle');
        if (!heatLevel) wanted(1);
      }
    }
    const nose = facing(actor.angle);
    actor.wheelSpin = ((actor.wheelSpin || 0) + ((actor.x-previous.x)*nose.x+(actor.z-previous.z)*nose.z)/0.34) % (Math.PI*2);
    return edge ? 'wall' : null;
  }

  function updateWorkers(dt) {
    const impactSpeed = inCar ? Math.abs(car.speed) : 0;
    const front = facing(car.angle);
    for (const worker of workers) {
      if (worker.recover > 0) {
        worker.recover -= dt;
        worker.elevation = Math.max(0, worker.elevation + worker.lift * dt);
        worker.lift -= 11.5 * dt;
        if (worker.elevation > 0) {
          move(worker, worker.vx * dt, worker.vz * dt, 0.25);
          worker.tilt += dt * 3.2;
        }
        continue;
      }
      if (worker.health === 0) worker.health = 100;
      if (worker.panicUntil > elapsed) {
        const away = Math.atan2(worker.x-player.x,player.z-worker.z);
        worker.angle = away;
        const direction = facing(away);
        move(worker,direction.x*3.8*dt,direction.z*3.8*dt,0.3);
        worker.homeX = worker.x; worker.homeZ = worker.z;
        continue;
      }
      const cycle = elapsed * worker.pace + (worker.phaseOffset || 0);
      const progress = (1 - Math.cos(cycle)) / 2;
      worker.x = worker.homeX + worker.dx * progress;
      worker.z = worker.homeZ + worker.dz * progress;
      worker.angle = Math.atan2(worker.dx, -worker.dz) + (Math.sin(cycle) < 0 ? Math.PI : 0);
      worker.elevation = worker.tilt = 0;
      if (impactSpeed < 4 || distance(car, worker) > 2.4) continue;
      const heading = Math.sign(car.speed);
      const hitX = car.x + front.x * heading * 1.28;
      const hitZ = car.z + front.z * heading * 1.28;
      if (Math.hypot(worker.x - hitX, worker.z - hitZ) > 1.03) continue;
      worker.elevation = 0.08;
      worker.lift = 3.4 + impactSpeed * 0.16;
      worker.vx = front.x * heading * impactSpeed * 0.49;
      worker.vz = front.z * heading * impactSpeed * 0.49;
      worker.recover = 2.2;
      car.speed *= 0.72;
      if (!heatLevel) wanted(1);
      notify('Collision · patrol alerted');
      cue(117, 48, 0.2, 'triangle');
    }
  }

  function clearControls() {
    footSpeed = actualFootSpeed = visualSpeed = turnLean = 0;
    firePointers.clear();
    footPlants.fill(null);
    keys.clear();
    pointers.clear();
    lookPointer = null;
    lookTouch = null;
    dragTouch = null;
    footHeading = null;
  }

  function resetTraffic() {
    displacedDrivers.length = 0;
    for (const lamp of lamps) { lamp.brokenAt = null; lamp.fallAngle = 0; }
    for (const vehicle of traffic) {
      vehicle.cruiseSpeed ??= vehicle.speed;
      Object.assign(vehicle, { ...models.coupe, occupied: true, taken: false, doorUntil: 0, speed: vehicle.cruiseSpeed });
      const [[x, z], [nextX, nextZ]] = vehicle.route;
      Object.assign(vehicle, { x, z, next: 1, angle: Math.atan2(nextX - x, z - nextZ) });
    }
  }

  function updateTraffic(dt) {
    const active = inCar ? car : player;
    for (let i = displacedDrivers.length - 1; i >= 0; i--) {
      if (displacedDrivers[i].age > 25) displacedDrivers.splice(i, 1);
    }
    for (const driver of displacedDrivers) {
      driver.age += dt;
      if (driver.age < 0.55) {
        const t = Math.min(1,driver.age/0.55);
        driver.x = driver.fromX+(driver.exitX-driver.fromX)*t;
        driver.z = driver.fromZ+(driver.exitZ-driver.fromZ)*t;
        driver.tilt = Math.sin(t*Math.PI)*0.3;
        continue;
      }
      driver.tilt = 0;
      const direction = facing(driver.angle);
      move(driver, direction.x * dt * 2.2, direction.z * dt * 2.2, 0.3);
    }
    for (const vehicle of traffic) {
      if (vehicle.taken || vehicle.destroyed) continue;
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
      moveVehicle(vehicle, dx * travel, dz * travel);
    }
  }

  function startAudio() {
    if (!soundEnabled) return;
    try {
      if (!audio) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const channel = (type, frequency) => {
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          oscillator.type = type;
          oscillator.frequency.value = frequency;
          gain.gain.value = 0;
          oscillator.connect(gain).connect(ctx.destination);
          oscillator.start();
          return { oscillator, gain };
        };
        audio = { ctx, engine: channel('triangle', 48), siren: channel('sine', 620) };
      }
      if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
    } catch {}
  }

  function updateAudio() {
    if (!audio) return;
    const now = audio.ctx.currentTime;
    const enabled = soundEnabled && phase === 'playing' && !document.hidden;
    const engine = enabled && inCar ? 0.025 + Math.abs(car.speed) * 0.001 : 0;
    const pursuitDistance = heatLevel > 1 ? Math.min(distance(car, patrol), distance(car, backup)) : distance(inCar ? car : player, patrol);
    const siren = enabled && heatLevel ? 0.045 * clamp(1 - pursuitDistance / 60, 0, 1) : 0;
    audio.engine.gain.gain.setTargetAtTime(engine, now, 0.035);
    audio.siren.gain.gain.setTargetAtTime(siren, now, 0.035);
    if (!enabled) return;
    audio.engine.oscillator.frequency.setTargetAtTime(43 + Math.abs(car.speed) * 5.1, now, 0.05);
    audio.siren.oscillator.frequency.setTargetAtTime(670 + 230 * Math.sin(elapsed * 5.6), now, 0.06);
  }

  function cue(frequency, end, duration, type = 'sine') {
    if (!audio || !soundEnabled || document.hidden) return;
    const { ctx } = audio;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start();
    oscillator.stop(now + duration);
  }

  function notify(message) {
    element('feedback').textContent = message;
    feedbackUntil = elapsed + 2.2;
  }

  function advanceStage(message) {
    stageIndex += 1;
    window.HarborOnline?.stage(stageIndex,inCar?car.x:player.x,inCar?car.z:player.z);
    const next=activeJob?.stages[stageIndex];
    notify(message+(next?' · Next: '+next.label:''));
    feedbackUntil=elapsed+4;
    cue(480, 870, 0.18);
  }

  function describeJob() {
    const job = jobs[Number(element('mission').value)] ?? jobs[0];
    const risk = job.heat ? ['','Local patrol','Police backup','Lockdown'][job.heat] : 'No scheduled pursuit';
    element('brief').textContent = job.tagline+' — '+job.briefing+' '+job.stages.length + ' objectives · ' + models[job.model].name
      + ' · ' + Math.floor(job.time / 60) + ':' + String(job.time % 60).padStart(2, '0') + ' · ' + risk+'. Tip: '+job.tip;
  }

  function availableJobs() {
    const unfinished = jobs.findIndex(job => !records[job.name]);
    return unfinished === -1 ? jobs.length : unfinished + 1;
  }

  function jobBoard() {
    const board = element('mission');
    const unlocked = availableJobs();
    board.replaceChildren();
    jobs.forEach((job, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.disabled = index >= unlocked;
      option.textContent = (index + 1) + '. ' + job.name + (records[job.name] ? ' ✓' : index >= unlocked ? ' · Locked' : '');
      board.append(option);
    });
    selectedJob = Math.min(selectedJob, unlocked - 1);
    board.value = selectedJob;
    describeJob();
    element('progress').textContent = Object.keys(records).length + ' / ' + jobs.length + ' jobs complete · saved on this device';
  }

  function wanted(level) {
    const escalating=level>heatLevel;
    heatLevel = Math.max(heatLevel, level);
    lost = false;
    if(escalating) notify(heatLevel > 1 ? 'Police backup en route' : 'Patrol alerted');
    unseen = 0;
    if(escalating) caught=0;
    for (const unit of [patrol, backup]) {
      unit.last = { x: inCar ? car.x : player.x, z: inCar ? car.z : player.z };
      unit.path = [];
      unit.rethink = 0;
    }
  }

  function reset(free = false) {
    selectedJob = clamp(Math.floor(Number(element('mission').value) || 0), 0, availableJobs() - 1);
    activeJob = free ? null : jobs[selectedJob];
    window.HarborOnline?.start(free?null:selectedJob);
    stageIndex = heatLevel = shotFlash = feedbackUntil = 0;
    weaponIndex=0; ownedWeapons.clear(); ownedWeapons.add(0); shotAt=-10; shotConnected=false;
    weaponPickups.forEach(p=>p.readyAt=0);
    for (const v of [...traffic,patrol,backup]) { v.health=160; v.destroyed=false; }
    shotTarget = null;
    won = false;
    Object.assign(player, { x: 12, z: 43, angle: 0 });
    car = spawn(activeJob?.model ?? 'coupe', 12, 32);
    // Park parallel to the curb, halfway between junctions, clear of traffic lanes.
    if (!activeJob) Object.assign(car, { x: 17.3, z: 26 });
    vehicles = activeJob ? [car] : [car, spawn('muscle', 17.3, 54),
      spawn('van', 45.3, 54), spawn('muscle', 157.3, 166),
      spawn('coupe', 269.3, 222), spawn('van', 325.3, 306)];
    Object.assign(patrol, { x: 40, z: 56, angle: 0 });
    Object.assign(backup, { x: 68, z: 40, angle: 0 });
    Object.assign(camera, { x: player.x, z: player.z, angle: 0, distance: 11 });
    inCar = stolen = lost = false;
    elapsed = unseen = caught = 0;
    footView = driveLook = walkCycle = walkBlend = 0;
    runEnabled = false;
    stamina = 100; exhausted = false;
    element('run-mode').textContent = 'Run';
    element('run-mode').setAttribute('aria-pressed', 'false');
    cameraMode = false; manualLookUntil = 0; cameraLift = 0;
    element('camera-mode').textContent = 'Look around';
    element('camera-mode').setAttribute('aria-pressed', 'false');
    resetTraffic();
    for (const worker of workers) Object.assign(worker, { x: worker.homeX, z: worker.homeZ, recover: 0, elevation: 0, tilt: 0, health: 100, panicUntil: 0 });
    run();
  }

  function run() {
    phase = 'playing';
    clearControls();
    element('overlay').hidden = true;
    element('pause').disabled = false;
    startAudio();
    updateHud();
  }

  function overlay(next, title, description, action) {
    phase = next;
    updateAudio();
    clearControls();
    element('title').textContent = title;
    element('description').textContent = description;
    element('start').textContent = action;
    const best = activeJob && records[activeJob.name];
    element('best').hidden = next !== 'finished' || !best;
    element('best').textContent = best ? 'Best time · ' + (best / 1000).toFixed(1) + ' s' : '';
    element('board-fields').hidden = next !== 'ready';
    element('free-roam').hidden = next !== 'ready';
    element('open-board').hidden = next === 'ready';
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

  function nearestVehicle() {
    return [...vehicles, ...traffic].filter(vehicle => !vehicle.destroyed && distance(player, vehicle) < 3.4)
      .sort((a,b) => distance(player,a)-distance(player,b))[0];
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
    } else {
      const vehicle = nearestVehicle();
      if (!vehicle) return;
      if (vehicle.occupied) {
        const side = facing(vehicle.angle + Math.PI / 2);
        const sign = (player.x-vehicle.x)*side.x+(player.z-vehicle.z)*side.z >= 0 ? 1 : -1;
        const x = vehicle.x + side.x * sign * 1.65;
        const z = vehicle.z + side.z * sign * 1.65;
        if (blocked(x,z,0.3)) { notify('Approach the other door'); return; }
        const fromX = vehicle.x + side.x * sign * 0.5;
        const fromZ = vehicle.z + side.z * sign * 0.5;
        displacedDrivers.push({ x:fromX, z:fromZ, fromX, fromZ, exitX:x, exitZ:z, angle: vehicle.angle + sign * Math.PI/2, age:0 });
        vehicle.doorSide = sign;
        vehicle.doorUntil = elapsed + 0.9;
        cue(180, 90, 0.12, 'triangle');
        vehicle.occupied = false;
        vehicle.taken = true;
        vehicle.speed = 0;
        wanted(Math.max(1, heatLevel));
        notify('Driver pulled out · car taken');
      }
      car = vehicle;
      driveLook = Math.atan2(Math.sin(camera.angle - car.angle), Math.cos(camera.angle - car.angle));
      dragTouch = null;
      pointers.clear();
      inCar = true;
      if (!stolen && activeJob?.heat && activeJob.stages[0].kind !== 'shoot') wanted(activeJob.heat);
      stolen = true;
    }
    updateHud();
  }

  function objectiveTarget() {
    const step = activeJob?.stages[stageIndex];
    if (!step) return null;
    if (step.kind === 'shoot') return step;
    if (!inCar) return car;
    return step.kind === 'escape' ? null : step;
  }

  function updateHud() {
    const liveNotice=element("live-notice");if(liveNotice?.dataset && Date.now()>Number(liveNotice.dataset.until||0))liveNotice.hidden=true;
    element("connect-live").hidden = Boolean(activeJob);
    const seconds = activeJob ? Math.max(0, Math.ceil(activeJob.time - elapsed)) : 0;
    element('clock').textContent = activeJob
      ? Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') : 'FREE ROAM';
    const heat = element('heat');
    heat.textContent = heatLevel ? '★'.repeat(heatLevel) + (caught > 0 ? ' CLOSING IN' : unseen > 0 ? ' EVADING' : ' WANTED')
      : lost ? 'CLEAR' : inCar ? car.name.toUpperCase() : 'ON FOOT';
    heat.classList.toggle('danger', heatLevel > 0 && unseen === 0);
    heat.classList.toggle('clear', lost || unseen > 0);
    const meter = element('escape-progress');
    meter.hidden = heatLevel === 0;
    meter.max = 4 + heatLevel * 2;
    meter.value = unseen;
    element('feedback').hidden = phase !== 'playing' || elapsed >= feedbackUntil;
    element('speed').hidden = !inCar;
    element('brake').hidden = !inCar;
    element('brake').disabled = phase !== 'playing';
    element('fire').hidden = inCar || phase !== 'playing';
    element('stamina').textContent = (exhausted ? 'Recovering ' : 'Energy ') + Math.round(stamina) + '%';
    element('stamina').style.color = exhausted ? '#ffca91' : '#a9f7dc';
    element('stamina').hidden = inCar;
    element('run-mode').hidden = inCar;
    element('run-mode').disabled = phase !== 'playing';
    element('switch-weapon').hidden = inCar || phase !== 'playing';
    element('switch-weapon').disabled = ownedWeapons.size < 2;
    element('switch-weapon').textContent = 'Switch gun · '+ownedWeapons.size;
    element('fire').setAttribute('aria-pressed', String(firePointers.size>0 || keys.has('fire')));
    element('fire').textContent = activeJob?.stages[stageIndex]?.kind === 'shoot' ? 'Fire at target' : weapons[weaponIndex].name + ' · Fire';
    element('drive-hint').hidden = !inCar;
    element('run-hint').hidden = inCar;
    element('speed').textContent = Math.round(Math.abs(car.speed) * 3.6) + ' km/h';
    const active = inCar ? car : player;
    const district = active.x > 278 ? 'EAST TERMINAL' : active.z > 252 ? 'SOUTH INDUSTRIAL'
      : active.x > 154 ? 'CENTRAL CITY' : active.z > 121 ? 'LOWER QUAY' : active.x < 30 ? 'WEST RAIL' : active.x > 84 ? 'EAST DOCKS'
      : active.z < 33 ? 'NORTH QUAY' : active.z > 78 ? 'SOUTH YARD' : 'MARKET WARD';
    if (element('district').textContent !== district) element('district').textContent = district;
    const step = activeJob?.stages[stageIndex];
    const target = objectiveTarget();
    const range = target ? ' · ' + Math.ceil(distance(inCar ? car : player, target)) + ' m' : '';
    const label = !step ? 'Explore the harbor' : step.kind === 'shoot' && inCar ? 'Get out to use your pistol'
      : !inCar && step.kind !== 'shoot' ? 'Get to your ' + car.name.toLowerCase() : step.label;
    const objective = (step ? (stageIndex + 1) + '/' + activeJob.stages.length + ' · ' : '') + label + range;
    if (element('objective').textContent !== objective) element('objective').textContent = objective;
    const vehicle = inCar ? car : nearestVehicle();
    element('interact').disabled = phase !== 'playing' || (inCar ? Math.abs(car.speed) > 2 : !vehicle);
    element('interact').textContent = inCar ? 'Exit car' : vehicle ? (vehicle.occupied ? 'Pull driver out' : 'Enter ' + vehicle.name.toLowerCase()) : 'Enter car';
    element('jobs').hidden = Boolean(activeJob) || phase !== 'playing';
  }

  function damageVehicle(vehicle,damage) {
    if (vehicle.destroyed) return;
    vehicle.health=Math.max(0,(vehicle.health ?? 160)-damage);
    vehicle.hitAt=elapsed;
    if (vehicle.health>0) { notify('Vehicle damaged · '+vehicle.health+' integrity'); return; }
    vehicle.destroyed=true; vehicle.speed=0; vehicle.occupied=false; vehicle.blastAt=elapsed;
    wanted(3); notify('Vehicle exploded · police lockdown'); cue(65,24,0.6,'sawtooth');
    for (const worker of workers) if (distance(worker,vehicle)<5 && visible(vehicle,worker)) {
      Object.assign(worker,{health:0,recover:12,elevation:0.2,lift:3,vx:(worker.x-vehicle.x),vz:(worker.z-vehicle.z),tilt:0.5});
    }
  }

  function shoot() {
    if (phase !== 'playing' || inCar || shotFlash > 0 || window.HarborOnline?.dead()) return;
    if(!activeJob)window.HarborOnline?.fire(footView,weaponIndex);
    const step = activeJob?.stages[stageIndex];
    const weapon = weapons[weaponIndex];
    const aim = facing(footView);
    const span = step ? distance(player, step) : Infinity;
    const alignment = step && span > 0
      ? ((step.x - player.x) * aim.x + (step.z - player.z) * aim.z) / span : -1;
    let hit = step?.kind === 'shoot' && span < 22 && (span < 11 || alignment > 0.56) && visible(player, step);
    // Trace the first obstruction; shots never pass through walls or cars.
    let hitCar=null;
    let reach = weapon.range;
    for (let d=0.5;d<=weapon.range;d+=0.2) {
      const point={x:player.x+aim.x*d,z:player.z+aim.z*d};
      if (blocked(point.x,point.z,0.03)) { reach=d; break; }
      hitCar=[...vehicles,...traffic,patrol,backup].find(v=>(!v.destroyed || elapsed-v.blastAt<30) && pointToVehicle(point,v)<0.85);
      if (hitCar) { reach=d; break; }
    }
    let victim = null, nearest = reach;
    for (const worker of workers) {
      if (worker.health === 0 || worker.recover > 0) continue;
      const dx=worker.x-player.x, dz=worker.z-player.z;
      const along=dx*aim.x+dz*aim.z;
      const across=Math.abs(dx*aim.z-dz*aim.x);
      if (along>0.4 && along<nearest && across<0.65) { victim=worker; nearest=along; }
    }
    if (victim) hit=false;
    const impact = victim || (hit ? step : { x: player.x + aim.x * reach, z: player.z + aim.z * reach });
    shotTarget = {x:impact.x,z:impact.z};
    shotAt=elapsed; shotConnected=Boolean(victim || hit || hitCar);
    shotFlash = weapon.delay;
    if (hitCar && !victim && !hit) damageVehicle(hitCar,weapon.damage);
    cue(185, 47, 0.15, 'square');
    wanted(victim ? Math.max(2,heatLevel) : Math.max(1,heatLevel,activeJob?.heat || 0));
    for (const worker of workers) if (distance(worker,player)<28) worker.panicUntil=elapsed+8;
    if (victim) {
      victim.health=Math.max(0,(victim.health ?? 100)-weapon.damage);
      Object.assign(victim,{recover:victim.health===0?12:0.35,elevation:0.03,lift:1.2,vx:aim.x*2,vz:aim.z*2,tilt:0.25});
      notify(victim.health===0?'NPC down · police backup alerted':'Hit · '+weapon.damage+' damage · police alerted');
    }
    if (hit) {
      footView = player.angle = Math.atan2(step.x - player.x, player.z - step.z);
      advanceStage('Target down');
    }
    updateHud();
  }

  function pursue(unit, active, dt) {
    if (unit.destroyed) return;
    const separation = distance(active, unit);
    const seen = separation < 27 + heatLevel * 4 && visible(unit, active);
    if (seen) Object.assign(unit.last, { x: active.x, z: active.z });
    unit.rethink -= dt;
    if (unit.rethink <= 0) {
      unit.path = seen ? [] : route(unit, unit.last);
      unit.rethink = 0.55;
    }
    if (unit.path.length && distance(unit, unit.path[0]) < 1) unit.path.shift();
    const target = seen ? active : unit.path[0];
    if (target) {
      unit.angle = Math.atan2(target.x - unit.x, unit.z - target.z);
      const direction = facing(unit.angle);
      const speed = Math.min(Math.max(0,separation-(inCar?3.8:3.05))*3, seen ? 12 + heatLevel * 1.55 : 8.5 + heatLevel * 1.45);
      moveVehicle(unit, direction.x * speed * dt, direction.z * speed * dt);
    }
    return { seen, separation };
  }

  function completeJob() {
    window.HarborOnline?.finish();
    const time = Math.max(1, Math.ceil(elapsed * 1000));
    const record = !records[activeJob.name] || time < records[activeJob.name];
    if (record) {
      records[activeJob.name] = time;
      try { window.localStorage?.setItem(storageKey, JSON.stringify(records)); } catch {}
    }
    const next = jobs[selectedJob + 1];
    won = true;
    cue(520, 1040, 0.36, 'triangle');
    overlay('finished', 'Job complete', activeJob.name + ' · ' + (time / 1000).toFixed(1)
      + ' seconds · '+activeJob.stages.length+' objectives complete.' + (record ? ' New personal best.' : ''), next ? 'Next job' : 'Replay job');
  }

  function lookBy(radians, vertical = 0) {
    manualLookUntil = elapsed + 2;
    cameraLift = clamp(cameraLift + vertical, -1.2, 2.1);
    if (inCar) driveLook = clamp(driveLook + radians, -Math.PI, Math.PI);
    else footView += radians;
  }

  function update(dt) {
    elapsed += dt;
    const onlineActor=inCar?car:player;
    window.HarborOnline?.tick({x:onlineActor.x,z:onlineActor.z,angle:onlineActor.angle,driving:inCar,free:!activeJob});
    const liveRespawn=window.HarborOnline?.takeRespawn();
    if(liveRespawn){inCar=false;Object.assign(player,liveRespawn);keys.clear();pointers.clear();firePointers.clear();notify('Respawned · 5 seconds of protection');}
    if(window.HarborOnline?.dead()){keys.clear();pointers.clear();firePointers.clear();return;}
    shotFlash = Math.max(0, shotFlash - dt);
    if (!activeJob && !inCar) for (const pickup of weaponPickups) {
      if (elapsed >= (pickup.readyAt || 0) && distance(player,pickup)<1.6) {
        weaponIndex=pickup.type; ownedWeapons.add(weaponIndex); pickup.readyAt=elapsed+45;
        notify(weapons[weaponIndex].name+' equipped · hold Fire'); cue(650,980,0.15,'sine');
      }
    }
    if (firePointers.size || keys.has('fire')) shoot();
    const horizontal = dragTouch ? dragTouch.dx : Number(held('right')) - Number(held('left'));
    const vertical = dragTouch ? dragTouch.dy : Number(held('down')) - Number(held('up'));
    const look = Number(held('lookRight')) - Number(held('lookLeft'));
    if (look) lookBy(look * 1.8 * dt);
    else if (inCar && !cameraMode && !lookTouch && lookPointer === null && elapsed > manualLookUntil) driveLook *= Math.exp(-1.8 * dt);
    let walking = false;
    let footTravel = 0;
    let desiredLean = 0;
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
        const acceleration = throttle > 0 && car.speed > 0 ? 24 : car.acceleration;
        const cornerSpeed = dragTouch ? car.top - 8 * Math.abs(steer) : car.top;
        car.speed = throttle < 0 && car.speed > cornerSpeed
          ? Math.max(cornerSpeed, car.speed - 12 * dt)
          : clamp(car.speed - throttle * acceleration * dt, -7, throttle < 0 ? cornerSpeed : car.top);
      } else car.speed *= Math.exp(-2.3 * dt);
      const steering = Math.min(1, Math.abs(car.speed) / 3);
      car.angle += steer * Math.sign(car.speed) * steering * (braking ? 3.15 : dragTouch ? 2.3 : 1.9) * dt;
      const direction = facing(car.angle);
      const impact = moveVehicle(car, direction.x * car.speed * dt, direction.z * car.speed * dt);
      if (impact) {
        if (Math.abs(car.speed) > 3) {
          notify(impact === 'vehicle' ? 'Vehicle impact' : 'Scraped the curb');
          cue(105, 38, 0.16, 'triangle');
        }
        car.speed *= 0.26;
      }
    } else if (dragTouch ? Math.hypot(horizontal, vertical) > 5 : horizontal || vertical) {
      // Keep the input frame fixed while a gesture or key combination is held.
      footHeading ??= camera.angle;
      const directionAngle = (dragTouch?.heading ?? footHeading) + Math.atan2(horizontal, -vertical);

      const turn = directionAngle - player.angle;
      // Ease into the shortest turn, with a firm angular speed limit.
      const turnError = Math.atan2(Math.sin(turn), Math.cos(turn));
      player.angle += clamp(turnError * (1 - Math.exp(-5 * dt)), -3.2 * dt, 3.2 * dt);
      const remainingTurn = Math.atan2(Math.sin(directionAngle-player.angle),Math.cos(directionAngle-player.angle));
      // Pivot before reversing; translation always follows the body's facing.
      const alignment = clamp((Math.cos(remainingTurn)-0.7)/0.3,0,1);
      desiredLean = clamp(remainingTurn,-0.7,0.7)*alignment;
      const direction = facing(player.angle);
      if (alignment > 0.5 && !look && !cameraMode && !lookTouch && lookPointer === null && elapsed > manualLookUntil) footView = player.angle;
      const oldX = player.x;
      const oldZ = player.z;
      const sprinting = (runEnabled || held('sprint')) && !exhausted;
      const pace = sprinting ? 11*(1+stats.muscle*0.10-stats.build*0.15) : 7*(1-stats.build*0.08);
      const speed = dragTouch ? pace * clamp((Math.hypot(horizontal, vertical) - 5) / 20, 0, 1) : pace;
      const desiredSpeed = speed * alignment;
      const rate = (desiredSpeed > footSpeed ? 9 : 16)/(1+stats.build*0.25);
      footSpeed += (desiredSpeed-footSpeed)*(1-Math.exp(-rate*dt));
      // Never coast backward while pivoting, even with leftover sprint momentum.
      const travelSpeed = footSpeed * alignment;
      move(player, direction.x * travelSpeed * dt, direction.z * travelSpeed * dt, 0.45);
      const previous = { x: oldX, z: oldZ };
      for (const vehicle of [...vehicles, ...traffic, patrol, ...(heatLevel > 1 ? [backup] : [])]) {
        // Low wreckage is step-over debris, never a permanent player cage.
        if (vehicle.destroyed || distance(player, vehicle) > 3) continue;
        const gap = pointToVehicle(player, vehicle);
        if (gap < 1.22 && gap < pointToVehicle(previous, vehicle)) Object.assign(player, previous);
      }
      footTravel = Math.hypot(player.x - oldX, player.z - oldZ);
      walking = footTravel > dt * 0.1;
      if (footTravel < 0.00001) footSpeed = 0;
    } else { footHeading = null; footSpeed = 0; }
    updateTraffic(dt);
    updateWorkers(dt);
    actualFootSpeed = dt > 0 ? footTravel/dt : 0;
    const spending = !inCar && actualFootSpeed > 7.2 && !exhausted;
    stamina = clamp(stamina + dt*(spending ? -(12-stats.endurance*5) : actualFootSpeed > 0.2 ? 6 : 14),0,100);
    if (stamina <= 0) exhausted = true;
    if (stamina >= 30) exhausted = false;
    if (spending) stats.endurance = clamp(stats.endurance+dt/7200,0,1);
    fitnessSave += dt;
    if (fitnessSave >= 10) { saveFitness(); fitnessSave = 0; }

    visualSpeed += (actualFootSpeed-visualSpeed)*(1-Math.exp(-8*dt));
    turnLean += (desiredLean*clamp(actualFootSpeed/11,0,1)-turnLean)*(1-Math.exp(-7*dt));
    walkCycle += footTravel * 2.05;
    walkBlend += (clamp(actualFootSpeed/7,0,1)-walkBlend)*(1-Math.exp(-12*dt));

    const active = inCar ? car : player;
    if (heatLevel) {
      const primary = pursue(patrol, active, dt);
      const support = heatLevel > 1 ? pursue(backup, active, dt) : null;
      const separation = Math.min(primary.separation, support?.separation ?? Infinity);
      unseen = !primary.seen && !support?.seen && separation > 12 ? unseen + dt : 0;
      caught = separation < (inCar ? 4.2 : 3.3) && (!inCar || Math.abs(car.speed) < 4) ? caught + dt : 0;
      if (unseen >= 4 + heatLevel * 2) {
        heatLevel = 0;
        lost = true;
        notify('Patrol lost');
        cue(360, 670, 0.25);
      }
    }
    const step = activeJob?.stages[stageIndex];
    if (step && ((step.kind === 'escape' && lost)
      || (inCar && step.kind === 'drive' && distance(car, step) < 5)
      || (inCar && step.kind === 'park' && distance(car, step) < 4.5 && Math.abs(car.speed) < 3))) {
      advanceStage(step.kind === 'park' ? 'Stop confirmed' : step.kind === 'escape' ? 'Patrol lost' : 'Checkpoint cleared');
      if (step.kind === 'park' && activeJob.heat && !heatLevel && activeJob.stages[stageIndex]?.kind === 'escape') wanted(activeJob.heat);
    }
    if (caught >= 2 || (activeJob && elapsed >= activeJob.time)) {
      overlay('finished', caught >= 2 ? 'Busted' : 'Time’s up',
        (activeJob ? activeJob.name+' · Completed '+stageIndex+'/'+activeJob.stages.length+' objectives. '+activeJob.tip : 'Break patrol line of sight using side streets. Keep moving to avoid capture.'), activeJob ? 'Retry job' : 'Return to free roam');
    } else if (activeJob && stageIndex === activeJob.stages.length) completeJob();

    const smoothing = 1 - Math.exp(-8 * dt);
    camera.x += (active.x - camera.x) * smoothing;
    camera.z += (active.z - camera.z) * smoothing;
    const turn = (inCar ? car.angle + driveLook : footView) - camera.angle;
    const manualCamera = cameraMode || look || lookTouch || lookPointer !== null || elapsed <= manualLookUntil;
    const followRate = manualCamera ? 5 : inCar ? 3.5 : 2.6;
    const angleStep = Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-followRate * dt));
    const cameraTurnLimit = manualCamera ? 2.8 : inCar ? 1.8 : 1.35;
    camera.angle += clamp(angleStep, -cameraTurnLimit * dt, cameraTurnLimit * dt);
    const forward = facing(camera.angle);
    const targetDistance = inCar ? 8.8 + Math.abs(car.speed) * 0.11 : (9.6+1.2*clamp((visualSpeed-7)/4,0,1));
    let clearance = targetDistance;
    // Sweep the entire camera boom; never enforce a distance that pushes it into a wall.
    if (blocked(camera.x,camera.z,0.45)) { camera.x=active.x; camera.z=active.z; }
    for (let offset = 0.4; offset <= targetDistance; offset += 0.2) {
      const x = camera.x - forward.x * offset;
      const z = camera.z - forward.z * offset;
      if (blocks.some(b => x > b.x-0.45 && x < b.x+b.w+0.45 && z > b.z-0.45 && z < b.z+b.d+0.45)) {
        clearance = Math.max(0.25,offset-0.25);
        break;
      }
    }
    // Ease pace-related zoom both ways; retain immediate wall clearance.
    const easedDistance = camera.distance+(targetDistance-camera.distance)*(1-Math.exp(-3*dt));
    camera.distance = Math.min(clearance, easedDistance);
    updateHud();
  }

  const roofs = ['#8d8e86', '#8c9292', '#969086', '#86928c'];
  const walls = ['#a09d8d', '#909a9c', '#a79e90', '#a0a697'];
  const darkWalls = ['#777973', '#69767a', '#807a74', '#737f76'];
  const lamps = roads.flatMap(x => roads.map(z => ({ x: x + 5.2, z: z + 5.2, brokenAt: null, fallAngle: 0 })));
  const trees = Array.from({ length: 18 }, (_, i) => ({
    x: i < 9 ? 17.45 : 102.05,
    z: 4.5 + (i % 9) * 11.9,
    height: 3.2 + (i * 13 % 8) * 0.24,
    spread: 1.35 + (i * 5 % 7) * 0.13,
  })).filter(tree => !roads.some(road => Math.abs(road - tree.z) < 5.6)
    && !(tree.x > 100 && Math.abs(tree.z - garage.z) < 9));
  for (const park of parks) for (const offset of [-5, 0, 5]) trees.push({ x: park.x + offset, z: park.z + offset * 0.55, height: 4.1, spread: 1.9 });
  const shops = [
    ["Shelby’s Bakery", '#356c69', '#a1cfbc'], ["Justin’s Mechanic Shop", '#695548', '#f0c480'], ["Blaze’s Vape Shop", '#455d79', '#bed3e6'],
    ['RAILWAY CAFE', '#834b47', '#eac5a0'], ['DEPOT SUPPLY', '#5d6947', '#d5d1a1'], ['DOCK FREIGHT', '#476075', '#b9cfdb'],
    ['WEST YARD', '#5d635a', '#d8d6bb'], ['WAREHOUSE 08', '#635950', '#dccab0'], ['COAST GUARD', '#476d78', '#c0dfe0'],
  ];
  const roadWear = roads.flatMap((road, column) => Array.from({ length: 99 }, (_, i) => ({
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
  let scenery = false;
  let architecture = false;
  let buildingSurface = false;
  let surfaceFogDepth;

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

  const hazeColors = new Map();
  function distanceColor(color, depth) {
    const band = Math.min(6, Math.max(0, Math.floor((depth - 30) / 14)));
    if (!band || !/^#[0-9a-f]{6}$/i.test(color)) return color;
    const key = color + band;
    if (!hazeColors.has(key)) {
      const t = band * 0.075;
      const channels = [0,1,2].map(i => Math.round(parseInt(color.slice(1+i*2,3+i*2),16)*(1-t)+[155,174,183][i]*t));
      hazeColors.set(key, `rgb(${channels.join(',')})`);
    }
    return hazeColors.get(key);
  }
  function polygon(points, color, ground = false, sortDepth) {
    const view = points.map(cameraPoint);
    const clipped = [];
    const near = 0.15;
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
    if (scenery) color = distanceColor(color, surfaceFogDepth ?? view.reduce((sum,p) => sum+p[2],0)/view.length);
    if (ground) fill(projected, color);
    else faces.push({ points: projected, color, scenery, architecture, buildingSurface, nearDepth: Math.min(...clipped.map(p => p[2])), depth: sortDepth ?? view.reduce((sum, p) => sum + p[2], 0) / view.length - (architecture && !buildingSurface ? 1.2 : 0) });
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

  function buildingFace(points,color) {
    if (!architecture) { polygon(points,color); return; }
    const length = (a,b) => Math.hypot(...a.map((v,i)=>v-b[i]));
    const columns = Math.max(1,Math.ceil(length(points[0],points[1])/(Math.hypot(points[0][0]-eye.x,points[0][2]-eye.z)>47 ? 6 : 0.8)));
    const rows = Math.max(1,Math.ceil(length(points[0],points[3])/(Math.hypot(points[0][0]-eye.x,points[0][2]-eye.z)>47 ? 6 : 0.8)));
    const at = (u,v) => points[0].map((_,i)=>(points[0][i]*(1-u)+points[1][i]*u)*(1-v)+(points[3][i]*(1-u)+points[2][i]*u)*v);
    surfaceFogDepth = points.reduce((sum,p)=>sum+cameraPoint(p)[2],0)/points.length;
    buildingSurface = true;
    for(let row=0;row<rows;row++) for(let col=0;col<columns;col++) {
      polygon([at(col/columns,row/rows),at((col+1)/columns,row/rows),at((col+1)/columns,(row+1)/rows),at(col/columns,(row+1)/rows)],color);
    }
    buildingSurface = false;
    surfaceFogDepth = undefined;
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
        buildingFace([a, b, top[next], top[i]], colors[1 + i % 2]);
      }
    }
    buildingFace(top, colors[0]);
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

  function fireParticle(x,y,z,width,height,kind,alpha) {
    const view=cameraPoint([x,y,z]);
    if(view[2]<0.3 || view[2]>90) return;
    const [sx,sy]=project(view);
    faces.push({particle:kind,x:sx,y:sy,w:focal*width/view[2],h:focal*height/view[2],alpha,depth:view[2]});
  }

  function drawCar(actor, police) {
    const start=faces.length;
    drawCarMesh(actor,police);
    for(let i=start;i<faces.length;i++) faces[i].vehicle=true;
  }
  function drawCarMesh(actor, police) {
    if (actor.destroyed) {
      if(elapsed-actor.blastAt>30) return;
      box(actor.x,actor.z,2.1,3.8,0.65,actor.angle,['#343536','#242628','#181c20'],0.15);
      const age=elapsed-actor.blastAt;
      const fade=clamp((18-age)/5,0,1);
      if (fade>0) {
        fireParticle(actor.x,0.6,actor.z,2.4,1.2,'glow',fade*0.35);
        for(let i=0;i<9;i++) {
          const flicker=0.85+0.22*Math.sin(elapsed*13+i*2.3);
          fireParticle(actor.x+Math.sin(i*2.4)*0.7,0.45,actor.z+Math.cos(i*2.4)*1.2,
            0.35*flicker, (1.1+(i%3)*0.35)*flicker,'flame',fade);
        }
        for(let i=0;i<7;i++) {
          const t=(age*0.23+i/7)%1;
          fireParticle(actor.x+Math.sin(i*3+t)*0.5+t*0.9,1.3+t*3.8,actor.z+Math.cos(i*2)*0.5,
            0.45+t*0.9,0.5+t*1.1,'smoke',fade*(1-t)*0.5);
        }
        for(let i=0;i<8;i++) {
          const t=(age*0.7+i/8)%1;
          fireParticle(actor.x+Math.sin(i*7)*t,0.8+t*3,actor.z+Math.cos(i*7)*t,
            0.025,0.07,'spark',fade*(1-t));
        }
      }
      return;
    }
    if ((actor.health ?? 160) < 85) for(let i=0;i<4;i++) {
      const t=(elapsed*0.3+i/4)%1;
      fireParticle(actor.x+t*0.4,1.1+t*2.2,actor.z-0.7,0.2+t*0.5,0.3+t*0.6,'smoke',(1-t)*0.45);
    }
    const paint = actor.paint ?? (police ? ['#e3eaf7', '#536783', '#33465f'] : ['#365957', '#243d3d', '#1c3033']);
    const rubber = ['#263145', '#101723', '#161e2b'];
    const front = facing(actor.angle);
    const side = facing(actor.angle + Math.PI / 2);
    const part = (across, ahead, w, d, h, base, colors, taper = 1) => box(
      actor.x + across * side.x + ahead * front.x, actor.z + across * side.z + ahead * front.z,
      w, d, h, actor.angle, colors, base, taper,
    );
    const detailed = Math.hypot(actor.x - eye.x, actor.z - eye.z) < 42;
    if (!detailed) for (const sign of [-1, 1]) {
      part(sign * 1.02, -1.15, 0.33, 0.68, 0.62, 0.03, rubber);
      part(sign * 1.02, 1.12, 0.33, 0.68, 0.62, 0.03, rubber);
    }
    if (detailed) {
      for (const sign of [-1, 1]) for (const ahead of [-1.15, 1.12]) {
        const ring = (radius, across, spin = 0) => Array.from({ length: 12 }, (_, i) => {
          const a = i * Math.PI / 6 + spin;
          const along = ahead + Math.cos(a) * radius;
          return [actor.x + across * side.x + along * front.x,
            0.34 + Math.sin(a) * radius, actor.z + across * side.z + along * front.z];
        });
        const inner = ring(0.34, sign * 0.90), outer = ring(0.34, sign * 1.20);
        for (let i = 0; i < 12; i++) {
          const j = (i + 1) % 12;
          polygon([inner[i],inner[j],outer[j],outer[i]], i < 6 ? '#30383e' : '#141a21');
        }
        polygon(outer, '#141c25');
        polygon(ring(0.19, sign * 1.205), '#8c9ca8');
        const hub = ring(0.065, sign * 1.215, actor.wheelSpin || 0), rim = ring(0.16, sign * 1.215, actor.wheelSpin || 0);
        for (let i = 0; i < 12; i += 2) polygon([hub[i],rim[i],rim[(i+1)%12],hub[(i+1)%12]], '#33414d');
        polygon(ring(0.055, sign * 1.22), '#c1cbd1');
      }
      for (const sign of [-1, 1]) {
        part(sign * 1.07, 0.83, 0.23, 0.34, 0.15, 1.01, paint);
        part(sign * 1.065, -0.12, 0.035, 0.26, 0.055, 0.78, ['#b4bec5','#9ba9b4','#7a8994']);
        part(sign * 1.07, 0, 0.035, 2.45, 0.055, 0.48, rubber);
      }
    }
    part(0, 0, 2.12, 3.64, 0.43, 0.27, paint, 0.96);
    part(0, 0.09, 1.99, 3.34, 0.22, 0.70, paint);
    if (actor.name === 'Cargo van') {
      part(0, -0.33, 1.91, 2.65, 0.92, 0.91, paint, 0.95);
      part(0, 1.02, 1.72, 0.65, 0.68, 0.91, ['#7e9ca7', '#4d6b75', '#3c5159'], 0.82);
      part(0, -1.67, 0.06, 0.04, 0.66, 1.01, ['#594f48', '#514c48', '#514c48']);
    } else {
      const muscle = actor.name === 'Muscle';
      const roofHeight = muscle ? 0.4 : 0.48;
      part(0, muscle ? -0.19 : 0.05, 1.76, 2.02, roofHeight, 0.92, ['#77919b', '#4c6874', '#3a505a'], 0.73);
      part(0, muscle ? -0.19 : 0.05, 1.29, 1.47, 0.09, 0.92 + roofHeight, paint, 0.92);
      if (muscle) part(0, -1.63, 1.73, 0.3, 0.12, 0.93, ['#555b63', '#363e48', '#293440']);
    }
    if (detailed) {
      const chrome = ['#b1bec8','#7a8c9b','#536675'];
      const trim = ['#37434c','#242e37','#18232c'];
      // Grille, lower intake, hood seams and sculpted front bumper.
      part(0,1.84,0.90,0.075,0.23,0.53,trim);
      for (const y of [0.59,0.67,0.75]) part(0,1.885,0.84,0.025,0.025,y,chrome);
      part(0,1.83,1.98,0.17,0.15,0.28,paint,0.92);
      part(0,1.925,1.82,0.035,0.045,0.34,chrome);
      part(0,-1.91,1.9,0.035,0.035,0.35,chrome);
      for (const sign of [-1,1]) {
        part(sign*0.59,1.39,0.018,0.67,0.012,0.925,trim);
        part(sign*0.95,1.84,0.09,0.06,0.11,0.59,['#f7c478','#d89141','#b26a32']);
        part(sign*0.68,-1.94,0.18,0.21,0.11,0.20,chrome);
        part(sign*1.055,0.62,0.025,0.022,0.36,0.48,trim);
        part(sign*1.055,-0.78,0.025,0.022,0.36,0.48,trim);
        if (actor.name !== 'Cargo van') {
          part(sign*0.77,-0.15,0.065,0.09,0.38,0.96,trim,0.87);
          part(sign*0.85,0.04,0.04,1.86,0.04,0.94,chrome);
        }
      }
      if (actor.name === 'Muscle') {
        part(0,1.36,0.62,0.65,0.09,0.93,trim,0.7);
        for(const sign of [-1,1]) part(sign*0.24,-1.40,0.16,0.48,0.012,0.93,trim);
      }
    }
    if (detailed && actor.occupied) {
      // Dark driver silhouettes on the side glazing remain readable at phone scale.
      for (const sign of [-1,1]) {
        const point = (ahead,y) => [actor.x+side.x*sign*0.82+front.x*ahead,y,actor.z+side.z*sign*0.82+front.z*ahead];
        polygon([point(0.12,1.05),point(0.52,1.05),point(0.45,1.22),point(0.18,1.22)], '#26333d');
        polygon([point(0.22,1.22),point(0.43,1.22),point(0.42,1.37),point(0.25,1.40)], '#b78c6b');
      }
    }
    if (detailed && actor.doorUntil > elapsed) {
      const openness = Math.sin(Math.min(1,(actor.doorUntil-elapsed)/0.9)*Math.PI);
      const sign = actor.doorSide || 1;
      const across = sign * (1.06 + openness * 0.48);
      const doorAngle = actor.angle + sign * openness * 0.85;
      const x=actor.x+side.x*across+front.x*0.25, z=actor.z+side.z*across+front.z*0.25;
      box(x,z,0.09,1.25,0.48,doorAngle,paint,0.45);
      box(x,z,0.065,1.12,0.36,doorAngle,['#96afb6','#66838d','#486370'],0.94,0.85);
    }
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

  function signText(label, point, ink, sortDepth) {
    const view = cameraPoint(point);
    if (view[2] < 2 || view[2] > 28) return;
    const [x, y] = project(view);
    if (x < 0 || x > width || y < 0 || y > height) return;
    const size = clamp(focal * 0.29 / view[2], 6, 15);
    faces.push({ depth: sortDepth ?? view[2] - 0.22, text: label, x, y, size, maxWidth: focal * 4.45 / view[2], color: ink });
  }

  function drawShop(b, x, z) {
    const [label, trim, accent] = shops[b.storefront];
    const west = eye.x < x;
    const wallX = west ? b.x - 0.028 : b.x + b.w + 0.028;
    const offset = west ? -1 : 1;
    const frontDepth = cameraPoint([wallX, b.h / 2, z])[2] - 0.12;
    const facade = (left, low, span, tall, color, depth = 0) => {
      const side = wallX + offset * depth;
      polygon([[side, low, z + left], [side, low, z + left + span],
        [side, low + tall, z + left + span], [side, low + tall, z + left]], color, false, frontDepth - depth);
    };
    facade(-2.45, 0.06, 4.9, 2.55, trim);
    facade(-2.23, 0.42, 1.36, 1.48, '#344f54', 0.034);
    facade(0.88, 0.42, 1.34, 1.48, '#394f57', 0.034);
    facade(-0.54, 0.07, 1.08, 1.84, '#233d48', 0.055);
    facade(-0.46, 0.8, 0.92, 0.98, '#6e979e', 0.08);
    for (const edge of [-1.58, 1.52]) facade(edge, 0.4, 0.064, 1.52, accent, 0.058);
    facade(-2.38, 2.01, 4.76, 0.43, '#22333e', 0.055);
    if (Math.abs(eye.x - wallX) > Math.abs(eye.z - z) * 0.65) {
      signText(label, [wallX + offset * 0.16, 2.17, z], accent, frontDepth - 0.16);
    }
    for (let i = 0; i < 7; i += 1) {
      const start = z - 2.46 + i * 0.71;
      polygon([[wallX, 1.98, start], [wallX, 1.98, start + 0.71],
        [wallX + offset * 0.82, 1.78, start + 0.71], [wallX + offset * 0.82, 1.78, start]],
      i % 2 ? '#c1c0aa' : trim, false, frontDepth - 0.12);
    }
  }

  function drawBuilding(b) {
    const x = b.x + b.w / 2;
    const z = b.z + b.d / 2;
    box(x, z, b.w, b.d, b.h, 0, [roofs[b.shade], walls[b.shade], darkWalls[b.shade]]);
    if (Math.hypot(x - eye.x, z - eye.z) > 47) return;
    if (b.storefront !== undefined) drawShop(b, x, z);
    if (b.shade % 2 === 0) {
      const strip = b.shade === 0 ? ['#e9a6d4', '#b6609b', '#7b4b81'] : ['#94efee', '#489ab0', '#326d83'];
      box(x, b.z + b.d + 0.06, b.w * 0.48, 0.15, 0.23, 0, strip, 1.55);
      box(x, b.z - 0.06, b.w * 0.48, 0.15, 0.23, 0, strip, 1.55);
    }
    box(x, z, b.w + 0.22, b.d + 0.22, 0.24, 0, ['#647184', '#4c5268', '#3a435b'], b.h - 0.08);
    box(x + 1.1, z - 0.55, 2.3, 1.7, 0.85, 0, ['#71849a', '#4d5b73', '#36465c'], b.h + 0.15);
    const nearDetail = Math.hypot(x - eye.x, z - eye.z) < 30;
    if (nearDetail) {
      const stone = ['#aaa79a','#827f76','#716f69'];
      for (let floor=3.8;floor<b.h-1;floor+=2.1) box(x,z,b.w+0.18,b.d+0.18,0.10,0,stone,floor);
      if (b.shade % 2 === 1) {
        for (let floor=2.1;floor<b.h-1.25;floor+=2.1) {
          const balconyZ=b.z+b.d+0.4;
          box(x,balconyZ,2.25,0.8,0.14,0,stone,floor-0.16);
          box(x,balconyZ+0.36,2.25,0.06,0.07,0,['#596d74','#3e5159','#2c414c'],floor+0.55);
          for(const offset of [-1,-.5,0,.5,1]) box(x+offset,balconyZ+0.36,.045,.045,.65,0,['#596d74','#3e5159','#2c414c'],floor-0.1);
        }
      }
      box(x,z,b.w+0.10,b.d+0.10,0.35,0,stone,0.02);
      box(x,z,b.w+0.14,b.d+0.14,0.15,0,stone,1.48);
      for (const edge of [-1,1]) box(x+edge*(b.w/2-0.14),z,0.28,b.d+0.12,b.h-0.3,0,stone,0.16);
      if (b.storefront === undefined) {
        for (const sign of [-1,1]) {
          const doorZ=z+sign*(b.d/2+0.045);
          box(x,doorZ,1.28,0.08,1.85,0,['#3e5359','#30434b','#24343c'],0.16);
          box(x,doorZ+sign*0.22,1.65,0.60,0.16,0,stone,2.05);
          box(x,doorZ+sign*0.18,1.5,0.48,0.12,0,stone,0.02);
          box(x+0.42,doorZ+sign*0.06,0.07,0.04,0.20,0,['#d5ba7f','#b99c62','#a28d67'],0.92);
        }
      }
    }
    const frontZ = eye.z >= z ? b.z + b.d + 0.025 : b.z - 0.025;
    const sideX = eye.x >= x ? b.x + b.w + 0.025 : b.x - 0.025;
    for (let level = 2.1; level < b.h - 1.25; level += 2.1) {
      for (let i = 1.4; i < b.w - 1; i += 2.05) {
        const left = b.x + i;
        let paneDepth = cameraPoint([left+0.43,level+0.45,frontZ])[2]-1.2;
        const pane = (points,color) => polygon(points,color,false,paneDepth-=0.001);
        const color = Math.floor(i + level + b.x) % 3 ? '#4e5d60' : '#728289';
        pane([[left - 0.08, level - 0.08, frontZ], [left + 0.94, level - 0.08, frontZ],
          [left + 0.94, level + 0.98, frontZ], [left - 0.08, level + 0.98, frontZ]], '#b0aaa0');
        pane([[left, level, frontZ], [left + 0.86, level, frontZ],
          [left + 0.86, level + 0.9, frontZ], [left, level + 0.9, frontZ]], color);
        if (nearDetail) {
          box(left+0.43,frontZ,1.08,0.24,0.09,0,['#b6b2a5','#8c8d86','#777e7d'],level-0.09);
          pane([[left+0.40,level,frontZ],[left+0.46,level,frontZ],[left+0.46,level+0.90,frontZ],[left+0.40,level+0.90,frontZ]],'#adb3ae');
          pane([[left+0.06,level+0.61,frontZ],[left+0.35,level+0.61,frontZ],[left+0.35,level+0.82,frontZ],[left+0.06,level+0.82,frontZ]],'#92a8ac');
        }
      }
      if (b.storefront !== undefined && level < 3) continue;
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

  function drawStreetDetails() {
    for (const x of roads) {
      for (const z of roads) {
        if (Math.hypot(x - camera.x, z - camera.z) > 29) continue;
        const postX = x + 5.35;
        const postZ = z - 5.35;
        box(postX, postZ, 0.12, 0.12, 3.25, 0, ['#68757a', '#506067', '#3d4d55']);
        box(postX - 0.72, postZ, 1.5, 0.1, 0.11, 0, ['#727c7f', '#58666a', '#404f55'], 3.11);
        box(postX - 1.37, postZ, 0.31, 0.29, 0.67, 0, ['#475052', '#323d42', '#263339'], 2.55);
        const green = (Math.floor(elapsed / 6) + Math.round(x / 28)) % 2;
        box(postX - 1.37, postZ + 0.15, 0.13, 0.04, 0.12, 0,
          green ? ['#a1e3a0', '#75c483', '#639b6d'] : ['#fb9a89', '#df675d', '#b65454'], green ? 2.6 : 3);
        box(x + 5.42, z + 5.51, 0.42, 0.43, 0.71, 0, ['#687d78', '#486360', '#3a514f']);
        box(x + 5.42, z + 5.51, 0.47, 0.49, 0.11, 0, ['#91a19b', '#677d77', '#4c6562'], 0.7);
      }
    }
  }

  function drawFerry() {
    const x = -15;
    const z = 24 + Math.sin(elapsed * 0.021) * 35;
    if (camera.x > 49 || Math.abs(camera.z - z) > 77) return;
    flat(x - 2.2, z - 12, 0.3, 25, '#bdcacc38');
    flat(x + 2, z - 9, 0.28, 21, '#bdcacc38');
    box(x, z, 4.5, 12, 1.12, 0, ['#77858d', '#43596b', '#334857'], 0, 0.94);
    box(x, z + 0.25, 4.1, 9.7, 0.22, 0, ['#d4d8c9', '#a9b4ae', '#839c9a'], 1.11);
    box(x, z - 1.5, 3.15, 4.9, 1.68, 0, ['#d4d9ce', '#bdc9c2', '#9aaba9'], 1.34, 0.91);
    box(x, z - 2, 3.01, 3.4, 0.26, 0, ['#67889a', '#496c82', '#3e5b71'], 2.74);
    box(x, z + 1.5, 0.33, 0.39, 1.35, 0, ['#7f929a', '#657c84', '#4c686f'], 2.25);
  }

  function drawDocks() {
    if (camera.x < size - 60) return;
    box(size + 5, 291, 8, 12, 4.4, 0, ['#415b73', '#263d55', '#30445d']);
    box(size + 0.94, 291, 0.08, 7.5, 3.55, 0,
      lost ? ['#ffd68c', '#cb944c', '#edb866'] : ['#70859b', '#364c65', '#415a73']);
    box(size + 0.85, 291, 0.16, 8.4, 0.28, 0,
      lost ? ['#fff1b6', '#ffcc72', '#ffdf8c'] : ['#7099a9', '#385c70', '#51788c'], 3.68);
    for (let i = 0; i < 6; i += 1) {
      box(size + 6 + (i % 2) * 3.2, 229 + i * 7.4, 2.8, 6.1, 2.8, 0,
        i % 2 ? ['#aa715a', '#814d49', '#643941'] : ['#5d8c99', '#416d80', '#315365']);
    }
    for (const z of [234, 266]) {
      box(size + 15, z, 1.1, 1.2, 13, 0, ['#ccaa84', '#967e69', '#675f66']);
      box(size + 10, z, 11, 1.05, 0.8, 0, ['#c39d76', '#987657', '#695263'], 12.1);
      box(size + 5, z, 0.16, 0.16, 4, 0, ['#9aa7bb', '#586479', '#475163'], 8.2);
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
    const scale = mapSize / 91;
    const left = clamp(active.x - 45.5, 0, size - 91);
    const top = clamp(active.z - 45.5, 0, size - 91);
    const x = width - mapSize - 10;
    const y = height - mapSize - 10;
    context.save();
    context.beginPath();
    context.rect(x, y, mapSize, mapSize);
    context.clip();
    context.fillStyle = '#111b2de8';
    context.fillRect(x, y, mapSize, mapSize);
    context.strokeStyle = '#698097';
    context.strokeRect(x, y, mapSize, mapSize);
    context.fillStyle = '#354459';
    for (const b of blocks) if (b.x + b.w >= left && b.x < left + 91 && b.z + b.d >= top && b.z < top + 91) context.fillRect(x + (b.x - left) * scale, y + (b.z - top) * scale, b.w * scale, b.d * scale);
    context.fillStyle = '#263a50';
    for (const road of roads) {
      context.fillRect(x + (road - 3 - left) * scale, y, 6 * scale, mapSize);
      context.fillRect(x, y + (road - 3 - top) * scale, mapSize, 6 * scale);
    }
    const dots = [];
    if (!inCar) for (const vehicle of vehicles) if(!vehicle.destroyed) dots.push([vehicle, '#79f1c6']);
    if (!activeJob) for(const pickup of weaponPickups) if(elapsed >= (pickup.readyAt || 0)) dots.push([pickup,'#ffd48a']);
    if (heatLevel) dots.push([patrol, '#ff6179']);
    if (heatLevel > 1) dots.push([backup, '#ff6179']);
    const target = objectiveTarget();
    if (target && target !== car) dots.push([target, '#ffd373']);
    for (const [point, color] of dots) {
      context.beginPath();
      context.fillStyle = color;
      context.arc(clamp(x + (point.x - left) * scale, x + 3, x + mapSize - 3), clamp(y + (point.z - top) * scale, y + 3, y + mapSize - 3), 3, 0, Math.PI * 2);
      context.fill();
    }
    const ax = x + (active.x - left) * scale;
    const ay = y + (active.z - top) * scale;
    const direction = facing(active.angle);
    fill([[ax + direction.x * 6, ay + direction.z * 6],
      [ax - direction.x * 4 - direction.z * 3.5, ay - direction.z * 4 + direction.x * 3.5],
      [ax - direction.x * 4 + direction.z * 3.5, ay - direction.z * 4 - direction.x * 3.5]], '#f3fbff');
    context.restore();
  }

  function drawSpuddy() {
    const forward = facing(player.angle), right = facing(player.angle + Math.PI / 2);
    const stride = Math.sin(walkCycle) * walkBlend;
    const bob = Math.abs(stride) * 0.012;
    const front = window.HarborSpuddy?.view(1).sprite;
    const back = window.HarborSpuddy?.view(-1).sprite;
    const skin = ['#dfb37c', '#bf8d5b', '#94643f'];
    const cloth = ['#57768f', '#3a546e', '#293d55'];
    const denim = ['#405b77', '#304760', '#22364c'];
    const shoe = ['#40546a', '#293b50', '#1b2a3c'];
    const position = (x,y,z) => {
      const lean = Math.max(0,y-0.6)*walkBlend*(0.045+clamp(visualSpeed/11,0,1)*0.045);
      const bank = Math.max(0,y-0.55)*turnLean*0.16;
      x *= 1 + stats.build*0.14 + stats.muscle*0.035;
      return [player.x+right.x*(x+bank)+forward.x*(z+lean),y,player.z+right.z*(x+bank)+forward.z*(z+lean)];
    };
    // Rounded ring meshes retain thickness at every heading. Front/back artwork
    // is wrapped onto the head and jacket rather than scaled as a billboard.
    function rounded(rings, colors, crop) {
      const sides = crop ? 16 : 10;
      const vertices = rings.map(([x,y,z,rx,rz]) => Array.from({length:sides},(_,i) => {
        const angle = i / sides * Math.PI * 2;
        return position(x + Math.cos(angle)*rx,y,z + Math.sin(angle)*rz);
      }));
      for(let row=1;row<rings.length;row++) for(let i=0;i<sides;i++) {
        const next=(i+1)%sides, angle=(i+0.5)/sides*Math.PI*2;
        const nx=right.x*Math.cos(angle)+forward.x*Math.sin(angle);
        const nz=right.z*Math.cos(angle)+forward.z*Math.sin(angle);
        const center=vertices[row][i];
        if(nx*(eye.x-center[0])+nz*(eye.z-center[2]) < 0) continue;
        const points=[vertices[row-1][i],vertices[row-1][next],vertices[row][next],vertices[row][i]];
        const light=-0.62*nx+0.78*nz;
        const count=faces.length;
        polygon(points,colors[light>0.44?0:light< -0.32?2:1]);
        if(crop && Math.abs(Math.sin(angle)) > 0.6 && faces.length>count && points.every(p=>cameraPoint(p)[2]>1)) {
          const texture=Math.sin(angle)>=0?front:back;
          if(texture) {
            const [sx,sy,sw,sh]=crop;
            const u=j=>sx+(Math.cos(j/sides*Math.PI*2)+1)*0.5*sw;
            const v=r=>sy+(1-(rings[r][1]-rings[0][1])/(rings.at(-1)[1]-rings[0][1]))*sh;
            faces[faces.length-1].texture=texture;
            faces[faces.length-1].uv=[[u(i),v(row-1)],[u(next),v(row-1)],[u(next),v(row)],[u(i),v(row)]];
          }
        }
      }
      polygon(vertices.at(-1),colors[0]);
    }
    for(const sign of [-1,1]) {
      const step=sign*stride, lift=Math.max(0,step)*0.13;
      const index = sign < 0 ? 0 : 1;
      let x=sign*0.14, z=step*0.19;
      if (step <= 0 && walkBlend > 0.1) {
        const plant = footPlants[index];
        if (!plant || Math.hypot(plant.x-player.x,plant.z-player.z)>0.42) footPlants[index] = {x:player.x+right.x*x+forward.x*z,z:player.z+right.z*x+forward.z*z};
        const planted = footPlants[index];
        x = (planted.x-player.x)*right.x+(planted.z-player.z)*right.z;
        z = (planted.x-player.x)*forward.x+(planted.z-player.z)*forward.z;
      } else footPlants[index]=null;
      rounded([[x,0.008+lift,z+0.035,0.095,0.17],[x,0.045+lift,z+0.035,0.095,0.17]],['#d2dce1','#b7c6d0','#8799aa']);
      rounded([[x,0.045+lift,z+0.035,0.09,0.165],[x,0.12+lift,z+0.025,0.085,0.14],[x,0.16+lift,z,0.06,0.08]],shoe);
      rounded([[x,0.14+lift,z,0.07,0.075],[x,0.38+lift*0.4, Math.max(0,step)*0.12,0.085,0.085],[x,0.66+bob,0,0.10,0.10]],denim);
      const armZ=-step*0.19;
      rounded([[sign*0.30,0.75+bob,armZ+0.035,0.055,0.06],[sign*0.32,0.85+bob,armZ-0.025,0.065,0.07],[sign*0.30,0.96+bob,armZ*0.4,0.075,0.08],[sign*0.27,1.07+bob,0,0.085,0.09]],cloth);
      rounded([[sign*0.30,0.68+bob,armZ+0.035,0.025,0.035],[sign*0.30,0.72+bob,armZ+0.035,0.065,0.065],[sign*0.30,0.78+bob,armZ+0.035,0.055,0.055]],skin);
    }
    rounded([[0,0.62+bob,0,0.20,0.14],[0,0.73+bob,0,0.24,0.17],[0,0.93+bob,0,0.25,0.18],[0,1.10+bob,0,0.22,0.16],[0,1.16+bob,0,0.14,0.12]],cloth,[88,174,126,130]);
    // A raised hood and cuffs give the jacket a readable silhouette from behind.
    rounded([[0,1.00+bob,-0.15,0.13,0.045],[0,1.07+bob,-0.17,0.17,0.075],[0,1.15+bob,-0.11,0.14,0.06]],cloth);
    rounded([[0,1.12+bob,0,0.10,0.09],[0,1.18+bob,0,0.20,0.16],[0,1.29+bob,0,0.25,0.21],[0,1.48+bob,0,0.26,0.22],[0,1.64+bob,0,0.23,0.20],[0,1.73+bob,0,0.15,0.13],[0,1.76+bob,0,0.025,0.025]],skin,[80,28,143,158]);
    // Small dimensional nose keeps the face readable in a three-quarter view.
    rounded([[0,1.37+bob,0.212,0.025,0.025],[0,1.40+bob,0.24,0.044,0.048],[0,1.44+bob,0.22,0.024,0.024]],skin);
  }

  function textureTriangle(texture, dest, uv) {
    const [a,b,c]=uv, [p,q,r]=dest;
    const det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
    if(Math.abs(det)<0.01) return;
    const ax=((q[0]-p[0])*(c[1]-a[1])-(r[0]-p[0])*(b[1]-a[1]))/det;
    const bx=((r[0]-p[0])*(b[0]-a[0])-(q[0]-p[0])*(c[0]-a[0]))/det;
    const ay=((q[1]-p[1])*(c[1]-a[1])-(r[1]-p[1])*(b[1]-a[1]))/det;
    const by=((r[1]-p[1])*(b[0]-a[0])-(q[1]-p[1])*(c[0]-a[0]))/det;
    context.save(); context.beginPath();context.moveTo(...p);context.lineTo(...q);context.lineTo(...r);context.closePath();context.clip();
    context.transform(ax,ay,bx,by,p[0]-ax*a[0]-bx*a[1],p[1]-ay*a[0]-by*a[1]);
    context.drawImage(texture,0,0); context.restore();
  }

  function drawPerson(person, stride, jacket, aiming = false) {
    const forward = facing(person.angle);
    const right = facing(person.angle + Math.PI / 2);
    const position = (x, y, z) => [
      person.x + right.x * x + forward.x * (z + y * Math.sin(person.tilt || 0)),
      y * Math.cos(person.tilt || 0) + (person.elevation || 0),
      person.z + right.z * x + forward.z * (z + y * Math.sin(person.tilt || 0)),
    ];
    const cloth = ['#7792a3', '#506a80', '#34495e'];
    const skin = ['#dfab83', '#bf8864', '#a46c52'];
    const hair = ['#4e3933', '#3c2c2a', '#302323'];
    const shoes = ['#505b63', '#333d47', '#252d38'];
    const sole = ['#c2beb1', '#a6a49c', '#858a86'];
    const bodyBob = Math.abs(stride) * 0.11;
    const sides = 8;

    // Each ring contains its center and horizontal radii. Offset centers bend joints and taper silhouettes.
    function mesh(rings, colors) {
      const vertices = rings.map(([x, y, z, rx, rz]) => Array.from({ length: sides }, (_, i) => {
        const angle = (i + 0.5) / sides * Math.PI * 2;
        return position(x + Math.cos(angle) * rx, y, z + Math.sin(angle) * rz);
      }));
      for (let level = 1; level < vertices.length; level += 1) {
        for (let side = 0; side < sides; side += 1) {
          const next = (side + 1) % sides;
          const angle = (side + 1) / sides * Math.PI * 2;
          const nx = right.x * Math.cos(angle) + forward.x * Math.sin(angle);
          const nz = right.z * Math.cos(angle) + forward.z * Math.sin(angle);
          const center = vertices[level][side];
          if (nx * (eye.x - center[0]) + nz * (eye.z - center[2]) < -0.06) continue;
          const light = -0.62 * nx + 0.78 * nz;
          polygon([vertices[level - 1][side], vertices[level - 1][next],
            vertices[level][next], vertices[level][side]], colors[light > 0.44 ? 0 : light < -0.32 ? 2 : 1]);
        }
      }
      polygon(vertices[vertices.length - 1], colors[0]);
    }

    for (const sign of [-1, 1]) {
      const step = sign * stride;
      const x = sign * 0.105;
      const lift = Math.max(0, -step) * 0.56;
      mesh([[x, lift + 0.012, step + 0.067, 0.077, 0.151],
        [x, lift + 0.046, step + 0.067, 0.078, 0.151]], sole);
      mesh([[x, lift + 0.045, step + 0.066, 0.074, 0.146],
        [x, lift + 0.117, step + 0.041, 0.065, 0.105],
        [x, lift + 0.14, step, 0.056, 0.072]], shoes);
      mesh([[x, lift + 0.119, step, 0.058, 0.064],
        [x, 0.34 + lift * 0.56, step * 0.77 - 0.04, 0.072, 0.076],
        [x, 0.49 + lift * 0.32, step * 0.64 + 0.015, 0.084, 0.082],
        [x, 0.68, step * 0.3, 0.096, 0.099],
        [x, 0.86 + bodyBob, 0, 0.112, 0.115]], cloth);
    }
    mesh([[0, 0.75 + bodyBob, 0, 0.203, 0.117], [0, 0.96 + bodyBob, 0, 0.197, 0.12]], cloth);
    mesh([[0, 0.92 + bodyBob, -0.015, 0.197, 0.122], [0, 1.08 + bodyBob, 0, 0.198, 0.123],
      [0, 1.32 + bodyBob, 0.01, 0.257, 0.135], [0, 1.45 + bodyBob, 0.009, 0.228, 0.115],
      [0, 1.51 + bodyBob, 0.01, 0.11, 0.089]], jacket);
    for (const sign of [-1, 1]) {
      const shoulder = sign * 0.235;
      const swing = -sign * stride * 0.66;
      const reach = aiming && sign === 1 ? 0.26 : 0;
      const elbowY = 1.09 + bodyBob + reach * 0.43;
      const handY = 0.91 + bodyBob + reach * 1.55;
      mesh([[shoulder * 1.21, elbowY, swing * 0.56 + reach, 0.066, 0.066],
        [shoulder * 1.26, 1.25 + bodyBob, swing * 0.23 + reach * 0.48, 0.079, 0.077],
        [shoulder, 1.44 + bodyBob, 0, 0.086, 0.086]], jacket);
      mesh([[shoulder * 1.15, handY, swing + reach * 2.05, 0.043, 0.056],
        [shoulder * 1.23, (handY + elbowY) / 2, swing * 0.84 + reach * 1.55, 0.055, 0.06],
        [shoulder * 1.21, elbowY, swing * 0.56 + reach, 0.062, 0.064]], skin);
      if (reach) {
        mesh([[shoulder * 1.15, handY - 0.036, reach * 2.03, 0.036, 0.046],
          [shoulder * 1.15, handY + 0.054, reach * 2.13, 0.034, 0.10]], ['#505861', '#323942', '#252c34']);
      }
    }
    mesh([[0, 1.47 + bodyBob, 0.013, 0.082, 0.07], [0, 1.6 + bodyBob, 0.023, 0.067, 0.07]], skin);
    mesh([[0, 1.55 + bodyBob, 0.025, 0.071, 0.079], [0, 1.61 + bodyBob, 0.035, 0.104, 0.094],
      [0, 1.72 + bodyBob, 0.026, 0.127, 0.117], [0, 1.82 + bodyBob, 0.017, 0.12, 0.111],
      [0, 1.86 + bodyBob, 0.01, 0.085, 0.085]], skin);
    mesh([[0, 1.76 + bodyBob, -0.014, 0.126, 0.104], [0, 1.86 + bodyBob, 0.004, 0.126, 0.109],
      [0, 1.907 + bodyBob, 0.002, 0.086, 0.08]], hair);
    const frontal = forward.x * (eye.x - person.x) + forward.z * (eye.z - person.z);
    if (frontal > 0.2 && distance(person, camera) < 13) {
      for (const sign of [-1, 1]) {
        const x = sign * 0.047;
        polygon([position(x - 0.021, 1.717 + bodyBob, 0.139), position(x + 0.021, 1.717 + bodyBob, 0.139),
          position(x + 0.016, 1.736 + bodyBob, 0.139), position(x - 0.02, 1.735 + bodyBob, 0.139)], '#4c3530');
      }
      polygon([position(-0.028, 1.7 + bodyBob, 0.134), position(0.026, 1.686 + bodyBob, 0.136),
        position(0, 1.694 + bodyBob, 0.171), position(0, 1.742 + bodyBob, 0.14)], '#d49b73');
      polygon([position(-0.03, 1.642 + bodyBob, 0.129), position(0.03, 1.642 + bodyBob, 0.129),
        position(0.021, 1.629 + bodyBob, 0.125), position(-0.021, 1.63 + bodyBob, 0.125)], '#814c43');
    }
    if (frontal > 0) {
      polygon([position(-0.081, 1.49 + bodyBob, 0.083), position(0.081, 1.49 + bodyBob, 0.083),
        position(0.024, 1.32 + bodyBob, 0.14), position(-0.025, 1.32 + bodyBob, 0.14)], '#d6d4c8');
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
    focal = Math.min(width * (inCar ? 0.97 : 0.88), height * 0.95);
    eye.cosine = Math.cos(camera.angle);
    eye.sine = Math.sin(camera.angle);
    eye.x = camera.x - eye.sine * camera.distance;
    eye.z = camera.z + eye.cosine * camera.distance;
    eye.y = Math.min(5, 2.6 + camera.distance * 0.19) + cameraLift;
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
    flat(-140, -140, size + 280, size + 280, '#65818a');
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
    flat(-0.65, 0, 0.65, size, '#aeb1a1');
    flat(size, 0, 0.65, size, '#aeb1a1');
    for (let z = 4; z < size; z += 7) {
      if (Math.abs(camera.z - z) < 50) {
        flat(-2.1, z, 1.55, 0.16, '#c4d1c52f');
        flat(size + 0.65, z + 2, 1.15, 0.16, '#c4d1c52f');
      }
    }
    flat(329.2, 0, 10.8, size, '#697c54');
    if (camera.x > size - 78) flat(size, 224, 20, 79, '#858980');
    for (const park of parks) if (distance(park, camera) < 85) flat(park.x - 8, park.z - 8, 16, 16, '#738357');
    for (const road of roads) {
      flat(road - 5.15, 0, 10.3, size, '#a3a49a');
      flat(0, road - 5.15, size, 10.3, '#a3a49a');
    }
    for (const road of roads) {
      flat(road - 4.6, 0, 9.2, size, '#676a6b');
      flat(0, road - 4.6, size, 9.2, '#676a6b');
      const start = Math.max(2, 2 + Math.floor((Math.min(camera.x, camera.z) - 52) / 5) * 5);
      const end = Math.min(size - 2, Math.max(camera.x, camera.z) + 54);
      for (let offset = start; offset < end; offset += 5) {
        if (roads.some(cross => Math.abs(cross - offset) < 5)) continue;
        if (Math.abs(road - camera.x) < 54 && Math.abs(offset - camera.z) < 54) flat(road - 0.09, offset, 0.18, 2.1, '#b9b4a0');
        if (Math.abs(road - camera.z) < 54 && Math.abs(offset - camera.x) < 54) flat(offset, road - 0.09, 2.1, 0.18, '#b9b4a0');
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
    const routeMarker = objectiveTarget();
    if (routeMarker && routeMarker !== car) {
      const { x, z } = routeMarker;
      const radius = routeMarker.kind === 'shoot' ? 1.4 : 3.6;
      groundGlow(x, z, radius + 1, '#f4be5573');
      for (const sign of [-1, 1]) {
        flat(x - radius, z + sign * radius, radius * 2, 0.16, '#ffe4a0');
        flat(x + sign * radius, z - radius, 0.16, radius * 2, '#ffe4a0');
      }
    }
    const nearbyLamps = lamps.filter(lamp => distance(lamp, camera) < 52);

    const front = facing(car.angle);
    groundGlow(car.x, car.z, 1.7, '#0b112659');
    if (!inCar) groundGlow(player.x, player.z, 0.34, '#07102080');
    if (heatLevel) groundGlow(patrol.x, patrol.z, 4.2, elapsed % 0.55 < 0.275 ? '#ff54756d' : '#619cff6d');
    groundGlow(car.x - front.x * 2.4, car.z - front.z * 2.4, 2.8, '#ff45582b');
    if (inCar) groundGlow(car.x + front.x * 4.2, car.z + front.z * 4.2, 3.7, '#e3f3ff1e');
    faces = [];
    scenery = true;
    for (const lamp of nearbyLamps) {
      if (lamp.brokenAt !== null) {
        const t = clamp((elapsed-lamp.brokenAt)/0.65,0,1);
        const tilt = t*t*Math.PI/2;
        const dir = facing(lamp.fallAngle);
        const right = facing(lamp.fallAngle+Math.PI/2);
        const base = [lamp.x,0.15,lamp.z];
        const tip = [lamp.x+dir.x*4.5*Math.sin(tilt),0.15+4.5*Math.cos(tilt),lamp.z+dir.z*4.5*Math.sin(tilt)];
        const corners = (p) => [[p[0]+right.x*.1,p[1]+.08,p[2]+right.z*.1],[p[0]-right.x*.1,p[1]+.08,p[2]-right.z*.1],[p[0]-right.x*.1,p[1]-.08,p[2]-right.z*.1],[p[0]+right.x*.1,p[1]-.08,p[2]+right.z*.1]];
        const a=corners(base), b=corners(tip);
        for(let i=0;i<4;i++) polygon([a[i],a[(i+1)%4],b[(i+1)%4],b[i]], i%2?'#354858':'#637687');
        box(tip[0],tip[2],0.6,0.45,0.18,lamp.fallAngle,['#727a7c','#454f57','#303b45'],tip[1]);
        box(lamp.x,lamp.z,.3,.3,.18,0,['#8d8d81','#666d68','#4d5857']);
        continue;
      }
      box(lamp.x, lamp.z, 0.18, 0.18, 4.6, 0, ['#576981', '#3d5064', '#293f54']);
      box(lamp.x, lamp.z, 0.6, 0.45, 0.18, 0, ['#ffd795', '#ffca7a', '#d49753'], 4.55);
    }
    // Visible seawalls and bollards mark the playable shoreline.
    for(let offset=4;offset<size;offset+=8) for(const p of [{x:offset,z:1},{x:offset,z:size-1},{x:1,z:offset},{x:size-1,z:offset}]) {
      if(distance(p,camera)>85) continue;
      box(p.x,p.z,0.55,0.55,0.85,0,['#d2c6a4','#8e958e','#626e70']);
    }
    if(!activeJob) for(const pickup of weaponPickups) if(elapsed >= (pickup.readyAt || 0) && distance(pickup,camera)<55) {
      const lift=0.55+Math.sin(elapsed*3)*0.12;
      box(pickup.x,pickup.z,1.2,1.2,0.12,0,['#81e9c5','#368f7a','#22594f'],0.03);
      const tint=pickup.type===2?['#ffe3a2','#c99750','#856536']:['#b6ffe2','#43bc98','#256b63'];
      box(pickup.x,pickup.z,0.24,pickup.type===2?1.25:0.8,0.23,elapsed*0.7,tint,lift);
      box(pickup.x,pickup.z,0.18,0.25,0.3,elapsed*0.7,['#566779','#354655','#253440'],lift-0.22);

    }
    drawFerry();
    architecture = true;
    for (const b of blocks) if (Math.hypot(b.x - camera.x, b.z - camera.z) < 145) drawBuilding(b);
    architecture = false;
    drawStreetDetails();
    drawViaduct();
    for (const tree of trees) if (distance(tree, camera) < 48) drawTree(tree);
    drawDocks();
    scenery = false;
    for (const vehicle of vehicles) drawCar(vehicle, false);
    drawCar(patrol, true);
    if (heatLevel > 1) drawCar(backup, true);
    if (routeMarker?.kind === 'drive') {
      for (const side of [-1, 1]) box(routeMarker.x + side * 4.25, routeMarker.z, 0.36, 0.36, 2, 0,
        ['#fff0b1', '#d5a45f', '#aa7849']);
    }
    const step = activeJob?.stages[stageIndex];
    if (step?.kind === 'shoot') {
      box(step.x, step.z, 0.14, 0.14, 1.55, 0, ['#414b53', '#34434b', '#2b343d']);
      box(step.x, step.z, 0.8, 0.19, 0.71, 0, ['#ffd99d', '#e58b58', '#af5d47'], 1.18);
    }
    for (const vehicle of traffic) if (distance(vehicle, camera) < 48) drawCar(vehicle, false);
    for (const driver of displacedDrivers) {
      if (driver.age < 25 && distance(driver,camera) < 30) drawPerson(driver, Math.sin(driver.age*13)*0.65, ['#b6a080','#786b56','#5e5548']);
    }
    for (const worker of workers) {
      if (distance(worker, camera) < 23) drawPerson(worker,
        worker.recover > 0 ? 0 : Math.sin(elapsed * 11) * 0.18, worker.jacket);
    }
    for(const peer of window.HarborOnline?.peers() || []) if(peer.health!==0 && distance(peer,camera)<65) {
      if(peer.driving) drawCar(peer,false);
      else drawPerson(peer,Math.sin(elapsed*8)*0.15,['#b2d8ed','#4288ac','#2d5978']);
    }
    if (!inCar) drawSpuddy();
    const subject = inCar ? car : player;
    const subjectView = cameraPoint([subject.x, inCar ? 1.3 : 1.0, subject.z]);
    const subjectScreen = project(subjectView);
    const protectWidth = focal * (inCar ? 1.8 : 0.55) / Math.max(1, subjectView[2]);
    const protectHeight = focal * (inCar ? 1.0 : 1.1) / Math.max(1, subjectView[2]);
    faces.sort((a, b) => b.depth - a.depth);
    for (const face of faces) {
      if (face.particle) {
        context.save();
        context.translate(face.x,face.y);
        context.globalAlpha=face.alpha;
        const w=face.w,h=face.h;
        if(face.particle==='flame') {
          const gradient=context.createLinearGradient(0,0,0,-h);
          gradient.addColorStop(0,'#fff5bc'); gradient.addColorStop(0.3,'#ffc34a');
          gradient.addColorStop(0.68,'#f76b22'); gradient.addColorStop(1,'#c6341200');
          context.fillStyle=gradient;
          context.beginPath(); context.moveTo(-w,0);
          context.bezierCurveTo(-w*1.3,-h*0.4,w*0.4,-h*0.55,w*0.15,-h);
          context.bezierCurveTo(w*1.5,-h*0.5,w*1.2,-h*0.15,w,0);
          context.closePath(); context.fill();
        } else {
          const gradient=context.createRadialGradient(0,0,0,0,0,Math.max(w,h));
          const smoke=face.particle==='smoke';
          gradient.addColorStop(0,smoke?'#55565b': '#ffd577');
          gradient.addColorStop(0.45,smoke?'#62616599':'#ff7b3566');
          gradient.addColorStop(1,smoke?'#75747a00':'#ff6b2400');
          context.fillStyle=gradient;
          context.beginPath(); context.ellipse(0,0,w,h,0,0,Math.PI*2); context.fill();
        }
        context.restore();
      } else if (face.sprite) {
        context.save();
        context.translate(face.x, face.y + face.height);
        const upper = face.height * 0.72;
        const leg = face.height - upper;
        const bounce = Math.abs(face.stride) * face.height * 0.008;
        // Longer legs with alternating foot lift; the planted foot stays at y=0.
        context.drawImage(face.sprite, 0, 0, 300, 304,
          -face.width / 2 + face.stride * face.width * 0.015,
          -face.height - bounce, face.width, upper + bounce);
        for (const side of [-1, 1]) {
          const lift = Math.max(0, face.stride * side) * face.height * 0.035;
          context.drawImage(face.sprite, side < 0 ? 0 : 150, 304, 150, 74,
            side < 0 ? -face.width / 2 : 0, -leg, face.width / 2, leg - lift);
        }
        context.restore();
      } else if (face.points) {
        const obscures = (face.scenery || (!inCar && face.vehicle)) && !face.architecture && face.nearDepth < subjectView[2] - 0.6
          && Math.min(...face.points.map(p => p[0])) < subjectScreen[0] + protectWidth
          && Math.max(...face.points.map(p => p[0])) > subjectScreen[0] - protectWidth
          && Math.min(...face.points.map(p => p[1])) < subjectScreen[1] + protectHeight
          && Math.max(...face.points.map(p => p[1])) > subjectScreen[1] - protectHeight;
        context.globalAlpha = obscures ? 0.35 : 1;
        fill(face.points, face.color);
        // Cover subpixel gaps between tessellated pieces of the same solid wall.
        if (face.buildingSurface) {
          context.strokeStyle = face.color;
          context.lineWidth = 0.65;
          context.stroke();
        }
        if(face.texture) for(const ids of [[0,1,2],[0,2,3]])
          textureTriangle(face.texture,ids.map(i=>face.points[i]),ids.map(i=>face.uv[i]));
        context.globalAlpha = 1;
      }
      else {
        context.font = '700 ' + face.size + 'px system-ui, sans-serif';
        context.textAlign = 'center';
        context.fillStyle = face.color;
        context.fillText(face.text, face.x, face.y, face.maxWidth);
      }
    }
    const target = objectiveTarget();
    if (target) pin(target, target === car ? 3.2 : 3, target === car ? '#79f1c6' : '#ffd373',
      target === car ? 'GETAWAY CAR' : step.kind === 'shoot' ? 'TARGET' : step.kind === 'park' ? 'STOP HERE' : 'CHECKPOINT');
    if (!inCar && phase==='playing') {
      const aim=facing(footView);
      let range=6;
      for(let d=0.5;d<6;d+=0.25) if(blocked(player.x+aim.x*d,player.z+aim.z*d,0.05)) { range=d; break; }
      const view=cameraPoint([player.x+aim.x*range,1.1,player.z+aim.z*range]);
      if(view[2]>0.3) {
        const [x,y]=project(view);
        context.save(); context.strokeStyle='#e8fff0cc'; context.lineWidth=1.5;
        context.beginPath(); context.arc(x,y,6,0,Math.PI*2); context.stroke();
        context.fillStyle='#fff6ce'; context.fillRect(x-1,y-1,2,2); context.restore();
      }
    }
    if (elapsed-shotAt < 0.055 && shotTarget) {
      const start = cameraPoint([player.x, 1.07, player.z]);
      const end = cameraPoint([shotTarget.x, 1.42, shotTarget.z]);
      if (start[2] > 1 && end[2] > 1) {
        context.beginPath();
        context.moveTo(...project(start));
        context.lineTo(...project(end));
        context.strokeStyle = '#ffe6a5';
        context.lineWidth = 2;
        context.stroke();
        if (shotConnected) {
          const [x,y]=project(end);
          context.strokeStyle='#fff0bc';
          context.beginPath();
          for(const sign of [-1,1]) { context.moveTo(x+sign*3,y-3); context.lineTo(x+sign*7,y-7); context.moveTo(x+sign*3,y+3); context.lineTo(x+sign*7,y+7); }
          context.stroke();
        }
      }
    }
    if(!activeJob) for(const pickup of weaponPickups) if(elapsed >= (pickup.readyAt || 0) && distance(pickup,camera)<35 && visible(player,pickup)) pin(pickup,2.2,'#a3ffe0',weapons[pickup.type].name+' · Walk over to equip');
    for(const v of [...vehicles,...traffic]) if(!v.destroyed && elapsed-(v.hitAt ?? -10)<2 && visible(player,v)) pin(v,2.5,'#ffd18c','Integrity '+v.health+'/160');
    for(const peer of window.HarborOnline?.peers() || []) if(peer.health!==0 && distance(peer,camera)<40 && visible(player,peer)) pin(peer,2.5,peer.shield?'#a3ffe0':'#ffb7bb',peer.shield?'LIVE · Protected':'LIVE · '+peer.health+' HP');
    minimap(inCar ? car : player);
  }

  function frame(time) {
    const dt = Math.min((time - (lastTime || time)) / 1000, 0.05);
    lastTime = time;
    if (phase === 'playing') {
      update(dt);
      updateAudio();
    }
    render();
    requestAnimationFrame(frame);
  }

  document.addEventListener('keydown', event => {
    if (event.target?.closest?.('input, select, textarea, [contenteditable=true]')) return;
    const action = bindings[event.code];
    if (action && phase === 'playing' && !(action === 'brake' && (!inCar || event.target?.closest?.('button, a')))) {
      event.preventDefault();
      keys.add(action);
    } else if (event.code === 'KeyF') { keys.add('fire'); if (!event.repeat) shoot(); }
    else if (event.code === 'KeyE' && !event.repeat) interact();
    else if (event.code === 'Escape' && !event.repeat) pause();
  });
  document.addEventListener('keyup', event => keys.delete(event.code === 'KeyF' ? 'fire' : bindings[event.code]));
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
    for (const touch of Array.from(event.changedTouches)) {
      if (!dragTouch && !cameraMode && !lookTouch) {
        pointers.clear();
        dragTouch = { id: touch.identifier, x: touch.clientX, y: touch.clientY, dx: 0, dy: 0, heading: camera.angle };
      } else if (!lookTouch) {
        lookTouch = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
        manualLookUntil = elapsed + 2;
      }
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', event => {
    if (!dragTouch && !lookTouch) return;
    event.preventDefault();
    for (const touch of Array.from(event.changedTouches)) {
      if (touch.identifier === dragTouch?.id) {
        dragTouch.dx = touch.clientX - dragTouch.x;
        dragTouch.dy = touch.clientY - dragTouch.y;
      } else if (touch.identifier === lookTouch?.id) {
        lookBy((lookTouch.x - touch.clientX) * 0.007, (touch.clientY - lookTouch.y) * 0.012);
        lookTouch.x = touch.clientX; lookTouch.y = touch.clientY;
      }
    }
  }, { passive: false });
  function endTouch(event) {
    for (const touch of Array.from(event.changedTouches)) {
      if (touch.identifier === dragTouch?.id) { dragTouch = null; footHeading = null; }
      if (touch.identifier === lookTouch?.id) { lookTouch = null; manualLookUntil = elapsed + 2; }
    }
    if (event.touches.length === 0) {
      pointers.clear(); lookPointer = null; dragTouch = null; lookTouch = null;
    }
  }
  for (const type of ['touchend', 'touchcancel']) document.addEventListener(type, endTouch, true);
  element('focus-view').addEventListener('click', () => {
    const active = document.body.classList.toggle('focus-game');
    element('focus-view').textContent = active ? 'Exit focus' : 'Focus view';
    element('focus-view').setAttribute('aria-pressed', String(active));
  });
  let settingsPaused = false;
  const settingsPanel = element('spuddy-settings');
  settingsPanel.addEventListener('toggle', () => {
    if (settingsPanel.open && phase === 'playing') { settingsPaused = true; pause(); }
    else if (!settingsPanel.open && settingsPaused) {
      settingsPaused = false;
      if (phase === 'paused') run();
    }
  });
  element('return-game').addEventListener('click', () => {
    settingsPanel.open = false;
    canvas.scrollIntoView({behavior:'smooth',block:'start'});
  });
  for (const key of ['build','muscle']) {
    const control = element('stat-'+key);
    control.value = Math.round(stats[key]*100);
    element('value-'+key).textContent = control.value + '%';
    control.addEventListener('input', () => {
      stats[key] = clamp(Number(control.value)/100,0,1);
      element('value-'+key).textContent = Math.round(stats[key]*100) + '%';
      saveFitness();
    });
  }
  element('run-mode').addEventListener('click', () => {
    if (phase !== 'playing' || inCar) return;
    runEnabled = !runEnabled;
    element('run-mode').textContent = runEnabled ? 'Walk' : 'Run';
    element('run-mode').setAttribute('aria-pressed', String(runEnabled));
    notify(runEnabled ? 'Running · drag to move' : 'Walking');
  });
  element('camera-mode').addEventListener('click', () => {
    clearControls();
    cameraMode = !cameraMode;
    if (!cameraMode) {
      footView = player.angle; driveLook = 0; cameraLift = 0; manualLookUntil = 0;
    }
    element('camera-mode').textContent = cameraMode ? 'Follow camera' : 'Look around';
    element('camera-mode').setAttribute('aria-pressed', String(cameraMode));
    notify(cameraMode ? 'Drag to look around · tap Follow camera to move again' : 'Camera following');
  });

  function clearPointer(event) {
    firePointers.delete(event.pointerId);
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
    lookY = event.clientY ?? 0;
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== lookPointer) return;
    lookBy((lookX - event.clientX) * 0.009, ((event.clientY ?? lookY) - lookY) * 0.012);
    lookY = event.clientY ?? lookY;
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
  function showBoard() {
    jobBoard();
    overlay('ready', 'Harbor jobs', 'Take a job or explore the district at your own pace.', 'Start selected job');
    updateHud();
  }

  element('start').addEventListener('click', () => {
    if (phase === 'paused') run();
    else {
      if (won && phase === 'finished' && selectedJob + 1 < jobs.length) element('mission').value = selectedJob + 1;
      reset(phase === 'finished' && !activeJob);
    }
  });
  element('free-roam').addEventListener('click', () => reset(true));
  element('open-board').addEventListener('click', showBoard);
  element('jobs').addEventListener('click', showBoard);
  element('switch-weapon').addEventListener('click', () => {
    if (phase !== 'playing' || inCar) return;
    const available=[...ownedWeapons].sort();
    weaponIndex=available[(available.indexOf(weaponIndex)+1)%available.length];
    notify(weapons[weaponIndex].name+' equipped'); updateHud();
  });
  const fireButton = element('fire');
  fireButton.style.touchAction = 'none';
  fireButton.style.userSelect = 'none';
  fireButton.style.webkitTouchCallout = 'none';
  fireButton.addEventListener('pointerdown', event => {
    if (phase !== 'playing' || inCar || event.button !== 0) return;
    event.preventDefault();
    fireButton.setPointerCapture?.(event.pointerId);
    firePointers.add(event.pointerId);
    shoot();
  });
  // Preserve keyboard/assistive activation without duplicating a pointer shot.
  fireButton.addEventListener('click', event => { if (!event || event.detail === 0) shoot(); });
  element('mission').addEventListener('change', describeJob);
  function showSound() {
    const button = element('sound');
    button.textContent = soundEnabled ? 'Sound on' : 'Sound off';
    button.setAttribute('aria-pressed', String(soundEnabled));
  }
  element('sound').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    try { window.localStorage?.setItem('harborSound', soundEnabled ? 'on' : 'off'); } catch {}
    if (soundEnabled && phase === 'playing') startAudio();
    updateAudio();
    showSound();
  });
  showSound();
  element('interact').addEventListener('click', interact);
  element('pause').addEventListener('click', pause);
  element('pause').disabled = true;
  resetTraffic();
  for (const worker of workers) Object.assign(worker, { homeX: worker.x, homeZ: worker.z, angle: 0, recover: 0 });
  selectedJob = availableJobs() - 1;
  jobBoard();
  updateHud();
  requestAnimationFrame(frame);
})();
