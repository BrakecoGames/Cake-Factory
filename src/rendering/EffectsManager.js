/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Pooled sprite particles (steam, sparkles, poofs). Particle counts are
 * capped and scaled by the quality level.
 */
import * as THREE from 'three';
import { textures } from './ModelFactory.js';

const MAX = 160;

export class EffectsManager {
  constructor(scene) {
    this.scene = scene;
    this.scale = 1;
    this.pool = [];
    this.live = [];
    const tex = textures().soft;
    for (let i = 0; i < MAX; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      s.visible = false;
      s.renderOrder = 5;
      scene.add(s);
      this.pool.push({ s, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size0: 0.2, size1: 0.5, a0: 0.8 });
    }
  }

  _spawn(x, y, z, o) {
    const p = this.pool.pop();
    if (!p) return;
    Object.assign(p, o);
    p.life = 0;
    p.s.position.set(x, y, z);
    p.s.material.color.set(o.color || '#ffffff');
    p.s.visible = true;
    this.live.push(p);
  }

  steam(pos) {
    if (Math.random() > this.scale) return;
    this._spawn(pos.x + (Math.random() - 0.5) * 0.05, pos.y, pos.z, {
      vx: (Math.random() - 0.5) * 0.08, vy: 0.45 + Math.random() * 0.2, vz: (Math.random() - 0.5) * 0.08,
      max: 1.4, size0: 0.12, size1: 0.45, a0: 0.75, color: '#ffffff',
    });
  }

  burst(pos, color = '#ffe27a', n = 12, speed = 1.6) {
    const count = Math.max(3, Math.round(n * this.scale));
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      this._spawn(pos.x, pos.y, pos.z, {
        vx: Math.cos(a) * speed * (0.5 + Math.random() * 0.5), vy: 1 + Math.random() * 1.2, vz: Math.sin(a) * speed * (0.5 + Math.random() * 0.5),
        max: 0.7 + Math.random() * 0.3, size0: 0.16, size1: 0.05, a0: 1, color, gravity: 4,
      });
    }
  }

  poof(pos) { this.burst(pos, '#c9c0cf', 10, 0.9); }

  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life += dt;
      const t = p.life / p.max;
      if (t >= 1) {
        p.s.visible = false;
        this.live[i] = this.live[this.live.length - 1];
        this.live.pop();
        this.pool.push(p);
        continue;
      }
      if (p.gravity) p.vy -= p.gravity * dt;
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      const sz = p.size0 + (p.size1 - p.size0) * t;
      p.s.scale.set(sz, sz, 1);
      p.s.material.opacity = p.a0 * (1 - t);
    }
  }
}
