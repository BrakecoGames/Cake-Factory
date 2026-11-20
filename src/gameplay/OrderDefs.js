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

import { generateRecipe, scoreCake, requiredMachines, nameRecipe, hintFor } from './RecipeGenerator.js';
// (contractCake uses generateRecipe; makeContractOrder reads the cached cake)
import { parseCakeKey } from '../cakes/CakeSerializer.js';

export const STARTING_UNLOCKS = {
  decorations: [],
  features: [],
  machines: ['belt', 'oven', 'delivery'],
  flavors: ['vanilla'],
  // Every frosting colour is available from the start (only the machine unlocks).
  frostings: ['pink', 'white', 'brown', 'yellow', 'blue', 'green', 'purple'],
};

export const ORDER_DEFS = [
  {
    id: 'o1_vanilla_delight', name: 'Vanilla Delight', customer: 'Grandma Rosa',
    cake: whole('vanilla'), quantity: 5, perCake: 10, reward: 100, difficulty: 1,
    requires: ['oven', 'delivery'],
    unlocks: { machines: ['froster'] },
    purpose: 'Teaches oven → belt → delivery.',
  },
  {
    id: 'o2_strawberry_frosting', name: 'Strawberry Frosting', customer: 'Lily’s Birthday',
    cake: whole('vanilla', 'pink'), quantity: 8, perCake: 15, reward: 250, difficulty: 1,
    requires: ['oven', 'froster', 'delivery'],
    hint: 'Put a Frosting Machine between the oven and the station.',
    unlocks: { machines: ['cutter', 'trash'], flavors: ['chocolate'] },
    purpose: 'Introduces frosting.',
  },
  {
    id: 'o4_half_moon', name: 'Half Moon', customer: 'Moonlight Diner',
    cake: key(P('vanilla'), null, null, P('vanilla')), quantity: 6, perCake: 20, reward: 350, difficulty: 2,
    requires: ['oven', 'cutter', 'trash', 'delivery'],
    hint: 'The Cutter sends the LEFT (west) half out of its L exit and the right (east) half out of R. Bin the right halves in a Trash Bin.',
    unlocks: { machines: ['combiner'] },
    purpose: 'Introduces cutting and discarding.',
  },
  {
    id: 'o3_half_and_half', name: 'Half & Half', customer: 'The Twins',
    cake: key(P('vanilla'), P('chocolate'), P('chocolate'), P('vanilla')), quantity: 10, perCake: 25, reward: 500, difficulty: 2,
    requires: ['oven', 'cutter', 'combiner', 'trash', 'delivery'],
    hint: 'Cut a vanilla and a chocolate cake. Keep the vanilla L-exit half and the chocolate R-exit half (trash the others), then combine.',
    unlocks: { machines: ['rotator'], flavors: ['strawberry'] },
    purpose: 'Introduces combining two production lines.',
  },
  {
    id: 'o6_sunrise', name: 'Sunrise Cake', customer: 'Early Bird Bakery',
    cake: key(P('chocolate'), P('chocolate'), P('vanilla'), P('vanilla')), quantity: 10, perCake: 30, reward: 700, difficulty: 3,
    requires: ['oven', 'cutter', 'rotator', 'combiner', 'trash', 'delivery'],
    hint: 'Rotating a left half clockwise turns it into a TOP half; a right half becomes a BOTTOM half.',
    unlocks: { flavors: ['lemon'] },
    purpose: 'Introduces rotation.',
  },
  {
    id: 'o7_strawberry_cream', name: 'Strawberry Cream', customer: 'Garden Party',
    cake: whole('strawberry', 'white'), quantity: 15, perCake: 20, reward: 600, difficulty: 2,
    requires: ['oven', 'froster', 'delivery'],
    bonus: { seconds: 30, reward: 250, text: 'Deliver all 15 within 30 s' },
    hint: 'A breather: scale up a simple line to beat the timer.',
    unlocks: { flavors: ['blueberry'] },
    purpose: 'Throughput breather.',
  },
  {
    id: 'o8_four_flavors', name: 'Four Flavors', customer: 'Food Critic Margot',
    cake: key(P('vanilla'), P('chocolate'), P('strawberry'), P('lemon')), quantity: 12, perCake: 50, reward: 1200, difficulty: 4,
    requires: ['oven', 'cutter', 'rotator', 'combiner', 'trash', 'delivery'],
    hint: 'Cut a half again after rotating it to get single quarters. Combine quarters into halves, halves into a cake.',
    unlocks: {},
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

/**
 * Recipes of the old rotating contracts. Only kept so saves that stored a
 * recipe *index* (before endless orders) still resolve to the same cake.
 */
export const LEGACY_CONTRACT_RECIPES = Object.freeze([
  whole('vanilla', 'pink'), ORDER_DEFS[4].cake, ORDER_DEFS[5].cake,
  whole('lemon', 'yellow'), key(P('blueberry', 'blue'), null, null, P('blueberry', 'blue')), ORDER_DEFS[7].cake,
]);

/**
 * What finishing endless contract n unlocks. Every 5th contract is a Showpiece
 * whose reward is a new machine or ingredient set, so there is always a next
 * goal in sight. Later Showpieces raise the stakes (bigger towers, more pay).
 */
export const CONTRACT_UNLOCKS = Object.freeze({
  2: { flavors: ['caramel'] },
  5: { machines: ['stacker'] },
  8: { flavors: ['redvelvet'] },
  10: { machines: ['decorator'], decorations: ['sprinkles', 'cherry'] },
  13: { decorations: ['swirl'] },
  15: { decorations: ['strawberry'] },
  18: { flavors: ['pistachio'] },
  20: { decorations: ['chocolate'], features: ['layers3'] },
  30: { features: ['layers4'] },
});

/** Names of unlockable features (not machines or ingredients). */
export const FEATURES = Object.freeze({
  layers3: 'Cakes up to 3 layers',
  layers4: 'Cakes up to 4 layers',
});

/** Contract n is a Showpiece (boss order). */
export const isShowpiece = (n) => n % 5 === 0;

/** Pay factor for repeating the previous contract's cake (the line already exists). */
export const REPEAT_PAY = 0.85;

/**
 * Endless contract n. Each one asks for a newly generated cake (see
 * RecipeGenerator) a little harder than before. `repeatCake` (a cake key)
 * swaps in the previous contract's cake at REPEAT_PAY – the player's choice
 * between a new puzzle and an existing line.
 */
const _contractOrders = new Map();
/**
 * `legacy`: a contract that was already running in a save from before endless
 * orders keeps its old cake at full pay (the player's line makes that cake).
 */
export function makeContractOrder(n, repeatCake = null, legacy = false) {
  // `current` is read every frame; generated orders are deterministic, so cache them.
  const ck = `${n}|${repeatCake || ''}|${legacy ? 1 : 0}`;
  if (!_contractOrders.has(ck)) {
    if (_contractOrders.size > 200) _contractOrders.clear();
    _contractOrders.set(ck, buildContractOrder(n, repeatCake, legacy));
  }
  return _contractOrders.get(ck);
}

function buildContractOrder(n, repeatCake, legacy) {
  const boss = isShowpiece(n);
  const genKey = contractCake(n);
  const gen = { cake: genKey, score: scoreCake(parseCakeKey(genKey)) };
  const keepOld = legacy && !!repeatCake;
  const repeat = !keepOld && !!repeatCake && repeatCake !== gen.cake && !boss;
  const cake = repeat || keepOld ? repeatCake : gen.cake;
  const score = repeat ? scoreCake(parseCakeKey(cake)) : gen.score;
  const pay = repeat ? REPEAT_PAY : 1;
  const growth = Math.min(2, 1 + 0.03 * (n - 1));
  const quantity = Math.round(Math.max(8, Math.min(40, 10 + n * 0.5 - score * 0.35)) * (boss ? 0.8 : 1));
  // Bonus pace tightens over time (upgrades keep mattering); complex cakes get a little more time.
  const pace = Math.max(1.3, 2.6 - 0.035 * (n - 1)) + 0.06 * score;
  const seconds = Math.round(quantity * pace);
  const perCake = Math.round((8 + score * 4) * growth * pay);
  const named = nameRecipe(n, cake, boss);
  const unlocks = CONTRACT_UNLOCKS[n] || {};
  return {
    id: `contract_${n}`,
    name: keepOld ? `Classic Contract #${n}` : repeat ? `Encore #${n}: same cake again` : named.name,
    customer: named.customer,
    cake,
    quantity,
    perCake,
    reward: Math.round((250 + n * 120 + score * 30) * pay * (boss ? 2 : 1)),
    recipe: repeat || keepOld ? cake : null, repeat, legacy: keepOld, boss: boss && !keepOld, score,
    difficulty: Math.min(5, 1 + Math.round(score / 4)),
    requires: requiredMachines(parseCakeKey(cake)),
    bonus: { seconds, reward: Math.round((150 + n * 50) * (boss ? 2 : 1)), text: `Deliver all ${quantity} within ${seconds} s` },
    hint: hintFor(cake),
    unlocks,
    purpose: boss ? 'Showpiece.' : 'Endless puzzle order.',
  };
}

const _contractCakes = new Map();
/** The generated cake of contract n (cached; generation is deterministic). */
export function contractCake(n) {
  if (n < 1) return null;
  // Fill the cache in order so the recursion (each cake avoids the previous one) stays shallow.
  for (let i = 1; i < n; i++) if (!_contractCakes.has(i)) contractCake(i);
  if (!_contractCakes.has(n)) {
    const u = unlocksAfter(ORDER_DEFS.length + n - 1);
    _contractCakes.set(n, generateRecipe(n, u, { boss: isShowpiece(n), avoid: contractCake(n - 1) }).cake);
  }
  return _contractCakes.get(n);
}

export function getOrderDef(index, repeatCake = null, legacy = false) {
  if (index < ORDER_DEFS.length) return ORDER_DEFS[index];
  return makeContractOrder(index - ORDER_DEFS.length + 1, repeatCake, legacy);
}

/**
 * Orders that were removed from the list, mapped to the order that replaces
 * them in old saves (progress on a retired order restarts on its replacement).
 */
export const RETIRED_ORDERS = Object.freeze({
  o2_morning_rush: 'o4_half_moon', // a repeat of plain vanilla – removed to cut repetition
});

export function orderIndexById(id) {
  if (RETIRED_ORDERS[id]) id = RETIRED_ORDERS[id];
  const i = ORDER_DEFS.findIndex((o) => o.id === id);
  if (i >= 0) return i;
  const m = /^contract_(\d+)$/.exec(id || '');
  return m ? ORDER_DEFS.length + Number(m[1]) - 1 : -1;
}

export const UNLOCK_KINDS = ['machines', 'flavors', 'frostings', 'decorations', 'features'];

/** Unlocks granted by finishing order `index` (scripted or endless). */
export function orderUnlocks(index) {
  if (index < ORDER_DEFS.length) return ORDER_DEFS[index].unlocks || {};
  return CONTRACT_UNLOCKS[index - ORDER_DEFS.length + 1] || {};
}

/** Everything unlocked once the first `completedCount` orders are done. */
export function unlocksAfter(completedCount) {
  const u = Object.fromEntries(UNLOCK_KINDS.map((k) => [k, new Set(STARTING_UNLOCKS[k] || [])]));
  const lastContract = Math.max(...Object.keys(CONTRACT_UNLOCKS).map(Number));
  const end = Math.min(completedCount, ORDER_DEFS.length + lastContract);
  for (let i = 0; i < end; i++) {
    const un = orderUnlocks(i);
    for (const k of UNLOCK_KINDS) for (const v of un[k] || []) u[k].add(v);
  }
  return u;
}

/**
 * The next order (from `index`, the current one) that unlocks something:
 * { inOrders (1 = the current order), unlocks } or null when all is unlocked.
 */
export function nextUnlock(index) {
  const lastContract = Math.max(...Object.keys(CONTRACT_UNLOCKS).map(Number));
  for (let i = index; i < ORDER_DEFS.length + lastContract; i++) {
    const un = orderUnlocks(i);
    if (UNLOCK_KINDS.some((k) => (un[k] || []).length)) return { inOrders: i - index + 1, unlocks: un };
  }
  return null;
}

/** Orders until the next Showpiece (1 = the current order), or null during the scripted orders. */
export function nextShowpiece(index) {
  if (index < ORDER_DEFS.length) return null;
  const n = index - ORDER_DEFS.length + 1;
  return 5 - ((n - 1) % 5);
}
