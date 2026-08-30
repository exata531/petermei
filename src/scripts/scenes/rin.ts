/* Rin, answering.

   The real app runs a terminal with a whole notes folder open behind it.
   This one runs a script: a short list of things a visitor would try, each
   answered in her voice, with the facts taken from the same file the rest of
   the desktop reads. Some answers do something to the Mac around the panel
   (open an app, switch the appearance, put it to sleep); those go up as
   events and the desktop does the rest. Tabs are sessions: each keeps its own
   transcript, and all of it is kept for the tab session. Nothing typed here
   leaves the page. She never speaks first. */
import { load, save, esc } from './state';
import { blurbs, links } from '../../data/apps';

type Tab = { name: string; lines: string[]; n: number };
type State = { tabs: Tab[]; active: number; seq: number };
const KEY = 'rin';
const seed = (): State => ({ tabs: [{ name: 'brain', lines: [], n: 1 }, { name: 'school', lines: [], n: 2 }], active: 0, seq: 2 });

const dim = (s: string) => `<span class="dim">${s}</span>`;
const cmd = (s: string) => `<span class="cmd">${s}</span>`;
const TRY = ['help', 'who is peter', 'what is on the desktop', 'open kyou', 'what is volbase', 'dark', 'sleep'];
const OPENS: Record<string, [string, string]> = {
  volbase: ['volbase', 'volbase'], safari: ['safari', 'Safari'], kyou: ['kyou', 'Kyou'], market: ['market', 'Market Station'], 'market station': ['market', 'Market Station'],
  photos: ['photos', 'Photos'], pictures: ['photos', 'Photos'], 'read me': ['textedit', 'the Read me'], readme: ['textedit', 'the Read me'], textedit: ['textedit', 'TextEdit'],
  finder: ['finder', 'Finder'], about: ['finder', 'About Peter'], 'about peter': ['finder', 'About Peter'], peter: ['finder', 'About Peter'], trash: ['trash', 'the Trash'], site: ['safari', 'petermei.com'], 'petermei.com': ['safari', 'petermei.com'], github: ['github', 'GitHub'],
};

export function initRin(root: HTMLElement) {
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const out = $('[data-term-out]'), inp = $('[data-term-in]'), real = $<HTMLInputElement>('[data-term-real]'), term = $('[data-term]');
  const tabsEl = $('[data-rin-tabs]'), tryList = $('[data-rin-try-list]'), light = $('[data-rin-light]'), face = $('[data-rin-face]');
  const st = load<State>(KEY, seed);
  const put = () => save(KEY, st);
  const tab = () => st.tabs[st.active];

  const emit = (type: string, detail: unknown) => root.dispatchEvent(new CustomEvent(type, { bubbles: true, detail }));
  const mood = (f: string) => { face.textContent = f; emit('rin:face', f); };

  /* ── what she answers ── */
  const HELP = `${dim('things I answer:')}\n  who is peter · who are you · what is on the desktop\n  what is volbase · what is rin · what is kyou · what is market station\n  open ${dim('<volbase, kyou, market station, photos, read me, about, safari>')}\n  dark · light · sleep · lock · date · clear\n${dim('type one, or tap one under the prompt. anything else gets a shrug.')}`;
  const answer = (raw: string): { html: string; face?: string; act?: () => void } => {
    const q = raw.toLowerCase().replace(/[?!.]+$/g, '').replace(/\s+/g, ' ').trim();
    const has = (...w: string[]) => w.some((x) => q === x || q.startsWith(x + ' ') || q.includes(' ' + x));
    if (q === 'help' || q === '?' || q === 'commands' || has('what can you do', 'what do you do', 'what can i')) return { html: HELP, face: '(￣ヮ￣)' };
    if (q === 'clear') return { html: '', act: () => { tab().lines = []; put(); paintOut(); } };
    if (has('who is peter', 'who made this', 'who built this', 'whose mac', 'about peter', 'who is he')) return { html: `Peter Mei. senior at the school, outside Detroit. makes software, taught himself from the docs, mostly by getting it wrong first. everything on this desktop is his. ${dim('the long version is in About Peter. say')} ${cmd('open about')}${dim('.')}`, face: '(￣ヮ￣)' };
    if (has('who are you', 'what are you', 'are you real', 'are you an ai', 'are you ai', 'what is rin', 'whats rin', "what's rin") && !has('open')) return { html: `Rin. the assistant in his menu bar. ${blurbs.rin.replace('Rin is a', 'the real one is a')} ${dim('here I run on a script, not a model, so I answer a short list and nothing typed leaves the page.')} (¬‿¬)`, face: '(¬‿¬)' };
    if (has('what is on the desktop', "what's on the desktop", 'whats on the desktop', 'what is here', "what's here", 'whats here', 'desktop', 'what can i open', 'what is on this mac', 'apps')) return { html: `four apps: volbase in Safari, me up here, Kyou in the Simulator, Market Station as a dashboard. also Photos (48 of his), a Read me, and About Peter in Finder. ${dim('say')} ${cmd('open kyou')} ${dim('and I put it up.')}`, face: '(｡•ᴗ•｡)' };
    /* an open order outranks the what-is answers, or "open kyou" would only
       ever get the blurb */
    const op = /^(?:open|launch|show|start|put up)\s+(?:the\s+)?(.+)$/.exec(q);
    if (op) {
      const k = op[1].replace(/\s+app$/, '');
      const hit = OPENS[k] ?? OPENS[Object.keys(OPENS).find((x) => k.includes(x)) ?? ''];
      if (hit) return { html: `opening ${hit[1]}. (ง •̀_•́)ง`, face: '(ง •̀_•́)ง', act: () => emit('rin:open', hit[0]) };
      return { html: `${dim('no app called that on this Mac. the ones I can open:')} volbase, kyou, market station, photos, read me, about, safari.` };
    }
    if (has('what is volbase', 'whats volbase', "what's volbase", 'volbase')) return { html: `${blurbs.volbase} ${dim('say')} ${cmd('open volbase')}${dim('.')}` };
    if (has('what is kyou', 'whats kyou', "what's kyou", 'kyou')) return { html: `${blurbs.kyou} ${dim('the demo runs the real parser. say')} ${cmd('open kyou')}${dim('.')}` };
    if (has('what is market station', 'whats market station', "what's market station", 'market station', 'market')) return { html: `${blurbs.market} ${dim('say')} ${cmd('open market station')}${dim('.')}` };
    if (has('dark', 'dark mode', 'lights off', 'night')) return { html: 'lights off. (´-ω-`)', face: '(´-ω-`)', act: () => emit('rin:theme', 'dark') };
    if (has('light', 'light mode', 'lights on', 'day')) return { html: 'lights on. ヽ(・∀・)ﾉ', face: 'ヽ(・∀・)ﾉ', act: () => emit('rin:theme', 'light') };
    if (has('theme', 'appearance', 'switch')) return { html: 'flipped. (￣ヮ￣)', act: () => emit('rin:theme', 'flip') };
    if (has('sleep', 'go to sleep', 'put the mac to sleep', 'goodnight', 'good night')) return { html: `fine. good night. ${dim('click the screen when you want it back.')} (´-ω-\`)`, face: '(´-ω-`)', act: () => setTimeout(() => emit('rin:power', 'sleep'), 700) };
    if (has('lock', 'lock screen', 'lock it')) return { html: 'locked. (¬_¬)', act: () => setTimeout(() => emit('rin:power', 'lock'), 500) };
    if (has('shut down', 'shutdown', 'restart', 'log out', 'logout')) return { html: `${dim('that one asks first, the way a Mac does. it is in the face menu, top left.')}` };
    if (has('date', 'time', 'what day', 'what time', 'today')) return { html: `${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}, ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}. ${dim('your clock, not his.')}` };
    if (q === '/daily' || has('plan my day', 'my day')) return { html: `${dim('/daily on the real Mac reads his calendar and his assignments and plans the day. there is nothing of his to read here, on purpose.')} the day that IS here is Kyou. ${dim('say')} ${cmd('open kyou')}${dim('.')}` };
    if (q.startsWith('/')) return { html: `${dim('that one reads his school portal, his mail, or his notes. none of that is on a portfolio.')} nice try. (¬‿¬)`, face: '(¬‿¬)' };
    if (has('github', 'source', 'code', 'repo')) return { html: `the app is free and open source: <a href="${links.rin}" target="_blank" rel="noopener">github.com/exata531/Rin</a>. ${dim('his other work is at')} <a href="${links.github}" target="_blank" rel="noopener">github.com/exata531</a>.` };
    if (has('thank', 'thanks', 'thx', 'ty')) return { html: `w-warn me before you say stuff like that. (///) ${dim('...you are welcome.')}`, face: '(///)' };
    if (has('hi', 'hello', 'hey', 'yo', 'hola', 'konnichiwa', 'ohayo')) return { html: `hi. (｡•ᴗ•｡) ${dim('type')} ${cmd('help')} ${dim('if you want the list.')}`, face: '(｡•ᴗ•｡)' };
    if (has('bye', 'goodbye', 'cya', 'see you')) return { html: `otsukare. ${dim('the panel closes if you click anywhere else.')} ♪(´▽｀)`, face: '♪(´▽｀)' };
    if (has('how are you', 'how r u', 'sup', 'whats up', "what's up")) return { html: `fine. bookkeeping. ${dim('nothing is due on this Mac, which is the most relaxed I have ever been.')} (￣ヮ￣)` };
    if (has('cute', 'love you', 'kawaii', 'marry')) return { html: `...hmph. ${dim('I heard that.')} (///)`, face: '(///)' };
    if (has('joke', 'funny')) return { html: `${dim('I keep deadlines, not jokes.')} his robot fell apart after most matches and they still made it to Worlds. that is the closest thing I have.` };
    if (has('sat', 'grade', 'gpa', 'college', 'score', 'email', 'phone', 'address', 'where does he live')) return { html: `${dim('not on a portfolio, and not from me.')} (¬_¬) ${dim('what IS here:')} ${cmd('help')}` };
    if (q === 'whoami') return { html: `a visitor. welcome. ${dim('the machine belongs to Peter Mei.')}` };
    if (q === 'ls' || q === 'pwd' || q === 'ls ~') return { html: `${dim('this is a demo terminal, not a shell. the folder the real one opens is his notes, and those stay on his Mac.')}` };
    if (has('rin')) return { html: `that is me. (｡•ᴗ•｡) ${dim('ask')} ${cmd('who are you')}${dim('.')}` };
    return { html: `${dim('not one I know. (・_・;) the list is under')} ${cmd('help')}${dim(', or tap a line below.')}` };
  };

  /* ── the transcript ── */
  const paintOut = () => {
    out.innerHTML = tab().lines.join('\n');
    term.scrollTop = term.scrollHeight;
  };
  const say = (html: string) => { if (html) tab().lines.push(html); put(); paintOut(); };
  let busy = false;
  const submit = (raw: string) => {
    const v = raw.trim();
    real.value = ''; inp.textContent = '';
    if (!v || busy) return;
    say(`<span class="term-ps">❯</span> ${cmd(esc(v))}`);
    const a = answer(v);
    if (!a.html && a.act) { a.act(); return; }
    busy = true;
    light.classList.add('is-amber');
    const t = tab();
    tabsEl.querySelector('.rin-tab.is-on')?.classList.add('is-busy');
    setTimeout(() => {
      busy = false;
      light.classList.remove('is-amber');
      tabsEl.querySelector('.rin-tab.is-busy')?.classList.remove('is-busy');
      if (a.face) mood(a.face);
      if (t === tab()) say(a.html); else { t.lines.push(a.html); put(); }
      a.act?.();
    }, 260);
  };
  real.addEventListener('input', () => { inp.textContent = real.value; });
  real.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit(real.value);
    if (e.key === 'Escape') real.blur();
  });
  term.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('a')) real.focus({ preventScroll: true }); });

  /* ── the tabs ── */
  const paintTabs = () => {
    tabsEl.innerHTML = st.tabs.map((t, i) =>
      `<span class="rin-tab${i === st.active ? ' is-on' : ''}" role="tab" aria-selected="${i === st.active}" data-rin-tab="${i}" tabindex="${i === st.active ? 0 : -1}"><i></i>${esc(t.name)}<button class="rin-tab-x" type="button" data-rin-x="${i}" aria-label="Close ${esc(t.name)}" tabindex="-1">×</button></span>`,
    ).join('') + `<button class="rin-tab-add" type="button" data-rin-add aria-label="New tab">+</button>`;
  };
  const pick = (i: number) => { st.active = Math.max(0, Math.min(st.tabs.length - 1, i)); put(); paintTabs(); paintOut(); };
  tabsEl.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const x = t.closest<HTMLElement>('[data-rin-x]');
    if (x) {
      const i = Number(x.dataset.rinX);
      if (st.tabs.length === 1) { st.tabs[0].lines = []; put(); paintOut(); return; }
      st.tabs.splice(i, 1);
      pick(st.active >= i ? st.active - 1 : st.active);
      return;
    }
    if (t.closest('[data-rin-add]')) {
      st.seq++;
      st.tabs.push({ name: `tab ${st.seq}`, lines: [], n: st.seq });
      pick(st.tabs.length - 1);
      real.focus({ preventScroll: true });
      return;
    }
    const b = t.closest<HTMLElement>('[data-rin-tab]');
    if (b) { pick(Number(b.dataset.rinTab)); real.focus({ preventScroll: true }); }
  });
  tabsEl.addEventListener('keydown', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-rin-tab]');
    if (!b) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); pick(st.active + 1); tabsEl.querySelector<HTMLElement>('.rin-tab.is-on')?.focus(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); pick(st.active - 1); tabsEl.querySelector<HTMLElement>('.rin-tab.is-on')?.focus(); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); real.focus(); }
  });

  /* ── the strip under the prompt ── */
  tryList.innerHTML = TRY.map((t) => `<button type="button" data-rin-try="${esc(t)}">${esc(t)}</button>`).join('');
  tryList.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-rin-try]');
    if (b) { submit(b.dataset.rinTry!); real.focus({ preventScroll: true }); }
  });

  paintTabs();
  paintOut();

  return {
    run() { submit('help'); },
    enter() { paintOut(); },
    leave() { real.blur(); },
  };
}
