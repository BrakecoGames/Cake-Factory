/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Shop front on the east wall: two glass French doors in the middle and two
 * large display cases full of treats on either side.
 *
 * Local frame: origin = centre of the door opening at floor level, inside face
 * of the east wall. -X points into the shop (toward the factory), Z runs along
 * the wall. Treats are batched per colour with mergeGeometries so the two
 * display cases cost only a handful of draw calls.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { roundedBox, mat, PALETTE } from './ModelFactory.js';

export const DOOR_GAP = 2.3;        // width of the door opening (along the wall)
export const DOOR_H = 2.0;
const CASE_LEN = 6.4, CASE_D = 0.85, CASE_H = 1.85;

/** Collects transformed geometries per colour and merges them into one mesh each. */
class Batcher {
  constructor() { this.byColor = new Map(); this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); }
  add(geo, color, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) {
    this.e.set(rx, ry, rz);
    this.q.setFromEuler(this.e);
    this.m.compose(new THREE.Vector3(x, y, z), this.q, new THREE.Vector3(s, s, s));
    const g = geo.clone();
    g.applyMatrix4(this.m);
    if (!this.byColor.has(color)) this.byColor.set(color, []);
    this.byColor.get(color).push(g);
  }
  build(group, opts = {}) {
    for (const [color, list] of this.byColor) {
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      if (!merged) continue;
      const m = new THREE.Mesh(merged, mat(color, opts));
      m.castShadow = true; m.receiveShadow = true;
      group.add(m);
    }
  }
}

// Shared base geometries (all indexed, with position/normal/uv → mergeable).
const G = {
  cyl: (rt, rb, h, seg = 18) => new THREE.CylinderGeometry(rt, rb, h, seg),
  sphere: (r) => new THREE.SphereGeometry(r, 14, 10),
  torus: (r, t) => new THREE.TorusGeometry(r, t, 10, 22),
  cone: (r, h) => new THREE.ConeGeometry(r, h, 14),
};

const SPONGE = ['#f6dfa4', '#7a4a2e', '#f49ab0', '#f7e45e', '#7d8ee8'];
const ICING = ['#ff8fb8', '#fffaf2', '#8fc8ff', '#ffe27a', '#c3a2ff', '#8de0b4', '#8a5634'];
const MACARON = ['#ffb3c7', '#b8e6c9', '#c9b6ff', '#ffe08a', '#a8d8ff', '#f7c59f'];

/** Treat makers: each places one treat centred at (x, y, z) on a shelf (y = shelf top). */
const TREATS = [
  // Round frosted cake with a cherry.
  (b, x, y, z, k) => {
    const r = 0.17, h = 0.16;
    b.add(G.cyl(r + 0.04, r + 0.03, 0.02), '#ffffff', x, y + 0.01, z);
    b.add(G.cyl(r, r, h), SPONGE[k % SPONGE.length], x, y + 0.02 + h / 2, z);
    b.add(G.cyl(r + 0.006, r + 0.006, 0.04), ICING[k % ICING.length], x, y + 0.02 + h + 0.02, z);
    b.add(G.sphere(0.035), '#e8344e', x, y + h + 0.1, z);
  },
  // Two-layer celebration cake.
  (b, x, y, z, k) => {
    b.add(G.cyl(0.2, 0.19, 0.02), '#ffffff', x, y + 0.01, z);
    b.add(G.cyl(0.17, 0.17, 0.13), SPONGE[(k + 1) % SPONGE.length], x, y + 0.085, z);
    b.add(G.cyl(0.12, 0.12, 0.11), SPONGE[(k + 2) % SPONGE.length], x, y + 0.205, z);
    b.add(G.cyl(0.125, 0.125, 0.03), ICING[(k + 3) % ICING.length], x, y + 0.275, z);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      b.add(G.sphere(0.022), '#fffaf2', x + Math.cos(a) * 0.15, y + 0.155, z + Math.sin(a) * 0.15);
    }
  },
  // Cupcakes (a little row of three).
  (b, x, y, z, k) => {
    for (let i = -1; i <= 1; i++) {
      const cz = z + i * 0.13;
      b.add(G.cyl(0.055, 0.04, 0.07, 12), ['#ff8fb1', '#8fcbff', '#7fdcb0'][(k + i + 3) % 3], x, y + 0.035, cz);
      b.add(G.cone(0.06, 0.1), ICING[(k + i + 7) % ICING.length], x, y + 0.12, cz);
      b.add(G.sphere(0.018), '#e8344e', x, y + 0.18, cz);
    }
  },
  // Glazed donuts (stack of two + one leaning).
  (b, x, y, z, k) => {
    b.add(G.torus(0.075, 0.035), '#e2a663', x, y + 0.035, z - 0.06, Math.PI / 2);
    b.add(G.torus(0.075, 0.036), ICING[(k + 2) % ICING.length], x, y + 0.045, z - 0.06, Math.PI / 2, 0, 0, 1.0);
    b.add(G.torus(0.075, 0.035), '#e2a663', x, y + 0.105, z - 0.06, Math.PI / 2);
    b.add(G.torus(0.075, 0.036), ICING[(k + 4) % ICING.length], x, y + 0.115, z - 0.06, Math.PI / 2);
    b.add(G.torus(0.075, 0.035), '#e2a663', x, y + 0.08, z + 0.12, Math.PI / 2 - 0.9);
  },
  // Macaron tower (pyramid of six).
  (b, x, y, z, k) => {
    const spots = [[-0.07, 0, -0.07], [0.07, 0, -0.07], [-0.07, 0, 0.07], [0.07, 0, 0.07], [0, 0.07, 0], [0, 0.14, 0]];
    spots.forEach(([dx, dy, dz], i) => {
      const c = MACARON[(k + i) % MACARON.length];
      b.add(G.sphere(0.05), c, x + dx, y + 0.03 + dy, z + dz, 0, 0, 0, 1);
      b.add(G.cyl(0.042, 0.042, 0.012, 12), '#fffaf2', x + dx, y + 0.03 + dy, z + dz);
    });
  },
  // Fruit tart.
  (b, x, y, z, k) => {
    b.add(G.cyl(0.18, 0.15, 0.06), '#d9a066', x, y + 0.03, z);
    b.add(G.cyl(0.155, 0.155, 0.02), '#fff1c7', x, y + 0.065, z);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + k;
      b.add(G.sphere(0.03), ['#e8344e', '#5a6fd6', '#ffb02e'][i % 3], x + Math.cos(a) * 0.1, y + 0.085, z + Math.sin(a) * 0.1);
    }
  },
  // Cookies on a plate.
  (b, x, y, z, k) => {
    b.add(G.cyl(0.19, 0.17, 0.02), '#ffffff', x, y + 0.01, z);
    for (let i = 0; i < 4; i++) {
      const dz = (i - 1.5) * 0.085;
      b.add(G.cyl(0.06, 0.06, 0.018, 14), '#d9a066', x, y + 0.03 + i * 0.012, z + dz, 0.25, 0, 0);
      b.add(G.sphere(0.012), '#5a3221', x + 0.02, y + 0.045 + i * 0.012, z + dz);
    }
  },
];

function buildDisplayCase(len, seed) {
  const g = new THREE.Group();
  const frame = mat(PALETTE.pink), cream = mat(PALETTE.cream);
  const glassMat = new THREE.MeshStandardMaterial({ color: '#e4f6ff', transparent: true, opacity: 0.25, roughness: 0.03, metalness: 0.1, depthWrite: false });
  const place = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  // Cabinet: base, top, back.
  place(new THREE.Mesh(roundedBox(CASE_D, 0.5, len, 0.06), frame), 0, 0.25, 0);
  place(new THREE.Mesh(roundedBox(CASE_D + 0.08, 0.12, len + 0.08, 0.04), cream), 0, CASE_H, 0);
  place(new THREE.Mesh(roundedBox(0.06, CASE_H - 0.5, len, 0.02), mat('#fff3f6')), CASE_D / 2 - 0.03, 0.5 + (CASE_H - 0.5) / 2, 0);
  // Pink and white stripe along the base front.
  place(new THREE.Mesh(roundedBox(0.02, 0.1, len - 0.2, 0.01), mat(PALETTE.white)), -CASE_D / 2 - 0.005, 0.32, 0);
  // Glass front and ends.
  const glassH = CASE_H - 0.56;
  const front = new THREE.Mesh(new THREE.PlaneGeometry(len, glassH), glassMat);
  front.rotation.y = -Math.PI / 2; front.position.set(-CASE_D / 2, 0.5 + glassH / 2, 0); front.renderOrder = 3;
  g.add(front);
  for (const z of [-len / 2, len / 2]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(CASE_D, glassH), glassMat);
    side.position.set(0, 0.5 + glassH / 2, z); side.renderOrder = 3;
    g.add(side);
  }
  const posts = Math.round(len / 1.6);
  for (let i = 0; i <= posts; i++) {
    place(new THREE.Mesh(roundedBox(0.06, CASE_H - 0.5, 0.06, 0.02), frame), -CASE_D / 2, 0.5 + (CASE_H - 0.5) / 2, -len / 2 + (i * len) / posts);
  }
  // Three shelves of treats.
  const shelves = [0.5, 0.94, 1.36];
  const b = new Batcher();
  shelves.forEach((y, si) => {
    if (si > 0) place(new THREE.Mesh(roundedBox(CASE_D - 0.14, 0.025, len - 0.1, 0.01), mat('#eaf6fb', { transparent: true, opacity: 0.6 })), 0, y - 0.015, 0);
    const n = Math.floor((len - 0.4) / 0.48);
    for (let i = 0; i < n; i++) {
      const z = -len / 2 + 0.35 + i * ((len - 0.7) / (n - 1));
      const k = seed + si * 5 + i * 3;
      TREATS[(k + si * 2) % TREATS.length](b, -0.06, y, z, k);
    }
  });
  b.build(g, { roughness: 0.55 });
  // Warm light strip and a little sign.
  const light = new THREE.Mesh(roundedBox(0.04, 0.03, len - 0.3, 0.01), new THREE.MeshBasicMaterial({ color: '#fff6d8' }));
  light.position.set(-CASE_D / 2 + 0.1, CASE_H - 0.08, 0);
  g.add(light);
  return g;
}

function buildDoor(width, hingeSide) {
  // Pivot group sits on the hinge; the leaf extends along ±Z from it.
  const pivot = new THREE.Group();
  const leaf = new THREE.Group();
  const dirZ = -hingeSide; // leaf extends from the hinge toward the opening centre
  const frame = mat(PALETTE.white);
  const glassMat = new THREE.MeshStandardMaterial({ color: '#d8f1ff', transparent: true, opacity: 0.35, roughness: 0.03, metalness: 0.1, depthWrite: false });
  const add = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; leaf.add(m); };
  const cz = dirZ * width / 2;
  add(new THREE.Mesh(roundedBox(0.06, DOOR_H, 0.07, 0.02), frame), 0, DOOR_H / 2, dirZ * 0.035);           // hinge stile
  add(new THREE.Mesh(roundedBox(0.06, DOOR_H, 0.07, 0.02), frame), 0, DOOR_H / 2, dirZ * (width - 0.035)); // lock stile
  add(new THREE.Mesh(roundedBox(0.06, 0.08, width, 0.02), frame), 0, DOOR_H - 0.04, cz);                     // top rail
  add(new THREE.Mesh(roundedBox(0.06, 0.22, width, 0.02), mat(PALETTE.pink)), 0, 0.11, cz);                // kick plate
  add(new THREE.Mesh(roundedBox(0.06, 0.05, width, 0.02), frame), 0, 1.0, cz);                              // mid rail
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.1, DOOR_H - 0.3), glassMat);
  glass.rotation.y = Math.PI / 2; glass.position.set(0, (DOOR_H + 0.14) / 2, cz); glass.renderOrder = 3;
  leaf.add(glass);
  const handle = new THREE.Mesh(roundedBox(0.03, 0.32, 0.03, 0.012), mat('#ffd84d', { metalness: 0.7, roughness: 0.25 }));
  handle.position.set(-0.06, 1.0, dirZ * (width - 0.14));
  leaf.add(handle);
  pivot.add(leaf);
  pivot.userData.hingeSide = hingeSide;
  return pivot;
}

/** Shop front: returns { group, doors } (doors[i].rotation.y is animated by the shop). */
export function buildStorefront(wallLen) {
  const g = new THREE.Group();
  const leafW = DOOR_GAP / 2;
  const doors = [-1, 1].map((side) => {
    const d = buildDoor(leafW, side);
    d.position.set(-0.13, 0, side * DOOR_GAP / 2);
    g.add(d);
    return d;
  });
  // Door frame (posts + header) on the inside face of the wall.
  const frame = mat(PALETTE.cream);
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(roundedBox(0.3, DOOR_H + 0.1, 0.1, 0.03), frame);
    p.position.set(-0.05, (DOOR_H + 0.1) / 2, side * (DOOR_GAP / 2 + 0.05)); p.castShadow = true; g.add(p);
  }
  const header = new THREE.Mesh(roundedBox(0.3, 0.12, DOOR_GAP + 0.2, 0.03), frame);
  header.position.set(-0.05, DOOR_H + 0.06, 0); g.add(header);
  // Welcome mat just inside.
  const matMesh = new THREE.Mesh(roundedBox(0.9, 0.02, 1.8, 0.01), mat('#e9668f', { roughness: 0.9 }));
  matMesh.position.set(-0.75, 0.01, 0); matMesh.receiveShadow = true; g.add(matMesh);
  // Two big display cases left and right of the doors.
  const caseLen = Math.min(CASE_LEN, wallLen / 2 - DOOR_GAP / 2 - 1.2);
  [-1, 1].forEach((side, i) => {
    const c = buildDisplayCase(caseLen, i * 11 + 3);
    c.position.set(-0.13 - CASE_D / 2, 0, side * (DOOR_GAP / 2 + 0.45 + caseLen / 2));
    g.add(c);
  });
  return { group: g, doors };
}
