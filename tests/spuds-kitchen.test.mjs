import test from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  move,
  generate,
  refill,
  travel,
  indices,
  serve,
  spaces,
  empty,
  order,
} from "../spuds-kitchen-engine.js";
test("opening merge fulfills the first ticket exactly once", () => {
  const s = fresh();
  assert.equal(move(s, 18, 19), "Merged");
  assert.ok(serve(s, 0));
  assert.equal(s.money, 6);
  assert.equal(indices(s, [1]), null);
});
test("full and locked spaces preserve energy and items", () => {
  const s = fresh();
  s.board.fill(0, 0, spaces(s));
  assert.equal(empty(s), -1);
  assert.equal(generate(s, 0), false);
  assert.equal(move(s, 1, 79), "");
  assert.equal(s.energy, 100);
});
test("energy catches up in whole intervals", () => {
  const s = fresh(100);
  generate(s, 0, 100);
  refill(s, 120099);
  assert.equal(s.energy, 99);
  refill(s, 120100);
  assert.equal(s.energy, 100);
});
test("duplicate requirements consume distinct items", () => {
  const s = fresh();
  assert.deepEqual(indices(s, [10, 10]), [20, 21]);
  assert.equal(indices(s, [10, 10, 10]), null);
});
test("new restaurants issue locally achievable orders after restoring progress", () => {
  const s = fresh();
  assert.equal(travel(s, 2), false);
  s.level = 20;
  assert.ok(travel(s, 2));
  for (let i = 0; i < 2000; i++)
    assert.ok(order(s).every((id) => id >= 40 && id < 60));
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});
