/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Polyline helpers for a machine's internal conveyor paths (local units).
 */
export function pathLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

/** Point at fraction t (0..1) along the polyline. */
export function pointAt(pts, t, out = [0, 0]) {
  const L = pathLength(pts);
  let d = Math.max(0, Math.min(1, t)) * L;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= seg || i === pts.length - 1) {
      const k = seg ? Math.min(1, d / seg) : 0;
      out[0] = a[0] + (b[0] - a[0]) * k; out[1] = a[1] + (b[1] - a[1]) * k;
      return out;
    }
    d -= seg;
  }
  out[0] = pts[0][0]; out[1] = pts[0][1];
  return out;
}
