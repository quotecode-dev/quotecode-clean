import { createClient } from '@supabase/supabase-js';

// Codex Post-LIVE Wave 1 blocker 4 (2026-09-27): the job used to select quotes whose valid_until is today with
// expiration_reminder_sent = false and then set expiration_reminder_sent = true - WITHOUT sending anything (no quote
// reminder delivery exists anywhere in the product). Quote expiration reminders are a backlog idea (PROFLOW_TODO
// "Quote expiration / validity date + reminders / extension"), not part of Wave 1 scope, so that step is REMOVED rather
// than implemented: this job never reads or writes quotes and never claims a quote reminder was sent. Implementing quote
// reminder delivery (recipient, content, market, consent) is a separate Owner product decision.
// Every remaining write is result-checked; a failed step makes the run report success: false (HTTP 500) instead of a
// false "executed successfully".

// שלב: מפעיל את שתי ה-Edge Functions הייעודיות במצב "batch" - כל אחת אחראית
// על זרם תזכורות עצמאי משלה (ניסיון חינמי / מנוי בתשלום) כך שאין כפילות
// לוגיקה בין Vercel ל-Supabase, ואין תלות בין הזרמים אם אחד מהם נכשל.
export async function triggerExpirationReminders(supabase, env, logs) {
  const failures = [];
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) {
    logs.push('Expiration reminders skipped: CRON_SECRET not configured.');
    return failures;
  }

  const { data: trialData, error: trialError } = await supabase.functions.invoke('send-trial-expiration-email', {
    body: { mode: 'batch' },
    headers: { 'x-cron-secret': cronSecret },
  });
  if (trialError || trialData?.error) {
    failures.push(`trial reminders: ${trialError?.message ?? trialData.error}`);
  } else {
    const t = trialData ?? {};
    logs.push(`Trial reminders: ${t.sent3d ?? 0} 3-day, ${t.sent24h ?? 0} 24-hour email(s) sent and recorded; `
      + `market unresolved (not sent) ${t.skippedMarketUnresolved ?? 0}; already claimed ${t.notClaimed ?? 0}; `
      + `send failed ${t.sendFailed ?? 0}; send outcome unknown ${t.sendUnknown ?? 0}; sent but not recorded ${t.sentUnrecorded ?? 0}.`);
    const hard = (t.claimErrors ?? 0) + (t.completionErrors ?? 0) + (t.sentUnrecorded ?? 0) + (t.sendFailed ?? 0) + (t.sendUnknown ?? 0);
    if (hard > 0) failures.push(`trial reminders: ${hard} reminder(s) not cleanly delivered and recorded`);
    if (t.errors?.length) logs.push(`Trial reminder details: ${t.errors.join('; ')}`);
  }

  const { data: subData, error: subError } = await supabase.functions.invoke('send-subscription-expiration-email', {
    body: { mode: 'batch' },
    headers: { 'x-cron-secret': cronSecret },
  });
  if (subError || subData?.error) {
    failures.push(`subscription reminders: ${subError?.message ?? subData.error}`);
  } else {
    logs.push(`Subscription reminders: ${subData?.sent3d ?? 0} 3-day, ${subData?.sent24h ?? 0} 24-hour email(s) sent.`);
    if (subData?.errors?.length) {
      failures.push(`subscription reminders: ${subData.errors.length} send error(s)`);
      logs.push(`Subscription reminder send errors: ${subData.errors.join('; ')}`);
    }
  }
  return failures;
}

// עדכון אוטומטי של שערי מטבעות דרך API חיצוני ושמירה ב-Supabase (תוצאת הכתיבה נבדקת)
export async function refreshExchangeRates(supabase, fetchImpl, logs) {
  const response = await fetchImpl('https://open.er-api.com/v6/latest/USD');
  const data = await response.json();
  if (!data || !data.rates) throw new Error('rates API returned no rates');

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

  const { error } = await supabase
    .from('app_settings')
    .upsert({
      key: 'exchange_rates',
      value: liveRates,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });
  if (error) throw new Error(`exchange_rates upsert failed: ${error.message}`);

  logs.push('Exchange rates updated successfully.');
}

export async function runCron({ supabase, env, fetchImpl }) {
  const logs = [];
  const failures = [];

  try {
    await refreshExchangeRates(supabase, fetchImpl, logs);
  } catch (e) {
    console.error('Exchange rates step failed:', e.message);
    failures.push(`rates: ${e.message}`);
  }

  // תזכורות דו-שלביות (3 ימים / 24 שעות) לפני תפוגת ניסיון חינמי או מנוי בתשלום
  try {
    failures.push(...await triggerExpirationReminders(supabase, env, logs));
  } catch (e) {
    console.error('Expiration reminder job failed:', e.message);
    failures.push(`reminders: ${e.message}`);
  }

  return { ok: failures.length === 0, logs, failures };
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { ok, logs, failures } = await runCron({ supabase, env: process.env, fetchImpl: fetch });
    return res.status(ok ? 200 : 500).json({
      success: ok,
      message: `${ok ? 'Cron executed successfully.' : 'Cron finished with failures.'} ${logs.join(' | ')}`,
      failures,
    });
  } catch (error) {
    console.error('Cron job error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
