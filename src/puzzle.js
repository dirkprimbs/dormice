// Puzzle layout and rules. Everything the player can see before a single
// tile is turned (shape, colours, which line clues exist) is decided here
// from the seed; where the sleepers lie is decided later by the generator.
import { makeRng } from './rng.js';
import { buildBoard } from './topology.js';

// Grow `k` contiguous blobs over the board; returns blob index per cell.
function growBlobs(board, k, rng) {
  const n = board.cells.length;
  const blob = new Int32Array(n).fill(-1);
  const frontier = [];
  const seeds = rng.shuffle([...Array(n).keys()]).slice(0, Math.min(k, n));
  seeds.forEach((c, i) => frontier.push([c, i]));
  while (frontier.length) {
    const j = rng.int(frontier.length);
    const [c, b] = frontier[j];
    frontier[j] = frontier[frontier.length - 1];
    frontier.pop();
    if (blob[c] !== -1) continue;
    blob[c] = b;
    for (const x of board.cells[c].nb) if (blob[x] === -1) frontier.push([x, b]);
  }
  return blob;
}

export function layoutPuzzle(spec, seed) {
  const rng = makeRng(seed + '|layout');
  const board = buildBoard(spec, rng);
  const n = board.cells.length;
  const rules = spec.rules || {};
  const mode = rules.color || 'none'; // none | counts | split | twins
  const p = {
    spec, seed, board, n, mode,
    color: new Int8Array(n).fill(-1),
    ncolors: 0,
    w: new Uint8Array(n).fill(1), // how many sleepers a tile holds if occupied
    owl: new Uint8Array(n),
    lines: [],
    mines: null,
  };

  if (mode === 'counts') {
    p.ncolors = n < 50 ? 3 : n < 130 ? 4 : 5;
    const blob = growBlobs(board, p.ncolors, rng);
    for (let c = 0; c < n; c++) p.color[c] = blob[c];
  } else if (mode === 'split') {
    p.ncolors = 2;
    const k = Math.max(4, Math.round(n / 7));
    const blob = growBlobs(board, k, rng);
    const tone = rng.shuffle([...Array(k).keys()].map((i) => i % 2));
    for (let c = 0; c < n; c++) p.color[c] = tone[blob[c]];
  } else if (mode === 'twins') {
    const k = Math.max(4, Math.round(n / 4));
    const blob = growBlobs(board, k, rng);
    const twin = rng.shuffle([...Array(k).keys()].map((i) => (i % 4 === 0 ? 1 : 0)));
    for (let c = 0; c < n; c++) if (twin[blob[c]]) p.w[c] = 2;
  }

  // Start tile: somewhere near the middle, with a full ring of neighbours.
  const cx = (board.minX + board.maxX) / 2, cy = (board.minY + board.maxY) / 2;
  const maxNb = Math.max(...board.cells.map((c) => c.nb.length));
  const central = board.cells
    .filter((c) => c.nb.length === maxNb)
    .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  const pool = central.slice(0, Math.max(1, Math.ceil(central.length * 0.25)));
  p.start = (pool.length ? rng.pick(pool) : board.cells[0]).id;

  if (rules.owls && board.grid !== 'tri') {
    for (let c = 0; c < n; c++) if (c !== p.start && rng.next() < rules.owls) p.owl[c] = 1;
  }

  // The tiles each clue looks at, split into parts (two parts in split mode).
  p.reg = board.cells.map((cell, c) => {
    if (!p.owl[c]) return cell.nb;
    const far = new Set();
    for (const a of cell.nb) { far.add(a); for (const b of board.cells[a].nb) far.add(b); }
    far.delete(c);
    return [...far].sort((a, b) => a - b);
  });
  p.parts = p.reg.map((reg) =>
    mode === 'split' ? [reg.filter((x) => p.color[x] === 0), reg.filter((x) => p.color[x] === 1)] : [reg]
  );

  if (rules.lines) {
    const taken = new Set();
    for (const line of rng.shuffle(board.lines.slice())) {
      if (rng.next() >= rules.lines) continue;
      const ends = rng.next() < 0.5 ? line.ends : [line.ends[1], line.ends[0]];
      const key = (e) => Math.round(e[0] * 4) + ',' + Math.round(e[1] * 4);
      const pos = ends.find((e) => !taken.has(key(e)));
      if (!pos) continue;
      taken.add(key(pos));
      p.lines.push({ cells: line.cells, pos, sum: 0 });
    }
  }

  const cap = Math.max(0, n - p.reg[p.start].length - 2);
  const want = spec.mines != null ? spec.mines : Math.round(n * (spec.density ?? 0.15));
  p.mineCount = Math.min(want, cap);
  return p;
}

// Fill in everything that depends on where the sleepers are.
export function finalize(p, mines) {
  p.mines = mines;
  const sum = (cells) => { let s = 0; for (const c of cells) if (mines[c]) s += p.w[c]; return s; };
  p.clues = p.parts.map((parts) => parts.map(sum));
  const all = [...Array(p.n).keys()];
  p.total = sum(all);
  p.statics = [];
  p.lines.forEach((line, i) => { line.sum = sum(line.cells); p.statics.push({ cells: line.cells, sum: line.sum, src: { t: 'line', i } }); });
  p.colorTotals = [];
  if (p.mode === 'counts') {
    for (let k = 0; k < p.ncolors; k++) {
      const cells = all.filter((c) => p.color[c] === k);
      p.colorTotals.push(sum(cells));
      p.statics.push({ cells, sum: p.colorTotals[k], src: { t: 'color', i: k } });
    }
  }
  p.statics.push({ cells: all, sum: p.total, src: { t: 'total' } });
  return p;
}

export const isZero = (p, c) => p.clues[c].every((v) => v === 0);
