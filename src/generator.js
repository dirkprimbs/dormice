// Decides where the sleepers lie. With `noGuess` the layout is nudged and
// re-checked against the solver until it can be finished by logic alone,
// at the reasoning depth the puzzle asks for (spec.level).
import { makeRng } from './rng.js';
import { layoutPuzzle, finalize } from './puzzle.js';
import { simulate } from './solver.js';

export function generate(spec, seed, startCell = null) {
  const p = layoutPuzzle(spec, seed);
  const rng = makeRng(seed + '|mines|' + (startCell ?? ''));
  const start = startCell ?? p.start;
  p.start = start;
  const n = p.n;
  const safeZone = new Uint8Array(n);
  safeZone[start] = 1;
  for (const c of p.reg[start]) safeZone[c] = 1;
  const allowed = [];
  for (let c = 0; c < n; c++) if (!safeZone[c]) allowed.push(c);
  let count = Math.max(0, Math.min(p.mineCount, allowed.length - 1));

  const place = () => {
    const mines = new Uint8Array(n);
    rng.shuffle(allowed);
    for (let i = 0; i < count; i++) mines[allowed[i]] = 1;
    return mines;
  };

  if (!spec.noGuess) return finalize(p, place());

  const level = spec.level ?? 3;
  const maxPerturb = Math.max(6, Math.round(n / 6));
  const patience = spec.patience ?? 40;
  const needLines = p.lines.length > 0;
  const ceiling = Math.min(allowed.length - 1, Math.max(count, Math.min(Math.floor(allowed.length * 0.3), Math.ceil(count * 1.4) + 2)));
  let stuck = 0, easy = 0;
  for (let attempt = 1; ; attempt++) {
    const mines = place();
    let solved = false;
    for (let k = 0; k <= maxPerturb; k++) {
      finalize(p, mines);
      const sim = simulate(p, start, level);
      if (sim.solved) {
        solved = true;
        // Asked for a puzzle with some bite: skip ones that solve too plainly.
        if (sim.maxTier < (spec.minTier || 0) && attempt < 25) break;
        // Row clues should be needed, not a shortcut: skip boards that solve without them.
        p.linesNeeded = needLines && !solvableWithoutLines(p, start);
        if (needLines && !p.linesNeeded && attempt < 60) {
          // Sparse boards rarely need their row clues, so crowd the garden a little.
          if (++easy % 4 === 0 && count < ceiling) count++;
          break;
        }
        p.attempts = attempt; p.maxTier = sim.maxTier; return p;
      }
      if (k === maxPerturb || !perturb(p, mines, sim.known, safeZone, rng)) break;
    }
    // Too crowded to be solvable by logic: thin the sleepers out a little.
    if (!solved && ++stuck >= patience && count > 0) {
      count = Math.max(0, Math.min(count - 1, Math.floor(count * 0.95)));
      stuck = 0;
    }
  }
}

function solvableWithoutLines(p, start) {
  const statics = p.statics;
  p.statics = statics.filter((s) => s.src.t !== 'line');
  try { return simulate(p, start, 3).solved; } finally { p.statics = statics; }
}

// Move one sleeper away from where the solver got stuck, into unexplored ground.
function perturb(p, mines, known, safeZone, rng) {
  const n = p.n, frontier = new Uint8Array(n);
  for (let c = 0; c < n; c++) {
    if (known[c] !== 0) continue;
    for (const x of p.reg[c]) if (known[x] === -1) frontier[x] = 1;
  }
  const from = [], deep = [], near = [];
  for (let c = 0; c < n; c++) {
    if (known[c] !== -1) continue;
    if (mines[c]) { if (frontier[c]) from.push(c); }
    else if (!safeZone[c]) (frontier[c] ? near : deep).push(c);
  }
  if (!from.length) for (let c = 0; c < n; c++) if (known[c] === -1 && mines[c]) from.push(c);
  const to = deep.length ? deep : near;
  if (!from.length || !to.length) return false;
  mines[rng.pick(from)] = 0;
  mines[rng.pick(to)] = 1;
  return true;
}
