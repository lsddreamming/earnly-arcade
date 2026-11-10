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
    roots: { name: 'More roots', base: 45, desc: 'Latch onto one more creature at once' },
    focus: { name: 'Root Focus', base: 55, desc: 'Up to 3 spare roots reinforce the nearest target · +15% damage each per rank' },
    courier: { name: 'Courier wings', base: 60, desc: 'Rescue Pip first · unlock and improve cargo deliveries' },
    helper: { name: 'Sprout companion', base: 65, desc: 'A little friend · +18% gathering power' }
  };
  const upgradeCap = key => key==='focus'?3:key==='helper'?1:key==='roots'?4:key==='courier'?5:8;
  const rescueNames=['Pip','Fern','Copper','Clover','Nova'];
  const rescues=zones.map((z,i)=>({name:rescueNames[i],zone:i,x:i%2?-6:6,z:z.max-10}));
  const perks = {
    roots: { name: 'Wild roots', desc: '+8% base capture power' },
    vigor: { name: 'Deep roots', desc: '+15 maximum health' },
    harvest: { name: 'Seed keeper', desc: '+6 carrying capacity' }
  };
  const CHAPTERS = 100;
  const conditions = [
    {name:'Wild growth', desc:'Armored creatures have 35% more health.', armor:1.35, haste:1, healing:1},
    {name:'Spore storm', desc:'Ranged spores travel 30% faster. Keep moving.', armor:1, haste:1.3, healing:1},
    {name:'Restless guardians', desc:'Bosses recover 25% faster between attacks.', armor:1, haste:1, healing:1},
    {name:'Withered springs', desc:'Nests heal 35% slower; their sanctuary remains safe.', armor:1, haste:1, healing:.65}
  ];
  const research = {power:{name:'Ancient roots',desc:'+8% capture power per rank'},health:{name:'Living bark',desc:'+20 maximum health per rank'},cargo:{name:'Deep pockets',desc:'+8 carrying capacity per rank'}};
  const lab = [
    {name:'Thorn renewal',material:'Thorn seed',desc:'Captures restore 1 / 2 / 3 health.',color:'#43866a'},
    {name:'Prism sweep',material:'Prism shard',desc:'Root burst clears incoming spores within 4 / 6 / 8 metres.',color:'#8d69c2'},
    {name:'Frost guard',material:'Frost core',desc:'Root burst grants 30% damage protection for 1 / 2 / 3 seconds.',color:'#368da7'},
    {name:'Ember burst',material:'Ember heart',desc:'Root burst deals 20% / 40% / 60% more damage.',color:'#c36a36'},
    {name:'Bloom renewal',material:'Bloom pearl',desc:'Root burst restores 3% / 6% / 9% maximum health.',color:'#ab588b'}
  ];
  function clean(raw) {
    const s = { version: 1, lab:{cores:Array(5).fill(0),ranks:Array(5).fill(0)}, bank: 0, xp: 0, deposited: 0, unlocked: 0, bosses: zones.map(() => false), perks: [], journey: {chapter:1,shards:0,captures:0,banked:0,research:{power:0,health:0,cargo:0},journal:Array(25).fill(0)}, crew:{rescued:Array(5).fill(false),transit:0,rare:0}, levels: { focus:0,roots:0,courier:0,power: 0, reach: 0, cargo: 0, speed: 0, health: 0, helper: 0 } };
    if (!raw || raw.version !== 1) return s;
    for (const k of ['bank', 'xp', 'deposited']) s[k] = Number.isFinite(raw[k]) ? clamp(Math.floor(raw[k]), 0, 1000000) : 0;
    s.unlocked = Number.isInteger(raw.unlocked) ? clamp(raw.unlocked, 0, zones.length - 1) : 0;
    for (const k in s.levels) s.levels[k] = Number.isInteger(raw.levels?.[k]) ? clamp(raw.levels[k], 0, upgradeCap(k)) : 0;
    s.bosses = s.bosses.map((_, i) => raw.bosses?.[i] === true);
    for (let i = 0; i < s.unlocked; i++) if (!s.bosses[i]) { s.unlocked = i; break; }
    s.perks = Array.isArray(raw.perks) ? raw.perks.filter(k => Object.hasOwn(perks, k)).slice(0, Math.min(20, Math.floor(s.xp / 90))) : [];
    if(raw.crew){s.crew.rescued=s.crew.rescued.map((_,i)=>raw.crew.rescued?.[i]===true);s.crew.transit=Number.isInteger(raw.crew.transit)?clamp(raw.crew.transit,0,72):0;s.crew.rare=Number.isInteger(raw.crew.rare)?clamp(raw.crew.rare,0,1000000):0;}
    const j=raw.journey;
    if(j && typeof j==='object'){
      for(const [k,max] of Object.entries({chapter:CHAPTERS,shards:1000000,captures:1000000,banked:1000000}))s.journey[k]=Number.isInteger(j[k])?clamp(j[k],k==='chapter'?1:0,max):s.journey[k];
      for(const k of Object.keys(research))s.journey.research[k]=Number.isInteger(j.research?.[k])?clamp(j.research[k],0,30):0;
      s.journey.journal=s.journey.journal.map((_,i)=>Number.isInteger(j.journal?.[i])?clamp(j.journal[i],0,1000000):0);
    }
    s.lab.ranks=s.lab.ranks.map((_,i)=>Number.isInteger(raw.lab?.ranks?.[i])?clamp(raw.lab.ranks[i],0,3):0);
    s.lab.cores=s.lab.cores.map((_,i)=>raw.lab?Number.isInteger(raw.lab.cores?.[i])?clamp(raw.lab.cores[i],0,100):0:Math.min(100,Math.max(s.bosses[i]?1:0,s.journey.journal[i*5+4])));
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
    const s = { save, x: 0, z: 9, hp: 100, cargo: 0, time: 0, paused: true, dead: false, won: save.bosses.at(-1), cooldown: 0, enemies: [], links: [], events: [], pulse: 0, heading: 0, steps: 0, moving: false, depositClock: 0, hurt: 0, projectiles: [],courier:{x:0,z:9},rescueProgress:0,rescueTarget:-1,gardenClock:0,labGuard:0 };
    const condition = () => save.journey.chapter===1 ? null : conditions[(save.journey.chapter-2)%conditions.length];
    const rescuedCount=()=>save.crew.rescued.filter(Boolean).length;
    const count = key => save.perks.filter(p => p === key).length;
    const evolution = () => Math.min(2, Math.floor(Object.values(save.levels).reduce((a,b)=>a+b,0)/5));
    const stats = (levels = save.levels) => ({ power: 10 * (1 + .35 * levels.power + .08 * count('roots')) * (1+.08*save.journey.research.power), range: 3.1 + .4 * levels.reach, capacity: 24 + 12 * levels.cargo + 6 * count('harvest') + 8*save.journey.research.cargo+(rescuedCount()>=3?20:0), speed: 5.2 * (1 + .08 * levels.speed), hp: 100 + 25 * levels.health + 15 * count('vigor') + 20*save.journey.research.health, targets: 2 + Math.floor(levels.power / 2)+levels.roots });
    s.hp = stats().hp;
    function event(type, data = {}) { s.events.push({ type, ...data }); if (s.events.length > 40) s.events.shift(); }
    function spawn(zone, index, boss = false) {
      const z = zones[zone];
      const rare=!boss&&index>=8&&random()<.12;
      const hp = (rare?1.8:1)*(boss ? 110 + zone * 150 : 9 + zone * 12 + (index % 3) * 4) * (1+.075*(save.journey.chapter-1)) * (!boss && index%4===2 ? condition()?.armor||1 : 1);
      return { id: zone * 100 + index, zone, boss, rare, kind: boss ? 'warden' : index % 4 === 0 ? 'hunter' : index % 4 === 1 ? 'runner' : index % 4 === 2 ? 'grazer' : 'floater', x: boss ? 0 : -10 + random() * 20, z: boss ? z.min + 6 : z.min + 5 + random() * 19, hp, maxHp: hp, dead: 0, phase: random() * 6, attack: 2, windup: 0, targetX: 0, targetZ: 0, hit: 0, value: Math.ceil((rare?3:1)*(boss ? 35 + zone * 30 : 3 + zone * 3)*(1+.025*(save.journey.chapter-1))) };
    }
    for (let zone = 0; zone < zones.length; zone++) {
      for (let i = 0; i < 12; i++) s.enemies.push(spawn(zone, i));
      if (!save.bosses[zone]) s.enemies.push(spawn(zone, 99, true));
    }
    function cost(key) { return upgrades[key] ? Math.floor(upgrades[key].base * Math.pow(1.55, save.levels[key])) : Infinity; }
    function upgradePreview(key) {
      if (!Object.hasOwn(upgrades,key)) return '';
      if(save.levels[key]>=upgradeCap(key))return 'Maximum upgrade reached';
      const next={...save.levels,[key]:save.levels[key]+1},a=stats(),b=stats(next),fmt=n=>Number(n.toFixed(2));
      const change=(label,x,y,unit='')=>label+': '+fmt(x)+' → '+fmt(y)+unit;
      if(key==='power')return change('Damage / second',a.power*(save.levels.helper?1.18:1),b.power*(save.levels.helper?1.18:1))+(a.targets!==b.targets?' · '+change('Targets',a.targets,b.targets):'');
      if(key==='reach')return change('Radius',a.range,b.range,' m');
      if(key==='cargo')return change('Carry',a.capacity,b.capacity,' seeds');
      if(key==='speed')return change('Speed',a.speed,b.speed,' m/s');
      if(key==='health')return change('Health',a.hp,b.hp);
      if(key==='roots')return change('Targets',a.targets,b.targets);
      if(key==='focus')return change('Bonus per spare root',15*save.levels.focus,15*next.focus,'%')+' · up to 3';
      if(key==='helper')return change('Damage / second',a.power,a.power*1.18);
      if(key==='courier')return change('Delivery load',save.levels.courier?12+8*save.levels.courier+(rescuedCount()>=5?20:0):0,12+8*next.courier+(rescuedCount()>=5?20:0),' seeds');
      return '';
    }
    function buy(key) {
      if(key==='courier'&&!save.crew.rescued[0])return false;
      if (!Object.hasOwn(upgrades, key) || s.dead || save.levels[key] >= upgradeCap(key) || save.bank < cost(key)) return false;
      save.bank -= cost(key); save.levels[key]++;
      s.hp = Math.min(stats().hp, s.hp + (key === 'health' ? 25 : 0)); event('upgrade', { key }); if(Object.values(save.levels).reduce((a,b)=>a+b,0)%5===0 && evolution()>0)event('evolution',{form:evolution()}); return true;
    }
    function pendingPerks() { return Math.max(0, Math.min(20, Math.floor(save.xp / 90)) - save.perks.length); }
    function choosePerk(key) {
      if (!Object.hasOwn(perks, key) || !pendingPerks() || s.dead) return false;
      save.perks.push(key); if (key === 'vigor') s.hp += 15; event('perk', { key }); return true;
    }
    function gateStatus(zone = save.unlocked + 1) {
      if (!Number.isInteger(zone) || zone < 1 || zone >= zones.length) return null;
      const open = zone <= save.unlocked, boss = zones[zone - 1].boss;
      const defeated = save.bosses[zone - 1], cost = zones[zone].cost;
      const missing = Math.max(0, cost - save.bank), available = zone === save.unlocked + 1;
      return {zone, name:zones[zone].name, x:0, z:zones[zone].max, open, boss, defeated, cost, missing,
        ready:available && defeated && missing === 0 && !s.dead,
        message:open ? 'Open · walk through the center' : !available ? 'Open the earlier habitats first' : !defeated ? 'Defeat '+boss+' first' : missing ? 'Bank '+missing+' more seeds at a nest' : 'Ready · unlock for '+cost+' banked seeds'};
    }
    function nearbyGate() {
      return zones.slice(1).map((_,i)=>gateStatus(i+1)).find(g=>Math.abs(s.z-g.z)<5 && Math.abs(s.x)<6) || null;
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
        if(e.rare){save.crew.rare++;save.journey.shards+=2;event('rare',{amount:2});}
        const species=e.zone*5+(e.boss?4:['hunter','runner','grazer','floater'].indexOf(e.kind));
        if(species>=0&&species<25){save.journey.journal[species]++;if([1,10,50,e.boss?100:200].includes(save.journey.journal[species])){save.journey.shards++;event('discovery',{amount:1});}}
        if(e.boss)save.journey.shards+=1+Math.floor(save.journey.chapter/5);else save.journey.captures++;
        e.hp = 0; e.dead = e.boss ? Infinity : 14; save.xp += e.value;
        if (e.boss) { if(!save.bosses[e.zone])save.lab.cores[e.zone]=Math.min(100,save.lab.cores[e.zone]+1); save.bosses[e.zone] = true; save.bank += e.value; s.won = save.bosses.at(-1); event('boss', { zone: e.zone, value: e.value }); }
        else { s.hp=Math.min(stats().hp,s.hp+save.lab.ranks[0]); s.cargo = Math.min(stats().capacity, s.cargo + e.value); event('capture', { x: e.x, z: e.z, value: e.value }); }
      }
    }
    function hurt(amount) {
      const nest = nearestNest();
      if (s.hurt > 0 || Math.hypot(s.x - nest.x, s.z - nest.z) < 3) return;
      amount*=(1+.018*(save.journey.chapter-1))*(s.labGuard>0?.7:1);
      s.hp = Math.max(0, s.hp - amount); s.hurt = .65;
      event('hurt', { amount });
    }
    function pulse() {
      if (s.paused || s.dead || s.cooldown > 0) return false;
      s.cooldown = evolution()===2?5:7; s.pulse = .6;
      if(save.lab.ranks[1])s.projectiles=s.projectiles.filter(p=>Math.hypot(p.x-s.x,p.z-s.z)>2+2*save.lab.ranks[1]||!clearPath(s.x,s.z,p.x,p.z));
      s.labGuard=save.lab.ranks[2];
      s.hp=Math.min(stats().hp,s.hp+stats().hp*.03*save.lab.ranks[4]);
      for (const e of s.enemies) if (clearPath(s.x, s.z, e.x, e.z) && Math.hypot(e.x - s.x, e.z - s.z) < stats().range * 1.6) damage(e, stats().power * (evolution()>=1?3:2.3)*(1+.2*save.lab.ranks[3]));
      event('pulse'); return true;
    }
    function step(dt, input = { x: 0, z: 0 }) {
      if (s.paused || s.dead || !Number.isFinite(dt) || dt <= 0) return;
      dt = Math.min(dt, .05); s.labGuard=Math.max(0,s.labGuard-dt); s.hurt = Math.max(0, s.hurt - dt); s.time += dt; s.cooldown = Math.max(0, s.cooldown - dt); s.pulse = Math.max(0, s.pulse - dt);
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
      const eligible=near.filter(e=>!e.dead&&e.zone<=save.unlocked&&Math.hypot(e.x-s.x,e.z-s.z)<a.range&&clearPath(s.x,s.z,e.x,e.z)&&(s.cargo<a.capacity||e.boss));
      const focusTarget=eligible[0],spares=save.levels.focus?Math.min(3,Math.max(0,a.targets-eligible.length)):0;
      const focusLinks=[];
      for (const e of near) {
        if (e.zone > save.unlocked) continue;
        e.hit = Math.max(0, e.hit - dt);
        if (e.dead) { if (!e.boss) { e.dead -= dt; if (e.dead <= 0) Object.assign(e, spawn(e.zone, e.id % 100)); } continue; }
        const dist = Math.hypot(e.x - s.x, e.z - s.z), dx = (s.x - e.x) / (dist || 1), dz = (s.z - e.z) / (dist || 1); e.phase += dt;
        if (clearPath(s.x, s.z, e.x, e.z) && dist < a.range && targets < a.targets && (s.cargo < a.capacity || e.boss)) { s.links.push({ x: e.x, z: e.z, boss: e.boss }); const extra=e===focusTarget?spares:0; for(let i=0;i<extra;i++)focusLinks.push({x:e.x,z:e.z,boss:e.boss}); damage(e, a.power * dt * (save.levels.helper ? 1.18 : 1)*(1+extra*.15*save.levels.focus)); targets++; }
        if (e.dead) continue;
        const zone = zones[e.zone];
        if (e.boss) {
          e.enraged=e.hp<e.maxHp*.5; e.attack -= dt;
          if (e.windup > 0) {
            e.windup -= dt;
            if (e.windup <= 0) {
              const hit = e.zone === 3 ? Math.abs(s.x - e.targetX) < 1.8 && Math.abs(s.z - e.targetZ) < 5 : Math.hypot(s.x - e.targetX, s.z - e.targetZ) < (e.zone === 4 ? 4.2 : 3.4);
              if (hit && clearPath(e.x, e.z, s.x, s.z)) hurt(18 + e.zone * 12);
              event('slam', { x: e.targetX, z: e.targetZ }); e.attack = (e.zone === 4 ? 2.8 : 3.8)*(e.enraged?.75:1)*(condition()===conditions[2]?.75:1);
            }
          } else if (e.attack <= 0 && dist < 9) { e.windup = e.zone === 4 ? 1.6 : 1.25; e.targetX = s.x; e.targetZ = s.z; }
          else if (dist < 10 && dist > 2) { e.x = clamp(e.x + dx * 1.3 * dt, -11, 11); e.z = clamp(e.z + dz * 1.3 * dt, zone.min + 3, zone.max - 3); }
        } else {
          let vx = Math.sin(e.phase + e.id) * .35, vz = Math.cos(e.phase * .7 + e.id) * .35;
          if (dist < 5) { const direction = e.kind === 'hunter' ? 1 : e.kind === 'runner' ? -1 : 0; vx += dx * direction * (e.kind === 'runner' ? 1.8 : 1.25 + e.zone * .4); vz += dz * direction * (e.kind === 'runner' ? 1.8 : 1.25 + e.zone * .4); }
          if(e.windup>0 || e.dash>0){vx=0;vz=0;}
          e.x = clamp(e.x + vx * dt, -11.5, 11.5); e.z = clamp(e.z + vz * dt, zone.min + 3, zone.max - 3);
          // Each species gains an offensive role gradually; starting bites are forgiving.
          e.attack = Math.max(0, (Number.isFinite(e.attack) ? e.attack : 2) - dt*(e.rare?1.5:1));
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
                if(s.projectiles.length<32)s.projectiles.push({x:e.x,z:e.z,vx:(e.targetX-e.x)/d*(4+e.zone*.4)*(condition()?.haste||1),vz:(e.targetZ-e.z)/d*(4+e.zone*.4)*(condition()?.haste||1),life:2.5,damage:5+e.zone*4,zone:e.zone});
              }else if(e.kind==='hunter'||e.kind==='runner'){
                const d=Math.hypot(e.targetX-e.x,e.targetZ-e.z)||1;e.dash=.55;e.dashX=(e.targetX-e.x)/d*8;e.dashZ=(e.targetZ-e.z)/d*8;
              }else if (canReach && Math.hypot(s.x - e.targetX, s.z - e.targetZ) < e.attackRadius) hurt(5 + e.zone * 4);
              e.attack = 3.8 - e.zone * .35;
            }
          } else if (canReach && !e.attack) {
            if ((e.kind==='hunter' && e.zone>=1 || e.kind==='runner' && e.zone>=2) && dist>1.35 && dist<5 || e.kind === 'floater' && e.zone >= 1 && dist < 6 || e.kind === 'grazer' && e.zone >= 2 && dist < 2.8) {
              e.targetX = e.kind === 'grazer' ? e.x : s.x; e.targetZ = e.kind === 'grazer' ? e.z : s.z;
              e.attackRadius = e.kind === 'grazer' ? (e.rare?3.2:2.4) : 1.3;
              e.windup = 1.4 - e.zone * .1;
            } else if (dist < 1.35) {
              hurt((e.kind === 'hunter' ? 4 : 2) + e.zone * 3);
              e.attack = 2.5 - e.zone * .3;
            }
          }
        }
      }
      for (const e of s.enemies) if (!e.dead && e.zone <= save.unlocked) separate(e, e.boss ? 1.3 : .4);
      s.links.push(...focusLinks);
      for(const p of s.projectiles){
        const ox=p.x,oz=p.z;p.life-=dt;p.x+=p.vx*dt;p.z+=p.vz*dt;
        if(!clearPath(ox,oz,p.x,p.z)||p.x<-12||p.x>12||obstacles.some(o=>Math.hypot(p.x-o.x,p.z-o.z)<o.r+.2))p.life=0;
        if(p.life>0 && Math.hypot(p.x-s.x,p.z-s.z)<.85){hurt(p.damage);p.life=0;}
      }s.projectiles=s.projectiles.filter(p=>p.life>0);
      // Rescue one stranded Spuddy per habitat by staying nearby, away from active danger.
      const rescue=rescues.find(r=>r.zone<=save.unlocked&&!save.crew.rescued[r.zone]&&Math.hypot(s.x-r.x,s.z-r.z)<2);
      const safe=s.hp>0&&rescue&&!s.enemies.some(e=>!e.dead&&e.zone<=save.unlocked&&Math.hypot(e.x-s.x,e.z-s.z)<2.5);
      if(safe){if(s.rescueTarget!==rescue.zone)s.rescueProgress=0;s.rescueTarget=rescue.zone;s.rescueProgress+=dt;if(s.rescueProgress>=2){save.crew.rescued[rescue.zone]=true;save.journey.shards+=3;s.rescueProgress=0;event('rescue',{name:rescue.name});}}else{s.rescueProgress=0;s.rescueTarget=-1;}
      // The flying courier transfers conserved cargo; no offline production or duplicate rewards.
      if(save.levels.courier>0 || save.crew.transit>0){
        const c=s.courier,target=save.crew.transit>0?{x:0,z:9}:s,dx=target.x-c.x,dz=target.z-c.z,d=Math.hypot(dx,dz),distance=(5+save.levels.courier+(rescuedCount()>=2?2:0))*dt;
        if(d>0){c.x+=dx/d*Math.min(d,distance);c.z+=dz/d*Math.min(d,distance);}
        if(d<1.2){if(save.crew.transit>0){const amount=save.crew.transit;save.crew.transit=0;bankCargo(amount);event('delivery',{amount});}else if(s.cargo>0&&Math.hypot(s.x,s.z-9)>4){const amount=Math.min(s.cargo,12+8*save.levels.courier+(rescuedCount()>=5?20:0));s.cargo-=amount;save.crew.transit=amount;event('pickup',{amount});}}
      }
      if(rescuedCount()>=1){s.gardenClock+=dt;if(s.gardenClock>=30){s.gardenClock-=30;const amount=3*rescuedCount();save.bank+=amount;event('garden',{amount});}}
      const nest = nearestNest(), atBase = Math.hypot(s.x - nest.x, s.z - nest.z) < 3;
      if (atBase) {
        s.hp = Math.min(a.hp, s.hp + 30 * dt*(condition()?.healing||1)*(rescuedCount()>=4?1.5:1)); s.depositClock += dt;
        if (s.cargo && s.depositClock > .5) { const amount = s.cargo; s.cargo = 0; s.depositClock = 0;bankCargo(amount); }
      } else s.depositClock = 0;
      if (s.hp <= 0) { s.hp = 0; s.dead = true; s.links = []; event('defeat'); }
    }
    function bankCargo(amount){save.bank+=amount;save.deposited+=amount;save.journey.banked+=amount;event('deposit',{amount});}
    function respawn() {
      const nest = nearestNest(); s.dead = false; s.x = nest.x; s.z = nest.z; s.hp = stats().hp; s.cargo = Math.floor(s.cargo * .75); s.cooldown = 0; s.labGuard=0; s.hurt = 2; s.projectiles=[]; for(const e of s.enemies){e.dash=0;e.windup=0;}
      for (const e of s.enemies) if (e.boss && !e.dead) { e.hp = e.maxHp; e.windup = 0; e.attack = 2; } event('respawn');
    }
    function travel(zone){
      const nest=nearestNest();if(s.dead||!Number.isInteger(zone)||zone<0||zone>save.unlocked||!save.crew.rescued[zone]||Math.hypot(s.x-nest.x,s.z-nest.z)>=3)return false;
      if(s.cargo){bankCargo(s.cargo);s.cargo=0;}s.x=zone===0?0:-8;s.z=zone===0?9:zones[zone].max-6;s.links=[];s.hurt=2;event('travel');return true;
    }
    function journeyStatus(){
      const j=save.journey, captures=j.chapter===1?0:40+j.chapter*8, banked=j.chapter===1?0:200+j.chapter*60;
      const ready=save.bosses.every(Boolean)&&j.captures>=captures&&j.banked>=banked;
      return {chapter:j.chapter,total:CHAPTERS,captures,banked,ready,complete:ready&&j.chapter===CHAPTERS,condition:condition(),bosses:save.bosses.filter(Boolean).length};
    }
    function labCost(zone){return Number.isInteger(zone)&&zone>=0&&zone<lab.length?save.lab.ranks[zone]+1:Infinity;}
    function buyLab(zone){
      if(s.dead||!Number.isInteger(zone)||zone<0||zone>=lab.length||save.lab.ranks[zone]>=3||save.lab.cores[zone]<labCost(zone))return false;
      save.lab.cores[zone]-=labCost(zone);save.lab.ranks[zone]++;event('lab',{zone});return true;
    }
    function researchCost(key){return Object.hasOwn(research,key)?2+Math.floor(save.journey.research[key]/3):Infinity;}
    function buyResearch(key){
      if(!Object.hasOwn(research,key)||s.dead||save.journey.research[key]>=30||save.journey.shards<researchCost(key))return false;
      save.journey.shards-=researchCost(key);save.journey.research[key]++;if(key==='health')s.hp+=20;event('research');return true;
    }
    function nextChapter(){
      const status=journeyStatus();if(!status.ready||status.complete||s.dead)return false;
      if(save.crew.transit){bankCargo(save.crew.transit);save.crew.transit=0;}s.courier={x:0,z:9};s.rescueProgress=0;s.rescueTarget=-1;
      save.journey.chapter++;save.journey.captures=0;save.journey.banked=0;save.bosses=zones.map(()=>false);save.unlocked=0;
      s.x=0;s.z=9;s.cargo=0;s.hp=stats().hp;s.won=false;s.dead=false;s.cooldown=0;s.labGuard=0;s.hurt=2;s.projectiles=[];s.links=[];s.events=[];s.enemies=[];s.depositClock=0;
      for(let z=0;z<zones.length;z++){for(let i=0;i<12;i++)s.enemies.push(spawn(z,i));s.enemies.push(spawn(z,99,true));}
      event('chapter',{chapter:save.journey.chapter});return true;
    }
    function objective() {
      if(save.bosses.every(Boolean)){const j=journeyStatus();return j.complete?'The Hundredfold Bloom is restored!':j.ready?'Expedition complete! Open Journey to continue.':'Journey: '+Math.min(save.journey.captures,j.captures)+'/'+j.captures+' captures · '+Math.min(save.journey.banked,j.banked)+'/'+j.banked+' seeds banked';}
      if (save.deposited < 20) return 'Gather 20 seeds and bring them to your nest';
      if (Object.values(save.levels).reduce((a, b) => a + b, 0) < 2) return 'Spend your banked seeds on two upgrades';
      if (!save.bosses[save.unlocked]) return 'Defeat the ' + zones[save.unlocked].boss;
      const gate = gateStatus();
      return gate.ready ? 'Gate ready! Approach the door to '+gate.name : gate.message+' to open '+gate.name;
    }
    return { s, gateStatus, nearbyGate, labCost, buyLab, upgradePreview, travel, rescuedCount, journeyStatus, researchCost, buyResearch, nextChapter, stats, evolution, cost, buy, unlock, step, pulse, respawn, objective, nearestNest, pendingPerks, choosePerk, exportSave: () => JSON.parse(JSON.stringify(save)) };
  }
  const api = { create, clean, lab, zones, upgrades, perks, research, conditions, CHAPTERS, upgradeCap, rescues };
  if (typeof module !== 'undefined') module.exports = api; else root.SpuddyEvolution = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
