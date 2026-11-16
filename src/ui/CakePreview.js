/**
 * Cake Factory – Sweet Automation
 * © 2026 Brakeco Games. All rights reserved.
 *
 * Top-down 2D cake drawing from cake data (orders, inspector, celebration).
 * Quadrants: TL upper-left, TR upper-right, BR lower-right, BL lower-left –
 * identical to the data model, so what you see is exactly what you need.
 */
import { FLAVORS, FROSTINGS } from '../cakes/CakeModel.js';

// Canvas angles (y down): wedge start/end per quadrant index.
const WEDGE = [[Math.PI, Math.PI * 1.5], [Math.PI * 1.5, Math.PI * 2], [0, Math.PI * 0.5], [Math.PI * 0.5, Math.PI]];
const MID = WEDGE.map(([a, b]) => (a + b) / 2);
const DECOR = { cherry: '#e8344e', sprinkles: '#ff9ad5', chocolate: '#5a3221', strawberry: '#ff4d6d', swirl: '#ffffff' };

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} cake
 * @param {{ layer?: number }} opts  layer: which layer to show (default top)
 */
export function drawCake(canvas, cake, opts = {}) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth || canvas.width;
  const cssH = canvas.clientHeight || canvas.height;
  if (canvas.width !== Math.round(cssW * dpr)) { canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr); }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, cssW, cssH);
  if (!cake) return;

  const n = cake.layers.length;
  const li = Math.min(n - 1, opts.layer ?? n - 1);
  const layer = cake.layers[li];
  const cx = cssW / 2, cy = cssH / 2 - (n > 1 ? 6 : 0);
  const R = Math.min(cssW, cssH) * 0.4;

  // Plate + soft shadow.
  g.fillStyle = 'rgba(120,60,90,0.12)';
  g.beginPath(); g.ellipse(cx, cy + R * 0.12, R * 1.12, R * 1.08, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(cx, cy, R * 1.1, 0, Math.PI * 2); g.fill();

  // Lower layers peek out as rings (visible layer count).
  for (let i = 0; i < n - 1 - (n - 1 - li); i++) {
    g.strokeStyle = 'rgba(160,110,90,0.25)'; g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, R * (1.02 + (i + 1) * 0.03), 0, Math.PI * 2); g.stroke();
  }

  // Optional rotation so the picture matches the current 3D camera view.
  const rot = opts.rotation || 0;
  g.save();
  g.translate(cx, cy); g.rotate(rot); g.translate(-cx, -cy);
  const gap = R * 0.05;
  for (let q = 0; q < 4; q++) {
    const p = layer.quadrants[q];
    const ox = Math.cos(MID[q]) * gap, oy = Math.sin(MID[q]) * gap;
    const [a0, a1] = WEDGE[q];
    if (!p) {
      g.setLineDash([4, 4]);
      g.strokeStyle = 'rgba(170,130,150,0.6)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(cx + ox, cy + oy); g.arc(cx + ox, cy + oy, R, a0, a1); g.closePath(); g.stroke();
      g.setLineDash([]);
      continue;
    }
    // Sponge
    g.fillStyle = FLAVORS[p.flavor].color;
    g.beginPath(); g.moveTo(cx + ox, cy + oy); g.arc(cx + ox, cy + oy, R, a0, a1); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(90,50,40,0.25)'; g.lineWidth = 1.5; g.stroke();
    // Frosting (inner part) so flavor and frosting are both readable.
    if (p.frosting) {
      g.fillStyle = FROSTINGS[p.frosting].color;
      g.beginPath(); g.moveTo(cx + ox, cy + oy); g.arc(cx + ox, cy + oy, R * 0.74, a0, a1); g.closePath(); g.fill();
    }
    if (p.decoration) {
      g.fillStyle = DECOR[p.decoration] || '#e8344e';
      g.beginPath(); g.arc(cx + ox + Math.cos(MID[q]) * R * 0.5, cy + oy + Math.sin(MID[q]) * R * 0.5, R * 0.12, 0, Math.PI * 2); g.fill();
    }
  }

  g.restore();

  // Compass: a small arrow pointing to the factory's north (top of the order picture).
  if (opts.compass) {
    const ax = cssW - 13, ay = 13, a = -Math.PI / 2 + rot;
    g.save();
    g.translate(ax, ay); g.rotate(a + Math.PI / 2);
    g.fillStyle = 'rgba(233,102,143,0.9)';
    g.beginPath(); g.moveTo(0, -9); g.lineTo(5, 3); g.lineTo(-5, 3); g.closePath(); g.fill();
    g.restore();
    g.fillStyle = '#e9668f'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', ax, ay + 11);
  }

  // Layer pips under the cake.
  if (n > 1) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = i === li ? '#e9668f' : '#f3c3d2';
      g.beginPath(); g.arc(cx + (i - (n - 1) / 2) * 12, cssH - 7, 4, 0, Math.PI * 2); g.fill();
    }
  }
}
