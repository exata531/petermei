/* The gate. Run before pushing; CI runs the same thing.

   Four checks, in the order that finds problems soonest:
     1. the design system, which needs nothing installed
     2. stylelint, the ordinary CSS rules
     3. astro check, the types
     4. the build, because in the end it has to build

   A check whose tool is not installed is SKIPPED and named, not silently
   passed and not treated as a failure. The reason is the machine this was
   written on: npm could not reach the registry that afternoon, and a gate that
   refuses to run at all until every dependency lands is a gate nobody keeps.
   CI installs from the lockfile, so there it runs all four every time.

   A skipped check still prints the one command that would fix it. */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const BIN = 'node_modules/.bin/';

/* `needs` is the path that has to exist for the check to be runnable. For the
   type check that is @astrojs/check itself, not the astro binary: astro is
   always here, and asked to `check` without it, it stops and asks to install
   it, which hangs a run that was supposed to be unattended. */
const checks = [
  { name: 'design system', needs: null, cmd: ['node', ['scripts/design-lint.mjs']] },
  { name: 'stylelint', needs: BIN + 'stylelint', cmd: [BIN + 'stylelint', ['src/styles/**/*.css']] },
  { name: 'types', needs: 'node_modules/@astrojs/check', cmd: [BIN + 'astro', ['check']] },
  { name: 'build', needs: BIN + 'astro', cmd: [BIN + 'astro', ['build']] },
];

let failed = 0;
const bad = [];
const skipped = [];

for (const { name, needs, cmd } of checks) {
  if (needs && !existsSync(needs)) {
    skipped.push(name);
    console.log(`\n── ${name}: SKIPPED, ${needs.split('/').pop()} is not installed ──`);
    continue;
  }
  console.log(`\n── ${name} ──`);
  const r = spawnSync(cmd[0], cmd[1], { stdio: 'inherit' });
  /* a signal, or a binary that would not start, leaves status null; that is a
     failure too, and saying which check it was is the whole point of a gate */
  if (r.status !== 0) { failed++; bad.push(`${name} (${r.status === null ? r.error?.message || 'did not run' : 'exit ' + r.status})`); }
}

console.log('');
if (skipped.length) {
  console.log(`skipped: ${skipped.join(', ')}`);
  console.log('to run everything:  npm install');
}
if (failed) {
  console.log(`failed: ${bad.join(', ')}`);
  process.exit(1);
}
console.log(skipped.length ? 'everything that could run, passed.' : 'all four passed.');
