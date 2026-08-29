/* The window manager.

   A window is a plain element parked at the top left of the desk with its
   position carried entirely on a transform, so moving one never asks the
   browser to lay anything out. Opening scales it up out of its dock icon,
   minimizing folds it back down into the same icon, and every one of those
   moves is a spring on the shared clock in motion.ts.

   Nothing here knows what is inside a window. The page hands it a body. */
import { Spring, Velocity, onFrame, reduced } from './motion';

export type WinOpts = {
  id: string;
  title: string;
  body: HTMLElement;
  w: number;
  h: number;
  min?: number;
  klass?: string;
  onClose?: () => void;
  onFocus?: () => void;
};

type Win = {
  id: string;
  el: HTMLElement;
  bar: HTMLElement;
  x: number; y: number;
  w: number; h: number;
  min: number;
  open: Spring;          // 0 closed, 1 open
  from: { x: number; y: number; w: number };  // the dock icon it grew out of
  minimized: boolean;
  z: number;
  opts: WinOpts;
  stop?: () => void;
};

const BAR = 25;          // the menu bar's height, kept in step with the CSS
const TBAR = 30;         // a window's own title bar, likewise
const EDGE = 6;          // how much of a window must stay on screen

export class Desk {
  root: HTMLElement;
  wins: Win[] = [];
  private z = 10;
  private dragging: Win | null = null;
  onChange: (front: Win | null) => void = () => {};

  constructor(root: HTMLElement) {
    this.root = root;
    addEventListener('keydown', (e) => this.key(e));
    addEventListener('resize', () => this.wins.forEach((w) => this.clamp(w)));
  }

  get front() {
    const vis = this.wins.filter((w) => !w.minimized);
    return vis.length ? vis.reduce((a, b) => (a.z > b.z ? a : b)) : null;
  }
  has(id: string) { return this.wins.some((w) => w.id === id); }
  get(id: string) { return this.wins.find((w) => w.id === id); }

  /* Where a new window lands: centred, then nudged down and right for each
     window already on screen, the way a real Mac cascades. */
  private place(w: number, h: number) {
    const n = this.wins.length;
    const vw = innerWidth, vh = innerHeight;
    const x = Math.max(12, (vw - w) / 2 + (n % 5) * 26 - 52);
    const y = Math.max(BAR + 12, (vh - h) / 2 - 24 + (n % 5) * 24);
    return { x, y };
  }

  open(o: WinOpts, from?: DOMRect) {
    const exist = this.get(o.id);
    if (exist) {
      if (exist.minimized) this.restore(exist);
      else this.focus(exist);
      return exist;
    }

    const vw = innerWidth, vh = innerHeight;
    const w = Math.min(o.w, vw - 24);
    const h = Math.min(o.h, vh - BAR - 110);
    const { x, y } = this.place(w, h);

    const el = document.createElement('section');
    el.className = `win${o.klass ? ` ${o.klass}` : ''}`;
    el.dataset.win = o.id;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', o.title);
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;

    const bar = document.createElement('header');
    bar.className = 'win-bar';
    bar.innerHTML =
      `<span class="lights">
         <button class="lt lt-c" type="button" aria-label="Close ${o.title}"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 4l4 4M8 4l-4 4"/></svg></button>
         <button class="lt lt-m" type="button" aria-label="Minimize ${o.title}"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.4 6h5.2"/></svg></button>
         <button class="lt lt-z" type="button" aria-label="Zoom ${o.title}"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.2 7.8v-3.6h3.6"/><path d="M7.8 4.2v3.6H4.2"/></svg></button>
       </span>
       <span class="win-title">${o.title}</span>
       <span class="win-pad"></span>`;

    const body = document.createElement('div');
    body.className = 'win-body';
    body.appendChild(o.body);

    el.append(bar, body);
    this.root.appendChild(el);

    const win: Win = {
      id: o.id, el, bar, x, y, w, h, min: o.min ?? 260,
      open: new Spring(0, 260, 26),
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
    el.addEventListener('pointerdown', () => this.focus(win), true);
    this.drag(win);
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

  /* one spring per window, released the moment it settles */
  private animate(win: Win) {
    if (win.stop) return;
    win.stop = onFrame((dt) => {
      win.open.step(dt);
      this.paint(win);
      if (win.open.done) {
        win.stop?.(); win.stop = undefined;
        if (win.open.value === 0) this.reap(win);
        else win.el.style.willChange = 'auto';
      }
    });
    win.el.style.willChange = 'transform, opacity';
  }

  private paint(win: Win) {
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

  private reap(win: Win) {
    if (win.minimized) return;
    win.el.remove();
    this.wins = this.wins.filter((w) => w !== win);
    win.opts.onClose?.();
    this.onChange(this.front);
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

  close(win: Win) {
    win.open.to(0);
    if (reduced()) { win.open.set(0); this.reap(win); return; }
    this.animate(win);
  }

  minimize(win: Win) {
    if (win.minimized) return;
    win.minimized = true;
    win.el.classList.add('is-min');
    win.open.to(0);
    if (reduced()) { win.open.set(0); this.paint(win); this.onChange(this.front); return; }
    this.animate(win);
    this.onChange(this.front);
  }

  restore(win: Win) {
    win.minimized = false;
    win.el.classList.remove('is-min');
    win.open.to(1);
    this.focus(win);
    if (reduced()) { win.open.set(1); this.paint(win); return; }
    this.animate(win);
  }

  /* zoom: grow to most of the desk, or go back to where it was */
  private zoomed = new WeakMap<HTMLElement, { x: number; y: number; w: number; h: number }>();
  zoom(win: Win) {
    const prev = this.zoomed.get(win.el);
    if (prev) {
      this.zoomed.delete(win.el);
      Object.assign(win, prev);
    } else {
      this.zoomed.set(win.el, { x: win.x, y: win.y, w: win.w, h: win.h });
      win.x = 16; win.y = BAR + 12;
      win.w = innerWidth - 32;
      win.h = innerHeight - BAR - 12 - 106;
    }
    win.el.style.width = `${win.w}px`;
    win.el.style.height = `${win.h}px`;
    win.el.dispatchEvent(new CustomEvent('win:resize', { bubbles: false }));
    this.paint(win);
  }

  /* an About panel is as tall as its own sentence, so it is measured once the
     body is in place rather than guessed at in the app table */
  fit(win: Win, extra = 0) {
    const inner = win.el.querySelector<HTMLElement>('.win-body');
    if (!inner) return;
    const h = Math.min(innerHeight - 120, inner.scrollHeight + TBAR + extra);
    if (h < 60) return;
    win.h = h;
    win.el.style.height = `${h}px`;
    win.y = Math.max(BAR + 12, (innerHeight - h) / 2 - 20);
    this.paint(win);
  }

  private clamp(win: Win) {
    win.x = Math.min(Math.max(EDGE - win.w + 90, win.x), innerWidth - 90);
    win.y = Math.min(Math.max(BAR, win.y), innerHeight - 40);
    this.paint(win);
  }

  /* Drag by the title bar. Pointer capture means the window keeps receiving
     moves even when the cursor outruns it, and the only thing written per frame
     is a transform. */
  private drag(win: Win) {
    const vel = new Velocity();
    let px = 0, py = 0, ox = 0, oy = 0, id = -1;
    let pending = false, nx = 0, ny = 0;

    const flush = () => {
      pending = false;
      win.x = nx; win.y = ny;
      win.el.style.transform = `translate3d(${Math.round(win.x)}px, ${Math.round(win.y)}px, 0)`;
    };

    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      nx = ox + (e.clientX - px);
      ny = Math.max(BAR, oy + (e.clientY - py));
      nx = Math.min(Math.max(90 - win.w, nx), innerWidth - 90);
      ny = Math.min(ny, innerHeight - 34);
      vel.push(e.clientX, e.clientY, e.timeStamp);
      if (!pending) { pending = true; requestAnimationFrame(flush); }
    };

    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      win.bar.releasePointerCapture(e.pointerId);
      win.el.classList.remove('is-drag');
      win.el.style.willChange = 'auto';
      this.dragging = null;
      /* a small throw, so letting go feels like letting go of something */
      const v = vel.read(); vel.clear();
      if (!reduced() && (Math.abs(v.x) > 220 || Math.abs(v.y) > 220)) this.throw(win, v);
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
    };

    win.bar.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.lt, a, button')) return;
      if (e.button !== 0) return;
      id = e.pointerId;
      win.bar.setPointerCapture(e.pointerId);
      px = e.clientX; py = e.clientY; ox = win.x; oy = win.y;
      vel.clear(); vel.push(e.clientX, e.clientY, e.timeStamp);
      win.el.classList.add('is-drag');
      win.el.style.willChange = 'transform';
      this.dragging = win;
      this.focus(win);
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      addEventListener('pointercancel', up);
      e.preventDefault();
    });

    win.bar.addEventListener('dblclick', () => this.zoom(win));
  }

  private throw(win: Win, v: { x: number; y: number }) {
    /* capped: a flick should carry, not launch the window off the desk */
    let vx = Math.max(-1200, Math.min(1200, v.x));
    let vy = Math.max(-1200, Math.min(1200, v.y));
    const stop = onFrame((dt) => {
      vx *= Math.exp(-dt / 0.09);
      vy *= Math.exp(-dt / 0.09);
      win.x += vx * dt;
      win.y += vy * dt;
      win.x = Math.min(Math.max(90 - win.w, win.x), innerWidth - 90);
      win.y = Math.min(Math.max(BAR, win.y), innerHeight - 34);
      win.el.style.transform = `translate3d(${Math.round(win.x)}px, ${Math.round(win.y)}px, 0)`;
      if (Math.hypot(vx, vy) < 24 || this.dragging === win) stop();
    });
  }

  private key(e: KeyboardEvent) {
    /* Spotlight owns the keyboard while it is up */
    if (document.querySelector('.spot.is-open')) return;
    const f = this.front;
    const typing = (e.target as HTMLElement)?.matches?.('input, textarea, [contenteditable]');
    if (e.key === 'Escape' && f) { this.close(f); return; }
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'w' && f) { e.preventDefault(); this.close(f); }
    else if (k === 'm' && f && !typing) { e.preventDefault(); this.minimize(f); }
  }
}
