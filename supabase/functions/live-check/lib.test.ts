// Codex release 9, topic 10 (Owner console 2026-10-30: "מאשר לעומר פתח כניסה מיוחד בשרת, רק לשני חשבונות הבדיקה ..."): Omer's server
// side - the secret, a session for a registered persona only, the run row, the typed hash-only report, one Owner email for a failed
// SCHEDULED run (never for a manual or chain run).
import { describe, it, expect, vi } from 'vitest';
import { handle, readReport, summaryOf, COVERAGE, type LiveDeps, type RunRow } from './lib.ts';

const RUN = '00000000-0000-4000-8000-0000000000aa';
function deps(over: Partial<LiveDeps> = {}, run: RunRow | null = { id: RUN, agent: 'live_check', trigger: 'cron', status: 'running' }) {
  const finished: Record<string, unknown>[] = [];
  const d: LiveDeps = {
    secretOk: () => true,
    now: () => new Date('2026-10-30T05:20:00Z'),
    persona: async (p) => (p === 'il' ? { userId: 'u-il', email: 'omer-il@test.example' } : null),
    mintSession: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, token_type: 'bearer', user: { id: 'u-il' } }),
    claimScheduled: vi.fn(async () => RUN),
    getRun: async () => run,
    finishRun: vi.fn(async (_id, patch) => { finished.push(patch); return true; }),
    mailOwner: vi.fn(async () => true),
    recordHealth: vi.fn(async () => {}),
    signOut: vi.fn(async () => true),
    ...over,
  };
  return { d, finished };
}
const step = (ok: boolean, over = {}) => ({ market: 'il', size: '390x844', step: 'dashboard', ok, ...(ok ? {} : { code: 'overflow' }), ...over });

describe('the door: the secret and the two personas only', () => {
  it('without the secret nothing answers', async () => {
    const { d } = deps({ secretOk: () => false });
    expect((await handle({ action: 'session', persona: 'il' }, d)).status).toBe(403);
  });
  it('a session only for a registered (and marked) persona; an unknown persona or a mismatching session = refused', async () => {
    const { d } = deps();
    expect((await handle({ action: 'session', persona: 'il' }, d)).body).toMatchObject({ ok: true, session: { access_token: 'at' } });
    expect((await handle({ action: 'session', persona: 'intl' }, d)).body).toMatchObject({ ok: false, code: 'persona_not_registered' });
    expect((await handle({ action: 'session', persona: 'admin' }, d)).body).toMatchObject({ ok: false, code: 'bad_persona' });
    const other = deps({ mintSession: async () => ({ access_token: 'x', refresh_token: 'y', expires_in: 1, token_type: 'bearer', user: { id: 'someone-else' } }) });
    expect((await handle({ action: 'session', persona: 'il' }, other.d)).body).toMatchObject({ ok: false, code: 'session_failed' });
  });
});

describe('the session is ended after the run (review 30/10)', () => {
  it('signout ends the given session; anything that is not a token is refused', async () => {
    const { d } = deps();
    expect((await handle({ action: 'signout', accessToken: 'aaa.bbb.ccc' }, d)).body).toEqual({ ok: true });
    expect(d.signOut).toHaveBeenCalledWith('aaa.bbb.ccc');
    expect((await handle({ action: 'signout', accessToken: 'not a token' }, d)).body).toMatchObject({ ok: false, code: 'bad_token' });
    expect((await handle({ action: 'signout', accessToken: 'aaa.bbb.ccc' }, deps({ secretOk: () => false }).d)).status).toBe(403);
  });
});

describe('the run row', () => {
  it('a scheduled run claims today once; a manual / chain run must be the open admin row', async () => {
    const { d } = deps();
    expect((await handle({ action: 'begin' }, d)).body).toMatchObject({ ok: true, runId: RUN, origin: 'schedule' });
    const again = deps({ claimScheduled: async () => null });
    expect((await handle({ action: 'begin' }, again.d)).body).toMatchObject({ ok: true, skip: 'already_ran' });
    const manual = deps({}, { id: RUN, agent: 'live_check', trigger: 'admin', status: 'running' });
    expect((await handle({ action: 'begin', runId: RUN }, manual.d)).body).toMatchObject({ ok: true, origin: 'manual' });
    const closed = deps({}, { id: RUN, agent: 'live_check', trigger: 'admin', status: 'done' });
    expect((await handle({ action: 'begin', runId: RUN }, closed.d)).body).toMatchObject({ ok: false, code: 'run_not_open' });
  });
});

describe('the report: typed steps and hashes only', () => {
  it('free text, an unknown size or a pass with a failed step is refused', () => {
    expect(readReport({ runId: RUN, outcome: 'passed', steps: [step(true)] })).not.toBeNull();
    expect(readReport({ runId: RUN, outcome: 'passed', steps: [step(false)] })).toBeNull();
    expect(readReport({ runId: RUN, outcome: 'failed', steps: [step(true)] })).toBeNull();
    expect(readReport({ runId: RUN, outcome: 'failed', steps: [step(false, { code: 'The page said: secret text' })] })).toBeNull();
    expect(readReport({ runId: RUN, outcome: 'passed', steps: [step(true, { size: '100x100' })] })).toBeNull();
    expect(readReport({ runId: RUN, outcome: 'passed', steps: [step(true, { note: 'x' })] })).not.toBeNull(); // unknown fields are dropped
    expect(readReport({ runId: RUN, outcome: 'passed', steps: [step(true, { note: 'x' })] })!.steps[0]).not.toHaveProperty('note');
  });
  it('the spec sentences: healthy / a problem at a step for a market / inconclusive is never green', () => {
    expect(summaryOf('passed', [step(true) as never], null).summaryHe).toBe('בדיקת ה-LIVE במסגרת שאושרה תקינה.');
    expect(summaryOf('failed', [step(false) as never], null).summaryHe).toBe('בדיקת LIVE היומית מצאה תקלה במסך הבית של החשבון, בשוק ישראל.');
    expect(summaryOf('failed', [step(false) as never], null).summaryEn).toBe('The daily LIVE check found a problem at the account home screen for Israel.');
    expect(summaryOf('inconclusive', [], 'deploy_changed').summaryEn).toContain('does not confirm the site is healthy');
    expect(summaryOf('passed', [step(true) as never], null).findings.some((f) => f.he === COVERAGE.he)).toBe(true);
  });
  it('a failed SCHEDULED run: stored as failed, the watcher told, ONE Owner email', async () => {
    const { d, finished } = deps();
    const r = await handle({ action: 'report', runId: RUN, outcome: 'failed', steps: [step(false)] }, d);
    expect(r.body).toMatchObject({ ok: true, outcome: 'failed', mailed: true });
    expect(finished[0]).toMatchObject({ status: 'failed', data: { outcome: 'failed' } });
    expect(d.recordHealth).toHaveBeenCalledWith('failed', 'failed');
    expect(d.mailOwner).toHaveBeenCalledTimes(1);
    expect((d.mailOwner as ReturnType<typeof vi.fn>).mock.calls[0][2]).toBe(`tekango-live-check/v1/${RUN}`);
  });
  it('a manual or chain run never emails; an inconclusive run is stored as done with its outcome (never green on the screen)', async () => {
    const manual = deps({}, { id: RUN, agent: 'live_check', trigger: 'admin', status: 'running' });
    await handle({ action: 'report', runId: RUN, outcome: 'failed', steps: [step(false)] }, manual.d);
    expect(manual.d.mailOwner).not.toHaveBeenCalled();
    expect(manual.d.recordHealth).not.toHaveBeenCalled();
    const inc = deps();
    await handle({ action: 'report', runId: RUN, outcome: 'inconclusive', steps: [step(true)], reason: 'deploy_changed' }, inc.d);
    expect(inc.finished[0]).toMatchObject({ status: 'done', data: { outcome: 'inconclusive', reason: 'deploy_changed' } });
    expect(inc.d.recordHealth).toHaveBeenCalledWith('partial', 'inconclusive');
    expect(inc.d.mailOwner).not.toHaveBeenCalled();
  });
  it('a report for a closed run changes nothing', async () => {
    const { d } = deps({}, { id: RUN, agent: 'live_check', trigger: 'cron', status: 'done' });
    expect((await handle({ action: 'report', runId: RUN, outcome: 'passed', steps: [step(true)] }, d)).body).toMatchObject({ ok: false, code: 'run_not_open' });
  });
});
