// Cake Factory – Sweet Automation · © 2026 Brakeco Games
import test from 'node:test';
import assert from 'node:assert/strict';
import { FactorySimulation } from '../src/simulation/FactorySimulation.js';
import { DIR } from '../src/simulation/Grid.js';
import { SIM, BELT } from '../src/core/Config.js';
import { makeWholeCake } from '../src/cakes/CakeModel.js';
import { STATUS } from '../src/machines/Machine.js';

const seconds = (sim, s) => { const n = Math.round(s * SIM.TICK_RATE); for (let i = 0; i < n; i++) sim.step(); };
const acceptAll = () => ({ accepted: true, reward: 1 });

function line(sim, x0, x1, y, dir = DIR.E) {
  for (let x = x0; x <= x1; x++) sim.place('belt', x, y, dir);
}
function putCake(sim, x, y, progress = 0) {
  const b = sim.entityAt(x, y);
  b.item = { id: 999 + x, cake: makeWholeCake(), progress, inDir: b.dir, lastTick: -1, x: 0, y: 0, px: 0, py: 0 };
  sim._itemPos(b, b.item);
}
function allCakes(sim) {
  const out = [];
  for (const e of sim.entities.values()) {
    if (e.kind === 'belt' && e.item) out.push(e.item);
  }
  return out;
}

test('placement validation: bounds, overlap, footprints', () => {
  const sim = new FactorySimulation(10, 10);
  assert.ok(sim.place('delivery', 8, 8, 0));
  assert.equal(sim.canPlace('delivery', 9, 9, 0).ok, false); // outside
  assert.equal(sim.canPlace('belt', 9, 9, 0).ok, false);     // occupied by 2x2
  assert.equal(sim.canPlace('belt', -1, 0, 0).ok, false);
  assert.equal(sim.place('oven', 9, 9, 0), null);
  assert.ok(sim.place('oven', 0, 0, 0));
});

test('a cake travels along a belt at the configured speed', () => {
  const sim = new FactorySimulation(10, 3);
  line(sim, 0, 5, 1);
  putCake(sim, 0, 1, 0);
  seconds(sim, 2 / BELT.SPEED); // two cells worth of travel
  const [it] = allCakes(sim);
  assert.ok(sim.entityAt(2, 1).item === it, 'cake should be on belt #2');
  assert.ok(Math.abs(it.x - 2.0) < 0.1, `x≈2.0 got ${it.x}`); // entry edge of cell 2
});

test('cake waits at a dead end (backpressure) and is never lost', () => {
  const sim = new FactorySimulation(10, 3);
  line(sim, 0, 2, 1);
  putCake(sim, 0, 1);
  seconds(sim, 5);
  const b = sim.entityAt(2, 1);
  assert.ok(b.item, 'cake waits on last belt');
  assert.equal(b.item.progress, 1);
  assert.ok(b.blocked, 'belt reports blocked');
  assert.equal(allCakes(sim).length, 1);
});

test('no two cakes share a cell and spacing is respected in a jam', () => {
  const sim = new FactorySimulation(12, 3);
  line(sim, 0, 9, 1);
  for (let x = 0; x < 8; x += 1) putCake(sim, x, 1, 0.2);
  for (let i = 0; i < 400; i++) {
    sim.step();
    const cakes = allCakes(sim).sort((a, b) => a.x - b.x);
    assert.equal(cakes.length, 8, 'no cakes created or destroyed');
    for (let k = 1; k < cakes.length; k++) {
      assert.ok(cakes[k].x - cakes[k - 1].x >= BELT.MIN_SPACING - 1e-6, `spacing violated at tick ${i}`);
    }
  }
  // Fully jammed at the end: 8 cakes in the last 8 cells.
  for (let x = 2; x <= 9; x++) assert.ok(sim.entityAt(x, 1).item, `cell ${x} filled`);
});

test('dense line flows without gaps (downstream-first update)', () => {
  const sim = new FactorySimulation(30, 3);
  line(sim, 0, 25, 1);
  putCake(sim, 0, 1, 0.5); putCake(sim, 1, 1, 0.5);
  seconds(sim, 3);
  const [a, b] = allCakes(sim).sort((p, q) => p.x - q.x);
  assert.ok(Math.abs((b.x - a.x) - 1) < 0.05, `stays 1 cell apart, got ${b.x - a.x}`);
});

test('corner: cake turns from east-bound into south-bound belt', () => {
  const sim = new FactorySimulation(5, 5);
  sim.place('belt', 0, 0, DIR.E);
  sim.place('belt', 1, 0, DIR.S);
  sim.place('belt', 1, 1, DIR.S);
  putCake(sim, 0, 0, 0);
  seconds(sim, 2.2 / BELT.SPEED);
  const it = sim.entityAt(1, 1).item;
  assert.ok(it, 'reached the south belt');
  assert.ok(Math.abs(it.x - 1.5) < 1e-6, 'centered horizontally after the turn');
});

test('belt pointing back into source does not accept', () => {
  const sim = new FactorySimulation(5, 3);
  sim.place('belt', 0, 1, DIR.E);
  sim.place('belt', 1, 1, DIR.W); // head-on
  putCake(sim, 0, 1);
  seconds(sim, 3);
  assert.ok(sim.entityAt(0, 1).item, 'stays on first belt');
  assert.equal(sim.entityAt(1, 1).item, null);
});

test('conveyor loop keeps circulating without duplication or deadlock', () => {
  const sim = new FactorySimulation(4, 4);
  sim.place('belt', 0, 0, DIR.E); sim.place('belt', 1, 0, DIR.S);
  sim.place('belt', 1, 1, DIR.W); sim.place('belt', 0, 1, DIR.N);
  putCake(sim, 0, 0, 0);
  putCake(sim, 1, 1, 0);
  const seen = new Set();
  for (let i = 0; i < 600; i++) {
    sim.step();
    const cakes = allCakes(sim);
    assert.equal(cakes.length, 2);
    for (const c of cakes) seen.add(`${Math.floor(c.x)},${Math.floor(c.y)}`);
  }
  assert.equal(seen.size, 4, 'cakes visited every loop cell');
});

test('oven bakes on schedule and outputs onto the belt', () => {
  const sim = new FactorySimulation(10, 3);
  const oven = sim.place('oven', 0, 1, DIR.E);
  line(sim, 1, 8, 1);
  seconds(sim, oven.bakeTime * 3 + 0.05);
  assert.equal(oven.producedTotal, 3);
  assert.equal(allCakes(sim).length, 3);
});

test('oven with nothing in front stops after one cake (no overproduction)', () => {
  const sim = new FactorySimulation(5, 3);
  const oven = sim.place('oven', 0, 1, DIR.E);
  seconds(sim, 20);
  assert.equal(oven.producedTotal, 1);
  assert.equal(oven.buffer.length, 1);
  assert.equal(oven.status, STATUS.NO_OUTPUT);
});

test('oven blocked by a jammed line stops producing and reports blocked', () => {
  const sim = new FactorySimulation(6, 3);
  const oven = sim.place('oven', 0, 1, DIR.E);
  line(sim, 1, 3, 1);
  seconds(sim, 60);
  const onBelts = allCakes(sim).length;
  assert.equal(onBelts, 3, 'three belts full');
  assert.equal(oven.producedTotal, onBelts + oven.buffer.length);
  assert.equal(oven.status, STATUS.BLOCKED);
});

test('oven → belt → delivery: every cake is validated exactly once', () => {
  const sim = new FactorySimulation(12, 4);
  const oven = sim.place('oven', 0, 1, DIR.E);
  line(sim, 1, 4, 1);
  sim.place('delivery', 5, 1, 0);
  let calls = 0;
  sim.deliveryValidator = () => { calls++; return { accepted: true, reward: 10 }; };
  seconds(sim, 30);
  const delivered = sim.drainEvents().filter((e) => e.type === 'delivered');
  assert.equal(delivered.length, calls);
  const inFlight = allCakes(sim).length + oven.buffer.length;
  assert.equal(oven.producedTotal, delivered.length + inFlight, 'conservation of cakes');
  assert.ok(delivered.length >= 10);
});

test('oven directly adjacent to the delivery station feeds it', () => {
  const sim = new FactorySimulation(6, 4);
  sim.place('oven', 0, 1, DIR.E);
  sim.place('delivery', 1, 1, 0);
  sim.deliveryValidator = acceptAll;
  seconds(sim, 10);
  assert.equal(sim.drainEvents().filter((e) => e.type === 'delivered').length, 4);
});

test('rejected cakes still leave the line and are reported', () => {
  const sim = new FactorySimulation(8, 4);
  sim.place('oven', 0, 1, DIR.E);
  line(sim, 1, 2, 1);
  sim.place('delivery', 3, 1, 0);
  sim.deliveryValidator = () => ({ accepted: false, reason: 'nope' });
  seconds(sim, 10);
  const ev = sim.drainEvents().filter((e) => e.type === 'delivered');
  assert.ok(ev.length >= 3);
  assert.ok(ev.every((e) => !e.accepted && e.reason === 'nope'));
});

test('removing a belt carrying a cake reports the lost cake', () => {
  const sim = new FactorySimulation(5, 3);
  line(sim, 0, 2, 1);
  putCake(sim, 1, 1, 0.5);
  const id = sim.entityAt(1, 1).id;
  const res = sim.remove(id);
  assert.equal(res.lost.length, 1);
  const ev = sim.drainEvents();
  assert.equal(ev[0].type, 'itemDestroyed');
  assert.equal(sim.entityAt(1, 1), null);
});

test('rotating and moving machines keeps their state', () => {
  const sim = new FactorySimulation(8, 8);
  const oven = sim.place('oven', 2, 2, DIR.E);
  seconds(sim, 3); // buffer full, nothing in front
  assert.equal(oven.buffer.length, 1);
  assert.ok(sim.rotate(oven.id));
  assert.equal(oven.outputs[0].dir, DIR.S);
  assert.ok(sim.move(oven.id, 5, 5));
  assert.equal(oven.buffer.length, 1);
  assert.equal(sim.entityAt(2, 2), null);
  assert.equal(sim.entityAt(5, 5), oven);
  sim.place('belt', 5, 6, DIR.S);
  seconds(sim, 0.2);
  assert.equal(oven.buffer.length, 0, 'buffered cake released after connecting');
});

test('machines cannot be moved or rotated into occupied/outside cells', () => {
  const sim = new FactorySimulation(4, 4);
  const d = sim.place('delivery', 2, 2, 0);
  sim.place('belt', 0, 0, DIR.E);
  assert.equal(sim.move(d.id, 3, 3), false);
  assert.equal(sim.move(d.id, 0, 0), false);
  assert.equal(sim.entityAt(2, 2), d);
});

test('simulation is deterministic', () => {
  const build = () => {
    const sim = new FactorySimulation(12, 6);
    sim.place('oven', 0, 1, DIR.E); line(sim, 1, 6, 1);
    sim.place('oven', 4, 3, DIR.N); sim.place('belt', 4, 2, DIR.N);
    sim.place('delivery', 7, 1, 0);
    sim.deliveryValidator = acceptAll;
    seconds(sim, 40);
    return JSON.stringify(sim.serialize());
  };
  assert.equal(build(), build());
});

test('serialize → deserialize preserves layout, cakes and oven state', () => {
  const sim = new FactorySimulation(10, 4);
  sim.place('oven', 0, 1, DIR.E);
  line(sim, 1, 3, 1);
  seconds(sim, 30); // jammed, oven buffer full
  const data = JSON.parse(JSON.stringify(sim.serialize()));
  const { sim: b, problems } = FactorySimulation.deserialize(data);
  assert.deepEqual(problems, []);
  assert.equal(JSON.stringify(b.serialize()), JSON.stringify(sim.serialize()));
  // and it keeps running: add a delivery and everything drains
  b.place('delivery', 4, 1, 0);
  b.deliveryValidator = acceptAll;
  seconds(b, 10);
  assert.ok(b.drainEvents().filter((e) => e.type === 'delivered').length >= 4);
});

test('deserialize skips invalid entities instead of failing', () => {
  const { sim, problems } = FactorySimulation.deserialize({
    w: 5, h: 5, nextId: 3,
    entities: [{ id: 1, t: 'belt', x: 0, y: 0, r: 0 }, { id: 2, t: 'belt', x: 0, y: 0, r: 1 }, { id: 3, t: 'laser', x: 1, y: 1, r: 0 }],
  });
  assert.equal(sim.entities.size, 1);
  assert.equal(problems.length, 2);
});
