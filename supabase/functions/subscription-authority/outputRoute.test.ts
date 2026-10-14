// @vitest-environment node
// authorize_output: the route wrapper + the ADOPTED orchestrator + the real adapters, driven against an in-memory model of the
// SQL saga (prepare / finalize / mint / grant) and an in-memory Storage bucket. No network, no DB, no provider.
import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { authorizeOutputRoute, type OutputRouteDeps } from './outputRoute';
import { createQuoteOutputOrchestrator } from './authorizeOutput';
import { bucketSnapshotStorage, capabilityRpcs, freeIssuePhaseReader, marketInputsReader, rpcOutputSql, storageMediaAssetSource,
  storagePresentationSource, type BucketApi, type Rpc, type TableReader } from './adapters';

const U = '11111111-1111-4111-8111-111111111111';
const OTHER = '66666666-6666-4666-8666-666666666666';
const Q = '22222222-2222-4222-8222-222222222222';
const DIGEST = 'd'.repeat(64);
const sha = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');
const TOKEN_PATH = /^\/public-quote\/c\/([A-Za-z0-9_-]{43})$/;
const TOKEN_PATH_EN = /^\/en\/public-quote\/c\/([A-Za-z0-9_-]{43})$/;

function memoryBucket(): BucketApi & { objects: Map<string, Uint8Array> } {
  const objects = new Map<string, Uint8Array>();
  return {
    objects,
    upload: async (path, bytes, opts) => {
      if (objects.has(path) && !opts.upsert) return { error: { statusCode: '409', message: 'The resource already exists' } };
      objects.set(path, new Uint8Array(bytes)); return { error: null };
    },
    download: async (path) => {
      const b = objects.get(path);
      return b ? { data: { arrayBuffer: async () => b.slice().buffer }, error: null } : { data: null, error: { status: 404, message: 'Object not found' } };
    },
    remove: async (paths) => { for (const p of paths) objects.delete(p); return { error: null }; },
  };
}

function world(opts: { phase?: string; market?: string | null; country?: string | null } = {}) {
  const bucket = memoryBucket();
  const state = {
    phase: opts.phase ?? 'enforced', consumed: 0, attempts: new Map<string, Record<string, unknown>>(), finals: new Map<string, Record<string, unknown>>(),
    caps: [] as Record<string, unknown>[], grants: [] as Record<string, unknown>[], calls: [] as string[], mintFailOnce: false, seq: 0,
  };
  const final = (a: Record<string, unknown>, already: boolean) => ({ ok: true, state: 'finalized', attemptId: a.id, quoteId: Q, firstChannel: a.channel, consumed: true,
    accountMode: 'free_10', finalizedAt: '2026-10-07T10:00:00Z', ...(already ? { alreadyFinalized: true } : {}),
    descriptor: { path: a.path, sha256: a.sha, bytes: a.bytes, schemaVersion: 1, contentDigest: DIGEST, issuerDigest: 'e'.repeat(64), presentationDigest: a.pd } });
  const rpc: Rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    state.calls.push(fn);
    switch (fn) {
      case 'prepare_quote_output': {
        if (args.p_user_id !== U || args.p_quote_id !== Q) return { data: { ok: false, code: 'quote_not_found' }, error: null };
        const f = state.finals.get(Q);
        if (f) return { data: final(f, true), error: null };
        if (args.p_expected_digest !== DIGEST) return { data: { ok: false, code: 'quote_changed', contentDigest: DIGEST, internal: 'x' }, error: null };
        const id = `aaaaaaaa-0000-4000-8000-${String(++state.seq).padStart(12, '0')}`;
        const a = { id, channel: args.p_channel, key: args.p_idempotency_key, pd: args.p_presentation_digest, style: args.p_style, path: `issued-documents/${U}/${Q}/${id}.json` };
        state.attempts.set(id, a);
        return { data: { ok: true, state: 'preparing', attemptId: id, ownerId: U, quoteId: Q, customerBinding: 'c1', channel: a.channel, style: a.style,
          styleVersion: args.p_style_version, mediaCount: args.p_media_count, snapshotPath: a.path, contentDigest: DIGEST, currentDigest: DIGEST,
          issuerDigest: 'e'.repeat(64), currentIssuerDigest: 'e'.repeat(64), presentationDigest: a.pd, reservedAt: '2026-10-07T09:59:00Z',
          document: { documentProjection: 'quote-document/v1', quote: { id: Q } }, issuer: { issuerProjection: 'issuer/v1', business_name: 'B', logo_url: null } }, error: null };
      }
      case 'finalize_quote_output': {
        const a = state.attempts.get(args.p_attempt_id as string)!;
        Object.assign(a, { sha: args.p_sha256, bytes: args.p_bytes });
        state.consumed++; state.finals.set(Q, a);
        return { data: final(a, false), error: null };
      }
      case 'mint_public_capability':
        if (state.mintFailOnce) { state.mintFailOnce = false; return { data: null, error: { message: 'timeout' } }; }
        state.caps.push(args); return { data: { ok: true, capabilityId: '44444444-4444-4444-8444-444444444444' }, error: null };
      case 'issue_output_grant':
        state.grants.push(args); return { data: { ok: true, expiresAt: new Date(Date.parse('2026-10-07T10:00:00Z') + 300_000).toISOString() }, error: null };
      default: return { data: null, error: { message: `unexpected ${fn}` } };
    }
  }) as Rpc;
  const tables: TableReader = {
    one: async (table, _c, _col, value) => {
      if (table === 'subscription_activation') return state.phase === 'absent'
        ? { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.subscription_activation' in the schema cache" } }
        : { data: { phase: state.phase }, error: null };
      if (table === 'account_market') return { data: value === U && opts.market !== null ? { market: opts.market ?? 'IL' } : null, error: null };
      if (table === 'business_settings') return { data: { country: opts.country === undefined ? 'Local' : opts.country }, error: null };
      return { data: null, error: { message: 'unexpected table' } };
    },
  };
  const orchestrator = createQuoteOutputOrchestrator({ sql: rpcOutputSql(rpc), storage: bucketSnapshotStorage(bucket),
    presentation: storagePresentationSource(bucket), assets: storageMediaAssetSource(bucket) });
  const outputSpy = vi.fn(orchestrator.output);
  const caps = capabilityRpcs(rpc);
  const deps: OutputRouteDeps = { readFreeIssuePhase: freeIssuePhaseReader(tables), readMarketInputs: marketInputsReader(tables),
    orchestrator: { output: outputSpy }, mintCapability: caps.mintCapability, issueGrant: caps.issueGrant, now: () => Date.parse('2026-10-07T10:00:00Z') };
  return { deps, state, rpc, bucket, outputSpy };
}
const body = (channel: string, key = 'key-0001-abcdef', extra: Record<string, unknown> = {}) => ({ action: 'authorize_output', quoteId: Q, channel, idempotencyKey: key, expectedDigest: DIGEST, ...extra });

describe('authorize_output: request validation (no preview / draft channel)', () => {
  it.each(['preview', 'draft', 'whatsapp', '', null, 'SEND'])('channel %j -> 400 before any read', async (channel) => {
    const w = world();
    expect(await authorizeOutputRoute(w.deps, U, body(channel as string))).toEqual({ status: 400, body: { ok: false, code: 'invalid_request', field: 'channel' } });
    expect(w.state.calls).toEqual([]);
    expect(w.outputSpy).not.toHaveBeenCalled();
  });
  it('missing quote id / short key / bad digest -> 400; no user -> 401', async () => {
    const w = world();
    expect((await authorizeOutputRoute(w.deps, U, { ...body('send'), quoteId: 'x' })).body.field).toBe('quoteId');
    expect((await authorizeOutputRoute(w.deps, U, body('send', 'short'))).body.field).toBe('idempotencyKey');
    expect((await authorizeOutputRoute(w.deps, U, { ...body('send'), expectedDigest: 'z' })).body.field).toBe('expectedDigest');
    expect((await authorizeOutputRoute(w.deps, 'nope', body('send'))).status).toBe(401);
  });
});

describe('phase gate: not enforced -> not_activated with NO side effect', () => {
  it.each(['absent', 'prepared', 'shadow'])('%s', async (phase) => {
    const w = world({ phase });
    expect(await authorizeOutputRoute(w.deps, U, body('send'))).toEqual({ status: 409, body: { ok: false, code: 'not_activated' } });
    expect(w.outputSpy).not.toHaveBeenCalled();
    expect(w.state.calls).toEqual([]);
    expect(w.bucket.objects.size).toBe(0);
  });
});

describe('send / public_share: capability minted only after FINALIZED; language from the server market', () => {
  it('IL: Hebrew token path; sha256 of the token stored; the raw token appears only inside publicPath', async () => {
    const w = world();
    const r = await authorizeOutputRoute(w.deps, U, body('send'));
    expect(r.status).toBe(200);
    expect(Object.keys(r.body).sort()).toEqual(['attemptId', 'channel', 'consumed', 'ok', 'publicPath', 'quoteId']);
    const token = TOKEN_PATH.exec(r.body.publicPath as string)![1];
    expect(w.state.caps).toHaveLength(1);
    expect(w.state.caps[0]).toMatchObject({ p_user_id: U, p_attempt_id: r.body.attemptId, p_token_hash: sha(token), p_allowed_ops: ['view', 'approve'], p_expires_at: null });
    expect(JSON.stringify(w.state.caps)).not.toContain(token);
    expect(JSON.stringify(r.body).split(token).length - 1).toBe(1);
    expect(w.state.consumed).toBe(1);
    expect(w.state.calls.indexOf('mint_public_capability')).toBeGreaterThan(w.state.calls.indexOf('finalize_quote_output'));
    // the immutable snapshot exists at the SQL-derived path with the finalized hash
    const a = [...w.state.attempts.values()][0];
    expect(sha(w.bucket.objects.get(a.path as string)!)).toBe(a.sha);
  });
  it('INTERNATIONAL: English token path (market from account_market / business country, never from the body)', async () => {
    const w = world({ market: 'INTERNATIONAL', country: 'International' });
    const r = await authorizeOutputRoute(w.deps, U, body('public_share', 'key-0001-abcdef', { lang: 'he', market: 'IL', locale: 'he-IL' }));
    expect(r.body.publicPath).toMatch(TOKEN_PATH_EN);
  });
  it('unresolved / contradicting market -> 409 market_unresolved before any reservation', async () => {
    for (const w of [world({ market: null, country: null }), world({ market: 'IL', country: 'International' })]) {
      expect(await authorizeOutputRoute(w.deps, U, body('send'))).toEqual({ status: 409, body: { ok: false, code: 'market_unresolved' } });
      expect(w.state.calls).not.toContain('prepare_quote_output');
    }
  });
  it('a forged body user / plan is ignored: SQL receives the JWT user', async () => {
    const w = world();
    await authorizeOutputRoute(w.deps, U, body('send', 'key-0001-abcdef', { userId: OTHER, plan: 'visual', capabilities: ['x'] }));
    expect((w.rpc as unknown as { mock: { calls: [string, Record<string, unknown>][] } }).mock.calls.find((c) => c[0] === 'prepare_quote_output')![1].p_user_id).toBe(U);
  });
  it('retry with the same key after commit: same attempt, no second consumption, a fresh token for the same attempt', async () => {
    const w = world();
    const r1 = await authorizeOutputRoute(w.deps, U, body('send'));
    const r2 = await authorizeOutputRoute(w.deps, U, body('send'));
    expect(r2.body.attemptId).toBe(r1.body.attemptId);
    expect(r2.body.alreadyFinalized).toBe(true);
    expect(w.state.consumed).toBe(1);
    expect(r2.body.publicPath).not.toBe(r1.body.publicPath);
    expect(w.state.caps.map((c) => c.p_attempt_id)).toEqual([r1.body.attemptId, r1.body.attemptId]);
  });
  it('mint failure after commit -> 503 capability_unavailable; the retry reuses the durable artifact', async () => {
    const w = world(); w.state.mintFailOnce = true;
    const r1 = await authorizeOutputRoute(w.deps, U, body('send'));
    expect(r1).toEqual({ status: 503, body: { ok: false, code: 'capability_unavailable', attemptId: expect.any(String) } });
    const r2 = await authorizeOutputRoute(w.deps, U, body('send'));
    expect(r2.status).toBe(200);
    expect(w.state.consumed).toBe(1);
  });
});

describe('final_pdf / final_print: short-lived grant after FINALIZED', () => {
  it('grant (43 chars) + expiresAt capped at 120 s even if SQL says longer; hash stored, ttl 120', async () => {
    const w = world();
    const r = await authorizeOutputRoute(w.deps, U, body('final_pdf'));
    expect(r.status).toBe(200);
    expect(r.body.grant).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(r.body.expiresAt).toBe('2026-10-07T10:02:00.000Z');
    expect(w.state.grants[0]).toMatchObject({ p_channel: 'final_pdf', p_grant_hash: sha(r.body.grant as string), p_ttl_seconds: 120 });
    expect(Object.keys(r.body).sort()).toEqual(['attemptId', 'channel', 'consumed', 'expiresAt', 'grant', 'ok', 'quoteId']);
  });
  it('print after send reuses the same artifact (one consumption across channels)', async () => {
    const w = world();
    const s = await authorizeOutputRoute(w.deps, U, body('send', 'key-send-000001'));
    const p = await authorizeOutputRoute(w.deps, U, body('final_print', 'key-print-00001'));
    expect(p.body.attemptId).toBe(s.body.attemptId);
    expect(w.state.consumed).toBe(1);
  });
});

describe('failure bodies are rebuilt from an allowlist', () => {
  it('quote_changed passes through without SQL internals', async () => {
    const w = world();
    const r = await authorizeOutputRoute(w.deps, U, { ...body('send'), expectedDigest: 'f'.repeat(64) });
    expect(r).toEqual({ status: 409, body: { ok: false, code: 'quote_changed' } });
    expect(w.state.caps).toHaveLength(0);
  });
  it('an orchestrator body with unknown fields / odd codes is sanitized', async () => {
    const w = world();
    w.deps.orchestrator.output = async () => ({ status: 403, body: { ok: false, code: 'free_issue_limit_reached', freeIssues: { limit: 10, consumed: 10, reserved: 0, remaining: 0, secret: 'x' }, leak: 'y' } });
    expect(await authorizeOutputRoute(w.deps, U, body('send'))).toEqual({ status: 403, body: { ok: false, code: 'free_issue_limit_reached', freeIssues: { limit: 10, consumed: 10, reserved: 0, remaining: 0 } } });
    w.deps.orchestrator.output = async () => ({ status: 200, body: { ok: true, state: 'finalized', attemptId: 'x', quoteId: Q, consumed: true } });
    expect(await authorizeOutputRoute(w.deps, U, body('send'))).toEqual({ status: 503, body: { ok: false, code: 'final_response_invalid' } });
  });
  it('phase read error -> 503', async () => {
    const w = world();
    w.deps.readFreeIssuePhase = async () => 'error';
    expect((await authorizeOutputRoute(w.deps, U, body('send'))).status).toBe(503);
  });
});
