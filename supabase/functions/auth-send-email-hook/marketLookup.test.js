import { describe, it, expect } from 'vitest';
import { makeBusinessMarketLookup, secretKeyFromEnv } from './marketLookup.ts';

// Auth market identity gap F1 - Option C (2026-09-28): the single service-role read. A fake supabase-js client records the
// exact query; nothing connects anywhere. Synthetic values only.
const USER_ID = '11111111-2222-4333-8444-555555555555';
const SECRET = 'sb_secret_SYNTHETIC_ONLY_do_not_log';
const ENV = { SUPABASE_URL: 'https://example-ref.supabase.co', SUPABASE_SECRET_KEYS: JSON.stringify({ default: SECRET }) };

function fakeCreateClient(result) {
  const log = { clients: [], calls: [] };
  const createClient = (url, key, options) => {
    log.clients.push({ url, key, options });
    const builder = {
      select: (cols) => { log.calls.push(['select', cols]); return builder; },
      eq: (col, val) => { log.calls.push(['eq', col, val]); return builder; },
      limit: (n) => { log.calls.push(['limit', n]); return builder; },
      abortSignal: (s) => { log.calls.push(['abortSignal', s instanceof AbortSignal]); return builder; },
      then: (resolve, reject) => (typeof result === 'function' ? Promise.resolve().then(result) : Promise.resolve(result)).then(resolve, reject),
    };
    return { from: (table) => { log.calls.push(['from', table]); return builder; } };
  };
  return { createClient, log };
}

describe('marketLookup - one narrow service-role read', () => {
  it('uses SUPABASE_SECRET_KEYS.default (existing pattern) and queries ONLY business_settings.country by the exact user_id, at most 2 rows', async () => {
    const { createClient, log } = fakeCreateClient({ data: [{ country: 'Local', business_name: 'must not leak through' }], error: null });
    const rows = await makeBusinessMarketLookup({ env: (k) => ENV[k], createClient })(USER_ID, new AbortController().signal);
    expect(rows).toEqual([{ country: 'Local' }]); // only the market field leaves the lookup
    expect(log.clients).toEqual([{ url: ENV.SUPABASE_URL, key: SECRET, options: { auth: { persistSession: false, autoRefreshToken: false } } }]);
    expect(log.calls).toEqual([['from', 'business_settings'], ['select', 'country'], ['eq', 'user_id', USER_ID], ['limit', 2], ['abortSignal', true]]);
  });

  it('zero and two rows are returned as-is (the resolver decides bootstrap / fail-closed)', async () => {
    for (const data of [[], [{ country: 'Local' }, { country: 'International' }]]) {
      const { createClient } = fakeCreateClient({ data, error: null });
      expect(await makeBusinessMarketLookup({ env: (k) => ENV[k], createClient })(USER_ID, new AbortController().signal)).toHaveLength(data.length);
    }
  });

  it('missing / malformed SUPABASE_SECRET_KEYS or SUPABASE_URL -> not_configured, no client created, no secret in the error', async () => {
    for (const env of [{ SUPABASE_URL: ENV.SUPABASE_URL }, { ...ENV, SUPABASE_SECRET_KEYS: 'not json' }, { ...ENV, SUPABASE_SECRET_KEYS: '{"other":"x"}' }, { SUPABASE_SECRET_KEYS: ENV.SUPABASE_SECRET_KEYS }]) {
      const { createClient, log } = fakeCreateClient({ data: [], error: null });
      const err = await makeBusinessMarketLookup({ env: (k) => env[k], createClient })(USER_ID, new AbortController().signal).catch((e) => e);
      expect(err.code).toBe('not_configured');
      expect(log.clients).toHaveLength(0);
      expect(String(err.message)).not.toContain(SECRET);
    }
    expect(secretKeyFromEnv((k) => ENV[k])).toBe(SECRET);
  });

  it('database error / rejection / non-array data -> query_failed; the error never carries the key, the user id or the database message', async () => {
    for (const result of [{ data: null, error: { message: `permission denied for ${USER_ID} using ${SECRET}` } }, () => { throw new Error(`network ${SECRET}`); }, { data: { country: 'Local' }, error: null }, null]) {
      const { createClient } = fakeCreateClient(result);
      const err = await makeBusinessMarketLookup({ env: (k) => ENV[k], createClient })(USER_ID, new AbortController().signal).catch((e) => e);
      expect(err.code).toBe('query_failed');
      for (const s of [SECRET, USER_ID, 'permission denied', 'network']) expect(`${err.message} ${err.stack ?? ''}`).not.toContain(s);
    }
  });
});
