/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Tracks the active order, validates delivered cakes and pays rewards.
 * Time is simulation time (seconds), so pausing pauses bonus timers too.
 */
import { getOrderDef, orderIndexById, RETIRED_ORDERS, ORDER_DEFS, LEGACY_CONTRACT_RECIPES } from './OrderDefs.js';
import { isValidCakeData } from '../cakes/CakeModel.js';
import { cakeKey, parseCakeKey } from '../cakes/CakeSerializer.js';
import { diagnoseMismatch } from './Diagnose.js';

export class OrderManager {
  constructor() {
    this.index = 0;
    this.delivered = 0;
    this.startedAt = 0;
    this.completed = []; // { id, name, bonus: bool, time }
    this.recipe = null;     // cake key the current contract was switched to (null = its new cake)
    this.lastRecipe = null; // cake key of the last finished contract
    this.legacy = false;    // current contract keeps its pre-endless cake (old save)
    this.listeners = new Set();
  }

  get current() { return getOrderDef(this.index, this.recipe, this.legacy); }

  get isContract() { return this.index >= ORDER_DEFS.length; }

  /**
   * The other offer for the current contract, or null: "repeat the previous
   * contract's cake at lower pay" (or back to the new cake). Only before the
   * first cake, so no progress is lost, and never for a Showpiece.
   */
  get alternative() {
    if (!this.isContract || this.delivered > 0 || !this.lastRecipe) return null;
    if (this.recipe) return getOrderDef(this.index, null);
    if (this.legacy) return null;
    const cur = this.current;
    if (cur.boss || cur.cake === this.lastRecipe) return null;
    return getOrderDef(this.index, this.lastRecipe);
  }

  /** Switch the current contract to the alternative offer. */
  switchContract() {
    const alt = this.alternative;
    if (!alt) return false;
    this.recipe = alt.repeat ? alt.cake : null;
    this.legacy = false;
    this._emit({ type: 'orderProgress', order: this.current, delivered: 0 });
    return true;
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit(ev) { for (const fn of this.listeners) fn(ev); }

  /** Time left for the bonus (seconds) or null when the order has no bonus. */
  bonusRemaining(now) {
    const b = this.current.bonus;
    if (!b) return null;
    return Math.max(0, b.seconds - (now - this.startedAt));
  }

  /**
   * Validate a delivered cake. Returns { accepted, reward, reason }.
   * Rewards are paid by the caller via the returned value + events.
   */
  deliver(cake, now) {
    const order = this.current;
    if (cakeKey(cake) !== order.cake) {
      return { accepted: false, reward: 0, reason: diagnoseMismatch(cake, parseCakeKey(order.cake)) };
    }
    // The bonus clock starts with the first correct cake, so building time is free.
    if (this.delivered === 0) this.startedAt = now;
    this.delivered++;
    let reward = order.perCake;
    if (this.delivered >= order.quantity) {
      const elapsed = now - this.startedAt;
      const bonus = !!order.bonus && elapsed <= order.bonus.seconds;
      const completionReward = order.reward + (bonus ? order.bonus.reward : 0);
      reward += completionReward;
      this.completed.push({ id: order.id, name: order.name, bonus, time: Math.round(elapsed * 10) / 10 });
      const finished = order;
      if (this.isContract) this.lastRecipe = finished.cake;
      this.recipe = null;
      this.legacy = false;
      this.index++;
      this.delivered = 0;
      this.startedAt = now;
      this._emit({ type: 'orderCompleted', order: finished, bonus, completionReward, next: this.current });
    } else {
      this._emit({ type: 'orderProgress', order, delivered: this.delivered });
    }
    return { accepted: true, reward };
  }

  serialize() {
    return { id: this.current.id, index: this.index, delivered: this.delivered, startedAt: this.startedAt, completed: this.completed.slice(), recipe: this.recipe, lastRecipe: this.lastRecipe, legacy: this.legacy, v: 2 };
  }

  load(s, now = 0) {
    if (!s) return;
    const byId = typeof s.id === 'string' ? orderIndexById(s.id) : -1;
    this.index = byId >= 0 ? byId : Math.max(0, s.index | 0);
    const retired = typeof s.id === 'string' && !!RETIRED_ORDERS[s.id];
    // Resume the bonus clock relative to the restored simulation time.
    this.startedAt = Number.isFinite(s.startedAt) ? s.startedAt : now;
    this.completed = Array.isArray(s.completed) ? s.completed.filter((c) => c && typeof c.id === 'string') : [];
    // Saves from before endless orders stored a recipe index; newer ones a cake key.
    const ri = (v) => {
      if (Number.isInteger(v)) return LEGACY_CONTRACT_RECIPES[v] ?? null;
      if (typeof v !== 'string') return null;
      try { return isValidCakeData(parseCakeKey(v)) ? v : null; } catch { return null; }
    };
    this.lastRecipe = ri(s.lastRecipe);
    this.recipe = this.isContract ? ri(s.recipe) : null;
    this.legacy = this.isContract && !!s.legacy && !!this.recipe;
    if (this.isContract && s.v !== 2 && !this.recipe) {
      // Saved before endless orders: the running contract keeps its rotation cake.
      const n = this.index - ORDER_DEFS.length + 1;
      this.recipe = LEGACY_CONTRACT_RECIPES[(n - 1) % LEGACY_CONTRACT_RECIPES.length];
      this.legacy = true;
    }
    // After the cake is restored: its quantity bounds the progress.
    this.delivered = retired ? 0 : Math.max(0, Math.min(s.delivered | 0, this.current.quantity - 1));
  }
}
