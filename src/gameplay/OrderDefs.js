/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Data-driven customer orders. `cake` is a CakeSerializer key, so an order's
 * requirement is exactly as precise as cake identity itself.
 *
 * `unlocks` is granted when the order is COMPLETED. `requires` lists the
 * machines the intended solution needs; a test verifies that every order's
 * machines, flavors and frostings are unlocked by earlier orders, so players
 * are never asked for something they cannot build.
 *
 * Key cheat-sheet (quadrants TL,TR,BR,BL): "-" empty, "flavor:frosting:decor".
 */

const P = (flavor, frosting = null) => `${flavor}:${frosting ?? '_'}:_`;
const key = (tl, tr, br, bl) => [tl, tr, br, bl].map((q) => q ?? '-').join(',');
const whole = (f, fr = null) => key(P(f, fr), P(f, fr), P(f, fr), P(f, fr));

export const STARTING_UNLOCKS = {
  machines: ['belt', 'oven', 'delivery'],
  flavors: ['vanilla'],
  frostings: [],
};

export const ORDER_DEFS = [
  {
    id: 'o1_vanilla_delight', name: 'Vanilla Delight', customer: 'Grandma Rosa',
    cake: whole('vanilla'), quantity: 5, perCake: 10, reward: 100, difficulty: 1,
    requires: ['oven', 'delivery'],
    unlocks: { machines: ['froster'], frostings: ['pink'] },
    purpose: 'Teaches oven → belt → delivery.',
  },
  {
    id: 'o2_strawberry_frosting', name: 'Strawberry Frosting', customer: 'Lily’s Birthday',
    cake: whole('vanilla', 'pink'), quantity: 8, perCake: 15, reward: 250, difficulty: 1,
    requires: ['oven', 'froster', 'delivery'],
    hint: 'Put a Frosting Machine between the oven and the station.',
    unlocks: { flavors: ['chocolate'] },
    purpose: 'Introduces frosting.',
  },
  {
    id: 'o2_morning_rush', name: 'Morning Rush', customer: 'Café Sunny Side',
    cake: whole('vanilla'), quantity: 12, perCake: 10, reward: 250, difficulty: 1,
    requires: ['oven', 'delivery'],
    bonus: { seconds: 25, reward: 100, text: 'Deliver all 12 within 25 s' },
    hint: 'Two ovens feeding one line beat the bonus timer. Belts merge from the side.',
    unlocks: { machines: ['cutter', 'trash'] },
    purpose: 'Second oven + merging belts.',
  },
  {
    id: 'o4_half_moon', name: 'Half Moon', customer: 'Moonlight Diner',
    cake: key(P('vanilla'), null, null, P('vanilla')), quantity: 6, perCake: 20, reward: 350, difficulty: 2,
    requires: ['oven', 'cutter', 'trash', 'delivery'],
    hint: 'The Cutter sends the LEFT half out of its left exit. Bin the right halves in a Trash Bin.',
    unlocks: { machines: ['combiner'] },
    purpose: 'Introduces cutting and discarding.',
  },
  {
    id: 'o3_half_and_half', name: 'Half & Half', customer: 'The Twins',
    cake: key(P('vanilla'), P('chocolate'), P('chocolate'), P('vanilla')), quantity: 10, perCake: 25, reward: 500, difficulty: 2,
    requires: ['oven', 'cutter', 'combiner', 'trash', 'delivery'],
    hint: 'Cut a vanilla and a chocolate cake, keep the vanilla LEFT half and the chocolate RIGHT half, then combine.',
    unlocks: { machines: ['rotator'], flavors: ['strawberry'], frostings: ['white'] },
    purpose: 'Introduces combining two production lines.',
  },
  {
    id: 'o6_sunrise', name: 'Sunrise Cake', customer: 'Early Bird Bakery',
    cake: key(P('chocolate'), P('chocolate'), P('vanilla'), P('vanilla')), quantity: 10, perCake: 30, reward: 700, difficulty: 3,
    requires: ['oven', 'cutter', 'rotator', 'combiner', 'trash', 'delivery'],
    hint: 'Rotating a left half clockwise turns it into a TOP half; a right half becomes a BOTTOM half.',
    unlocks: { flavors: ['lemon'], frostings: ['yellow'] },
    purpose: 'Introduces rotation.',
  },
  {
    id: 'o7_strawberry_cream', name: 'Strawberry Cream', customer: 'Garden Party',
    cake: whole('strawberry', 'white'), quantity: 15, perCake: 20, reward: 600, difficulty: 2,
    requires: ['oven', 'froster', 'delivery'],
    bonus: { seconds: 30, reward: 250, text: 'Deliver all 15 within 30 s' },
    hint: 'A breather: scale up a simple line to beat the timer.',
    unlocks: { flavors: ['blueberry'], frostings: ['blue', 'brown'] },
    purpose: 'Throughput breather.',
  },
  {
    id: 'o8_four_flavors', name: 'Four Flavors', customer: 'Food Critic Margot',
    cake: key(P('vanilla'), P('chocolate'), P('strawberry'), P('lemon')), quantity: 12, perCake: 50, reward: 1200, difficulty: 4,
    requires: ['oven', 'cutter', 'rotator', 'combiner', 'trash', 'delivery'],
    hint: 'Cut a half again after rotating it to get single quarters. Combine quarters into halves, halves into a cake.',
    unlocks: { frostings: ['green', 'purple'] },
    purpose: 'First big production chain.',
  },
  {
    id: 'o3_bakery_fair', name: 'Bakery Fair', customer: 'Town Festival',
    cake: key(P('vanilla', 'pink'), P('chocolate', 'pink'), P('chocolate', 'pink'), P('vanilla', 'pink')), quantity: 20, perCake: 40, reward: 1500, difficulty: 4,
    requires: ['oven', 'cutter', 'combiner', 'froster', 'trash', 'delivery'],
    bonus: { seconds: 60, reward: 600, text: 'Deliver all 20 within 60 s' },
    hint: 'Frost after combining – the froster colors every piece of the top layer.',
    unlocks: {},
    purpose: 'Combine everything at scale.',
  },
];

/** Recipes reused by repeatable contracts (all producible after the scripted orders). */
const CONTRACT_RECIPES = [
  { name: 'Pink Vanilla', cake: whole('vanilla', 'pink'), value: 15 },
  { name: 'Half & Half', cake: ORDER_DEFS[4].cake, value: 25 },
  { name: 'Sunrise', cake: ORDER_DEFS[5].cake, value: 30 },
  { name: 'Lemon Drizzle', cake: whole('lemon', 'yellow'), value: 15 },
  { name: 'Blue Moon', cake: key(P('blueberry', 'blue'), null, null, P('blueberry', 'blue')), value: 25 },
  { name: 'Four Flavors', cake: ORDER_DEFS[7].cake, value: 50 },
];

/**
 * After the scripted orders run out, repeatable contracts keep the factory
 * busy. They cycle through recipes and scale so optimisation pays off.
 */
export function makeContractOrder(n) {
  const r = CONTRACT_RECIPES[(n - 1) % CONTRACT_RECIPES.length];
  const quantity = 15 + n * 5;
  const seconds = Math.round(quantity * 2.2);
  return {
    id: `contract_${n}`,
    name: `${r.name} Contract #${n}`,
    customer: 'Sweet Supply Co.',
    cake: r.cake,
    quantity,
    perCake: r.value,
    reward: 300 + n * 150,
    difficulty: 4,
    bonus: { seconds, reward: 200 + n * 60, text: `Deliver all ${quantity} within ${seconds} s` },
    hint: 'Repeatable contract. Upgrade machines (U) and buy Bakery Upgrades (⬆) to beat the timer.',
    unlocks: {},
    purpose: 'Repeatable contract.',
  };
}

export function getOrderDef(index) {
  if (index < ORDER_DEFS.length) return ORDER_DEFS[index];
  return makeContractOrder(index - ORDER_DEFS.length + 1);
}

export function orderIndexById(id) {
  const i = ORDER_DEFS.findIndex((o) => o.id === id);
  if (i >= 0) return i;
  const m = /^contract_(\d+)$/.exec(id || '');
  return m ? ORDER_DEFS.length + Number(m[1]) - 1 : -1;
}

/** Everything unlocked once the first `completedCount` orders are done. */
export function unlocksAfter(completedCount) {
  const u = {
    machines: new Set(STARTING_UNLOCKS.machines),
    flavors: new Set(STARTING_UNLOCKS.flavors),
    frostings: new Set(STARTING_UNLOCKS.frostings),
  };
  for (let i = 0; i < Math.min(completedCount, ORDER_DEFS.length); i++) {
    const un = ORDER_DEFS[i].unlocks || {};
    for (const k of ['machines', 'flavors', 'frostings']) for (const v of un[k] || []) u[k].add(v);
  }
  return u;
}
