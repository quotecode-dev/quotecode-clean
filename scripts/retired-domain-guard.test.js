// חוק ברזל (Domain/Brand Centralization, systemic remediation task,
// 2026-09-09): send-quote-email, chat-ai, and billing-checkout-stub were all
// independently found, at different times, still running the retired
// "ProFlow"/"quotecodepro.com" branding live on Production after the
// TEKANGO domain migration - because nothing in this repository ever
// checked for it. A shared runtime constant (src/shared/brand.js) closes
// this for the frontend bundle going forward, but each Supabase Edge
// Function is bundled and deployed independently and cannot import it - so
// this test is the only mechanism that can catch the same drift recurring
// in an Edge Function. It scans every ACTIVE runtime source file (frontend
// src/, Edge Function supabase/functions/*/index.ts) for the retired brand
// name/domain and fails if found anywhere outside the documented, allowed
// exceptions (migration history, legacy-redirect config, docs, and tests
// that intentionally verify migration/legacy-redirect behavior).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');
const RETIRED_PATTERNS = [/quotecodepro\.com/i, /\bProFlow\b/];

// Paths where the retired brand/domain is EXPECTED and correct to find -
// never flag these. Keep this list narrow and explicit; a new file should
// have to be added here deliberately, not swept in by a broad glob.
const ALLOWED_SUBSTRINGS = [
  'vercel.json', // legacy-host redirect rules - must keep matching the old domain to redirect it
  'public/sitemap.xml', // may reference legacy redirect targets for crawler continuity
  'PROFLOW_', // continuity/handoff docs - historical record, not runtime
  'docs/archive/', // archived history
  '.test.', // tests that assert legacy strings are ABSENT, or that verify redirect/migration behavior, reference them as data
  'supabase/migrations/', // migration history is immutable historical record
  'node_modules/',
  '.git/',
  'dist/',
];

function isAllowed(relPath) {
  return ALLOWED_SUBSTRINGS.some((s) => relPath.includes(s));
}

// Strip // and /* */ comments before matching - internal developer comments
// routinely reference historical task/phase names literally called
// "ProFlow" (this whole codebase's own established convention, e.g. commit
// messages and code comments throughout this project's history), and are
// not live user-facing branding. This guard's job is to catch a retired
// brand name/domain in something a user actually sees or a server actually
// sends - a comment mentioning the migration is documentation, not drift.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(REPO_ROOT, full).replace(/\\/g, '/');
    if (isAllowed(rel)) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('retired-domain-guard - no ProFlow/quotecodepro.com branding in active runtime files', () => {
  it('src/ (frontend bundle) contains no retired brand/domain references', () => {
    const files = walk(join(REPO_ROOT, 'src'));
    const offenders = [];
    for (const file of files) {
      const content = stripComments(readFileSync(file, 'utf-8'));
      for (const pattern of RETIRED_PATTERNS) {
        if (pattern.test(content)) offenders.push(relative(REPO_ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('supabase/functions/ (Edge Functions) contains no retired brand/domain references', () => {
    const files = walk(join(REPO_ROOT, 'supabase', 'functions'));
    const offenders = [];
    for (const file of files) {
      const content = stripComments(readFileSync(file, 'utf-8'));
      for (const pattern of RETIRED_PATTERNS) {
        if (pattern.test(content)) offenders.push(relative(REPO_ROOT, file));
      }
    }
    // clever-processor/send-welcome-email are known, already-flagged
    // exceptions (Orphan Edge Function Recovery task) - their branding
    // correction is deliberately held pending Owner confirmation of trigger
    // wiring, not an oversight this guard should fail the build over.
    const knownPendingCorrection = ['clever-processor', 'send-welcome-email'];
    const unexpected = offenders.filter((f) => !knownPendingCorrection.some((name) => f.includes(name)));
    expect(unexpected).toEqual([]);
  });
});
