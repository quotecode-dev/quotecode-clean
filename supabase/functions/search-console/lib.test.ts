// search-console (Owner console 2026-10-26: the admin's read-only Search Console screen): super admin only; the service account assertion;
// read-only calls; the 28-day window two days back; honest failures without the key or the token.
import { describe, it, expect, vi } from 'vitest';
import { handler, parseServiceAccount, signedAssertion, rs256Sign, periods, sitemapPaths, SCOPE, TOKEN_URL, SITE_URL, type Deps } from './lib.ts';

const KEY = JSON.stringify({ type: 'service_account', client_email: 'reader@x.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nAAA\n-----END PRIVATE KEY-----\n' });
const NOW = new Date('2026-10-27T08:00:00Z');
const ok = (j: unknown) => new Response(JSON.stringify(j), { status: 200, headers: { 'Content-Type': 'application/json' } });
const decode = (part: string) => JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));

function deps(over: Partial<Deps> = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const d: Deps & { calls: typeof calls } = {
    calls,
    caller: vi.fn(async () => 'admin' as const),
    keyJson: () => KEY,
    now: () => NOW,
    sign: vi.fn(async () => 'SIG'),
    sitemapXml: async () => '<urlset><url><loc>https://www.tekango.com/he</loc></url><url><loc>https://www.tekango.com/en/tools</loc></url><url><loc>https://evil.example/x</loc></url></urlset>',
    fetch: vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url === TOKEN_URL) return ok({ access_token: 'AT', expires_in: 3600 });
      if (url.endsWith('/sitemaps')) return ok({ sitemap: [{ path: 'https://www.tekango.com/sitemap.xml', lastDownloaded: '2026-10-26T10:00:00Z', errors: 0, warnings: 1, contents: [{ submitted: '28' }] }] });
      if (url.includes('urlInspection')) {
        const b = JSON.parse(String(init?.body));
        return b.inspectionUrl.endsWith('/he')
          ? ok({ inspectionResult: { indexStatusResult: { verdict: 'PASS', coverageState: 'Submitted and indexed', lastCrawlTime: '2026-10-20T00:00:00Z', googleCanonical: 'https://www.tekango.com/he' } } })
          : new Response('{}', { status: 429 });
      }
      const b = JSON.parse(String(init?.body));
      if (!b.dimensions.length) return ok({ rows: [{ clicks: 2, impressions: 47, ctr: 0.04255, position: 18.04 }] });
      if (b.dimensions[0] === 'date') return ok({ rows: [{ keys: ['2026-10-01'], clicks: 1, impressions: 5, ctr: 0.2, position: 9 }] });
      if (b.dimensions[0] === 'query') return ok({ rows: [{ keys: ['הצעת מחיר'], clicks: 1, impressions: 10, ctr: 0.1, position: 12.34 }] });
      return ok({ rows: [{ keys: ['https://www.tekango.com/he'], clicks: 2, impressions: 30, ctr: 0.0667, position: 8 }] });
    }),
    ...over,
  };
  return d;
}

describe('search-console', () => {
  it('only a super admin: anyone else gets 403 and Google is never called', async () => {
    const d = deps({ caller: vi.fn(async () => null) });
    const r = await handler(d, { action: 'summary' });
    expect(r.status).toBe(403);
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it('refuses an unknown action, and says honestly when the key is missing or broken', async () => {
    expect((await handler(deps(), { action: 'delete' })).body.code).toBe('bad_action');
    expect((await handler(deps({ keyJson: () => '' }), { action: 'summary' })).body.code).toBe('not_configured');
    expect((await handler(deps({ keyJson: () => '{"client_email":"x"}' }), { action: 'summary' })).body.code).toBe('not_configured');
    expect(parseServiceAccount(KEY)?.client_email).toBe('reader@x.iam.gserviceaccount.com');
  });

  it('the assertion asks for the READ-ONLY scope, for one hour, from the service account', async () => {
    const a = await signedAssertion(parseServiceAccount(KEY)!, NOW.getTime(), async () => 'SIG');
    const [h, c, s] = a.split('.');
    expect(decode(h)).toEqual({ alg: 'RS256', typ: 'JWT' });
    const claims = decode(c);
    expect(claims).toMatchObject({ iss: 'reader@x.iam.gserviceaccount.com', scope: SCOPE, aud: TOKEN_URL });
    expect(SCOPE).toBe('https://www.googleapis.com/auth/webmasters.readonly');
    expect(claims.exp - claims.iat).toBe(3600);
    expect(s).toBe('SIG');
  });

  it('rs256Sign signs with a real PKCS#8 key and the signature verifies (the exact code the function runs)', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
    const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
    let bin = ''; for (const b of der) bin += String.fromCharCode(b);
    const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(bin).match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`;
    const sig = await rs256Sign(pem, 'head.claims');
    const raw = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    expect(sig).not.toMatch(/[+/=]/);
    expect(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pair.publicKey, raw, new TextEncoder().encode('head.claims'))).toBe(true);
  });

  it('the summary: 28 days ending two days ago, against the 28 days before; totals, queries, pages, sitemaps', async () => {
    const d = deps();
    const r = await handler(d, { action: 'summary' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, site: SITE_URL, period: { startDate: '2026-09-28', endDate: '2026-10-25' }, previousPeriod: { startDate: '2026-08-31', endDate: '2026-09-27' } });
    expect(r.body.totals).toEqual({ clicks: 2, impressions: 47, ctr: 4.3, position: 18 });
    expect(r.body.queries).toEqual([{ query: 'הצעת מחיר', clicks: 1, impressions: 10, ctr: 10, position: 12.3 }]);
    expect(r.body.pages).toEqual([{ page: '/he', clicks: 2, impressions: 30, ctr: 6.7, position: 8 }]);
    expect(r.body.sitemaps).toEqual([{ path: '/sitemap.xml', lastDownloaded: '2026-10-26T10:00:00Z', errors: 0, warnings: 1, submitted: 28 }]);
    // read only: every Google call is a query / a list with the bearer token - nothing else
    for (const c of d.calls.filter((x) => x.url !== TOKEN_URL)) {
      expect(c.url).toMatch(/searchAnalytics\/query$|\/sitemaps$/);
      expect((c.init?.headers as Record<string, string>).Authorization).toBe('Bearer AT');
    }
    expect(periods(NOW).current).toEqual({ startDate: '2026-09-28', endDate: '2026-10-25' });
  });

  it('indexing inspects only the live sitemap pages of the site; one failure does not hide the others', async () => {
    expect(sitemapPaths('<loc>https://www.tekango.com/he</loc><loc>https://evil.example/x</loc>')).toEqual(['/he']);
    const r = await handler(deps(), { action: 'indexing' });
    expect(r.body.pages).toEqual([
      { path: '/he', verdict: 'PASS', coverageState: 'Submitted and indexed', lastCrawlTime: '2026-10-20T00:00:00Z', googleCanonical: '/he' },
      { path: '/en/tools', verdict: 'ERROR', coverageState: 'google_429', lastCrawlTime: null, googleCanonical: null },
    ]);
  });

  it('a Google refusal is reported by its status only - never the key or the token', async () => {
    const d = deps({ fetch: vi.fn(async () => new Response('{"error":"invalid_grant"}', { status: 400 })) });
    const r = await handler(d, { action: 'summary' });
    expect(r).toEqual({ status: 502, body: { ok: false, code: 'google_400' } });
    expect(JSON.stringify(r)).not.toMatch(/PRIVATE KEY|AT\b/);
  });
});
