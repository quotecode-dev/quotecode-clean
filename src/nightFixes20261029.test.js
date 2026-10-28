// Owner console 2026-10-29 (typed: "מאשר את משימת הלילה: תיקון תשעת ממצאי קודקס על 115 והריצוד ברשימת ההצעות, כולל שינוי ב-L-01, L-15, L-22,
// L-29 ..."): the screens part - the quote-list flicker (L-29), Codex R08 (L-01/L-15) and R09 (docs/CODEX_REVIEW_CODEXFIX2_2026-10-29.md).
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createPerPageMemo, settlePerPage } from './components/quotesPerPage';
import { articleRowProblem, fetchPublishedArticles } from './shared/siteArticlesApi';

const src = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

describe('L-29: the rows-per-page measure settles (the flicker of 29/10)', () => {
  it('4 -> 5 -> 4 at the same window size locks on 4; it never flips again', () => {
    const m = createPerPageMemo();
    expect(settlePerPage(m, '1904x995', 4)).toBe(4);
    expect(settlePerPage(m, '1904x995', 5)).toBe(5);
    expect(settlePerPage(m, '1904x995', 4)).toBe(4);
    for (let i = 0; i < 10; i += 1) expect(settlePerPage(m, '1904x995', i % 2 ? 4 : 5)).toBe(4);
  });
  it('a real change is followed: fonts loading (6 -> 5), a repeated value, a new window size', () => {
    const m = createPerPageMemo();
    expect(settlePerPage(m, '1440x900', 6)).toBe(6);
    expect(settlePerPage(m, '1440x900', 5)).toBe(5);
    expect(settlePerPage(m, '1440x900', 5)).toBe(5);
    expect(settlePerPage(m, '1440x900', 4)).toBe(4);
    // a taller window is a new size: the lock (if any) is gone and more rows fit
    expect(settlePerPage(m, '1440x1200', 9)).toBe(9);
  });
  it('the quote list uses it, with a fresh memo for every list (an effect run)', () => {
    const q = src('src/components/QuotesTab.jsx');
    expect(q).toContain('const memo = createPerPageMemo();');
    expect(q).toContain('const n = settlePerPage(memo, `${window.innerWidth}x${window.innerHeight}`, Math.max(1, Math.floor((body.clientHeight + free + 0.5) / rowH)));');
  });
});

describe('Codex R08 (L-01/L-15): the sign-in email is never a saved business email', () => {
  it('the business-details gate reads the stored email; the form baseline may show the sign-in email', () => {
    const d = src('src/pages/Dashboard.jsx');
    expect(d).toContain("storedEmail: row?.email ?? '' };");
    expect(d).toContain("return { phone: s.phone ?? '', taxId: s.taxId ?? '', name: s.name ?? '', email: s.storedEmail ?? '' };");
    // the leave-without-saving baseline keeps what the form shows (Codex N17)
    expect(d).toContain("email: data.email || userEmail || '' }); // Codex N17");
    expect(d).toContain("setBizEmail(s.email ?? '');");
  });
});

describe('Codex R09 (decision 4): an invalid published guide stops the build with its name AND the reason', () => {
  const lang = { title: 'T', description: 'D', h1: 'H', intro: 'I', sections: [{ h: 'S', p: ['P'] }] };
  it('the reason of each kind of problem', () => {
    expect(articleRowProblem({ slug: 'Bad Slug', he: lang, en: lang, published_at: '2026-10-28' })).toBe('invalid slug');
    expect(articleRowProblem({ slug: 'a-guide', he: null, en: lang, published_at: '2026-10-28' })).toBe('he: no content');
    expect(articleRowProblem({ slug: 'a-guide', he: lang, en: { ...lang, title: '', intro: '' }, published_at: '2026-10-28' })).toBe('en: missing title, intro');
    expect(articleRowProblem({ slug: 'a-guide', he: lang, en: { ...lang, sections: [] }, published_at: '2026-10-28' })).toBe('en: no section with a heading and a paragraph');
    expect(articleRowProblem({ slug: 'a-guide', he: lang, en: lang, published_at: null })).toBe('no publication date');
    expect(articleRowProblem({ slug: 'a-guide', he: lang, en: lang, published_at: '2026-10-28T10:00:00Z' })).toBeNull();
  });
  it('the production build names the guide and the reason; the browser just leaves it out', async () => {
    const rows = [{ slug: 'broken-guide', market: 'intl', he: lang, en: { ...lang, h1: '' }, published_at: '2026-10-28T10:00:00Z' }];
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => rows }));
    await expect(fetchPublishedArticles({ base: 'https://s.co', key: 'k', fetchImpl, strict: true })).rejects.toThrow('articles_invalid:broken-guide (en: missing h1)');
    expect(await fetchPublishedArticles({ base: 'https://s.co', key: 'k', fetchImpl })).toEqual([]);
  });
});
