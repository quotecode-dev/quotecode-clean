// search-console - the logic (unit-tested in lib.test.ts; index.ts is wiring only).
// Owner console 2026-10-26 (typed: "מאשר לבנות מסך גוגל סרץ' קונסול במסך הניהול, בקריאה בלבד"; built in the approved night task):
// the admin screen reads the Search Console data of the property sc-domain:tekango.com through a Google service account
// (search-console-reader@tekango-search-console.iam.gserviceaccount.com, added to the property as a RESTRICTED user = read only).
//  - The service account key is the secret GSC_SERVICE_ACCOUNT_JSON (the Owner saved it 2026-10-26 23:23); it never leaves the function.
//  - Read only: the scope is webmasters.readonly; only searchAnalytics.query, sitemaps.list and urlInspection.index.inspect are called.
//  - Super admin only (checked in code, like every Owner-only admin tool).

export const SITE_URL = 'sc-domain:tekango.com';
export const ORIGIN = 'https://www.tekango.com';
export const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const API = 'https://searchconsole.googleapis.com';
export const DAYS = 28;
export const DATA_LAG_DAYS = 2; // Search Console data settles about two days later
export const TOP_ROWS = 25;
export const INSPECT_CONCURRENCY = 4;

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
export interface ServiceAccount { client_email: string; private_key: string }
export interface Deps {
  caller: () => Promise<'admin' | null>;
  keyJson: () => string;
  fetch: Fetch;
  now: () => Date;
  sitemapXml: () => Promise<string>; // the live sitemap = the public pages to inspect (one source; never a second list)
  sign: (privateKeyPem: string, data: string) => Promise<string>; // RS256 -> base64url
}

const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const utf8b64url = (s: string) => b64url(String.fromCharCode(...new TextEncoder().encode(s)));

// RS256 (RSASSA-PKCS1-v1_5 + SHA-256) over the service account's PKCS#8 PEM key -> base64url (Web Crypto: the same in Deno and Node)
export async function rs256Sign(privateKeyPem: string, data: string): Promise<string> {
  const der = Uint8Array.from(atob(privateKeyPem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(data)));
  let bin = '';
  for (let i = 0; i < sig.length; i += 1) bin += String.fromCharCode(sig[i]);
  return b64url(bin);
}

export function parseServiceAccount(raw: string): ServiceAccount | null {
  try {
    const j = JSON.parse(raw);
    if (typeof j?.client_email !== 'string' || typeof j?.private_key !== 'string' || !j.private_key.includes('PRIVATE KEY')) return null;
    return { client_email: j.client_email, private_key: j.private_key };
  } catch { return null; }
}

export async function signedAssertion(sa: ServiceAccount, nowMs: number, sign: Deps['sign']): Promise<string> {
  const iat = Math.floor(nowMs / 1000);
  const head = utf8b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = utf8b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }));
  return `${head}.${claims}.${await sign(sa.private_key, `${head}.${claims}`)}`;
}

const day = (d: Date) => d.toISOString().slice(0, 10);
export function periods(now: Date) {
  const end = new Date(now.getTime() - DATA_LAG_DAYS * 86_400_000);
  const start = new Date(end.getTime() - (DAYS - 1) * 86_400_000);
  const prevEnd = new Date(start.getTime() - 86_400_000);
  const prevStart = new Date(prevEnd.getTime() - (DAYS - 1) * 86_400_000);
  return { current: { startDate: day(start), endDate: day(end) }, previous: { startDate: day(prevStart), endDate: day(prevEnd) } };
}

interface Row { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
const metrics = (r: Partial<Row> | undefined) => ({
  clicks: Math.round(r?.clicks ?? 0), impressions: Math.round(r?.impressions ?? 0),
  ctr: round((r?.ctr ?? 0) * 100, 1), position: round(r?.position ?? 0, 1),
});

class GoogleError extends Error { constructor(readonly status: number) { super(`google_${status}`); } }

async function token(deps: Deps, sa: ServiceAccount): Promise<string> {
  const assertion = await signedAssertion(sa, deps.now().getTime(), deps.sign);
  const res = await deps.fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString() });
  if (!res.ok) throw new GoogleError(res.status);
  const j = await res.json();
  if (typeof j?.access_token !== 'string') throw new GoogleError(502);
  return j.access_token;
}

async function call(deps: Deps, access: string, path: string, body?: unknown) {
  const res = await deps.fetch(`${API}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${access}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) throw new GoogleError(res.status);
  return await res.json();
}

const site = encodeURIComponent(SITE_URL);
const query = (deps: Deps, access: string, range: { startDate: string; endDate: string }, dimensions: string[], rowLimit?: number) =>
  call(deps, access, `/webmasters/v3/sites/${site}/searchAnalytics/query`, { ...range, dimensions, ...(rowLimit ? { rowLimit } : {}), dataState: 'final' })
    .then((j) => (Array.isArray(j?.rows) ? j.rows as Row[] : []));

export async function summary(deps: Deps, access: string) {
  const { current, previous } = periods(deps.now());
  const [now, before, byDate, queries, pages, maps] = await Promise.all([
    query(deps, access, current, []), query(deps, access, previous, []), query(deps, access, current, ['date']),
    query(deps, access, current, ['query'], TOP_ROWS), query(deps, access, current, ['page'], TOP_ROWS),
    call(deps, access, `/webmasters/v3/sites/${site}/sitemaps`),
  ]);
  return {
    period: current, previousPeriod: previous,
    totals: metrics(now[0]), previous: metrics(before[0]),
    byDate: byDate.map((r) => ({ date: r.keys?.[0] ?? '', clicks: Math.round(r.clicks), impressions: Math.round(r.impressions) })),
    queries: queries.map((r) => ({ query: r.keys?.[0] ?? '', ...metrics(r) })),
    pages: pages.map((r) => ({ page: (r.keys?.[0] ?? '').replace(ORIGIN, '') || '/', ...metrics(r) })),
    sitemaps: (Array.isArray(maps?.sitemap) ? maps.sitemap : []).map((m: Record<string, unknown>) => ({
      path: String(m.path ?? '').replace(ORIGIN, ''), lastDownloaded: m.lastDownloaded ?? null,
      errors: Number(m.errors ?? 0), warnings: Number(m.warnings ?? 0),
      submitted: (Array.isArray(m.contents) ? m.contents : []).reduce((n: number, c: Record<string, unknown>) => n + Number(c.submitted ?? 0), 0),
    })),
  };
}

export function sitemapPaths(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()).filter((u) => u.startsWith(ORIGIN))
    .map((u) => u.slice(ORIGIN.length) || '/').slice(0, 60);
}

export async function indexing(deps: Deps, access: string) {
  const paths = sitemapPaths(await deps.sitemapXml());
  const out: Record<string, unknown>[] = new Array(paths.length);
  let next = 0;
  const worker = async () => {
    while (next < paths.length) {
      const i = next++;
      const path = paths[i];
      try {
        const j = await call(deps, access, '/v1/urlInspection/index:inspect', { inspectionUrl: `${ORIGIN}${path}`, siteUrl: SITE_URL });
        const r = j?.inspectionResult?.indexStatusResult ?? {};
        out[i] = { path, verdict: r.verdict ?? 'VERDICT_UNSPECIFIED', coverageState: r.coverageState ?? '', lastCrawlTime: r.lastCrawlTime ?? null,
          googleCanonical: typeof r.googleCanonical === 'string' ? r.googleCanonical.replace(ORIGIN, '') || '/' : null };
      } catch (e) {
        out[i] = { path, verdict: 'ERROR', coverageState: e instanceof GoogleError ? e.message : 'error', lastCrawlTime: null, googleCanonical: null };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(INSPECT_CONCURRENCY, paths.length) }, worker));
  return { pages: out };
}

export async function handler(deps: Deps, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  if ((await deps.caller()) !== 'admin') return { status: 403, body: { ok: false, code: 'forbidden' } };
  const action = (body as { action?: unknown } | null)?.action;
  if (action !== 'summary' && action !== 'indexing') return { status: 400, body: { ok: false, code: 'bad_action' } };
  const sa = parseServiceAccount(deps.keyJson());
  if (!sa) return { status: 503, body: { ok: false, code: 'not_configured' } };
  try {
    const access = await token(deps, sa);
    const data = action === 'summary' ? await summary(deps, access) : await indexing(deps, access);
    return { status: 200, body: { ok: true, site: SITE_URL, ...data } };
  } catch (e) {
    // Google's status only - never the key, the token or a request body
    const code = e instanceof GoogleError ? e.message : 'unavailable';
    console.error(`search-console: ${code}`);
    return { status: 502, body: { ok: false, code } };
  }
}
