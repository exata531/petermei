/* Terminal.app.

   A real prompt over a small pretend file system: the Read Me, the Pictures
   folder, one project folder per product, and a couple of honest jokes in
   the filenames. The commands are the ones a hand tries first: help, ls, cd,
   cat, open (which really opens the window), neofetch (whose every line is
   true), say, date, clear. The up arrow walks the history, Tab completes,
   and a command that does not exist earns the error sound and the zsh line.
   The transcript is kept for the tab session. Nothing typed here leaves the
   page.

   Two words it answers are in neither help nor Tab: `hello`, which is the
   first thing a Macintosh ever wrote on its own screen, and `moof`, which is
   what the dogcow says. A person who has read the machine's history types
   them; nobody else finds them, which is the point. */
import { load, save, esc } from '../scenes/state';
import { secrets } from './secrets';
import { hello as helloArt, gridEl } from '../../data/pixels-eggs';

type Dir = { [name: string]: Dir | string[] };
type St = { hist: string[]; lines: string[] };

export type TermHooks = {
  open(id: string): void;
  bonk(): void;
  photos: { n: string; a: string; p: string }[];
  build: { commit: string; astro: string; date: string; mb: number };
};

const KEY = 'pm-term';
const seed = (): St => ({ hist: [], lines: [] });

const dim = (s: string) => `<span class="dim">${s}</span>`;

/* what `open` knows how to open, and what the window is called */
const OPENS: Record<string, [string, string]> = {
  volbase: ['volbase', 'volbase'], navigator: ['safari', 'Navigator'], safari: ['safari', 'Navigator'], kyou: ['kyou', 'Kyou'],
  market: ['market', 'Market Station'], 'market station': ['market', 'Market Station'],
  'market-station': ['market', 'Market Station'],
  rin: ['rin', 'Rin'], photos: ['photos', 'Photos'], finder: ['finder', 'Macintosh HD'],
  about: ['doc-peter', 'the Peter document'], simpletext: ['textedit', 'SimpleText'], textedit: ['textedit', 'SimpleText'],
  'read me': ['textedit', 'the Read Me'], readme: ['textedit', 'the Read Me'], trash: ['trash', 'the Trash'],
  stickies: ['stickies', 'Stickies'], 'petermei.com': ['safari', 'petermei.com'], site: ['safari', 'petermei.com'],
};

export function initTerminal(root: HTMLElement, hooks: TermHooks) {
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const out = $('[data-vt-out]');
  const scroll = $('[data-vt-scroll]');
  const mirror = $('[data-vt-mirror]');
  const ps = $('[data-vt-ps]');
  const real = $<HTMLInputElement>('[data-vt-in]');

  const opened = performance.now();
  const st = load<St>(KEY, seed);
  const put = () => save(KEY, st);

  /* ── the file system, all of it pretend and all of it honest ────────── */
  const pictures: Dir = {};
  for (const p of hooks.photos) pictures[p.n] = [`a photograph: ${p.a} (${p.p}.)`, `open Photos to see it bigger.`];
  const FS: Dir = {
    'Read Me': [], /* filled by the page: the same lines SimpleText shows */
    'homework.txt': ['not on this Mac.'],
    Pictures: pictures,
    Projects: {
      volbase: {
        'README.md': ['a marketplace where students find volunteer and internship openings near them.', 'live at volbase.app, with real users. try: open volbase'],
        node_modules: { 'README.md': ['several hundred megabytes of other people\'s code.', 'not listing it.'] },
      },
      rin: {
        'README.md': ['a Mac app that drops an assistant down from the menu bar.', 'free and open source. the tabs survive quitting. try: open rin'],
      },
      kyou: {
        'README.md': ['an iPhone planner that puts the whole day on one timeline.', 'try: open kyou'],
        'todo.txt': ['the habits page, then the App Store.'],
      },
      'market-station': {
        'README.md': ['a dashboard that watches the market all day for one reader at home.', 'running since August. try: open market'],
        'alerts.log': ['one alert per crossing.'],
      },
      'first-robotics': {
        'robot-v1.stl': ['fell apart after most matches.', 'went to Worlds anyway.'],
      },
    },
    'old versions.txt': ['they are in the Trash.'],
  };

  let cwd: string[] = [];

  const dirAt = (path: string[]): Dir | null => {
    let d: Dir | string[] = FS;
    for (const part of path) {
      if (Array.isArray(d) || !(part in d)) return null;
      d = d[part];
    }
    return Array.isArray(d) ? null : d;
  };
  const isDir = (v: Dir | string[] | undefined): v is Dir => !!v && !Array.isArray(v);

  /* resolve a typed path against the cwd; "" means the cwd itself */
  const resolve = (raw: string): { path: string[]; node: Dir | string[] } | null => {
    let parts: string[];
    let base: string[];
    const t = raw.trim();
    if (t === '') { parts = []; base = [...cwd]; }
    else if (t === '~') { parts = []; base = []; }
    else if (t.startsWith('~/')) { base = []; parts = t.slice(2).split('/'); }
    else if (t.startsWith('/')) { base = []; parts = t.slice(1).split('/'); }
    else { base = [...cwd]; parts = t.split('/'); }
    const path = [...base];
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') { path.pop(); continue; }
      path.push(part);
    }
    /* case-insensitive match, the way a Mac's file system reads */
    let d: Dir | string[] = FS;
    const fixed: string[] = [];
    for (const part of path) {
      if (Array.isArray(d)) return null;
      const hit = Object.keys(d).find((k) => k.toLowerCase() === part.toLowerCase());
      if (!hit) return null;
      fixed.push(hit);
      d = d[hit];
    }
    return { path: fixed, node: d };
  };

  const psText = () => `visitor@petermei ${cwd.length ? cwd[cwd.length - 1] : '~'} %`;

  /* ── output ─────────────────────────────────────────────────────────── */
  const paint = () => {
    out.innerHTML = st.lines.join('\n');
    ps.textContent = psText();
    scroll.scrollTop = scroll.scrollHeight;
  };
  const say = (html: string) => { if (html) st.lines.push(html); put(); paint(); };

  const list = (d: Dir) => {
    const names = Object.keys(d);
    if (!names.length) return dim('(empty)');
    return names
      .map((n) => (isDir(d[n]) ? `<span class="term-dir">${esc(n)}/</span>` : esc(n)))
      .join('   ');
  };

  const HELP = [
    `${dim('the commands this Mac answers:')}`,
    `  help                ${dim('this list')}`,
    `  ls ${dim('[folder]')}         ${dim('what is in a folder')}`,
    `  cd ${dim('[folder]')}         ${dim('go there (cd .. goes back)')}`,
    `  cat ${dim('&lt;file&gt;')}          ${dim('read a file')}`,
    `  open ${dim('&lt;app&gt;')}          ${dim('really opens it: volbase, rin, kyou, market, photos...')}`,
    `  neofetch            ${dim('this machine')}`,
    `  say ${dim('&lt;words&gt;')}         ${dim('the Mac says them out loud')}`,
    `  date, clear, pwd, whoami, history`,
  ].join('\n');

  const neofetch = () => {
    const up = Math.max(1, Math.round((performance.now() - opened) / 1000));
    const upTxt = up < 60 ? `${up} secs` : `${Math.floor(up / 60)} min${up % 60 ? ` ${up % 60} secs` : ''}`;
    /* Drawn with characters Monaco 9 actually carries. The box-drawing set
       and the kaomoji are not in the face, so the old art was silently
       falling back to a system font mid-window, at the wrong width. */
    const art = [
      '+-----------+ ',
      '| +-------+ | ',
      '| |       | | ',
      '| | o   o | | ',
      '| |       | | ',
      '| | \\___/ | | ',
      '| +-------+ | ',
      '+--[_____]--+ ',
    ];
    const facts: [string, string][] = [
      ['OS', 'petermei.com'],
      ['Host', 'Vercel'],
      ['Kernel', `Astro ${hooks.build.astro}`],
      ['Uptime', upTxt],
      ['Shell', 'not really zsh'],
      ['Resolution', `${innerWidth}x${innerHeight}`],
      ['Commit', hooks.build.commit],
      ['Built', hooks.build.date],
      ['Photos', String(hooks.photos.length)],
      ['Weight', `${hooks.build.mb} MB`],
    ];
    const head = `<b class="term-acc">visitor</b>@<b class="term-acc">petermei.com</b>`;
    const rows = [head, dim('-'.repeat(20)), ...facts.map(([k, v]) => `<b class="term-acc">${k}</b>${' '.repeat(Math.max(1, 11 - k.length))}${esc(v)}`)];
    return art.map((a, i) => `<span class="term-art">${a}</span>${rows[i] ?? ''}`).join('\n') +
      (rows.length > art.length ? '\n' + rows.slice(art.length).map((r) => ' '.repeat(14) + r).join('\n') : '');
  };

  /* ── the commands ───────────────────────────────────────────────────── */
  /* a hand with shell habits quotes a name that has a space in it, so a
     matched pair of surrounding quotes comes off before anything looks it up */
  const unquote = (s: string) => s.replace(/^(['"])([\s\S]*)\1$/, '$2');

  const run = (raw: string): string => {
    const [cmd, ...restA] = raw.trim().split(/\s+/);
    const rest = unquote(raw.trim().slice(cmd.length).trim());
    const c = cmd.toLowerCase();
    switch (c) {
      case 'help': case '?': return HELP;
      case 'ls': {
        const r = resolve(rest);
        if (!r) return `ls: ${esc(rest)}: No such file or directory`;
        if (Array.isArray(r.node)) return esc(r.path[r.path.length - 1]);
        return list(r.node);
      }
      case 'cd': {
        const r = resolve(rest);
        if (!r) return `cd: no such file or directory: ${esc(rest)}`;
        if (Array.isArray(r.node)) return `cd: not a directory: ${esc(rest)}`;
        cwd = r.path;
        return '';
      }
      case 'pwd': return `/Users/visitor${cwd.length ? '/' + cwd.join('/') : ''}`;
      case 'cat': {
        if (!rest) return 'usage: cat &lt;file&gt;';
        const r = resolve(rest);
        if (!r) return `cat: ${esc(rest)}: No such file or directory`;
        if (!Array.isArray(r.node)) return `cat: ${esc(rest)}: Is a directory`;
        return r.node.map(esc).join('\n') || dim('(an empty file)');
      }
      case 'open': {
        if (!rest) return 'usage: open &lt;app&gt;';
        const k = rest.toLowerCase().replace(/\s+app$/, '');
        const hit = OPENS[k] ?? OPENS[Object.keys(OPENS).find((x) => k.includes(x)) ?? ''];
        if (!hit) return `open: ${esc(rest)}: nothing by that name on this Mac. ${dim('try: open volbase')}`;
        hooks.open(hit[0]);
        return `opening ${hit[1]}.`;
      }
      case 'neofetch': return neofetch();
      case 'say': {
        if (!rest) return 'usage: say &lt;words&gt;';
        try {
          const u = new SpeechSynthesisUtterance(rest.slice(0, 200));
          speechSynthesis.speak(u);
          return dim(`the Mac says: `) + `“${esc(rest)}”`;
        } catch {
          return dim('no speech in this browser. it would have said: ') + `“${esc(rest)}”`;
        }
      }
      case 'date': return new Date().toString();
      case 'clear': st.lines = []; put(); paint(); return '';
      case 'whoami': return 'visitor';
      case 'echo': return esc(rest);
      case 'uname': return `petermei.com (Astro ${hooks.build.astro} on Vercel)`;
      case 'history': return st.hist.map((h, i) => `  ${i + 1}  ${esc(h)}`).join('\n') || dim('(no history yet)');
      case 'sudo': return `visitor is not in the sudoers file. this incident will not be reported.`;
      case 'exit': return dim('the red light, top left.');
      case 'rm': return `rm: no.`;
      case 'vim': case 'nano': case 'emacs': return `${c}: the only editable file here is the Read Me, and SimpleText has it.`;
      case 'git': return `git: the repository is the site. ${dim('neofetch has the commit.')}`;
      /* the first word a Macintosh wrote on its own screen, in 1984, in the
         hand it wrote it in. Not in help, and Tab will not find it. */
      case 'hello': case 'hello.': {
        secrets.found('hello');
        return `${gridEl(helloArt, 'term-pix')}\nThe first Mac wrote that on its screen in 1984. This one can too.`;
      }
      /* the dogcow's one word, answered as a courtesy. It does not count:
         hers is in the Finder, where she actually lives. */
      case 'moof': return 'Moof!';
      default:
        hooks.bonk();
        return `zsh: command not found: ${esc(cmd)}`;
    }
  };

  /* ── the prompt ─────────────────────────────────────────────────────── */
  let hi = -1;   // where the up arrow is in the history
  const submit = (raw: string) => {
    const v = raw.trim();
    real.value = ''; mirror.textContent = '';
    hi = -1;
    if (!v) { say(`<span class="term-ps">${esc(psText())}</span>`); return; }
    secrets.found('terminal');
    if (st.hist[st.hist.length - 1] !== v) st.hist.push(v);
    if (st.hist.length > 100) st.hist.shift();
    const echoLine = `<span class="term-ps">${esc(psText())}</span> ${esc(v)}`;
    const outLine = run(v);
    say(outLine ? `${echoLine}\n${outLine}` : echoLine);
  };

  const complete = () => {
    const v = real.value;
    const at = v.lastIndexOf(' ');
    const head = v.slice(0, at + 1);
    const tail = v.slice(at + 1);
    if (!tail) return;
    let pool: string[];
    if (at < 0) {
      pool = ['help', 'ls', 'cd', 'cat', 'open', 'neofetch', 'say', 'date', 'clear', 'pwd', 'whoami', 'echo', 'history'];
    } else if (/^open\s/i.test(v)) {
      pool = Object.keys(OPENS);
    } else {
      /* complete a path against its own folder */
      const slash = tail.lastIndexOf('/');
      const dirPart = slash >= 0 ? tail.slice(0, slash + 1) : '';
      const r = resolve(dirPart);
      if (!r || Array.isArray(r.node)) return;
      const frag = tail.slice(slash + 1);
      const hits = Object.keys(r.node).filter((k) => k.toLowerCase().startsWith(frag.toLowerCase()));
      if (hits.length === 1) {
        const full = dirPart + hits[0] + (isDir((r.node as Dir)[hits[0]]) ? '/' : '');
        real.value = head + full;
        mirror.textContent = real.value;
      } else if (hits.length > 1) {
        say(`<span class="term-ps">${esc(psText())}</span> ${esc(v)}\n${hits.map(esc).join('   ')}`);
      }
      return;
    }
    const hits = pool.filter((k) => k.toLowerCase().startsWith(tail.toLowerCase()));
    if (hits.length === 1) { real.value = head + hits[0] + ' '; mirror.textContent = real.value; }
    else if (hits.length > 1) say(`<span class="term-ps">${esc(psText())}</span> ${esc(v)}\n${hits.map(esc).join('   ')}`);
  };

  real.addEventListener('input', () => { mirror.textContent = real.value; });
  real.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { submit(real.value); return; }
    if (e.key === 'Tab') { e.preventDefault(); complete(); return; }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!st.hist.length) return;
      hi = hi < 0 ? st.hist.length - 1 : Math.max(0, hi - 1);
      real.value = st.hist[hi]; mirror.textContent = real.value;
      requestAnimationFrame(() => real.setSelectionRange(real.value.length, real.value.length));
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (hi < 0) return;
      hi++;
      if (hi >= st.hist.length) { hi = -1; real.value = ''; }
      else real.value = st.hist[hi];
      mirror.textContent = real.value;
      return;
    }
    if (e.key === 'Escape') real.blur();
  });
  root.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('a')) real.focus({ preventScroll: true });
  });

  /* the first frame prints a used window rather than one line on a blank sheet:
     who you are, what this is, and the four commands worth trying first */
  if (!st.lines.length) {
    st.lines.push(
      `${dim('Last login: never.')}`,
      `This is a small shell I wrote for this desktop, and every command below really runs.`,
      `Try <b class="term-acc">ls</b> to see what is here, <b class="term-acc">cat</b> a file to read it, <b class="term-acc">open kyou</b> to launch an app, or <b class="term-acc">neofetch</b> for the machine.`,
      `${dim('Type')} <b class="term-acc">help</b> ${dim('for the whole list.')}`,
    );
  }
  paint();

  return {
    focus() { real.focus({ preventScroll: true }); },
    blur() { real.blur(); },
    setReadme(lines: string[]) { (FS['Read Me'] as string[]).splice(0, 0, ...lines); },
  };
}
