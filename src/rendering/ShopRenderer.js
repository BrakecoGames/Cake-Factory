/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * The cake shop counter on the right (east) side of the factory, with
 * customers who bring in orders and pick them up.
 *
 * Purely visual – it reads game state and bus events, never changes them:
 *  - A customer walks in and shows the current order in a speech bubble.
 *  - Every correct cake flies as a cake box from the delivery station to the
 *    counter and is stacked there.
 *  - When the order is complete the customer takes the boxes, says thanks and
 *    walks out; the next customer walks in with the next order.
 */
import * as THREE from 'three';
import { textures, roundedBox, cylinder, mat, PALETTE } from './ModelFactory.js';
import { parseCakeKey } from '../cakes/CakeSerializer.js';
import { drawCake } from '../ui/CakePreview.js';

const COUNTER_LEN = 9;        // cells along the factory's east edge

/** Position a mesh (Object3D.position is read-only, so it can't be assigned). */
function place(m, x, y, z) {
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const WALK_SPEED = 2.2;       // world units / second
const BOX_FLIGHT = 0.8;       // seconds
const MAX_STACK = 18;         // boxes drawn on the counter

const SKIN = ['#f6d3b8', '#e8b48f', '#c98b62', '#8d5a3b', '#f2c6a0', '#5e3b26'];
const SHIRT = ['#7fdcb0', '#8fcbff', '#c9b6ff', '#ffb36b', '#ff8fb1', '#ffe27a', '#6fc3c9', '#b0d36b'];
const HAIR = ['#3b2a20', '#7a4a2e', '#d9a35b', '#1d1a22', '#b5562e', '#e8e0d0'];

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

export class ShopRenderer {
  constructor(fr) {
    this.fr = fr;
    this.game = fr.game;
    this.scene = fr.scene;
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.customers = [];
    this.flying = [];
    this.stackCount = 0;      // boxes that have landed on the counter
    this.inFlight = 0;
    this.time = 0;
    this.onCustomerArrived = () => {};
    this.boxGeo = roundedBox(0.26, 0.2, 0.26, 0.03, 2);
    this.ribbonGeo = roundedBox(0.27, 0.03, 0.06, 0.01, 1);
    this.boxMat = mat('#ffffff', { roughness: 0.5 });
    this.ribbonMat = mat(PALETTE.pink);

    const bus = this.game.bus;
    bus.on('delivered', (ev) => { if (ev.accepted) this._launchBox(ev); });
    bus.on('orderCompleted', (ev) => this._completeOrder(ev));
    this.rebuild();
  }

  // ---------------------------------------------------------------- layout
  get W() { return this.game.sim.width; }
  get H() { return this.game.sim.height; }
  /** Counter centre (world). The factory side is west (-X), customers stand east (+X). */
  get counterPos() { return new THREE.Vector3(this.W / 2 + 1.3, 0, 0); }
  get standPos() { return new THREE.Vector3(this.W / 2 + 2.45, 0, 0.1); }
  get spawnPos() { return new THREE.Vector3(this.W / 2 + 2.45, 0, this.H / 2 + 3.6); }
  get exitPos() { return new THREE.Vector3(this.W / 2 + 2.45, 0, -this.H / 2 - 3.2); }
  /** Display cabinet against the east wall (behind the customers). */
  get vitrinePos() { return new THREE.Vector3(this.W / 2 + 3.95, 0, 0); }

  /** Called on reset / expansion: rebuild the counter and put the current customer in place. */
  rebuild() {
    for (const c of this.customers) this.root.remove(c.group);
    for (const f of this.flying) this.root.remove(f.mesh);
    this.customers = []; this.flying = []; this.inFlight = 0;
    if (this.counter) this.root.remove(this.counter);
    this.counter = this._buildCounter();
    this.counter.position.copy(this.counterPos);
    this.root.add(this.counter);
    if (this.vitrine) this.root.remove(this.vitrine);
    this.vitrine = this._buildVitrine();
    this.vitrine.position.copy(this.vitrinePos);
    this.root.add(this.vitrine);
    this.stackCount = Math.min(this.game.orders.delivered, MAX_STACK);
    this._layoutStack();
    // The current order's customer is already waiting at the counter.
    const c = this._spawn(this.game.orders.current, true);
    c.state = 'waiting';
    c.group.position.copy(this.standPos);
    c.group.rotation.y = Math.PI; // face the counter (west, -X)
    c.bubble.visible = true;
  }

  _buildCounter() {
    const g = new THREE.Group();
    const t = textures();
    // Counter body: customers on +X, staff side toward the factory.
    const L = COUNTER_LEN;
    const body = new THREE.Mesh(roundedBox(0.9, 0.85, L, 0.08), mat(PALETTE.pink));
    body.position.set(0, 0.425, 0); body.castShadow = true; body.receiveShadow = true;
    const top = new THREE.Mesh(roundedBox(1.05, 0.08, L + 0.15, 0.04), mat(PALETTE.cream));
    top.position.set(0.02, 0.89, 0); top.castShadow = true;
    const stripe = new THREE.Mesh(roundedBox(0.02, 0.12, L - 0.2, 0.01), mat(PALETTE.white));
    stripe.position.set(0.46, 0.6, 0);
    g.add(body, top, stripe);
    // Glass display case with cakes (north end of the counter).
    const glass = new THREE.Mesh(roundedBox(0.7, 0.42, 1.0, 0.05),
      new THREE.MeshStandardMaterial({ color: '#dff4ff', transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1 }));
    glass.position.set(0, 1.14, -L / 2 + 0.8);
    g.add(glass);
    const displayColors = [['#f6dfa4', '#ff8fb8'], ['#7a4a2e', '#fffaf2'], ['#f49ab0', '#ffffff']];
    displayColors.forEach(([sponge, top2], i) => {
      const c = new THREE.Mesh(cylinder(0.13, 0.13, 0.12, 18), mat(sponge));
      c.position.set(0, 1.0, -L / 2 + 0.47 + i * 0.32);
      const f = new THREE.Mesh(cylinder(0.135, 0.135, 0.03, 18), mat(top2));
      f.position.set(0, 1.075, -L / 2 + 0.47 + i * 0.32);
      g.add(c, f);
    });
    // Cash register (south end).
    const reg = new THREE.Mesh(roundedBox(0.36, 0.22, 0.34, 0.04), mat(PALETTE.mint));
    reg.position.set(-0.1, 1.04, 1.4); reg.castShadow = true;
    const screen = new THREE.Mesh(roundedBox(0.04, 0.12, 0.24, 0.02), mat('#2f3a44'));
    screen.position.set(0.12, 1.2, 1.4); screen.rotation.z = 0.4;
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#ffd84d', { metalness: 0.6, roughness: 0.25 }));
    bell.position.set(0.3, 0.93, 0.95);
    g.add(reg, screen, bell);
    // Awning on posts + sign.
    const postMat = mat(PALETTE.white);
    for (const z of [-L / 2 + 0.05, -L / 6, L / 6, L / 2 - 0.05]) {
      const p = new THREE.Mesh(cylinder(0.05, 0.05, 2.1, 10), postMat);
      p.position.set(-0.35, 1.05, z); p.castShadow = true; g.add(p);
    }
    const awnTex = t.awning.clone(); awnTex.needsUpdate = true; awnTex.wrapS = THREE.RepeatWrapping; awnTex.repeat.set(L, 1);
    const awning = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, L + 0.2), new THREE.MeshStandardMaterial({ map: awnTex, roughness: 0.6 }));
    awning.position.set(0.15, 2.1, 0); awning.rotation.z = -0.28; awning.castShadow = true;
    g.add(awning);
    const signC = document.createElement('canvas'); signC.width = 512; signC.height = 128;
    const sg = signC.getContext('2d');
    sg.fillStyle = '#ffffff'; sg.beginPath(); sg.roundRect(6, 6, 500, 116, 40); sg.fill();
    sg.strokeStyle = '#ff8fb1'; sg.lineWidth = 10; sg.stroke();
    sg.fillStyle = '#e9668f'; sg.font = 'bold 64px "Fredoka", "Trebuchet MS", sans-serif'; sg.textAlign = 'center'; sg.textBaseline = 'middle';
    sg.fillText('CAKE SHOP', 256, 68);
    const signTex = new THREE.CanvasTexture(signC); signTex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, side: THREE.DoubleSide }));
    sign.position.set(0.5, 2.5, 0); sign.rotation.y = Math.PI / 2;
    g.add(sign);
    // Box stack anchor on the customer side of the counter top.
    this.stackRoot = new THREE.Group();
    this.stackRoot.position.set(0.2, 0.93, 0.15);
    g.add(this.stackRoot);
    return g;
  }

  /**
   * Long glass display cabinet with cakes, standing against the east wall.
   * Faces the factory (-X). Hidden whenever that wall is hidden (camera side).
   */
  _buildVitrine() {
    const g = new THREE.Group();
    const L = 10, D = 0.62, H = 1.55;
    const frame = mat(PALETTE.pink), cream = mat(PALETTE.cream);
    const glassMat = new THREE.MeshStandardMaterial({ color: '#e4f6ff', transparent: true, opacity: 0.28, roughness: 0.03, metalness: 0.1, depthWrite: false });
    // Base cabinet, top, back panel.
    g.add(place(new THREE.Mesh(roundedBox(D, 0.55, L, 0.06), frame), 0, 0.275, 0));
    g.add(place(new THREE.Mesh(roundedBox(D + 0.06, 0.1, L + 0.06, 0.04), cream), 0, H, 0));
    g.add(place(new THREE.Mesh(roundedBox(0.06, H - 0.55, L, 0.02), mat('#fff3f6')), D / 2 - 0.03, 0.55 + (H - 0.55) / 2, 0));
    // Glass front + glass end panels.
    const front = new THREE.Mesh(new THREE.PlaneGeometry(L, H - 0.6), glassMat);
    front.rotation.y = -Math.PI / 2; front.position.set(-D / 2, 0.55 + (H - 0.6) / 2, 0); front.renderOrder = 3;
    g.add(front);
    for (const z of [-L / 2, L / 2]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(D, H - 0.6), glassMat);
      side.position.set(0, 0.55 + (H - 0.6) / 2, z); side.renderOrder = 3;
      g.add(side);
    }
    // Frame posts.
    for (let i = 0; i <= 5; i++) {
      const z = -L / 2 + (i * L) / 5;
      g.add(place(new THREE.Mesh(roundedBox(0.06, H - 0.55, 0.06, 0.02), frame), -D / 2, 0.55 + (H - 0.55) / 2, z));
    }
    // Two shelves of cakes (sponge + frosting + a cherry on some).
    const sponges = ['#f6dfa4', '#7a4a2e', '#f49ab0', '#f7e45e', '#7d8ee8'];
    const tops = ['#ff8fb8', '#fffaf2', '#8fc8ff', '#ffe27a', '#c3a2ff', '#8de0b4', '#8a5634'];
    const shelfY = [0.56, 1.0];
    for (const [si, y] of shelfY.entries()) {
      if (si > 0) g.add(place(new THREE.Mesh(roundedBox(D - 0.12, 0.03, L - 0.1, 0.01), mat('#eaf6fb', { transparent: true, opacity: 0.6 })), 0, y - 0.02, 0));
      for (let i = 0; i < 12; i++) {
        const z = -L / 2 + 0.45 + i * ((L - 0.9) / 11);
        const k = i * 3 + si * 7;
        const r = 0.15 + (k % 3) * 0.02;
        const h = 0.12 + (k % 2) * 0.06;
        const plate = new THREE.Mesh(cylinder(r + 0.04, r + 0.03, 0.02, 18), mat('#ffffff'));
        plate.position.set(-0.05, y + 0.01, z);
        const sp = new THREE.Mesh(cylinder(r, r, h, 18), mat(sponges[k % sponges.length]));
        sp.position.set(-0.05, y + 0.02 + h / 2, z); sp.castShadow = true;
        const fr = new THREE.Mesh(cylinder(r + 0.005, r + 0.005, 0.035, 18), mat(tops[k % tops.length]));
        fr.position.set(-0.05, y + 0.02 + h + 0.017, z);
        g.add(plate, sp, fr);
        if (k % 2 === 0) {
          const ch = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat('#e8344e'));
          ch.position.set(-0.05, y + 0.02 + h + 0.06, z); g.add(ch);
        }
      }
    }
    // Warm strip light under the top.
    const light = new THREE.Mesh(roundedBox(0.04, 0.03, L - 0.3, 0.01), new THREE.MeshBasicMaterial({ color: '#fff6d8' }));
    light.position.set(-D / 2 + 0.08, H - 0.07, 0);
    g.add(light);
    return g;
  }

  _stackSlot(i) {
    const perLayer = 6;
    const layer = Math.floor(i / perLayer), k = i % perLayer;
    return new THREE.Vector3((k % 2) * 0.28 - 0.14, 0.1 + layer * 0.21, Math.floor(k / 2) * 0.28 - 0.28);
  }

  _makeBox() {
    const g = new THREE.Group();
    const b = new THREE.Mesh(this.boxGeo, this.boxMat); b.castShadow = true;
    const r1 = new THREE.Mesh(this.ribbonGeo, this.ribbonMat); r1.position.y = 0.09;
    const r2 = r1.clone(); r2.rotation.y = Math.PI / 2;
    g.add(b, r1, r2);
    return g;
  }

  _layoutStack() {
    this.stackRoot.clear();
    for (let i = 0; i < this.stackCount; i++) {
      const box = this._makeBox();
      box.position.copy(this._stackSlot(i));
      this.stackRoot.add(box);
    }
  }

  // ---------------------------------------------------------------- customers
  _buildPerson(seed) {
    const r = (n) => (seed >>> (n * 3)) % 997;
    const skin = SKIN[r(1) % SKIN.length], shirt = SHIRT[r(2) % SHIRT.length], hair = HAIR[r(3) % HAIR.length];
    const g = new THREE.Group();
    const body = new THREE.Group(); // bobbing part
    g.add(body);
    const legs = [];
    for (const z of [-0.09, 0.09]) {
      const leg = new THREE.Group();
      leg.position.set(0, 0.42, z);
      const m = new THREE.Mesh(cylinder(0.06, 0.055, 0.42, 8), mat('#4a5a7a'));
      m.position.y = -0.21; m.castShadow = true;
      const shoe = new THREE.Mesh(roundedBox(0.16, 0.06, 0.1, 0.02), mat('#3a2f3a'));
      shoe.position.set(0.03, -0.41, 0);
      leg.add(m, shoe);
      g.add(leg); legs.push(leg);
    }
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.28, 4, 10), mat(shirt));
    torso.position.y = 0.66; torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), mat(skin));
    head.position.y = 1.0; head.castShadow = true;
    const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(hair));
    hairM.position.set(-0.02, 1.02, 0); hairM.rotation.z = 0.25;
    const eyeMat = mat('#1d1a22');
    const eyes = [-0.05, 0.05].map((z) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), eyeMat); e.position.set(0.135, 1.02, z); return e; });
    const arms = [];
    for (const z of [-0.21, 0.21]) {
      const arm = new THREE.Group();
      arm.position.set(0, 0.8, z);
      const a = new THREE.Mesh(cylinder(0.045, 0.04, 0.34, 8), mat(shirt));
      a.position.y = -0.17; a.castShadow = true;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(skin));
      hand.position.y = -0.35;
      arm.add(a, hand);
      body.add(arm); arms.push(arm);
    }
    body.add(torso, head, hairM, ...eyes);
    // Boxes carried when leaving.
    const carry = new THREE.Group();
    carry.position.set(0.24, 0.62, 0);
    carry.visible = false;
    body.add(carry);
    return { group: g, body, legs, arms, carry };
  }

  _bubbleTexture(order, delivered, thanks) {
    const c = this._bubbleCanvas || (this._bubbleCanvas = document.createElement('canvas'));
    c.width = 256; c.height = 220;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 256, 220);
    g.fillStyle = '#ffffff'; g.strokeStyle = '#f3c3d2'; g.lineWidth = 6;
    g.beginPath(); g.roundRect(8, 8, 240, 168, 36); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(110, 172); g.lineTo(128, 208); g.lineTo(146, 172); g.closePath(); g.fill();
    g.fillStyle = '#4a2c3a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (thanks) {
      g.font = 'bold 54px "Fredoka", sans-serif'; g.fillStyle = '#e9668f'; g.fillText('Thanks!', 128, 76);
      g.font = '58px sans-serif'; g.fillText('♥', 128, 140);
    } else {
      const cakeC = document.createElement('canvas'); cakeC.width = 120; cakeC.height = 120;
      drawCake(cakeC, parseCakeKey(order.cake));
      g.drawImage(cakeC, 14, 22, 132, 132);
      g.font = 'bold 50px "Fredoka", sans-serif'; g.fillStyle = '#4a2c3a';
      g.fillText(`×${order.quantity}`, 196, 72);
      g.font = 'bold 30px "Fredoka", sans-serif'; g.fillStyle = '#3fb27f';
      g.fillText(`${delivered}/${order.quantity}`, 196, 130);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  _setBubble(cust, thanks = false) {
    const old = cust.bubble.material.map;
    cust.bubble.material.map = this._bubbleTexture(cust.order, this.game.orders.delivered, thanks);
    cust.bubble.material.needsUpdate = true;
    if (old) old.dispose();
    cust.shownDelivered = this.game.orders.delivered;
  }

  _spawn(order, silent = false) {
    const person = this._buildPerson(hash(order.id));
    const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
    bubble.scale.set(0.95, 0.82, 1);
    bubble.position.set(0, 1.62, 0);
    bubble.renderOrder = 12;
    bubble.visible = false;
    person.group.add(bubble);
    const cust = { ...person, bubble, order, state: 'entering', walkT: 0, wait: 0, silent };
    this._setBubble(cust);
    person.group.position.copy(this.spawnPos);
    this.root.add(person.group);
    this.customers.push(cust);
    return cust;
  }

  _current() { return this.customers.find((c) => c.state === 'entering' || c.state === 'waiting'); }

  _completeOrder(ev) {
    const cust = this._current();
    if (cust) { cust.state = 'collect'; cust.wait = 0; }
    this._nextOrder = ev.next;
  }

  // ---------------------------------------------------------------- boxes
  _launchBox(ev) {
    const sim = this.game.sim;
    const st = sim.entities.get(ev.machineId);
    const from = st
      ? this.fr.gridToWorld(st.x + st.size[0] / 2, st.y + st.size[1] / 2, 0.6)
      : this.fr.gridToWorld(ev.x + 0.5, ev.y + 0.5, 0.6);
    const slot = Math.min(this.stackCount + this.inFlight, MAX_STACK - 1);
    const to = this._stackSlot(slot).add(this.counterPos).add(this.stackRoot.position);
    const mesh = this._makeBox();
    mesh.position.copy(from);
    this.root.add(mesh);
    this.flying.push({ mesh, from, to, t: 0 });
    this.inFlight++;
  }

  // ---------------------------------------------------------------- frame
  _walk(cust, target, dt) {
    const p = cust.group.position;
    const d = new THREE.Vector3().subVectors(target, p);
    d.y = 0;
    const dist = d.length();
    if (dist < 0.02) { p.copy(target); return true; }
    const step = Math.min(dist, WALK_SPEED * dt);
    p.addScaledVector(d.normalize(), step);
    cust.group.rotation.y = Math.atan2(-d.z, d.x);
    cust.walkT += dt * 9;
    const s = Math.sin(cust.walkT);
    cust.legs[0].rotation.z = s * 0.5; cust.legs[1].rotation.z = -s * 0.5;
    if (!cust.carry.visible) { cust.arms[0].rotation.z = -s * 0.4; cust.arms[1].rotation.z = s * 0.4; }
    cust.body.position.y = Math.abs(Math.cos(cust.walkT)) * 0.03;
    return false;
  }

  _idle(cust) {
    cust.legs[0].rotation.z = cust.legs[1].rotation.z = 0;
    if (!cust.carry.visible) cust.arms[0].rotation.z = cust.arms[1].rotation.z = Math.sin(this.time * 2) * 0.05;
    cust.body.position.y = Math.sin(this.time * 2.2) * 0.01;
  }

  update(dt) {
    this.time += dt;
    // The cabinet stands against the east wall: show it only when that wall is visible.
    if (this.vitrine) this.vitrine.visible = Math.cos(this.fr.camAzimuth ?? Math.PI / 4) < -0.1;
    // Flying boxes: arc from the delivery station to the counter.
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.t += dt / BOX_FLIGHT;
      const k = Math.min(1, f.t);
      f.mesh.position.lerpVectors(f.from, f.to, k);
      f.mesh.position.y += Math.sin(k * Math.PI) * 2.2;
      f.mesh.rotation.y = k * Math.PI * 2;
      if (k >= 1) {
        this.root.remove(f.mesh);
        this.flying.splice(i, 1);
        this.inFlight--;
        if (this.stackCount < MAX_STACK) { this.stackCount++; this._layoutStack(); }
      }
    }

    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];
      if (c.state === 'entering') {
        if (this._walk(c, this.standPos, dt)) {
          c.state = 'waiting';
          c.group.rotation.y = Math.PI; // face the counter (-X)
          c.bubble.visible = true;
          this._setBubble(c);
          if (!c.silent) this.onCustomerArrived(c.order);
        }
      } else if (c.state === 'waiting') {
        c.group.rotation.y = Math.PI;
        this._idle(c);
        if (c.shownDelivered !== this.game.orders.delivered && c.order.id === this.game.orders.current.id) this._setBubble(c);
      } else if (c.state === 'collect') {
        c.group.rotation.y = Math.PI;
        this._idle(c);
        c.wait += dt;
        if (this.inFlight === 0 && c.wait > 0.3) {
          // Pick up the boxes (show up to three in the arms) and say thanks.
          c.carry.clear();
          const n = Math.max(1, Math.min(3, this.stackCount));
          for (let k = 0; k < n; k++) { const b = this._makeBox(); b.position.set(0, k * 0.21, 0); c.carry.add(b); }
          c.carry.visible = true;
          c.arms[0].rotation.z = c.arms[1].rotation.z = 1.2;
          // Whatever landed after completion belongs to the next order.
          this.stackCount = Math.min(this.game.orders.delivered, MAX_STACK);
          this._layoutStack();
          this._setBubble(c, true);
          c.state = 'thanks'; c.wait = 0;
        }
      } else if (c.state === 'thanks') {
        this._idle(c);
        c.wait += dt;
        if (c.wait > 1.1) {
          c.state = 'leaving'; c.bubble.visible = false;
          if (this._nextOrder) { this._spawn(this._nextOrder); this._nextOrder = null; }
        }
      } else if (c.state === 'leaving') {
        if (this._walk(c, this.exitPos, dt)) {
          this.root.remove(c.group);
          c.bubble.material.map?.dispose();
          this.customers.splice(i, 1);
        }
      }
    }
    // Safety: there is always a customer for the current order.
    if (!this._current() && !this.customers.some((c) => c.state === 'collect' || c.state === 'thanks')) {
      this._spawn(this._nextOrder || this.game.orders.current);
      this._nextOrder = null;
    }
  }
}
