/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Explains WHY a delivered cake does not match the order, so players can fix
 * their line instead of guessing. Pure data – no rendering.
 */
import { cakeKey } from '../cakes/CakeSerializer.js';
import { rotateCW, rotateCCW, rotate180 } from '../cakes/CakeOperations.js';
import { cloneCake, FROSTINGS, DECORATIONS } from '../cakes/CakeModel.js';

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
  if (delivered.layers.length > 1) {
    const flipped = { layers: delivered.layers.slice().reverse() };
    if (cakeKey(flipped) === want) return 'Layers are upside down – swap the Layer Stacker\'s inputs (side input goes on top)';
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
  if (frostingsOf(delivered) !== frostingsOf(ordered)) {
    const colors = (c) => [...new Set(c.layers.flatMap((l) => l.quadrants).filter((p) => p && p.frosting).map((p) => p.frosting))];
    const want = colors(ordered), got = colors(delivered);
    const name = (k) => FROSTINGS[k]?.name.toLowerCase() ?? k;
    if (want.length && !got.length) return `Needs ${want.map(name).join(' + ')} frosting – add a Frosting Machine to the line`;
    if (!want.length && got.length) return 'No frosting wanted – take the Frosting Machine out of this line';
    if (want.length === 1 && got.length === 1 && want[0] !== got[0]) return `Wrong frosting colour: ${name(got[0])} instead of ${name(want[0])}`;
    return 'The frosting does not match';
  }
  const decosOf = (c) => [...new Set(c.layers.flatMap((l) => l.quadrants).filter((p) => p && p.decoration).map((p) => p.decoration))].sort();
  const wd = decosOf(ordered), gd = decosOf(delivered);
  if (wd.join() !== gd.join()) {
    const name = (k) => DECORATIONS[k]?.name.toLowerCase() ?? k;
    if (wd.length && !gd.length) return `Needs ${wd.map(name).join(' + ')} – add a Decorator to the line`;
    if (!wd.length && gd.length) return 'No decorations wanted on this cake';
    return `Wrong decoration: ${gd.map(name).join(' + ')} instead of ${wd.map(name).join(' + ')}`;
  }
  return 'Right ingredients, wrong arrangement';
}
