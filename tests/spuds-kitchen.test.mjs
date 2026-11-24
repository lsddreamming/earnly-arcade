import test from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  capacity,
  station,
  collectOrderBonus,
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

test("stations cool independently and resume on the saved deadline", () => {
  const s = fresh(100);
  for (let i = 0; i < capacity(s, 0); i++) assert.ok(generate(s, 0, 100));
  assert.equal(generate(s, 0, 101), false);
  assert.equal(s.energy, 88);
  assert.ok(generate(s, 1, 101));
  const saved = JSON.parse(JSON.stringify(s));
  const deadline = station(saved, 0, 101).readyAt;
  assert.equal(generate(saved, 0, deadline - 1), false);
  assert.ok(generate(saved, 0, deadline));
});
test("only the latest served order can pay a second time", () => {
  const s = fresh();
  assert.ok(serve(s, 2));
  const old = s.bonusTicket;
  assert.ok(serve(s, 1));
  const ticket = s.bonusTicket, cash = s.money, xp = s.xp;
  assert.equal(collectOrderBonus(s, old), false);
  assert.ok(collectOrderBonus(s, ticket));
  assert.equal(s.money, cash + ticket.cash);
  assert.equal(s.xp, xp);
  assert.equal(collectOrderBonus(s, ticket), false);
});
