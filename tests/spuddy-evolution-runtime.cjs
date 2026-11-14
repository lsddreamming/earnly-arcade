'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../spuddy-evolution-engine.js');
const { seedCollectionFixture, quietMenuRandom } = require('./spuddy-evolution-fixtures.cjs');
const root = path.resolve(__dirname, '..');
const runtime = fs.readFileSync(path.join(root, 'spuddy-evolution.js'), 'utf8');

// Engine tests alone cannot detect a syntax error in the browser controller.
// Parse the complete production scripts before attempting any browser startup.
for (const file of ['spuddy-evolution.js', 'www/spuddy-evolution.js']) {
  test(file + ' parses as a browser script', () => {
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file }));
  });
}
test('web and native controllers are identical', () => {
  assert.equal(runtime, fs.readFileSync(path.join(root, 'www/spuddy-evolution.js'), 'utf8'));
});

function harness(configure = game => { game.s.enemies = []; }) {
  const game = E.create(null, () => .5);
  game.s.paused = false;
  configure(game);
  const steps = [];
  const step = game.step;
  game.step = (dt, input) => { steps.push(dt); step(dt, input); };
  const start = runtime.indexOf('function frame(now)');
  const end = runtime.indexOf('\nif(!renderer.available)', start);
  assert.ok(start >= 0 && end > start, 'Exercise the production frame function, not a duplicate');
  const context = vm.createContext({
    game, s: game.s, last: 0, hudAt: 0, saveAt: 0, renderAt: 0,
    keys: new Set(), input: { x: 0, z: 0 }, victoryShown: false,
    renderer: { transformInput: value => value, draw() {}, burst() {} },
    save() {}, toast() {}, tone() {}, damageNumber() {}, update() {},
    open() { game.s.paused = true; }, requestAnimationFrame() {}
  });
  new vm.Script(runtime.slice(start, end)).runInContext(context);
  return { game, context, steps, frame: now => context.frame(now) };
}

for (const interval of [1000 / 60, 250]) {
  test('seven-second burst completes at ' + (1000 / interval) + ' frames per second', () => {
    const h = harness();
    assert.equal(h.game.pulse(), true);
    for (let now = interval; now <= 7100; now += interval) h.frame(now);
    h.frame(7100);
    assert.equal(h.game.s.cooldown, 0);
    assert.equal(h.game.pulse(), true);
    assert.ok(h.steps.every(dt => dt > 0 && dt <= .05), 'Keep collision/combat steps bounded');
  });
}

test('slow frames preserve movement distance without one large physics step', () => {
  const fast = harness(), slow = harness();
  fast.context.input.x = slow.context.input.x = 1;
  for (let i = 1; i <= 60; i++) fast.frame(i * 1000 / 60);
  for (let i = 1; i <= 4; i++) slow.frame(i * 250);
  assert.ok(Math.abs(fast.game.s.x - 5.2) < 1e-6);
  assert.ok(Math.abs(slow.game.s.x - fast.game.s.x) < 1e-6);
});

test('paused frames do not move the player or consume burst cooldown', () => {
  const h = harness();
  h.game.pulse();
  h.frame(250);
  h.game.s.paused = true;
  const before = { x: h.game.s.x, z: h.game.s.z, time: h.game.s.time, cooldown: h.game.s.cooldown };
  h.context.input.z = -1;
  for (let now = 500; now <= 10000; now += 250) h.frame(now);
  assert.deepEqual({ x: h.game.s.x, z: h.game.s.z, time: h.game.s.time, cooldown: h.game.s.cooldown }, before);
  h.game.s.paused = false;
  h.context.last = 10000; // close() resets the timestamp when resuming.
  h.frame(10250);
  assert.ok(Math.abs(h.game.s.cooldown - (before.cooldown - .25)) < 1e-6);
});

test('a suspended tab cannot create an unbounded catch-up loop', () => {
  const h = harness();
  h.frame(60000);
  assert.ok(Math.abs(h.game.s.time - .5) < 1e-6);
  assert.equal(h.steps.length, 10);
});

for (const intervals of [[1000 / 60], [250], [500], [17, 500, 33, 250]]) {
  test('browser capture fixture separates collection and banking at frame intervals ' + intervals.join('/'), () => {
    const h = harness(seedCollectionFixture);
    let now = 0, frame = 0;
    const advance = () => { now += intervals[frame++ % intervals.length]; h.frame(now); };
    h.context.input.z = -1;
    while (!h.game.s.cargo && now < 15000) advance();
    assert.equal(h.game.s.cargo, 3, 'Real roots must capture the real engine target');
    assert.equal(h.game.s.save.bank, 0, 'Capture must occur outside nest banking range');
    assert.ok(h.game.s.z < 6, 'Keyboard movement leaves the nest before capture');
    // A slow driver may release the held key one rendered frame later.
    advance();
    h.context.input.z = 0;
    advance();
    assert.equal(h.game.s.cargo, 3);
    assert.equal(h.game.s.save.bank, 0);
    h.context.input.z = 1;
    while (!h.game.s.save.bank && now < 30000) advance();
    h.context.input.z = 0;
    assert.equal(h.game.s.cargo, 0);
    assert.equal(h.game.s.save.bank, 3);
    assert.equal(h.game.s.save.deposited, 3);
    assert.equal(h.game.s.save.journey.captures, 1);
    const restored = E.create(h.game.exportSave(), () => .5);
    assert.equal(restored.s.save.bank, 3);
    assert.equal(restored.s.save.deposited, 3);
    assert.equal(restored.s.save.journey.captures, 1);
  });
}


test('journey menu fixture keeps real balances stable before and after chapter advancement', () => {
  const raw = { version: 1, bank: 100, bosses: [true, true, true, true, true],
    unlocked: 4, journey: { chapter: 1, shards: 5 } };
  const game = E.create(raw, quietMenuRandom);
  const waitAtNest = () => {
    game.s.paused = false;
    for (let i = 0; i < 2400; i++) game.step(.05);
  };
  waitAtNest(); // Even a two-minute slow menu interaction must not earn rewards.
  assert.equal(game.s.save.bank, 100);
  assert.equal(game.s.save.journey.shards, 5);
  assert.equal(game.buyResearch('power'), true);
  assert.equal(game.nextChapter(), true);
  waitAtNest();
  const reloaded = E.create(game.exportSave(), quietMenuRandom).exportSave();
  assert.equal(reloaded.bank, 100);
  assert.equal(reloaded.journey.shards, 3);
  assert.equal(reloaded.journey.chapter, 2);
  assert.equal(reloaded.journey.research.power, 1);
});
