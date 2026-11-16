import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/rng.js';
import { buildBoard } from '../src/topology.js';
import { generate } from '../src/generator.js';
import { simulate } from '../src/solver.js';
import { Game, getHint, OPEN, LEAF, COVERED } from '../src/game.js';
import { LEVELS, CHAPTERS, isUnlocked, dailyPuzzle, freeSpec, FREE_DEFAULT, SIZES } from '../src/levels.js';

const count = (m) => m.reduce((a, b) => a + b, 0);

test('neighbour counts per grid', () => {
  const inner = (grid, w, h) => Math.max(...buildBoard({ grid, w, h }, makeRng(1)).cells.map((c) => c.nb.length));
  assert.equal(inner('square', 5, 5), 8);
  assert.equal(inner('hex', 5, 5), 6);
  assert.equal(inner('tri', 9, 5), 12);
  assert.equal(buildBoard({ grid: 'hex', w: 7, shape: 'hexagon' }, makeRng(1)).cells.length, 37);
});

test('shaped boards stay in one piece', () => {
  for (const shape of ['round', 'ring', 'diamond', 'ponds'])
    for (const grid of ['square', 'hex', 'tri']) {
      const b = buildBoard({ grid, w: 14, h: 12, shape }, makeRng(shape + grid));
      const seen = new Set([0]), stack = [0];
      while (stack.length) for (const x of b.cells[stack.pop()].nb) if (!seen.has(x)) { seen.add(x); stack.push(x); }
      assert.equal(seen.size, b.cells.length, `${grid}/${shape}`);
      assert.ok(b.cells.length > 30);
    }
});

test('classic boards keep their exact sleeper counts', () => {
  for (const [w, h, m] of [[9, 9, 10], [16, 16, 40], [30, 16, 99]]) {
    const p = generate({ grid: 'square', w, h, mines: m, noGuess: true, level: 3 }, `classic${w}`);
    assert.equal(count(p.mines), m);
    assert.ok(simulate(p, p.start, 3).solved);
  }
});

test('every journey level is solvable at its stated depth, deterministically', () => {
  for (const lv of LEVELS) {
    const p = generate(lv.spec, lv.seed);
    assert.ok(simulate(p, p.start, lv.spec.level).solved, lv.id);
    assert.deepEqual(generate(lv.spec, lv.seed).mines, p.mines, lv.id);
    const wanted = p.mineCount, got = count(p.mines);
    assert.ok(got >= wanted * 0.8, `${lv.id} thinned too far: ${got}/${wanted}`);
    assert.equal(p.mines[p.start], 0);
  }
});

test('free play: every option combination generates and solves', () => {
  for (const grid of ['square', 'hex', 'tri'])
    for (const color of ['none', 'counts', 'split', 'twins'])
      for (const shape of ['rect', 'round', 'ponds', 'hexagon'])
        for (const extras of [0, 1]) {
          const cfg = { ...FREE_DEFAULT, grid, color, shape, size: 'm', density: 'tricky', lines: !!extras, owls: !!extras };
          const spec = freeSpec(cfg);
          const p = generate(spec, 'combo', null);
          assert.ok(simulate(p, p.start, 3).solved, JSON.stringify(cfg));
        }
});

test('first click anywhere is safe and opens an area', () => {
  const spec = { grid: 'square', w: 9, h: 9, mines: 10, noGuess: true, level: 3 };
  for (const start of [0, 8, 40, 80]) {
    const p = generate(spec, 'click', start);
    const g = new Game(p);
    const r = g.reveal(start);
    assert.ok(r.changed.length > 1);
    assert.equal(r.hit.length, 0);
  }
});

test('a game can be won by following hints alone', () => {
  for (const lv of LEVELS.filter((_, i) => i % 3 === 0)) {
    const g = new Game(generate(lv.spec, lv.seed));
    g.reveal(g.p.start);
    for (let i = 0; i < 5000 && !g.over; i++) {
      const h = getHint(g);
      assert.ok(h && h.kind !== 'wrong', lv.id);
      assert.notEqual(h.msg, 'gift', `${lv.id} needed a gift`);
      for (const c of h.cells) h.kind === 'mine' ? g.toggleLeaf(c) : g.reveal(c);
    }
    assert.equal(g.status, 'won', lv.id);
    assert.equal(g.mistakes, 0);
    assert.equal(g.remaining(), 0);
  }
});

test('hearts, waking and chords', () => {
  const p = generate({ grid: 'square', w: 9, h: 9, mines: 10, noGuess: true, level: 3 }, 'hearts');
  const g = new Game(p, { lives: 2 });
  g.reveal(p.start);
  const mines = [...p.mines.keys()].filter((c) => p.mines[c]);
  assert.equal(g.reveal(mines[0]).hit.length, 1);
  assert.equal(g.lives, 1);
  assert.equal(g.status, 'playing');
  g.toggleLeaf(mines[1]);
  assert.equal(g.state[mines[1]], LEAF);
  assert.equal(g.reveal(mines[1]).changed.length, 0, 'a leafed tile cannot be turned');
  g.toggleLeaf(mines[1]);
  assert.equal(g.state[mines[1]], COVERED);
  assert.ok(g.reveal(mines[1]).lost);

  // chord: leaf everything correctly, then every open clue can clear its surroundings
  const g2 = new Game(p);
  g2.reveal(p.start);
  mines.forEach((c) => g2.toggleLeaf(c));
  for (let pass = 0; pass < 50 && !g2.over; pass++)
    for (let c = 0; c < p.n; c++) if (g2.state[c] === OPEN) g2.chord(c);
  assert.equal(g2.status, 'won');
});

test('unlocking and daily', () => {
  assert.ok(isUnlocked(LEVELS[0], {}));
  assert.ok(!isUnlocked(LEVELS[1], {}));
  assert.ok(isUnlocked(LEVELS[1], { [LEVELS[0].id]: { stars: 1 } }));
  const ch2 = CHAPTERS[1].levels[0];
  assert.ok(!isUnlocked(ch2, { 'meadow-1': {}, 'meadow-2': {} }));
  assert.ok(isUnlocked(ch2, { 'meadow-1': {}, 'meadow-2': {}, 'meadow-3': {} }));
  for (let d = 1; d <= 28; d++) {
    const { spec, seed } = dailyPuzzle(`2026-02-${String(d).padStart(2, '0')}`);
    const p = generate(spec, seed);
    assert.ok(simulate(p, p.start, 3).solved);
  }
  assert.ok(SIZES.square.l[0] === 30);
});

test('row clues are needed on every journey level that has them', () => {
  const withLines = LEVELS.filter((l) => l.spec.rules?.lines);
  assert.ok(withLines.length >= 4);
  for (const lv of withLines) assert.ok(generate(lv.spec, lv.seed).linesNeeded, lv.id);
});

test('a row clue clears its row once its leaves add up', () => {
  const lv = LEVELS.find((l) => l.id === 'rows-2');
  const p = generate(lv.spec, lv.seed);
  const zero = p.lines.findIndex((l) => l.sum === 0), some = p.lines.findIndex((l) => l.sum > 0);
  for (const i of [zero, some]) {
    if (i < 0) continue;
    const g = new Game(p);
    g.reveal(p.start);
    const line = p.lines[i];
    if (line.sum > 0 && line.cells.some((c) => g.state[c] === COVERED)) assert.equal(g.chordLine(i).changed.length, 0, 'nothing happens before the leaves are laid');
    for (const c of line.cells) if (p.mines[c]) g.toggleLeaf(c);
    const r = g.chordLine(i);
    assert.equal(r.hit.length, 0);
    assert.ok(line.cells.every((c) => g.state[c] !== COVERED));
  }
  assert.ok(some >= 0);
});
