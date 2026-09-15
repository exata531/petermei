/* Edit mode, the part you can see. Runs on Peter's machine only.

   A switch in the bottom left corner. Turn it on and every sentence on the
   page grows a dotted underline; click one, type, and press Enter or click
   away. The words go back into the file they came from and the page reloads
   itself with them in place.

   Links do not follow while the switch is on, so the words inside a button or
   a link can be edited like any others. Turning it off puts everything back. */

const KEY = 'pm-edit';
const bar = document.createElement('div');
const note = document.createElement('span');
let on = false;

/* an element worth editing: it holds words and nothing but words */
function editable(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.closest('[data-edit-ui]')) return false;
  if (el.isContentEditable) return false;
  const tag = el.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TITLE' || tag === 'HTML' || tag === 'BODY') return false;
  if (!el.childNodes.length) return false;
  for (const n of el.childNodes) if (n.nodeType !== Node.TEXT_NODE) return false;
  return (el.textContent || '').trim().length > 0;
}

/* A sentence that shares its box with something else, the way a value sits
   next to its own label, is not reachable by marking whole elements, so those
   loose pieces of text get a box of their own to be edited in. Dev only, and
   the page reloads after every save anyway. */
function wrapLoose() {
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const t = (n.nodeValue || '').trim();
      if (!t) return NodeFilter.FILTER_REJECT;
      const p = n.parentElement;
      if (!p || p.closest('[data-edit-ui]') || p.dataset.editText !== undefined) return NodeFilter.FILTER_REJECT;
      const tag = p.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TITLE') return NodeFilter.FILTER_REJECT;
      /* the parent is already one plain box of words, so it is handled */
      if ([...p.childNodes].every((c) => c.nodeType === Node.TEXT_NODE)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const loose: Text[] = [];
  for (let n = walk.nextNode(); n; n = walk.nextNode()) loose.push(n as Text);
  for (const n of loose) {
    const span = document.createElement('span');
    span.dataset.editWrap = '';
    n.replaceWith(span);
    span.appendChild(n);
  }
}

let marking = false;
function mark() {
  if (marking) return;
  marking = true;
  wrapLoose();
  for (const el of document.querySelectorAll<HTMLElement>('body *')) {
    if (editable(el)) el.dataset.editText = '';
    else delete el.dataset.editText;
  }
  marking = false;
}

function say(text: string, good = true) {
  note.textContent = text;
  note.dataset.good = good ? '1' : '0';
  clearTimeout(Number(note.dataset.t));
  note.dataset.t = String(setTimeout(() => { note.textContent = ''; }, good ? 2200 : 7000));
}

async function save(el: HTMLElement, before: string) {
  const after = (el.textContent || '').trim();
  if (after === before) return;
  if (!after) { el.textContent = before; say('A line cannot be empty', false); return; }
  say('Saving');
  try {
    const r = await fetch('/__edit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ before, after }),
    });
    const out = await r.json();
    if (out.ok) say(`Saved to ${out.file || 'the file'}`);
    else { el.textContent = before; say(out.why || 'Could not save that one', false); }
  } catch {
    el.textContent = before;
    say('The dev server did not answer', false);
  }
}

/* one click starts an edit. It ends when you press Enter, click away, or
   click another sentence, and every one of those routes through the same
   place, because relying on one of them alone loses an edit whenever the
   browser does not give the element focus. */
let active: { el: HTMLElement; before: string } | null = null;

function commit() {
  if (!active) return;
  const { el, before } = active;
  active = null;
  el.contentEditable = 'false';
  el.removeEventListener('keydown', key);
  void save(el, before);
}

function key(ev: KeyboardEvent) {
  if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
  if (ev.key === 'Escape' && active) { active.el.textContent = active.before; active = null; (ev.currentTarget as HTMLElement).contentEditable = 'false'; }
}

document.addEventListener('click', (e) => {
  if (!on) return;
  const el = (e.target as HTMLElement)?.closest<HTMLElement>('[data-edit-text]');
  if (active && active.el !== el) commit();
  if (!el || el === active?.el) return;
  e.preventDefault();
  e.stopPropagation();
  active = { el, before: (el.textContent || '').trim() };
  el.contentEditable = 'plaintext-only';
  el.addEventListener('keydown', key);
  el.addEventListener('blur', commit, { once: true });
  el.focus();
}, true);

/* while the switch is on, nothing the page normally does happens */
for (const ev of ['mousedown', 'pointerdown', 'submit'] as const) {
  document.addEventListener(ev, (e) => {
    if (!on) return;
    const el = (e.target as HTMLElement)?.closest?.('[data-edit-text], a, button');
    if (el && !(el as HTMLElement).closest('[data-edit-ui]')) { e.preventDefault(); e.stopPropagation(); }
  }, true);
}

function paint() {
  document.documentElement.classList.toggle('is-editing', on);
  if (on) mark();
  const sw = bar.querySelector('button')!;
  sw.textContent = on ? 'Editing text' : 'Edit text';
  sw.dataset.on = on ? '1' : '0';
}

/* the switch, and the styles for both it and the dotted underline */
bar.dataset.editUi = '';
bar.innerHTML = `<button type="button">Edit text</button><span data-note></span>`;
const css = document.createElement('style');
css.textContent = `
[data-edit-ui] { position: fixed; left: 14px; bottom: 14px; z-index: 2147483647; display: flex; align-items: center; gap: 10px;
  font: 500 13px/1.3 -apple-system, BlinkMacSystemFont, system-ui, sans-serif; color: #111; }
[data-edit-ui] button { appearance: none; border: 1px solid rgb(0 0 0 / .18); background: #fff; color: #111;
  padding: 7px 12px; border-radius: 999px; cursor: pointer; box-shadow: 0 4px 14px rgb(0 0 0 / .14); }
[data-edit-ui] button[data-on="1"] { background: #111; color: #fff; border-color: #111; }
[data-edit-ui] span { max-width: 46ch; padding: 6px 10px; border-radius: 8px; background: #111; color: #fff;
  box-shadow: 0 4px 14px rgb(0 0 0 / .18); }
[data-edit-ui] span:empty { display: none; }
[data-edit-ui] span[data-good="0"] { background: #a8332a; }
html.is-editing [data-edit-text] { outline: 1px dashed rgb(0 0 0 / .28); outline-offset: 2px; cursor: text; }
html.is-editing [data-edit-text]:hover { outline-color: rgb(0 0 0 / .6); background: rgb(255 235 120 / .35); }
html.is-editing [data-edit-text][contenteditable="plaintext-only"] { outline: 2px solid #111; background: #fff; }
`;
document.head.append(css);
bar.append(note);
note.remove();
bar.querySelector('[data-note]')!.replaceWith(note);
document.body.append(bar);
bar.querySelector('button')!.addEventListener('click', () => {
  on = !on;
  try { sessionStorage.setItem(KEY, on ? '1' : '0'); } catch {}
  paint();
});

try { on = sessionStorage.getItem(KEY) === '1'; } catch {}
paint();
/* pages swap under the router, and the Mac draws its own windows as it goes */
document.addEventListener('astro:page-load', () => { document.body.append(bar); paint(); });
new MutationObserver(() => { if (on) mark(); }).observe(document.body, { childList: true, subtree: true });
