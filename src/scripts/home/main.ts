/* The home page's one script. One rAF loop; transform and opacity only.
   The lerped scroll wrapper is switched on only around the reel, so the
   paper sections keep native scroll. Everything reads complete without it. */

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T | null;
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll(s)) as T[];
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const damp = (t: number, dt: number) => 1 - Math.pow(1 - t, dt * 60);

const html = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;
const smallQ = matchMedia('(max-width: 820px)');
let small = smallQ.matches;

/* ── the loader, the rules, the name ───────────────────────────────── */
const loader = $('[data-loader]')!, face = $('[data-face]')!;
const masthead = $('[data-masthead]')!, name = $('[data-name]')!, pill = $('[data-pill]')!, rail = $('[data-rail]')!;
const dateEl = $('[data-date]')!;
dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

function boot() {
  if (reduce) {
    loader.remove();
    html.classList.add('rules-in', 'in-hl');
    name.classList.add('in');
    pill.classList.add('on');
    return;
  }
  const ready = Promise.race([
    Promise.all([document.fonts?.ready ?? Promise.resolve(), new Promise<void>((res) => { const im = $<HTMLImageElement>('.peek img'); if (!im || im.complete) res(); else { im.addEventListener('load', () => res(), { once: true }); im.addEventListener('error', () => res(), { once: true }); } })]),
    new Promise((res) => setTimeout(res, 900)),
  ]);
  setTimeout(() => { face.textContent = '(｡-ᴗ-｡)'; setTimeout(() => { face.textContent = '(｡•ᴗ•｡)'; }, 90); }, 400);
  ready.then(() => {
    loader.classList.add('gone');
    html.classList.add('rules-in');
    setTimeout(() => loader.remove(), 320);
    setTimeout(() => { name.classList.add('in'); html.classList.add('in-hl'); }, 200);
    setTimeout(() => { if (!small) pill.classList.add('on'); }, 200 + 1100 + 300);
  });
}
boot();

/* ── chapter text, split into visual lines (b.html) ────────────────── */
function splitLines(p: HTMLElement) {
  if (p.dataset.src == null) p.dataset.src = p.innerHTML;
  p.innerHTML = p.dataset.src;
  const walk = (node: Node) => {
    Array.from(node.childNodes).forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        let sp = false;
        (n.textContent || '').split(/(\s+)/).forEach((t) => {
          if (!t) return;
          if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(' ')); sp = true; }
          else { const s = document.createElement('span'); s.className = 'm'; s.textContent = t; if (sp) s.dataset.sp = '1'; sp = false; frag.appendChild(s); }
        });
        (n as ChildNode).replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  walk(p);
  const words = $$('.m', p);
  const rows: { top: number; words: HTMLElement[] }[] = [];
  words.forEach((w) => {
    const top = w.getBoundingClientRect().top;
    let row = rows[rows.length - 1];
    if (!row || Math.abs(row.top - top) >= 4) { row = { top, words: [] }; rows.push(row); }
    row.words.push(w);
  });
  const out = document.createDocumentFragment();
  rows.forEach((row) => {
    const ln = document.createElement('span'); ln.className = 'ln';
    const li = document.createElement('span'); li.className = 'li';
    let lastLink: HTMLAnchorElement | null = null, clone: HTMLAnchorElement | null = null;
    row.words.forEach((w, i) => {
      const a = w.closest('a') as HTMLAnchorElement | null;
      if (i && (w.dataset.sp || (a && a !== lastLink))) (a && a === lastLink && clone ? clone : li).appendChild(document.createTextNode(' '));
      if (a) {
        if (a !== lastLink) { clone = a.cloneNode(false) as HTMLAnchorElement; li.appendChild(clone); lastLink = a; }
        clone!.appendChild(document.createTextNode(w.textContent || ''));
      } else { li.appendChild(document.createTextNode(w.textContent || '')); lastLink = null; clone = null; }
    });
    ln.appendChild(li); out.appendChild(ln);
  });
  p.replaceChildren(out);
  return $$('.li', p);
}

/* ── the reel ──────────────────────────────────────────────────────── */
const wrap = $('[data-wrap]')!, spacer = $('[data-spacer]')!;
const washes = $$('.wash .wl'), grain = $('[data-grain]')!;
const fill = $('[data-fill]')!, dots = $$('.rail .dot');
const index = $('.index')!, foot = $('.foot')!, giant = $('[data-giant]')!;
const plane = $('.flight .plane') as SVGGElement | null, trail = $('.flight .trail') as SVGPathElement | null, planeBox = $('.cl-plane');
const blob = $('[data-blob]')!;
type Chapter = { el: HTMLElement; stage: HTMLElement; copy: HTMLElement; ico: HTMLElement; dev: HTMLElement; alts: HTMLImageElement[]; glare: HTMLElement; crest: HTMLElement | null; rx: number; ry: number; lines: HTMLElement[]; top: number; h: number; tail: number };
const chapters: Chapter[] = $$('.ch').map((el) => {
  const dev = $('[data-dev]', el)!;
  return { el, stage: $('[data-stage]', el)!, copy: $('[data-copy]', el)!, ico: $('[data-ico]', el)!, dev, alts: $$('.scr img.alt', el), glare: $('[data-glare]', el)!, crest: $('.crest.lights', el), rx: +dev.dataset.rx!, ry: +dev.dataset.ry!, lines: [], top: 0, h: 0, tail: 0 };
});

let vh = innerHeight, vw = innerWidth, total = 0, mastH = 800, indexTop = 0, footTop = 0, trailLen = 0;
let SMOOTH = false, wantSmooth = false, canSmooth = !small && !reduce;
let target = 0, cur = 0, forceDraw = true, lastT = performance.now();
let mx = 0, my = 0, smx = 0, smy = 0;
let cx = -100, cy = -100, rx = -100, ry = -100, hoverScale = 1, curScale = 1;
let bx = vw * 0.5, by = vh * 0.35, prevChapter = -1;

function layout() {
  vh = innerHeight; vw = innerWidth; small = smallQ.matches;
  canSmooth = !small && !reduce;
  if (!canSmooth) setSmooth(false);
  chapters.forEach((c) => { c.lines = splitLines($('[data-txt]', c.copy)!); });
  mastH = Math.max(320, masthead.offsetHeight);
  chapters.forEach((c) => { c.top = c.el.offsetTop; c.h = c.el.offsetHeight; c.tail = c.el.classList.contains('tail') ? vh * 0.22 : 0; });
  indexTop = index.offsetTop; footTop = foot.offsetTop;
  total = wrap.offsetHeight;
  if (SMOOTH) spacer.style.height = total + 'px';
  if (trail) { try { trailLen = trail.getTotalLength(); } catch { trailLen = 0; } }
  if (small || reduce) mobileReveal();
  forceDraw = true;
}

function setSmooth(on: boolean) {
  if (on === SMOOTH) return;
  SMOOTH = on;
  if (on) { cur = target; spacer.style.height = total + 'px'; wrap.style.transform = `translate3d(0,${-cur}px,0)`; html.classList.add('smooth'); }
  else { html.classList.remove('smooth'); wrap.style.transform = ''; spacer.style.height = '0px'; }
}

/* the reel wants the lerp only while it is anywhere near the window */
if (canSmooth && 'IntersectionObserver' in window) {
  const near = new Set<Element>();
  new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? near.add(e.target) : near.delete(e.target))); wantSmooth = near.size > 0; }, { rootMargin: '120% 0px' }).observe($('.runway.down')!);
  chapters.forEach((c) => new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? near.add(e.target) : near.delete(e.target))); wantSmooth = near.size > 0; }, { rootMargin: '120% 0px' }).observe(c.el));
}

addEventListener('scroll', () => { target = scrollY; }, { passive: true });
addEventListener('mousemove', (e) => { mx = (e.clientX / vw) * 2 - 1; my = (e.clientY / vh) * 2 - 1; cx = e.clientX; cy = e.clientY; }, { passive: true });
addEventListener('mouseleave', () => { mx = 0; my = 0; });

function pinned(el: HTMLElement, top: number, h: number, y: number) {
  const off = clamp(y - top, 0, h - vh);
  el.style.transform = `translate3d(0,${off}px,0)`;
}

let stageAmt = 0;
function washes4(y: number, lead: number) {
  const t = [1];
  chapters.forEach((c) => t.push(clamp((y - (c.top - vh * lead)) / (vh * 0.6), 0, 1)));
  t.push(clamp((y - (indexTop - vh * lead)) / (vh * 0.6), 0, 1));
  let dark = 0;
  for (let k = 0; k < 6; k++) { const o = t[k] * (k < 5 ? 1 - t[k + 1] : 1); (washes[k] as HTMLElement).style.opacity = String(o); if (k > 0 && k < 5) dark += o; }
  stageAmt = clamp(dark, 0, 1);
  grain.style.opacity = String(0.05 * stageAmt);
  blob.style.setProperty('--bo', String(0.5 * (1 - stageAmt)));
}

function drawDesktop(y: number) {
  if (SMOOTH) wrap.style.transform = `translate3d(0,${-y}px,0)`;
  // masthead recedes, the plane flies
  if (y < mastH * 1.2) {
    masthead.style.setProperty('--my', `${-y * 0.16}px`);
    masthead.style.setProperty('--mo-', String(1 - clamp(y / (mastH * 0.92), 0, 1) * 0.88));
    if (plane && trail && trailLen > 0 && planeBox) {
      const ft = clamp((y - 24) / (mastH * 0.85 - 24), 0, 1);
      const p = trail.getPointAtLength(ft * trailLen), q = trail.getPointAtLength(Math.min(trailLen, ft * trailLen + 6));
      const a = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
      plane.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${a})`);
      planeBox.style.setProperty('--fo', String(1 - clamp((ft - 0.78) / 0.18, 0, 1)));
    }
  }
  // chapters
  let active = -1, filled = 0;
  chapters.forEach((c, i) => {
    if (y + vh < c.top || y > c.top + c.h) return;
    pinned(c.stage, c.top, c.h, y);
    const p = clamp((y - c.top) / (c.h - vh - c.tail), 0, 1);
    const enter = easeOut(clamp(p / 0.28, 0, 1));
    const exit = inOut(clamp((p - 0.8) / 0.2, 0, 1));
    if (p > 0 && p < 1) { active = i; filled = i + p; }
    const drift = Math.sin(p * Math.PI * 2) * 5;
    const tx = c.rx * (1 - enter) + c.rx * 0.22 * enter - 16 * exit + smy * -6;
    const ty = c.ry * (1 - enter) + c.ry * 0.2 * enter + drift + smx * 10;
    const yy = 120 * (1 - enter) - 140 * exit;
    const sc = 0.86 + 0.14 * enter - 0.06 * exit;
    c.dev.style.transform = `translate3d(0,${yy}px,0) rotateX(${tx}deg) rotateY(${ty}deg) scale(${sc})`;
    c.dev.style.opacity = String(Math.min(enter, 1 - exit));
    c.glare.style.transform = `translate3d(${smx * 30 + (p - 0.5) * 60}px,0,0)`;
    c.glare.style.opacity = String(0.5 + smx * 0.3);
    if (c.alts.length === 1) c.alts[0].style.opacity = String(easeOut(clamp((p - 0.5) / 0.05, 0, 1)));
    else if (c.alts.length === 2) {
      c.alts[0].style.opacity = String(easeOut(clamp((p - 0.4) / 0.05, 0, 1)));
      c.alts[1].style.opacity = String(easeOut(clamp((p - 0.62) / 0.05, 0, 1)));
    }
    const ci = easeOut(clamp((p - 0.14) / 0.18, 0, 1));
    c.ico.style.opacity = String(ci * (1 - exit)); c.ico.style.transform = `translate3d(0,${(1 - ci) * 20}px,0)`;
    c.lines.forEach((li, k) => {
      const t = easeOut(clamp((p - 0.17 - k * 0.045) / 0.16, 0, 1));
      li.style.transform = `translate3d(0,${(1 - t) * 110}%,0)`; li.style.opacity = String(t * (1 - exit));
    });
    c.copy.style.transform = `translate3d(0,${-exit * 60}px,0)`;
    if (c.crest) c.crest.style.transform = `translate3d(0,${(1 - easeOut(clamp((p - 0.8) / 0.2, 0, 1))) * 34}%,0)`;
  });
  // rail
  const c0 = chapters[0], c3 = chapters[3];
  if (active < 0) {
    filled = y < c0.top ? 0 : y > c3.top + c3.h - vh ? 4 : filled;
    for (let i = 0; i < 4; i++) { const c = chapters[i]; if (y >= c.top - vh * 0.5 && y < c.top + c.h - vh * 0.5) filled = i + clamp((y - c.top) / (c.h - vh - c.tail), 0, 1); }
  }
  fill.style.transform = `scaleY(${clamp(filled / 4, 0, 1)})`;
  const onReel = y >= c0.top - vh * 0.5 && y < c3.top + c3.h - c3.tail - vh * 0.6;
  rail.classList.toggle('on', onReel);
  const dotOn = onReel ? Math.min(3, Math.floor(filled)) : -1;
  if (dotOn !== prevChapter) { dots.forEach((d, i) => d.classList.toggle('on', i === dotOn)); prevChapter = dotOn; }
  washes4(y, 0.55);
  grain.style.transform = `translate3d(${(y % 7) * 3}px,${(y % 11) * -2}px,0)`;
  // the footer wordmark grows as the footer enters
  const q = clamp((y + vh - footTop) / vh, 0, 1);
  giant.style.setProperty('--gs', String(0.9 + 0.1 * easeOut(q)));
}

let io: IntersectionObserver | null = null;
function mobileReveal() {
  if (io) io.disconnect();
  io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io!.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
  $$('.rv').forEach((el) => io!.observe(el));
  chapters.forEach((c) => { c.dev.style.transform = `rotateX(${c.rx * 0.35}deg) rotateY(${c.ry * 0.3}deg)`; c.dev.style.opacity = '1'; c.glare.style.opacity = '.35'; c.ico.style.opacity = '1'; c.ico.style.transform = ''; c.copy.style.transform = ''; c.stage.style.transform = ''; });
  $$('.li').forEach((li) => { li.style.transform = 'none'; li.style.opacity = '1'; });
  masthead.style.setProperty('--my', '0px'); masthead.style.setProperty('--mo-', '1');
  washes.forEach((w, k) => ((w as HTMLElement).style.opacity = k === 0 ? '1' : '0'));
  rail.classList.remove('on');
  giant.style.setProperty('--gs', '1');
}
function drawMobile(y: number) {
  washes4(y, 0.6);
  chapters.forEach((c) => {
    const p = clamp((y - (c.top - vh * 0.3)) / c.h, 0, 1);
    if (c.alts.length === 1) c.alts[0].style.opacity = String(easeOut(clamp((p - 0.45) / 0.15, 0, 1)));
    else if (c.alts.length === 2) { c.alts[0].style.opacity = String(easeOut(clamp((p - 0.3) / 0.12, 0, 1))); c.alts[1].style.opacity = String(easeOut(clamp((p - 0.55) / 0.12, 0, 1))); }
  });
}

/* ── the pill ──────────────────────────────────────────────────────── */
let lastY = 0, lastProbe = 0;
const pl = $$('.pl');
function pillScroll(y: number) {
  const dy = y - lastY;
  if (Math.abs(dy) > 2) { if (dy > 0 && y > 50) pill.classList.add('folded'); else if (dy < 0) pill.classList.remove('folded'); lastY = y; }
  pill.classList.toggle('anim-idle', !pill.classList.contains('folded'));
  const now = performance.now();
  if (now - lastProbe > 60) {
    lastProbe = now;
    const r = pill.getBoundingClientRect(); const py = r.top + r.height / 2;
    let dark = 0;
    [r.left + 24, r.left + r.width / 2, r.right - 24].forEach((px) => {
      const under = document.elementsFromPoint(px, py).find((el) => !el.closest('.pill, .cur, .blob, .rail, .loader'));
      if (under && under.closest('.ch, .band') && !under.closest('.crest')) dark++;
    });
    pill.classList.toggle('dark', dark >= 2);
    const sections = [['#work', indexTop], ['#about', $('#about')!.offsetTop], ['#photos', $('#photos')!.offsetTop]] as [string, number][];
    let act = '';
    sections.forEach(([id, top]) => { if (y + vh * 0.4 >= top) act = id; });
    if (y + vh >= total - 2) act = '#photos';
    pl.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === act));
  }
}

/* ── the loop ──────────────────────────────────────────────────────── */
const curD = $('[data-cur-d]')!, curR = $('[data-cur-r]')!, cur$ = $('[data-cur]')!;
let lastDrawn = -1, blobMoved = true;
type Spring = { g: HTMLElement; x: number; v: number; to: number; done: boolean };
const springs: Spring[] = [];
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (canSmooth && wantSmooth !== SMOOTH && (wantSmooth || Math.abs(target - cur) < 0.5)) setSmooth(wantSmooth);
  const k = SMOOTH ? damp(0.085, dt) : 1;
  cur = Math.abs(target - cur) < 0.05 ? target : lerp(cur, target, k);
  smx = lerp(smx, mx, 0.06); smy = lerp(smy, my, 0.06);
  if (fine) {
    rx = lerp(rx, cx, 0.18); ry = lerp(ry, cy, 0.18); curScale = lerp(curScale, hoverScale, 0.15);
    curD.style.transform = `translate3d(${cx}px,${cy}px,0)`;
    curR.style.transform = `translate3d(${rx}px,${ry}px,0) scale(${curScale})`;
    const nbx = lerp(bx, cx, 0.1), nby = lerp(by, cy, 0.1);
    if (Math.abs(nbx - bx) + Math.abs(nby - by) > 0.1 || blobMoved) { bx = nbx; by = nby; blob.style.transform = `translate3d(${bx}px,${by}px,0)`; blobMoved = false; }
  }
  // gallery throws
  for (const s of springs) {
    if (s.done) continue;
    const a = -170 * (s.x - s.to) - 26 * s.v;
    s.v += a * dt; s.x += s.v * dt;
    if (Math.abs(s.x - s.to) < 0.5 && Math.abs(s.v) < 5) { s.x = s.to; s.done = true; }
    s.g.scrollLeft = s.x;
  }
  const moved = forceDraw || Math.abs(cur - lastDrawn) > 0.01 || Math.abs(smx - mx) > 0.002 || Math.abs(smy - my) > 0.002;
  if (!moved) return;
  forceDraw = false; lastDrawn = cur;
  if (small || reduce) drawMobile(cur); else drawDesktop(cur);
  if (!small) pillScroll(cur);
}

/* ── chapter navigation ────────────────────────────────────────────── */
const anchors = () => [0, ...chapters.map((c) => c.top), indexTop];
function go(i: number) { const a = anchors(); i = clamp(i, 0, a.length - 1); scrollTo({ top: a[i], behavior: SMOOTH || reduce ? 'auto' : 'smooth' }); }
function current() { const a = anchors(); let i = 0; for (let k = 0; k < a.length; k++) if (target >= a[k] - 2) i = k; return i; }
dots.forEach((d) => d.addEventListener('click', () => go(+d.dataset.go!)));
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || small || (e.target as HTMLElement).closest('input, textarea')) return;
  const onReel = target >= chapters[0].top - vh && target < indexTop;
  if (!onReel) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(current() + 1); }
  else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(current() - 1); }
  else if (e.key === 'Home') { e.preventDefault(); go(0); }
  else if (e.key === 'End') { e.preventDefault(); go(5); }
});

/* ── the cursor ────────────────────────────────────────────────────── */
if (fine && !reduce) {
  html.classList.add('hascur');
  document.addEventListener('mouseover', (e) => {
    const t = e.target as HTMLElement;
    hoverScale = t.closest('a, button, label') ? 2.1 : 1;
    cur$.classList.toggle('off', !!t.closest('.gallery, .pol, .reset'));
  });
}

/* ── the rows ──────────────────────────────────────────────────────── */
const spreads = $$('[data-spread]');
const root = html;
const accentOf = (s: HTMLElement) => getComputedStyle(s).getPropertyValue('--c').trim();
const openAccent = () => { const o = spreads.find((s) => s.classList.contains('open')); root.style.setProperty('--accent', o ? accentOf(o) : getComputedStyle(root).getPropertyValue('--vb').trim()); };
spreads.forEach((s) => {
  s.addEventListener('pointerenter', () => root.style.setProperty('--accent', accentOf(s)));
  s.addEventListener('pointerleave', openAccent);
});
const galleryIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); galleryIO.unobserve(e.target); } }), { threshold: 0, rootMargin: '0px 0px -8% 0px' });
const onEnd = (panel: HTMLElement, fn: () => void) => { const h = (e: TransitionEvent) => { if (e.propertyName === 'height') { panel.removeEventListener('transitionend', h); fn(); } }; panel.addEventListener('transitionend', h); };
const closeRow = (s: HTMLElement) => {
  const panel = $('[data-panel]', s)!;
  panel.style.height = panel.scrollHeight + 'px'; panel.getBoundingClientRect();
  requestAnimationFrame(() => { panel.style.height = '0px'; });
  s.classList.remove('open'); $('[data-row]', s)!.setAttribute('aria-expanded', 'false');
};
const openRow = (s: HTMLElement, animate = true) => {
  const panel = $('[data-panel]', s)!;
  s.classList.add('open'); $('[data-row]', s)!.setAttribute('aria-expanded', 'true');
  if (!animate || reduce) { panel.style.transition = 'none'; panel.style.height = 'auto'; panel.getBoundingClientRect(); panel.style.transition = ''; }
  else { panel.style.height = panel.scrollHeight + 'px'; onEnd(panel, () => { if (s.classList.contains('open')) panel.style.height = 'auto'; layout(); }); }
  galleryIO.observe($('[data-gallery]', s)!);
};
function toggleRow(s: HTMLElement) {
  const isOpen = s.classList.contains('open');
  spreads.forEach((o) => { if (o !== s && o.classList.contains('open')) closeRow(o); });
  if (isOpen) closeRow(s);
  else { openRow(s); scrollTo({ top: s.getBoundingClientRect().top + scrollY - (small ? 12 : 16 + 56 + 12), behavior: reduce ? 'auto' : 'smooth' }); }
  openAccent();
  setTimeout(layout, 720);
}
spreads.forEach((s) => $('[data-row]', s)!.addEventListener('click', () => toggleRow(s)));
$$('[data-open-row]').forEach((a) => a.addEventListener('click', (e) => {
  const s = spreads.find((x) => x.dataset.spread === a.dataset.openRow); if (!s) return;
  e.preventDefault(); if (!s.classList.contains('open')) toggleRow(s); else scrollTo({ top: s.getBoundingClientRect().top + scrollY - 84, behavior: reduce ? 'auto' : 'smooth' });
  history.replaceState(null, '', `/work/${s.dataset.spread}`);
}));

/* ── the galleries: drag with a mouse, throw to the nearest snap ───── */
$$('[data-gallery]').forEach((g) => {
  let down = false, startX = 0, startL = 0, moved = false, lastX = 0, lastMs = 0, vel = 0;
  let spring: Spring | null = null;
  g.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return;
    down = true; moved = false; startX = lastX = e.clientX; startL = g.scrollLeft; lastMs = performance.now(); vel = 0;
    if (spring) spring.done = true;
    g.classList.add('dragging');
  });
  addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 3) moved = true;
    g.scrollLeft = startL - dx;
    const now = performance.now(); const t = now - lastMs;
    if (t > 0) { vel = lerp(vel, (lastX - e.clientX) / t, 0.5); lastX = e.clientX; lastMs = now; }
  }, { passive: true });
  const up = () => {
    if (!down) return; down = false; g.classList.remove('dragging');
    if (reduce) return;
    const throwTo = g.scrollLeft + vel * 180;
    const snaps = $$<HTMLElement>(':scope > figure', g).map((f) => f.offsetLeft - parseFloat(getComputedStyle(g).paddingLeft));
    const max = g.scrollWidth - g.clientWidth;
    let to = clamp(throwTo, 0, max);
    let best = to, bd = Infinity;
    snaps.forEach((s) => { const d = Math.abs(s - to); if (d < bd) { bd = d; best = s; } });
    to = clamp(best, 0, max);
    spring = { g, x: g.scrollLeft, v: vel * 1000, to, done: false };
    springs.push(spring);
  };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  g.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
});

/* ── the marquee, only when it overflows ───────────────────────────── */
const marquee = $('[data-marquee]')!;
function marqueeCheck() {
  if (reduce) { marquee.classList.remove('run'); return; }
  const first = $('span', marquee)!;
  marquee.classList.add('run');            // measure as one line, then keep it only if it overflows
  if (first.scrollWidth + 40 <= vw) marquee.classList.remove('run');
}
new IntersectionObserver((es) => marquee.classList.toggle('idle', !es[0].isIntersecting)).observe(marquee);

/* ── about: reveal, the pile, the checklist ────────────────────────── */
const upIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); upIO.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
$$('[data-up]').forEach((el) => upIO.observe(el));
const stripEl = $('[data-strip]');
if (stripEl) galleryIO.observe(stripEl);

const pols = $$('[data-pol]');
const rest = pols.map((p) => { const cs = getComputedStyle(p); return { dx: parseFloat(cs.getPropertyValue('--dx')) || 0, dy: parseFloat(cs.getPropertyValue('--dy')) || 0 }; });
let zTop = 10;
pols.forEach((p, i) => {
  let held = false, ox = 0, oy = 0, x = rest[i].dx, y = rest[i].dy, lx = 0, ly = 0, vx = 0, vy = 0, lastMs = 0, raf = 0;
  const rot = parseFloat(getComputedStyle(p).getPropertyValue('--rot')) || 0;
  const paint = (r: number) => { p.style.transform = `translate(${x}px,${y}px) rotate(${r}deg)`; };
  p.addEventListener('pointerdown', (e) => {
    if (small) return;
    held = true; p.setPointerCapture(e.pointerId); p.classList.add('held'); p.classList.remove('settling'); p.style.zIndex = String(++zTop);
    ox = e.clientX - x; oy = e.clientY - y; lx = e.clientX; ly = e.clientY; lastMs = performance.now(); vx = vy = 0;
    cancelAnimationFrame(raf);
  });
  p.addEventListener('pointermove', (e) => {
    if (!held) return;
    const now = performance.now(), t = Math.max(1, now - lastMs);
    vx = lerp(vx, (e.clientX - lx) / t, 0.4); vy = lerp(vy, (e.clientY - ly) / t, 0.4); lx = e.clientX; ly = e.clientY; lastMs = now;
    x = lerp(x, e.clientX - ox, reduce ? 1 : 0.6); y = lerp(y, e.clientY - oy, reduce ? 1 : 0.6);
    paint(rot * 0.6);
  });
  const drop = () => {
    if (!held) return; held = false; p.classList.remove('held');
    if (reduce) { paint(rot); return; }
    let sx = vx * 16, sy = vy * 16;
    const glide = () => {
      sx *= 0.9; sy *= 0.9; x += sx; y += sy;
      const lim = 260; x = clamp(x, -lim, lim); y = clamp(y, -lim, lim);
      paint(rot);
      if (Math.abs(sx) + Math.abs(sy) > 0.2) raf = requestAnimationFrame(glide);
    };
    raf = requestAnimationFrame(glide);
  };
  p.addEventListener('pointerup', drop); p.addEventListener('pointercancel', drop);
  p.addEventListener('reset-pile' as any, () => { cancelAnimationFrame(raf); x = rest[i].dx; y = rest[i].dy; p.classList.add('settling'); p.style.zIndex = ''; paint(rot); });
});
$('[data-reset]')?.addEventListener('click', () => pols.forEach((p) => p.dispatchEvent(new Event('reset-pile'))));

$$<HTMLInputElement>('[data-tick]').forEach((box) => {
  const key = `week-${box.dataset.tick}`;
  try { box.checked = localStorage.getItem(key) === '1'; } catch {}
  box.addEventListener('change', () => { try { localStorage.setItem(key, box.checked ? '1' : '0'); } catch {} });
});

/* ── sparks off a pressed black button ─────────────────────────────── */
if (!reduce) $$('.btn--black').forEach((b) => b.addEventListener('mousedown', (e) => {
  const chars = ['✧', '✦', '☆', '·', '♪'];
  for (let i = 0; i < 8; i++) {
    const s = document.createElement('span'); s.className = 'spark'; s.textContent = chars[i % chars.length];
    const a = Math.random() * Math.PI * 2, r = 34 + Math.random() * 44;
    s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px';
    s.style.setProperty('--dx', Math.cos(a) * r + 'px'); s.style.setProperty('--dy', Math.sin(a) * r - 18 + 'px'); s.style.setProperty('--rot', Math.random() * 80 - 40 + 'deg');
    document.body.appendChild(s); setTimeout(() => s.remove(), 700);
  }
}));

/* ── the phone menu ────────────────────────────────────────────────── */
const burger = $('[data-burger]'), menu = $('[data-menu]');
if (burger && menu) {
  const set = (on: boolean) => { burger.classList.toggle('x', on); burger.setAttribute('aria-expanded', String(on)); menu.classList.toggle('on', on); menu.setAttribute('aria-hidden', String(!on)); };
  burger.addEventListener('click', () => set(!menu.classList.contains('on')));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => set(false)));
}

/* ── boot ──────────────────────────────────────────────────────────── */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
let rt = 0;
addEventListener('resize', () => { clearTimeout(rt); rt = window.setTimeout(() => { layout(); marqueeCheck(); }, 120); });
const fontsReady = document.fonts?.ready ?? Promise.resolve();
fontsReady.then(() => {
  layout(); marqueeCheck();
  target = scrollY; cur = target;
  // /work/<slug>: the row is already open; land on it once the loader is gone
  const openSlug = html.dataset.open;
  if (openSlug) {
    const s = spreads.find((x) => x.dataset.spread === openSlug);
    if (s) { galleryIO.observe($('[data-gallery]', s)!); openAccent(); setTimeout(() => { scrollTo({ top: s.getBoundingClientRect().top + scrollY - (small ? 12 : 84), behavior: 'auto' }); target = scrollY; cur = target; forceDraw = true; }, reduce ? 0 : 950); }
  } else if (location.hash) {
    const t = $(location.hash); if (t) setTimeout(() => { t.scrollIntoView(); target = scrollY; cur = target; forceDraw = true; }, reduce ? 0 : 950);
  }
  requestAnimationFrame(frame);
});
