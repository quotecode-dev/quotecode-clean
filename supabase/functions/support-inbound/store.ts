// Smart support email, stage 2 - the database side of process.ts, on a SERVICE ROLE client (the only writer of the inquiry tables;
// callers verify the webhook signature / the super admin before they get here).
import type { InquiryStore, Settings, ConversationStore, OutboundRecord, Association } from './process.ts';

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
    conversations: conversationStore(admin),
  };
}

// Codex release 5 (Owner console 2026-10-29 night, decision 8): support conversations (migration 20261030600000). Every failure
// throws - the caller then handles the email alone, as before.
export function conversationStore(admin: Client): ConversationStore {
  const must = <T>({ data, error }: { data: T; error: unknown }): T => { if (error) throw new Error('support_conversation_store'); return data; };
  return {
    async byReferences(ids: string[], selfId: string) {
      if (!ids.length) return [];
      const inbound = must(await admin.from('support_inbound_messages').select('conversation_id, from_address, mailbox')
        .in('message_id', ids).neq('id', selfId).not('conversation_id', 'is', null).limit(50)) as Array<{ conversation_id: string; from_address: string; mailbox: string | null }>;
      const outbound = must(await admin.from('support_outbound_messages').select('conversation_id').in('rfc_message_id', ids).limit(50)) as Array<{ conversation_id: string }>;
      const convIds = [...new Set(outbound.map((o) => o.conversation_id))];
      const convs = convIds.length
        ? must(await admin.from('support_conversations').select('id, participant, mailbox').in('id', convIds)) as Array<{ id: string; participant: string; mailbox: string | null }>
        : [];
      return [
        ...inbound.map((m) => ({ conversation_id: m.conversation_id, participant: m.from_address, mailbox: m.mailbox ?? null })),
        ...convs.map((c) => ({ conversation_id: c.id, participant: c.participant, mailbox: c.mailbox ?? null })),
      ];
    },
    async bySubject(participant: string, mailbox: string | null, subject: string, sinceIso: string) {
      let q = admin.from('support_conversations').select('id').eq('participant', participant).eq('subject_norm', subject).gte('last_activity_at', sinceIso);
      q = mailbox ? q.eq('mailbox', mailbox) : q.is('mailbox', null);
      const rows = must(await q.order('last_activity_at', { ascending: false }).limit(1)) as Array<{ id: string }>;
      return rows[0]?.id ?? null;
    },
    async assign(inboundId: string, parent: string | null, suggested: string | null, association: Association, subject: string | null) {
      const id = must(await admin.rpc('support_conversation_assign', { p_inbound: inboundId, p_parent: parent, p_suggested: suggested, p_association: association, p_subject_norm: subject }));
      if (typeof id !== 'string') throw new Error('support_conversation_store');
      return id;
    },
    async claimAck(conversationId: string, claim: string) {
      return must(await admin.rpc('support_conversation_claim_ack', { p_conversation: conversationId, p_claim: claim })) === true;
    },
    async releaseAck(conversationId: string, claim: string) {
      must(await admin.rpc('support_conversation_release_ack', { p_conversation: conversationId, p_claim: claim }));
    },
    async recordOutbound(rec: OutboundRecord) {
      // the same send key again (a retry) only updates its delivery state / provider id
      must(await admin.from('support_outbound_messages').upsert(rec, { onConflict: 'send_key' }));
    },
  };
}
