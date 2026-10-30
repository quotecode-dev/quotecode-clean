/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
// support-digest (Owner console 2026-10-20, smart support email stage 2; spec 6 + Owner 2026-10-19 "סיכום הערב ... מתאים"): the Owner's
// evening summary at 20:00 Israel time, once a day.
//  - Called only by the site cron with the shared cron secret (x-cron-secret = CRON_SECRET); the cron runs at both 17:00 and 18:00 UTC
//    and only the run that is 20:00 in Israel sends (summer and winter time), and a day is claimed once (support_digest_runs).
//  - Safety net: an email still 'new' ten minutes after it was stored (its handling crashed) is handled now.
//  - Codex release 5 (Owner console 2026-10-29 night, decisions 7-8): an Owner alert (red / grey) whose delivery failed in the last
//    three days is retried with the same slot (never a second alert); the summary groups the waiting emails by conversation.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { israelClock, buildDigest, DIGEST_HOUR } from "../support-inbound/digest.ts";
import { processInquiry, retryOwnerAlert } from "../support-inbound/process.ts";
import { supabaseStore } from "../support-inbound/store.ts";
import { sendMail } from "../support-inbound/mail.ts";
import { recordRun } from "../_shared/scheduledHealth.ts"; // Codex release 7: the evening window is reported

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const ROW = 'id, status, stored_at, from_address, to_addresses, subject, text_body, attachments, message_id, is_automated, mailbox, automation_class, reply_allowed, reference_ids, conversation_id, auth_results';
const ALERT = 'id, status, from_address, to_addresses, subject, text_body, mailbox, bin, bin_reason, summary, ack_sent_at, owner_notified_at';
const DIGEST = 'from_address, subject, bin, status, bin_reason, summary, reply_sent_by, stored_at, conversation_id';

serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, code: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('CRON_SECRET') ?? '';
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ ok: false, code: 'unauthorized' }, 401);
  const now = new Date();
  const { hour, day } = israelClock(now);
  if (hour !== DIGEST_HOUR) return json({ ok: true, skipped: 'not_digest_hour', hour });

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const store = supabaseStore(admin);
  const mail = { fetch: fetch as never, apiKey: Deno.env.get('RESEND_API_KEY') ?? '' };
  const ownerAddress = (Deno.env.get('SUPPORT_OWNER_NOTIFY_ADDRESS') ?? '').trim();

  const stuckBefore = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const { data: stuck } = await admin.from('support_inbound_messages').select(ROW).eq('status', 'new').lt('stored_at', stuckBefore).limit(20);
  for (const row of stuck ?? []) {
    await processInquiry(row, { store, mail, model: { fetch: fetch as never, apiKey: Deno.env.get('OPENAI_API_KEY') ?? '' }, ownerAddress, now: () => new Date() })
      .catch(() => store.update(row.id, { bin: row.reply_allowed === false ? 'grey' : 'red', bin_reason: 'processing_failed', status: 'waiting', processed_at: new Date().toISOString() }, ['new']));
  }

  const { data: unalerted } = await admin.from('support_inbound_messages').select(ALERT).eq('status', 'waiting').in('bin', ['red', 'grey'])
    .is('owner_notified_at', null).gte('stored_at', new Date(now.getTime() - 3 * 24 * 3600 * 1000).toISOString()).lt('stored_at', stuckBefore).limit(20);
  for (const row of unalerted ?? []) await retryOwnerAlert(row, { store, mail, ownerAddress, now: () => new Date() }).catch(() => false);

  // Codex release 7: every answer of the 20:00 slot reports how the evening window ended
  const done = async (body: Record<string, unknown>, status = 200) => { await recordRun(admin, 'support-digest', status, body); return json(body, status); };
  const { data: claimed, error: claimErr } = await admin.from('support_digest_runs').upsert({ day }, { onConflict: 'day', ignoreDuplicates: true }).select('day');
  if (claimErr) return done({ ok: false, code: 'store_failed' }, 500);
  if (!claimed?.length) return done({ ok: true, skipped: 'already_sent', day });
  if (!ownerAddress) return done({ ok: true, skipped: 'no_owner_address', day });

  const since = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const [{ data: today }, { data: waiting }] = await Promise.all([
    admin.from('support_inbound_messages').select(DIGEST).gte('stored_at', since).order('stored_at', { ascending: false }).limit(500),
    admin.from('support_inbound_messages').select(DIGEST).in('status', ['waiting', 'draft']).order('stored_at', { ascending: true }).limit(200),
  ]);
  const digest = buildDigest(day, today ?? [], waiting ?? []);
  const r = await sendMail(mail, { from: 'TEKANGO Support <support@tekango.com>', replyTo: 'support@tekango.com', to: ownerAddress, subject: digest.subject, text: digest.text, idempotencyKey: `tekango-support/v1/digest/${day}` });
  if (!r.ok) {
    // the day is released so the next cron run (or a manual call) can try again
    await admin.from('support_digest_runs').delete().eq('day', day);
    return done({ ok: false, code: 'provider_failure' }, 502);
  }
  await admin.from('support_digest_runs').update({ sent_at: new Date().toISOString() }).eq('day', day);
  return done({ ok: true, sent: true, day, handled_stuck: stuck?.length ?? 0 });
});
