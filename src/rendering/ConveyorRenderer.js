/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Conveyor ("lb") rendering, fully instanced, styled after real modular
 * conveyors: blue belt, white side guards, aluminium legs, end rollers.
 *
 *  - Straight runs are straight segments, continuous between cells.
 *  - A corner cell (fed from exactly one side) is a real curved 90° belt
 *    piece; cakes follow the arc. No height differences anywhere.
 *  - Processing machines get their own short belts (MachineDefs.paths) so the
 *    line visibly runs through the machine.
 * The renderer only reads simulation state.
 */
import * as THREE from 'three';
import { DX, DY, opposite, rotatePoint } from '../simulation/Grid.js';
import { RENDER, BELT } from '../core/Config.js';
import { textures, roundedBox, contactShadowMaterial, contactStripMaterial } from './ModelFactory.js';

export const SURF = RENDER.BELT_SURF;
const BW = 0.74;                 // belt width
const GUARD_W = 0.05;            // white side guard thickness
const GUARD_UP = 0.045;          // guard height above the belt
const GUARD_DOWN = 0.07;         // guard depth below the belt
const LEG_W = 0.06;
const TRIM = 0.12;
const ROLLER_R = 0.055;          // end roller radius (belt surface is tangent to its top)               // secondary machine paths stop short of the stage
const dirAngle = (d) => -d * Math.PI / 2;

const GUARD = new THREE.Color('#ecebf1');
const GUARD_MACHINE = new THREE.Color('#eceaf0');
const GUARD_BLOCKED = new THREE.Color('#ff7b8d');
const GUARD_REPLACED = new THREE.Color('#ffd84d');

// ------------------------------------------------------------ curved geometry
/**
 * Corner piece in canonical orientation: cakes enter moving +X through the
 * west edge and leave through the south (right turn, +Z) or north (left turn).
 * Pivot = the cell corner shared by the entry and exit edges.
 */
function cornerFrame(right) {
  const K = { x: -0.5, z: right ? 0.5 : -0.5 };
  const a0 = right ? -Math.PI / 2 : Math.PI / 2; // entry angle around K
  const a1 = 0;                                   // exit angle
  return { K, a0, a1 };
}

/** Flat ring-sector strip (the belt surface). u runs along travel, 1 unit per cell of centre-line. */
function curvedBelt(right, segs = 16) {
  const { K, a0, a1 } = cornerFrame(right);
  const rIn = 0.5 - BW / 2, rOut = 0.5 + BW / 2, L = Math.PI / 4; // centre-line length
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, a = a0 + (a1 - a0) * t;
    for (const [r, v] of [[rIn, right ? 1 : 0], [rOut, right ? 0 : 1]]) {
      pos.push(K.x + Math.cos(a) * r, 0, K.z + Math.sin(a) * r);
      uv.push(t * L, v);
    }
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Make sure the surface faces up.
  if (g.attributes.normal.getY(0) < 0) { g.setIndex(idx.map((_, i) => idx[i - (i % 3) + [0, 2, 1][i % 3]])); g.computeVertexNormals(); }
  return g;
}

/** Curved "box" (ring sector between radii r0..r1 and heights y0..y1), drawn double-sided. */
function curvedBox(right, r0, r1, y0, y1, segs = 16) {
  const { K, a0, a1 } = cornerFrame(right);
  const pos = [];
  const P = (r, a, y) => [K.x + Math.cos(a) * r, y, K.z + Math.sin(a) * r];
  const quad = (p, q, r, s) => pos.push(...p, ...q, ...r, ...p, ...r, ...s);
  for (let i = 0; i < segs; i++) {
    const aa = a0 + (a1 - a0) * (i / segs), ab = a0 + (a1 - a0) * ((i + 1) / segs);
    quad(P(r0, aa, y1), P(r1, aa, y1), P(r1, ab, y1), P(r0, ab, y1)); // top
    quad(P(r0, aa, y0), P(r0, aa, y1), P(r0, ab, y1), P(r0, ab, y0)); // inner face
    quad(P(r1, aa, y0), P(r1, aa, y1), P(r1, ab, y1), P(r1, ab, y0)); // outer face
  }
  // end caps
  for (const a of [a0, a1]) quad(P(r0, a, y0), P(r1, a, y0), P(r1, a, y1), P(r0, a, y1));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function mergeCurved(right) {
  const rIn = 0.5 - BW / 2, rOut = 0.5 + BW / 2;
  const parts = [
    curvedBox(right, rIn - GUARD_W, rIn, -GUARD_DOWN, GUARD_UP),
    curvedBox(right, rOut, rOut + GUARD_W, -GUARD_DOWN, GUARD_UP),
  ];
  const pos = [];
  for (const p of parts) pos.push(...p.attributes.position.array);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

const smoothNum = (x) => (Number.isFinite(x) ? x : 0);

export class ConveyorRenderer {
  constructor(scene, fr) {
    this.scene = scene;
    this.fr = fr;
    this.tex = textures().blueBelt;
    this.topMat = new THREE.MeshStandardMaterial({ map: this.tex, roughness: 0.55, metalness: 0 });
    this.guardMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, metalness: 0.05, side: THREE.DoubleSide });
    this.aluMat = new THREE.MeshStandardMaterial({ color: '#cfd4db', roughness: 0.35, metalness: 0.65, side: THREE.DoubleSide });
    this.topMeshes = new Map();
    this.cornerInfo = new Map(); // belt id → { right }
    this.segOwner = [];
    this._m = new THREE.Matrix4(); this._m2 = new THREE.Matrix4(); this._base = new THREE.Matrix4();
    this._q = new THREE.Quaternion(); this._qI = new THREE.Quaternion();
    this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1); this._v = new THREE.Vector3();
    this._y = new THREE.Vector3(0, 1, 0);
    this._c = new THREE.Color();
    this.geo = {
      guard: roundedBox(1, GUARD_UP + GUARD_DOWN, GUARD_W, 0.015, 2),
      under: new THREE.BoxGeometry(1, 0.04, BW),
      leg: (() => { const g = new THREE.BoxGeometry(LEG_W, 1, LEG_W); g.translate(0, 0.5, 0); return g; })(),
      foot: new THREE.CylinderGeometry(0.045, 0.05, 0.02, 12),
      // End roller: the belt wraps over this drum; bearing caps sit outside the side guards.
      drum: (() => { const g = new THREE.CylinderGeometry(ROLLER_R, ROLLER_R, BW + 0.02, 18); g.rotateX(Math.PI / 2); return g; })(),
      bearing: (() => { const g = new THREE.CylinderGeometry(ROLLER_R + 0.03, ROLLER_R + 0.03, 0.035, 20); g.rotateX(Math.PI / 2); return g; })(),
      hub: (() => { const g = new THREE.CylinderGeometry(0.03, 0.03, 0.045, 12); g.rotateX(Math.PI / 2); return g; })(),
      cornerTop: [curvedBelt(false), curvedBelt(true)],
      cornerGuard: [mergeCurved(false), mergeCurved(true)],
      cornerUnder: [curvedBox(false, 0.5 - BW / 2, 0.5 + BW / 2, -0.05, -0.01), curvedBox(true, 0.5 - BW / 2, 0.5 + BW / 2, -0.05, -0.01)],
    };
    this._alloc(1024);
  }

  _inst(geo, material, n, { color = false, shadow = true } = {}) {
    const im = new THREE.InstancedMesh(geo, material, n);
    im.count = 0; im.frustumCulled = false; im.receiveShadow = true; im.castShadow = shadow;
    if (color) im.setColorAt(0, GUARD);
    this.scene.add(im);
    return im;
  }

  _alloc(segments) {
    const old = [this.shade, this.shadeC, this.guard, this.under, this.leg, this.foot, this.drum, this.bearing, this.hub, ...(this.cTop || []), ...(this.cGuard || []), ...(this.cUnder || []), ...this.topMeshes.values()];
    for (const m of old) if (m) { this.scene.remove(m); m.dispose(); }
    this.topMeshes.clear();
    this.capacity = segments;
    // Contact shadows (one soft strip per straight segment, one patch per corner).
    const shadeGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.shade = this._inst(shadeGeo, contactStripMaterial(), segments, { shadow: false });
    this.shadeC = this._inst(shadeGeo, contactShadowMaterial(), segments, { shadow: false });
    this.shade.receiveShadow = this.shadeC.receiveShadow = false;
    this.shade.renderOrder = this.shadeC.renderOrder = -1;
    this.guard = this._inst(this.geo.guard, this.guardMat, segments * 2, { color: true });
    this.under = this._inst(this.geo.under, this.aluMat, segments, { shadow: false });
    this.leg = this._inst(this.geo.leg, this.aluMat, segments * 2);
    this.foot = this._inst(this.geo.foot, new THREE.MeshStandardMaterial({ color: '#3a3d44', roughness: 0.8 }), segments * 2, { shadow: false });
    this.drum = this._inst(this.geo.drum, new THREE.MeshStandardMaterial({ color: '#c7ccd4', roughness: 0.3, metalness: 0.8 }), segments * 2);
    this.bearing = this._inst(this.geo.bearing, new THREE.MeshStandardMaterial({ color: '#33363d', roughness: 0.5, metalness: 0.3 }), segments * 4);
    this.hub = this._inst(this.geo.hub, new THREE.MeshStandardMaterial({ color: '#d9dde3', roughness: 0.25, metalness: 0.9 }), segments * 4);
    this.cTop = this.geo.cornerTop.map((g) => this._inst(g, this.topMat, segments, { shadow: false }));
    this.cGuard = this.geo.cornerGuard.map((g) => this._inst(g, this.guardMat, segments, { color: true }));
    this.cUnder = this.geo.cornerUnder.map((g) => this._inst(g, this.aluMat, segments, { shadow: false }));
  }

  _top(len) {
    const k = Math.round(len * 100) / 100;
    let im = this.topMeshes.get(k);
    if (!im) {
      const g = new THREE.PlaneGeometry(k, BW);
      g.rotateX(-Math.PI / 2);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * k); // 1 texture tile per cell
      im = this._inst(g, this.topMat, this.capacity, { shadow: false });
      this.topMeshes.set(k, im);
    }
    return im;
  }

  // ------------------------------------------------------------- topology
  _feeds(b, s) {
    const n = this.sim.entityAt(b.x + DX[s], b.y + DY[s]);
    if (!n) return false;
    if (n.kind === 'belt') return n.x + DX[n.dir] === b.x && n.y + DY[n.dir] === b.y;
    for (const o of n.outputs) if (o.nx === b.x && o.ny === b.y) return true;
    return false;
  }

  // ------------------------------------------------------------- placement helpers
  _legPair(wx, wz, yaw) {
    for (const side of [-1, 1]) {
      // Local offset (0, oz) rotated by yaw around Y (Three.js convention).
      const oz = side * (BW / 2 + GUARD_W / 2);
      const rx = oz * Math.sin(yaw), rz = oz * Math.cos(yaw);
      this._m.compose(this._v.set(wx + rx, 0, wz + rz), this._qI, this._s.set(1, SURF - GUARD_DOWN, 1));
      this.leg.setMatrixAt(this.n.leg++, this._m);
      this._m.compose(this._v.set(wx + rx, 0.01, wz + rz), this._qI, this._s.set(1, 1, 1));
      this.foot.setMatrixAt(this.n.foot++, this._m);
    }
  }

  /** Straight segment from tail point (grid units) along dir. */
  _seg(tx, ty, dir, len, { tail = false, head = false, legs = true, owner = null, lift = 0 } = {}) {
    if (this.n.seg >= this.capacity) { this._grow = true; return; }
    const W = this.fr.W, H = this.fr.H;
    const cx = tx + DX[dir] * len / 2 - this.fr.OX - W / 2, cz = ty + DY[dir] * len / 2 - this.fr.OY - H / 2;
    const yaw = dirAngle(dir);
    this._q.setFromAxisAngle(this._y, yaw);
    this._base.compose(this._p.set(cx, SURF + lift, cz), this._q, this._s.set(1, 1, 1));
    const put = (im, idx, lx, ly, lz, sx = 1) => {
      this._m2.compose(this._v.set(lx, ly, lz), this._qI, this._s.set(sx, 1, 1));
      this._m.multiplyMatrices(this._base, this._m2);
      im.setMatrixAt(idx, this._m);
    };
    const top = this._top(len);
    put(top, top.count++, 0, 0.002, 0);
    put(this.under, this.n.seg, 0, -0.03, 0, len);
    this._m2.compose(this._v.set(0, -(SURF + lift) + 0.005, 0), this._qI, this._s.set(len, 1, BW + 0.5));
    this._m.multiplyMatrices(this._base, this._m2);
    this.shade.setMatrixAt(this.n.seg, this._m);
    for (const side of [-1, 1]) {
      this.guardOwner[this.n.guard] = owner;
      put(this.guard, this.n.guard++, 0, (GUARD_UP - GUARD_DOWN) / 2, side * (BW / 2 + GUARD_W / 2), len);
    }
    // The belt ends over a roller (and starts again over one) – visible drum + bearing caps.
    const roller = (x) => {
      put(this.drum, this.n.cap++, x, -ROLLER_R, 0);
      for (const side of [-1, 1]) {
        const z = side * (BW / 2 + GUARD_W + 0.018);
        put(this.bearing, this.n.bear, x, -ROLLER_R, z);
        put(this.hub, this.n.bear++, x, -ROLLER_R, z + side * 0.012);
      }
    };
    if (tail) roller(-len / 2 + ROLLER_R);
    if (head) roller(len / 2 - ROLLER_R);
    if (legs && len >= 0.5 && !lift) this._legPair(cx, cz, yaw);
    this.n.seg++;
  }

  _corner(b, right, inDir) {
    const W = this.fr.W, H = this.fr.H;
    const k = right ? 1 : 0;
    this._q.setFromAxisAngle(this._y, dirAngle(inDir));
    const c = this._p.set(b.x + 0.5 - this.fr.OX - W / 2, SURF, b.y + 0.5 - this.fr.OY - H / 2);
    this._m.compose(c, this._q, this._s.set(1, 1, 1));
    const i = this.n.corner[k]++;
    this.cTop[k].setMatrixAt(i, this._m);
    this.cUnder[k].setMatrixAt(i, this._m);
    this.cGuard[k].setMatrixAt(i, this._m);
    this.cornerOwner[k][i] = b;
    this._m.compose(this._v.set(c.x, 0.005, c.z), this._qI, this._s.set(0.95, 1, 0.95));
    this.shadeC.setMatrixAt(this.n.shadeC++, this._m);
    // Legs under the middle of the arc.
    const { K } = cornerFrame(right);
    const mid = right ? -Math.PI / 4 : Math.PI / 4;
    const yaw = dirAngle(inDir);
    for (const r of [0.5 - BW / 2 - GUARD_W / 2, 0.5 + BW / 2 + GUARD_W / 2]) {
      const lx = K.x + Math.cos(mid) * r, lz = K.z + Math.sin(mid) * r;
      const rx = lx * Math.cos(yaw) + lz * Math.sin(yaw), rz = -lx * Math.sin(yaw) + lz * Math.cos(yaw);
      this._m.compose(this._v.set(c.x + rx, 0, c.z + rz), this._qI, this._s.set(1, SURF - GUARD_DOWN, 1));
      this.leg.setMatrixAt(this.n.leg++, this._m);
      this._m.compose(this._v.set(c.x + rx, 0.01, c.z + rz), this._qI, this._s.set(1, 1, 1));
      this.foot.setMatrixAt(this.n.foot++, this._m);
    }
  }

  rebuild(sim) {
    this.sim = sim;
    this.n = { seg: 0, guard: 0, cap: 0, bear: 0, leg: 0, foot: 0, corner: [0, 0], shadeC: 0 };
    for (const m of this.topMeshes.values()) m.count = 0;
    this.cornerInfo.clear();
    this.guardOwner = [];
    this.cornerOwner = [[], []];
    const total = sim.entities.size * 4;
    if (total > this.capacity) this._alloc(Math.max(total, this.capacity * 2));

    for (const b of sim.entities.values()) {
      if (b.kind !== 'belt') continue;
      const back = opposite(b.dir), left = (b.dir + 3) & 3, right = (b.dir + 1) & 3;
      const fb = this._feeds(b, back), fl = this._feeds(b, left), fr = this._feeds(b, right);
      if (!fb && fl !== fr) {
        // Curved piece. inDir = travel direction of a cake entering from the feeding side
        // (a cake coming from the left neighbour moves toward the right).
        const inDir = fl ? right : left;
        const isRight = ((inDir + 1) & 3) === b.dir;
        this.cornerInfo.set(b.id, { inDir, right: isRight });
        this._corner(b, isRight, inDir);
        continue;
      }
      this._seg(b.x + 0.5 - DX[b.dir] * 0.5, b.y + 0.5 - DY[b.dir] * 0.5, b.dir, 1, {
        // Rollers wherever the belt does not continue into / come from another belt:
        // line ends and every machine connection (the machine has its own transfer).
        tail: !this._beltFeeds(b, back) && !this._beltFeeds(b, left) && !this._beltFeeds(b, right),
        head: !this._continuesOnBelt(b), owner: b,
      });
    }

    for (const e of sim.entities.values()) {
      if (e.kind !== 'machine') continue;
      const paths = e.def.paths;
      // Machines with a turntable (froster, rotator) have no belt of their own:
      // the line ends over a roller before them and starts again after them.
      if (!paths || e.def.ownBelt === false) continue;
      if (e.def.beltRuns) {
        // Explicit belt runs (e.g. cutter: main lane + parallel R lane), each on rollers.
        for (const run of e.def.beltRuns) {
          const [[ax, ay], [bx, by]] = run;
          const [wax, way] = rotatePoint(ax, ay, e.def.w, e.def.h, e.rot);
          const [wbx, wby] = rotatePoint(bx, by, e.def.w, e.def.h, e.rot);
          const dx = wbx - wax, dy = wby - way;
          const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
          this._seg(e.x + wax, e.y + way, dir, Math.hypot(dx, dy), { legs: false, owner: null, tail: true, head: true });
        }
        continue;
      }
      const st = e.def.stage;
      const all = [...paths.in.map((p, i) => ({ p, sec: i > 0, endsAtStage: true })), ...paths.out.map((p, i) => ({ p, sec: i > 0, endsAtStage: false }))];
      for (const { p, sec, endsAtStage } of all) {
        for (let k = 1; k < p.length; k++) {
          // Rollers at the machine's entry and exit edges (not under the stage).
          const tailRoller = endsAtStage && k === 1;
          const headRoller = !endsAtStage && k === p.length - 1;
          let [ax, ay] = p[k - 1], [bx, by] = p[k];
          const vertical = ax === bx;
          const touchesStage = endsAtStage ? (bx === st.x && by === st.y) : (ax === st.x && ay === st.y);
          let lift = 0;
          if (sec && vertical && touchesStage) {
            lift = 0.004; // a side feed into / out of the stage stops short of the main belt
            const len0 = Math.hypot(bx - ax, by - ay);
            const f = TRIM / len0;
            if (endsAtStage) { bx -= (bx - ax) * f; by -= (by - ay) * f; } else { ax += (bx - ax) * f; ay += (by - ay) * f; }
          }
          const [wax, way] = rotatePoint(ax, ay, e.def.w, e.def.h, e.rot);
          const [wbx, wby] = rotatePoint(bx, by, e.def.w, e.def.h, e.rot);
          const dx = wbx - wax, dy = wby - way;
          const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
          this._seg(e.x + wax, e.y + way, dir, Math.hypot(dx, dy), { legs: false, owner: null, lift, tail: tailRoller, head: headRoller });
        }
      }
    }

    this.under.count = this.shade.count = this.n.seg; this.guard.count = this.n.guard;
    this.shadeC.count = this.n.shadeC;
    this.shade.instanceMatrix.needsUpdate = this.shadeC.instanceMatrix.needsUpdate = true;
    this.drum.count = this.n.cap; this.bearing.count = this.n.bear; this.hub.count = this.n.bear;
    this.leg.count = this.n.leg; this.foot.count = this.n.foot;
    for (let k = 0; k < 2; k++) { this.cTop[k].count = this.cUnder[k].count = this.cGuard[k].count = this.n.corner[k]; }
    for (const m of [this.under, this.guard, this.drum, this.bearing, this.hub, this.leg, this.foot, ...this.cTop, ...this.cUnder, ...this.cGuard, ...this.topMeshes.values()]) m.instanceMatrix.needsUpdate = true;
    if (this._grow) { this._grow = false; this._alloc(this.capacity * 2); this.rebuild(sim); }
  }

  /** Only another BELT feeding b from side s (machines don't count – the belt starts over a roller there). */
  _beltFeeds(b, s) {
    const n = this.sim.entityAt(b.x + DX[s], b.y + DY[s]);
    return !!n && n.kind === 'belt' && n.x + DX[n.dir] === b.x && n.y + DY[n.dir] === b.y;
  }

  /** True when the cake continues on another belt (not into a machine or nothing). */
  _continuesOnBelt(b) {
    const n = this.sim.entityAt(b.x + DX[b.dir], b.y + DY[b.dir]);
    return !!n && n.kind === 'belt' && n.dir !== opposite(b.dir);
  }

  /** True when the next cell takes the cake (belt not pointing back, or a machine input). */
  _continuesSafe(b) {
    const nx = b.x + DX[b.dir], ny = b.y + DY[b.dir];
    const n = this.sim.entityAt(nx, ny);
    if (!n) return false;
    if (n.kind === 'belt') return n.dir !== opposite(b.dir);
    return n.inputPortAt(nx, ny, opposite(b.dir)) >= 0;
  }

  /** Guard colours: red = blocked belt, yellow (pulsing) = will be replaced by the placement preview. */
  updateColors(replacedIds, time) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 8);
    const pick = (b) => {
      if (!b) return GUARD_MACHINE;
      if (replacedIds && replacedIds.length && replacedIds.includes(b.id)) return this._c.copy(GUARD).lerp(GUARD_REPLACED, 0.5 + pulse * 0.5);
      return b.blocked ? GUARD_BLOCKED : GUARD;
    };
    for (let i = 0; i < this.n.guard; i++) this.guard.setColorAt(i, pick(this.guardOwner[i]));
    if (this.guard.instanceColor) this.guard.instanceColor.needsUpdate = true;
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i < this.n.corner[k]; i++) this.cGuard[k].setColorAt(i, pick(this.cornerOwner[k][i]));
      if (this.cGuard[k].instanceColor) this.cGuard[k].instanceColor.needsUpdate = true;
    }
  }

  scroll(speed, dt) {
    this.tex.offset.x -= speed * dt;
    if (this.tex.offset.x < -1000) this.tex.offset.x += 1000;
  }

  /**
   * Grid position of a cake on belt b (interpolated). On a curved piece the
   * cake follows the arc; everywhere else the simulation's path is used.
   */
  cakeGridPos(b, it, alpha, out) {
    const info = this.cornerInfo.get(b.id);
    if (info && it.inDir === info.inDir) {
      const moving = it.x !== it.px || it.y !== it.py;
      const step = (this.sim?.beltSpeed ?? BELT.SPEED) / 30;
      const p = Math.max(0, Math.min(1, moving ? it.progress - step * (1 - alpha) : it.progress));
      const cx = b.x + 0.5, cy = b.y + 0.5;
      const ex = cx - DX[info.inDir] * 0.5, ey = cy - DY[info.inDir] * 0.5;   // entry edge
      const xx = cx + DX[b.dir] * 0.5, xy = cy + DY[b.dir] * 0.5;            // exit edge
      const kx = ex + DX[b.dir] * 0.5, ky = ey + DY[b.dir] * 0.5;            // pivot (cell corner)
      const th = p * Math.PI / 2;
      out[0] = kx + (ex - kx) * Math.cos(th) + (xx - kx) * Math.sin(th);
      out[1] = ky + (ey - ky) * Math.cos(th) + (xy - ky) * Math.sin(th);
      return out;
    }
    out[0] = smoothNum(it.px + (it.x - it.px) * alpha);
    out[1] = smoothNum(it.py + (it.y - it.py) * alpha);
    return out;
  }
}
