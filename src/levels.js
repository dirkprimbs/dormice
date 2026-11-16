// The Journey (a fixed sequence of seeded puzzles that introduces one idea
// at a time), the daily puzzle, and the free-play option tables.
import { makeRng } from './rng.js';

const sq = (w, h, extra) => ({ grid: 'square', w, h, ...extra });
const hex = (w, h, extra) => ({ grid: 'hex', w, h, ...extra });
const comb = (d, extra) => ({ grid: 'hex', w: d, h: d, shape: 'hexagon', ...extra });
const tri = (w, h, extra) => ({ grid: 'tri', w, h, ...extra });

// level: how deep the reasoning has to go (1 one clue, 2 two clues, 3 anything).
// Chapter titles and blurbs are in the language files, as chapter.<id> and chapter.<id>.blurb.
export const CHAPTERS = [
  { id: 'meadow', levels: [
    sq(5, 5, { mines: 3, level: 1, guided: true }),
    sq(6, 6, { mines: 5, level: 1, guided: true }),
    sq(8, 8, { mines: 9, level: 1 }),
    sq(9, 9, { mines: 10, level: 2 }),
    sq(10, 10, { mines: 16, level: 2 }),
  ] },
  { id: 'honeycomb', levels: [
    comb(7, { mines: 6, level: 1 }),
    hex(8, 8, { mines: 11, level: 2 }),
    comb(11, { mines: 17, level: 2 }),
    hex(12, 11, { shape: 'ponds', density: 0.17, level: 3 }),
  ] },
  { id: 'beds', levels: [
    sq(6, 6, { mines: 7, level: 1, rules: { color: 'counts' } }),
    sq(8, 8, { density: 0.19, level: 2, rules: { color: 'counts' } }),
    comb(9, { density: 0.2, level: 2, rules: { color: 'counts' } }),
    sq(11, 11, { shape: 'round', density: 0.2, level: 3, rules: { color: 'counts' } }),
  ] },
  { id: 'rows', levels: [
    sq(6, 6, { density: 0.22, level: 1, rules: { lines: 1 } }),
    sq(8, 8, { density: 0.22, level: 2, rules: { lines: 0.7 } }),
    comb(9, { density: 0.22, level: 2, rules: { lines: 0.6 } }),
    sq(12, 10, { density: 0.22, level: 3, rules: { lines: 0.5 } }),
  ] },
  { id: 'twotone', levels: [
    sq(6, 6, { density: 0.2, level: 1, rules: { color: 'split' } }),
    sq(9, 9, { density: 0.22, level: 2, rules: { color: 'split' } }),
    hex(10, 9, { density: 0.24, level: 2, rules: { color: 'split' } }),
    sq(12, 12, { shape: 'diamond', density: 0.22, level: 3, rules: { color: 'split' } }),
  ] },
  { id: 'trellis', levels: [
    tri(9, 5, { density: 0.11, level: 1 }),
    tri(13, 7, { density: 0.13, level: 2 }),
    tri(17, 9, { density: 0.14, level: 2 }),
    tri(21, 10, { shape: 'round', density: 0.15, level: 3 }),
  ] },
  { id: 'owls', levels: [
    sq(7, 7, { density: 0.14, level: 1, rules: { owls: 0.25 } }),
    sq(9, 9, { density: 0.16, level: 2, rules: { owls: 0.3 } }),
    hex(10, 10, { density: 0.17, level: 2, rules: { owls: 0.3 } }),
    sq(12, 12, { shape: 'ponds', density: 0.17, level: 3, rules: { owls: 0.3 } }),
  ] },
  { id: 'twins', levels: [
    sq(7, 7, { density: 0.14, level: 1, rules: { color: 'twins' } }),
    sq(9, 9, { density: 0.16, level: 2, rules: { color: 'twins' } }),
    comb(11, { density: 0.17, level: 2, rules: { color: 'twins' } }),
    tri(15, 8, { density: 0.13, level: 3, rules: { color: 'twins' } }),
  ] },
  { id: 'wild', levels: [
    comb(13, { density: 0.2, level: 3, rules: { color: 'counts', lines: 0.4 } }),
    sq(14, 12, { shape: 'ring', density: 0.2, level: 3, rules: { color: 'split', owls: 0.25 } }),
    tri(21, 11, { density: 0.15, level: 3, rules: { color: 'counts', lines: 0.6 } }),
    sq(16, 16, { shape: 'ponds', density: 0.17, level: 3, rules: { color: 'twins', lines: 0.4, owls: 0.2 } }),
    hex(16, 14, { density: 0.22, level: 3, rules: { color: 'split', lines: 0.4 } }),
    sq(30, 16, { mines: 99, level: 3 }),
  ] },
];

export const LEVELS = [];
CHAPTERS.forEach((ch, ci) => ch.levels.forEach((spec, li) => {
  spec.noGuess = true;
  spec.minTier = Math.min(spec.level, 2);
  const lv = { id: `${ch.id}-${li + 1}`, chapter: ci, index: li, number: LEVELS.length + 1, spec, seed: `journey:${ch.id}:${li + 1}` };
  ch.levels[li] = lv;
  LEVELS.push(lv);
}));

export function isUnlocked(level, progress) {
  if (level.index > 0) return !!progress[CHAPTERS[level.chapter].levels[level.index - 1].id];
  if (level.chapter === 0) return true;
  const prev = CHAPTERS[level.chapter - 1].levels;
  return prev.filter((l) => progress[l.id]).length >= Math.ceil(prev.length / 2);
}

const DAILY = [
  sq(12, 12, { density: 0.17 }),
  comb(13, { density: 0.18 }),
  tri(19, 10, { density: 0.14 }),
  sq(11, 11, { density: 0.2, rules: { color: 'counts' } }),
  comb(11, { density: 0.21, rules: { color: 'counts', lines: 0.4 } }),
  sq(11, 11, { density: 0.22, rules: { color: 'split' } }),
  hex(12, 11, { density: 0.23, rules: { color: 'split' } }),
  sq(12, 11, { density: 0.2, rules: { lines: 0.6 } }),
  sq(11, 11, { shape: 'round', density: 0.17, rules: { owls: 0.3 } }),
  hex(12, 12, { shape: 'ponds', density: 0.17, rules: { owls: 0.3 } }),
  sq(11, 11, { density: 0.16, rules: { color: 'twins' } }),
  comb(13, { density: 0.17, rules: { color: 'twins', lines: 0.3 } }),
  sq(13, 13, { shape: 'diamond', density: 0.18, rules: { lines: 0.5, owls: 0.2 } }),
  tri(19, 10, { density: 0.14, rules: { color: 'counts' } }),
];

export const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function dailyPuzzle(key = dateKey()) {
  const rng = makeRng('daily:' + key);
  return { spec: { ...rng.pick(DAILY), noGuess: true, level: 3, minTier: 2 }, seed: 'daily:' + key };
}

// ---- Free play ----
export const SIZES = {
  square: { s: [9, 9], m: [16, 16], l: [30, 16] },
  hex: { s: [9, 9], m: [14, 13], l: [24, 15] },
  tri: { s: [13, 7], m: [21, 10], l: [33, 14] },
};
const COMB = { s: 9, m: 13, l: 19 };
const DENSITY = {
  square: { calm: 0.1235, standard: 0.15625, tricky: 0.20625 },
  hex: { calm: 0.12, standard: 0.16, tricky: 0.2 },
  tri: { calm: 0.1, standard: 0.13, tricky: 0.16 },
};

export const FREE_DEFAULT = {
  grid: 'square', shape: 'rect', size: 's', density: 'calm', color: 'none',
  lines: false, owls: false, noGuess: true, lives: 3,
};

export function freeSpec(cfg, portrait = false) {
  const spec = { grid: cfg.grid, shape: cfg.shape, noGuess: cfg.noGuess, level: 3, rules: {} };
  if (cfg.grid !== 'hex' && cfg.shape === 'hexagon') spec.shape = 'rect';
  if (spec.shape === 'hexagon') spec.w = spec.h = COMB[cfg.size];
  else {
    [spec.w, spec.h] = SIZES[cfg.grid][cfg.size];
    if (portrait && spec.w > spec.h) [spec.w, spec.h] = [spec.h, spec.w];
  }
  spec.density = DENSITY[cfg.grid][cfg.density];
  if (cfg.color !== 'none') { spec.rules.color = cfg.color; if (cfg.color === 'split') spec.density *= 1.15; }
  if (cfg.lines) spec.rules.lines = 0.6;
  if (cfg.owls && cfg.grid !== 'tri') spec.rules.owls = 0.3;
  return spec;
}

// Which "how it works" cards a puzzle needs, in teaching order.
export function rulesOf(spec) {
  const r = spec.rules || {}, out = ['basics'];
  if (spec.grid === 'hex') out.push('hex');
  if (spec.grid === 'tri') out.push('tri');
  if (r.color === 'counts') out.push('counts');
  if (r.lines) out.push('lines');
  if (r.color === 'split') out.push('split');
  if (r.owls && spec.grid !== 'tri') out.push('owls');
  if (r.color === 'twins') out.push('twins');
  return out;
}
