/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Factory layout: the main hall plus extra wings bought by the player, each
 * joined to the hall by a corridor wide enough for several conveyor belts.
 * Pure data – no rendering.
 *
 * Until the first wing is bought the grid is exactly the main hall (old saves
 * and early play are unchanged). Buying a wing converts the grid once into a
 * "world" that fits the hall at its MAXIMUM size plus every wing slot, so later
 * hall expansions never collide with wings and never shift anything again.
 *
 *          [north wing]
 *               ║ corridor
 *  [west]══ [main hall, max 36×36] ── Cake Shop (east, decorative)
 *               ║
 *          [south wing]
 */

export const MAIN_MAX = 36;   // largest main hall (Factory Expansion level 5)
export const WING = 16;       // wings are 16×16 cells
export const GAP = 6;         // cells between the hall's maximum edge and a wing
export const CORRIDOR = 4;    // corridor width in cells (room for 4 parallel belts)

/** World size once wings exist: west wing on the left, north/south wings above/below. */
export const WORLD_W = WING + GAP + MAIN_MAX;
export const WORLD_H = WING + GAP + MAIN_MAX + GAP + WING;
/** Top-left of the hall's maximum box in world mode. */
const BOX_X = WING + GAP, BOX_Y = WING + GAP;
const MID_X = BOX_X + MAIN_MAX / 2, MID_Y = BOX_Y + MAIN_MAX / 2;

/** Wings in purchase order, with price and display name. */
export const WINGS = Object.freeze([
  { id: 'north', name: 'North Wing', cost: 6000 },
  { id: 'west', name: 'West Wing', cost: 15000 },
  { id: 'south', name: 'South Wing', cost: 35000 },
]);

/** Wing rectangle (world mode). */
export function wingRect(id) {
  const c = MID_X - WING / 2, m = MID_Y - WING / 2;
  if (id === 'north') return { x: c, y: 0, w: WING, h: WING };
  if (id === 'south') return { x: c, y: BOX_Y + MAIN_MAX + GAP, w: WING, h: WING };
  if (id === 'west') return { x: 0, y: m, w: WING, h: WING };
  return null;
}

/** Corridor rectangle between the current main hall and a wing (world mode). */
export function corridorRect(id, main) {
  const half = CORRIDOR / 2;
  const w = wingRect(id);
  if (id === 'north') return { x: MID_X - half, y: w.y + w.h, w: CORRIDOR, h: main.y - (w.y + w.h) };
  if (id === 'south') return { x: MID_X - half, y: main.y + main.h, w: CORRIDOR, h: w.y - (main.y + main.h) };
  if (id === 'west') return { x: w.x + w.w, y: MID_Y - half, w: main.x - (w.x + w.w), h: CORRIDOR };
  return null;
}

/** Main hall rectangle of size s in world mode (centred in its maximum box). */
export function worldMainRect(s) {
  const o = (MAIN_MAX - s) / 2;
  return { x: BOX_X + o, y: BOX_Y + o, w: s, h: s };
}

/**
 * Every floor rectangle: { x, y, w, h, kind: 'main'|'wing'|'corridor', id }.
 * @param {{ main: {x,y,w,h}, wings: string[] }} layout
 */
export function floorRects(layout) {
  const out = [{ ...layout.main, kind: 'main', id: 'main' }];
  for (const id of layout.wings) {
    const c = corridorRect(id, layout.main);
    if (c.w > 0 && c.h > 0) out.push({ ...c, kind: 'corridor', id });
    out.push({ ...wingRect(id), kind: 'wing', id });
  }
  return out;
}

/** Floor mask (1 = buildable) for a grid of width×height, or null when the whole grid is floor. */
export function floorMask(layout, width, height) {
  if (!layout.wings.length) return null;
  const mask = new Uint8Array(width * height);
  for (const r of floorRects(layout)) {
    for (let y = Math.max(0, r.y); y < Math.min(height, r.y + r.h); y++) {
      for (let x = Math.max(0, r.x); x < Math.min(width, r.x + r.w); x++) mask[y * width + x] = 1;
    }
  }
  return mask;
}
