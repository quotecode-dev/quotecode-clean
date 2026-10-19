// Smart support email stage 2 (Owner console 2026-10-20; Owner 2026-10-19: the evening summary at 20:00 Israel time): the site cron calls
// the support-digest Edge Function at 17:00 and 18:00 UTC; the function itself sends only at 20:00 Israel time (summer / winter) and
// once a day. Same authorization as api/cron.js (Vercel's Bearer CRON_SECRET); the function gets the shared secret as x-cron-secret.
export async function runSupportDigest({ env, fetchImpl }) {
  const base = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  if (!base || !env.CRON_SECRET) return { ok: false, status: 500, body: { error: 'not_configured' } };
  // support-digest has no user JWT (verify_jwt = false); the shared cron secret is its only key
  const res = await fetchImpl(`${String(base).replace(/\/$/, '')}/functions/v1/support-digest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': env.CRON_SECRET },
    body: '{}',
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
    const r = await runSupportDigest({ env: process.env, fetchImpl: fetch });
    return res.status(r.ok ? 200 : 500).json({ success: r.ok, result: r.body });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
