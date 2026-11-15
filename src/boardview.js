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
  '<g class="mouse"><circle class="fur" cx="-17" cy="-19" r="10"/><circle class="fur" cx="17" cy="-19" r="10"/>' +
  '<circle class="ear" cx="-17" cy="-19" r="5"/><circle class="ear" cx="17" cy="-19" r="5"/>' +
  '<circle class="fur" r="25" cy="2"/><path class="eye" d="M-14 0q5 5 10 0M4 0q5 5 10 0"/><ellipse class="nose" cy="10" rx="3.5" ry="2.6"/></g>';
export const MOUSE_AWAKE = MOUSE_ICON.replace(/<path class="eye"[^>]*\/>/, '<circle class="pupil" cx="-9" cy="0" r="3.6"/><circle class="pupil" cx="9" cy="0" r="3.6"/>');
export const LEAF_ICON =
  '<g class="leafmark" transform="rotate(32)"><path class="blade" d="M0-31C24-20 27 9 0 31C-27 9-24-20 0-31Z"/><path class="rib" d="M0-20V31"/></g>';
const TWIN_DOTS = '<g class="twindots"><circle cx="-7" cy="-27" r="4.2"/><circle cx="7" cy="-27" r="4.2"/></g>';
const MARKS = [
  '<circle r="5"/>', '<path d="M0-6L6 0L0 6L-6 0Z"/>', '<path d="M0-6L6 5H-6Z"/>',
  '<rect x="-5" y="-5" width="10" height="10"/>', '<path d="M-6-2h4v-4h4v4h4v4h-4v4h-4v-4h-4z"/>',
];

export class BoardView {
  constructor(wrap, game, { onAct }) {
    this.wrap = wrap;
    this.game = game;
    this.onAct = onAct;
    this.scale = 0;
    this.tx = this.ty = 0;
    this.hl = [];
    this.hinted = [];
    this.cursor = -1;
    this.build();
    this.bind();
    this.fit(true);
    new ResizeObserver(() => this.fit(false)).observe(wrap);
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
      return { g, ct, floor };
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
    let cls = 'cell', html = '';
    if (p.color[c] >= 0) cls += ' kc k' + p.color[c];
    const twin = p.w[c] === 2;
    if (twin) cls += ' twin';
    node.floor.setAttribute('class', 'floor' + cls.slice(4) + (st === OPEN ? ' on' : ''));
    if (st === OPEN) { cls += ' open'; html = this.clueMarkup(c); }
    else if (st === LEAF) {
      cls += ' leaf';
      html = LEAF_ICON;
      if (g.status === 'lost' && !p.mines[c]) { cls += ' wrong'; html += '<path class="cross" d="M-20-20L20 20M20-20L-20 20"/>'; }
    } else if (st === WOKEN) { cls += ' woken'; html = MOUSE_AWAKE; }
    else if (g.status === 'lost' && p.mines && p.mines[c]) { cls += ' shown'; html = MOUSE_ICON; }
    if (st !== OPEN) {
      if (twin) html += TWIN_DOTS;
      if (p.color[c] >= 0) html += `<g class="mark" transform="translate(0 30) scale(.8)">${MARKS[p.color[c]]}</g>`;
    }
    if (c === this.cursor) cls += ' cursor';
    node.g.setAttribute('class', cls);
    node.ct.innerHTML = html;
  }

  update(changed) {
    changed.forEach((c, i) => {
      this.refresh(c);
      const g = this.nodes[c].g;
      g.style.animationDelay = Math.min(i * 9, 450) + 'ms';
      g.classList.add('pop');
    });
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
    const W = this.wrap.clientWidth, H = this.wrap.clientHeight;
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

  apply() {
    const W = this.wrap.clientWidth, H = this.wrap.clientHeight;
    const w = (this.vb.w * this.scale) / U, h = (this.vb.h * this.scale) / U;
    this.tx = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, this.tx));
    this.ty = h <= H ? (H - h) / 2 : Math.min(0, Math.max(H - h, this.ty));
    this.pannable = w > W + 1 || h > H + 1;
    this.svg.style.width = w + 'px';
    this.svg.style.height = h + 'px';
    this.svg.style.transform = `translate(${this.tx}px, ${this.ty}px)`;
    this.wrap.classList.toggle('pannable', this.pannable);
  }

  zoomAt(px, py, scale) {
    scale = Math.max(Math.min(this.fitScale, 24), Math.min(96, scale));
    this.auto = false;
    const k = scale / this.scale;
    this.tx = px - (px - this.tx) * k;
    this.ty = py - (py - this.ty) * k;
    this.scale = scale;
    this.apply();
  }

  // Scroll just enough to bring a tile into view.
  reveal(c) {
    if (!this.pannable || c == null) return;
    const cell = this.game.p.board.cells[c], k = this.scale / U;
    const x = (cell.x * U - this.vb.x) * k + this.tx, y = (cell.y * U - this.vb.y) * k + this.ty;
    const m = this.scale * 1.2, W = this.wrap.clientWidth, H = this.wrap.clientHeight;
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
        this.zoomAt(mx, my, (pinch.scale * d) / pinch.d);
      } else if (press && press.id === e.pointerId && !press.long) {
        if (!press.moved && Math.hypot(pos[0] - press.at[0], pos[1] - press.at[1]) > 9) {
          press.moved = true;
          clearTimeout(timer);
          try { wrap.setPointerCapture(e.pointerId); } catch { /* fine */ }
        }
        if (press.moved && this.pannable) {
          this.tx += pos[0] - press.last[0]; this.ty += pos[1] - press.last[1];
          this.apply();
        }
        press.last = pos;
      }
    };
    this.onUp = (e) => {
      if (!ptrs.delete(e.pointerId)) return;
      clearTimeout(timer);
      if (press && press.id === e.pointerId && e.type === 'pointerup' && !press.moved && !press.long && press.cell != null)
        this.onAct(press.cell, press.button === 2 ? 'secondary' : press.button === 1 ? 'chord' : 'primary');
      press = null;
      if (ptrs.size < 2) pinch = null;
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
