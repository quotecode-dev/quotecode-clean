// Generates src/data/productTruthControlBaseline.json (Codex final re-review Blocker 1,
// 2026-09-2X: "replacement-control gate still accepts a swapped control"). Persists, per real
// capability id, the structural identity key(s) (productTruthControlScanner.computeIdentityKey)
// of the control(s) currently resolving to it - captured from real source, never hand-typed. The
// identity gate (checkControlIdentityBaseline, exercised in productTruthControlScanner.test.js)
// fails the instant a capability id's resolved control has an identity key NOT in this file, i.e.
// the control behind that id was replaced (different kind/tag/handler/enclosing component) OR the
// id is new and was never explicitly reviewed - so regenerating this file is itself the reviewable
// act of accepting a control's new identity ("explicit remap"); it must never be run reflexively
// to silence a real regression without review.
//
// Usage:
//   node scripts/generate-product-truth-control-baseline.js          # regenerate the file
//   node scripts/generate-product-truth-control-baseline.js --check  # exit 1 if stale, no write
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { listScannableFiles } from '../src/data/productTruthCapabilityScanner.js';
import { scanControlsInFiles, controlScopeFiles, computeIdentityKey } from '../src/data/productTruthControlScanner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_PATH = join(ROOT, 'src', 'data', 'productTruthControlBaseline.json');

const allFiles = listScannableFiles(ROOT, ['src', 'supabase/functions']);
const inScope = controlScopeFiles(allFiles);
const { controls, parseErrors } = scanControlsInFiles(ROOT, inScope);
if (parseErrors.length > 0) {
  console.error(`Refusing to generate: parse errors in ${parseErrors.length} file(s):\n${parseErrors.join('\n')}`);
  process.exit(1);
}

const byCapability = new Map();
for (const c of controls) {
  if (c.resolution.status !== 'resolved' || c.resolution.type !== 'capability') continue;
  const id = c.resolution.id;
  const key = computeIdentityKey(c);
  if (!byCapability.has(id)) byCapability.set(id, new Set());
  byCapability.get(id).add(key);
}

const baseline = {};
for (const id of [...byCapability.keys()].sort()) {
  baseline[id] = [...byCapability.get(id)].sort();
}
const output = JSON.stringify(baseline, null, 2) + '\n';

if (process.argv.includes('--check')) {
  const existing = existsSync(OUT_PATH) ? readFileSync(OUT_PATH, 'utf-8') : null;
  if (existing !== output) {
    console.error('productTruthControlBaseline.json is stale - run: node scripts/generate-product-truth-control-baseline.js');
    process.exit(1);
  }
  console.log('productTruthControlBaseline.json is up to date.');
  process.exit(0);
}

writeFileSync(OUT_PATH, output);
console.log(`Wrote control identity baseline for ${Object.keys(baseline).length} capabilities -> ${OUT_PATH}`);
