'use strict';

// Use the same real-engine encounter in browser and frame-loop regressions.
// At z=5 a creature is within root reach while the player is still inside the
// nest, so a slow frame can correctly capture AND bank it before the HUD shows
// a carried seed. z=0 separates those states without altering game rules.
function seedCollectionFixture(game) {
  const creature = game.s.enemies.find(enemy => enemy.zone === 0 && !enemy.boss && enemy.kind === 'grazer');
  if (!creature) throw new Error('Seed-collection fixture requires a sanctuary grazer');
  game.s.enemies = [{ ...creature, x: 0, z: 0, hp: 1, maxHp: 1,
    dead: 0, phase: 0, attack: 2, value: 3 }];
  return game;
}

module.exports = { seedCollectionFixture };
