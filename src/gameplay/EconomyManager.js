/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Money in, money out. Income-per-minute is measured over a sliding window
 * of simulation time so pausing does not distort it.
 */
import { ECONOMY } from '../core/Config.js';

const WINDOW = 60; // seconds

export class EconomyManager {
  constructor(money = ECONOMY.START_MONEY) {
    this.money = money;
    this.totalEarned = 0;
    this.totalSpent = 0;
    this._income = [];     // [time, amount]
    this._deliveries = []; // time
  }

  canAfford(amount) { return amount <= this.money; }

  /** Returns false (and changes nothing) if the player cannot afford it. */
  spend(amount) {
    if (!(amount >= 0) || amount > this.money) return false;
    this.money -= amount;
    this.totalSpent += amount;
    return true;
  }

  earn(amount, now) {
    if (!(amount > 0)) return;
    this.money += amount;
    this.totalEarned += amount;
    this._income.push([now, amount]);
  }

  /** A gift (milestone reward): money, but not production income. */
  grant(amount) {
    if (amount > 0) this.money += amount;
  }

  refund(amount) {
    if (amount > 0) { this.money += amount; this.totalSpent -= amount; }
  }

  recordDelivery(now) { this._deliveries.push(now); }

  _trim(now) {
    while (this._income.length && this._income[0][0] < now - WINDOW) this._income.shift();
    while (this._deliveries.length && this._deliveries[0] < now - WINDOW) this._deliveries.shift();
  }

  /** Money per minute over the last 60 s of simulation time. */
  incomePerMinute(now) {
    this._trim(now);
    let sum = 0;
    for (const [, a] of this._income) sum += a;
    const span = Math.min(WINDOW, Math.max(now, 1));
    return Math.round((sum / span) * 60);
  }

  /** Correct cakes delivered per minute over the same window. */
  cakesPerMinute(now) {
    this._trim(now);
    const span = Math.min(WINDOW, Math.max(now, 1));
    return Math.round((this._deliveries.length / span) * 60 * 10) / 10;
  }

  serialize() {
    return { money: this.money, totalEarned: this.totalEarned, totalSpent: this.totalSpent };
  }

  load(s) {
    if (!s) return;
    this.money = Number.isFinite(s.money) && s.money >= 0 ? Math.floor(s.money) : ECONOMY.START_MONEY;
    this.totalEarned = Number.isFinite(s.totalEarned) ? s.totalEarned : 0;
    this.totalSpent = Number.isFinite(s.totalSpent) ? s.totalSpent : 0;
  }
}
