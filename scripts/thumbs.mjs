/* Thumbnails for the photo library.

   Two sizes per photo, written once and committed: a 560px grid thumbnail
   (about a tenth of the source) and a 128px icon for the desktop and Finder.
   The sources in public/img/photos stay as they are; the viewer shows those.
   Run: node scripts/thumbs.mjs */
import sharp from 'sharp';
import { readdirSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const src = new URL('../public/img/photos/', import.meta.url).pathname;
const out = { t: 560, i: 128 };
for (const dir of Object.keys(out)) mkdirSync(join(src, dir), { recursive: true });

let n = 0, bytes = 0;
for (const f of readdirSync(src)) {
  if (!f.endsWith('.webp')) continue;
  for (const [dir, size] of Object.entries(out)) {
    const to = join(src, dir, f);
    await sharp(join(src, f))
      .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: dir === 'i' ? 72 : 76, effort: 6 })
      .toFile(to);
    bytes += statSync(to).size;
    n++;
  }
}
console.log(`${n} thumbnails, ${Math.round(bytes / 1024)} KB`);
