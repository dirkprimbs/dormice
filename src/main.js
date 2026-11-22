// Screens, routing and the glue between a Game and its BoardView.
import { store } from './store.js';
import { generate } from './generator.js';
import { layoutPuzzle } from './puzzle.js';
import { Game, getHint, COVERED, OPEN, LEAF } from './game.js';
import { BoardView, MOUSE_ICON, MOUSE_AWAKE, MOUSE_WIN, LEAF_ICON } from './boardview.js';
import { CHAPTERS, LEVELS, isUnlocked, dailyPuzzle, dateKey, freeSpec, FREE_DEFAULT, FREE_OPTS, resolveFree, fitSpec, rulesOf } from './levels.js';
import { RULES } from './text.js';
import { play, setSound } from './audio.js';
import { t, setLang, lang, LANGS, LANG_NAMES } from './i18n.js';

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app'), dlg = $('#dlg');
const S = () => store.data;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const stars = (n, of = 3) => `<span class="stars" aria-label="${t('stars', n, of)}">${'<i class="on">★</i>'.repeat(n)}${'<i>★</i>'.repeat(of - n)}</span>`;
const icon = (inner, vb = '-40 -40 80 80') => `<svg class="ic" viewBox="${vb}" aria-hidden="true">${inner}</svg>`;
const I = {
  mouse: icon(MOUSE_ICON),
  awake: icon(MOUSE_AWAKE),
  winMouse: icon(MOUSE_WIN),
  leaf: icon(`<g transform="rotate(14)">${LEAF_ICON}</g>`),
  heart: icon('<path class="heart out" d="M0 28C-38 2-30-27-11-26C-3-25 0-17 0-17C0-17 3-25 11-26C30-27 38 2 0 28Z"/><path class="heart-hi" d="M-16-14c-4 2-6 7-4 11"/>'),
  heartEmpty: icon('<path class="heart-empty" d="M0 28C-38 2-30-27-11-26C-3-25 0-17 0-17C0-17 3-25 11-26C30-27 38 2 0 28Z"/>'),
  heartSplit: icon(
    '<path class="heart out heart-l" d="M0 28C-38 2-30-27-11-26C-3-25 0-17 0-17L-4-5L3 6L-3 17L0 28Z"/>' +
    '<path class="heart out heart-r" d="M0 28L-3 17L3 6L-4-5L0-17C0-17 3-25 11-26C30-27 38 2 0 28Z"/>'
  ),
  back: icon('<path d="M10-22L-14 0L10 22" fill="none" stroke="currentColor" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round"/>'),
  // A little owl silhouette for Hint
  hint: icon('<path d="M-18-24l6 8c4-2 8-2 12 0l6-8v14c6 6 8 15 6 24-3 10-10 15-18 15s-15-5-18-15c-2-9 0-18 6-24v-14z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><circle cx="-7" cy="-3" r="4" fill="currentColor"/><circle cx="7" cy="-3" r="4" fill="currentColor"/><path d="M-3 6l3 4 3-4" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>'),
  again: icon('<path d="M22-8A24 24 0 1 0 24 6M24-28v20H4" fill="none" stroke="currentColor" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>'),
  fit: icon('<path d="M-26-10v-16h16M26-10v-16H10M-26 10v16h16M26 10v16H10" fill="none" stroke="currentColor" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>'),
  // A little garden trowel for Turn & Free play
  turn: icon('<path d="M-22 22l14-14M-11 5l6 6M-6-10c9-12 22-18 28-12s0 19-12 28c-6 4-13 5-17 1s-3-11 1-17z" fill="none" stroke="currentColor" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>'),
  path: icon('<path d="M-20 26c0-14 28-12 28-24s-24-10-24-22" fill="none" stroke="currentColor" stroke-width="6.5" stroke-linecap="round" stroke-dasharray="1 11"/><circle cx="14" cy="-22" r="7" fill="none" stroke="currentColor" stroke-width="5.5"/><path d="M14-15v10" stroke="currentColor" stroke-width="5.5" stroke-linecap="round"/>'),
  sun: icon('<circle r="13" fill="none" stroke="currentColor" stroke-width="6.5"/><path d="M0-30v7M0 23v7M-30 0h7M23 0h7M-21-21l5 5M16 16l5 5M21-21l-5 5M-16 16l-5 5" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>'),
  dice: icon('<rect x="-26" y="-26" width="52" height="52" rx="12" fill="none" stroke="currentColor" stroke-width="7"/><g fill="currentColor"><circle cx="-11" cy="-11" r="5.5"/><circle r="5.5"/><circle cx="11" cy="11" r="5.5"/></g>'),
};
const OAK_TL = '<path class="sp-leaf" d="M6-4C24-10 34 2 28 12C38 10 46 20 38 30C48 30 54 42 44 50C52 54 48 68 34 64C26 62 22 54 20 50C12 58 0 52 4 40C-6 36-4 22 8 20C-2 12 0 0 6-4Z"/><path class="sp-vein" d="M10 4L40 54M18 18L30 14M25 30L38 28M32 42L44 42M20 28L10 36M28 42L16 48"/>';
const CLOVER = (cx, cy, s = 1) => `<g transform="translate(${cx} ${cy}) scale(${s})"><circle class="sp-clover" cx="-6" cy="-5" r="6"/><circle class="sp-clover" cx="6" cy="-5" r="6"/><circle class="sp-clover" cx="-6" cy="5" r="6"/><circle class="sp-clover" cx="6" cy="5" r="6"/></g>`;
const SPRIGS_HOME = `<div class="sprigs" aria-hidden="true">
  <svg class="sprig tl" viewBox="0 0 220 180">
    <path class="sp-stem" d="M16 14C66 12 114 18 176 28M22 24C12 68 10 112 22 154M114 20C126 34 134 42 146 46"/>
    ${OAK_TL}
    ${CLOVER(88, 18, 0.95)}${CLOVER(184, 34, 1.05)}${CLOVER(14, 72, 0.85)}
    <path class="sp-leaf sm" d="M14 114C2 122 2 138 14 144C22 134 22 122 14 114Z"/>
    <path class="sp-leaf sm" d="M22 132C34 138 34 154 22 162C14 152 14 140 22 132Z"/>
    <circle class="sp-berry" cx="122" cy="40" r="5.5"/><circle class="sp-berry" cx="134" cy="48" r="4.5"/><circle class="sp-berry" cx="148" cy="36" r="4.2"/>
    <circle class="sp-berry" cx="30" cy="108" r="4.5"/><circle class="sp-berry" cx="38" cy="100" r="3.8"/>
  </svg>
  <svg class="sprig br" viewBox="0 0 220 180">
    <g transform="translate(220 180) scale(-1 -1)">
      <path class="sp-stem" d="M16 14C66 12 114 18 176 28M22 24C12 68 10 112 22 154M114 20C126 34 134 42 146 46"/>
      ${OAK_TL}
      ${CLOVER(88, 18, 0.95)}${CLOVER(184, 34, 1.05)}${CLOVER(14, 72, 0.85)}
      <path class="sp-leaf sm" d="M14 114C2 122 2 138 14 144C22 134 22 122 14 114Z"/>
      <path class="sp-leaf sm" d="M22 132C34 138 34 154 22 162C14 152 14 140 22 132Z"/>
      <circle class="sp-berry" cx="122" cy="40" r="5.5"/><circle class="sp-berry" cx="134" cy="48" r="4.5"/><circle class="sp-berry" cx="148" cy="36" r="4.2"/>
      <circle class="sp-berry" cx="30" cy="108" r="4.5"/><circle class="sp-berry" cx="38" cy="100" r="3.8"/>
    </g>
  </svg>
</div>`;
const SPRIGS_GAME = `<div class="sprigs pressed" aria-hidden="true">
  <svg class="sprig tl" viewBox="0 0 200 180"><g transform="rotate(12 50 50) scale(1.25)">${OAK_TL}</g></svg>
  <svg class="sprig tr" viewBox="0 0 200 180"><g transform="translate(170 20) rotate(110) scale(1.1)">${OAK_TL}</g></svg>
  <svg class="sprig bl" viewBox="0 0 200 180"><g transform="translate(20 165) rotate(-55) scale(1.2)">${OAK_TL}</g></svg>
  <svg class="sprig br" viewBox="0 0 200 180"><g transform="translate(175 160) rotate(205) scale(1.15)">${OAK_TL}</g></svg>
</div>`;

// ---------- settings ----------
function applySettings() {
  const s = S().settings;
  setLang(s.lang);
  document.title = 'Dormice';
  $('meta[name=description]').content = t('page.description');
  const dark = s.theme === 'dark' || (s.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.markers = s.markers ? 'on' : 'off';
  document.documentElement.dataset.motion = s.motion ? 'on' : 'off';
  $('meta[name=theme-color]').content = dark ? '#1f2226' : '#f3ecdf';
  setSound(s.sound);
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySettings);

// ---------- dialogs ----------
function openDialog(html, onAct, keepScroll = false) {
  const prevScroll = keepScroll ? dlg.querySelector('.sheet')?.scrollTop || 0 : 0;
  dlg.innerHTML = html;
  dlg.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (b && b.dataset.act === 'poke') return poke(b);
    if (b) { const keep = onAct && onAct(b.dataset.act, b) === true; if (!keep) dlg.close(); }
    else if (e.target === dlg && !dlg.dataset.sticky) dlg.close();
  };
  delete dlg.dataset.sticky;
  if (!dlg.open) dlg.showModal();
  // Focusing the button at the end scrolls a long sheet down; start at the top unless updating in place.
  const sheet = dlg.querySelector('.sheet');
  if (sheet) sheet.scrollTop = prevScroll;
}

function showRules(ids, then) {
  const body = ids.map((id) => `<section><h2>${RULES[id].title}</h2>${RULES[id].body()}</section>`).join('');
  openDialog(`<div class="sheet rules">${body}<div class="row"><button class="btn primary" autofocus data-act="ok">${t('gotIt')}</button></div></div>`);
  dlg.addEventListener('close', () => then && then(), { once: true });
}

function aboutDialog() {
  openDialog(`<div class="sheet about"><div class="big">${I.mouse}</div><h2>Dormice</h2>
    <p>${t('about.by')}</p>
    <p>${t('about.more')}</p>
    <p class="links"><a href="https://primbs.ca" target="_blank" rel="noopener">primbs.ca</a><a href="https://github.com/dirkprimbs" target="_blank" rel="noopener">github.com/dirkprimbs</a></p>
    <div class="row"><button class="btn primary" autofocus data-act="ok">${t('close')}</button></div></div>`);
}

function settingsDialog(keepScroll = false) {
  const s = S().settings;
  const cur = (key) => (key === 'snapLeaf' ? snapsBack() : s[key]);
  const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-act="set" data-k="${key}" data-v="${v}" class="${String(cur(key)) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  openDialog(`<div class="sheet"><h2>${t('settings.title')}</h2>
    <label>${t('settings.language')}</label>${seg('lang', [['auto', t('settings.langAuto')], ...Object.keys(LANGS).map((k) => [k, LANG_NAMES[k]])])}
    <label>${t('settings.look')}</label>${seg('theme', [['auto', t('settings.auto')], ['light', t('settings.day')], ['dark', t('settings.evening')]])}
    <label>${t('settings.sound')}</label>${seg('sound', [[true, t('on')], [false, t('off')]])}
    <label>${t('settings.animation')}</label>${seg('motion', [[true, t('on')], [false, t('settings.reduced')]])}
    <label>${t('settings.snapLeaf')}</label>${seg('snapLeaf', [[true, t('on')], [false, t('off')]])}
    <p class="muted small">${t('settings.snapLeafNote')}</p>
    <label>${t('settings.markers')}</label>${seg('markers', [[false, t('off')], [true, t('on')]])}
    <p class="muted small">${t('settings.markersNote')}</p>
    <div class="row"><button class="btn ghost" data-act="reset">${t('settings.erase')}</button><button class="btn primary" autofocus data-act="ok">${t('done')}</button></div></div>`,
  (act, b) => {
    if (act === 'set') {
      const v = b.dataset.v;
      s[b.dataset.k] = v === 'true' ? true : v === 'false' ? false : v;
      const relang = b.dataset.k === 'lang';
      store.save(); applySettings(); settingsDialog(true);
      // The screen behind the dialog is in the old language: draw it again, without closing the dialog.
      if (relang) redraw();
      return true;
    }
    if (act === 'reset') {
      if (b.dataset.sure) { store.reset(); applySettings(); route(); return false; }
      b.dataset.sure = '1'; b.textContent = t('settings.eraseSure');
      return true;
    }
  }, keepScroll);
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
  const dateText = new Date().toLocaleDateString(lang(), { weekday: 'long', day: 'numeric', month: 'long' });
  app.innerHTML = `${SPRIGS_HOME}<main class="home">
    <header class="hero">
      <button class="art" data-act="poke" aria-label="${t('home.poke')}"><svg viewBox="0 0 240 156" aria-hidden="true">
        <defs>
          <linearGradient id="dm-leaf" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#d5d396"/><stop offset="55%" stop-color="#c2c482"/><stop offset="100%" stop-color="#aab16e"/>
          </linearGradient>
          <radialGradient id="dm-fur" cx="42%" cy="35%" r="68%">
            <stop offset="0%" stop-color="#dfb891"/><stop offset="60%" stop-color="#c89a6e"/><stop offset="100%" stop-color="#ad7c52"/>
          </radialGradient>
          <linearGradient id="dm-nest" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f2cfba"/><stop offset="100%" stop-color="#e3b199"/>
          </linearGradient>
        </defs>
        <path class="a-leaf" d="M22 118C62 66 154 60 218 99C174 147 82 150 22 118Z"/>
        <path class="a-rib" d="M25 117C86 104 156 99 214 99"/>
        <path class="a-vein" d="M68 109l-14-14M112 103l-12-15M158 100l-12-13M88 107l-12 17M136 102l-10 16M180 100l-9 12"/>
        <path class="a-nest" d="M74 106C98 134 152 132 174 106C150 118 98 118 74 106Z"/>
        <g class="dm">
          <g class="a-tail">
            <path class="a-tail-fill" d="M164 106c18 2 28-8 24-21c-2-7-9-9-11-4c-1 3 3 6 5 10c1 6-6 10-18 9z"/>
          </g>
          <g class="a-head">
            <g class="a-earl"><ellipse class="a-fur" cx="68" cy="60" rx="11.5" ry="12" transform="rotate(-14 68 60)"/><ellipse class="a-ear" cx="68.5" cy="61" rx="6.2" ry="6.8" transform="rotate(-14 68.5 61)"/></g>
            <g class="a-earr"><ellipse class="a-fur" cx="98" cy="57" rx="11.5" ry="12" transform="rotate(10 98 57)"/><ellipse class="a-ear" cx="97.5" cy="58" rx="6.2" ry="6.8" transform="rotate(10 97.5 58)"/></g>
          </g>
          <path class="a-fur" d="M65 67C55 75 54 96 67 107C76 114 96 113 116 114C138 119 162 116 170 100C178 82 166 63 142 59C126 57 112 60 104 64C94 60 76 60 65 67Z"/>
          <path class="a-tuft" d="M80 65l2 10M85 63l-1 11M90 65l-3 9M118 65q8-1 16 2M121 71q9-1 17 2M126 77q7 0 13 2"/>
          <path class="a-haunch" d="M138 82C122 86 117 102 125 113"/>
          <path class="a-fold" d="M90 109C98 107 104 103 108 99"/>
          <g class="a-head">
            <ellipse class="a-blush" cx="67" cy="94" rx="5.2" ry="2.8"/><ellipse class="a-blush" cx="99" cy="94" rx="5.2" ry="2.8"/>
            <path class="a-eye" d="M68 87q5.5 6 11 0M86 87q5.5 6 11 0"/>
            <g class="a-open"><circle cx="73.5" cy="86" r="4"/><circle cx="91.5" cy="86" r="4"/><circle class="a-shine" cx="72" cy="84.5" r="1.4"/><circle class="a-shine" cx="90" cy="84.5" r="1.4"/></g>
            <ellipse class="a-nose" cx="82" cy="96" rx="3.8" ry="2.7"/>
            <path class="a-whisker" d="M65 92l-13-3M65 96l-14 0M66 100l-12 4M99 92l13-3M99 96l14 0M98 100l12 4"/>
          </g>
        </g>
        <text class="a-z z1" x="132" y="46">z</text><text class="a-z z2" x="150" y="30">z</text><text class="a-z z3" x="170" y="16">z</text>
      </svg></button>
      <h1>Dormice</h1>
      <p>${t('tagline')}</p>
    </header>
    <nav class="menu">
      <a class="card primary" href="#/journey"><span class="card-ic">${I.path}</span><span class="card-txt"><b>${j.done ? t('home.continue') : t('home.start')}</b>
        <span>${j.next ? esc(t('home.next', chTitle(CHAPTERS[j.next.chapter]), j.next.index + 1)) : t('home.allVisited')} · ${j.done}/${LEVELS.length} · ${j.st}★</span></span></a>
      <a class="card today" href="#/daily"><span class="card-ic">${I.sun}</span><span class="card-txt"><b>${t('home.today')}</b>
        <span>${dateText} · ${today ? t('home.todayDone', fmt(today.time), '★'.repeat(today.stars)) : t('home.notVisited')}${streak > 1 ? ` · ${t('home.streak', streak)}` : ''}</span></span></a>
      <a class="card free" href="#/free"><span class="card-ic">${I.turn}</span><span class="card-txt"><b>${t('home.free')}</b><span>${t('home.freeBlurb')}</span></span></a>
    </nav>
    <footer><a class="link" href="#/records">${t('home.records')}</a><button class="link" data-act="how">${t('home.how')}</button><button class="link" data-act="settings">${t('home.settings')}</button><button class="link" data-act="about">${t('home.about')}</button></footer>
  </main>`;
}

// ---------- journey ----------
function journeyScreen() {
  const pr = S().journey;
  app.innerHTML = `${SPRIGS_HOME}<main class="page">
    <header class="bar"><a class="iconbtn" href="#/" data-back aria-label="${t('back')}">${I.back}</a><h1>${t('journey.title')}</h1><span class="spacer"></span></header>
    <div class="chapters">${CHAPTERS.map((ch, ci) => {
      const open = isUnlocked(ch.levels[0], pr);
      return `<section class="chapter ${open ? '' : 'locked'}">
        <h2><small>${ci + 1}</small>${esc(chTitle(ch))}</h2><p>${open ? esc(t(`chapter.${ch.id}.blurb`)) : t('journey.locked')}</p>
        <div class="levels">${ch.levels.map((l) => {
          const ok = isUnlocked(l, pr), got = pr[l.id];
          return `<button class="lv ${got ? 'done' : ''}" ${ok ? '' : 'disabled'} data-level="${l.id}" aria-label="${t('journey.level', l.index + 1)}">
            <b>${l.index + 1}</b>${got ? stars(got.stars) : '<span class="stars"><i>★</i><i>★</i><i>★</i></span>'}</button>`;
        }).join('')}</div></section>`;
    }).join('')}</div></main>`;
}

// ---------- free play ----------
const opt = (k, v) => t(`opt.${k}.${v}`);
const CLASSIC = [['beginner', 's', 'calm', '9 × 9, 10'], ['intermediate', 'm', 'standard', '16 × 16, 40'], ['expert', 'l', 'tricky', '30 × 16, 99']];
const chTitle = (ch) => t(`chapter.${ch.id}`);
const cfgKey = (c) => [c.grid, c.shape, c.size, c.density, c.color, +c.lines, +c.owls, +c.noGuess, c.lives].join('|');

function freeScreen() {
  const cfg = (S().free = { ...FREE_DEFAULT, ...S().free });
  if (cfg.grid !== 'hex' && cfg.shape === 'hexagon') cfg.shape = 'rect';
  if (cfg.grid === 'tri') cfg.owls = false;
  const seg = (k) => `<fieldset><legend>${t(`opt.${k}`)}</legend><div class="chips">${FREE_OPTS[k]
    .filter((v) => v !== 'hexagon' || cfg.grid === 'hex')
    .map((v) => `<button data-k="${k}" data-v="${v}" class="chip ${cfg[k] === v ? 'on' : ''}">${opt(k, v)}</button>`).join('')}
    <button data-k="${k}" data-v="random" class="chip rand ${cfg[k] === 'random' ? 'on' : ''}">${I.dice}${t('opt.random')}</button></div></fieldset>`;
  const tog = (k, l, off) => `<button data-k="${k}" data-v="toggle" class="chip ${cfg[k] ? 'on' : ''}" ${off ? 'disabled' : ''}>${l}</button>`;
  const isClassic = cfg.grid === 'square' && cfg.shape === 'rect' && cfg.color === 'none' && !cfg.lines && !cfg.owls;
  const best = S().best[cfgKey(cfg)];
  app.innerHTML = `${SPRIGS_HOME}<main class="page">
    <header class="bar"><a class="iconbtn" href="#/" data-back aria-label="${t('back')}">${I.back}</a><h1>${t('free.title')}</h1><span class="spacer"></span></header>
    <div class="form">
      <fieldset><legend>${t('free.classics')}</legend><div class="chips">${CLASSIC.map(([l, s, d, sub]) =>
        `<button data-classic="${s},${d}" class="chip tall ${isClassic && cfg.size === s && cfg.density === d ? 'on' : ''}">${t(`classic.${l}`)}<small>${sub}</small></button>`).join('')}</div></fieldset>
      ${seg('grid')}${seg('size')}${seg('density')}${seg('shape')}${seg('color')}
      <fieldset><legend>${t('free.extra')}</legend><div class="chips">${tog('lines', t('free.lines'))}${tog('owls', t('free.owls'), cfg.grid === 'tri')}</div></fieldset>
      <fieldset><legend>${t('free.comfort')}</legend><div class="chips">
        ${tog('noGuess', t('free.noGuess'))}
        <button data-k="lives" data-v="3" class="chip ${cfg.lives === 3 ? 'on' : ''}">${t('free.threeHearts')}</button>
        <button data-k="lives" data-v="1" class="chip ${cfg.lives === 1 ? 'on' : ''}">${t('free.oneHeart')}</button></div></fieldset>
      <div class="go"><span class="muted">${best ? t('free.best', fmt(best)) : ''}</span><button class="btn primary big" data-act="play">${t('free.play')}</button></div>
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
  const o = (k) => opt(k, cfg[k]);
  const plain = cfg.grid === 'square' && cfg.shape === 'rect' && cfg.color === 'none' && !cfg.lines && !cfg.owls;
  const classic = plain && CLASSIC.find(([, s, d]) => s === cfg.size && d === cfg.density);
  const name = classic ? `${t(`classic.${classic[0]}`)} (${classic[3]})` : t('free.garden', cfg.size, cfg.grid, cfg.density);
  const extra = [cfg.shape !== 'rect' && o('shape'), cfg.color !== 'none' && o('color'), cfg.lines && t('free.lines'), cfg.owls && t('free.owls'),
    !cfg.noGuess && t('free.mayGuess'), cfg.lives === 1 && t('free.oneHeart')].filter(Boolean);
  return [name, extra.join(' · ')];
}
const dayText = (key) => (key ? new Date(key + 'T12:00').toLocaleDateString(lang(), { day: 'numeric', month: 'short', year: 'numeric' }) : '');

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
    const st = done.reduce((a, l) => a + d.journey[l.id].stars, 0), time = done.reduce((a, l) => a + d.journey[l.id].best, 0);
    return `<li><b>${esc(chTitle(ch))}</b>${`<span class="stars"><i class="on">★</i> ${st}/${ch.levels.length * 3}</span>`}<span class="muted">${t('records.chapter', done.length, ch.levels.length, fmt(time))}</span></li>`;
  }).join('');
  app.innerHTML = `${SPRIGS_HOME}<main class="page">
    <header class="bar"><a class="iconbtn" href="#/" data-back aria-label="${t('back')}">${I.back}</a><h1>${t('records.title')}</h1><span class="spacer"></span></header>
    <div class="chapters">
      <section class="chapter rec"><h2>${t('free.title')}</h2><p>${t('records.freeIntro')}</p></section>
      ${boards || `<section class="chapter rec"><p>${t('records.freeEmpty')}</p></section>`}
      <section class="chapter rec"><h2>${t('home.today')}</h2>
        <p>${days.length ? t('records.daily', days.length, dailyStreak(), fmt(d.daily[fastest].time), dayText(fastest)) : t('records.dailyNone')}</p>
        ${days.length ? `<p>${t('records.dailyReplay')}</p>` : ''}
        <ol class="plain days">${days.slice(0, 14).map((k) => `<li><button data-day="${k}" aria-label="${esc(t('records.replay', dayText(k)))}"><b>${fmt(d.daily[k].time)}</b>${stars(d.daily[k].stars)}<span class="muted">${dayText(k)}</span>${I.again}</button></li>`).join('')}</ol></section>
      <section class="chapter rec"><h2>${t('journey.title')}</h2><p>${t('records.journey', j.done, LEVELS.length, j.st, LEVELS.length * 3)}</p>
        <ol class="plain">${chapters}</ol></section>
    </div></main>`;
}

function freeTitle(cfg) {
  const extra = [cfg.color !== 'none' && opt('color', cfg.color), cfg.lines && t('free.lines'), cfg.owls && t('free.owls')].filter(Boolean);
  return [t('free.name', cfg.size, cfg.grid), extra.join(' · ')];
}

// ---------- game ----------
let pending = null; // what #/game should show
let ses = null;     // the running session

function startJourney(id) {
  const lv = LEVELS.find((l) => l.id === id);
  const ch = CHAPTERS[lv.chapter];
  launch({ kind: 'journey', level: lv, spec: lv.spec, seed: lv.seed, title: () => chTitle(ch), sub: () => t('journey.levelOf', lv.index + 1, ch.levels.length), lives: 3, back: '#/journey' });
}
// Today's garden, or (from Records) the garden of an earlier day.
function dailyCtx(key = dateKey(), back = '#/') {
  const d = dailyPuzzle(key), today = key === dateKey();
  const day = new Date(key + 'T12:00');
  const sub = () => day.toLocaleDateString(lang(), today ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
  return { kind: 'daily', key, ...d, title: () => t(today ? 'home.today' : 'home.pastDay'), sub, lives: 3, back };
}
function startFree() {
  const cfg = resolveFree(S().free);
  const portrait = innerHeight > innerWidth * 1.15;
  launch({ kind: 'free', cfg, spec: freeSpec(cfg, portrait), seed: 'free:' + Math.random().toString(36).slice(2), title: () => freeTitle(cfg)[0], sub: () => freeTitle(cfg)[1], lives: cfg.lives, back: '#/free' });
}
function launch(ctx) {
  pending = ctx;
  if (location.hash === '#/game') route(); else location.hash = '#/game';
}

// What a plain tap does when a game opens: the player's last choice, and before
// they have made one, Leaf on touch screens (the careful default) and Turn with a mouse.
const coarse = () => matchMedia('(pointer: coarse)').matches;
// "Back to Leaf after a turn": on unless switched off on touch screens, off unless switched on with a mouse.
const snapsBack = () => S().settings.snapLeaf ?? coarse();
const startMode = () => (snapsBack() ? 'leaf' : S().settings.mode || (coarse() ? 'leaf' : 'turn'));
function setMode(mode) {
  ses.mode = mode;
  document.querySelectorAll('.mode button').forEach((b) => b.classList.toggle('on', b.dataset.v === mode));
}

function gameScreen() {
  const ctx = pending;
  if (!ctx) { location.replace('#/'); return; }
  const r = ctx.spec.rules || {}, colors = r.color || 'none';
  const legend = colors === 'counts' ? `<div class="legend" id="legend"></div>`
    : colors === 'split' ? `<div class="legend"><span class="lg k0"><i></i>${t('legend.sun')}</span><span class="lg k1"><i></i>${t('legend.shade')}</span></div>`
    : colors === 'twins' ? `<div class="legend"><span class="lg tw"><i></i>${t('legend.twins')}</span></div>` : '';
  app.innerHTML = `<main class="game">
    <header class="bar">
      <a class="iconbtn" href="${ctx.back}" data-back aria-label="${t('back')}">${I.back}</a>
      <div class="title"><b>${esc(ctx.title())}</b><span>${esc(ctx.sub() || '')}</span></div>
      <div class="stat hearts" id="hearts"></div>
      <div class="stat" id="left" title="${t('game.left')}">${I.mouse}<b></b></div>
      <div class="stat time" id="time">0:00</div>
    </header>
    ${legend}
    <div class="stage">
      ${SPRIGS_GAME}
      <div class="boardwrap" id="wrap" tabindex="0" aria-label="${t('game.board')}"></div>
      <div class="hintbar" id="hintbar" role="status" aria-live="polite" hidden><p></p><button class="iconbtn small" data-act="hint-close" aria-label="${t('game.closeHint')}">×</button></div>
    </div>
    <footer class="tools">
      <button class="tool" data-act="hint" aria-label="${t('game.hint')}">${I.hint}<span>${t('game.hint')}</span></button>
      <div class="mode" role="group" aria-label="${t('game.tapDoes')}">
        <button class="${startMode() === 'turn' ? 'on' : ''}" data-act="mode" data-v="turn" aria-label="${t('game.turn')}">${I.turn}<span>${t('game.turn')}</span></button>
        <button class="${startMode() === 'leaf' ? 'on' : ''}" data-act="mode" data-v="leaf" aria-label="${t('game.leaf')}">${I.leaf}<span>${t('game.leaf')}</span></button>
      </div>
      <button class="tool" data-act="fit" aria-label="${t('game.fit')}">${I.fit}<span>${t('game.fit')}</span></button>
      <button class="tool" data-act="again" aria-label="${t('game.restart')}">${I.again}<span>${t('game.restart')}</span></button>
    </footer>
  </main>`;
  // Journey and daily boards are reshaped when they would not fit the screen (a phone, say);
  // free play keeps the size the player picked.
  const spec = ctx.kind === 'free' ? ctx.spec : fitSpec(ctx.spec, room($('#wrap')));
  // Puzzles with clues that are visible from the start are opened for you;
  // plain ones wait for your first click and build themselves around it.
  const preopen = ctx.kind !== 'free' || r.lines || r.color;
  const p = preopen ? generate(spec, ctx.seed) : layoutPuzzle(spec, ctx.seed);
  const game = new Game(p, { lives: ctx.lives });
  if (preopen) game.openStart();
  closeSession();
  ses = { ctx, spec, game, mode: startMode(), guided: !!ctx.spec.guided, view: null, timer: 0, lives: null, guidedTimer: 0, toastTimer: 0 };
  ses.view = new BoardView($('#wrap'), game, { onAct: act, intro: motionOn(), onPoke: () => play('squeak') });
  ses.timer = setInterval(tick, 250);
  hud();
  const scheduleGuided = () => {
    if (!ses || !ses.guided) return;
    const wait = ses.view.introMs || 0;
    if (wait) ses.guidedTimer = setTimeout(() => ses && !ses.game.over && showHint(true), wait);
    else showHint(true);
  };
  const unseen = rulesOf(ctx.spec).filter((id) => !S().seen[id]);
  if (unseen.length) {
    unseen.forEach((id) => (S().seen[id] = true));
    store.save();
    showRules(unseen, () => ses && ses.guided && showHint(true));
  } else if (ses.guided) scheduleGuided();
}

function closeSession() {
  if (!ses) return;
  clearInterval(ses.timer);
  clearTimeout(ses.toastTimer);
  clearTimeout(ses.guidedTimer);
  ses.view?.destroy();
  ses = null;
}

// The space for the board, in tiles of the smallest size the view settles for before it
// makes the player drag (see BoardView.fit).
function room(wrap) {
  const tile = coarse() ? 32 : 19.2;
  return wrap.clientWidth && wrap.clientHeight ? { cols: Math.floor(wrap.clientWidth / tile), rows: Math.floor(wrap.clientHeight / tile) } : null;
}
const motionOn = () => S().settings.motion && !matchMedia('(prefers-reduced-motion: reduce)').matches;

function tick() {
  if (!ses || !$('#time')) return;
  $('#time').textContent = fmt(ses.game.elapsed());
}

function hud() {
  const g = ses.game;
  // Hearts are drawn again only when one is lost, so a lost heart's crack & split can play out.
  if (ses.lives !== g.lives) {
    const lost = (i) => ses.lives != null && i >= g.lives && i < ses.lives;
    const bits = Array.from({ length: 6 }, (_, k) => `<i class="bit" style="--a:${k * 60 + 18}deg"></i>`).join('');
    $('#hearts').innerHTML = g.maxLives > 1 ? Array.from({ length: g.maxLives }, (_, i) => {
      if (i < g.lives) return `<span>${I.heart}</span>`;
      if (lost(i) && motionOn()) return `<span class="gone burst">${I.heartEmpty}<span class="split">${I.heartSplit}</span>${bits}</span>`;
      return `<span class="gone">${I.heartEmpty}</span>`;
    }).join('') : '';
    ses.lives = g.lives;
  }
  $('#left b').textContent = g.remaining();
  const lg = $('#legend');
  if (lg) lg.innerHTML = g.p.colorTotals.map((_, k) => `<span class="lg k${k} ${g.colorRemaining(k) === 0 ? 'zero' : ''}" data-color="${k}"><i></i><b>${g.colorRemaining(k)}</b></span>`).join('');
  tick();
}

function act(c, kind, viaKey = false) {
  let g = ses.game;
  if (g.over) return;
  const st = g.state[c];
  const dig = !g.p.mines ? kind === 'primary' : (kind === 'primary') === (ses.mode === 'turn');
  let r;
  if (kind === 'line') r = g.chordLine(c);
  else if (st === OPEN) {
    if (kind === 'secondary') { ses.view.highlight(g.p.reg[c], 1600); return; }
    r = g.chord(c);
  } else if (kind === 'chord') return;
  else if (dig) {
    if (st !== COVERED) return;
    if (!g.p.mines) g.p = generate(ses.spec, ses.ctx.seed, c);
    r = g.reveal(c);
    // Turn was a one-off: a tap that turned a tile hands the switch back to Leaf.
    if (!viaKey && kind === 'primary' && ses.mode === 'turn' && snapsBack() && r.changed.length) setMode('leaf');
  } else {
    if (!g.p.mines) return toast(t('toast.turnFirst'), c);
    r = g.toggleLeaf(c);
  }
  if (!r.changed.length) return;
  clearTimeout(ses.guidedTimer);
  ses.view.update(r.changed);
  hideHint();
  const opened = r.changed.filter((x) => g.state[x] === OPEN).length;
  if (r.hit.length) {
    play('wake');
    const w = $('#wrap');
    w.classList.remove('shake'); void w.offsetWidth; w.classList.add('shake');
    if (!r.lost) toast(t('toast.woke', g.lives), r.hit[0]);
  } else if (opened) play('turn', opened);
  else play(g.state[c] === LEAF ? 'leaf' : 'lift');
  hud();
  if (r.won) return win();
  if (r.lost) return lose();
  if (ses.guided) ses.guidedTimer = setTimeout(() => ses && !ses.game.over && showHint(true), 350);
}

// The bar floats over the board, so the board never moves when it comes and goes.
// It sits at the bottom unless that would cover the tiles it is about and the top would not.
function placeBar(bar, nodes) {
  const covers = () => {
    const b = bar.getBoundingClientRect();
    return nodes.some((n) => { const r = n.getBoundingClientRect(); return r.bottom > b.top && r.top < b.bottom && r.right > b.left && r.left < b.right; });
  };
  if (covers()) { bar.classList.add('top'); if (covers()) bar.classList.remove('top'); }
}
function toast(text, c) {
  const bar = $('#hintbar');
  bar.hidden = false;
  bar.className = 'hintbar toast';
  $('p', bar).textContent = text;
  if (c != null) placeBar(bar, [ses.view.nodes[c].g]);
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
  if (!g.p.mines) return toast(t('toast.begin'));
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
  // With the switch on Leaf, a plain tap would not do what a "safe to turn" hint asks for.
  const how = h.kind === 'safe' && ses.mode === 'leaf' ? (coarse() ? t('hint.howTouch') : t('hint.howMouse')) : '';
  $('p', bar).textContent = t(`hint.${h.msg}`, h.mine) + how;
  placeBar(bar, ses.view.hinted.map(([node]) => node));
}

// A record has to show on the clock: at least a whole second quicker.
const faster = (t, old) => Math.floor(t) < Math.floor(old);

function win() {
  const { ctx, game } = ses;
  clearInterval(ses.timer);
  tick();
  play('win');
  const time = game.elapsed();
  const st = game.mistakes ? 1 : game.hints ? 2 : 3;
  let note = '', beaten = null; // beaten: the old best time, when this win was faster
  if (ctx.kind === 'journey') {
    const old = S().journey[ctx.level.id];
    if (old && faster(time, old.best)) beaten = old.best;
    S().journey[ctx.level.id] = { stars: Math.max(st, old?.stars || 0), best: Math.min(time, old?.best || Infinity) };
  } else if (ctx.kind === 'daily') {
    const old = S().daily[ctx.key];
    if (old && faster(time, old.time)) beaten = old.time;
    S().daily[ctx.key] = { stars: Math.max(st, old?.stars || 0), time: Math.min(time, old?.time || Infinity) };
  } else {
    const k = cfgKey(ctx.cfg), old = S().best[k];
    const had = scoresFor(k).length, rank = addScore(k, time, st);
    if (!old || time < old) S().best[k] = time;
    if (had && rank === 1 && faster(time, old)) beaten = old;
    note = rank > 1 ? t('win.rank', rank) : '';
  }
  store.save();
  confetti();
  if (beaten != null) setTimeout(() => { if (ses && ses.game === game) { play('record'); confetti(); } }, 900);
  const next = ctx.kind === 'journey' ? LEVELS[ctx.level.number] : null;
  const nextOpen = next && isUnlocked(next, S().journey);
  const why = st === 3 ? t('win.three') : st === 2 ? t('win.two') : t('win.one');
  setTimeout(() => {
    if (!ses || ses.game !== game) return;
    openDialog(`<div class="sheet result"><button class="big" data-act="poke" aria-label="${t('home.poke')}">${I.winMouse}</button><h2>${t('win.title')}</h2>${stars(st)}
      ${beaten != null ? `<p class="record"><b>${t('win.record')}</b><span>${t('win.beats', fmt(time), fmt(beaten))}</span></p>` : ''}
      <p>${fmt(time)} · ${why}</p>${note ? `<p class="muted">${note}</p>` : ''}
      ${nextOpen && next.index === 0 ? `<p class="muted">${esc(t('win.nextUp', chTitle(CHAPTERS[next.chapter])))}</p>` : ''}
      <div class="row">
        <button class="btn ghost" data-act="back">${ctx.kind === 'journey' ? t('win.toJourney') : ctx.kind === 'free' ? t('win.change') : ctx.back === '#/records' ? t('home.records') : t('win.home')}</button>
        ${ctx.kind === 'free' ? `<button class="btn primary" autofocus data-act="new">${t('win.another')}</button>` : nextOpen ? `<button class="btn" data-act="again">${t('win.again')}</button><button class="btn primary" autofocus data-act="next">${t('win.next')}</button>` : `<button class="btn primary" autofocus data-act="again">${t('win.again')}</button>`}
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
    openDialog(`<div class="sheet result"><button class="big awake" data-act="poke" aria-label="${t('home.poke')}">${I.awake}</button><h2>${t('lose.title')}</h2>
      <p>${t('lose.text')}</p>
      <div class="row"><button class="btn ghost" data-act="look">${t('lose.look')}</button>
      <button class="btn primary" autofocus data-act="${ctx.kind === 'free' ? 'new' : 'again'}">${t('lose.again')}</button></div></div>`, resultAct);
  }, 1100);
}

function resultAct(a) {
  const ctx = ses.ctx;
  if (a === 'back') location.hash = ctx.back;
  else if (a === 'next') startJourney(LEVELS[ctx.level.number].id);
  else if (a === 'new') startFree();
  else if (a === 'again') launch(ctx);
}

// A dormouse that is tapped wriggles (and squeaks) instead of doing nothing.
function poke(el) {
  play('squeak');
  if (!motionOn()) return;
  el.classList.remove('poked');
  void el.getBoundingClientRect();
  el.classList.add('poked');
  clearTimeout(el.pokeTimer);
  el.pokeTimer = setTimeout(() => el.classList.remove('poked'), 1200);
}

function confetti() {
  if (!motionOn()) return;
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
  // A dialog button may already be gone (the dialog redraws itself) by the time the click gets here.
  if (dlg.contains(e.target) || !e.target.isConnected) return;
  const t = e.target.closest('[data-act],[data-level],[data-k],[data-classic],[data-day]');
  if (!t) return;
  const cfg = S().free;
  if (t.dataset.level) return startJourney(t.dataset.level);
  if (t.dataset.day) return launch(dailyCtx(t.dataset.day, '#/records'));
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
    case 'poke': return poke(t);
    case 'how': return showRules(Object.keys(RULES));
    case 'about': return aboutDialog();
    case 'settings': return settingsDialog();
    case 'play': return startFree();
    case 'hint': return showHint(false);
    case 'hint-close': return hideHint();
    case 'fit': ses.view.scale = ses.view.fitScale; ses.view.apply(); ses.view.auto = ses.view.fitScale >= 24; return;
    case 'again': return launch(ses.ctx.kind === 'free' ? { ...ses.ctx, seed: 'free:' + Math.random().toString(36).slice(2) } : ses.ctx);
    case 'mode':
      S().settings.mode = t.dataset.v;
      store.save();
      setMode(t.dataset.v);
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
  if (!turn && ses.game.state[c] === OPEN) return;
  const mode = ses.mode;
  ses.mode = 'turn'; // keys have fixed meanings, whatever the switch says
  act(c, turn ? 'primary' : 'secondary', true);
  if (ses) ses.mode = mode;
}

// Draws the current screen again in place, e.g. after the language changed. The game screen is
// left alone: Settings is only reachable from the home screen, and redrawing would restart the game.
function redraw() {
  const h = location.hash || '#/';
  if (h === '#/journey') journeyScreen();
  else if (h === '#/free') freeScreen();
  else if (h === '#/records') recordsScreen();
  else if (h !== '#/game') home();
}

function route() {
  if (dlg.open) dlg.close();
  const h = location.hash || '#/';
  if (h !== '#/game' && ses) closeSession();
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
