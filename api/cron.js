import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// שלב 3: מפעיל את ה-Supabase Edge Function send-expiration-email במצב "batch",
// שהיא כעת המנוע היחיד ששולח בפועל את כל תזכורות התפוגה (הן ניסיון חינמי
// והן מנוי בתשלום) דרך Resend - כך שאין כפילות לוגיקה בין Vercel ל-Supabase.
async function triggerExpirationReminders(logs) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    logs.push('Expiration reminders skipped: CRON_SECRET not configured.');
    return;
  }

  const { data, error } = await supabase.functions.invoke('send-expiration-email', {
    body: { mode: 'batch' },
    headers: { 'x-cron-secret': cronSecret },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  logs.push(`Trial reminders: ${data?.trial?.sent3d ?? 0} 3-day, ${data?.trial?.sent24h ?? 0} 24-hour email(s) sent.`);
  logs.push(`Subscription reminders: ${data?.subscription?.sent3d ?? 0} 3-day, ${data?.subscription?.sent24h ?? 0} 24-hour email(s) sent.`);
  if (data?.errors?.length) {
    logs.push(`Reminder send errors: ${data.errors.join('; ')}`);
  }
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

    // 3. תזכורות דו-שלביות (3 ימים / 24 שעות) לפני תפוגת ניסיון חינמי או מנוי בתשלום
    try {
      await triggerExpirationReminders(logs);
    } catch (reminderError) {
      console.error('Expiration reminder job failed:', reminderError.message);
      logs.push(`Expiration reminders skipped: ${reminderError.message}`);
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
