/* The window manager, System 7 style.

   A window is a plain element parked at the top left of the desk with its
   position carried on a transform. Opening draws the zoom rectangles a
   Macintosh drew, a handful of dotted outlines growing from the icon to the
   window's frame, and then the window is simply there; closing draws them
   back. Nothing scales, nothing fades.

   Dragging moves an outline, not the window: the dotted frame follows the
   hand and the window jumps to it when the button comes up, which is how
   the Finder did it and also why an iframe inside a window never swallows a
   drag. Resizing works the same way from the grow box or any edge. A double
   click on the title bar rolls the window up into its bar (WindowShade, 7.5)
   and the zoom box grows it to the screen and back.

   Nothing here knows what is inside a window. The page hands it a body. */
import { reduced } from './motion';

export type WinOpts = {
  id: string;
  title: string;
  body: HTMLElement;
  w: number;
  h: number;
  min?: number;          // minimum width
  minH?: number;         // minimum height
  klass?: string;
  tool?: HTMLElement;    // a strip of controls under the title bar
  scroller?: HTMLElement; // the element the app scrolls, when it is not the pane
  side?: boolean;        // kept for callers; a System 7 window has no sidebar
  fixed?: boolean;       // an About window: no resize, no zoom
  zoomOnly?: boolean;    // Quick Look: no resize, zoom is live
  onClose?: () => void;
  onFocus?: () => void;
  onMin?: () => void;
  onRestore?: () => void;
};

export type Rect = { x: number; y: number; w: number; h: number };

export type Win = {
  id: string;
  el: HTMLElement;
  bar: HTMLElement;
  x: number; y: number;
  w: number; h: number;
  min: number; minH: number;
  from: Rect;            // the icon it grew out of
  minimized: boolean;    // always false here: a shaded window is still on screen
  shaded: boolean;
  restoring?: boolean;
  z: number;
  opts: WinOpts;
  stop?: () => void;
  settle?: () => void;
  repaintBars?: () => void;
};

/* the geometry, in CSS pixels, kept in step with the tokens (one unit is 2px) */
const U = 2;
const BAR = 20 * U;      // the menu bar
const TBAR = 20 * U;     // a title bar, its bottom line included
const KEEP = 60 * U;     // how much of a title bar must stay on screen, sideways
const ZOOM_STEPS = 8;
const ZOOM_TICK = 14;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* the dotted rectangles: a fixed layer, a few outlines at a time. Exported
   because a disk mounting on the desktop is drawn in with the same eight
   frames a window opens with, and there should be one of them. */
export function zoomRects(a: Rect, b: Rect, done: () => void) {
  if (reduced()) { done(); return; }
  const layer = document.createElement('div');
  layer.className = 'zoom-rects';
  document.body.appendChild(layer);
  let i = 0;
  const step = () => {
    if (i >= ZOOM_STEPS) { layer.remove(); done(); return; }
    const t = (i + 1) / ZOOM_STEPS;
    const r = document.createElement('div');
    r.className = 'zr';
    r.style.left = `${lerp(a.x, b.x, t).toFixed(1)}px`;
    r.style.top = `${lerp(a.y, b.y, t).toFixed(1)}px`;
    r.style.width = `${lerp(a.w, b.w, t).toFixed(1)}px`;
    r.style.height = `${lerp(a.h, b.h, t).toFixed(1)}px`;
    layer.appendChild(r);
    while (layer.children.length > 3) layer.firstChild!.remove();
    i++;
    setTimeout(step, ZOOM_TICK);
  };
  step();
}

export class Desk {
  root: HTMLElement;
  wins: Win[] = [];
  private z = 10;
  dragging: Win | null = null;
  onChange: (front: Win | null) => void = () => {};
  /* the bottom of the usable screen: the whole screen, there is no dock */
  dockTop: () => number = () => innerHeight;

  constructor(root: HTMLElement) {
    this.root = root;
    addEventListener('resize', () => this.wins.forEach((w) => { this.clamp(w); this.paint(w); }));
  }

  /* the top of the pile, whether or not it is active */
  get front() {
    const vis = this.wins.filter((w) => !w.minimized);
    return vis.length ? vis.reduce((a, b) => (a.z > b.z ? a : b)) : null;
  }
  /* the window taking the keyboard and the menu bar: the top of the pile,
     unless the desktop or a note was clicked since, in which case nothing */
  private blurred = false;
  get active() { return this.blurred ? null : this.front; }
  get visible() { return this.wins.filter((w) => !w.minimized); }
  has(id: string) { return this.wins.some((w) => w.id === id); }
  get(id: string) { return this.wins.find((w) => w.id === id); }
  barH(_win: Win) { return TBAR; }

  /* where a new window lands: the first one near the middle of the screen,
     every one after it a step down and right of the last, the way the Finder
     staggered them, and back at the first one's corner once the next step
     would run off the screen */
  private origin: { x: number; y: number } | null = null;
  private place(w: number, h: number) {
    const vw = innerWidth, vh = this.dockTop();
    const snap = (v: number) => Math.round(v / U) * U;
    const inside = (x: number, y: number) => ({
      x: Math.max(4 * U, snap(Math.min(x, vw - w - 4 * U))),
      y: Math.max(BAR + 4 * U, snap(Math.min(y, vh - h - 4 * U))),
    });
    const last = this.wins[this.wins.length - 1];
    if (!last || !this.origin) {
      this.origin = inside((vw - w) / 2 - 24 * U, (vh + BAR - h) / 2 - 10 * U);
      return { ...this.origin };
    }
    const x = snap(last.x) + 10 * U, y = snap(last.y) + 10 * U;
    if (x + w > vw - 4 * U || y + h > vh - 4 * U) return inside(this.origin.x, this.origin.y);
    return { x, y };
  }

  open(o: WinOpts, from?: DOMRect) {
    const exist = this.get(o.id);
    if (exist) {
      if (exist.shaded) this.restore(exist);
      else this.focus(exist);
      return exist;
    }

    const vw = innerWidth;
    const w = Math.min(o.w, vw - 8 * U);
    const h = Math.min(o.h, this.dockTop() - BAR - 8 * U);
    const { x, y } = this.place(w, h);

    const el = document.createElement('section');
    el.className = `win${o.klass ? ` ${o.klass}` : ''}${o.tool ? ' has-tool' : ''}${o.fixed ? ' is-fixed' : ''}${o.zoomOnly ? ' is-nomin' : ''}`;
    el.dataset.win = o.id;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', o.title || 'About');
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.visibility = 'hidden';

    const bar = document.createElement('header');
    bar.className = 'win-bar';
    bar.dataset.drag = '';
    bar.innerHTML =
      `<button class="wbox wbox-c" type="button" aria-label="Close"></button>
       <span class="win-title">${o.title}</span>
       <button class="wbox wbox-z" type="button" aria-label="Zoom"></button>`;

    const pad = document.createElement('div');
    pad.className = 'win-pad';

    const body = document.createElement('div');
    body.className = 'win-body';
    const pane = document.createElement('div');
    pane.className = 'win-pane';
    pane.appendChild(o.body);
    body.appendChild(pane);
    /* every document window carries both scroll bars and the grow box between
       them, even when there is nothing to scroll: an empty white track is what
       a Macintosh showed, and the corner has to have something to sit in */
    const bars = !o.fixed && !o.zoomOnly;
    if (bars) {
      body.insertAdjacentHTML('beforeend',
        `<div class="sb sb-v" data-sb="v">
           <button class="sb-arw sb-up" type="button" tabindex="-1" aria-label="Scroll up"></button>
           <div class="sb-track" data-sb-track><span class="sb-thumb" data-sb-thumb></span></div>
           <button class="sb-arw sb-dn" type="button" tabindex="-1" aria-label="Scroll down"></button>
         </div>
         <div class="sb sb-h" data-sb="h">
           <button class="sb-arw sb-lf" type="button" tabindex="-1" aria-label="Scroll left"></button>
           <div class="sb-track" data-sb-track><span class="sb-thumb" data-sb-thumb></span></div>
           <button class="sb-arw sb-rt" type="button" tabindex="-1" aria-label="Scroll right"></button>
         </div>
         <div class="win-grow" aria-hidden="true"></div>`);
    }

    el.append(bar);
    if (o.tool) { o.tool.classList.add('win-tool'); el.appendChild(o.tool); }
    else { const empty = document.createElement('div'); empty.className = 'win-tool'; empty.hidden = true; el.appendChild(empty); }
    el.append(pad, body);
    if (!o.fixed && !o.zoomOnly) {
      for (const d of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
        const hd = document.createElement('span');
        hd.className = `rz rz-${d}`;
        hd.dataset.rz = d;
        el.appendChild(hd);
      }
    }
    this.root.appendChild(el);

    /* the floor a resize stops at: the window's own chrome, the two arrows
       and room for the scroll box between them. Measured rather than
       guessed, because a toolbar adds a row and a narrow one wraps into two. */
    const floor = () => (bars ? el.offsetHeight - pane.offsetHeight + 48 * U : 60 * U);

    const win: Win = {
      id: o.id, el, bar, x, y, w, h, min: o.min ?? 130 * U, minH: o.minH ?? floor(),
      from: from
        ? { x: from.left, y: from.top, w: from.width, h: from.height }
        : { x: x + w / 2 - 16 * U, y: y + h / 2 - 16 * U, w: 32 * U, h: 32 * U },
      minimized: false, shaded: false, z: ++this.z, opts: o,
    };
    el.style.zIndex = String(win.z);
    this.wins.push(win);

    /* wire the chrome */
    bar.querySelector('.wbox-c')!.addEventListener('click', (e) => { e.stopPropagation(); this.close(win); });
    bar.querySelector('.wbox-z')!.addEventListener('click', (e) => { e.stopPropagation(); this.zoom(win); });
    /* WindowShade: a double click on the bar rolls the window up */
    el.addEventListener('dblclick', (e) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-drag]')) return;
      if (t.closest('.wbox, button, a, input, select, textarea, [contenteditable], [data-nodrag]')) return;
      if (win.shaded) this.restore(win); else this.minimize(win);
    });
    this.wireFocus(win);
    this.drag(win);
    if (bars) this.scrollbars(win, o.scroller ?? pane);
    if (!o.fixed && !o.zoomOnly) {
      this.resize(win);
      if (o.minH == null) el.addEventListener('win:resize', () => { if (!win.shaded) win.minH = floor(); });
    }
    this.focus(win);
    this.paint(win);

    const show = () => {
      el.style.visibility = '';
      win.settle?.();
      this.onChange(this.front);
    };
    zoomRects(win.from, { x: win.x, y: win.y, w: win.w, h: win.h }, show);
    return win;
  }

  /* a click on a window that is not in front brings it forward and does
     nothing else, which is what a Macintosh did. The boxes are the exception. */
  private wireFocus(win: Win) {
    win.el.addEventListener('pointerdown', (e) => {
      const wasFront = this.front === win;
      this.focus(win);
      if (wasFront) return;
      const t = e.target as HTMLElement;
      if (t.closest('.wbox, [data-drag], .rz')) return;
      const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      win.el.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => win.el.removeEventListener('click', swallow, { capture: true }), 400);
    }, true);
  }

  paint(win: Win) {
    win.el.style.transform = `translate3d(${Math.round(win.x)}px, ${Math.round(win.y)}px, 0)`;
    win.el.style.opacity = '1';
  }

  /* the owner hears about the close while the body is still inside the
     window, so it can carry the body back out before the frame is dropped */
  private reap(win: Win) {
    this.wins = this.wins.filter((w) => w !== win);
    win.opts.onClose?.();
    win.el.remove();
    this.next();
  }

  /* the window underneath comes forward */
  private next() {
    const f = this.front;
    if (f) this.focus(f);
    else this.onChange(null);
  }

  focus(win: Win) {
    if (win.z !== this.z) {
      win.z = ++this.z;
      win.el.style.zIndex = String(win.z);
    }
    this.blurred = false;
    this.wins.forEach((w) => w.el.classList.toggle('is-front', w === win));
    win.opts.onFocus?.();
    this.onChange(this.front);
  }

  /* nobody in front: the desktop was clicked. The pile keeps its order; the
     top window just stops being the active one. */
  blur() {
    this.blurred = true;
    this.wins.forEach((w) => w.el.classList.remove('is-front'));
    this.onChange(null);
  }

  /* the back-most window comes forward */
  cycle() {
    const vis = this.visible;
    if (vis.length < 2) return;
    const back = vis.reduce((a, b) => (a.z < b.z ? a : b));
    this.focus(back);
  }

  close(win: Win) {
    if (this.wins.indexOf(win) < 0) return;
    win.el.style.visibility = 'hidden';
    win.el.style.pointerEvents = 'none';
    const here = { x: win.x, y: win.y, w: win.w, h: this.tall(win) };
    zoomRects(here, win.from, () => this.reap(win));
  }

  /* how tall a window is drawn: a shaded one is as tall as the sheet makes
     its bar, frame included, so it is read off the element */
  private tall(win: Win) { return win.shaded ? win.el.offsetHeight : win.h; }

  /* WindowShade: the body rolls up, the bar stays where it is. The height is
     the sheet's to set, so the bar is not squeezed against its own frame. */
  minimize(win: Win) {
    if (win.shaded || win.opts.fixed) return;
    win.shaded = true;
    win.el.classList.add('is-shade');
    win.el.style.height = '';
    win.opts.onMin?.();
    this.focus(win);
  }

  /* where a window folds to, and grows back from */
  setFrom(win: Win, r: DOMRect) {
    win.from = { x: r.left, y: r.top, w: Math.max(8, r.width), h: Math.max(8, r.height) };
  }

  restore(win: Win) {
    if (!win.shaded) { this.focus(win); return; }
    win.shaded = false;
    win.el.classList.remove('is-shade');
    win.el.style.height = `${win.h}px`;
    this.clamp(win);
    this.paint(win);
    this.focus(win);
    win.opts.onRestore?.();
  }

  /* zoom: the whole screen under the menu bar, or back to where it was */
  private zoomed = new WeakMap<HTMLElement, { x: number; y: number; w: number; h: number }>();
  zoom(win: Win) {
    if (win.opts.fixed) return;
    if (win.shaded) this.restore(win);
    const prev = this.zoomed.get(win.el);
    if (prev) {
      this.zoomed.delete(win.el);
      Object.assign(win, prev);
    } else {
      this.zoomed.set(win.el, { x: win.x, y: win.y, w: win.w, h: win.h });
      win.x = 0; win.y = BAR;
      win.w = innerWidth;
      win.h = this.dockTop() - BAR;
    }
    this.size(win);
    this.paint(win);
  }

  /* a panel that follows its content, the way Quick Look does */
  setSize(win: Win, w: number, h: number) {
    const cx = win.x + win.w / 2, cy = win.y + win.h / 2;
    win.w = Math.min(w, innerWidth - 8 * U);
    win.h = Math.min(h, this.dockTop() - BAR - 8 * U);
    win.x = cx - win.w / 2; win.y = cy - win.h / 2;
    this.clamp(win);
    this.size(win);
    this.paint(win);
  }

  private size(win: Win) {
    win.el.style.width = `${win.w}px`;
    win.el.style.height = win.shaded ? '' : `${win.h}px`;
    win.el.dispatchEvent(new CustomEvent('win:resize', { bubbles: false }));
    win.repaintBars?.();
  }

  /* an About window is as tall as its own words, measured once the body is
     in place rather than guessed at in the app table */
  fit(win: Win, extra = 0) {
    const inner = win.el.querySelector<HTMLElement>('.win-pane');
    if (!inner) return;
    const chrome = win.el.offsetHeight - inner.offsetHeight;
    const h = Math.min(this.dockTop() - BAR - 20 * U, inner.scrollHeight + chrome + extra);
    if (h < 60) return;
    win.h = h;
    win.el.style.height = `${h}px`;
    win.y = Math.max(BAR + 4 * U, (this.dockTop() + BAR - h) / 2 - 10 * U);
    this.paint(win);
  }

  /* the hard bounds: the title bar stays reachable on every side */
  private clamp(win: Win) {
    win.x = Math.min(Math.max(KEEP - win.w, win.x), innerWidth - KEEP);
    win.y = Math.min(Math.max(BAR, win.y), this.dockTop() - TBAR);
  }

  /* The drawn scroll bars.

     The pane, or whatever element inside it the app actually scrolls, moves
     the way any element does, by wheel, by keyboard, by an app calling
     scrollIntoView; these read it every time it moves and lay the scroll box
     out over the track. Driving it works the other way: an arrow scrolls a
     line and keeps going while held, the track pages, the box drags. With
     nothing to scroll the bar loses its dither and its box. */
  private scrollbars(win: Win, pane: HTMLElement) {
    const LINE = 16 * U;
    const bars = [...win.el.querySelectorAll<HTMLElement>('[data-sb]')];

    const paint = () => {
      for (const bar of bars) {
        const v = bar.dataset.sb === 'v';
        const track = bar.querySelector<HTMLElement>('[data-sb-track]')!;
        const thumb = bar.querySelector<HTMLElement>('[data-sb-thumb]')!;
        const size = v ? pane.clientHeight : pane.clientWidth;
        const full = v ? pane.scrollHeight : pane.scrollWidth;
        /* a few units of padding hanging off the foot of a page is not a
           document to scroll; half a line of text is */
        const live = full - size >= 8 * U;
        bar.classList.toggle('is-live', live);
        if (!live) continue;
        const room = v ? track.clientHeight : track.clientWidth;
        /* the scroll box is a square that only moves: System 7 said where you
           were, never how much there was. A box sized to the document came
           with the Appearance Manager in 8.5. */
        const len = 16 * U;
        const at = Math.round(((v ? pane.scrollTop : pane.scrollLeft) / (full - size)) * (room - len));
        if (v) { thumb.style.top = `${at}px`; thumb.style.height = `${len}px`; }
        else { thumb.style.left = `${at}px`; thumb.style.width = `${len}px`; }
      }
    };

    const by = (v: boolean, d: number) => {
      if (v) pane.scrollTop += d; else pane.scrollLeft += d;
    };

    for (const bar of bars) {
      const v = bar.dataset.sb === 'v';
      const track = bar.querySelector<HTMLElement>('[data-sb-track]')!;
      const thumb = bar.querySelector<HTMLElement>('[data-sb-thumb]')!;

      /* an arrow scrolls one line, and keeps scrolling while it is held */
      for (const arw of [...bar.querySelectorAll<HTMLElement>('.sb-arw')]) {
        const back = arw.classList.contains('sb-up') || arw.classList.contains('sb-lf');
        let timer = 0, first = 0;
        const go = () => by(v, back ? -LINE : LINE);
        const stop = () => { clearInterval(timer); clearTimeout(first); timer = 0; first = 0; };
        arw.addEventListener('pointerdown', (e) => {
          e.preventDefault(); e.stopPropagation();
          this.focus(win);
          go();
          first = window.setTimeout(() => { timer = window.setInterval(go, 40); }, 300);
          const up = () => { stop(); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
          addEventListener('pointerup', up); addEventListener('pointercancel', up);
        });
      }

      /* the track pages toward the pointer, the way a click above or below the
         thumb did; the thumb itself drags */
      track.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.focus(win);
        if (!bar.classList.contains('is-live')) return;
        const r = track.getBoundingClientRect();
        const t = thumb.getBoundingClientRect();
        const page = v ? pane.clientHeight : pane.clientWidth;
        if (e.target !== thumb) {
          const before = v ? e.clientY < t.top : e.clientX < t.left;
          by(v, before ? -page : page);
          return;
        }
        /* drag: the pointer holds its place on the thumb the whole way */
        const grab = (v ? e.clientY - t.top : e.clientX - t.left);
        const room = (v ? r.height : r.width) - (v ? t.height : t.width);
        const size = v ? pane.clientHeight : pane.clientWidth;
        const full = v ? pane.scrollHeight : pane.scrollWidth;
        const id = e.pointerId;
        try { thumb.setPointerCapture(id); } catch {}
        const move = (m: PointerEvent) => {
          if (m.pointerId !== id) return;
          const at = Math.min(Math.max(0, (v ? m.clientY - r.top : m.clientX - r.left) - grab), room);
          const to = room > 0 ? (at / room) * (full - size) : 0;
          if (v) pane.scrollTop = to; else pane.scrollLeft = to;
        };
        const up = (m: PointerEvent) => {
          if (m.pointerId !== id) return;
          try { thumb.releasePointerCapture(id); } catch {}
          thumb.removeEventListener('pointermove', move);
          thumb.removeEventListener('pointerup', up);
          thumb.removeEventListener('pointercancel', up);
        };
        thumb.addEventListener('pointermove', move);
        thumb.addEventListener('pointerup', up);
        thumb.addEventListener('pointercancel', up);
      });
    }

    pane.addEventListener('scroll', paint, { passive: true });
    win.el.addEventListener('win:resize', paint);
    /* the content inside a window changes size on its own: a folder switching
       from icons to a list, a demo settling, a picture loading */
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(paint);
      ro.observe(pane);
      if (pane.firstElementChild) ro.observe(pane.firstElementChild);
    }
    win.repaintBars = paint;
    requestAnimationFrame(paint);
    setTimeout(paint, 300);
  }

  /* the dotted outline a drag or a resize moves */
  private outline(r: Rect) {
    const o = document.createElement('div');
    o.className = 'drag-outline';
    this.placeOutline(o, r);
    document.body.appendChild(o);
    return o;
  }
  private placeOutline(o: HTMLElement, r: Rect) {
    o.style.left = `${Math.round(r.x)}px`;
    o.style.top = `${Math.round(r.y)}px`;
    o.style.width = `${Math.round(r.w)}px`;
    o.style.height = `${Math.round(r.h)}px`;
  }

  /* drag by any chrome surface marked data-drag: the outline follows the
     hand once it has actually moved, and the window jumps on release */
  private drag(win: Win) {
    let px = 0, py = 0, ox = 0, oy = 0, id = -1;
    let nx = 0, ny = 0, started = false;
    let box: HTMLElement | null = null;

    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      if (!started) {
        if (Math.hypot(e.clientX - px, e.clientY - py) <= 3) return;
        started = true;
        try { win.el.setPointerCapture(e.pointerId); } catch {}
        win.el.classList.add('is-drag');
        document.body.classList.add('is-dragging');
        this.dragging = win;
        box = this.outline({ x: win.x, y: win.y, w: win.w, h: this.tall(win) });
      }
      nx = Math.min(Math.max(KEEP - win.w, ox + (e.clientX - px)), innerWidth - KEEP);
      /* the menu bar is a wall */
      ny = Math.min(Math.max(BAR, oy + (e.clientY - py)), this.dockTop() - TBAR);
      if (box) this.placeOutline(box, { x: nx, y: ny, w: win.w, h: this.tall(win) });
    };

    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      const was = started;
      started = false;
      try { win.el.releasePointerCapture(e.pointerId); } catch {}
      win.el.classList.remove('is-drag');
      document.body.classList.remove('is-dragging');
      this.dragging = null;
      box?.remove(); box = null;
      win.el.removeEventListener('pointermove', move);
      win.el.removeEventListener('pointerup', up);
      win.el.removeEventListener('pointercancel', up);
      if (was) { win.x = nx; win.y = ny; this.paint(win); }
    };

    win.el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement;
      const hit = t.closest('[data-drag], [data-nodrag], button, a, input, textarea, select, [contenteditable]');
      if (!hit || !(hit as HTMLElement).hasAttribute('data-drag')) return;
      id = e.pointerId;
      started = false;
      px = e.clientX; py = e.clientY; ox = win.x; oy = win.y;
      nx = ox; ny = oy;
      win.el.addEventListener('pointermove', move);
      win.el.addEventListener('pointerup', up);
      win.el.addEventListener('pointercancel', up);
    });
  }

  /* resize from the grow box or any edge: an outline shows the new frame,
     and the window takes it on release */
  private resize(win: Win) {
    /* the drawn grow box sits in the corner cell; the invisible .rz-se handle
       lies over it and is what the hand actually grabs */
    const handles = [...win.el.querySelectorAll<HTMLElement>('.rz')];
    for (const h of handles) {
      const dir = h.dataset.rz!;
      let id = -1, px = 0, py = 0, ox = 0, oy = 0, ow = 0, oh = 0;
      let r: Rect = { x: 0, y: 0, w: 0, h: 0 };
      let box: HTMLElement | null = null;
      const move = (e: PointerEvent) => {
        if (e.pointerId !== id) return;
        const dx = e.clientX - px, dy = e.clientY - py;
        let x = ox, y = oy, w = ow, hh = oh;
        if (dir.includes('e')) w = Math.max(win.min, ow + dx);
        if (dir.includes('s')) hh = Math.max(win.minH, oh + dy);
        if (dir.includes('w')) { w = Math.max(win.min, ow - dx); x = ox + (ow - w); }
        if (dir.includes('n')) { hh = Math.max(win.minH, oh - dy); y = Math.max(BAR, oy + (oh - hh)); hh = oh + (oy - y); }
        r = { x, y, w: Math.round(w), h: Math.round(hh) };
        if (box) this.placeOutline(box, r);
      };
      const up = (e: PointerEvent) => {
        if (e.pointerId !== id) return;
        id = -1;
        try { h.releasePointerCapture(e.pointerId); } catch {}
        h.removeEventListener('pointermove', move);
        h.removeEventListener('pointerup', up);
        h.removeEventListener('pointercancel', up);
        document.body.classList.remove('is-dragging');
        win.el.classList.remove('is-rz');
        box?.remove(); box = null;
        this.zoomed.delete(win.el);
        win.x = r.x; win.y = r.y; win.w = r.w; win.h = r.h;
        this.size(win);
        this.paint(win);
      };
      h.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || win.shaded) return;
        e.stopPropagation();
        e.preventDefault();
        this.focus(win);
        id = e.pointerId;
        try { h.setPointerCapture(e.pointerId); } catch {}
        px = e.clientX; py = e.clientY; ox = win.x; oy = win.y; ow = win.w; oh = win.h;
        r = { x: ox, y: oy, w: ow, h: oh };
        document.body.classList.add('is-dragging');
        win.el.classList.add('is-rz');
        box = this.outline(r);
        h.addEventListener('pointermove', move);
        h.addEventListener('pointerup', up);
        h.addEventListener('pointercancel', up);
      });
    }
  }
}
