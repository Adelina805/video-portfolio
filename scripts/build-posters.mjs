// Generates responsive WebP poster variants from the JPEG posters in
// public/media and writes the srcset manifest used by src/main.js.
// Run with `npm run posters` after adding or replacing a poster.

import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mediaDir = path.join(root, 'public/media');
const outDir = path.join(mediaDir, 'posters');
const manifestPath = path.join(root, 'src/posters.json');

const WIDTHS = [320, 480, 640];
const QUALITY = 80;

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const files = (await readdir(mediaDir)).filter((file) => file.endsWith('.jpg')).sort();
const manifest = {};
let sourceBytes = 0;
let outputBytes = 0;

for (const file of files) {
  const input = path.join(mediaDir, file);
  const name = path.basename(file, '.jpg');
  const { width: sourceWidth } = await sharp(input).metadata();

  // Never upscale; the source width is always offered as the largest variant.
  const widths = [...new Set([...WIDTHS.filter((w) => w < sourceWidth), sourceWidth])];

  manifest[`/media/${file}`] = [];
  for (const width of widths) {
    const outName = `${name}-${width}.webp`;
    const info = await sharp(input)
      .resize({ width })
      .webp({ quality: QUALITY, effort: 6 })
      .toFile(path.join(outDir, outName));
    manifest[`/media/${file}`].push({ src: `/media/posters/${outName}`, width });
    if (width === widths.at(-1)) outputBytes += info.size;
  }
  sourceBytes += (await stat(input)).size;
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`${files.length} posters -> ${path.relative(root, outDir)}`);
console.log(`full-size JPEG total: ${(sourceBytes / 1024).toFixed(0)} KiB`);
console.log(`full-size WebP total: ${(outputBytes / 1024).toFixed(0)} KiB`);
