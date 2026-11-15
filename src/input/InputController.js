/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Mouse / touch / keyboard handling and build tools. All changes to the game
 * go through Game actions (buildMachine, buildBeltPath, removeEntity, …).
 */
import { dirBetween, rotatedSize, rotateLocal } from '../simulation/Grid.js';
import { getDef, MACHINE_DEFS, BUILDABLE_ORDER } from '../machines/MachineDefs.js';

export const TOOLS = ['select', ...BUILDABLE_ORDER, 'rotate', 'move', 'upgrade', 'delete'];
const isMachineTool = (t) => t !== 'belt' && !!MACHINE_DEFS[t];
/** Machines that accept from every side: no auto-rotation, centred placement. */
const OMNI_TYPES = new Set(['delivery', 'trash']);
const HOTKEYS = Object.fromEntries(BUILDABLE_ORDER.map((t) => [MACHINE_DEFS[t].hotkey, t]));
const DRAG_PX = 6;
const ORBIT_SPEED = 0.008;  // radians per pixel (middle-mouse orbit)
const TILT_SPEED = 0.006;

export class InputController {
  constructor({ canvas, game, camera, renderer, audio, ui }) {
    this.canvas = canvas;
    this.game = game;
    this.cam = camera;
    this.fr = renderer;
    this.audio = audio;
    this.ui = ui;
    this.tool = 'select';
    this.rot = 0;
    this.hoverCell = null;
    this.selectedId = 0;
    this.path = null;        // belt drag path
    this.carry = null;       // move tool: { id }
    this.pan = null;         // { x, y }
    this.orbit = null;       // middle-mouse rotate/tilt
    this.tilt3 = null;       // three-finger tilt
    this.pointers = new Map();
    this.pinch = null;
    this.spaceDown = false;
    this.down = null;        // { x, y, button, moved, pointerType }
    this.enabled = true;
    this.onSelect = () => {};
    this.onToolChange = () => {};
    this.onAction = () => {};
    this._lastClient = null;
    this._bind();
  }

  // ------------------------------------------------------------- tools
  setTool(tool) {
    if (!TOOLS.includes(tool)) return;
    if (MACHINE_DEFS[tool] && !this.game.isUnlocked('machines', tool)) {
      const src = this.game.unlockSource('machines', tool);
      this.game.bus.emit('actionFailed', src ? `${MACHINE_DEFS[tool].name} unlocks after the “${src}” order` : 'Not unlocked yet');
      this.audio.play('invalid');
      return;
    }
    this.tool = tool;
    this.path = null;
    this.carry = null;
    if (tool !== 'select') this.select(0);
    this.onToolChange(tool);
  }

  select(id) {
    this.selectedId = id || 0;
    this.onSelect(this.selectedId ? this.game.sim.entities.get(this.selectedId) : null);
  }

  rotateAction() {
    if (this.tool === 'belt' || isMachineTool(this.tool) || this.carry) {
      this.rot = (this.rot + 1) & 3;
      this._manualRot = true;
      this.audio.play('rotate');
      return;
    }
    const target = this.selectedId || this._entityIdAtHover();
    if (target) {
      const r = this.game.rotateEntity(target);
      this.audio.play(r.ok ? 'rotate' : 'invalid');
    }
  }

  removeSelected() {
    if (!this.selectedId) return;
    this.game.removeEntity(this.selectedId);
    this.audio.play('remove');
    this.select(0);
  }

  cancel() {
    if (this.path) { this.path = null; return; }
    if (this.carry) { this.carry = null; return; }
    if (this.tool !== 'select') { this.setTool('select'); return; }
    if (this.selectedId) this.select(0);
  }

  // ------------------------------------------------------------- helpers
  _rect() { return this.canvas.getBoundingClientRect(); }

  _cellAt(clientX, clientY) {
    const p = this.cam.groundAt(clientX, clientY, this._rect());
    if (!p) return null;
    return this.fr.worldToCell(p);
  }

  _entityIdAtHover() {
    if (!this.hoverCell) return 0;
    const e = this.game.sim.entityAt(this.hoverCell.x, this.hoverCell.y);
    return e ? e.id : 0;
  }

  /**
   * Anchor for placing a machine at the cursor cell. Directional machines put
   * their main port cell (first input, or first output for ovens) under the
   * cursor, so dropping one onto a belt slots it into that line. Machines that
   * accept from every side are centred instead.
   */
  _anchor(type, cell, rot) {
    const def = getDef(type);
    const port = OMNI_TYPES.has(type) ? null : (def.inputs[0] || def.outputs[0]);
    if (port) {
      const [lx, ly] = rotateLocal(port.x, port.y, def.w, def.h, rot);
      return { x: cell.x - lx, y: cell.y - ly };
    }
    const [w, h] = rotatedSize(def.w, def.h, rot);
    return { x: cell.x - Math.floor((w - 1) / 2), y: cell.y - Math.floor((h - 1) / 2) };
  }

  /**
   * While hovering a belt with a directional machine, turn the machine to
   * follow the belt (cakes enter its back, leave its front). Pressing R on the
   * same belt overrides this until the cursor leaves the belts.
   */
  _autoAlign(type, cell) {
    if (!type || OMNI_TYPES.has(type)) return;
    const b = this.game.sim.entityAt(cell.x, cell.y);
    if (!b || b.kind !== 'belt') { this._manualRot = false; return; }
    if (!this._manualRot) this.rot = b.dir;
  }

  _extendPath(cell) {
    const path = this.path;
    const last = path[path.length - 1];
    if (last.x === cell.x && last.y === cell.y) return;
    // Backtracking over the path removes the tail (undo while dragging).
    const idx = path.findIndex((c) => c.x === cell.x && c.y === cell.y);
    if (idx >= 0) { path.length = idx + 1; return; }
    // Walk orthogonally (x first, then y) so fast drags never skip cells.
    let cx = last.x, cy = last.y;
    while (cx !== cell.x || cy !== cell.y) {
      const nx = cx !== cell.x ? cx + Math.sign(cell.x - cx) : cx;
      const ny = cx !== cell.x ? cy : cy + Math.sign(cell.y - cy);
      const d = dirBetween(cx, cy, nx, ny);
      path[path.length - 1].dir = d;
      path.push({ x: nx, y: ny, dir: d });
      cx = nx; cy = ny;
      this.audio.play('belt');
    }
  }

  _pathValidity(c) {
    const sim = this.game.sim;
    if (!sim.grid.inBounds(c.x, c.y)) return false;
    const e = sim.entityAt(c.x, c.y);
    return !e || e.kind === 'belt';
  }

  // ------------------------------------------------------------- events
  _bind() {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => this._onDown(e));
    window.addEventListener('pointermove', (e) => this._onMove(e));
    window.addEventListener('pointerup', (e) => this._onUp(e));
    window.addEventListener('pointercancel', (e) => this._onUp(e, true));
    c.addEventListener('pointerleave', () => { if (!this.down) this.hoverCell = null; });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
      this.cam.zoomAt(f, e.clientX, e.clientY, this._rect());
    }, { passive: false });
    window.addEventListener('keydown', (e) => this._onKey(e, true));
    window.addEventListener('keyup', (e) => this._onKey(e, false));
    c.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
    window.addEventListener('blur', () => { this.spaceDown = false; this.pan = null; this.orbit = null; this.tilt3 = null; this.down = null; this.pointers.clear(); this.pinch = null; });
  }

  _onKey(e, down) {
    if (!this.enabled) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
    if (e.code === 'Space') { this.spaceDown = down; e.preventDefault(); return; }
    if (!down || e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'r') this.rotateAction();
    else if (k === 'q') this.cam.rotate(-1);
    else if (k === 'e') this.cam.rotate(1);
    else if (k === 'pageup') this.cam.tiltBy(0.15, true);
    else if (k === 'pagedown') this.cam.tiltBy(-0.15, true);
    else if (k === 'home') this.cam.resetView();
    else if (HOTKEYS[k]) this.setTool(HOTKEYS[k]);
    else if (k === 'v') this.setTool('select');
    else if (k === 'm') this.setTool('move');
    else if (k === 'u') this.setTool('upgrade');
    else if (k === 'x') this.setTool('delete');
    else if (k === 'delete' || k === 'backspace') this.removeSelected();
    else if (k === 'escape') this.cancel();
    else return;
    this.ui.onKeyAction?.(k);
  }

  _onDown(e) {
    if (!this.enabled) return;
    this.audio.unlock();
    try { this.canvas.setPointerCapture?.(e.pointerId); } catch { /* pointer already gone */ }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      // Pinch / twist starts: abandon any single-finger action.
      this.path = null; this.down = null; this.pan = null; this.orbit = null;
      this.pinch = this._pinchState();
      return;
    }
    if (this.pointers.size === 3) {
      // Three fingers: tilt the view up/down.
      this.pinch = null;
      this.tilt3 = { y: this._avgY() };
      return;
    }
    if (this.pointers.size > 3) return;
    this.down = { x: e.clientX, y: e.clientY, button: e.button, moved: false, pointerType: e.pointerType };
    this._lastClient = { x: e.clientX, y: e.clientY };
    const cell = this._cellAt(e.clientX, e.clientY);
    this.hoverCell = cell;

    if (e.button === 1) { e.preventDefault(); this.orbit = { x: e.clientX, y: e.clientY }; return; }
    if (e.button === 0 && this.spaceDown) { this.pan = { x: e.clientX, y: e.clientY }; return; }
    if (e.button === 2) { this.pan = { x: e.clientX, y: e.clientY, maybeCancel: true }; return; }
    if (e.button !== 0) return;

    if (this.tool === 'belt' && cell) {
      this.path = [{ x: cell.x, y: cell.y, dir: this.rot }];
    } else if (this.tool === 'delete' && cell) {
      this._deleteAt(cell);
    } else {
      // select / machine / rotate / move: a tap acts, a drag pans the camera.
      this.pan = { x: e.clientX, y: e.clientY, maybeClick: true };
    }
  }

  _pinchState() {
    const [a, b] = [...this.pointers.values()];
    return {
      d: Math.hypot(a.x - b.x, a.y - b.y),
      ang: Math.atan2(b.y - a.y, b.x - a.x),
      mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2,
    };
  }

  _avgY() {
    let y = 0;
    for (const p of this.pointers.values()) y += p.y;
    return y / Math.max(1, this.pointers.size);
  }

  _onMove(e) {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.tilt3 && this.pointers.size === 3) {
      const y = this._avgY();
      this.cam.tiltBy((y - this.tilt3.y) * TILT_SPEED);
      this.tilt3.y = y;
      return;
    }
    if (this.pinch && this.pointers.size === 2) {
      const n = this._pinchState();
      if (this.pinch.d > 0) this.cam.zoomAt(n.d / this.pinch.d, n.mx, n.my, this._rect());
      // Twist: the world follows the fingers.
      let da = n.ang - this.pinch.ang;
      if (da > Math.PI) da -= Math.PI * 2;
      if (da < -Math.PI) da += Math.PI * 2;
      this.cam.rotateBy(-da);
      this.cam.panPixels(n.mx - this.pinch.mx, n.my - this.pinch.my);
      this.pinch = n;
      return;
    }
    if (this.orbit) {
      this.cam.rotateBy((e.clientX - this.orbit.x) * ORBIT_SPEED);
      this.cam.tiltBy((e.clientY - this.orbit.y) * TILT_SPEED);
      this.orbit.x = e.clientX; this.orbit.y = e.clientY;
      return;
    }
    if (!this.enabled) return;
    if (e.target !== this.canvas && !this.down) { return; }
    this.hoverCell = this._cellAt(e.clientX, e.clientY);
    this._lastClient = { x: e.clientX, y: e.clientY };
    if (!this.down) return;
    if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > DRAG_PX) this.down.moved = true;
    if (this.pan) {
      if (this.down.moved || !this.pan.maybeClick) {
        this.cam.panPixels(e.clientX - this.pan.x, e.clientY - this.pan.y);
        this.pan.x = e.clientX; this.pan.y = e.clientY;
      }
      return;
    }
    if (this.path && this.hoverCell) this._extendPath(this.hoverCell);
    else if (this.tool === 'delete' && this.hoverCell) this._deleteAt(this.hoverCell);
  }

  _onUp(e, cancelled = false) {
    this.pointers.delete(e.pointerId);
    if (this.orbit && e.button === 1) { this.orbit = null; this.down = null; return; }
    if (this.tilt3) {
      if (this.pointers.size < 3) this.tilt3 = null;
      // Dropping from three to two fingers continues as pinch/twist.
      if (this.pointers.size === 2) this.pinch = this._pinchState();
      this.down = null; return;
    }
    if (this.pinch) {
      if (this.pointers.size < 2) this.pinch = null;
      this.down = null; return;
    }
    const down = this.down;
    this.down = null;
    if (!down || cancelled) { this.path = null; this.pan = null; return; }
    const pan = this.pan; this.pan = null;
    if (pan) {
      if (pan.maybeCancel && !down.moved) this.cancel();
      if (pan.maybeClick && !down.moved) this._click(this._cellAt(e.clientX, e.clientY));
      return;
    }
    if (down.button !== 0) return;
    if (this.path) {
      const path = this.path; this.path = null;
      const valid = path.filter((c) => this._pathValidity(c));
      if (!valid.length) { this.audio.play('invalid'); return; }
      const r = this.game.buildBeltPath(valid);
      if (r.ok) { this.audio.play('place'); this.onAction('belts', r); }
      else this.audio.play('invalid');
      return;
    }
  }

  _deleteAt(cell) {
    const e = this.game.sim.entityAt(cell.x, cell.y);
    if (!e) return;
    this.game.removeEntity(e.id);
    this.audio.play('remove');
    if (this.selectedId === e.id) this.select(0);
  }

  _click(cell) {
    if (!cell) return;
    const sim = this.game.sim;
    const ent = sim.entityAt(cell.x, cell.y);
    switch (this.tool) {
      case 'select':
        this.select(ent ? ent.id : 0);
        if (ent) this.audio.play('click');
        break;
      default: {
        if (!isMachineTool(this.tool)) break;
        this._autoAlign(this.tool, cell);
        const a = this._anchor(this.tool, cell, this.rot);
        const r = this.game.buildMachine(this.tool, a.x, a.y, this.rot);
        this.audio.play(r.ok ? 'place' : 'invalid');
        if (r.ok) this.onAction('machine', r);
        break;
      }
      case 'upgrade':
        if (ent) {
          const r = this.game.upgradeMachine(ent.id);
          this.audio.play(r.ok ? 'upgrade' : 'invalid');
        }
        break;
      case 'rotate':
        if (ent) { const r = this.game.rotateEntity(ent.id); this.audio.play(r.ok ? 'rotate' : 'invalid'); }
        break;
      case 'move':
        if (!this.carry) {
          if (ent) { this.carry = { id: ent.id }; this.rot = ent.rot; this._manualRot = true; this.select(0); this.audio.play('click'); }
        } else {
          const e = sim.entities.get(this.carry.id);
          if (!e) { this.carry = null; break; }
          if (e.kind !== 'belt') this._autoAlign(e.type, cell);
          const a = e.kind === 'belt' ? cell : this._anchor(e.type, cell, this.rot);
          const r = this.game.moveEntity(e.id, a.x, a.y, this.rot);
          this.audio.play(r.ok ? 'place' : 'invalid');
          if (r.ok) this.carry = null;
        }
        break;
    }
  }

  // ------------------------------------------------------------- per frame
  /** Builds the renderer preview + cursor tooltip. */
  update() {
    const sim = this.game.sim;
    const p = { hoverCell: null, machine: null, belts: null, selectedId: this.selectedId, building: this.tool !== 'select' };
    let tip = null;
    const cell = this.hoverCell;
    const touch = this.down?.pointerType === 'touch';
    if (cell && this.enabled) {
      if (this.tool !== 'select' && !touch) p.hoverCell = cell;
      if (isMachineTool(this.tool)) {
        const def = getDef(this.tool);
        this._autoAlign(this.tool, cell);
        const a = this._anchor(this.tool, cell, this.rot);
        const can = sim.canPlace(this.tool, a.x, a.y, this.rot, 0, { replaceBelts: true });
        const n = can.ok ? can.belts.length : 0;
        const net = def.cost - this.game.beltRefund(n);
        const afford = this.game.economy.canAfford(net);
        p.machine = { type: this.tool, x: a.x, y: a.y, rot: this.rot, valid: can.ok && afford };
        p.replaced = can.ok ? can.belts : [];
        const text = n ? `$${def.cost} · replaces ${n} belt${n === 1 ? '' : 's'} (+$${def.cost - net} back)` : `$${def.cost}`;
        tip = { text, bad: !can.ok ? can.reason : !afford ? 'Not enough money' : null };
      } else if (this.tool === 'belt') {
        if (this.path) {
          p.belts = this.path.map((c) => ({ ...c, valid: this._pathValidity(c) }));
          const newCount = this.path.filter((c) => this._pathValidity(c) && !sim.entityAt(c.x, c.y)).length;
          const cost = newCount * getDef('belt').cost;
          tip = { text: `${newCount} belt${newCount === 1 ? '' : 's'} · $${cost}`, bad: cost > this.game.economy.money ? 'Not enough money' : null };
        } else {
          p.belts = [{ x: cell.x, y: cell.y, dir: this.rot, valid: this._pathValidity(cell) }];
          tip = { text: `$${getDef('belt').cost} · drag to build`, bad: null };
        }
      } else if (this.tool === 'move' && this.carry) {
        const e = sim.entities.get(this.carry.id);
        if (e) {
          if (e.kind === 'belt') {
            const ok = sim.canPlace('belt', cell.x, cell.y, this.rot, e.id).ok;
            p.belts = [{ x: cell.x, y: cell.y, dir: this.rot, valid: ok }];
          } else {
            this._autoAlign(e.type, cell);
            const a = this._anchor(e.type, cell, this.rot);
            const can = sim.canPlace(e.type, a.x, a.y, this.rot, e.id, { replaceBelts: true });
            p.machine = { type: e.type, x: a.x, y: a.y, rot: this.rot, valid: can.ok };
            p.replaced = can.ok ? can.belts : [];
          }
          tip = { text: `Moving ${e.def.name} · R to rotate`, bad: null };
        }
      } else if (this.tool === 'move') {
        tip = { text: 'Click a machine or belt to move it', bad: null };
      } else if (this.tool === 'upgrade') {
        const e = sim.entityAt(cell.x, cell.y);
        if (e && e.kind === 'machine') {
          tip = e.canUpgrade
            ? { text: `Upgrade ${e.def.name} → level ${e.level + 1} · $${e.upgradeCost}`, bad: this.game.economy.canAfford(e.upgradeCost) ? null : 'Not enough money' }
            : { text: e.maxLevel === 1 ? `${e.def.name} has no upgrades` : `${e.def.name} is at max level`, bad: null };
        }
      } else if (this.tool === 'delete') {
        const e = sim.entityAt(cell.x, cell.y);
        tip = e ? { text: `Remove ${e.def.name} (+$${e.kind === 'machine' ? e.invested : e.def.cost})`, bad: null } : null;
      } else if (this.tool === 'rotate') {
        const e = sim.entityAt(cell.x, cell.y);
        tip = e ? { text: `Rotate ${e.def.name}`, bad: null } : null;
      }
    }
    this.fr.setPreview(p);
    this.ui.setCursorTip(touch ? null : tip, this._lastClient);
  }
}
