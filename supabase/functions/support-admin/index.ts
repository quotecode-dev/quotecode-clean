/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
// support-admin (Owner console 2026-10-20, typed: "מאשר שינוי ב-L-22: שלב 2 של המייל החכם (צבעים, מונה, טיוטות, שבוע ניסיון ועמודת
// הכתובת)"; spec docs/SMART_SUPPORT_EMAIL_SPEC_2026-10-19.md section 7): the Owner's actions from the admin "פניות" tab.
//  - Super admin only: the caller's JWT is verified, then business_settings.role must be 'super_admin' (the same check as the other
//    admin functions). Every write runs with the service role AFTER that check - the tables have no client write path.
//  - Owner console 2026-10-20 (L-22 "... ומשתמש מפקח עם מסך הרשאות מנהל"): or a supervisor the Owner granted the matching permission -
//    'inquiries.reply' for send / redraft / dismiss, 'inquiries.settings' for settings - asked of the database AS THE CALLER
//    (has_admin_permission(), SECURITY DEFINER over admin_permission_grants); any error = refused.
//  - send     {id, text}  "מאשר ושולח" / "מתקן ושולח" / a reply to a RED email - through the one mail gate (process.ts ownerSend).
//  - redraft  {id}        "בקש מהעוזר טיוטה" - a new draft from the product facts only; nothing is sent.
//  - dismiss  {id}        "לא לשלוח" - nothing is sent, the inquiry leaves the waiting list.
//  - settings {auto_send_green, auto_send_yellow, paused}  sending by colour (the trial) and the stop switch.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ownerSend, type InquiryRow } from "../support-inbound/process.ts";
import { draftReply } from "../support-inbound/assistant.ts";
import { supabaseStore } from "../support-inbound/store.ts";
import { detectLanguage } from "../support-inbound/triage.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const ROW = 'id, status, from_address, to_addresses, subject, text_body, attachments, message_id, is_automated, mailbox, reply_language, bin, draft_reply';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, code: 'method_not_allowed' }, 405);
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ ok: false, code: 'unauthorized' }, 401);
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
  const { data: authData, error: authErr } = await caller.auth.getUser();
  const user = authData?.user;
  if (authErr || !user) return json({ ok: false, code: 'unauthorized' }, 401);
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  // deno-lint-ignore no-explicit-any
  let body: any = null;
  try { body = await req.json(); } catch { body = null; }
  const action = String(body?.action || '');
  const { data: biz } = await admin.from('business_settings').select('role').eq('user_id', user.id).maybeSingle();
  let allowed = biz?.role === 'super_admin';
  if (!allowed) {
    const { data: has, error: permErr } = await caller.rpc('has_admin_permission', { p_permission: action === 'settings' ? 'inquiries.settings' : 'inquiries.reply' });
    allowed = !permErr && has === true;
  }
  if (!allowed) return json({ ok: false, code: 'forbidden' }, 403);
  if (!body || typeof body !== 'object') return json({ ok: false, code: 'invalid_request' }, 400);
  const store = supabaseStore(admin);
  const now = () => new Date();

  if (action === 'settings') {
    const patch: Record<string, unknown> = { updated_at: now().toISOString(), updated_by: user.id };
    for (const k of ['auto_send_green', 'auto_send_yellow', 'paused']) {
      if (k in (body ?? {})) {
        if (typeof body[k] !== 'boolean') return json({ ok: false, code: 'invalid_request' }, 400);
        patch[k] = body[k];
      }
    }
    const { data, error } = await admin.from('support_assistant_settings').update(patch).eq('id', 1).select('auto_send_green, auto_send_yellow, paused');
    if (error || !data?.length) return json({ ok: false, code: 'store_failed' }, 500);
    return json({ ok: true, settings: data[0] });
  }

  const id = String(body?.id || '');
  if (!UUID.test(id)) return json({ ok: false, code: 'invalid_request' }, 400);
  const { data: row, error: readErr } = await admin.from('support_inbound_messages').select(ROW).eq('id', id).maybeSingle();
  if (readErr) return json({ ok: false, code: 'store_failed' }, 500);
  if (!row) return json({ ok: false, code: 'not_found' }, 404);

  if (action === 'send') {
    const result = await ownerSend(row as InquiryRow, String(body?.text ?? ''), { store, mail: { fetch: fetch as never, apiKey: Deno.env.get('RESEND_API_KEY') ?? '' }, now });
    if (result === 'sent') return json({ ok: true, status: 'answered' });
    return json({ ok: false, code: result }, result === 'invalid' ? 400 : result === 'already_handled' ? 409 : 502);
  }
  if (action === 'redraft') {
    const lang = row.reply_language === 'en' || row.reply_language === 'he' ? row.reply_language : detectLanguage(row.subject, row.text_body);
    const draft = await draftReply({ fetch: fetch as never, apiKey: Deno.env.get('OPENAI_API_KEY') ?? '' }, row.subject, row.text_body, lang);
    if (!draft) return json({ ok: false, code: 'no_safe_answer' }, 422);
    if (!await store.update(id, { draft_reply: draft }, ['new', 'waiting', 'draft'])) return json({ ok: false, code: 'already_handled' }, 409);
    return json({ ok: true, draft });
  }
  if (action === 'dismiss') {
    if (!await store.update(id, { status: 'dismissed', handled_at: now().toISOString() }, ['new', 'waiting', 'draft'])) return json({ ok: false, code: 'already_handled' }, 409);
    return json({ ok: true, status: 'dismissed' });
  }
  return json({ ok: false, code: 'invalid_request' }, 400);
});
