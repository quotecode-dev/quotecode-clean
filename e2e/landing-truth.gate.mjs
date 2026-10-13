// LANDING FIRST-LIVE TRUTH GATE (rendered). Real Chromium, no login, no data.
//   node e2e/landing-truth.gate.mjs <baseUrl> [outJson]
// HE (/he) and EN (/en) at 320/360/390/412/768/1440, against the Owner-approved landing (Task 38/39; IRON-LANDING-001 as amended
// 2026-10-11): the Free-10 hero line + every Free-10 call to action WITH its "not active yet" status, the signup route of that CTA, the
// one-package plan card (monthly + annual price from the catalog, review notice: not purchasable, no online payment), the footer
// accessibility + cancellation entries, no horizontal overflow, rendered metadata (title, description, canonical, hreflang he/en/x-default,
// html lang/dir), and forbidden claims absent - including the REMOVED 14-day trial and video claims (negative controls). The EN visitor
// geo is a controlled US input (request stub) so the card shows the USD row; currency per country is the market-currency gate.
// Static SEO (§55.11): "/" is never a page (a geo redirect), so the sitemap lists /he and /en with he/en/x-default alternates and the
// SERVED initial HTML of /he and /en carries canonical + hreflang + description (the source index.html shell intentionally has none).
import { createRequire } from 'node:module';
import fs from 'node:fs';

const base = process.argv[2] || 'http://localhost:5198';
const out = process.argv[3];
const require = createRequire(process.env.PW_ROOT || 'C:/tkrtool/package.json');
const { chromium } = require('playwright');

const FORBIDDEN = /תוך דקה|בדקה\b|משלוש דקות|in a minute|in minutes|Most Popular|הפופולרי ביותר|notified instantly|עדכון מיידי|Invoic|חשבונית|automated tax|automate tax|international standards/i;
const results = [];
const browser = await chromium.launch();
for (const [lang, path, dir] of [['he', '/he?lang=he', 'rtl'], ['en', '/en?lang=en', 'ltr']]) {
  for (const width of [320, 360, 390, 412, 768, 1440]) {
    const c = { id: `${lang.toUpperCase()}/${width}`, checks: [] };
    const check = (name, ok, detail) => { c.checks.push({ name, ok: !!ok, detail }); if (!ok) console.log(`  FAIL ${c.id} :: ${name} ${detail ?? ''}`); };
    results.push(c);
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 700, hasTouch: width < 700 });
    const page = await ctx.newPage();
    await page.route('**/api/geo', (rt) => rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ country: lang === 'he' ? 'IL' : 'US' }) }));
    try {
      await page.goto(`${base}${path}`, { timeout: 90000, waitUntil: 'domcontentloaded' });
      await page.locator('h1').first().waitFor({ timeout: 45000 });
      await page.waitForTimeout(1200);
      const m = await page.evaluate(() => {
        const q = (s) => document.querySelector(s);
        const links = [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => `${l.hreflang}=${new URL(l.href).pathname}`);
        return {
          free10: [...document.querySelectorAll('[data-free10-cta]')].map((a) => !!a.querySelector('[data-free10-status]')),
          cardAmount: document.querySelector('[data-plan-card="all_inclusive"] .tl-plan-amount')?.innerText.trim() || '',
          cancelLink: !!document.querySelector('footer a[href$="/terms#cancellation"]'),
          title: document.title, desc: q('meta[name="description"]')?.content || '', canonical: q('link[rel="canonical"]')?.href || '',
          hreflang: links, htmlLang: document.documentElement.lang, htmlDir: document.documentElement.dir,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          text: document.body.innerText.replace(/\s+/g, ' '),
          video: !!(q('video') || q('iframe[src*="youtube"]')),
          trialCtas: [...document.querySelectorAll('button, a')].filter((b) => /התחל ניסיון חינם|נסה חינם|Start Free Trial|Free Trial/.test(b.innerText)).length,
        };
      });
      check('html lang/dir', m.htmlLang === lang && m.htmlDir === dir, `${m.htmlLang}/${m.htmlDir}`);
      check('title + description set for the market', m.title.includes('TEKANGO') && m.desc.length > 40, m.title);
      check('canonical is the market page', /\/(he|en)$/.test(new URL(m.canonical).pathname) && new URL(m.canonical).pathname.endsWith(lang), m.canonical);
      check('hreflang he/en/x-default present', ['he=/he', 'en=/en', 'x-default=/'].every((h) => m.hreflang.includes(h)), m.hreflang.join(','));
      check('no horizontal overflow', m.overflow <= 1, `overflow=${m.overflow}`);
      check('hero Free-10 line with its true status', lang === 'he' ? /10 הצעות מחיר חינם בסך הכול, בלי הגבלת זמן\. ההטבה עדיין לא הופעלה\./.test(m.text) : /10 free quotes in total · not active yet/.test(m.text));
      check('every Free-10 call to action carries its status', m.free10.length >= 2 && m.free10.every(Boolean), `count=${m.free10.length}`);
      check('plan card: monthly price from the catalog', m.cardAmount === (lang === 'he' ? '₪30.00' : '$18.00'), m.cardAmount);
      const card = page.locator('[data-plan-card="all_inclusive"]');
      await card.locator('input[data-period="year"]').check();
      const yearAmount = (await card.locator('.tl-plan-amount').first().innerText()).trim();
      check('plan card: annual price from the catalog', yearAmount === (lang === 'he' ? '₪306.00' : '$184.00'), yearAmount);
      check('pricing truth line (not purchasable, no online payment)', lang === 'he' ? /אי אפשר לרכוש מנוי או לשלם באתר/.test(m.text) : /subscriptions cannot be purchased and there is no online payment/.test(m.text));
      check('negative control: the removed 14-day trial claim is absent', !/14 יום ניסיון|14-day|Start Free Trial|התחל ניסיון חינם/.test(m.text) && m.trialCtas === 0, `trialCtas=${m.trialCtas}`);
      check('negative control: the removed video section is absent', !m.video);
      check('footer cancellation & refunds link', m.cancelLink);
      check('footer accessibility entry', await page.locator('footer button, footer a, .footer-link').filter({ hasText: /^(נגישות|הצהרת נגישות|Accessibility|Accessibility Statement)$/ }).count() > 0);
      check('no forbidden claim in the rendered page', !FORBIDDEN.test(m.text), (m.text.match(FORBIDDEN) || [])[0]);
      // the Free-10 CTA route (click it, observe the signup route without submitting anything)
      if (width === 390 || width === 1440) {
        await page.locator('[data-free10-cta]').first().click();
        await page.waitForURL(/signup=true/, { timeout: 15000 });
        check('Free-10 CTA opens the signup route', /\/dashboard\?signup=true&lang=(he|en)/.test(page.url()), page.url());
      }
    } catch (e) { check('page rendered', false, String(e.message).split(String.fromCharCode(10))[0].slice(0, 160)); }
    await ctx.close();
  }
}
// static crawler files
for (const f of ['robots.txt', 'sitemap.xml']) {
  const c = { id: `static/${f}`, checks: [] };
  results.push(c);
  const txt = fs.readFileSync(new URL(`../public/${f}`, import.meta.url), 'utf8');
  if (f === 'robots.txt') c.checks.push({ name: 'robots allows /, /he, /en and points at the sitemap', ok: /Allow: \/he\b/.test(txt) && /Allow: \/en\b/.test(txt) && /Sitemap: https:\/\/www\.tekango\.com\/sitemap\.xml/.test(txt) });
  else c.checks.push({ name: 'sitemap lists /he and /en with he / en / x-default alternates; "/" is not a page (§55.11)', ok: ['https://www.tekango.com/he</loc>', 'https://www.tekango.com/en</loc>'].every((u) => txt.includes(u)) && !txt.includes('https://www.tekango.com/</loc>') && /hreflang="he"/.test(txt) && /hreflang="en"/.test(txt) && /hreflang="x-default"/.test(txt) });
}
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
results.push({ id: 'static/index.html', checks: [
  { name: 'static fallback claims no invoicing', ok: !/Invoic/i.test(html) },
] });
// the SERVED initial HTML (before any JavaScript) of the canonical market pages carries the SEO metadata
for (const lang of ['he', 'en']) {
  const c = { id: `served-html/${lang}`, checks: [] };
  results.push(c);
  try {
    const raw = await (await fetch(`${base}/${lang}`, { redirect: 'manual' })).text();
    c.checks.push({ name: 'canonical is the market page', ok: raw.includes(`<link rel="canonical" href="https://www.tekango.com/${lang}"`) });
    c.checks.push({ name: 'hreflang he / en / x-default', ok: /hreflang="he"/.test(raw) && /hreflang="en"/.test(raw) && /hreflang="x-default"/.test(raw) });
    c.checks.push({ name: 'meta description + html lang', ok: /<meta name="description" content="[^"]{40,}"/.test(raw) && raw.includes(`<html lang="${lang}"`) });
  } catch (e) { c.checks.push({ name: 'served html fetched', ok: false, detail: String(e.message).slice(0, 120) }); }
}
await browser.close();
for (const c of results) c.status = c.checks.length && c.checks.every((x) => x.ok) ? 'PASS' : 'FAIL';
const failed = results.filter((c) => c.status !== 'PASS');
const summary = { gate: 'LANDING FIRST-LIVE TRUTH GATE', base, at: new Date().toISOString(), cells: results.length, failed: failed.length, verdict: failed.length ? 'FAIL' : 'PASS', results };
if (out) fs.writeFileSync(out, JSON.stringify(summary, null, 2));
console.log(`LANDING FIRST-LIVE TRUTH GATE: ${summary.verdict} (${results.length - failed.length}/${results.length} cells PASS)`);
process.exit(failed.length ? 1 : 0);
