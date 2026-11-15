// Board geometry. A board is just a set of polygon cells; two cells are
// neighbours when they share a corner. That one rule gives 8 neighbours on
// squares, 6 on hexagons and 12 on triangles, so the rest of the game never
// needs to know which grid it is playing on.
const S = Math.sqrt(3) / 2;
export const TRI = 1.5; // triangle side length, in board units

const vkey = (x, y) => Math.round(x * 1000) + ',' + Math.round(y * 1000);

function rawCells(grid, w, h, shape) {
  const raw = [];
  if (grid === 'hex') {
    const a = 1 / Math.sqrt(3);
    const push = (q, r) => {
      const x = q + r / 2, y = r * S, pts = [];
      for (let k = 0; k < 6; k++) {
        const t = (Math.PI / 180) * (60 * k - 90);
        pts.push([x + a * Math.cos(t), y + a * Math.sin(t)]);
      }
      raw.push({ pts, L: [r, q, q + r], O: [q, r, r] });
    };
    if (shape === 'hexagon') {
      const R = (w - 1) >> 1;
      for (let r = -R; r <= R; r++)
        for (let q = -R; q <= R; q++) if (Math.abs(q + r) <= R) push(q, r);
    } else {
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) push(c - (r >> 1), r);
    }
  } else if (grid === 'tri') {
    const H = TRI * S;
    for (let r = 0; r < h; r++)
      for (let c = 0; c < w; c++) {
        const x = (c * TRI) / 2, y = r * H, up = (r + c) % 2 === 0;
        const pts = up
          ? [[x, y], [x + TRI / 2, y + H], [x - TRI / 2, y + H]]
          : [[x - TRI / 2, y], [x + TRI / 2, y], [x, y + H]];
        raw.push({ pts, L: [r], O: [c] });
      }
  } else {
    for (let r = 0; r < h; r++)
      for (let c = 0; c < w; c++)
        raw.push({
          pts: [[c - 0.5, r - 0.5], [c + 0.5, r - 0.5], [c + 0.5, r + 0.5], [c - 0.5, r + 0.5]],
          L: [r, c], O: [c, r],
        });
  }
  for (const c of raw) {
    c.x = c.pts.reduce((s, p) => s + p[0], 0) / c.pts.length;
    c.y = c.pts.reduce((s, p) => s + p[1], 0) / c.pts.length;
  }
  return raw;
}

const STEPS = {
  square: [[1, 0], [0, 1]],
  hex: [[1, 0], [0.5, S], [-0.5, S]],
  tri: [[TRI * 0.8, 0]],
};

function applyShape(raw, shape, rng) {
  if (shape === 'rect' || shape === 'hexagon' || !shape) return raw;
  const xs = raw.map((c) => c.x), ys = raw.map((c) => c.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const hw = (x1 - x0) / 2 + 0.3, hh = (y1 - y0) / 2 + 0.3;
  if (shape === 'ponds') {
    const count = 2 + Math.floor(raw.length / 110);
    const ponds = [];
    for (let i = 0; i < count; i++) {
      const c = rng.pick(raw);
      ponds.push([c.x, c.y, 0.9 + rng.next() * 0.9]);
    }
    return raw.filter((c) => !ponds.some(([px, py, pr]) => Math.hypot(c.x - px, c.y - py) < pr));
  }
  return raw.filter((c) => {
    const u = (c.x - cx) / hw, v = (c.y - cy) / hh, d = u * u + v * v;
    if (shape === 'round') return d <= 1;
    if (shape === 'ring') return d <= 1 && d >= 0.1;
    if (shape === 'diamond') return Math.abs(u) + Math.abs(v) <= 1.04;
    return true;
  });
}

function link(cells) {
  const byVertex = new Map();
  cells.forEach((c, i) => {
    for (const [x, y] of c.pts) {
      const k = vkey(x, y);
      if (!byVertex.has(k)) byVertex.set(k, []);
      byVertex.get(k).push(i);
    }
  });
  const sets = cells.map(() => new Set());
  for (const group of byVertex.values())
    for (const a of group) for (const b of group) if (a !== b) sets[a].add(b);
  return sets.map((s) => [...s].sort((a, b) => a - b));
}

export function buildBoard({ grid = 'square', w = 9, h = 9, shape = 'rect' }, rng) {
  let raw = applyShape(rawCells(grid, w, h, shape), shape, rng);
  // Keep only the largest connected piece so no island is cut off.
  let nb = link(raw);
  const comp = new Int32Array(raw.length).fill(-1);
  let best = -1, bestSize = 0;
  for (let i = 0; i < raw.length; i++) {
    if (comp[i] !== -1) continue;
    const stack = [i];
    comp[i] = i;
    let size = 0;
    while (stack.length) {
      const c = stack.pop();
      size++;
      for (const x of nb[c]) if (comp[x] === -1) { comp[x] = i; stack.push(x); }
    }
    if (size > bestSize) { bestSize = size; best = i; }
  }
  if (bestSize !== raw.length) {
    raw = raw.filter((_, i) => comp[i] === best);
    nb = link(raw);
  }
  const cells = raw.map((c, id) => ({ id, x: c.x, y: c.y, pts: c.pts, nb: nb[id], L: c.L, O: c.O }));

  const lines = [];
  STEPS[grid].forEach((step, d) => {
    const groups = new Map();
    for (const c of cells) {
      if (!groups.has(c.L[d])) groups.set(c.L[d], []);
      groups.get(c.L[d]).push(c);
    }
    for (const g of groups.values()) {
      if (g.length < 3) continue;
      g.sort((a, b) => a.O[d] - b.O[d]);
      const first = g[0], last = g[g.length - 1];
      lines.push({
        cells: g.map((c) => c.id),
        ends: [[first.x - step[0], first.y - step[1]], [last.x + step[0], last.y + step[1]]],
      });
    }
  });

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of cells)
    for (const [x, y] of c.pts) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
  return { grid, cells, lines, minX, minY, maxX, maxY };
}
