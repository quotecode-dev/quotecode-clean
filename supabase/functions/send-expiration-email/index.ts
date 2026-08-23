/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ==========================================
// 🚨 פונקציה זו היא המנוע היחיד לשליחת מיילי תזכורת תפוגה (Resend), עבור שני
// זרמים עצמאיים - "trial" (תום תקופת ניסיון חינמית) ו-"subscription" (תפוגת
// מנוי בתשלום), כל אחד בשני שלבים (3 ימים / 24 שעות לפני התפוגה).
//
// שני מצבי הפעלה:
//   - mode "batch": ריצה יומית אוטומטית (מוגנת ב-CRON_SECRET משותף), נקראת
//     על-ידי Vercel Cron (api/cron.js). סורקת את business_settings ושולחת
//     תזכורות לכל המשתמשים הרלוונטיים משני הזרמים גם יחד.
//   - mode "test": שליחת מייל בודד מיידי לכתובת נתונה, מוגבל ל-super_admin
//     בלבד (מאומת דרך ה-JWT של הקורא) - משמש את כפתורי בדיקת המייל בדשבורד.
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
type FlowType = 'trial' | 'subscription';

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

function ctaButton(isHebrew: boolean, label?: string) {
  const url = 'https://www.quotecodepro.com/dashboard' + (isHebrew ? '' : '?lang=en');
  const text = label || (isHebrew ? 'שדרג עכשיו' : 'Upgrade Now');
  return `<a href="${url}" style="display:inline-block;margin-top:16px;background:${ACCENT_VIOLET};color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:700;font-size:0.9rem;">${text}</a>`;
}

interface ReminderParams {
  stage: Stage;
  businessName: string;
  endsAt: string;
  isHebrew: boolean;
}

// זרם 1: תום תקופת ניסיון חינמית (14 יום) - עדיין לא רכשו מנוי בתשלום
function buildTrialReminderEmail({ stage, businessName, endsAt, isHebrew }: ReminderParams) {
  const name = businessName || (isHebrew ? 'לקוח יקר' : 'there');
  const dateStr = formatDate(endsAt, isHebrew);

  if (stage === '3d') {
    const subject = isHebrew
      ? 'תקופת הניסיון שלך ב-ProFlow מסתיימת בעוד 3 ימים'
      : 'Your ProFlow trial ends in 3 days';
    const html = wrapEmail(isHebrew, `
      <p style="font-size:1rem;">${isHebrew ? `שלום ${name},` : `Hi ${name},`}</p>
      <p style="font-size:0.95rem;line-height:1.6;">
        ${isHebrew
          ? `תקופת הניסיון החינמית שלך ב-ProFlow תסתיים בתאריך <strong>${dateStr}</strong> (עוד 3 ימים). כדי להמשיך ליהנות מכל יכולות ה-PRO ללא הפרעה, נשמח שתשדרג לתוכנית בתשלום.`
          : `Your free ProFlow trial ends on <strong>${dateStr}</strong> (in 3 days). To keep enjoying all PRO features without interruption, upgrade to a paid plan.`}
      </p>
      ${ctaButton(isHebrew)}
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
    <p style="font-size:1rem;">${isHebrew ? `שלום ${name},` : `Hi ${name},`}</p>
    <p style="font-size:0.95rem;line-height:1.6;">
      ${isHebrew
        ? `נשארו פחות מ-24 שעות לתקופת הניסיון שלך ב-ProFlow, שתסתיים בתאריך <strong>${dateStr}</strong>. לאחר מכן החשבון יעבור אוטומטית לתוכנית החינמית עם המגבלות שלה. שדרג עכשיו כדי להימנע מהפרעה.`
        : `Less than 24 hours remain on your ProFlow trial, ending on <strong>${dateStr}</strong>. After that your account moves automatically to the Free plan with its limits. Upgrade now to avoid any interruption.`}
    </p>
    ${ctaButton(isHebrew)}
  `);
  const text = isHebrew
    ? `שלום ${name}, נשארו פחות מ-24 שעות לתקופת הניסיון שלך ב-ProFlow (מסתיימת ב-${dateStr}). שדרג עכשיו: https://www.quotecodepro.com/dashboard`
    : `Hi ${name}, less than 24 hours remain on your ProFlow trial (ends ${dateStr}). Upgrade now: https://www.quotecodepro.com/dashboard?lang=en`;
  return { subject, html, text };
}

// זרם 2: תפוגת מנוי בתשלום (Basic/Pro) - חידוש נדרש כדי לא לאבד גישה
function buildSubscriptionReminderEmail({ stage, businessName, endsAt, isHebrew }: ReminderParams) {
  const name = businessName || (isHebrew ? 'לקוח יקר' : 'there');
  const dateStr = formatDate(endsAt, isHebrew);

  if (stage === '3d') {
    const subject = isHebrew
      ? 'המנוי שלך ב-ProFlow מתחדש/פג בעוד 3 ימים'
      : 'Your ProFlow subscription renews/expires in 3 days';
    const html = wrapEmail(isHebrew, `
      <p style="font-size:1rem;">${isHebrew ? `שלום ${name},` : `Hi ${name},`}</p>
      <p style="font-size:0.95rem;line-height:1.6;">
        ${isHebrew
          ? `המנוי בתשלום שלך ב-ProFlow עומד להסתיים בתאריך <strong>${dateStr}</strong> (עוד 3 ימים). כדי להבטיח המשך גישה רציפה לכל התכונות שלך ללא הפרעה, יש לחדש את המנוי מראש.`
          : `Your paid ProFlow subscription is set to end on <strong>${dateStr}</strong> (in 3 days). Renew now to make sure you keep uninterrupted access to all your features.`}
      </p>
      ${ctaButton(isHebrew, isHebrew ? 'חדש מנוי עכשיו' : 'Renew Subscription')}
    `);
    const text = isHebrew
      ? `שלום ${name}, המנוי שלך ב-ProFlow מסתיים ב-${dateStr} (עוד 3 ימים). חדש עכשיו: https://www.quotecodepro.com/dashboard`
      : `Hi ${name}, your ProFlow subscription ends on ${dateStr} (in 3 days). Renew now: https://www.quotecodepro.com/dashboard?lang=en`;
    return { subject, html, text };
  }

  const subject = isHebrew
    ? 'תזכורת אחרונה: המנוי שלך ב-ProFlow פג מחר'
    : 'Last reminder: your ProFlow subscription expires tomorrow';
  const html = wrapEmail(isHebrew, `
    <p style="font-size:1rem;">${isHebrew ? `שלום ${name},` : `Hi ${name},`}</p>
    <p style="font-size:0.95rem;line-height:1.6;">
      ${isHebrew
        ? `נשארו פחות מ-24 שעות למנוי שלך ב-ProFlow, שיסתיים בתאריך <strong>${dateStr}</strong>. לאחר מכן החשבון יעבור אוטומטית למסלול החינמי עם המגבלות שלו. חדש עכשיו כדי להימנע מהפרעה בעבודה השוטפת.`
        : `Less than 24 hours remain on your paid ProFlow subscription, ending on <strong>${dateStr}</strong>. After that your account moves automatically to the Free plan with its limits. Renew now to avoid any disruption to your work.`}
    </p>
    ${ctaButton(isHebrew, isHebrew ? 'חדש מנוי עכשיו' : 'Renew Subscription')}
  `);
  const text = isHebrew
    ? `שלום ${name}, נשארו פחות מ-24 שעות למנוי שלך ב-ProFlow (מסתיים ב-${dateStr}). חדש עכשיו: https://www.quotecodepro.com/dashboard`
    : `Hi ${name}, less than 24 hours remain on your ProFlow subscription (ends ${dateStr}). Renew now: https://www.quotecodepro.com/dashboard?lang=en`;
  return { subject, html, text };
}

function buildReminderEmail(type: FlowType, params: ReminderParams) {
  return type === 'subscription' ? buildSubscriptionReminderEmail(params) : buildTrialReminderEmail(params);
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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';

    if (!resendApiKey) {
      return jsonResponse({ error: 'RESEND_API_KEY is not configured for this function.' }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ===== מצב בדיקה: שליחת מייל בודד מיידי, מוגבל ל-super_admin =====
    if (mode === 'test') {
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

      const email = body.email;
      if (!email || typeof email !== 'string') {
        return jsonResponse({ error: 'Missing or invalid "email"' }, 400);
      }
      const useHebrew = Boolean(body.isHebrew);
      const useStage: Stage = body.stage === '24h' ? '24h' : '3d';
      const useType: FlowType = body.type === 'subscription' ? 'subscription' : 'trial';
      const fakeEndsAt = new Date(Date.now() + (useStage === '3d' ? 3 : 1) * MS_PER_DAY).toISOString();
      const businessName = body.businessName || (useHebrew ? 'עסק לדוגמה' : 'Test Business');

      const { subject, html, text } = buildReminderEmail(useType, {
        stage: useStage,
        businessName,
        endsAt: fakeEndsAt,
        isHebrew: useHebrew,
      });

      await sendViaResend(resendApiKey, {
        from: senderAddressFor(useHebrew),
        to: email,
        subject: `[TEST] ${subject}`,
        html,
        text,
      });

      return jsonResponse({ success: true, sentTo: email, type: useType, stage: useStage, language: useHebrew ? 'he' : 'en' }, 200);
    }

    // ===== מצב אוטומטי (batch): מוגן בסוד משותף, נקרא רק ע"י Vercel Cron =====
    const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
    const providedSecret = req.headers.get('x-cron-secret') || '';
    if (!cronSecret || providedSecret !== cronSecret) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const now = Date.now();
    const errors: string[] = [];
    let trialSent3d = 0;
    let trialSent24h = 0;
    let subSent3d = 0;
    let subSent24h = 0;

    // --- זרם 1: תזכורות תום תקופת ניסיון (trial_ends_at, מסלול חינמי בלבד) ---
    const { data: trialCandidates, error: trialErr } = await adminClient
      .from('business_settings')
      .select('user_id, email, business_name, country, trial_ends_at, trial_reminder_3d_sent, trial_reminder_24h_sent, role, plan')
      .not('trial_ends_at', 'is', null)
      .or('trial_reminder_3d_sent.is.false,trial_reminder_24h_sent.is.false');

    if (trialErr) throw trialErr;

    for (const biz of trialCandidates || []) {
      if (!biz.email || biz.role === 'super_admin') continue;
      if ((biz.plan || 'free').toLowerCase() !== 'free') continue; // כבר בתשלום - לא רלוונטי לתזכורת ניסיון

      const endsMs = new Date(biz.trial_ends_at).getTime();
      if (Number.isNaN(endsMs)) continue;

      const daysLeft = (endsMs - now) / MS_PER_DAY;
      const isHebrew = (biz.country || 'Local') !== 'International';

      try {
        if (!biz.trial_reminder_3d_sent && daysLeft <= 3 && daysLeft > 1) {
          const { subject, html, text } = buildReminderEmail('trial', { stage: '3d', businessName: biz.business_name, endsAt: biz.trial_ends_at, isHebrew });
          await sendViaResend(resendApiKey, { from: senderAddressFor(isHebrew), to: biz.email, subject, html, text });
          await adminClient.from('business_settings').update({ trial_reminder_3d_sent: true }).eq('user_id', biz.user_id);
          trialSent3d++;
        } else if (!biz.trial_reminder_24h_sent && daysLeft <= 1 && daysLeft > 0) {
          const { subject, html, text } = buildReminderEmail('trial', { stage: '24h', businessName: biz.business_name, endsAt: biz.trial_ends_at, isHebrew });
          await sendViaResend(resendApiKey, { from: senderAddressFor(isHebrew), to: biz.email, subject, html, text });
          await adminClient.from('business_settings').update({ trial_reminder_24h_sent: true }).eq('user_id', biz.user_id);
          trialSent24h++;
        }
      } catch (sendErr: unknown) {
        const msg = sendErr instanceof Error ? sendErr.message : 'Unknown send error';
        console.error(`Failed to send trial reminder to ${biz.email}:`, msg);
        errors.push(`trial/${biz.email}: ${msg}`);
      }
    }

    // --- זרם 2: תזכורות תפוגת מנוי בתשלום (subscription_ends_at, Basic/Pro בלבד) ---
    const { data: subCandidates, error: subErr } = await adminClient
      .from('business_settings')
      .select('id, user_id, email, business_name, country, plan, role, subscription_ends_at, subscription_reminder_3d_sent, subscription_reminder_24h_sent')
      .not('subscription_ends_at', 'is', null)
      .or('subscription_reminder_3d_sent.is.false,subscription_reminder_24h_sent.is.false');

    if (subErr) throw subErr;

    for (const biz of subCandidates || []) {
      if (!biz.email || biz.role === 'super_admin') continue;
      const plan = (biz.plan || 'free').toLowerCase();
      if (plan !== 'basic' && plan !== 'pro') continue; // רלוונטי רק למנויים בתשלום בפועל

      const endsMs = new Date(biz.subscription_ends_at).getTime();
      if (Number.isNaN(endsMs)) continue;

      const daysLeft = (endsMs - now) / MS_PER_DAY;
      const isHebrew = (biz.country || 'Local') !== 'International';

      try {
        if (!biz.subscription_reminder_3d_sent && daysLeft <= 3 && daysLeft > 1) {
          const { subject, html, text } = buildReminderEmail('subscription', { stage: '3d', businessName: biz.business_name, endsAt: biz.subscription_ends_at, isHebrew });
          await sendViaResend(resendApiKey, { from: senderAddressFor(isHebrew), to: biz.email, subject, html, text });
          await adminClient.from('business_settings').update({ subscription_reminder_3d_sent: true }).eq('user_id', biz.user_id);
          subSent3d++;
        } else if (!biz.subscription_reminder_24h_sent && daysLeft <= 1 && daysLeft > 0) {
          const { subject, html, text } = buildReminderEmail('subscription', { stage: '24h', businessName: biz.business_name, endsAt: biz.subscription_ends_at, isHebrew });
          await sendViaResend(resendApiKey, { from: senderAddressFor(isHebrew), to: biz.email, subject, html, text });
          await adminClient.from('business_settings').update({ subscription_reminder_24h_sent: true }).eq('user_id', biz.user_id);
          subSent24h++;
        }
      } catch (sendErr: unknown) {
        const msg = sendErr instanceof Error ? sendErr.message : 'Unknown send error';
        console.error(`Failed to send subscription reminder to ${biz.email}:`, msg);
        errors.push(`subscription/${biz.email}: ${msg}`);
      }
    }

    return jsonResponse({
      success: true,
      trial: { sent3d: trialSent3d, sent24h: trialSent24h },
      subscription: { sent3d: subSent3d, sent24h: subSent24h },
      errors,
    }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('send-expiration-email error:', message);
    return jsonResponse({ error: message }, 400);
  }
});
