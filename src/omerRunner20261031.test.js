// Codex review 2026-10-31 group 5, F22 (Owner console, typed: "מאשר את שש הקבוצות של קודקס ... L-22 ..." + the night task): Omer's runner
// retries a transient result once (a slow sign-in, a plans window that did not open, a timeout, no answer, a 5xx), never a real defect;
// F24: the sign-out runs in a finally per market and names its persona; F27: a bare hand dispatch never starts the job.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { withRetry, TRANSIENT } from '../scripts/live-check/runner.mjs';

describe('withRetry', () => {
  it('a transient result is tried once more; a real defect is final at once', async () => {
    const flaky = vi.fn().mockResolvedValueOnce({ ok: false, code: 'not_signed_in' }).mockResolvedValueOnce({ ok: true, hash: 'h' });
    expect(await withRetry(flaky)).toEqual({ ok: true, hash: 'h' });
    expect(flaky).toHaveBeenCalledTimes(2);
    const defect = vi.fn(async () => ({ ok: false, code: 'overflow' }));
    expect(await withRetry(defect)).toEqual({ ok: false, code: 'overflow' });
    expect(defect).toHaveBeenCalledTimes(1);
    const thrown = vi.fn().mockRejectedValueOnce(new Error('Timeout 45000ms')).mockResolvedValueOnce({ ok: true });
    expect(await withRetry(thrown)).toEqual({ ok: true });
    for (const c of ['not_signed_in', 'plans_not_open', 'timeout', 'error', 'http_0', 'http_503']) expect(TRANSIENT.test(c)).toBe(true);
    for (const c of ['overflow', 'direction', 'font', 'page_error', 'http_404']) expect(TRANSIENT.test(c)).toBe(false);
  });
  it('past the job budget a transient result is not retried', async () => {
    const f = vi.fn(async () => ({ ok: false, code: 'timeout' }));
    expect(await withRetry(f, Date.now() - 10, 0)).toEqual({ ok: false, code: 'budget' });
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('the runner and the workflow', () => {
  const runner = readFileSync('scripts/live-check/runner.mjs', 'utf8');
  it('F24: every market signs out in a finally, naming its persona; a refused sign-out makes the run inconclusive', () => {
    expect(runner).toContain("const out = await call({ action: 'signout', persona: market, accessToken: session.access_token }).catch(() => null);");
    expect(runner).toContain("if (!(out?.status === 200 && out.body?.ok === true)) reason = reason ?? 'signout_failed';");
    expect(runner).toMatch(/\} finally \{\r?\n\s+if \(session\) \{/);
  });
  it('F27: only the schedule or an agents-room run id starts the job', () => {
    expect(readFileSync('.github/workflows/daily-live-check.yml', 'utf8')).toContain("(github.event_name == 'schedule' || inputs.run_id != '')");
  });
});
