// The weekly support review (Owner console 2026-10-23, typed L-22: "סקירה שבועית אוטומטית של תקלות ובקשות שיפור מהמיילים ..."): the site
// cron calls the support-weekly-review Edge Function at 17:00 and 18:00 UTC on Sundays; the function itself works only at 20:00 Israel
// time (summer and winter) and once a day. Same authorization as api/cron.js (Vercel's Bearer CRON_SECRET); the function gets the shared
// secret as x-cron-secret.
export async function runWeeklyReview({ env, fetchImpl }) {
  const base = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  if (!base || !env.CRON_SECRET) return { ok: false, status: 500, body: { error: 'not_configured' } };
  const res = await fetchImpl(`${String(base).replace(/\/$/, '')}/functions/v1/support-weekly-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': env.CRON_SECRET },
    body: JSON.stringify({ action: 'run' }),
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const r = await runWeeklyReview({ env: process.env, fetchImpl: fetch });
    return res.status(r.ok ? 200 : 500).json({ success: r.ok, result: r.body });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
