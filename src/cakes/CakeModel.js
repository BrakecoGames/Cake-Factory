/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Logical cake data. Completely independent from rendering.
 *
 * QUADRANT ORDER (used everywhere in the codebase):
 *   index 0 = top-left (TL), 1 = top-right (TR),
 *   index 2 = bottom-right (BR), 3 = bottom-left (BL)
 * i.e. clockwise starting at top-left, seen from above.
 *
 * In world space "top" is -Z and "left" is -X, so quadrant 0 sits at (-x,-z).
 *
 * Layers are ordered bottom → top (layers[0] is the bottom layer).
 *
 * A quadrant is either `null` (empty) or a piece:
 *   { flavor: string, frosting: string|null, decoration: string|null }
 */

export const Q = Object.freeze({ TL: 0, TR: 1, BR: 2, BL: 3 });
export const QUADRANT_NAMES = Object.freeze(['top-left', 'top-right', 'bottom-right', 'bottom-left']);

export const FLAVORS = Object.freeze({
  vanilla:    { name: 'Vanilla',    color: '#f6dfa4' },
  chocolate:  { name: 'Chocolate',  color: '#7a4a2e' },
  strawberry: { name: 'Strawberry', color: '#f49ab0' },
  lemon:      { name: 'Lemon',      color: '#f7e45e' },
  blueberry:  { name: 'Blueberry',  color: '#7d8ee8' },
});

export const FROSTINGS = Object.freeze({
  pink:   { name: 'Pink',   color: '#ff8fb8' },
  white:  { name: 'White',  color: '#fffaf2' },
  brown:  { name: 'Brown',  color: '#8a5634' },
  yellow: { name: 'Yellow', color: '#ffe27a' },
  blue:   { name: 'Blue',   color: '#8fc8ff' },
  green:  { name: 'Green',  color: '#8de0b4' },
  purple: { name: 'Purple', color: '#c3a2ff' },
});

export const DECORATIONS = Object.freeze({
  cherry:     { name: 'Cherry' },
  sprinkles:  { name: 'Sprinkles' },
  chocolate:  { name: 'Chocolate pieces' },
  strawberry: { name: 'Strawberry' },
  swirl:      { name: 'Cream swirl' },
});

let nextCakeId = 1;
/** Monotonic runtime id. Not part of cake identity (see CakeSerializer). */
export function allocCakeId() { return nextCakeId++; }
export function resetCakeIds(start = 1) { nextCakeId = start; }

export function makePiece(flavor, frosting = null, decoration = null) {
  if (!FLAVORS[flavor]) throw new Error(`Unknown flavor: ${flavor}`);
  if (frosting !== null && !FROSTINGS[frosting]) throw new Error(`Unknown frosting: ${frosting}`);
  if (decoration !== null && !DECORATIONS[decoration]) throw new Error(`Unknown decoration: ${decoration}`);
  return { flavor, frosting, decoration };
}

/** A layer is always exactly 4 quadrants. */
export function makeLayer(quadrants) {
  if (!Array.isArray(quadrants) || quadrants.length !== 4) {
    throw new Error('A layer must have exactly 4 quadrants');
  }
  return { quadrants: quadrants.map((p) => (p ? { ...p } : null)) };
}

export function makeCake(layers) {
  if (!Array.isArray(layers) || layers.length === 0) throw new Error('A cake needs at least one layer');
  return { id: allocCakeId(), layers: layers.map((l) => makeLayer(l.quadrants ?? l)) };
}

/** Full round cake of one flavor – what an oven produces. */
export function makeWholeCake(flavor = 'vanilla') {
  return makeCake([[makePiece(flavor), makePiece(flavor), makePiece(flavor), makePiece(flavor)]]);
}

export function cloneCake(cake, keepId = false) {
  return {
    id: keepId ? cake.id : allocCakeId(),
    layers: cake.layers.map((l) => ({ quadrants: l.quadrants.map((p) => (p ? { ...p } : null)) })),
  };
}

export function isLayerEmpty(layer) {
  return layer.quadrants.every((p) => p === null);
}

/** Removes empty layers. Returns null when nothing remains (cake fully empty). */
export function normalizeCake(cake) {
  const layers = cake.layers.filter((l) => !isLayerEmpty(l));
  if (layers.length === 0) return null;
  return { id: cake.id, layers };
}

/** Validates the shape of untrusted data (e.g. from a save file). */
export function isValidCakeData(c) {
  if (!c || !Array.isArray(c.layers) || c.layers.length === 0) return false;
  for (const l of c.layers) {
    if (!l || !Array.isArray(l.quadrants) || l.quadrants.length !== 4) return false;
    for (const p of l.quadrants) {
      if (p === null) continue;
      if (typeof p !== 'object' || !FLAVORS[p.flavor]) return false;
      if (p.frosting != null && !FROSTINGS[p.frosting]) return false;
      if (p.decoration != null && !DECORATIONS[p.decoration]) return false;
    }
  }
  return c.layers.some((l) => !isLayerEmpty(l));
}

/** Human readable one-line description, used in tooltips and the inspector. */
export function describeCake(cake) {
  const parts = cake.layers.map((layer, i) => {
    const qs = layer.quadrants.map((p) => {
      if (!p) return '—';
      let s = FLAVORS[p.flavor].name;
      if (p.frosting) s += ` + ${FROSTINGS[p.frosting].name} frosting`;
      if (p.decoration) s += ` + ${DECORATIONS[p.decoration].name}`;
      return s;
    });
    const same = qs.every((q) => q === qs[0]);
    // Quadrants: 0 TL, 1 TR, 2 BR, 3 BL. Name halves the way players think of them.
    const halves = [['left', 0, 3], ['right', 1, 2], ['top', 0, 1], ['bottom', 3, 2]];
    const half = (a, b) => qs[a] !== '—' && qs[a] === qs[b];
    const empty = (a, b) => qs[a] === '—' && qs[b] === '—';
    let body;
    if (same) body = qs[0] === '—' ? 'empty' : `whole ${qs[0]}`;
    else {
      const pairs = [[0, 1], [2, 3]].map(([i, j]) => [halves[i], halves[j]]);
      for (const [h1, h2] of pairs) {
        if (half(h1[1], h1[2]) && empty(h2[1], h2[2])) body = `${h1[0]} half ${qs[h1[1]]}`;
        else if (half(h2[1], h2[2]) && empty(h1[1], h1[2])) body = `${h2[0]} half ${qs[h2[1]]}`;
        else if (half(h1[1], h1[2]) && half(h2[1], h2[2])) body = `${h1[0]} ${qs[h1[1]]} · ${h2[0]} ${qs[h2[1]]}`;
        if (body) break;
      }
      if (!body) body = ['TL', 'TR', 'BR', 'BL'].map((n, i) => `${n} ${qs[i]}`).join(' · ');
    }
    return cake.layers.length > 1 ? `Layer ${i + 1}: ${body}` : body;
  });
  return parts.join(' · ');
}
