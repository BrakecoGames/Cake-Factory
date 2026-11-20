/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Milestones: long-term goals with a cash reward. Pure data – progress is
 * read from game statistics, so milestones can never get out of sync with the
 * real state (an old save simply reaches the ones it already deserves).
 */

/** stat → what is counted (see Game.milestoneStats()). */
export const MILESTONES = Object.freeze([
  { id: 'cakes_10', name: 'First Batch', desc: 'Deliver 10 correct cakes', stat: 'cakes', goal: 10, reward: 50 },
  { id: 'orders_3', name: 'Regular Customers', desc: 'Complete 3 orders', stat: 'orders', goal: 3, reward: 150 },
  { id: 'machines_6', name: 'Production Line', desc: 'Run 6 machines at once', stat: 'machines', goal: 6, reward: 150 },
  { id: 'cakes_50', name: 'Busy Bakery', desc: 'Deliver 50 correct cakes', stat: 'cakes', goal: 50, reward: 200 },
  { id: 'upgrade_1', name: 'Tuned Up', desc: 'Upgrade a machine to level 2', stat: 'levelUps', goal: 1, reward: 100 },
  { id: 'bonus_1', name: 'Speedy Service', desc: 'Earn an order’s time bonus', stat: 'bonuses', goal: 1, reward: 250 },
  { id: 'orders_8', name: 'Town Favourite', desc: 'Complete 8 orders', stat: 'orders', goal: 8, reward: 800 },
  { id: 'earned_10k', name: 'Sweet Profits', desc: 'Earn $10,000 in total', stat: 'earned', goal: 10000, reward: 500 },
  { id: 'machines_15', name: 'Real Factory', desc: 'Run 15 machines at once', stat: 'machines', goal: 15, reward: 600 },
  { id: 'expand_1', name: 'More Room', desc: 'Expand the factory once', stat: 'expansions', goal: 1, reward: 500 },
  { id: 'cakes_250', name: 'Cake Machine', desc: 'Deliver 250 correct cakes', stat: 'cakes', goal: 250, reward: 1000 },
  { id: 'bonus_5', name: 'Clockwork Kitchen', desc: 'Earn 5 time bonuses', stat: 'bonuses', goal: 5, reward: 1200 },
  { id: 'upgrade_5', name: 'Top of the Line', desc: 'Upgrade a machine to level 5', stat: 'levelUps', goal: 4, reward: 1500 },
  { id: 'orders_15', name: 'Contract Baker', desc: 'Complete 15 orders', stat: 'orders', goal: 15, reward: 2500 },
  { id: 'machines_30', name: 'Industrial Bakery', desc: 'Run 30 machines at once', stat: 'machines', goal: 30, reward: 2500 },
  { id: 'earned_100k', name: 'Cake Tycoon', desc: 'Earn $100,000 in total', stat: 'earned', goal: 100000, reward: 5000 },
  { id: 'cakes_1000', name: 'Legendary Bakery', desc: 'Deliver 1,000 correct cakes', stat: 'cakes', goal: 1000, reward: 6000 },
  { id: 'expand_4', name: 'Mega Factory', desc: 'Expand the factory to full size', stat: 'expansions', goal: 4, reward: 8000 },
  // Endless play
  { id: 'showpiece_1', name: 'Showstopper', desc: 'Complete a Showpiece order', stat: 'showpieces', goal: 1, reward: 1200 },
  { id: 'orders_30', name: 'Bakery Legend', desc: 'Complete 30 orders', stat: 'orders', goal: 30, reward: 6000 },
  { id: 'showpiece_5', name: 'Master Pâtissier', desc: 'Complete 5 Showpiece orders', stat: 'showpieces', goal: 5, reward: 12000 },
  { id: 'orders_60', name: 'Cake Empire', desc: 'Complete 60 orders', stat: 'orders', goal: 60, reward: 25000 },
  { id: 'cakes_5000', name: 'Sweet Infinity', desc: 'Deliver 5,000 correct cakes', stat: 'cakes', goal: 5000, reward: 30000 },
  { id: 'showpiece_20', name: 'Hall of Fame', desc: 'Complete 20 Showpiece orders', stat: 'showpieces', goal: 20, reward: 60000 },
]);

export class MilestoneManager {
  constructor() {
    this.reached = new Set();
  }

  get total() { return MILESTONES.length; }
  get count() { return this.reached.size; }

  /** Progress of every milestone for the panel: { def, value, done }. */
  progress(stats) {
    return MILESTONES.map((def) => ({ def, value: Math.min(def.goal, stats[def.stat] ?? 0), done: this.reached.has(def.id) }));
  }

  /** The next few unreached milestones, closest to completion first. */
  next(stats, n = 3) {
    return this.progress(stats).filter((p) => !p.done)
      .sort((a, b) => b.value / b.def.goal - a.value / a.def.goal)
      .slice(0, n);
  }

  /** Mark every milestone the stats satisfy. Returns the newly reached definitions. */
  check(stats) {
    const out = [];
    for (const def of MILESTONES) {
      if (this.reached.has(def.id)) continue;
      if ((stats[def.stat] ?? 0) >= def.goal) { this.reached.add(def.id); out.push(def); }
    }
    return out;
  }

  serialize() { return [...this.reached]; }
  load(list) {
    this.reached = new Set(Array.isArray(list) ? list.filter((id) => MILESTONES.some((m) => m.id === id)) : []);
  }
}
