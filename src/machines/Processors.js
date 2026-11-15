/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Processing machines (Phase 2): Froster, Cutter, Rotator, Combiner, Trash.
 *
 * Each processor has its own short conveyor (def.paths). A cake that enters
 * rides its input path to the stage in the middle, stops there while it is
 * processed, and the results ride their output paths to the exits.
 *
 * Processor cycle (deterministic):
 *   1. Move cakes along the internal paths (belt speed). Waiting inputs stop
 *      short of the stage while it is busy.
 *   2. Push finished pieces that reached their exit (backpressure-aware).
 *   3. While working, advance the timer; at the end produce outputs at the stage.
 *   4. When idle, every output slot is empty and every input has arrived at
 *      the stage, take the inputs and start working.
 * A machine never starts while any output is still inside it (no overproduction).
 */
import { Machine, STATUS } from './Machine.js';
import { rotateCW, rotateCCW, rotate180, cutHalves, combine, frost } from '../cakes/CakeOperations.js';
import { isValidCakeData } from '../cakes/CakeModel.js';
import { serializeCake, deserializeCake } from '../cakes/CakeSerializer.js';
import { pathLength } from './Paths.js';
import { BELT } from '../core/Config.js';

const ser = (c) => (c ? serializeCake(c) : null);
const des = (c) => (c ? deserializeCake(c) : null);

export class Processor extends Machine {
  constructor(id, type, x, y, rot) {
    super(id, type, x, y, rot);
    this.nIn = Math.max(0, ...this.def.inputs.map((p) => p.slot + 1));
    this.nOut = Math.max(0, ...this.def.outputs.map((p) => p.slot + 1));
    this.inSlots = new Array(this.nIn).fill(null);
    this.outSlots = new Array(this.nOut).fill(null);
    /** 0..1 progress of each cake along its internal input / output path. */
    this.inProg = new Array(this.nIn).fill(0);
    this.outProg = new Array(this.nOut).fill(0);
    const paths = this.def.paths || { in: [], out: [] };
    this.inLen = Array.from({ length: this.nIn }, (_, i) => (paths.in[i] ? pathLength(paths.in[i]) : 0.5));
    this.outLen = Array.from({ length: this.nOut }, (_, i) => (paths.out[i] ? pathLength(paths.out[i]) : 0.5));
    this.current = null;   // inputs being processed
    this.working = false;
    this.timer = 0;
    this.processedTotal = 0;
    this.refusedAt = -1;
    this.refuseReason = null;
  }

  get processTime() { return this.def.processTime / this.speedMult; }
  get progress() { return this.working ? Math.min(1, this.timer / this.processTime) : 0; }

  /** Subclasses: return an array with one entry (cake|null) per output slot. */
  process(_inputs) { return []; }
  /** Subclasses may refuse a piece (e.g. combiner overlap). Return a reason string or null. */
  refuse(_cake, _slot) { return null; }

  canAccept(cake, portIndex) {
    const slot = this.inputs[portIndex]?.slot ?? 0;
    if (this.inSlots[slot] !== null) return false;
    const why = this.refuse(cake, slot);
    if (why) { this.refuseReason = why; this.refusedAt = this._now ?? 0; return false; }
    return true;
  }

  accept(cake, portIndex) {
    const slot = this.inputs[portIndex]?.slot ?? 0;
    this.inSlots[slot] = cake;
    this.inProg[slot] = 0;
  }

  _pushOutputs(sim) {
    for (const port of this.outputs) {
      const c = this.outSlots[port.slot];
      if (c && this.outProg[port.slot] >= 1 && sim.tryOutput(this, port, c)) this.outSlots[port.slot] = null;
    }
  }

  _moveInternal(dt, sim) {
    const step = (sim?.beltSpeed ?? BELT.SPEED) * dt;
    for (let i = 0; i < this.nIn; i++) {
      if (!this.inSlots[i]) continue;
      // While the stage is busy, a waiting cake keeps its distance.
      const cap = this.working ? Math.max(0, 1 - BELT.MIN_SPACING / this.inLen[i]) : 1;
      this.inProg[i] = Math.max(this.inProg[i], Math.min(cap, this.inProg[i] + step / this.inLen[i]));
    }
    for (let i = 0; i < this.nOut; i++) {
      if (this.outSlots[i]) this.outProg[i] = Math.min(1, this.outProg[i] + step / this.outLen[i]);
    }
  }

  update(dt, sim) {
    this._now = sim.time;
    this._moveInternal(dt, sim);
    this._pushOutputs(sim);

    if (this.working) {
      this.timer += dt;
      if (this.timer >= this.processTime) {
        const results = this.process(this.current);
        this.working = false;
        this.timer = 0;
        this.current = null;
        for (let i = 0; i < this.nOut; i++) {
          const r = results[i] ?? null;
          if (r && !isValidCakeData(r)) { sim.emit({ type: 'machineError', machineId: this.id, reason: 'invalid result' }); continue; }
          this.outSlots[i] = r;
          this.outProg[i] = 0;
        }
        this.processedTotal++;
        sim.emit({ type: 'processed', machineId: this.id });
        this._pushOutputs(sim);
      }
    }

    const outsEmpty = this.outSlots.every((c) => c === null);
    if (!this.working && outsEmpty && this.nIn > 0 && this.inSlots.every((c) => c !== null) && this.inProg.every((p) => p >= 1)) {
      this.current = this.inSlots.slice();
      this.inSlots.fill(null);
      this.working = true;
      this.timer = 0;
    }

    // Status for the UI.
    const outMoving = this.outSlots.some((c, i) => c && this.outProg[i] < 1);
    const inMoving = this.inSlots.some((c, i) => c && this.inProg[i] < 1);
    if (this.working || outMoving || (inMoving && outsEmpty)) { this.status = STATUS.WORKING; this.blockedTime = 0; }
    else if (!outsEmpty) {
      const port = this.outputs.find((p) => this.outSlots[p.slot]);
      this.status = port && sim.hasReceiver(port) ? STATUS.BLOCKED : STATUS.NO_OUTPUT;
      this.blockedTime += dt;
    } else if (sim.time - this.refusedAt < 0.5 && this.refusedAt >= 0) {
      this.status = STATUS.INCOMPATIBLE;
      this.blockedTime += dt;
    } else { this.status = STATUS.IDLE; this.blockedTime = 0; }
  }

  heldCakes() {
    return [...this.inSlots, ...(this.current || []), ...this.outSlots].filter(Boolean);
  }

  serializeState() {
    return {
      in: this.inSlots.map(ser), out: this.outSlots.map(ser), cur: this.current ? this.current.map(ser) : null,
      inP: this.inProg.slice(), outP: this.outProg.slice(),
      timer: this.timer, working: this.working, total: this.processedTotal,
    };
  }

  loadState(s) {
    if (!s) return;
    const fill = (arr, n) => Array.from({ length: n }, (_, i) => (Array.isArray(arr) ? des(arr[i]) : null));
    this.inSlots = fill(s.in, this.nIn);
    this.outSlots = fill(s.out, this.nOut);
    const cur = Array.isArray(s.cur) ? fill(s.cur, this.nIn) : null;
    // Only resume work when every input of the cycle survived validation.
    this.working = !!s.working && !!cur && cur.every(Boolean);
    this.current = this.working ? cur : null;
    if (!this.working && cur) {
      // Return surviving inputs to their slots instead of losing them.
      cur.forEach((c, i) => { if (c && !this.inSlots[i]) this.inSlots[i] = c; });
    }
    this.timer = this.working && Number.isFinite(s.timer) ? Math.max(0, Math.min(s.timer, this.processTime)) : 0;
    this.processedTotal = s.total | 0;
    // Older saves have no internal progress: treat waiting cakes as arrived / at the exit.
    const prog = (arr, n, i) => (Array.isArray(arr) && Number.isFinite(arr[i]) ? Math.max(0, Math.min(1, arr[i])) : 1);
    this.inProg = Array.from({ length: this.nIn }, (_, i) => prog(s.inP, this.nIn, i));
    this.outProg = Array.from({ length: this.nOut }, (_, i) => prog(s.outP, this.nOut, i));
  }
}

export class Froster extends Processor {
  constructor(id, x, y, rot) { super(id, 'froster', x, y, rot); }
  /** Frosts the top layer; from level 3 only the quadrants enabled in `mask`. */
  process([c]) {
    const mask = this.config.mask || [true, true, true, true];
    const quads = [0, 1, 2, 3].filter((i) => mask[i]);
    return [frost(c, this.config.color, quads)];
  }
}

export class Cutter extends Processor {
  constructor(id, x, y, rot) { super(id, 'cutter', x, y, rot); }
  /** [left half (TL,BL), right half (TR,BR)] – an empty half becomes null. */
  process([c]) { return cutHalves(c); }
}

export class Rotator extends Processor {
  constructor(id, x, y, rot) { super(id, 'rotator', x, y, rot); }
  process([c]) {
    const m = this.config.mode;
    return [m === 'ccw' ? rotateCCW(c) : m === '180' ? rotate180(c) : rotateCW(c)];
  }
}

export class Combiner extends Processor {
  constructor(id, x, y, rot) { super(id, 'combiner', x, y, rot); }
  refuse(cake, slot) {
    const other = this.inSlots[1 - slot];
    if (!other) return null;
    const r = combine(other, cake);
    return r.ok ? null : r.reason;
  }
  process([a, b]) {
    const r = combine(a, b);
    // refuse() guarantees compatibility; this is a safety net.
    return r.ok ? [r.cake] : [a];
  }
}

export class TrashBin extends Machine {
  constructor(id, x, y, rot) {
    super(id, 'trash', x, y, rot);
    this.trashedTotal = 0;
    this.flash = 0;
  }
  canAccept() { return true; }
  accept(cake, portIndex, sim) {
    this.trashedTotal++;
    this.flash = 0.4;
    this.status = STATUS.WORKING;
    const p = this.inputs[portIndex];
    sim.emit({ type: 'trashed', machineId: this.id, cake, x: (p ? p.x : this.x) + 0.5, y: (p ? p.y : this.y) + 0.5 });
  }
  update(dt) {
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt); if (!this.flash) this.status = STATUS.IDLE; }
  }
  serializeState() { return { total: this.trashedTotal }; }
  loadState(s) { if (s) this.trashedTotal = s.total | 0; }
}
