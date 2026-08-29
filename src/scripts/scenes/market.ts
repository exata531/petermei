/* Market Station: sparklines that walk while the window is open and stop
   when it closes, and an alert chip that runs its state machine once when
   pressed, sending the desktop the same banner the phone would get. The
   walk is autocorrelated: independent random values read as fake in seconds. */
export function initMarket(root: HTMLElement) {
  const tiles = [...root.querySelectorAll<HTMLElement>('[data-ms-tile]')];
  const alert = root.querySelector<HTMLElement>('[data-ms-alert]')!;
  const alertTxt = root.querySelector<HTMLElement>('[data-ms-alert-txt]')!;
  const clock = root.querySelector<HTMLElement>('[data-ms-clock]');

  const series = tiles.map((t) => {
    const base = Number(t.querySelector<HTMLElement>('[data-ms-val]')!.dataset.base);
    const pts: number[] = []; let v = base;
    for (let i = 0; i < 40; i++) { v += (Math.random() - 0.5) * base * 0.02 + (base - v) * 0.08; pts.push(v); }
    return { t, base, pts, val: t.querySelector<HTMLElement>('[data-ms-val]')!, raw: t.querySelector<HTMLElement>('[data-ms-raw]')!, poly: t.querySelector<SVGPolylineElement>('[data-ms-spark]')!, dec: (String(base).split('.')[1] || '').length };
  });
  const draw = (s: typeof series[0]) => {
    const min = Math.min(...s.pts), max = Math.max(...s.pts), span = max - min || 1;
    s.poly.setAttribute('points', s.pts.map((p, i) => `${(i / (s.pts.length - 1)) * 100},${26 - ((p - min) / span) * 24}`).join(' '));
    s.val.textContent = s.pts[s.pts.length - 1].toFixed(s.dec); s.raw.textContent = s.pts[s.pts.length - 1].toFixed(s.dec + 2);
  };
  series.forEach(draw);
  const paintClock = () => { if (clock) clock.textContent = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }); };
  paintClock();

  let timer: number | null = null;
  const tick = () => {
    for (const s of series) { const last = s.pts[s.pts.length - 1]; const next = last + (Math.random() - 0.5) * s.base * 0.003 + (s.base - last) * 0.03; s.pts.push(next); s.pts.shift(); draw(s); }
    paintClock();
  };
  const start = () => { if (timer === null) timer = window.setInterval(tick, 1600); };
  const stop = () => { if (timer !== null) { clearInterval(timer); timer = null; } };

  const states = ['fired', 'easing', 'recovered', 'armed'];
  let walking = false;
  const walk = () => {
    if (walking) return;
    walking = true;
    let i = 0;
    const step = () => {
      alert.dataset.state = states[i]; alertTxt.textContent = states[i];
      alert.setAttribute('aria-label', `Alert state: ${states[i]}`);
      if (states[i] === 'fired') {
        root.dispatchEvent(new CustomEvent('ms:alert', { bubbles: true, detail: { title: 'Market Station', text: 'S&P breadth fell under 55%. Fewer stocks are holding the index up.' } }));
      }
      i++;
      if (i < states.length) setTimeout(step, 1500);
      else { walking = false; alert.setAttribute('aria-label', 'Alert state: armed. Press to test the alert.'); }
    };
    step();
  };
  alert.addEventListener('click', walk);

  return {
    enter() { start(); },
    leave() { stop(); },
    run() { walk(); },
  };
}
