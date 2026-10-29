/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
// support-inbound (Owner console 2026-10-19, smart support email stage 1, docs/SMART_SUPPORT_EMAIL_SPEC_2026-10-19.md): the email
// provider's "email.received" webhook. Stage 1 RECEIVES and STORES; stage 2 (below) sorts and answers through process.ts.
//  - No user JWT (verify_jwt = false): the request must carry a valid provider signature over the raw body (Standard Webhooks /
//    Svix scheme, RESEND_INBOUND_WEBHOOK_SECRET); a missing / stale / wrong signature is refused before anything is read.
//  - Only mail to a configured support / info address (SUPPORT_INBOUND_ADDRESSES) is stored; anything else is acknowledged and dropped.
//  - The full message is fetched from the provider by its id (the webhook carries metadata only), reduced to plain text, and stored
//    ONCE (unique provider event / email) with the service role - the only writer of support_inbound_messages.
//  - A provider / database failure answers non-2xx so the provider retries; a duplicate answers 200 and changes nothing.
//  - Stage 2 (Owner console 2026-10-20, typed: "מאשר שינוי ב-L-22: שלב 2 של המייל החכם ..."): a NEWLY stored email is sorted and handled
//    by process.ts right after the answer (EdgeRuntime.waitUntil); a stored email left unhandled (a crash) is handled when the provider
//    redelivers it after two minutes. A handling crash marks the email RED for the Owner - it is never silently lost.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyStandardWebhook } from "../auth-send-email-hook/webhookVerify.ts";
import { buildInboundRow, parseAllowedAddresses, recipientAllowed, addressList } from "./inbound.ts";
import { processInquiry, type InquiryRow } from "./process.ts";
import { supabaseStore } from "./store.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
export const ROW_COLUMNS = 'id, status, stored_at, from_address, to_addresses, subject, text_body, attachments, message_id, is_automated, mailbox, automation_class, reply_allowed, reference_ids, conversation_id, auth_results';
const RESUME_AFTER_MS = 120000;

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const PROVIDER_TIMEOUT_MS = 15000;

serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, code: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('RESEND_INBOUND_WEBHOOK_SECRET') ?? '';
  const allowed = parseAllowedAddresses(Deno.env.get('SUPPORT_INBOUND_ADDRESSES'));
  if (!secret || allowed.size === 0) return json({ ok: false, code: 'not_configured' }, 500);

  const rawBody = await req.text();
  const id = req.headers.get('svix-id') ?? req.headers.get('webhook-id');
  const verified = await verifyStandardWebhook({
    id,
    timestamp: req.headers.get('svix-timestamp') ?? req.headers.get('webhook-timestamp'),
    signatureHeader: req.headers.get('svix-signature') ?? req.headers.get('webhook-signature'),
    rawBody, secret, nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!verified.ok) return json({ ok: false, code: 'invalid_signature' }, 401);

  // deno-lint-ignore no-explicit-any
  let event: any;
  try { event = JSON.parse(rawBody); } catch { return json({ ok: false, code: 'invalid_payload' }, 400); }
  if (event?.type !== 'email.received') return json({ ok: true, ignored: 'event_type' });
  const data = event?.data;
  const emailId = typeof data?.email_id === 'string' ? data.email_id : '';
  if (!emailId || !/^[A-Za-z0-9-]{1,200}$/.test(emailId)) return json({ ok: false, code: 'invalid_payload' }, 400);
  const recipients = [...addressList(data?.to), ...addressList(data?.received_for), ...addressList(data?.cc)];
  if (!recipientAllowed(recipients, allowed)) return json({ ok: true, ignored: 'recipient' });

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), PROVIDER_TIMEOUT_MS);
  // deno-lint-ignore no-explicit-any
  let email: any;
  try {
    const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
      // the project's sending key may be "sending access" only - reading received mail needs its own full-access key (2026-10-19)
      headers: { Authorization: `Bearer ${Deno.env.get('RESEND_RECEIVING_API_KEY') || Deno.env.get('RESEND_API_KEY') || ''}` }, signal: abort.signal,
    });
    if (!res.ok) return json({ ok: false, code: 'provider_failure', status: res.status }, 502);
    email = await res.json();
  } catch {
    return json({ ok: false, code: 'provider_failure' }, 502);
  } finally {
    clearTimeout(timer);
  }

  const row = buildInboundRow({ eventId: String(id), webhookData: data, email });
  if (!row) return json({ ok: false, code: 'invalid_message' }, 422);
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  const { data: inserted, error } = await admin.from('support_inbound_messages').upsert(row, { onConflict: 'provider,provider_email_id', ignoreDuplicates: true }).select(ROW_COLUMNS);
  if (error) return json({ ok: false, code: 'store_failed' }, 500);
  let target: InquiryRow | null = Array.isArray(inserted) && inserted[0] ? inserted[0] : null;
  if (!target) {
    const { data: existing } = await admin.from('support_inbound_messages').select(ROW_COLUMNS).eq('provider', 'resend').eq('provider_email_id', row.provider_email_id).maybeSingle();
    if (existing?.status === 'new' && Date.now() - Date.parse(existing.stored_at) > RESUME_AFTER_MS) target = existing;
  }
  if (target) {
    const store = supabaseStore(admin);
    const work = processInquiry(target, {
      store,
      model: { fetch: fetch as never, apiKey: Deno.env.get('OPENAI_API_KEY') ?? '' },
      mail: { fetch: fetch as never, apiKey: Deno.env.get('RESEND_API_KEY') ?? '' },
      ownerAddress: (Deno.env.get('SUPPORT_OWNER_NOTIFY_ADDRESS') ?? '').trim(),
      now: () => new Date(),
    }).catch(async (e) => {
      console.error('support-inbound: handling failed', e instanceof Error ? e.message : e);
      await store.update(target!.id, { bin: target!.reply_allowed === false ? 'grey' : 'red', bin_reason: 'processing_failed', status: 'waiting', processed_at: new Date().toISOString() }, ['new']);
    });
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(work); else await work;
  }
  return json({ ok: true, stored: Array.isArray(inserted) && inserted.length > 0 });
});
