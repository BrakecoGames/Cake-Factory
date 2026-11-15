// Cake Factory – Sweet Automation · © 2026 Brakeco Games
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCake, makePiece, makeWholeCake, isValidCakeData } from '../src/cakes/CakeModel.js';
import { rotateCW, rotateCCW, rotate180, cutHalves, cutQuarters, combine, stack, frost, decorate } from '../src/cakes/CakeOperations.js';
import { cakeKey, cakesEqual, cakeHash, parseCakeKey, serializeCake, deserializeCake } from '../src/cakes/CakeSerializer.js';

const V = makePiece('vanilla'), C = makePiece('chocolate'), S = makePiece('strawberry'), L = makePiece('lemon');
const four = () => makeCake([[V, C, S, L]]);
const flav = (cake, layer = 0) => cake.layers[layer].quadrants.map((p) => (p ? p.flavor : null));

test('rotate clockwise moves TL→TR→BR→BL→TL', () => {
  assert.deepEqual(flav(rotateCW(four())), ['lemon', 'vanilla', 'chocolate', 'strawberry']);
});

test('rotate CCW is inverse of CW; 4×CW is identity; 180 = 2×CW', () => {
  const c = four();
  assert.ok(cakesEqual(rotateCCW(rotateCW(c)), c));
  assert.ok(cakesEqual(rotateCW(rotateCW(rotateCW(rotateCW(c)))), c));
  assert.ok(cakesEqual(rotate180(c), rotateCW(rotateCW(c))));
  assert.deepEqual(flav(rotate180(c)), ['strawberry', 'lemon', 'vanilla', 'chocolate']);
});

test('operations never mutate inputs', () => {
  const c = four();
  const before = cakeKey(c);
  rotateCW(c); cutHalves(c); frost(c, 'pink'); decorate(c, 'cherry');
  assert.equal(cakeKey(c), before);
});

test('cutHalves: [left (TL,BL), right (TR,BR)]', () => {
  const [left, right] = cutHalves(four());
  assert.deepEqual(flav(left), ['vanilla', null, null, 'lemon']);
  assert.deepEqual(flav(right), [null, 'chocolate', 'strawberry', null]);
});

test('cutting an already-cut half returns null for the empty side', () => {
  const [left] = cutHalves(four());
  const [l2, r2] = cutHalves(left);
  assert.ok(l2);
  assert.equal(r2, null);
});

test('cutQuarters returns one piece per quadrant in quadrant order', () => {
  const qs = cutQuarters(four());
  assert.deepEqual(qs.map((q) => flav(q).filter(Boolean)[0]), ['vanilla', 'chocolate', 'strawberry', 'lemon']);
});

test('combine halves back into the original cake', () => {
  const c = four();
  const [l, r] = cutHalves(c);
  const res = combine(l, r);
  assert.ok(res.ok);
  assert.ok(cakesEqual(res.cake, c));
});

test('combine rejects overlap and mismatched layer counts', () => {
  assert.equal(combine(four(), four()).ok, false);
  const two = stack(four(), four()).cake;
  const [l] = cutHalves(four());
  assert.equal(combine(two, l).ok, false);
});

test('stack keeps bottom→top order and enforces the layer limit', () => {
  const bottom = makeWholeCake('chocolate');
  const top = makeWholeCake('vanilla');
  const res = stack(bottom, top);
  assert.ok(res.ok);
  assert.equal(res.cake.layers.length, 2);
  assert.equal(res.cake.layers[0].quadrants[0].flavor, 'chocolate');
  assert.equal(res.cake.layers[1].quadrants[0].flavor, 'vanilla');
  assert.equal(stack(res.cake, res.cake, 3).ok, false);
});

test('frost only affects filled quadrants of the top layer', () => {
  const [left] = cutHalves(four());
  const f = frost(left, 'pink');
  assert.deepEqual(f.layers[0].quadrants.map((p) => p && p.frosting), ['pink', null, null, 'pink']);
});

test('cake identity ignores runtime ids and is deterministic', () => {
  const a = makeWholeCake('vanilla'), b = makeWholeCake('vanilla');
  assert.notEqual(a.id, b.id);
  assert.ok(cakesEqual(a, b));
  assert.equal(cakeHash(a), cakeHash(b));
  assert.equal(cakeKey(a), 'vanilla:_:_,vanilla:_:_,vanilla:_:_,vanilla:_:_');
  assert.ok(!cakesEqual(a, frost(a, 'pink')));
  assert.ok(!cakesEqual(a, rotateCW(four())));
});

test('key parse + JSON serialization round-trip', () => {
  const c = decorate(frost(four(), 'blue', [0, 2]), 'cherry', [1]);
  assert.ok(cakesEqual(parseCakeKey(cakeKey(c)), c));
  assert.ok(cakesEqual(deserializeCake(JSON.parse(JSON.stringify(serializeCake(c)))), c));
});

test('invalid cake data is rejected', () => {
  assert.equal(isValidCakeData(null), false);
  assert.equal(isValidCakeData({ layers: [{ quadrants: [null, null, null] }] }), false);
  assert.equal(isValidCakeData({ layers: [{ quadrants: [null, null, null, null] }] }), false);
  assert.equal(isValidCakeData({ layers: [{ quadrants: [{ flavor: 'pizza' }, null, null, null] }] }), false);
  assert.equal(deserializeCake({ layers: [] }), null);
});
