/* Market Station beat: tiles rise at .05, sparklines walk forever, the curve
   draws at .3, the alert chip walks armed→fired→easing→recovered from .5,
   and the briefing types at .62. The walk is autocorrelated: independent
   random values read as fake in seconds. */
export function initMarket(root: HTMLElement) {
  const tiles = [...root.querySelectorAll<HTMLElement>('[data-ms-tile]')];
  const curve = root.querySelector<SVGElement>('.ms-curve')!;
  const brief = root.querySelector<HTMLElement>('[data-ms-brief]')!;
  const alert = root.querySelector<HTMLElement>('[data-ms-alert]')!;
  const alertTxt = root.querySelector<HTMLElement>('[data-ms-alert-txt]')!;
  const clock = root.querySelector<HTMLElement>('[data-ms-clock]');
  const hint = root.querySelector<HTMLElement>('[data-ms-hint]');

  const series = tiles.map((t) => {
    const base = Number(t.querySelector<HTMLElement>('[data-ms-val]')!.dataset.base);
    const pts: number[] = []; let v = base;
    for (let i = 0; i < 40; i++) { v += (Math.random() - 0.5) * base * 0.02 + (base - v) * 0.08; pts.push(v); }
    return { t, base, v, pts, val: t.querySelector<HTMLElement>('[data-ms-val]')!, raw: t.querySelector<HTMLElement>('[data-ms-raw]')!, poly: t.querySelector<SVGPolylineElement>('[data-ms-spark]')!, dec: (String(base).split('.')[1] || '').length };
  });
  const draw = (s: typeof series[0]) => {
    const min = Math.min(...s.pts), max = Math.max(...s.pts), span = max - min || 1;
    s.poly.setAttribute('points', s.pts.map((p, i) => `${(i / (s.pts.length - 1)) * 100},${26 - ((p - min) / span) * 24}`).join(' '));
    s.val.textContent = s.pts[s.pts.length - 1].toFixed(s.dec); s.raw.textContent = s.pts[s.pts.length - 1].toFixed(s.dec + 2);
  };
  series.forEach(draw);

  let live = false, timer: number | null = null, t0 = 0;
  const tick = () => {
    for (const s of series) { const last = s.pts[s.pts.length - 1]; const next = last + (Math.random() - 0.5) * s.base * 0.003 + (s.base - last) * 0.03; s.pts.push(next); s.pts.shift(); draw(s); }
    if (clock) { const d = new Date(); clock.textContent = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }); }
  };
  const start = () => { if (!live) { live = true; timer = window.setInterval(tick, 1600); } };
  const stop = () => { if (live) { live = false; if (timer) clearInterval(timer); } };

  const states = ['armed', 'fired', 'easing', 'recovered'];
  let stateTimer: number | null = null;
  const walk = () => {
    let i = 0; const step = () => { alert.dataset.state = states[i]; alertTxt.textContent = states[i]; i = (i + 1) % states.length; };
    step(); stateTimer = window.setInterval(step, 1500);
  };
  const stopWalk = () => { if (stateTimer) clearInterval(stateTimer); alert.dataset.state = 'armed'; alertTxt.textContent = 'armed'; };

  const text = 'Volatility is asleep and breadth is thinning: 58% of the S&P is above its 50-day, down from 71% a month ago. Credit is calm. Nothing fires today; the watch is on breadth.';
  let typing: number | null = null, typedOnce = false;
  const typeBrief = () => { if (typedOnce) return; typedOnce = true; let i = 0; typing = window.setInterval(() => { brief.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(typing!); }, 18); };

  const beats = [
    { at: 0.04, on: () => { tiles.forEach((t) => t.classList.add('is-in')); start(); }, off: () => { tiles.forEach((t) => t.classList.remove('is-in')); } },
    { at: 0.3, on: () => curve.classList.add('is-in'), off: () => curve.classList.remove('is-in') },
    { at: 0.5, on: walk, off: stopWalk },
    { at: 0.62, on: () => { typeBrief(); hint?.classList.add('is-in'); }, off: () => {} },
  ].map((b) => ({ ...b, state: false }));

  return {
    set(p: number) { for (const b of beats) { const want = p >= b.at; if (want !== b.state) { b.state = want; want ? b.on() : b.off(); } } },
    leave() { stop(); stopWalk(); t0 = 0; },
    enter() { start(); },
    cta() { tiles[0]?.focus(); },
  };
}
