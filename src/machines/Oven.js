/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Basic Oven: bakes whole cakes and pushes them out of its front port.
 * It never bakes while its output buffer is full (no production when blocked).
 */
import { Machine, STATUS } from './Machine.js';
import { makeWholeCake } from '../cakes/CakeModel.js';
import { serializeCake, deserializeCake } from '../cakes/CakeSerializer.js';
import { UPGRADES } from '../core/Config.js';

export class Oven extends Machine {
  constructor(id, x, y, rot) {
    super(id, 'oven', x, y, rot);
    this.timer = 0;
    this.buffer = [];
    this.producedTotal = 0;
  }

  get bakeTime() { return this.def.bakeTime / this.speedMult; }
  get bufferSize() { return UPGRADES.OVEN_BUFFER[this.level - 1] ?? this.def.bufferSize; }
  /** 0..1 progress of the current bake – used by the renderer. */
  get progress() { return this.buffer.length >= this.bufferSize ? 1 : this.timer / this.bakeTime; }

  update(dt, sim) {
    // 1) Try to push a finished cake out.
    if (this.buffer.length > 0) {
      const out = this.outputs[0];
      if (sim.tryOutput(this, out, this.buffer[0])) {
        this.buffer.shift();
      }
    }

    // 2) Bake only while there is room in the buffer.
    if (this.buffer.length < this.bufferSize) {
      this.timer += dt;
      this.status = STATUS.WORKING;
      if (this.timer >= this.bakeTime) {
        this.timer -= this.bakeTime;
        const cake = makeWholeCake(this.config.flavor);
        this.buffer.push(cake);
        this.producedTotal++;
        sim.emit({ type: 'produced', machineId: this.id, cake });
        // Immediately try to output so a free line has no extra delay.
        if (sim.tryOutput(this, this.outputs[0], cake)) this.buffer.shift();
      }
      this.blockedTime = 0;
    } else {
      this.timer = 0;
      const out = this.outputs[0];
      this.status = sim.hasReceiver(out) ? STATUS.BLOCKED : STATUS.NO_OUTPUT;
      this.blockedTime += dt;
    }
  }

  heldCakes() { return this.buffer.slice(); }

  serializeState() {
    return { timer: this.timer, buffer: this.buffer.map(serializeCake), producedTotal: this.producedTotal };
  }

  loadState(s) {
    if (!s) return;
    this.timer = Number.isFinite(s.timer) ? Math.max(0, Math.min(s.timer, this.bakeTime)) : 0;
    this.buffer = Array.isArray(s.buffer)
      ? s.buffer.map(deserializeCake).filter(Boolean).slice(0, this.bufferSize)
      : [];
    this.producedTotal = Number.isFinite(s.producedTotal) ? s.producedTotal : 0;
  }
}
