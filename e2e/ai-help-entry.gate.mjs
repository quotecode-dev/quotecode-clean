// AI HELP ENTRY UX GATE (§51.15 "AI HELP ENTRY MUST BE SELF-EXPLANATORY"; canonical 5186; synthetic allowlisted personas).
// For the Smart Quote / Add-item wizard, the blocker alert, the file-error pop-up and the plans pop-up x HE/EN x 320/360/390/412/1366:
//   * the entry shows the canonical AI Chat icon (data-ai-chat-icon="canonical", rendered) AND the visible label (שאל את AI / Ask AI)
//   * fully inside the viewport, intersects no title / Close / CTA / other control of its modal, no horizontal page overflow
//   * keyboard: focus + Enter opens the ONE assistant; closing it returns to the SAME modal/wizard state (wizard: same step, typed data kept)
//   node e2e/ai-help-entry.gate.mjs http://192.168.1.189:5186 [--lang=he|en] [--w=390]
import { chromium, personas, openAuthed, evidenceDir, writeEvidence, shot, servedIdentity, identityProblems, EXPECTED, baseFromArgs, rectOf } from './lib/canonical.mjs';

const BASE = baseFromArgs();
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || null;
const LANGS = arg('lang') ? [arg('lang')] : ['he', 'en'];
const WIDTHS = arg('w') ? [Number(arg('w'))] : [320, 360, 390, 412, 1280, 1440];
// §51.16 header surfaces: the AI action shares the title row; desktop = centred long label, mobile = same row, short label
const HEADER = new Set(['wizard', 'plans']);
const LONG = { he: 'צריך עזרה? שאל את AI', en: 'Need help? Ask AI' }; const SHORT = { he: 'שאל את AI', en: 'Ask AI' };
const PERSONA = { he: personas.PERSONA_A, en: personas.PERSONA_EN };
const LABEL = { he: /^(צריך עזרה\? )?שאל את AI$/, en: /^(Need help\? )?Ask AI$/ };
const dir = evidenceDir('ai-help-entry');
const nav = (page, action) => page.evaluate((a) => window.dispatchEvent(new CustomEvent('proflow-ai-navigate', { detail: { action: a, meta: null } })), action);
const settle = (page, ms = 600) => page.waitForTimeout(ms);

async function expandDraftRow(page, lang) {
  await nav(page, 'open_quote_history'); await settle(page);
  const row = page.locator('tr:has(button[aria-expanded]), button[aria-expanded]').filter({ hasText: lang === 'he' ? /טיוטה/ : /Draft/ }).filter({ hasNotText: lang === 'he' ? /לא גמורה/ : /Unfinished/ }).first();
  await row.waitFor({ state: 'visible', timeout: 20000 });
  const toggle = (await row.evaluate((el) => el.tagName)) === 'TR' ? row.locator('button[aria-expanded]').first() : row;
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') { await toggle.click(); await settle(page, 400); }
}
async function reset(page) {
  const close = page.locator('.ai-chat-popup').getByRole('button', { name: /^(Close|סגור)$/ });
  if (await close.isVisible().catch(() => false)) await close.click();
  for (const re of [/^(OK|הבנתי, סגור)$/, /^(OK|אישור)$/]) { const b = page.getByRole('button', { name: re }).first(); if (await b.isVisible().catch(() => false)) await b.click(); }
  for (let i = 0; i < 3; i++) await page.keyboard.press('Escape').catch(() => {});
  await nav(page, 'open_dashboard'); await settle(page);
}

const SURFACES = {
  wizard: { testId: 'ai-help-wizard', reach: async (page, lang) => {
    await nav(page, 'open_new_quote');
    await page.getByRole('button', { name: lang === 'he' ? /הוספת מוצר או עבודה/ : /Add product or work/ }).first().click();
    // catalog-first step: take the product's own "not in the catalog" path to the free-text description (same as smart-quote-flows)
    const manual = page.getByText(/Not in the catalog\? Add a product|לא מצאתם בקטלוג\? הוסיפו מוצר/);
    if (await manual.count()) await manual.first().click();
    await page.locator('#wiz-description').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#wiz-description').fill('AI entry synthetic item');
    await page.getByRole('button', { name: lang === 'he' ? /^הבא$/ : /^Next$/ }).first().click(); await settle(page, 400);
  } },
  alert: { testId: 'ai-help-alert', reach: async (page, lang) => {
    await expandDraftRow(page, lang);
    await page.getByRole('button', { name: lang === 'he' ? /^שלח במייל$/ : /^Email$/ }).first().click();
    const c = page.getByRole('button', { name: lang === 'he' ? /^כן, שלח מייל$/ : /^Yes, Send$/ }); await c.waitFor({ state: 'visible', timeout: 10000 }); await c.click();
  } },
  fileError: { testId: 'ai-help-file-error', reach: async (page, lang) => {
    await expandDraftRow(page, lang);
    await page.getByRole('button', { name: lang === 'he' ? /^ערוך$/ : /^Edit$/ }).first().click();
    await page.locator('input[list="existing-clients-list"]').waitFor({ state: 'visible', timeout: 20000 });
    const [ch] = await Promise.all([page.waitForEvent('filechooser', { timeout: 15000 }), page.getByRole('button', { name: lang === 'he' ? /צרף קובץ/ : /Attach File/ }).first().click()]);
    await ch.setFiles({ name: 'synthetic-oversize.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(3.5 * 1024 * 1024, 0x20) }); // refused locally, never uploaded
  } },
  plans: { testId: 'ai-help-plans', reach: async (page) => { await nav(page, 'open_plan_information'); } },
};

async function cell(page, { surface, lang, width }) {
  const s = SURFACES[surface]; const rec = { surface, lang, width, checks: [] };
  const c = (name, ok, detail) => rec.checks.push({ name, ok: !!ok, ...(detail !== undefined ? { detail } : {}) });
  try {
    await s.reach(page, lang);
    const entry = page.getByTestId(s.testId); await entry.waitFor({ state: 'visible', timeout: 15000 });
    await settle(page, 700); // modal entrance animations (e.g. the alert's pop-in scale) must finish before geometry is measured
    const geo = await entry.evaluate((el) => {
      const r = el.getBoundingClientRect(); const icon = el.querySelector('[data-ai-chat-icon="canonical"]'); const ir = icon && icon.getBoundingClientRect();
      // the modal the entry lives in: nearest fixed-position ancestor
      let m = el.parentElement; while (m && getComputedStyle(m).position !== 'fixed') m = m.parentElement;
      const others = m ? [...m.querySelectorAll('h1,h2,h3,button,[role="button"],input,select,textarea')].filter((o) => o !== el && !el.contains(o) && !o.contains(el) && o.offsetParent !== null) : [];
      const hit = others.map((o) => ({ o, b: o.getBoundingClientRect() })).filter(({ b }) => b.width > 0 && b.height > 0 && b.left < r.right - 0.5 && r.left < b.right - 0.5 && b.top < r.bottom - 0.5 && r.top < b.bottom - 0.5)
        .map(({ o }) => `${o.tagName}:${(o.getAttribute('aria-label') || o.textContent || '').trim().slice(0, 30)}`);
      // header geometry (§51.16): the header row, its title, its Close
      const head = el.closest('.pf-modal-head'); let hg = null;
      if (head) { const hb = head.getBoundingClientRect(); const t = head.querySelector('.pf-modal-head-title-text'); const cl = head.querySelector('.pf-modal-head-close-btn'); const tb = t && t.getBoundingClientRect(); const cb = cl && cl.getBoundingClientRect();
        const lh = t ? parseFloat(getComputedStyle(t).lineHeight) || parseFloat(getComputedStyle(t).fontSize) * 1.3 : 0;
        hg = { header: { x: hb.x, width: hb.width, height: hb.height, top: hb.top, bottom: hb.bottom }, headCenter: hb.x + hb.width / 2, aiCenter: r.x + r.width / 2, title: tb ? { top: tb.top, bottom: tb.bottom, height: tb.height, left: tb.left, right: tb.right, clipped: t.scrollWidth > t.clientWidth + 1, lines: Math.round(tb.height / lh), fontPx: parseFloat(getComputedStyle(t).fontSize) } : null,
          close: cb ? { top: cb.top, bottom: cb.bottom, left: cb.left, right: cb.right } : null, aiFontPx: parseFloat(getComputedStyle(el).fontSize) }; }
      return { hg, visibleText: el.innerText.trim(), rect: { x: r.x, y: r.y, width: r.width, height: r.height }, text: el.textContent.trim(), iconRendered: !!ir && ir.width > 0 && ir.height > 0 && !!icon.querySelector('svg'), aria: el.getAttribute('aria-label'), dirAttr: el.getAttribute('dir'),
        overlaps: hit, vw: window.innerWidth, vh: window.innerHeight, scrollW: document.documentElement.scrollWidth, inModal: !!m };
    });
    rec.entry = { rect: rectOf(geo.rect), text: geo.visibleText, aria: geo.aria, header: geo.hg };
    c('visible label (שאל את AI / Ask AI)', LABEL[lang].test(geo.visibleText), geo.visibleText);
    if (HEADER.has(surface)) {
      const hg = geo.hg; const desktop = width >= 1000;
      c('in the shared modal header row (.pf-modal-head)', !!hg);
      if (hg) {
        const vOverlap = (a, b) => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
        const ai = { top: geo.rect.y, bottom: geo.rect.y + geo.rect.height };
        if (hg.title) c('same row as the title', vOverlap(ai, hg.title));
        if (hg.close) c('same row as Close', vOverlap(ai, hg.close));
        c('single compact header row', hg.header.height <= (desktop ? 76 : 60), hg.header.height);
        if (hg.title) { c('title fully readable (not clipped)', !hg.title.clipped); c('title on one line (no wrap)', hg.title.lines <= 1, hg.title.lines); }
        c(desktop ? 'desktop long label' : 'mobile short label', geo.visibleText === (desktop ? LONG[lang] : SHORT[lang]), geo.visibleText);
        if (desktop) c('desktop: AI action visually centred in the modal header (<= 2px)', Math.abs(hg.aiCenter - hg.headCenter) <= 2, +(hg.aiCenter - hg.headCenter).toFixed(2));
        else { c('mobile: reduced title font (<= 14.1px)', !hg.title || hg.title.fontPx <= 14.1, hg.title?.fontPx); c('mobile: reduced AI label font (< 13.6px)', hg.aiFontPx < 13.6, hg.aiFontPx); }
      }
    }
    c('canonical AI Chat icon rendered', geo.iconRendered);
    c('accessible name', /AI/.test(geo.aria || ''), geo.aria);
    c('direction matches language', geo.dirAttr === (lang === 'he' ? 'rtl' : 'ltr'));
    c('inside a modal / wizard layer', geo.inModal);
    c('fully inside the viewport', geo.rect.x >= -0.5 && geo.rect.y >= -0.5 && geo.rect.x + geo.rect.width <= geo.vw + 0.5 && geo.rect.y + geo.rect.height <= geo.vh + 0.5, rectOf(geo.rect));
    c('covers no title / Close / CTA / control', geo.overlaps.length === 0, geo.overlaps.join(' | '));
    c('no horizontal page overflow', geo.scrollW <= geo.vw + 1, `${geo.scrollW} > ${geo.vw}`);
    c(HEADER.has(surface) ? 'touch target >= 32px (compact header)' : '44px touch target', geo.rect.height >= (HEADER.has(surface) ? 31.5 : 43.5), geo.rect.height);
    rec.screenshot = await shot(page, dir, `entry-${surface}-${lang}-${width}.png`);
    // keyboard: focus + Enter opens the ONE assistant
    await entry.focus(); c('keyboard focusable', await entry.evaluate((el) => document.activeElement === el));
    await page.keyboard.press('Enter');
    const popup = page.locator('.ai-chat-popup'); await popup.waitFor({ state: 'visible', timeout: 10000 });
    c('opens the ONE assistant', (await page.locator('.ai-chat-popup').count()) === 1);
    await popup.getByRole('button', { name: /^(Close|סגור)$/ }).click(); await popup.waitFor({ state: 'hidden', timeout: 10000 });
    c('modal still open after closing the assistant', await entry.isVisible());
    if (surface === 'wizard') {
      c('same wizard step (still past step 1)', (await page.locator('#wiz-description').count()) === 0);
      await page.getByRole('button', { name: lang === 'he' ? /^חזרה$/ : /^Back$/ }).first().click();
      c('typed data kept', (await page.locator('#wiz-description').inputValue().catch(() => '')) === 'AI entry synthetic item');
    }
  } catch (e) { c('cell executed', false, String(e?.message || e).slice(0, 300)); }
  rec.result = rec.checks.length && rec.checks.every((x) => x.ok) ? 'PASS' : 'FAIL';
  console.log(`${rec.result} ${surface} ${lang} ${width}${rec.result === 'FAIL' ? ` ${JSON.stringify(rec.checks.filter((x) => !x.ok))}` : ''}`);
  return rec;
}

const browser = await chromium.launch();
const t0 = new Date().toISOString(); const servedBefore = await servedIdentity(BASE);
const cells = []; const loadedIds = [];
try {
  for (const width of WIDTHS) for (const lang of LANGS) {
    const mobile = width < 800;
    const { ctx, page, loaded } = await openAuthed(browser, { persona: PERSONA[lang], lang, base: BASE, viewport: { width, height: mobile ? 844 : 900 }, mobile });
    page.on('dialog', (d) => d.accept());
    await page.route('**/functions/v1/send-quote-email', (r) => r.abort('failed')); // nothing is ever sent
    loadedIds.push({ lang, width, problems: identityProblems({ served: servedBefore, loaded }) });
    for (const surface of Object.keys(SURFACES)) { cells.push(await cell(page, { surface, lang, width })); await reset(page); }
    await ctx.close();
  }
} finally { await browser.close(); }
const servedAfter = await servedIdentity(BASE);
const snap = (s) => ({ base: s.base, capturedAt: s.capturedAt, version: s.version, servedFingerprint: s.servedFingerprint, servedFiles: s.servedFiles, servedMismatches: s.servedMismatches });
const problems = [...identityProblems({ served: servedBefore }).map((p) => `before: ${p}`), ...identityProblems({ served: servedAfter }).map((p) => `after: ${p}`), ...loadedIds.flatMap((l) => l.problems.map((p) => `loaded ${l.lang}/${l.width}: ${p}`))];
const expected = WIDTHS.length * LANGS.length * Object.keys(SURFACES).length;
const pass = !problems.length && cells.length === expected && cells.every((x) => x.result === 'PASS');
writeEvidence(dir, 'gate-ai-help-entry.json', { gate: 'AI HELP ENTRY UX (self-explanatory canonical entry)', law: 'AI-HELP-AVAILABILITY-001', url: BASE, candidate: { sha: EXPECTED.sha, digest: EXPECTED.digest }, start: t0, end: new Date().toISOString(),
  identity: { before: snap(servedBefore), after: snap(servedAfter), problems, loaded: loadedIds }, expectedCells: expected, cells, screenshots: cells.map((x) => x.screenshot).filter(Boolean),
  notCoveredInBrowser: [{ surface: 'upgrade pop-up (QuoteForm)', reason: 'every allowlisted synthetic persona is PRO or super-admin, so the upgrade pop-up cannot open; covered by the component/structural tests (same AiHelpButton, label enforced)' }, { surface: 'draft conflict / client editor', reason: 'same AiHelpButton component; structural test enforces the labelled entry' }],
  verdict: pass ? 'PASS' : 'FAIL' });
console.log(`AI HELP ENTRY UX GATE: ${pass ? 'PASS' : 'FAIL'} (${cells.filter((x) => x.result === 'PASS').length}/${expected} cells${problems.length ? ', IDENTITY PROBLEM' : ''})`);
process.exit(pass ? 0 : 1);
