// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { decideApproval, parseApprovalRequest, planApprovalCall } from './publicApprovalDecision';
import { canonicalSnapshotPath, mintToken } from './capabilityToken';
import { classifyPhaseRead, decideLegacyIdAccess, isMissingFunctionError, isMissingRelationError } from './activationPhase';

const U = '11111111-1111-4111-8111-111111111111';
const QA = '22222222-2222-4222-8222-222222222222';
const QB = '55555555-5555-4555-8555-555555555555';
const A = '33333333-3333-4333-8333-333333333333';
const C = '44444444-4444-4444-8444-444444444444';
const resolution = (quoteId: string, ops = ['view', 'approve']) => ({ ok: true, capabilityId: C, userId: U, quoteId, attemptId: A,
  snapshotPath: canonicalSnapshotPath(U, quoteId, A), snapshotSha256: 'b'.repeat(64), ops });

describe('reference semantics of public_approve_quote_capability (op approve)', () => {
  const token = mintToken();
  it('a token bound to quote A approves quote A only (the quote id comes from the resolution, not the body)', () => {
    const d = decideApproval(parseApprovalRequest({ capability_token: token }), { resolutionRaw: resolution(QA) });
    expect(d).toMatchObject({ allow: true, quoteId: QA, via: 'capability' });
  });
  it('token swap: a token for quote A with a body quote B is refused with the uniform 404', () => {
    expect(decideApproval(parseApprovalRequest({ capability_token: token, quote_id: QB }), { resolutionRaw: resolution(QA) }))
      .toEqual({ allow: false, status: 404, code: 'not_found' });
  });
  it.each([
    ['view-only capability', resolution(QA, ['view'])], ['revoked / expired / unknown (SQL uniform not_found)', { ok: false, code: 'not_found' }],
    ['not queried', undefined], ['malformed answer', { ok: true }],
  ])('%s -> uniform 404', (_n, raw) => {
    expect(decideApproval(parseApprovalRequest({ capability_token: token }), { resolutionRaw: raw })).toEqual({ allow: false, status: 404, code: 'not_found' });
  });
  it('a malformed token is refused without any SQL answer being consulted', () => {
    const req = parseApprovalRequest({ capability_token: 'x'.repeat(43) + '!' });
    expect(req).toMatchObject({ mode: 'capability', tokenValid: false });
    expect(decideApproval(req, { resolutionRaw: resolution(QA) })).toEqual({ allow: false, status: 404, code: 'not_found' });
  });
});

describe('approval RPC plan (public_approve_quote_capability on the capability route)', () => {
  const SIG = 'data:image/png;base64,AAAA';
  it('capability route -> the new anon RPC with the raw token only (never a quote id)', () => {
    const t = mintToken();
    const call = planApprovalCall(parseApprovalRequest({ capability_token: t, quote_id: QB }), SIG);
    expect(call).toEqual({ call: true, rpc: 'public_approve_quote_capability', args: { p_token: t, p_signature_data_url: SIG } });
    expect(JSON.stringify(call)).not.toContain(QB);
  });
  it('legacy id route -> public_approve_quote with the existing arguments (SQL adds the enforced guard)', () => {
    expect(planApprovalCall(parseApprovalRequest({ quote_id: QA }), SIG)).toEqual({ call: true, rpc: 'public_approve_quote', args: { p_quote_id: QA, p_signature_data_url: SIG } });
  });
  it('malformed token -> no RPC (uniform not_found); missing signature / bad body -> 400', () => {
    expect(planApprovalCall(parseApprovalRequest({ capability_token: 'abc' }), SIG)).toEqual({ call: false, status: 404, code: 'not_found' });
    expect(planApprovalCall(parseApprovalRequest({ capability_token: mintToken() }), '')).toMatchObject({ call: false, status: 400 });
    expect(planApprovalCall(parseApprovalRequest({ quote_id: QA }), 'javascript:alert(1)')).toMatchObject({ call: false, status: 400 });
    expect(planApprovalCall(parseApprovalRequest(null), SIG)).toMatchObject({ call: false, status: 400 });
  });
});

describe('legacy id approval', () => {
  it.each(['absent', 'prepared', 'shadow'] as const)('phase %s: unchanged (allowed by id)', (phase) => {
    expect(decideApproval(parseApprovalRequest({ quote_id: QA }), { phase })).toMatchObject({ allow: true, via: 'legacy_unenforced' });
  });
  it('enforced: only legacy-allowlisted ids may use the id path', () => {
    expect(decideApproval(parseApprovalRequest({ quote_id: QA }), { phase: 'enforced', isLegacy: true })).toMatchObject({ allow: true, via: 'legacy_allowlisted' });
    expect(decideApproval(parseApprovalRequest({ quote_id: QA }), { phase: 'enforced', isLegacy: false })).toEqual({ allow: false, status: 404, code: 'not_found' });
    expect(decideApproval(parseApprovalRequest({ quote_id: QA }), { phase: 'enforced', isLegacy: 'true' })).toEqual({ allow: false, status: 404, code: 'not_found' });
  });
  it('phase read error fails closed; malformed requests are 400', () => {
    expect(decideApproval(parseApprovalRequest({ quote_id: QA }), { phase: 'error' })).toMatchObject({ allow: false, status: 503 });
    expect(decideApproval(parseApprovalRequest({ quote_id: 'nope' }), {})).toMatchObject({ allow: false, status: 400 });
    expect(decideApproval(parseApprovalRequest(null), {})).toMatchObject({ allow: false, status: 400 });
  });
});

describe('the p0-aqp-0929-broker is NOT an approval path and is untouched', () => {
  it('broker policy is the Production migration executor (no public_approve_quote call path)', () => {
    const src = readFileSync(join(cwd(), 'supabase/functions/p0-aqp-0929-broker/policy.ts'), 'utf8');
    expect(src).toMatch(/ONE protected execution channel for the Production run of migration 20260929000000/);
    expect(src).not.toMatch(/rpc\(['"]public_approve_quote/);
  });
});

describe('activation phase read + legacy id access rule (shared by get-public-quote and quote-presentation)', () => {
  it.each([
    [{ data: { phase: 'enforced' }, error: null }, 'enforced'], [{ data: { phase: 'shadow' }, error: null }, 'shadow'],
    [{ data: { phase: 'prepared' }, error: null }, 'prepared'], [{ data: null, error: null }, 'prepared'],
    [{ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.subscription_activation' in the schema cache" } }, 'absent'],
    [{ data: null, error: { code: '42P01', message: 'relation "public.subscription_activation" does not exist' } }, 'absent'],
    [{ data: null, error: { code: '42501', message: 'permission denied for table subscription_activation' } }, 'error'],
    [{ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.other' in the schema cache" } }, 'error'],
    [{ data: { phase: 'ENFORCED' }, error: null }, 'error'], [null, 'error'],
  ])('%j -> %s', (answer, want) => { expect(classifyPhaseRead(answer as never)).toBe(want); });
  it('missing relation / function classifiers', () => {
    expect(isMissingRelationError({ code: 'PGRST205', message: "Could not find the table 'public.account_market' in the schema cache" }, 'account_market')).toBe(true);
    expect(isMissingFunctionError({ code: 'PGRST202', message: 'Could not find the function public.capability_check' })).toBe(true);
    expect(isMissingFunctionError({ code: '500', message: 'boom' })).toBe(false);
  });
  const OWNER = U; const OTHER = C;
  it.each([
    ['not enforced: anyone, unchanged', { phase: 'absent', isLegacy: false, callerUserId: null, quoteOwnerId: OWNER }, 'serve'],
    ['not enforced: unknown id still goes the old way', { phase: 'prepared', isLegacy: null, callerUserId: null, quoteOwnerId: null }, 'serve'],
    ['enforced: verified owner preview', { phase: 'enforced', isLegacy: false, callerUserId: OWNER, quoteOwnerId: OWNER }, 'serve'],
    ['enforced: other authenticated user, post-cutover quote', { phase: 'enforced', isLegacy: false, callerUserId: OTHER, quoteOwnerId: OWNER }, 'not_found'],
    ['enforced: anonymous, post-cutover quote', { phase: 'enforced', isLegacy: false, callerUserId: null, quoteOwnerId: OWNER }, 'not_found'],
    ['enforced: anonymous, legacy-allowlisted quote', { phase: 'enforced', isLegacy: true, callerUserId: null, quoteOwnerId: OWNER }, 'serve'],
    ['enforced: unknown id', { phase: 'enforced', isLegacy: false, callerUserId: null, quoteOwnerId: null }, 'not_found'],
    ['enforced: owner claim without a quote row', { phase: 'enforced', isLegacy: true, callerUserId: OWNER, quoteOwnerId: null }, 'not_found'],
    ['phase read error', { phase: 'error', isLegacy: true, callerUserId: OWNER, quoteOwnerId: OWNER }, 'error'],
  ])('%s', (_n, input, want) => { expect(decideLegacyIdAccess(input as never)).toBe(want); });
});
