import { describe, it, expect } from 'vitest';
import { resolveTrialReminderStage, MS_PER_DAY } from './eligibility.ts';

const NOW = Date.parse('2026-08-31T00:00:00.000Z');

function baseCandidate(overrides = {}) {
  return {
    email: 'tenant@example.com',
    role: 'user',
    plan: 'pro',
    trial_ends_at: new Date(NOW + 2 * MS_PER_DAY).toISOString(),
    trial_reminder_3d_sent: false,
    trial_reminder_24h_sent: false,
    ...overrides,
  };
}

describe('resolveTrialReminderStage', () => {
  it('selects the 3-day stage when 1 < daysLeft <= 3 and not yet sent', () => {
    const biz = baseCandidate({ trial_ends_at: new Date(NOW + 2.5 * MS_PER_DAY).toISOString() });
    expect(resolveTrialReminderStage(biz, NOW)).toBe('3d');
  });

  it('selects the 24-hour stage when 0 < daysLeft <= 1 and not yet sent', () => {
    const biz = baseCandidate({ trial_ends_at: new Date(NOW + 0.5 * MS_PER_DAY).toISOString() });
    expect(resolveTrialReminderStage(biz, NOW)).toBe('24h');
  });

  it('excludes a candidate outside both windows (still 5 days out)', () => {
    const biz = baseCandidate({ trial_ends_at: new Date(NOW + 5 * MS_PER_DAY).toISOString() });
    expect(resolveTrialReminderStage(biz, NOW)).toBeNull();
  });

  it('excludes an already-expired trial (daysLeft <= 0)', () => {
    const biz = baseCandidate({ trial_ends_at: new Date(NOW - 1 * MS_PER_DAY).toISOString() });
    expect(resolveTrialReminderStage(biz, NOW)).toBeNull();
  });

  it('REGRESSION: excludes a genuine FREE-plan account (the exact P0 bug scenario) even with a stray trial_ends_at', () => {
    const biz = baseCandidate({ plan: 'free', trial_ends_at: new Date(NOW + 2 * MS_PER_DAY).toISOString() });
    expect(resolveTrialReminderStage(biz, NOW)).toBeNull();
  });

  it('REGRESSION: includes a genuine active-trial account (plan pro, real future trial_ends_at) — the actual bug fix', () => {
    const biz = baseCandidate({ plan: 'pro', trial_ends_at: new Date(NOW + 2.5 * MS_PER_DAY).toISOString() });
    expect(resolveTrialReminderStage(biz, NOW)).toBe('3d');
  });

  it('excludes a paid/non-trial BASIC account', () => {
    const biz = baseCandidate({ plan: 'basic' });
    expect(resolveTrialReminderStage(biz, NOW)).toBeNull();
  });

  it('excludes a Lifetime PRO account (trial_ends_at null)', () => {
    const biz = baseCandidate({ trial_ends_at: null });
    expect(resolveTrialReminderStage(biz, NOW)).toBeNull();
  });

  it('excludes a super_admin account regardless of plan/trial shape', () => {
    const biz = baseCandidate({ role: 'super_admin' });
    expect(resolveTrialReminderStage(biz, NOW)).toBeNull();
  });

  it('excludes a candidate with no email', () => {
    const biz = baseCandidate({ email: null });
    expect(resolveTrialReminderStage(biz, NOW)).toBeNull();
  });

  it('idempotency: does not re-select the 3-day stage once trial_reminder_3d_sent is true', () => {
    const biz = baseCandidate({ trial_ends_at: new Date(NOW + 2.5 * MS_PER_DAY).toISOString(), trial_reminder_3d_sent: true });
    expect(resolveTrialReminderStage(biz, NOW)).toBeNull();
  });

  it('idempotency: does not re-select the 24-hour stage once trial_reminder_24h_sent is true', () => {
    const biz = baseCandidate({ trial_ends_at: new Date(NOW + 0.5 * MS_PER_DAY).toISOString(), trial_reminder_24h_sent: true });
    expect(resolveTrialReminderStage(biz, NOW)).toBeNull();
  });

  it('still selects the 24-hour stage even if the 3-day stage was already sent (progression, not a re-send)', () => {
    const biz = baseCandidate({ trial_ends_at: new Date(NOW + 0.5 * MS_PER_DAY).toISOString(), trial_reminder_3d_sent: true, trial_reminder_24h_sent: false });
    expect(resolveTrialReminderStage(biz, NOW)).toBe('24h');
  });

  it('is timezone-safe: uses absolute epoch ms, not local calendar days', () => {
    const biz = baseCandidate({ trial_ends_at: new Date(NOW + 2.9 * MS_PER_DAY).toISOString() });
    expect(resolveTrialReminderStage(biz, NOW)).toBe('3d');
  });
});
