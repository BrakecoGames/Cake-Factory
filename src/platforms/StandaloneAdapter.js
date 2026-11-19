/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Standalone / local-development platform adapter.
 * Storage: localStorage when available, otherwise an in-memory map (the HUD
 * then shows "Not saved" because nothing survives a refresh).
 *
 * CrazyGamesAdapter and PokiAdapter (Phase 6) implement the same interface:
 *   init(), storage {getItem,setItem,removeItem}, persistent (bool),
 *   loadingStart/loadingStop/gameplayStart/gameplayStop()
 */

function probeLocalStorage() {
  try {
    const k = '__cf_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return null;
  }
}

export class StandaloneAdapter {
  constructor() {
    this.name = 'standalone';
    this.persistent = false;
    this._mem = new Map();
    this._ls = null;
    this.storage = {
      getItem: async (k) => (this._ls ? this._ls.getItem(k) : (this._mem.get(k) ?? null)),
      setItem: async (k, v) => { if (this._ls) this._ls.setItem(k, v); else this._mem.set(k, v); },
      removeItem: async (k) => { if (this._ls) this._ls.removeItem(k); else this._mem.delete(k); },
    };
  }

  async init() {
    this._ls = typeof window !== 'undefined' ? probeLocalStorage() : null;
    this.persistent = !!this._ls;
    return true;
  }

  loadingStart() {}
  loadingStop() {}
  gameplayStart() {}
  gameplayStop() {}
  happytime() {}
  get muteAudio() { return false; }
  onSettingsChange() {}
}
