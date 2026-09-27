// Trial reminder batch orchestration (Codex Post-LIVE Wave 1 blockers 3 + 5, 2026-09-27). Pure: the database claim /
// completion and the email transport are injected, so the exact same code runs in the Edge Function (supabase-js RPC +
// Resend) and under vitest / the disposable-DB concurrency proof.
//
// Per eligible account and stage:
//   1. market = exact canonical country ('Local' | 'International'); anything else -> skipped, nothing claimed or sent.
//   2. claim   = public.claim_trial_reminder (atomic). No claim -> no send. Claim error -> no send.
//   3. send    = transport with the claim's idempotency key -> 'sent' | 'failed' (definitely not sent) | 'unknown'.
//   4. record  = public.complete_trial_reminder(outcome). Its result is checked: a refused or failed completion is reported
//                (an accepted email is then counted as sentUnrecorded, never as recorded) and the open claim is retried
//                later with the same idempotency key, so the retry cannot send a second email.

import { resolveReminderMarket, resolveTrialReminderStage, type ReminderMarket, type TrialReminderCandidate } from './eligibility.ts';
import { buildTrialReminderEmail, senderAddressFor, type Stage } from './reminderContent.ts';

export type BatchCandidate = TrialReminderCandidate & {
  user_id: string;
  business_name?: string | null;
  country?: string | null;
};

export type Claim = { claimId: string; idempotencyKey: string; attempt: number };

export type SendOutcome =
  | { outcome: 'sent'; messageId: string | null }
  | { outcome: 'failed' | 'unknown'; error: string };

export type ReminderMessage = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  market: ReminderMarket;
  stage: Stage;
};

export type BatchDeps = {
  claim: (userId: string, stage: Stage) => Promise<Claim | null>;
  transport: (message: ReminderMessage, idempotencyKey: string) => Promise<SendOutcome>;
  complete: (userId: string, stage: Stage, claimId: string, result: SendOutcome) => Promise<boolean>;
};

export type BatchSummary = {
  sent3d: number;
  sent24h: number;
  skippedMarketUnresolved: number;
  notClaimed: number;
  claimErrors: number;
  sendFailed: number;
  sendUnknown: number;
  sentUnrecorded: number;
  completionErrors: number;
  errors: string[];
};

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e ?? 'Unknown error')).slice(0, 300);

export async function runTrialReminderBatch(candidates: BatchCandidate[], nowMs: number, deps: BatchDeps): Promise<BatchSummary> {
  const s: BatchSummary = {
    sent3d: 0, sent24h: 0, skippedMarketUnresolved: 0, notClaimed: 0, claimErrors: 0,
    sendFailed: 0, sendUnknown: 0, sentUnrecorded: 0, completionErrors: 0, errors: [],
  };

  for (const biz of candidates) {
    const stage = resolveTrialReminderStage(biz, nowMs);
    if (!stage) continue;

    const market = resolveReminderMarket(biz.country);
    if (!market) {
      s.skippedMarketUnresolved++;
      s.errors.push(`${biz.user_id}/${stage}: market not exactly Local/International - not sent`);
      continue;
    }

    let claim: Claim | null;
    try {
      claim = await deps.claim(biz.user_id, stage);
    } catch (e) {
      s.claimErrors++;
      s.errors.push(`${biz.user_id}/${stage}: claim failed - not sent: ${errText(e)}`);
      continue;
    }
    if (!claim) {
      s.notClaimed++;
      continue;
    }

    const { subject, html, text } = buildTrialReminderEmail({
      stage, businessName: biz.business_name, trialEndsAt: String(biz.trial_ends_at), market,
    });
    const message: ReminderMessage = { from: senderAddressFor(market), to: String(biz.email), subject, html, text, market, stage };

    let result: SendOutcome;
    try {
      result = await deps.transport(message, claim.idempotencyKey);
    } catch (e) {
      result = { outcome: 'unknown', error: errText(e) };
    }
    if (result.outcome === 'failed') s.sendFailed++;
    if (result.outcome === 'unknown') s.sendUnknown++;

    let recorded = false;
    try {
      recorded = await deps.complete(biz.user_id, stage, claim.claimId, result);
      if (!recorded) s.errors.push(`${biz.user_id}/${stage}: completion refused (claim no longer held) - outcome ${result.outcome}`);
    } catch (e) {
      s.completionErrors++;
      s.errors.push(`${biz.user_id}/${stage}: outcome ${result.outcome} not recorded: ${errText(e)}`);
    }

    if (result.outcome === 'sent') {
      if (!recorded) s.sentUnrecorded++;
      else if (stage === '3d') s.sent3d++;
      else s.sent24h++;
    } else if (recorded) {
      s.errors.push(`${biz.user_id}/${stage}: ${result.outcome}: ${result.error}`);
    }
  }

  return s;
}

// Resend transport with an Idempotency-Key and an explicit outcome classification.
//   2xx                       -> sent
//   409 (idempotency conflict: same key in flight, or same key used with a different payload) -> unknown
//   other 4xx (validation, auth, rate limit) -> failed (the request was rejected; nothing was sent)
//   5xx / network error / timeout -> unknown (the provider may have accepted it)
export async function sendViaResendWithOutcome(
  fetchImpl: typeof fetch,
  apiKey: string,
  message: Pick<ReminderMessage, 'from' | 'to' | 'subject' | 'html' | 'text'>,
  idempotencyKey: string,
  timeoutMs = 15_000,
): Promise<SendOutcome> {
  let res: Response;
  try {
    res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ from: message.from, to: message.to, subject: message.subject, html: message.html, text: message.text }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    return { outcome: 'unknown', error: `transport: ${errText(e)}` };
  }
  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  if (res.ok) return { outcome: 'sent', messageId: typeof data?.id === 'string' ? data.id : null };
  const detail = `Resend ${res.status}: ${typeof data?.message === 'string' ? data.message : 'error'}`;
  if (res.status === 409 || res.status >= 500) return { outcome: 'unknown', error: detail };
  return { outcome: 'failed', error: detail };
}
