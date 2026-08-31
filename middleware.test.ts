import { describe, it, expect } from 'vitest';
import { resolveCanonicalRedirect, VERCEL_APP_HOST, CANONICAL_ORIGIN } from './middleware';

// חוק ברזל (Vercel Canonical Root Redirect Repair): בודק את פונקציית-ההחלטה
// הטהורה בלבד (host/pathname/search -> יעד-הפניה או null) - לא את geolocation()
// עצמה, שדורשת runtime אמיתי של Vercel Edge ואינה ניתנת להרצה תחת Vitest.

describe('resolveCanonicalRedirect', () => {
  it('canonical Production host root: NO redirect', () => {
    expect(resolveCanonicalRedirect('www.quotecodepro.com', '/', '')).toBeNull();
  });

  it('canonical Production host, any path: NO redirect', () => {
    expect(resolveCanonicalRedirect('www.quotecodepro.com', '/dashboard', '?lang=he')).toBeNull();
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

  it('is case-insensitive on the host header', () => {
    expect(resolveCanonicalRedirect('QuoteCode.Vercel.App', '/', '')).toBe(`${CANONICAL_ORIGIN}/`);
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
    const target = resolveCanonicalRedirect('www.quotecodepro.com', '/', '');
    expect(target).toBeNull();
    // Even if it somehow returned a target, CANONICAL_ORIGIN never equals VERCEL_APP_HOST,
    // so a redirect can never point back to the same host that triggered it.
    expect(CANONICAL_ORIGIN).not.toContain(VERCEL_APP_HOST);
  });

  it('empty/missing host header: NO forced redirect (fails safe, does not crash)', () => {
    expect(resolveCanonicalRedirect('', '/', '')).toBeNull();
  });
});
