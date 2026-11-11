/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
// quote-signed-notice (Owner 2026-11-11, finding 18): ONE email to the business owner when a customer signs. Called by the customer page
// right after a successful signature (anonymous, like get-public-quote). The server decides everything from its own data with the
// service role: the quote must be signed within the last two hours, and quote_signed_owner_notices (migration 20261111100000) is written
// BEFORE the email - a second call for the same quote sends nothing. The answer never tells whether the id exists or was signed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMail } from "../support-inbound/mail.ts";
import { isFreshSignature, marketOf, parseRequest, SENDER, signedNoticeContent } from "./lib.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const done = () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ ok: false, code: 'method_not_allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  let quoteId: string | null = null;
  try { quoteId = parseRequest(await req.json()); } catch { quoteId = null; }
  if (!quoteId) return done();
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: q } = await admin.from('quotes')
      .select('id, user_id, quote_number, signed_at, signature, signer_name, clients ( company_name )')
      .eq('id', quoteId).maybeSingle();
    if (!q || !q.user_id || !q.signature || !isFreshSignature(q.signed_at, Date.now())) return done();
    // the record first: only the call that creates it sends the email
    const { data: rec } = await admin.from('quote_signed_owner_notices')
      .upsert({ quote_id: q.id, user_id: q.user_id, signed_at: q.signed_at }, { onConflict: 'quote_id', ignoreDuplicates: true })
      .select('quote_id');
    if (!Array.isArray(rec) || rec.length !== 1) return done();
    const [{ data: owner }, { data: biz }] = await Promise.all([
      admin.auth.admin.getUserById(q.user_id),
      admin.from('business_settings').select('country').eq('user_id', q.user_id).maybeSingle(),
    ]);
    const to = owner?.user?.email ?? '';
    if (!to) return done();
    const market = marketOf(biz?.country);
    const clientName = String((q.clients as { company_name?: string } | null)?.company_name || q.signer_name || '');
    const content = signedNoticeContent({ quoteId: q.id, quoteNumber: q.quote_number ?? null, signedAt: q.signed_at, clientName, market });
    const sent = await sendMail({ fetch: fetch as never, apiKey: Deno.env.get('RESEND_API_KEY') ?? '' }, {
      ...SENDER[market], to, subject: content.subject, text: content.text, idempotencyKey: `quote-signed/${q.id}`,
    });
    if (sent.ok) await admin.from('quote_signed_owner_notices').update({ sent: true }).eq('quote_id', q.id);
  } catch {
    // a failure never reaches the customer page (the signature itself is already done)
  }
  return done();
});
