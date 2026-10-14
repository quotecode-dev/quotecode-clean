// Task 16 - Quote Experience V2: shared helpers for the responsive / output QA scripts.
// QA tooling only (never imported by the app). Chromium headless via the repository's own Playwright install.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const QA_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(QA_DIR, '..', '..', '..');
export const DEFAULT_OUT = path.join(
  os.tmpdir(), 'claude', 'c--Users-sales-Documents-YoutubeChanel-WebSite-quotecode-saas',
  'b6da8cf3-4c20-4651-96fb-4c72cd0ac39f', 'scratchpad', 'qa',
);
export const TEST_PROJECT_REF = 'ljfizgrdyzxddswcedwr';
export const PROTECTED_PORT = 5186;

export const STATUS = Object.freeze({ PASS: 'PASS', FAIL: 'FAIL', NOT_TESTED: 'NOT TESTED' });

export function loadPlaywright() {
  const require = createRequire(path.join(REPO_ROOT, 'package.json'));
  const target = process.env.PW_PATH || 'playwright';
  return require(target);
}

// --key value | --key=value | --flag
export function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 0) { out[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { out[key] = next; i += 1; } else out[key] = true;
  }
  return out;
}

export function resolveBaseUrl(args) {
  const raw = String(args['base-url'] || process.env.BASE_URL || '').trim();
  if (!raw) throw new Error('BASE_URL is required (--base-url http://127.0.0.1:54xx or env BASE_URL)');
  const u = new URL(raw);
  if (!['127.0.0.1', 'localhost'].includes(u.hostname)) throw new Error(`refusing non-local BASE_URL host ${u.hostname}`);
  return u.origin;
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function outDir(args, sub) {
  const base = path.resolve(String(args.out || process.env.QA_OUT || DEFAULT_OUT));
  return ensureDir(sub ? path.join(base, sub) : base);
}

export function check(status, detail) {
  return detail === undefined ? { status } : { status, detail };
}
export const pass = (detail) => check(STATUS.PASS, detail);
export const fail = (detail) => check(STATUS.FAIL, detail);
export const notTested = (detail) => check(STATUS.NOT_TESTED, detail);

export function summarize(cells) {
  const byCheck = {};
  const totals = { PASS: 0, FAIL: 0, 'NOT TESTED': 0 };
  for (const c of cells) {
    for (const [name, r] of Object.entries(c.checks || {})) {
      byCheck[name] ||= { PASS: 0, FAIL: 0, 'NOT TESTED': 0 };
      byCheck[name][r.status] += 1;
      totals[r.status] += 1;
    }
  }
  const failures = [];
  for (const c of cells) {
    for (const [name, r] of Object.entries(c.checks || {})) if (r.status === STATUS.FAIL) failures.push({ cell: c.id, check: name, detail: r.detail });
  }
  return { totals, byCheck, failures };
}

export function writeJson(file, data, redactor) {
  let text = JSON.stringify(data, null, 2);
  if (redactor) text = redactor(text);
  fs.writeFileSync(file, text + '\n');
  return file;
}

export function slug(s) {
  return String(s).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

// Overflow probe: document width vs viewport plus the widest offenders (for a reproducible defect report).
export async function probeOverflow(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const sw = document.documentElement.scrollWidth;
    const offenders = [];
    if (sw > vw) {
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > vw + 1 || r.left < -1) {
          const cs = getComputedStyle(el);
          if (cs.position === 'fixed' && cs.visibility === 'hidden') continue;
          const id = el.id ? `#${el.id}` : '';
          const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}` : '';
          offenders.push({ el: `${el.tagName.toLowerCase()}${id}${cls}`, left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) });
        }
      }
    }
    // Keep the outermost few: an offender whose ancestor is already listed adds nothing.
    return { innerWidth: vw, scrollWidth: sw, offenders: offenders.slice(0, 8) };
  });
}

export async function viewportMeta(page) {
  return page.evaluate(() => {
    const metas = [...document.querySelectorAll('meta[name="viewport"]')].map((m) => m.getAttribute('content') || '');
    return metas;
  });
}

export function viewportMetaVerdict(metas) {
  if (!metas.length) return fail('no <meta name="viewport">');
  const bad = metas.filter((c) => /user-scalable\s*=\s*(no|0)\b/i.test(c) || /maximum-scale\s*=\s*1(\.0+)?(?![\d.])/i.test(c));
  return bad.length ? fail({ metas }) : pass({ metas });
}

export function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export function isMain(metaUrl) {
  return !!process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(metaUrl).toLowerCase();
}

// ---------------------------------------------------------------------------------------------------------------
// IRON-DATA-001 persona allowlist (fail-closed). A persona may sign in ONLY when sha256(lowercased email) is listed in
// synthetic-personas.json `testPersonas` and the address matches no denylist pattern. Messages never contain the email.
// Allowed set (2026-10-05): LOCAL_PRO, INTL_PRO, INTL_EUR, INTL_GBP, PERSONA_SUPER_ADMIN (and PERSONA_A).
// Never: LOCAL_BASIC / INTL_FREE / INTL_BASIC / LOCAL_FREE / LOCAL_ADMIN / *_EXPIRED / ABANDONED_FREE.
// ---------------------------------------------------------------------------------------------------------------
export const PERSONA_ALLOWLIST_FILE = process.env.T16_PERSONA_ALLOWLIST || 'C:/tkrtool-iron/scripts/iron-laws/synthetic-personas.json';
export const FORBIDDEN_PERSONA_KEY = /(LOCAL_BASIC|INTL_BASIC|INTL_FREE|LOCAL_FREE|LOCAL_ADMIN|_EXPIRED|ABANDONED_FREE)/;

export function loadPersonaAllowlist() {
  const j = JSON.parse(fs.readFileSync(PERSONA_ALLOWLIST_FILE, 'utf8'));
  if (!Array.isArray(j.testPersonas) || !j.testPersonas.length) throw new Error('testPersonas missing');
  return {
    hashes: new Set(j.testPersonas.map((p) => String(p.emailSha256 || '').toLowerCase()).filter((h) => /^[0-9a-f]{64}$/.test(h))),
    deny: (j.denylistPatterns || []).map((p) => String(p).toLowerCase()).filter(Boolean),
  };
}

// Throws (fail-closed) unless the persona is allowlisted. `label` is a key/persona NAME, never the address.
export function assertAllowlistedPersona(email, label = 'persona') {
  if (FORBIDDEN_PERSONA_KEY.test(String(label))) throw new Error(`${label}: persona key is forbidden by IRON-DATA-001 (refused)`);
  if (typeof email !== 'string' || !email.includes('@')) throw new Error(`${label}: no e-mail configured (refused)`);
  let list;
  try { list = loadPersonaAllowlist(); } catch (e) { throw new Error(`persona allowlist unavailable - refusing to sign in (fail-closed): ${String(e.message || e).slice(0, 80)}`); }
  const lower = email.trim().toLowerCase();
  if (list.deny.some((p) => lower.includes(p))) throw new Error(`${label}: matches the synthetic-persona denylist (refused)`);
  const h = crypto.createHash('sha256').update(lower).digest('hex');
  if (!list.hashes.has(h)) throw new Error(`${label}: not in synthetic-personas.json testPersonas (refused, fail-closed)`);
  return true;
}
