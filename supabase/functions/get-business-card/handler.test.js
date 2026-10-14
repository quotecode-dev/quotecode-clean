// Task 23 + Task 24: the PUBLIC get-business-card handler (index.ts) exercised in-process with SYNTHETIC data - Deno `serve` and the
// Supabase client are replaced; nothing leaves the test. Proves: anonymous POST {id}, explicit column lists for both tables, opt-in output,
// a missing business_cards table = "no profile" (not an error), uniform 404, read-only, server key fails closed, CORS on every answer.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({ handler: null, state: null }));
vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (fn) => { h.handler = fn; } }));
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: (url, key) => {
    const s = h.state; s.clients.push({ url, key });
    return {
      from: (table) => {
        const q = { table, filters: [], select(cols) { q.cols = cols; return q; }, eq(k, v) { q.filters.push([k, v]); return q; }, maybeSingle() { return Promise.resolve(s.results[table]); } };
        for (const verb of ['insert', 'update', 'upsert', 'delete']) q[verb] = () => { s.writes.push(verb); return Promise.resolve({}); };
        s.queries.push(q); return q;
      },
      rpc: () => { s.writes.push('rpc'); return Promise.resolve({}); },
    };
  },
}));

const ID = '00000000-0000-4000-8000-0000000000a1';
const ROW = { business_name: 'עסק בדיקה סינתטי', phone: '+972 50-000-0000', email: 'qa@example.test', address: 'רחוב הבדיקה 1|חיפה||', logo_url: '', country: 'Local', tax_id: 'SECRET-TAX' };
const PROFILE = { display_name: null, job_title: 'מתקין', slogan: null, about: null, photo_url: null, show_phone: true, show_whatsapp: false, show_email: true, show_address: false, style: 'visual' };
const MISSING = { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.business_cards' in the schema cache" } };
function setup({ settings = { data: ROW, error: null }, profile = { data: PROFILE, error: null }, keys = JSON.stringify({ default: 'server-key-placeholder' }) } = {}) {
  h.state = { results: { business_settings: settings, business_cards: profile }, clients: [], queries: [], writes: [] };
  globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_SECRET_KEYS: keys })[k] } };
}
const post = (body) => new Request('https://x/functions/v1/get-business-card', { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });

beforeEach(async () => { setup(); if (!h.handler) await import('./index.ts'); });

describe('get-business-card handler (synthetic, in-process)', () => {
  it('answers the CORS preflight', async () => {
    const r = await h.handler(new Request('https://x', { method: 'OPTIONS' }));
    expect(r.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('anonymous POST {id} -> settings + profile with explicit columns; only opted-in channels; style; read-only; noindex', async () => {
    const r = await h.handler(post({ id: ID, extra: 'ignored' }));
    expect(r.status).toBe(200);
    expect(r.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(await r.json()).toEqual({ contractVersion: 2, ok: true, card: {
      businessName: 'עסק בדיקה סינתטי', jobTitle: 'מתקין', slogan: '', about: '', photoUrl: '', logoUrl: '', style: 'visual',
      phone: '+972 50-000-0000', whatsappUrl: '', email: 'qa@example.test', address: '', language: 'he' } });
    expect(h.state.queries.map((q) => [q.table, q.cols, q.filters])).toEqual([
      ['business_settings', 'business_name, phone, email, address, logo_url, country', [['user_id', ID]]],
      ['business_cards', 'display_name, job_title, slogan, about, photo_url, show_phone, show_whatsapp, show_email, show_address, style', [['user_id', ID]]],
    ]);
    expect(h.state.writes).toEqual([]);
  });

  it('business_cards not on this server yet (migration not applied) = no profile: name only, no channel - not an error', async () => {
    setup({ profile: MISSING });
    const r = await h.handler(post({ id: ID }));
    expect(r.status).toBe(200);
    const { card } = await r.json();
    expect([card.businessName, card.phone, card.email, card.address, card.whatsappUrl, card.style]).toEqual(['עסק בדיקה סינתטי', '', '', '', '', 'classic']);
  });

  it('any other profile read error fails closed (500) and leaks nothing', async () => {
    setup({ profile: { data: null, error: { code: '42501', message: 'boom' } } });
    const r = await h.handler(post({ id: ID }));
    expect(r.status).toBe(500);
    expect(JSON.stringify(await r.json())).not.toContain('boom');
  });

  it.each([
    ['a sequential id', { id: '7' }, undefined],
    ['no id', {}, undefined],
    ['an unknown owner', { id: ID }, { data: null, error: null }],
    ['an unnamed business', { id: ID }, { data: { ...ROW, business_name: 'ProFlow' }, error: null }],
    ['an unresolved market', { id: ID }, { data: { ...ROW, country: 'Unknown' }, error: null }],
  ])('%s -> the same uniform 404', async (_n, body, settings) => {
    if (settings) setup({ settings, profile: { data: null, error: null } });
    const r = await h.handler(post(body));
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ contractVersion: 2, ok: false, code: 'not_found' });
  });

  it('a malformed id never reaches the database', async () => {
    await h.handler(post({ id: '7' }));
    expect(h.state.queries).toHaveLength(0);
  });

  it('missing server configuration or a settings read error fails closed (500)', async () => {
    setup({ keys: '{}' });
    expect((await h.handler(post({ id: ID }))).status).toBe(500);
    setup({ settings: { data: null, error: { message: 'boom' } } });
    expect((await h.handler(post({ id: ID }))).status).toBe(500);
  });

  it('GET / malformed JSON are refused', async () => {
    expect((await h.handler(new Request('https://x', { method: 'GET' }))).status).toBe(405);
    expect((await h.handler(post('{oops'))).status).toBe(400);
  });
});
