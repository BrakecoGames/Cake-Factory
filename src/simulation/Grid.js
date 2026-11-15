/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Grid occupancy + direction helpers. No rendering dependencies.
 *
 * Directions (clockwise, seen from above; +x = east, +y = south):
 *   0 = East (+x), 1 = South (+y), 2 = West (-x), 3 = North (-y)
 * Grid y maps to world Z in the renderer.
 */

export const DIR = Object.freeze({ E: 0, S: 1, W: 2, N: 3 });
export const DIR_NAMES = Object.freeze(['East', 'South', 'West', 'North']);
export const DX = Object.freeze([1, 0, -1, 0]);
export const DY = Object.freeze([0, 1, 0, -1]);

export const opposite = (d) => (d + 2) & 3;
export const rotateDir = (d, r) => (d + r) & 3;

/** Direction from cell a to orthogonally adjacent cell b, or -1. */
export function dirBetween(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  if (dx === 1 && dy === 0) return DIR.E;
  if (dx === -1 && dy === 0) return DIR.W;
  if (dx === 0 && dy === 1) return DIR.S;
  if (dx === 0 && dy === -1) return DIR.N;
  return -1;
}

/**
 * Rotate a local footprint cell (lx,ly) of a w×h footprint by r quarter turns
 * clockwise. Returns [x, y] in the rotated footprint's local space.
 */
export function rotateLocal(lx, ly, w, h, r) {
  switch (r & 3) {
    case 0: return [lx, ly];
    case 1: return [h - 1 - ly, lx];
    case 2: return [w - 1 - lx, h - 1 - ly];
    default: return [ly, w - 1 - lx];
  }
}

/** Rotate a continuous local point (0..w, 0..h) of a footprint by r quarter turns clockwise. */
export function rotatePoint(px, py, w, h, r) {
  switch (r & 3) {
    case 0: return [px, py];
    case 1: return [h - py, px];
    case 2: return [w - px, h - py];
    default: return [py, w - px];
  }
}

export function rotatedSize(w, h, r) {
  return (r & 1) ? [h, w] : [w, h];
}

export class Grid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    /** Entity id per cell, 0 = empty. */
    this.cells = new Int32Array(width * height);
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x, y) {
    if (!this.inBounds(x, y)) return -1;
    return this.cells[y * this.width + x];
  }

  set(x, y, id) {
    if (!this.inBounds(x, y)) throw new Error(`Cell out of bounds: ${x},${y}`);
    this.cells[y * this.width + x] = id;
  }

  clear() { this.cells.fill(0); }
}
