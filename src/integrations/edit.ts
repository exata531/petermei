/* Edit mode: click any sentence on the site and type.

   This runs only while the site is running on Peter's own machine under
   `npm run dev`. It adds nothing to a build, so nothing here ever reaches
   petermei.com: the script is injected only when Astro's command is `dev`,
   and the endpoint is a piece of the dev server, which does not exist in a
   deploy.

   How it saves. The page sends the sentence as it was and the sentence as
   you typed it. The server looks for that exact run of characters across the
   source, and writes the new one in its place. It will only do that when the
   old sentence appears exactly once in the whole project, so a word like
   "Work" that appears in nine places is refused out loud instead of being
   changed in the wrong one. Because the file on disk changed, the page
   reloads itself with the new words already in it.

   When the same words appear twice. A phrase like "Work" lives in nine files,
   so an exact search cannot tell which one you meant. Rather than refuse every
   time, the page says which route it is on, and the hits are ranked: the page's
   own source first, then the data file the site reads its words from, then
   components, then everything else. If exactly one hit sits in the best tier,
   that is the one you meant and it is written. If the best tier is still a tie,
   it refuses and names the files, which is the old behaviour and the safe one.

   Undo. The last write is held in memory with the bytes it replaced, so the
   page can ask for it back. One step, this server's lifetime only, which is all
   a dev-time editor needs; the file is also in git.

   What it cannot edit. A sentence that the page builds out of pieces is not
   in the source as one run of characters, so the server will not find it and
   will say so. Those are the few that still have to be edited by hand. */
import type { AstroIntegration } from 'astro';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

/* the places a visible sentence can live */
const ROOTS = ['src', 'public'];
const EXT = new Set(['.astro', '.ts', '.js', '.json', '.md', '.html', '.txt']);
const SKIP = new Set(['node_modules', 'dist', '.astro', '.git', 'fonts', 'img', 'icons']);

async function files(dir: string, out: string[] = []): Promise<string[]> {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await files(p, out);
    else if (EXT.has(extname(e.name))) out.push(p);
  }
  return out;
}

/* Every place this exact run of characters appears, one entry per occurrence
   rather than one per file. The offset is what makes scoring possible: with it,
   the source LINE holding each occurrence can be read and compared against the
   element the words came from. */
type Hit = { file: string; at: number; line: string };

/* The project, read once. The search now tries about two dozen spellings and
   slots per save, and re-reading every file for each of them took the better
   part of a minute; the same files answer all of them. Held for a few seconds
   so one save is one read, and dropped after, so an edit is always searched
   against what is on disk right now. */
let cache: { at: number; files: { file: string; body: string }[] } | null = null;

/* Edit mode's own two files are the machine, not the words on the site, and
   they talk about the site at length. Left in, this file's own examples of
   editable sentences answered searches for those sentences, and a save aimed at
   the home page landed in a comment in here. Nothing in the tooling is site
   content, so the tooling is not searched. */
const MINE = ['src/integrations/edit.ts', 'src/scripts/dev/edit.ts'];

async function corpus(root: string) {
  if (cache && Date.now() - cache.at < 4000) return cache.files;
  const out: { file: string; body: string }[] = [];
  for (const dir of ['src', 'public']) {
    for (const f of await files(join(root, dir))) {
      const rel = f.replace(root, '').replace(/^\/+/, '');
      if (MINE.includes(rel)) continue;
      out.push({ file: f, body: await readFile(f, 'utf8') });
    }
  }
  cache = { at: Date.now(), files: out };
  return out;
}

async function findAll(root: string, needle: string): Promise<Hit[]> {
  const hits: Hit[] = [];
  for (const { file, body } of await corpus(root)) {
    for (let i = body.indexOf(needle); i !== -1; i = body.indexOf(needle, i + needle.length)) {
      const from = body.lastIndexOf('\n', i) + 1;
      let to = body.indexOf('\n', i);
      if (to === -1) to = body.length;
      hits.push({ file, at: i, line: body.slice(from, to) });
    }
  }
  return hits;
}

/* How much one occurrence looks like the element the words came from. The
   element's own class, href and id are written on its source line too, so
   counting how many of them the line carries separates three "About" labels
   that the page and the file name could never separate. */
function score(hit: Hit, hint: string[]): number {
  if (!hint.length) return 0;
  const line = hit.line.toLowerCase();
  let n = 0;
  for (const t of hint) if (line.includes(t.toLowerCase())) n++;
  return n;
}

/* What is holding this sentence, and what the new one has to be escaped for.
   Walk back to the start of the line and count the quotes: if a quote is still
   open when the sentence begins, that quote is the one holding it. */
function fit(body: string, at: number, text: string): string {
  const lineStart = body.lastIndexOf('\n', at) + 1;
  const before = body.slice(lineStart, at);
  let open = '';
  for (let i = 0; i < before.length; i++) {
    const c = before[i];
    if (c === '\\') { i++; continue; }
    if (c === "'" || c === '"' || c === '`') {
      if (!open) open = c;
      else if (open === c) open = '';
    }
  }
  if (open) {
    let out = text.replace(/\\/g, '\\\\').replace(new RegExp(open, 'g'), '\\' + open);
    /* a template string also reads ${ as the start of an expression */
    if (open === '`') out = out.replace(/\$\{/g, '\\${');
    return out;
  }
  /* not in a string, so it is text in markup, where the angle brackets and the
     ampersand are the ones that change the meaning */
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* How close a file is to the page you were looking at. Lower is better, and
   only the best tier gets to answer; a tie inside it is still a refusal. */
function tier(file: string, root: string, page: string): number {
  const rel = file.replace(root, '').replace(/^\/+/, '');
  if (!rel.startsWith('src/')) return 5;
  /* the route's own file: /about -> src/pages/about.astro, / -> index.astro,
     and a nested route -> its folder's index or its [slug] */
  const clean = (page || '/').split('?')[0].replace(/^\/+|\/+$/g, '');
  const own = clean ? [`src/pages/${clean}.astro`, `src/pages/${clean}/index.astro`] : ['src/pages/index.astro'];
  if (own.includes(rel)) return 0;
  /* a route built from a parameter, e.g. /work/volbase from work/[slug].astro */
  const parent = clean.split('/').slice(0, -1).join('/');
  if (parent && rel.startsWith(`src/pages/${parent}/`) && rel.includes('[')) return 1;
  if (rel.startsWith('src/data/')) return 2;
  if (rel.startsWith('src/components/') || rel.startsWith('src/layouts/')) return 3;
  return 4;
}

/* the last write, so it can be taken back. It is a list because one edit can
   legitimately touch several files: see the identical-line rule below. */
let lastWrite: { file: string; at: number; had: string; got: string }[] | null = null;

/* TEXT BUILT AROUND A VALUE.

   "Open volbase on the desktop." is not in any file: the source says
   `Open {s.name} on the desktop.` and the name arrives at render time. Every
   such sentence used to be refused, which was most of the generated interface.

   The fixed words ARE in the file, on either side of the hole, so they can be
   edited even though the whole sentence cannot be found. The match has to be
   exact on both sides, and the value has to survive: if the words you typed no
   longer contain the thing that was filled in, there is nowhere to put it back
   and the edit is refused rather than guessed at.

   Only the fixed words change. The hole, and whatever fills it, is untouched. */
type Split = { file: string; head: { at: number; text: string }; tail: { at: number; text: string }; value: string };

function findAround(corpusFiles: { file: string; body: string }[], before: string): Split[] {
  const out: Split[] = [];
  /* the longest fixed opening worth trusting; shorter than this and "Open " on
     its own would match half the project */
  const MIN = 4;
  for (const { file, body } of corpusFiles) {
    for (let cut = before.length - 1; cut >= MIN; cut--) {
      const head = before.slice(0, cut);
      let i = body.indexOf(head);
      while (i !== -1) {
        const after = body.slice(i + head.length);
        /* the hole: a JSX expression or a template placeholder, right here */
        const m = /^(\$?\{)/.exec(after);
        if (m) {
          /* walk to the brace that closes it */
          let depth = 0, j = i + head.length + m[1].length - 1;
          for (; j < body.length; j++) {
            if (body[j] === '{') depth++;
            else if (body[j] === '}') { depth--; if (!depth) break; }
          }
          const rest = body.slice(j + 1);
          const tail = before.slice(cut);
          /* whatever the hole rendered as sits at the front of the tail, so the
             fixed words after it are the longest suffix the source also has */
          for (let k = 1; k <= tail.length; k++) {
            const fixed = tail.slice(k);
            if (fixed.length < MIN) break;
            if (rest.startsWith(fixed)) {
              out.push({ file, head: { at: i, text: head }, tail: { at: j + 1, text: fixed }, value: tail.slice(0, k) });
              break;
            }
          }
        }
        i = body.indexOf(head, i + 1);
      }
      if (out.length) return out;   // the longest opening that worked wins
    }
  }
  return out;
}

export default function editMode(): AstroIntegration {
  let root = process.cwd();
  return {
    name: 'edit-mode',
    hooks: {
      'astro:config:setup': ({ command, config, injectScript }) => {
        root = config.root.pathname;
        if (command !== 'dev') return;
        injectScript('page', `import '/src/scripts/dev/edit';`);
      },
      'astro:server:setup': ({ server }) => {
        /* Rin's site is a plain folder in public, so it answers at /rin on a
           built site and on the live one. The dev server does not serve a
           folder's index, so /rin came back a 404 and the Macintosh's browser
           drew its own not-found page inside itself, which is a Macintosh
           inside a Macintosh and about as heavy as it sounds (Peter, 09-14:
           "its crashing and not showing me rins website"). This hands back
           the folder's index, the way every other server already does. */
        server.middlewares.use(async (req, res, next) => {
          const path = (req.url || '').split('?')[0];
          if (req.method !== 'GET' || extname(path)) return next();
          const file = join(root, 'public', path.replace(/^\/+|\/+$/g, ''), 'index.html');
          if (!file.startsWith(join(root, 'public'))) return next();
          let body;
          try { body = await readFile(file); } catch { return next(); }
          res.setHeader('content-type', 'text/html; charset=utf-8');
          res.end(body);
        });
        server.middlewares.use('/__edit', async (req, res) => {
          const send = (code: number, body: unknown) => {
            res.statusCode = code;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(body));
          };
          if (req.method !== 'POST') return send(405, { ok: false, why: 'POST only' });
          let raw = '';
          for await (const chunk of req) raw += chunk;
          let before = '', after = '', page = '', undo = false, probe = false, hint: string[] = [];
          try { ({ before, after, page = '', undo = false, probe = false, hint = [] } = JSON.parse(raw)); } catch { return send(400, { ok: false, why: 'bad body' }); }
          /* take the last write back, exactly, from the bytes it replaced */
          if (undo) {
            if (!lastWrite || !lastWrite.length) return send(409, { ok: false, why: 'nothing to undo' });
            /* every file is checked before any is written, so a half-undone edit
               is not a state this can end up in */
            const bodies: string[] = [];
            for (const w of lastWrite) {
              const body = await readFile(w.file, 'utf8');
              if (body.slice(w.at, w.at + w.got.length) !== w.got) {
                lastWrite = null;
                return send(409, { ok: false, why: 'that file changed since, so I will not guess where to put it back' });
              }
              bodies.push(body);
            }
            for (let i = 0; i < lastWrite.length; i++) {
              const w = lastWrite[i];
              await writeFile(w.file, bodies[i].slice(0, w.at) + w.had + bodies[i].slice(w.at + w.got.length), 'utf8');
            }
            const where = lastWrite.map((w) => w.file.replace(root, ''));
            cache = null;
            lastWrite = null;
            return send(200, { ok: true, file: where.join(', '), undone: true });
          }
          before = String(before ?? ''); after = String(after ?? '');
          hint = Array.isArray(hint) ? hint.map(String).slice(0, 12) : [];
          if (!before.trim()) return send(400, { ok: false, why: 'nothing to look for' });
          /* a probe asks the same question a save asks, and writes nothing. It is
             how the coverage of this whole feature gets measured instead of
             guessed at: walk a page, probe every sentence, count the refusals. */
          if (!probe && before === after) return send(200, { ok: true, why: 'no change' });
          /* What the page shows is not always what the file holds: an apostrophe
             may be curly on screen and typewritten in the source, and a sentence
             this editor wrote earlier carries backslashes in front of its quotes.

             THE SPELLINGS, and then THE SLOTS. A word like "About" appears in
             seventy-four places as a substring and in two as an actual label, so
             searching for the bare word could never pick one. Every spelling is
             therefore tried inside its SLOT first: between the angle brackets of
             an element, or as a whole quoted string. A slot match means the file
             holds this text as a thing on its own rather than as letters inside a
             longer word, which is what the page was showing. Only when no slot
             anywhere holds it does the bare text get tried, which is where a
             sentence that shares its element with other markup lands. */
          const plain = before.replace(/’/g, "'").replace(/[“”]/g, '"');
          const spellings = [
            before,
            plain,
            before.replace(/(['"`])/g, '\\$1'),
            plain.replace(/(['"`])/g, '\\$1'),
          ].filter((v, i, a) => a.indexOf(v) === i);
          /* slot first, bare last, and the whole ladder is tried in order */
          const tries: { needle: string; cut: number }[] = [];
          for (const v of spellings) {
            tries.push({ needle: `>${v}<`, cut: 1 });
            tries.push({ needle: `'${v}'`, cut: 1 });
            tries.push({ needle: `"${v}"`, cut: 1 });
            tries.push({ needle: '`' + v + '`', cut: 1 });
            tries.push({ needle: `>${v}`, cut: 1 });
          }
          for (const v of spellings) tries.push({ needle: v, cut: 0 });
          /* Walk the ladder. A rung that finds nothing, or finds several equally
             likely places, is not the end of the search any more: a tie on one
             delimiter often resolves on the next, so the loop keeps going and
             only the LAST refusal is reported if every rung fails. */
          /* Walk the ladder. Each rung narrows the field three ways, in order:
             the slot the text sits in, then how close the file is to the page
             you were on, then how much the source line looks like the element
             you clicked. A rung that still cannot pick one is not the end of the
             search, because a tie on one delimiter often resolves on the next,
             so the loop carries on and reports only the last refusal. */
          let refusal: { total: number; left: number; files: string[] } | null = null;
          for (const { needle, cut } of tries) {
            const hits = await findAll(root, needle);
            if (!hits.length) continue;
            const total = hits.length;

            /* 1. the page you were looking at */
            let picked = hits;
            if (picked.length > 1) {
              const best = Math.min(...picked.map((h) => tier(h.file, root, page)));
              picked = picked.filter((h) => tier(h.file, root, page) === best);
            }
            /* 2. the element you clicked */
            if (picked.length > 1 && hint.length) {
              const best = Math.max(...picked.map((h) => score(h, hint)));
              if (best > 0) picked = picked.filter((h) => score(h, hint) === best);
            }
            /* 3. the same line, twice. The skip link is written identically in
               both layouts, and so are a handful of other shared labels. When
               every candidate that survived is the SAME source line, they are
               one string that happens to be typed out more than once, and the
               edit belongs to all of them: changing one would leave the other
               pages saying the old thing. Only byte-identical lines qualify;
               three different "About" labels are three different decisions and
               still refuse. */
            const identical = picked.length > 1 && picked.every((h) => h.line === picked[0].line);
            if (picked.length > 1 && !identical) {
              refusal = { total, left: picked.length, files: [...new Set(picked.map((h) => h.file.replace(root, '')))] };
              continue;
            }

            const hit = picked[0];
            if (probe) return send(200, { ok: true, file: hit.file.replace(root, ''), others: total - 1, also: identical ? picked.length - 1 : 0, probe: true });
            const body = await readFile(hit.file, 'utf8');
            /* the needle may carry a delimiter on each end, and only the text
               between them is replaced, so the markup or the quotes survive */
            const at = hit.at + cut;
            const had = needle.slice(cut, needle.length - cut || undefined);
            /* A sentence usually lives inside a quoted string in the source, so
               a typed apostrophe would end that string early and break the
               file. This happened once, on 09-14: an apostrophe typed into a
               product line closed the string and the whole site stopped
               building. So the replacement is escaped for whatever is actually
               holding it. */
            const safe = fit(body, at, after);
            const written: { file: string; at: number; had: string; got: string }[] = [];
            /* every identical line, or just the one */
            for (const h of identical ? picked : [hit]) {
              const b2 = h === hit ? body : await readFile(h.file, 'utf8');
              const a2 = h.at + cut;
              await writeFile(h.file, b2.slice(0, a2) + safe + b2.slice(a2 + had.length), 'utf8');
              written.push({ file: h.file, at: a2, had, got: safe });
            }
            cache = null;   // the files just changed under it
            lastWrite = written;
            return send(200, {
              ok: true,
              file: written.map((w) => w.file.replace(root, '')).join(', '),
              others: total - written.length,
            });
          }
          if (refusal) {
            return send(409, {
              ok: false,
              why: `these words sit in ${refusal.left} places that look equally right, out of ${refusal.total} altogether, so I will not guess. Edit a longer line that is only in one place, or change it in ${refusal.files[0]}`,
              files: refusal.files,
            });
          }
          /* Last: the sentence is built around a value. The fixed words on each
             side of the hole are real text in a real file and can be edited. */
          const around = findAround(await corpus(root), before);
          if (around.length === 1) {
            const sp = around[0];
            /* the value has to still be in there, exactly once, or there is
               nowhere to put it back */
            const first = after.indexOf(sp.value);
            if (!sp.value || first === -1 || after.indexOf(sp.value, first + 1) !== -1) {
              return send(409, {
                ok: false,
                why: `that sentence is built around "${sp.value}", which the page fills in, so I can only change the words either side of it. Keep "${sp.value}" in what you type, once`,
                files: [sp.file.replace(root, '')],
              });
            }
            const head = after.slice(0, first);
            const tail = after.slice(first + sp.value.length);
            if (probe) return send(200, { ok: true, file: sp.file.replace(root, ''), others: 0, around: true, probe: true });
            let body = await readFile(sp.file, 'utf8');
            /* the tail sits after the head in the file, so it is written first
               and the earlier offset stays true */
            body = body.slice(0, sp.tail.at) + fit(body, sp.tail.at, tail) + body.slice(sp.tail.at + sp.tail.text.length);
            const headSafe = fit(body, sp.head.at, head);
            body = body.slice(0, sp.head.at) + headSafe + body.slice(sp.head.at + sp.head.text.length);
            await writeFile(sp.file, body, 'utf8');
            cache = null;
            /* an edit in two places in one file: undo puts both back */
            lastWrite = null;   // the two halves move each other's offsets, so this one is not undoable
            return send(200, { ok: true, file: sp.file.replace(root, ''), others: 0, around: true });
          }
          return send(404, { ok: false, why: around.length > 1 ? 'that sentence is built around a value in more than one place, so I cannot tell which one you meant' : 'the page builds that line out of pieces, so it is not one piece of text in the source' });
        });
      },
    },
  };
}
