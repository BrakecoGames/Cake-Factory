/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Reads simulation state and draws it. Never modifies production logic.
 *  - Belts: 4 InstancedMeshes for the whole factory (rebuilt only when the
 *    layout changes; colours refreshed per frame for blocked feedback).
 *  - Machines: individual procedural models (few, richly animated).
 *  - Cakes: CakeRenderer (instanced), positions interpolated between ticks.
 */
import * as THREE from 'three';
import { DX, DY, opposite, rotatePoint } from '../simulation/Grid.js';
import { Machine, STATUS } from '../machines/Machine.js';
import { getDef } from '../machines/MachineDefs.js';
import { BELT } from '../core/Config.js';
import { CakeRenderer } from '../cakes/CakeRenderer.js';
import { EffectsManager } from './EffectsManager.js';
import {
  MODEL_BUILDERS, buildAlertSprite, arrowGeometry, textures, roundedBox, cylinder, mat, PALETTE,
} from './ModelFactory.js';
import { FROSTINGS, FLAVORS } from '../cakes/CakeModel.js';
import { ConveyorRenderer, SURF } from './ConveyorRenderer.js';
import { ShopRenderer } from './ShopRenderer.js';
import { pointAt } from '../machines/Paths.js';
import { frost } from '../cakes/CakeOperations.js';

const ALERT_H = { oven: 1.35, delivery: 1.8, froster: 1.45, cutter: 1.25, rotator: 0.95, combiner: 1.35, trash: 1.05 };
/** Machines whose every side is an input – no port decals needed. */
const OMNI = new Set(['delivery', 'trash']);

const CAKE_Y = SURF + 0.005;
const dirAngle = (d) => -d * Math.PI / 2; // rotation.y that points local +X along dir

export class FactoryRenderer {
  constructor(sceneManager, game) {
    this.sm = sceneManager;
    this.scene = sceneManager.scene;
    this.game = game;
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.machineViews = new Map();
    this.beltsDirty = true;
    this.time = 0;
    this.cakes = new CakeRenderer(this.scene);
    this.effects = new EffectsManager(this.scene);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    this._y = new THREE.Vector3(0, 1, 0);
    this.conv = new ConveyorRenderer(this.scene, this);
    this._buildPortDecals();
    this._buildOverlays();

    const bus = game.bus;
    bus.on('reset', () => this.fullSync());
    bus.on('entityAdded', (e) => { this._onAdded(e); });
    bus.on('entityRemoved', (e) => { this._onRemoved(e); });
    bus.on('entityChanged', (e) => { this._onChanged(e); });
    bus.on('itemDestroyed', (ev) => this.effects.poof(this.gridToWorld(ev.x, ev.y, 0.3)));
    bus.on('trashed', (ev) => {
      const v = this.machineViews.get(ev.machineId);
      if (v) { v.hop = 0.35; this.effects.poof(v.group.position.clone().setY(0.7)); }
    });
    bus.on('machineUpgraded', (e) => {
      const v = this.machineViews.get(e.id);
      if (!v) return;
      v.pop = 0.35;
      this.effects.burst(v.group.position.clone().setY(0.8), '#ffd84d', 18, 2);
      this._setStars(v);
    });
    bus.on('processed', (ev) => {
      const v = this.machineViews.get(ev.machineId);
      if (v) this.effects.burst(v.group.position.clone().setY(0.55), '#fff6c8', 5, 0.8);
    });
    bus.on('delivered', (ev) => {
      const v = this.machineViews.get(ev.machineId);
      const pos = v ? v.group.position.clone().setY(0.6) : this.gridToWorld(ev.x + 0.5, ev.y + 0.5, 0.6);
      this.effects.burst(pos, ev.accepted ? '#ffe27a' : '#ff7b8d', ev.accepted ? 10 : 6);
    });
    this.fullSync();
    this.shop = new ShopRenderer(this);
  }

  // ------------------------------------------------------------ coordinates
  get W() { return this.game.sim.width; }
  get H() { return this.game.sim.height; }
  /** Grid units (cell centre = +0.5) → world. */
  gridToWorld(gx, gy, y = 0, out = new THREE.Vector3()) {
    return out.set(gx - this.W / 2, y, gy - this.H / 2);
  }
  worldToCell(v) {
    return { x: Math.floor(v.x + this.W / 2), y: Math.floor(v.z + this.H / 2) };
  }
  footprintCenter(type, x, y, rot) {
    const def = getDef(type);
    const [w, h] = (rot & 1) ? [def.h, def.w] : [def.w, def.h];
    return this.gridToWorld(x + w / 2, y + h / 2, 0);
  }

  // ------------------------------------------------------------ environment
  _buildEnvironment() {
    if (this.env) { this.root.remove(this.env); }
    const env = new THREE.Group();
    this.env = env;
    const W = this.W, H = this.H;
    const t = textures();

    // Outer bakery floor + factory tiles.
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(W + 12, H + 12), mat('#f3d4e0', { roughness: 0.9 }));
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; outer.receiveShadow = true;
    const floorTex = t.floor.clone(); floorTex.needsUpdate = true; floorTex.repeat.set(W / 2, H / 2);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    const border = new THREE.Mesh(roundedBox(W + 0.5, 0.08, H + 0.5, 0.04), mat(PALETTE.pinkDark));
    border.position.y = -0.045; border.receiveShadow = true;
    env.add(outer, border, floor);

    // Grid lines.
    const pts = [];
    for (let x = 0; x <= W; x++) pts.push(x - W / 2, 0.003, -H / 2, x - W / 2, 0.003, H / 2);
    for (let y = 0; y <= H; y++) pts.push(-W / 2, 0.003, y - H / 2, W / 2, 0.003, y - H / 2);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.gridLines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#d79aae', transparent: true, opacity: 0.25 }));
    env.add(this.gridLines);

    // Walls on all four sides; only the two far from the camera are shown.
    const wallTex = t.wall.clone(); wallTex.needsUpdate = true;
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.85 });
    const shelfMat = mat(PALETTE.cream);
    this.walls = [];
    const D = 4.5; // distance from grid edge
    const mk = (len, nx, nz, shelves = true) => {
      const g = new THREE.Group();
      const tex = wallTex.clone(); tex.needsUpdate = true; tex.repeat.set(len / 2, 1);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(len, 2.2, 0.25), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
      wall.position.y = 1.1; wall.receiveShadow = true;
      g.add(wall);
      // Shelves with jars.
      for (let i = -len / 2 + 2; shelves && i < len / 2 - 1; i += 4) {
        const shelf = new THREE.Mesh(roundedBox(2, 0.08, 0.4, 0.03), shelfMat);
        shelf.position.set(i, 1.3, 0.3); g.add(shelf);
        const colors = [PALETTE.pink, PALETTE.mint, PALETTE.vanilla, PALETTE.sky, PALETTE.lavender];
        for (let j = 0; j < 3; j++) {
          const jar = new THREE.Mesh(cylinder(0.13, 0.13, 0.3, 14), mat(colors[(Math.abs(i) + j) % colors.length], { roughness: 0.3 }));
          jar.position.set(i - 0.6 + j * 0.6, 1.5, 0.3); jar.castShadow = true; g.add(jar);
        }
      }
      g.position.set(nx * (W / 2 + D), 0, nz * (H / 2 + D));
      g.rotation.y = Math.atan2(nx, nz) + Math.PI;
      g.userData.normal = new THREE.Vector2(nx, nz);
      env.add(g);
      this.walls.push(g);
    };
    // The east wall gets no jar shelves: the Cake Shop display cabinet stands there.
    mk(W + 9, 0, -1); mk(W + 9, 0, 1); mk(H + 9, -1, 0); mk(H + 9, 1, 0, false);
    wallMat.dispose();

    // Bakery props around the factory floor (outside the buildable grid).
    const props = [
      [-W / 2 - 1.6, -H / 2 + 2, 'sack'], [-W / 2 - 1.5, -H / 2 + 3.2, 'sack'], [W / 2 + 1.6, H / 2 - 3, 'plant'],
      [-W / 2 - 1.8, H / 2 - 2, 'plant'], [W / 2 + 1.7, -H / 2 + 2.5, 'crate'], [W / 2 + 1.6, -H / 2 + 4, 'crate'],
      [-2, -H / 2 - 1.8, 'plant'], [4, -H / 2 - 1.7, 'sack'], [3, H / 2 + 1.8, 'crate'], [-5, H / 2 + 1.7, 'sack'],
    ];
    for (const [x, z, kind] of props) env.add(this._prop(kind, x, z));
    this.root.add(env);
  }

  _prop(kind, x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    if (kind === 'sack') {
      const s = new THREE.Mesh(roundedBox(0.7, 0.8, 0.5, 0.22), mat('#f5ecd9', { roughness: 0.95 }));
      s.position.y = 0.4; s.castShadow = true; g.add(s);
      const label = new THREE.Mesh(roundedBox(0.35, 0.22, 0.02, 0.05), mat(PALETTE.pink));
      label.position.set(0, 0.42, 0.26); g.add(label);
    } else if (kind === 'crate') {
      const c = new THREE.Mesh(roundedBox(0.8, 0.6, 0.8, 0.05), mat('#d9a066'));
      c.position.y = 0.3; c.castShadow = true; g.add(c);
      for (let i = 0; i < 3; i++) {
        const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mat(['#ff4d6d', '#ffd84d', '#7d8ee8'][i], { roughness: 0.4 }));
        fruit.position.set(-0.22 + i * 0.22, 0.68, 0); fruit.castShadow = true; g.add(fruit);
      }
    } else {
      const pot = new THREE.Mesh(cylinder(0.3, 0.22, 0.45, 16), mat(PALETTE.sky));
      pot.position.y = 0.22; pot.castShadow = true; g.add(pot);
      for (let i = 0; i < 4; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), mat(PALETTE.mintDark, { roughness: 0.7 }));
        leaf.position.set(Math.cos(i * 1.6) * 0.15, 0.7 + i * 0.1, Math.sin(i * 1.6) * 0.15); leaf.castShadow = true; g.add(leaf);
      }
    }
    return g;
  }

  _updateWalls() {
    const az = this.camAzimuth ?? Math.PI / 4;
    const cx = Math.cos(az), cz = Math.sin(az);
    for (const w of this.walls) w.visible = (w.userData.normal.x * cx + w.userData.normal.y * cz) < -0.1;
  }

  // ------------------------------------------------------------ belts
  _buildPortDecals() {
    const mk = (color) => {
      const im = new THREE.InstancedMesh(arrowGeometry(), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }), 512);
      im.count = 0; im.frustumCulled = false; im.renderOrder = 4;
      this.scene.add(im);
      return im;
    };
    this.portDecals = { in: mk('#36c98a'), out: mk('#ff9a3d') };
  }

  /** Small permanent arrows at every directional machine port (input = green, output = orange). */
  _rebuildPortDecals() {
    let ni = 0, no = 0;
    const put = (im, i, port, out) => {
      const ex = port.x + 0.5 + DX[port.dir] * (out ? 0.56 : 0.66);
      const ey = port.y + 0.5 + DY[port.dir] * (out ? 0.56 : 0.66);
      const w = this.gridToWorld(ex, ey, 0.012);
      this._q.setFromAxisAngle(this._y, dirAngle(out ? port.dir : opposite(port.dir)));
      this._s.setScalar(0.55);
      this._m.compose(w, this._q, this._s);
      this._s.setScalar(1);
      im.setMatrixAt(i, this._m);
    };
    for (const e of this.game.sim.entities.values()) {
      if (e.kind !== 'machine' || OMNI.has(e.type)) continue;
      for (const p of e.outputs) if (no < 512) put(this.portDecals.out, no++, p, true);
      for (const p of e.inputs) if (ni < 512) put(this.portDecals.in, ni++, p, false);
    }
    this.portDecals.in.count = ni; this.portDecals.out.count = no;
    this.portDecals.in.instanceMatrix.needsUpdate = true;
    this.portDecals.out.instanceMatrix.needsUpdate = true;
  }

  _rebuildBelts() {
    this.conv.rebuild(this.game.sim);
    this._rebuildPortDecals();
    this.beltsDirty = false;
  }

  // ------------------------------------------------------------ machines
  fullSync() {
    for (const v of this.machineViews.values()) this.root.remove(v.group);
    this.machineViews.clear();
    this._buildEnvironment();
    this.shop?.rebuild();
    for (const e of this.game.sim.entities.values()) if (e.kind === 'machine') this._createMachineView(e);
    this.beltsDirty = true;
  }

  _createMachineView(e) {
    const built = MODEL_BUILDERS[e.type]();
    const holder = new THREE.Group();
    holder.add(built.group);
    const alert = buildAlertSprite();
    alert.visible = false;
    holder.add(alert);
    alert.position.set(0, ALERT_H[e.type] ?? 1.3, 0);
    const v = { group: holder, model: built.group, parts: built.parts, alert, entity: e, steamT: 0, pop: 0.35, hop: 0, spin: 0 };
    this._placeMachineView(v);
    this.root.add(holder);
    this.machineViews.set(e.id, v);
    this._setStars(v);
    return v;
  }

  /** Small floating "★N" badge for upgraded machines. */
  _setStars(v) {
    const lv = v.entity.level;
    if (v.stars) { v.group.remove(v.stars); v.stars.material.map.dispose(); v.stars.material.dispose(); v.stars = null; }
    if (lv < 2) return;
    const c = document.createElement('canvas'); c.width = 96; c.height = 40;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(74,44,58,0.85)'; g.beginPath(); g.roundRect(2, 2, 92, 36, 16); g.fill();
    g.fillStyle = '#ffd84d'; g.font = 'bold 26px "Fredoka", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`★${lv}`, 48, 21);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    sp.scale.set(0.42, 0.18, 1);
    sp.position.set(0, (ALERT_H[v.entity.type] ?? 1.3) - 0.25, 0);
    sp.renderOrder = 9;
    v.group.add(sp);
    v.stars = sp;
  }

  _placeMachineView(v) {
    const e = v.entity;
    v.group.position.copy(this.footprintCenter(e.type, e.x, e.y, e.rot));
    v.model.rotation.y = dirAngle(e.rot);
  }

  _onAdded(e) {
    if (e.kind === 'belt') this.beltsDirty = true;
    else { this._createMachineView(e); this.beltsDirty = true; }
  }
  _onRemoved(e) {
    this.beltsDirty = true;
    const v = this.machineViews.get(e.id);
    if (v) { this.root.remove(v.group); this.machineViews.delete(e.id); }
  }
  _onChanged(e) {
    this.beltsDirty = true;
    const v = this.machineViews.get(e.id);
    if (v) { this._placeMachineView(v); v.pop = 0.25; }
  }

  // ------------------------------------------------------------ overlays
  _buildOverlays() {
    // Hover cell outline.
    const hoverGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.98, 0.98).rotateX(-Math.PI / 2));
    this.hover = new THREE.LineSegments(hoverGeo, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }));
    this.hover.visible = false;
    this.hover.position.y = 0.02;
    this.scene.add(this.hover);

    // Placement footprint tint.
    this.footMat = new THREE.MeshBasicMaterial({ color: '#5de39a', transparent: true, opacity: 0.35, depthWrite: false });
    this.foot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.footMat);
    this.foot.position.y = 0.015; this.foot.visible = false; this.foot.renderOrder = 2;
    this.scene.add(this.foot);

    // Selection outline.
    this.selBox = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }));
    this.selBox.visible = false; this.selBox.position.y = 0.018;
    this.scene.add(this.selBox);

    // Port arrows pool.
    this.arrowIn = new THREE.MeshBasicMaterial({ color: '#36c98a', transparent: true, opacity: 0.95, depthTest: false });
    this.arrowOut = new THREE.MeshBasicMaterial({ color: '#ff9a3d', transparent: true, opacity: 0.95, depthTest: false });
    this.arrows = [];
    for (let i = 0; i < 24; i++) {
      const a = new THREE.Mesh(arrowGeometry(), this.arrowIn);
      a.visible = false; a.renderOrder = 8; a.scale.setScalar(0.8);
      this.scene.add(a); this.arrows.push(a);
    }

    // Ghosts.
    this.ghostMat = new THREE.MeshStandardMaterial({ color: '#5de39a', transparent: true, opacity: 0.55, depthWrite: false, emissive: '#2b8f5c', emissiveIntensity: 0.4 });
    this.ghosts = {};
    for (const type of Object.keys(MODEL_BUILDERS)) {
      const built = MODEL_BUILDERS[type]();
      built.group.traverse((o) => { if (o.isMesh) { o.material = this.ghostMat; o.castShadow = false; } });
      const holder = new THREE.Group(); holder.add(built.group); holder.visible = false;
      holder.userData.model = built.group;
      this.scene.add(holder);
      this.ghosts[type] = holder;
    }
    this.beltGhostMat = new THREE.MeshBasicMaterial({ color: '#5de39a', transparent: true, opacity: 0.5, depthWrite: false });
    this.beltGhostBad = new THREE.MeshBasicMaterial({ color: '#ff6b81', transparent: true, opacity: 0.5, depthWrite: false });
    this.beltGhostArrow = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthTest: false });
    this.beltGhosts = [];
    this.ghostGeo = roundedBox(0.92, 0.1, 0.92, 0.04, 2);

    // Tutorial highlights.
    const ringGeo = new THREE.RingGeometry(0.95, 1.12, 40).rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({ color: '#ffd84d', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    this.rings = [0, 1].map(() => { const r = new THREE.Mesh(ringGeo, this.ringMat); r.visible = false; r.position.y = 0.03; r.renderOrder = 3; this.scene.add(r); return r; });
    this.hintArrow = new THREE.Mesh(arrowGeometry(), new THREE.MeshBasicMaterial({ color: '#ffd84d', transparent: true, depthTest: false }));
    this.hintArrow.visible = false; this.hintArrow.renderOrder = 9;
    this.scene.add(this.hintArrow);
  }

  _beltGhost(i) {
    while (this.beltGhosts.length <= i) {
      const g = new THREE.Group();
      const base = new THREE.Mesh(this.ghostGeo, this.beltGhostMat); base.position.y = SURF - 0.05;
      const arrow = new THREE.Mesh(arrowGeometry(), this.beltGhostArrow); arrow.position.y = SURF + 0.02; arrow.renderOrder = 9;
      g.add(base, arrow); g.userData = { base, arrow }; g.visible = false;
      this.scene.add(g); this.beltGhosts.push(g);
    }
    return this.beltGhosts[i];
  }

  /**
   * Preview state written by the InputController every frame:
   * { hoverCell, machine: {type,x,y,rot,valid}, belts: [{x,y,dir,valid}], selectedId, ports }
   */
  setPreview(p) { this.preview = p; }

  _hideArrows() { for (const a of this.arrows) a.visible = false; }

  _showPorts(def, x, y, rot, startIndex = 0) {
    const ports = Machine.worldPorts(def, x, y, rot);
    let i = startIndex;
    const place = (port, out) => {
      if (i >= this.arrows.length) return;
      const a = this.arrows[i++];
      const ex = port.x + 0.5 + DX[port.dir] * (out ? 0.62 : 0.72);
      const ey = port.y + 0.5 + DY[port.dir] * (out ? 0.62 : 0.72);
      this.gridToWorld(ex, ey, 0.05, a.position);
      a.rotation.y = dirAngle(out ? port.dir : opposite(port.dir));
      a.material = out ? this.arrowOut : this.arrowIn;
      a.visible = true;
    };
    for (const p of ports.outputs) place(p, true);
    for (const p of ports.inputs) place(p, false);
    return i;
  }

  _updatePreview() {
    const p = this.preview || {};
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
    this._hideArrows();
    // Hover
    if (p.hoverCell && this.game.sim.grid.inBounds(p.hoverCell.x, p.hoverCell.y)) {
      this.gridToWorld(p.hoverCell.x + 0.5, p.hoverCell.y + 0.5, 0.02, this.hover.position);
      this.hover.visible = true;
    } else this.hover.visible = false;

    // Machine ghost
    for (const [type, g] of Object.entries(this.ghosts)) g.visible = !!(p.machine && p.machine.type === type);
    let arrowsUsed = 0;
    if (p.machine) {
      const m = p.machine;
      const g = this.ghosts[m.type];
      if (g) {
        g.position.copy(this.footprintCenter(m.type, m.x, m.y, m.rot)).setY(0.02 + pulse * 0.03);
        g.userData.model.rotation.y = dirAngle(m.rot);
      }
      this.ghostMat.color.set(m.valid ? '#5de39a' : '#ff6b81');
      this.ghostMat.emissive.set(m.valid ? '#2b8f5c' : '#a3203a');
      const def = getDef(m.type);
      const [w, h] = (m.rot & 1) ? [def.h, def.w] : [def.w, def.h];
      this.foot.visible = true;
      this.foot.scale.set(w, 1, h);
      this.foot.position.copy(this.footprintCenter(m.type, m.x, m.y, m.rot)).setY(0.015);
      this.footMat.color.set(m.valid ? '#5de39a' : '#ff6b81');
      arrowsUsed = this._showPorts(def, m.x, m.y, m.rot, 0);
    } else this.foot.visible = false;

    // Belt ghosts
    const belts = p.belts || [];
    for (let i = 0; i < Math.max(belts.length, this.beltGhosts.length); i++) {
      const g = this._beltGhost(i);
      const b = belts[i];
      if (!b) { g.visible = false; continue; }
      g.visible = true;
      this.gridToWorld(b.x + 0.5, b.y + 0.5, 0.0, g.position);
      g.userData.base.material = b.valid ? this.beltGhostMat : this.beltGhostBad;
      g.userData.arrow.rotation.y = dirAngle(b.dir);
    }

    // Selection
    const sel = p.selectedId ? this.game.sim.entities.get(p.selectedId) : null;
    if (sel) {
      const def = sel.def;
      const [w, h] = sel.kind === 'belt' ? [1, 1] : ((sel.rot & 1) ? [def.h, def.w] : [def.w, def.h]);
      this.selBox.visible = true;
      this.selBox.scale.set(w + 0.1, 1, h + 0.1);
      this.selBox.position.copy(this.footprintCenter(sel.type, sel.x, sel.y, sel.rot)).setY(0.018);
      this.selBox.material.opacity = 0.25 + pulse * 0.25;
      if (sel.kind === 'machine') this._showPorts(def, sel.x, sel.y, sel.rot, arrowsUsed);
    } else this.selBox.visible = false;

    this.gridLines.material.opacity = p.building ? 0.55 : 0.22;
  }

  /** Tutorial highlight targets: ['oven','delivery','ovenOutput'] */
  setHighlights(list) { this.highlights = list || []; }

  _updateHighlights() {
    const list = this.highlights || [];
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4);
    this.rings.forEach((r) => { r.visible = false; });
    this.hintArrow.visible = false;
    let ri = 0;
    for (const target of list) {
      if (target === 'ovenOutput') {
        const oven = [...this.game.sim.entities.values()].find((e) => e.type === 'oven');
        if (!oven) continue;
        const o = oven.outputs[0];
        this.gridToWorld(o.nx + 0.5 + DX[o.dir] * 0.1 * pulse, o.ny + 0.5 + DY[o.dir] * 0.1 * pulse, 0.06, this.hintArrow.position);
        this.hintArrow.rotation.y = dirAngle(o.dir);
        this.hintArrow.scale.setScalar(1.6 + pulse * 0.3);
        this.hintArrow.visible = true;
        continue;
      }
      const e = [...this.game.sim.entities.values()].find((x) => x.type === target);
      if (!e || ri >= this.rings.length) continue;
      const r = this.rings[ri++];
      r.position.copy(this.footprintCenter(e.type, e.x, e.y, e.rot)).setY(0.03);
      const s = (e.def.w > 1 ? 1.5 : 0.8) * (1 + pulse * 0.12);
      r.scale.set(s, 1, s);
      r.visible = true;
    }
    this.ringMat.opacity = 0.55 + pulse * 0.4;
  }

  /** Machine-local point (def units) → world position at height y. */
  _machinePoint(e, lx, ly, y, out) {
    const [px, py] = rotatePoint(lx, ly, e.def.w, e.def.h, e.rot);
    return this.gridToWorld(e.x + px, e.y + py, y, out);
  }

  _drawProcessorCakes(e, tmp) {
    const def = e.def;
    const paths = def.paths;
    const pt = this._pt || (this._pt = [0, 0]);
    const stageY = CAKE_Y + (e.type === 'rotator' ? 0.02 : e.type === 'froster' ? 0.02 : 0);
    // Cake(s) stopped on the stage while being processed.
    if (e.current) {
      this._machinePoint(e, def.stage.x, def.stage.y, stageY, tmp);
      let rotY = 0;
      let shown = e.current;
      if (e.type === 'froster') {
        // Spins with the turntable; the frosting appears as the spatula spreads it.
        rotY = -e.progress * Math.PI * 4;
        if (e.progress > 0.35) {
          const src = e.current[0];
          if (!e._frostPreview || e._frostPreview.src !== src || e._frostPreview.color !== e.config.color) {
            e._frostPreview = { src, color: e.config.color, cake: frost(src, e.config.color) };
          }
          shown = [e._frostPreview.cake];
        }
      } else if (e.type === 'rotator') {
        const k = e.progress;
        const ease = k * k * (3 - 2 * k);
        rotY = e.config.mode === 'ccw' ? ease * Math.PI / 2 : e.config.mode === '180' ? -ease * Math.PI : -ease * Math.PI / 2;
      }
      for (const c of shown) if (c) this.cakes.add(c, tmp.x, tmp.y, tmp.z, 1, rotY);
    }
    // Pieces riding the machine's own belts to the exits…
    for (let i = 0; i < e.nOut; i++) {
      const c = e.outSlots[i];
      if (!c) continue;
      pointAt(paths.out[i], e.outProg[i], pt);
      this._machinePoint(e, pt[0], pt[1], CAKE_Y, tmp);
      this.cakes.add(c, tmp.x, tmp.y, tmp.z);
    }
    // …and incoming cakes riding to the stage.
    for (let i = 0; i < e.nIn; i++) {
      const c = e.inSlots[i];
      if (!c) continue;
      pointAt(paths.in[i], e.inProg[i], pt);
      const lift = i > 0 && e.inProg[i] > 0.5 ? 0.03 : 0;
      this._machinePoint(e, pt[0], pt[1], CAKE_Y + lift, tmp);
      this.cakes.add(c, tmp.x, tmp.y, tmp.z);
    }
  }

  _animateMachine(v, e, dt) {
    const working = e.status === STATUS.WORKING;
    const P = v.parts;
    switch (e.type) {
      case 'froster': {
        const col = FROSTINGS[e.config.color]?.color || '#ffffff';
        P.bagMat.color.set(col);
        P.spatulaMat.color.set(e.working && e.progress > 0.2 ? col : '#ffffff');
        // The turntable spins the cake two full turns while the spatula spreads the frosting.
        P.table.rotation.y = e.working ? -e.progress * Math.PI * 4 : 0;
        P.arm.position.y = e.working ? -Math.sin(e.progress * Math.PI) * 0.012 : 0.03;
        break;
      }
      case 'cutter': {
        // Blade carriage stays on the world north–south cut line (cakes keep world orientation).
        P.bladeHolder.rotation.y = -dirAngle(e.rot);
        // Stroke: parked above the cake → drop beside it → slide right through → back → rise.
        const CUT_Y = SURF + 0.12, UP_Y = SURF + 0.42, SIDE = 0.58, FAR = -0.4;
        let y = UP_Y, z = SIDE;
        if (e.working) {
          const k = e.progress;
          const ease = (t) => t * t * (3 - 2 * t);
          if (k < 0.15) y = UP_Y + (CUT_Y - UP_Y) * ease(k / 0.15);
          else if (k < 0.85) {
            y = CUT_Y;
            const t = (k - 0.15) / 0.7;                 // there and back
            z = SIDE + (FAR - SIDE) * Math.sin(t * Math.PI);
          } else y = CUT_Y + (UP_Y - CUT_Y) * ease((k - 0.85) / 0.15);
        }
        P.blade.position.set(0, y, z);
        v.spin += dt * (e.working ? 22 : 0);
        P.spinner.rotation.x = v.spin;
        // Pusher follows the right half while it is pushed across, then retracts.
        let target = P.pusherHome;
        const c = e.outSlots[1];
        if (c) {
          const pushLen = 1.0;                           // first leg of the R path
          const pushT = Math.min(1, (e.outProg[1] * e.outLen[1]) / pushLen);
          if (pushT < 1) target = Math.max(P.pusherHome, -0.5 + pushT * 1.0 - 0.39);
        }
        const cur = P.pusher.position.z;
        P.pusher.position.z = target > cur ? target : cur + (target - cur) * Math.min(1, dt * 8);
        // Rod between the cylinder and the plate.
        const len = Math.max(0.02, P.pusher.position.z - P.rodBaseZ);
        P.pRod.scale.set(1, len, 1);
        P.pRod.position.set(P.rodX, SURF + 0.09, P.rodBaseZ + len / 2);
        P.pusher.position.x = P.pusherX;
        break;
      }
      case 'rotator':
        if (e.working) {
          const k = e.progress; const ease = k * k * (3 - 2 * k);
          P.table.rotation.y = -ease * Math.PI / 2;
        } else P.table.rotation.y = 0;
        break;
      case 'combiner':
        P.press.position.y = P.pressY - (e.working ? Math.sin(e.progress * Math.PI) * 0.22 : 0);
        break;
      case 'trash':
        if (v.hop > 0) v.hop = Math.max(0, v.hop - dt);
        P.lid.position.y = 0.59 + Math.sin((v.hop / 0.35) * Math.PI) * 0.18;
        P.lid.rotation.z = Math.sin((v.hop / 0.35) * Math.PI) * 0.4;
        break;
      default: break;
    }
    if (e.outSlots) {
      const bad = (e.status === STATUS.BLOCKED || e.status === STATUS.NO_OUTPUT || e.status === STATUS.INCOMPATIBLE) && e.blockedTime > 0.6;
      v.alert.visible = bad;
      if (bad) v.alert.position.y = (ALERT_H[e.type] ?? 1.3) + Math.sin(this.time * 4) * 0.05;
    }
  }

  // ------------------------------------------------------------ frame
  render(dt, alpha, camAzimuth) {
    this.time += dt;
    this.camAzimuth = camAzimuth;
    if (this.beltsDirty) this._rebuildBelts();
    this.conv.updateColors(this.preview?.replaced, this.time);
    this.conv.scroll(this.game.sim.beltSpeed, dt); // belt surface moves exactly as fast as the cakes
    this._updateWalls();

    // Cakes on belts (interpolated) + cakes waiting in machine buffers.
    const sim = this.game.sim;
    this.cakes.begin();
    const tmp = this._p;
    for (const e of sim.entities.values()) {
      if (e.kind === 'belt') {
        const it = e.item;
        if (!it) continue;
        const g2 = this.conv.cakeGridPos(e, it, alpha, this._g2 || (this._g2 = [0, 0]));
        this.gridToWorld(g2[0], g2[1], CAKE_Y, tmp);
        this.cakes.add(it.cake, tmp.x, tmp.y, tmp.z);
      } else if (e.type === 'oven' && e.buffer.length) {
        const o = e.outputs[0];
        this.gridToWorld(o.x + 0.5 + DX[o.dir] * 0.34, o.y + 0.5 + DY[o.dir] * 0.34, SURF - 0.02, tmp);
        this.cakes.add(e.buffer[0], tmp.x, tmp.y, tmp.z, 0.7);
      } else if (e.outSlots) {
        this._drawProcessorCakes(e, tmp);
      }
    }
    this.cakes.end();

    // Machine animation.
    for (const v of this.machineViews.values()) {
      const e = v.entity;
      if (v.pop > 0) { v.pop = Math.max(0, v.pop - dt); const s = 1 + Math.sin((v.pop / 0.35) * Math.PI) * 0.12; v.model.scale.setScalar(s); }
      if (e.type === 'oven') {
        const working = e.status === STATUS.WORKING;
        if (v.parts.iconMat) v.parts.iconMat.color.set(FLAVORS[e.config.flavor]?.color || '#ffe6a3');
        v.parts.glowMat.emissiveIntensity = working ? 0.6 + e.progress * 1.6 + Math.sin(this.time * 9) * 0.15 : 0.25;
        if (working) {
          v.parts.gear.rotation.z += dt * 3;
          v.steamT -= dt;
          if (v.steamT <= 0) {
            v.steamT = 0.35;
            const wp = v.parts.chimneyTop.clone().applyEuler(v.model.rotation).add(v.group.position);
            this.effects.steam(wp);
          }
        }
        const blocked = (e.status === STATUS.BLOCKED || e.status === STATUS.NO_OUTPUT) && e.blockedTime > 0.6;
        v.alert.visible = blocked;
        if (blocked) v.alert.position.y = ALERT_H.oven + Math.sin(this.time * 4) * 0.05;
      } else if (e.type === 'delivery') {
        v.parts.flashMat.emissiveIntensity = e.flash * 0.9;
      } else {
        this._animateMachine(v, e, dt);
      }
    }

    this._updatePreview();
    this._updateHighlights();
    this.effects.scale = this.sm.particleScale;
    this.effects.update(dt);
    this.shop.update(dt);
  }

  get drawCalls() { return this.sm.renderer.info.render.calls; }
}
