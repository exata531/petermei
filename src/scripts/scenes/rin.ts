/* the Rin terminal: a prompt that waits. Return on an empty line plays the one
   scripted command, and after that the keys are yours. Commands are a small
   honest set; nothing here is live. */

const script = {
  cmd: '/daily',
  out: '<span class="dim">saturday. two things with teeth:</span>\n  · physics set, <span class="amber">due monday</span>\n  · essay, cut to 650 words\n<span class="dim">calendar:</span> climbing 4pm. nothing else. go.',
};
const answers: Record<string, string> = {
  help: '<span class="dim">commands:</span> /daily  /grades  /sat  whoami  clear',
  '/daily': '<span class="dim">already ran it. scroll up.</span>\n<span class="dim">fine:</span> physics set monday, essay to 650, climbing 4pm.',
  '/grades': '<span class="dim">nothing published yet. summer.</span> the tracker is ready when they are.',
  '/sat': 'score pending. retake booked. <span class="dim">the 1400 is coming.</span>',
  whoami: 'peter. senior. builder.\n<span class="dim">and me, the bookkeeper in the menu bar.</span>',
  clear: '',
};

export function initRin(root: HTMLElement) {
  const out = root.querySelector<HTMLElement>('[data-term-out]')!;
  const inp = root.querySelector<HTMLElement>('[data-term-in]')!;
  const real = root.querySelector<HTMLInputElement>('[data-term-real]')!;
  const term = root.querySelector<HTMLElement>('[data-term]')!;
  const hint = root.querySelector<HTMLElement>('[data-rin-hint]');
  const light = root.querySelector<HTMLElement>('[data-rin-light]');
  const face = root.querySelector<HTMLElement>('[data-rin-face]');

  let played = false, busy = false;

  const typeCmd = (s: string, done: () => void) => {
    let i = 0; inp.textContent = '';
    const t = setInterval(() => { inp.textContent = s.slice(0, ++i); if (i >= s.length) { clearInterval(t); setTimeout(done, 240); } }, 50);
  };
  const print = (html: string, cls = '') => {
    const d = document.createElement('div'); d.className = cls; d.innerHTML = html; out.appendChild(d);
    term.scrollTop = term.scrollHeight;
  };
  const run = () => {
    if (played || busy) return;
    played = true; busy = true;
    hint?.classList.add('is-off');
    light?.classList.add('is-amber');
    typeCmd(script.cmd, () => {
      print(`<span class="term-ps">❯</span> <span class="cmd">${script.cmd}</span>`); inp.textContent = '';
      setTimeout(() => {
        print(script.out);
        light?.classList.remove('is-amber');
        if (face) face.textContent = '(￣ヮ￣)';
        busy = false;
      }, 380);
    });
  };
  const submit = () => {
    const v = real.value.trim(); real.value = ''; inp.textContent = '';
    if (!v) { run(); return; }
    hint?.classList.add('is-off');
    print(`<span class="term-ps">❯</span> <span class="cmd">${v.replace(/</g, '&lt;')}</span>`);
    if (v === 'clear') { out.innerHTML = ''; return; }
    const a = answers[v.toLowerCase()];
    setTimeout(() => print(a ?? `<span class="dim">unknown: ${v.replace(/</g, '&lt;')}.</span> try <span class="cmd">help</span>.`), 220);
  };
  term.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-rin-hint]')) { run(); }
    real.focus();
  });
  real.addEventListener('input', () => { inp.textContent = real.value; });
  real.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') real.blur(); });

  return {
    run,
    leave() { real.blur(); },
  };
}
