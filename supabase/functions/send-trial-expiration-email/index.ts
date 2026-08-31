/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveTrialReminderStage } from "./eligibility.ts";

// ==========================================
// 🚨 פונקציה זו אחראית באופן בלעדי על מיילי תזכורת תום תקופת ניסיון חינמית
// (14 יום), בשני שלבים: 3 ימים לפני ו-24 שעות לפני התפוגה. נשלחת דרך Resend
// מ-support@quotecodepro.com למשתמשים דוברי עברית ומ-info@quotecodepro.com
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
const HEADER_BG = '#111112';
const FLOW_PURPLE = '#d8b4fe';
const ACCENT_VIOLET = '#8b5cf6';

type Stage = '3d' | '24h';

function senderAddressFor(isHebrew: boolean) {
  return isHebrew ? 'ProFlow Support <support@quotecodepro.com>' : 'ProFlow <info@quotecodepro.com>';
}

function formatDate(dateStr: string, isHebrew: boolean) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(isHebrew ? 'he-IL' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function wrapEmail(isHebrew: boolean, bodyHtml: string) {
  return `<!DOCTYPE html>
<html dir="${isHebrew ? 'rtl' : 'ltr'}" lang="${isHebrew ? 'he' : 'en'}">
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Segoe UI,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:${HEADER_BG};padding:20px 28px;">
              <span style="color:#ffffff;font-size:1.2rem;font-weight:800;font-family:Arial,Segoe UI,sans-serif;">Pro</span><span style="color:${FLOW_PURPLE};font-size:1.2rem;font-weight:800;font-family:Arial,Segoe UI,sans-serif;">Flow</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;text-align:${isHebrew ? 'right' : 'left'};color:#1e293b;">
              ${bodyHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(isHebrew: boolean) {
  const url = 'https://www.quotecodepro.com/dashboard' + (isHebrew ? '' : '?lang=en');
  return `<a href="${url}" style="display:inline-block;margin-top:16px;background:${ACCENT_VIOLET};color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:700;font-size:0.9rem;">${isHebrew ? 'שדרג עכשיו' : 'Upgrade Now'}</a>`;
}

function buildTrialReminderEmail({ stage, businessName, trialEndsAt, isHebrew }: {
  stage: Stage; businessName: string; trialEndsAt: string; isHebrew: boolean;
}) {
  const name = businessName || (isHebrew ? 'עסק יקר' : 'there');
  const dateStr = formatDate(trialEndsAt, isHebrew);

  if (stage === '3d') {
    const subject = isHebrew
      ? 'תקופת הניסיון שלך ב-ProFlow מסתיימת בעוד 3 ימים'
      : 'Your ProFlow trial ends in 3 days';
    const html = wrapEmail(isHebrew, `
      <div dir="${isHebrew ? 'rtl' : 'ltr'}" style="text-align:${isHebrew ? 'right' : 'left'};">
        <p style="font-size:1rem; margin-bottom:16px;">${isHebrew ? `שלום ${name},` : `Hi ${name},`}</p>
        <p style="font-size:0.95rem; line-height:1.6; margin-bottom:16px;">
          ${isHebrew
            ? `תקופת הניסיון החינמית שלך במערכת <strong>ProFlow</strong> עומדת להסתיים בתאריך <strong>${dateStr}</strong> (עוד 3 ימים). כדי להמשיך ליהנות מכלל יכולות ה-PRO ללא שום הפרעה, נשמח שתשדרג את החשבון שלך לתוכנית בתשלום.`
            : `Your free ProFlow trial ends on <strong>${dateStr}</strong> (in 3 days). To keep enjoying all PRO features without interruption, upgrade to a paid plan.`}
        </p>
        ${ctaButton(isHebrew)}
      </div>
    `);
    const text = isHebrew
      ? `שלום ${name}, תקופת הניסיון שלך ב-ProFlow מסתיימת ב-${dateStr} (עוד 3 ימים). שדרג עכשיו: https://www.quotecodepro.com/dashboard`
      : `Hi ${name}, your ProFlow trial ends on ${dateStr} (in 3 days). Upgrade now: https://www.quotecodepro.com/dashboard?lang=en`;
    return { subject, html, text };
  }

  const subject = isHebrew
    ? 'תזכורת אחרונה: תקופת הניסיון שלך מסתיימת מחר'
    : 'Last reminder: your ProFlow trial ends tomorrow';
  const html = wrapEmail(isHebrew, `
    <div dir="${isHebrew ? 'rtl' : 'ltr'}" style="text-align:${isHebrew ? 'right' : 'left'};">
      <p style="font-size:1rem; margin-bottom:16px;">${isHebrew ? `שלום ${name},` : `Hi ${name},`}</p>
      <p style="font-size:0.95rem; line-height:1.6; margin-bottom:16px;">
        ${isHebrew
          ? `נשארו פחות מ-24 שעות לתקופת הניסיון שלך ב-ProFlow, שתסתיים בתאריך <strong>${dateStr}</strong>. לאחר מכן החשבון יעבור אוטומטית לתוכנית החינמית. שדרג עכשיו כדי להימנע מהפסקת שירות.`
          : `Less than 24 hours remain on your ProFlow trial, ending on <strong>${dateStr}</strong>. After that your account moves automatically to the Free plan. Upgrade now to avoid any interruption.`}
      </p>
      ${ctaButton(isHebrew)}
    </div>
  `);
  const text = isHebrew
    ? `שלום ${name}, נשארו פחות מ-24 שעות לתקופת הניסיון שלך ב-ProFlow (מסתיימת ב-${dateStr}). שדרג עכשיו: https://www.quotecodepro.com/dashboard`
    : `Hi ${name}, less than 24 hours remain on your ProFlow trial (ends ${dateStr}). Upgrade now: https://www.quotecodepro.com/dashboard?lang=en`;
  return { subject, html, text };
}

async function sendViaResend(resendApiKey: string, { from, to, subject, html, text }: {
  from: string; to: string; subject: string; html: string; text: string;
}) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || `Resend API error (status ${res.status})`);
  }
  return data;
}

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

      const TEST_BYPASS_EMAILS = new Set(['tahshitishi@gmail.com', 'minhatshay@gmail.com']);
      const isBypassedTestRecipient = TEST_BYPASS_EMAILS.has(email.toLowerCase());

      if (!isBypassedTestRecipient) {
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
      }

      const useHebrew = Boolean(body.isHebrew);
      const useStage: Stage = body.stage === '24h' ? '24h' : '3d';
      const fakeTrialEndsAt = new Date(Date.now() + (useStage === '3d' ? 3 : 1) * MS_PER_DAY).toISOString();
      const businessName = body.businessName || (useHebrew ? 'עסק לדוגמה' : 'Test Business');

      const { subject, html, text } = buildTrialReminderEmail({
        stage: useStage,
        businessName,
        trialEndsAt: fakeTrialEndsAt,
        isHebrew: useHebrew,
      });

      await sendViaResend(resendApiKey, {
        from: senderAddressFor(useHebrew),
        to: email,
        subject: `[TEST] ${subject}`,
        html,
        text,
      });

      return jsonResponse({ success: true, sentTo: email, stage: useStage, language: useHebrew ? 'he' : 'en' }, 200);
    }

    const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
    const providedSecret = req.headers.get('x-cron-secret') || '';
    if (!cronSecret || providedSecret !== cronSecret) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { data: candidates, error: candidatesErr } = await adminClient
      .from('business_settings')
      .select('user_id, email, business_name, country, trial_ends_at, trial_reminder_3d_sent, trial_reminder_24h_sent, role, plan')
      .not('trial_ends_at', 'is', null)
      .or('trial_reminder_3d_sent.is.false,trial_reminder_24h_sent.is.false');

    if (candidatesErr) throw candidatesErr;

    const now = Date.now();
    let sent3d = 0;
    let sent24h = 0;
    const errors: string[] = [];

    for (const biz of candidates || []) {
      const stage = resolveTrialReminderStage(biz, now);
      if (!stage) continue;

      const isHebrew = (biz.country || 'Local') !== 'International';

      try {
        if (stage === '3d') {
          const { subject, html, text } = buildTrialReminderEmail({ stage: '3d', businessName: biz.business_name, trialEndsAt: biz.trial_ends_at, isHebrew });
          await sendViaResend(resendApiKey, { from: senderAddressFor(isHebrew), to: biz.email, subject, html, text });
          await adminClient.from('business_settings').update({ trial_reminder_3d_sent: true }).eq('user_id', biz.user_id);
          sent3d++;
        } else {
          const { subject, html, text } = buildTrialReminderEmail({ stage: '24h', businessName: biz.business_name, trialEndsAt: biz.trial_ends_at, isHebrew });
          await sendViaResend(resendApiKey, { from: senderAddressFor(isHebrew), to: biz.email, subject, html, text });
          await adminClient.from('business_settings').update({ trial_reminder_24h_sent: true }).eq('user_id', biz.user_id);
          sent24h++;
        }
      } catch (sendErr: unknown) {
        const msg = sendErr instanceof Error ? sendErr.message : 'Unknown send error';
        console.error(`Failed to send trial reminder to ${biz.email}:`, msg);
        errors.push(`${biz.email}: ${msg}`);
      }
    }

    return jsonResponse({ success: true, sent3d, sent24h, errors }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('send-trial-expiration-email error:', message);
    return jsonResponse({ error: message }, 400);
  }
});