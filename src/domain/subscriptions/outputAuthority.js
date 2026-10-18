// ONE output-authority gate for the four client-facing output channels (OD-02): Send (WhatsApp / email), Public share,
// final PDF and final Print. Approval/signature use the same artifact as the public share.
//
// The phase is the SERVER output phase from the account summary (outputPhaseOf in the shared contract) - never an env
// variable, never a client flag. The server is the authority in every phase (DB trigger + get-public-quote + the
// subscription-authority function); this gate only chooses which request the client makes:
// - 'off' / 'prepared' / 'shadow' : the server does not enforce output -> synchronous { proceed: true, mode: 'legacy' } -
//   no network, no await, so the existing behavior (incl. the browser's user-gesture chain for window.open / print) is
//   unchanged.
// - 'enforced' : { proceed: false, mode: 'authority_required' } - the caller MUST obtain a server authorization first
//   (requestOutputAuthorization: JWT -> reservation -> immutable snapshot -> SQL finalize -> capability URL / short grant)
//   and may expose output only after it succeeds. All four channels switch together: there is no per-channel phase.
// - anything else : FAIL CLOSED.
// Owner previews (opening the quote from the dashboard) are not client output and never consume (OD-02).
export const OUTPUT_ACTIVATION_PHASE = 'off';
export const OUTPUT_CHANNELS = Object.freeze(['send', 'public_share', 'final_pdf', 'final_print']);
const LEGACY_PHASES = Object.freeze(['off', 'prepared', 'shadow']);

export function outputGate(channel, phase = OUTPUT_ACTIVATION_PHASE) {
  if (!OUTPUT_CHANNELS.includes(channel)) return { proceed: false, mode: 'blocked', code: 'unknown_output_channel' };
  if (LEGACY_PHASES.includes(phase)) return { proceed: true, mode: 'legacy' };
  if (phase === 'enforced') return { proceed: false, mode: 'authority_required' };
  return { proceed: false, mode: 'blocked', code: 'output_phase_unknown' };
}

// Stable idempotency key per quote VERSION and channel (Task 30: Free-10 counts per version + customer; the version digest covers the
// customer block, the recipient and the content): a retry after the server committed returns the SAME artifact and never consumes
// twice, a changed version gets its own key (the server enforces both; the key only lets it recognize the retry).
export const outputIdempotencyKey = (quoteId, channel, contentDigest) => `out:${quoteId}:${channel}:${contentDigest}`;

const TOKEN_PATH_RE = /^\/(en\/)?public-quote\/c\/[A-Za-z0-9_-]{43}$/;

const HEX64 = /^[0-9a-f]{64}$/;

// Read-only pre-consumption notice (OD-02 "real balance + advance notice"): the server returns the digest of the deal the
// owner is about to send, whether this output would use one of the 10 free quotes, and the real remaining balance.
export async function requestOutputNotice({ quoteId, invoke }) {
  if (typeof quoteId !== 'string' || !quoteId || typeof invoke !== 'function') return { ok: false, code: 'invalid_request' };
  let res;
  try {
    res = await invoke('subscription-authority', { body: { action: 'output_notice', quoteId } });
  } catch {
    return { ok: false, code: 'authority_unreachable' };
  }
  const d = res?.data;
  if (res?.error || !d || d.ok !== true) return { ok: false, code: String((d && d.code) || 'authority_refused').slice(0, 64) };
  if (d.quoteId !== quoteId || typeof d.contentDigest !== 'string' || !HEX64.test(d.contentDigest) || typeof d.wouldConsume !== 'boolean'
    || !(d.remaining === null || (Number.isInteger(d.remaining) && d.remaining >= 0))) return { ok: false, code: 'final_response_invalid' };
  return { ok: true, contentDigest: d.contentDigest, wouldConsume: d.wouldConsume, remaining: d.remaining, alreadyFinalized: d.alreadyFinalized === true };
}

// Task 30: shown only when THIS version would count (a first output, or a changed customer / recipient / content); re-sending the same
// version to the same customer never asks (the server answers wouldConsume false).
export function consumptionNoticeText(remaining, isHebrew) {
  const left = Number.isInteger(remaining) ? (isHebrew ? ` (נותרו ${remaining})` : ` (${remaining} left)`) : '';
  return isHebrew
    ? `פעולה זו תנצל הצעה אחת מתוך 10 ההצעות החינמיות שלכם${left}: זו הפעם הראשונה שגרסה זו יוצאת ללקוח הזה. שליחה חוזרת של אותה גרסה לאותו לקוח לא תיספר שוב. להמשיך?`
    : `This action will use 1 of your 10 free quotes${left}: this version has not reached this client before. Sending the same version to the same client again will not count again. Continue?`;
}

// The full enforced-phase flow: notice -> owner confirmation when a free quote would be used -> authorization bound to the
// exact deal digest the owner confirmed. Cancelling performs nothing.
export async function authorizeWithNotice({ channel, quoteId, invoke, confirm, isHebrew }) {
  const notice = await requestOutputNotice({ quoteId, invoke });
  if (!notice.ok) return { proceed: false, mode: 'blocked', code: notice.code };
  if (notice.wouldConsume && !(typeof confirm === 'function' && confirm(consumptionNoticeText(notice.remaining, isHebrew)))) {
    return { proceed: false, mode: 'cancelled', code: 'cancelled_by_owner' };
  }
  return requestOutputAuthorization({ channel, quoteId, invoke, expectedDigest: notice.contentDigest });
}

// Calls the server authority. Response allowlist: { ok:true, channel, publicPath? , grant?, expiresAt? } or { ok:false, code }.
export async function requestOutputAuthorization({ channel, quoteId, invoke, expectedDigest }) {
  if (!OUTPUT_CHANNELS.includes(channel)) return { proceed: false, mode: 'blocked', code: 'unknown_output_channel' };
  if (typeof quoteId !== 'string' || !quoteId || typeof invoke !== 'function' || !HEX64.test(String(expectedDigest || ''))) return { proceed: false, mode: 'blocked', code: 'invalid_request' };
  let res;
  try {
    res = await invoke('subscription-authority', {
      body: { action: 'authorize_output', quoteId, channel, idempotencyKey: outputIdempotencyKey(quoteId, channel, expectedDigest), expectedDigest },
    });
  } catch {
    return { proceed: false, mode: 'blocked', code: 'authority_unreachable' };
  }
  const data = res?.data;
  if (res?.error || !data || data.ok !== true || data.channel !== channel) {
    const code = data && typeof data.code === 'string' ? data.code : (res?.error?.context?.code || 'authority_refused');
    return { proceed: false, mode: 'blocked', code: String(code).slice(0, 64) };
  }
  if (channel === 'send' || channel === 'public_share') {
    if (typeof data.publicPath !== 'string' || !TOKEN_PATH_RE.test(data.publicPath)) return { proceed: false, mode: 'blocked', code: 'final_response_invalid' };
    return { proceed: true, mode: 'authorized', publicPath: data.publicPath };
  }
  if (typeof data.grant !== 'string' || data.grant.length < 32 || typeof data.expiresAt !== 'string') {
    return { proceed: false, mode: 'blocked', code: 'final_response_invalid' };
  }
  return { proceed: true, mode: 'authorized', grant: data.grant, expiresAt: data.expiresAt };
}

// The raw capability token inside an authorized public path (passed to send-quote-email so the server can verify the binding).
export const capabilityTokenFromPath = (publicPath) => (TOKEN_PATH_RE.test(publicPath || '') ? publicPath.split('/').pop() : null);

export function outputBlockedMessage(code, isHebrew) {
  if (code === 'free_issue_limit_reached') {
    return isHebrew
      ? 'נוצלו כל 10 ההצעות החינמיות. הצעות שכבר יצאו נשארות זמינות. פרטי המסלולים זמינים במסך המסלולים.'
      : 'All 10 free quotes have been used. Quotes already sent stay available. Plan details are in the plans view.';
  }
  if (code === 'output_in_progress') {
    return isHebrew ? 'גרסה אחרת של ההצעה נמצאת כרגע בהפקה. נסו שוב בעוד רגע. דבר לא נשלח ולא נוצלה הצעה.' : 'Another version of this quote is being produced right now. Try again in a moment. Nothing was sent and no quote was used.';
  }
  if (code === 'quote_closed') {
    return isHebrew ? 'ההצעה נחתמה או נסגרה, ולכן אי אפשר להפיק ממנה גרסה חדשה. אפשר לשלוח שוב את הגרסה שכבר יצאה, או ליצור הצעה חדשה. דבר לא נשלח ולא נוצלה הצעה.' : 'This quote is signed or closed, so a new version cannot be produced from it. You can send the version already issued again, or create a new quote. Nothing was sent and no quote was used.';
  }
  if (code === 'quote_changed') {
    return isHebrew ? 'ההצעה השתנתה בזמן ההפקה. בדקו את הגרסה הנוכחית ונסו שוב. דבר לא נשלח ולא נוצלה הצעה.' : 'The quote changed while it was being produced. Check the current version and try again. Nothing was sent and no quote was used.';
  }
  if (code === 'account_not_provisioned') {
    return isHebrew ? 'החשבון טרם שויך למסלול, ולכן לא ניתן להוציא הצעות ללקוח כרגע.' : 'This account is not assigned to a plan yet, so quotes cannot be sent to clients right now.';
  }
  return isHebrew ? 'לא ניתן להוציא את ההצעה ללקוח כרגע. דבר לא נשלח ולא נוצלה הצעה.' : 'The quote cannot be sent to the client right now. Nothing was sent and no quote was used.';
}
