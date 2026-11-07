// Owner console 2026-10-19 (voice assistant): the voice-ai Edge Function HANDLER exercised end to end with SYNTHETIC data - the Deno
// `serve`, the Supabase client and the provider HTTP calls are replaced in-process; nothing leaves the test.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';

const here = path.dirname(fileURLToPath(import.meta.url));
const h = vi.hoisted(() => ({ handler: null, state: null, mod: null }));
vi.mock('https://deno.land/std@0.168.0/http/server.ts', () => ({ serve: (fn) => { h.handler = fn; } }));
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({
  createClient: (_url, _key, opts) => {
    const s = h.state;
    s.clientAuthHeaders.push(opts?.global?.headers?.Authorization ?? null);
    const query = (table) => {
      const q = { table, filters: [], select(cols) { q.cols = cols; return q; }, eq(k, v) { q.filters.push([k, v]); return q; }, maybeSingle() { return Promise.resolve(s.tables[table]); } };
      for (const verb of ['insert', 'update', 'upsert', 'delete']) q[verb] = () => { s.writes.push(`${verb}:${table}`); return Promise.resolve({ data: null, error: null }); };
      s.queries.push(q);
      return q;
    };
    const auth = opts?.global?.headers?.Authorization ?? null;
    return { auth: { getUser: async () => ({ data: { user: s.user } }) }, from: query, rpc: (fn, args) => {
      s.rpcs.push(fn);
      if (fn === 'smart_pack_usage_claim' || fn === 'smart_pack_usage_finish') s.meter.push({ fn, args, auth });
      return Promise.resolve(fn === 'get_account_summary' ? s.summary : fn === 'smart_pack_usage_finish' ? { data: { ok: true }, error: null } : s.claim);
    } };
  },
}));

const AUDIO_B64 = Buffer.from(new Uint8Array(4000).fill(7)).toString('base64');
let providerCalls;
// Owner 2026-11-06: the SMART PACK usage meter replaces the day's 60 - claim (caller JWT), then finish (service role)
function setup({ user = { id: 'u-voice-1' }, country = 'Local', claim = { data: { ok: true, claimId: 'm1' }, error: null }, provider = null,
  summary = { data: { ok: false, code: 'not_activated' }, error: null } } = {}) {
  h.state = { user, claim, summary, meter: [], clientAuthHeaders: [], queries: [], writes: [], rpcs: [], tables: { business_settings: { data: country ? { country } : null, error: null } } };
  providerCalls = [];
  globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_ANON_KEY: 'anon-placeholder', OPENAI_API_KEY: 'placeholder' })[k] } };
  globalThis.fetch = vi.fn(async (url, init) => {
    const call = { url, init };
    if (init.body instanceof FormData) call.form = Object.fromEntries([...init.body.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : `blob:${v.type}`]));
    else call.json = JSON.parse(init.body);
    providerCalls.push(call);
    if (provider) return provider(url, init, providerCalls.length);
    if (url.endsWith('/audio/transcriptions')) return new Response(JSON.stringify({ text: ' כמה הצעות יש לי ' }), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
  });
}
const post = (body, auth = 'Bearer synthetic-user-jwt') => new Request('https://synthetic.supabase.co/functions/v1/voice-ai', { method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) }, body: JSON.stringify(body) });

beforeEach(async () => {
  setup();
  if (!h.handler) h.mod = await import('./index.ts');
});

describe('voice-ai handler (synthetic, in-process) - Owner 2026-10-19', () => {
  it('answers the CORS preflight', async () => {
    const r = await h.handler(new Request('https://x/functions/v1/voice-ai', { method: 'OPTIONS' }));
    expect(r.status).toBe(200);
    expect(r.headers.get('access-control-allow-headers')).toContain('authorization');
  });

  it('transcribe: Hebrew from the server market, one metered operation, the caller JWT, nothing written', async () => {
    const r = await h.handler(post({ mode: 'transcribe', audio: AUDIO_B64, mime: 'audio/webm;codecs=opus', language: 'en' }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ contractVersion: 1, ok: true, text: 'כמה הצעות יש לי' });
    expect(providerCalls).toHaveLength(1);
    expect(providerCalls[0].url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(providerCalls[0].form).toMatchObject({ model: 'gpt-transcribe', language: 'he', file: 'blob:audio/webm' });
    // Owner 2026-10-20 (L-17): the SMART PACK gate reads the caller's own summary first (plans off here = unchanged), then the meter
    // (Owner 2026-11-06): claimed with the caller JWT, finished with the service role (the second client) - no usage given = 60 s charged
    expect(h.state.rpcs).toEqual(['get_account_summary', 'smart_pack_usage_claim', 'smart_pack_usage_finish']);
    expect(h.state.clientAuthHeaders).toEqual(['Bearer synthetic-user-jwt', null]);
    expect(h.state.meter.map((m) => [m.fn, m.auth])).toEqual([['smart_pack_usage_claim', 'Bearer synthetic-user-jwt'], ['smart_pack_usage_finish', null]]);
    // 2026-11-07 (release D, M02): the reserve in micro-USD (60 s on both models, at least the old 40,000 micro-ILS), converted by the database
    expect(h.state.meter[0].args).toEqual({ p_feature: 'voice', p_reserve_micros: 40002, p_reserve_usd_micros: 11429 });
    expect(h.state.meter[1].args).toMatchObject({ p_ok: true, p_cost_usd_micros: 4500, p_model: 'gpt-transcribe' });
    expect(h.state.queries.map((q) => [q.table, q.cols, q.filters])).toEqual([['business_settings', 'country', [['user_id', 'u-voice-1']]]]);
    expect(h.state.writes).toEqual([]);
  });

  it('Owner 2026-10-20 (L-17): enforced without SMART PACK -> 403 smart_pack_required before the meter and the provider', async () => {
    setup({ summary: { data: { ok: true, schema: 'account-summary/v1', version: 1, phase: { output: 'enforced', catalog: 'prepared', billing: 'off' },
      market: 'IL', plan: { id: 'free' }, subscriptionStatus: 'none', capabilities: ['quote_style.classic'], eligiblePlans: {},
      free10: { limit: 10, consumed: 1, reserved: 0, remaining: 9 }, catalog: { active: 0, countDefinition: 'unset', limit: null, blocks: 0, limitDecided: false },
      priceCatalogVersion: null, smartPack: { active: false, source: null, until: null } }, error: null } });
    const res = await h.handler(new Request('https://synthetic.supabase.co/functions/v1/voice-ai', { method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer synthetic-user-jwt' }, body: JSON.stringify({ mode: 'speak', text: 'שלום' }) }));
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ ok: false, code: 'smart_pack_required' });
    expect(h.state.rpcs).toEqual(['get_account_summary']);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('transcribe: English for an International account; the fallback model answers when the first fails', async () => {
    setup({ country: 'International', provider: (url, _init, n) => (n === 1 ? new Response('no', { status: 500 }) : new Response(JSON.stringify({ text: 'how many quotes' }), { status: 200 })) });
    const r = await h.handler(post({ mode: 'transcribe', audio: AUDIO_B64, mime: 'audio/mp4' }));
    expect((await r.json()).text).toBe('how many quotes');
    expect(providerCalls.map((c) => c.form.model)).toEqual(['gpt-transcribe', 'whisper-1']);
    expect(providerCalls[1].form.language).toBe('en');
  });

  it('speak: markdown stripped, mp3 back as base64, Hebrew voice instructions', async () => {
    const r = await h.handler(post({ mode: 'speak', text: '**ההצעה האחרונה** היא מס׳ 100703\n- ללקוח Eden David' }));
    const body = await r.json();
    expect(body).toMatchObject({ ok: true, mime: 'audio/mpeg' });
    expect(Buffer.from(body.audio, 'base64')).toEqual(Buffer.from([1, 2, 3, 4]));
    expect(providerCalls[0].url).toBe('https://api.openai.com/v1/audio/speech');
    expect(providerCalls[0].json).toMatchObject({ model: 'gpt-4o-mini-tts', voice: 'marin', input: 'ההצעה האחרונה היא מס׳ 100703\nללקוח Eden David', response_format: 'mp3' });
    expect(providerCalls[0].json.instructions).toMatch(/Hebrew/);
  });

  it('refuses: no JWT, unknown market, 0% of the SMART PACK usage left, bad audio / mode - and never calls the provider then', async () => {
    expect((await h.handler(post({ mode: 'speak', text: 'x' }, null))).status).toBe(401);
    setup({ user: null });
    expect((await h.handler(post({ mode: 'speak', text: 'x' }))).status).toBe(401);
    setup({ country: null });
    expect((await h.handler(post({ mode: 'speak', text: 'x' }))).status).toBe(409);
    setup({ claim: { data: { ok: false, code: 'budget_exhausted' }, error: null } });
    const capped = await h.handler(post({ mode: 'speak', text: 'x' }));
    expect(capped.status).toBe(403);
    expect(await capped.json()).toMatchObject({ ok: false, code: 'budget_exhausted' });
    setup();
    expect((await h.handler(post({ mode: 'transcribe', audio: AUDIO_B64, mime: 'video/x-msvideo' }))).status).toBe(400);
    expect((await h.handler(post({ mode: 'transcribe', audio: 'A'.repeat(2_000_001), mime: 'audio/webm' }))).status).toBe(400);
    expect((await h.handler(post({ mode: 'transcribe', audio: 'QUJD', mime: 'audio/webm' }))).status).toBe(400);
    expect((await h.handler(post({ mode: 'translate', text: 'x' }))).status).toBe(400);
    expect((await h.handler(post({ mode: 'speak', text: '   ' }))).status).toBe(400);
    expect(providerCalls).toHaveLength(0);
  });

  it('provider down on both models -> 502, never a fake answer', async () => {
    setup({ provider: () => new Response('down', { status: 503 }) });
    expect((await h.handler(post({ mode: 'speak', text: 'שלום' }))).status).toBe(502);
    expect(providerCalls).toHaveLength(2);
  });

  it('the spoken text is capped at 1,500 characters', () => {
    expect(h.mod.speakableText('א'.repeat(3000))).toHaveLength(1500);
  });

  it('read-only source: no table write, no storage, no admin auth; the service role only finishes the usage meter', () => {
    const src = fs.readFileSync(path.join(here, 'index.ts'), 'utf8');
    for (const re of [/\.insert\(/, /\.update\(/, /\.delete\(/, /\.upsert\(/, /\.storage\./, /auth\.admin/]) expect(src).not.toMatch(re);
    // Owner 2026-11-06: the service-role client exists ONLY to finish the SMART PACK usage meter (smart_pack_usage_finish)
    const uses = [...src.matchAll(/\badmin\b/g)].length;
    expect(uses).toBe([...src.matchAll(/finishMeter\(admin,/g)].length + 1);
  });
});

// Owner console 2026-11-06 (typed night-task approval): the SMART PACK usage meter - the real cost of each voice operation
describe('voice-ai: the SMART PACK usage meter', () => {
  it('speech: the characters spoken are counted (gpt-4o-mini-tts, 25 micro-USD a character)', async () => {
    setup();
    await h.handler(post({ mode: 'speak', text: 'שלום עולם' }));
    // 2026-11-07 (release D, M02): THIS text's proven maximum - 9 characters on both models (25 + 15 micro-USD each)
    expect(h.state.meter[0].args).toEqual({ p_feature: 'voice', p_reserve_micros: 1260, p_reserve_usd_micros: 360 });
    expect(h.state.meter[1].args).toMatchObject({ p_ok: true, p_cost_usd_micros: 225, p_model: 'gpt-4o-mini-tts', p_units: 9 });
  });
  it('a recording: the provider duration (whisper-1 seconds) or token usage is counted', async () => {
    setup({ provider: () => new Response(JSON.stringify({ text: 'x', usage: { type: 'duration', seconds: 15 } }), { status: 200 }) });
    await h.handler(post({ mode: 'transcribe', audio: AUDIO_B64, mime: 'audio/webm' }));
    // 15 s of gpt-transcribe at US$0.0045 a minute = 1,125 micro-USD
    expect(h.state.meter[1].args).toMatchObject({ p_ok: true, p_cost_usd_micros: 1125, p_units: 15 });
    setup({ provider: () => new Response(JSON.stringify({ text: 'x', usage: { type: 'tokens', input_tokens: 120, input_token_details: { audio_tokens: 100, text_tokens: 20 }, output_tokens: 10 } }), { status: 200 }) });
    await h.handler(post({ mode: 'transcribe', audio: AUDIO_B64, mime: 'audio/webm' }));
    // 100 x 6 + 20 x 2.5 + 10 x 10 = 750 micro-USD
    expect(h.state.meter[1].args).toMatchObject({ p_ok: true, p_cost_usd_micros: 750 });
  });
  it('the provider fails: the reserve is given back (not counted)', async () => {
    setup({ provider: () => new Response('x', { status: 500 }) });
    const r = await h.handler(post({ mode: 'speak', text: 'שלום' }));
    expect(r.status).toBe(502);
    expect(h.state.meter[1].args).toMatchObject({ p_ok: false, p_cost_usd_micros: 0 });
  });
  it('the meter cannot be read: refused before the provider', async () => {
    setup({ claim: { data: null, error: { message: 'down' } } });
    const r = await h.handler(post({ mode: 'speak', text: 'שלום' }));
    expect(r.status).toBe(500);
    expect(providerCalls).toHaveLength(0);
  });
});
