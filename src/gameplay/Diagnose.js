/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Explains WHY a delivered cake does not match the order, so players can fix
 * their line instead of guessing. Pure data – no rendering.
 */
import { cakeKey } from '../cakes/CakeSerializer.js';
import { rotateCW, rotateCCW, rotate180 } from '../cakes/CakeOperations.js';
import { cloneCake } from '../cakes/CakeModel.js';

/** Swap west and east halves (TL↔TR, BL↔BR) on every layer. */
export function mirrorLeftRight(cake) {
  const c = cloneCake(cake);
  for (const l of c.layers) { const q = l.quadrants; l.quadrants = [q[1], q[0], q[3], q[2]]; }
  return c;
}

const flavorsOf = (cake) => cake.layers.flatMap((l) => l.quadrants.map((p) => (p ? p.flavor : '-'))).sort().join(',');
const frostingsOf = (cake) => cake.layers.flatMap((l) => l.quadrants.map((p) => (p ? p.frosting ?? '_' : '-'))).sort().join(',');

/**
 * @returns {string} a short, specific reason (shown to the player).
 */
export function diagnoseMismatch(delivered, ordered) {
  const want = cakeKey(ordered);
  if (delivered.layers.length !== ordered.layers.length) {
    return `Wrong number of layers (${delivered.layers.length} instead of ${ordered.layers.length})`;
  }
  if (cakeKey(mirrorLeftRight(delivered)) === want) {
    return 'Left and right halves are swapped – keep the other exit (L ↔ R) at one of your cutters';
  }
  if (cakeKey(rotate180(delivered)) === want) return 'Turned 180° – the pieces are on the opposite sides';
  if (cakeKey(rotateCW(delivered)) === want || cakeKey(rotateCCW(delivered)) === want) {
    return 'Turned a quarter – the pieces need to be rotated 90°';
  }
  const holes = (c) => c.layers.flatMap((l) => l.quadrants).filter((p) => !p).length;
  if (holes(delivered) > holes(ordered)) return 'Pieces are missing – the cake is not complete';
  if (flavorsOf(delivered) !== flavorsOf(ordered)) return 'Wrong flavors';
  if (frostingsOf(delivered) !== frostingsOf(ordered)) return 'The frosting does not match';
  return 'Right ingredients, wrong arrangement';
}
