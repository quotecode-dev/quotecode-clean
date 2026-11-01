// live-check - Omer, the daily LIVE check (Codex release 9, topic 10). Owner console 2026-10-30, typed: "מאשר לעומר פתח כניסה מיוחד בשרת,
// רק לשני חשבונות הבדיקה. הבדיקה תהיה מלאה יותר, אבל זה פתח כניסה חדש ורגיש" + decisions 17-20 as recommended (the two test accounts
// only, their records kept and not counted; login and pages, no purchase - signup and payment are not tested; fingerprints only, no
// screenshots; a 10 USD monthly runner cap, exact GitHub permissions, no general admin key). Pure logic (vitest); index.ts is wiring.
//  - Every call carries the shared secret (x-live-check-secret = LIVE_CHECK_SECRET, constant time) - only the GitHub job has it.
//  - "session": a sign-in session for ONE of the two registered personas (live_check_personas, each also a marked test account) - never
//    for any other account, whatever is asked.
//  - "begin" / "report": the run row in the agents room (agent_runs, agent live_check). A report holds typed steps and hashes only - no
//    free text, no screenshot, no page content. A failed SCHEDULED run emails the Owner once; a manual or chain run never emails.

export type Persona = 'il' | 'intl';
export type StepResult = { market: Persona; size: string; step: string; ok: boolean; code?: string; hash?: string };
export type Outcome = 'passed' | 'failed' | 'inconclusive';
export type RunRow = { id: string; agent: string; trigger: string; status: string };
export type Session = { access_token: string; refresh_token: string; expires_in: number; expires_at?: number; token_type: string; user: { id: string; email?: string } };

export interface LiveDeps {
  secretOk(): boolean;
  now(): Date;
  persona(p: Persona): Promise<{ userId: string; email: string } | null>;
  mintSession(email: string): Promise<Session | null>;
  claimScheduled(runKey: string): Promise<string | null>; // null = today's scheduled run exists
  getRun(id: string): Promise<RunRow | null>;
  finishRun(id: string, patch: Record<string, unknown>): Promise<boolean>; // only while it is still running
  mailOwner(subject: string, text: string, key: string): Promise<boolean>;
  recordHealth(event: 'completed' | 'failed' | 'partial', outcome: string): Promise<void>;
  signOut(accessToken: string): Promise<boolean>; // ends the session this run used (review 30/10: no long-lived refresh token is left)
  // Codex review 2026-10-31 F27: the LIVE-check runs started this month (scheduled + manual) - the monthly runner cap is enforced here
  monthRuns?(): Promise<number>;
}
// F27: at most 40 runs a month (40 x 30 minutes x 0.006 USD = 7.20 USD, under the approved 10 USD runner cap)
export const MONTHLY_RUNS = 40;
// F23: the complete matrix a "passed" report must hold - 2 markets x 4 sizes x 5 steps, each once
export const PASS_STEPS = ['public_home', 'public_privacy', 'public_tools', 'dashboard', 'plans'] as const;
/** The user id a session token belongs to (its own claim - read only to bind a sign-out to its persona; the signature is Auth's job). */
export function tokenSubject(token: string): string | null {
  try {
    const part = token.split('.')[1] ?? '';
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')));
    return typeof json?.sub === 'string' ? json.sub : null;
  } catch { return null; }
}

export const SIZES = ['1440x900', '1180x820', '820x1180', '390x844'] as const;
const STEP_RE = /^[a-z0-9_-]{1,40}$/;
const CODE_RE = /^[a-z0-9_:.-]{1,60}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const STEP_LABEL: Record<string, { he: string; en: string }> = {
  login: { he: 'כניסה לחשבון', en: 'signing in' },
  dashboard: { he: 'מסך הבית של החשבון', en: 'the account home screen' },
  plans: { he: 'חלון המסלולים', en: 'the plans window' },
  public_home: { he: 'דף הבית הציבורי', en: 'the public home page' },
  public_privacy: { he: 'דף הפרטיות', en: 'the privacy page' },
  public_tools: { he: 'דף הכלים', en: 'the tools page' },
  version: { he: 'גרסת האתר', en: 'the site version' },
};
const MARKET_LABEL: Record<Persona, { he: string; en: string }> = { il: { he: 'ישראל', en: 'Israel' }, intl: { he: 'חו״ל', en: 'international' } };
export const COVERAGE = {
  he: 'לא נבדקו: הרשמה, דף התשלום ותשלום אמיתי, יצירת הצעה, שליחה במייל וחתימה. נבדק בכרום בלבד, בארבעה גדלי מסך. זו לא בדיקת הקבלה שלכם.',
  en: 'Not checked: signup, the payment page and a real payment, creating a quote, email sending and signing. Checked in Chrome only, at four screen sizes. This is not your own acceptance check.',
};

/** The typed report; anything malformed = null (refused, nothing stored). */
export function readReport(b: Record<string, unknown>): { runId: string; outcome: Outcome; steps: StepResult[]; reason: string | null; version: Record<string, string> } | null {
  if (typeof b.runId !== 'string' || !UUID_RE.test(b.runId)) return null;
  if (b.outcome !== 'passed' && b.outcome !== 'failed' && b.outcome !== 'inconclusive') return null;
  if (!Array.isArray(b.steps) || b.steps.length > 200) return null;
  const steps: StepResult[] = [];
  for (const raw of b.steps as Record<string, unknown>[]) {
    if (!raw || typeof raw !== 'object') return null;
    const { market, size, step, ok, code, hash } = raw;
    if ((market !== 'il' && market !== 'intl') || !(SIZES as readonly string[]).includes(String(size)) || !STEP_RE.test(String(step)) || typeof ok !== 'boolean') return null;
    // F23: only the known steps, each market x size x step once
    if (!(String(step) in STEP_LABEL) || steps.some((x) => x.market === market && x.size === String(size) && x.step === String(step))) return null;
    if (code !== undefined && !CODE_RE.test(String(code))) return null;
    if (hash !== undefined && !/^[0-9a-f]{64}$/.test(String(hash))) return null;
    steps.push({ market, size: String(size), step: String(step), ok, ...(code !== undefined ? { code: String(code) } : {}), ...(hash !== undefined ? { hash: String(hash) } : {}) });
  }
  const reason = b.reason === undefined || b.reason === null ? null : CODE_RE.test(String(b.reason)) ? String(b.reason) : '';
  if (reason === '') return null;
  const v = (b.version ?? {}) as Record<string, unknown>;
  const version: Record<string, string> = {};
  for (const k of ['before', 'after']) if (typeof v[k] === 'string' && /^[0-9a-f]{6,64}$/.test(v[k] as string)) version[k] = v[k] as string;
  if (b.outcome === 'passed' && steps.some((s) => !s.ok)) return null; // a pass with a failed step is not a pass
  // F23: a pass covers the whole approved matrix, gives no reason, and was measured on ONE deployment (both fingerprints, equal)
  if (b.outcome === 'passed') {
    const cells = new Set(steps.map((s) => `${s.market}|${s.size}|${s.step}`));
    const full = (['il', 'intl'] as const).every((m) => SIZES.every((z) => PASS_STEPS.every((p) => cells.has(`${m}|${z}|${p}`))));
    if (!full || reason !== null || !version.before || !version.after || version.before !== version.after) return null;
  }
  if (b.outcome === 'failed' && !steps.some((s) => !s.ok)) return null;
  return { runId: b.runId, outcome: b.outcome, steps, reason, version };
}

export function summaryOf(outcome: Outcome, steps: StepResult[], reason: string | null) {
  const bad = steps.filter((s) => !s.ok);
  const first = bad[0];
  const label = first ? STEP_LABEL[first.step] ?? { he: first.step, en: first.step } : null;
  const market = first ? MARKET_LABEL[first.market] : null;
  const summaryHe = outcome === 'passed' ? 'בדיקת ה-LIVE במסגרת שאושרה תקינה.'
    : outcome === 'failed' ? `בדיקת LIVE היומית מצאה תקלה ב${label!.he}, בשוק ${market!.he}.`
      : `בדיקת ה-LIVE לא הוכרעה, ולכן היא לא מאשרת שהאתר תקין${reason ? ` (קוד: ${reason})` : ''}.`;
  const summaryEn = outcome === 'passed' ? 'The approved LIVE check scope is healthy.'
    : outcome === 'failed' ? `The daily LIVE check found a problem at ${label!.en} for ${market!.en}.`
      : `The LIVE check was inconclusive, so it does not confirm the site is healthy${reason ? ` (code: ${reason})` : ''}.`;
  const findings = [
    ...bad.slice(0, 20).map((s) => {
      const l = STEP_LABEL[s.step] ?? { he: s.step, en: s.step };
      return { level: 'bad' as const, he: `${MARKET_LABEL[s.market].he}, ${s.size}: ${l.he}${s.code ? ` (קוד: ${s.code})` : ''}`, en: `${MARKET_LABEL[s.market].en}, ${s.size}: ${l.en}${s.code ? ` (code: ${s.code})` : ''}` };
    }),
    { level: outcome === 'passed' ? 'good' as const : 'warn' as const, he: `נבדקו ${steps.length} שלבים, ${bad.length} נכשלו.`, en: `${steps.length} steps checked, ${bad.length} failed.` },
    { level: 'warn' as const, he: COVERAGE.he, en: COVERAGE.en },
  ];
  return { summaryHe, summaryEn, findings, firstBad: first ?? null };
}

const sameDayKey = (now: Date) => `cron:${now.toISOString().slice(0, 10)}`;
type Out = { status: number; body: Record<string, unknown> };

export async function handle(body: unknown, d: LiveDeps): Promise<Out> {
  if (!d.secretOk()) return { status: 403, body: { ok: false, code: 'forbidden' } };
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.action === 'session') {
    if (b.persona !== 'il' && b.persona !== 'intl') return { status: 400, body: { ok: false, code: 'bad_persona' } };
    const p = await d.persona(b.persona);
    if (!p) return { status: 404, body: { ok: false, code: 'persona_not_registered' } };
    const s = await d.mintSession(p.email);
    if (!s || s.user?.id !== p.userId) return { status: 502, body: { ok: false, code: 'session_failed' } };
    return { status: 200, body: { ok: true, session: s } };
  }
  if (b.action === 'signout') {
    const t = typeof b.accessToken === 'string' ? b.accessToken : '';
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(t) || t.length > 4096) return { status: 400, body: { ok: false, code: 'bad_token' } };
    // F24: a sign-out is bound to the persona it names - the token must belong to that registered test account, never another user
    if (b.persona !== 'il' && b.persona !== 'intl') return { status: 400, body: { ok: false, code: 'bad_persona' } };
    const p = await d.persona(b.persona);
    if (!p || tokenSubject(t) !== p.userId) return { status: 403, body: { ok: false, code: 'not_persona_session' } };
    return { status: 200, body: { ok: await d.signOut(t) } };
  }
  if (b.action === 'begin') {
    // F27: the monthly runner cap (an unreadable count refuses - fail closed)
    if (d.monthRuns) {
      const n = await d.monthRuns().catch(() => Infinity);
      // a manual / chain run row was already created by the agents room (it counts itself); a scheduled run is not created yet
      const manual = b.runId !== undefined && b.runId !== null && b.runId !== '';
      if (manual ? n > MONTHLY_RUNS : n >= MONTHLY_RUNS) return { status: 429, body: { ok: false, code: 'monthly_cap' } };
    }
    if (b.runId !== undefined && b.runId !== null && b.runId !== '') {
      const id = String(b.runId);
      const run = UUID_RE.test(id) ? await d.getRun(id) : null;
      if (!run || run.agent !== 'live_check' || run.status !== 'running' || run.trigger !== 'admin') return { status: 409, body: { ok: false, code: 'run_not_open' } };
      return { status: 200, body: { ok: true, runId: id, origin: 'manual' } };
    }
    const id = await d.claimScheduled(sameDayKey(d.now()));
    return id ? { status: 200, body: { ok: true, runId: id, origin: 'schedule' } } : { status: 200, body: { ok: true, skip: 'already_ran' } };
  }
  if (b.action === 'report') {
    const r = readReport(b);
    if (!r) return { status: 400, body: { ok: false, code: 'bad_report' } };
    const run = await d.getRun(r.runId);
    if (!run || run.agent !== 'live_check' || run.status !== 'running') return { status: 409, body: { ok: false, code: 'run_not_open' } };
    const s = summaryOf(r.outcome, r.steps, r.reason);
    const at = d.now().toISOString();
    const stored = await d.finishRun(r.runId, { status: r.outcome === 'failed' ? 'failed' : 'done', finished_at: at, summary: s.summaryHe, findings: s.findings,
      data: { outcome: r.outcome, summaryEn: s.summaryEn, steps: r.steps, version: r.version, reason: r.reason, coverage: { signup: false, payment: false, quote: false, email: false, signature: false } },
      error: r.outcome === 'failed' ? `${s.firstBad?.market}:${s.firstBad?.step}`.slice(0, 200) : null });
    if (!stored) return { status: 409, body: { ok: false, code: 'run_not_open' } };
    let mailed: boolean | null = null;
    if (run.trigger === 'cron') {
      await d.recordHealth(r.outcome === 'passed' ? 'completed' : r.outcome === 'failed' ? 'failed' : 'partial', r.outcome);
      if (r.outcome === 'failed') {
        mailed = await d.mailOwner('בדיקת ה-LIVE היומית מצאה תקלה - TEKANGO',
          [s.summaryHe, '', ...s.findings.filter((f) => f.level === 'bad').map((f) => `- ${f.he}`), '', 'חדר הסוכנים: https://www.tekango.com/dashboard?view=admin&section=agents-room'].join('\n'),
          `tekango-live-check/v1/${r.runId}`);
      }
    }
    return { status: 200, body: { ok: true, outcome: r.outcome, mailed } };
  }
  return { status: 400, body: { ok: false, code: 'bad_action' } };
}
