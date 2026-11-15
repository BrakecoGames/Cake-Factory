/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Tiny synthesized sound effects (no audio files). The AudioContext is only
 * created/resumed after a user gesture, respecting autoplay policies.
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.7;
    this.muted = false;
    this._last = {};
  }

  /** Call from a user gesture (click/tap/key). Safe to call repeatedly. */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this._applyVolume();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch { /* audio unavailable – the game stays fully playable */ }
  }

  suspend() { try { this.ctx?.suspend(); } catch { /* ignore */ } }
  resume() { try { if (this.ctx?.state === 'suspended') this.ctx.resume(); } catch { /* ignore */ } }

  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); this._applyVolume(); }
  setMuted(m) { this.muted = !!m; this._applyVolume(); }
  _applyVolume() { if (this.master) this.master.gain.value = this.muted ? 0 : this.volume * 0.5; }

  _tone(freq, dur, { type = 'sine', vol = 0.4, slide = 0, delay = 0 } = {}) {
    const c = this.ctx;
    if (!c || c.state !== 'running' || this.muted) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  /** Rate-limit repeated sounds so a busy factory never becomes noise. */
  _ok(name, gap) {
    const now = performance.now();
    if (now - (this._last[name] || 0) < gap) return false;
    this._last[name] = now;
    return true;
  }

  play(name) {
    switch (name) {
      case 'place': this._tone(520, 0.09, { type: 'triangle', slide: 260 }); break;
      case 'belt': if (this._ok('belt', 40)) this._tone(760, 0.04, { type: 'triangle', vol: 0.18 }); break;
      case 'remove': this._tone(300, 0.12, { type: 'triangle', slide: -150 }); break;
      case 'rotate': this._tone(640, 0.06, { type: 'triangle', vol: 0.25 }); break;
      case 'invalid': if (this._ok('invalid', 150)) this._tone(150, 0.16, { type: 'square', vol: 0.12, slide: -40 }); break;
      case 'deliver': if (this._ok('deliver', 90)) { this._tone(880, 0.1, { vol: 0.25 }); this._tone(1320, 0.14, { vol: 0.2, delay: 0.06 }); } break;
      case 'reject': if (this._ok('reject', 200)) this._tone(220, 0.2, { type: 'sawtooth', vol: 0.1, slide: -80 }); break;
      case 'complete': [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.22, { type: 'triangle', vol: 0.3, delay: i * 0.09 })); break;
      case 'upgrade': [660, 880, 1175].forEach((f, i) => this._tone(f, 0.14, { type: 'triangle', vol: 0.28, delay: i * 0.06 })); break;
      case 'bell': this._tone(1568, 0.5, { type: 'sine', vol: 0.22 }); this._tone(2093, 0.6, { type: 'sine', vol: 0.12, delay: 0.02 }); break;
      case 'click': this._tone(1000, 0.03, { type: 'sine', vol: 0.12 }); break;
      case 'bake': if (this._ok('bake', 400)) this._tone(420, 0.05, { type: 'sine', vol: 0.05 }); break;
      default: break;
    }
  }
}
