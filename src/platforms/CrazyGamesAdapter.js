/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * CrazyGames platform adapter (SDK v3). Same interface as StandaloneAdapter:
 *   init(), storage {getItem,setItem,removeItem}, persistent,
 *   loadingStart/loadingStop/gameplayStart/gameplayStop(), happytime()
 *
 * - The SDK script is only loaded by this adapter (never in standalone builds).
 * - Storage uses the SDK data module (cloud sync for signed-in players). Reads
 *   fall back to localStorage so saves made before the SDK was used are kept;
 *   nothing is ever deleted from localStorage.
 * - If the SDK cannot load or reports "disabled", init() throws and main.js
 *   continues with the standalone adapter.
 */

export const CRAZYGAMES_SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

function loadScript(src, timeoutMs) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    const timer = setTimeout(() => reject(new Error('CrazyGames SDK load timed out')), timeoutMs);
    s.src = src;
    s.async = true;
    s.onload = () => { clearTimeout(timer); resolve(); };
    s.onerror = () => { clearTimeout(timer); reject(new Error('CrazyGames SDK failed to load')); };
    document.head.appendChild(s);
  });
}

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

export class CrazyGamesAdapter {
  constructor({ timeoutMs = 6000 } = {}) {
    this.name = 'crazygames';
    this.persistent = false;
    this.sdk = null;
    this._timeoutMs = timeoutMs;
    this._ls = null;
    this._mem = new Map();
    this._playing = false;
    const data = () => this.sdk?.data || null;
    this.storage = {
      getItem: async (k) => {
        const d = data();
        const v = d ? d.getItem(k) : null;
        if (v != null) return v;
        // Saves written before the SDK data module was used live in localStorage.
        return this._ls ? this._ls.getItem(k) : (this._mem.get(k) ?? null);
      },
      setItem: async (k, v) => {
        const d = data();
        if (d) d.setItem(k, v);
        else if (this._ls) this._ls.setItem(k, v);
        else this._mem.set(k, v);
      },
      removeItem: async (k) => {
        const d = data();
        if (d) d.removeItem(k);
        if (this._ls) this._ls.removeItem(k);
        this._mem.delete(k);
      },
    };
  }

  async init() {
    if (!window.CrazyGames?.SDK) await loadScript(CRAZYGAMES_SDK_URL, this._timeoutMs);
    const sdk = window.CrazyGames?.SDK;
    if (!sdk) throw new Error('CrazyGames SDK missing');
    await sdk.init();
    if (sdk.environment === 'disabled') throw new Error('CrazyGames SDK disabled on this domain');
    this.sdk = sdk;
    this._ls = probeLocalStorage();
    this.persistent = !!(sdk.data || this._ls);
    return true;
  }

  _call(fn) {
    try { fn(this.sdk?.game); } catch (e) { console.warn('CrazyGames SDK call failed', e); }
  }

  loadingStart() { this._call((g) => g?.loadingStart?.()); }
  loadingStop() { this._call((g) => g?.loadingStop?.()); }
  gameplayStart() {
    if (this._playing) return;
    this._playing = true;
    this._call((g) => g?.gameplayStart?.());
  }
  gameplayStop() {
    if (!this._playing) return;
    this._playing = false;
    this._call((g) => g?.gameplayStop?.());
  }
  /** CrazyGames can ask games to stay silent (e.g. while its own UI plays audio). */
  get muteAudio() { return !!this.sdk?.game?.settings?.muteAudio; }
  onSettingsChange(fn) { this._call((g) => g?.addSettingsChangeListener?.(fn)); }

  /** A moment of celebration (order completed). */
  happytime() { this._call((g) => g?.happytime?.()); }
}

/** Use the CrazyGames adapter for CrazyGames builds, on CrazyGames domains or with ?platform=crazygames. */
export function wantsCrazyGames(env = {}, loc = typeof location !== 'undefined' ? location : null) {
  if (env.VITE_PLATFORM === 'crazygames') return true;
  if (!loc) return false;
  if (/(^|\.)crazygames\.[a-z.]+$/i.test(loc.hostname)) return true;
  return /[?&]platform=crazygames\b/.test(loc.search || '');
}
