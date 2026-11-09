(function (root) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const zones = [
    { name: 'Sprout Sanctuary', min: -16, max: 16, color: '#d9e5d0', cost: 0, boss: 'Thorn Warden' },
    { name: 'Prism Laboratory', min: -48, max: -16, color: '#dddaf0', cost: 80, boss: 'Prism Sentinel' },
    { name: 'Frost Reactor', min: -80, max: -48, color: '#c9edf2', cost: 180, boss: 'Frost Colossus' },
    { name: 'Ember Foundry', min: -112, max: -80, color: '#edd6c4', cost: 300, boss: 'Cinder Ram' },
    { name: 'Bloom Heart', min: -144, max: -112, color: '#e1d4e9', cost: 460, boss: 'Hollow Bloom' }
  ];
  const obstacles = zones.flatMap(z => [
    { x: -8.7, z: z.min + 13, r: 1 }, { x: 8.7, z: z.min + 18, r: 1 },
    { x: -9, z: z.min + 23, r: 1.05 }, { x: 9, z: z.min + 23, r: 1.05 }
  ]);
  function separate(body, radius) {
    for (const o of obstacles) {
      const dx = body.x - o.x, dz = body.z - o.z, r = radius + o.r;
      if (Math.abs(dx) >= r || Math.abs(dz) >= r) continue;
      const d = Math.hypot(dx, dz);
      if (d < r) { body.x = o.x + (d ? dx / d : 1) * r; body.z = o.z + (d ? dz / d : 0) * r; }
    }
  }
  const upgrades = {
    power: { name: 'Root power', base: 18, desc: 'Capture faster · +35% base damage' },
    reach: { name: 'Root reach', base: 22, desc: 'Reach farther · +0.4m radius' },
    cargo: { name: 'Seed pouch', base: 16, desc: 'Carry more · +12 capacity' },
    speed: { name: 'Quick feet', base: 20, desc: 'Move faster · +8% speed' },
    health: { name: 'Hardy skin', base: 18, desc: 'Survive longer · +25 health' },
    helper: { name: 'Sprout companion', base: 65, desc: 'A little friend · +18% gathering power' }
  };
  const perks = {
    roots: { name: 'Wild roots', desc: '+8% base capture power' },
    vigor: { name: 'Deep roots', desc: '+15 maximum health' },
    harvest: { name: 'Seed keeper', desc: '+6 carrying capacity' }
  };
  function clean(raw) {
    const s = { version: 1, bank: 0, xp: 0, deposited: 0, unlocked: 0, bosses: zones.map(() => false), perks: [], levels: { power: 0, reach: 0, cargo: 0, speed: 0, health: 0, helper: 0 } };
    if (!raw || raw.version !== 1) return s;
    for (const k of ['bank', 'xp', 'deposited']) s[k] = Number.isFinite(raw[k]) ? clamp(Math.floor(raw[k]), 0, 1000000) : 0;
    s.unlocked = Number.isInteger(raw.unlocked) ? clamp(raw.unlocked, 0, zones.length - 1) : 0;
    for (const k in s.levels) s.levels[k] = Number.isInteger(raw.levels?.[k]) ? clamp(raw.levels[k], 0, k === 'helper' ? 1 : 8) : 0;
    s.bosses = s.bosses.map((_, i) => raw.bosses?.[i] === true);
    for (let i = 0; i < s.unlocked; i++) if (!s.bosses[i]) { s.unlocked = i; break; }
    s.perks = Array.isArray(raw.perks) ? raw.perks.filter(k => Object.hasOwn(perks, k)).slice(0, Math.min(20, Math.floor(s.xp / 90))) : [];
    return s;
  }
  function clearPath(x, z, tx, tz) {
    for (const zone of zones.slice(1)) {
      const gate = zone.max;
      if ((z < gate && tz > gate) || (z > gate && tz < gate)) {
        const crossing = x + (tx - x) * (gate - z) / (tz - z);
        if (Math.abs(crossing) > 3.5) return false;
      }
    }
    return true;
  }
  function create(raw, random = Math.random) {
    const save = clean(raw);
    const s = { save, x: 0, z: 9, hp: 100, cargo: 0, time: 0, paused: true, dead: false, won: save.bosses.at(-1), cooldown: 0, enemies: [], links: [], events: [], pulse: 0, heading: 0, steps: 0, moving: false, depositClock: 0, hurt: 0, projectiles: [] };
    const count = key => save.perks.filter(p => p === key).length;
    const evolution = () => Math.min(2, Math.floor(Object.values(save.levels).reduce((a,b)=>a+b,0)/5));
    const stats = () => ({ power: 10 * (1 + .35 * save.levels.power + .08 * count('roots')), range: 3.1 + .4 * save.levels.reach, capacity: 24 + 12 * save.levels.cargo + 6 * count('harvest'), speed: 5.2 * (1 + .08 * save.levels.speed), hp: 100 + 25 * save.levels.health + 15 * count('vigor'), targets: 2 + Math.floor(save.levels.power / 2) });
    s.hp = stats().hp;
    function event(type, data = {}) { s.events.push({ type, ...data }); if (s.events.length > 40) s.events.shift(); }
    function spawn(zone, index, boss = false) {
      const z = zones[zone];
      const hp = boss ? 110 + zone * 150 : 9 + zone * 12 + (index % 3) * 4;
      return { id: zone * 100 + index, zone, boss, kind: boss ? 'warden' : index % 4 === 0 ? 'hunter' : index % 4 === 1 ? 'runner' : index % 4 === 2 ? 'grazer' : 'floater', x: boss ? 0 : -10 + random() * 20, z: boss ? z.min + 6 : z.min + 5 + random() * 19, hp, maxHp: hp, dead: 0, phase: random() * 6, attack: 2, windup: 0, targetX: 0, targetZ: 0, hit: 0, value: boss ? 35 + zone * 30 : 3 + zone * 3 };
    }
    for (let zone = 0; zone < zones.length; zone++) {
      for (let i = 0; i < 12; i++) s.enemies.push(spawn(zone, i));
      if (!save.bosses[zone]) s.enemies.push(spawn(zone, 99, true));
    }
    function cost(key) { return upgrades[key] ? Math.floor(upgrades[key].base * Math.pow(1.55, save.levels[key])) : Infinity; }
    function buy(key) {
      if (!Object.hasOwn(upgrades, key) || s.dead || save.levels[key] >= (key === 'helper' ? 1 : 8) || save.bank < cost(key)) return false;
      save.bank -= cost(key); save.levels[key]++;
      s.hp = Math.min(stats().hp, s.hp + (key === 'health' ? 25 : 0)); event('upgrade', { key }); if(Object.values(save.levels).reduce((a,b)=>a+b,0)%5===0 && evolution()>0)event('evolution',{form:evolution()}); return true;
    }
    function pendingPerks() { return Math.max(0, Math.min(20, Math.floor(save.xp / 90)) - save.perks.length); }
    function choosePerk(key) {
      if (!Object.hasOwn(perks, key) || !pendingPerks() || s.dead) return false;
      save.perks.push(key); if (key === 'vigor') s.hp += 15; event('perk', { key }); return true;
    }
    function unlock() {
      const next = save.unlocked + 1;
      if (next >= zones.length || !save.bosses[next - 1] || save.bank < zones[next].cost || s.dead) return false;
      save.bank -= zones[next].cost; save.unlocked = next; event('unlock', { zone: next }); return true;
    }
    function nearestNest() {
      let best = { x: 0, z: 9, zone: 0 };
      for (let i = 1; i <= save.unlocked; i++) {
        const candidate = { x: -8, z: zones[i].max - 6, zone: i };
        if (Math.hypot(s.x - candidate.x, s.z - candidate.z) < Math.hypot(s.x - best.x, s.z - best.z)) best = candidate;
      }
      return best;
    }
    function damage(e, n) {
      if (e.dead || e.zone > save.unlocked || (!e.boss && s.cargo >= stats().capacity)) return;
      e.hp -= n; e.hit = .12;
      e.damageTotal=(e.damageTotal||0)+n;
      if(s.time-(e.damageAt||0)>.35 || e.hp<=0){event('damage',{x:e.x,z:e.z,amount:e.damageTotal});e.damageTotal=0;e.damageAt=s.time;}
      if (e.hp <= 0) {
        e.hp = 0; e.dead = e.boss ? Infinity : 14; save.xp += e.value;
        if (e.boss) { save.bosses[e.zone] = true; save.bank += e.value; s.won = save.bosses.at(-1); event('boss', { zone: e.zone, value: e.value }); }
        else { s.cargo = Math.min(stats().capacity, s.cargo + e.value); event('capture', { x: e.x, z: e.z, value: e.value }); }
      }
    }
    function hurt(amount) {
      const nest = nearestNest();
      if (s.hurt > 0 || Math.hypot(s.x - nest.x, s.z - nest.z) < 3) return;
      s.hp = Math.max(0, s.hp - amount); s.hurt = .65;
      event('hurt', { amount });
    }
    function pulse() {
      if (s.paused || s.dead || s.cooldown > 0) return false;
      s.cooldown = evolution()===2?5:7; s.pulse = .6;
      for (const e of s.enemies) if (clearPath(s.x, s.z, e.x, e.z) && Math.hypot(e.x - s.x, e.z - s.z) < stats().range * 1.6) damage(e, stats().power * (evolution()>=1?3:2.3));
      event('pulse'); return true;
    }
    function step(dt, input = { x: 0, z: 0 }) {
      if (s.paused || s.dead || !Number.isFinite(dt) || dt <= 0) return;
      dt = Math.min(dt, .05); s.hurt = Math.max(0, s.hurt - dt); s.time += dt; s.cooldown = Math.max(0, s.cooldown - dt); s.pulse = Math.max(0, s.pulse - dt);
      const a = stats(); let ix = Number.isFinite(input.x) ? input.x : 0, iz = Number.isFinite(input.z) ? input.z : 0, len = Math.hypot(ix, iz);
      if (len > 1) { ix /= len; iz /= len; }
      s.x = clamp(s.x + ix * a.speed * dt, -12, 12);
      const oldZ = s.z; s.z = clamp(s.z + iz * a.speed * dt, zones[save.unlocked].min + 1, 14);
      for (const zone of zones.slice(1)) {
        const gate = zone.max;
        if (((oldZ <= gate && s.z > gate) || (oldZ >= gate && s.z < gate)) && Math.abs(s.x) > 3.5) s.z = oldZ;
      }
      separate(s, .65);
      s.moving = len > .05;
      if (s.moving) { s.heading = Math.atan2(ix, iz); s.steps += dt * 9; }
      s.links = []; let targets = 0;
      const near = [...s.enemies].sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z));
      for (const e of near) {
        if (e.zone > save.unlocked) continue;
        e.hit = Math.max(0, e.hit - dt);
        if (e.dead) { if (!e.boss) { e.dead -= dt; if (e.dead <= 0) Object.assign(e, spawn(e.zone, e.id % 100)); } continue; }
        const dist = Math.hypot(e.x - s.x, e.z - s.z), dx = (s.x - e.x) / (dist || 1), dz = (s.z - e.z) / (dist || 1); e.phase += dt;
        if (clearPath(s.x, s.z, e.x, e.z) && dist < a.range && targets < a.targets && (s.cargo < a.capacity || e.boss)) { s.links.push({ x: e.x, z: e.z, boss: e.boss }); damage(e, a.power * dt * (save.levels.helper ? 1.18 : 1)); targets++; }
        if (e.dead) continue;
        const zone = zones[e.zone];
        if (e.boss) {
          e.enraged=e.hp<e.maxHp*.5; e.attack -= dt;
          if (e.windup > 0) {
            e.windup -= dt;
            if (e.windup <= 0) {
              const hit = e.zone === 3 ? Math.abs(s.x - e.targetX) < 1.8 && Math.abs(s.z - e.targetZ) < 5 : Math.hypot(s.x - e.targetX, s.z - e.targetZ) < (e.zone === 4 ? 4.2 : 3.4);
              if (hit && clearPath(e.x, e.z, s.x, s.z)) hurt(18 + e.zone * 12);
              event('slam', { x: e.targetX, z: e.targetZ }); e.attack = (e.zone === 4 ? 2.8 : 3.8)*(e.enraged?.75:1);
            }
          } else if (e.attack <= 0 && dist < 9) { e.windup = e.zone === 4 ? 1.6 : 1.25; e.targetX = s.x; e.targetZ = s.z; }
          else if (dist < 10 && dist > 2) { e.x = clamp(e.x + dx * 1.3 * dt, -11, 11); e.z = clamp(e.z + dz * 1.3 * dt, zone.min + 3, zone.max - 3); }
        } else {
          let vx = Math.sin(e.phase + e.id) * .35, vz = Math.cos(e.phase * .7 + e.id) * .35;
          if (dist < 5) { const direction = e.kind === 'hunter' ? 1 : e.kind === 'runner' ? -1 : 0; vx += dx * direction * (e.kind === 'runner' ? 1.8 : 1.25 + e.zone * .4); vz += dz * direction * (e.kind === 'runner' ? 1.8 : 1.25 + e.zone * .4); }
          if(e.windup>0 || e.dash>0){vx=0;vz=0;}
          e.x = clamp(e.x + vx * dt, -11.5, 11.5); e.z = clamp(e.z + vz * dt, zone.min + 3, zone.max - 3);
          // Each species gains an offensive role gradually; starting bites are forgiving.
          e.attack = Math.max(0, (Number.isFinite(e.attack) ? e.attack : 2) - dt);
          const canReach = clearPath(e.x, e.z, s.x, s.z);
          if(e.dash>0){
            e.dash-=dt;e.x=clamp(e.x+e.dashX*dt,-11.5,11.5);e.z=clamp(e.z+e.dashZ*dt,zone.min+3,zone.max-3);
            if(canReach && Math.hypot(s.x-e.x,s.z-e.z)<1.2)hurt(5+e.zone*3);
            separate(e,.4);continue;
          }
          if (e.windup > 0) {
            e.windup -= dt;
            if (e.windup <= 0) {
              if(e.kind==='floater'){
                const d=Math.hypot(e.targetX-e.x,e.targetZ-e.z)||1;
                if(s.projectiles.length<32)s.projectiles.push({x:e.x,z:e.z,vx:(e.targetX-e.x)/d*(4+e.zone*.4),vz:(e.targetZ-e.z)/d*(4+e.zone*.4),life:2.5,damage:5+e.zone*4,zone:e.zone});
              }else if(e.kind==='hunter'||e.kind==='runner'){
                const d=Math.hypot(e.targetX-e.x,e.targetZ-e.z)||1;e.dash=.55;e.dashX=(e.targetX-e.x)/d*8;e.dashZ=(e.targetZ-e.z)/d*8;
              }else if (canReach && Math.hypot(s.x - e.targetX, s.z - e.targetZ) < e.attackRadius) hurt(5 + e.zone * 4);
              e.attack = 3.8 - e.zone * .35;
            }
          } else if (canReach && !e.attack) {
            if ((e.kind==='hunter' && e.zone>=1 || e.kind==='runner' && e.zone>=2) && dist>1.35 && dist<5 || e.kind === 'floater' && e.zone >= 1 && dist < 6 || e.kind === 'grazer' && e.zone >= 2 && dist < 2.8) {
              e.targetX = e.kind === 'grazer' ? e.x : s.x; e.targetZ = e.kind === 'grazer' ? e.z : s.z;
              e.attackRadius = e.kind === 'grazer' ? 2.4 : 1.3;
              e.windup = 1.4 - e.zone * .1;
            } else if (dist < 1.35) {
              hurt((e.kind === 'hunter' ? 4 : 2) + e.zone * 3);
              e.attack = 2.5 - e.zone * .3;
            }
          }
        }
      }
      for (const e of s.enemies) if (!e.dead && e.zone <= save.unlocked) separate(e, e.boss ? 1.3 : .4);
      for(const p of s.projectiles){
        const ox=p.x,oz=p.z;p.life-=dt;p.x+=p.vx*dt;p.z+=p.vz*dt;
        if(!clearPath(ox,oz,p.x,p.z)||p.x<-12||p.x>12||obstacles.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<o.r+.2))p.life=0;
        if(p.life>0 && Math.hypot(p.x-s.x,p.z-s.z)<.85){hurt(p.damage);p.life=0;}
      }s.projectiles=s.projectiles.filter(p=>p.life>0);
      const nest = nearestNest(), atBase = Math.hypot(s.x - nest.x, s.z - nest.z) < 3;
      if (atBase) {
        s.hp = Math.min(a.hp, s.hp + 30 * dt); s.depositClock += dt;
        if (s.cargo && s.depositClock > .5) { const amount = s.cargo; save.bank += amount; save.deposited += amount; s.cargo = 0; s.depositClock = 0; event('deposit', { amount }); }
      } else s.depositClock = 0;
      if (s.hp <= 0) { s.hp = 0; s.dead = true; s.links = []; event('defeat'); }
    }
    function respawn() {
      const nest = nearestNest(); s.dead = false; s.x = nest.x; s.z = nest.z; s.hp = stats().hp; s.cargo = Math.floor(s.cargo * .75); s.cooldown = 0; s.hurt = 2; s.projectiles=[]; for(const e of s.enemies){e.dash=0;e.windup=0;}
      for (const e of s.enemies) if (e.boss && !e.dead) { e.hp = e.maxHp; e.windup = 0; e.attack = 2; } event('respawn');
    }
    function objective() {
      if (save.bosses.at(-1)) return 'All five habitats restored! Keep growing your Spuddy.';
      if (save.deposited < 20) return 'Gather 20 seeds and bring them to your nest';
      if (Object.values(save.levels).reduce((a, b) => a + b, 0) < 2) return 'Spend your banked seeds on two upgrades';
      if (!save.bosses[save.unlocked]) return 'Defeat the ' + zones[save.unlocked].boss;
      return 'Bank ' + zones[save.unlocked + 1].cost + ' seeds to unlock the next habitat';
    }
    return { s, stats, evolution, cost, buy, unlock, step, pulse, respawn, objective, nearestNest, pendingPerks, choosePerk, exportSave: () => JSON.parse(JSON.stringify(save)) };
  }
  const api = { create, clean, zones, upgrades, perks };
  if (typeof module !== 'undefined') module.exports = api; else root.SpuddyEvolution = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
