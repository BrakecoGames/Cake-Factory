/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Base class for grid machines (everything except belts).
 */
import { getDef } from './MachineDefs.js';
import { rotateLocal, rotatedSize, rotateDir, DX, DY } from '../simulation/Grid.js';
import { FLAVORS, FROSTINGS } from '../cakes/CakeModel.js';
import { UPGRADES } from '../core/Config.js';

const CONFIG_VALIDATORS = {
  flavor: (v) => !!FLAVORS[v],
  color: (v) => !!FROSTINGS[v],
  mode: (v) => v === 'cw' || v === 'ccw' || v === '180',
  mask: (v) => Array.isArray(v) && v.length === 4 && v.every((b) => typeof b === 'boolean') && v.some(Boolean),
};

export const STATUS = Object.freeze({
  IDLE: 'idle',
  WORKING: 'working',
  BLOCKED: 'blocked',
  NO_OUTPUT: 'no-output',
  INCOMPATIBLE: 'incompatible',
});

export class Machine {
  constructor(id, type, x, y, rot = 0) {
    this.id = id;
    this.kind = 'machine';
    this.type = type;
    this.def = getDef(type);
    this.x = x;
    this.y = y;
    this.rot = rot & 3;
    this.status = STATUS.IDLE;
    this.level = 1;
    /** Seconds the machine has been blocked in a row (for UI). */
    this.blockedTime = 0;
    /** Player-selectable settings (flavor, frosting color, …). */
    this.config = { ...(this.def.defaultConfig || {}) };
    this.computePorts();
  }

  // ---- levels (Phase 3) -------------------------------------------------
  get maxLevel() { return this.def.cost > 0 && this.def.upgradable !== false ? UPGRADES.MAX_LEVEL : 1; }
  get speedMult() { return UPGRADES.SPEED[Math.min(this.level, UPGRADES.MAX_LEVEL) - 1]; }
  get canUpgrade() { return this.level < this.maxLevel; }
  /** Price of the next level, or 0 when maxed. */
  get upgradeCost() { return this.canUpgrade ? Math.round(this.def.cost * UPGRADES.COST_FACTOR[this.level - 1]) : 0; }
  /** Total money put into this machine (purchase + upgrades) – used for refunds. */
  get invested() {
    let sum = this.def.cost;
    for (let l = 1; l < this.level; l++) sum += Math.round(this.def.cost * UPGRADES.COST_FACTOR[l - 1]);
    return sum;
  }

  /** Sets one config value if the key exists for this machine and the value is valid. */
  setConfig(key, value) {
    if (!(key in this.config)) return false;
    const ok = CONFIG_VALIDATORS[key];
    if (ok && !ok(value)) return false;
    this.config[key] = Array.isArray(value) ? value.slice() : value;
    return true;
  }

  loadConfig(c) {
    if (!c || typeof c !== 'object') return;
    for (const [k, v] of Object.entries(c)) this.setConfig(k, v);
  }

  get size() { return rotatedSize(this.def.w, this.def.h, this.rot); }

  /** All occupied cells for a hypothetical placement. */
  static footprint(def, x, y, rot) {
    const [w, h] = rotatedSize(def.w, def.h, rot);
    const cells = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) cells.push([x + i, y + j]);
    return cells;
  }

  /** World-space ports for a hypothetical placement (used for previews too). */
  static worldPorts(def, x, y, rot) {
    const map = (p) => {
      const [lx, ly] = rotateLocal(p.x, p.y, def.w, def.h, rot);
      const dir = rotateDir(p.dir, rot);
      const cx = x + lx, cy = y + ly;
      return { x: cx, y: cy, dir, slot: p.slot ?? 0, nx: cx + DX[dir], ny: cy + DY[dir] };
    };
    return { inputs: def.inputs.map(map), outputs: def.outputs.map(map) };
  }

  computePorts() {
    const p = Machine.worldPorts(this.def, this.x, this.y, this.rot);
    this.inputs = p.inputs;
    this.outputs = p.outputs;
  }

  cells() { return Machine.footprint(this.def, this.x, this.y, this.rot); }

  /** Index of the input port at cell (x,y) opening toward side `dir`, or -1. */
  inputPortAt(x, y, dir) {
    for (let i = 0; i < this.inputs.length; i++) {
      const p = this.inputs[i];
      if (p.x === x && p.y === y && p.dir === dir) return i;
    }
    return -1;
  }

  // ---- overridable behaviour -------------------------------------------
  /** Can this machine take `cake` through input port `portIndex` right now? */
  canAccept(_cake, _portIndex) { return false; }
  /** Take ownership of the cake. Only called after canAccept returned true. */
  accept(_cake, _portIndex, _sim) {}
  /** Advance internal processing by dt seconds. */
  update(_dt, _sim) {}
  /** Cakes currently owned by this machine (for removal / saving). */
  heldCakes() { return []; }
  serializeState() { return {}; }
  loadState(_s) {}
}
