/* Render every icon in src/data/pixels.ts to PNG so a person can look at it.

   node scripts/icons-preview.mjs [outdir] [scale]
   Writes <outdir>/<id>.svg and <id>.png (via macOS QuickLook) plus sheet.html
   with every icon at 1x, 2x and 4x on a grey desktop pattern. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { pix, pixSvg } from '../src/data/pixels.ts';

const out = process.argv[2] ?? 'scratch/icons';
const scale = Number(process.argv[3] ?? 8);
mkdirSync(out, { recursive: true });
const ids = Object.keys(pix);
for (const id of ids) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${32 * scale}" height="${32 * scale}" shape-rendering="crispEdges">${pixSvg(id)}</svg>`;
  writeFileSync(`${out}/${id}.svg`, svg);
  try { execSync(`qlmanage -t -s ${32 * scale} -o "${out}" "${out}/${id}.svg" >/dev/null 2>&1`); } catch {}
}
const cell = (id, s) => `<svg viewBox="0 0 32 32" width="${32 * s}" height="${32 * s}" shape-rendering="crispEdges">${pixSvg(id)}</svg>`;
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:24px;font:12px Geneva,Verdana,sans-serif;background:
 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2' height='2'%3E%3Crect width='1' height='1' fill='%23000'/%3E%3Crect x='1' y='1' width='1' height='1' fill='%23000'/%3E%3C/svg%3E") #fff}
.row{display:flex;align-items:flex-end;gap:16px;margin:0 0 20px;padding:8px;background:#fff;width:max-content}
.row b{width:120px}</style>
${ids.map((id) => `<div class="row"><b>${id}</b>${cell(id, 1)}${cell(id, 2)}${cell(id, 4)}</div>`).join('')}`;
writeFileSync(`${out}/sheet.html`, html);
console.log(`${ids.length} icons -> ${out}`);
