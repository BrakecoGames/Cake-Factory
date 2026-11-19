/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Tracks the active order, validates delivered cakes and pays rewards.
 * Time is simulation time (seconds), so pausing pauses bonus timers too.
 */
import { getOrderDef, orderIndexById, RETIRED_ORDERS, ORDER_DEFS, contractRecipeIndex, contractRecipeName } from './OrderDefs.js';
import { cakeKey, parseCakeKey } from '../cakes/CakeSerializer.js';
import { diagnoseMismatch } from './Diagnose.js';

export class OrderManager {
  constructor() {
    this.index = 0;
    this.delivered = 0;
    this.startedAt = 0;
    this.completed = []; // { id, name, bonus: bool, time }
    this.recipe = null;     // chosen recipe for the current contract (null = rotation)
    this.lastRecipe = null; // recipe of the last finished contract
    this.listeners = new Set();
  }

  get current() { return getOrderDef(this.index, this.recipe); }

  get isContract() { return this.index >= ORDER_DEFS.length; }

  /**
   * The other contract on offer (repeat the previous recipe at lower pay), or
   * null. Only before the first cake of the contract, so no progress is lost.
   */
  get alternative() {
    if (!this.isContract || this.delivered > 0 || this.lastRecipe == null) return null;
    const n = this.index - ORDER_DEFS.length + 1;
    const rot = contractRecipeIndex(n);
    if (this.lastRecipe === rot) return null;
    const other = this.recipe == null ? this.lastRecipe : rot;
    return getOrderDef(this.index, other);
  }

  /** Switch the current contract to the alternative offer. */
  switchContract() {
    const alt = this.alternative;
    if (!alt) return false;
    const n = this.index - ORDER_DEFS.length + 1;
    this.recipe = alt.recipe === contractRecipeIndex(n) ? null : alt.recipe;
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
      if (this.isContract) this.lastRecipe = finished.recipe ?? null;
      this.recipe = null;
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
    return { id: this.current.id, index: this.index, delivered: this.delivered, startedAt: this.startedAt, completed: this.completed.slice(), recipe: this.recipe, lastRecipe: this.lastRecipe };
  }

  load(s, now = 0) {
    if (!s) return;
    const byId = typeof s.id === 'string' ? orderIndexById(s.id) : -1;
    this.index = byId >= 0 ? byId : Math.max(0, s.index | 0);
    const retired = typeof s.id === 'string' && !!RETIRED_ORDERS[s.id];
    this.delivered = retired ? 0 : Math.max(0, Math.min(s.delivered | 0, this.current.quantity - 1));
    // Resume the bonus clock relative to the restored simulation time.
    this.startedAt = Number.isFinite(s.startedAt) ? s.startedAt : now;
    this.completed = Array.isArray(s.completed) ? s.completed.filter((c) => c && typeof c.id === 'string') : [];
    const ri = (v) => (Number.isInteger(v) && contractRecipeName(v) ? v : null);
    this.lastRecipe = ri(s.lastRecipe);
    this.recipe = this.isContract ? ri(s.recipe) : null;
  }
}
