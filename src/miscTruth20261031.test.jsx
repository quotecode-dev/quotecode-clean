// Codex review 2026-10-31 group 6 (Owner console, typed: "מאשר את שש הקבוצות של קודקס ... כולל שינוי ב-L-02, L-15, ... L-22 ... החלטות א-ח
// והנוסחים כמומלץ" + the night task): F07 - nothing private renders in a document that loaded the measurement tag; F09 - the Owner's
// series / period of a copy; F29 - no internal error text in the expiration-email answers.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { taggedPrivate } from './shared/siteAnalytics';
import TaggedPrivateBoundary from './shared/TaggedPrivateBoundary';
import { invoicePatch } from '../supabase/functions/expense-invoices/lib.ts';

afterEach(() => { cleanup(); delete window.__tekangoGtagLoaded; });
const win = (loaded) => ({ __tekangoGtagLoaded: loaded, location: { origin: 'https://www.tekango.com' } });

describe('F07: the tag never stays while a private page shows', () => {
  it('a private destination with the tag in memory is a full page load; a public one is not; without the tag nothing changes', () => {
    expect(taggedPrivate('/dashboard', win(true))).toBe(true);
    expect(taggedPrivate('/he/public-quote/c/x', win(true))).toBe(true);
    expect(taggedPrivate('/he', win(true))).toBe(false);
    expect(taggedPrivate('/en/tools', win(true))).toBe(false);
    expect(taggedPrivate('/dashboard', win(false))).toBe(false);
  });
  it('the boundary renders nothing private in a tagged document, and the page normally otherwise', () => {
    window.__tekangoGtagLoaded = true;
    const { container } = render(<MemoryRouter initialEntries={['/dashboard']}><TaggedPrivateBoundary><p>private</p></TaggedPrivateBoundary></MemoryRouter>);
    expect(container.textContent).toBe('');
    cleanup();
    const pub = render(<MemoryRouter initialEntries={['/he']}><TaggedPrivateBoundary><p>public</p></TaggedPrivateBoundary></MemoryRouter>);
    expect(pub.container.textContent).toBe('public');
    cleanup();
    delete window.__tekangoGtagLoaded;
    const plain = render(<MemoryRouter initialEntries={['/dashboard']}><TaggedPrivateBoundary><p>private</p></TaggedPrivateBoundary></MemoryRouter>);
    expect(plain.container.textContent).toBe('private');
  });
  it('both app shells wrap their routes; both landing link helpers use it', () => {
    for (const f of ['src/local/AppLocal.jsx', 'src/global/AppGlobal.jsx']) expect(readFileSync(f, 'utf8')).toMatch(/<TaggedPrivateBoundary><Routes>[\s\S]*<\/Routes><\/TaggedPrivateBoundary>/);
    for (const f of ['src/components/landing/LandingHeader.jsx', 'src/components/landing/LandingPage.jsx']) expect(readFileSync(f, 'utf8')).toContain('if (taggedPrivate(href)) { window.location.assign(href); return; }');
  });
});

describe('F09: the Owner\'s series / period of a copy', () => {
  it('a typed series is accepted trimmed; an empty or overlong one is refused; null clears it', () => {
    expect(invoicePatch({ identitySeries: ' 2026 ' })).toEqual({ identity_series: '2026' });
    expect(invoicePatch({ identitySeries: 'סדרה ב/2026' })).toEqual({ identity_series: 'סדרה ב/2026' });
    expect(invoicePatch({ identitySeries: null })).toEqual({ identity_series: null });
    expect(invoicePatch({ identitySeries: '' })).toBeNull();
    expect(invoicePatch({ identitySeries: 'x'.repeat(41) })).toBeNull();
    expect(invoicePatch({ identitySeries: '<b>' })).toBeNull();
  });
  it('a document marked with its own series is not "the same invoice" when it is sent (compared by identity)', () => {
    expect(readFileSync('supabase/functions/expense-invoices/index.ts', 'utf8')).toContain(".eq('document_identity', row.document_identity)");
  });
  it('the screen offers it only on a copy, with the approved words', () => {
    const s = readFileSync('src/components/AdminExpenseInvoices.jsx', 'utf8');
    expect(s).toContain("{r.duplicateOf && r.status !== 'sent' && (series?.id === r.id ? (");
    expect(s).toContain("open: 'מסמך אחר – סדרה או תקופה'");
    expect(s).toContain("open: 'Another document – series or period'");
  });
});

describe('F29: no internal error text in the answers', () => {
  it('the permission check and the catch answer fixed codes; the trial batch returns counts only', () => {
    for (const f of ['supabase/functions/send-subscription-expiration-email/index.ts', 'supabase/functions/send-trial-expiration-email/index.ts']) {
      const s = readFileSync(f, 'utf8');
      expect(s).not.toContain('callerBizErr.message');
      expect(s).not.toMatch(/jsonResponse\(\{ error: message \}/);
      expect(s).toContain("return jsonResponse({ error: 'failed', code: 'internal' }, 400);");
    }
    const t = readFileSync('supabase/functions/send-trial-expiration-email/index.ts', 'utf8');
    expect(t).toContain('return jsonResponse({ success: true, ...counts, errorCount: errors.length }, 200);');
    expect(t).not.toContain('for (const line of summary.errors)');
  });
});
