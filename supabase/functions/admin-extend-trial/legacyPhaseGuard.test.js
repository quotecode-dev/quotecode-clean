// Stream D (subscriptions cross-cut): the legacy trial / is_lifetime admin operations are refused with 409
// legacy_trial_retired once the subscription free_issue phase is enforced; a missing subscription_activation table means
// "not enforced"; any other phase-read failure fails closed (503) - never a legacy write on an unknown phase.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { checkLegacyOperationAllowed, decideLegacyOperation, LEGACY_TRIAL_RETIRED, PHASE_UNAVAILABLE } from './legacyPhaseGuard.ts';

const read = (...p) => readFileSync(join(cwd(), ...p));

function fakeClient(result, { throws = false } = {}) {
  const calls = [];
  const chain = {
    select: vi.fn((cols) => { calls.push(['select', cols]); return chain; }),
    eq: vi.fn((col, val) => { calls.push(['eq', col, val]); return chain; }),
    maybeSingle: vi.fn(async () => { if (throws) throw new Error('network'); return result; }),
  };
  return { client: { from: vi.fn((table) => { calls.push(['from', table]); return chain; }) }, calls };
}

describe('legacy admin operation phase guard (decision)', () => {
  it('enforced -> 409 legacy_trial_retired', () => {
    expect(decideLegacyOperation({ data: { phase: 'enforced' }, error: null })).toEqual({ allow: false, status: 409, code: LEGACY_TRIAL_RETIRED, phase: 'enforced' });
  });
  for (const phase of ['off', 'prepared', 'shadow']) {
    it(`${phase} -> allowed (legacy operations keep working while the system is not enforced)`, () => {
      expect(decideLegacyOperation({ data: { phase }, error: null })).toEqual({ allow: true, phase });
    });
  }
  it('no free_issue row -> allowed (not enforced)', () => {
    expect(decideLegacyOperation({ data: null, error: null })).toEqual({ allow: true, phase: null });
  });
  for (const code of ['42P01', 'PGRST205']) {
    it(`missing table (${code}) -> treated as not enforced`, () => {
      expect(decideLegacyOperation({ data: null, error: { code, message: 'relation does not exist' } })).toEqual({ allow: true, phase: null });
    });
  }
  it('any other read error fails closed with 503 phase_unavailable', () => {
    expect(decideLegacyOperation({ data: null, error: { code: '42501', message: 'permission denied' } })).toEqual({ allow: false, status: 503, code: PHASE_UNAVAILABLE, phase: null });
  });
});

describe('legacy admin operation phase guard (service-role read)', () => {
  it('reads subscription_activation.phase for component free_issue', async () => {
    const { client, calls } = fakeClient({ data: { phase: 'enforced' }, error: null });
    const d = await checkLegacyOperationAllowed(client);
    expect(d.allow).toBe(false);
    expect(d.status).toBe(409);
    expect(calls).toEqual([['from', 'subscription_activation'], ['select', 'phase'], ['eq', 'component', 'free_issue']]);
  });
  it('a thrown client error fails closed', async () => {
    const { client } = fakeClient(null, { throws: true });
    expect(await checkLegacyOperationAllowed(client)).toEqual({ allow: false, status: 503, code: PHASE_UNAVAILABLE, phase: null });
  });
});

describe('both Edge functions use the guard before the proof claim and before any write', () => {
  it('the guard module is byte-identical in admin-extend-trial and admin-set-lifetime', () => {
    expect(read('supabase', 'functions', 'admin-set-lifetime', 'legacyPhaseGuard.ts').equals(read('supabase', 'functions', 'admin-extend-trial', 'legacyPhaseGuard.ts'))).toBe(true);
  });
  for (const fn of ['admin-extend-trial', 'admin-set-lifetime']) {
    it(`${fn}: guard -> 409/503 refusal precedes claimReauthProof and the business_settings update`, () => {
      const src = read('supabase', 'functions', fn, 'index.ts').toString('utf8');
      expect(src).toContain('import { checkLegacyOperationAllowed } from "./legacyPhaseGuard.ts";');
      const guard = src.indexOf('await checkLegacyOperationAllowed(adminClient)');
      const superAdmin = src.indexOf("callerBiz?.role !== 'super_admin'");
      const claim = src.indexOf('await claimReauthProof(');
      const update = src.indexOf('.update(');
      expect(guard).toBeGreaterThan(superAdmin);
      expect(guard).toBeGreaterThan(0);
      expect(guard).toBeLessThan(claim);
      expect(guard).toBeLessThan(update);
      expect(src).toMatch(/if \(!legacyGuard\.allow\) \{[\s\S]{0,200}return jsonResponse\(\{ error: legacyGuard\.code \}, legacyGuard\.status\);/);
    });
  }
});
