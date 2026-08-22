import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { buildTrialReminderEmail, senderAddressFor } from './_emailTemplates.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// שני שלבי תזכורת לפני סיום תקופת הניסיון: 3 ימים ו-24 שעות מראש.
// כל שלב נשלח פעם אחת בלבד בעזרת דגל ה-sent הייעודי שלו ב-business_settings.
async function sendTrialReminders(logs) {
  if (!resend) {
    logs.push('Trial reminders skipped: RESEND_API_KEY not configured.');
    return;
  }

  const { data: candidates, error } = await supabase
    .from('business_settings')
    .select('user_id, email, business_name, country, trial_ends_at, trial_reminder_3d_sent, trial_reminder_24h_sent, role, plan')
    .not('trial_ends_at', 'is', null)
    .or('trial_reminder_3d_sent.is.false,trial_reminder_24h_sent.is.false');

  if (error) throw error;
  if (!candidates || candidates.length === 0) {
    logs.push('Trial reminders: no candidates.');
    return;
  }

  const now = Date.now();
  let sent3d = 0;
  let sent24h = 0;

  for (const biz of candidates) {
    if (!biz.email || biz.role === 'super_admin') continue;
    if ((biz.plan || 'free').toLowerCase() !== 'free') continue; // כבר מנוי בתשלום - לא רלוונטי לתזכורת ניסיון

    const trialEndsMs = new Date(biz.trial_ends_at).getTime();
    if (Number.isNaN(trialEndsMs)) continue;

    const daysLeft = (trialEndsMs - now) / MS_PER_DAY;
    const isHebrew = (biz.country || 'Local') !== 'International';

    try {
      if (!biz.trial_reminder_3d_sent && daysLeft <= 3 && daysLeft > 1) {
        const { subject, html, text } = buildTrialReminderEmail({ stage: '3d', businessName: biz.business_name, trialEndsAt: biz.trial_ends_at, isHebrew });
        await resend.emails.send({ from: senderAddressFor(isHebrew), to: biz.email, subject, html, text });
        await supabase.from('business_settings').update({ trial_reminder_3d_sent: true }).eq('user_id', biz.user_id);
        sent3d++;
      } else if (!biz.trial_reminder_24h_sent && daysLeft <= 1 && daysLeft > 0) {
        const { subject, html, text } = buildTrialReminderEmail({ stage: '24h', businessName: biz.business_name, trialEndsAt: biz.trial_ends_at, isHebrew });
        await resend.emails.send({ from: senderAddressFor(isHebrew), to: biz.email, subject, html, text });
        await supabase.from('business_settings').update({ trial_reminder_24h_sent: true }).eq('user_id', biz.user_id);
        sent24h++;
      }
    } catch (sendError) {
      console.error(`Failed to send trial reminder to ${biz.email}:`, sendError.message);
    }
  }

  logs.push(`Trial reminders: ${sent3d} 3-day, ${sent24h} 24-hour email(s) sent.`);
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const logs = [];

    // 1. בדיקת הצעות מחיר שתוקפן פג היום ושטרם נשלחה להן תזכורת
    const { data: expiringQuotes, error: quotesError } = await supabase
      .from('quotes')
      .select('id, valid_until, clients(email, company_name)')
      .eq('expiration_reminder_sent', false)
      .eq('valid_until', today);

    if (quotesError) throw quotesError;

    // סימון בבסיס הנתונים שהתזכורת בוצעה
    if (expiringQuotes && expiringQuotes.length > 0) {
      for (const quote of expiringQuotes) {
        await supabase
          .from('quotes')
          .update({ expiration_reminder_sent: true })
          .eq('id', quote.id);
      }
    }
    logs.push(`Processed ${expiringQuotes?.length || 0} quotes.`);

    // 2. עדכון אוטומטי של שערי מטבעות ומתכות דרך API חיצוני ושמירה ב-Supabase
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      const data = await response.json();

      if (data && data.rates) {
        const liveRates = {
          USD: 1,
          ILS: data.rates.ILS || 3.65,
          EUR: data.rates.EUR || 0.92,
          GBP: data.rates.GBP || 0.78,
          CAD: data.rates.CAD || 1.35,
          AUD: data.rates.AUD || 1.52,
          CHF: data.rates.CHF || 0.88,
          JPY: data.rates.JPY || 150.0
        };

        // שמירה או עדכון במסד הנתונים
        await supabase
          .from('app_settings')
          .upsert({ 
            key: 'exchange_rates', 
            value: liveRates, 
            updated_at: new Date().toISOString() 
          }, { onConflict: 'key' });

        logs.push('Exchange rates updated successfully.');
      }
    } catch (apiError) {
      console.error('Failed to fetch live exchange rates:', apiError.message);
      logs.push(`Rates update skipped: ${apiError.message}`);
    }

    // 3. תזכורות דו-שלביות (3 ימים / 24 שעות) לפני סיום תקופת הניסיון
    try {
      await sendTrialReminders(logs);
    } catch (trialError) {
      console.error('Trial reminder job failed:', trialError.message);
      logs.push(`Trial reminders skipped: ${trialError.message}`);
    }

    return res.status(200).json({
      success: true, 
      message: `Cron executed successfully. ${logs.join(' | ')}` 
    });
  } catch (error) {
    console.error('Cron job error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}