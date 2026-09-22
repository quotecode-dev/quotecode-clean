// LANDING FIRST-LIVE TRUTH GATE (rendered). Real Chromium, no login, no data.
//   node e2e/landing-truth.gate.mjs <baseUrl> [outJson]
// HE (/he) and EN (/en) at 320/360/390/412/768/1440: hero + trial line, signup CTA route, pricing (monthly + annual + 14-day trial,
// no statistical badge), video/poster, footer (accessibility), no horizontal overflow, rendered metadata (title, description,
// canonical, hreflang he/en/x-default, html lang/dir), and forbidden claims absent from the rendered text.
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
    try {
      await page.goto(`${base}${path}`, { timeout: 90000, waitUntil: 'domcontentloaded' });
      await page.locator('h1').first().waitFor({ timeout: 45000 });
      await page.waitForTimeout(1200);
      const m = await page.evaluate(() => {
        const q = (s) => document.querySelector(s);
        const links = [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((l) => `${l.hreflang}=${new URL(l.href).pathname}`);
        return {
          title: document.title, desc: q('meta[name="description"]')?.content || '', canonical: q('link[rel="canonical"]')?.href || '',
          hreflang: links, htmlLang: document.documentElement.lang, htmlDir: document.documentElement.dir,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          text: document.body.innerText.replace(/\s+/g, ' '),
          video: !!(q('video') || q('iframe[src*="youtube"]') || q('img[alt*="video" i]') || q('[class*="video" i]')),
          ctaTargets: [...document.querySelectorAll('button, a')].filter((b) => /התחל ניסיון חינם|נסה חינם|Start Free Trial|Free Trial/.test(b.innerText)).length,
        };
      });
      check('html lang/dir', m.htmlLang === lang && m.htmlDir === dir, `${m.htmlLang}/${m.htmlDir}`);
      check('title + description set for the market', m.title.includes('TEKANGO') && m.desc.length > 40, m.title);
      check('canonical is the market page', /\/(he|en)$/.test(new URL(m.canonical).pathname) && new URL(m.canonical).pathname.endsWith(lang), m.canonical);
      check('hreflang he/en/x-default present', ['he=/he', 'en=/en', 'x-default=/'].every((h) => m.hreflang.includes(h)), m.hreflang.join(','));
      check('no horizontal overflow', m.overflow <= 1, `overflow=${m.overflow}`);
      check('hero trial line (14 days, no card)', lang === 'he' ? /14 יום ניסיון PRO מלא, ללא כרטיס אשראי/.test(m.text) : /14-day full PRO trial, no credit card required/.test(m.text));
      check('free-trial CTAs present', m.ctaTargets >= 3, `count=${m.ctaTargets}`);
      check('pricing shows monthly + annual plans and prices', lang === 'he' ? /מסלול שנתי/.test(m.text) && /מסלול חודשי/.test(m.text) && /₪/.test(m.text) : /Annual Billing/.test(m.text) && /Monthly Billing/.test(m.text) && /[$€£]\d/.test(m.text));
      check('pricing truth line (no paid checkout yet)', lang === 'he' ? /תשלום מקוון אינם זמינים כרגע/.test(m.text) : /online checkout are not currently available/.test(m.text));
      check('video / poster section present', m.video);
      check('footer accessibility entry', await page.locator('footer button, footer a, .footer-link').filter({ hasText: /^(נגישות|הצהרת נגישות|Accessibility|Accessibility Statement)$/ }).count() > 0);
      check('no forbidden claim in the rendered page', !FORBIDDEN.test(m.text), (m.text.match(FORBIDDEN) || [])[0]);
      // the trial CTA route (click the hero CTA, observe the signup route without submitting anything)
      if (width === 390 || width === 1440) {
        await page.getByRole('button', { name: /^(התחל ניסיון חינם|Start Free Trial)/ }).first().click();
        await page.waitForURL(/signup=true/, { timeout: 15000 });
        check('hero CTA opens the free-trial signup route', /\/dashboard\?signup=true&lang=(he|en)/.test(page.url()), page.url());
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
  else c.checks.push({ name: 'sitemap lists /, /he, /en with hreflang alternates', ok: ['https://www.tekango.com/</loc>', 'https://www.tekango.com/he</loc>', 'https://www.tekango.com/en</loc>'].every((u) => txt.includes(u)) && /hreflang="he"/.test(txt) });
}
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
results.push({ id: 'static/index.html', checks: [
  { name: 'static fallback claims no invoicing', ok: !/Invoic/i.test(html) },
  { name: 'static fallback has canonical + hreflang + description', ok: /rel="canonical"/.test(html) && /hreflang="he"/.test(html) && /name="description"/.test(html) },
] });
await browser.close();
for (const c of results) c.status = c.checks.length && c.checks.every((x) => x.ok) ? 'PASS' : 'FAIL';
const failed = results.filter((c) => c.status !== 'PASS');
const summary = { gate: 'LANDING FIRST-LIVE TRUTH GATE', base, at: new Date().toISOString(), cells: results.length, failed: failed.length, verdict: failed.length ? 'FAIL' : 'PASS', results };
if (out) fs.writeFileSync(out, JSON.stringify(summary, null, 2));
console.log(`LANDING FIRST-LIVE TRUTH GATE: ${summary.verdict} (${results.length - failed.length}/${results.length} cells PASS)`);
process.exit(failed.length ? 1 : 0);
