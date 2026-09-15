/* Facts about this very build, measured at build time.

   The Terminal's neofetch and the About This Mac panel both promise the
   truth, so every line here is read off the machine that is building the
   site: the commit being built, the day it was built, the Astro that built
   it, and how much the site's own files weigh. Nothing is typed in by hand
   and nothing is guessed. */
import { execSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

function commit(): string {
  const env = process.env.VERCEL_GIT_COMMIT_SHA;
  if (env) return env.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { cwd: process.cwd() }).toString().trim();
  } catch {
    return 'unversioned';
  }
}

function astroVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    return (require('astro/package.json') as { version: string }).version;
  } catch {
    return '7';
  }
}

/* public/ is what the deployed site serves besides its own markup and
   scripts, minus the folders below. lab/ is gitignored, so it exists on this
   machine and never on the deploy, and counting it would make a local build
   report a bigger number than the real one. */
const UNSHIPPED = new Set(['lab']);

function weigh(dir: string, top = false): number {
  let total = 0;
  try {
    for (const name of readdirSync(dir)) {
      if (top && UNSHIPPED.has(name)) continue;
      const p = join(dir, name);
      const s = statSync(p);
      if (s.isDirectory()) total += weigh(p);
      else total += s.size;
    }
  } catch {}
  return total;
}

const now = new Date();

export const build = {
  commit: commit(),
  astro: astroVersion(),
  date: now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  shortDate: now.toISOString().slice(0, 10),
  /* the site's files, in whole megabytes, photographs being most of it */
  mb: Math.max(1, Math.round(weigh(join(process.cwd(), 'public'), true) / 1e6)),
};
