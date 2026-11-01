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
export async function triggerExpirationReminders(supabase, env, logs, priorFailures = []) {
  const failures = [];
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) {
    logs.push('Expiration reminders skipped: CRON_SECRET not configured.');
    return failures;
  }

  // Night task 2026-10-16 (R-15, Owner default 2): the trial-expiry emails are no longer sent. There is no trial (OD-01) and nothing is
  // interrupted when an old trial ends (every capability is open while the plan system is not active), so "upgrade to keep all
  // features" would be untrue. The edge function stays deployed and untouched; this job simply no longer calls it.
  logs.push('Trial reminders: not sent (retired - no trial exists and nothing changes when an old trial ends).');

  const { data: subData, error: subError } = await supabase.functions.invoke('send-subscription-expiration-email', {
    // Codex review 2026-10-31 F10: the steps that already failed (names only) - the worker records the daily window as partial
    body: { mode: 'batch', ...(priorFailures.length ? { parentFailures: priorFailures.map((f) => String(f).split(':')[0]) } : {}) },
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

// Owner console 2026-11-01 (typed: "מאשר להוריד את שלב שערי המטבע מההרצה היומית, שחרור עד הלייב"): the exchange-rates step is retired.
// It wrote the rates to public.app_settings - a table that was never created and that nothing reads (the calculator, the public tools
// and the plans-window estimate fetch their rates directly) - so it failed every day; since Codex F10 the daily window was partial.

export async function runCron({ supabase, env }) {
  const logs = [];
  const failures = [];

  // תזכורות דו-שלביות (3 ימים / 24 שעות) לפני תפוגת ניסיון חינמי או מנוי בתשלום
  try {
    failures.push(...await triggerExpirationReminders(supabase, env, logs, [...failures]));
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

    const { ok, logs, failures } = await runCron({ supabase, env: process.env });
    // Codex SEC-LOG-02 (Owner 2026-10-30): the details (provider texts, recipients) stay in the server log; the answer names only the steps
    console.log('cron:', logs.join(' | '));
    if (failures.length) console.error('cron failures:', failures.join(' | '));
    return res.status(ok ? 200 : 500).json({
      success: ok,
      message: ok ? 'Cron executed successfully.' : 'Cron finished with failures.',
      failures: failures.map((f) => String(f).split(':')[0]),
    });
  } catch (error) {
    console.error('Cron job error:', error.message);
    return res.status(500).json({ success: false, error: 'cron_failed' });
  }
}
