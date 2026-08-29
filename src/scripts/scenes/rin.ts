/* the Rin beat: panel drops at .08, /daily types itself from .2, then the
   terminal is yours. Commands are a small honest set; nothing here is live. */
import gsap from 'gsap';

const script = [
  { cmd: '/daily' },
  { out: '<span class="dim">saturday. two things with teeth:</span>\n  · physics set, <span class="amber">due monday</span>\n  · essay, cut to 650 words\n<span class="dim">calendar:</span> climbing 4pm. nothing else. go.' },
];
const answers: Record<string, string> = {
  help: '<span class="dim">commands:</span> /daily  /grades  /sat  whoami  clear',
  '/daily': '<span class="dim">already ran it. scroll up.</span>\n<span class="dim">fine:</span> physics set monday, essay to 650, climbing 4pm.',
  '/grades': '<span class="dim">nothing published yet. summer.</span> the tracker is ready when they are.',
  '/sat': 'score pending. retake booked. <span class="dim">the 1400 is coming.</span>',
  whoami: 'peter. senior. builder.\n<span class="dim">and me, the bookkeeper in the menu bar.</span>',
  clear: '',
};

export function initRin(root: HTMLElement) {
  const panel = root.querySelector<HTMLElement>('[data-rin-panel]')!;
  const out = root.querySelector<HTMLElement>('[data-term-out]')!;
  const inp = root.querySelector<HTMLElement>('[data-term-in]')!;
  const real = root.querySelector<HTMLInputElement>('[data-term-real]')!;
  const term = root.querySelector<HTMLElement>('[data-term]')!;
  const hint = root.querySelector<HTMLElement>('[data-rin-hint]');
  const light = root.querySelector<HTMLElement>('[data-rin-light]');
  const face = root.querySelector<HTMLElement>('[data-rin-face]');

  let dropped = false, typed = false, owned = false;
  const drop = gsap.to(panel, { y: 0, duration: 0.9, ease: 'expo.out', paused: true });

  const typeCmd = (s: string, done: () => void) => {
    let i = 0; inp.textContent = '';
    const t = setInterval(() => { inp.textContent = s.slice(0, ++i); if (i >= s.length) { clearInterval(t); setTimeout(done, 260); } }, 55);
  };
  const print = (html: string, cls = '') => {
    const d = document.createElement('div'); d.className = cls; d.innerHTML = html; out.appendChild(d);
    out.scrollTop = out.scrollHeight;
  };
  const runDemo = () => {
    if (typed) return; typed = true;
    light?.classList.add('is-amber');
    typeCmd(script[0].cmd!, () => {
      print(`<span class="term-ps">❯</span> <span class="cmd">${script[0].cmd}</span>`); inp.textContent = '';
      setTimeout(() => { print(script[1].out!); light?.classList.remove('is-amber'); if (face) face.textContent = '(￣ヮ￣)'; }, 420);
    });
  };
  const submit = () => {
    const v = real.value.trim(); real.value = ''; inp.textContent = '';
    if (!v) return;
    print(`<span class="term-ps">❯</span> <span class="cmd">${v.replace(/</g, '&lt;')}</span>`);
    if (v === 'clear') { out.innerHTML = ''; return; }
    const a = answers[v.toLowerCase()];
    setTimeout(() => print(a ?? `<span class="dim">unknown: ${v.replace(/</g, '&lt;')}.</span> try <span class="cmd">help</span>.`), 240);
  };
  term.addEventListener('click', () => { real.focus(); owned = true; hint?.classList.add('is-off'); });
  real.addEventListener('input', () => { inp.textContent = real.value; });
  real.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') real.blur(); });
  real.addEventListener('blur', () => { owned = false; });

  return {
    set(p: number) {
      if (p >= 0.08 && !dropped) { dropped = true; drop.play(); }
      if (p < 0.04 && dropped) { dropped = false; drop.reverse(); }
      if (p >= 0.22) runDemo();
    },
    leave() { if (owned) real.blur(); },
    cta() { term.click(); },
  };
}
