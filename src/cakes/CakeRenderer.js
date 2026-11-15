/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Instanced 3D cake rendering driven purely by cake data.
 * Each quadrant of each layer is one instance of a shared quarter-cylinder,
 * coloured by its flavor; frosting/filling and decorations are separate
 * instanced meshes. Hundreds of cakes cost a handful of draw calls.
 *
 * Quadrant → world placement: TL=(-x,-z), TR=(+x,-z), BR=(+x,+z), BL=(-x,+z).
 * The base geometry is the BR quarter; rotation.y maps it to the others.
 */
import * as THREE from 'three';
import { FLAVORS, FROSTINGS } from './CakeModel.js';

const R = 0.3;              // cake radius (cells)
const SPONGE_H = 0.13;
const CREAM_H = 0.03;
const LAYER_H = SPONGE_H + CREAM_H;
const GAP = 0.018;          // visual gap between quadrants for readability
const QUAD_ROT = [Math.PI, Math.PI / 2, 0, Math.PI * 1.5]; // TL, TR, BR, BL
const QUAD_DIR = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => [x / Math.SQRT2, z / Math.SQRT2]);
const DECOR_COLORS = { cherry: '#e8344e', sprinkles: '#ff9ad5', chocolate: '#5a3221', strawberry: '#ff4d6d', swirl: '#fffaf2' };

function quarterGeo(r, h) {
  const g = new THREE.CylinderGeometry(r, r, h, 12, 1, false, 0, Math.PI / 2);
  g.translate(0, h / 2, 0);
  return g;
}

export class CakeRenderer {
  constructor(scene, capacity = 512) {
    this.scene = scene;
    this.color = new THREE.Color();
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.p = new THREE.Vector3();
    this.s = new THREE.Vector3(1, 1, 1);
    this.yAxis = new THREE.Vector3(0, 1, 0);
    this.geos = {
      sponge: quarterGeo(R, SPONGE_H),
      cream: quarterGeo(R + 0.008, CREAM_H),
      plate: new THREE.CylinderGeometry(R + 0.07, R + 0.05, 0.025, 20).translate(0, 0.0125, 0),
      decor: new THREE.SphereGeometry(0.045, 10, 8),
    };
    this.mats = {
      sponge: new THREE.MeshStandardMaterial({ roughness: 0.75 }),
      cream: new THREE.MeshStandardMaterial({ roughness: 0.35 }),
      plate: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }),
      decor: new THREE.MeshStandardMaterial({ roughness: 0.25 }),
    };
    this.meshes = {};
    this._alloc(capacity);
  }

  _alloc(cakes) {
    for (const k of Object.keys(this.meshes)) { this.scene.remove(this.meshes[k]); this.meshes[k].dispose(); }
    this.capacity = cakes;
    const per = { sponge: cakes * 4 * 2, cream: cakes * 4 * 2, plate: cakes, decor: cakes * 4 };
    for (const k of Object.keys(per)) {
      const im = new THREE.InstancedMesh(this.geos[k], this.mats[k], per[k]);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = k !== 'plate';
      im.receiveShadow = true;
      im.count = 0;
      im.frustumCulled = false; // instances span the whole factory
      if (k !== 'plate') { im.setColorAt(0, this.color.set('#ffffff')); im.instanceColor.setUsage(THREE.DynamicDrawUsage); }
      this.meshes[k] = im;
      this.scene.add(im);
    }
    this.limits = per;
  }

  begin() {
    this.n = { sponge: 0, cream: 0, plate: 0, decor: 0, cakes: 0 };
  }

  _put(kind, x, y, z, rotY, scale, color) {
    const i = this.n[kind];
    if (i >= this.limits[kind]) return;
    this.q.setFromAxisAngle(this.yAxis, rotY);
    this.p.set(x, y, z);
    this.s.setScalar(scale);
    this.m.compose(this.p, this.q, this.s);
    const im = this.meshes[kind];
    im.setMatrixAt(i, this.m);
    if (color) im.setColorAt(i, this.color.set(color));
    this.n[kind] = i + 1;
  }

  /** Add one cake at world position (x, y, z). Returns false if out of capacity. */
  add(cake, x, y, z, scale = 1, rotY = 0) {
    const cr = Math.cos(rotY), sr = Math.sin(rotY);
    if (this.n.cakes >= this.capacity) { this._wantGrow = true; return false; }
    this.n.cakes++;
    this._put('plate', x, y, z, 0, scale, null);
    let h = y + 0.025 * scale;
    const top = cake.layers.length - 1;
    cake.layers.forEach((layer, li) => {
      for (let qi = 0; qi < 4; qi++) {
        const p = layer.quadrants[qi];
        if (!p) continue;
        // Quadrant direction rotated by rotY (Three.js Y-rotation convention).
        const qx = QUAD_DIR[qi][0] * cr + QUAD_DIR[qi][1] * sr;
        const qz = -QUAD_DIR[qi][0] * sr + QUAD_DIR[qi][1] * cr;
        const qr = QUAD_ROT[qi] + rotY;
        const ox = x + qx * GAP * scale, oz = z + qz * GAP * scale;
        this._put('sponge', ox, h, oz, qr, scale, FLAVORS[p.flavor].color);
        // Frosting colour, or a cream filling between layers for visible separation.
        const cream = p.frosting ? FROSTINGS[p.frosting].color : (li < top ? '#fff4e2' : null);
        if (cream) this._put('cream', ox, h + SPONGE_H * scale, oz, qr, scale, cream);
        if (p.decoration && li === top) {
          const d = R * 0.55 * scale;
          this._put('decor', ox + qx * d, h + (LAYER_H + 0.03) * scale, oz + qz * d, 0, scale, DECOR_COLORS[p.decoration]);
        }
      }
      h += LAYER_H * scale;
    });
    return true;
  }

  end() {
    for (const k of ['sponge', 'cream', 'plate', 'decor']) {
      const im = this.meshes[k];
      im.count = this.n[k];
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    if (this._wantGrow) { this._wantGrow = false; this._alloc(this.capacity * 2); }
  }
}
