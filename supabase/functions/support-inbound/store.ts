// Smart support email, stage 2 - the database side of process.ts, on a SERVICE ROLE client (the only writer of the inquiry tables;
// callers verify the webhook signature / the super admin before they get here).
import type { InquiryStore, Settings } from './process.ts';

// deno-lint-ignore no-explicit-any
type Client = any;

export function supabaseStore(admin: Client): InquiryStore {
  return {
    async settings(): Promise<Settings | null> {
      const { data, error } = await admin.from('support_assistant_settings').select('auto_send_green, auto_send_yellow, paused').eq('id', 1).maybeSingle();
      if (error || !data) return null;
      return { auto_send_green: data.auto_send_green === true, auto_send_yellow: data.auto_send_yellow === true, paused: data.paused !== false };
    },
    async recentFromSender(address: string, sinceIso: string) {
      const { data, error } = await admin.from('support_inbound_messages').select('id, ack_sent_at, reply_sent_at, reply_sent_by')
        .eq('from_address', address).gte('stored_at', sinceIso).limit(100);
      // unreadable history counts as "limit reached" - fail closed
      if (error) return Array.from({ length: 100 }, (_, i) => ({ id: String(i), ack_sent_at: sinceIso, reply_sent_at: null, reply_sent_by: null }));
      return data ?? [];
    },
    async update(id: string, patch: Record<string, unknown>, fromStatuses?: string[]) {
      let q = admin.from('support_inbound_messages').update(patch).eq('id', id);
      if (fromStatuses?.length) q = q.in('status', fromStatuses);
      const { data, error } = await q.select('id');
      return !error && Array.isArray(data) && data.length > 0;
    },
  };
}
