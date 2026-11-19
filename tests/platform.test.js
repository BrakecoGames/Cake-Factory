// Cake Factory – Sweet Automation · © 2026 Brakeco Games
// CrazyGames adapter: SDK lifecycle calls, storage fallback, platform detection.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CrazyGamesAdapter, wantsCrazyGames } from '../src/platforms/CrazyGamesAdapter.js';

function memStore() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}

function fakeSdk({ environment = 'crazygames', data = true } = {}) {
  const calls = [];
  const game = {
    settings: { muteAudio: false },
    loadingStart: () => calls.push('loadingStart'), loadingStop: () => calls.push('loadingStop'),
    gameplayStart: () => calls.push('gameplayStart'), gameplayStop: () => calls.push('gameplayStop'),
    happytime: () => calls.push('happytime'), addSettingsChangeListener: () => {},
  };
  return { calls, sdk: { environment, init: async () => calls.push('init'), game, data: data ? memStore() : undefined } };
}

function withWindow(sdk, ls, fn) {
  const prev = globalThis.window;
  globalThis.window = { CrazyGames: { SDK: sdk }, localStorage: ls };
  return Promise.resolve(fn()).finally(() => { globalThis.window = prev; });
}

test('CrazyGames adapter: init + lifecycle calls are forwarded once', async () => {
  const { sdk, calls } = fakeSdk();
  await withWindow(sdk, memStore(), async () => {
    const a = new CrazyGamesAdapter();
    await a.init();
    a.loadingStart(); a.loadingStop();
    a.gameplayStart(); a.gameplayStart(); // duplicate start is ignored
    a.gameplayStop(); a.gameplayStop();
    a.happytime();
    assert.deepEqual(calls, ['init', 'loadingStart', 'loadingStop', 'gameplayStart', 'gameplayStop', 'happytime']);
    assert.equal(a.persistent, true);
  });
});

test('CrazyGames adapter: old localStorage save is read when SDK data is empty, and never deleted by a write', async () => {
  const { sdk } = fakeSdk();
  const ls = memStore();
  ls.setItem('save', '{"old":true}');
  await withWindow(sdk, ls, async () => {
    const a = new CrazyGamesAdapter();
    await a.init();
    assert.equal(await a.storage.getItem('save'), '{"old":true}');
    await a.storage.setItem('save', '{"new":true}');
    assert.equal(await a.storage.getItem('save'), '{"new":true}');
    assert.equal(sdk.data.getItem('save'), '{"new":true}');
    assert.equal(ls.getItem('save'), '{"old":true}', 'localStorage copy is kept as a fallback');
  });
});

test('CrazyGames adapter: disabled environment throws so the game falls back to standalone', async () => {
  const { sdk } = fakeSdk({ environment: 'disabled' });
  await withWindow(sdk, memStore(), async () => {
    await assert.rejects(() => new CrazyGamesAdapter().init(), /disabled/);
  });
});

test('CrazyGames adapter: without the data module it stores in localStorage', async () => {
  const { sdk } = fakeSdk({ data: false });
  const ls = memStore();
  await withWindow(sdk, ls, async () => {
    const a = new CrazyGamesAdapter();
    await a.init();
    await a.storage.setItem('k', 'v');
    assert.equal(ls.getItem('k'), 'v');
    assert.equal(a.persistent, true);
  });
});

test('wantsCrazyGames: build flag, domain or query parameter', () => {
  assert.equal(wantsCrazyGames({ VITE_PLATFORM: 'crazygames' }, null), true);
  assert.equal(wantsCrazyGames({}, { hostname: 'games.crazygames.com', search: '' }), true);
  assert.equal(wantsCrazyGames({}, { hostname: 'localhost', search: '?platform=crazygames' }), true);
  assert.equal(wantsCrazyGames({}, { hostname: 'brakecogames.github.io', search: '' }), false);
  assert.equal(wantsCrazyGames({}, { hostname: 'notcrazygames.com.evil.io', search: '' }), false);
});
