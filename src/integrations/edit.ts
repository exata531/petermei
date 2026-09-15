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

/* every place this exact run of characters appears, and how many times in each */
async function findAll(root: string, needle: string) {
  const hits: { file: string; count: number }[] = [];
  for (const f of await files(join(root, 'src'))) {
    const body = await readFile(f, 'utf8');
    let n = 0, i = body.indexOf(needle);
    while (i !== -1) { n++; i = body.indexOf(needle, i + needle.length); }
    if (n) hits.push({ file: f, count: n });
  }
  for (const f of await files(join(root, 'public'))) {
    const body = await readFile(f, 'utf8');
    let n = 0, i = body.indexOf(needle);
    while (i !== -1) { n++; i = body.indexOf(needle, i + needle.length); }
    if (n) hits.push({ file: f, count: n });
  }
  return hits;
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
          let before = '', after = '', near = '';
          try { ({ before, after, near = '' } = JSON.parse(raw)); } catch { return send(400, { ok: false, why: 'bad body' }); }
          before = String(before ?? ''); after = String(after ?? '');
          if (!before.trim()) return send(400, { ok: false, why: 'nothing to look for' });
          if (before === after) return send(200, { ok: true, why: 'no change' });
          /* an apostrophe in the page is curly; the source may hold it either
             way, so try what the page has first and the typewriter form after */
          /* what the page shows is not always what the file holds: an
             apostrophe may be curly on screen and typewritten in the source,
             and a sentence this editor wrote earlier carries backslashes in
             front of its quotes. Try the plain form, then those. */
          const plain = before.replace(/’/g, "'").replace(/[“”]/g, '"');
          const tries = [
            before,
            plain,
            before.replace(/(['"`])/g, '\\$1'),
            plain.replace(/(['"`])/g, '\\$1'),
          ];
          for (const needle of tries) {
            const hits = await findAll(root, needle);
            const total = hits.reduce((n, h) => n + h.count, 0);
            if (total === 0) continue;
            if (total > 1) {
              /* Guessing which one you meant was tried and it picked the wrong
                 file on its first test (09-14), so it refuses instead. Edit a
                 longer line that only exists once, or change this one by hand. */
              return send(409, {
                ok: false,
                why: `these words are in ${total} places, so I cannot tell which one you meant. Edit a longer line that is only in one place, or change this one by hand`,
                files: hits.map((h) => h.file.replace(root, '')),
              });
            }
            const hit = hits[0];
            const body = await readFile(hit.file, 'utf8');
            const at = body.indexOf(needle);
            /* A sentence usually lives inside a quoted string in the source, so
               a typed apostrophe would end that string early and break the
               file. This happened once, on 09-14: an apostrophe typed into a
               product line closed the string and the whole site stopped
               building. So the replacement is escaped for whatever is actually
               holding it. */
            const safe = fit(body, at, after);
            await writeFile(hit.file, body.slice(0, at) + safe + body.slice(at + needle.length), 'utf8');
            return send(200, { ok: true, file: hit.file.replace(root, '') });
          }
          return send(404, { ok: false, why: 'the page builds that line out of pieces, so it is not one piece of text in the source' });
        });
      },
    },
  };
}
