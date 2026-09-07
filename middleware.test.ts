import { describe, it, expect } from 'vitest';
import { resolveCanonicalRedirect, VERCEL_APP_HOST, CANONICAL_ORIGIN } from './middleware';

// חוק ברזל (Vercel Canonical Root Redirect Repair): בודק את פונקציית-ההחלטה
// הטהורה בלבד (host/pathname/search -> יעד-הפניה או null) - לא את geolocation()
// עצמה, שדורשת runtime אמיתי של Vercel Edge ואינה ניתנת להרצה תחת Vitest.

describe('resolveCanonicalRedirect', () => {
  it('canonical Production host root: NO redirect', () => {
    expect(resolveCanonicalRedirect('www.tekango.com', '/', '')).toBeNull();
  });

  it('canonical Production host, any path: NO redirect', () => {
    expect(resolveCanonicalRedirect('www.tekango.com', '/dashboard', '?lang=he')).toBeNull();
  });

  // TEKANGO Public-Migration RC (Worker 3, 2026-09-07): the business
  // requirement flipped from the prior task's decision. Previously
  // www.quotecodepro.com was deliberately left as a non-redirecting legacy
  // host (see git history for the old version of this test). Now old
  // bookmarks/links to quotecodepro.com (bare) and www.quotecodepro.com must
  // ALSO permanently 308-redirect to the equivalent path+query under
  // CANONICAL_ORIGIN, exactly like the Vercel host - they no longer continue
  // to resolve on the old site at all.
  it('legacy host (quotecodepro.com, bare apex) root: redirects to the canonical origin root', () => {
    expect(resolveCanonicalRedirect('quotecodepro.com', '/', '')).toBe(`${CANONICAL_ORIGIN}/`);
  });

  it('legacy host (quotecodepro.com, bare apex) with path and query: preserves both exactly', () => {
    expect(resolveCanonicalRedirect('quotecodepro.com', '/en/public-quote/abc123', '?lang=en')).toBe(
      `${CANONICAL_ORIGIN}/en/public-quote/abc123?lang=en`
    );
  });

  it('legacy host (www.quotecodepro.com) root: redirects to the canonical origin root', () => {
    expect(resolveCanonicalRedirect('www.quotecodepro.com', '/', '')).toBe(`${CANONICAL_ORIGIN}/`);
  });

  it('legacy host (www.quotecodepro.com) with path and query: preserves both exactly', () => {
    expect(resolveCanonicalRedirect('www.quotecodepro.com', '/dashboard', '?lang=he')).toBe(
      `${CANONICAL_ORIGIN}/dashboard?lang=he`
    );
  });

  it('Vercel host root: redirects to the canonical origin root', () => {
    expect(resolveCanonicalRedirect(VERCEL_APP_HOST, '/', '')).toBe(`${CANONICAL_ORIGIN}/`);
  });

  it('Vercel host with a path: redirects preserving the path', () => {
    expect(resolveCanonicalRedirect(VERCEL_APP_HOST, '/en', '')).toBe(`${CANONICAL_ORIGIN}/en`);
  });

  it('Vercel host with path and query: preserves both exactly', () => {
    expect(resolveCanonicalRedirect(VERCEL_APP_HOST, '/dashboard', '?lang=he')).toBe(
      `${CANONICAL_ORIGIN}/dashboard?lang=he`
    );
  });

  it('is case-insensitive on the host header (Vercel host)', () => {
    expect(resolveCanonicalRedirect('QuoteCode.Vercel.App', '/', '')).toBe(`${CANONICAL_ORIGIN}/`);
  });

  it('is case-insensitive on the host header (bare apex legacy host)', () => {
    expect(resolveCanonicalRedirect('QuoteCodePro.COM', '/dashboard', '?lang=he')).toBe(
      `${CANONICAL_ORIGIN}/dashboard?lang=he`
    );
  });

  it('is case-insensitive on the host header (www legacy host)', () => {
    expect(resolveCanonicalRedirect('WWW.QuoteCodePro.com', '/en', '?lang=en')).toBe(
      `${CANONICAL_ORIGIN}/en?lang=en`
    );
  });

  it('local development host: NO forced Production redirect', () => {
    expect(resolveCanonicalRedirect('localhost:5183', '/', '')).toBeNull();
    expect(resolveCanonicalRedirect('localhost:5186', '/', '')).toBeNull();
  });

  it('TEST/local-network host: NO forced Production redirect', () => {
    expect(resolveCanonicalRedirect('127.0.0.1:5186', '/', '')).toBeNull();
  });

  it('unknown/preview host: preserves existing behavior (no forced redirect) unless explicitly canonicalized', () => {
    expect(resolveCanonicalRedirect('quotecode-git-feature-branch.vercel.app', '/', '')).toBeNull();
    expect(resolveCanonicalRedirect('some-other-app.example.com', '/', '')).toBeNull();
  });

  it('never redirects the canonical host to itself (no loop possible by construction)', () => {
    const target = resolveCanonicalRedirect('www.tekango.com', '/', '');
    expect(target).toBeNull();
    // Even if it somehow returned a target, CANONICAL_ORIGIN never equals VERCEL_APP_HOST,
    // so a redirect can never point back to the same host that triggered it.
    expect(CANONICAL_ORIGIN).not.toContain(VERCEL_APP_HOST);
  });

  it('empty/missing host header: NO forced redirect (fails safe, does not crash)', () => {
    expect(resolveCanonicalRedirect('', '/', '')).toBeNull();
  });
});
