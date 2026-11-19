/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * DOM user interface: HUD, build toolbar, order panel, inspector, tutorial,
 * toasts, money popups, modals (settings, help, celebration, confirm).
 * The UI only changes the game through Game / InputController actions.
 */
import { MACHINE_DEFS, BUILDABLE_ORDER, CONFIG_OPTIONS, ROTATOR_MODE_LEVEL } from '../machines/MachineDefs.js';
import { STATUS } from '../machines/Machine.js';
import { parseCakeKey } from '../cakes/CakeSerializer.js';
import { describeCake, FLAVORS, FROSTINGS, QUADRANT_NAMES } from '../cakes/CakeModel.js';
import { rotateCW } from '../cakes/CakeOperations.js';
import { DIR_NAMES } from '../simulation/Grid.js';
import { TUTORIAL_STEPS } from '../gameplay/TutorialManager.js';
import { drawCake } from './CakePreview.js';
import { COPYRIGHT, BELT, UPGRADES, GLOBAL_UPGRADES } from '../core/Config.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en-US');

const ICONS = {
  select: '<svg viewBox="0 0 40 40"><path d="M11 6l18 13-8 1.5 5 9.5-4 2-5-9.5-6 5.5z" fill="#fff" stroke="#4a2c3a" stroke-width="2.4" stroke-linejoin="round"/></svg>',
  belt: '<svg viewBox="0 0 40 40"><rect x="3" y="13" width="34" height="14" rx="7" fill="#5b5563"/><rect x="3" y="11" width="34" height="4" rx="2" fill="#fff6ea"/><rect x="3" y="25" width="34" height="4" rx="2" fill="#fff6ea"/><path d="M12 16l4 4-4 4M20 16l4 4-4 4" stroke="#ffd36b" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  oven: '<svg viewBox="0 0 40 40"><rect x="6" y="9" width="28" height="25" rx="6" fill="#ff8fb1"/><rect x="5" y="6" width="30" height="6" rx="3" fill="#fff6ea"/><rect x="11" y="16" width="18" height="12" rx="3" fill="#5a2c1b"/><rect x="13" y="18" width="14" height="8" rx="2" fill="#ffad5c"/><rect x="25" y="2" width="5" height="6" rx="1.5" fill="#d8dde6"/></svg>',
  delivery: '<svg viewBox="0 0 40 40"><rect x="4" y="22" width="32" height="12" rx="4" fill="#7fdcb0"/><path d="M5 14h30l-3 6H8z" fill="#ff8fb1"/><path d="M11 14h6l-1 6h-5zM23 14h6l1 6h-5z" fill="#fff"/><rect x="9" y="7" width="22" height="7" rx="3" fill="#fff"/><rect x="15" y="24" width="10" height="8" rx="2" fill="#fff"/></svg>',
  rotate: '<svg viewBox="0 0 40 40"><path d="M30 20a10 10 0 1 1-4-8" stroke="#e9668f" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M27 5l1 8-8 0z" fill="#e9668f"/></svg>',
  move: '<svg viewBox="0 0 40 40"><path d="M20 4l5 6h-3v8h8v-3l6 5-6 5v-3h-8v8h3l-5 6-5-6h3v-8h-8v3l-6-5 6-5v3h8v-8h-3z" fill="#8fcbff" stroke="#4a7fb5" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  froster: '<svg viewBox="0 0 40 40"><rect x="5" y="24" width="30" height="11" rx="4" fill="#ffe6a3"/><rect x="7" y="6" width="5" height="20" rx="2" fill="#fff6ea" stroke="#e8cfa0"/><rect x="9" y="6" width="17" height="4" rx="2" fill="#fff6ea" stroke="#e8cfa0"/><path d="M19 10h10l-5 12z" fill="#ff8fb1"/><circle cx="24" cy="25" r="2" fill="#ff8fb1"/></svg>',
  cutter: '<svg viewBox="0 0 40 40"><rect x="6" y="20" width="28" height="14" rx="4" fill="#8fcbff"/><circle cx="20" cy="15" r="9" fill="#e9eef5" stroke="#9fb0c4" stroke-width="2"/><circle cx="20" cy="15" r="2.5" fill="#e9668f"/><path d="M20 22v10" stroke="#fff" stroke-width="2" stroke-dasharray="2 2"/></svg>',
  rotator: '<svg viewBox="0 0 40 40"><rect x="5" y="22" width="30" height="12" rx="4" fill="#c9b6ff"/><ellipse cx="20" cy="21" rx="13" ry="5" fill="#fff"/><path d="M10 15a11 6 0 0 1 20 0" stroke="#e9668f" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M31 11l-1 6-5-2z" fill="#e9668f"/></svg>',
  combiner: '<svg viewBox="0 0 40 40"><rect x="5" y="22" width="30" height="12" rx="4" fill="#ff8fb1"/><path d="M8 18a8 8 0 0 1 12-7v14z" fill="#f6dfa4"/><path d="M32 18a8 8 0 0 0-12-7v14z" fill="#7a4a2e"/><rect x="12" y="4" width="16" height="4" rx="2" fill="#ffe6a3"/></svg>',
  trash: '<svg viewBox="0 0 40 40"><path d="M10 13h20l-2 21H12z" fill="#9fb4c7"/><rect x="8" y="9" width="24" height="5" rx="2.5" fill="#7fdcb0"/><rect x="17" y="5" width="6" height="4" rx="2" fill="#3fb27f"/><path d="M16 18v12M24 18v12" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
  upgrade: '<svg viewBox="0 0 40 40"><path d="M20 4l7 9h-4v9h-6v-9h-4z" fill="#ffd84d" stroke="#c48a00" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 27l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L1.8 32.2l5-.7z" transform="translate(6 -4) scale(.9)" fill="#ff8fb1"/><path d="M9 27l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L1.8 32.2l5-.7z" transform="translate(17 -4) scale(.9)" fill="#ff8fb1"/></svg>',
  delete: '<svg viewBox="0 0 40 40"><rect x="10" y="12" width="20" height="23" rx="4" fill="#ff8095"/><rect x="7" y="8" width="26" height="5" rx="2.5" fill="#d63a55"/><rect x="16" y="4" width="8" height="5" rx="2" fill="#d63a55"/><path d="M16 17v13M24 17v13" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>',
};

const TOOL_META = {
  select: { label: 'Select', key: 'V' },
  belt: { label: 'Conveyor', key: '1' },
  oven: { label: 'Oven', key: '2' },
  froster: { label: 'Frosting', key: '3' },
  cutter: { label: 'Cutter', key: '4' },
  rotator: { label: 'Rotator', key: '5' },
  combiner: { label: 'Combiner', key: '6' },
  trash: { label: 'Trash', key: '7' },
  delivery: { label: 'Delivery', key: '8' },
  rotate: { label: 'Rotate', key: 'R' },
  move: { label: 'Move', key: 'M' },
  upgrade: { label: 'Upgrade', key: 'U' },
  delete: { label: 'Delete', key: 'X' },
};

const STATUS_TEXT = {
  [STATUS.WORKING]: 'Working', [STATUS.IDLE]: 'Waiting for cakes', [STATUS.BLOCKED]: 'Blocked – output full', [STATUS.NO_OUTPUT]: 'No output connected',
  [STATUS.INCOMPATIBLE]: 'Pieces don’t fit',
};
/** Short "how it works" cards shown when an order first needs a new machine. */
const CAKE_L = '<path d="M30 8a22 22 0 0 0 0 44z" fill="#f6dfa4" stroke="#c9a96a" stroke-width="1.5"/>';
const CAKE_R = (c) => `<path d="M30 8a22 22 0 0 1 0 44z" fill="${c}" stroke="#7d5a45" stroke-width="1.5"/>`;
const ARROW = (x, y, label, col) => `<path d="M${x} ${y}h22" stroke="${col}" stroke-width="3" stroke-linecap="round"/><path d="M${x + 22} ${y - 5}l7 5-7 5z" fill="${col}"/><text x="${x + 8}" y="${y - 6}" font-size="11" font-weight="700" fill="${col}">${label}</text>`;
const MACHINE_TIPS = {
  cutter: {
    title: 'New machine: Cake Cutter',
    svg: `<svg viewBox="0 0 190 60">${CAKE_L}${CAKE_R('#f6dfa4')}<path d="M30 4v52" stroke="#e9668f" stroke-width="2.5" stroke-dasharray="4 3"/>
      ${ARROW(62, 18, 'L', '#3fb27f')}<path d="M100 8a11 11 0 0 0 0 22z" fill="#f6dfa4" stroke="#c9a96a"/>
      ${ARROW(62, 44, 'R', '#e9668f')}<path d="M100 33a11 11 0 0 1 0 22z" fill="#f6dfa4" stroke="#c9a96a"/>
      <text x="118" y="23" font-size="11" fill="#4a2c3a">left half</text><text x="118" y="48" font-size="11" fill="#4a2c3a">right half</text></svg>`,
    text: 'It cuts a cake in two. The <b>left</b> half (as in the order picture) leaves the <b>L</b> exit, the <b>right</b> half the <b>R</b> exit. Every exit needs a belt – send halves you don’t need into a <b>Trash Bin</b>.',
  },
  combiner: {
    title: 'New machine: Cake Combiner',
    svg: `<svg viewBox="0 0 190 60"><path d="M30 8a22 22 0 0 0 0 44z" fill="#f6dfa4" stroke="#c9a96a" stroke-width="1.5"/><text x="34" y="34" font-size="20" font-weight="700" fill="#4a2c3a">+</text>
      <path d="M60 8a22 22 0 0 1 0 44z" fill="#7a4a2e" stroke="#5a3420" stroke-width="1.5"/>${ARROW(92, 30, '', '#3fb27f')}
      <path d="M150 8a22 22 0 0 0 0 44z" fill="#f6dfa4" stroke="#c9a96a" stroke-width="1.5"/><path d="M150 8a22 22 0 0 1 0 44z" fill="#7a4a2e" stroke="#5a3420" stroke-width="1.5"/></svg>`,
    text: 'Feed one piece into each input (the main input and the side input). Pieces that fill <b>different</b> quadrants are joined into one cake; overlapping pieces are refused.',
  },
  rotator: {
    title: 'New machine: Cake Rotator',
    svg: `<svg viewBox="0 0 190 60"><path d="M50 8a22 22 0 0 0 0 44z" fill="#f6dfa4" stroke="#c9a96a" stroke-width="1.5"/>
      <path d="M86 18a16 16 0 0 1 22 0" stroke="#e9668f" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M110 12l1 9-8-2z" fill="#e9668f"/>
      <path d="M128 30a22 22 0 0 1 44 0z" fill="#f6dfa4" stroke="#c9a96a" stroke-width="1.5"/></svg>`,
    text: 'Turns a cake <b>90° clockwise</b>: a left half becomes a <b>top</b> half, a right half a bottom half. Click the order picture to preview rotations.',
  },
};

const LOCK_SVG = '<svg class="lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="3" fill="#8a6676"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="#8a6676" stroke-width="2.5" fill="none"/></svg>';

export class UI {
  constructor({ game, audio, camera, canvas }) {
    this.game = game;
    this.audio = audio;
    this.cam = camera;
    this.canvas = canvas;
    this.input = null;
    this.selected = null;
    this.moneyShown = game.economy.money;
    this._inspT = 0;
    this._hudT = 0;
    this.onPauseToggle = () => {};
    this.onSettingsChange = () => {};
    this.onResetProgress = () => {};
    this._buildToolbar();
    this._wire();
    this._subscribe();
  }

  /** Rotation that makes 2D cake pictures match the current 3D camera view. */
  get viewRot() { return Math.PI / 2 - (this.cam?.azimuth ?? Math.PI / 4); }

  attachInput(input) {
    this.input = input;
    input.onToolChange = (t) => this._syncTools(t);
    input.onSelect = (e) => this.showInspector(e);
    this._syncTools(input.tool);
  }

  showGame() {
    for (const id of ['hud', 'orderPanel', 'toolbarWrap', 'camControls']) $(id).classList.remove('hidden');
    requestAnimationFrame(() => this._syncToolbarEdges());
    this.refreshOrder();
    this.refreshTutorial();
  }

  /**
   * The part of the screen not covered by HUD panels (client pixels). Narrow
   * panels at a side shrink the area horizontally; wide ones vertically.
   */
  freeRect() {
    const W = innerWidth, H = innerHeight;
    let l = 0, r = W, t = 0, b = H;
    for (const id of ['hud', 'orderPanel', 'tutorial', 'toolbarWrap', 'camControls', 'inspector']) {
      const el = $(id);
      if (!el || el.classList.contains('hidden')) continue;
      const box = id === 'hud' ? el.querySelector('.hud-center') || el : el;
      const q = box.getBoundingClientRect();
      if (!q.width || !q.height) continue;
      const sideable = id === 'orderPanel' || id === 'camControls' || id === 'inspector';
      if (sideable && q.width < W * 0.3) {
        if (q.left + q.width / 2 > W / 2) r = Math.min(r, q.left); else l = Math.max(l, q.right);
      } else if (q.top + q.height / 2 < H / 2) t = Math.max(t, q.bottom);
      else b = Math.min(b, q.top);
    }
    const pad = 12;
    return { x: l + pad, y: t + pad, w: Math.max(0, r - l - pad * 2), h: Math.max(0, b - t - pad * 2) };
  }

  // ------------------------------------------------------------- toolbar
  _buildToolbar() {
    const bar = $('toolbar');
    const tools = ['select', ...BUILDABLE_ORDER, 'rotate', 'move', 'upgrade', 'delete'];
    this.toolButtons = {};
    for (const t of tools) {
      const b = document.createElement('button');
      b.className = 'tool' + (t === 'rotate' ? ' sep' : '');
      b.dataset.tool = t;
      const def = MACHINE_DEFS[t];
      b.title = def ? `${def.name} – ${def.description}` : TOOL_META[t].label;
      b.innerHTML = `<span class="key">${TOOL_META[t].key}</span>${ICONS[t]}<span>${TOOL_META[t].label}</span>${def ? `<span class="price">$${def.cost}</span>` : ''}${def ? LOCK_SVG : ''}<span class="badge-new">NEW</span>`;
      b.addEventListener('click', () => {
        b.classList.remove('is-new');
        this.audio.unlock(); this.audio.play('click');
        this.input.setTool(this.input.tool === t && t !== 'select' ? 'select' : t);
      });
      bar.appendChild(b);
      this.toolButtons[t] = b;
    }
    bar.addEventListener('scroll', () => this._syncToolbarEdges(), { passive: true });
    window.addEventListener('resize', () => this._syncToolbarEdges());
  }

  /** Ring a tool button and scroll it into view (phones show only part of the toolbar). */
  _highlightTool(t) {
    const b = this.toolButtons[t];
    b.classList.add('highlight');
    const bar = $('toolbar');
    if (bar.scrollWidth > bar.clientWidth) {
      const left = b.offsetLeft - (bar.clientWidth - b.offsetWidth) / 2;
      bar.scrollTo({ left, behavior: 'smooth' });
    }
  }

  /** Fade the toolbar edges where more tools are hidden off-screen. */
  _syncToolbarEdges() {
    const bar = $('toolbar');
    const more = bar.scrollWidth - bar.clientWidth;
    bar.classList.toggle('more-left', more > 2 && bar.scrollLeft > 2);
    bar.classList.toggle('more-right', more > 2 && bar.scrollLeft < more - 2);
  }

  _syncTools(tool) {
    for (const [t, b] of Object.entries(this.toolButtons)) b.classList.toggle('active', t === tool);
    const building = tool === 'move' || !!MACHINE_DEFS[tool];
    $('btnRotateGhost').classList.toggle('hidden', !building);
    if (tool !== 'select') this.showInspector(null);
  }

  // ------------------------------------------------------------- wiring
  _wire() {
    $('btnRotateGhost').addEventListener('click', () => this.input.rotateAction());
    $('btnPause').addEventListener('click', () => { this.audio.unlock(); this.onPauseToggle(); });
    $('btnSettings').addEventListener('click', () => this.openSettings());
    $('btnHelp').addEventListener('click', () => this.openHelp());
    $('camZoomIn').addEventListener('click', () => this.cam.zoomAt(1.25));
    $('camZoomOut').addEventListener('click', () => this.cam.zoomAt(0.8));
    $('camRotL').addEventListener('click', () => this.cam.rotate(-1));
    $('camRotR').addEventListener('click', () => this.cam.rotate(1));
    $('camTiltUp').addEventListener('click', () => this.cam.tiltBy(0.18, true));
    $('camTiltDown').addEventListener('click', () => this.cam.tiltBy(-0.18, true));
    $('camReset').addEventListener('click', () => this.cam.resetView());
    $('orderToggle').addEventListener('click', () => {
      const p = $('orderPanel'); p.classList.toggle('collapsed');
      $('orderToggle').textContent = p.classList.contains('collapsed') ? '+' : '–';
    });
    $('inspClose').addEventListener('click', () => this.input.select(0));
    $('inspRotate').addEventListener('click', () => { if (this.selected) { const r = this.game.rotateEntity(this.selected.id); this.audio.play(r.ok ? 'rotate' : 'invalid'); } });
    $('inspMove').addEventListener('click', () => {
      if (!this.selected) return;
      const id = this.selected.id;
      this.input.setTool('move');
      this.input.carry = { id };
      this.input.rot = this.game.sim.entities.get(id)?.rot ?? 0;
    });
    $('inspRemove').addEventListener('click', () => this.input.removeSelected());
    $('orderSwitch').addEventListener('click', () => {
      const r = this.game.switchContract();
      this.audio.play(r.ok ? 'click' : 'invalid');
      if (r.ok) this.toast(`Contract switched: ${r.order.name}`, 'good');
      this.refreshOrder();
    });
    $('orderCake').addEventListener('click', () => this.openCakeInspector(this._orderCake, `Order: ${this.game.orders.current.name}`, true));
    $('inspCake').addEventListener('click', () => { if (this._inspCakeObj) this.openCakeInspector(this._inspCakeObj, 'Cake inspector', false); });
    $('inspConfig').addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-val],[data-q]');
      if (!btn || !this.selected) return;
      if (btn.classList.contains('locked') && btn.dataset.kind) {
        // Explain which order unlocks this flavor / colour instead of doing nothing.
        const kind = btn.dataset.kind === 'flavor' ? 'flavors' : 'frostings';
        const table = kind === 'flavors' ? FLAVORS : FROSTINGS;
        const src = this.game.unlockSource(kind, btn.dataset.val);
        this.toast(`${table[btn.dataset.val].name} unlocks after the “${src}” order`, 'bad');
        this.audio.play('invalid');
        return;
      }
      if (btn.disabled) return;
      let r;
      if (btn.dataset.q !== undefined) {
        const mask = (this.selected.config.mask || [true, true, true, true]).slice();
        mask[Number(btn.dataset.q)] = !mask[Number(btn.dataset.q)];
        r = this.game.configureMachine(this.selected.id, 'mask', mask);
      } else r = this.game.configureMachine(this.selected.id, btn.dataset.key, btn.dataset.val);
      this.audio.play(r.ok ? 'click' : 'invalid');
      this._renderInspector();
    });
    $('inspUpgrade').addEventListener('click', () => {
      if (!this.selected) return;
      const r = this.game.upgradeMachine(this.selected.id);
      this.audio.play(r.ok ? 'upgrade' : 'invalid');
      if (r.ok) this.toast(`${this.selected.def.name} upgraded to level ${r.level}!`, 'good');
      this._renderInspector();
    });
    $('btnUpgrades').addEventListener('click', () => { this.audio.unlock(); this.openUpgrades(); });
    $('btnMilestones').addEventListener('click', () => { this.audio.unlock(); this.audio.play('click'); this.openMilestones(); });
    $('tutSkip').addEventListener('click', () => { this.game.tutorial.skip(); this.toast('Tutorial skipped – press ? for help any time'); });
    $('tutNext').addEventListener('click', () => {
      this.audio.play('click');
      if (this._tip) { this.game.markTipSeen(this._tip); this._tip = null; this.refreshTutorial(); return; }
      this.game.tutorial.next();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !$('modal').classList.contains('hidden')) { this.closeModal(); e.stopPropagation(); }
      if (e.key.toLowerCase() === 'p' && !$('hud').classList.contains('hidden')) this.onPauseToggle();
      if (e.key.toLowerCase() === 'h' && !$('hud').classList.contains('hidden')) this.openHelp();
    }, true);
  }

  _subscribe() {
    const bus = this.game.bus;
    bus.on('actionFailed', (reason) => {
      this.toast(reason, 'bad');
      if (/money/i.test(reason)) { const m = document.querySelector('.stat.money'); m.classList.remove('deny'); void m.offsetWidth; m.classList.add('deny'); }
    });
    bus.on('delivered', (ev) => {
      const wp = this._stationWorld(ev);
      if (ev.accepted) {
        if (this._lastReject) { this._lastReject = null; this._showLastReject(); }
        this.popup(`+$${ev.reward}`, wp, ev.reward > 50 ? 'big' : '');
        this.audio.play('deliver');
      } else {
        this.popup('✗ Wrong cake', wp, 'bad');
        this.audio.play('reject');
        // Explain every rejection (rate-limited) and show the wrong cake in the order card.
        const now = performance.now();
        if (now - (this._lastRejectToast ?? -1e9) > 3500) { this._lastRejectToast = now; this.toast(`Wrong cake: ${ev.reason}`, 'bad'); }
        this._lastReject = { cake: ev.cake, reason: ev.reason, orderId: this.game.orders.current.id };
        this._showLastReject();
      }
    });
    bus.on('itemDestroyed', () => this.toast('A cake was discarded with the removed part', ''));
    bus.on('orderProgress', () => this.refreshOrder());
    bus.on('orderCompleted', (ev) => { this.refreshOrder(); this.celebrate(ev); this.refreshTutorial(); });
    bus.on('entityAdded', (e) => { if (this._tip && e.type === this._tip) { this.game.markTipSeen(this._tip); this._tip = null; this.refreshTutorial(); } });
    bus.on('tutorial', () => this.refreshTutorial());
    bus.on('unlocked', (list) => {
      for (const u of list) {
        if (u.kind === 'machines' && this.toolButtons[u.value]) this.toolButtons[u.value].classList.add('is-new');
      }
    });
    bus.on('milestone', ({ reached, total }) => {
      this.audio.play('upgrade');
      const text = reached.length === 1 ? `🏆 Milestone: ${reached[0].name}! +$${fmt(total)}` : `🏆 ${reached.length} milestones reached! +$${fmt(total)}`;
      this.toast(text, 'good');
      const chip = $('btnMilestones');
      chip.classList.add('has-new');
      chip.classList.toggle('bump', false); void chip.offsetWidth; chip.classList.add('bump');
      $('trophies').textContent = this.game.milestones.count;
    });
    bus.on('reset', () => { this.refreshOrder(); this.refreshTutorial(); this.showInspector(null); this.moneyShown = this.game.economy.money; });
  }

  _stationWorld(ev) {
    const sim = this.game.sim;
    const e = sim.entities.get(ev.machineId);
    const x = e ? e.x + e.size[0] / 2 : ev.x + 0.5;
    const y = e ? e.y + e.size[1] / 2 : ev.y + 0.5;
    return { gx: x, gy: y, h: 1.6 };
  }

  // ------------------------------------------------------------- HUD
  update(dt) {
    const eco = this.game.economy;
    // Animated money counter.
    const target = eco.money;
    if (this.moneyShown !== target) {
      const diff = target - this.moneyShown;
      this.moneyShown += Math.abs(diff) < 1 ? diff : diff * Math.min(1, dt * 10);
      if (diff > 0 && Math.abs(diff) > 30 && !this._bumped) { const m = document.querySelector('.stat.money'); m.classList.remove('bump'); void m.offsetWidth; m.classList.add('bump'); this._bumped = true; }
    } else this._bumped = false;
    $('money').textContent = fmt(this.moneyShown);

    // Keep 2D cake pictures turned the same way as the 3D view.
    const vr = this.viewRot;
    if (this._orderCake && Math.abs(vr - (this._lastViewRot ?? 99)) > 0.01) {
      this._lastViewRot = vr;
      drawCake($('orderCake'), this._orderCake, { rotation: vr, compass: true });
      if (this._lastReject) drawCake($('orderLastCake'), this._lastReject.cake, { rotation: vr });
      if (this.selected && this._inspCakeObj) drawCake($('inspCake'), this._inspCakeObj, { rotation: vr, compass: true });
    }
    this._hudT -= dt;
    if (this._hudT <= 0) {
      this._hudT = 0.5;
      const now = this.game.sim.time;
      $('income').textContent = `$${fmt(eco.incomePerMinute(now))}`;
      $('rate').textContent = eco.cakesPerMinute(now);
      $('level').textContent = this.game.level;
      $('trophies').textContent = this.game.milestones.count;
      const unlocked = this.game.unlocks.machines;
      for (const [t, b] of Object.entries(this.toolButtons)) {
        const def = MACHINE_DEFS[t];
        if (!def) continue;
        const locked = !unlocked.has(t);
        b.classList.toggle('locked', locked);
        b.classList.toggle('cant', !locked && !eco.canAfford(def.cost));
        if (locked) {
          const src = this.game.unlockSource('machines', t);
          b.title = `${def.name} – unlocks after the “${src}” order`;
        } else b.title = `${def.name} ($${def.cost}) – ${def.description} [${def.hotkey}]`;
      }
      this._updateBonus(now);
      this._updateTutorialHint();
    }
    this._inspT -= dt;
    if (this._inspT <= 0 && this.selected) { this._inspT = 0.25; this._renderInspector(); }
  }

  setSaveStatus(status, persistent) {
    const el = $('saveStatus');
    el.classList.remove('ok', 'err');
    if (!persistent) { el.textContent = 'Not saved (storage off)'; el.classList.add('err'); return; }
    if (status === 'saved') { el.textContent = '✓ Saved'; el.classList.add('ok'); }
    else if (status === 'saving') el.textContent = 'Saving…';
    else if (status === 'pending') el.textContent = 'Unsaved changes';
    else if (status === 'error') { el.textContent = '⚠ Save failed'; el.classList.add('err'); }
    else el.textContent = '—';
  }

  setPaused(p) {
    $('pauseOverlay').classList.toggle('hidden', !p);
    $('pauseIcon').innerHTML = p
      ? '<path d="M7 5l12 7-12 7z" fill="currentColor"/>'
      : '<rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor"/>';
  }

  // ------------------------------------------------------------- order
  refreshOrder() {
    const om = this.game.orders;
    const o = om.current;
    const sw = $('orderSwitch');
    const alt = om.alternative;
    sw.classList.toggle('hidden', !alt);
    if (alt) sw.innerHTML = `⇄ <b>${alt.repeat ? 'Repeat' : 'New'}:</b> ${alt.name.replace(/ Contract #\d+$/, '')} · $${alt.perCake}/cake${alt.repeat ? ' <small>(same line as last time)</small>' : ''}`;
    if (this._orderId !== o.id + o.cake) {
      this._orderId = o.id + o.cake;
      this._orderCake = parseCakeKey(o.cake);
      $('orderPanel').classList.remove('pulse'); void $('orderPanel').offsetWidth; $('orderPanel').classList.add('pulse');
    }
    $('orderName').textContent = o.name;
    $('orderCustomer').textContent = `for ${o.customer}`;
    { const d = describeCake(this._orderCake); $('orderDesc').textContent = d[0].toUpperCase() + d.slice(1); }
    $('orderProgress').textContent = `${om.delivered} / ${o.quantity}`;
    $('orderBar').style.width = `${(om.delivered / o.quantity) * 100}%`;
    $('orderPer').textContent = `$${o.perCake}`;
    $('orderReward').textContent = `$${fmt(o.reward)}`;
    $('orderHint').textContent = o.hint ? `💡 ${o.hint}` : '';
    this._showLastReject();
    requestAnimationFrame(() => drawCake($('orderCake'), this._orderCake, { rotation: this.viewRot, compass: true }));
    this._updateBonus(this.game.sim.time);
  }

  _showLastReject() {
    const box = $('orderLast');
    const r = this._lastReject;
    if (!r || r.orderId !== this.game.orders.current.id) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    $('orderLastText').textContent = r.reason;
    drawCake($('orderLastCake'), r.cake, { rotation: this.viewRot });
  }

  _updateBonus(now) {
    const om = this.game.orders;
    const o = om.current;
    const el = $('orderBonus');
    if (!o.bonus) { el.textContent = ''; return; }
    el.classList.remove('lost');
    if (om.delivered === 0) { el.textContent = `★ Bonus +$${o.bonus.reward}: ${o.bonus.text} (timer starts with the first cake)`; return; }
    const left = om.bonusRemaining(now);
    if (left > 0) el.textContent = `★ Bonus +$${o.bonus.reward} · ${left.toFixed(0)} s left`;
    else { el.textContent = `★ Bonus +$${o.bonus.reward} missed`; el.classList.add('lost'); }
  }

  // ------------------------------------------------------------- inspector
  showInspector(entity) {
    this.selected = entity;
    $('inspector').classList.toggle('hidden', !entity);
    if (entity) this._renderInspector();
  }

  _renderInspector() {
    const e = this.selected;
    if (!e || !this.game.sim.entities.has(e.id)) { this.showInspector(null); return; }
    $('inspTitle').textContent = e.def.name;
    const st = $('inspStatus');
    const rows = [];
    const cakeCanvas = $('inspCake');
    let cake = null;
    if (e.kind === 'belt') {
      const blocked = e.blocked;
      st.className = `insp-status ${blocked ? 'blocked' : e.item ? 'working' : 'idle'}`;
      st.textContent = blocked ? 'Blocked' : e.item ? 'Moving' : 'Empty';
      rows.push(['Direction', DIR_NAMES[e.dir]]);
      rows.push(['Speed', `${this.game.sim.beltSpeed.toFixed(1)} cells/s`]);
      if (e.item) { cake = e.item.cake; rows.push(['Carrying', describeCake(cake)]); }
      if (blocked) rows.push(['Why', 'Nothing can take the cake ahead']);
    } else {
      st.className = `insp-status ${e.status}`;
      st.textContent = STATUS_TEXT[e.status] || e.status;
      if (e.type === 'oven') {
        rows.push(['Bakes', `Whole ${(FLAVORS[e.config.flavor]?.name ?? 'vanilla').toLowerCase()} cake`]);
        rows.push(['Bake time', `${e.bakeTime.toFixed(1)} s`]);
        rows.push(['Throughput', `${(60 / e.bakeTime).toFixed(0)} cakes/min`]);
        rows.push(['Progress', `${Math.round(e.progress * 100)}%`]);
        rows.push(['Baked', `${e.producedTotal}`]);
        rows.push(['Output', DIR_NAMES[e.outputs[0].dir]]);
        if (e.buffer.length) cake = e.buffer[0];
        if (e.status === STATUS.NO_OUTPUT) rows.push(['Tip', 'Place a belt on the orange arrow']);
      } else if (e.type === 'delivery') {
        rows.push(['Accepts', 'From every side']);
        rows.push(['Accepted', `${e.acceptedTotal}`]);
        rows.push(['Rejected', `${e.rejectedTotal}`]);
        if (e.lastCake) { cake = e.lastCake; rows.push(['Last cake', e.lastAccepted ? '✓ accepted' : '✗ rejected']); }
      } else if (e.type === 'trash') {
        rows.push(['Accepts', 'From every side']);
        rows.push(['Thrown away', `${e.trashedTotal}`]);
      } else if (e.outSlots) {
        const what = {
          froster: `Frosts the top layer ${FROSTINGS[e.config.color]?.name.toLowerCase()}`,
          cutter: 'West half (left in the order picture) → L exit · east half → R exit',
          rotator: { cw: 'Rotates 90° clockwise', ccw: 'Rotates 90° counter-clockwise', '180': 'Rotates 180°' }[e.config.mode],
          combiner: 'Joins two pieces that fit together',
        }[e.type];
        rows.push(['Does', what]);
        rows.push(['Cycle time', `${e.processTime.toFixed(1)} s`]);
        rows.push(['Throughput', `${(60 / e.processTime).toFixed(0)} / min max`]);
        if (e.working) rows.push(['Progress', `${Math.round(e.progress * 100)}%`]);
        rows.push(['Processed', `${e.processedTotal}`]);
        if (e.status === STATUS.INCOMPATIBLE && e.refuseReason) rows.push(['Problem', `${e.refuseReason} – the two inputs must fill different quadrants`]);
        if (e.status === STATUS.NO_OUTPUT) rows.push(['Tip', 'Connect a belt to every orange arrow (or a Trash Bin)']);
        cake = e.current?.find(Boolean) || e.outSlots.find(Boolean) || e.inSlots.find(Boolean) || null;
        if (e.type === 'combiner' && e.current) {
          const both = e.current.filter(Boolean);
          if (both.length === 2) cake = { layers: both[0].layers.map((l, li) => ({ quadrants: l.quadrants.map((q, qi) => q || both[1].layers[li].quadrants[qi]) })) };
        }
      }
    }
    // Machine settings – only unlocked values are offered; locked ones say why.
    const cfg = $('inspConfig');
    const opts = e.kind === 'machine' ? (CONFIG_OPTIONS[e.type] || []) : [];
    if (opts.length) {
      // Only touch the DOM when something changed: re-creating the buttons every
      // refresh made clicks get lost (mouse down on the old button, up on the new one).
      const html = opts.map((opt) => this._configHtml(e, opt)).join('');
      if (cfg.dataset.html !== html) { cfg.innerHTML = html; cfg.dataset.html = html; }
      cfg.classList.remove('hidden');
    } else cfg.classList.add('hidden');
    this._renderUpgradeCard(e);
    $('inspBody').innerHTML = rows.map(([a, b]) => `<div class="row"><span>${a}</span><span>${b}</span></div>`).join('');
    cakeCanvas.classList.toggle('hidden', !cake);
    this._inspCakeObj = cake;
    if (cake) drawCake(cakeCanvas, cake, { rotation: this.viewRot, compass: true });
    $('inspRemove').textContent = `Remove (+$${e.kind === 'machine' ? e.invested : e.def.cost})`;
  }

  // ------------------------------------------------------------- tutorial
  refreshTutorial() {
    const t = this.game.tutorial;
    const step = t.currentStep;
    for (const b of Object.values(this.toolButtons)) b.classList.remove('highlight');
    this.onHighlight?.(step?.highlight?.world || []);
    $('tutorial').classList.toggle('is-tip', false);
    if (!step) { this._showMachineTip(); return; }
    $('tutorial').classList.remove('hidden');
    $('tutStep').textContent = `Tutorial ${t.step + 1}/${TUTORIAL_STEPS.length}`;
    $('tutTitle').textContent = step.title;
    $('tutText').innerHTML = step.text;
    $('tutHint').classList.add('hidden');
    const next = $('tutNext');
    next.classList.toggle('hidden', step.advance !== 'button');
    next.textContent = step.button || 'Next';
    if (step.highlight?.tool && this.toolButtons[step.highlight.tool]) this._highlightTool(step.highlight.tool);
    if (step.id === 'reward' || step.id === 'expand') $('tutSkip').classList.add('hidden'); else $('tutSkip').classList.remove('hidden');
  }

  /** After the tutorial: explain a machine the moment an order first needs it. */
  _showMachineTip() {
    const id = this.game.pendingMachineTip(Object.keys(MACHINE_TIPS));
    this._tip = id;
    if (!id) { $('tutorial').classList.add('hidden'); return; }
    const tip = MACHINE_TIPS[id];
    $('tutorial').classList.remove('hidden');
    $('tutorial').classList.add('is-tip');
    $('tutStep').textContent = 'How it works';
    $('tutTitle').textContent = tip.title;
    $('tutText').innerHTML = `<div class="tip-svg">${tip.svg}</div>${tip.text}`;
    $('tutHint').classList.add('hidden');
    $('tutSkip').classList.add('hidden');
    $('tutNext').classList.remove('hidden');
    $('tutNext').textContent = 'Got it';
    if (this.toolButtons[id]) this._highlightTool(id);
  }

  _updateTutorialHint() {
    const step = this.game.tutorial.currentStep;
    if (!step || !step.hintBlocked) return;
    let blocked = false;
    for (const e of this.game.sim.entities.values()) if (e.kind === 'belt' && e.blocked) { blocked = true; break; }
    const h = $('tutHint');
    h.textContent = step.hintBlocked;
    h.classList.toggle('hidden', !blocked);
  }

  // ------------------------------------------------------------- feedback
  toast(text, kind = '') {
    const box = $('toasts');
    if (box.children.length > 3) box.firstChild.remove();
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 2200);
  }

  /** Floating text at a grid position ({gx, gy, h}). */
  popup(text, at, cls = '') {
    const el = document.createElement('div');
    el.className = `popup ${cls}`;
    el.textContent = text;
    const p = this.worldToScreen?.(at);
    if (!p) return;
    el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
    $('popups').appendChild(el);
    setTimeout(() => el.remove(), 1150);
  }

  setCursorTip(tip, client) {
    const el = $('cursorTip');
    if (!tip || !client) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = `${tip.text}${tip.bad ? `<span class="bad">${tip.bad}</span>` : ''}`;
    el.style.left = `${client.x}px`; el.style.top = `${client.y}px`;
  }

  // ------------------------------------------------------------- modals
  openModal(html, { onClose } = {}) {
    $('modalCard').innerHTML = html;
    $('modal').classList.remove('hidden');
    this._onModalClose = onClose;
    $('modal').onclick = (e) => { if (e.target.id === 'modal') this.closeModal(); };
    if (this.input) this.input.enabled = false;
  }

  closeModal() {
    $('modal').classList.add('hidden');
    $('modalCard').innerHTML = '';
    if (this.input) this.input.enabled = true;
    const cb = this._onModalClose; this._onModalClose = null;
    cb?.();
  }

  openSettings() {
    const s = this.game.settings;
    this.openModal(`
      <h2>Settings</h2>
      <div class="row"><span>Volume</span><input type="range" id="setVol" min="0" max="1" step="0.05" value="${s.volume}"></div>
      <div class="row"><span>Music</span><input type="range" id="setMusic" min="0" max="1" step="0.05" value="${s.music ?? 0.5}"></div>
      <div class="row"><span>Mute</span><input type="checkbox" id="setMute" ${s.muted ? 'checked' : ''}></div>
      <div class="row"><span>Graphics quality</span>
        <select id="setQuality">
          ${['auto', 'low', 'medium', 'high'].map((q) => `<option value="${q}" ${s.quality === q ? 'selected' : ''}>${q[0].toUpperCase() + q.slice(1)}</option>`).join('')}
        </select></div>
      <div class="row"><span>Help</span><button class="btn small" id="setHelp">How to play</button></div>
      <div class="row"><span>Progress</span><button class="btn small danger" id="setReset">Reset progress…</button></div>
      <div class="actions"><button class="btn primary" id="setClose">Done</button></div>
      <div class="copyright">${COPYRIGHT}</div>`);
    $('setVol').oninput = (e) => { s.volume = Number(e.target.value); this.onSettingsChange(); };
    $('setMusic').oninput = (e) => { s.music = Number(e.target.value); this.onSettingsChange(); };
    $('setMute').onchange = (e) => { s.muted = e.target.checked; this.onSettingsChange(); };
    $('setQuality').onchange = (e) => { s.quality = e.target.value; this.onSettingsChange(); };
    $('setClose').onclick = () => this.closeModal();
    $('setHelp').onclick = () => this.openHelp();
    $('setReset').onclick = () => this.confirm('Reset all progress?', 'Your factory, money and orders will be deleted. This cannot be undone.', 'Reset', () => this.onResetProgress());
  }

  confirm(title, text, okLabel, onOk) {
    this.openModal(`<h2>${title}</h2><p>${text}</p>
      <div class="actions"><button class="btn" id="cfCancel">Cancel</button><button class="btn danger" id="cfOk">${okLabel}</button></div>`);
    $('cfCancel').onclick = () => this.closeModal();
    $('cfOk').onclick = () => { this.closeModal(); onOk(); };
  }

  openHelp() {
    this.openModal(`
      <h2>How to play</h2>
      <p>Customers order cakes. Build <b>ovens</b>, connect them with <b>conveyor belts</b> and send the cakes into a <b>Delivery Station</b>. Correct cakes earn money – spend it to grow your factory.</p>
      <div class="help-section">Mouse &amp; keyboard</div>
      <div class="help-grid">
        <b>Left click</b><span>Select / place</span>
        <b>Left drag</b><span>Build a conveyor line (Conveyor tool) · pan (other tools)</span>
        <b>Right click</b><span>Cancel / deselect</span>
        <b>R</b><span>Rotate the piece you are placing or the selected machine</span>
        <b>Wheel</b><span>Zoom</span>
        <b>Scroll-wheel drag</b><span>Rotate the view (left/right) and tilt it (up/down)</span>
        <b>Space + drag · Right drag</b><span>Move the camera</span>
        <b>Q / E</b><span>Rotate the view 90°</span>
        <b>Page Up / Down · Home</b><span>Tilt the view · reset the view</span>
        <b>1 – 8</b><span>Conveyor · Oven · Frosting · Cutter · Rotator · Combiner · Trash · Delivery</span>
        <b>M · U · X · V</b><span>Move · Upgrade · Delete · Select</span>
        <b>Delete</b><span>Remove the selected machine</span>
        <b>P · Esc</b><span>Pause · Cancel / close</span>
      </div>
      <div class="help-section">Touch</div>
      <div class="help-grid">
        <b>Tap</b><span>Place / select</span>
        <b>Drag</b><span>Build belts (Conveyor tool) or move the camera</span>
        <b>Two fingers</b><span>Pinch to zoom, twist to rotate, drag to pan</span>
        <b>Three fingers</b><span>Drag up/down to tilt the view</span>
      </div>
      <div class="help-section">Tips</div>
      <p>Green floor arrows are machine inputs, orange arrows outputs. Quadrants are always named from above: top-left, top-right, bottom-right, bottom-left. Click any cake picture to inspect it. Belts feeding into the side of another belt merge automatically. A red belt or a red <b>!</b> means cakes are stuck – follow the line to find the gap. Removing things refunds their full price.</p>
      <div class="actions"><button class="btn primary" id="helpClose">Got it</button></div>
      <div class="copyright">${COPYRIGHT}</div>`);
    $('helpClose').onclick = () => this.closeModal();
  }

  celebrate(ev) {
    this.audio.play('complete');
    this._confetti();
    // Repeatable contracts unlock nothing: celebrate without stopping play.
    const nothingNew = !ev.unlocked?.length && /^contract_/.test(ev.order.id);
    if (nothingNew && $('modal').classList.contains('hidden')) {
      const el = document.createElement('div');
      el.className = 'win-banner';
      el.innerHTML = `<div class="wb-title">Contract complete!</div><div class="wb-amt">+$${fmt(ev.completionReward)}</div>${
        ev.order.bonus ? `<div class="wb-sub">${ev.bonus ? '★ Time bonus earned' : 'Bonus missed – speed up your line'}</div>` : ''}<div class="wb-sub">Next: ${ev.next.name} · ${ev.next.quantity} cakes</div>`;
      document.body.appendChild(el);
      setTimeout(() => el.classList.add('out'), 2600);
      setTimeout(() => el.remove(), 3000);
      return;
    }
    const bonusLine = ev.order.bonus
      ? (ev.bonus ? `<div class="bonus-line">★ Bonus earned: +$${ev.order.bonus.reward}</div>` : `<div class="next">Bonus missed – faster lines earn +$${ev.order.bonus.reward} next time.</div>`)
      : '';
    this.openModal(`
      <div class="celebrate">
        <h2>Order completed!</h2>
        <div>${ev.order.name} for ${ev.order.customer}</div>
        <canvas id="celebCake" width="140" height="140"></canvas>
        <div class="reward">+$<span id="celebAmt">0</span></div>
        ${bonusLine}
        ${this._unlockHtml(ev.unlocked)}
        <div class="next">Next order: <b>${ev.next.name}</b> – ${ev.next.quantity} cakes</div>
        <div class="actions" style="justify-content:center"><button class="btn primary" id="celebOk">Continue</button></div>
      </div>`, { onClose: () => clearTimeout(this._celebTimer) });
    drawCake($('celebCake'), parseCakeKey(ev.order.cake));
    const total = ev.completionReward;
    const t0 = performance.now();
    const tick = () => {
      const el = $('celebAmt');
      if (!el) return;
      const k = Math.min(1, (performance.now() - t0) / 700);
      el.textContent = fmt(total * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    $('celebOk').onclick = () => this.closeModal();
    clearTimeout(this._celebTimer);
    this._celebTimer = setTimeout(() => { if ($('celebOk')) this.closeModal(); }, 5000);
  }

  _configHtml(e, opt) {
    const cur = e.config[opt.key];
    if (opt.kind === 'flavor' || opt.kind === 'frosting') {
      const table = opt.kind === 'flavor' ? FLAVORS : FROSTINGS;
      const unlocked = this.game.unlocks[opt.kind === 'flavor' ? 'flavors' : 'frostings'];
      return `<div class="cfg-label">${opt.kind === 'flavor' ? 'Flavor' : 'Frosting color'}</div><div class="swatches">${
        Object.entries(table).map(([k, v]) => {
          const ok = unlocked.has(k);
          return `<button class="swatch ${k === cur ? 'on' : ''} ${ok ? '' : 'locked'}" data-kind="${opt.kind}" data-key="${opt.key}" data-val="${k}" title="${v.name}${ok ? '' : ' – locked'}" style="--c:${v.color}"></button>`;
        }).join('')}</div><div class="cfg-name">${table[cur]?.name ?? ''}${
          [...unlocked].length < Object.keys(table).length ? ' <small class="cfg-more">· more unlock with orders</small>' : ''}</div>`;
    }
    if (opt.kind === 'mode') {
      // Array (not object) so the order stays cw, ccw, 180.
      const labels = [['cw', '⟳ 90° clockwise'], ['ccw', '⟲ 90° counter-clockwise'], ['180', '↻ 180°']];
      return `<div class="cfg-label">Direction</div><div class="seg-btns">${labels.map(([k, label]) => {
        const need = ROTATOR_MODE_LEVEL[k];
        const ok = e.level >= need;
        return `<button class="seg ${k === cur ? 'on' : ''}" ${ok ? '' : 'disabled'} data-key="mode" data-val="${k}" title="${ok ? label : `Needs level ${need}`}">${label}${ok ? '' : ` <small>L${need}</small>`}</button>`;
      }).join('')}</div>`;
    }
    if (opt.kind === 'mask') {
      const ok = e.level >= opt.minLevel;
      const m = cur || [true, true, true, true];
      const names = ['TL', 'TR', 'BL', 'BR'];
      const order = [0, 1, 3, 2]; // grid order: TL TR / BL BR
      return `<div class="cfg-label">Frost quadrants ${ok ? '' : `<small>(level ${opt.minLevel})</small>`}</div><div class="quad-grid ${ok ? '' : 'locked'}">${
        order.map((qi, i) => `<button class="quad ${m[qi] ? 'on' : ''}" ${ok ? '' : 'disabled'} data-q="${qi}" title="${QUADRANT_NAMES[qi]}">${names[i]}</button>`).join('')}</div>`;
    }
    return '';
  }

  /** Upgrade card: level stars, next level price and before → after numbers. */
  _renderUpgradeCard(e) {
    const box = $('inspUpgradeBox');
    if (e.kind !== 'machine' || e.maxLevel === 1) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const stars = '★'.repeat(e.level) + '☆'.repeat(e.maxLevel - e.level);
    const rate = (lv) => {
      const mult = UPGRADES.SPEED[lv - 1];
      if (e.type === 'oven') return `${(60 / (e.def.bakeTime / mult)).toFixed(0)} cakes/min`;
      return `${(60 / (e.def.processTime / mult)).toFixed(0)}/min`;
    };
    let rows = `<div class="row"><span>Level</span><span class="stars">${stars}</span></div>`;
    if (e.canUpgrade) {
      const nl = e.level + 1;
      rows += `<div class="row"><span>Speed</span><span>${rate(e.level)} → <b>${rate(nl)}</b></span></div>`;
      if (e.type === 'oven' && UPGRADES.OVEN_BUFFER[nl - 1] !== UPGRADES.OVEN_BUFFER[e.level - 1]) {
        rows += `<div class="row"><span>Buffer</span><span>${UPGRADES.OVEN_BUFFER[e.level - 1]} → <b>${UPGRADES.OVEN_BUFFER[nl - 1]}</b></span></div>`;
      }
      const feat = UPGRADES.FEATURES[e.type]?.[nl];
      if (feat) rows += `<div class="row"><span>New</span><span><b>${feat}</b></span></div>`;
    } else rows += '<div class="row"><span>Speed</span><span><b>MAX</b></span></div>';
    $('inspUpgradeInfo').innerHTML = rows;
    const btn = $('inspUpgrade');
    btn.classList.toggle('hidden', !e.canUpgrade);
    btn.textContent = `⬆ Upgrade to level ${e.level + 1} · $${e.upgradeCost.toLocaleString('en-US')}`;
    btn.disabled = !this.game.economy.canAfford(e.upgradeCost);
  }

  /** Bakery Upgrades panel: factory-wide upgrades and expansion. */
  openUpgrades() {
    const render = () => {
      const g = this.game;
      const cards = Object.entries(GLOBAL_UPGRADES).map(([k, d]) => {
        const lv = g.global[k];
        const max = lv >= d.values.length;
        const fmtv = (v) => (d.unit === '×' ? `${v.toFixed(2)}×` : `${v}×${v}`);
        const cost = g.globalNextCost(k);
        return `<div class="upg-card">
          <div class="upg-head"><b>${d.name}</b><span class="stars">${'★'.repeat(lv)}${'☆'.repeat(d.values.length - lv)}</span></div>
          <div class="upg-desc">${d.desc}</div>
          <div class="upg-val">${fmtv(d.values[lv - 1])}${max ? ' · <b>MAX</b>' : ` → <b>${fmtv(d.values[lv])}</b>`}</div>
          ${max ? '' : `<button class="btn small primary" data-buy="${k}" ${g.economy.canAfford(cost) ? '' : 'disabled'}>Buy · $${cost.toLocaleString('en-US')}</button>`}
        </div>`;
      }).join('');
      $('modalCard').innerHTML = `<h2>Bakery Upgrades</h2>
        <p class="upg-intro">Factory-wide improvements. Upgrade single machines from their panel (or with the Upgrade tool, key U).</p>
        <div class="upg-grid">${cards}</div>
        <div class="actions"><button class="btn primary" id="upgClose">Done</button></div>`;
      $('upgClose').onclick = () => this.closeModal();
      for (const b of document.querySelectorAll('[data-buy]')) {
        b.onclick = () => {
          const r = this.game.buyGlobal(b.dataset.buy);
          this.audio.play(r.ok ? 'upgrade' : 'invalid');
          if (r.ok) this.toast(`${GLOBAL_UPGRADES[b.dataset.buy].name} level ${r.level}!`, 'good');
          render();
        };
      }
    };
    this.openModal('');
    render();
  }

  /** Milestones panel: every long-term goal with its progress and reward. */
  openMilestones() {
    $('btnMilestones').classList.toggle('has-new', false);
    const ms = this.game.milestones;
    const prog = ms.progress(this.game.milestoneStats());
    // Unreached first (closest to done on top), then the reached ones.
    prog.sort((a, b) => (a.done - b.done) || (b.value / b.def.goal - a.value / a.def.goal));
    const items = prog.map(({ def, value, done }) => `
      <div class="ms-item ${done ? 'done' : ''}">
        <div class="ms-icon">🏆</div>
        <div><div class="ms-name">${def.name}</div><div class="ms-desc">${def.desc}${done ? '' : ` · ${fmt(value)} / ${fmt(def.goal)}`}</div>
          ${done ? '' : `<div class="ms-bar"><i style="width:${Math.round((value / def.goal) * 100)}%"></i></div>`}</div>
        <div class="ms-reward">${done ? '✓' : `+$${fmt(def.reward)}`}</div>
      </div>`).join('');
    this.openModal(`
      <h2>Milestones · ${ms.count}/${ms.total}</h2>
      <p class="ms-intro">Long-term goals for your bakery. Rewards are paid automatically.</p>
      <div class="ms-list">${items}</div>
      <div class="actions"><button class="btn primary" id="msClose">Done</button></div>`);
    $('msClose').onclick = () => this.closeModal();
  }

  _unlockHtml(list) {
    if (!list || !list.length) return '';
    const items = list.map((u) => {
      if (u.kind === 'machines') return `<div class="unlock-item">${ICONS[u.value] || ''}<span>${MACHINE_DEFS[u.value].name}</span></div>`;
      const t = u.kind === 'flavors' ? FLAVORS[u.value] : FROSTINGS[u.value];
      return `<div class="unlock-item"><i class="dot" style="--c:${t.color}"></i><span>${t.name} ${u.kind === 'flavors' ? 'flavor' : 'frosting'}</span></div>`;
    }).join('');
    return `<div class="unlocks"><div class="unlocks-title">Unlocked!</div><div class="unlock-list">${items}</div></div>`;
  }

  /** Large cake inspector: exact composition per quadrant, with a rotation preview. */
  openCakeInspector(cake, title, isOrder) {
    if (!cake) return;
    let view = cake;
    let turns = 0;
    const rowsHtml = (c) => c.layers.map((l, li) => `${c.layers.length > 1 ? `<div class="help-section">Layer ${li + 1}</div>` : ''}${
      l.quadrants.map((q, qi) => `<div class="row"><span>${QUADRANT_NAMES[qi]}</span><span>${q ? `<i class="dot" style="--c:${FLAVORS[q.flavor].color}"></i>${FLAVORS[q.flavor].name}${q.frosting ? ` · <i class="dot" style="--c:${FROSTINGS[q.frosting].color}"></i>${FROSTINGS[q.frosting].name} frosting` : ''}` : '<em>empty</em>'}</span></div>`).join('')}`).join('');
    this.openModal(`
      <h2>${title}</h2>
      <div class="cake-insp"><canvas id="ciCake" width="180" height="180"></canvas></div>
      <div class="ci-rot"><button class="btn small" id="ciRot">⟳ Preview rotation</button><span id="ciTurns" class="ci-turns">as ${isOrder ? 'ordered' : 'produced'}</span></div>
      <div id="ciRows">${rowsHtml(view)}</div>
      <p class="ci-note">The picture is turned like your current camera view; the pink arrow points to the factory's north (top-left = north-west). Preview rotation does not change the real cake.</p>
      <div class="actions"><button class="btn primary" id="ciClose">Close</button></div>`);
    const draw = () => { drawCake($('ciCake'), view, { rotation: this.viewRot, compass: true }); $('ciRows').innerHTML = rowsHtml(view); $('ciTurns').textContent = turns ? `preview: ${turns * 90}° clockwise` : `as ${isOrder ? 'ordered' : 'produced'}`; };
    requestAnimationFrame(draw);
    $('ciRot').onclick = () => { turns = (turns + 1) % 4; view = turns ? rotateCW(view) : cake; draw(); };
    $('ciClose').onclick = () => this.closeModal();
  }

  _confetti() {
    const colors = ['#ff8fb1', '#7fdcb0', '#ffe27a', '#8fcbff', '#c9b6ff', '#ffffff'];
    for (let i = 0; i < 60; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = `${Math.random() * 100}vw`;
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
      c.style.animationDelay = `${Math.random() * 0.4}s`;
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 3500);
    }
  }
}
