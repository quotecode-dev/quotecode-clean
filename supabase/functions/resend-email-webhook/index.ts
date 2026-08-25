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
// ==========================================

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

    const event = JSON.parse(rawBody);
    const eventType: string = event?.type || '';

    // רק כשל/החזרה קשיחה נחשבים "כתובת לא קיימת" לצורך הפיצ'ר הזה - לא
    // פותחות/קליקים/תלונות שאינם קשורים לתקינות הכתובת עצמה
    if (eventType !== 'email.bounced' && eventType !== 'email.failed') {
      return jsonResponse({ received: true, ignored: eventType }, 200);
    }

    const quoteId = extractQuoteId(event?.data?.tags);
    if (!quoteId) {
      // מייל שנכשל/הוחזר בלי quote_id מתויג (למשל מיילי תזכורת אחרים) - אין
      // מה לעדכן, אבל זו לא שגיאה מבחינת Resend
      return jsonResponse({ received: true, skipped: 'no quote_id tag' }, 200);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')['default'] ?? '';
    const adminClient = createClient(supabaseUrl, secretKey);

    const bounceReason = event?.data?.bounce?.message || event?.data?.bounce?.type || eventType;

    const { error: updateErr } = await adminClient
      .from('quotes')
      .update({
        email_bounced: true,
        email_bounce_reason: bounceReason,
        email_bounced_at: new Date().toISOString(),
      })
      .eq('id', quoteId);

    if (updateErr) {
      console.error(`Failed to mark quote ${quoteId} as bounced:`, updateErr.message);
      return jsonResponse({ error: updateErr.message }, 500);
    }

    return jsonResponse({ received: true, quoteId, marked: 'bounced' }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('resend-email-webhook error:', message);
    return jsonResponse({ error: message }, 400);
  }
});
