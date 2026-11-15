// Cake Factory – Sweet Automation · © 2026 Brakeco Games
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/Game.js';
import { OrderManager } from '../src/gameplay/OrderManager.js';
import { EconomyManager } from '../src/gameplay/EconomyManager.js';
import { ORDER_DEFS } from '../src/gameplay/OrderDefs.js';
import { makeWholeCake } from '../src/cakes/CakeModel.js';
import { frost } from '../src/cakes/CakeOperations.js';
import { parseCakeKey } from '../src/cakes/CakeSerializer.js';
import { SIM, ECONOMY } from '../src/core/Config.js';
import { DIR } from '../src/simulation/Grid.js';

const ticks = (game, s) => { for (let i = 0; i < s * SIM.TICK_RATE; i++) game.fixedUpdate(); };

test('order defs are valid cake keys and well-formed', () => {
  const ids = new Set();
  for (const o of ORDER_DEFS) {
    assert.ok(parseCakeKey(o.cake));
    assert.ok(o.quantity > 0 && o.reward > 0 && o.perCake >= 0);
    assert.ok(!ids.has(o.id)); ids.add(o.id);
  }
});

test('order matching accepts exact cakes only and completes', () => {
  const om = new OrderManager();
  const events = [];
  om.on((e) => events.push(e));
  assert.equal(om.deliver(frost(makeWholeCake(), 'pink'), 0).accepted, false);
  for (let i = 0; i < 4; i++) assert.equal(om.deliver(makeWholeCake(), i).accepted, true);
  const last = om.deliver(makeWholeCake(), 5);
  assert.equal(last.reward, ORDER_DEFS[0].perCake + ORDER_DEFS[0].reward);
  assert.equal(om.index, 1);
  assert.equal(om.delivered, 0);
  assert.ok(events.some((e) => e.type === 'orderCompleted'));
});

test('bonus is awarded only within the time limit (clock starts at first cake)', () => {
  const run = (gap) => {
    const om = new OrderManager();
    om.index = ORDER_DEFS.findIndex((o) => o.bonus);
    const def = om.current;
    let total = 0;
    for (let i = 0; i < def.quantity; i++) total += om.deliver(parseCakeKey(def.cake), 100 + i * gap).reward;
    return { total, def, completed: om.completed[0] };
  };
  const fast = run(1), slow = run(5);
  assert.equal(fast.completed.bonus, true);
  assert.equal(slow.completed.bonus, false);
  assert.equal(fast.total - slow.total, fast.def.bonus.reward);
});

test('economy: cannot overspend, refunds and income tracking', () => {
  const e = new EconomyManager(100);
  assert.equal(e.spend(150), false);
  assert.equal(e.money, 100);
  assert.equal(e.spend(40), true);
  e.refund(40);
  assert.equal(e.money, 100);
  e.earn(60, 30);
  assert.equal(e.incomePerMinute(60), 60);
  assert.equal(e.spend(-5), false);
});

test('new game starts in a valid, solvable state', () => {
  const g = new Game();
  assert.equal(g.economy.money, ECONOMY.START_MONEY);
  const types = [...g.sim.entities.values()].map((e) => e.type).sort();
  assert.deepEqual(types, ['delivery', 'oven']);
  // Connecting the starting machines costs far less than the starting money.
  const r = g.buildBeltPath([6, 7, 8, 9, 10, 11].map((x) => ({ x, y: 9, dir: DIR.E })));
  assert.equal(r.placed, 6);
  assert.equal(g.economy.money, ECONOMY.START_MONEY - 30);
});

test('full loop: tutorial order completes and pays out', () => {
  const g = new Game();
  g.tutorial.next(); // past intro
  g.buildBeltPath([6, 7, 8, 9, 10, 11].map((x) => ({ x, y: 9, dir: DIR.E })));
  const start = g.economy.money;
  ticks(g, 20);
  assert.ok(g.orders.index >= 1, 'first order completed');
  const o = ORDER_DEFS[0];
  assert.ok(g.economy.money >= start + o.quantity * o.perCake + o.reward);
  assert.ok(g.tutorial.step >= 4, `tutorial advanced, step ${g.tutorial.step}`);
  assert.equal(g.level, 2);
});

test('build rejects unaffordable or invalid placements without charging', () => {
  const g = new Game();
  g.economy.money = 50;
  assert.equal(g.buildMachine('oven', 0, 0, 0).ok, false);
  assert.equal(g.economy.money, 50);
  g.economy.money = 500;
  assert.equal(g.buildMachine('oven', 5, 9, 0).ok, false); // occupied by starting oven
  assert.equal(g.economy.money, 500);
  assert.equal(g.buildMachine('oven', 0, 0, 0).ok, true);
  assert.equal(g.economy.money, 400);
});

test('belt path partially built when money runs out', () => {
  const g = new Game();
  g.economy.money = 12;
  const r = g.buildBeltPath([0, 1, 2, 3].map((x) => ({ x, y: 0, dir: DIR.E })));
  assert.equal(r.placed, 2);
  assert.equal(r.short, true);
  assert.equal(g.economy.money, 2);
});

test('removing refunds and running out of money never goes negative', () => {
  const g = new Game();
  const r = g.buildMachine('oven', 0, 0, 0);
  const m = g.economy.money;
  g.removeEntity(r.entity.id);
  assert.equal(g.economy.money, m + 100);
  g.economy.money = 0;
  assert.equal(g.buildBeltPath([{ x: 0, y: 0, dir: 0 }]).ok, false);
  assert.equal(g.economy.money, 0);
});
