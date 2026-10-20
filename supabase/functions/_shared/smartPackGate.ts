// Owner console 2026-10-20 (typed: "מאשר שינוי ב-L-17: חסימת הצ'אט החכם, הצ'אט הקולי וההצעה החכמה בלי חכם פלוס"): the SMART PACK gate
// for the smart Edge Functions (voice-ai, ai-quote-draft; chat-ai uses the summary it already reads). It asks the CALLER'S OWN server
// account summary (the user's token, get_account_summary) and decides with decideSmartPack: enforced only while the plan system is
// enforced - otherwise every account keeps today's access (L-05). A summary that cannot be read keeps today's access too (the same
// legacy rule as decideCapability); the database stays the authority for attachments (quote_attachments_smart_pack_gate).
import { parseAccountSummary, decideSmartPack } from './subscriptionContract.ts';

export const SMART_PACK_REQUIRED = 'smart_pack_required';

// client = the caller-token Supabase client (read-only: get_account_summary is a STABLE read of the caller's own summary)
export async function smartPackAllowedFor(client: { rpc: (fn: string) => PromiseLike<{ data: unknown; error: unknown }> }): Promise<boolean> {
  try {
    const { data, error } = await client.rpc('get_account_summary');
    if (error) return true;
    return decideSmartPack(parseAccountSummary(data)).allowed;
  } catch {
    return true;
  }
}
