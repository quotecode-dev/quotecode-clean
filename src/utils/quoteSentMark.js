// Owner 2026-10-15 (a real WhatsApp share stayed "Needs sending"): a quote shared with the customer by WhatsApp (when WhatsApp opens) or
// by email (after the send succeeded) is marked Sent - only from Draft, and only while the output phase is legacy (when the phase is
// enforced, finalize_quote_output on the server marks it and the client never changes the status). Owner 2026-10-25 (typed L-13): copying
// the message marks it Sent too (it is copied to be sent by SMS / another app).
export const isDraftStatus = (status) => String(status || 'draft').toLowerCase() === 'draft';

export async function markQuoteSentAfterShare(client, userId, quote) {
  if (!client || typeof client.from !== 'function' || typeof userId !== 'string' || !userId) return { ok: false, reason: 'not_signed_in' };
  if (!quote?.id || !isDraftStatus(quote.status)) return { ok: false, reason: 'not_draft' };
  try {
    // the status filter makes the write a no-op when the quote is no longer a Draft on the server (never downgrades a status)
    const { data, error } = await client.from('quotes').update({ status: 'sent' }).eq('id', quote.id).eq('user_id', userId)
      .in('status', ['draft', 'Draft', 'DRAFT']).select('id, status');
    if (error) return { ok: false, reason: 'error', error };
    return Array.isArray(data) && data.length === 1 ? { ok: true } : { ok: false, reason: 'not_draft_on_server' };
  } catch (error) {
    return { ok: false, reason: 'network', error };
  }
}

// a sent quote the customer has not opened yet (view_count counts customer opens only; the owner's own views are excluded)
export const sentNotViewed = (quote) => String(quote?.status || '').toLowerCase() === 'sent'
  && (quote?.view_count === 0 || quote?.view_count === '0');
