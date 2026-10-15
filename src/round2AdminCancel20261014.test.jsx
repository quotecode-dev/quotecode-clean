// Owner round 2 (2026-10-14, Codex spec A7 / A8 / A10 approved): admin indicator tags and status filter; the cancellation-request
// link in Settings › My subscription.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// No network, no real client.
vi.mock('./shared/supabase', () => ({ supabase: { rpc: vi.fn(async () => ({ data: null, error: { code: 'PGRST202' } })) } }));
import { accountIndicators, matchesStatusFilter } from './domain/subscriptions/adminAccountSummary';
import { AdminAccountIndicators } from './components/AdminSubscriptionState';

afterEach(() => cleanup());
const read = (p) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), p), 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));
const NOW = Date.parse('2026-10-14T12:00:00Z');
const fmt = () => '01/11/2026';

describe('admin indicators', () => {
  it('lifetime is an independent tag even while the plan system is not active', () => {
    const t = accountIndicators({ is_lifetime: true, trial_ends_at: '2026-12-01' }, { state: 'not_activated' }, { isHebrew: true, formatDate: fmt, now: NOW });
    expect(t.map((x) => x.key)).toEqual(['lifetime']);
    expect(t[0].text).toBe('לכל החיים');
  });
  it('legacy trial: active with its date / ended; never a new-trial wording', () => {
    expect(accountIndicators({ trial_ends_at: '2026-11-01' }, { state: 'not_activated' }, { isHebrew: true, formatDate: fmt, now: NOW })[0].text).toBe('ניסיון ישן עד 01/11/2026');
    expect(accountIndicators({ trial_ends_at: '2026-09-01' }, null, { isHebrew: false, now: NOW })[0].text).toBe('Legacy trial ended');
  });
  it('a ready summary adds assignment, Free-10 (prepared vs enforced) and the subscription state; unprovisioned is flagged', () => {
    const prepared = accountIndicators({}, { state: 'ready', planId: 'free', free10: { remaining: 7, limit: 10 }, phase: { output: 'prepared' }, subscriptionStatus: 'none' }, { isHebrew: true, now: NOW });
    expect(prepared.map((x) => x.text)).toEqual(['שויך למערכת המסלולים', 'Free-10: מוכן, לא נאכף', 'ללא מנוי']);
    const enforced = accountIndicators({}, { state: 'ready', planId: 'free', free10: { remaining: 7, limit: 10 }, phase: { output: 'enforced' } }, { isHebrew: false, now: NOW });
    expect(enforced.find((x) => x.key === 'free10').text).toBe('Free-10: 7/10 left');
    expect(accountIndicators({}, { state: 'unprovisioned' }, { isHebrew: true, now: NOW })[0].text).toBe('טרם שויך למערכת המסלולים');
  });
  it('unknown / missing data gives no tag (never "free")', () => {
    expect(accountIndicators({}, { state: 'unavailable' }, { isHebrew: true, now: NOW })).toEqual([]);
    const { container } = render(<AdminAccountIndicators account={{}} summary={{ state: 'not_activated' }} isHebrew />);
    expect(container.textContent).toContain('—');
  });
  it('status filter', () => {
    const lifetime = { is_lifetime: true }; const active = { trial_ends_at: '2026-11-01' }; const ended = { trial_ends_at: '2026-09-01' }; const none = {};
    expect([lifetime, active, ended, none].map((a) => matchesStatusFilter(a, 'lifetime', NOW))).toEqual([true, false, false, false]);
    expect([lifetime, active, ended, none].map((a) => matchesStatusFilter(a, 'trial_active', NOW))).toEqual([false, true, false, false]);
    expect([lifetime, active, ended, none].map((a) => matchesStatusFilter(a, 'trial_ended', NOW))).toEqual([false, false, true, false]);
    expect([lifetime, active, ended, none].map((a) => matchesStatusFilter(a, 'none', NOW))).toEqual([false, false, false, true]);
    expect(matchesStatusFilter(lifetime, 'all', NOW)).toBe(true);
  });
  it('the users view shows the indicators column and the filter instead of the raw legacy record', () => {
    const v = read('components/AdminUsersView.jsx');
    expect(v).toContain("[isHebrew ? 'חיוויים' : 'Indicators', null]");
    expect(v).not.toContain("'רשומת מורשת (היסטוריה)'");
    expect(v).toContain('matchesStatusFilter(account, statusFilter)');
  });
});

describe('Settings › My subscription: the cancellation-request link (not lifetime, not super admin)', () => {
  it('reuses the plans-window cancellation model (email request + terms link), inside the non-lifetime block', () => {
    const s = read('components/SettingsTab.jsx');
    const block = s.slice(s.indexOf('{!isSuperAdmin && !lifetimeAccount && ('), s.indexOf('</section>', s.indexOf('{!isSuperAdmin && !lifetimeAccount && (')));
    expect(block).toContain('data-testid="settings-subscription-cancellation"');
    expect(block).toContain('<a href={subscriptionOffer.cancellation.href}');
    expect(block).toContain('{subscriptionOffer.cancellation.termsLabel}</a>');
  });
});
