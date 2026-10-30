// Codex release 9, topic 11 (Owner 2026-10-29 L-22 rule, built 2026-10-30): the manager's "Run now" chain - every due agent, then the
// manager; fresh = latest attempt succeeded within 24 hours (exactly 24 is fresh); one step per call under a lease; the LIVE check is
// dispatched first and the manager waits for its answer or its deadline; ZERO email from the chain.
import { describe, it, expect, vi } from 'vitest';
import { chainStart, chainStep, isFresh, hourKey, partialOf, STEPS, LIVE_DEADLINE_MS, type Chain, type ChainDeps, type Latest, type Step } from './chain.ts';
import { REQUIRED_HEADERS } from './lib.ts';
import type { StageDeps } from './manager.ts';

const NOW = new Date('2026-10-30T07:00:00Z'); // 09:00 Israel
const H = 3_600_000;

function fake(latest: Latest = {}, over: Partial<StageDeps & ChainDeps> = {}) {
  let chain: Chain | null = null;
  let leased = false;
  let clock = NOW;
  const runs = new Map<string, { status: string; finished_at: string | null; data: Record<string, unknown>; error: string | null }>();
  const mails: string[] = [];
  const calls: string[] = [];
  const d = {
    caller: async () => 'admin',
    callerId: () => 'owner-1',
    now: () => clock,
    claim: async (agent: string, key: string) => { calls.push(`claim:${agent}`); const id = `${agent}-${key}`; if (runs.has(id)) return null; runs.set(id, { status: 'running', finished_at: null, data: {}, error: null }); return id; },
    finish: async (id: string, patch: Record<string, unknown>) => { const r = runs.get(id); if (r) Object.assign(r, patch); },
    monthCostUsd: async () => 0,
    recentRuns: async () => [],
    gsc: null,
    serviceStats: async () => ({ inquiries: {}, openItems: 0, topItems: [], chatQuestions: 0 }),
    fetchHead: async () => ({ status: 200, headers: Object.fromEntries(REQUIRED_HEADERS.map((h) => [h, 'x'])) }),
    versionJson: async () => ({ commit: 'abc' }),
    complete: async () => { throw new Error('no AI in this test'); },
    mailOwner: vi.fn(async (s: string) => { mails.push(s); return true; }),
    latestRuns: async () => latest,
    chainOfHour: async () => chain,
    chainCreate: async (hk: string, steps: Step[]) => { if (chain) return null; chain = { id: '00000000-0000-4000-8000-0000000000c1', hour_key: hk, status: 'running', steps, created_at: clock.toISOString(), finished_at: null }; return chain; },
    chainGet: async () => chain,
    chainActive: async () => (chain?.status === 'running' ? chain : null),
    chainLease: async () => { if (leased || !chain || chain.status !== 'running') return null; leased = true; return chain; },
    chainSave: async (_id: string, steps: Step[], status: Chain['status']) => { chain = { ...chain!, steps, status }; leased = false; },
    getRun: async (id: string) => runs.get(id) ?? null,
    dispatchLiveCheck: vi.fn(async () => 'ok' as const),
    paths: async () => ['/he', '/en'],
    openSocialSlots: async () => 0,
    runCustomerSuccessNow: vi.fn(async () => { calls.push('cs'); return { status: 'done' }; }),
    runSocialNow: vi.fn(async () => { calls.push('social'); return { status: 'done' }; }),
    runManagerNow: vi.fn(async () => { calls.push('manager'); return { status: 'done' }; }),
    ...over,
  } as unknown as StageDeps & ChainDeps;
  return { d, runs, mails, calls, get: () => chain!, tick: (ms: number) => { clock = new Date(clock.getTime() + ms); }, release: () => { leased = false; } };
}
const fresh = (hoursAgo: number, status = 'done', outcome?: string) => ({ lastTerminal: { status, finishedAt: new Date(NOW.getTime() - hoursAgo * H).toISOString(), outcome } });
const until = async (f: ReturnType<typeof fake>, n = 20) => { for (let i = 0; i < n && f.get().status === 'running'; i += 1) await chainStep(f.d, f.get().id); };

describe('fresh = the latest attempt succeeded at most 24 hours ago', () => {
  it('exactly 24 hours is still fresh; a minute more is not; a newer failure is not', () => {
    expect(isFresh(fresh(24), NOW)).toBe(true);
    expect(isFresh(fresh(24 + 1 / 60), NOW)).toBe(false);
    expect(isFresh(fresh(1, 'failed'), NOW)).toBe(false);
    expect(isFresh(undefined, NOW)).toBe(false);
  });
});

describe('the chain', () => {
  it('starts once per hour; a second click shows the same chain', async () => {
    const f = fake();
    const a = await chainStart(f.d);
    expect(a.body.chain).toMatchObject({ hour_key: hourKey(NOW), status: 'running' });
    expect((a.body.chain as Chain).steps.map((s) => s.step)).toEqual([...STEPS]);
    const b = await chainStart(f.d);
    expect((b.body.chain as Chain).id).toBe((a.body.chain as Chain).id);
  });
  it('fresh reports are skipped, a prepared week is skipped, Maya runs, the LIVE check is awaited, then the manager - no email at all', async () => {
    const f = fake({ seo: fresh(2), service: fresh(3), security: fresh(24), customer_success: fresh(30), live_check: fresh(30) });
    await chainStart(f.d);
    for (let i = 0; i < 6; i += 1) await chainStep(f.d, f.get().id);
    const st = () => Object.fromEntries(f.get().steps.map((s) => [s.step, s.status]));
    expect(st()).toMatchObject({ live_check: 'waiting', seo: 'skipped_fresh', service: 'skipped_fresh', security: 'skipped_fresh', customer_success: 'ran', social: 'skipped_week', live_wait: 'pending', manager: 'pending' });
    expect(f.d.dispatchLiveCheck).toHaveBeenCalledTimes(1);
    // the LIVE check has not answered: the manager waits
    await chainStep(f.d, f.get().id);
    expect(st().live_wait).toBe('waiting');
    expect(f.calls).not.toContain('manager');
    // the GitHub job reports
    const runId = f.get().steps.find((s) => s.step === 'live_check')!.runId!;
    Object.assign(f.runs.get(runId)!, { status: 'done', finished_at: NOW.toISOString(), data: { outcome: 'passed' } });
    await until(f);
    expect(st()).toMatchObject({ live_check: 'ran', live_wait: 'ran', manager: 'ran' });
    expect(f.get().status).toBe('done');
    expect(partialOf(f.get().steps)).toBe(false);
    expect(f.mails).toHaveLength(0);
  });
  it('the LIVE deadline: no answer within 35 minutes = failed, the manager still runs and the summary is partial', async () => {
    const f = fake({ seo: fresh(1), service: fresh(1), security: fresh(1), customer_success: fresh(1), live_check: fresh(48) });
    await chainStart(f.d);
    for (let i = 0; i < 7; i += 1) await chainStep(f.d, f.get().id);
    f.tick(LIVE_DEADLINE_MS + 1000);
    await until(f);
    const live = f.get().steps.find((s) => s.step === 'live_check')!;
    expect(live).toMatchObject({ status: 'failed', code: 'timeout' });
    expect(f.runs.get(live.runId!)).toMatchObject({ status: 'failed', error: 'no_result' });
    expect(f.calls).toContain('manager');
    expect(partialOf(f.get().steps)).toBe(true);
  });
  it('a recent inconclusive check is not re-run; no dispatch configured = failed with its reason', async () => {
    const a = fake({ live_check: fresh(2, 'done', 'inconclusive') });
    await chainStart(a.d); await chainStep(a.d, a.get().id);
    expect(a.get().steps[0]).toMatchObject({ step: 'live_check', status: 'not_run_inconclusive' });
    const b = fake({}, { dispatchLiveCheck: vi.fn(async () => 'not_configured' as const) });
    await chainStart(b.d); await chainStep(b.d, b.get().id);
    expect(b.get().steps[0]).toMatchObject({ status: 'failed', code: 'dispatch_not_configured' });
  });
  it('a second call while a step runs waits (the lease) - nothing runs twice', async () => {
    const f = fake();
    await chainStart(f.d);
    const leaseTaken = { ...f.d, chainLease: async () => null } as typeof f.d;
    const r = await chainStep(leaseTaken, f.get().id);
    expect(r.body).toMatchObject({ ok: true, busy: true });
    expect(f.d.dispatchLiveCheck).not.toHaveBeenCalled();
  });
  it('an agent already running is reported, not started again; the hour limit is said', async () => {
    const f = fake({ seo: { running: true }, live_check: fresh(2) });
    await chainStart(f.d);
    for (let i = 0; i < 2; i += 1) await chainStep(f.d, f.get().id);
    expect(f.get().steps[1]).toMatchObject({ step: 'seo', status: 'already_running' });
  });
});
