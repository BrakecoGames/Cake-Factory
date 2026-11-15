/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Fixed-timestep loop with interpolated rendering.
 * - Simulation runs at SIM.TICK_RATE regardless of frame rate.
 * - At most MAX_TICKS_PER_FRAME ticks per frame; excess time is dropped so a
 *   long stall (tab switch, GC) never fast-forwards or freezes the game.
 */
import { SIM } from './Config.js';

export class GameLoop {
  constructor({ update, render }) {
    this.update = update;
    this.render = render;
    this.acc = 0;
    this.last = 0;
    this.running = false;
    this.paused = false;
    this.simMs = 0; // last frame's simulation cost (diagnostics)
    this._frame = this._frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._frame);
  }

  stop() { this.running = false; }

  _frame(now) {
    if (!this.running) return;
    let frameDt = (now - this.last) / 1000;
    this.last = now;
    if (frameDt > 0.25) frameDt = 0.25; // tab was hidden or a long stall

    if (!this.paused) {
      this.acc += frameDt;
      const t0 = performance.now();
      let ticks = 0;
      while (this.acc >= SIM.DT && ticks < SIM.MAX_TICKS_PER_FRAME) {
        this.update(SIM.DT);
        this.acc -= SIM.DT;
        ticks++;
      }
      if (ticks === SIM.MAX_TICKS_PER_FRAME) this.acc = 0;
      this.simMs = performance.now() - t0;
    }
    const alpha = this.paused ? 1 : this.acc / SIM.DT;
    this.render(frameDt, alpha);
    requestAnimationFrame(this._frame);
  }
}
