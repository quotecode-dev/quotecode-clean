// Generates src/data/productTruthInteractiveBaseline.json (Codex "enforceable source inventory"
// finding, 2026-09-2X) - a mechanical snapshot of real interactive-element-vs-marker counts per
// capability-bearing file, captured from real source, never hand-typed. The completeness gate
// (productTruthInteractiveCompleteness.test.js) fails only when a file's real gap GROWS beyond what
// this baseline recorded - so regenerating this file is itself the reviewable act of accepting a
// new gap; it must never be run reflexively to silence a real regression without review.
//
// Usage:
//   node scripts/generate-product-truth-interactive-baseline.js          # regenerate the file
//   node scripts/generate-product-truth-interactive-baseline.js --check  # exit 1 if stale, no write
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { listScannableFiles } from '../src/data/productTruthCapabilityScanner.js';
import { scanInteractiveSurface } from '../src/data/productTruthInteractiveScanner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_PATH = join(ROOT, 'src', 'data', 'productTruthInteractiveBaseline.json');

const files = listScannableFiles(ROOT, ['src', 'supabase/functions']);
const scan = scanInteractiveSurface(ROOT, files);

const baseline = {};
for (const file of Object.keys(scan).sort()) {
  const s = scan[file];
  baseline[file] = { interactive: s.interactive, markers: s.markers };
}
const output = JSON.stringify(baseline, null, 2) + '\n';

if (process.argv.includes('--check')) {
  const existing = existsSync(OUT_PATH) ? readFileSync(OUT_PATH, 'utf-8') : null;
  if (existing !== output) {
    console.error('productTruthInteractiveBaseline.json is stale - run: node scripts/generate-product-truth-interactive-baseline.js');
    process.exit(1);
  }
  console.log('productTruthInteractiveBaseline.json is up to date.');
  process.exit(0);
}

writeFileSync(OUT_PATH, output);
console.log(`Wrote baseline for ${Object.keys(baseline).length} files -> ${OUT_PATH}`);
