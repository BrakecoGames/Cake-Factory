/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Delivery Station: accepts any cake from any side and asks the simulation's
 * delivery validator (set by the gameplay layer) whether it matches an order.
 * Rejected cakes are binned with visible feedback – never silently.
 */
import { Machine, STATUS } from './Machine.js';

export class DeliveryStation extends Machine {
  constructor(id, x, y, rot) {
    super(id, 'delivery', x, y, rot);
    this.acceptedTotal = 0;
    this.rejectedTotal = 0;
    this.flash = 0; // seconds of "activity" for the renderer
  }

  canAccept() { return true; }

  accept(cake, portIndex, sim) {
    const port = this.inputs[portIndex];
    const result = sim.validateDelivery(cake, this);
    if (result.accepted) this.acceptedTotal++; else this.rejectedTotal++;
    this.lastCake = cake;
    this.lastAccepted = !!result.accepted;
    this.status = STATUS.WORKING;
    this.flash = 0.6;
    sim.emit({
      type: 'delivered',
      machineId: this.id,
      cake,
      accepted: result.accepted,
      reward: result.reward ?? 0,
      reason: result.reason ?? null,
      x: port ? port.x : this.x,
      y: port ? port.y : this.y,
    });
  }

  update(dt) {
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt);
      if (this.flash === 0) this.status = STATUS.IDLE;
    }
  }

  serializeState() { return { acceptedTotal: this.acceptedTotal, rejectedTotal: this.rejectedTotal }; }
  loadState(s) {
    if (!s) return;
    this.acceptedTotal = s.acceptedTotal | 0;
    this.rejectedTotal = s.rejectedTotal | 0;
  }
}
