// Orchestrator contract tests (PREPARATION / NOT ACTIVATED, prep schema v3). The SQL side is an in-memory model of the saga
// CONTRACT (CLAUDE_NEXT_STEP_SPEC.md + CLAUDE_PREP_CLOSURE_SPEC.md): states, idempotency, reservations, bound digests, commit
// point. It proves the orchestrator's boundary handling (failure injection, retries, full byte verification, cleanup, reveal),
// NOT the prepared SQL itself (that is the disposable-DB suite's job).
import { describe, expect, it } from 'vitest';
import {
  createQuoteOutputOrchestrator, canonicalJson, sha256Hex, presentationDigest, hasLogo, CODE_STATUS, OUTPUT_CHANNELS,
  type OutputSql, type SnapshotStorage, type PresentationIntent, type MediaRef,
} from './authorizeQuoteOutput';

const U = '00000000-0000-4000-8000-0000000000a1';
const OTHER = '00000000-0000-4000-8000-0000000000b2';
const qid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const D = (c: string) => c.repeat(64);
const KEY = (n: number | string) => `key-${n}-xxxxxxxx`;
const enc = (s: string) => new TextEncoder().encode(s);

type Quote = { owner: string; client: string | null; digest: string; status: string; attachments: number };
type Attempt = { id: string; user: string; quote: string; channel: string; key: string; state: string; digest: string; binding: string;
  style: string; styleVersion: number; media: number; issuerDigest: string; presentationDigest: string; path: string; reservedAt: string;
  expired: boolean; failureCode?: string; sha?: string; bytes?: number; deleted?: boolean };

function makeWorld() {
  const objects = new Map<string, Uint8Array>();
  const sizeMeta = new Map<string, number>();
  const w = {
    phase: 'shadow' as 'prepared' | 'shadow' | 'enforced',
    ent: { mode: 'free_10', consumed: 0, limit: 10 } as null | { mode: string; consumed: number; limit: number },
    allowedStyles: ['classic'], mediaAllowed: false,
    issuer: { business_name: 'Synthetic Business', phone: '050-0000000' } as Record<string, string | null>,
    sqlLogoCheck: true,   // false = simulate a SQL layer that did not refuse a logo (to prove the orchestrator's own check)
    quotes: new Map<string, Quote>(), attempts: new Map<string, Attempt>(), finals: new Map<string, Attempt>(),
    objects, sizeMeta, assets: new Map<string, Uint8Array>(), seq: 0, calls: [] as string[],
    storageFail: { put: 0, get: 0 }, finalizeThrowOnce: false, finalizeCommitThenThrow: false, omitSizeMeta: false,
    corruptReadback: false, issuerDriftBeforeFinalize: false,
  };
  const issuerDigestReal = () => canonicalJson(w.issuer);
  const live = (exceptId?: string) => [...w.attempts.values()].filter((a) => a.user === U && a.state === 'preparing' && !a.expired && a.id !== exceptId).length;
  const finalResp = (a: Attempt) => ({ ok: true, state: 'finalized', attemptId: a.id, quoteId: a.quote, firstChannel: a.channel, consumed: true,
    accountMode: 'free_10', finalizedAt: '2026-10-07T08:05:00.123456+00:00', descriptor: { path: a.path, sha256: a.sha!, bytes: a.bytes!, schemaVersion: 1, contentDigest: a.digest,
      issuerDigest: a.issuerDigest, presentationDigest: a.presentationDigest } });
  const preparing = (a: Attempt, replay: boolean) => {
    const q = w.quotes.get(a.quote);
    return { ok: true, state: 'preparing', replay, attemptId: a.id, ownerId: a.user, quoteId: a.quote, customerBinding: a.binding,
      channel: a.channel, style: a.style, styleVersion: a.styleVersion, mediaCount: a.media, snapshotPath: a.path,
      contentDigest: a.digest, currentDigest: q ? q.digest : null, issuerDigest: a.issuerDigest, currentIssuerDigest: issuerKey(),
      presentationDigest: a.presentationDigest, reservedAt: a.reservedAt,
      document: { documentProjection: 'quote-document/v1', quote: { id: a.quote }, contentDigest: q ? q.digest : null }, // the model document is exactly what its digest covers
      issuer: { issuerProjection: 'issuer/v1', ...w.issuer } };
  };
  // the issuer digest the "SQL" binds: a stable key of the current issuer projection
  const digestCache = new Map<string, string>();
  const issuerKey = () => { const k = issuerDigestReal(); if (!digestCache.has(k)) digestCache.set(k, D(String.fromCharCode(97 + (digestCache.size % 6)))); return digestCache.get(k)!; };
  const sql: OutputSql = {
    async prepare(x) {
      w.calls.push('prepare');
      if (w.phase === 'prepared') return { ok: false, code: 'not_activated' };
      if (!w.ent) return { ok: false, code: 'account_not_provisioned' };
      const q = w.quotes.get(x.quoteId);
      const own = q && q.owner === x.userId ? q : undefined;
      const byKey = [...w.attempts.values()].find((a) => a.user === x.userId && a.key === x.idempotencyKey);
      if (byKey && (byKey.quote !== x.quoteId || byKey.channel !== x.channel)) return { ok: false, code: 'idempotency_key_reused' };
      const fin = w.finals.get(x.quoteId);
      if (fin) {
        if (!own) return { ...finalResp(fin), ok: false, code: 'document_unavailable' };
        if (fin.binding !== (own.client ?? 'none')) return { ok: false, code: 'customer_changed_new_quote_required' };
        return { ...finalResp(fin), alreadyFinalized: true };
      }
      if (!own) return { ok: false, code: 'quote_not_found' };
      if (byKey) return byKey.state === 'preparing' && !byKey.expired ? preparing(byKey, true) : { ok: false, code: `attempt_${byKey.expired ? 'expired' : byKey.state}` };
      const liveSame = [...w.attempts.values()].find((a) => a.quote === x.quoteId && a.state === 'preparing' && !a.expired);
      if (liveSame) return { ...preparing(liveSame, true), sameQuoteLiveAttempt: true };
      if (own.status !== 'draft') return { ok: false, code: 'legacy_issue_policy_pending' };
      if (!own.client) return { ok: false, code: 'customer_binding_missing' };
      if (own.digest !== x.expectedDigest) return { ok: false, code: 'quote_changed' };
      if (own.attachments > 0) return { ok: false, code: 'attachment_snapshot_policy_pending' };
      if (w.sqlLogoCheck && typeof w.issuer.logo_url === 'string' && w.issuer.logo_url.trim() !== '') return { ok: false, code: 'logo_snapshot_policy_pending' };
      if (!w.allowedStyles.includes(x.style)) return { ok: false, code: 'style_not_entitled' };
      if (x.mediaCount > 0 && !w.mediaAllowed) return { ok: false, code: 'media_not_entitled' };
      if (w.ent.mode === 'paid') return { ok: false, code: 'paid_quote_policy_pending' };
      if (w.ent.consumed + live() >= w.ent.limit) return { ok: false, code: 'free_issue_limit_reached', freeIssues: { limit: 10, consumed: w.ent.consumed, reserved: live(), remaining: 0 } };
      const id = `20000000-0000-4000-8000-${String(++w.seq).padStart(12, '0')}`;
      const a: Attempt = { id, user: x.userId, quote: x.quoteId, channel: x.channel, key: x.idempotencyKey, state: 'preparing', digest: own.digest,
        binding: own.client, style: x.style, styleVersion: x.styleVersion, media: x.mediaCount, issuerDigest: issuerKey(),
        presentationDigest: x.presentationDigest, path: `issued-documents/${x.userId}/${x.quoteId}/${id}.json`, reservedAt: '2026-10-07T08:00:00Z', expired: false };
      w.attempts.set(id, a);
      return preparing(a, false);
    },
    async finalize(x) {
      w.calls.push('finalize');
      if (w.finalizeThrowOnce) { w.finalizeThrowOnce = false; throw new Error('network'); }
      if (w.phase === 'prepared') return { ok: false, code: 'not_activated' };
      const a = w.attempts.get(x.attemptId);
      if (!a || a.user !== x.userId) return { ok: false, code: 'attempt_not_found' };
      if (a.state === 'finalized') return a.sha === x.sha256 ? finalResp(a) : { ok: false, code: 'snapshot_mismatch' };
      if (a.state !== 'preparing') return { ok: false, code: `attempt_${a.state}` };
      if (a.expired) { a.state = 'expired'; return { ok: false, code: 'attempt_expired' }; }
      if (x.snapshotPath !== a.path || x.schemaVersion !== 1) return { ok: false, code: 'snapshot_mismatch' };
      if (!w.objects.has(a.path)) return { ok: false, code: 'snapshot_missing' };
      if (!w.sizeMeta.has(a.path)) return { ok: false, code: 'snapshot_metadata_missing' };
      if (w.sizeMeta.get(a.path) !== x.bytes) return { ok: false, code: 'snapshot_mismatch' };
      if (w.issuerDriftBeforeFinalize) { w.issuer = { ...w.issuer, phone: '050-9999999' }; w.issuerDriftBeforeFinalize = false; }
      const q = w.quotes.get(a.quote);
      const abort = (code: string) => { a.state = 'aborted'; a.failureCode = code; return { ok: false, code }; };
      if (!q) return abort('quote_not_found');
      if ((q.client ?? 'none') !== a.binding) return abort('customer_changed_new_quote_required');
      if (q.digest !== a.digest) return abort('quote_changed');
      if (issuerKey() !== a.issuerDigest) return abort('issuer_changed');
      if (x.presentationDigest !== a.presentationDigest) return abort('presentation_changed');
      if (!w.allowedStyles.includes(a.style)) return abort('style_not_entitled');
      if (w.ent!.consumed + live(a.id) >= w.ent!.limit) return abort('free_issue_limit_reached');
      a.state = 'finalized'; a.sha = x.sha256; a.bytes = x.bytes; w.ent!.consumed += 1; w.finals.set(a.quote, a);
      if (a.channel === 'send') q.status = 'sent';
      if (w.finalizeCommitThenThrow) { w.finalizeCommitThenThrow = false; throw new Error('response lost after commit'); }
      return finalResp(a);
    },
    async abort(x) {
      w.calls.push('abort');
      const a = w.attempts.get(x.attemptId);
      if (!a || a.user !== x.userId) return { ok: false, code: 'attempt_not_found' };
      if (a.state !== 'preparing') return { ok: true, state: a.state, changed: false };
      a.state = a.expired ? 'expired' : 'aborted'; a.failureCode = x.failureCode;
      return { ok: true, state: a.state, changed: true };
    },
    async descriptor(x) {
      if (w.phase === 'prepared') return { ok: false, code: 'not_activated' };
      const f = w.finals.get(x.quoteId);
      return f ? finalResp(f) : { ok: false, code: 'not_finalized' };
    },
    async attemptState(x) {
      const a = w.attempts.get(x.attemptId);
      if (!a || a.user !== x.userId) return { ok: false, code: 'attempt_not_found' };
      return a.state === 'preparing' ? preparing(a, true) : { ok: false, code: `attempt_${a.state}` };
    },
    async listForReconcile() {
      return [...w.attempts.values()].filter((a) => a.state === 'preparing' || ((a.state === 'aborted' || a.state === 'expired') && !a.deleted))
        .map((a) => ({ attemptId: a.id, userId: a.user, quoteId: a.quote, state: a.state, failureCode: a.failureCode ?? null,
          contentDigest: a.digest, issuerDigest: a.issuerDigest, presentationDigest: a.presentationDigest, snapshotPath: a.path,
          pastTtl: a.state === 'preparing' && a.expired }));
    },
    async markSnapshotDeleted(x) {
      const a = w.attempts.get(x.attemptId);
      if (!a || a.state === 'finalized' || a.state === 'preparing') return { ok: false, code: 'snapshot_not_deletable' };
      a.deleted = true; return { ok: true };
    },
  };
  const storage: SnapshotStorage = {
    async put(path, bytes) {
      w.calls.push('put');
      if (w.storageFail.put > 0) { w.storageFail.put -= 1; throw new Error('storage 503'); }
      if (objects.has(path)) return 'exists';
      objects.set(path, bytes.slice());
      if (!w.omitSizeMeta) sizeMeta.set(path, bytes.byteLength);
      return 'created';
    },
    async get(path) {
      if (w.storageFail.get > 0) { w.storageFail.get -= 1; throw new Error('storage 503'); }
      const b = objects.get(path)?.slice() ?? null;
      if (b && w.corruptReadback) { w.corruptReadback = false; b[b.length - 2] ^= 1; }
      return b;
    },
    async remove(path) { w.calls.push('remove'); objects.delete(path); sizeMeta.delete(path); },
  };
  return { w, sql, storage };
}

async function mediaRef(w: ReturnType<typeof makeWorld>['w'], assetId: string, content: string): Promise<MediaRef> {
  const bytes = enc(content);
  w.assets.set(assetId, bytes);
  return { assetId, sha256: await sha256Hex(bytes), bytes: bytes.byteLength };
}

function setup(opts: { intent?: Partial<PresentationIntent> } = {}) {
  const { w, sql, storage } = makeWorld();
  const intent: PresentationIntent = { style: 'classic', styleVersion: 1, branding: { name: 'Synthetic' }, media: [], ...opts.intent };
  const incidents: unknown[] = [];
  const o = createQuoteOutputOrchestrator({ sql, storage, presentation: { load: async () => structuredClone(intent) },
    assets: { read: async (userId, assetId) => (userId === U ? w.assets.get(assetId)?.slice() ?? null : null) },
    onIncident: (i) => incidents.push(i) });
  const addQuote = (n: number, over: Partial<Quote> = {}) => { w.quotes.set(qid(n), { owner: U, client: `client-${n}`, digest: D('a'), status: 'draft', attachments: 0, ...over }); return qid(n); };
  const out = (n: number, channel = 'send', key: string | number = n, extra: Record<string, unknown> = {}) =>
    o.output({ userId: U }, { quoteId: qid(n), channel, idempotencyKey: KEY(key), expectedDigest: w.quotes.get(qid(n))?.digest ?? D('a'), ...extra });
  const attemptOf = (n: number) => [...w.attempts.values()].find((a) => a.quote === qid(n))!;
  return { w, o, intent, incidents, addQuote, out, attemptOf };
}

describe('happy path and the commit point', () => {
  it('prepare -> immutable snapshot -> finalize: one consumption, descriptor hash = stored bytes', async () => {
    const t = setup(); t.addQuote(1);
    const r = await t.out(1);
    expect(r.status).toBe(200);
    expect(r.body.state).toBe('finalized');
    expect(t.w.ent!.consumed).toBe(1);
    const d = r.body.descriptor as { path: string; sha256: string; bytes: number };
    const stored = t.w.objects.get(d.path)!;
    expect(await sha256Hex(stored)).toBe(d.sha256);
    expect(stored.byteLength).toBe(d.bytes);
    expect(d.path).toMatch(new RegExp(`^issued-documents/${U}/${qid(1)}/[0-9a-f-]{36}\\.json$`));
  });

  it('the snapshot binds owner, quote, customer, content digest, attempt, full document and presentation', async () => {
    const t = setup({ intent: { styleVersion: 3 } }); t.addQuote(2);
    const r = await t.out(2, 'final_pdf');
    const d = r.body.descriptor as { path: string };
    const snap = JSON.parse(new TextDecoder().decode(t.w.objects.get(d.path)!));
    const a = t.attemptOf(2);
    expect(snap).toMatchObject({ kind: 'tekango-issued-quote-document', schemaVersion: 1, ownerId: U, quoteId: qid(2), customerBinding: 'client-2',
      contentDigest: D('a'), issuerDigest: a.issuerDigest, presentationDigest: a.presentationDigest, attemptId: r.body.attemptId,
      document: { documentProjection: 'quote-document/v1' }, issuer: { issuerProjection: 'issuer/v1', business_name: 'Synthetic Business' },
      presentation: { presentationProjection: 'presentation/v1', style: 'classic', styleVersion: 3, branding: { name: 'Synthetic' }, media: [] } });
    expect(a.presentationDigest).toBe(await presentationDigest({ style: 'classic', styleVersion: 3, branding: { name: 'Synthetic' }, media: [] }));
  });

  it('only channel send changes the workflow status; the other channels finalize without it', async () => {
    const t = setup(); t.addQuote(3); t.addQuote(4);
    await t.out(3, 'public_share');
    await t.out(4, 'send');
    expect(t.w.quotes.get(qid(3))!.status).toBe('draft');
    expect(t.w.quotes.get(qid(4))!.status).toBe('sent');
    expect(t.w.ent!.consumed).toBe(2);
  });
});

describe('request authority: identity and rights come from the server', () => {
  it('a forged body (userId / plan / style / media) changes nothing: user from auth, style/media from the server intent', async () => {
    const t = setup(); t.addQuote(5);
    const r = await t.out(5, 'send', 5, { userId: OTHER, plan: 'visual', style: 'visual', media: [{ assetId: 'x' }], usagePackageId: 'large' });
    expect(r.status).toBe(200);
    const snap = JSON.parse(new TextDecoder().decode(t.w.objects.get((r.body.descriptor as { path: string }).path)!));
    expect(snap.ownerId).toBe(U);
    expect(snap.presentation.style).toBe('classic');
  });
  it('style above the server entitlement is refused before any write (no payload involved)', async () => {
    const t = setup({ intent: { style: 'visual' } }); t.addQuote(6);
    const r = await t.out(6);
    expect(r).toEqual({ status: 403, body: { ok: false, code: 'style_not_entitled' } });
    expect(t.w.calls).not.toContain('put');
    expect(t.w.ent!.consumed).toBe(0);
  });
  it('media above the server entitlement is refused', async () => {
    const t = setup(); t.addQuote(7);
    t.intent.media = [await mediaRef(t.w, 'a1', 'image-a1')];
    expect((await t.out(7)).body.code).toBe('media_not_entitled');
  });
  it('preview / draft are not output channels: rejected without touching SQL or Storage', async () => {
    const t = setup(); t.addQuote(8);
    for (const ch of ['preview', 'draft', 'print', '']) expect((await t.out(8, ch)).status).toBe(400);
    expect(t.w.calls).toEqual([]);
    expect(OUTPUT_CHANNELS).toEqual(['send', 'public_share', 'final_pdf', 'final_print']);
  });
  it('a missing / malformed authenticated user is 401 and nothing runs', async () => {
    const t = setup(); t.addQuote(9);
    expect((await t.o.output({ userId: 'not-a-uuid' }, { quoteId: qid(9), channel: 'send', idempotencyKey: KEY(9), expectedDigest: D('a') })).status).toBe(401);
    expect(t.w.calls).toEqual([]);
  });
});

describe('media manifest verified against owned server objects (closure)', () => {
  it('a media hash that does not match the owned object is refused before prepare (media_verification_failed)', async () => {
    const t = setup(); t.addQuote(60); t.w.mediaAllowed = true;
    const ref = await mediaRef(t.w, 'img-1', 'real-bytes');
    t.intent.media = [{ ...ref, sha256: D('f') }];                     // the presentation source claims a wrong hash
    expect((await t.out(60)).body).toEqual({ ok: false, code: 'media_verification_failed', assetId: 'img-1' });
    expect(t.w.calls).toEqual([]);
  });
  it('a media object that is missing, foreign or has another size is refused', async () => {
    const t = setup(); t.addQuote(61); t.w.mediaAllowed = true;
    t.intent.media = [{ assetId: 'missing', sha256: D('e'), bytes: 10 }];
    expect((await t.out(61)).body.code).toBe('media_verification_failed');
    const ref = await mediaRef(t.w, 'img-2', 'twelve-bytes');
    t.intent.media = [{ ...ref, bytes: ref.bytes + 1 }];
    expect((await t.out(61)).body.code).toBe('media_verification_failed');
    expect(t.w.ent!.consumed).toBe(0);
  });
});

describe('fail-closed activation and policy', () => {
  it('phase prepared: not_activated, no reservation, no ledger', async () => {
    const t = setup(); t.w.phase = 'prepared'; t.addQuote(10);
    expect((await t.out(10)).body.code).toBe('not_activated');
    expect(t.w.attempts.size).toBe(0);
  });
  it('unprovisioned account: account_not_provisioned (never an unchanged bypass)', async () => {
    const t = setup(); t.w.ent = null; t.addQuote(11);
    expect(await t.out(11)).toEqual({ status: 409, body: { ok: false, code: 'account_not_provisioned' } });
  });
  it('paid account: paid_quote_policy_pending (no implicit unlimited)', async () => {
    const t = setup(); t.w.ent = { mode: 'paid', consumed: 0, limit: 10 }; t.addQuote(12);
    expect(await t.out(12)).toEqual({ status: 403, body: { ok: false, code: 'paid_quote_policy_pending' } });
  });
  it('a quote with attachments fails closed: attachment_snapshot_policy_pending, nothing reserved', async () => {
    const t = setup(); t.addQuote(14, { attachments: 1 });
    expect(await t.out(14)).toEqual({ status: 409, body: { ok: false, code: 'attachment_snapshot_policy_pending' } });
    expect(t.w.attempts.size).toBe(0);
  });
  it('unknown SQL codes / malformed answers fail closed as 503', async () => {
    const t = setup(); t.addQuote(13);
    const base = makeWorld();
    const o = createQuoteOutputOrchestrator({ sql: { ...base.sql, prepare: async () => ({ ok: true, state: 'weird' }) }, storage: base.storage,
      presentation: { load: async () => t.intent }, assets: { read: async () => null } });
    expect((await o.output({ userId: U }, { quoteId: qid(13), channel: 'send', idempotencyKey: KEY(13), expectedDigest: D('a') })).status).toBe(503);
    expect(CODE_STATUS.free_issue_limit_reached).toBe(403);
  });
});

describe('Free-10 quota with reservations', () => {
  it('quotes 1..10 finalize, the 11th is refused with nothing written', async () => {
    const t = setup();
    for (let n = 1; n <= 10; n++) { t.addQuote(n); expect((await t.out(n, OUTPUT_CHANNELS[n % 4])).status).toBe(200); }
    t.addQuote(11);
    const r = await t.out(11);
    expect(r.body.code).toBe('free_issue_limit_reached');
    expect(t.w.ent!.consumed).toBe(10);
    expect([...t.w.attempts.values()].filter((a) => a.quote === qid(11))).toHaveLength(0);
  });
  it('a live reservation counts: at 9 consumed with one live reservation, another quote is refused', async () => {
    const t = setup(); t.w.ent!.consumed = 9; t.addQuote(20); t.addQuote(21);
    t.w.storageFail.put = 2;                                   // quote 20 stays PREPARING (write failed twice)
    expect((await t.out(20)).body.code).toBe('storage_unavailable');
    expect((await t.out(21)).body.code).toBe('free_issue_limit_reached');
  });
});

describe('failure matrix (Storage / network boundaries)', () => {
  it('Storage write fails then the same key retries: same attempt, one object, one consumption', async () => {
    const t = setup(); t.addQuote(30);
    t.w.storageFail.put = 2;
    expect((await t.out(30)).body.code).toBe('storage_unavailable');
    expect(t.w.ent!.consumed).toBe(0);
    const r = await t.out(30);
    expect(r.status).toBe(200);
    expect(t.w.attempts.size).toBe(1);
    expect(t.w.ent!.consumed).toBe(1);
  });
  it('object written, finalize never reached (network): same key retry finalizes the same object', async () => {
    const t = setup(); t.addQuote(31);
    t.w.finalizeThrowOnce = true;
    expect((await t.out(31)).body.code).toBe('finalize_outcome_unknown');
    expect(t.w.objects.size).toBe(1);
    const r = await t.out(31);
    expect(r.status).toBe(200);
    expect(t.w.objects.size).toBe(1);
    expect(t.w.ent!.consumed).toBe(1);
  });
  it('finalize committed but the response was lost: the retry returns the durable final, no second consumption', async () => {
    const t = setup(); t.addQuote(32);
    t.w.finalizeCommitThenThrow = true;
    expect((await t.out(32)).status).toBe(503);
    const r = await t.out(32);
    expect(r.status).toBe(200);
    expect(r.body.state).toBe('finalized');
    expect(t.w.ent!.consumed).toBe(1);
  });
  it('a foreign object already at the derived path is never trusted: snapshot_conflict, attempt aborted, object kept', async () => {
    const t = setup(); t.addQuote(33);
    const nextPath = `issued-documents/${U}/${qid(33)}/20000000-0000-4000-8000-000000000001.json`;
    t.w.objects.set(nextPath, enc('{"kind":"evil"}'));
    const r = await t.out(33);
    expect(r.body.code).toBe('snapshot_conflict');
    expect(t.w.ent!.consumed).toBe(0);
    expect(t.w.objects.has(nextPath)).toBe(true);
  });
  it('an existing object with the CORRECT header but different document/issuer/media is snapshot_conflict, not consumed, kept (closure)', async () => {
    const t = setup(); t.addQuote(34);
    t.w.finalizeThrowOnce = true;
    await t.out(34);                                           // PREPARING + the genuine object
    const a = t.attemptOf(34);
    const genuine = JSON.parse(new TextDecoder().decode(t.w.objects.get(a.path)!));
    const forged = enc(canonicalJson({ ...genuine, document: { ...genuine.document, quote: { id: qid(34), total: 1 } } }));
    t.w.objects.set(a.path, forged);                           // same attempt/owner/quote/digests in the header, other content
    const r = await t.out(34);
    expect(r.body.code).toBe('snapshot_conflict');
    expect(t.w.ent!.consumed).toBe(0);
    expect(t.w.objects.get(a.path)).toEqual(forged);           // unknown provenance: never deleted
    expect(a.state).toBe('aborted');
  });
  it('content changed between prepare and finalize: quote_changed, no consumption, orphan removed', async () => {
    const t = setup(); t.addQuote(35);
    t.w.finalizeThrowOnce = true;
    await t.out(35);
    t.w.quotes.get(qid(35))!.digest = D('b');
    const r = await t.o.output({ userId: U }, { quoteId: qid(35), channel: 'send', idempotencyKey: KEY(35), expectedDigest: D('a') });
    expect(r.body.code).toBe('quote_changed');
    expect(t.w.ent!.consumed).toBe(0);
    expect(t.w.objects.size).toBe(0);
    expect(t.attemptOf(35).state).toBe('aborted');
  });
  it('customer changed between prepare and finalize: customer_changed_new_quote_required, orphan removed', async () => {
    const t = setup(); t.addQuote(36);
    t.w.storageFail.get = 1;                                   // read-back fails once -> stays PREPARING with the object
    expect((await t.out(36)).body.code).toBe('storage_unavailable');
    t.w.quotes.get(qid(36))!.client = 'client-other';
    const r = await t.out(36);
    expect(r.body.code).toBe('customer_changed_new_quote_required');
    expect(t.w.ent!.consumed).toBe(0);
    expect(t.w.objects.size).toBe(0);
  });
  it('presentation changed under a live reservation: presentation_changed, aborted, orphan removed', async () => {
    const t = setup(); t.addQuote(37);
    t.w.finalizeThrowOnce = true;
    await t.out(37);
    t.w.allowedStyles.push('modern');
    t.intent.style = 'modern';
    const r = await t.out(37);
    expect(r.body.code).toBe('presentation_changed');
    expect(t.w.objects.size).toBe(0);
  });
  it('same-count media swap A -> B on retry: presentation_changed, aborted, own orphan removed, no consumption (closure)', async () => {
    const t = setup(); t.addQuote(38); t.w.mediaAllowed = true;
    t.intent.media = [await mediaRef(t.w, 'img-A', 'bytes-of-A')];
    t.w.finalizeThrowOnce = true;
    await t.out(38);
    t.intent.media = [await mediaRef(t.w, 'img-B', 'bytes-of-B')];   // same style, same count
    const r = await t.out(38);
    expect(r.body.code).toBe('presentation_changed');
    expect(t.attemptOf(38).state).toBe('aborted');
    expect(t.w.objects.size).toBe(0);
    expect(t.w.ent!.consumed).toBe(0);
  });
  it('branding-only change on retry is presentation_changed (closure)', async () => {
    const t = setup(); t.addQuote(39);
    t.w.finalizeThrowOnce = true;
    await t.out(39);
    t.intent.branding = { name: 'Synthetic', color: '#000000' };
    expect((await t.out(39)).body.code).toBe('presentation_changed');
    expect(t.w.ent!.consumed).toBe(0);
  });
  it('styleVersion-only change on retry is presentation_changed (closure)', async () => {
    const t = setup(); t.addQuote(40);
    t.w.finalizeThrowOnce = true;
    await t.out(40);
    t.intent.styleVersion = 2;
    expect((await t.out(40)).body.code).toBe('presentation_changed');
    expect(t.w.ent!.consumed).toBe(0);
  });
  it('issuer drift between prepare and retry: issuer_changed, aborted, own orphan removed, no consumption (closure)', async () => {
    const t = setup(); t.addQuote(41);
    t.w.finalizeThrowOnce = true;
    await t.out(41);
    t.w.issuer = { ...t.w.issuer, business_name: 'Renamed Business' };
    const r = await t.out(41);
    expect(r.body.code).toBe('issuer_changed');
    expect(t.attemptOf(41).state).toBe('aborted');
    expect(t.w.objects.size).toBe(0);
    expect(t.w.ent!.consumed).toBe(0);
  });
  it('issuer drift that lands after the orchestrator check is refused by finalize (SQL re-check): issuer_changed, cleanup (closure)', async () => {
    const t = setup(); t.addQuote(42);
    t.w.issuerDriftBeforeFinalize = true;
    const r = await t.out(42);
    expect(r.body.code).toBe('issuer_changed');
    expect(t.w.objects.size).toBe(0);
    expect(t.w.ent!.consumed).toBe(0);
  });
  it('Storage size metadata missing: snapshot_metadata_missing (fail closed), attempt stays PREPARING, no consumption (closure)', async () => {
    const t = setup(); t.addQuote(43);
    t.w.omitSizeMeta = true;
    expect(await t.out(43)).toEqual({ status: 503, body: { ok: false, code: 'snapshot_metadata_missing' } });
    expect(t.attemptOf(43).state).toBe('preparing');
    expect(t.w.ent!.consumed).toBe(0);
  });
  it('a read-back that differs from the written bytes never finalizes (closure)', async () => {
    const t = setup(); t.addQuote(44);
    t.w.corruptReadback = true;
    expect((await t.out(44)).body.code).toBe('snapshot_readback_mismatch');
    expect(t.w.calls).not.toContain('finalize');
    expect(t.w.ent!.consumed).toBe(0);
  });
});

describe('reuse, duplicate, deletion and reveal', () => {
  it('reuse of an output quote for the same customer: durable final, no second consumption, any channel', async () => {
    const t = setup(); t.addQuote(50);
    await t.out(50, 'send');
    for (const ch of OUTPUT_CHANNELS) expect((await t.out(50, ch, `${ch}-again`)).status).toBe(200);
    expect(t.w.ent!.consumed).toBe(1);
  });
  it('the same key for another quote is idempotency_key_reused', async () => {
    const t = setup(); t.addQuote(51); t.addQuote(52);
    await t.out(51, 'send', 'shared');
    expect((await t.out(52, 'send', 'shared')).body.code).toBe('idempotency_key_reused');
  });
  it('a duplicate (new quote identity) consumes at its own first output', async () => {
    const t = setup(); t.addQuote(53); await t.out(53);
    t.addQuote(54); await t.out(54);
    expect(t.w.ent!.consumed).toBe(2);
  });
  it('quote deleted after final: no refund, no regenerated document - document_unavailable metadata', async () => {
    const t = setup(); t.addQuote(55); await t.out(55);
    t.w.quotes.delete(qid(55));
    const r = await t.out(55, 'send', 55);
    expect(r).toEqual({ status: 410, body: { ok: false, code: 'document_unavailable' } });
    expect(t.w.ent!.consumed).toBe(1);
  });
  it('deletion semantics: re-issue/regeneration after deletion is refused, while the RETAINED finalized artifact stays revealable (closure)', async () => {
    const t = setup(); t.addQuote(56); await t.out(56);
    t.w.quotes.delete(qid(56));
    expect((await t.out(56, 'final_pdf', 'reissue')).body.code).toBe('document_unavailable');   // no new output path
    const rev = await t.o.reveal(qid(56));                                                    // the stored artifact is not regenerated,
    expect(rev.status).toBe(200);                                                             // it is served as finalized while retained
    const path = (rev.body.descriptor as { path: string }).path;
    t.w.objects.delete(path);                                                                 // artifact gone -> fail closed
    expect((await t.o.reveal(qid(56))).body.code).toBe('document_unavailable');
    expect(t.w.ent!.consumed).toBe(1);
  });
  it('reveal: a Draft without finalize is refused (public link / PDF / Print cannot open it)', async () => {
    const t = setup(); t.addQuote(57);
    expect((await t.o.reveal(qid(57))).body.code).toBe('not_finalized');
    expect(t.w.calls).toEqual([]);
  });
  it('reveal: an orphan object at the prefix is never served without a FINALIZED descriptor', async () => {
    const t = setup(); t.addQuote(58);
    t.w.objects.set(`issued-documents/${U}/${qid(58)}/orphan.json`, enc('{}'));
    expect((await t.o.reveal(qid(58))).status).toBe(404);
  });
  it('reveal: FINALIZED with a missing or tampered object is document_unavailable + incident, never regenerated', async () => {
    const t = setup(); t.addQuote(59);
    const r = await t.out(59);
    const path = (r.body.descriptor as { path: string }).path;
    t.w.objects.set(path, enc('tampered'));
    expect((await t.o.reveal(qid(59))).status).toBe(410);
    t.w.objects.delete(path);
    expect((await t.o.reveal(qid(59))).body.code).toBe('document_unavailable');
    expect(t.incidents).toHaveLength(2);
    expect(t.w.ent!.consumed).toBe(1);
  });
  it('reveal never prepares, writes or consumes', async () => {
    const t = setup(); t.addQuote(62); await t.out(62);
    const before = [...t.w.calls];
    expect((await t.o.reveal(qid(62))).status).toBe(200);
    expect(t.w.calls).toEqual(before);
  });
});

describe('reconciler (idempotent, SQL-state driven)', () => {
  it('finalizes a live attempt whose bound object exists; expires a past-TTL one and deletes its orphan; second run is a no-op', async () => {
    const t = setup(); t.addQuote(70); t.addQuote(71);
    t.w.finalizeThrowOnce = true; await t.out(70);
    t.w.finalizeThrowOnce = true; await t.out(71);
    const late = t.attemptOf(71); late.expired = true;
    const r1 = await t.o.reconcile({ minAgeSeconds: 0, limit: 100 });
    expect(r1.log.map((l) => l.action).sort()).toEqual(['expired', 'finalized']);
    expect(t.w.ent!.consumed).toBe(1);
    expect(t.w.objects.has(late.path)).toBe(false);
    const r2 = await t.o.reconcile({ minAgeSeconds: 0, limit: 100 });
    expect(r2.log).toEqual([]);
  });
  it('never finalizes an object that does not bind the attempt', async () => {
    const t = setup(); t.addQuote(72);
    t.w.finalizeThrowOnce = true; await t.out(72);
    const a = t.attemptOf(72);
    t.w.objects.set(a.path, enc(canonicalJson({ kind: 'tekango-issued-quote-document', schemaVersion: 1, attemptId: 'other', ownerId: U, quoteId: qid(72) })));
    const r = await t.o.reconcile({ minAgeSeconds: 0, limit: 100 });
    expect(r.log).toEqual([{ attemptId: a.id, action: 'skip_object_not_expected_bytes' }]);
    expect(t.w.ent!.consumed).toBe(0);
  });
  it('uses the FULL verifier: a correct header with a wrong body/digest is not finalized and not deleted (closure)', async () => {
    const t = setup(); t.addQuote(73);
    t.w.finalizeThrowOnce = true; await t.out(73);
    const a = t.attemptOf(73);
    const genuine = JSON.parse(new TextDecoder().decode(t.w.objects.get(a.path)!));
    const forged = enc(canonicalJson({ ...genuine, issuer: { ...genuine.issuer, phone: '000' } }));
    t.w.objects.set(a.path, forged);
    const r = await t.o.reconcile({ minAgeSeconds: 0, limit: 100 });
    expect(r.log).toEqual([{ attemptId: a.id, action: 'skip_object_not_expected_bytes' }]);
    expect(t.w.ent!.consumed).toBe(0);
    expect(t.w.objects.get(a.path)).toEqual(forged);
  });
  it('drift under a live reservation is never finalized by the reconciler (closure)', async () => {
    const t = setup(); t.addQuote(74);
    t.w.finalizeThrowOnce = true; await t.out(74);
    t.intent.branding = { name: 'Changed' };
    const r = await t.o.reconcile({ minAgeSeconds: 0, limit: 100 });
    expect(r.log).toEqual([{ attemptId: t.attemptOf(74).id, action: 'skip_drift', code: 'presentation_changed' }]);
    expect(t.w.ent!.consumed).toBe(0);
  });
  it('an object of a snapshot_conflict attempt (unknown provenance) is never deleted by cleanup (closure)', async () => {
    const t = setup(); t.addQuote(75);
    const p = `issued-documents/${U}/${qid(75)}/20000000-0000-4000-8000-000000000001.json`;
    t.w.objects.set(p, enc('{"kind":"evil"}'));
    expect((await t.out(75)).body.code).toBe('snapshot_conflict');
    const r = await t.o.reconcile({ minAgeSeconds: 0, limit: 100 });
    expect(r.log).toEqual([{ attemptId: t.attemptOf(75).id, action: 'kept_conflict_object_unknown_provenance' }]);
    expect(t.w.objects.has(p)).toBe(true);
  });
});


describe('logo: mutable external URL fails closed (CODEX_PREP_CLOSURE_REVIEW 10.1)', () => {
  const nothingChanged = (t: ReturnType<typeof setup>, n: number) => {
    expect(t.w.attempts.size).toBe(0);
    expect(t.w.objects.size).toBe(0);
    expect(t.w.finals.size).toBe(0);
    expect(t.w.ent!.consumed).toBe(0);
    expect(t.w.quotes.get(qid(n))!.status).toBe('draft');
    expect(t.w.calls).not.toContain('put');
    expect(t.w.calls).not.toContain('finalize');
  };
  it('[AC1+AC2] an issuer with a logo_url: logo_snapshot_policy_pending (409) before any attempt, snapshot, ledger or consumption', async () => {
    const t = setup(); t.addQuote(80); t.w.issuer.logo_url = 'https://cdn.example.test/logo.png';
    expect(await t.out(80)).toEqual({ status: 409, body: { ok: false, code: 'logo_snapshot_policy_pending' } });
    expect(CODE_STATUS.logo_snapshot_policy_pending).toBe(409);
    nothingChanged(t, 80);
  });
  it('[AC3+AC6] same URL serving bytes A then bytes B: both attempts blocked, the URL is never fetched, nothing is ever finalized', async () => {
    const t = setup(); t.addQuote(81); t.w.issuer.logo_url = 'https://cdn.example.test/same-logo.png';
    const served = [enc('LOGO-BYTES-A'), enc('LOGO-BYTES-B')];
    let fetches = 0;
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => { const b = served[Math.min(fetches, 1)]; fetches += 1; return new Response(b); }) as typeof fetch;
    try {
      const first = await t.out(81, 'send', 'logo-a');          // the URL would serve bytes A
      const second = await t.out(81, 'final_pdf', 'logo-b');    // ...and bytes B on the next read
      expect(first.body.code).toBe('logo_snapshot_policy_pending');
      expect(second.body.code).toBe('logo_snapshot_policy_pending');
      expect([first.body.state, second.body.state]).not.toContain('finalized');
    } finally { globalThis.fetch = realFetch; }
    expect(fetches).toBe(0);                                   // fail-closed proof, not a byte-binding proof: nothing is read
    nothingChanged(t, 81);
    expect((await t.o.reveal(qid(81))).body.code).toBe('not_finalized');
  });
  it('[AC5] no logo (absent, null, empty or whitespace-only) keeps the normal path: finalized, one consumption', async () => {
    for (const [i, logo] of [[0, undefined], [1, null], [2, ''], [3, '   ']] as const) {
      const t = setup(); t.addQuote(82 + i);
      if (logo !== undefined) t.w.issuer.logo_url = logo;
      const r = await t.out(82 + i);
      expect(r.status).toBe(200);
      expect(r.body.state).toBe('finalized');
      expect(t.w.ent!.consumed).toBe(1);
    }
    expect(hasLogo({ logo_url: null })).toBe(false);
    expect(hasLogo({ logo_url: '  ' })).toBe(false);
    expect(hasLogo({ logo_url: 'https://x' })).toBe(true);
  });
  it('[AC4] a logo added after prepare changes the issuer digest: issuer_changed, aborted, only the proven own orphan removed', async () => {
    const t = setup(); t.addQuote(86);
    t.w.finalizeThrowOnce = true;
    await t.out(86);                                           // PREPARING + own object (issuer without logo)
    const a = t.attemptOf(86);
    t.w.objects.set('issued-documents/unrelated/object.json', enc('{"kind":"other"}'));
    t.w.issuer.logo_url = 'https://cdn.example.test/new-logo.png';
    const r = await t.out(86);
    expect(r.body.code).toBe('issuer_changed');
    expect(a.state).toBe('aborted');
    expect(t.w.objects.has(a.path)).toBe(false);
    expect(t.w.objects.has('issued-documents/unrelated/object.json')).toBe(true);
    expect(t.w.ent!.consumed).toBe(0);
  });
  it('[defence in depth] even if the SQL layer did not refuse it, the orchestrator never snapshots an issuer with a logo', async () => {
    const t = setup(); t.addQuote(87); t.w.sqlLogoCheck = false; t.w.issuer.logo_url = 'https://cdn.example.test/logo.png';
    const r = await t.out(87);
    expect(r.body.code).toBe('logo_snapshot_policy_pending');
    expect(t.attemptOf(87).state).toBe('aborted');
    expect(t.w.calls).not.toContain('put');
    expect(t.w.ent!.consumed).toBe(0);
  });
});

describe('v1 handler partitions carried into the orchestrator (CODEX_PREP_CLOSURE_REVIEW 10.2)', () => {
  const QUOTE = qid(90);
  const okBody = { quoteId: QUOTE, channel: 'send', idempotencyKey: KEY(90), expectedDigest: D('a') };
  it('output channels are exactly the four and frozen', () => {
    expect([...OUTPUT_CHANNELS]).toEqual(['send', 'public_share', 'final_pdf', 'final_print']);
    expect(Object.isFrozen(OUTPUT_CHANNELS)).toBe(true);
  });
  it.each(['preview', 'draft', 'save', 'view', 'SEND', 'print', 'pdf', '', null, undefined, 1, ['send'], { channel: 'send' }])(
    'channel %p is rejected with 400 and neither SQL nor Storage is called', async (channel) => {
      const t = setup(); t.addQuote(90);
      expect(await t.o.output({ userId: U }, { ...okBody, channel })).toEqual({ status: 400, body: { ok: false, code: 'invalid_request', field: 'channel' } });
      expect(t.w.calls).toEqual([]);
    });
  it.each([
    ['quoteId', { ...okBody, quoteId: 'not-a-uuid' }],
    ['quoteId', { ...okBody, quoteId: `${QUOTE}' OR 1=1 --` }],
    ['quoteId', { channel: 'send', idempotencyKey: KEY(90), expectedDigest: D('a') }],
    ['quoteId', { ...okBody, quoteId: 'abcdef00-0000-4000-8000-0000000000ab'.toUpperCase() }],  // v2: lowercase canonical form only (v1 lower-cased)
    ['idempotencyKey', { ...okBody, idempotencyKey: 'short' }],
    ['idempotencyKey', { ...okBody, idempotencyKey: 'k'.repeat(201) }],
    ['idempotencyKey', { ...okBody, idempotencyKey: 12345678 }],
    ['expectedDigest', { ...okBody, expectedDigest: 'abc' }],
    ['expectedDigest', { ...okBody, expectedDigest: D('A') }],
    ['expectedDigest', { quoteId: QUOTE, channel: 'send', idempotencyKey: KEY(90) }],
    ['body', null],
    ['body', 'quoteId=x'],
    ['body', [QUOTE, 'send', KEY(90)]],
  ])('invalid %s -> 400 with that field, nothing called', async (field, body) => {
    const t = setup(); t.addQuote(90);
    expect(await t.o.output({ userId: U }, body)).toEqual({ status: 400, body: { ok: false, code: 'invalid_request', field } });
    expect(t.w.calls).toEqual([]);
  });
  it('prepare receives only server-derived arguments: the user from auth, presentation from the server source, never body fields', async () => {
    const seen: Record<string, unknown>[] = [];
    const base = makeWorld();
    base.w.quotes.set(QUOTE, { owner: U, client: 'client-90', digest: D('a'), status: 'draft', attachments: 0 });
    const sql = { ...base.sql, prepare: async (x: Parameters<typeof base.sql.prepare>[0]) => { seen.push({ ...x }); return base.sql.prepare(x); } };
    const intent: PresentationIntent = { style: 'classic', styleVersion: 2, branding: { name: 'S' }, media: [] };
    const o = createQuoteOutputOrchestrator({ sql, storage: base.storage, presentation: { load: async () => structuredClone(intent) }, assets: { read: async () => null } });
    await o.output({ userId: U }, { ...okBody, userId: OTHER, plan: 'visual', style: 'visual', styleVersion: 9, presentationDigest: D('9'), mediaCount: 7, accountMode: 'paid' });
    expect(seen).toEqual([{ userId: U, quoteId: QUOTE, channel: 'send', idempotencyKey: KEY(90), expectedDigest: D('a'), style: 'classic',
      mediaCount: 0, styleVersion: 2, presentationDigest: await presentationDigest(intent) }]);
  });
  it.each(Object.entries({
    not_activated: 409, account_not_provisioned: 409, quote_not_found: 404, idempotency_key_reused: 409,
    customer_changed_new_quote_required: 409, customer_binding_missing: 409, legacy_issue_policy_pending: 409,
    attachment_snapshot_policy_pending: 409, logo_snapshot_policy_pending: 409, issuer_missing: 409, quote_changed: 409,
    style_not_entitled: 403, media_not_entitled: 403, paid_quote_policy_pending: 403, free_issue_limit_reached: 403,
    attempt_aborted: 409, attempt_expired: 409, document_unavailable: 410,
  }))('SQL prepare code %s -> HTTP %i with a minimal body', async (code, status) => {
    const base = makeWorld();
    const o = createQuoteOutputOrchestrator({ sql: { ...base.sql, prepare: async () => ({ ok: false, code, internal: 'secret' }) }, storage: base.storage,
      presentation: { load: async () => ({ style: 'classic', styleVersion: 1, branding: null, media: [] }) }, assets: { read: async () => null } });
    expect(await o.output({ userId: U }, okBody)).toEqual({ status, body: { ok: false, code } });
    expect(CODE_STATUS[code]).toBe(status);
  });
  it('limit reached carries the server balance', async () => {
    const base = makeWorld();
    const freeIssues = { limit: 10, consumed: 9, reserved: 1, remaining: 0 };
    const o = createQuoteOutputOrchestrator({ sql: { ...base.sql, prepare: async () => ({ ok: false, code: 'free_issue_limit_reached', freeIssues }) },
      storage: base.storage, presentation: { load: async () => ({ style: 'classic', styleVersion: 1, branding: null, media: [] }) }, assets: { read: async () => null } });
    expect(await o.output({ userId: U }, okBody)).toEqual({ status: 403, body: { ok: false, code: 'free_issue_limit_reached', freeIssues } });
  });
  it.each([
    ['prepare throws', async () => { throw new Error('network'); }],
    ['prepare returns null', async () => null],
    ['unknown code', async () => ({ ok: false, code: 'something_new' })],
    ['prototype-name code', async () => ({ ok: false, code: 'toString' })],
    ['ok is not boolean true', async () => ({ ok: 'true', state: 'preparing' })],
    ['unknown state', async () => ({ ok: true, state: 'weird' })],
    ['preparing with a foreign path', async () => ({ ok: true, state: 'preparing', attemptId: '20000000-0000-4000-8000-000000000001', ownerId: U, quoteId: QUOTE,
      customerBinding: 'c', channel: 'send', style: 'classic', styleVersion: 1, mediaCount: 0, snapshotPath: 'public/x.json', contentDigest: D('a'),
      currentDigest: D('a'), issuerDigest: D('b'), currentIssuerDigest: D('b'), presentationDigest: D('c'), reservedAt: 'x' })],
  ])('%s -> 503 fail closed, nothing written', async (_label, prepare) => {
    const base = makeWorld();
    const o = createQuoteOutputOrchestrator({ sql: { ...base.sql, prepare: prepare as never }, storage: base.storage,
      presentation: { load: async () => ({ style: 'classic', styleVersion: 1, branding: null, media: [] }) }, assets: { read: async () => null } });
    const r = await o.output({ userId: U }, okBody);
    expect(r.status).toBe(503);
    expect(base.w.calls).not.toContain('put');
    expect(base.w.objects.size).toBe(0);
  });
});


describe('success response: one parser + allowlist on every success path (CODEX_PREP_LOGO_FINAL_REVIEW 7)', () => {
  type Over = { finalize?: OutputSql['finalize']; prepare?: OutputSql['prepare']; descriptor?: OutputSql['descriptor'] };
  function world(over: (base: ReturnType<typeof makeWorld>) => Over = () => ({})) {
    const base = makeWorld();
    const sql: OutputSql = { ...base.sql, ...over(base) };
    const intent: PresentationIntent = { style: 'classic', styleVersion: 1, branding: { name: 'Synthetic' }, media: [] };
    const incidents: unknown[] = [];
    const o = createQuoteOutputOrchestrator({ sql, storage: base.storage, presentation: { load: async () => structuredClone(intent) },
      assets: { read: async () => null }, onIncident: (i) => incidents.push(i) });
    const add = (n: number) => base.w.quotes.set(qid(n), { owner: U, client: `client-${n}`, digest: D('a'), status: 'draft', attachments: 0 });
    const out = (n: number, key: string, channel = 'send') => o.output({ userId: U }, { quoteId: qid(n), channel, idempotencyKey: KEY(key), expectedDigest: D('a') });
    return { ...base, o, add, out, incidents };
  }
  const EXPECTED_KEYS = ['accountMode', 'attemptId', 'consumed', 'descriptor', 'finalizedAt', 'firstChannel', 'ok', 'quoteId', 'state'];
  const DESCRIPTOR_KEYS = ['bytes', 'contentDigest', 'issuerDigest', 'path', 'presentationDigest', 'schemaVersion', 'sha256'];
  type Final = Record<string, unknown> & { descriptor: Record<string, unknown> };
  const corruptions: Array<[string, (x: Final) => void]> = [
    ['descriptor missing', (x) => { delete (x as Record<string, unknown>).descriptor; }],
    ['path of another owner', (x) => { x.descriptor.path = String(x.descriptor.path).replace(U, OTHER); }],
    ['path of another attempt', (x) => { x.descriptor.path = String(x.descriptor.path).replace(/[0-9a-f-]{36}\.json$/, '20000000-0000-4000-8000-0000000000ff.json'); }],
    ['non-canonical path', (x) => { x.descriptor.path = 'public/x.json'; }],
    ['sha256 of other bytes', (x) => { x.descriptor.sha256 = D('f'); }],
    ['sha256 not hex', (x) => { x.descriptor.sha256 = 'zz'; }],
    ['bytes off by one', (x) => { x.descriptor.bytes = Number(x.descriptor.bytes) + 1; }],
    ['bytes zero', (x) => { x.descriptor.bytes = 0; }],
    ['unsupported schemaVersion', (x) => { x.descriptor.schemaVersion = 2; }],
    ['contentDigest wrong', (x) => { x.descriptor.contentDigest = D('9'); }],
    ['issuerDigest wrong', (x) => { x.descriptor.issuerDigest = D('8'); }],
    ['presentationDigest wrong', (x) => { x.descriptor.presentationDigest = D('7'); }],
    ['presentationDigest missing', (x) => { delete x.descriptor.presentationDigest; }],
    ['attemptId of another attempt', (x) => { x.attemptId = '20000000-0000-4000-8000-0000000000ee'; }],
    ['quoteId of another quote', (x) => { x.quoteId = qid(999); }],
    ['firstChannel not a channel', (x) => { x.firstChannel = 'preview'; }],
    ['firstChannel not the reserved channel', (x) => { x.firstChannel = 'final_print'; }],
    ['consumed not boolean', (x) => { x.consumed = 'yes'; }],
    ['accountMode unknown', (x) => { x.accountMode = 'pro'; }],
    ['finalizedAt not a date', (x) => { x.finalizedAt = 'not-a-date'; }],
    ['finalizedAt missing', (x) => { delete x.finalizedAt; }],
    ['state wrong', (x) => { x.state = 'preparing'; }],
    ['ok not boolean true', (x) => { x.ok = 'true'; }],
    ['alreadyFinalized not boolean', (x) => { x.alreadyFinalized = 'yes'; }],
  ];

  it('finalize answering only {ok:true, state:"finalized"} is 503; the same-key retry returns the validated durable result, no second consumption or snapshot', async () => {
    const t = world((b) => ({ finalize: async (x) => { await b.sql.finalize(x); return { ok: true, state: 'finalized' }; } }));
    t.add(100);
    expect(await t.out(100, 'sr-1')).toEqual({ status: 503, body: { ok: false, code: 'final_response_invalid' } });
    expect(t.w.ent!.consumed).toBe(1);                         // SQL committed; nothing is undone or deleted
    expect(t.w.objects.size).toBe(1);
    const r = await t.out(100, 'sr-1');                       // retry: prepare -> durable final -> parser -> hash/size/identity
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, state: 'finalized', alreadyFinalized: true });
    expect(t.w.ent!.consumed).toBe(1);
    expect(t.w.objects.size).toBe(1);
    expect(t.w.finals.size).toBe(1);
    expect(t.w.calls.filter((c) => c === 'put')).toHaveLength(1);
  });

  it.each(corruptions)('finalize response with %s -> 503 fail closed; nothing deleted; the retry is validated and not re-consumed', async (_label, corrupt) => {
    const t = world((b) => ({ finalize: async (x) => { const real = structuredClone(await b.sql.finalize(x)) as Final; corrupt(real); return real; } }));
    t.add(101);
    expect((await t.out(101, 'sr-2')).status).toBe(503);
    expect(t.w.objects.size).toBe(1);
    const r = await t.out(101, 'sr-2');
    expect(r.status).toBe(200);
    expect(t.w.ent!.consumed).toBe(1);
    expect(t.w.objects.size).toBe(1);
  });

  it('a valid final carrying internal / user_id / future fields is returned as a clean allowlisted 200 body', async () => {
    const t = world((b) => ({ finalize: async (x) => {
      const real = structuredClone(await b.sql.finalize(x)) as Final;
      return { ...real, internal: 'secret', user_id: U, futureField: { x: 1 }, descriptor: { ...real.descriptor, bucket: 'quote-files', secretUrl: 'https://signed' } };
    } }));
    t.add(102);
    const r = await t.out(102, 'sr-3');
    expect(r.status).toBe(200);
    expect(Object.keys(r.body).sort()).toEqual(EXPECTED_KEYS);
    expect(Object.keys(r.body.descriptor as object).sort()).toEqual(DESCRIPTOR_KEYS);
    expect(JSON.stringify(r.body)).not.toMatch(/secret|user_id|futureField|bucket|signed/);
  });

  it.each(corruptions)('prepare-reuse (already finalized) with %s -> 503', async (_label, corrupt) => {
    let corruptReuse = false;
    const t = world((b) => ({ prepare: async (x) => {
      const r = structuredClone(await b.sql.prepare(x)) as Final;
      if (corruptReuse && r.state === 'finalized') corrupt(r);
      return r;
    } }));
    t.add(103);
    expect((await t.out(103, 'sr-4')).status).toBe(200);
    corruptReuse = true;
    // a reuse on the reserved channel ('send'); the channel-mismatch case is a finalize-only cross-check, so it stays 200 here
    const r = await t.out(103, 'sr-4');
    if (_label === 'firstChannel not the reserved channel') expect(r.status).toBe(200);
    // a well-formed sha/bytes that merely disagree with the stored object is the hash/size integrity incident (410)
    else if (_label === 'sha256 of other bytes' || _label === 'bytes off by one') expect(r.body.code).toBe('document_unavailable');
    else { expect(r.status).toBe(503); expect(['final_response_invalid', 'output_unavailable']).toContain(r.body.code); }  // not a final at all (ok/state) fails before the parser
    expect(t.w.ent!.consumed).toBe(1);
  });

  it('a valid prepare-reuse is clean: alreadyFinalized stays a boolean, internal fields are dropped, hash+size still verified', async () => {
    const t = world((b) => ({ prepare: async (x) => {
      const r = structuredClone(await b.sql.prepare(x)) as Final;
      return r.state === 'finalized' ? { ...r, internal: 'secret', freeIssues: { limit: 999 } } : r;
    } }));
    t.add(104);
    await t.out(104, 'sr-5');
    const r = await t.out(104, 'sr-5b', 'final_pdf');
    expect(r.status).toBe(200);
    expect(Object.keys(r.body).sort()).toEqual([...EXPECTED_KEYS, 'alreadyFinalized'].sort());
    expect(r.body.alreadyFinalized).toBe(true);
    const path = (r.body.descriptor as { path: string }).path;
    t.w.objects.set(path, enc('tampered'));
    expect((await t.out(104, 'sr-5c', 'final_print')).body.code).toBe('document_unavailable');
  });

  it.each(corruptions.filter(([l]) => l !== 'firstChannel not the reserved channel'))(
    'reveal with %s -> fail closed: 503, or document_unavailable when the claimed object does not verify', async (label, corrupt) => {
      let corruptReveal = false;
      const t = world((b) => ({ descriptor: async (x) => {
        const r = structuredClone(await b.sql.descriptor(x)) as Final;
        if (corruptReveal) corrupt(r);
        return r;
      } }));
      t.add(105);
      await t.out(105, 'sr-6');
      corruptReveal = true;
      const r = await t.o.reveal(qid(105));
      // a well-formed sha/bytes that simply do not match the stored object is the existing hash/size incident (410)
      // reveal has no trusted owner: the owner is proven by the stored snapshot. A claimed object that is absent (foreign-owner path)
      // or whose well-formed sha/bytes disagree is the integrity incident (410); everything else is a parse failure (503)
      if (['sha256 of other bytes', 'bytes off by one', 'path of another owner'].includes(label)) {
        expect(r).toEqual({ status: 410, body: { ok: false, code: 'document_unavailable', attemptId: expect.any(String) } });
      } else { expect(r.status).toBe(503); expect(['final_response_invalid', 'output_unavailable']).toContain(r.body.code); }  // not a final at all (ok/state) fails before the parser
      expect(r.status).not.toBe(200);
    });

  it('reveal: valid descriptor is clean; a stored object whose hash matches but whose identity differs is refused (503 + incident)', async () => {
    let swap: null | ((r: Final) => void) = null;
    const t = world((b) => ({ descriptor: async (x) => { const r = structuredClone(await b.sql.descriptor(x)) as Final; if (swap) swap(r); return { ...r, internal: 'secret' }; } }));
    t.add(106); t.add(107);
    await t.out(106, 'sr-7'); await t.out(107, 'sr-8');
    const ok = await t.o.reveal(qid(106));
    expect(ok.status).toBe(200);
    expect(Object.keys(ok.body).sort()).toEqual(EXPECTED_KEYS);
    // put quote 107's genuine snapshot bytes at quote 106's path and make the descriptor's hash/size match those bytes
    const p106 = (ok.body.descriptor as { path: string }).path;
    const other = t.w.objects.get([...t.w.objects.keys()].find((k) => k.includes(qid(107)))!)!;
    t.w.objects.set(p106, other);
    const sha = await sha256Hex(other);
    swap = (r) => { r.descriptor.sha256 = sha; r.descriptor.bytes = other.byteLength; };
    expect(await t.o.reveal(qid(106))).toEqual({ status: 503, body: { ok: false, code: 'final_response_invalid' } });
    expect(t.incidents).toHaveLength(1);
  });
});

describe('canonical bytes', () => {
  it('canonicalJson is key-order independent and rejects non-JSON values', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(canonicalJson({ a: [{ c: 3, d: 2 }], b: 1 }));
    expect(() => canonicalJson({ a: Number.NaN })).toThrow();
  });
  it('the presentation digest covers style, styleVersion, branding and the ORDERED media manifest (closure)', async () => {
    const base = { style: 'classic' as const, styleVersion: 1, branding: { n: 1 }, media: [
      { assetId: 'a', sha256: D('1'), bytes: 1 }, { assetId: 'b', sha256: D('2'), bytes: 2 }] };
    const d0 = await presentationDigest(base);
    for (const v of [{ ...base, styleVersion: 2 }, { ...base, branding: { n: 2 } }, { ...base, media: [...base.media].reverse() },
      { ...base, media: [base.media[0], { ...base.media[1], sha256: D('3') }] }, { ...base, media: [base.media[0], { ...base.media[1], bytes: 3 }] }]) {
      expect(await presentationDigest(v)).not.toBe(d0);
    }
    expect(await presentationDigest(structuredClone(base))).toBe(d0);
  });
});
