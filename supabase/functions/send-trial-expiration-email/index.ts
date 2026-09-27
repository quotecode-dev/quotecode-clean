/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildTrialReminderEmail, senderAddressFor, type Stage } from "./reminderContent.ts";
import { runTrialReminderBatch, sendViaResendWithOutcome, type SendOutcome } from "./reminderRun.ts";

// ==========================================
// 🚨 פונקציה זו אחראית באופן בלעדי על מיילי תזכורת תום תקופת ניסיון חינמית
// (14 יום), בשני שלבים: 3 ימים לפני ו-24 שעות לפני התפוגה. נשלחת דרך Resend
// מ-support@tekango.com למשתמשים דוברי עברית ומ-info@tekango.com
// למשתמשים דוברי אנגלית.
// ==========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Codex Post-LIVE Wave 1 blockers 3 + 5 (2026-09-27): content lives in ./reminderContent.ts (market-keyed), the batch in
// ./reminderRun.ts (atomic DB claim -> idempotency-keyed send -> verified completion; exact-market fail-closed), backed by
// migration 20260927000000_trial_reminder_delivery_claims.sql. This function must not be deployed before that migration.

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const mode = body.mode === 'test' ? 'test' : 'batch';

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')['default'] ?? '';
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';

    if (!resendApiKey) {
      return jsonResponse({ error: 'RESEND_API_KEY is not configured for this function.' }, 500);
    }

    const adminClient = createClient(supabaseUrl, secretKey);

    if (mode === 'test') {
      const email = body.email;
      if (!email || typeof email !== 'string') {
        return jsonResponse({ error: 'Missing or invalid "email"' }, 400);
      }

      // חוק ברזל (Entitlement Audit task, 2026-09-08, ממצא אבטחה אמיתי -
      // "test-only bypasses in email diagnostics", בדיוק הסיכון שהמשימה
      // ביקשה במפורש לבדוק מחדש): גרסה קודמת כאן דילגה על כל בדיקת-
      // super_admin כש-email היה אחת משתי כתובות קשיחות-בקוד - כלומר כל
      // מבקש לא-מאומת (אין דרישת Authorization header בכלל בענף הזה) יכול
      // היה להפעיל שליחת מייל אמיתית דרך Resend, ללא הגבלה, כל עוד ידע את
      // אחת משתי הכתובות. הוסר לגמרי - בדיקת super_admin חלה תמיד, ללא
      // יוצא מן הכלל, תואם את התבנית הקיימת בכל שאר הפרויקט (למשל הטריגר
      // guard_business_settings_plan_trial, §206) של "אימות-role עצמאי
      // בצד-שרת תמיד, ללא קיצורי-דרך נוחות".
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return jsonResponse({ error: 'Missing Authorization header' }, 401);
      }

      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user: callerUser }, error: callerAuthErr } = await callerClient.auth.getUser();
      if (callerAuthErr || !callerUser) {
        return jsonResponse({ error: 'Invalid or expired session' }, 401);
      }

      const { data: callerBiz, error: callerBizErr } = await adminClient
        .from('business_settings')
        .select('role')
        .eq('user_id', callerUser.id)
        .maybeSingle();

      if (callerBizErr) {
        return jsonResponse({ error: `Failed to verify caller permissions: ${callerBizErr.message}` }, 500);
      }
      if (callerBiz?.role !== 'super_admin') {
        return jsonResponse({ error: 'Forbidden: super_admin role required' }, 403);
      }

      const useHebrew = Boolean(body.isHebrew);
      const useStage: Stage = body.stage === '24h' ? '24h' : '3d';
      const fakeTrialEndsAt = new Date(Date.now() + (useStage === '3d' ? 3 : 1) * MS_PER_DAY).toISOString();
      const businessName = body.businessName || (useHebrew ? 'עסק לדוגמה' : 'Test Business');

      // Super-admin preview only: the admin explicitly chooses the language; no account market is involved.
      const testMarket = useHebrew ? 'Local' : 'International';
      const { subject, html, text } = buildTrialReminderEmail({
        stage: useStage,
        businessName,
        trialEndsAt: fakeTrialEndsAt,
        market: testMarket,
      });

      const testResult: SendOutcome = await sendViaResendWithOutcome(fetch, resendApiKey, {
        from: senderAddressFor(testMarket),
        to: email,
        subject: `[TEST] ${subject}`,
        html,
        text,
      }, `trial-reminder-test/${crypto.randomUUID()}`);
      if (testResult.outcome !== 'sent') {
        throw new Error(testResult.error);
      }

      return jsonResponse({ success: true, sentTo: email, stage: useStage, language: useHebrew ? 'he' : 'en' }, 200);
    }

    const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
    const providedSecret = req.headers.get('x-cron-secret') || '';
    if (!cronSecret || providedSecret !== cronSecret) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { data: candidates, error: candidatesErr } = await adminClient
      .from('business_settings')
      .select('user_id, email, business_name, country, trial_ends_at, trial_reminder_3d_sent, trial_reminder_24h_sent, role, plan, is_lifetime')
      .not('trial_ends_at', 'is', null)
      .or('trial_reminder_3d_sent.is.false,trial_reminder_24h_sent.is.false');

    if (candidatesErr) throw candidatesErr;

    const summary = await runTrialReminderBatch(candidates || [], Date.now(), {
      claim: async (userId, stage) => {
        const { data, error } = await adminClient.rpc('claim_trial_reminder', { p_user_id: userId, p_stage: stage });
        if (error) throw new Error(error.message);
        if (data == null) return null;
        if (typeof data?.claim_id !== 'string' || typeof data?.idempotency_key !== 'string') {
          throw new Error('claim_trial_reminder returned an unexpected shape');
        }
        return { claimId: data.claim_id, idempotencyKey: data.idempotency_key, attempt: Number(data.attempt) };
      },
      transport: (message, idempotencyKey) => sendViaResendWithOutcome(fetch, resendApiKey, message, idempotencyKey),
      complete: async (userId, stage: Stage, claimId, result) => {
        const { data, error } = await adminClient.rpc('complete_trial_reminder', {
          p_user_id: userId,
          p_stage: stage,
          p_claim_id: claimId,
          p_outcome: result.outcome,
          p_provider_message_id: result.outcome === 'sent' ? result.messageId : null,
          p_error: result.outcome === 'sent' ? null : result.error,
        });
        if (error) throw new Error(error.message);
        return data === true;
      },
    });

    for (const line of summary.errors) console.error(`send-trial-expiration-email: ${line}`);
    return jsonResponse({ success: true, ...summary }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('send-trial-expiration-email error:', message);
    return jsonResponse({ error: message }, 400);
  }
});