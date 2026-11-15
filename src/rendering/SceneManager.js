/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Renderer, scene, lights, quality levels, resize and WebGL context loss.
 */
import * as THREE from 'three';

export const QUALITY = {
  low:    { pixelRatio: 1,   shadows: false, shadowSize: 0,    particles: 0.35 },
  medium: { pixelRatio: 1.5, shadows: true,  shadowSize: 1024, particles: 0.7 },
  high:   { pixelRatio: 2,   shadows: true,  shadowSize: 2048, particles: 1 },
};

export function detectQuality() {
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && innerWidth < 1100);
  const cores = navigator.hardwareConcurrency || 4;
  if (mobile) return cores >= 6 ? 'medium' : 'low';
  return cores >= 4 ? 'high' : 'medium';
}

export class SceneManager {
  constructor(container) {
    this.container = container;
    this.quality = 'high';
    this.dynamicScale = 1; // adaptive pixel-ratio multiplier
    this._fpsSamples = [];
    this.onContextLost = () => {};
    this.onContextRestored = () => {};

    // May throw when WebGL is unavailable – main.js shows a friendly message.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;
    this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.onContextLost(); }, false);
    this.canvas.addEventListener('webglcontextrestored', () => this.onContextRestored(), false);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#fbe3ea');

    this.hemi = new THREE.HemisphereLight('#fff6ee', '#d9b8d8', 1.25);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff1dc', 2.1);
    this.sun.position.set(-9, 18, 7);
    this.sun.shadow.camera.left = -16; this.sun.shadow.camera.right = 16;
    this.sun.shadow.camera.top = 16; this.sun.shadow.camera.bottom = -16;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 50;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);
    const fill = new THREE.DirectionalLight('#ffd6ec', 0.55);
    fill.position.set(10, 8, -6);
    this.scene.add(fill);

    window.addEventListener('resize', () => this.resize());
  }

  setQuality(q) {
    this.quality = QUALITY[q] ? q : 'medium';
    const cfg = QUALITY[this.quality];
    this.renderer.shadowMap.enabled = cfg.shadows;
    this.sun.castShadow = cfg.shadows;
    if (cfg.shadows) {
      this.sun.shadow.mapSize.set(cfg.shadowSize, cfg.shadowSize);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.dynamicScale = 1;
    this.scene.traverse((o) => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach((mm) => { mm.needsUpdate = true; }); } });
    this.resize();
  }

  get particleScale() { return QUALITY[this.quality].particles; }

  resize() {
    const w = this.container.clientWidth || innerWidth;
    const h = this.container.clientHeight || innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, QUALITY[this.quality].pixelRatio) * this.dynamicScale;
    this.renderer.setPixelRatio(Math.max(0.6, pr));
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.width = w; this.height = h;
    if (this.camera) this.camera.resize(w, h);
  }

  /** Lowers resolution gracefully when the frame rate stays low. */
  trackFps(frameDt) {
    this._fpsSamples.push(frameDt);
    if (this._fpsSamples.length < 120) return;
    const avg = this._fpsSamples.reduce((a, b) => a + b, 0) / this._fpsSamples.length;
    this._fpsSamples.length = 0;
    const fps = 1 / avg;
    if (fps < 40 && this.dynamicScale > 0.6) { this.dynamicScale = Math.max(0.6, this.dynamicScale - 0.15); this.resize(); }
    else if (fps > 58 && this.dynamicScale < 1) { this.dynamicScale = Math.min(1, this.dynamicScale + 0.1); this.resize(); }
  }

  render(camera) {
    this.renderer.render(this.scene, camera);
  }
}
