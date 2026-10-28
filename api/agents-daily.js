// The agents room daily run (Owner console 2026-10-27, typed: "מאשר את תוכנית שלב 2 עם מנהל הסוכנים" - decision 3: the security agent
// every day, an email only when there is a problem). The site cron calls the agents-room Edge Function at 04:30 UTC every day; the
// function runs the security agent once per Israel day, emails the Owner only on a problem (once a day) and resubmits the sitemap to
// Google after a newly published article. Same authorization as api/agents-weekly.js (Vercel Bearer CRON_SECRET); the function gets
// the shared secret as x-cron-secret.
export async function runAgentsDaily({ env, fetchImpl }) {
  const base = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  if (!base || !env.CRON_SECRET) return { ok: false, status: 500, body: { error: 'not_configured' } };
  const res = await fetchImpl(`${String(base).replace(/\/$/, '')}/functions/v1/agents-room`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': env.CRON_SECRET },
    body: JSON.stringify({ action: 'daily' }),
  });
  const body = await res.json().catch(() => null);
  // 20261029000000 (Codex F12): the function answers 200 also when part of the work failed - the body decides
  const outcome = !res.ok || !body || body.ok !== true ? 'failed'
    : body.security === 'failed' || body.urgent === false || body.sitemap === 'failed' ? 'partial'
      : body.security === 'already_ran' ? 'skipped' : 'completed';
  return { ok: outcome === 'completed' || outcome === 'skipped', outcome, status: res.status, body };
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const r = await runAgentsDaily({ env: process.env, fetchImpl: fetch });
    return res.status(r.ok ? 200 : 500).json({ success: r.ok, outcome: r.outcome, result: r.body });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
