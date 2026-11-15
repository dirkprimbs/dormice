// The solver reasons the way a careful player does, in three tiers:
//   1  one clue on its own (all its remaining tiles are safe / all are sleepers)
//   2  two overlapping clues compared against each other
//   3  trying every arrangement that fits a cluster of clues
// It powers the no-guess generator, the hint button and difficulty grading.
//
// known[c]: -1 unknown, 0 open (its clue is visible), 1 sleeper.

export function buildConstraints(p, known) {
  const out = [], w = p.w;
  const add = (cells, sum, src) => {
    let rem = sum, W = 0;
    const u = [];
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i], k = known[c];
      if (k === -1) { u.push(c); W += w[c]; } else if (k === 1) rem -= w[c];
    }
    if (u.length) out.push({ u, rem, W, src });
  };
  for (let c = 0; c < p.n; c++) {
    if (known[c] !== 0) continue;
    const parts = p.parts[c], vals = p.clues[c];
    for (let i = 0; i < parts.length; i++) add(parts[i], vals[i], { t: 'cell', c, i });
  }
  for (const s of p.statics) add(s.cells, s.sum, s.src);
  return out;
}

export function findDeductions(p, known, level = 3, all = false, budget = 40000) {
  const cons = buildConstraints(p, known), n = p.n, w = p.w;
  const res = [];
  const mark = new Int8Array(n).fill(-1);
  const emit = (cells, mine, tier, srcs) => {
    const fresh = cells.filter((c) => mark[c] === -1);
    if (!fresh.length) return;
    for (const c of fresh) mark[c] = mine ? 1 : 0;
    res.push({ cells: fresh, mine, tier, srcs });
  };

  // Tier 1
  for (const k of cons) {
    if (k.rem === 0) emit(k.u, false, 1, [k.src]);
    else if (k.rem === k.W) emit(k.u, true, 1, [k.src]);
    if (!all && res.length) return res;
  }
  if (res.length || level < 2) return res;

  // Tier 2
  const byCell = Array.from({ length: n }, () => null);
  cons.forEach((k, i) => { for (const c of k.u) (byCell[c] || (byCell[c] = [])).push(i); });
  const inA = new Int32Array(n).fill(-1), seen = new Int32Array(cons.length).fill(-1);
  for (let a = 0; a < cons.length; a++) {
    const A = cons[a];
    for (const c of A.u) inA[c] = a;
    for (const c of A.u) {
      for (const b of byCell[c]) {
        if (b <= a || seen[b] === a) continue;
        seen[b] = a;
        const B = cons[b];
        let wS = 0;
        const shared = [], bOnly = [];
        for (const x of B.u) { if (inA[x] === a) { wS += w[x]; shared.push(x); } else bOnly.push(x); }
        const wAo = A.W - wS, wBo = B.W - wS;
        const smax = Math.min(A.rem, B.rem, wS), smin = Math.max(0, A.rem - wAo, B.rem - wBo);
        const srcs = [A.src, B.src];
        if (wAo > 0) {
          const mine = A.rem - smax === wAo, safe = A.rem - smin === 0;
          if (mine || safe) { const sh = new Set(shared); emit(A.u.filter((x) => !sh.has(x)), mine, 2, srcs); }
        }
        if (wBo > 0) {
          if (B.rem - smax === wBo) emit(bOnly, true, 2, srcs);
          else if (B.rem - smin === 0) emit(bOnly, false, 2, srcs);
        }
        if (smin === wS) emit(shared, true, 2, srcs);
        if (!all && res.length) return res;
      }
    }
  }
  if (res.length || level < 3) return res;

  // Tier 3
  let unknown = 0;
  for (let c = 0; c < n; c++) if (known[c] === -1) unknown++;
  const endgame = unknown <= 20;
  const use = cons.filter((k) => endgame || k.u.length <= 14);
  const parent = new Int32Array(n).fill(-1);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (const k of use) {
    for (const c of k.u) if (parent[c] === -1) parent[c] = c;
    const r = find(k.u[0]);
    for (const c of k.u) parent[find(c)] = r;
  }
  const comps = new Map();
  for (const k of use) {
    const r = find(k.u[0]);
    if (!comps.has(r)) comps.set(r, []);
    comps.get(r).push(k);
  }
  for (const group of comps.values()) {
    const d = enumerate(group, w, budget);
    if (!d) continue;
    const srcs = group.map((k) => k.src).slice(0, 8);
    if (d.safe.length) emit(d.safe, false, 3, srcs);
    if (d.mine.length) emit(d.mine, true, 3, srcs);
    if (!all && res.length) return res;
  }
  return res;
}

function enumerate(group, w, budget) {
  const idx = new Map(), vars = [];
  group = group.slice().sort((a, b) => a.u.length - b.u.length);
  for (const k of group) for (const c of k.u) if (!idx.has(c)) { idx.set(c, vars.length); vars.push(c); }
  const m = vars.length;
  if (m > 60) return null;
  const ks = group.map((k) => ({ rem: k.rem, free: k.W }));
  const varCons = vars.map(() => []);
  group.forEach((k, i) => { for (const c of k.u) varCons[idx.get(c)].push(ks[i]); });
  const can0 = new Uint8Array(m), can1 = new Uint8Array(m), assign = new Uint8Array(m);
  let nodes = 0, aborted = false;
  const dfs = (i) => {
    if (aborted) return;
    if (++nodes > budget) { aborted = true; return; }
    if (i === m) {
      for (let v = 0; v < m; v++) (assign[v] ? can1 : can0)[v] = 1;
      return;
    }
    const cs = varCons[i], wv = w[vars[i]];
    for (let val = 0; val < 2; val++) {
      let ok = true;
      for (const k of cs) { k.free -= wv; if (val) k.rem -= wv; if (k.rem < 0 || k.rem > k.free) ok = false; }
      if (ok) { assign[i] = val; dfs(i + 1); }
      for (const k of cs) { k.free += wv; if (val) k.rem += wv; }
    }
  };
  dfs(0);
  if (aborted) return null;
  const safe = [], mine = [];
  for (let v = 0; v < m; v++) {
    if (can0[v] && !can1[v]) safe.push(vars[v]);
    else if (can1[v] && !can0[v]) mine.push(vars[v]);
  }
  return { safe, mine };
}

// Play the puzzle out from its start tile using only certain deductions.
export function simulate(p, start, level = 3) {
  const known = new Int8Array(p.n).fill(-1);
  let maxTier = 0, steps = 0;
  if (p.mines[start]) return { solved: false, known, maxTier, steps };
  known[start] = 0;
  for (;;) {
    const ds = findDeductions(p, known, level, true);
    if (!ds.length) break;
    for (const d of ds) {
      if (d.tier > maxTier) maxTier = d.tier;
      for (const c of d.cells) {
        if (!!p.mines[c] !== d.mine) throw new Error('solver made an unsound deduction');
        known[c] = d.mine ? 1 : 0;
      }
    }
    steps++;
  }
  let solved = true;
  for (let c = 0; c < p.n; c++) if (!p.mines[c] && known[c] !== 0) { solved = false; break; }
  return { solved, known, maxTier, steps };
}
