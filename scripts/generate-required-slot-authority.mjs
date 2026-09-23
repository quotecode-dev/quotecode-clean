// One-time generator for the static REQUIRED_SLOT_IDENTITY_DIGESTS table in
// src/data/productTruthRequiredSlotAuthority.js (Finding 1). Run ONLY after a deliberate, reviewed change to the
// acceptance definition; the table is committed as static text and is never recomputed at validation time.
//   node scripts/generate-required-slot-authority.mjs            # prints the table body
//   node scripts/generate-required-slot-authority.mjs --write    # substitutes it for the __TABLE__ marker / existing table
import { readFileSync, writeFileSync } from 'node:fs';
import { FINAL_MATRIX_DEFINITIONS } from '../src/data/productTruthFinalMatrixAcceptance.js';
import { slotIdentityDigest } from '../src/data/productTruthRequiredSlotAuthority.js';

const body = Object.entries(FINAL_MATRIX_DEFINITIONS).map(([key, def]) => {
  const lines = def.slots.map((s) => `    ${JSON.stringify(s.slot)}: ${JSON.stringify(slotIdentityDigest(key, s))},`).join('\n');
  return `  ${key}: Object.freeze({\n${lines}\n  }),`;
}).join('\n');

if (process.argv.includes('--write')) {
  const file = 'src/data/productTruthRequiredSlotAuthority.js';
  const src = readFileSync(file, 'utf8');
  const re = /export const REQUIRED_SLOT_IDENTITY_DIGESTS = Object\.freeze\(\{[\s\S]*?\n\}\);/;
  writeFileSync(file, src.replace(re, () => `export const REQUIRED_SLOT_IDENTITY_DIGESTS = Object.freeze({\n${body}\n});`));
  console.log('table written to', file);
} else {
  console.log(body);
}
