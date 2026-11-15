// Cake Factory – Sweet Automation · © 2026 Brakeco Games
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/core/Game.js';
import { SaveManager } from '../src/storage/SaveManager.js';
import { migrateSave } from '../src/storage/SaveMigration.js';
import { SAVE, SIM } from '../src/core/Config.js';
import { DIR } from '../src/simulation/Grid.js';

function memStorage({ failWrites = false } = {}) {
  const m = new Map();
  return {
    m,
    getItem: async (k) => m.get(k) ?? null,
    setItem: async (k, v) => { if (failWrites) throw new Error('quota'); m.set(k, v); },
    removeItem: async (k) => { m.delete(k); },
  };
}

test('save → load round-trip restores the whole game', async () => {
  const g = new Game();
  g.buildBeltPath([6, 7, 8, 9, 10, 11].map((x) => ({ x, y: 9, dir: DIR.E })));
  g.buildMachine('oven', 2, 2, DIR.S);
  for (let i = 0; i < 9 * SIM.TICK_RATE; i++) g.fixedUpdate();
  const sm = new SaveManager(memStorage());
  assert.equal(await sm.saveGame(g.getSaveState()), true);
  assert.equal(sm.status, 'saved');

  const res = await sm.loadGame();
  assert.ok(res.ok, res.reason);
  const g2 = new Game();
  assert.deepEqual(g2.loadState(res.state), []);
  assert.equal(g2.economy.money, g.economy.money);
  assert.equal(g2.orders.index, g.orders.index);
  assert.equal(g2.orders.delivered, g.orders.delivered);
  assert.equal(JSON.stringify(g2.sim.serialize()), JSON.stringify(g.sim.serialize()));

  // Both continue identically after loading (deterministic resume).
  for (let i = 0; i < 5 * SIM.TICK_RATE; i++) { g.fixedUpdate(); g2.fixedUpdate(); }
  assert.equal(g2.economy.money, g.economy.money);
});

test('failed writes are reported as failures, never as saved', async () => {
  const sm = new SaveManager(memStorage({ failWrites: true }));
  assert.equal(await sm.saveGame(new Game().getSaveState()), false);
  assert.equal(sm.status, 'error');
});

test('corrupt save is backed up and not reported as loaded', async () => {
  const st = memStorage();
  st.m.set(SAVE.STORAGE_KEY, '{not json');
  const sm = new SaveManager(st);
  const res = await sm.loadGame();
  assert.equal(res.ok, false);
  assert.equal(res.corrupt, true);
  assert.equal(st.m.get(SAVE.BACKUP_KEY), '{not json');
});

test('missing save reports empty', async () => {
  const res = await new SaveManager(memStorage()).loadGame();
  assert.equal(res.ok, false);
  assert.equal(res.empty, true);
});

test('save from a newer game version is refused (not overwritten silently)', async () => {
  const st = memStorage();
  st.m.set(SAVE.STORAGE_KEY, JSON.stringify({ version: 999 }));
  const res = await new SaveManager(st).loadGame();
  assert.equal(res.ok, false);
  assert.ok(st.m.get(SAVE.BACKUP_KEY));
});

test('v1 saves migrate to the current format', () => {
  const v1 = { version: 1, cash: 321, grid: { w: 20, h: 20, nextId: 1, entities: [] } };
  const s = migrateSave(v1);
  assert.equal(s.version, SAVE.FORMAT_VERSION);
  assert.equal(s.economy.money, 321);
  assert.equal(s.factory.w, 20);
  const g = new Game();
  g.loadState(s);
  assert.equal(g.economy.money, 321);
});

test('concurrent saves are coalesced and the newest state wins', async () => {
  const st = memStorage();
  const sm = new SaveManager(st);
  const g = new Game();
  const p1 = sm.saveGame(g.getSaveState());
  g.economy.money = 777;
  const p2 = sm.saveGame(g.getSaveState());
  await Promise.all([p1, p2]);
  assert.equal(JSON.parse(st.m.get(SAVE.STORAGE_KEY)).economy.money, 777);
});
