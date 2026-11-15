// Screens, routing and the glue between a Game and its BoardView.
import { store } from './store.js';
import { generate } from './generator.js';
import { layoutPuzzle } from './puzzle.js';
import { Game, getHint, COVERED, OPEN, LEAF } from './game.js';
import { BoardView, MOUSE_ICON, MOUSE_AWAKE, LEAF_ICON } from './boardview.js';
import { CHAPTERS, LEVELS, isUnlocked, dailyPuzzle, dateKey, freeSpec, FREE_DEFAULT, rulesOf } from './levels.js';
import { RULES } from './text.js';
import { play, setSound } from './audio.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app'), dlg = $('#dlg');
const S = () => store.data;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const stars = (n, of = 3) => `<span class="stars" aria-label="${n} of ${of} stars">${'<i class="on">★</i>'.repeat(n)}${'<i>★</i>'.repeat(of - n)}</span>`;
const icon = (inner, vb = '-40 -40 80 80') => `<svg class="ic" viewBox="${vb}" aria-hidden="true">${inner}</svg>`;
const I = {
  mouse: icon(MOUSE_ICON),
  awake: icon(MOUSE_AWAKE),
  leaf: icon(LEAF_ICON),
  heart: icon('<path class="heart" d="M0 28C-40 2-30-28-10-26C-3-25 0-18 0-18C0-18 3-25 10-26C30-28 40 2 0 28Z"/>'),
  back: icon('<path d="M10-22L-14 0L10 22" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>'),
  hint: icon('<path d="M0-30a21 21 0 0 0-11 39v7h22v-7a21 21 0 0 0-11-39zM-9 26h18" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'),
  again: icon('<path d="M22-8A24 24 0 1 0 24 6M24-28v20H4" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>'),
  fit: icon('<path d="M-26-10v-16h16M26-10v-16H10M-26 10v16h16M26 10v16H10" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>'),
  turn: icon('<rect x="-24" y="-24" width="48" height="48" rx="10" fill="none" stroke="currentColor" stroke-width="8"/><circle r="6" fill="currentColor"/>'),
};

// ---------- settings ----------
function applySettings() {
  const s = S().settings;
  const dark = s.theme === 'dark' || (s.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.markers = s.markers ? 'on' : 'off';
  document.documentElement.dataset.motion = s.motion ? 'on' : 'off';
  $('meta[name=theme-color]').content = dark ? '#1f2226' : '#f3ecdf';
  setSound(s.sound);
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySettings);

// ---------- dialogs ----------
function openDialog(html, onAct) {
  dlg.innerHTML = html;
  dlg.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (b) { const keep = onAct && onAct(b.dataset.act, b) === true; if (!keep) dlg.close(); }
    else if (e.target === dlg && !dlg.dataset.sticky) dlg.close();
  };
  delete dlg.dataset.sticky;
  if (!dlg.open) dlg.showModal();
  // Focusing the button at the end scrolls a long sheet down; start at the top instead.
  const sheet = dlg.querySelector('.sheet');
  if (sheet) sheet.scrollTop = 0;
}

function showRules(ids, then) {
  const body = ids.map((id) => `<section><h2>${RULES[id].title}</h2>${RULES[id].body()}</section>`).join('');
  openDialog(`<div class="sheet rules">${body}<div class="row"><button class="btn primary" autofocus data-act="ok">Got it</button></div></div>`);
  dlg.addEventListener('close', () => then && then(), { once: true });
}

function aboutDialog() {
  openDialog(`<div class="sheet about"><div class="big">${I.mouse}</div><h2>Dormice</h2>
    <p>A quiet little puzzle about not waking anyone, made by Dirk Primbs.</p>
    <p>If you enjoy it, come and see what else I am building.</p>
    <p class="links"><a href="https://primbs.ca" target="_blank" rel="noopener">primbs.ca</a><a href="https://github.com/dirkprimbs" target="_blank" rel="noopener">github.com/dirkprimbs</a></p>
    <div class="row"><button class="btn primary" autofocus data-act="ok">Close</button></div></div>`);
}

function settingsDialog() {
  const s = S().settings;
  const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-act="set" data-k="${key}" data-v="${v}" class="${String(s[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  openDialog(`<div class="sheet"><h2>Settings</h2>
    <label>Look</label>${seg('theme', [['auto', 'Auto'], ['light', 'Day'], ['dark', 'Evening']])}
    <label>Sound</label>${seg('sound', [[true, 'On'], [false, 'Off']])}
    <label>Animation</label>${seg('motion', [[true, 'On'], [false, 'Reduced']])}
    <label>Shape marks on coloured tiles</label>${seg('markers', [[false, 'Off'], [true, 'On']])}
    <p class="muted small">Shape marks help if the tile colours are hard to tell apart.</p>
    <div class="row"><button class="btn ghost" data-act="reset">Erase progress</button><button class="btn primary" autofocus data-act="ok">Done</button></div></div>`,
  (act, b) => {
    if (act === 'set') {
      const v = b.dataset.v;
      s[b.dataset.k] = v === 'true' ? true : v === 'false' ? false : v;
      store.save(); applySettings(); settingsDialog();
      return true;
    }
    if (act === 'reset') {
      if (b.dataset.sure) { store.reset(); applySettings(); route(); return false; }
      b.dataset.sure = '1'; b.textContent = 'Really erase everything?';
      return true;
    }
  });
}

// ---------- home ----------
function journeyStats() {
  const pr = S().journey;
  const done = LEVELS.filter((l) => pr[l.id]).length;
  const st = LEVELS.reduce((a, l) => a + (pr[l.id]?.stars || 0), 0);
  const next = LEVELS.find((l) => !pr[l.id] && isUnlocked(l, pr)) || null;
  return { done, st, next };
}

function dailyStreak() {
  let n = 0;
  const d = new Date();
  if (!S().daily[dateKey(d)]) d.setDate(d.getDate() - 1);
  while (S().daily[dateKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function home() {
  const j = journeyStats(), today = S().daily[dateKey()], streak = dailyStreak();
  const dateText = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  app.innerHTML = `<main class="home">
    <header class="hero">
      <svg class="art" viewBox="0 0 240 150" aria-hidden="true">
        <path class="a-leaf" d="M20 118C60 60 170 50 226 96C170 150 70 150 20 118Z"/>
        <path class="a-rib" d="M30 116C90 100 160 96 220 97"/>
        <ellipse class="a-fur" cx="122" cy="92" rx="52" ry="34"/>
        <path class="a-tail" d="M168 104c22 6 30-14 16-22"/>
        <circle class="a-fur" cx="84" cy="84" r="27"/>
        <circle class="a-fur" cx="70" cy="60" r="11"/><circle class="a-ear" cx="70" cy="60" r="6"/>
        <circle class="a-fur" cx="98" cy="58" r="11"/><circle class="a-ear" cx="98" cy="58" r="6"/>
        <path class="a-eye" d="M68 84q6 6 12 0M86 84q6 6 12 0"/><ellipse class="a-nose" cx="82" cy="95" rx="4" ry="3"/>
        <text class="a-z z1" x="128" y="46">z</text><text class="a-z z2" x="146" y="30">z</text><text class="a-z z3" x="166" y="16">z</text>
      </svg>
      <h1>Dormice</h1>
      <p>A quiet little puzzle about not waking anyone.</p>
    </header>
    <nav class="menu">
      <a class="card primary" href="#/journey"><b>${j.done ? 'Continue the journey' : 'Start the journey'}</b>
        <span>${j.next ? `Next: ${esc(CHAPTERS[j.next.chapter].title)} ${j.next.index + 1}` : 'Every garden visited'} · ${j.done}/${LEVELS.length} · ${j.st}★</span></a>
      <a class="card" href="#/daily"><b>Today's garden</b>
        <span>${dateText} · ${today ? `done in ${fmt(today.time)} ${'★'.repeat(today.stars)}` : 'not visited yet'}${streak > 1 ? ` · ${streak} days running` : ''}</span></a>
      <a class="card" href="#/free"><b>Free play</b><span>Classic boards, honeycombs, triangles and every twist</span></a>
    </nav>
    <footer><a class="link" href="#/records">Records</a><button class="link" data-act="how">How to play</button><button class="link" data-act="settings">Settings</button><button class="link" data-act="about">About</button></footer>
  </main>`;
}

// ---------- journey ----------
function journeyScreen() {
  const pr = S().journey;
  app.innerHTML = `<main class="page">
    <header class="bar"><a class="iconbtn" href="#/" aria-label="Back">${I.back}</a><h1>Journey</h1><span class="spacer"></span></header>
    <div class="chapters">${CHAPTERS.map((ch, ci) => {
      const open = isUnlocked(ch.levels[0], pr);
      return `<section class="chapter ${open ? '' : 'locked'}">
        <h2><small>${ci + 1}</small>${esc(ch.title)}</h2><p>${open ? esc(ch.blurb) : 'Finish more of the garden before this one to open it.'}</p>
        <div class="levels">${ch.levels.map((l) => {
          const ok = isUnlocked(l, pr), got = pr[l.id];
          return `<button class="lv ${got ? 'done' : ''}" ${ok ? '' : 'disabled'} data-level="${l.id}" aria-label="Level ${l.index + 1}">
            <b>${l.index + 1}</b>${got ? stars(got.stars) : '<span class="stars"><i>★</i><i>★</i><i>★</i></span>'}</button>`;
        }).join('')}</div></section>`;
    }).join('')}</div></main>`;
}

// ---------- free play ----------
const OPTS = {
  grid: ['Tiles', [['square', 'Squares'], ['hex', 'Hexagons'], ['tri', 'Triangles']]],
  size: ['Size', [['s', 'Small'], ['m', 'Medium'], ['l', 'Large']]],
  density: ['Sleepers', [['calm', 'Few'], ['standard', 'Some'], ['tricky', 'Many']]],
  shape: ['Garden shape', [['rect', 'Plain'], ['hexagon', 'Comb'], ['round', 'Round'], ['diamond', 'Diamond'], ['ring', 'Ring'], ['ponds', 'Ponds']]],
  color: ['Colour rule', [['none', 'None'], ['counts', 'Flowerbeds'], ['split', 'Sun and shade'], ['twins', 'Twin nests']]],
};
const CLASSIC = [['Beginner', 's', 'calm', '9 × 9, 10'], ['Intermediate', 'm', 'standard', '16 × 16, 40'], ['Expert', 'l', 'tricky', '30 × 16, 99']];
const cfgKey = (c) => [c.grid, c.shape, c.size, c.density, c.color, +c.lines, +c.owls, +c.noGuess, c.lives].join('|');

function freeScreen() {
  const cfg = (S().free = { ...FREE_DEFAULT, ...S().free });
  if (cfg.grid !== 'hex' && cfg.shape === 'hexagon') cfg.shape = 'rect';
  if (cfg.grid === 'tri') cfg.owls = false;
  const seg = (k) => `<fieldset><legend>${OPTS[k][0]}</legend><div class="chips">${OPTS[k][1]
    .filter(([v]) => v !== 'hexagon' || cfg.grid === 'hex')
    .map(([v, l]) => `<button data-k="${k}" data-v="${v}" class="chip ${cfg[k] === v ? 'on' : ''}">${l}</button>`).join('')}</div></fieldset>`;
  const tog = (k, l, off) => `<button data-k="${k}" data-v="toggle" class="chip ${cfg[k] ? 'on' : ''}" ${off ? 'disabled' : ''}>${l}</button>`;
  const isClassic = cfg.grid === 'square' && cfg.shape === 'rect' && cfg.color === 'none' && !cfg.lines && !cfg.owls;
  const best = S().best[cfgKey(cfg)];
  app.innerHTML = `<main class="page">
    <header class="bar"><a class="iconbtn" href="#/" aria-label="Back">${I.back}</a><h1>Free play</h1><span class="spacer"></span></header>
    <div class="form">
      <fieldset><legend>The classics</legend><div class="chips">${CLASSIC.map(([l, s, d, sub]) =>
        `<button data-classic="${s},${d}" class="chip tall ${isClassic && cfg.size === s && cfg.density === d ? 'on' : ''}">${l}<small>${sub}</small></button>`).join('')}</div></fieldset>
      ${seg('grid')}${seg('size')}${seg('density')}${seg('shape')}${seg('color')}
      <fieldset><legend>Extra clues</legend><div class="chips">${tog('lines', 'Row clues')}${tog('owls', 'Owls', cfg.grid === 'tri')}</div></fieldset>
      <fieldset><legend>Comfort</legend><div class="chips">
        ${tog('noGuess', 'Never needs a guess')}
        <button data-k="lives" data-v="3" class="chip ${cfg.lives === 3 ? 'on' : ''}">Three hearts</button>
        <button data-k="lives" data-v="1" class="chip ${cfg.lives === 1 ? 'on' : ''}">One heart</button></div></fieldset>
      <div class="go"><span class="muted">${best ? `Your best here: ${fmt(best)}` : ''}</span><button class="btn primary big" data-act="play">Play</button></div>
    </div></main>`;
  store.save();
}

// ---------- records ----------
const KEEP = 5;
// The fastest wins for one kind of free-play garden. Older saves only have a single best time.
function scoresFor(key) {
  return S().scores[key] || (S().best[key] ? [{ t: S().best[key], d: null, st: 0 }] : []);
}
function addScore(key, t, st) {
  const entry = { t, d: dateKey(), st };
  const list = [...scoresFor(key), entry].sort((a, b) => a.t - b.t).slice(0, KEEP);
  S().scores[key] = list;
  return list.indexOf(entry) + 1; // 0 when it did not make the board
}
function cfgOfKey(key) {
  const [grid, shape, size, density, color, lines, owls, noGuess, lives] = key.split('|');
  return { grid, shape, size, density, color, lines: lines === '1', owls: owls === '1', noGuess: noGuess === '1', lives: +lives };
}
function gardenName(cfg) {
  const o = (k) => OPTS[k][1].find(([v]) => v === cfg[k])?.[1] ?? cfg[k];
  const plain = cfg.grid === 'square' && cfg.shape === 'rect' && cfg.color === 'none' && !cfg.lines && !cfg.owls;
  const classic = plain && CLASSIC.find(([, s, d]) => s === cfg.size && d === cfg.density);
  const name = classic ? `${classic[0]} (${classic[3]})` : `${o('size')} ${o('grid').toLowerCase()}, ${o('density').toLowerCase()} sleepers`;
  const extra = [cfg.shape !== 'rect' && o('shape'), cfg.color !== 'none' && o('color'), cfg.lines && 'Row clues', cfg.owls && 'Owls',
    !cfg.noGuess && 'May need a guess', cfg.lives === 1 && 'One heart'].filter(Boolean);
  return [name, extra.join(' · ')];
}
const dayText = (key) => (key ? new Date(key + 'T12:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function recordsScreen() {
  const d = S(), j = journeyStats();
  const order = { square: 0, hex: 1, tri: 2, s: 0, m: 1, l: 2 };
  const keys = [...new Set([...Object.keys(d.scores), ...Object.keys(d.best)])].sort((a, b) => {
    const x = cfgOfKey(a), y = cfgOfKey(b);
    return order[x.grid] - order[y.grid] || order[x.size] - order[y.size] || a.localeCompare(b);
  });
  const boards = keys.map((k) => {
    const [name, extra] = gardenName(cfgOfKey(k));
    return `<section class="chapter rec"><h2>${esc(name)}</h2>${extra ? `<p>${esc(extra)}</p>` : ''}
      <ol>${scoresFor(k).map((e) => `<li><b>${fmt(e.t)}</b>${e.st ? stars(e.st) : '<span></span>'}<span class="muted">${dayText(e.d)}</span></li>`).join('')}</ol></section>`;
  }).join('');
  const days = Object.keys(d.daily).sort().reverse();
  const fastest = days.reduce((a, k) => (a == null || d.daily[k].time < d.daily[a].time ? k : a), null);
  const chapters = CHAPTERS.map((ch) => {
    const done = ch.levels.filter((l) => d.journey[l.id]);
    if (!done.length) return '';
    const st = done.reduce((a, l) => a + d.journey[l.id].stars, 0), t = done.reduce((a, l) => a + d.journey[l.id].best, 0);
    return `<li><b>${esc(ch.title)}</b>${`<span class="stars"><i class="on">★</i> ${st}/${ch.levels.length * 3}</span>`}<span class="muted">${done.length}/${ch.levels.length} levels · ${fmt(t)} in all</span></li>`;
  }).join('');
  app.innerHTML = `<main class="page">
    <header class="bar"><a class="iconbtn" href="#/" aria-label="Back">${I.back}</a><h1>Records</h1><span class="spacer"></span></header>
    <div class="chapters">
      <section class="chapter rec"><h2>Free play</h2><p>The five fastest wins for each kind of garden you have played, kept on this device.</p></section>
      ${boards || '<section class="chapter rec"><p>Nothing here yet. Win a free-play garden and its time shows up here.</p></section>'}
      <section class="chapter rec"><h2>Today's garden</h2>
        <p>${days.length ? `${days.length} ${days.length === 1 ? 'day' : 'days'} visited · ${dailyStreak()} running · fastest ${fmt(d.daily[fastest].time)} on ${dayText(fastest)}` : 'Not visited yet.'}</p>
        <ol class="plain">${days.slice(0, 7).map((k) => `<li><b>${fmt(d.daily[k].time)}</b>${stars(d.daily[k].stars)}<span class="muted">${dayText(k)}</span></li>`).join('')}</ol></section>
      <section class="chapter rec"><h2>Journey</h2><p>${j.done}/${LEVELS.length} levels · ${j.st}/${LEVELS.length * 3} stars</p>
        <ol class="plain">${chapters}</ol></section>
    </div></main>`;
}

function freeTitle(cfg) {
  const o = (k) => OPTS[k][1].find(([v]) => v === cfg[k])[1];
  const bits = [o('size'), o('grid').toLowerCase()];
  const extra = [cfg.color !== 'none' && o('color'), cfg.lines && 'Row clues', cfg.owls && 'Owls'].filter(Boolean);
  return [bits.join(' '), extra.join(' · ')];
}

// ---------- game ----------
let pending = null; // what #/game should show
let ses = null;     // the running session

function startJourney(id) {
  const lv = LEVELS.find((l) => l.id === id);
  const ch = CHAPTERS[lv.chapter];
  launch({ kind: 'journey', level: lv, spec: lv.spec, seed: lv.seed, title: ch.title, sub: `Level ${lv.index + 1} of ${ch.levels.length}`, lives: 3, back: '#/journey' });
}
function dailyCtx() {
  const key = dateKey(), d = dailyPuzzle(key);
  return { kind: 'daily', key, ...d, title: "Today's garden", sub: new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long' }), lives: 3, back: '#/' };
}
function startFree() {
  const cfg = { ...S().free };
  const portrait = innerHeight > innerWidth * 1.15;
  const [title, sub] = freeTitle(cfg);
  launch({ kind: 'free', cfg, spec: freeSpec(cfg, portrait), seed: 'free:' + Math.random().toString(36).slice(2), title, sub, lives: cfg.lives, back: '#/free' });
}
function launch(ctx) {
  pending = ctx;
  if (location.hash === '#/game') route(); else location.hash = '#/game';
}

function gameScreen() {
  const ctx = pending;
  if (!ctx) { location.replace('#/'); return; }
  const r = ctx.spec.rules || {};
  // Puzzles with clues that are visible from the start are opened for you;
  // plain ones wait for your first click and build themselves around it.
  const preopen = ctx.kind !== 'free' || r.lines || r.color;
  const p = preopen ? generate(ctx.spec, ctx.seed) : layoutPuzzle(ctx.spec, ctx.seed);
  const game = new Game(p, { lives: ctx.lives });
  if (preopen) game.openStart();
  const legend = p.mode === 'counts' ? `<div class="legend" id="legend"></div>`
    : p.mode === 'split' ? `<div class="legend"><span class="lg k0"><i></i>sun, left number</span><span class="lg k1"><i></i>shade, right number</span></div>`
    : p.mode === 'twins' ? `<div class="legend"><span class="lg tw"><i></i>twin nest: two sleepers or none</span></div>` : '';
  app.innerHTML = `<main class="game">
    <header class="bar">
      <a class="iconbtn" href="${ctx.back}" aria-label="Back">${I.back}</a>
      <div class="title"><b>${esc(ctx.title)}</b><span>${esc(ctx.sub || '')}</span></div>
      <div class="stat hearts" id="hearts"></div>
      <div class="stat" id="left" title="Sleepers not yet under a leaf">${I.mouse}<b></b></div>
      <div class="stat time" id="time">0:00</div>
    </header>
    ${legend}
    <div class="boardwrap" id="wrap" tabindex="0" aria-label="Puzzle board"></div>
    <div class="hintbar" id="hintbar" hidden><p></p><button class="iconbtn small" data-act="hint-close" aria-label="Close hint">×</button></div>
    <footer class="tools">
      <button class="tool" data-act="hint">${I.hint}<span>Hint</span></button>
      <div class="mode" role="group" aria-label="What a tap does">
        <button class="on" data-act="mode" data-v="turn">${I.turn}<span>Turn</span></button>
        <button data-act="mode" data-v="leaf">${I.leaf}<span>Leaf</span></button>
      </div>
      <button class="tool" data-act="fit">${I.fit}<span>Fit</span></button>
      <button class="tool" data-act="again">${I.again}<span>Restart</span></button>
    </footer>
  </main>`;
  if (ses) clearInterval(ses.timer);
  ses = { ctx, game, mode: 'turn', guided: !!ctx.spec.guided, view: null, timer: 0 };
  ses.view = new BoardView($('#wrap'), game, { onAct: act });
  ses.timer = setInterval(tick, 250);
  hud();
  const unseen = rulesOf(ctx.spec).filter((id) => !S().seen[id]);
  if (unseen.length) {
    unseen.forEach((id) => (S().seen[id] = true));
    store.save();
    showRules(unseen, () => ses.guided && showHint(true));
  } else if (ses.guided) showHint(true);
}

function tick() {
  if (!ses || !$('#time')) return;
  $('#time').textContent = fmt(ses.game.elapsed());
}

function hud() {
  const g = ses.game;
  $('#hearts').innerHTML = g.maxLives > 1 ? Array.from({ length: g.maxLives }, (_, i) => `<span class="${i < g.lives ? '' : 'gone'}">${I.heart}</span>`).join('') : '';
  $('#left b').textContent = g.remaining();
  const lg = $('#legend');
  if (lg) lg.innerHTML = g.p.colorTotals.map((_, k) => `<span class="lg k${k} ${g.colorRemaining(k) === 0 ? 'zero' : ''}" data-color="${k}"><i></i><b>${g.colorRemaining(k)}</b></span>`).join('');
  tick();
}

function act(c, kind) {
  let g = ses.game;
  if (g.over) return;
  const st = g.state[c];
  const dig = (kind === 'primary') === (ses.mode === 'turn');
  let r;
  if (kind === 'line') r = g.chordLine(c);
  else if (st === OPEN) {
    if (kind === 'secondary') { ses.view.highlight(g.p.reg[c], 1600); return; }
    r = g.chord(c);
  } else if (kind === 'chord') return;
  else if (dig) {
    if (st !== COVERED) return;
    if (!g.p.mines) g.p = generate(ses.ctx.spec, ses.ctx.seed, c);
    r = g.reveal(c);
  } else {
    if (!g.p.mines) return toast('Turn a tile first. Your first tile is always safe.');
    r = g.toggleLeaf(c);
  }
  if (!r.changed.length) return;
  ses.view.update(r.changed);
  hideHint();
  const opened = r.changed.filter((x) => g.state[x] === OPEN).length;
  if (r.hit.length) {
    play('wake');
    const w = $('#wrap');
    w.classList.remove('shake'); void w.offsetWidth; w.classList.add('shake');
    if (!r.lost) toast(g.lives === 1 ? 'A dormouse woke up. One heart left.' : `A dormouse woke up. ${g.lives} hearts left.`);
  } else if (opened) play('turn', opened);
  else play(g.state[c] === LEAF ? 'leaf' : 'lift');
  hud();
  if (r.won) return win();
  if (r.lost) return lose();
  if (ses.guided) setTimeout(() => ses && !ses.game.over && showHint(true), 350);
}

function toast(text) {
  const bar = $('#hintbar');
  bar.hidden = false;
  bar.className = 'hintbar toast';
  $('p', bar).textContent = text;
  clearTimeout(ses.toastTimer);
  ses.toastTimer = setTimeout(hideHint, 2600);
}
function hideHint() {
  if (!ses) return;
  clearTimeout(ses.toastTimer);
  const bar = $('#hintbar');
  if (bar) bar.hidden = true;
  ses.view.clearHint();
  document.querySelectorAll('.hint-src-ui').forEach((e) => e.classList.remove('hint-src-ui'));
}
function showHint(auto) {
  const g = ses.game;
  if (g.over) return;
  if (!g.p.mines) return toast('Turn any tile to begin. Your first tile is always safe.');
  const h = getHint(g);
  if (!h) return;
  if (!auto) g.hints++;
  hideHint();
  ses.view.showHint(h);
  for (const s of h.srcs) {
    if (s.t === 'total') $('#left').classList.add('hint-src-ui');
    if (s.t === 'color') $(`#legend [data-color="${s.i}"]`)?.classList.add('hint-src-ui');
  }
  const bar = $('#hintbar');
  bar.hidden = false;
  bar.className = 'hintbar ' + h.kind;
  $('p', bar).textContent = h.text;
}

// A record has to show on the clock: at least a whole second quicker.
const faster = (t, old) => Math.floor(t) < Math.floor(old);

function win() {
  const { ctx, game } = ses;
  clearInterval(ses.timer);
  tick();
  play('win');
  const t = game.elapsed();
  const st = game.mistakes ? 1 : game.hints ? 2 : 3;
  let note = '', beaten = null; // beaten: the old best time, when this win was faster
  if (ctx.kind === 'journey') {
    const old = S().journey[ctx.level.id];
    if (old && faster(t, old.best)) beaten = old.best;
    S().journey[ctx.level.id] = { stars: Math.max(st, old?.stars || 0), best: Math.min(t, old?.best || Infinity) };
  } else if (ctx.kind === 'daily') {
    const old = S().daily[ctx.key];
    if (old && faster(t, old.time)) beaten = old.time;
    if (!old || st > old.stars || (st === old.stars && t < old.time)) S().daily[ctx.key] = { time: t, stars: st };
  } else {
    const k = cfgKey(ctx.cfg), old = S().best[k];
    const had = scoresFor(k).length, rank = addScore(k, t, st);
    if (!old || t < old) S().best[k] = t;
    if (had && rank === 1 && faster(t, old)) beaten = old;
    note = rank > 1 ? `Number ${rank} on your board for this kind of garden.` : '';
  }
  store.save();
  confetti();
  if (beaten != null) setTimeout(() => { if (ses && ses.game === game) { play('record'); confetti(); } }, 900);
  const next = ctx.kind === 'journey' ? LEVELS[ctx.level.number] : null;
  const nextOpen = next && isUnlocked(next, S().journey);
  const why = st === 3 ? 'Nobody stirred, and no hints needed.' : st === 2 ? 'Nobody stirred. Try without hints for the third star.' : 'Everyone else slept on. Wake nobody for two stars.';
  setTimeout(() => {
    if (!ses || ses.game !== game) return;
    openDialog(`<div class="sheet result"><div class="big">${I.mouse}</div><h2>All quiet</h2>${stars(st)}
      ${beaten != null ? `<p class="record"><b>New record</b><span>${fmt(t)} beats your old best of ${fmt(beaten)}</span></p>` : ''}
      <p>${fmt(t)} · ${why}</p>${note ? `<p class="muted">${note}</p>` : ''}
      ${nextOpen && next.index === 0 ? `<p class="muted">Next up: ${esc(CHAPTERS[next.chapter].title)}</p>` : ''}
      <div class="row">
        <button class="btn ghost" data-act="back">${ctx.kind === 'journey' ? 'Journey' : ctx.kind === 'free' ? 'Change garden' : 'Home'}</button>
        ${ctx.kind === 'free' ? '<button class="btn primary" autofocus data-act="new">Another</button>' : nextOpen ? '<button class="btn primary" autofocus data-act="next">Next level</button>' : '<button class="btn primary" autofocus data-act="again">Play again</button>'}
      </div></div>`, resultAct);
  }, 900);
}

function lose() {
  const { ctx, game } = ses;
  clearInterval(ses.timer);
  play('lose');
  ses.view.refreshAll();
  setTimeout(() => {
    if (!ses || ses.game !== game) return;
    openDialog(`<div class="sheet result"><div class="big awake">${I.awake}</div><h2>Everybody is up</h2>
      <p>No harm done. Dormice fall asleep again very quickly.</p>
      <div class="row"><button class="btn ghost" data-act="look">Look at the board</button>
      <button class="btn primary" autofocus data-act="${ctx.kind === 'free' ? 'new' : 'again'}">Try again</button></div></div>`, resultAct);
  }, 1100);
}

function resultAct(a) {
  const ctx = ses.ctx;
  if (a === 'back') location.hash = ctx.back;
  else if (a === 'next') startJourney(LEVELS[ctx.level.number].id);
  else if (a === 'new') startFree();
  else if (a === 'again') launch(ctx);
}

function confetti() {
  if (!S().settings.motion) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  for (let i = 0; i < 26; i++) {
    const s = document.createElement('i');
    s.style.cssText = `left:${Math.random() * 100}%;animation-delay:${Math.random() * 0.7}s;animation-duration:${2.2 + Math.random() * 1.6}s;--r:${Math.random() * 360}deg;--k:${i % 5}`;
    box.appendChild(s);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 4600);
}

// ---------- events ----------
document.addEventListener('click', (e) => {
  if (dlg.contains(e.target)) return;
  const t = e.target.closest('[data-act],[data-level],[data-k],[data-classic]');
  if (!t) return;
  const cfg = S().free;
  if (t.dataset.level) return startJourney(t.dataset.level);
  if (t.dataset.classic) {
    const [size, density] = t.dataset.classic.split(',');
    Object.assign(cfg, { grid: 'square', shape: 'rect', color: 'none', lines: false, owls: false, size, density });
    return freeScreen();
  }
  if (t.dataset.k) {
    const k = t.dataset.k, v = t.dataset.v;
    cfg[k] = v === 'toggle' ? !cfg[k] : k === 'lives' ? +v : v;
    return freeScreen();
  }
  switch (t.dataset.act) {
    case 'how': return showRules(Object.keys(RULES));
    case 'about': return aboutDialog();
    case 'settings': return settingsDialog();
    case 'play': return startFree();
    case 'hint': return showHint(false);
    case 'hint-close': return hideHint();
    case 'fit': ses.view.scale = ses.view.fitScale; ses.view.apply(); ses.view.auto = ses.view.fitScale >= 24; return;
    case 'again': return launch(ses.ctx.kind === 'free' ? { ...ses.ctx, seed: 'free:' + Math.random().toString(36).slice(2) } : ses.ctx);
    case 'mode':
      ses.mode = t.dataset.v;
      t.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === t));
  }
});

const DIRS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] };
document.addEventListener('keydown', (e) => {
  if (!ses || location.hash !== '#/game' || dlg.open || e.ctrlKey || e.metaKey || e.altKey) return;
  const v = ses.view, cells = ses.game.p.board.cells, key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (DIRS[key]) {
    e.preventDefault();
    if (v.cursor < 0) return v.setCursor(ses.game.p.start);
    const [dx, dy] = DIRS[key], from = cells[v.cursor];
    let best = -1, score = Infinity;
    for (const c of cells) {
      const along = (c.x - from.x) * dx + (c.y - from.y) * dy, across = Math.abs((c.x - from.x) * dy - (c.y - from.y) * dx);
      if (along < 0.3 || across > along * 1.2 + 0.01) continue;
      const sc = along + across * 2;
      if (sc < score) { score = sc; best = c.id; }
    }
    if (best >= 0) { v.setCursor(best); v.hover(best); }
  } else if ((key === ' ' || key === 'Enter') && v.cursor >= 0) { e.preventDefault(); actKey(v.cursor, true); }
  else if (key === 'f' && v.cursor >= 0) actKey(v.cursor, false);
  else if (key === 'h') showHint(false);
  else if (key === 'Escape') hideHint();
});
// The keyboard ignores the Turn/Leaf switch: Space always turns, F always leafs.
function actKey(c, turn) {
  const mode = ses.mode;
  ses.mode = 'turn';
  if (!turn && ses.game.state[c] === OPEN) return;
  act(c, turn ? 'primary' : 'secondary');
  ses.mode = mode;
}

function route() {
  if (dlg.open) dlg.close();
  const h = location.hash || '#/';
  if (h !== '#/game' && ses) { clearInterval(ses.timer); ses = null; }
  if (h === '#/journey') journeyScreen();
  else if (h === '#/free') freeScreen();
  else if (h === '#/records') recordsScreen();
  else if (h === '#/daily') { pending = dailyCtx(); location.replace('#/game'); return; }
  else if (h === '#/game') gameScreen();
  else home();
  scrollTo(0, 0);
}
addEventListener('hashchange', route);

applySettings();
route();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
