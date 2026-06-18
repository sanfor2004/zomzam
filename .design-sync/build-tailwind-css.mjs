// Compiles src/app/globals.css with this repo's own Tailwind v4 pipeline
// (@tailwindcss/postcss) so the design-sync converter's cssEntry gets the
// real compiled @theme tokens + utility classes, not a reimplementation.
// Run from the repo root: node .design-sync/build-tailwind-css.mjs
//
// next/font/google self-hosts Inter + JetBrains Mono at Next.js build time,
// which this standalone PostCSS pass can't reproduce — `next build` itself
// is blocked by a pre-existing, unrelated TypeScript error in
// usePageEntrance.ts. The families are genuine Google Fonts either way, so
// a CDN @import is prepended as a faithful (if not self-hosted) substitute.
// See .design-sync/NOTES.md "Re-sync risks" if next/font's weights change.

import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FONTS_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');\n\n";

const input = resolve('src/app/globals.css');
const output = resolve('.design-sync/tailwind-build.css');

const css = readFileSync(input, 'utf8');
const result = await postcss([tailwindcss({ base: resolve('.') })]).process(css, {
  from: input,
  to: output,
}).async();

writeFileSync(output, FONTS_IMPORT + result.css);
console.error(`  tailwind: compiled ${input} -> ${output} (${(result.css.length / 1024).toFixed(0)} KB)`);
