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
    this.musicLevel = 0.5;
    this._last = {};
    this._music = null; // { bus, filter, timer, next, step }
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
  _applyVolume() {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume * 0.5;
    if (this._music) this._music.bus.gain.value = this.musicLevel * 0.6;
  }

  setMusic(level) { this.musicLevel = Math.max(0, Math.min(1, level)); this._applyVolume(); }

  // ------------------------------------------------------------- music
  /**
   * Gentle procedural music-box loop (no audio files): I–vi–IV–V in C,
   * 92 bpm, soft bass + arpeggio + an 8-bar pentatonic melody. Scheduled
   * slightly ahead on the audio clock, so timing never depends on frame rate.
   */
  startMusic() {
    const c = this.ctx;
    if (!c || this._music) return;
    const bus = c.createGain();
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 2400; filter.Q.value = 0.3;
    bus.connect(filter); filter.connect(this.master);
    this._music = { bus, filter, next: c.currentTime + 0.15, step: 0, timer: 0 };
    this._applyVolume();
    this._music.timer = setInterval(() => this._scheduleMusic(), 120);
    this._scheduleMusic();
  }

  stopMusic() {
    if (!this._music) return;
    clearInterval(this._music.timer);
    try { this._music.filter.disconnect(); } catch { /* ignore */ }
    this._music = null;
  }

  _mnote(freq, t, dur, vol, type = 'sine') {
    const c = this.ctx, m = this._music;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(m.bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  _scheduleMusic() {
    const c = this.ctx, m = this._music;
    if (!c || !m || c.state !== 'running') { if (m && c) m.next = Math.max(m.next, c.currentTime + 0.1); return; }
    const E = 60 / 92 / 2; // eighth note
    const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
    // Chords as MIDI notes (C, Am, F, G), two bars each round of 8 bars.
    const CHORDS = [[48, 60, 64, 67], [45, 57, 60, 64], [41, 57, 60, 65], [43, 55, 59, 62]];
    const MELODY = [ // 8 bars × 8 eighths, 0 = rest (C-major pentatonic)
      76, 0, 79, 0, 76, 74, 72, 0, 72, 0, 74, 76, 0, 0, 0, 0,
      77, 0, 76, 0, 74, 0, 72, 0, 74, 0, 0, 72, 74, 0, 0, 0,
      76, 0, 79, 0, 81, 0, 79, 76, 72, 0, 74, 0, 76, 0, 0, 0,
      77, 76, 74, 0, 72, 0, 74, 0, 71, 0, 72, 0, 74, 0, 0, 0,
    ];
    if (m.next < c.currentTime) m.next = c.currentTime + 0.05; // after a suspend
    while (m.next < c.currentTime + 0.5) {
      const t = m.next, step = m.step;
      const bar = Math.floor(step / 8) % 8, e = step % 8;
      const ch = CHORDS[Math.floor(bar / 2) % 4];
      if (e === 0 || e === 4) this._mnote(hz(ch[0]), t, E * 3.5, 0.22, 'sine');
      // Soft arpeggio on every eighth.
      this._mnote(hz(ch[1 + (e % 3)] + 12), t, E * 1.6, 0.05, 'triangle');
      const mel = MELODY[(bar * 8 + e) % MELODY.length];
      if (mel) this._mnote(hz(mel), t, E * 2.8, 0.11, 'sine');
      m.next += E; m.step++;
    }
  }

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
