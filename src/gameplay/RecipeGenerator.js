/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Endless puzzle orders. After the scripted orders every contract asks for a
 * NEW cake, generated from the ingredients and machines the player has
 * unlocked, a little harder each time (capped, so it stays a puzzle).
 *
 * Pure and deterministic: contract n always produces the same cake, so saves
 * and tests are stable. Every generated cake is buildable with what is
 * unlocked at that point (see `requiredMachines` / `isBuildable`).
 *
 * Design rules that keep the puzzles fair and readable:
 *  - Lower layers are plain sponge (flavors only); frosting and decorations
 *    only on the top layer, where the player can see them.
 *  - Cakes with more than one layer always have full layers.
 */
import { cakeKey, parseCakeKey } from '../cakes/CakeSerializer.js';

/** Small seeded PRNG (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const P = (flavor, frosting = null, decoration = null) => ({ flavor, frosting, decoration });
const same = (a, b) => (!a && !b) || (a && b && a.flavor === b.flavor && a.frosting === b.frosting && a.decoration === b.decoration);

// ------------------------------------------------------------ analysis
/** Is a layer one piece repeated in all four quadrants? */
const uniform = (q) => q.every((p) => same(p, q[0])) && !!q[0];
/** Left/right split (TL=BL, TR=BR): a cutter alone can make it. */
const lrSplit = (q) => same(q[0], q[3]) && same(q[1], q[2]);

/** Machines needed to build `cake` (by construction rules of the factory). */
export function requiredMachines(cake) {
  const need = new Set(['oven', 'delivery']);
  if (cake.layers.length > 1) need.add('stacker');
  for (const l of cake.layers) {
    const q = l.quadrants;
    if (q.some((p) => p && p.frosting)) need.add('froster');
    if (q.some((p) => p && p.decoration)) need.add('decorator');
    if (!uniform(q)) {
      // Anything but a whole cake starts with a cut; the unused part goes to the bin.
      need.add('cutter'); need.add('trash');
      // A single half comes straight out of one cut; everything else is joined from parts.
      const filled = q.filter(Boolean);
      const singleHalf = filled.length === 2 && same(filled[0], filled[1]);
      if (!singleHalf) need.add('combiner');
      // Cuts give west/east halves in place; anything else has to be turned.
      if (!lrSplit(q)) need.add('rotator');
    }
  }
  return [...need];
}

/** Can this cake be built with these unlocks ({ machines, flavors, frostings, decorations } Sets)? */
export function isBuildable(cake, u) {
  if (cake.layers.length > 4) return false;
  if (cake.layers.length > 1 && cake.layers.length > maxLayersFor(0, u)) return false;
  for (const m of requiredMachines(cake)) if (!u.machines.has(m)) return false;
  for (const l of cake.layers) for (const p of l.quadrants) {
    if (!p) continue;
    if (!u.flavors.has(p.flavor)) return false;
    if (p.frosting && !u.frostings.has(p.frosting)) return false;
    if (p.decoration && !(u.decorations || new Set()).has(p.decoration)) return false;
  }
  return true;
}

/**
 * Puzzle difficulty of a cake: more distinct pieces, rotations, extra layers,
 * frosting colours and decorations make it harder.
 */
export function scoreCake(cake) {
  let s = 0;
  const top = cake.layers.length - 1;
  cake.layers.forEach((l, li) => {
    const q = l.quadrants;
    const keys = new Set(q.map((p) => (p ? `${p.flavor}:${p.frosting}:${p.decoration}` : '-')));
    if (!uniform(q)) {
      s += 1.5 + keys.size;
      if (!lrSplit(q)) s += 1.5;            // needs rotating
      if (q.some((p) => !p)) s += 0.5;      // needs trashing
    }
    if (li === top) {
      s += new Set(q.filter((p) => p && p.frosting).map((p) => p.frosting)).size;
      s += 1.5 * new Set(q.filter((p) => p && p.decoration).map((p) => p.decoration)).size;
    }
  });
  s += (cake.layers.length - 1) * 3;
  return Math.round(s * 10) / 10;
}

// ------------------------------------------------------------ generation
/** Layer shapes: which quadrants share a piece (letters) or are empty ('-'). TL,TR,BR,BL. */
const SHAPES = {
  whole: ['a', 'a', 'a', 'a'],
  halvesLR: ['a', 'b', 'b', 'a'],
  halvesTB: ['a', 'a', 'b', 'b'],
  diagonal: ['a', 'b', 'a', 'b'],
  threeOne: ['a', 'a', 'a', 'b'],
  quarters3: ['a', 'b', 'c', 'a'],
  quarters4: ['a', 'b', 'c', 'd'],
  halfLeft: ['a', '-', '-', 'a'],
  halfTop: ['a', 'a', '-', '-'],
  threeQuarters: ['a', 'a', 'a', '-'],
};

function makeLayer(r, shape, u, { top, frostP, decoP, ownFlavors }) {
  const flavors = [...u.flavors], frostings = [...u.frostings], decos = [...(u.decorations || [])];
  const letters = {};
  const used = new Set();
  const piece = () => {
    let f = pick(r, ownFlavors || flavors);
    for (let i = 0; i < 4 && used.has(f) && flavors.length > 1; i++) f = pick(r, flavors); // prefer variety
    used.add(f);
    const fr = top && r() < frostP ? pick(r, frostings) : null;
    const de = top && decos.length && r() < decoP ? pick(r, decos) : null;
    return P(f, fr, de);
  };
  const q = SHAPES[shape].map((l) => (l === '-' ? null : (letters[l] ||= piece())));
  // Shapes that promise different pieces must really differ.
  const distinct = new Set(Object.values(letters).map((p) => `${p.flavor}:${p.frosting}:${p.decoration}`));
  if (distinct.size < Object.keys(letters).length) return null;
  return { quadrants: q.map((p) => (p ? { ...p } : null)) };
}

/** Difficulty the generator aims for at contract n (grows, then levels off). */
export function targetScore(n, boss = false) {
  return Math.min(19, 3 + n * 0.42) + (boss ? 3 : 0);
}

/** Maximum layers for contract n given the unlocks. */
export function maxLayersFor(n, u) {
  if (!u.machines.has('stacker')) return 1;
  const f = u.features || new Set();
  return f.has('layers4') ? 4 : f.has('layers3') ? 3 : 2;
}

/**
 * Generate the cake for contract n. `u` = unlocks available during that contract.
 * `avoid` = a cake key that must not be repeated (the previous contract).
 * Returns { cake (key), score }.
 */
export function generateRecipe(n, u, { boss = false, avoid = null } = {}) {
  const r = rng(n * 7919 + (boss ? 101 : 13));
  const target = targetScore(n, boss);
  const maxL = maxLayersFor(n, u);
  const frostP = Math.min(0.85, 0.35 + n * 0.02);
  const decoP = Math.min(0.8, 0.3 + n * 0.02);
  const singleShapes = Object.keys(SHAPES);
  const fullShapes = singleShapes.filter((k) => !SHAPES[k].includes('-'));
  let best = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    // More layers become likelier as the target grows.
    let layers = 1;
    while (layers < maxL && r() < Math.min(0.75, 0.25 + target / 30)) layers++;
    const out = [];
    let ok = true;
    for (let li = 0; li < layers; li++) {
      const top = li === layers - 1;
      const shapes = layers > 1 ? fullShapes : singleShapes;
      // Lower layers stay simple (whole or halves) so the top layer carries the puzzle.
      const shape = top ? pick(r, shapes) : pick(r, ['whole', 'whole', 'halvesLR', 'halvesTB']);
      const layer = makeLayer(r, shape, u, { top, frostP, decoP });
      if (!layer) { ok = false; break; }
      out.push(layer);
    }
    if (!ok) continue;
    const cake = { layers: out };
    if (!isBuildable(cake, u)) continue;
    const key = cakeKey(cake);
    if (key === avoid) continue;
    const score = scoreCake(cake);
    const d = Math.abs(score - target) + r() * 0.8; // small jitter keeps choices varied
    if (!best || d < best.d) best = { key, score, d };
  }
  if (!best) { // cannot happen with the starting unlocks; keep the game running regardless
    const f = [...u.flavors][0] || 'vanilla';
    const cake = { layers: [{ quadrants: [P(f), P(f), P(f), P(f)] }] };
    return { cake: cakeKey(cake), score: scoreCake(cake) };
  }
  return { cake: best.key, score: best.score };
}

// ------------------------------------------------------------ presentation
const ADJ = ['Sunny', 'Velvet', 'Twilight', 'Royal', 'Candy', 'Dreamy', 'Golden', 'Berry', 'Midnight', 'Rainbow', 'Cozy', 'Starry', 'Sugar', 'Moonlit', 'Blossom', 'Frosty'];
const CUSTOMERS = ['Chef Amélie', 'The Lighthouse Café', 'Professor Crumb', 'Mayor Biscotti', 'Little Sam', 'Wedding Planner Joy', 'Captain Waffles', 'The Book Club', 'Grandpa Theo', 'Pastry Critic Yuki', 'The Royal Kitchen', 'Space Camp', 'Ballet School', 'Fire Station 7', 'Zoo Keepers', 'Night Market'];

/** Display name + customer for a generated cake (deterministic). */
export function nameRecipe(n, key, boss) {
  const cake = parseCakeKey(key);
  const r = rng(n * 31 + 7);
  const top = cake.layers[cake.layers.length - 1].quadrants;
  const pieces = new Set(top.map((p) => (p ? p.flavor + p.frosting + p.decoration : '-'))).size;
  const noun = cake.layers.length >= 4 ? 'Skyscraper' : cake.layers.length === 3 ? 'Grand Tower' : cake.layers.length === 2 ? 'Tower'
    : top.some((p) => !p) ? 'Slice' : pieces >= 4 ? 'Mosaic' : pieces === 3 ? 'Trio' : pieces === 2 ? 'Duo' : 'Classic';
  const deco = top.some((p) => p && p.decoration) ? ' Delight' : '';
  const name = `${pick(r, ADJ)} ${noun}${deco}`;
  return { name: boss ? `Showpiece #${n}: ${name}` : `${name} #${n}`, customer: pick(r, CUSTOMERS) };
}

/** A short, specific hint for a generated cake. */
export function hintFor(key) {
  const cake = parseCakeKey(key);
  const need = new Set(requiredMachines(cake));
  const tips = [];
  if (cake.layers.length > 1) tips.push(`Build ${cake.layers.length} layers as separate cakes and stack them – the Stacker's side input goes on top`);
  if (need.has('rotator')) tips.push('rotate pieces into place before combining');
  if (need.has('decorator')) tips.push('decorate after frosting');
  if (!tips.length) tips.push(need.has('cutter') ? 'cut, keep the halves you need and combine them' : 'scale up a simple line');
  const s = tips.join('; ');
  return s[0].toUpperCase() + s.slice(1) + '.';
}
