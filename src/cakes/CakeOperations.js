/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Pure cake transformations. Every function returns NEW cake objects and
 * never mutates its inputs. Machines (Phase 2+) call these; the rules are
 * defined and tested now because they are the foundation of the game.
 *
 * Quadrant order: 0=TL, 1=TR, 2=BR, 3=BL (clockwise).
 */
import { MAX_CAKE_LAYERS } from '../core/Config.js';
import { cloneCake, normalizeCake, FROSTINGS, DECORATIONS } from './CakeModel.js';

/** Rotate every layer 90° clockwise: TL→TR, TR→BR, BR→BL, BL→TL. */
export function rotateCW(cake) {
  const c = cloneCake(cake);
  for (const l of c.layers) {
    const q = l.quadrants;
    l.quadrants = [q[3], q[0], q[1], q[2]];
  }
  return c;
}

export function rotateCCW(cake) {
  const c = cloneCake(cake);
  for (const l of c.layers) {
    const q = l.quadrants;
    l.quadrants = [q[1], q[2], q[3], q[0]];
  }
  return c;
}

export function rotate180(cake) {
  return rotateCW(rotateCW(cake));
}

/** Keep only the listed quadrant indices on every layer. Returns null if nothing remains. */
export function keepQuadrants(cake, indices) {
  const c = cloneCake(cake);
  for (const l of c.layers) {
    l.quadrants = l.quadrants.map((p, i) => (indices.includes(i) ? p : null));
  }
  return normalizeCake(c);
}

/**
 * Vertical half cut (the basic cutter).
 * Deterministic rule: output[0] = LEFT half (TL, BL), output[1] = RIGHT half (TR, BR).
 * A half that would be empty is returned as null.
 */
export function cutHalves(cake) {
  return [keepQuadrants(cake, [0, 3]), keepQuadrants(cake, [1, 2])];
}

/** Quarter cut. Output order follows quadrant order: [TL, TR, BR, BL]. */
export function cutQuarters(cake) {
  return [0, 1, 2, 3].map((i) => keepQuadrants(cake, [i]));
}

/**
 * Combine two cakes side by side. Compatible only when both have the same
 * number of layers and no quadrant is filled in both.
 * Returns { ok: true, cake } or { ok: false, reason }.
 */
export function combine(a, b) {
  if (a.layers.length !== b.layers.length) {
    return { ok: false, reason: 'Layer counts differ' };
  }
  const out = cloneCake(a);
  for (let li = 0; li < a.layers.length; li++) {
    for (let qi = 0; qi < 4; qi++) {
      const pa = a.layers[li].quadrants[qi];
      const pb = b.layers[li].quadrants[qi];
      if (pa && pb) return { ok: false, reason: 'Pieces overlap' };
      out.layers[li].quadrants[qi] = pa ? { ...pa } : pb ? { ...pb } : null;
    }
  }
  return { ok: true, cake: out };
}

/** Stack `top` onto `bottom`. Layers stay ordered bottom→top. */
export function stack(bottom, top, maxLayers = MAX_CAKE_LAYERS) {
  const total = bottom.layers.length + top.layers.length;
  if (total > maxLayers) return { ok: false, reason: `Max ${maxLayers} layers` };
  const out = cloneCake(bottom);
  for (const l of top.layers) out.layers.push({ quadrants: l.quadrants.map((p) => (p ? { ...p } : null)) });
  return { ok: true, cake: out };
}

/**
 * Apply frosting to the TOP layer. `quadrants` limits which quadrants are
 * frosted (advanced frosters); by default every filled quadrant.
 */
export function frost(cake, color, quadrants = [0, 1, 2, 3]) {
  if (!FROSTINGS[color]) throw new Error(`Unknown frosting ${color}`);
  const c = cloneCake(cake);
  const top = c.layers[c.layers.length - 1];
  top.quadrants = top.quadrants.map((p, i) => (p && quadrants.includes(i) ? { ...p, frosting: color } : p));
  return c;
}

/** Add a decoration to filled quadrants of the TOP layer. */
export function decorate(cake, decoration, quadrants = [0, 1, 2, 3]) {
  if (!DECORATIONS[decoration]) throw new Error(`Unknown decoration ${decoration}`);
  const c = cloneCake(cake);
  const top = c.layers[c.layers.length - 1];
  top.quadrants = top.quadrants.map((p, i) => (p && quadrants.includes(i) ? { ...p, decoration } : p));
  return c;
}
