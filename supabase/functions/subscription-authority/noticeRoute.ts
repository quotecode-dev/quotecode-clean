// subscription-authority action `output_notice {quoteId}` (OD-02 pre-consumption notice; spec Phase 4 step 1).
// READ-ONLY: JWT user -> service RPC output_notice(p_user_id, p_quote_id) -> allowlisted answer. No reservation, no
// consumption, no snapshot. The client shows the Owner notice when wouldConsume is true and then calls authorize_output with
// expectedDigest = contentDigest. The user id comes only from the verified JWT; a body userId / plan / balance is never read.

export type Resp = { status: number; body: Record<string, unknown> };
export interface NoticeDeps {
  /** output_notice(p_user_id, p_quote_id): {ok:true, contentDigest, alreadyFinalized, wouldConsume, remaining, accountMode} | {ok:false, code} */
  outputNotice(userId: string, quoteId: string): Promise<unknown>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const err = (status: number, code: string, extra: Record<string, unknown> = {}): Resp => ({ status, body: { ok: false, code, ...extra } });
// SQL failure codes passed through; anything else is a fail-closed 503
const NOTICE_CODES: Readonly<Record<string, number>> = Object.freeze({
  not_activated: 409, account_not_provisioned: 409, quote_not_found: 404, legacy_issue_policy_pending: 409,
  customer_binding_missing: 409, paid_quote_policy_pending: 403, free_issue_limit_reached: 403,
});

export async function outputNoticeRoute(deps: NoticeDeps, userId: string, body: unknown): Promise<Resp> {
  if (typeof userId !== 'string' || !UUID.test(userId)) return err(401, 'not_authenticated');
  const quoteId = isObj(body) ? body.quoteId : undefined;
  if (typeof quoteId !== 'string' || !UUID.test(quoteId)) return err(400, 'invalid_request', { field: 'quoteId' });
  let r: unknown;
  try { r = await deps.outputNotice(userId, quoteId); } catch { return err(503, 'output_unavailable'); }
  if (!isObj(r)) return err(503, 'output_unavailable');
  if (r.ok !== true) {
    const code = typeof r.code === 'string' ? r.code : '';
    return Object.prototype.hasOwnProperty.call(NOTICE_CODES, code) ? err(NOTICE_CODES[code], code) : err(503, 'output_unavailable');
  }
  const { contentDigest, alreadyFinalized, wouldConsume, remaining } = r;
  if (typeof contentDigest !== 'string' || !HEX64.test(contentDigest) || typeof alreadyFinalized !== 'boolean' || typeof wouldConsume !== 'boolean'
      || !(remaining === null || (Number.isInteger(remaining) && (remaining as number) >= 0 && (remaining as number) <= 10))) {
    return err(503, 'output_unavailable');
  }
  if (alreadyFinalized && wouldConsume) return err(503, 'output_unavailable'); // a finalized quote can never consume again
  return { status: 200, body: { ok: true, quoteId, contentDigest, alreadyFinalized, wouldConsume, remaining } };
}
