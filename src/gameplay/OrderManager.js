/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Tracks the active order, validates delivered cakes and pays rewards.
 * Time is simulation time (seconds), so pausing pauses bonus timers too.
 */
import { getOrderDef, orderIndexById, RETIRED_ORDERS } from './OrderDefs.js';
import { cakeKey } from '../cakes/CakeSerializer.js';

export class OrderManager {
  constructor() {
    this.index = 0;
    this.delivered = 0;
    this.startedAt = 0;
    this.completed = []; // { id, name, bonus: bool, time }
    this.listeners = new Set();
  }

  get current() { return getOrderDef(this.index); }

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
      return { accepted: false, reward: 0, reason: 'Not what the customer ordered' };
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
    return { id: this.current.id, index: this.index, delivered: this.delivered, startedAt: this.startedAt, completed: this.completed.slice() };
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
  }
}
