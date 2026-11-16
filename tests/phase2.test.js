// Cake Factory – Sweet Automation · © 2026 Brakeco Games
import test from 'node:test';
import assert from 'node:assert/strict';
import { FactorySimulation } from '../src/simulation/FactorySimulation.js';
import { DIR } from '../src/simulation/Grid.js';
import { SIM } from '../src/core/Config.js';
import { makeWholeCake, makeCake, makePiece } from '../src/cakes/CakeModel.js';
import { cakeKey, parseCakeKey } from '../src/cakes/CakeSerializer.js';
import { cutHalves } from '../src/cakes/CakeOperations.js';
import { STATUS } from '../src/machines/Machine.js';
import { Game } from '../src/core/Game.js';
import { ORDER_DEFS, unlocksAfter, orderIndexById } from '../src/gameplay/OrderDefs.js';
import { migrateSave } from '../src/storage/SaveMigration.js';
import { SAVE } from '../src/core/Config.js';

const seconds = (sim, s) => { for (let i = 0; i < Math.round(s * SIM.TICK_RATE); i++) sim.step(); };
const run = (game, s) => { for (let i = 0; i < Math.round(s * SIM.TICK_RATE); i++) game.fixedUpdate(); };
const keys = (cakes) => cakes.map(cakeKey);

/** Collects cakes delivered into a station at (x,y). */
function sink(sim) {
  const got = [];
  sim.deliveryValidator = (cake) => { got.push(cake); return { accepted: true, reward: 0 }; };
  return got;
}
/** Feed a specific cake from a "source": a belt we keep topping up. */
function feeder(sim, x, y, dir, cakeFn) {
  const b = sim.place('belt', x, y, dir);
  return () => {
    if (!b.item) {
      b.item = { id: Math.random(), cake: cakeFn(), progress: 0.5, inDir: dir, lastTick: -1, x: 0, y: 0, px: 0, py: 0 };
      sim._itemPos(b, b.item); b.item.px = b.item.x; b.item.py = b.item.y;
    }
  };
}
function runFeeding(sim, s, feeds) {
  for (let i = 0; i < Math.round(s * SIM.TICK_RATE); i++) { feeds.forEach((f) => f()); sim.step(); }
}

test('froster frosts the top layer in its configured color', () => {
  const sim = new FactorySimulation(8, 3);
  const f = feeder(sim, 0, 1, DIR.E, () => makeWholeCake('vanilla'));
  const fr = sim.place('froster', 1, 1, DIR.E);
  assert.ok(fr.setConfig('color', 'blue'));
  assert.equal(fr.setConfig('color', 'rainbow'), false);
  sim.place('delivery', 2, 1, 0);
  const got = sink(sim);
  runFeeding(sim, 5, [f]);
  assert.ok(got.length >= 2);
  assert.ok(got.every((c) => c.layers[0].quadrants.every((p) => p.frosting === 'blue')));
});

test('rotator turns quadrants clockwise', () => {
  const sim = new FactorySimulation(8, 3);
  const src = makeCake([[makePiece('vanilla'), makePiece('chocolate'), null, null]]); // top half
  const f = feeder(sim, 0, 1, DIR.E, () => src);
  sim.place('rotator', 1, 1, DIR.E);
  sim.place('delivery', 2, 1, 0);
  const got = sink(sim);
  runFeeding(sim, 4, [f]);
  assert.ok(got.length >= 2);
  assert.equal(cakeKey(got[0]), '-,vanilla:_:_,chocolate:_:_,-'); // now the right half
});

test('cutter: left half exits the left (north) port, right half the right (south) port', () => {
  const sim = new FactorySimulation(10, 6);
  const four = () => makeCake([[makePiece('vanilla'), makePiece('chocolate'), makePiece('strawberry'), makePiece('lemon')]]);
  const f = feeder(sim, 0, 1, DIR.E, four);
  sim.place('cutter', 1, 1, DIR.E);            // cells (1,1) and (1,2)
  sim.place('belt', 2, 1, DIR.E); sim.place('belt', 2, 2, DIR.E);
  const left = sim.place('delivery', 3, 0, 0); // covers (3..4, 0..1) – receives row 1
  sim.place('trash', 3, 2, 0);                 // receives row 2
  const got = [];
  let trashed = [];
  sim.deliveryValidator = (cake) => { got.push(cake); return { accepted: true }; };
  for (let i = 0; i < 8 * SIM.TICK_RATE; i++) {
    f(); sim.step();
    trashed.push(...sim.drainEvents().filter((e) => e.type === 'trashed').map((e) => e.cake));
  }
  assert.ok(left);
  assert.ok(got.length >= 3);
  const [l, r] = cutHalves(four());
  assert.ok(keys(got).every((k) => k === cakeKey(l)), 'only left halves at the station');
  assert.ok(trashed.length >= 3 && keys(trashed).every((k) => k === cakeKey(r)), 'right halves trashed');
});

test('cutter facing south (rot 1) mirrors its exits correctly', () => {
  const sim = new FactorySimulation(6, 8);
  const c = sim.place('cutter', 2, 1, DIR.S); // 2 wide × 1 tall: cells (2,1) and (1,1)?
  assert.ok(c);
  // Facing south, input is on the north side, "left" of travel (south) is east.
  const outs = c.outputs.map((p) => [p.x, p.y, p.dir, p.slot]);
  const ins = c.inputs.map((p) => [p.x, p.y, p.dir]);
  assert.deepEqual(ins, [[3, 1, DIR.N]]);
  assert.deepEqual(outs, [[3, 1, DIR.S, 0], [2, 1, DIR.S, 1]]);
});

test('cutter with one output blocked stops taking new cakes (no loss, no overproduction)', () => {
  const sim = new FactorySimulation(10, 5);
  const f = feeder(sim, 0, 1, DIR.E, () => makeWholeCake());
  const cut = sim.place('cutter', 1, 1, DIR.E);
  sim.place('trash', 2, 1, 0);        // left exit fine
  // right exit (2,2) has nothing → blocked
  runFeeding(sim, 10, [f]);
  assert.equal(cut.processedTotal, 1);
  assert.equal(cut.status, STATUS.NO_OUTPUT);
  assert.ok(cut.outSlots[1], 'right half waits in the machine');
  assert.ok(cut.inSlots[0], 'next cake is buffered, not lost');
});

test('combiner joins matching halves and refuses overlapping ones', () => {
  const sim = new FactorySimulation(10, 5);
  const [vl] = cutHalves(makeWholeCake('vanilla'));
  const [, cr] = cutHalves(makeWholeCake('chocolate'));
  const fa = feeder(sim, 0, 1, DIR.E, () => vl);
  const fb = feeder(sim, 0, 2, DIR.E, () => cr);
  sim.place('combiner', 1, 1, DIR.E);
  sim.place('delivery', 2, 1, 0);
  const got = sink(sim);
  runFeeding(sim, 10, [fa, fb]);
  assert.ok(got.length >= 3);
  assert.ok(got.every((c) => cakeKey(c) === 'vanilla:_:_,chocolate:_:_,chocolate:_:_,vanilla:_:_'));

  const sim2 = new FactorySimulation(10, 5);
  const ga = feeder(sim2, 0, 1, DIR.E, () => vl);
  const gb = feeder(sim2, 0, 2, DIR.E, () => vl); // same half twice → overlap
  const comb = sim2.place('combiner', 1, 1, DIR.E);
  sim2.place('delivery', 2, 1, 0);
  const got2 = sink(sim2);
  runFeeding(sim2, 6, [ga, gb]);
  assert.equal(got2.length, 0);
  assert.equal(comb.status, STATUS.INCOMPATIBLE);
  assert.match(comb.refuseReason, /overlap/i);
});

test('processor state (in-flight + buffered cakes) survives save/load', () => {
  const sim = new FactorySimulation(10, 5);
  const f = feeder(sim, 0, 1, DIR.E, () => makeWholeCake('vanilla'));
  const cut = sim.place('cutter', 1, 1, DIR.E);
  runFeeding(sim, 1.0, [f]);
  assert.ok(cut.working);
  const { sim: b, problems } = FactorySimulation.deserialize(JSON.parse(JSON.stringify(sim.serialize())));
  assert.deepEqual(problems, []);
  assert.equal(JSON.stringify(b.serialize()), JSON.stringify(sim.serialize()));
});

test('every order is producible with what earlier orders unlocked', () => {
  ORDER_DEFS.forEach((o, i) => {
    const u = unlocksAfter(i);
    for (const m of o.requires) assert.ok(u.machines.has(m), `${o.name} needs ${m} which is still locked`);
    const cake = parseCakeKey(o.cake);
    for (const l of cake.layers) for (const p of l.quadrants) {
      if (!p) continue;
      assert.ok(u.flavors.has(p.flavor), `${o.name} needs flavor ${p.flavor}`);
      if (p.frosting) {
        assert.ok(u.frostings.has(p.frosting), `${o.name} needs frosting ${p.frosting}`);
        assert.ok(o.requires.includes('froster'), `${o.name} needs the froster listed`);
      }
    }
    const partial = cake.layers[0].quadrants.some((q) => !q) || new Set(cake.layers[0].quadrants.map((q) => q && q.flavor)).size > 1;
    if (partial) assert.ok(o.requires.includes('cutter'), `${o.name} needs a cutter`);
  });
});

function buildHalfAndHalf(game, keepVanilla, keepChoc, rotate) {
  // Vanilla line (rows 2-3) and chocolate line (rows 6-7) feeding a combiner.
  const g = game;
  const ok = (r) => assert.ok(r.ok, r.reason);
  ok(g.buildMachine('oven', 1, 2, DIR.E));
  ok(g.buildMachine('oven', 1, 6, DIR.E));
  const ovens = [...g.sim.entities.values()].filter((e) => e.type === 'oven' && e.y !== 9);
  ok(g.configureMachine(ovens.find((o) => o.y === 6).id, 'flavor', 'chocolate'));
  g.buildBeltPath([{ x: 2, y: 2, dir: DIR.E }]);
  g.buildBeltPath([{ x: 2, y: 6, dir: DIR.E }]);
  ok(g.buildMachine('cutter', 3, 2, DIR.E));
  ok(g.buildMachine('cutter', 3, 6, DIR.E));
  // Vanilla keeps `keepVanilla` ('left' row 2 | 'right' row 3); trash the other.
  const vKeepY = keepVanilla === 'left' ? 2 : 3, vTrashY = keepVanilla === 'left' ? 3 : 2;
  const cKeepY = keepChoc === 'left' ? 6 : 7, cTrashY = keepChoc === 'left' ? 7 : 6;
  ok(g.buildMachine('trash', 4, vTrashY, 0));
  ok(g.buildMachine('trash', 4, cTrashY, 0));
  if (rotate) { ok(g.buildMachine('rotator', 4, vKeepY, DIR.E)); ok(g.buildMachine('rotator', 4, cKeepY, DIR.E)); }
  const x0 = rotate ? 5 : 4;
  // Route vanilla keep → combiner top input (7,4); chocolate keep → bottom input (7,5).
  const pathV = [{ x: x0, y: vKeepY, dir: DIR.E }];
  for (let y = vKeepY; y < 4; y++) pathV.push({ x: 6, y, dir: DIR.S });
  if (x0 < 6) for (let x = x0 + 1; x < 6; x++) pathV.splice(1, 0, { x, y: vKeepY, dir: DIR.E });
  pathV.push({ x: 6, y: 4, dir: DIR.E });
  const pathC = [{ x: x0, y: cKeepY, dir: DIR.E }];
  if (x0 < 6) for (let x = x0 + 1; x < 6; x++) pathC.push({ x, y: cKeepY, dir: DIR.E });
  for (let y = cKeepY; y > 5; y--) pathC.push({ x: 6, y, dir: DIR.N });
  pathC.push({ x: 6, y: 5, dir: DIR.E });
  // Fix the corner cells' directions (the cell where a path turns points along the new leg).
  const fix = (p) => p.map((c, i) => (i + 1 < p.length && (p[i + 1].x !== c.x + [1, 0, -1, 0][c.dir] || p[i + 1].y !== c.y + [0, 1, 0, -1][c.dir])
    ? { ...c, dir: p[i + 1].x > c.x ? DIR.E : p[i + 1].y > c.y ? DIR.S : p[i + 1].y < c.y ? DIR.N : DIR.W } : c));
  g.buildBeltPath(fix(pathV));
  g.buildBeltPath(fix(pathC));
  ok(g.buildMachine('combiner', 7, 4, DIR.E));
  g.buildBeltPath([{ x: 8, y: 4, dir: DIR.E }]);
  ok(g.buildMachine('delivery', 9, 4, 0));
}

test('integration: a real Half & Half factory completes the order', () => {
  const g = new Game();
  g.orders.index = orderIndexById('o3_half_and_half');
  g.economy.money = 10000;
  buildHalfAndHalf(g, 'left', 'right', false);
  const before = g.orders.index;
  run(g, 60);
  assert.ok(g.orders.index > before, `order completed (delivered ${g.orders.delivered})`);
});

test('integration: a real Sunrise factory (with rotators) completes the order', () => {
  const g = new Game();
  g.orders.index = orderIndexById('o6_sunrise');
  g.economy.money = 10000;
  // Chocolate LEFT half rotated CW → top half; vanilla RIGHT half rotated CW → bottom half.
  buildHalfAndHalf(g, 'right', 'left', true);
  const before = g.orders.index;
  run(g, 60);
  assert.ok(g.orders.index > before, `order completed (delivered ${g.orders.delivered})`);
});

test('locked machines and flavors are refused with a helpful reason', () => {
  const g = new Game();
  const r = g.buildMachine('cutter', 0, 0, 0);
  assert.equal(r.ok, false);
  assert.match(r.reason, /Strawberry Frosting/);
  const oven = [...g.sim.entities.values()].find((e) => e.type === 'oven');
  assert.equal(g.configureMachine(oven.id, 'flavor', 'chocolate').ok, false);
  g.orders.index = 2;
  assert.equal(g.configureMachine(oven.id, 'flavor', 'chocolate').ok, true);
  assert.equal(oven.config.flavor, 'chocolate');
  // The next oven inherits the last chosen flavor.
  g.economy.money = 1000;
  const o2 = g.buildMachine('oven', 0, 0, 0).entity;
  assert.equal(o2.config.flavor, 'chocolate');
});

test('completing an order reports what it unlocked', () => {
  const g = new Game();
  let ev = null;
  g.bus.on('orderCompleted', (e) => { ev = e; });
  for (let i = 0; i < 5; i++) g.orders.deliver(makeWholeCake(), i);
  assert.deepEqual(ev.unlocked.map((u) => u.value).sort(), ['froster', 'pink']);
});

test('v2 (Phase 1) saves migrate to sensible Phase 2 orders', () => {
  const base = { version: 2, economy: { money: 50 }, factory: { w: 20, h: 20, nextId: 1, entities: [] } };
  const m = (index, delivered) => migrateSave({ ...base, orders: { index, delivered, completed: [] } }).orders;
  assert.equal(m(0, 3).id, 'o1_vanilla_delight');
  assert.equal(m(1, 4).id, 'o2_morning_rush');
  assert.equal(m(1, 4).delivered, 4);
  assert.equal(m(2, 7).id, 'o4_half_moon');
  assert.equal(m(2, 7).delivered, 0);
  const s = migrateSave({ ...base, orders: { index: 1, delivered: 4 } });
  assert.equal(s.version, SAVE.FORMAT_VERSION);
  const g = new Game();
  g.loadState(s);
  // Morning Rush was later removed: such saves continue with Half Moon.
  assert.equal(g.orders.current.id, 'o4_half_moon');
  assert.equal(g.orders.delivered, 0);
  assert.ok(g.isUnlocked('machines', 'froster'), 'earlier unlocks are granted');
});

test('cakes ride the machine’s own belt, stop at the stage, then ride out', () => {
  const sim = new FactorySimulation(8, 3);
  const f = feeder(sim, 0, 1, DIR.E, () => makeWholeCake('vanilla'));
  const fr = sim.place('froster', 1, 1, DIR.E);
  sim.place('belt', 2, 1, DIR.E);
  let sawRiding = false, sawStoppedWorking = false, sawExiting = false, lastIn = -1;
  for (let i = 0; i < 4 * SIM.TICK_RATE; i++) {
    f(); sim.step();
    if (fr.inSlots[0] && !fr.working) {
      if (fr.inProg[0] > 0 && fr.inProg[0] < 1) sawRiding = true;
      if (lastIn >= 0 && fr.inProg[0] < lastIn && fr.inSlots[0] === fr._lastIn) assert.fail('input went backwards');
      lastIn = fr.inProg[0]; fr._lastIn = fr.inSlots[0];
    }
    if (fr.working) { sawStoppedWorking = true; assert.ok(fr.current, 'cake is on the stage'); }
    if (fr.outSlots[0] && fr.outProg[0] > 0 && fr.outProg[0] < 1) sawExiting = true;
    // a cake never leaves before reaching the exit
    if (fr.outSlots[0]) assert.ok(fr.outProg[0] <= 1);
  }
  assert.ok(sawRiding && sawStoppedWorking && sawExiting);
  assert.ok(sim.entityAt(2, 1).item || fr.processedTotal >= 1);
});

test('while the stage is busy the next cake waits on the machine belt, short of the stage', () => {
  const sim = new FactorySimulation(8, 3);
  const f = feeder(sim, 0, 1, DIR.E, () => makeWholeCake('vanilla'));
  const fr = sim.place('froster', 1, 1, DIR.E);
  sim.place('trash', 2, 1, 0);
  let checked = false;
  for (let i = 0; i < 6 * SIM.TICK_RATE; i++) {
    f(); sim.step();
    if (fr.working && fr.inSlots[0]) { assert.ok(fr.inProg[0] < 1, 'waiting cake does not overlap the stage'); checked = true; }
  }
  assert.ok(checked);
});
