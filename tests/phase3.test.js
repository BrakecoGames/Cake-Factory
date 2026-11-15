// Cake Factory – Sweet Automation · © 2026 Brakeco Games
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/Game.js';
import { FactorySimulation } from '../src/simulation/FactorySimulation.js';
import { DIR } from '../src/simulation/Grid.js';
import { SIM, UPGRADES, GLOBAL_UPGRADES, BELT, SAVE } from '../src/core/Config.js';
import { makeWholeCake } from '../src/cakes/CakeModel.js';
import { cakeKey } from '../src/cakes/CakeSerializer.js';
import { migrateSave } from '../src/storage/SaveMigration.js';

const run = (g, s) => { for (let i = 0; i < Math.round(s * SIM.TICK_RATE); i++) g.fixedUpdate(); };
const line = (g) => g.buildBeltPath([6, 7, 8, 9, 10, 11].map((x) => ({ x, y: 9, dir: DIR.E })));
const oven = (g) => [...g.sim.entities.values()].find((e) => e.type === 'oven');

test('machine upgrade costs, levels and max level', () => {
  const g = new Game();
  g.economy.money = 100000;
  const o = oven(g);
  const costs = [];
  for (let i = 0; i < 4; i++) { const r = g.upgradeMachine(o.id); assert.ok(r.ok); costs.push(r.cost); }
  assert.deepEqual(costs, UPGRADES.COST_FACTOR.map((f) => Math.round(100 * f)));
  assert.equal(o.level, 5);
  assert.equal(g.upgradeMachine(o.id).ok, false);
  assert.equal(o.invested, 100 + costs.reduce((a, b) => a + b, 0));
});

test('upgrades need money and are refused for stations and bins', () => {
  const g = new Game();
  g.economy.money = 10;
  assert.equal(g.upgradeMachine(oven(g).id).ok, false);
  assert.equal(g.economy.money, 10);
  const d = [...g.sim.entities.values()].find((e) => e.type === 'delivery');
  g.economy.money = 1e6;
  assert.equal(g.upgradeMachine(d.id).ok, false);
});

test('an upgraded oven really bakes faster and holds more', () => {
  const count = (level) => {
    const sim = new FactorySimulation(12, 3);
    const o = sim.place('oven', 0, 1, DIR.E);
    o.level = level;
    for (let x = 1; x < 8; x++) sim.place('belt', x, 1, DIR.E);
    sim.place('trash', 8, 1, 0);
    for (let i = 0; i < 20 * SIM.TICK_RATE; i++) sim.step();
    return o.producedTotal;
  };
  assert.ok(count(5) >= Math.floor(count(1) * 2.2), `L5 ${count(5)} vs L1 ${count(1)}`);
  const sim = new FactorySimulation(4, 3);
  const o = sim.place('oven', 0, 1, DIR.E);
  o.level = 5;
  for (let i = 0; i < 20 * SIM.TICK_RATE; i++) sim.step();
  assert.equal(o.buffer.length, UPGRADES.OVEN_BUFFER[4]);
});

test('removing an upgraded machine refunds purchase + upgrades', () => {
  const g = new Game();
  g.economy.money = 1000;
  const o = g.buildMachine('oven', 0, 0, 0).entity;
  g.upgradeMachine(o.id); g.upgradeMachine(o.id);
  const before = g.economy.money;
  g.removeEntity(o.id);
  assert.equal(g.economy.money, before + o.invested);
});

test('rotator directions unlock with level', () => {
  const g = new Game();
  g.orders.index = 5; g.economy.money = 100000;
  const r = g.buildMachine('rotator', 0, 0, 0).entity;
  assert.equal(g.configureMachine(r.id, 'mode', 'ccw').ok, false);
  g.upgradeMachine(r.id);
  assert.ok(g.configureMachine(r.id, 'mode', 'ccw').ok);
  assert.equal(g.configureMachine(r.id, 'mode', '180').ok, false);
  g.upgradeMachine(r.id);
  assert.ok(g.configureMachine(r.id, 'mode', '180').ok);
});

test('level-3 froster frosts only the selected quadrants', () => {
  const g = new Game();
  g.orders.index = 1; g.economy.money = 100000;
  line(g);
  const f = g.buildMachine('froster', 8, 9, DIR.E).entity;
  assert.equal(g.configureMachine(f.id, 'mask', [true, false, false, true]).ok, false, 'needs level 3');
  g.upgradeMachine(f.id); g.upgradeMachine(f.id);
  assert.ok(g.configureMachine(f.id, 'mask', [true, false, false, true]).ok);
  assert.equal(g.configureMachine(f.id, 'mask', [false, false, false, false]).ok, false);
  const out = f.process([makeWholeCake('vanilla')])[0];
  assert.equal(cakeKey(out), 'vanilla:pink:_,vanilla:_:_,vanilla:_:_,vanilla:pink:_');
});

test('faster conveyors speed up belts and machine belts', () => {
  const g = new Game();
  g.economy.money = 100000;
  assert.ok(g.buyGlobal('belt').ok);
  assert.equal(g.sim.beltSpeed, BELT.SPEED * GLOBAL_UPGRADES.belt.values[1]);
  const g2 = new Game(); g2.loadState(JSON.parse(JSON.stringify(g.getSaveState())));
  assert.equal(g2.sim.beltSpeed, g.sim.beltSpeed);
});

test('reputation multiplies what correct cakes earn', () => {
  const g = new Game();
  g.economy.money = 100000;
  g.buyGlobal('reputation');
  const r = g.sim.validateDelivery(makeWholeCake());
  assert.equal(r.reward, Math.round(10 * GLOBAL_UPGRADES.reputation.values[1]));
});

test('expansion grows the grid on every side and keeps the factory working', () => {
  const g = new Game();
  line(g);
  run(g, 6);
  g.economy.money = 100000;
  const cakes = () => [...g.sim.entities.values()].filter((e) => e.kind === 'belt' && e.item).length;
  const before = cakes();
  const r = g.buyGlobal('size');
  assert.ok(r.ok);
  assert.equal(g.sim.width, 24);
  assert.equal(oven(g).x, 7);
  assert.equal(g.sim.entityAt(7, 11), oven(g));
  assert.equal(cakes(), before, 'cakes stay on their belts');
  const delivered = g.orders.delivered + g.orders.index * 100;
  run(g, 10);
  assert.ok(g.orders.delivered + g.orders.index * 100 > delivered, 'still delivering after expansion');
  // Saved grid size wins on load.
  const g2 = new Game(); g2.loadState(JSON.parse(JSON.stringify(g.getSaveState())));
  assert.equal(g2.sim.width, 24);
  assert.equal(g2.global.size, 2);
});

test('upgraded machine level survives save/load and moving', () => {
  const g = new Game();
  g.economy.money = 1000;
  const o = oven(g);
  g.upgradeMachine(o.id);
  g.moveEntity(o.id, 2, 2, 0);
  assert.equal(o.level, 2);
  const g2 = new Game(); g2.loadState(JSON.parse(JSON.stringify(g.getSaveState())));
  assert.equal(oven(g2).level, 2);
});

test('v3 saves migrate to v4 with default global upgrades', () => {
  const s = migrateSave({ version: 3, economy: { money: 5 }, orders: { id: 'o1_vanilla_delight' }, factory: { w: 20, h: 20, nextId: 1, entities: [] } });
  assert.equal(s.version, SAVE.FORMAT_VERSION);
  assert.deepEqual(s.global, { belt: 1, reputation: 1, size: 1 });
});
