// Codex release 9, topic 11 (Owner 2026-10-29 L-22 rule "run now = every due agent, then the manager", built with the two new roles;
// Owner console 2026-10-30 continuous-work approval): the manager's "Run now" is a durable job (agent_chains), not one long request.
//  - Each call runs ONE step under a database lease (a second tab / a double click waits); the steps and their results are stored, so a
//    refresh or a closed tab continues where it stopped and nothing that finished runs again.
//  - Order: the external LIVE check is dispatched first (it runs on GitHub), then SEO, service, security, Customer Success and the missing
//    social posts; the manager runs only after the LIVE check answered or its 35-minute deadline passed.
//  - A step runs only when its report is missing, older than 24 hours or its latest attempt failed (exactly 24 hours is still fresh).
//  - origin = manual_manager_chain, allowEmail = false: no step of the chain sends an email (to the Owner or to a customer) - the manager's
//    and the specialists' admin runs never mail, Customer Success only drafts, and the LIVE check is dispatched with origin "chain".
import { israelParts, runKey, handler, monthStartIso, MONTHLY_CAP_USD } from './lib.ts';
import type { StageDeps } from './manager.ts';

export const STEPS = ['live_check', 'seo', 'service', 'security', 'customer_success', 'social', 'live_wait', 'manager'] as const;
export type StepId = typeof STEPS[number];
export type StepStatus = 'pending' | 'ran' | 'skipped_fresh' | 'skipped_week' | 'already_running' | 'waiting' | 'not_run_hour' | 'not_run_budget'
  | 'not_run_inconclusive' | 'failed';
export type Step = { step: StepId; status: StepStatus; at?: string; code?: string; runId?: string; dispatchedAt?: string };
export type Chain = { id: string; hour_key: string; status: 'running' | 'done' | 'failed'; steps: Step[]; created_at: string; finished_at: string | null; lease_until?: string | null };
export type Latest = Record<string, { lastDone?: { finishedAt: string | null; outcome?: string | null } | null;
  lastTerminal?: { status: string; finishedAt: string | null; outcome?: string | null } | null; running?: boolean }>;

export const DAY_MS = 86_400_000;
export const LIVE_DEADLINE_MS = 35 * 60_000;
export const LEASE_SECONDS = 170;

export interface ChainDeps {
  callerId(): string | null;
  latestRuns(): Promise<Latest>;
  chainOfHour(hourKey: string): Promise<Chain | null>;
  chainCreate(hourKey: string, steps: Step[], createdBy: string): Promise<Chain | null>; // null = this hour already has one
  chainGet(id: string): Promise<Chain | null>;
  chainActive(): Promise<Chain | null>; // the newest running chain (a refreshed screen continues it)
  chainLease(id: string, seconds: number): Promise<Chain | null>; // null = another call holds it, or it ended
  // also releases the lease - written only while this call still holds the lease it took (a slower call never overwrites a newer one)
  chainSave(id: string, steps: Step[], status: Chain['status'], lease: string | null): Promise<void>;
  getRun(id: string): Promise<{ status: string; finished_at: string | null; data: Record<string, unknown>; error: string | null } | null>;
  dispatchLiveCheck(runId: string): Promise<'ok' | 'not_configured' | 'failed'>;
  openSocialSlots(): Promise<number>;
  paths(): Promise<string[]>; // the sitemap's public pages (the security agent checks them)
  runCustomerSuccessNow(): Promise<{ status: string; error?: string }>;
  runSocialNow(): Promise<{ status: string; error?: string }>;
  runManagerNow(): Promise<{ status: string; error?: string }>;
}
type Out = { status: number; body: Record<string, unknown> };
type D = StageDeps & ChainDeps;

const age = (now: Date, iso: string | null | undefined) => (iso ? now.getTime() - Date.parse(iso) : Infinity);
/** Fresh = the latest terminal attempt succeeded and finished at most 24 hours ago (a newer failure makes an older success stale). */
export function isFresh(l: Latest[string] | undefined, now: Date): boolean {
  const t = l?.lastTerminal;
  return !!t && t.status === 'done' && age(now, t.finishedAt) <= DAY_MS;
}
export const hourKey = (now: Date) => { const p = israelParts(now); return `chain:${p.day}T${p.hour}`; };
export const partialOf = (steps: Step[]) => steps.some((s) => s.status === 'failed' || s.status.startsWith('not_run') || s.status === 'already_running');

const mapRun = (status: string): StepStatus => (status === 'done' ? 'ran' : status === 'already_ran' ? 'not_run_hour' : status === 'skipped_cap' ? 'not_run_budget' : 'failed');

export async function chainStart(d: D): Promise<Out> {
  const uid = d.callerId();
  if (!uid) return { status: 403, body: { ok: false, code: 'forbidden' } };
  const active = await d.chainActive();
  if (active) return { status: 200, body: { ok: true, chain: active } };
  const key = hourKey(d.now());
  const created = await d.chainCreate(key, STEPS.map((step) => ({ step, status: 'pending' as const })), uid);
  if (created) return { status: 200, body: { ok: true, chain: created } };
  // the hour guard: this hour's chain already ran - it is shown, never a new key to get around it
  return { status: 200, body: { ok: true, chain: await d.chainOfHour(key), hourLimit: true } };
}

async function runStep(d: D, s: Step, steps: Step[], latest: Latest, now: Date): Promise<Step> {
  const at = now.toISOString();
  const info = latest[s.step === 'live_wait' ? 'live_check' : s.step];
  switch (s.step) {
    case 'live_check': {
      if (info?.running) return { ...s, status: 'already_running', at };
      const t = info?.lastTerminal;
      if (t && t.status === 'done' && age(now, t.finishedAt) <= DAY_MS) {
        return { ...s, status: t.outcome === 'inconclusive' ? 'not_run_inconclusive' : 'skipped_fresh', at };
      }
      const runId = await d.claim('live_check', runKey('admin', now), 'admin');
      if (!runId) return { ...s, status: 'not_run_hour', at };
      const sent = await d.dispatchLiveCheck(runId);
      if (sent === 'ok') return { ...s, status: 'waiting', at, runId, dispatchedAt: at };
      await d.finish(runId, { status: 'failed', finished_at: at, error: sent === 'not_configured' ? 'dispatch_not_configured' : 'dispatch_failed' });
      return { ...s, status: 'failed', at, code: sent === 'not_configured' ? 'dispatch_not_configured' : 'dispatch_failed' };
    }
    case 'seo': case 'service': case 'security': {
      if (info?.running) return { ...s, status: 'already_running', at };
      if (isFresh(info, now)) return { ...s, status: 'skipped_fresh', at };
      const r = await handler({ action: 'run', agent: s.step }, d, () => d.paths(), { mail: false });
      const x = ((r.body.results ?? []) as { status: string; error?: string | null }[])[0];
      return { ...s, status: x ? mapRun(x.status) : 'failed', at, ...(x?.error ? { code: String(x.error).slice(0, 60) } : {}) };
    }
    case 'customer_success': {
      if (info?.running) return { ...s, status: 'already_running', at };
      if (isFresh(info, now)) return { ...s, status: 'skipped_fresh', at };
      const r = await d.runCustomerSuccessNow();
      return { ...s, status: mapRun(r.status), at, ...(r.error ? { code: r.error.slice(0, 60) } : {}) };
    }
    case 'social': {
      if (info?.running) return { ...s, status: 'already_running', at };
      if ((await d.openSocialSlots()) === 0) return { ...s, status: 'skipped_week', at };
      if ((await d.monthCostUsd(monthStartIso(now))) >= MONTHLY_CAP_USD) return { ...s, status: 'not_run_budget', at };
      const r = await d.runSocialNow();
      return { ...s, status: mapRun(r.status), at, ...(r.error ? { code: r.error.slice(0, 60) } : {}) };
    }
    case 'live_wait': {
      const live = steps.find((x) => x.step === 'live_check');
      if (!live || live.status !== 'waiting' || !live.runId) return { ...s, status: live?.status === 'waiting' ? 'failed' : 'skipped_fresh', at };
      const run = await d.getRun(live.runId);
      if (run && run.status !== 'running') {
        const outcome = String(run.data?.outcome ?? '');
        return { ...s, status: run.status === 'done' && outcome === 'passed' ? 'ran' : run.status === 'done' && outcome === 'inconclusive' ? 'not_run_inconclusive' : 'failed', at,
          ...(run.error ? { code: run.error.slice(0, 60) } : outcome && outcome !== 'passed' ? { code: outcome } : {}) };
      }
      if (age(now, live.dispatchedAt) < LIVE_DEADLINE_MS) return { ...s, status: 'waiting', at };
      await d.finish(live.runId, { status: 'failed', finished_at: at, error: 'no_result' });
      return { ...s, status: 'failed', at, code: 'timeout' };
    }
    case 'manager': {
      const r = await d.runManagerNow();
      return { ...s, status: mapRun(r.status), at, ...(r.error ? { code: r.error.slice(0, 60) } : {}) };
    }
  }
  return { ...s, status: 'failed', at, code: 'unknown_step' };
}

/** One call = at most one step. The screen calls again while the chain runs (a waiting LIVE check returns at once). */
export async function chainStep(d: D, id: unknown): Promise<Out> {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) return { status: 400, body: { ok: false, code: 'bad_chain' } };
  const held = await d.chainLease(id, LEASE_SECONDS);
  if (!held) {
    const c = await d.chainGet(id);
    return c ? { status: 200, body: { ok: true, chain: c, busy: c.status === 'running' } } : { status: 404, body: { ok: false, code: 'not_found' } };
  }
  const steps = held.steps.map((x) => ({ ...x }));
  const i = steps.findIndex((x) => x.status === 'pending' || (x.step === 'live_wait' && x.status === 'waiting'));
  if (i < 0) {
    await d.chainSave(id, steps, 'done', held.lease_until ?? null);
    return { status: 200, body: { ok: true, chain: { ...held, steps, status: 'done' }, partial: partialOf(steps) } };
  }
  let next: Step;
  try {
    next = await runStep(d, steps[i], steps, await d.latestRuns(), d.now());
  } catch (e) {
    next = { ...steps[i], status: 'failed', at: d.now().toISOString(), code: String((e as Error)?.message ?? 'failed').slice(0, 60) };
  }
  steps[i] = next;
  // the LIVE check's own row shows its answer once it came (or its deadline passed)
  const live = steps.findIndex((x) => x.step === 'live_check');
  if (next.step === 'live_wait' && next.status !== 'waiting' && live >= 0 && steps[live].status === 'waiting') steps[live] = { ...steps[live], status: next.status, ...(next.code ? { code: next.code } : {}) };
  const done = !steps.some((x) => x.status === 'pending' || (x.step === 'live_wait' && x.status === 'waiting'));
  await d.chainSave(id, steps, done ? 'done' : 'running', held.lease_until ?? null);
  return { status: 200, body: { ok: true, chain: { ...held, steps, status: done ? 'done' : 'running' }, ...(done ? { partial: partialOf(steps) } : {}) } };
}
