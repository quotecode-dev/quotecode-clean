// The daily payment reconciliation (Owner console 2026-10-23, typed approval of "... התאמת תשלומים יומית עם מסך בניהול"): the site
// cron calls the billing-reconcile Edge Function at 04:00 and 05:00 UTC every day; the function runs once per Israel day (between 06:00 and 08:00
// Israel time). Same authorization as api/cron.js (Vercel's Bearer CRON_SECRET); the function gets the shared
// secret as x-cron-secret.
export async function runBillingReconcile({ env, fetchImpl }) {
  const base = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  if (!base || !env.CRON_SECRET) return { ok: false, status: 500, body: { error: 'not_configured' } };
  const res = await fetchImpl(`${String(base).replace(/\/$/, '')}/functions/v1/billing-reconcile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': env.CRON_SECRET },
    body: JSON.stringify({ action: 'run' }),
  });
  const body = await res.json().catch(() => null);
  // Codex R-02: the function answers 200 also for a failed or unconfigured run - the body decides (completed / skipped / failed)
  const outcome = !res.ok || !body ? 'failed' : body.status === 'ok' ? 'completed' : body.status === 'already_ran_today' ? 'skipped'
    : body.status === 'not_configured' ? 'not_configured' : 'failed';
  return { ok: outcome === 'completed' || outcome === 'skipped', outcome, status: res.status, body };
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const r = await runBillingReconcile({ env: process.env, fetchImpl: fetch });
    return res.status(r.ok ? 200 : 500).json({ success: r.ok, outcome: r.outcome, result: r.body });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
