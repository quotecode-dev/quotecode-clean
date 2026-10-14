// @vitest-environment node
// IRON-PUBLIC-001 / IRON-TENANT-001 / IRON-SIGN-001 / IRON-QUOTE-006 / IRON-MARKET-004 - the REAL get-public-quote handler
// (index.ts) answering anonymous and authenticated public-link requests.
// Hermetic isolation only: `serve` captures the real handler, and the Supabase client is an in-memory fake of the three
// tables + storage the handler reads. This proves the handler's own decisions (validation, owner flag, allowlisted output,
// attachment path guard, expiry truth, fallback select) - it is NOT a proof of the hosted service, RLS or the database.
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const state = {
    handler: null as null | ((req: Request) => Promise<Response>),
    env: {} as Record<string, string | undefined>,
    db: { quotes: [] as any[], business_settings: [] as any[], quote_attachments: [] as any[] },
    users: {} as Record<string, string>, // bearer token -> user id
    getUserThrows: false,
    richSelectError: null as null | { message: string },
    failTable: null as null | string,
    signFails: new Set<string>(),
    clients: [] as { url: string; key: string; opts: any }[],
    queries: [] as { table: string; select: string; filters: [string, unknown][] }[],
    signCalls: [] as { bucket: string; path: string; expiry: number }[],
    getUserCalls: 0,
  };
  (globalThis as any).Deno = { env: { get: (k: string) => state.env[k] } };
  return state;
});

vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (fn: any) => { h.handler = fn; } }));
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: (url: string, key: string, opts?: any) => {
    h.clients.push({ url, key, opts });
    const auth = opts?.global?.headers?.Authorization as string | undefined;
    return {
      auth: {
        getUser: async () => {
          h.getUserCalls += 1;
          if (h.getUserThrows) throw new Error('auth network down');
          const token = auth?.replace(/^Bearer\s+/i, '');
          const id = token ? h.users[token] : undefined;
          return { data: { user: id ? { id } : null }, error: id ? null : { message: 'invalid JWT' } };
        },
      },
      from: (table: string) => {
        const q = { table, select: '', filters: [] as [string, unknown][] };
        const run = () => {
          h.queries.push(q);
          if (h.failTable === table) return { data: null, error: { message: `relation "${table}" permission denied for role` } };
          if (table === 'quotes' && /project_name/.test(q.select) && h.richSelectError) return { data: null, error: h.richSelectError };
          const rows = (h.db as any)[table].filter((r: any) => q.filters.every(([c, v]) => r[c] === v));
          return { rows };
        };
        const builder: any = {
          select: (cols: string) => { q.select = cols; return builder; },
          eq: (col: string, val: unknown) => { q.filters.push([col, val]); return builder; },
          maybeSingle: async () => { const r: any = run(); return r.error ? r : { data: r.rows[0] ?? null, error: null }; },
          then: (res: any, rej: any) => { const r: any = run(); return Promise.resolve(r.error ? r : { data: r.rows, error: null }).then(res, rej); },
        };
        return builder;
      },
      storage: {
        from: (bucket: string) => ({
          createSignedUrl: async (path: string, expiry: number) => {
            h.signCalls.push({ bucket, path, expiry });
            return h.signFails.has(path) ? { data: null, error: { message: 'object not found' } } : { data: { signedUrl: `https://signed.test/${bucket}/${path}?ttl=${expiry}` }, error: null };
          },
        }),
      },
    };
  },
}));

const OWNER = '0b0b0b0b-1111-4222-8333-444444444444';
const OTHER_TENANT = '0c0c0c0c-5555-4666-8777-888888888888';
const QID = 'a29b1fbb-f2ca-427d-88b2-6198d138eb89';
const QID2 = 'b39b1fbb-f2ca-427d-88b2-6198d138eb90';

const baseQuote = (over: Record<string, unknown> = {}) => ({
  id: QID, user_id: OWNER, created_at: '2026-10-01T09:00:00Z', valid_until: null, tax_rate: 18, subtotal: 1040, total: 1227.2,
  discount: 0, terms: 'Net 30', warranty: '12 months', notes: 'n', subject: 'Windows', status: 'sent', signature: null, currency: 'ILS',
  client_type: 'business', quote_number: 100701, attn_name: 'Dana', attn_role: 'Buyer', project_name: 'Villa',
  clients: { company_name: 'Client Ltd', email: 'c@example.test', phone: '050', address: 'Haifa', client_type: 'business', id: 'cl-1', user_id: OWNER },
  quote_sections: [], quote_items: [{ description: 'Window', quantity: 1, unit_price: 1040, total_price: 1040, sort_order: 0 }],
  ...over,
});
const business = (over: Record<string, unknown> = {}) => ({
  user_id: OWNER, business_name: 'Issuer Co', logo_url: null, tax_id: '515', email: 'b@example.test', phone: '03', address: 'TLV', currency: 'ILS', country: 'Local', ...over,
});

const call = async (body: unknown, init: { method?: string; auth?: string; raw?: string } = {}) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.auth) headers.Authorization = init.auth;
  const req = new Request('https://fn.test/get-public-quote', {
    method: init.method ?? 'POST', headers,
    body: (init.method ?? 'POST') === 'POST' || init.raw !== undefined ? (init.raw ?? JSON.stringify(body)) : undefined,
  });
  const res = await h.handler!(req);
  const text = await res.text();
  let json: any = null; try { json = JSON.parse(text); } catch { /* plain body */ }
  return { status: res.status, json, text, headers: res.headers };
};

beforeAll(async () => {
  await import('./index.ts');
  expect(typeof h.handler).toBe('function');
});
beforeEach(() => {
  h.env = { SUPABASE_URL: 'https://test-ref.supabase.test', SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'service-secret' }), SUPABASE_ANON_KEY: 'anon-public' };
  h.db = { quotes: [baseQuote()], business_settings: [business()], quote_attachments: [] };
  h.users = { 'owner-jwt': OWNER, 'other-jwt': OTHER_TENANT };
  h.getUserThrows = false; h.richSelectError = null; h.failTable = null; h.signFails = new Set();
  h.clients = []; h.queries = []; h.signCalls = []; h.getUserCalls = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('request validation - nothing is read for a malformed public link', () => {
  it('CORS preflight answers 200 with the public CORS headers and no body processing', async () => {
    const r = await call(null, { method: 'OPTIONS' });
    expect(r.status).toBe(200);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(r.headers.get('Access-Control-Allow-Headers')).toContain('authorization');
    expect(h.queries).toHaveLength(0);
  });
  it('any method other than POST is 405', async () => {
    for (const method of ['GET', 'PUT', 'DELETE']) expect((await call(null, { method })).status).toBe(405);
    expect(h.queries).toHaveLength(0);
  });
  it('a body that is not JSON is 400 "Invalid request body"', async () => {
    const r = await call(null, { raw: '{not json' });
    expect([r.status, r.json.error]).toEqual([400, 'Invalid request body']);
  });
  it('a missing / non-string quote_id is 400 and never reaches the database', async () => {
    for (const body of [{}, { quote_id: null }, { quote_id: 42 }, { quote_id: { id: QID } }, { quote_id: [QID] }]) {
      const r = await call(body);
      expect([r.status, r.json.error], JSON.stringify(body)).toEqual([400, 'Missing or invalid quote_id']);
    }
    expect(h.queries).toHaveLength(0);
  });
  it('injection / enumeration shaped ids (not a UUID) are rejected before any lookup', async () => {
    for (const id of [`${QID}' or '1'='1`, '../quotes', '100701', `${QID}\n`, 'a29b1fbb-f2ca-427d-88b2-6198d138eb8', '']) {
      expect((await call({ quote_id: id })).status, id).toBe(400);
    }
    expect(h.queries).toHaveLength(0);
    expect(h.clients).toHaveLength(0);
  });
  it('missing server configuration returns the generic error without creating a client', async () => {
    h.env.SUPABASE_URL = undefined;
    const r = await call({ quote_id: QID });
    expect([r.status, r.json]).toEqual([400, { error: 'Unable to load quote' }]);
    expect(h.clients).toHaveLength(0);
  });
  it('a malformed secret-keys configuration fails closed with the generic error (no stack / config text leaked)', async () => {
    h.env.SUPABASE_SECRET_KEYS = '{broken';
    const r = await call({ quote_id: QID });
    expect([r.status, r.json]).toEqual([400, { error: 'Unable to load quote' }]);
    expect(r.text).not.toMatch(/JSON|broken|SECRET/i);
  });
});

describe('anonymous access by UUID link and the allowlisted public payload', () => {
  it('an unknown UUID is 404 "Quote not found" (no other tenant data, no business lookup)', async () => {
    const r = await call({ quote_id: QID2 });
    expect([r.status, r.json]).toEqual([404, { error: 'Quote not found' }]);
    expect(h.queries.map((q) => q.table)).toEqual(['quotes']);
  });
  it('the quote is looked up by the exact link id only, with the server secret (never a caller key)', async () => {
    await call({ quote_id: QID });
    expect(h.queries[0]).toMatchObject({ table: 'quotes', filters: [['id', QID]] });
    expect(h.clients[0]).toMatchObject({ url: 'https://test-ref.supabase.test', key: 'service-secret' });
  });
  it('an anonymous request renders the quote and never resolves a caller identity', async () => {
    const r = await call({ quote_id: QID });
    expect(r.status).toBe(200);
    expect(r.json.quote.is_owner_viewing).toBe(false);
    expect(h.getUserCalls).toBe(0);
    expect(h.clients).toHaveLength(1);
  });
  it('the quote object is exactly the public allowlist - the owner user_id and the internal client relation never leave the server', async () => {
    const r = await call({ quote_id: QID });
    expect(Object.keys(r.json.quote).sort()).toEqual(['attn_name', 'attn_role', 'client_type', 'created_at', 'currency', 'discount', 'id', 'is_expired',
      'is_owner_viewing', 'notes', 'project_name', 'quote_number', 'signature', 'status', 'subject', 'subtotal', 'tax_rate', 'terms', 'total',
      'valid_until', 'warranty'].sort());
    expect(r.text).not.toContain(OWNER);
    expect(r.text).not.toContain('cl-1');
  });
  it('the business block exposes only the letterhead fields: no market column, no owner id', async () => {
    const r = await call({ quote_id: QID });
    expect(Object.keys(r.json.business).sort()).toEqual(['address', 'business_name', 'currency', 'email', 'logo_url', 'phone', 'tax_id']);
    expect(r.json.business).not.toHaveProperty('country');
  });
  it('the client block exposes only the recipient contact fields', async () => {
    const r = await call({ quote_id: QID });
    expect(r.json.client).toEqual({ company_name: 'Client Ltd', email: 'c@example.test', phone: '050', address: 'Haifa' });
  });
  it('the letterhead is the ISSUER of this quote (looked up by the quote owner), even when another tenant is the caller', async () => {
    h.db.business_settings.push(business({ user_id: OTHER_TENANT, business_name: 'Caller Co' }));
    const r = await call({ quote_id: QID }, { auth: 'Bearer other-jwt' });
    expect(r.json.business.business_name).toBe('Issuer Co');
    expect(h.queries.find((q) => q.table === 'business_settings')!.filters).toEqual([['user_id', OWNER]]);
  });
  it('a quote without a business row or a client still renders (null blocks, not an error)', async () => {
    h.db.business_settings = [];
    h.db.quotes = [baseQuote({ clients: null })];
    const r = await call({ quote_id: QID });
    expect(r.status).toBe(200);
    expect([r.json.business, r.json.client]).toEqual([null, null]);
  });
});

describe('owner flag (advisory UI signal mirroring is_issuer_tenant_member)', () => {
  it('the quote owner viewing their own link is flagged is_owner_viewing=true', async () => {
    expect((await call({ quote_id: QID }, { auth: 'Bearer owner-jwt' })).json.quote.is_owner_viewing).toBe(true);
  });
  it('an authenticated user of ANOTHER tenant is a customer (false) - may sign as a recipient', async () => {
    expect((await call({ quote_id: QID }, { auth: 'Bearer other-jwt' })).json.quote.is_owner_viewing).toBe(false);
  });
  it('the caller identity is resolved with the PUBLIC anon key + the forwarded bearer token, never with the service secret', async () => {
    await call({ quote_id: QID }, { auth: 'Bearer owner-jwt' });
    const callerClient = h.clients.find((c) => c.opts?.global?.headers?.Authorization);
    expect(callerClient).toMatchObject({ key: 'anon-public', opts: { global: { headers: { Authorization: 'Bearer owner-jwt' } } } });
  });
  it('an invalid / expired token is simply not the owner (page still renders)', async () => {
    const r = await call({ quote_id: QID }, { auth: 'Bearer forged-jwt' });
    expect([r.status, r.json.quote.is_owner_viewing]).toEqual([200, false]);
  });
  it('an auth-service failure never blocks the public page and never grants the owner view', async () => {
    h.getUserThrows = true;
    const r = await call({ quote_id: QID }, { auth: 'Bearer owner-jwt' });
    expect([r.status, r.json.quote.is_owner_viewing]).toEqual([200, false]);
  });
  it('the owner view carries NO extra data: identical payload to the anonymous view except the advisory flag', async () => {
    const anon = (await call({ quote_id: QID })).json;
    const owner = (await call({ quote_id: QID }, { auth: 'Bearer owner-jwt' })).json;
    expect({ ...owner, quote: { ...owner.quote, is_owner_viewing: false } }).toEqual(anon);
  });
  it('without a configured anon key the bearer token is ignored (no identity resolution at all)', async () => {
    h.env.SUPABASE_ANON_KEY = undefined;
    const r = await call({ quote_id: QID }, { auth: 'Bearer owner-jwt' });
    expect([r.json.quote.is_owner_viewing, h.getUserCalls]).toEqual([false, 0]);
  });
});

describe('persisted money, market and signature truth (no server-side reinterpretation)', () => {
  it('a historical USD quote keeps its own currency / tax_rate although the issuer is now a Local (ILS) business', async () => {
    h.db.quotes = [baseQuote({ currency: 'USD', tax_rate: 0, total: 1227.2, subtotal: 1227.2 })];
    const r = await call({ quote_id: QID });
    expect([r.json.quote.currency, r.json.quote.tax_rate]).toEqual(['USD', 0]);
    expect(r.json.business.currency).toBe('ILS');
  });
  it('stored amounts are returned unrounded (the ILS whole-shekel rule is display-only, applied by the page)', async () => {
    const r = await call({ quote_id: QID });
    expect([r.json.quote.total, r.json.quote.subtotal, r.json.items[0].price]).toEqual([1227.2, 1040, 1040]);
  });
  it('status and the stored signature pass through unchanged so the page shows the approval record of a signed quote', async () => {
    h.db.quotes = [baseQuote({ status: 'approved', signature: 'data:image/png;base64,AAAA' })];
    const r = await call({ quote_id: QID });
    expect([r.json.quote.status, r.json.quote.signature]).toEqual(['approved', 'data:image/png;base64,AAAA']);
  });
});

describe('OD-1 acceptance expiry is server truth in the issuer market zone', () => {
  it('no validity date never expires', async () => {
    expect((await call({ quote_id: QID })).json.quote.is_expired).toBe(false);
  });
  it('Local issuer: valid through the end of valid_until in Asia/Jerusalem (23:30 local still valid, 00:30 next day expired)', async () => {
    h.db.quotes = [baseQuote({ valid_until: '2026-10-13' })];
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-13T20:30:00Z'));
    expect((await call({ quote_id: QID })).json.quote.is_expired).toBe(false);
    vi.setSystemTime(new Date('2026-10-13T21:30:00Z'));
    expect((await call({ quote_id: QID })).json.quote.is_expired).toBe(true);
  });
  it('International issuer: Anywhere-on-Earth - still valid at 11:59 UTC the next day, expired at 12:00 UTC', async () => {
    h.db.business_settings = [business({ country: 'International', currency: 'USD' })];
    h.db.quotes = [baseQuote({ valid_until: '2026-10-13', currency: 'USD' })];
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T11:59:00Z'));
    expect((await call({ quote_id: QID })).json.quote.is_expired).toBe(false);
    vi.setSystemTime(new Date('2026-10-14T12:00:00Z'));
    expect((await call({ quote_id: QID })).json.quote.is_expired).toBe(true);
  });
  it('an issuer with no business row is judged by the International (most lenient) zone, never silently Local', async () => {
    h.db.business_settings = [];
    h.db.quotes = [baseQuote({ valid_until: '2026-10-13' })];
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-13T21:30:00Z')); // already the 14th in Jerusalem, still the 13th at UTC-12
    expect((await call({ quote_id: QID })).json.quote.is_expired).toBe(false);
  });
  it('the stored valid_until is returned exactly as persisted (never shifted by the expiry computation)', async () => {
    h.db.quotes = [baseQuote({ valid_until: '2026-02-28' })];
    expect((await call({ quote_id: QID })).json.quote.valid_until).toBe('2026-02-28');
  });
});

describe('structured content and the flat-select fallback', () => {
  it('sections, items and measurements are ordered by their persisted sort_order; specification is always an array', async () => {
    h.db.quotes = [baseQuote({
      quote_sections: [{ id: 's2', name: 'Kitchen', sort_order: 2 }, { id: 's1', name: 'Living', sort_order: 1 }],
      quote_items: [
        { description: 'B', quantity: 1, unit_price: 2, total_price: 2, sort_order: 2, section_id: 's2', specification: 'not-an-array' },
        { description: 'A', quantity: 2, unit_price: 5, total_price: 10, sort_order: 1, section_id: 's1', specification: ['Low-E'],
          quote_item_measurements: [{ width: 2, height: 1, unit: 'm', calculated_area: 2, label: 'w2', sort_order: 2, is_pricing_driving: false }, { width: 1, height: 1, unit: 'm', calculated_area: 1, label: 'w1', sort_order: 1 }] },
      ],
    })];
    const r = await call({ quote_id: QID });
    expect(r.json.sections).toEqual([{ id: 's1', name: 'Living' }, { id: 's2', name: 'Kitchen' }]);
    expect(r.json.items.map((i: any) => i.description)).toEqual(['A', 'B']);
    expect(r.json.items[1].specification).toEqual([]);
    expect(r.json.items[0].measurements.map((m: any) => [m.label, m.is_pricing_driving])).toEqual([['w1', true], ['w2', false]]);
  });
  it('an environment without the structured columns retries ONCE with the flat select and still renders a plain quote', async () => {
    h.richSelectError = { message: 'column quotes.project_name does not exist' };
    const flat = baseQuote(); delete (flat as any).project_name; delete (flat as any).quote_sections;
    h.db.quotes = [flat];
    const r = await call({ quote_id: QID });
    expect(r.status).toBe(200);
    expect(h.queries.filter((q) => q.table === 'quotes')).toHaveLength(2);
    expect(h.queries[1].select).not.toMatch(/project_name|quote_sections/);
    expect([r.json.sections, r.json.quote.project_name, r.json.items[0].measurements]).toEqual([[], undefined, []]);
  });
  it('any OTHER database error is not retried and surfaces only the generic message (no SQL / relation text leaked)', async () => {
    h.failTable = 'quotes';
    const r = await call({ quote_id: QID });
    expect([r.status, r.json]).toEqual([400, { error: 'Unable to load quote' }]);
    expect(h.queries).toHaveLength(1);
    expect(r.text).not.toMatch(/relation|permission|role/);
  });
});

describe('private attachments: only this quote\'s own objects, minted as short-lived signed URLs', () => {
  const att = (storage_path: string, file_name = 'plan.pdf') => ({ quote_id: QID, file_name, storage_path });
  it('a valid owner/quote path is signed for 300 seconds and only {file_name, url} is returned (no storage path)', async () => {
    h.db.quote_attachments = [att(`${OWNER}/${QID}_1728000000.pdf`)];
    const r = await call({ quote_id: QID });
    expect(h.signCalls).toEqual([{ bucket: 'quote-files', path: `${OWNER}/${QID}_1728000000.pdf`, expiry: 300 }]);
    expect(r.json.attachments).toEqual([{ file_name: 'plan.pdf', url: `https://signed.test/quote-files/${OWNER}/${QID}_1728000000.pdf?ttl=300` }]);
    expect(h.queries.find((q) => q.table === 'quote_attachments')!.filters).toEqual([['quote_id', QID]]);
  });
  it('a row pointing at ANOTHER tenant\'s folder or ANOTHER quote\'s file is never signed', async () => {
    h.db.quote_attachments = [att(`${OTHER_TENANT}/${QID}_1.pdf`), att(`${OWNER}/${QID2}_1.pdf`)];
    const r = await call({ quote_id: QID });
    expect([h.signCalls, r.json.attachments]).toEqual([[], []]);
  });
  it('traversal, absolute, backslash and nested paths are refused', async () => {
    h.db.quote_attachments = [att(`${OWNER}/../${OTHER_TENANT}/${QID}_1.pdf`), att(`/${OWNER}/${QID}_1.pdf`), att(`${OWNER}\\${QID}_1.pdf`), att(`${OWNER}/x/${QID}_1.pdf`)];
    await call({ quote_id: QID });
    expect(h.signCalls).toEqual([]);
  });
  it('file names outside the <quote>_<digits>.<ext 1-10> shape (no extension, non-numeric stamp, 11-char extension, empty) are refused', async () => {
    h.db.quote_attachments = [att(`${OWNER}/${QID}_1`), att(`${OWNER}/${QID}_abc.pdf`), att(`${OWNER}/${QID}_1.abcdefghijk`), att(''), { quote_id: QID, file_name: 'x', storage_path: null }];
    await call({ quote_id: QID });
    expect(h.signCalls).toEqual([]);
  });
  it('a signing failure drops only that attachment; the quote and the other attachments still render', async () => {
    const ok = `${OWNER}/${QID}_2.png`; const missing = `${OWNER}/${QID}_1.pdf`;
    h.signFails.add(missing);
    h.db.quote_attachments = [att(missing, 'gone.pdf'), att(ok, 'photo.png')];
    const r = await call({ quote_id: QID });
    expect(r.status).toBe(200);
    expect(r.json.attachments.map((a: any) => a.file_name)).toEqual(['photo.png']);
  });
});
