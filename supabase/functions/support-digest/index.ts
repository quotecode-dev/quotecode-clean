/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
// support-digest (Owner console 2026-10-20, smart support email stage 2; spec 6 + Owner 2026-10-19 "סיכום הערב ... מתאים"): the Owner's
// evening summary at 20:00 Israel time, once a day.
//  - Called only by the site cron with the shared cron secret (x-cron-secret = CRON_SECRET); the cron runs at both 17:00 and 18:00 UTC
//    and only the run that is 20:00 in Israel sends (summer and winter time), and a day is claimed once (support_digest_runs).
//  - Safety net: an email still 'new' ten minutes after it was stored (its handling crashed) is handled now.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { israelClock, buildDigest, DIGEST_HOUR } from "../support-inbound/digest.ts";
import { processInquiry } from "../support-inbound/process.ts";
import { supabaseStore } from "../support-inbound/store.ts";
import { sendMail } from "../support-inbound/mail.ts";

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const ROW = 'id, status, stored_at, from_address, to_addresses, subject, text_body, attachments, message_id, is_automated, mailbox';
const DIGEST = 'from_address, subject, bin, status, bin_reason, summary, reply_sent_by, stored_at';

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
      .catch(() => store.update(row.id, { bin: 'red', bin_reason: 'processing_failed', status: 'waiting', processed_at: new Date().toISOString() }, ['new']));
  }

  const { data: claimed, error: claimErr } = await admin.from('support_digest_runs').upsert({ day }, { onConflict: 'day', ignoreDuplicates: true }).select('day');
  if (claimErr) return json({ ok: false, code: 'store_failed' }, 500);
  if (!claimed?.length) return json({ ok: true, skipped: 'already_sent', day });
  if (!ownerAddress) return json({ ok: true, skipped: 'no_owner_address', day });

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
    return json({ ok: false, code: 'provider_failure' }, 502);
  }
  await admin.from('support_digest_runs').update({ sent_at: new Date().toISOString() }).eq('day', day);
  return json({ ok: true, sent: true, day, handled_stuck: stuck?.length ?? 0 });
});
