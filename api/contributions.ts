/* GET /api/contributions

   The live half of the home page's GitHub grid. Fetches the public
   contributions HTML for the profile, parses it with the same code the
   build uses, and answers JSON. Vercel caches the answer at the edge for
   half an hour and serves it stale for a day while it refreshes, so
   GitHub sees a request every thirty minutes at most, whatever the
   traffic. On any failure the page keeps the build-time grid. */
import type { IncomingMessage, ServerResponse } from 'node:http';
/* '.js', pointing at a '.ts' file, which looks wrong and is correct. This file
   is compiled by the host rather than bundled by Astro, and whatever specifier
   is written here survives into the emitted JavaScript untouched. Node's module
   resolver wants a real extension, so '.ts' and no extension at all both fail
   to load the function, before its own error handling can answer; '.js' is the
   name the compiled neighbour actually has. TypeScript understands this and
   resolves it back to the .ts source. Astro's copy of this import keeps the
   .ts extension, because Vite resolves that one itself. */
import { parse, URL } from '../src/data/github-parse.js';

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  try {
    const r = await fetch(URL, {
      headers: { 'user-agent': 'petermei.com', accept: 'text/html' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const cal = parse(await r.text());
    if (!cal) throw new Error('the calendar markup did not parse');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400');
    res.end(JSON.stringify({ ...cal, at: new Date().toISOString() }));
  } catch (e) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
  }
}
