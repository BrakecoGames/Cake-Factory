/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Platform-independent save manager. Storage itself is delegated to a
 * platform adapter exposing async getItem/setItem/removeItem
 * (StandaloneAdapter now; CrazyGames/Poki adapters in Phase 6).
 *
 * Guarantees
 *  - Never reports success before the adapter's write resolved.
 *  - Writes are debounced and never overlap.
 *  - A save that fails to load is copied to a backup key BEFORE anything
 *    can overwrite it, so a failed load never destroys progress.
 */
import { SAVE } from '../core/Config.js';
import { migrateSave, validateSave } from './SaveMigration.js';

export class SaveManager {
  /** @param {{getItem(k:string):Promise<string|null>, setItem(k:string,v:string):Promise<void>, removeItem(k:string):Promise<void>}} storage */
  constructor(storage, key = SAVE.STORAGE_KEY) {
    this.storage = storage;
    this.key = key;
    this.status = 'idle'; // idle | pending | saving | saved | error
    this.lastSavedAt = 0;
    this.lastError = null;
    this._timer = null;
    this._writing = null;
    this._queued = null;
    this.onStatus = () => {};
  }

  _setStatus(s) { this.status = s; this.onStatus(s); }

  async hasSave() {
    try { return (await this.storage.getItem(this.key)) != null; } catch { return false; }
  }

  /**
   * Returns { ok: true, state } | { ok: false, reason, empty?: true }.
   */
  async loadGame() {
    let raw;
    try {
      raw = await this.storage.getItem(this.key);
    } catch (e) {
      return { ok: false, reason: `Storage unavailable: ${e.message || e}` };
    }
    if (raw == null) return { ok: false, empty: true, reason: 'No save' };
    try {
      const parsed = JSON.parse(raw);
      const state = migrateSave(parsed);
      const problems = validateSave(state);
      if (problems.length) throw new Error(problems.join(', '));
      return { ok: true, state };
    } catch (e) {
      // Preserve the unreadable save before the game can write a fresh one.
      try { await this.storage.setItem(SAVE.BACKUP_KEY, raw); } catch { /* ignore */ }
      return { ok: false, corrupt: true, reason: `Save could not be read (${e.message || e}). A backup was kept.` };
    }
  }

  /** Immediate save. Resolves true only when the write actually completed. */
  async saveGame(state) {
    clearTimeout(this._timer); this._timer = null;
    if (this._writing) {
      // Coalesce: remember the newest state and write it after the current one.
      this._queued = state;
      return this._writing.then(() => this._flushQueued());
    }
    return this._write(state);
  }

  async _flushQueued() {
    if (!this._queued) return this.status === 'saved';
    const s = this._queued; this._queued = null;
    return this._write(s);
  }

  async _write(state) {
    let json;
    try {
      json = JSON.stringify({ ...state, version: SAVE.FORMAT_VERSION, savedAt: Date.now() });
    } catch (e) {
      this.lastError = e; this._setStatus('error'); return false;
    }
    this._setStatus('saving');
    this._writing = (async () => {
      try {
        await this.storage.setItem(this.key, json);
        this.lastSavedAt = Date.now();
        this.lastError = null;
        this._setStatus('saved');
        return true;
      } catch (e) {
        this.lastError = e;
        this._setStatus('error');
        return false;
      }
    })();
    const ok = await this._writing;
    this._writing = null;
    if (this._queued) return this._flushQueued();
    return ok;
  }

  /** Debounced save – call freely after every player action. */
  requestSave(getState, delay = SAVE.DEBOUNCE_MS) {
    if (this.status !== 'saving') this._setStatus('pending');
    clearTimeout(this._timer);
    this._timer = setTimeout(() => { this._timer = null; this.saveGame(getState()); }, delay);
  }

  async deleteSave() {
    clearTimeout(this._timer); this._timer = null;
    try { await this.storage.removeItem(this.key); return true; } catch { return false; }
  }
}
