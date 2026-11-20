// Cake Factory – Sweet Automation · © 2026 Brakeco Games
// Endless orders: every generated cake is provably buildable with what is unlocked,
// and the new machines (Layer Stacker, Decorator) really work in the simulation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ORDER_DEFS, makeContractOrder, unlocksAfter, nextUnlock, nextShowpiece, CONTRACT_UNLOCKS } from '../src/gameplay/OrderDefs.js';
import { requiredMachines } from '../src/gameplay/RecipeGenerator.js';
import { cakeKey, parseCakeKey } from '../src/cakes/CakeSerializer.js';
import { makeWholeCake, makeCake, makePiece, isValidCakeData } from '../src/cakes/CakeModel.js';
import { cutHalves, rotateCW, combine, stack, frost, decorate } from '../src/cakes/CakeOperations.js';
import { FactorySimulation } from '../src/simulation/FactorySimulation.js';
import { DIR } from '../src/simulation/Grid.js';
import { SIM } from '../src/core/Config.js';
import { Game } from '../src/core/Game.js';

/**
 * Builds `want` (a parsed cake) using only machine operations, restricted to the
 * machines in `m`. Returns the built cake or throws when a needed machine is missing.
 */
function solve(want, m) {
  const need = (x) => { if (!m.has(x)) throw new Error(`needs ${x}`); };
  // A whole cake of one piece type: bake → frost → decorate.
  const source = (p) => {
    let c = makeWholeCake(p.flavor);
    if (p.frosting) { need('froster'); c = frost(c, p.frosting); }
    if (p.decoration) { need('decorator'); c = decorate(c, p.decoration); }
    return c;
  };
  const turn = (c, k) => { for (let i = 0; i < k; i++) { need('rotator'); c = rotateCW(c); } return c; };
  // One quadrant of piece p at position q: cut, turn the left half to the top, cut again, turn into place.
  const quarter = (p, q) => {
    need('cutter');
    let c = cutHalves(source(p))[0];           // TL,BL
    c = turn(c, 1);                            // → TL,TR
    c = cutHalves(c)[0];                       // → TL only
    return turn(c, q);                         // TL→TR→BR→BL
  };
  const join = (a, b) => { need('combiner'); const r = combine(a, b); assert.ok(r.ok, r.reason); return r.cake; };
  const buildLayer = (q) => {
    const same = (a, b) => (!a && !b) || (a && b && cakeKey({ layers: [{ quadrants: [a, a, a, a] }] }) === cakeKey({ layers: [{ quadrants: [b, b, b, b] }] }));
    if (q.every((p) => p && same(p, q[0]))) return source(q[0]);
    if (same(q[0], q[3]) && same(q[1], q[2])) {
      // West/east halves straight from cuts – no rotator needed.
      need('cutter');
      const parts = [];
      if (q[0]) parts.push(cutHalves(source(q[0]))[0]);
      if (q[1]) parts.push(cutHalves(source(q[1]))[1]);
      return parts.length === 2 ? join(parts[0], parts[1]) : parts[0];
    }
    // A single half in another position: cut a left half and turn it.
    const filled = [0, 1, 2, 3].filter((i) => q[i]);
    if (filled.length === 2 && same(q[filled[0]], q[filled[1]])) {
      const half = cutHalves(source(q[filled[0]]))[0];   // TL,BL
      for (let k = 0; k < 4; k++) { const c = turn(half, k); if (c.layers[0].quadrants.every((p, i) => !!p === !!q[i])) return c; }
    }
    let out = null;
    for (const i of filled) { const piece = quarter(q[i], i); out = out ? join(out, piece) : piece; }
    return out;
  };
  let cake = null;
  for (const l of want.layers) {
    const layer = buildLayer(l.quadrants);
    if (!cake) cake = layer;
    else { need('stacker'); const r = stack(cake, layer); assert.ok(r.ok, r.reason); cake = r.cake; }
  }
  return cake;
}

test('300 endless orders: valid, use only unlocked things, and are solvable with exactly the unlocked machines', () => {
  for (let n = 1; n <= 300; n++) {
    const o = makeContractOrder(n);
    const u = unlocksAfter(ORDER_DEFS.length + n - 1);
    const want = parseCakeKey(o.cake);
    assert.ok(isValidCakeData(want), `#${n} valid`);
    for (const m of requiredMachines(want)) assert.ok(u.machines.has(m), `#${n} needs locked ${m}`);
    for (const l of want.layers) for (const p of l.quadrants) if (p) {
      assert.ok(u.flavors.has(p.flavor), `#${n} flavor ${p.flavor}`);
      if (p.frosting) assert.ok(u.frostings.has(p.frosting));
      if (p.decoration) assert.ok(u.decorations.has(p.decoration), `#${n} decoration ${p.decoration}`);
    }
    const built = solve(want, u.machines);
    assert.equal(cakeKey(built), o.cake, `#${n} built exactly`);
    assert.ok(o.quantity >= 6 && o.perCake > 0 && o.reward > 0 && o.bonus.seconds > 0);
  }
});

test('the unlock schedule always shows a next goal', () => {
  for (let i = 0; i < ORDER_DEFS.length + 25; i++) assert.ok(nextUnlock(i) || nextShowpiece(i), `goal at order ${i}`);
  for (let i = ORDER_DEFS.length; i < ORDER_DEFS.length + 500; i++) assert.ok(nextShowpiece(i) >= 1 && nextShowpiece(i) <= 5);
  // New things really appear: stacker, decorator, new flavors and decorations.
  const all = unlocksAfter(10000);
  for (const m of ['stacker', 'decorator']) assert.ok(all.machines.has(m));
  for (const f of ['caramel', 'redvelvet', 'pistachio']) assert.ok(all.flavors.has(f));
  assert.ok(all.decorations.size >= 5 && all.features.has('layers4'));
  assert.ok(Object.keys(CONTRACT_UNLOCKS).length >= 6);
});

const run = (sim, s, feeds) => { for (let i = 0; i < Math.round(s * SIM.TICK_RATE); i++) { feeds.forEach((f) => f()); sim.step(); } };
function feeder(sim, x, y, dir, cakeFn) {
  const b = sim.place('belt', x, y, dir);
  return () => {
    if (!b.item) {
      b.item = { id: Math.random(), cake: cakeFn(), progress: 0.5, inDir: dir, lastTick: -1, x: 0, y: 0, px: 0, py: 0 };
      sim._itemPos(b, b.item); b.item.px = b.item.x; b.item.py = b.item.y;
    }
  };
}

test('Layer Stacker puts the side-input cake on top of the main-input cake', () => {
  const sim = new FactorySimulation(10, 5);
  const fa = feeder(sim, 0, 1, DIR.E, () => makeWholeCake('chocolate'));
  const fb = feeder(sim, 0, 2, DIR.E, () => frost(makeWholeCake('vanilla'), 'pink'));
  sim.place('stacker', 1, 1, DIR.E);
  sim.place('delivery', 2, 1, 0);
  const got = [];
  sim.deliveryValidator = (cake) => { got.push(cakeKey(cake)); return { accepted: true, reward: 0 }; };
  run(sim, 12, [fa, fb]);
  assert.ok(got.length >= 3, `stacked ${got.length}`);
  for (const k of got) assert.equal(k, 'chocolate:_:_,chocolate:_:_,chocolate:_:_,chocolate:_:_/vanilla:pink:_,vanilla:pink:_,vanilla:pink:_,vanilla:pink:_');
});

test('Layer Stacker refuses stacks above 4 layers', () => {
  const sim = new FactorySimulation(10, 5);
  const tall = () => { let c = makeWholeCake('vanilla'); for (let i = 0; i < 2; i++) c = stack(c, makeWholeCake('lemon')).cake; return c; }; // 3 layers
  const fa = feeder(sim, 0, 1, DIR.E, tall);
  const fb = feeder(sim, 0, 2, DIR.E, tall);
  const st = sim.place('stacker', 1, 1, DIR.E);
  sim.place('delivery', 2, 1, 0);
  const got = [];
  sim.deliveryValidator = (cake) => { got.push(cake); return { accepted: true, reward: 0 }; };
  run(sim, 6, [fa, fb]);
  assert.equal(got.length, 0);
  assert.equal(st.status, 'incompatible');
});

test('Decorator decorates the top layer with the configured decoration', () => {
  const sim = new FactorySimulation(10, 5);
  const f = feeder(sim, 0, 1, DIR.E, () => frost(makeWholeCake('caramel'), 'white'));
  const d = sim.place('decorator', 1, 1, DIR.E);
  d.setConfig('decoration', 'cherry');
  sim.place('delivery', 2, 1, 0);
  const got = [];
  sim.deliveryValidator = (cake) => { got.push(cakeKey(cake)); return { accepted: true, reward: 0 }; };
  run(sim, 8, [f]);
  assert.ok(got.length >= 3);
  for (const k of got) assert.equal(k, Array(4).fill('caramel:white:cherry').join(','));
});

test('finishing Showpiece #5 unlocks the Layer Stacker and the celebration lists it', () => {
  const g = new Game();
  g.tutorial.skip();
  g.orders.index = ORDER_DEFS.length + 4; // Showpiece #5
  assert.equal(g.isUnlocked('machines', 'stacker'), false);
  assert.match(g.buildMachine('stacker', 2, 2, 0).reason, /Showpiece #5/);
  const events = [];
  g.bus.on('orderCompleted', (e) => events.push(e));
  const o = g.orders.current, cake = parseCakeKey(o.cake);
  for (let i = 0; i < o.quantity; i++) g.orders.deliver(cake, i);
  assert.ok(g.isUnlocked('machines', 'stacker'));
  assert.deepEqual(events[0].unlocked, [{ kind: 'machines', value: 'stacker' }]);
  g.economy.money = 5000;
  assert.ok(g.buildMachine('stacker', 2, 2, 0).ok);
});

test('rejections explain upside-down stacks and decoration mistakes', async () => {
  const { diagnoseMismatch } = await import('../src/gameplay/Diagnose.js');
  const w = (f, fr = '_', d = '_') => Array(4).fill(`${f}:${fr}:${d}`).join(',');
  const want = parseCakeKey(`${w('chocolate')}/${w('vanilla', 'pink')}`);
  assert.match(diagnoseMismatch(parseCakeKey(`${w('vanilla', 'pink')}/${w('chocolate')}`), want), /upside down/);
  assert.match(diagnoseMismatch(parseCakeKey(w('lemon', 'white')), parseCakeKey(w('lemon', 'white', 'cherry'))), /Needs cherry – add a Decorator/);
  assert.match(diagnoseMismatch(parseCakeKey(w('lemon', 'white', 'swirl')), parseCakeKey(w('lemon', 'white', 'cherry'))), /cream swirl instead of cherry/);
});

test('a real factory line (ovens → froster → stacker → decorator) completes a layered, decorated contract', () => {
  const g = new Game();
  g.tutorial.skip();
  g.orders.index = ORDER_DEFS.length + 11;   // contract #12: stacker and decorator are unlocked
  const w = (f, fr = '_', d = '_') => Array(4).fill(`${f}:${fr}:${d}`).join(',');
  const want = `${w('chocolate')}/${w('vanilla', 'pink', 'cherry')}`;
  g.orders.lastRecipe = want; g.orders.recipe = want; // play it as the "repeat" offer
  assert.equal(g.orders.current.cake, want);
  g.economy.money = 1e6;
  const E = DIR.E, row = (y, x0, x1) => Array.from({ length: x1 - x0 + 1 }, (_, i) => ({ x: x0 + i, y, dir: E }));
  // Remove the starter oven/station so the layout is ours.
  for (const e of [...g.sim.entities.values()]) g.removeEntity(e.id);
  const oc = g.buildMachine('oven', 1, 4, E).entity; g.configureMachine(oc.id, 'flavor', 'chocolate');
  g.buildBeltPath(row(4, 2, 4));
  // New machines inherit the last setting of their type, so set the vanilla oven explicitly.
  const ov = g.buildMachine('oven', 1, 5, E).entity; g.configureMachine(ov.id, 'flavor', 'vanilla');
  g.buildBeltPath(row(5, 2, 2));
  const fr = g.buildMachine('froster', 3, 5, E).entity; g.configureMachine(fr.id, 'color', 'pink');
  g.buildBeltPath(row(5, 4, 4));
  assert.ok(g.buildMachine('stacker', 5, 4, E).ok);
  g.buildBeltPath(row(4, 6, 6));
  const dec = g.buildMachine('decorator', 7, 4, E).entity; g.configureMachine(dec.id, 'decoration', 'cherry');
  g.buildBeltPath(row(4, 8, 9));
  g.buildMachine('delivery', 10, 4, 0);
  const startIndex = g.orders.index, money0 = g.economy.money;
  const qty = g.orders.current.quantity;
  for (let i = 0; i < (qty * 4 + 30) * SIM.TICK_RATE && g.orders.index === startIndex; i++) g.fixedUpdate();
  assert.equal(g.orders.index, startIndex + 1, `contract completed (${g.orders.delivered}/${qty})`);
  assert.ok(g.economy.money > money0, 'paid');
});
