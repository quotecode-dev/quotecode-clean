// Codex release 7 (Owner console 2026-10-30, decision 11; migration 20261030900000): every scheduled worker reports how its window
// ended - completed / partial / failed / skipped - to the database (scheduled_health_record; the WINDOW is derived there from the server
// time). A watcher outside Vercel alerts the Owner once when a window ends without a valid completion. Pure classification (tests run it
// under vitest); recording never breaks or delays the job itself, and only a CRON call is recorded (a manual run never satisfies a window).

export type HealthEvent = 'completed' | 'partial' | 'failed' | 'skipped';
export type ScheduledJob = 'daily-cron' | 'support-digest' | 'expense-scan' | 'support-weekly-review' | 'billing-reconcile' | 'agents-weekly' | 'agents-daily';
type Body = Record<string, unknown> | null | undefined;

const code = (v: unknown, fallback: string) => (typeof v === 'string' && /^[a-z0-9_:-]{1,60}$/.test(v) ? v : fallback);

/** How one worker answer ends its window; null = this slot is not the job's window (the paired DST slot) - nothing is recorded. */
export function classifyRun(job: ScheduledJob, status: number, body: Body): { event: HealthEvent; outcome: string } | null {
  const b = body ?? {};
  if (b.skipped === 'not_digest_hour' || b.skipped === 'not_review_time') return null;
  if (status >= 400 || !body) return { event: 'failed', outcome: code(b.code, `http_${status}`) };
  switch (job) {
    case 'support-digest':
      if (b.skipped === 'already_sent') return { event: 'skipped', outcome: 'already_sent' };
      if (b.skipped === 'no_owner_address') return { event: 'partial', outcome: 'no_owner_address' };
      return b.sent === true ? { event: 'completed', outcome: 'sent' } : { event: 'failed', outcome: code(b.code, 'not_sent') };
    case 'support-weekly-review':
      if (b.skipped === 'already_reviewed') return { event: 'skipped', outcome: 'already_reviewed' };
      if (b.ok !== true) return { event: 'failed', outcome: code(b.code, 'failed') };
      return b.mailed === true ? { event: 'completed', outcome: 'mailed' } : { event: 'partial', outcome: 'not_mailed' };
    case 'billing-reconcile':
      if (b.status === 'already_ran_today') return { event: 'skipped', outcome: 'already_ran_today' };
      if (b.ok === true && b.status === 'ok') return b.mailed === false ? { event: 'partial', outcome: 'not_mailed' } : { event: 'completed', outcome: 'ok' };
      return { event: 'failed', outcome: code(b.status ?? b.code, 'failed') };
    case 'agents-weekly': {
      const results = Array.isArray(b.results) ? b.results as Array<{ status?: string }> : [];
      const ran = results.some((x) => x?.status !== 'already_ran');
      if (b.ok !== true || results.some((x) => x?.status === 'failed') || ((ran || b.mailAttempted === true) && b.mailed !== true)) return { event: 'failed', outcome: 'failed' };
      return ran ? { event: 'completed', outcome: 'ran' } : { event: 'skipped', outcome: 'already_ran' };
    }
    case 'agents-daily':
      if (b.ok !== true) return { event: 'failed', outcome: code(b.code, 'failed') };
      // Codex review 2026-10-31 F12: Shira's daily step and Maya's scan are part of the daily window too
      if (b.security === 'failed' || b.urgent === false || b.sitemap === 'failed' || b.articles === 'failed'
        || (b.social as { failed?: unknown } | undefined)?.failed === true || b.customerSuccess === 'failed') return { event: 'partial', outcome: 'partial' };
      return b.security === 'already_ran' ? { event: 'skipped', outcome: 'already_ran' } : { event: 'completed', outcome: 'ok' };
    case 'expense-scan': {
      if (b.ok !== true) return { event: 'failed', outcome: code(b.code, 'failed') };
      const partial = Number(b.remaining) > 0 || Number(b.failed) > 0 || (Array.isArray(b.errors) && b.errors.length > 0);
      return partial ? { event: 'partial', outcome: 'partial' } : { event: 'completed', outcome: 'ok' };
    }
    case 'daily-cron':
      // Codex review 2026-10-31 F10: the Vercel parent passes the steps that already failed before it called this worker (rates)
      if (Array.isArray(b.parentFailures) && b.parentFailures.length > 0) return { event: 'partial', outcome: `parent:${code(b.parentFailures[0], 'step')}` };
      return b.ok === false || (Array.isArray(b.errors) && b.errors.length > 0) ? { event: 'partial', outcome: 'send_errors' } : { event: 'completed', outcome: 'ok' };
  }
}

// deno-lint-ignore no-explicit-any
type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: any }> };

/** Records the window's end; any error is swallowed (the job's own answer is never changed by its report). */
export async function recordRun(admin: Rpc, job: ScheduledJob, status: number, body: Body): Promise<void> {
  const r = classifyRun(job, status, body);
  if (!r) return;
  try {
    const { error } = await admin.rpc('scheduled_health_record', { p_job: job, p_event: r.event, p_outcome: r.outcome });
    if (error) console.error(`scheduled health: not recorded (${job})`);
  } catch {
    console.error(`scheduled health: not recorded (${job})`);
  }
}
