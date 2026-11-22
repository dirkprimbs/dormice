// Draws a game as SVG and turns pointer, wheel and touch gestures into
// actions. Knows nothing about screens or progress.
import { COVERED, OPEN, LEAF, WOKEN } from './game.js';

const NS = 'http://www.w3.org/2000/svg';
const U = 100; // SVG units per board unit
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};

export const MOUSE_ICON =
  '<g class="mouse">' +
  '<path class="tail" d="M20 18c9 3 14-5 9-11"/>' +
  '<circle class="fur out" cx="-17" cy="-18" r="10"/><circle class="fur out" cx="17" cy="-18" r="10"/>' +
  '<circle class="ear" cx="-17" cy="-18" r="5.5"/><circle class="ear" cx="17" cy="-18" r="5.5"/>' +
  '<ellipse class="fur out" cx="0" cy="3" rx="25" ry="23"/>' +
  '<ellipse class="belly" cx="0" cy="11" rx="14" ry="10"/>' +
  '<ellipse class="blush" cx="-15" cy="7" rx="4.5" ry="2.6"/><ellipse class="blush" cx="15" cy="7" rx="4.5" ry="2.6"/>' +
  '<path class="eye" d="M-14 0q4.5 5 9 0M5 0q4.5 5 9 0"/>' +
  '<ellipse class="nose" cx="0" cy="7" rx="3.4" ry="2.4"/>' +
  '<path class="whisker" d="M-16 6l-10-2M-16 10l-10 2M16 6l10-2M16 10l10 2"/>' +
  '</g>';

export const MOUSE_AWAKE =
  '<g class="mouse startled">' +
  '<g class="sparks">' +
  '<path class="spark" d="M-29-16l-6-8M-31-4l-7-1M29-16l6-8M31-4l7-1"/>' +
  '<circle class="sparkdot" cx="-36" cy="-27" r="2.2"/><circle class="sparkdot" cx="36" cy="-27" r="2.2"/>' +
  '</g>' +
  '<circle class="fur out" cx="-20" cy="-20" r="10.5"/><circle class="fur out" cx="20" cy="-20" r="10.5"/>' +
  '<circle class="ear" cx="-20" cy="-20" r="5.8"/><circle class="ear" cx="20" cy="-20" r="5.8"/>' +
  '<ellipse class="fur out" cx="0" cy="4" rx="24" ry="22"/>' +
  '<ellipse class="belly" cx="0" cy="12" rx="13" ry="10"/>' +
  '<ellipse class="blush" cx="-15" cy="8" rx="4.2" ry="2.4"/><ellipse class="blush" cx="15" cy="8" rx="4.2" ry="2.4"/>' +
  '<circle class="pupil" cx="-9.5" cy="0" r="5.2"/><circle class="pupil" cx="9.5" cy="0" r="5.2"/>' +
  '<circle class="shine" cx="-11" cy="-1.8" r="1.8"/><circle class="shine" cx="8" cy="-1.8" r="1.8"/>' +
  '<path class="brow" d="M-16-8.5L-5-12M16-8.5L5-12"/>' +
  '<ellipse class="nose" cx="0" cy="7.5" rx="3.2" ry="2.2"/>' +
  '<path class="sadmouth" d="M-5 15.5Q0 11.2 5 15.5"/>' +
  '<path class="whisker" d="M-16 6l-9-2M-16 10l-9 2M16 6l9-2M16 10l9 2"/>' +
  '<ellipse class="paw out" cx="-22" cy="13" rx="5.5" ry="4.2" transform="rotate(-24 -22 13)"/>' +
  '<ellipse class="paw out" cx="22" cy="13" rx="5.5" ry="4.2" transform="rotate(24 22 13)"/>' +
  '</g>';

export const MOUSE_WIN =
  '<g class="mouse happy">' +
  '<circle class="fur out" cx="-16" cy="-20" r="9.5"/><circle class="fur out" cx="16" cy="-20" r="9.5"/>' +
  '<circle class="ear" cx="-16" cy="-20" r="5.2"/><circle class="ear" cx="16" cy="-20" r="5.2"/>' +
  '<ellipse class="fur out" cx="0" cy="-2" rx="22" ry="20"/>' +
  '<ellipse class="belly" cx="0" cy="5" rx="13" ry="8"/>' +
  '<ellipse class="blush" cx="-13" cy="2" rx="4.2" ry="2.4"/><ellipse class="blush" cx="13" cy="2" rx="4.2" ry="2.4"/>' +
  '<path class="eye" d="M-13-4q4-5.5 8 0M5-4q4-5.5 8 0"/>' +
  '<ellipse class="nose" cx="0" cy="2" rx="3" ry="2"/>' +
  '<path class="smile" d="M-4 6.5q4 3.5 8 0"/>' +
  '<path class="blanket out" d="M-31 18C-24 4 24 4 31 18C18 30-18 30-31 18Z"/>' +
  '<path class="blanket-rib" d="M-24 18C-8 13 10 13 26 18"/>' +
  '<ellipse class="paw out" cx="-12" cy="9" rx="5" ry="3.5"/><ellipse class="paw out" cx="12" cy="9" rx="5" ry="3.5"/>' +
  '</g>';

export const LEAF_ICON =
  '<g class="leafmark">' +
  '<path class="blade out" d="M0-32C6-32 9-25 7-20C14-23 22-17 18-10C16-7 13-6 12-5C21-5 24 4 17 10C14 12 10 12 9 13C15 17 13 24 5 24C2 24 1 22 0 21C-1 22-2 24-5 24C-13 24-15 17-9 13C-10 12-14 12-17 10C-24 4-21-5-12-5C-13-6-16-7-18-10C-22-17-14-23-7-20C-9-25-6-32 0-32Z"/>' +
  '<path class="rib" d="M0-25V31"/>' +
  '<path class="vein" d="M0-14l10-5M0-14l-10-5M0-2l12-4M0-2l-12-4M0 10l9-3M0 10l-9-3"/>' +
  '</g>';

const LEAF_PUFFS =
  '<g class="puffs"><circle cx="-24" cy="14" r="3"/><circle cx="24" cy="12" r="2.6"/><circle cx="-18" cy="-18" r="2.4"/><circle cx="20" cy="-16" r="2.8"/></g>';
const TWIN_DOTS = '<g class="twindots"><circle cx="-7" cy="-27" r="4.2"/><circle cx="7" cy="-27" r="4.2"/></g>';
const MARKS = [
  '<circle r="5"/>', '<path d="M0-6L6 0L0 6L-6 0Z"/>', '<path d="M0-6L6 5H-6Z"/>',
  '<rect x="-5" y="-5" width="10" height="10"/>', '<path d="M-6-2h4v-4h4v4h4v4h-4v4h-4v-4h-4z"/>',
];

export class BoardView {
  constructor(wrap, game, { onAct, onPoke, intro = false }) {
    this.wrap = wrap;
    this.game = game;
    this.onAct = onAct;
    this.onPoke = onPoke;
    this.scale = 0;
    this.baseScale = 0;
    this.W = this.H = 0;
    this.tx = this.ty = 0;
    this.hl = [];
    this.hinted = [];
    this.cursor = -1;
    this.introMs = 0;
    this.raf1 = this.raf2 = 0;
    this.build();
    if (intro) this.flyIn();
    this.bind();
    this.fit(true);
    this.ro = new ResizeObserver(() => this.fit(false));
    this.ro.observe(wrap);
  }

  destroy() {
    this.ro?.disconnect();
    cancelAnimationFrame(this.raf1);
    cancelAnimationFrame(this.raf2);
    clearTimeout(this.introTimer);
    clearTimeout(this.hlTimer);
    clearTimeout(this.popTimer);
  }

  build() {
    const p = this.game.p, b = p.board;
    let x0 = b.minX, y0 = b.minY, x1 = b.maxX, y1 = b.maxY;
    for (const l of p.lines) {
      x0 = Math.min(x0, l.pos[0] - 0.4); x1 = Math.max(x1, l.pos[0] + 0.4);
      y0 = Math.min(y0, l.pos[1] - 0.4); y1 = Math.max(y1, l.pos[1] + 0.4);
    }
    const pad = 0.3;
    this.vb = { x: (x0 - pad) * U, y: (y0 - pad) * U, w: (x1 - x0 + 2 * pad) * U, h: (y1 - y0 + 2 * pad) * U };
    const svg = (this.svg = el('svg', { class: 'board grid-' + b.grid, viewBox: `${this.vb.x} ${this.vb.y} ${this.vb.w} ${this.vb.h}` }));
    // Rustic wooden garden-bed timber frame around the plot (stays inside the existing 0.3U margin).
    const frame = el('g', { class: 'garden-frame' }, svg);
    const fx0 = b.minX * U, fy0 = b.minY * U, fx1 = b.maxX * U, fy1 = b.maxY * U;
    const fw = fx1 - fx0, fh = fy1 - fy0, bt = 20, g = 4, ov = 6;
    if (b.grid === 'square' && (!p.spec.shape || p.spec.shape === 'rect'))
      el('rect', { class: 'bed-soil', x: fx0 - g, y: fy0 - g, width: fw + 2 * g, height: fh + 2 * g, rx: 6 }, frame);
    const beam = (x, y, w, h, horiz) => {
      el('rect', { class: 'wood', x, y, width: w, height: h, rx: 4 }, frame);
      if (horiz) {
        el('path', { class: 'wood-grain', d: `M${x + 12} ${y + h * 0.35}H${x + w - 12}M${x + 26} ${y + h * 0.7}H${x + w - 20}` }, frame);
      } else {
        el('path', { class: 'wood-grain', d: `M${x + w * 0.35} ${y + 12}V${y + h - 12}M${x + w * 0.7} ${y + 26}V${y + h - 20}` }, frame);
      }
    };
    // Left & right posts, then top & bottom beams overlapping at the corners.
    beam(fx0 - g - bt, fy0 - g - bt - ov, bt, fh + 2 * (g + bt + ov), false);
    beam(fx1 + g, fy0 - g - bt - ov, bt, fh + 2 * (g + bt + ov), false);
    beam(fx0 - g - bt - ov, fy0 - g - bt, fw + 2 * (g + bt + ov), bt, true);
    beam(fx0 - g - bt - ov, fy1 + g, fw + 2 * (g + bt + ov), bt, true);
    for (const [px, py] of [[fx0 - g - bt / 2, fy0 - g - bt / 2], [fx1 + g + bt / 2, fy0 - g - bt / 2], [fx0 - g - bt / 2, fy1 + g + bt / 2], [fx1 + g + bt / 2, fy1 + g + bt / 2]])
      el('circle', { class: 'wood-peg', cx: px, cy: py, r: 3.6 }, frame);
    // Opened ground is drawn full-size in its own layer, so it joins into one surface under the raised tiles.
    const floors = el('g', { class: 'floors' }, svg);
    const layer = el('g', { class: 'cells' }, svg);
    this.nodes = b.cells.map((cell) => {
      // Shrink each polygon by a fixed margin; a round stroke then rounds its corners.
      let inr = Infinity;
      const n = cell.pts.length;
      for (let i = 0; i < n; i++) {
        const [ax, ay] = cell.pts[i], [bx, by] = cell.pts[(i + 1) % n];
        const d = Math.abs((bx - ax) * (ay - cell.y) - (ax - cell.x) * (by - ay)) / Math.hypot(bx - ax, by - ay);
        inr = Math.min(inr, d);
      }
      const shrink = (m) => {
        const f = (inr - m) / inr;
        return cell.pts.map(([x, y]) => `${((cell.x + (x - cell.x) * f) * U).toFixed(1)},${((cell.y + (y - cell.y) * f) * U).toFixed(1)}`).join(' ');
      };
      const pts = shrink(0.13);
      const floor = el('polygon', { class: 'floor', points: shrink(0) }, floors);
      const g = el('g', { class: 'cell', 'data-id': cell.id }, layer);
      el('polygon', { class: 'base', points: pts }, g);
      el('polygon', { class: 'top', points: pts }, g);
      el('polygon', { class: 'edge', points: shrink(0.07) }, g); // outline for highlights
      const ct = el('g', { class: 'ct', transform: `translate(${(cell.x * U).toFixed(1)} ${(cell.y * U).toFixed(1)})` }, g);
      return { g, ct, floor, html: '' };
    });
    const labels = el('g', { class: 'labels' }, svg);
    this.labels = p.lines.map((line, i) => {
      const g = el('g', { class: 'lbl', 'data-line': i, transform: `translate(${line.pos[0] * U} ${line.pos[1] * U})` }, labels);
      el('circle', { r: 30 }, g);
      el('text', { dy: '.35em' }, g).textContent = line.sum;
      return g;
    });
    this.wrap.replaceChildren(svg);
    for (let c = 0; c < p.n; c++) this.refresh(c);
    this.refreshLabels();
  }

  // A new board's tiles fly in from beyond its edges, the middle ones first.
  // Explicit SVG transform-origin avoids per-frame fill-box BBox recalculation, and pausing
  // until after the first paint keeps the opening frames from being dropped on slower phones.
  flyIn() {
    const b = this.game.p.board, cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    const far = Math.hypot(b.maxX - cx, b.maxY - cy) || 1;
    const span = Math.min(460, 140 + b.cells.length * 1.2); // big boards take a little longer, not forever
    this.introMs = span + 500;
    this.svg.classList.add('entering');
    b.cells.forEach((cell, i) => {
      const dx = cell.x - cx, dy = cell.y - cy, d = Math.hypot(dx, dy) / far;
      const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.9, dist = (1.1 + Math.random() * 1.1) * U;
      const { g, floor } = this.nodes[i];
      const delay = Math.round(d * span + Math.random() * 70) + 'ms';
      const ox = (cell.x * U).toFixed(1), oy = (cell.y * U).toFixed(1);
      g.style.cssText = `--dx:${(Math.cos(ang) * dist).toFixed(0)}px;--dy:${(Math.sin(ang) * dist - U * 0.7).toFixed(0)}px;--rot:${((Math.random() - 0.5) * 110).toFixed(0)}deg;transform-origin:${ox}px ${oy}px;animation-delay:${delay}`;
      g.classList.add('enter');
      if (floor.classList.contains('on')) {
        floor.style.animationDelay = delay;
        floor.classList.add('enter');
      }
    });
    this.labels.forEach((l) => l.classList.add('enter'));
    clearTimeout(this.introTimer);
    this.raf1 = requestAnimationFrame(() => {
      this.raf2 = requestAnimationFrame(() => {
        this.svg.classList.remove('entering');
        this.introTimer = setTimeout(() => {
          // Tidy up, without touching a tile that has already been played (its class was rewritten).
          this.nodes.forEach(({ g, floor }) => {
            if (g.classList.contains('enter')) { g.classList.remove('enter'); g.style.cssText = ''; }
            if (floor.classList.contains('enter')) { floor.classList.remove('enter'); floor.style.animationDelay = ''; }
          });
          this.labels.forEach((l) => l.classList.remove('enter'));
        }, span + 650);
      });
    });
  }

  // A tapped dormouse wriggles.
  poke(c) {
    const ct = this.nodes[c].ct;
    ct.classList.remove('poked');
    void ct.getBoundingClientRect();
    ct.classList.add('poked');
    if (this.onPoke) this.onPoke(c);
  }

  clueMarkup(c) {
    const p = this.game.p, vals = p.clues[c], owl = p.owl[c];
    const ring = owl ? '<circle class="ring" r="34"/>' : '';
    if (vals.length === 2) {
      if (!vals[0] && !vals[1] && !owl) return '';
      const one = (v, i, x) =>
        `<text class="n sp s${i}${v ? '' : ' zero'}" x="${x}" dy=".3em">${v}</text><g class="spm s${i}" transform="translate(${x} 25) scale(.75)">${MARKS[i]}</g>`;
      return ring + `<g transform="translate(0 -5)${owl ? ' scale(.82)' : ''}">` + one(vals[0], 0, -17) + one(vals[1], 1, 17) + '</g>';
    }
    const v = vals[0];
    if (!v && !owl) return '';
    return ring + `<text class="n n${Math.min(v, 9)}${v > 9 ? ' wide' : ''}${owl ? ' owl' : ''}" dy=".35em">${v}</text>`;
  }

  refresh(c) {
    const g = this.game, p = g.p, st = g.state[c], node = this.nodes[c];
    let cls = 'cell v' + ((c * 29) % 3), html = '';
    if (p.color[c] >= 0) cls += ' kc k' + p.color[c];
    const twin = p.w[c] === 2;
    if (twin) cls += ' twin';
    node.floor.setAttribute('class', 'floor' + cls.slice(4) + (st === OPEN ? ' on' : ''));
    if (st === OPEN) { cls += ' open'; html = this.clueMarkup(c); }
    else if (st === LEAF) {
      cls += ' leaf';
      const tilt = ((c * 37) % 25) - 12;
      html = LEAF_PUFFS + `<g transform="rotate(${tilt})">${LEAF_ICON}</g>`;
      if (g.status === 'lost' && !p.mines[c]) { cls += ' wrong'; html += '<path class="cross" d="M-20-20L20 20M20-20L-20 20"/>'; }
    } else if (st === WOKEN) { cls += ' woken'; html = MOUSE_AWAKE; }
    else if (g.status === 'lost' && p.mines && p.mines[c]) { cls += ' shown'; html = MOUSE_ICON; }
    // When a tile is covered with a leaf, the leaf is the only visible element on it.
    if (st !== OPEN && st !== LEAF) {
      if (twin) html += TWIN_DOTS;
      if (p.color[c] >= 0) html += `<g class="mark" transform="translate(0 30) scale(.8)">${MARKS[p.color[c]]}</g>`;
    }
    if (c === this.cursor) cls += ' cursor';
    node.g.setAttribute('class', cls);
    if (node.html !== html) { node.html = html; node.ct.innerHTML = html; }
  }

  update(changed) {
    const animate = changed.length <= 24;
    let maxDelay = 0;
    changed.forEach((c, i) => {
      this.refresh(c);
      const g = this.nodes[c].g;
      if (animate) {
        const d = Math.min(i * 9, 220);
        if (d > maxDelay) maxDelay = d;
        g.style.animationDelay = d + 'ms';
        g.classList.add('pop');
      } else {
        g.style.animationDelay = '';
      }
    });
    if (animate && changed.length) {
      const popped = changed.slice();
      clearTimeout(this.popTimer);
      this.popTimer = setTimeout(() => {
        for (const c of popped) this.nodes[c].g.classList.remove('pop');
      }, maxDelay + 320);
    }
    this.refreshLabels();
  }

  refreshAll() {
    for (let c = 0; c < this.game.p.n; c++) this.refresh(c);
    this.refreshLabels();
  }

  refreshLabels() {
    const g = this.game;
    g.p.lines.forEach((line, i) => {
      this.labels[i].classList.toggle('done', !line.cells.some((c) => g.state[c] === COVERED));
    });
  }

  // ---- highlights ----
  highlight(cells, ms = 0) {
    for (const c of this.hl) this.nodes[c].g.classList.remove('hl');
    this.hl = cells;
    for (const c of cells) this.nodes[c].g.classList.add('hl');
    clearTimeout(this.hlTimer);
    if (ms) this.hlTimer = setTimeout(() => this.highlight([]), ms);
  }

  hover(c) {
    if (c === this.hovered) return;
    this.hovered = c;
    this.highlight(c != null && this.game.state[c] === OPEN && this.game.p.clues ? this.game.p.reg[c] : []);
  }

  clearHint() {
    for (const [node, cls] of this.hinted) node.classList.remove(cls);
    this.hinted = [];
  }

  showHint(h) {
    this.clearHint();
    const add = (node, cls) => { node.classList.add(cls); this.hinted.push([node, cls]); };
    for (const c of h.cells) add(this.nodes[c].g, h.kind === 'mine' ? 'hint-mine' : h.kind === 'wrong' ? 'hint-wrong' : 'hint-safe');
    for (const s of h.srcs) {
      if (s.t === 'cell') add(this.nodes[s.c].g, 'hint-src');
      else if (s.t === 'line') add(this.labels[s.i], 'hint-src');
    }
    this.reveal(h.cells[0]);
  }

  setCursor(c) {
    const old = this.cursor;
    this.cursor = c;
    if (old >= 0) this.nodes[old].g.classList.remove('cursor');
    if (c >= 0) { this.nodes[c].g.classList.add('cursor'); this.reveal(c); }
  }

  // ---- view: fit, zoom, pan ----
  fit(reset) {
    const W = (this.W = this.wrap.clientWidth), H = (this.H = this.wrap.clientHeight);
    if (!W || !H) return;
    const perUnit = Math.min(W / this.vb.w, H / this.vb.h) * U; // px per tile when the whole board fits
    this.fitScale = Math.min(perUnit, 76);
    // Boards too large for the screen open at a comfortable tile size and can be dragged.
    // If that leaves only a sliver off-screen in one direction, shrink a little so that
    // direction fits: dragging a board by half a tile is just wobble.
    const comfy = matchMedia('(pointer: coarse)').matches ? 40 : 24;
    let auto = Math.max(this.fitScale, comfy);
    for (const axis of [(W / this.vb.w) * U, (H / this.vb.h) * U])
      if (axis < auto && axis >= comfy * 0.8) auto = axis;
    if (reset || !this.scale) {
      this.auto = true; // follow the available space until the player zooms
      this.scale = auto;
      const s = this.game.p.board.cells[this.game.p.start];
      this.tx = W / 2 - (s.x * U - this.vb.x) * (this.scale / U);
      this.ty = H / 2 - (s.y * U - this.vb.y) * (this.scale / U);
    } else if (this.auto && auto !== this.scale) {
      const k = auto / this.scale;
      this.tx = W / 2 - (W / 2 - this.tx) * k;
      this.ty = H / 2 - (H / 2 - this.ty) * k;
      this.scale = auto;
    }
    this.apply();
  }

  apply(live = false) {
    const W = this.W || this.wrap.clientWidth, H = this.H || this.wrap.clientHeight;
    const w = (this.vb.w * this.scale) / U, h = (this.vb.h * this.scale) / U;
    this.tx = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, this.tx));
    this.ty = h <= H ? (H - h) / 2 : Math.min(0, Math.max(H - h, this.ty));
    const pannable = w > W + 1 || h > H + 1;
    if (pannable !== this.pannable) {
      this.pannable = pannable;
      this.wrap.classList.toggle('pannable', pannable);
    }
    if (live && this.baseScale) {
      const ratio = this.scale / this.baseScale;
      this.svg.style.transform = ratio === 1
        ? `translate3d(${this.tx}px, ${this.ty}px, 0)`
        : `translate3d(${this.tx}px, ${this.ty}px, 0) scale(${ratio})`;
      return;
    }
    if (this.scale !== this.baseScale) {
      this.baseScale = this.scale;
      this.svg.style.width = w + 'px';
      this.svg.style.height = h + 'px';
    }
    this.svg.style.transform = `translate3d(${this.tx}px, ${this.ty}px, 0)`;
  }

  zoomAt(px, py, scale, live = false) {
    scale = Math.max(Math.min(this.fitScale, 24), Math.min(96, scale));
    this.auto = false;
    const k = scale / this.scale;
    this.tx = px - (px - this.tx) * k;
    this.ty = py - (py - this.ty) * k;
    this.scale = scale;
    this.apply(live);
  }

  // Scroll just enough to bring a tile into view.
  reveal(c) {
    if (!this.pannable || c == null) return;
    const cell = this.game.p.board.cells[c], k = this.scale / U;
    const x = (cell.x * U - this.vb.x) * k + this.tx, y = (cell.y * U - this.vb.y) * k + this.ty;
    const m = this.scale * 1.2, W = this.W || this.wrap.clientWidth, H = this.H || this.wrap.clientHeight;
    if (x < m) this.tx += m - x; else if (x > W - m) this.tx -= x - (W - m);
    if (y < m) this.ty += m - y; else if (y > H - m) this.ty -= y - (H - m);
    this.apply();
  }

  bind() {
    const wrap = this.wrap, ptrs = new Map();
    let press = null, pinch = null, timer = 0;
    const cellOf = (t) => { const g = t.closest && t.closest('.cell'); return g ? +g.dataset.id : null; };
    const local = (e) => { const r = wrap.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const spread = () => { const [a, b] = [...ptrs.values()]; return [Math.hypot(a[0] - b[0], a[1] - b[1]), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };

    this.onDown = (e) => {
      const lbl = e.target.closest && e.target.closest('.lbl');
      if (lbl) { this.highlight(this.game.p.lines[+lbl.dataset.line].cells, 1800); if (e.button === 0) this.onAct(+lbl.dataset.line, 'line'); return; }
      if (e.button === 1) e.preventDefault();
      ptrs.set(e.pointerId, local(e));
      clearTimeout(timer);
      if (ptrs.size === 1) {
        const cell = cellOf(e.target);
        press = { id: e.pointerId, cell, at: local(e), last: local(e), button: e.button, moved: false, long: false };
        if (e.pointerType !== 'mouse' && cell != null)
          timer = setTimeout(() => {
            press.long = true;
            if (navigator.vibrate) navigator.vibrate(12);
            this.onAct(cell, 'secondary');
          }, 360);
      } else if (ptrs.size === 2) {
        press = null;
        const [d, mx, my] = spread();
        pinch = { d, scale: this.scale, mx, my };
      }
    };
    this.onMove = (e) => {
      if (!ptrs.has(e.pointerId)) {
        if (e.pointerType === 'mouse') {
          const lbl = e.target.closest && e.target.closest('.lbl');
          if (lbl) { this.hovered = null; this.highlight(this.game.p.lines[+lbl.dataset.line].cells); }
          else this.hover(cellOf(e.target));
        }
        return;
      }
      const pos = local(e);
      ptrs.set(e.pointerId, pos);
      if (pinch && ptrs.size === 2) {
        const [d, mx, my] = spread();
        this.tx += mx - pinch.mx; this.ty += my - pinch.my;
        pinch.mx = mx; pinch.my = my;
        this.zoomAt(mx, my, (pinch.scale * d) / pinch.d, true);
      } else if (press && press.id === e.pointerId && !press.long) {
        if (!press.moved && Math.hypot(pos[0] - press.at[0], pos[1] - press.at[1]) > 9) {
          press.moved = true;
          clearTimeout(timer);
          try { wrap.setPointerCapture(e.pointerId); } catch { /* fine */ }
        }
        if (press.moved && this.pannable) {
          this.tx += pos[0] - press.last[0]; this.ty += pos[1] - press.last[1];
          this.apply(true);
        }
        press.last = pos;
      }
    };
    this.onUp = (e) => {
      if (!ptrs.delete(e.pointerId)) return;
      clearTimeout(timer);
      if (press && press.id === e.pointerId && e.type === 'pointerup' && !press.moved && !press.long && press.cell != null) {
        const cl = this.nodes[press.cell].g.classList;
        if (press.button === 0 && (cl.contains('woken') || cl.contains('shown'))) this.poke(press.cell);
        this.onAct(press.cell, press.button === 2 ? 'secondary' : press.button === 1 ? 'chord' : 'primary');
      }
      press = null;
      if (ptrs.size < 2 && pinch) { pinch = null; this.apply(false); }
    };
    wrap.addEventListener('pointerdown', this.onDown);
    wrap.addEventListener('pointermove', this.onMove);
    wrap.addEventListener('pointerup', this.onUp);
    wrap.addEventListener('pointercancel', this.onUp);
    wrap.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.hover(null); });
    wrap.addEventListener('contextmenu', (e) => e.preventDefault());
    wrap.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [x, y] = local(e);
      this.zoomAt(x, y, this.scale * Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
  }
}
