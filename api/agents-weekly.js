// The agents room weekly run (Owner console 2026-10-27: stage 1 of the agents room, the report by email too): the site
// cron calls the agents-room Edge Function at 05:00 and 06:00 UTC on Sundays (07:00 / 08:00 Israel in winter, 08:00 / 09:00 in summer);
// the function runs each agent once per Israel day (a second call changes nothing). Same authorization as api/cron.js (Vercel Bearer CRON_SECRET);
// the function gets the shared secret as x-cron-secret.
export async function runAgentsWeekly({ env, fetchImpl }) {
  const base = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  if (!base || !env.CRON_SECRET) return { ok: false, status: 500, body: { error: 'not_configured' } };
  const res = await fetchImpl(`${String(base).replace(/\/$/, '')}/functions/v1/agents-room`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': env.CRON_SECRET },
    body: JSON.stringify({ action: 'run', agent: 'all' }),
  });
  const body = await res.json().catch(() => null);
  // 20261029000000 (Codex F12): a failed agent, or work done whose report was not mailed, is a failure (the second call mails it)
  const results = Array.isArray(body?.results) ? body.results : [];
  const ran = results.some((x) => x?.status !== 'already_ran');
  // Codex N10: a report delivery tried in this call (also the retry of an earlier failed one) that failed is a failure, never "skipped"
  const outcome = !res.ok || !body || body.ok !== true || results.some((x) => x?.status === 'failed') || ((ran || body.mailAttempted === true) && body.mailed !== true) ? 'failed'
    : ran ? 'completed' : 'skipped';
  return { ok: outcome !== 'failed', outcome, status: res.status, body };
}

export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  try {
    const r = await runAgentsWeekly({ env: process.env, fetchImpl: fetch });
    return res.status(r.ok ? 200 : 500).json({ success: r.ok, outcome: r.outcome, result: r.body });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
