'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

for (const prefix of ['', 'www/']) {
  test(prefix + 'Games lists one free Evolution beta with honest rewards and local saves', () => {
    const html = read(prefix + 'games.html');
    const list = html.match(/const gameInfo = (\[[\s\S]*?\n    \]);/);
    assert.ok(list, 'The normal catalog must remain present');
    const entries = vm.runInNewContext('(' + list[1] + ')');
    const matches = entries.filter(game => game.key === 'spuddyEvolution');
    assert.equal(matches.length, 1);
    assert.equal(new Set(entries.map(game => game.key)).size, entries.length);
    const game = matches[0];
    assert.equal(game.name, 'Spuddy Evolution');
    assert.equal(game.href, 'spuddy-evolution.html');
    assert.equal(game.freeBeta, true, 'No daily-play or coin gate for this beta');
    assert.match(game.note, /device-only saves/);
    assert.match(game.note, /no Arcade Coin rewards/);
    assert.ok(fs.existsSync(path.join(root, prefix, game.href)));
    const tags = html.match(/const gameTags = (\{[\s\S]*?\n    \});/);
    assert.ok(tags);
    const labels = vm.runInNewContext('(' + tags[1] + ')').spuddyEvolution;
    assert.ok(labels.includes('new') && labels.includes('action'));
    assert.match(html, /key === 'spuddyEvolution' \? 104 : key === 'harborGetaway' \? 103/);
  });
  test(prefix + 'Evolution beta remains visible without JavaScript', () => {
    const html = read(prefix + 'games.html').split('<script')[0];
    const matches = [...html.matchAll(/<section\b[^>]*data-game="spuddyEvolution"[^>]*>[\s\S]*?<\/section>/g)];
    assert.equal(matches.length, 1);
    assert.match(matches[0][0], /href="spuddy-evolution.html"/);
    assert.match(matches[0][0], /Play · Free beta/);
    assert.match(matches[0][0], /device-only saves/);
    assert.match(matches[0][0], /no Arcade Coin rewards/);
  });
  test(prefix + 'Games inline JavaScript parses before browser QA', () => {
    const html = read(prefix + 'games.html');
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (!/\bsrc\s*=/.test(match[1])) new vm.Script(match[2]);
    }
  });
}
test('web and native beta catalog copies are identical', () => {
  assert.equal(read('games.html'), read('www/games.html'));
});
