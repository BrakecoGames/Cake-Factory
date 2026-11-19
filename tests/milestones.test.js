// Cake Factory – Sweet Automation · © 2026 Brakeco Games
// Milestones: reached from real game state, paid once, kept in saves, old saves estimated.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/Game.js';
import { MILESTONES, MilestoneManager } from '../src/gameplay/MilestoneManager.js';
import { SIM } from '../src/core/Config.js';
import { DIR } from '../src/simulation/Grid.js';

const tick = (g, s) => { for (let i = 0; i < s * SIM.TICK_RATE; i++) g.fixedUpdate(); };

test('milestone ids are unique and goals positive', () => {
  const ids = new Set(MILESTONES.map((m) => m.id));
  assert.equal(ids.size, MILESTONES.length);
  for (const m of MILESTONES) assert.ok(m.goal > 0 && m.reward > 0, m.id);
});

test('first batch milestone is reached by playing and paid exactly once', () => {
  const g = new Game();
  const events = [];
  g.bus.on('milestone', (e) => events.push(e));
  g.buildBeltPath([6, 7, 8, 9, 10, 11].map((x) => ({ x, y: 9, dir: DIR.E })));
  tick(g, 25); // the 5-cake first order completes; the next order wants frosting
  assert.equal(g.stats.cakes, 5, 'only correct cakes count');
  assert.equal(g.milestones.reached.has('cakes_10'), false);
  g.stats.cakes = 10;
  const earnedBefore = g.economy.totalEarned, moneyBefore = g.economy.money;
  tick(g, 1);
  assert.ok(g.milestones.reached.has('cakes_10'));
  assert.equal(g.economy.money - moneyBefore, MILESTONES.find((m) => m.id === 'cakes_10').reward);
  assert.equal(g.economy.totalEarned, earnedBefore, 'milestone money is not production income');
  tick(g, 3);
  const paid = events.flatMap((e) => e.reached.map((m) => m.id));
  assert.equal(paid.filter((id) => id === 'cakes_10').length, 1);
});

test('milestones and stats survive save/load; old saves get an estimate', () => {
  const g = new Game();
  g.stats.cakes = 60;
  g.milestones.check(g.milestoneStats());
  const s = JSON.parse(JSON.stringify(g.getSaveState()));
  const g2 = new Game();
  g2.loadState(s);
  assert.equal(g2.stats.cakes, 60);
  assert.deepEqual([...g2.milestones.reached].sort(), [...g.milestones.reached].sort());

  // A save from before milestones existed: 2 completed orders (5 + 8 cakes) + 3 in progress.
  delete s.milestones; delete s.stats;
  s.orders = { id: 'o4_half_moon', delivered: 3, startedAt: 0, completed: [{ id: 'o1_vanilla_delight', bonus: false }, { id: 'o2_strawberry_frosting', bonus: false }] };
  const g3 = new Game();
  g3.loadState(s);
  assert.equal(g3.stats.cakes, 16);
  assert.equal(g3.milestones.count, 0, 'reached on the next check, so the player sees them');
});

test('MilestoneManager ignores unknown ids from saves and sorts next goals by progress', () => {
  const m = new MilestoneManager();
  m.load(['cakes_10', 'bogus']);
  assert.deepEqual([...m.reached], ['cakes_10']);
  const next = m.next({ cakes: 45, orders: 0, machines: 0, levelUps: 0, bonuses: 0, earned: 0, expansions: 0 }, 1);
  assert.equal(next[0].def.id, 'cakes_50');
});

test('machine tips: shown once for a newly needed machine, never after Skip tutorial', () => {
  const g = new Game();
  const ids = ['cutter', 'combiner', 'rotator'];
  assert.equal(g.pendingMachineTip(ids), null, 'not during the tutorial');
  while (g.tutorial.active) g.tutorial.next();
  g.orders.index = 2; // Half Moon needs the cutter
  assert.equal(g.pendingMachineTip(ids), 'cutter');
  g.markTipSeen('cutter');
  assert.equal(g.pendingMachineTip(ids), null);
  const s = JSON.parse(JSON.stringify(g.getSaveState()));
  const g2 = new Game(); g2.loadState(s);
  assert.equal(g2.pendingMachineTip(ids), null, 'seen tips are saved');
  const g3 = new Game(); g3.tutorial.skip(); g3.orders.index = 2;
  assert.equal(g3.pendingMachineTip(ids), null, 'skipping the tutorial skips tips');
});
