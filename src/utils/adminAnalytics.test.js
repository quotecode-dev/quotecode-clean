import { describe, it, expect } from 'vitest';
import { getPlanDistribution, getMarketDistribution, getTrialStateDistribution, getAdminKpiSummary } from './adminAnalytics';

const now = new Date('2026-09-16T12:00:00Z');
const days = (n) => new Date(now.getTime() + n * 86400000).toISOString();

function account(overrides) {
  return {
    id: 'a', role: 'user', email: 'x@example.com', business_name: 'Biz',
    plan: 'free', trial_ends_at: null, is_lifetime: false, country: 'Local',
    created_at: now.toISOString(),
    ...overrides,
  };
}

describe('adminAnalytics - Owner-binding anti-fabrication rules', () => {
  it('excludes super_admin rows from every distribution', () => {
    const accounts = [account({ id: '1', role: 'super_admin', plan: 'pro' }), account({ id: '2' })];
    const dist = getPlanDistribution(accounts);
    expect(dist.reduce((sum, r) => sum + r.count, 0)).toBe(1);
  });

  it('excludes soft-deleted rows (deleted_ email prefix / business_name "deleted")', () => {
    const accounts = [
      account({ id: '1', email: 'deleted_x@example.com' }),
      account({ id: '2', business_name: 'deleted' }),
      account({ id: '3' }),
    ];
    expect(getPlanDistribution(accounts).reduce((s, r) => s + r.count, 0)).toBe(1);
  });

  it('getAdminKpiSummary never derives an "active now"/online signal - only structural facts', () => {
    const summary = getAdminKpiSummary([account({ id: '1' })], now);
    // The Owner's binding rule forbids surfacing last-sign-in-recency at
    // all - this locks the summary's own key set so a future edit can't
    // silently reintroduce an "activeNow"/"onlineCount" field.
    expect(Object.keys(summary).sort()).toEqual(['activeTrials', 'expiringSoon', 'managedBusinesses', 'registrationsLast24h'].sort());
  });

  it('counts registrations only within the real last-24h window, honestly (no invented activity)', () => {
    const accounts = [
      account({ id: '1', created_at: days(-0.5) }), // 12h ago - counts
      account({ id: '2', created_at: days(-2) }),   // 2 days ago - does not count
      account({ id: '3', created_at: null }),        // no created_at - does not count
    ];
    expect(getAdminKpiSummary(accounts, now).registrationsLast24h).toBe(1);
  });

  it('market distribution treats only real country values as Local/International - Unknown is excluded, never folded into Local', () => {
    const accounts = [
      account({ id: '1', country: 'Local' }),
      account({ id: '2', country: 'International' }),
      account({ id: '3', country: 'Unknown' }),
      account({ id: '4', country: null }),
    ];
    const dist = getMarketDistribution(accounts);
    const local = dist.find((r) => r.id === 'Local')?.count || 0;
    const intl = dist.find((r) => r.id === 'International')?.count || 0;
    expect(local + intl).toBe(2);
    expect(intl).toBe(1);
  });

  it('trial state distribution uses only the canonical resolver vocabulary (active/expiringSoon/expired/none)', () => {
    const accounts = [
      account({ id: '1', trial_ends_at: days(10) }),
      account({ id: '2', trial_ends_at: days(2) }),
      account({ id: '3', trial_ends_at: days(-5) }),
      account({ id: '4', trial_ends_at: null }),
    ];
    const dist = getTrialStateDistribution(accounts);
    for (const row of dist) {
      expect(['active', 'expiringSoon', 'expired', 'none']).toContain(row.id);
    }
  });
});
