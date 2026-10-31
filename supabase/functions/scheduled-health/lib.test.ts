// Codex release 7 (Owner 2026-10-30, decision 11): how each scheduled worker's answer ends its window, and the watcher's mail rules.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { classifyRun, recordRun } from '../_shared/scheduledHealth';
import { healthHandler, mailFor, type Item } from './lib';

describe('classifyRun - every worker answer', () => {
  it('the paired DST slot records nothing; an error status or no body is a failure', () => {
    expect(classifyRun('support-digest', 200, { ok: true, skipped: 'not_digest_hour' })).toBeNull();
    expect(classifyRun('support-weekly-review', 200, { ok: true, skipped: 'not_review_time' })).toBeNull();
    expect(classifyRun('billing-reconcile', 500, { ok: false, code: 'failed' })).toEqual({ event: 'failed', outcome: 'failed' });
    expect(classifyRun('agents-daily', 200, null)).toMatchObject({ event: 'failed' });
  });
  it('a 200 with a failure or a partial body is never "completed" (the wrappers\' blind spot)', () => {
    expect(classifyRun('support-weekly-review', 200, { ok: false, code: 'unreadable_answer' })).toEqual({ event: 'failed', outcome: 'unreadable_answer' });
    expect(classifyRun('support-weekly-review', 200, { ok: true, mailed: false })).toEqual({ event: 'partial', outcome: 'not_mailed' });
    expect(classifyRun('support-digest', 200, { ok: true, skipped: 'no_owner_address' })).toEqual({ event: 'partial', outcome: 'no_owner_address' });
    expect(classifyRun('expense-scan', 200, { ok: true, remaining: 3, failed: 0, errors: [] })).toEqual({ event: 'partial', outcome: 'partial' });
    expect(classifyRun('agents-daily', 200, { ok: true, articles: 'failed' })).toEqual({ event: 'partial', outcome: 'partial' });
    expect(classifyRun('agents-weekly', 200, { ok: true, results: [{ status: 'done' }], mailed: false })).toEqual({ event: 'failed', outcome: 'failed' });
  });
  it('completions and legitimate skips', () => {
    expect(classifyRun('support-digest', 200, { ok: true, sent: true })).toEqual({ event: 'completed', outcome: 'sent' });
    expect(classifyRun('support-digest', 200, { ok: true, skipped: 'already_sent' })).toEqual({ event: 'skipped', outcome: 'already_sent' });
    expect(classifyRun('billing-reconcile', 200, { ok: true, status: 'already_ran_today' })).toEqual({ event: 'skipped', outcome: 'already_ran_today' });
    expect(classifyRun('billing-reconcile', 200, { ok: true, status: 'ok', mailed: true })).toEqual({ event: 'completed', outcome: 'ok' });
    expect(classifyRun('agents-weekly', 200, { ok: true, results: [{ status: 'already_ran' }] })).toEqual({ event: 'skipped', outcome: 'already_ran' });
    expect(classifyRun('agents-daily', 200, { ok: true, security: 'done' })).toEqual({ event: 'completed', outcome: 'ok' });
    expect(classifyRun('expense-scan', 200, { ok: true, remaining: 0, failed: 0, errors: [] })).toEqual({ event: 'completed', outcome: 'ok' });
    expect(classifyRun('daily-cron', 200, { success: true, errors: [] })).toEqual({ event: 'completed', outcome: 'ok' });
  });
  it('recording never throws and never changes the answer', async () => {
    const admin = { rpc: vi.fn(async () => { throw new Error('down'); }) };
    await expect(recordRun(admin, 'support-digest', 200, { ok: true, sent: true })).resolves.toBeUndefined();
    const ok = { rpc: vi.fn(async () => ({ error: null })) };
    await recordRun(ok, 'billing-reconcile', 200, { ok: true, status: 'ok' });
    expect(ok.rpc).toHaveBeenCalledWith('scheduled_health_record', { p_job: 'billing-reconcile', p_event: 'completed', p_outcome: 'ok' });
    await recordRun(ok, 'support-digest', 200, { ok: true, skipped: 'not_digest_hour' });
    expect(ok.rpc).toHaveBeenCalledTimes(1);
  });
  it('every worker reports only its cron window', () => {
    const src = (p: string) => readFileSync(`supabase/functions/${p}`, 'utf8');
    expect(src('support-weekly-review/index.ts')).toContain("if (role === 'cron') await recordRun(admin, 'support-weekly-review'");
    expect(src('billing-reconcile/index.ts')).toContain("if (role === 'cron') await recordRun(admin, 'billing-reconcile'");
    expect(src('agents-room/index.ts')).toContain("if (role === 'cron' && (cronAction === 'run' || cronAction === 'daily')) await recordRun(admin");
    expect(src('expense-invoices/index.ts')).toContain("await recordRun(admin, 'expense-scan'");
    expect(src('support-digest/index.ts')).toContain("await recordRun(admin, 'support-digest', status, body)");
    expect(src('send-subscription-expiration-email/index.ts')).toContain("await recordRun(adminClient, 'daily-cron', 200, batchAnswer as never)");
  });
});

describe('the watcher', () => {
  const item = (o: Partial<Item> = {}): Item => ({ id: 1, job: 'support-digest', label: 'סיכום הפניות של הערב', window: '2026-10-30', kind: 'missed', mail: 'alert', ...o });
  it('the alert and the recovery are the spec\'s Hebrew sentences, each with its own stable key', () => {
    const a = mailFor(item());
    expect(a.subject).toBe('הרצה מתוזמנת לא הושלמה: סיכום הפניות של הערב');
    expect(a.text.split('\n')[0]).toBe('הרצה מתוזמנת לא הושלמה: סיכום הפניות של הערב. חלון ההרצה חלף ולא התקבלה השלמה תקינה. בדקו את הגדרות התזמון והחיבור.');
    expect(a.text).toContain('החלון: 30/10/2026');
    expect(a.idempotencyKey).toBe('tekango-schedule/v1/support-digest/2026-10-30/incident');
    const r = mailFor(item({ mail: 'recovery' }));
    expect(r.text.split('\n')[0]).toBe('ההרצה המתוזמנת חזרה לפעול: סיכום הפניות של הערב.');
    expect(r.idempotencyKey).toBe('tekango-schedule/v1/support-digest/2026-10-30/recovery');
  });
  it('only the schedule\'s secret opens it; a delivered mail is recorded once, a failed one stays pending', async () => {
    const deps = { secret: 's3cr3t', evaluate: vi.fn(async () => [item(), item({ id: 2, job: 'billing-reconcile' })]), mailed: vi.fn(async () => true), send: vi.fn(async (m: { idempotencyKey: string }) => !m.idempotencyKey.includes('billing')) };
    expect((await healthHandler(null, deps)).status).toBe(401);
    expect((await healthHandler('wrong!', deps)).status).toBe(401);
    expect(deps.evaluate).not.toHaveBeenCalled();
    const r = await healthHandler('s3cr3t', deps);
    expect(r.body).toEqual({ ok: true, incidents: 2, mailed: 1, pending: 1 });
    expect(deps.mailed).toHaveBeenCalledTimes(1);
    expect((await healthHandler('x', { ...deps, secret: '' })).status).toBe(500);
  });
});
