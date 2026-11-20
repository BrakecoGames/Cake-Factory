/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Orthographic isometric camera with smooth pan / zoom / 90° rotation,
 * bounds, and screen→ground picking.
 */
import * as THREE from 'three';

const ISO_ELEVATION = Math.atan(1 / Math.SQRT2); // true isometric
const BASE_VIEW = 15; // world units visible vertically at zoom 1
const MIN_ZOOM = 0.45, MAX_ZOOM = 2.6;
const MIN_ELEV = 20 * Math.PI / 180, MAX_ELEV = 82 * Math.PI / 180;
const DEFAULT_AZIMUTH = Math.PI / 4;

export class CameraController {
  constructor(width, height) {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 200);
    this.target = new THREE.Vector3();
    this.goal = new THREE.Vector3();
    this.zoom = 1; this.goalZoom = 1;
    this.rotIndex = 0;
    this.azimuth = DEFAULT_AZIMUTH; this.goalAzimuth = DEFAULT_AZIMUTH;
    this.elevation = ISO_ELEVATION; this.goalElevation = ISO_ELEVATION;
    this.bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._v2 = new THREE.Vector2();
    this._hit = new THREE.Vector3();
    this.resize(width, height);
    this._apply();
  }

  setBounds(halfW, halfH) {
    const m = 2;
    // Extra room on the east side for the Cake Shop counter.
    this.bounds = { minX: -halfW - m, maxX: halfW + m + 3, minZ: -halfH - m, maxZ: halfH + m };
  }

  /** Bounds from a world rectangle (wings and corridors included), plus the Cake Shop on the east. */
  setBoundsRect(r) {
    const m = 2;
    this.bounds = { minX: r.minX - m, maxX: r.maxX + m + 3, minZ: r.minZ - m, maxZ: r.maxZ + m };
  }

  resize(w, h) {
    this.viewW = w; this.viewH = h;
    this.aspect = w / Math.max(1, h);
    // Portrait screens (phones) get a wider view so the factory fits.
    this.baseView = this.aspect < 0.8 ? BASE_VIEW * 1.55 : BASE_VIEW;
    this._updateProjection();
  }

  _updateProjection() {
    const hh = (this.baseView / this.zoom) / 2;
    const hw = hh * this.aspect;
    const c = this.camera;
    c.left = -hw; c.right = hw; c.top = hh; c.bottom = -hh;
    c.updateProjectionMatrix();
  }

  _clamp(v) {
    v.x = Math.min(this.bounds.maxX, Math.max(this.bounds.minX, v.x));
    v.z = Math.min(this.bounds.maxZ, Math.max(this.bounds.minZ, v.z));
    v.y = 0;
    return v;
  }

  _apply() {
    const d = 40;
    const ce = Math.cos(this.elevation);
    this.camera.position.set(
      this.target.x + Math.cos(this.azimuth) * ce * d,
      this.target.y + Math.sin(this.elevation) * d,
      this.target.z + Math.sin(this.azimuth) * ce * d,
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }

  update(dt) {
    const k = 1 - Math.exp(-dt * 12);
    this.target.lerp(this.goal, k);
    const z0 = this.zoom;
    this.zoom += (this.goalZoom - this.zoom) * k;
    const kr = 1 - Math.exp(-dt * 14);
    this.azimuth += (this.goalAzimuth - this.azimuth) * kr;
    this.elevation += (this.goalElevation - this.elevation) * kr;
    if (Math.abs(z0 - this.zoom) > 1e-5) this._updateProjection();
    this._apply();
  }

  /** Ground-plane point (y=0) under a client pixel, or null. */
  groundAt(clientX, clientY, rect, out = new THREE.Vector3()) {
    this._v2.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this._ray.setFromCamera(this._v2, this.camera);
    return this._ray.ray.intersectPlane(this._plane, out);
  }

  /** Pan so the ground point under `from` moves under `to` (pixels). */
  panPixels(dx, dy) {
    // World units per pixel at the current zoom.
    const upp = (this.baseView / this.zoom) / this.viewH;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0); right.y = 0; right.normalize();
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1); up.y = 0; up.normalize();
    // Vertical screen motion maps to a longer ground distance in isometric view.
    const vScale = 1 / Math.sin(this.elevation);
    this.goal.addScaledVector(right, -dx * upp).addScaledVector(up, dy * upp * vScale);
    this._clamp(this.goal);
    this.target.copy(this.goal); // panning is direct for precise control
  }

  zoomAt(factor, clientX, clientY, rect) {
    const nz = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.goalZoom * factor));
    const real = nz / this.goalZoom;
    if (real === 1) return;
    if (clientX != null) {
      const p = this.groundAt(clientX, clientY, rect, new THREE.Vector3());
      if (p) this.goal.add(p.sub(this.goal).multiplyScalar(1 - 1 / real));
      this._clamp(this.goal);
    }
    this.goalZoom = nz;
  }

  /** Snap-rotate the view by 90° steps (Q/E and buttons), landing on the isometric angles. */
  rotate(step) {
    const q = Math.PI / 2;
    const snapped = Math.round((this.goalAzimuth - DEFAULT_AZIMUTH) / q) * q + DEFAULT_AZIMUTH;
    this.goalAzimuth = snapped + q * step;
    this.rotIndex = (((Math.round((this.goalAzimuth - DEFAULT_AZIMUTH) / q)) % 4) + 4) % 4;
  }

  /** Free rotation around the vertical axis (radians). Applied directly for 1:1 control. */
  rotateBy(rad) {
    this.goalAzimuth += rad;
    this.azimuth += rad;
  }

  /** Tilt up/down (radians, positive = more top-down), clamped. */
  tiltBy(rad, smooth = false) {
    this.goalElevation = Math.min(MAX_ELEV, Math.max(MIN_ELEV, this.goalElevation + rad));
    if (!smooth) this.elevation = this.goalElevation;
  }

  /** Back to the default isometric angle (keeps position and zoom). */
  resetView() {
    const q = Math.PI * 2;
    this.goalAzimuth = DEFAULT_AZIMUTH + Math.round((this.goalAzimuth - DEFAULT_AZIMUTH) / q) * q;
    this.goalElevation = ISO_ELEVATION;
  }

  /**
   * Frame a set of world points so they fit inside `free` (client pixels: the
   * part of the screen not covered by UI panels) and snap there immediately.
   * `rect` is the canvas rect. Zoom is capped by `maxZoom`.
   */
  frame(points, free, rect, maxZoom = 1.25) {
    if (!points.length || free.w < 40 || free.h < 40) return;
    const mid = new THREE.Vector3();
    for (const p of points) mid.add(p);
    mid.divideScalar(points.length).setY(0);
    this.goal.copy(mid); this.target.copy(mid);
    this.azimuth = this.goalAzimuth; this.elevation = this.goalElevation;
    this.zoom = 1; this._updateProjection(); this._apply();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const s = {};
    for (const p of points) {
      this.project(p, rect, s);
      minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x);
      minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y);
    }
    const fit = Math.min(free.w / Math.max(1, maxX - minX), free.h / Math.max(1, maxY - minY));
    this.zoom = this.goalZoom = Math.min(maxZoom, MAX_ZOOM, Math.max(MIN_ZOOM, fit));
    this._updateProjection(); this._apply();
    // Move the content's centre from the canvas centre to the free area's centre.
    this.project(mid, rect, s);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const k = this.zoom; // screen offsets scale with zoom (orthographic)
    const contentX = s.x + (cx - (rect.left + rect.width / 2)) * k;
    const contentY = s.y + (cy - (rect.top + rect.height / 2)) * k;
    this.panPixels(free.x + free.w / 2 - contentX, free.y + free.h / 2 - contentY);
    this._apply();
  }

  focus(x, z, zoom) {
    this.goal.set(x, 0, z);
    this._clamp(this.goal);
    if (zoom) this.goalZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
  }

  /** World → client pixel (for DOM popups). */
  project(v, rect, out = { x: 0, y: 0 }) {
    const p = v.clone().project(this.camera);
    out.x = rect.left + (p.x + 1) / 2 * rect.width;
    out.y = rect.top + (-p.y + 1) / 2 * rect.height;
    return out;
  }
}
