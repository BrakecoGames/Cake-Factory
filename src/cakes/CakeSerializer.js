/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Deterministic cake identity.
 *
 * Key format: layers bottom→top joined by "/", each layer is 4 quadrants
 * (TL,TR,BR,BL) joined by ",". A quadrant is "-" when empty, otherwise
 * "flavor:frosting:decoration" with "_" for missing frosting/decoration.
 *
 * Example – plain vanilla cake: "vanilla:_:_,vanilla:_:_,vanilla:_:_,vanilla:_:_"
 *
 * The runtime `id` is never part of the key, so two independently produced
 * cakes with identical composition share the same key.
 */
import { isValidCakeData, makeCake } from './CakeModel.js';

export function pieceKey(p) {
  if (!p) return '-';
  return `${p.flavor}:${p.frosting ?? '_'}:${p.decoration ?? '_'}`;
}

export function cakeKey(cake) {
  return cake.layers.map((l) => l.quadrants.map(pieceKey).join(',')).join('/');
}

export function cakesEqual(a, b) {
  return cakeKey(a) === cakeKey(b);
}

/** Small stable 32-bit FNV-1a hash of the key, handy for compact lookups. */
export function cakeHash(cake) {
  const key = cakeKey(cake);
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function parseCakeKey(key) {
  const layers = key.split('/').map((ls) => {
    const qs = ls.split(',');
    if (qs.length !== 4) throw new Error(`Bad cake key layer: ${ls}`);
    return qs.map((q) => {
      if (q === '-') return null;
      const [flavor, frosting, decoration] = q.split(':');
      return { flavor, frosting: frosting === '_' ? null : frosting, decoration: decoration === '_' ? null : decoration };
    });
  });
  const cake = makeCake(layers);
  if (!isValidCakeData(cake)) throw new Error(`Invalid cake key: ${key}`);
  return cake;
}

/** Plain JSON form for saves (layers only, no runtime id). */
export function serializeCake(cake) {
  return { layers: cake.layers.map((l) => ({ quadrants: l.quadrants.map((p) => (p ? { ...p } : null)) })) };
}

export function deserializeCake(data) {
  if (!isValidCakeData(data)) return null;
  return makeCake(data.layers.map((l) => l.quadrants.map((p) => (p ? {
    flavor: p.flavor, frosting: p.frosting ?? null, decoration: p.decoration ?? null,
  } : null))));
}
