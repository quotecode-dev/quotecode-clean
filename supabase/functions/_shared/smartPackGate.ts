// Owner console 2026-10-20 (typed: "מאשר שינוי ב-L-17: חסימת הצ'אט החכם, הצ'אט הקולי וההצעה החכמה בלי חכם פלוס"): the SMART PACK gate
// for the smart Edge Functions (voice-ai, ai-quote-draft; chat-ai uses the summary it already reads). It asks the CALLER'S OWN server
// account summary (the user's token, get_account_summary) and decides with decideSmartPack: enforced only while the plan system is
// enforced - otherwise every account keeps today's access (L-05). The database stays the authority for attachments
// (quote_attachments_smart_pack_gate).
// Owner console 2026-10-25 (typed: "מאשר שינוי ב-L-05: יכולות חכם פלוס נחסמות ברגע הלחיצה למי שאין לו חכם פלוס"): a summary that cannot
// be read (an error, an unknown answer, an account not provisioned) is REFUSED - only a server that says the plan system is not
// activated ('not_activated') keeps today's access without a summary.
import { parseAccountSummary, decideSmartPack, type AccountSummary } from './subscriptionContract.ts';

export const SMART_PACK_REQUIRED = 'smart_pack_required';

/** the decision from a summary already read (chat-ai): ready = decideSmartPack; 'not_activated' = today's access; anything else = refused */
export function smartPackAllowedBySummary(summary: AccountSummary | null | undefined): boolean {
  if (summary?.state === 'ready') return decideSmartPack(summary).allowed;
  return summary?.state === 'not_activated';
}

// client = the caller-token Supabase client (read-only: get_account_summary is a STABLE read of the caller's own summary)
export async function smartPackAllowedFor(client: { rpc: (fn: string) => PromiseLike<{ data: unknown; error: unknown }> }): Promise<boolean> {
  try {
    const { data, error } = await client.rpc('get_account_summary');
    if (error) return false;
    return smartPackAllowedBySummary(parseAccountSummary(data));
  } catch {
    return false;
  }
}
