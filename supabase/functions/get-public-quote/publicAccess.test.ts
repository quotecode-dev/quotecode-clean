// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import {
  decideLegacyAccess, outputPhaseOf, parsePublicRequest, rendererFromSnapshot, serveCapability, serveGrant, UNIFORM_NOT_FOUND,
  type CapabilityDeps,
} from './publicAccess';
import { canonicalSnapshotPath, mintToken, tokenHash } from '../_shared/capabilityToken';
import { canonicalJson } from '../subscription-authority/authorizeOutput';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '66666666-6666-4666-8666-666666666666';
const QA = '22222222-2222-4222-8222-222222222222';
const QB = '55555555-5555-4555-8555-555555555555';
const ATT = '33333333-3333-4333-8333-333333333333';
const CAP = '44444444-4444-4444-8444-444444444444';

function snapshotFor(quoteId: string) {
  return {
    kind: 'tekango-issued-quote-document', schemaVersion: 1, attemptId: ATT, ownerId: OWNER, quoteId, customerBinding: 'c1',
    requestedChannel: 'send', preparedAt: '2026-10-07T10:00:00Z', contentDigest: 'a'.repeat(64), issuerDigest: 'b'.repeat(64), presentationDigest: 'c'.repeat(64),
    document: { documentProjection: 'quote-document/v1',
      quote: { id: quoteId, quote_number: 1007, created_at: '2026-10-01T00:00:00Z', valid_until: '2999-01-01', currency: 'ILS', client_type: 'business',
        subject: 'Kitchen', project_name: 'P', attn_name: 'Dana', attn_role: 'CEO', subtotal: 100, discount: 0, tax_rate: 18, total: 118, terms: 't', warranty: 'w', notes: 'n' },
      customer: { company_name: 'Acme', email: 'a@example.com', phone: '1', address: 'x', internal_note: 'never' },
      sections: [{ id: 's2', name: 'B', sort_order: 2 }, { id: 's1', name: 'A', sort_order: 1 }],
      items: [{ description: 'tile', quantity: 2, unit_price: 50, total_price: 100, pricing_unit: null, calculated_quantity: null, quantity_source: null,
        specification: null, section_id: 's1', calculation_method: null, sort_order: 1, measurements: [{ width: 1, height: 2, unit: 'm', calculated_area: 2, label: 'w', sort_order: 1, is_pricing_driving: true }] }],
      attachmentCount: 0, attachmentManifest: [] },
    issuer: { issuerProjection: 'issuer/v1', business_name: 'Biz', logo_url: null, tax_id: '9', email: 'b@example.com', phone: '2', address: 'y', currency: 'ILS', country: 'Local' },
    presentation: { presentationProjection: 'presentation/v1', style: 'classic', styleVersion: 1, branding: null, media: [] },
  };
}

function world() {
  const objects = new Map<string, Uint8Array>();
  const caps = new Map<string, { quoteId: string; ops: string[]; revoked?: boolean }>();
  const grants = new Map<string, { quoteId: string; channel: string; used: boolean }>();
  const live = new Map<string, { user_id: string; status: unknown; signature: unknown; signer_name?: unknown; signer_company?: unknown; signer_role?: unknown; signed_at?: unknown }>();
  for (const q of [QA, QB]) {
    const bytes = new TextEncoder().encode(canonicalJson(snapshotFor(q)));
    objects.set(canonicalSnapshotPath(OWNER, q, ATT), bytes);
    live.set(q, { user_id: OWNER, status: 'Sent', signature: null });
  }
  // the hash bound at finalize time (SQL row), fixed: later Storage tampering does not change it
  const shas = new Map([QA, QB].map((q) => [q, createHash('sha256').update(objects.get(canonicalSnapshotPath(OWNER, q, ATT))!).digest('hex')]));
  const sha = (q: string) => shas.get(q)!;
  const bound = (q: string) => ({ ok: true, userId: OWNER, quoteId: q, attemptId: ATT, snapshotPath: canonicalSnapshotPath(OWNER, q, ATT), snapshotSha256: sha(q) });
  const deps: CapabilityDeps & { resolve: ReturnType<typeof vi.fn>; redeem: ReturnType<typeof vi.fn> } = {
    resolve: vi.fn(async (hash: string, op: string) => {
      const c = caps.get(hash);
      if (!c || c.revoked || !c.ops.includes(op)) return { ok: false, code: 'not_found' };
      return { ...bound(c.quoteId), capabilityId: CAP, ops: c.ops };
    }),
    redeem: vi.fn(async (hash: string, channel: string) => {
      const g = grants.get(hash);
      if (!g || g.used || g.channel !== channel) return { ok: false, code: 'not_found' };
      g.used = true;
      return bound(g.quoteId);
    }),
    readSnapshot: async (p: string) => objects.get(p) ?? null,
    readLiveQuote: async (q: string) => live.get(q) ?? null,
    callerUserId: null, outputPhase: 'enforced', now: () => new Date('2026-10-07T12:00:00Z'),
  } as never;
  const addCap = async (quoteId: string, ops = ['view', 'approve']) => { const t = mintToken(); caps.set((await tokenHash(t))!, { quoteId, ops }); return t; };
  const addGrant = async (quoteId: string, channel: string) => { const t = mintToken(); grants.set((await tokenHash(t))!, { quoteId, channel, used: false }); return t; };
  return { objects, caps, grants, live, deps, addCap, addGrant };
}

describe('request parsing: exactly one mode', () => {
  const t = mintToken();
  it.each([
    [{ capability_token: t }, 'capability'], [{ output_grant: t, channel: 'final_pdf' }, 'grant'], [{ quote_id: QA }, 'legacy'],
    [{ capability_token: 'short' }, 'malformed'], [{ output_grant: 'short', channel: 'final_print' }, 'malformed'],
    [{ output_grant: t, channel: 'send' }, 'bad_request'], [{ output_grant: t }, 'bad_request'], [{ capability_token: t, quote_id: QA }, 'bad_request'],
    [{ quote_id: 'x' }, 'bad_request'], [null, 'bad_request'], [{}, 'bad_request'],
  ])('%j -> %s', (body, mode) => { expect(parsePublicRequest(body).mode).toBe(mode); });
  it('legacy bad requests keep the exact legacy error body', () => {
    expect(parsePublicRequest({}).mode === 'bad_request' && (parsePublicRequest({}) as { res: unknown }).res).toEqual({ status: 400, body: { error: 'Missing or invalid quote_id' } });
  });
});

describe('capability mode', () => {
  it('serves the immutable snapshot in the legacy renderer shape + capability:true, viewerIsOwner:false, outputPhase', async () => {
    const w = world(); const t = await w.addCap(QA);
    const r = await serveCapability(w.deps, t);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ capability: true, viewerIsOwner: false, outputPhase: 'enforced', attachments: [] });
    expect(Object.keys(r.body).sort()).toEqual(['attachments', 'business', 'capability', 'client', 'items', 'outputPhase', 'quote', 'sections', 'thanks', 'viewerIsOwner']);
    const q = r.body.quote as Record<string, unknown>;
    expect(q).toMatchObject({ id: QA, status: 'Sent', signature: null, is_owner_viewing: false, is_expired: false, total: 118 });
    expect(Object.keys(q).sort()).toEqual(['attn_name', 'attn_role', 'client_type', 'created_at', 'currency', 'discount', 'id', 'is_expired', 'is_owner_viewing', 'notes',
      'project_name', 'quote_number', 'signature', 'signed_at', 'signer_company', 'signer_name', 'signer_role', 'status', 'subject', 'subtotal', 'tax_rate', 'terms', 'total', 'valid_until', 'warranty']);
    expect(r.body.client).toEqual({ company_name: 'Acme', email: 'a@example.com', phone: '1', address: 'x' }); // allowlist: no internal_note
    expect(r.body.sections).toEqual([{ id: 's1', name: 'A' }, { id: 's2', name: 'B' }]);
    expect((r.body.items as Record<string, unknown>[])[0]).toMatchObject({ description: 'tile', price: 50, specification: [], measurements: [{ width: 1, height: 2, unit: 'm', calculated_area: 2, label: 'w', is_pricing_driving: true }] });
    expect(r.body.business).toEqual({ business_name: 'Biz', logo_url: null, tax_id: '9', email: 'b@example.com', phone: '2', address: 'y', currency: 'ILS' });
  });
  it('token swap: the token for quote A can never read quote B (the quote comes from the resolution)', async () => {
    const w = world(); const t = await w.addCap(QA);
    const r = await serveCapability(w.deps, t);
    expect((r.body.quote as { id: string }).id).toBe(QA);
    // a resolution that points at B's id but A's path is refused by the strict parser (path bound to identities)
    w.deps.resolve.mockResolvedValueOnce({ ok: true, capabilityId: CAP, userId: OWNER, quoteId: QB, attemptId: ATT, snapshotPath: canonicalSnapshotPath(OWNER, QA, ATT), snapshotSha256: 'a'.repeat(64), ops: ['view'] });
    expect(await serveCapability(w.deps, t)).toEqual(UNIFORM_NOT_FOUND);
  });
  it('unknown / revoked / approve-only tokens get the identical uniform 404', async () => {
    const w = world();
    const unknown = await serveCapability(w.deps, mintToken());
    const revokedT = await w.addCap(QA); w.caps.get((await tokenHash(revokedT))!)!.revoked = true;
    const approveOnly = await w.addCap(QA, ['approve']);
    for (const r of [unknown, await serveCapability(w.deps, revokedT), await serveCapability(w.deps, approveOnly)]) expect(r).toEqual(UNIFORM_NOT_FOUND);
  });
  it('a malformed token never reaches SQL', async () => {
    const w = world();
    expect(await serveCapability(w.deps, 'not-a-token')).toEqual(UNIFORM_NOT_FOUND);
    expect(w.deps.resolve).not.toHaveBeenCalled();
  });
  it('tampered stored bytes are never served (hash verified)', async () => {
    const w = world(); const t = await w.addCap(QA);
    const p = canonicalSnapshotPath(OWNER, QA, ATT);
    w.objects.set(p, new TextEncoder().encode(canonicalJson({ ...snapshotFor(QA), document: { ...snapshotFor(QA).document, quote: { ...snapshotFor(QA).document.quote, total: 1 } } })));
    const onIncident = vi.fn();
    expect(await serveCapability({ ...w.deps, onIncident }, t)).toEqual({ status: 400, body: { error: 'Unable to load quote' } });
    expect(onIncident).toHaveBeenCalledWith('snapshot_hash_mismatch');
  });
  it('live approval state from another owner row is never mixed in', async () => {
    const w = world(); const t = await w.addCap(QA);
    w.live.set(QA, { user_id: OTHER, status: 'Approved', signature: 'sig', signer_name: 'Someone', signer_company: 'X', signer_role: 'CEO', signed_at: '2026-10-28T10:00:00Z' });
    const r = await serveCapability(w.deps, t);
    expect(r.body.quote).toMatchObject({ status: null, signature: null, signer_name: null, signer_company: null, signer_role: null, signed_at: null });
  });
  // 20261029000000 (Codex F15, L-24): a fresh load of a signed capability link shows who signed (the owner-checked live row only)
  it('a signed quote opened again shows the signer', async () => {
    const w = world(); const t = await w.addCap(QA);
    w.live.set(QA, { user_id: OWNER, status: 'Approved', signature: 'sig', signer_name: 'דנה כהן', signer_company: 'אקמה', signer_role: 'מנכ"לית', signed_at: '2026-10-28T10:00:00Z' });
    const r = await serveCapability(w.deps, t);
    expect(r.body.quote).toMatchObject({ status: 'Approved', signer_name: 'דנה כהן', signer_company: 'אקמה', signer_role: 'מנכ"לית', signed_at: '2026-10-28T10:00:00Z' });
  });
});

describe('grant mode (final PDF / Print)', () => {
  it('single use, channel-scoped, renderer shape + capability:true, viewerIsOwner:true', async () => {
    const w = world(); const g = await w.addGrant(QA, 'final_pdf');
    expect(await serveGrant(w.deps, g, 'final_print')).toEqual(UNIFORM_NOT_FOUND);       // wrong channel
    const first = await serveGrant(w.deps, g, 'final_pdf');
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ capability: true, viewerIsOwner: true, output_channel: 'final_pdf', outputPhase: 'enforced' });
    expect(await serveGrant(w.deps, g, 'final_pdf')).toEqual(UNIFORM_NOT_FOUND);         // second use
    expect(await serveGrant(w.deps, mintToken(), 'final_pdf')).toEqual(UNIFORM_NOT_FOUND); // expired / unknown
  });
});

describe('legacy id mode (enforced: owner preview or legacy allowlist only; uniform 404 otherwise)', () => {
  it('decision matrix incl. the owner preview rule', () => {
    expect(decideLegacyAccess({ phase: 'absent', isLegacy: null, callerUserId: null, quoteOwnerId: null })).toBe('serve');
    expect(decideLegacyAccess({ phase: 'enforced', isLegacy: false, callerUserId: OWNER, quoteOwnerId: OWNER })).toBe('serve');
    expect(decideLegacyAccess({ phase: 'enforced', isLegacy: false, callerUserId: OTHER, quoteOwnerId: OWNER })).toBe('not_found');
    expect(decideLegacyAccess({ phase: 'enforced', isLegacy: false, callerUserId: null, quoteOwnerId: OWNER })).toBe('not_found');
    expect(decideLegacyAccess({ phase: 'enforced', isLegacy: false, callerUserId: null, quoteOwnerId: null })).toBe('not_found');
    expect(decideLegacyAccess({ phase: 'enforced', isLegacy: true, callerUserId: null, quoteOwnerId: OWNER })).toBe('serve');
  });
  it('outputPhase field: absent -> off; error -> null (caller fails closed)', () => {
    expect(outputPhaseOf('absent')).toBe('off');
    expect(outputPhaseOf('shadow')).toBe('shadow');
    expect(outputPhaseOf('error')).toBeNull();
  });
  it('index.ts wiring: refused ids return the SAME body/status as an unknown id, after the same two lookups', () => {
    const src = readFileSync(join(cwd(), 'supabase/functions/get-public-quote/index.ts'), 'utf8');
    expect(src).toContain("if (!quote) return jsonResponse({ error: 'Quote not found' }, 404);");
    expect(UNIFORM_NOT_FOUND).toEqual({ status: 404, body: { error: 'Quote not found' } });
    expect(src).toMatch(/Promise\.all\(\[\s*phase === 'enforced' \? adminClient\.rpc\('is_legacy_public_quote'[\s\S]*?from\('quotes'\)\.select\('user_id'\)/);
    // continuation (D): the capability scope is read for every id (rollback-safe)
    expect(src).toContain("adminClient.rpc('is_capability_scoped_quote', { p_quote_id: quoteId })");
    expect(src).toMatch(/viewerIsOwner: isOwner,\s*outputPhase,/);
    // the owner preview path never writes anything: no insert/update/upsert/rpc that mints or finalizes in this function
    expect(src).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|mint_public_capability|issue_output_grant|finalize_quote_output/);
  });
});

describe('renderer: draft never exposed through a snapshot of another identity', () => {
  it('a snapshot whose header does not match the bound identity is refused', () => {
    const s = snapshotFor(QA);
    const bound = { userId: OWNER, quoteId: QA, attemptId: ATT, snapshotPath: canonicalSnapshotPath(OWNER, QA, ATT), snapshotSha256: 'a'.repeat(64) };
    expect(rendererFromSnapshot({ ...s, ownerId: OTHER }, bound, null, { callerUserId: null, now: new Date() })).toBeNull();
    expect(rendererFromSnapshot({ ...s, document: { ...s.document, quote: { ...s.document.quote, id: QB } } }, bound, null, { callerUserId: null, now: new Date() })).toBeNull();
    expect(rendererFromSnapshot({ ...s, kind: 'draft' }, bound, null, { callerUserId: null, now: new Date() })).toBeNull();
  });
});

// Continuation (A): issued documents carry the IMMUTABLE logo asset bound by SQL (issuer/v2); the renderer reads the exact bound
// bytes back (size + sha256) and serves them inline. The mutable account logo URL is never used for an issued document.
describe('issued logo (issuer/v2): bound asset, read-back, A stays A after B', () => {
  const PNG = (n: number) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, n, n, n]);
  const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
  const ASSET_A = '77777777-7777-4777-8777-777777777777';
  const ASSET_B = '88888888-8888-4888-8888-888888888888';
  const pathOf = (owner: string, asset: string) => `account-assets/${owner}/${asset}.png`;
  function logoWorld(logo: Record<string, unknown>, objects: Record<string, Uint8Array>) {
    const w = world();
    const snap = { ...snapshotFor(QA), issuer: { issuerProjection: 'issuer/v2', business_name: 'Biz', logo, tax_id: '9', email: 'b@example.com', phone: '2', address: 'y', currency: 'ILS', country: 'Local' } };
    const bytes = new TextEncoder().encode(canonicalJson(snap));
    const p = canonicalSnapshotPath(OWNER, QA, ATT);
    w.objects.set(p, bytes);
    const fixedSha = createHash('sha256').update(bytes).digest('hex');
    w.deps.resolve = vi.fn(async () => ({ ok: true, userId: OWNER, quoteId: QA, attemptId: ATT, snapshotPath: p, snapshotSha256: fixedSha, capabilityId: CAP, ops: ['view', 'approve'] })) as never;
    (w.deps as CapabilityDeps).readLogo = async (path: string) => objects[path] ?? null;
    return w;
  }
  const A = PNG(1); const B = PNG(2);
  const logoA = { assetId: ASSET_A, objectPath: pathOf(OWNER, ASSET_A), sha256: sha(A), bytes: A.length, mime: 'image/png', width: 64, height: 64, bindingId: 1 };

  it('renders the bound logo A as verified inline bytes; never the account URL', async () => {
    const w = logoWorld(logoA, { [pathOf(OWNER, ASSET_A)]: A, [pathOf(OWNER, ASSET_B)]: B });
    const r = await serveCapability(w.deps, mintToken());
    expect(r.status).toBe(200);
    const url = String((r.body.business as Record<string, unknown>).logo_url);
    expect(url).toBe(`data:image/png;base64,${Buffer.from(A).toString('base64')}`);
  });
  it('after the owner binds B, document A still shows A (the snapshot binds A; B exists only for new documents)', async () => {
    const w = logoWorld(logoA, { [pathOf(OWNER, ASSET_A)]: A, [pathOf(OWNER, ASSET_B)]: B });
    const r = await serveCapability(w.deps, mintToken());
    expect(String((r.body.business as Record<string, unknown>).logo_url)).not.toContain(Buffer.from(B).toString('base64'));
  });
  it.each([
    ['hash mismatch (object bytes changed)', logoA, { [pathOf(OWNER, ASSET_A)]: B }],
    ['size mismatch', { ...logoA, bytes: 99 }, { [pathOf(OWNER, ASSET_A)]: A }],
    ['missing object', logoA, {}],
  ])('%s -> unable to load (incident), no document without its logo', async (_n, logo, objects) => {
    const w = logoWorld(logo, objects as Record<string, Uint8Array>);
    const r = await serveCapability(w.deps, mintToken());
    expect(r).toEqual({ status: 400, body: { error: 'Unable to load quote' } });
  });
  it.each([
    ['another owner path', { ...logoA, objectPath: pathOf(OTHER, ASSET_A) }],
    ['path not matching the asset id', { ...logoA, objectPath: pathOf(OWNER, ASSET_B) }],
    ['mime not allowed', { ...logoA, mime: 'image/svg+xml' }],
    ['bad sha', { ...logoA, sha256: 'x' }],
  ])('%s -> snapshot refused (identity mismatch, unable)', async (_n, logo) => {
    const w = logoWorld(logo, { [pathOf(OWNER, ASSET_A)]: A, [pathOf(OTHER, ASSET_A)]: A });
    const r = await serveCapability(w.deps, mintToken());
    expect(r).toEqual({ status: 400, body: { error: 'Unable to load quote' } });
  });
  it('issuer/v1 snapshots (no logo / legacy) render exactly as before', async () => {
    const w = world();
    const t = await w.addCap(QA);
    const r = await serveCapability(w.deps, t);
    expect(r.status).toBe(200);
    expect((r.body.business as Record<string, unknown>).logo_url).toBeNull();
  });
});

// Continuation (D) - rollback safety: documents issued through the output authority stay capability-scoped in every phase.
describe('capability-scoped quotes after a rollback to prepared (no id exposure)', () => {
  it.each(['prepared', 'shadow', 'absent', 'enforced'] as const)('phase %s: a scoped quote id opens nothing for anyone but the verified owner', (phase) => {
    expect(decideLegacyAccess({ phase, isLegacy: true, callerUserId: null, quoteOwnerId: OWNER, capabilityScoped: true })).toBe('not_found');
    expect(decideLegacyAccess({ phase, isLegacy: true, callerUserId: OTHER, quoteOwnerId: OWNER, capabilityScoped: true })).toBe('not_found');
    expect(decideLegacyAccess({ phase, isLegacy: false, callerUserId: OWNER, quoteOwnerId: OWNER, capabilityScoped: true })).toBe('serve');
  });
  it('a non-scoped (legacy) quote keeps the legacy behavior when not enforced', () => {
    expect(decideLegacyAccess({ phase: 'prepared', isLegacy: false, callerUserId: null, quoteOwnerId: OWNER, capabilityScoped: false })).toBe('serve');
  });
});

// Task 28: the owner's thank-you on the capability (customer view) route; never on output grants; never from snapshot / foreign data.
describe('thank-you on capability / grant routes (Task 28)', () => {
  const ROW = { thanks_text: 'Thank you!', website_url: 'https://example.test', show_website_after_signature: true };
  const withThanks = (w: ReturnType<typeof world>, rows: Record<string, unknown>) => {
    const readThanksRow = vi.fn(async (ownerId: string) => (rows[ownerId] ?? null) as never);
    return { deps: { ...w.deps, readThanksRow } as CapabilityDeps, readThanksRow };
  };
  it('capability view of a SIGNED quote (live server status + signature) -> thanks of the bound owner only', async () => {
    const w = world(); const t = await w.addCap(QA);
    w.live.set(QA, { user_id: OWNER, status: 'Approved', signature: 'data:image/png;base64,AA' });
    const { deps, readThanksRow } = withThanks(w, { [OWNER]: ROW, [OTHER]: { thanks_text: 'foreign' } });
    const r = await serveCapability(deps, t);
    expect(r.body.thanks).toEqual({ text: 'Thank you!', website_url: 'https://example.test' });
    expect(readThanksRow).toHaveBeenCalledTimes(1);
    expect(readThanksRow).toHaveBeenCalledWith(OWNER);
  });
  it('not signed (Sent / approved without a signature / paid with blank signature) -> no thanks and no settings read', async () => {
    for (const live of [{ status: 'Sent', signature: null }, { status: 'Approved', signature: null }, { status: 'paid', signature: '  ' }, { status: 'Rejected', signature: 'sig' }]) {
      const w = world(); const t = await w.addCap(QA);
      w.live.set(QA, { user_id: OWNER, ...live });
      const { deps, readThanksRow } = withThanks(w, { [OWNER]: ROW });
      expect((await serveCapability(deps, t)).body.thanks).toBeNull();
      expect(readThanksRow).not.toHaveBeenCalled();
    }
  });
  it('a live row of ANOTHER tenant is never trusted as proof of signature', async () => {
    const w = world(); const t = await w.addCap(QA);
    w.live.set(QA, { user_id: OTHER, status: 'Approved', signature: 'sig' });
    const { deps, readThanksRow } = withThanks(w, { [OWNER]: ROW, [OTHER]: ROW });
    expect((await serveCapability(deps, t)).body.thanks).toBeNull();
    expect(readThanksRow).not.toHaveBeenCalled();
  });
  it('a signature inside the SNAPSHOT is not proof (only the live server row counts)', async () => {
    const w = world(); const t = await w.addCap(QA);
    const p = canonicalSnapshotPath(OWNER, QA, ATT);
    const snap = snapshotFor(QA);
    w.objects.set(p, new TextEncoder().encode(canonicalJson({ ...snap, document: { ...snap.document, quote: { ...snap.document.quote, status: 'approved', signature: 'forged' } } })));
    const { deps } = withThanks(w, { [OWNER]: ROW });
    const r = await serveCapability(deps, t); // tampered bytes -> refused before any thanks logic
    expect(r.status).toBe(400);
    expect(r.body.thanks).toBeUndefined();
  });
  it('invalid scope (approve-only / revoked / unknown) -> the uniform 404, no thanks field, no settings read', async () => {
    const w = world(); const approveOnly = await w.addCap(QA, ['approve']);
    w.live.set(QA, { user_id: OWNER, status: 'Approved', signature: 'sig' });
    const { deps, readThanksRow } = withThanks(w, { [OWNER]: ROW });
    expect(await serveCapability(deps, approveOnly)).toEqual(UNIFORM_NOT_FOUND);
    expect(await serveCapability(deps, mintToken())).toEqual(UNIFORM_NOT_FOUND);
    expect(readThanksRow).not.toHaveBeenCalled();
  });
  it('output grants (final PDF / Print) never carry the thank-you, even for a signed quote', async () => {
    for (const channel of ['final_pdf', 'final_print']) {
      const w = world(); const g = await w.addGrant(QA, channel);
      w.live.set(QA, { user_id: OWNER, status: 'Approved', signature: 'sig' });
      const { deps, readThanksRow } = withThanks(w, { [OWNER]: ROW });
      const r = await serveGrant(deps, g, channel as never);
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ output_channel: channel, thanks: null });
      expect(readThanksRow).not.toHaveBeenCalled();
    }
  });
  it('a failing / absent settings read is no thanks (never a placeholder), and the quote is still served', async () => {
    const w = world(); const t = await w.addCap(QA);
    w.live.set(QA, { user_id: OWNER, status: 'Approved', signature: 'sig' });
    const failing = { ...w.deps, readThanksRow: vi.fn(async () => { throw new Error('relation does not exist'); }) } as CapabilityDeps;
    const r1 = await serveCapability(failing, t);
    expect(r1.status).toBe(200); expect(r1.body.thanks).toBeNull();
    const r2 = await serveCapability(w.deps, await w.addCap(QA)); // no reader wired at all
    expect(r2.status).toBe(200); expect(r2.body.thanks).toBeNull();
  });
});
