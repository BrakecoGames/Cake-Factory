/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Procedural, toy-like machine models with shared geometries/materials.
 * All assets are generated in code (no external files).
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RENDER } from '../core/Config.js';

const SURF = RENDER.BELT_SURF;

export const PALETTE = {
  cream: '#fff6ea', pink: '#ff8fb1', pinkDark: '#e9668f', choc: '#6b3f2a', mint: '#7fdcb0', mintDark: '#4fbf90',
  vanilla: '#ffe6a3', sky: '#8fcbff', lavender: '#c9b6ff', white: '#ffffff', metal: '#d8dde6', dark: '#3b2f3a',
};

const geoCache = new Map();
export function roundedBox(w, h, d, r = 0.06, seg = 3) {
  const k = `rb:${w}:${h}:${d}:${r}:${seg}`;
  if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(w, h, d, seg, r));
  return geoCache.get(k);
}
export function cylinder(rt, rb, h, seg = 20) {
  const k = `cy:${rt}:${rb}:${h}:${seg}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.CylinderGeometry(rt, rb, h, seg));
  return geoCache.get(k);
}

const matCache = new Map();
export function mat(color, opts = {}) {
  const k = `${color}|${JSON.stringify(opts)}`;
  if (!matCache.has(k)) {
    matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...opts }));
  }
  return matCache.get(k);
}

function mesh(geo, material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------- textures
function canvasTexture(w, h, draw, { repeat = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}

let _textures = null;
export function textures() {
  if (_textures) return _textures;
  _textures = {
    floor: canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = '#fff3e8'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffe4ea'; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2);
      g.strokeStyle = 'rgba(214,160,170,0.35)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      for (const [x, y] of [[w / 4, h / 4], [w * 0.75, h * 0.75]]) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
    }, { repeat: true }),
    belt: canvasTexture(64, 64, (g, w, h) => {
      g.fillStyle = '#5b5563'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#6a6473'; for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 4);
      // chevrons pointing +u (texture x)
      g.strokeStyle = '#ffd36b'; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(w * 0.32, h * 0.25); g.lineTo(w * 0.62, h * 0.5); g.lineTo(w * 0.32, h * 0.75); g.stroke();
    }, { repeat: true }),
    blueBelt: canvasTexture(128, 64, (g, w, h) => {
      // Smooth blue modular belt with faint module seams; a soft arrow shows the direction.
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#3f86e6'); gr.addColorStop(0.5, '#4a91ee'); gr.addColorStop(1, '#3f86e6');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(20, 60, 140, 0.18)';
      for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 2, h);
      g.strokeStyle = 'rgba(255, 255, 255, 0.22)'; g.lineWidth = 5; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(w * 0.42, h * 0.3); g.lineTo(w * 0.56, h * 0.5); g.lineTo(w * 0.42, h * 0.7); g.stroke();
    }, { repeat: true }),
    rubber: canvasTexture(64, 64, (g, w, h) => {
      // Dark rubber with cleats across the belt; a faint chevron shows the direction.
      g.fillStyle = '#3e3b44'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 8) { g.fillStyle = '#4a4751'; g.fillRect(x, 0, 3, h); g.fillStyle = '#34313a'; g.fillRect(x + 3, 0, 1, h); }
      g.strokeStyle = 'rgba(255, 214, 120, 0.35)'; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(w * 0.36, h * 0.3); g.lineTo(w * 0.6, h * 0.5); g.lineTo(w * 0.36, h * 0.7); g.stroke();
    }, { repeat: true }),
    awning: canvasTexture(128, 32, (g, w, h) => {
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#ff8fb1'; g.fillRect(i * w / 8, 0, w / 8, h); }
    }),
    sign: canvasTexture(256, 96, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 26); g.fill();
      g.strokeStyle = '#ff8fb1'; g.lineWidth = 8; g.stroke();
      g.fillStyle = '#e9668f'; g.font = 'bold 46px "Fredoka", "Trebuchet MS", sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('DELIVERY', w / 2, h / 2 + 3);
    }),
    soft: canvasTexture(64, 64, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }),
    alert: canvasTexture(64, 64, (g, w, h) => {
      g.fillStyle = '#ff5d73'; g.beginPath(); g.arc(w / 2, h / 2, 28, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke();
      g.fillStyle = '#fff'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', w / 2, h / 2 + 2);
    }),
    wall: canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = '#ffd9e3'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffcbd8'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 16, h);
      g.fillStyle = '#fff6ea'; g.fillRect(0, h * 0.78, w, h * 0.22);
    }, { repeat: true }),
  };
  return _textures;
}

// --------------------------------------------------------------- machines
/**
 * Oven (1×1, output toward local +X). Returns { group, parts } where parts
 * holds animated sub-objects for the renderer.
 */
export function buildOven() {
  const g = new THREE.Group();
  const body = mesh(roundedBox(0.86, 0.62, 0.86, 0.12), mat(PALETTE.pink), 0, 0.34, 0);
  const base = mesh(roundedBox(0.92, 0.08, 0.92, 0.03), mat(PALETTE.choc), 0, 0.04, 0);
  const roof = mesh(roundedBox(0.9, 0.12, 0.9, 0.06), mat(PALETTE.cream), 0, 0.7, 0);
  const chimney = mesh(cylinder(0.08, 0.09, 0.26), mat(PALETTE.metal, { metalness: 0.4, roughness: 0.35 }), -0.22, 0.88, -0.2);
  const chimneyCap = mesh(cylinder(0.11, 0.11, 0.05), mat(PALETTE.choc), -0.22, 1.02, -0.2);
  // Door on the +X face with a glowing window.
  const doorFrame = mesh(roundedBox(0.04, 0.42, 0.6, 0.02), mat(PALETTE.cream), 0.44, 0.34, 0);
  const glowMat = new THREE.MeshStandardMaterial({ color: '#3a1d12', emissive: '#ff8a3d', emissiveIntensity: 0.2, roughness: 0.2 });
  const window_ = mesh(roundedBox(0.03, 0.28, 0.44, 0.02), glowMat, 0.46, 0.36, 0, false);
  const handle = mesh(roundedBox(0.04, 0.04, 0.34, 0.015), mat(PALETTE.metal, { metalness: 0.6, roughness: 0.3 }), 0.5, 0.58, 0);
  // Dial gear on the side (spins while baking).
  const gear = new THREE.Group();
  gear.position.set(0, 0.42, 0.44);
  const gearDisc = mesh(cylinder(0.12, 0.12, 0.04, 10), mat(PALETTE.vanilla), 0, 0, 0);
  gearDisc.rotation.x = Math.PI / 2;
  const gearDot = mesh(cylinder(0.04, 0.04, 0.06, 10), mat(PALETTE.choc), 0, 0.06, 0);
  gearDot.rotation.x = Math.PI / 2;
  gearDot.position.set(0.06, 0, 0.01);
  gear.add(gearDisc, gearDot);
  // Little cake icon on top so the silhouette reads as "cake oven".
  const iconMat = new THREE.MeshStandardMaterial({ color: PALETTE.vanilla, roughness: 0.6 });
  const icon = mesh(cylinder(0.12, 0.12, 0.08, 16), iconMat, 0.18, 0.8, 0.18);
  const iconTop = mesh(cylinder(0.125, 0.125, 0.03, 16), mat(PALETTE.white), 0.18, 0.855, 0.18);
  const cherry = mesh(new THREE.SphereGeometry(0.035, 10, 8), mat('#e8344e'), 0.18, 0.9, 0.18);
  g.add(base, body, roof, chimney, chimneyCap, doorFrame, window_, handle, gear, icon, iconTop, cherry);
  return { group: g, parts: { glowMat, gear, iconMat, chimneyTop: new THREE.Vector3(-0.22, 1.08, -0.2), body } };
}

/** Delivery station (2×2, centred on its footprint). */
export function buildDelivery() {
  const t = textures();
  const g = new THREE.Group();
  const flashMat = new THREE.MeshStandardMaterial({ color: PALETTE.mint, emissive: '#7fffc8', emissiveIntensity: 0, roughness: 0.5 });
  const base = mesh(roundedBox(1.9, 0.22, 1.9, 0.08), flashMat, 0, 0.11, 0);
  const trim = mesh(roundedBox(1.94, 0.06, 1.94, 0.03), mat(PALETTE.mintDark), 0, 0.03, 0);
  const intake = mesh(roundedBox(1.3, 0.05, 1.3, 0.04), mat('#5b5563'), 0, 0.245, 0);
  const counter = mesh(roundedBox(1.1, 0.42, 0.5, 0.08), mat(PALETTE.cream), 0, 0.46, -0.55);
  const postMat = mat(PALETTE.white);
  const p1 = mesh(cylinder(0.04, 0.04, 0.9), postMat, -0.78, 0.65, -0.78);
  const p2 = mesh(cylinder(0.04, 0.04, 0.9), postMat, 0.78, 0.65, -0.78);
  const awning = mesh(new THREE.BoxGeometry(1.8, 0.05, 0.6), new THREE.MeshStandardMaterial({ map: t.awning, roughness: 0.6 }), 0, 1.12, -0.6);
  awning.rotation.x = 0.25;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.41), new THREE.MeshBasicMaterial({ map: t.sign, transparent: true }));
  sign.position.set(0, 1.35, -0.78);
  // Stack of cake boxes.
  const box1 = mesh(roundedBox(0.34, 0.24, 0.34, 0.03), mat(PALETTE.white), 0.62, 0.36, 0.6);
  const box2 = mesh(roundedBox(0.3, 0.22, 0.3, 0.03), mat(PALETTE.pink), 0.6, 0.59, 0.58);
  const ribbon = mesh(roundedBox(0.31, 0.03, 0.06, 0.01), mat(PALETTE.white), 0.6, 0.71, 0.58);
  const bell = mesh(new THREE.SphereGeometry(0.09, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(PALETTE.vanilla, { metalness: 0.5, roughness: 0.3 }), -0.3, 0.67, -0.55);
  g.add(trim, base, intake, counter, p1, p2, awning, sign, box1, box2, ribbon, bell);
  return { group: g, parts: { flashMat, sign } };
}

/** Floating status icon (e.g. blocked "!"). */
export function buildAlertSprite() {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures().alert, depthTest: false, transparent: true }));
  s.scale.set(0.42, 0.42, 1);
  s.renderOrder = 10;
  return s;
}

/** Flat arrow used for port indicators and highlights. */
let _arrowGeo = null;
export function arrowGeometry() {
  if (_arrowGeo) return _arrowGeo;
  const s = new THREE.Shape();
  s.moveTo(0.22, 0); s.lineTo(-0.02, 0.2); s.lineTo(-0.02, 0.09); s.lineTo(-0.2, 0.09);
  s.lineTo(-0.2, -0.09); s.lineTo(-0.02, -0.09); s.lineTo(-0.02, -0.2); s.closePath();
  _arrowGeo = new THREE.ShapeGeometry(s);
  _arrowGeo.rotateX(-Math.PI / 2); // lie flat, pointing +X
  return _arrowGeo;
}

// ------------------------------------------------------------ Phase 2 machines

function platform(w, d, color, trimColor = PALETTE.cream) {
  const g = new THREE.Group();
  g.add(mesh(roundedBox(w + 0.04, 0.06, d + 0.04, 0.03), mat(PALETTE.choc), 0, 0.03, 0));
  g.add(mesh(roundedBox(w, 0.22, d, 0.07), mat(color), 0, 0.17, 0));
  g.add(mesh(roundedBox(w - 0.08, 0.04, d - 0.08, 0.03), mat(trimColor), 0, 0.285, 0));
  return g;
}

/** Labelled exit flag (L / R) so cutter exits are readable at a glance. */
let _flagTex = {};
function flagTexture(text, color) {
  const k = text + color;
  if (!_flagTex[k]) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = color; g.beginPath(); g.roundRect(4, 4, 56, 56, 14); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 40px "Fredoka", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 32, 35);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; _flagTex[k] = t;
  }
  return _flagTex[k];
}
function flag(text, color) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flagTexture(text, color), depthTest: true }));
  s.scale.set(0.24, 0.24, 1);
  return s;
}

// The belt runs THROUGH these machines (drawn by ConveyorRenderer), so the
// models are housings around a clear corridor: side walls, a bridge and a tool
// above the stage where the cake stops.
const WALL_T = 0.05;
function wall(len, h, color, x, z, alongX = true) {
  const m = mesh(roundedBox(alongX ? len : WALL_T, h, alongX ? WALL_T : len, 0.02), mat(color), x, h / 2, z);
  return m;
}
function capStrip(len, color, x, y, z, alongX = true) {
  return mesh(roundedBox(alongX ? len : 0.09, 0.05, alongX ? 0.09 : len, 0.02), mat(color), x, y, z);
}

let _displayTex = null;
function displayTexture() {
  if (_displayTex) return _displayTex;
  const c = document.createElement('canvas'); c.width = 128; c.height = 48;
  const g = c.getContext('2d');
  g.fillStyle = '#1d1a22'; g.beginPath(); g.roundRect(0, 0, 128, 48, 12); g.fill();
  g.fillStyle = '#ff3b3b'; g.font = 'bold 26px monospace'; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText('000', 120, 25);
  for (const [x, col] of [[16, '#5aa8ff'], [34, '#5aa8ff'], [52, '#4fd1ff']]) { g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.arc(x, 24, 6, 0, Math.PI * 2); g.stroke(); }
  _displayTex = new THREE.CanvasTexture(c); _displayTex.colorSpace = THREE.SRGBColorSpace;
  return _displayTex;
}

/** Small steel plates that bridge from the belt's end roller onto a turntable (and off again). */
function transferPlates(g, tableR) {
  const len = 0.5 - tableR + 0.02;
  for (const side of [-1, 1]) {
    g.add(mesh(roundedBox(len, 0.025, 0.7, 0.01), mat('#cfd4db', { metalness: 0.75, roughness: 0.3 }), side * (0.5 - len / 2), SURF - 0.012, 0));
  }
}

/**
 * Frosting machine (1×1), modelled on a cake-icing machine: a pink body,
 * a stainless turntable in the belt (the cake spins on it), and a column
 * with a stainless arm whose spatula spreads the frosting.
 * The belt runs straight through along local X.
 */
export function buildFroster() {
  const g = new THREE.Group();
  const pink = '#f39bbb', pinkDark = '#e07fa3';
  const steel = mat('#dfe3e9', { metalness: 0.85, roughness: 0.22 });
  // Low pink side bodies along the belt.
  for (const z of [-0.47, 0.47]) {
    g.add(mesh(roundedBox(0.94, SURF + 0.1, 0.07, 0.03), mat(pink), 0, (SURF + 0.1) / 2, z));
  }
  // Control panel on the camera-facing side.
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), new THREE.MeshBasicMaterial({ map: displayTexture() }));
  panel.position.set(0.12, (SURF + 0.1) / 2, 0.508);
  g.add(panel);
  // Stainless turntable lying in the belt under the stage.
  const table = new THREE.Group();
  table.position.y = SURF + 0.008;
  table.add(mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.03, 40), steel, 0, 0, 0));
  table.add(mesh(new THREE.TorusGeometry(0.35, 0.012, 6, 40), steel, 0, 0.015, 0));
  table.children[1].rotation.x = Math.PI / 2;
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1 + i * 0.08, 0.004, 4, 32), mat('#c4c9d1', { metalness: 0.9, roughness: 0.3 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.017; table.add(ring);
  }
  g.add(table);
  transferPlates(g, 0.35);
  // Pink column at the back (north) edge, outside the cake's reach.
  g.add(mesh(roundedBox(0.4, 0.82, 0.1, 0.04), mat(pink), -0.2, SURF + 0.1 + 0.41, -0.45));
  g.add(mesh(roundedBox(0.42, 0.06, 0.12, 0.03), mat(pinkDark), -0.2, SURF + 0.1 + 0.84, -0.45));
  // Crank on top of the column.
  const crank = new THREE.Group();
  crank.position.set(-0.2, SURF + 0.1 + 0.9, -0.45);
  crank.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 8), mat('#2a2a30'), 0, 0, 0));
  crank.add(mesh(roundedBox(0.16, 0.025, 0.03, 0.01), mat('#2a2a30'), 0.06, 0.04, 0));
  g.add(crank);
  // Frosting hopper (tinted with the selected color) on the column.
  const bagMat = new THREE.MeshStandardMaterial({ color: '#ff8fb8', roughness: 0.35 });
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.16, 16), bagMat, -0.32, SURF + 0.1 + 0.95, -0.45));
  // Stainless arm reaching over the cake + spatulas.
  const arm = new THREE.Group();
  arm.position.set(0, 0, 0);
  arm.add(mesh(roundedBox(0.07, 0.06, 0.46, 0.015), steel, 0, 0.66, -0.2));       // horizontal arm
  arm.add(mesh(roundedBox(0.03, 0.2, 0.03, 0.01), steel, 0, 0.55, -0.02));        // drop rod
  const spatulaMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0.4 });
  const topBlade = mesh(roundedBox(0.05, 0.012, 0.34, 0.005), spatulaMat, 0, 0.452, -0.18); // skims the top
  const sideBlade = mesh(roundedBox(0.05, 0.2, 0.012, 0.005), spatulaMat, 0, 0.35, -0.385); // smooths the side
  arm.add(topBlade, sideBlade);
  g.add(arm);
  return { group: g, parts: { bagMat, table, arm, spatulaMat } };
}

/**
 * Cake cutter (1×2). Model centred on its footprint: the input cell is
 * z = -0.5 (north at rotation 0), the R exit cell z = +0.5.
 * The blade is kept aligned with the WORLD north–south axis by the renderer,
 * because cakes keep their world orientation (left half = west half).
 */
export function buildCutter() {
  const g = new THREE.Group();
  const body = PALETTE.sky;
  g.add(wall(0.94, 0.5, body, 0, -0.98), capStrip(0.96, PALETTE.cream, 0, 0.52, -0.98));
  g.add(wall(0.94, 0.5, body, 0, 0.98), capStrip(0.96, PALETTE.cream, 0, 0.52, 0.98));
  g.add(wall(0.9, 0.42, body, -0.48, 0.5, false));           // closed back of the R cell
  // Cantilever arm from the north wall over the stage.
  g.add(mesh(roundedBox(0.12, 0.85, 0.12, 0.04), mat(PALETTE.cream), 0, 0.42, -0.98));
  g.add(mesh(roundedBox(0.12, 0.1, 0.56, 0.04), mat(PALETTE.cream), 0, 0.82, -0.72));
  const blade = new THREE.Group();
  blade.position.set(0, 0.6, -0.5);
  const disc = mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.015, 28), mat('#eef2f7', { metalness: 0.8, roughness: 0.18 }), 0, 0, 0);
  disc.rotation.z = Math.PI / 2; // disc in the plane that splits west/east halves
  const hub = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 12), mat(PALETTE.pinkDark), 0, 0, 0);
  hub.rotation.z = Math.PI / 2;
  blade.add(disc, hub);
  const bladeHolder = new THREE.Group(); // counter-rotated to stay world-aligned
  bladeHolder.position.set(0, 0, -0.5);
  blade.position.set(0, 0.6, 0);
  bladeHolder.add(blade);
  g.add(bladeHolder);
  g.add(mesh(roundedBox(0.06, 0.24, 0.06, 0.02), mat(PALETTE.metal), 0, 0.74, -0.5));
  // L / R exit flags (left of travel = the north cell at rotation 0).
  for (const [z, text, color] of [[-0.5, 'L', '#3fb27f'], [0.5, 'R', '#e9668f']]) {
    const f = flag(text, color); f.position.set(0.46, 0.66, z + (z < 0 ? -0.36 : 0.36)); g.add(f);
  }
  return { group: g, parts: { blade, bladeHolder, bladeY: 0.6 } };
}

/** Rotator (1×1): low guards and a turntable lying on the belt under the stage. */
export function buildRotator() {
  const g = new THREE.Group();
  for (const z of [-0.48, 0.48]) g.add(wall(0.92, SURF + 0.12, PALETTE.lavender, 0, z), capStrip(0.94, PALETTE.cream, 0, SURF + 0.14, z));
  g.add(mesh(roundedBox(0.3, 0.2, 0.14, 0.04), mat(PALETTE.lavender), -0.2, SURF + 0.26, -0.48)); // motor
  const table = new THREE.Group();
  table.position.y = SURF + 0.012;
  table.add(mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.02, 32), mat(PALETTE.white, { roughness: 0.4 }), 0, 0, 0));
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.018, 6, 24, Math.PI * 1.3), mat(PALETTE.pinkDark));
  arc.rotation.x = -Math.PI / 2; arc.position.y = 0.012;
  table.add(arc);
  g.add(table);
  transferPlates(g, 0.33);
  return { group: g, parts: { table } };
}

/**
 * Combiner (1×2): piece A rides in on the north belt, piece B comes in on the
 * south belt and is carried up to meet it under the press.
 */
export function buildCombiner() {
  const g = new THREE.Group();
  const body = PALETTE.pink;
  g.add(wall(0.94, 0.5, body, 0, -0.98), capStrip(0.96, PALETTE.cream, 0, 0.52, -0.98));
  g.add(wall(0.94, 0.5, body, 0, 0.98), capStrip(0.96, PALETTE.cream, 0, 0.52, 0.98));
  g.add(wall(0.9, 0.42, body, 0.48, 0.5, false));            // closed front of the B cell
  g.add(mesh(roundedBox(0.12, 0.95, 0.12, 0.04), mat(PALETTE.cream), 0, 0.47, -0.98));
  g.add(mesh(roundedBox(0.12, 0.1, 0.56, 0.04), mat(PALETTE.cream), 0, 0.92, -0.72));
  const pressRod = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), mat(PALETTE.metal), 0, 0.76, -0.5);
  const press = mesh(roundedBox(0.5, 0.05, 0.5, 0.03), mat(PALETTE.vanilla, { metalness: 0.3, roughness: 0.3 }), 0, 0.68, -0.5);
  g.add(pressRod, press);
  return { group: g, parts: { press, pressY: 0.68 } };
}

/** Trash bin (1×1). */
export function buildTrash() {
  const g = new THREE.Group();
  g.add(mesh(roundedBox(0.8, 0.05, 0.8, 0.03), mat(PALETTE.choc), 0, 0.025, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.33, 0.27, 0.55, 20), mat('#9fb4c7', { roughness: 0.4, metalness: 0.2 }), 0, 0.3, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(mesh(roundedBox(0.04, 0.45, 0.02, 0.01), mat('#8aa0b5'), Math.cos(a) * 0.31, 0.3, Math.sin(a) * 0.31));
  }
  const lid = new THREE.Group();
  lid.position.set(0, 0.59, 0);
  lid.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 20), mat(PALETTE.mint), 0, 0, 0));
  lid.add(mesh(roundedBox(0.18, 0.06, 0.06, 0.02), mat(PALETTE.mintDark), 0, 0.06, 0));
  g.add(lid);
  return { group: g, parts: { lid } };
}

export const MODEL_BUILDERS = {
  oven: buildOven, delivery: buildDelivery, froster: buildFroster, cutter: buildCutter,
  rotator: buildRotator, combiner: buildCombiner, trash: buildTrash,
};
