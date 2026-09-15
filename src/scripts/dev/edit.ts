/* Edit mode, the part you can see. Runs on Peter's machine only.

   Turn it on and every sentence on the page grows a dotted underline; click
   one, type, and press Enter or click away. The words go back into the file
   they came from and the page reloads itself with them in place.

   Links do not follow while the switch is on, so the words inside a button or
   a link can be edited like any others. Turning it off puts everything back.

   THE SWITCH KEEPS OUT OF THE WAY. It used to sit in the bottom left as a
   full pill at all times, which parked it on top of the footer's signature on
   every page (Peter, 09-15, from a screenshot of it covering his own name).
   Off, it is now a small dot that only becomes a labelled button when the
   pointer is near it or the keyboard reaches it. On, it is a pill again,
   because then it is the thing you are using.

   Cmd+E, or Ctrl+E, turns it on and off without going to the corner at all.
   Escape leaves an edit, and pressing it again leaves edit mode.

   Cmd+Z, right after a save, asks the dev server to put the old words back.
   One step, and only while that server is running.

   The chrome reads the site's own tokens, so it is the same ink, the same
   radius, the same spring as the page it sits on rather than a second set of
   invented values. */

const KEY = 'pm-edit';
const bar = document.createElement('div');
const note = document.createElement('span');
let on = false;

/* Text that is not CONTENT. Marking these was worse than useless: the name in
   the hero is one span per letter, so edit mode offered to edit the letter "P",
   and the only honest answer the server could give was that the letter P occurs
   in eight hundred places. A face drawn out of punctuation is a picture, not a
   sentence. And a single character is never a thing anyone means to retype. */
function contentish(el: HTMLElement): boolean {
  if (el.closest('[data-name], .hero-only')) return false;      // the wordmark, letter by letter
  if (el.closest('[aria-hidden="true"]')) return false;         // decoration, faces included
  if (el.closest('[data-face]')) return false;
  const t = (el.textContent || '').trim();
  if (t.length < 2) return false;                               // one character is not a sentence
  if (!/[A-Za-z0-9]/.test(t)) return false;                     // punctuation drawings
  return true;
}

/* an element worth editing: it holds words and nothing but words */
function editable(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.closest('[data-edit-ui]')) return false;
  if (el.isContentEditable) return false;
  const tag = el.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TITLE' || tag === 'HTML' || tag === 'BODY') return false;
  if (!el.childNodes.length) return false;
  for (const n of el.childNodes) if (n.nodeType !== Node.TEXT_NODE) return false;
  if (!(el.textContent || '').trim()) return false;
  return contentish(el);
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
      if (p.closest('[data-name], .hero-only, [aria-hidden="true"], [data-face]')) return NodeFilter.FILTER_REJECT;
      if (t.length < 2 || !/[A-Za-z0-9]/.test(t)) return NodeFilter.FILTER_REJECT;
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
  /* Element, not HTMLElement: the cast was a lie an SVG child would break, and
     it also narrowed the else branch to nothing. The guard does the real work. */
  for (const el of document.querySelectorAll('body *')) {
    if (editable(el)) el.dataset.editText = '';
    else if (el instanceof HTMLElement) delete el.dataset.editText;
  }
  marking = false;
}

/* A message that says what went wrong is the whole value of this thing when it
   refuses, and it used to erase itself after seven seconds, often while the
   sentence explaining the refusal was still being read. Good news clears
   itself; bad news stays until the next edit replaces it or it is clicked. */
function say(text: string, good = true) {
  note.textContent = text;
  note.dataset.good = good ? '1' : '0';
  clearTimeout(Number(note.dataset.t));
  if (good) note.dataset.t = String(setTimeout(() => { note.textContent = ''; }, 3200));
}

/* What this element is, in the words its own source line would use: the tag,
   its classes, and the attributes that identify one of several similar things.
   Values only, no syntax, because the source may write them in any order and
   with any quoting. */
function fingerprint(el: HTMLElement): string[] {
  const out: string[] = [el.tagName.toLowerCase()];
  if (typeof el.className === 'string') out.push(...el.className.split(/\s+/).filter(Boolean));
  for (const a of ['href', 'id', 'aria-label', 'data-open', 'data-app', 'data-nav', 'type', 'rel']) {
    const v = el.getAttribute(a);
    if (v) out.push(v);
  }
  const p = el.parentElement;
  if (p && typeof p.className === 'string') out.push(...p.className.split(/\s+/).filter(Boolean));
  return [...new Set(out)].filter((t) => t.length > 1).slice(0, 12);
}

/* the last thing written, so Cmd+Z has something to ask about */
let undoable = false;

async function post(body: unknown) {
  const r = await fetch('/__edit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function save(el: HTMLElement, before: string) {
  const after = (el.textContent || '').trim();
  if (after === before) return;
  if (!after) { el.textContent = before; say('A line cannot be empty', false); return; }
  say('Saving');
  try {
    /* The route is evidence, and so is the element. "About" is a label in three
       different components and the page alone cannot separate them, but the one
       you clicked carries a class and an href that its own source line carries
       too. Send that fingerprint and the tie resolves itself. */
    const out = await post({ before, after, page: location.pathname, hint: fingerprint(el) });
    if (out.ok) {
      undoable = true;
      const where = out.file || 'the file';
      say(out.others ? `Saved to ${where}. ${out.others} other copy left alone. Cmd+Z undoes it` : `Saved to ${where}. Cmd+Z undoes it`);
    } else {
      el.textContent = before;
      say(out.why || 'Could not save that one', false);
    }
  } catch {
    el.textContent = before;
    say('The dev server did not answer', false);
  }
}

async function undo() {
  if (!undoable) { say('Nothing to undo', false); return; }
  say('Putting it back');
  try {
    const out = await post({ undo: true });
    if (out.ok) { undoable = false; say(`Put back in ${out.file || 'the file'}`); }
    else say(out.why || 'Could not undo that', false);
  } catch {
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
  if (ev.key === 'Escape' && active) {
    ev.preventDefault();
    const { el, before } = active;
    active = null;
    el.textContent = before;
    el.contentEditable = 'false';
    el.removeEventListener('keydown', key);
    el.blur();
    say('Left that one as it was');
  }
}

/* the switch, from the keyboard. Cmd+E on a Mac, Ctrl+E everywhere else, and
   it works wherever you are on the page instead of only in the corner.
   Escape with nothing being edited leaves edit mode entirely; Cmd+Z right
   after a save asks the server to put the old words back. */
function toggle() {
  on = !on;
  try { sessionStorage.setItem(KEY, on ? '1' : '0'); } catch {}
  paint();
  say(on ? 'Editing text. Click a sentence' : 'Back to reading');
}

document.addEventListener('keydown', (ev) => {
  const meta = ev.metaKey || ev.ctrlKey;
  if (meta && ev.key.toLowerCase() === 'e') { ev.preventDefault(); toggle(); return; }
  if (!on) return;
  if (meta && ev.key.toLowerCase() === 'z' && !active) { ev.preventDefault(); void undo(); return; }
  if (ev.key === 'Escape' && !active) { ev.preventDefault(); toggle(); }
});

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
  sw.querySelector('[data-label]')!.textContent = on ? 'Editing text' : 'Edit text';
  sw.dataset.on = on ? '1' : '0';
  sw.setAttribute('aria-pressed', on ? 'true' : 'false');
  sw.title = on ? 'Editing text. Cmd+E to stop' : 'Edit text (Cmd+E)';
}

/* the switch, and the styles for both it and the dotted underline.

   Values come from the site's own tokens wherever one exists, with a literal
   after the comma for the two chapters that do not load them (the Mac and the
   product pages carry their own sets, and this bar floats over those too). */
bar.dataset.editUi = '';
bar.innerHTML = `<button type="button" aria-keyshortcuts="Meta+E Control+E"><span data-dot aria-hidden="true"></span><span data-label>Edit text</span></button><span data-note></span>`;
const css = document.createElement('style');
css.textContent = `
[data-edit-ui] { position: fixed; left: 14px; bottom: 14px; z-index: 2147483647; display: flex; align-items: center;
  gap: var(--gap-snug, 12px); font: 500 13px/1.3 var(--ui, -apple-system, BlinkMacSystemFont, system-ui, sans-serif);
  color: var(--ink, #111); }
[data-edit-ui] button { appearance: none; display: flex; align-items: center; gap: var(--gap-tight, 8px);
  border: 1px solid var(--hair-2, rgb(0 0 0 / .18)); background: var(--paper, #fff); color: var(--ink, #111);
  padding: 7px 12px; border-radius: var(--r-pill, 999px); cursor: pointer; box-shadow: var(--shadow-card, 0 4px 14px rgb(0 0 0 / .14));
  transition: opacity var(--t-hover, 200ms) var(--spring, ease), padding var(--t-hover, 200ms) var(--spring, ease); }
[data-edit-ui] button [data-dot] { width: 7px; height: 7px; border-radius: var(--r-pill, 999px); background: currentColor; opacity: .45; }
[data-edit-ui] button[data-on="1"] { background: var(--ink, #111); color: var(--paper, #fff); border-color: var(--ink, #111); }
[data-edit-ui] button[data-on="1"] [data-dot] { opacity: 1; }

/* OFF, it is a dot. It used to be a full pill at all times and it sat on top
   of the footer's signature on every page. It grows back into a button when
   the pointer comes near or the keyboard lands on it, and Cmd+E never needs
   it at all. ON, it stays a pill, because then it is what you are using. */
/* collapsed it is a 7px dot, but the thing you click is still the full 44px
   square the guidelines ask for: the padding shrinks the ink, not the target */
[data-edit-ui] button[data-on="0"] { padding: 18px; opacity: .3; margin: -11px; }
[data-edit-ui] button[data-on="0"] [data-label] { display: none; }
[data-edit-ui]:hover button[data-on="0"], [data-edit-ui] button[data-on="0"]:focus-visible { padding: 7px 12px; opacity: 1; margin: 0; }
[data-edit-ui]:hover button[data-on="0"] [data-label], [data-edit-ui] button[data-on="0"]:focus-visible [data-label] { display: inline; }

[data-edit-ui] span[data-note] { max-width: 46ch; padding: 6px 10px; border-radius: var(--r-control, 8px);
  background: var(--ink, #111); color: var(--paper, #fff); box-shadow: var(--shadow-card, 0 4px 14px rgb(0 0 0 / .18)); cursor: pointer; }
[data-edit-ui] span[data-note]:empty { display: none; }
[data-edit-ui] span[data-note][data-good="0"] { background: var(--a-red, #a8332a); }
html.is-editing [data-edit-text] { outline: 1px dashed rgb(0 0 0 / .28); outline-offset: 2px; cursor: text; }
html.is-editing [data-edit-text]:hover { outline-color: rgb(0 0 0 / .6); background: rgb(255 235 120 / .35); }
html.is-editing [data-edit-text][contenteditable="plaintext-only"] { outline: 2px solid var(--ink, #111); background: var(--paper, #fff); }
@media (prefers-reduced-motion: reduce) { [data-edit-ui] button { transition: none; } }
`;
document.head.append(css);
bar.append(note);
note.remove();
bar.querySelector('[data-note]')!.replaceWith(note);
document.body.append(bar);
bar.querySelector('button')!.addEventListener('click', toggle);
note.addEventListener('click', () => { note.textContent = ''; });

try { on = sessionStorage.getItem(KEY) === '1'; } catch {}
paint();
/* pages swap under the router, and the Mac draws its own windows as it goes */
document.addEventListener('astro:page-load', () => { document.body.append(bar); paint(); });
new MutationObserver(() => { if (on) mark(); }).observe(document.body, { childList: true, subtree: true });

/* This file has no import and no export, which makes TypeScript read it as a
   global script rather than a module, so its top-level names collide with
   every other such file. Astro bundles it as a module regardless, so this
   line changes nothing at runtime and gives it its own scope at check time. */
export {};
