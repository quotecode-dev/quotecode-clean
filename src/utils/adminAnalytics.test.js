import { describe, it, expect } from 'vitest';
import * as analytics from './adminAnalytics';
import { getLegacyRecordBreakdown, getMarketDistribution, getAdminKpiSummary, LEGACY_HISTORY_LABEL } from './adminAnalytics';

const total = (rows, prefix) => rows.filter((r) => r.key.startsWith(prefix)).reduce((s, r) => s + r.count, 0);

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
    expect(total(getLegacyRecordBreakdown(accounts, now), 'plan=')).toBe(1);
  });

  it('excludes soft-deleted rows (deleted_ email prefix / business_name "deleted")', () => {
    const accounts = [
      account({ id: '1', email: 'deleted_x@example.com' }),
      account({ id: '2', business_name: 'deleted' }),
      account({ id: '3' }),
    ];
    expect(total(getLegacyRecordBreakdown(accounts, now), 'plan=')).toBe(1);
  });

  it('getAdminKpiSummary never derives an "active now"/online signal - only structural facts', () => {
    const summary = getAdminKpiSummary([account({ id: '1' })], now);
    // The Owner's binding rule forbids surfacing last-sign-in-recency at
    // all - this locks the summary's own key set so a future edit can't
    // silently reintroduce an "activeNow"/"onlineCount" field.
    // OD-16/OD-20: no trial/plan KPI is derived from the legacy fields any more.
    expect(Object.keys(summary).sort()).toEqual(['managedBusinesses', 'registrationsLast24h'].sort());
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

  it('legacy record breakdown counts RAW lowercase technical values only (no Basic/Pro/trial/LIFETIME identity, no new-model plan)', () => {
    const accounts = [
      account({ id: '1', plan: 'PRO', is_lifetime: false, trial_ends_at: days(10) }),
      account({ id: '2', plan: 'basic', is_lifetime: true, trial_ends_at: days(-5) }),
      account({ id: '3', plan: null, is_lifetime: null, trial_ends_at: null }),
      account({ id: '4', plan: 'free', is_lifetime: false, trial_ends_at: 'not-a-date' }),
    ];
    const rows = getLegacyRecordBreakdown(accounts, now);
    const map = Object.fromEntries(rows.map((r) => [r.key, r.count]));
    expect(map).toEqual({
      'plan=basic': 1, 'plan=free': 1, 'plan=null': 1, 'plan=pro': 1,
      'is_lifetime=false': 2, 'is_lifetime=null': 1, 'is_lifetime=true': 1,
      'trial_ends_at<=now': 1, 'trial_ends_at=invalid': 1, 'trial_ends_at=null': 1, 'trial_ends_at>now': 1,
    });
    for (const r of rows) {
      expect(r.key).toMatch(/^(plan|is_lifetime|trial_ends_at)[=<>]/);
      expect(r.key).toBe(r.key.toLowerCase());
      expect(r.key).not.toMatch(/Basic|Pro\b|FREE|PRO|BASIC|LIFETIME|Lifetime|trial\b|Classic|Modern|Visual|unlimited/);
    }
    expect(LEGACY_HISTORY_LABEL).toEqual({ he: 'רשומת מורשת (היסטוריה)', en: 'Legacy record (history)' });
  });

  it('no legacy-derived plan identity/trial distribution is exported any more', () => {
    for (const name of ['getPlanDistribution', 'getTrialStateDistribution', 'getPlanSortRank', 'PLAN_SORT_RANK']) {
      expect(analytics[name]).toBeUndefined();
    }
  });
});
