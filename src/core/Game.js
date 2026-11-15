/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Game orchestrator: owns the simulation and gameplay managers and exposes
 * the ONLY actions the UI may use to change the game. Still independent of
 * Three.js; the renderer and UI subscribe to the EventBus.
 */
import { GRID, ECONOMY, GAME_VERSION, BELT, GLOBAL_UPGRADES, UPGRADES } from './Config.js';
import { EventBus } from './EventBus.js';
import { FactorySimulation } from '../simulation/FactorySimulation.js';
import { getDef } from '../machines/MachineDefs.js';
import { EconomyManager } from '../gameplay/EconomyManager.js';
import { OrderManager } from '../gameplay/OrderManager.js';
import { TutorialManager } from '../gameplay/TutorialManager.js';
import { DIR } from '../simulation/Grid.js';
import { ORDER_DEFS, unlocksAfter } from '../gameplay/OrderDefs.js';
import { CONFIG_OPTIONS, ROTATOR_MODE_LEVEL } from '../machines/MachineDefs.js';
import { FLAVORS, FROSTINGS } from '../cakes/CakeModel.js';

export const DEFAULT_SETTINGS = Object.freeze({ volume: 0.7, muted: false, quality: 'auto' });

export class Game {
  constructor() {
    this.bus = new EventBus();
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveManager = null;
    this.lastConfig = {}; // remembered per machine type for newly placed machines
    this.newGame();
  }

  // ------------------------------------------------------------ lifecycle
  newGame() {
    this.lastConfig = {};
    this.global = { belt: 1, reputation: 1, size: 1 };
    this._attach(new FactorySimulation(GRID.START_WIDTH, GRID.START_HEIGHT), new EconomyManager(ECONOMY.START_MONEY),
      new OrderManager(), new TutorialManager());
    // Starting bakery: one oven facing east and the delivery station, a few
    // cells apart, so the very first action is "connect them".
    this.sim.place('oven', 5, 9, DIR.E);
    this.sim.place('delivery', 12, 9, 0);
    this.bus.emit('reset');
  }

  _attach(sim, economy, orders, tutorial) {
    this.sim = sim;
    this.economy = economy;
    this.orders = orders;
    this.tutorial = tutorial;
    this.sim.deliveryValidator = (cake) => {
      const r = this.orders.deliver(cake, this.sim.time);
      // Reputation multiplies everything a correct cake earns.
      if (r.accepted) r.reward = Math.round(r.reward * this.globalValue('reputation'));
      return r;
    };
    if (this.global) this.sim.beltSpeed = BELT.SPEED * this.globalValue('belt');
    this.orders.on((ev) => {
      if (ev.type === 'orderCompleted') {
        ev.unlocked = this._diffUnlocks(this.orders.index - 1, this.orders.index);
        this.bus.emit('orderCompleted', ev);
        if (ev.unlocked.length) this.bus.emit('unlocked', ev.unlocked);
        this.tutorial.signal('orderCompleted');
        this.requestSave();
      } else {
        this.bus.emit('orderProgress', ev);
      }
    });
    this.tutorial.on((step) => { this.bus.emit('tutorial', step); this.requestSave(); });
  }

  get level() { return 1 + this.orders.completed.length; }

  /** Machines / flavors / frostings currently available (derived from order progress). */
  get unlocks() { return unlocksAfter(this.orders.index); }

  isUnlocked(kind, value) { return this.unlocks[kind].has(value); }

  /** Name of the order whose completion unlocks something (for locked-tool tooltips). */
  unlockSource(kind, value) {
    const o = ORDER_DEFS.find((d) => (d.unlocks?.[kind] || []).includes(value));
    return o ? o.name : null;
  }

  _diffUnlocks(fromCount, toCount) {
    const a = unlocksAfter(fromCount), b = unlocksAfter(toCount);
    const out = [];
    for (const kind of ['machines', 'flavors', 'frostings']) for (const v of b[kind]) if (!a[kind].has(v)) out.push({ kind, value: v });
    return out;
  }

  // -------------------------------------------------------------- ticking
  fixedUpdate() {
    this.sim.step();
    const events = this.sim.drainEvents();
    for (const ev of events) {
      if (ev.type === 'delivered') {
        if (ev.accepted) {
          this.economy.earn(ev.reward, this.sim.time);
          this.economy.recordDelivery(this.sim.time);
          this.tutorial.signal('firstDelivery');
        }
        this.bus.emit('delivered', ev);
      } else if (ev.type === 'itemDestroyed') {
        this.bus.emit('itemDestroyed', ev);
      } else if (ev.type === 'produced' || ev.type === 'processed' || ev.type === 'trashed') {
        this.bus.emit(ev.type, ev);
      } else if (ev.type === 'machineError') {
        console.error('Machine produced invalid data', ev);
      }
    }
    // State-based tutorial conditions.
    const step = this.tutorial.currentStep;
    if (step && step.advance === 'ovenConnected') {
      for (const e of this.sim.entities.values()) {
        if (e.type === 'oven' && this.sim.hasReceiver(e.outputs[0])) { this.tutorial.signal('ovenConnected'); break; }
      }
    }
  }

  // --------------------------------------------------------------- actions
  /** Place a machine. Returns { ok, reason?, entity? }. */
  buildMachine(type, x, y, rot) {
    const def = getDef(type);
    if (!this.isUnlocked('machines', type)) {
      const src = this.unlockSource('machines', type);
      return this._fail(src ? `Unlocks after the “${src}” order` : 'Not unlocked yet');
    }
    // Machines may be dropped straight onto existing belts: those belts are replaced.
    const can = this.sim.canPlace(type, x, y, rot, 0, { replaceBelts: true });
    if (!can.ok) return this._fail(can.reason);
    const refund = this.beltRefund(can.belts.length);
    if (!this.economy.canAfford(def.cost - refund)) return this._fail('Not enough money');
    const res = this.sim.placeReplacingBelts(type, x, y, rot);
    if (!res) return this._fail('Cannot place here');
    const e = res.entity;
    this.economy.spend(def.cost - refund);
    for (const b of res.removed) this.bus.emit('entityRemoved', b);
    for (const ev of this.sim.drainEvents()) this.bus.emit(ev.type, ev);
    // New machines inherit the last settings chosen for that type (if still unlocked).
    const last = this.lastConfig[type];
    if (last) for (const [k, v] of Object.entries(last)) if (this._configAllowed(type, k, v, e.level)) e.setConfig(k, v);
    if (type === 'froster') this.tutorial.signal('frosterPlaced');
    this.bus.emit('entityAdded', e);
    this.bus.emit('money');
    this.requestSave();
    return { ok: true, entity: e, replaced: res.removed.length, rescued: res.rescued, lost: res.lost };
  }

  /** Money returned for belts that a machine replaces. */
  beltRefund(count) { return Math.floor(count * getDef('belt').cost * ECONOMY.REFUND_RATE); }

  /**
   * Build/redirect belts along a path of { x, y, dir }. Existing belts are
   * re-pointed for free; machine cells are skipped. If money runs out the
   * affordable prefix is built and the result says so.
   */
  buildBeltPath(path) {
    const cost = getDef('belt').cost;
    let placed = 0, redirected = 0, skipped = 0, short = false;
    for (const c of path) {
      const existing = this.sim.entityAt(c.x, c.y);
      if (existing === null && this.sim.grid.inBounds(c.x, c.y)) {
        if (!this.economy.canAfford(cost)) { short = true; break; }
        const b = this.sim.place('belt', c.x, c.y, c.dir);
        if (b) { this.economy.spend(cost); placed++; this.bus.emit('entityAdded', b); }
      } else if (existing && existing.kind === 'belt') {
        if (existing.dir !== c.dir) { this.sim.setBeltDir(existing.id, c.dir); redirected++; this.bus.emit('entityChanged', existing); }
      } else {
        skipped++;
      }
    }
    if (placed || redirected) { this.bus.emit('money'); this.requestSave(); }
    if (short) this._fail(placed ? 'Ran out of money – line partly built' : 'Not enough money');
    return { ok: placed + redirected > 0, placed, redirected, skipped, short };
  }

  removeEntity(id) {
    const e = this.sim.entities.get(id);
    if (!e) return { ok: false };
    const res = this.sim.remove(id);
    this.economy.refund(Math.floor((e.kind === 'machine' ? e.invested : e.def.cost) * ECONOMY.REFUND_RATE));
    // Flush itemDestroyed events right away so feedback is instant.
    for (const ev of this.sim.drainEvents()) this.bus.emit(ev.type, ev);
    this.bus.emit('entityRemoved', e);
    this.bus.emit('money');
    this.requestSave();
    return { ok: true, lost: res.lost.length };
  }

  /** Is `value` an allowed setting for `key` on this machine type (at this level)? */
  _configAllowed(type, key, value, level = 1) {
    const opt = (CONFIG_OPTIONS[type] || []).find((o) => o.key === key);
    if (!opt) return false;
    if (opt.kind === 'flavor') return !!FLAVORS[value] && this.isUnlocked('flavors', value);
    if (opt.kind === 'frosting') return !!FROSTINGS[value] && this.isUnlocked('frostings', value);
    if (opt.kind === 'mode') return (ROTATOR_MODE_LEVEL[value] ?? 99) <= level;
    if (opt.kind === 'mask') {
      if (!Array.isArray(value) || value.length !== 4 || !value.some(Boolean)) return false;
      return level >= (opt.minLevel || 1) || value.every(Boolean);
    }
    return false;
  }

  /** Change a machine setting (oven flavor, frosting color). Only unlocked values are allowed. */
  configureMachine(id, key, value) {
    const e = this.sim.entities.get(id);
    if (!e || e.kind !== 'machine') return { ok: false };
    if (!this._configAllowed(e.type, key, value, e.level)) {
      const opt = (CONFIG_OPTIONS[e.type] || []).find((o) => o.key === key);
      if (opt?.kind === 'mode') return this._fail(`Upgrade the ${e.def.name} to level ${ROTATOR_MODE_LEVEL[value]} first`);
      if (opt?.kind === 'mask') return this._fail(Array.isArray(value) && !value.some(Boolean) ? 'Keep at least one quadrant on' : `Upgrade the ${e.def.name} to level ${opt.minLevel} first`);
      return this._fail('Not unlocked yet');
    }
    if (!e.setConfig(key, value)) return this._fail('Invalid setting');
    this.lastConfig[e.type] = { ...e.config };
    this.bus.emit('entityChanged', e);
    this.requestSave();
    return { ok: true };
  }

  // ------------------------------------------------------------ upgrades (Phase 3)
  /** Raise a machine one level. Returns { ok, level, cost }. */
  upgradeMachine(id) {
    const e = this.sim.entities.get(id);
    if (!e || e.kind !== 'machine') return this._fail('Only machines can be upgraded');
    if (!e.canUpgrade) return this._fail(e.maxLevel === 1 ? `The ${e.def.name} has no upgrades` : `${e.def.name} is already at max level`);
    const cost = e.upgradeCost;
    if (!this.economy.spend(cost)) return this._fail('Not enough money');
    e.level++;
    this.bus.emit('machineUpgraded', e);
    this.bus.emit('entityChanged', e);
    this.bus.emit('money');
    this.requestSave();
    return { ok: true, level: e.level, cost };
  }

  globalValue(kind) { return GLOBAL_UPGRADES[kind].values[(this.global?.[kind] ?? 1) - 1]; }
  globalNextCost(kind) {
    const lv = this.global[kind];
    return lv < GLOBAL_UPGRADES[kind].values.length ? GLOBAL_UPGRADES[kind].costs[lv - 1] : 0;
  }

  /** Buy the next level of a factory-wide upgrade ('belt' | 'reputation' | 'size'). */
  buyGlobal(kind) {
    const def = GLOBAL_UPGRADES[kind];
    if (!def) return { ok: false };
    const lv = this.global[kind];
    if (lv >= def.values.length) return this._fail(`${def.name} is maxed`);
    const cost = def.costs[lv - 1];
    if (!this.economy.spend(cost)) return this._fail('Not enough money');
    this.global[kind] = lv + 1;
    if (kind === 'belt') this.sim.beltSpeed = BELT.SPEED * this.globalValue('belt');
    if (kind === 'size') {
      const d = (def.values[lv] - def.values[lv - 1]) / 2;
      this.sim.expand(d);
      this.bus.emit('factoryResized', { size: def.values[lv] });
      this.bus.emit('reset');
    }
    this.bus.emit('globalUpgraded', { kind, level: lv + 1 });
    this.bus.emit('money');
    this.requestSave();
    return { ok: true, level: lv + 1, cost };
  }

  rotateEntity(id) {
    const e = this.sim.entities.get(id);
    if (!e) return { ok: false };
    if (!this.sim.rotate(id)) return this._fail('No room to rotate');
    this.bus.emit('entityChanged', e);
    this.requestSave();
    return { ok: true };
  }

  moveEntity(id, x, y, rot) {
    const e = this.sim.entities.get(id);
    if (!e) return { ok: false };
    const opts = e.kind === 'machine' ? { replaceBelts: true } : {};
    if (!this.sim.move(id, x, y, rot, opts)) return this._fail('Cannot move there');
    const covered = this.sim.lastMoveReplaced || [];
    this.sim.lastMoveReplaced = null;
    if (covered.length) {
      this.economy.refund(this.beltRefund(covered.length));
      for (const b of covered) this.bus.emit('entityRemoved', b);
      this.bus.emit('money');
    }
    for (const ev of this.sim.drainEvents()) this.bus.emit(ev.type, ev);
    this.bus.emit('entityChanged', e);
    this.requestSave();
    return { ok: true };
  }

  _fail(reason) {
    this.bus.emit('actionFailed', reason);
    return { ok: false, reason };
  }

  // ------------------------------------------------------------ save/load
  getSaveState() {
    return {
      gameVersion: GAME_VERSION,
      economy: this.economy.serialize(),
      orders: this.orders.serialize(),
      tutorial: this.tutorial.serialize(),
      settings: { ...this.settings },
      lastConfig: JSON.parse(JSON.stringify(this.lastConfig)),
      global: { ...this.global },
      simTime: this.sim.time,
      factory: this.sim.serialize(),
    };
  }

  /** Apply a migrated + validated save. Returns a list of non-fatal problems. */
  loadState(s) {
    const { sim, problems } = FactorySimulation.deserialize(s.factory);
    sim.time = Number.isFinite(s.simTime) ? s.simTime : 0;
    const economy = new EconomyManager();
    economy.load(s.economy);
    const orders = new OrderManager();
    orders.load(s.orders, sim.time);
    const tutorial = new TutorialManager();
    tutorial.load(s.tutorial);
    this._attach(sim, economy, orders, tutorial);
    if (s.settings) this.settings = { ...DEFAULT_SETTINGS, ...s.settings };
    this.lastConfig = s.lastConfig && typeof s.lastConfig === 'object' ? s.lastConfig : {};
    const lvl = (v, k) => Math.max(1, Math.min(GLOBAL_UPGRADES[k].values.length, v | 0 || 1));
    const g = s.global || {};
    this.global = { belt: lvl(g.belt, 'belt'), reputation: lvl(g.reputation, 'reputation'), size: lvl(g.size, 'size') };
    // The saved grid size is authoritative; keep the size level consistent with it.
    const idx = GLOBAL_UPGRADES.size.values.indexOf(this.sim.width);
    if (idx >= 0) this.global.size = idx + 1;
    this.sim.beltSpeed = BELT.SPEED * this.globalValue('belt');
    this.bus.emit('reset');
    return problems;
  }

  requestSave() {
    if (this.saveManager) this.saveManager.requestSave(() => this.getSaveState());
  }

  async saveNow() {
    if (!this.saveManager) return false;
    return this.saveManager.saveGame(this.getSaveState());
  }
}
