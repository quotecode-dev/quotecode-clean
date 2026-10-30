/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ==========================================
// 🚨 מקבל Webhooks חיים מ-Resend (מוגדר ב-resend.com/webhooks) על אירועי מייל,
// ותפקידה היחיד: לזהות מייל שנכשל/הוחזר ("invalid/bounced") ולסמן זאת על
// שורת ה-quote המקורית כדי שנורית הסטטוס בדשבורד תהפוך לאדומה.
//
// אבטחה: Resend חותם כל בקשה בפרוטוקול Svix הסטנדרטי (svix-id/svix-timestamp/
// svix-signature) - מאומת כאן מול RESEND_WEBHOOK_SECRET (מהגדרות ה-Webhook
// ב-Resend), ולכן verify_jwt=false בקונפיג: זו לא קריאה עם JWT של Supabase
// בכלל, האימות היחיד הוא חתימת ה-Webhook עצמה.
//
// מתאם את האירוע להצעת המחיר המקורית דרך tags.quote_id שמצורף לכל שליחה
// ב-send-quote-email (Resend מחזיר את אותם tags בחזרה בכל אירוע Webhook).
//
// Codex SEC-EF-03 / SEC-LOG-02 (Owner console 2026-10-30, typed: "אשר עבודה רצופה מעכשיו: ממצאי האבטחה ..."):
//  - a signature older or newer than 5 minutes is refused (a captured request cannot be replayed later);
//  - every event id is accepted once (resend_webhook_events) and a bounce marks the quote only when it belongs to the quote's NEWEST
//    sent email (quote_email_sends) - an old bounce never turns a newer, good send red;
//  - errors answer with a fixed code, never a database / provider message.
// ==========================================

export const MAX_SKEW_SECONDS = 300;
/** Standard Webhooks freshness: the signed timestamp (seconds) within 5 minutes of now. */
export function timestampFresh(svixTimestamp: string, nowSeconds: number): boolean {
  if (!/^[0-9]{9,11}$/.test(svixTimestamp)) return false;
  return Math.abs(nowSeconds - Number(svixTimestamp)) <= MAX_SKEW_SECONDS;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// אימות חתימת Webhook לפי הסטנדרט הפתוח Svix/Standard Webhooks: החתימה היא
// HMAC-SHA256 על המחרוזת "{svix-id}.{svix-timestamp}.{raw-body}", עם המפתח
// שמתקבל מפענוח ה-base64 שאחרי הקידומת "whsec_". svix-signature עשוי להכיל
// כמה חתימות מופרדות ברווח, כל אחת בפורמט "v1,<base64>" - תקף אם ANY מהן תואמת.
async function verifySvixSignature(secret: string, svixId: string, svixTimestamp: string, svixSignature: string, rawBody: string): Promise<boolean> {
  const secretKey = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const keyBytes = Uint8Array.from(atob(secretKey), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(signedContent));
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  const providedSignatures = svixSignature.split(' ').map((part) => part.split(',')[1]).filter(Boolean);
  return providedSignatures.includes(expectedSignature);
}

function extractQuoteId(tags: unknown): string | null {
  if (!tags) return null;
  if (Array.isArray(tags)) {
    const match = tags.find((t: { name?: string; value?: string }) => t?.name === 'quote_id');
    return match?.value || null;
  }
  if (typeof tags === 'object') {
    return (tags as Record<string, string>).quote_id || null;
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();

    const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET') ?? '';
    if (!webhookSecret) {
      return jsonResponse({ error: 'RESEND_WEBHOOK_SECRET is not configured for this function.' }, 500);
    }

    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      return jsonResponse({ error: 'Missing Svix signature headers' }, 401);
    }

    const isValid = await verifySvixSignature(webhookSecret, svixId, svixTimestamp, svixSignature, rawBody);
    if (!isValid) {
      return jsonResponse({ error: 'Invalid webhook signature' }, 401);
    }
    if (!timestampFresh(svixTimestamp, Math.floor(Date.now() / 1000))) {
      return jsonResponse({ error: 'stale_webhook' }, 401);
    }

    const event = JSON.parse(rawBody);
    const eventType: string = event?.type || '';

    // רק כשל/החזרה קשיחה נחשבים "כתובת לא קיימת" לצורך הפיצ'ר הזה - לא
    // פותחות/קליקים/תלונות שאינם קשורים לתקינות הכתובת עצמה
    if (eventType !== 'email.bounced' && eventType !== 'email.failed') {
      return jsonResponse({ received: true, ignored: eventType }, 200);
    }

    const taggedQuote = extractQuoteId(event?.data?.tags);
    const quoteId = taggedQuote && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taggedQuote) ? taggedQuote : null;
    if (!quoteId) {
      // מייל שנכשל/הוחזר בלי quote_id מתויג (למשל מיילי תזכורת אחרים) - אין
      // מה לעדכן, אבל זו לא שגיאה מבחינת Resend
      return jsonResponse({ received: true, skipped: 'no quote_id tag' }, 200);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')['default'] ?? '';
    const adminClient = createClient(supabaseUrl, secretKey);

    const emailId = typeof event?.data?.email_id === 'string' ? event.data.email_id : null;
    const bounceReason = String(event?.data?.bounce?.message || event?.data?.bounce?.type || eventType).slice(0, 300);
    // the event record and the bounce mark are one database transaction (resend_webhook_accept): a failure records nothing, so the
    // provider's retry is applied
    const { data: verdict, error: acceptErr } = await adminClient.rpc('resend_webhook_accept', { p_event_id: svixId, p_event_type: eventType, p_email_id: emailId, p_quote: quoteId, p_reason: bounceReason });
    if (acceptErr) {
      console.error('resend-email-webhook: the event could not be recorded');
      return jsonResponse({ error: 'store_failed' }, 500);
    }
    if (verdict?.accept !== true) {
      return jsonResponse({ received: true, skipped: String(verdict?.reason || 'not_current') }, 200);
    }

    return jsonResponse({ received: true, quoteId, marked: 'bounced' }, 200);
  } catch (error: unknown) {
    console.error('resend-email-webhook error:', error instanceof Error ? error.name : 'unknown');
    return jsonResponse({ error: 'invalid_request' }, 400);
  }
});
