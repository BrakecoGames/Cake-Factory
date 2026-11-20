/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Deterministic, fixed-timestep factory simulation. Knows nothing about
 * Three.js or the DOM; the renderer only READS this state.
 *
 * Belt rules
 *  - Each belt cell holds at most ONE cake (no overlap, no duplication).
 *  - A cake's `progress` runs 0→1 through the cell: 0 = entry edge,
 *    0.5 = centre, 1 = exit edge (the side the belt points to).
 *  - A cake may only advance while it keeps MIN_SPACING to the cake ahead.
 *  - At progress 1 it hands off to the next cell: a belt that does not point
 *    back at us and is empty, or a machine input port facing us. Otherwise it
 *    waits (backpressure) and the belt is marked blocked after a short while.
 *  - Belts update downstream-first each tick so dense lines flow without
 *    gaps; a per-item `lastTick` guarantees no cake moves twice in one tick.
 */
import { SIM, BELT } from '../core/Config.js';
import { Grid, DX, DY, opposite } from './Grid.js';
import { getDef } from '../machines/MachineDefs.js';
import { Machine, STATUS } from '../machines/Machine.js';
import { Oven } from '../machines/Oven.js';
import { DeliveryStation } from '../machines/DeliveryStation.js';
import { Froster, Cutter, Rotator, Combiner, Stacker, Decorator, TrashBin } from '../machines/Processors.js';
import { serializeCake, deserializeCake } from '../cakes/CakeSerializer.js';

const MACHINE_CLASSES = { oven: Oven, delivery: DeliveryStation, froster: Froster, cutter: Cutter, rotator: Rotator, combiner: Combiner, stacker: Stacker, decorator: Decorator, trash: TrashBin };

let nextItemId = 1;

export class Belt {
  constructor(id, x, y, dir) {
    this.id = id;
    this.kind = 'belt';
    this.type = 'belt';
    this.def = getDef('belt');
    this.x = x;
    this.y = y;
    this.dir = dir & 3;
    /** @type {null|{id:number,cake:object,progress:number,inDir:number,lastTick:number,x:number,y:number,px:number,py:number}} */
    this.item = null;
    this.waitTicks = 0;
  }
  get rot() { return this.dir; }
  cells() { return [[this.x, this.y]]; }
  get blocked() { return this.waitTicks > SIM.TICK_RATE * 0.75; }
}

export class FactorySimulation {
  constructor(width, height) {
    this.grid = new Grid(width, height);
    /** @type {Map<number, Belt|Machine>} */
    this.entities = new Map();
    this.nextId = 1;
    this.tick = 0;
    this.time = 0;
    this.events = [];
    this.beltOrder = [];
    this.orderDirty = true;
    /** Injected by the gameplay layer. Must return { accepted, reward?, reason? }. */
    this.deliveryValidator = () => ({ accepted: false, reason: 'No active order' });
    this.listeners = [];
    /** Cells per second for belts and machine belts (raised by the global upgrade). */
    this.beltSpeed = BELT.SPEED;
  }

  get width() { return this.grid.width; }
  get height() { return this.grid.height; }

  // ---------------------------------------------------------------- events
  emit(ev) { this.events.push(ev); }
  drainEvents() { const e = this.events; this.events = []; return e; }
  validateDelivery(cake, station) { return this.deliveryValidator(cake, station); }

  // ---------------------------------------------------------------- queries
  entityAt(x, y) {
    const id = this.grid.get(x, y);
    return id > 0 ? this.entities.get(id) : null;
  }

  counts() {
    let belts = 0, machines = 0, items = 0;
    for (const e of this.entities.values()) {
      if (e.kind === 'belt') { belts++; if (e.item) items++; }
      else { machines++; items += e.heldCakes().length; }
    }
    return { belts, machines, items };
  }

  // ------------------------------------------------------------- placement
  /** Validates a placement. `ignoreId` lets an entity overlap itself (rotate / move). */
  /**
   * Validates a placement. `ignoreId` lets an entity overlap itself (rotate / move).
   * With `opts.replaceBelts` a machine may cover belts; their ids are returned in `belts`.
   */
  canPlace(type, x, y, rot, ignoreId = 0, opts = {}) {
    const def = getDef(type);
    const cells = type === 'belt' ? [[x, y]] : Machine.footprint(def, x, y, rot);
    const belts = [];
    for (const [cx, cy] of cells) {
      if (!this.grid.inBounds(cx, cy)) return { ok: false, reason: 'Outside the factory' };
      const occ = this.grid.get(cx, cy);
      if (occ === 0 || occ === ignoreId) continue;
      const e = this.entities.get(occ);
      if (opts.replaceBelts && type !== 'belt' && e && e.kind === 'belt') { belts.push(occ); continue; }
      return { ok: false, reason: 'Space is occupied' };
    }
    return { ok: true, belts };
  }

  /** Removes belts that a machine is about to cover. Returns their cakes (not yet lost). */
  _liftBelts(ids) {
    const items = [];
    for (const id of ids) {
      const b = this.entities.get(id);
      if (!b || b.kind !== 'belt') continue;
      this._vacate(b);
      this.entities.delete(id);
      if (b.item) items.push({ cake: b.item.cake, x: b.x, y: b.y, dir: b.dir, wx: b.item.x, wy: b.item.y });
    }
    if (ids.length) this.orderDirty = true;
    return items;
  }

  /**
   * Cakes that sat on replaced belts go into the new machine when it has a
   * free, matching input on that cell; otherwise they are discarded with an
   * explicit itemDestroyed event (never silently).
   */
  _rehome(machine, items) {
    let rescued = 0;
    for (const it of items) {
      let pi = machine.kind === 'machine' ? machine.inputPortAt(it.x, it.y, opposite(it.dir)) : -1;
      if (pi < 0 && machine.kind === 'machine') pi = machine.inputs.findIndex((p) => p.x === it.x && p.y === it.y);
      if (pi >= 0 && machine.canAccept(it.cake, pi)) { machine.accept(it.cake, pi, this); rescued++; continue; }
      this.emit({ type: 'itemDestroyed', cake: it.cake, x: it.wx, y: it.wy, reason: 'covered' });
    }
    return rescued;
  }

  /** Place a machine, replacing any belts under its footprint. */
  placeReplacingBelts(type, x, y, rot = 0) {
    const can = this.canPlace(type, x, y, rot, 0, { replaceBelts: true });
    if (!can.ok) return null;
    const removed = can.belts.map((id) => this.entities.get(id));
    const items = this._liftBelts(can.belts);
    const e = this.place(type, x, y, rot);
    const rescued = this._rehome(e, items);
    return { entity: e, removed, rescued, lost: items.length - rescued };
  }

  _occupy(entity) {
    for (const [cx, cy] of entity.cells()) this.grid.set(cx, cy, entity.id);
  }
  _vacate(entity) {
    for (const [cx, cy] of entity.cells()) {
      if (this.grid.get(cx, cy) === entity.id) this.grid.set(cx, cy, 0);
    }
  }

  /** Create and place an entity. Returns the entity or null if invalid. */
  place(type, x, y, rot = 0, id = 0) {
    if (!this.canPlace(type, x, y, rot).ok) return null;
    const eid = id || this.nextId++;
    if (id && id >= this.nextId) this.nextId = id + 1;
    let e;
    if (type === 'belt') e = new Belt(eid, x, y, rot);
    else {
      const Cls = MACHINE_CLASSES[type];
      if (!Cls) throw new Error(`No machine class for ${type}`);
      e = new Cls(eid, x, y, rot);
    }
    this.entities.set(eid, e);
    this._occupy(e);
    this.orderDirty = true;
    return e;
  }

  /** Point an existing belt in a new direction (keeps the cake on it). */
  setBeltDir(id, dir) {
    const e = this.entities.get(id);
    if (!e || e.kind !== 'belt') return false;
    e.dir = dir & 3;
    e.waitTicks = 0;
    this.orderDirty = true;
    return true;
  }

  /**
   * Remove an entity. Any cakes it held are destroyed with an explicit
   * `itemDestroyed` event so the UI can show where they went.
   */
  remove(id) {
    const e = this.entities.get(id);
    if (!e) return null;
    this._vacate(e);
    this.entities.delete(id);
    this.orderDirty = true;
    const lost = e.kind === 'belt' ? (e.item ? [e.item.cake] : []) : e.heldCakes();
    for (const cake of lost) {
      const px = e.kind === 'belt' && e.item ? e.item.x : e.x + 0.5;
      const py = e.kind === 'belt' && e.item ? e.item.y : e.y + 0.5;
      this.emit({ type: 'itemDestroyed', cake, x: px, y: py, reason: 'removed' });
    }
    return { entity: e, lost };
  }

  /** Rotate in place by one clockwise quarter turn if it still fits. */
  rotate(id) {
    const e = this.entities.get(id);
    if (!e) return false;
    if (e.kind === 'belt') return this.setBeltDir(id, e.dir + 1);
    const nr = (e.rot + 1) & 3;
    if (!this.canPlace(e.type, e.x, e.y, nr, e.id).ok) return false;
    this._vacate(e);
    e.rot = nr;
    e.computePorts();
    this._occupy(e);
    this.orderDirty = true;
    return true;
  }

  /**
   * Move an existing entity (keeps its internal state and cakes).
   * Returns false and leaves it untouched if the target is invalid.
   */
  move(id, x, y, rot, opts = {}) {
    const e = this.entities.get(id);
    if (!e) return false;
    const r = rot ?? e.rot;
    const can = this.canPlace(e.type, x, y, r, e.id, opts);
    if (!can.ok) return false;
    const covered = (can.belts || []).map((bid) => this.entities.get(bid));
    const items = this._liftBelts(can.belts || []);
    this._vacate(e);
    const dx = x - e.x, dy = y - e.y;
    e.x = x; e.y = y;
    if (e.kind === 'belt') {
      e.dir = r & 3;
      if (e.item) { e.item.x += dx; e.item.y += dy; e.item.px = e.item.x; e.item.py = e.item.y; }
    } else {
      e.rot = r & 3;
      e.computePorts();
    }
    this._occupy(e);
    this.orderDirty = true;
    if (items.length) this._rehome(e, items);
    this.lastMoveReplaced = covered;
    return true;
  }

  // ------------------------------------------------------------- transfer
  /** Would a cake leaving through `port` have somewhere to go? */
  hasReceiver(port) {
    const t = this.entityAt(port.nx, port.ny);
    if (!t) return false;
    if (t.kind === 'belt') return t.dir !== opposite(port.dir);
    return t.inputPortAt(port.nx, port.ny, opposite(port.dir)) >= 0;
  }

  /**
   * Try to move `cake` out of a machine through `port`.
   * Returns true when ownership was transferred.
   */
  tryOutput(machine, port, cake) {
    const t = this.entityAt(port.nx, port.ny);
    if (!t) return false;
    if (t.kind === 'belt') {
      if (t.item || t.dir === opposite(port.dir)) return false;
      const item = {
        id: nextItemId++, cake, progress: 0, inDir: port.dir, lastTick: this.tick,
        x: 0, y: 0, px: port.x + 0.5, py: port.y + 0.5,
      };
      this._itemPos(t, item);
      t.item = item;
      return true;
    }
    const pi = t.inputPortAt(port.nx, port.ny, opposite(port.dir));
    if (pi < 0 || !t.canAccept(cake, pi)) return false;
    t.accept(cake, pi, this);
    return true;
  }

  /** Sets item.x/item.y (grid units, cell centre = +0.5) from belt + progress. */
  _itemPos(belt, item) {
    const cx = belt.x + 0.5, cy = belt.y + 0.5;
    const p = item.progress;
    if (p < 0.5) {
      const t = p * 2; // entry edge → centre
      const ex = cx - DX[item.inDir] * 0.5, ey = cy - DY[item.inDir] * 0.5;
      item.x = ex + (cx - ex) * t;
      item.y = ey + (cy - ey) * t;
    } else {
      const t = (p - 0.5) * 2; // centre → exit edge
      item.x = cx + DX[belt.dir] * 0.5 * t;
      item.y = cy + DY[belt.dir] * 0.5 * t;
    }
  }

  _rebuildOrder() {
    // Downstream-first ordering: walk each chain to its end, then emit in reverse.
    const order = [];
    const state = new Map(); // id -> 1 (on stack) | 2 (done)
    for (const e of this.entities.values()) {
      if (e.kind !== 'belt' || state.get(e.id)) continue;
      const stack = [];
      let cur = e;
      while (cur && cur.kind === 'belt' && !state.get(cur.id)) {
        state.set(cur.id, 1);
        stack.push(cur);
        cur = this.entityAt(cur.x + DX[cur.dir], cur.y + DY[cur.dir]);
      }
      for (let i = stack.length - 1; i >= 0; i--) {
        state.set(stack[i].id, 2);
        order.push(stack[i]);
      }
    }
    this.beltOrder = order;
    this.orderDirty = false;
  }

  _updateBelt(b, step) {
    const it = b.item;
    if (!it || it.lastTick === this.tick) return;
    it.lastTick = this.tick;
    it.px = it.x; it.py = it.y;

    const nx = b.x + DX[b.dir], ny = b.y + DY[b.dir];
    const next = this.entityAt(nx, ny);
    let cap = 1;
    if (next && next.kind === 'belt' && next.dir !== opposite(b.dir) && next.item) {
      cap = Math.min(1, 1 + next.item.progress - BELT.MIN_SPACING);
    }
    const want = it.progress + step;
    it.progress = Math.max(it.progress, Math.min(want, cap));

    if (it.progress >= 1) {
      // Hand off.
      if (next && next.kind === 'belt') {
        if (!next.item && next.dir !== opposite(b.dir)) {
          b.item = null;
          it.progress = Math.min(0.25, Math.max(0, want - 1));
          it.inDir = b.dir;
          next.item = it;
          this._itemPos(next, it);
          b.waitTicks = 0;
          return;
        }
      } else if (next && next.kind === 'machine') {
        const pi = next.inputPortAt(nx, ny, opposite(b.dir));
        if (pi >= 0 && next.canAccept(it.cake, pi)) {
          b.item = null;
          it.x = nx + 0.5 - DX[b.dir] * 0.35; it.y = ny + 0.5 - DY[b.dir] * 0.35;
          next.accept(it.cake, pi, this);
          b.waitTicks = 0;
          return;
        }
      }
      b.waitTicks++;
    } else if (it.progress >= want - 1e-9) {
      b.waitTicks = 0;
    } else {
      b.waitTicks++; // held back by spacing
    }
    this._itemPos(b, it);
  }

  /** Advance exactly one fixed simulation tick. */
  step() {
    const dt = SIM.DT;
    this.tick++;
    this.time += dt;
    if (this.orderDirty) this._rebuildOrder();

    const step = this.beltSpeed * dt;
    for (let i = 0; i < this.beltOrder.length; i++) this._updateBelt(this.beltOrder[i], step);

    for (const e of this.entities.values()) {
      if (e.kind === 'machine') e.update(dt, this);
    }
  }

  /**
   * Grow the factory by `d` cells on every side. All entities and cakes shift
   * by (d, d) so the layout stays intact and centred.
   */
  expand(d) {
    if (!(d > 0)) return false;
    const grid = new Grid(this.width + 2 * d, this.height + 2 * d);
    this.grid = grid;
    for (const e of this.entities.values()) {
      e.x += d; e.y += d;
      if (e.kind === 'belt') {
        if (e.item) { e.item.x += d; e.item.y += d; e.item.px += d; e.item.py += d; }
      } else e.computePorts();
      this._occupy(e);
    }
    this.orderDirty = true;
    return true;
  }

  // ------------------------------------------------------------ save/load
  serialize() {
    const entities = [];
    for (const e of this.entities.values()) {
      if (e.kind === 'belt') {
        entities.push({
          id: e.id, t: 'belt', x: e.x, y: e.y, r: e.dir,
          item: e.item ? { cake: serializeCake(e.item.cake), p: e.item.progress, d: e.item.inDir } : null,
        });
      } else {
        entities.push({ id: e.id, t: e.type, x: e.x, y: e.y, r: e.rot, lv: e.level, c: { ...e.config }, s: e.serializeState() });
      }
    }
    return { w: this.width, h: this.height, nextId: this.nextId, tick: this.tick, entities };
  }

  /**
   * Rebuilds a simulation from saved data. Invalid entries are skipped (and
   * reported) instead of aborting, so one bad entity cannot wipe a factory.
   */
  static deserialize(data) {
    const sim = new FactorySimulation(data.w, data.h);
    sim.tick = data.tick | 0;
    const problems = [];
    for (const d of data.entities || []) {
      try {
        const e = sim.place(d.t, d.x | 0, d.y | 0, d.r | 0, d.id | 0);
        if (!e) { problems.push(`Could not place ${d.t} at ${d.x},${d.y}`); continue; }
        if (e.kind === 'belt' && d.item) {
          const cake = deserializeCake(d.item.cake);
          if (cake) {
            const item = {
              id: nextItemId++, cake,
              progress: Math.max(0, Math.min(1, Number(d.item.p) || 0)),
              inDir: (d.item.d | 0) & 3, lastTick: -1, x: 0, y: 0, px: 0, py: 0,
            };
            sim._itemPos(e, item);
            item.px = item.x; item.py = item.y;
            e.item = item;
          }
        } else if (e.kind === 'machine') {
          e.level = Math.max(1, d.lv | 0);
          e.loadConfig(d.c);
          e.loadState(d.s);
        }
      } catch (err) {
        problems.push(String(err.message || err));
      }
    }
    sim.nextId = Math.max(sim.nextId, data.nextId | 0);
    return { sim, problems };
  }
}

export { STATUS };
