/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Funny, animated details around the main hall – purely decorative, outside
 * the buildable floor: a sleeping cat, a robot vacuum wearing a chef's hat,
 * a mouse that scurries out of its hole, a giant cupcake with googly eyes,
 * a bunch of balloons, a gumball machine and a cake-shaped wall clock.
 * Cheap: a few dozen meshes, a handful of transforms per frame.
 */
import * as THREE from 'three';
import { roundedBox, cylinder, mat, PALETTE, bakeStatic } from './ModelFactory.js';

const bake = (g, keep = []) => bakeStatic(g, keep);
const sphere = (r, c, opts) => new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(c, opts));
const put = (parent, m, x, y, z, shadow = true) => { m.position.set(x, y, z); m.castShadow = shadow; parent.add(m); return m; };

function buildCat() {
  const g = new THREE.Group();
  const cushion = put(g, new THREE.Mesh(cylinder(0.62, 0.66, 0.16, 24), mat(PALETTE.lavender, { roughness: 0.9 })), 0, 0.08, 0);
  cushion.receiveShadow = true;
  const fur = '#f2a65a', furDark = '#d9822b';
  const body = put(g, sphere(0.36, fur, { roughness: 0.9 }), 0, 0.36, 0); body.scale.set(1.3, 0.75, 1);
  const head = new THREE.Group(); head.position.set(0.42, 0.34, 0.05); g.add(head);
  put(head, sphere(0.2, fur, { roughness: 0.9 }), 0, 0, 0);
  for (const s of [-1, 1]) {
    const ear = put(head, new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 8), mat(furDark)), 0.02, 0.18, s * 0.1);
    ear.rotation.x = s * 0.3;
    // Closed eyes: tiny dark lines.
    const eye = put(head, new THREE.Mesh(roundedBox(0.02, 0.012, 0.06, 0.004), mat('#3b2f3a')), 0.19, 0.04, s * 0.07, false);
    eye.rotation.y = 0.2 * s;
  }
  put(head, sphere(0.025, '#ff8fb1'), 0.2, -0.02, 0, false);
  const tail = new THREE.Group(); tail.position.set(-0.42, 0.28, 0); g.add(tail);
  const tailMesh = put(tail, new THREE.Mesh(cylinder(0.05, 0.06, 0.55, 8), mat(furDark)), 0, 0, 0.25);
  tailMesh.rotation.x = Math.PI / 2;
  // "Zzz" bubble.
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const ctx = c.getContext('2d'); ctx.font = 'bold 44px "Fredoka", sans-serif'; ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#7d5873'; ctx.lineWidth = 5;
  ctx.strokeText('Zzz', 14, 46); ctx.fillText('Zzz', 14, 46);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const zzz = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  zzz.scale.set(0.6, 0.3, 1); zzz.position.set(0.5, 0.9, 0); g.add(zzz);
  bake(g, [body, tail, zzz]);
  return {
    group: g,
    update(t) {
      const breath = 1 + Math.sin(t * 2.2) * 0.04;
      body.scale.set(1.3 * breath, 0.75 * breath, breath);
      tail.rotation.y = Math.sin(t * 1.3) * 0.5;
      const k = (t * 0.35) % 1;
      zzz.position.set(0.5 + k * 0.25, 0.85 + k * 0.6, 0);
      zzz.material.opacity = Math.sin(k * Math.PI);
    },
  };
}

function buildVacuum() {
  const g = new THREE.Group();
  put(g, new THREE.Mesh(cylinder(0.32, 0.34, 0.12, 28), mat('#3b3f4a', { metalness: 0.4, roughness: 0.35 })), 0, 0.07, 0);
  put(g, new THREE.Mesh(cylinder(0.24, 0.24, 0.02, 24), mat('#5fb3ff', { emissive: '#1f6fd0', emissiveIntensity: 0.4 })), 0, 0.14, 0);
  const light = put(g, sphere(0.04, '#7dffb0', { emissive: '#3dff8a', emissiveIntensity: 1 }), 0.24, 0.13, 0, false);
  // Tiny chef's hat – it takes its job very seriously.
  put(g, new THREE.Mesh(cylinder(0.09, 0.09, 0.12, 14), mat('#ffffff')), -0.04, 0.22, 0);
  put(g, sphere(0.13, '#ffffff'), -0.04, 0.32, 0).scale.set(1, 0.7, 1);
  // …and a cake slice riding along.
  const slice = put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12, 1, false, 0, Math.PI / 2), mat(PALETTE.vanilla)), 0.12, 0.2, 0.08);
  put(slice, new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 12, 1, false, 0, Math.PI / 2), mat(PALETTE.pink)), 0, 0.05, 0, false);
  bake(g, [light]);
  return { group: g, light };
}

function buildMouse() {
  const g = new THREE.Group();
  const body = put(g, sphere(0.09, '#b9b3c4', { roughness: 0.8 }), 0, 0.08, 0); body.scale.set(1.5, 0.9, 1);
  for (const s of [-1, 1]) put(g, sphere(0.045, '#ffc1d6'), 0.1, 0.15, s * 0.06, false);
  put(g, sphere(0.018, '#ff6f9f'), 0.17, 0.09, 0, false);
  const tail = put(g, new THREE.Mesh(cylinder(0.008, 0.012, 0.22, 6), mat('#ffc1d6')), -0.2, 0.06, 0, false);
  tail.rotation.z = Math.PI / 2 - 0.3;
  bake(g);
  return g;
}

function buildCupcake() {
  const g = new THREE.Group();
  put(g, new THREE.Mesh(cylinder(0.55, 0.42, 0.7, 20), mat(PALETTE.sky)), 0, 0.35, 0);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    put(g, new THREE.Mesh(roundedBox(0.06, 0.66, 0.04, 0.02), mat('#4b9be0')), Math.cos(a) * 0.5, 0.35, Math.sin(a) * 0.5, false).rotation.y = -a;
  }
  const top = put(g, sphere(0.62, PALETTE.pink, { roughness: 0.5 }), 0, 0.82, 0); top.scale.set(1, 0.6, 1);
  put(g, sphere(0.4, PALETTE.pink, { roughness: 0.5 }), 0, 1.12, 0).scale.set(1, 0.7, 1);
  put(g, sphere(0.14, '#e8344e', { roughness: 0.25 }), 0, 1.45, 0);
  const sprCols = ['#ffd36e', '#4fd3a0', '#5fb3ff', '#ffffff'];
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, r = 0.3 + (i % 3) * 0.08;
    const sp = put(g, new THREE.Mesh(roundedBox(0.03, 0.03, 0.1, 0.01), mat(sprCols[i % 4])), Math.cos(a) * r, 1.0 + (i % 4) * 0.06, Math.sin(a) * r, false);
    sp.rotation.set(i, i * 2, 0);
  }
  // Googly eyes that look around.
  const pupils = [];
  for (const s of [-1, 1]) {
    put(g, sphere(0.13, '#ffffff', { roughness: 0.2 }), 0.42, 0.98, s * 0.2, false);
    pupils.push(put(g, sphere(0.06, '#2b1d29'), 0.53, 0.98, s * 0.2, false));
  }
  const smile = put(g, new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 6, 16, Math.PI), mat('#2b1d29')), 0.5, 0.72, 0, false);
  smile.rotation.set(Math.PI, Math.PI / 2, 0);
  bake(g, pupils);
  return {
    group: g,
    update(t) {
      const lx = Math.sin(t * 0.9) * 0.05, ly = Math.cos(t * 1.3) * 0.03;
      pupils.forEach((p, i) => p.position.set(0.53, 0.98 + ly, (i ? 1 : -1) * 0.2 + lx));
      g.rotation.y = (g.userData.baseRot ??= g.rotation.y) + Math.sin(t * 0.4) * 0.25;
    },
  };
}

function buildBalloons() {
  const g = new THREE.Group();
  put(g, new THREE.Mesh(roundedBox(0.5, 0.35, 0.5, 0.05), mat('#d9a066')), 0, 0.17, 0);
  const cols = [PALETTE.pink, PALETTE.sky, PALETTE.vanilla, PALETTE.mint, PALETTE.lavender];
  const balloons = cols.map((c, i) => {
    const b = new THREE.Group();
    const a = (i / cols.length) * Math.PI * 2;
    b.userData = { a, h: 2.1 + (i % 3) * 0.3, phase: i * 1.7 };
    const ball = put(b, sphere(0.26, c, { roughness: 0.25, metalness: 0.05 }), 0, 0, 0); ball.scale.set(1, 1.2, 1);
    put(b, new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 6), mat(c)), 0, -0.33, 0, false).rotation.x = Math.PI;
    g.add(b);
    return b;
  });
  const strings = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }));
  strings.geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(cols.length * 6), 3));
  g.add(strings);
  return {
    group: g,
    update(t) {
      const pos = strings.geometry.attributes.position;
      balloons.forEach((b, i) => {
        const { a, h, phase } = b.userData;
        const x = Math.cos(a) * 0.45 + Math.sin(t * 0.8 + phase) * 0.06, z = Math.sin(a) * 0.45 + Math.cos(t * 0.7 + phase) * 0.06;
        b.position.set(x, h + Math.sin(t * 1.1 + phase) * 0.08, z);
        b.rotation.z = Math.sin(t * 0.9 + phase) * 0.12;
        pos.setXYZ(i * 2, 0, 0.35, 0); pos.setXYZ(i * 2 + 1, x, b.position.y - 0.36, z);
      });
      pos.needsUpdate = true;
    },
  };
}

function buildGumball() {
  const g = new THREE.Group();
  put(g, new THREE.Mesh(cylinder(0.22, 0.3, 0.7, 16), mat('#e8344e', { roughness: 0.3 })), 0, 0.35, 0);
  put(g, new THREE.Mesh(roundedBox(0.12, 0.08, 0.06, 0.02), mat('#dfe3e9', { metalness: 0.8, roughness: 0.2 })), 0.2, 0.45, 0, false);
  const glass = put(g, sphere(0.34, '#ffffff', { transparent: true, opacity: 0.35, roughness: 0.05 }), 0, 1.02, 0, false);
  glass.renderOrder = 2;
  const cols = ['#ff6f9f', '#5fb3ff', '#ffd36e', '#4fd3a0', '#a58cff'];
  for (let i = 0; i < 18; i++) {
    const a = i * 2.39996, r = 0.08 + (i % 4) * 0.05;
    put(g, sphere(0.07, cols[i % 5], { roughness: 0.3 }), Math.cos(a) * r, 0.82 + Math.floor(i / 6) * 0.11, Math.sin(a) * r, false);
  }
  put(g, sphere(0.07, '#e8344e'), 0, 1.38, 0);
  bake(g);
  return g;
}

function buildClock() {
  const g = new THREE.Group();
  const face = new THREE.Mesh(cylinder(0.5, 0.5, 0.08, 32), mat('#fff6ea'));
  face.rotation.x = Math.PI / 2; g.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 8, 32), mat(PALETTE.pink)); g.add(rim);
  // Sprinkles as hour marks.
  const cols = [PALETTE.sky, PALETTE.vanilla, PALETTE.mint, PALETTE.lavender];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const m = put(g, new THREE.Mesh(roundedBox(0.04, 0.1, 0.03, 0.01), mat(cols[i % 4])), Math.sin(a) * 0.4, Math.cos(a) * 0.4, 0.05, false);
    m.rotation.z = -a;
  }
  const hand = (len, w, c) => {
    const pivot = new THREE.Group(); pivot.position.z = 0.07; g.add(pivot);
    put(pivot, new THREE.Mesh(roundedBox(w, len, 0.02, 0.01), mat(c)), 0, len / 2 - 0.04, 0, false);
    return pivot;
  };
  const hour = hand(0.24, 0.05, '#5e3424'), minute = hand(0.36, 0.035, '#5e3424');
  put(g, sphere(0.05, '#e8344e'), 0, 0, 0.09, false); // cherry on the axle
  bake(g, [hour, minute]);
  return {
    group: g,
    update() {
      const d = new Date();
      const m = d.getMinutes() + d.getSeconds() / 60, h = (d.getHours() % 12) + m / 60;
      minute.rotation.z = -(m / 60) * Math.PI * 2;
      hour.rotation.z = -(h / 12) * Math.PI * 2;
    },
  };
}

/**
 * Builds the decorations around the main hall of `fr` into `env`.
 * `blocked(x, z)` says whether a world point lies in a corridor (kept clear).
 * Returns { update(dt) } for the renderer's frame loop.
 */
export function buildDecor(fr, env, blocked) {
  const W = fr.W, H = fr.H;
  const items = [];
  const place = (obj, x, z, rotY = 0) => {
    if (blocked(x, z)) return null;
    const g = obj.group || obj;
    g.position.set(x, 0, z); g.rotation.y = rotY;
    env.add(g);
    items.push(obj);
    return obj;
  };
  // North-west corner: the bakery cat naps on its cushion.
  place(buildCat(), -W / 2 - 2.6, -H / 2 - 2.6, Math.PI / 4);
  // South-west: the giant cupcake mascot keeps an eye on things.
  place(buildCupcake(), -W / 2 - 2.6, H / 2 + 2.4, -Math.PI / 4); // googly eyes towards the camera
  // North-east, near the shop: balloons tied to a crate.
  place(buildBalloons(), W / 2 + 2.2, -H / 2 - 2.6);
  // West side: gumball machine.
  place(buildGumball(), -W / 2 - 2.4, -2.2, Math.PI / 2);
  // Clock on the north wall (inside face), hidden with the wall when it faces the camera.
  const clock = buildClock();
  const north = fr.walls?.[0];
  // Between two jar shelves (shelves sit every 4 units from the wall's end).
  if (north) { clock.group.position.set(-(W + 9) / 2 + 8, 1.6, 0.16); north.add(clock.group); items.push(clock); }

  // Robot vacuum patrols the south side (left half, clear of any corridor).
  const vac = buildVacuum();
  const vz = H / 2 + 2.3, vx0 = -W / 2 - 1, vx1 = -3.2;
  env.add(vac.group);
  // Mouse: dashes along the north wall from its hole now and then.
  const mouse = buildMouse();
  const mz = -H / 2 - 4.2;
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16, 0, Math.PI), mat('#2b1d29'));
  hole.position.set(W * 0.18, 0.001, mz - 0.1); hole.rotation.y = 0;
  if (north) { hole.position.set(W * 0.18, 0, 0.13); north.add(hole); }
  env.add(mouse);
  let t = 0;
  return {
    update(dt) {
      t += dt;
      for (const it of items) it.update?.(t);
      // Vacuum: back and forth with a little turn at each end.
      const span = vx1 - vx0, period = span * 2 / 0.9;
      const k = (t % period) / period, fwd = k < 0.5;
      const p = fwd ? k * 2 : 2 - k * 2;
      vac.group.position.set(vx0 + span * p, 0, vz + Math.sin(t * 0.8) * 0.25);
      vac.group.rotation.y = fwd ? 0 : Math.PI;
      vac.light.material.emissiveIntensity = 0.6 + Math.sin(t * 6) * 0.4;
      // Mouse: every 9 s it runs out of its hole and back.
      const mk = (t % 9) / 9;
      const run = mk < 0.25 ? mk / 0.25 : mk < 0.3 ? 1 : mk < 0.55 ? 1 - (mk - 0.3) / 0.25 : 0;
      mouse.visible = mk < 0.55;
      mouse.position.set(W * 0.18 - run * 3.2, 0, mz + 0.35);
      mouse.rotation.y = mk < 0.3 ? Math.PI : 0;
    },
  };
}
