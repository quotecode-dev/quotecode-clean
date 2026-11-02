// Owner console 2026-10-20 (typed: "מאשר שינוי ב-L-17: חסימת הצ'אט החכם, הצ'אט הקולי וההצעה החכמה בלי חכם פלוס"): the SMART PACK gate
// for the smart Edge Functions (voice-ai, ai-quote-draft; chat-ai uses the summary it already reads). It asks the CALLER'S OWN server
// account summary (the user's token, get_account_summary) and decides with decideSmartPack: enforced only while the plan system is
// enforced - otherwise every account keeps today's access (L-05). The database stays the authority for attachments
// (quote_attachments_smart_pack_gate).
// Owner console 2026-10-25 (typed: "מאשר שינוי ב-L-05: יכולות חכם פלוס נחסמות ברגע הלחיצה למי שאין לו חכם פלוס"): a summary that cannot
// be read (an error, an unknown answer, an account not provisioned) is REFUSED - only a server that says the plan system is not
// activated ('not_activated') keeps today's access without a summary.
import { parseAccountSummary, decideSmartPack, type AccountSummary, type ReadySummary } from './subscriptionContract.ts';

export const SMART_PACK_REQUIRED = 'smart_pack_required';

/** the decision from a summary already read (chat-ai): ready = decideSmartPack; 'not_activated' = today's access; anything else = refused */
export function smartPackAllowedBySummary(summary: AccountSummary | null | undefined): boolean {
  if (summary?.state === 'ready') return decideSmartPack(summary).allowed;
  return summary?.state === 'not_activated';
}

/** Owner console 2026-10-25 (typed: "מאשר לתקן את ממצאים 1 עד 13 בעברית ובאנגלית, כולל שינוי ב-L-01, L-14, L-17, L-22"): the ONE answer
 *  to "can this account get SMART PACK from the plans window right now?" - every "you can add it in the plans window" line (the SMART
 *  PACK notice, the voice note, the chat answer) promises it only when this says so. 'package' = buy the package with the SMART PACK
 *  box (Free, or an all-inclusive account the pay button serves); 'add_on' = an active subscriber adds it with a pro-rata charge;
 *  null = no path now (purchase closed / not Israel / a failed charge being retried / a stopped renewal / a legacy style plan / has it).
 *  (Here and not in subscriptionContract.ts: that contract is shared by functions outside this release.) */
export function smartPackPurchasePath(summary: AccountSummary | null | undefined, isLifetime = false): 'package' | 'add_on' | null {
  if (isLifetime === true || summary?.state !== 'ready') return null;
  const s = summary as ReadySummary;
  if ((s.phase.billing !== 'prepared' && s.phase.billing !== 'enforced') || s.market !== 'IL' || s.smartPack?.active) return null;
  if (s.planId === 'all_inclusive' && s.billing?.limited) return 'package';
  if (s.planId === 'all_inclusive' && s.subscriptionStatus === 'active') return s.billing?.renewalStopped ? null : 'add_on';
  if (s.planId === 'all_inclusive') return s.subscriptionStatus === 'past_due' ? null : 'package'; // the same rule as the pay button
  return s.planId === 'free' ? 'package' : null;
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
