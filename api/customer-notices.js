// Owner console 2026-11-02 (stage 1 of docs/SPEC_CUSTOMER_EMAILS_2026-11-02.md): the site cron calls the customer-notices Edge Function every hour.
// Same authorization as api/support-digest.js (Vercel's Bearer CRON_SECRET); the function gets the shared secret as x-cron-secret.
export async function runCustomerNotices({ env, fetchImpl }) {
  const base = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  if (!base || !env.CRON_SECRET) return { ok: false, status: 500, body: { error: 'not_configured' } };
  const res = await fetchImpl(`${String(base).replace(/\/$/, '')}/functions/v1/customer-notices`, {
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
    const r = await runCustomerNotices({ env: process.env, fetchImpl: fetch });
    return res.status(r.ok ? 200 : 500).json({ success: r.ok, result: r.body });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
