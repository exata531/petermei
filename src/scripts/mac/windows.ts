/* The window manager.

   A window is a plain element parked at the top left of the desk with its
   position carried entirely on a transform, so moving one never asks the
   browser to lay anything out. Opening scales it up out of its dock icon,
   minimizing folds it back down into the same icon, closing is a quick fade,
   and every one of those moves is a spring on the shared clock in motion.ts.

   Dragging is the part everyone will test. The whole chrome is the handle
   (the title bar, a toolbar, a Safari tab strip, a Simulator bezel), the
   pointer is captured so the window keeps following a fast hand, nothing
   inside can select while it moves, and a released window stops where it was
   dropped, give or take a few pixels of settle. A window pushed off the edge
   springs back until its title bar is reachable again.

   Nothing here knows what is inside a window. The page hands it a body. */
import { Spring, Velocity, onFrame, reduced } from './motion';

export type WinOpts = {
  id: string;
  title: string;
  body: HTMLElement;
  w: number;
  h: number;
  min?: number;          // minimum width
  minH?: number;         // minimum height
  klass?: string;
  tool?: HTMLElement;    // a toolbar: the title bar grows to carry it
  fixed?: boolean;       // an About panel: no resize, no zoom
  onClose?: () => void;
  onFocus?: () => void;
  onMin?: () => void;
};

export type Win = {
  id: string;
  el: HTMLElement;
  bar: HTMLElement;
  x: number; y: number;
  w: number; h: number;
  min: number; minH: number;
  open: Spring;          // 0 closed, 1 open
  from: { x: number; y: number; w: number };  // the dock icon it grew out of
  minimized: boolean;
  z: number;
  opts: WinOpts;
  stop?: () => void;
  settle?: () => void;
};

const BAR = 24;          // the menu bar's height, kept in step with the CSS
const TBAR = 28;         // a plain title bar
const TOOL = 52;         // a title bar with a toolbar
const KEEP = 120;        // how much of a title bar must stay on screen, sideways

export class Desk {
  root: HTMLElement;
  wins: Win[] = [];
  private z = 10;
  dragging: Win | null = null;
  onChange: (front: Win | null) => void = () => {};
  /* the top of the dock, supplied by the page so a window stops above it */
  dockTop: () => number = () => innerHeight - 76;

  constructor(root: HTMLElement) {
    this.root = root;
    addEventListener('resize', () => this.wins.forEach((w) => { this.clamp(w); this.paint(w); }));
  }

  get front() {
    const vis = this.wins.filter((w) => !w.minimized);
    return vis.length ? vis.reduce((a, b) => (a.z > b.z ? a : b)) : null;
  }
  get visible() { return this.wins.filter((w) => !w.minimized); }
  has(id: string) { return this.wins.some((w) => w.id === id); }
  get(id: string) { return this.wins.find((w) => w.id === id); }
  barH(win: Win) { return win.opts.tool ? TOOL : TBAR; }

  /* Where a new window lands: centred, then nudged down and right for each
     window already on screen, the way a real Mac cascades. */
  private place(w: number, h: number) {
    const n = this.wins.length;
    const vw = innerWidth, vh = this.dockTop();
    const x = Math.max(12, (vw - w) / 2 + (n % 5) * 22 - 44);
    const y = Math.max(BAR + 8, (vh + BAR - h) / 2 - 12 + (n % 5) * 22);
    return { x, y };
  }

  open(o: WinOpts, from?: DOMRect) {
    const exist = this.get(o.id);
    if (exist) {
      if (exist.minimized) this.restore(exist);
      else this.focus(exist);
      return exist;
    }

    const vw = innerWidth;
    const w = Math.min(o.w, vw - 24);
    const h = Math.min(o.h, this.dockTop() - BAR - 24);
    const { x, y } = this.place(w, h);

    const el = document.createElement('section');
    el.className = `win${o.klass ? ` ${o.klass}` : ''}${o.tool ? ' has-tool' : ''}${o.fixed ? ' is-fixed' : ''}`;
    el.dataset.win = o.id;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', o.title || 'About');
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;

    const bar = document.createElement('header');
    bar.className = 'win-bar';
    bar.dataset.drag = '';
    bar.innerHTML =
      `<span class="lights">
         <button class="lt lt-c" type="button" aria-label="Close"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.6 3.6l4.8 4.8M8.4 3.6l-4.8 4.8"/></svg></button>
         <button class="lt lt-m" type="button" aria-label="Minimize"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 6h6"/></svg></button>
         <button class="lt lt-z" type="button" aria-label="Zoom"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.2 6.6v2.2h2.2M8.8 5.4V3.2H6.6"/><path d="M3.4 8.6l2.4-2.4M8.6 3.4L6.2 5.8"/></svg></button>
       </span>
       <span class="win-title">${o.title}</span>
       <span class="win-pad"></span>`;
    if (o.tool) {
      bar.querySelector('.win-title')!.replaceWith(o.tool);
      o.tool.classList.add('win-tool');
    }

    const body = document.createElement('div');
    body.className = 'win-body';
    body.appendChild(o.body);

    el.append(bar, body);
    if (!o.fixed) {
      for (const d of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
        const h = document.createElement('span');
        h.className = `rz rz-${d}`;
        h.dataset.rz = d;
        el.appendChild(h);
      }
    }
    this.root.appendChild(el);

    const win: Win = {
      id: o.id, el, bar, x, y, w, h, min: o.min ?? 260, minH: o.minH ?? 140,
      open: new Spring(0, 300, 30),
      from: from
        ? { x: from.left + from.width / 2, y: from.top + from.height / 2, w: from.width }
        : { x: x + w / 2, y: y + h + 60, w: 60 },
      minimized: false, z: ++this.z, opts: o,
    };
    el.style.zIndex = String(win.z);
    this.wins.push(win);

    /* wire the chrome */
    bar.querySelector('.lt-c')!.addEventListener('click', (e) => { e.stopPropagation(); this.close(win); });
    bar.querySelector('.lt-m')!.addEventListener('click', (e) => { e.stopPropagation(); this.minimize(win); });
    bar.querySelector('.lt-z')!.addEventListener('click', (e) => { e.stopPropagation(); this.zoom(win); });
    this.wireFocus(win);
    this.drag(win);
    if (!o.fixed) this.resize(win);
    this.focus(win);

    if (reduced()) {
      win.open.set(1);
      this.paint(win);
    } else {
      win.open.to(1);
      this.animate(win);
    }
    this.onChange(this.front);
    return win;
  }

  /* a click on a window that is not in front brings it forward and does
     nothing else, which is what a Mac does. The lights are the exception. */
  private wireFocus(win: Win) {
    win.el.addEventListener('pointerdown', (e) => {
      const wasFront = this.front === win;
      this.focus(win);
      if (wasFront) return;
      const t = e.target as HTMLElement;
      if (t.closest('.lt, [data-drag], .rz')) return;
      const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      win.el.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => win.el.removeEventListener('click', swallow, { capture: true }), 400);
    }, true);
  }

  /* one spring per window, released the moment it settles */
  private animate(win: Win) {
    if (win.stop) return;
    win.stop = onFrame((dt) => {
      win.open.step(dt);
      this.paint(win);
      if (win.open.done) {
        win.stop?.(); win.stop = undefined;
        if (win.open.value === 0) this.reap(win);
        else { win.el.style.willChange = 'auto'; win.settle?.(); }
      }
    });
    win.el.style.willChange = 'transform, opacity';
  }

  paint(win: Win) {
    const t = win.open.value;
    const el = win.el;
    if (t >= 0.999 && !win.minimized) {
      el.style.transform = `translate3d(${Math.round(win.x)}px, ${Math.round(win.y)}px, 0)`;
      el.style.opacity = '1';
      return;
    }
    /* interpolate the window's centre toward the icon it belongs to, and shrink
       it to the icon's width: the open is a real scale-from-dock, and the
       minimize is the same move played backwards */
    const cx = win.x + win.w / 2, cy = win.y + win.h / 2;
    const s = Math.max(0.02, (win.from.w / win.w) + (1 - win.from.w / win.w) * t);
    const nx = win.from.x + (cx - win.from.x) * t;
    const ny = win.from.y + (cy - win.from.y) * t;
    el.style.transform =
      `translate3d(${(nx - win.w / 2).toFixed(2)}px, ${(ny - win.h / 2).toFixed(2)}px, 0) scale(${s.toFixed(4)})`;
    el.style.opacity = String(Math.min(1, t * 2.4));
  }

  /* the owner hears about the close while the body is still inside the
     window, so it can carry the body back out before the frame is dropped */
  private reap(win: Win) {
    if (win.minimized) return;
    this.wins = this.wins.filter((w) => w !== win);
    win.opts.onClose?.();
    win.el.remove();
    this.next();
  }

  /* the window underneath comes forward, the way a Mac hands focus on */
  private next() {
    const f = this.front;
    if (f) this.focus(f);
    else this.onChange(null);
  }

  focus(win: Win) {
    if (win.z !== this.z || win.minimized) {
      win.z = ++this.z;
      win.el.style.zIndex = String(win.z);
    }
    this.wins.forEach((w) => w.el.classList.toggle('is-front', w === win));
    win.opts.onFocus?.();
    this.onChange(this.front);
  }

  /* nobody in front: the desktop was clicked */
  blur() {
    this.wins.forEach((w) => w.el.classList.remove('is-front'));
    this.onChange(null);
  }

  /* the back-most window comes forward, the way command-backtick cycles */
  cycle() {
    const vis = this.visible;
    if (vis.length < 2) return;
    const back = vis.reduce((a, b) => (a.z < b.z ? a : b));
    this.focus(back);
  }

  close(win: Win) {
    if (win.stop) { win.stop(); win.stop = undefined; }
    if (reduced()) { win.open.set(0); this.reap(win); return; }
    /* a Mac closes a window with a short fade, not a trip back to the dock */
    win.el.style.pointerEvents = 'none';
    const a = win.el.animate(
      [{ opacity: 1, transform: `${win.el.style.transform} scale(1)` },
       { opacity: 0, transform: `${win.el.style.transform} scale(.96)` }],
      { duration: 170, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' },
    );
    a.onfinish = () => this.reap(win);
  }

  minimize(win: Win) {
    if (win.minimized) return;
    win.minimized = true;
    win.el.classList.add('is-min');
    win.opts.onMin?.();
    win.el.classList.remove('is-front');
    win.open.to(0);
    if (reduced()) { win.open.set(0); this.paint(win); this.next(); return; }
    this.animate(win);
    this.next();
  }

  restore(win: Win) {
    win.minimized = false;
    win.el.classList.remove('is-min');
    win.open.to(1);
    this.focus(win);
    if (reduced()) { win.open.set(1); this.paint(win); return; }
    this.animate(win);
  }

  /* zoom: fill the space between the menu bar and the dock, or go back */
  private zoomed = new WeakMap<HTMLElement, { x: number; y: number; w: number; h: number }>();
  zoom(win: Win) {
    if (win.opts.fixed) return;
    const prev = this.zoomed.get(win.el);
    if (prev) {
      this.zoomed.delete(win.el);
      Object.assign(win, prev);
    } else {
      this.zoomed.set(win.el, { x: win.x, y: win.y, w: win.w, h: win.h });
      win.x = 0; win.y = BAR;
      win.w = innerWidth;
      win.h = this.dockTop() - BAR - 8;
    }
    if (!reduced()) {
      win.el.classList.add('is-zoom');
      setTimeout(() => win.el.classList.remove('is-zoom'), 280);
    }
    this.size(win);
    this.paint(win);
  }

  /* a panel that follows its content, the way Quick Look does */
  setSize(win: Win, w: number, h: number) {
    const cx = win.x + win.w / 2, cy = win.y + win.h / 2;
    win.w = Math.min(w, innerWidth - 24);
    win.h = Math.min(h, this.dockTop() - BAR - 24);
    win.x = cx - win.w / 2; win.y = cy - win.h / 2;
    this.clamp(win);
    this.size(win);
    this.paint(win);
  }

  private size(win: Win) {
    win.el.style.width = `${win.w}px`;
    win.el.style.height = `${win.h}px`;
    win.el.dispatchEvent(new CustomEvent('win:resize', { bubbles: false }));
  }

  /* an About panel is as tall as its own sentence, so it is measured once the
     body is in place rather than guessed at in the app table */
  fit(win: Win, extra = 0) {
    const inner = win.el.querySelector<HTMLElement>('.win-body');
    if (!inner) return;
    const h = Math.min(this.dockTop() - BAR - 40, inner.scrollHeight + this.barH(win) + extra);
    if (h < 60) return;
    win.h = h;
    win.el.style.height = `${h}px`;
    win.y = Math.max(BAR + 8, (this.dockTop() + BAR - h) / 2 - 20);
    this.paint(win);
  }

  /* the hard bounds: the title bar stays reachable on every side */
  private clamp(win: Win) {
    win.x = Math.min(Math.max(KEEP - win.w, win.x), innerWidth - KEEP);
    win.y = Math.min(Math.max(BAR, win.y), this.dockTop() - this.barH(win));
  }

  /* Drag by any chrome surface marked data-drag. Pointer capture on the
     window means it keeps receiving moves even when the cursor outruns it,
     and the only thing written per frame is a transform. */
  private drag(win: Win) {
    const vel = new Velocity();
    let px = 0, py = 0, ox = 0, oy = 0, id = -1;
    let pending = false, nx = 0, ny = 0;

    const flush = () => {
      pending = false;
      win.x = nx; win.y = ny;
      win.el.style.transform = `translate3d(${Math.round(win.x)}px, ${Math.round(win.y)}px, 0)`;
    };

    /* past the soft edge the window still follows the hand, with resistance,
       and springs back on release */
    const band = (v: number, lo: number, hi: number) => {
      if (v < lo) return lo - rubber(lo - v);
      if (v > hi) return hi + rubber(v - hi);
      return v;
    };
    const rubber = (d: number) => (d * 300 * 0.55) / (300 + 0.55 * d);

    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const rx = ox + (e.clientX - px);
      const ry = oy + (e.clientY - py);
      nx = band(rx, KEEP - win.w, innerWidth - KEEP);
      /* the menu bar is a wall, the way it is on a Mac */
      ny = Math.max(BAR, band(ry, BAR, this.dockTop() - this.barH(win)));
      vel.push(e.clientX, e.clientY, e.timeStamp);
      if (!pending) { pending = true; requestAnimationFrame(flush); }
    };

    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      try { win.el.releasePointerCapture(e.pointerId); } catch {}
      win.el.classList.remove('is-drag');
      document.body.classList.remove('is-dragging');
      win.el.style.willChange = 'auto';
      this.dragging = null;
      if (pending) flush();
      const v = vel.read(); vel.clear();
      win.el.removeEventListener('pointermove', move);
      win.el.removeEventListener('pointerup', up);
      win.el.removeEventListener('pointercancel', up);
      this.release(win, v);
    };

    win.el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const t = e.target as HTMLElement;
      const hit = t.closest('[data-drag], [data-nodrag], button, a, input, textarea, select, [contenteditable]');
      if (!hit || !(hit as HTMLElement).hasAttribute('data-drag')) return;
      if (win.stop) {
        /* grabbed mid-open: the spring is over, the hand wins */
        win.stop(); win.stop = undefined;
        win.open.set(1);
      }
      id = e.pointerId;
      try { win.el.setPointerCapture(e.pointerId); } catch {}
      px = e.clientX; py = e.clientY; ox = win.x; oy = win.y;
      nx = ox; ny = oy;
      vel.clear(); vel.push(e.clientX, e.clientY, e.timeStamp);
      win.el.classList.add('is-drag');
      document.body.classList.add('is-dragging');
      win.el.style.willChange = 'transform';
      this.dragging = win;
      win.el.addEventListener('pointermove', move);
      win.el.addEventListener('pointerup', up);
      win.el.addEventListener('pointercancel', up);
      e.preventDefault();
    });

    win.el.addEventListener('dblclick', (e) => {
      const t = e.target as HTMLElement;
      const hit = t.closest('[data-drag], [data-nodrag], button, a, input');
      if (hit && (hit as HTMLElement).hasAttribute('data-drag')) this.zoom(win);
    });
  }

  /* letting go: a few pixels of settle in the direction of travel, then a
     spring back inside the bounds if the hand left the window past them */
  private release(win: Win, v: { x: number; y: number }) {
    const speed = Math.hypot(v.x, v.y);
    let cx = 0, cy = 0;
    if (!reduced() && speed > 300) {
      const carry = Math.min(14, speed * 0.012);
      cx = (v.x / speed) * carry;
      cy = (v.y / speed) * carry;
    }
    const tx = Math.min(Math.max(KEEP - win.w, win.x + cx), innerWidth - KEEP);
    const ty = Math.min(Math.max(BAR, win.y + cy), this.dockTop() - this.barH(win));
    if (Math.abs(tx - win.x) < 0.5 && Math.abs(ty - win.y) < 0.5) return;
    if (reduced()) { win.x = tx; win.y = ty; this.paint(win); return; }
    const out = tx !== win.x + cx || ty !== win.y + cy;
    const sx = new Spring(win.x, out ? 260 : 400, out ? 28 : 40);
    const sy = new Spring(win.y, out ? 260 : 400, out ? 28 : 40);
    sx.to(tx); sy.to(ty);
    const stop = onFrame((dt) => {
      if (this.dragging === win) { stop(); return; }
      win.x = sx.step(dt); win.y = sy.step(dt);
      win.el.style.transform = `translate3d(${Math.round(win.x)}px, ${Math.round(win.y)}px, 0)`;
      if (sx.done && sy.done) stop();
    });
  }

  /* resize from any edge or corner: 8px edges, 16px corners, pointer
     captured on the handle, size written directly and the scene told once
     per frame */
  private resize(win: Win) {
    const handles = [...win.el.querySelectorAll<HTMLElement>('.rz')];
    for (const h of handles) {
      const dir = h.dataset.rz!;
      let id = -1, px = 0, py = 0, ox = 0, oy = 0, ow = 0, oh = 0, pending = false;
      const apply = () => {
        pending = false;
        this.size(win);
        win.el.style.transform = `translate3d(${Math.round(win.x)}px, ${Math.round(win.y)}px, 0)`;
      };
      const move = (e: PointerEvent) => {
        if (e.pointerId !== id) return;
        const dx = e.clientX - px, dy = e.clientY - py;
        let x = ox, y = oy, w = ow, hh = oh;
        if (dir.includes('e')) w = Math.max(win.min, ow + dx);
        if (dir.includes('s')) hh = Math.max(win.minH, oh + dy);
        if (dir.includes('w')) { w = Math.max(win.min, ow - dx); x = ox + (ow - w); }
        if (dir.includes('n')) { hh = Math.max(win.minH, oh - dy); y = Math.max(BAR, oy + (oh - hh)); hh = oh + (oy - y); }
        win.x = x; win.y = y; win.w = Math.round(w); win.h = Math.round(hh);
        if (!pending) { pending = true; requestAnimationFrame(apply); }
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
        this.zoomed.delete(win.el);
        apply();
      };
      h.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        this.focus(win);
        id = e.pointerId;
        try { h.setPointerCapture(e.pointerId); } catch {}
        px = e.clientX; py = e.clientY; ox = win.x; oy = win.y; ow = win.w; oh = win.h;
        document.body.classList.add('is-dragging');
        win.el.classList.add('is-rz');
        h.addEventListener('pointermove', move);
        h.addEventListener('pointerup', up);
        h.addEventListener('pointercancel', up);
      });
    }
  }
}
