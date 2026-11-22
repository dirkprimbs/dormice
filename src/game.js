// One play-through of a puzzle. Pure state, no DOM.
import { isZero } from './puzzle.js';
import { findDeductions } from './solver.js';

export const COVERED = 0, OPEN = 1, LEAF = 2, WOKEN = 3;

export class Game {
  constructor(puzzle, { lives = 3 } = {}) {
    this.p = puzzle;
    this.state = new Uint8Array(puzzle.n);
    this.lives = this.maxLives = lives;
    this.mistakes = 0;
    this.hints = 0;
    this.opened = 0;
    this.status = 'ready'; // ready | playing | won | lost
    this.startedAt = 0;
    this.endedAt = 0;
  }

  get over() { return this.status === 'won' || this.status === 'lost'; }

  elapsed(now = Date.now()) {
    if (!this.startedAt) return 0;
    return ((this.endedAt || now) - this.startedAt) / 1000;
  }

  // Sleepers not yet accounted for by a leaf (may go negative with stray leaves).
  remaining() {
    let r = this.p.total ?? this.p.mineCount;
    for (let c = 0; c < this.p.n; c++) if (this.state[c] >= LEAF) r -= this.p.w[c];
    return r;
  }

  colorRemaining(k) {
    let r = this.p.colorTotals[k];
    for (let c = 0; c < this.p.n; c++) if (this.state[c] >= LEAF && this.p.color[c] === k) r -= this.p.w[c];
    return r;
  }

  known() {
    const k = new Int8Array(this.p.n);
    for (let c = 0; c < this.p.n; c++) k[c] = this.state[c] === OPEN ? 0 : this.state[c] === COVERED ? -1 : 1;
    return k;
  }

  _begin() {
    if (this.status === 'ready') { this.status = 'playing'; this.startedAt = Date.now(); }
  }

  _result(changed, hit = []) {
    if (this.status === 'playing') {
      if (this.lives <= 0) this.status = 'lost';
      else if (this.opened === this.p.n - this.mineTiles()) {
        this.status = 'won';
        for (let c = 0; c < this.p.n; c++)
          if (this.state[c] === COVERED) { this.state[c] = LEAF; changed.push(c); }
      }
      if (this.over) this.endedAt = Date.now();
    }
    return { changed, hit, won: this.status === 'won', lost: this.status === 'lost' };
  }

  mineTiles() {
    if (this._mt == null) this._mt = this.p.mines.reduce((a, b) => a + b, 0);
    return this._mt;
  }

  _open(list, changed, hit) {
    const p = this.p, queue = [];
    for (const c of list) {
      if (this.state[c] !== COVERED || this.lives <= 0) continue;
      if (p.mines[c]) {
        this.state[c] = WOKEN;
        this.lives--;
        this.mistakes++;
        changed.push(c);
        hit.push(c);
        continue;
      }
      queue.push(c);
      this.state[c] = OPEN;
    }
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      this.opened++;
      changed.push(c);
      if (!isZero(p, c)) continue;
      for (const x of p.reg[c]) if (this.state[x] === COVERED) { this.state[x] = OPEN; queue.push(x); }
    }
  }

  // Open the puzzle's starting area without starting the clock.
  openStart() {
    const changed = [];
    this._open([this.p.start], changed, []);
    return changed;
  }

  reveal(c) {
    if (this.over || this.state[c] !== COVERED) return this._result([]);
    this._begin();
    const changed = [], hit = [];
    this._open([c], changed, hit);
    return this._result(changed, hit);
  }

  toggleLeaf(c) {
    if (this.over || (this.state[c] !== COVERED && this.state[c] !== LEAF)) return this._result([]);
    this.state[c] = this.state[c] === COVERED ? LEAF : COVERED;
    return this._result([c]);
  }

  // Acting on an open clue: clears the rest once the player's own leaves make up the number;
  // it never lays leaves for them.
  chord(c) {
    if (this.over || this.state[c] !== OPEN) return this._result([]);
    const p = this.p, toOpen = [];
    p.parts[c].forEach((part, i) => {
      let marked = 0;
      const covered = [];
      for (const x of part) {
        if (this.state[x] >= LEAF) marked += p.w[x];
        else if (this.state[x] === COVERED) covered.push(x);
      }
      if (marked === p.clues[c][i]) toOpen.push(...covered);
    });
    const changed = [], hit = [];
    if (toOpen.length) this._begin();
    this._open(toOpen, changed, hit);
    return this._result(changed, hit);
  }

  // The same for a row clue: once the leaves along the row make up its number
  // (at once, when the number is 0), the rest of the row is turned.
  chordLine(i) {
    const p = this.p, line = p.lines[i];
    if (this.over || !p.mines || !line) return this._result([]);
    let marked = 0;
    const covered = [];
    for (const x of line.cells) {
      if (this.state[x] >= LEAF) marked += p.w[x];
      else if (this.state[x] === COVERED) covered.push(x);
    }
    const changed = [], hit = [];
    if (marked !== line.sum || !covered.length) return this._result(changed);
    this._begin();
    this._open(covered, changed, hit);
    return this._result(changed, hit);
  }
}

// The simplest next step a player could take, with the reasoning behind it.
export function getHint(game) {
  const p = game.p;
  const wrong = [];
  for (let c = 0; c < p.n; c++) if (game.state[c] === LEAF && !p.mines[c]) wrong.push(c);
  if (wrong.length)
    return { kind: 'wrong', cells: [wrong[0]], srcs: [], msg: 'wrong' };
  const d = findDeductions(p, game.known(), 3, false)[0];
  if (!d) {
    let best = -1;
    for (let c = 0; c < p.n && best < 0; c++) if (game.state[c] === COVERED && !p.mines[c]) best = c;
    if (best < 0) return null;
    return { kind: 'safe', cells: [best], srcs: [], msg: 'gift' };
  }
  // msg names the explanation; the words are in the language files under hint.<msg>.
  const msg = d.tier === 1 ? `${d.mine ? 'mine' : 'safe'}.${d.srcs[0].t}` : d.tier === 2 ? 'two' : 'deep';
  return { kind: d.mine ? 'mine' : 'safe', cells: d.cells, srcs: d.srcs, msg, mine: d.mine, tier: d.tier };
}
