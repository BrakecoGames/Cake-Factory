// Cake Factory – Sweet Automation · © 2026 Brakeco Games
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/Game.js';
import { FactorySimulation } from '../src/simulation/FactorySimulation.js';
import { DIR } from '../src/simulation/Grid.js';
import { SIM } from '../src/core/Config.js';
import { makeWholeCake } from '../src/cakes/CakeModel.js';
import { cakeKey } from '../src/cakes/CakeSerializer.js';

const run = (game, s) => { for (let i = 0; i < Math.round(s * SIM.TICK_RATE); i++) game.fixedUpdate(); };
const lineToStation = (g) => g.buildBeltPath([6, 7, 8, 9, 10, 11].map((x) => ({ x, y: 9, dir: DIR.E })));

test('a machine dropped onto a running line replaces the belt and joins the line', () => {
  const g = new Game();
  g.orders.index = 1; // Strawberry Frosting: froster + pink unlocked
  lineToStation(g);
  run(g, 4);
  const money = g.economy.money;
  const r = g.buildMachine('froster', 8, 9, DIR.E);
  assert.ok(r.ok, r.reason);
  assert.equal(r.replaced, 1);
  assert.equal(g.economy.money, money - 200 + 5, 'pays cost minus the replaced belt');
  assert.equal(g.sim.entityAt(8, 9).type, 'froster');
  const before = g.orders.delivered;
  run(g, 25);
  assert.ok(g.orders.index > 1 || g.orders.delivered > before, 'frosted cakes are being accepted');
});

test('a cake on the replaced belt goes into the machine instead of vanishing', () => {
  const sim = new FactorySimulation(8, 3);
  for (let x = 0; x < 5; x++) sim.place('belt', x, 1, DIR.E);
  const b = sim.entityAt(2, 1);
  b.item = { id: 1, cake: makeWholeCake(), progress: 0.5, inDir: DIR.E, lastTick: -1, x: 2.5, y: 1.5, px: 2.5, py: 1.5 };
  const res = sim.placeReplacingBelts('froster', 2, 1, DIR.E);
  assert.ok(res);
  assert.equal(res.rescued, 1);
  assert.equal(res.lost, 0);
  assert.equal(res.entity.inSlots[0] && cakeKey(res.entity.inSlots[0]), cakeKey(makeWholeCake()));
  assert.equal(sim.drainEvents().filter((e) => e.type === 'itemDestroyed').length, 0);
});

test('cakes that cannot enter the machine are reported, not silently lost', () => {
  const sim = new FactorySimulation(8, 4);
  sim.place('belt', 2, 1, DIR.E); sim.place('belt', 2, 2, DIR.E);
  for (const [x, y] of [[2, 1], [2, 2]]) {
    const b = sim.entityAt(x, y);
    b.item = { id: x * 10 + y, cake: makeWholeCake(), progress: 0.5, inDir: DIR.E, lastTick: -1, x: x + 0.5, y: y + 0.5, px: 0, py: 0 };
  }
  // Cutter covers both cells; only (2,1) is its input.
  const res = sim.placeReplacingBelts('cutter', 2, 1, DIR.E);
  assert.equal(res.removed.length, 2);
  assert.equal(res.rescued, 1);
  assert.equal(res.lost, 1);
  assert.equal(sim.drainEvents().filter((e) => e.type === 'itemDestroyed').length, 1);
});

test('machines still cannot overlap other machines or leave the grid', () => {
  const g = new Game();
  g.orders.index = 3;
  assert.equal(g.buildMachine('cutter', 5, 9, DIR.E).ok, false); // starting oven
  assert.equal(g.buildMachine('cutter', 19, 19, DIR.E).ok, false); // 1×2 sticks out
});

test('not enough money is checked against the net price', () => {
  const g = new Game();
  g.orders.index = 1;
  lineToStation(g);
  g.economy.money = 197; // 200 − 5 refund = 195 needed
  assert.equal(g.buildMachine('froster', 8, 9, DIR.E).ok, true);
  assert.equal(g.economy.money, 2);
});

test('moving a machine onto belts replaces them too (with refund)', () => {
  const g = new Game();
  g.orders.index = 1;
  lineToStation(g);
  const fr = g.buildMachine('froster', 2, 2, DIR.E).entity;
  const m = g.economy.money;
  assert.ok(g.moveEntity(fr.id, 9, 9, DIR.E).ok);
  assert.equal(g.sim.entityAt(9, 9), fr);
  assert.equal(g.economy.money, m + 5);
  assert.equal(g.sim.entityAt(2, 2), null);
});

test('replacing belts keeps save/load consistent', () => {
  const g = new Game();
  g.orders.index = 1;
  lineToStation(g);
  g.buildMachine('froster', 8, 9, DIR.E);
  run(g, 5);
  const g2 = new Game();
  g2.loadState(JSON.parse(JSON.stringify(g.getSaveState())));
  assert.equal(JSON.stringify(g2.sim.serialize()), JSON.stringify(g.sim.serialize()));
});
