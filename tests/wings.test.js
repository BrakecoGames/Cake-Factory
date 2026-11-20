// Cake Factory – Sweet Automation · © 2026 Brakeco Games
// New wings joined by corridors: layout, placement, belts through corridors, expansion, saves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/Game.js';
import { FactorySimulation } from '../src/simulation/FactorySimulation.js';
import { DIR } from '../src/simulation/Grid.js';
import { SIM } from '../src/core/Config.js';
import { WORLD_W, WORLD_H, CORRIDOR, wingRect, corridorRect, worldMainRect, floorRects } from '../src/simulation/Layout.js';

const tick = (g, s) => { for (let i = 0; i < s * SIM.TICK_RATE; i++) g.fixedUpdate(); };

test('layout: wings never overlap the hall at its maximum size, corridors are 4 wide', () => {
  const big = worldMainRect(36);
  for (const id of ['north', 'west', 'south']) {
    const w = wingRect(id), c = corridorRect(id, worldMainRect(20));
    const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    assert.equal(overlap(w, big), false, `${id} clear of the max hall`);
    assert.ok(w.x >= 0 && w.y >= 0 && w.x + w.w <= WORLD_W && w.y + w.h <= WORLD_H);
    assert.equal(Math.min(c.w, c.h), CORRIDOR);
    assert.ok(Math.max(c.w, c.h) > 0);
  }
});

test('buying a wing keeps the running factory working and shifts it into the world', () => {
  const g = new Game();
  g.buildBeltPath([6, 7, 8, 9, 10, 11].map((x) => ({ x, y: 9, dir: DIR.E })));
  tick(g, 8);
  const before = g.stats.cakes, ents = g.sim.entities.size;
  assert.ok(before >= 1);
  g.economy.money = 100000;
  const r = g.buyWing('north');
  assert.ok(r.ok);
  assert.equal(g.economy.money, 100000 - 6000);
  assert.equal(g.sim.width, WORLD_W);
  assert.equal(g.sim.entities.size, ents, 'nothing lost');
  const oven = [...g.sim.entities.values()].find((e) => e.type === 'oven');
  assert.equal(oven.x, 5 + r.shift.dx);
  tick(g, 10);
  assert.ok(g.stats.cakes > before, 'cakes keep arriving after the conversion');
  assert.equal(g.wingPrice('west'), 15000, 'each slot has its own price');
  assert.equal(g.buyWing('north').ok, false, 'cannot buy twice');
});

test('walls are not floor; corridor and wing are; a belt line runs from the wing through the corridor into the hall', () => {
  const g = new Game();
  g.economy.money = 1e6;
  g.buyWing('north');
  const sim = g.sim;
  const main = sim.main, wing = wingRect('north'), cor = corridorRect('north', main);
  assert.equal(sim.grid.inBounds(wing.x - 1, wing.y + 2), false, 'outside the wing is wall');
  assert.equal(sim.grid.inBounds(cor.x - 1, cor.y + 1), false, 'beside the corridor is wall');
  assert.equal(g.buildMachine('oven', cor.x - 1, cor.y + 1, DIR.S).ok, false);
  // Remove the starter line, then: oven in the wing → belt south through the corridor → station in the hall.
  for (const e of [...sim.entities.values()]) g.removeEntity(e.id);
  const x = cor.x + 1;
  assert.ok(g.buildMachine('oven', x, wing.y + 10, DIR.S).ok);
  const path = [];
  for (let y = wing.y + 11; y < main.y + 3; y++) path.push({ x, y, dir: DIR.S });
  const res = g.buildBeltPath(path);
  assert.equal(res.placed, path.length, 'every corridor cell takes a belt');
  assert.ok(g.buildMachine('delivery', x, main.y + 3, 0).ok);
  tick(g, 30);
  assert.ok(g.stats.cakes >= 2, `cakes delivered through the corridor (${g.stats.cakes})`);
});

test('hall expansion after wings: grows in place, corridor gets shorter, nothing moves', () => {
  const g = new Game();
  g.economy.money = 1e6;
  g.buyWing('west');
  const pos = [...g.sim.entities.values()].map((e) => [e.id, e.x, e.y]);
  const corBefore = g.sim.floorRects().find((r) => r.kind === 'corridor');
  assert.ok(g.buyGlobal('size').ok);
  assert.equal(g.sim.main.w, 24);
  for (const [id, x, y] of pos) { const e = g.sim.entities.get(id); assert.deepEqual([e.x, e.y], [x, y]); }
  const corAfter = g.sim.floorRects().find((r) => r.kind === 'corridor');
  assert.equal(corAfter.w, corBefore.w - 2);
  assert.equal(g.global.size, 2);
  for (let i = 0; i < 3; i++) g.buyGlobal('size');
  assert.equal(g.sim.main.w, 36);
  assert.ok(g.sim.floorRects().filter((r) => r.kind === 'corridor').every((r) => r.w > 0 && r.h > 0), 'corridor still there at max size');
});

test('wings survive save/load; a broken layout in a save falls back safely', () => {
  const g = new Game();
  g.economy.money = 1e6;
  g.buyWing('south'); g.buyWing('north');
  g.buildMachine('oven', wingRect('south').x + 3, wingRect('south').y + 3, DIR.E);
  const s = JSON.parse(JSON.stringify(g.getSaveState()));
  const g2 = new Game();
  assert.deepEqual(g2.loadState(s), []);
  assert.deepEqual(g2.sim.layout.wings, ['south', 'north']);
  assert.equal(g2.sim.entities.size, g.sim.entities.size);
  assert.equal(g2.global.size, 1);
  assert.deepEqual(g2.sim.floorRects(), g.sim.floorRects());
  // Garbage layout: ignored (whole grid becomes floor) – the factory still loads.
  const bad = JSON.parse(JSON.stringify(s)); bad.factory.layout = { main: { x: -5 }, wings: ['moon'] };
  const { sim } = FactorySimulation.deserialize(bad.factory);
  assert.equal(sim.layout.wings.length, 0);
  assert.equal(sim.entities.size, g.sim.entities.size);
  assert.ok(floorRects(sim.layout).length === 1);
});
