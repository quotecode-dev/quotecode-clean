// Omer - the daily LIVE check runner (Codex release 9, topic 10; Owner console 2026-10-30: "מאשר לעומר פתח כניסה מיוחד בשרת, רק לשני
// חשבונות הבדיקה ..." + decisions 17-20). Runs on a GitHub-hosted Ubuntu runner (.github/workflows/daily-live-check.yml), one worker.
//  - Public pages (anonymous) and the two test accounts (Israel / Hebrew, international / English) at four screen sizes in Chromium.
//  - Signed in through the live-check function's session for a REGISTERED persona only; the session lives in this browser context and
//    is never written to disk, uploaded or printed.
//  - Read-only: it opens screens and the plans window. It creates, saves, sends, signs and buys nothing (decision 18) - the report says so.
//  - It reports typed steps and hashes only (decision 19): no screenshot, no page text, no address. A deployment that changed during
//    the run makes the result inconclusive, never green. One transient retry per step, inside the 30-minute job budget.
// Environment: LIVE_CHECK_URL (the live-check function URL), LIVE_CHECK_SECRET, RUN_ID (empty = the scheduled run).
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';

const SITE = 'https://www.tekango.com';
const SIZES = [[1440, 900], [1180, 820], [820, 1180], [390, 844]];
const PUBLIC = { il: [['public_home', '/he'], ['public_privacy', '/he/privacy'], ['public_tools', '/he/tools']],
  intl: [['public_home', '/en'], ['public_privacy', '/en/privacy'], ['public_tools', '/en/tools']] };
const FN = process.env.LIVE_CHECK_URL || '';
const EVENT = process.env.TRIGGER_EVENT || '';
const SECRET = process.env.LIVE_CHECK_SECRET || '';
const STARTED = Date.now();
const BUDGET_MS = 25 * 60_000;

const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
async function call(body) {
  const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-live-check-secret': SECRET }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
}
async function versionHash() {
  try { const r = await fetch(`${SITE}/version.json?t=${Date.now()}`, { cache: 'no-store' }); return r.ok ? sha(JSON.stringify(await r.json())) : null; } catch { return null; }
}

// the facts of the rendered page: horizontal overflow, the direction of the app's own root, its font, and the page's own errors
async function facts(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#root [dir]') || document.documentElement;
    return { overflow: document.documentElement.scrollWidth - window.innerWidth, dir: (root.getAttribute('dir') || document.documentElement.getAttribute('dir') || 'ltr').toLowerCase(),
      font: getComputedStyle(root).fontFamily || '' };
  });
}
function judge(f, market, errors) {
  if (errors.length) return 'page_error';
  if (f.overflow > 1) return 'overflow';
  if (f.dir !== (market === 'il' ? 'rtl' : 'ltr')) return 'direction';
  if (!/rubik/i.test(f.font)) return 'font';
  return null;
}

// the header renders the plan medallion twice (desktop and phone containers, one hidden by the layout) - take the one on screen,
// and wait for it (isVisible never waits)
const planButton = (page) => page.locator('[data-testid="header-plan-button"]:visible').first();
const shown = (locator) => locator.waitFor({ state: 'visible', timeout: 20000 }).then(() => true, () => false);

async function withRetry(fn) {
  try { return await fn(); } catch (e) {
    if (Date.now() - STARTED > BUDGET_MS) return { ok: false, code: 'budget' };
    try { return await fn(); } catch (e2) { return { ok: false, code: /timeout/i.test(String(e2?.message ?? e2)) ? 'timeout' : 'error' }; }
  }
}

async function checkPage(context, market, path, after) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(sha(String(e?.message ?? e)).slice(0, 12)));
  try {
    const res = await page.goto(`${SITE}${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (!res || res.status() >= 400) return { ok: false, code: `http_${res ? res.status() : 0}` };
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    if (after) { const code = await after(page); if (code) return { ok: false, code }; }
    const code = judge(await facts(page), market, errors);
    const html = await page.evaluate(() => document.querySelector('#root')?.innerHTML.length ?? 0);
    return code ? { ok: false, code } : { ok: true, hash: sha(`${path}:${html}`) };
  } finally { await page.close(); }
}

async function main() {
  if (!FN || SECRET.length < 32) { console.log('live-check: not configured'); process.exit(1); }
  // a dispatch by hand in GitHub without an agents-room run id is refused - only the schedule makes the scheduled (emailing) run
  if (EVENT !== 'schedule' && !process.env.RUN_ID) { console.log('live-check: a manual run starts from the agents room (no run id)'); process.exit(1); }
  const begun = await call({ action: 'begin', runId: process.env.RUN_ID || null });
  if (begun.status !== 200 || !begun.body?.ok) { console.log(`live-check: begin refused ${begun.status} ${begun.body?.code ?? ''}`); process.exit(1); }
  if (begun.body.skip) { console.log('live-check: today\'s scheduled run already exists'); return; }
  const runId = begun.body.runId;
  const before = await versionHash();
  const ref = new URL(FN).hostname.split('.')[0];
  const steps = [];
  const browser = await chromium.launch();
  let reason = null;
  try {
    for (const market of ['il', 'intl']) {
      const lang = market === 'il' ? 'he' : 'en';
      const s = await call({ action: 'session', persona: market });
      const session = s.status === 200 && s.body?.ok ? s.body.session : null;
      for (const [w, h] of SIZES) {
        const size = `${w}x${h}`;
        // the public pages, anonymous
        const anon = await browser.newContext({ viewport: { width: w, height: h }, locale: market === 'il' ? 'he-IL' : 'en-US' });
        for (const [step, path] of PUBLIC[market]) steps.push({ market, size, step, ...(await withRetry(() => checkPage(anon, market, path))) });
        await anon.close();
        // the test account (no session = the sign-in step failed; nothing else is attempted for this market and size)
        if (!session) { steps.push({ market, size, step: 'login', ok: false, code: `session_${s.status}` }); continue; }
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: market === 'il' ? 'he-IL' : 'en-US' });
        await ctx.addInitScript(([key, value, l]) => { try { localStorage.setItem(key, value); localStorage.setItem('proflow_lang', l); } catch { /* storage blocked */ } },
          [`sb-${ref}-auth-token`, JSON.stringify(session), lang]);
        steps.push({ market, size, step: 'dashboard', ...(await withRetry(() => checkPage(ctx, market, '/dashboard', async (page) => {
          return (await shown(planButton(page))) ? null : 'not_signed_in';
        }))) });
        steps.push({ market, size, step: 'plans', ...(await withRetry(() => checkPage(ctx, market, '/dashboard', async (page) => {
          const button = planButton(page);
          if (!(await shown(button))) return 'not_signed_in';
          await button.click();
          return (await page.getByTestId('plans-modal').isVisible({ timeout: 15000 }).catch(() => false)) ? null : 'plans_not_open';
        }))) });
        await ctx.close();
        if (Date.now() - STARTED > BUDGET_MS) { reason = 'budget'; break; }
      }
      if (session) await call({ action: 'signout', accessToken: session.access_token }).catch(() => null);
      if (reason) break;
    }
  } catch (e) {
    reason = 'runner_error';
    console.log(`live-check: runner error ${sha(String(e?.message ?? e)).slice(0, 12)}`);
  } finally {
    await browser.close();
  }
  const after = await versionHash();
  if (!reason && (!before || !after)) reason = 'version_unknown';
  if (!reason && before !== after) reason = 'deploy_changed';
  const failed = steps.some((x) => !x.ok);
  const outcome = reason ? 'inconclusive' : failed ? 'failed' : 'passed';
  const r = await call({ action: 'report', runId, outcome, steps, reason, version: { ...(before ? { before } : {}), ...(after ? { after } : {}) } });
  console.log(`live-check: ${outcome} (${steps.length} steps, ${steps.filter((x) => !x.ok).length} failed) - report ${r.status}`);
  if (r.status !== 200) process.exit(1);
}

main().catch((e) => { console.log(`live-check: failed ${sha(String(e?.message ?? e)).slice(0, 12)}`); process.exit(1); });
