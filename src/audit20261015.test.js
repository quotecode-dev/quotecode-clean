// Codex audit 2026-10-15: AUD-04 (the Statistics capability text promised "copy link and resend", which the screen does not have)
// and AUD-05 (sitemap lastmod older than the legal documents' own "last updated" date) - kept true from now on.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const read = (p) => readFileSync(join(cwd(), p), 'utf8');
const MONTHS_EN = { January: '01', February: '02', March: '03', April: '04', May: '05', June: '06', July: '07', August: '08', September: '09', October: '10', November: '11', December: '12' };

describe('AUD-04: product truth matches the Statistics screen', () => {
  it('no "copy link and resend" in the registry or the generated AI facts; the real actions are named', () => {
    for (const p of ['src/data/productTruthRegistry.js', 'supabase/functions/chat-ai/aiFacts.generated.ts']) {
      const s = read(p);
      expect(s, p).not.toMatch(/copy link and resend|העתקת קישור ושליחה חוזרת/);
      // night task 2026-10-16 (R-22 / R-17, Owner-approved L-14): the Statistics button that opens the customer page is "View quote"
      expect(s, p).toMatch(/view the quote \(opens in a new tab\), WhatsApp, email and create a follow-up task/);
      expect(s, p).toMatch(/צפייה בהצעה \(נפתחת בלשונית חדשה\), WhatsApp, שליחה במייל ויצירת משימת מעקב/);
    }
    const stats = read('src/components/StatisticsTab.jsx');
    for (const label of ['View quote', 'WhatsApp', 'Email', 'Create follow-up task']) expect(stats).toContain(`'${label}'`);
  });
});

describe('AUD-05: sitemap lastmod = the legal page\'s own "last updated" date', () => {
  const sitemap = read('public/sitemap.xml');
  const lastmod = (path) => {
    const block = sitemap.split('<url>').find((b) => b.includes(`<loc>https://www.tekango.com${path}</loc>`));
    expect(block, path).toBeTruthy();
    return block.match(/<lastmod>([0-9-]+)<\/lastmod>/)[1];
  };
  it.each([['src/pages/Terms.jsx', 'terms'], ['src/pages/Privacy.jsx', 'privacy']])('%s', (file, slug) => {
    const m = read(file).match(/Last updated: (\w+) (\d{1,2}), (\d{4})/);
    const iso = `${m[3]}-${MONTHS_EN[m[1]]}-${m[2].padStart(2, '0')}`;
    expect(lastmod(`/he/${slug}`)).toBe(iso);
    expect(lastmod(`/en/${slug}`)).toBe(iso);
  });
});
