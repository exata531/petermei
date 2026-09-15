/* A sheet of 1-bit paper.

   One canvas, black on white, measured in System 7 units rather than CSS
   pixels, so a game is drawn on the same grid as the rest of the desktop.
   Nothing is anti-aliased and nothing is half a pixel: the context is
   scaled by the unit once and every rectangle after that is whole.

   The four fills are the four a Macintosh had for a 1-bit surface: solid,
   the 50 percent checker, the 25 percent dot, and horizontal stripes. */

/* one System 7 unit, in CSS pixels, kept in step with the tokens */
const U = 2;

export type Ink = 'solid' | 'half' | 'quarter' | 'stripe' | 'white';

export type Paper = {
  el: HTMLCanvasElement;
  W: number;
  H: number;
  begin(): void;
  fill(x: number, y: number, w: number, h: number, ink?: Ink): void;
  frame(x: number, y: number, w: number, h: number): void;
  text(s: string, x: number, y: number, face?: 'chicago' | 'geneva' | 'monaco'): void;
  centre(s: string, y: number, face?: 'chicago' | 'geneva' | 'monaco'): void;
  /* how wide a line sets, in units, so a box can be cut to fit it */
  width(s: string, face?: 'chicago' | 'geneva' | 'monaco'): number;
};

export function makePaper(W: number, H: number): Paper {
  const el = document.createElement('canvas');
  el.className = 'game-canvas';
  const dpr = Math.max(1, Math.min(3, Math.round(devicePixelRatio || 1)));
  el.width = W * U * dpr;
  el.height = H * U * dpr;
  el.style.width = `${W * U}px`;
  el.style.height = `${H * U}px`;
  const ctx = el.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.scale(U * dpr, U * dpr);
  /* Chicago 12 and Geneva 9 sit on a sixteen unit grid, the same as the
     sheet's type scale; Monaco 9 with them */
  const FACE: Record<string, string> = {
    chicago: '16px ChiKareGo2, ChicagoFLF, Geneva, sans-serif',
    geneva: '16px FindersKeepers, Geneva, sans-serif',
    monaco: '16px MonacoBitmap, Monaco, monospace',
  };

  const paper: Paper = {
    el, W, H,
    begin() {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#000000';
    },
    fill(x, y, w, h, ink = 'solid') {
      x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
      if (ink === 'white') { ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#000000'; return; }
      if (ink === 'solid') { ctx.fillRect(x, y, w, h); return; }
      for (let j = y; j < y + h; j++) {
        if (ink === 'stripe') { if (j % 2 === 0) ctx.fillRect(x, j, w, 1); continue; }
        for (let i = x; i < x + w; i++) {
          const on = ink === 'half' ? (i + j) % 2 === 0 : i % 2 === 0 && j % 2 === 0;
          if (on) ctx.fillRect(i, j, 1, 1);
        }
      }
    },
    frame(x, y, w, h) {
      paper.fill(x, y, w, 1);
      paper.fill(x, y + h - 1, w, 1);
      paper.fill(x, y, 1, h);
      paper.fill(x + w - 1, y, 1, h);
    },
    text(s, x, y, face = 'chicago') {
      ctx.font = FACE[face];
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#000000';
      ctx.fillText(s, Math.round(x), Math.round(y));
    },
    centre(s, y, face = 'chicago') {
      paper.text(s, Math.round((W - paper.width(s, face)) / 2), y, face);
    },
    width(s, face = 'chicago') {
      ctx.font = FACE[face];
      return ctx.measureText(s).width;
    },
  };
  return paper;
}
