/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Versioned save migrations. Each migration upgrades exactly one version.
 * v1 was the internal pre-release format (money at the top level as `cash`,
 * factory under `grid`); it is kept here so the migration path is exercised
 * by tests and future formats follow the same pattern.
 */
import { SAVE } from '../core/Config.js';

const MIGRATIONS = {
  1: (s) => {
    const out = { ...s, version: 2 };
    out.economy = { money: s.cash ?? 0, totalEarned: 0, totalSpent: 0 };
    delete out.cash;
    out.factory = s.grid;
    delete out.grid;
    return out;
  },
  // v2 (Phase 1) → v3 (Phase 2): the order list gained new recipes in between.
  // Map the old position to the matching new order (by meaning, not index).
  2: (s) => {
    const out = { ...s, version: 3 };
    const o = { ...(s.orders || {}) };
    const idx = o.index | 0;
    if (idx <= 0) { o.id = 'o1_vanilla_delight'; }
    else if (idx === 1) { o.id = 'o2_morning_rush'; }
    else { o.id = 'o4_half_moon'; o.delivered = 0; } // finished Morning Rush (or more) → next new recipe
    delete o.index;
    out.orders = o;
    return out;
  },
  // v3 (Phase 2) → v4 (Phase 3): factory-wide upgrades start at level 1;
  // machine levels were already stored per machine.
  3: (s) => ({ ...s, version: 4, global: s.global || { belt: 1, reputation: 1, size: 1 } }),
};

export function migrateSave(data) {
  if (!data || typeof data !== 'object') throw new Error('Save is not an object');
  let s = data;
  let v = s.version | 0;
  if (v < 1) throw new Error('Save has no version');
  if (v > SAVE.FORMAT_VERSION) throw new Error(`Save version ${v} is newer than this game (${SAVE.FORMAT_VERSION})`);
  while (v < SAVE.FORMAT_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`No migration from version ${v}`);
    s = m(s);
    v = s.version;
  }
  return s;
}

/** Structural validation of a (migrated) save. Returns a list of problems. */
export function validateSave(s) {
  const p = [];
  if (s.version !== SAVE.FORMAT_VERSION) p.push('wrong version');
  if (!s.economy || !Number.isFinite(s.economy.money)) p.push('economy missing');
  const f = s.factory;
  if (!f || !Number.isInteger(f.w) || !Number.isInteger(f.h) || f.w < 4 || f.h < 4 || f.w > 200 || f.h > 200) p.push('factory size invalid');
  if (!f || !Array.isArray(f.entities)) p.push('entity list missing');
  return p;
}
