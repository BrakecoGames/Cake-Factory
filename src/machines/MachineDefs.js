/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Data-driven machine definitions. Footprints and ports are defined for
 * rotation 0 (machine "faces" East: cakes enter from the West, leave East).
 * Ports are { x, y, dir, slot } in local cells; `dir` is the side of that
 * cell the port opens to, `slot` the logical input/output index.
 *  - output port: items leave through `dir` into the neighbouring cell.
 *  - input port:  items arrive from the neighbouring cell on side `dir`.
 * `stage` is where the cake stops to be processed (local units).
 * `paths` are the machine's own short conveyor runs (local polylines): each
 * input slot's path ends at the stage, each output slot's path starts there.
 */
import { DIR } from '../simulation/Grid.js';
import { BELT } from '../core/Config.js';

/** Every edge cell of a w×h footprint gets an input port facing outwards. */
function perimeterInputs(w, h) {
  const ports = [];
  for (let x = 0; x < w; x++) {
    ports.push({ x, y: 0, dir: DIR.N, slot: 0 });
    ports.push({ x, y: h - 1, dir: DIR.S, slot: 0 });
  }
  for (let y = 0; y < h; y++) {
    ports.push({ x: 0, y, dir: DIR.W, slot: 0 });
    ports.push({ x: w - 1, y, dir: DIR.E, slot: 0 });
  }
  return ports;
}

export const MACHINE_DEFS = Object.freeze({
  belt: {
    type: 'belt', name: 'Conveyor Belt',
    description: 'Moves cakes one cell at a time. Drag to build a line.',
    cost: BELT.COST, w: 1, h: 1, inputs: [], outputs: [], hotkey: '1',
  },
  oven: {
    type: 'oven', name: 'Basic Oven',
    description: 'Bakes a whole cake every few seconds. Pick the flavor in its panel.',
    cost: 100, w: 1, h: 1,
    inputs: [],
    outputs: [{ x: 0, y: 0, dir: DIR.E, slot: 0 }],
    bakeTime: 2.5, bufferSize: 1,
    defaultConfig: { flavor: 'vanilla' },
    hotkey: '2',
  },
  froster: {
    type: 'froster', name: 'Frosting Machine',
    description: 'Frosts every piece of the top layer in the chosen color.',
    cost: 200, w: 1, h: 1,
    inputs: [{ x: 0, y: 0, dir: DIR.W, slot: 0 }],
    outputs: [{ x: 0, y: 0, dir: DIR.E, slot: 0 }],
    processTime: 1.0, stage: { x: 0.5, y: 0.5 },
    paths: { in: [[[0, 0.5], [0.5, 0.5]]], out: [[[0.5, 0.5], [1, 0.5]]] },
    defaultConfig: { color: 'pink', mask: [true, true, true, true] },
    hotkey: '3',
  },
  cutter: {
    type: 'cutter', name: 'Cake Cutter',
    description: 'Cuts a cake in half. Left half → left exit, right half → right exit.',
    cost: 250, w: 1, h: 2,
    inputs: [{ x: 0, y: 0, dir: DIR.W, slot: 0 }],
    // Facing East, "left" of the travel direction is North = the top cell.
    outputs: [{ x: 0, y: 0, dir: DIR.E, slot: 0 }, { x: 0, y: 1, dir: DIR.E, slot: 1 }],
    processTime: 1.2, stage: { x: 0.5, y: 0.5 },
    // Left half rides straight on; the right half is pushed down to the R exit.
    paths: { in: [[[0, 0.5], [0.5, 0.5]]], out: [[[0.5, 0.5], [1, 0.5]], [[0.5, 0.5], [0.5, 1.5], [1, 1.5]]] },
    hotkey: '4',
  },
  rotator: {
    type: 'rotator', name: 'Cake Rotator',
    description: 'Turns a cake 90° clockwise (quadrants move TL→TR→BR→BL).',
    cost: 125, w: 1, h: 1,
    inputs: [{ x: 0, y: 0, dir: DIR.W, slot: 0 }],
    outputs: [{ x: 0, y: 0, dir: DIR.E, slot: 0 }],
    processTime: 0.6, stage: { x: 0.5, y: 0.5 },
    paths: { in: [[[0, 0.5], [0.5, 0.5]]], out: [[[0.5, 0.5], [1, 0.5]]] },
    defaultConfig: { mode: 'cw' },
    hotkey: '5',
  },
  combiner: {
    type: 'combiner', name: 'Cake Combiner',
    description: 'Joins two pieces that fit together into one cake. Overlapping pieces are refused.',
    cost: 350, w: 1, h: 2,
    inputs: [{ x: 0, y: 0, dir: DIR.W, slot: 0 }, { x: 0, y: 1, dir: DIR.W, slot: 1 }],
    outputs: [{ x: 0, y: 0, dir: DIR.E, slot: 0 }],
    processTime: 1.2, stage: { x: 0.5, y: 0.5 },
    // Piece A rides straight in; piece B comes in below and is carried up to meet it.
    paths: { in: [[[0, 0.5], [0.5, 0.5]], [[0, 1.5], [0.5, 1.5], [0.5, 0.5]]], out: [[[0.5, 0.5], [1, 0.5]]] },
    hotkey: '6',
  },
  trash: {
    type: 'trash', name: 'Trash Bin',
    description: 'Throws away any cake piece you do not need. Accepts from every side.',
    cost: 20, w: 1, h: 1,
    inputs: perimeterInputs(1, 1),
    outputs: [],
    upgradable: false,
    hotkey: '7',
  },
  delivery: {
    type: 'delivery', name: 'Delivery Station',
    description: 'Ships cakes to customers. Accepts cakes from every side.',
    cost: 150, w: 2, h: 2,
    inputs: perimeterInputs(2, 2),
    outputs: [],
    upgradable: false,
    hotkey: '8',
  },
});

export const BUILDABLE_ORDER = ['belt', 'oven', 'froster', 'cutter', 'rotator', 'combiner', 'trash', 'delivery'];

/** Options a player may pick in a machine's panel (filtered by unlocks). */
export const CONFIG_OPTIONS = Object.freeze({
  oven: [{ key: 'flavor', kind: 'flavor' }],
  froster: [{ key: 'color', kind: 'frosting' }, { key: 'mask', kind: 'mask', minLevel: 3 }],
  rotator: [{ key: 'mode', kind: 'mode' }],
});

/** Minimum machine level for each rotator mode. */
export const ROTATOR_MODE_LEVEL = Object.freeze({ cw: 1, ccw: 2, '180': 3 });

export function getDef(type) {
  const d = MACHINE_DEFS[type];
  if (!d) throw new Error(`Unknown machine type: ${type}`);
  return d;
}
