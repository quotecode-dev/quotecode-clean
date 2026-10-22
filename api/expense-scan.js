// The Owner's expense-invoice tool (Owner console 2026-10-22, typed L-22: "... הרצה חודשית ב-1 לחודש מהשרת"): on the 1st of every month
// the site cron asks the expense-invoices Edge Function to read the new emails of both mailboxes; the function reads in the background and
// emails the Owner when new invoices wait for approval. Nothing is sent to PayPlus without the Owner. Same authorization as api/cron.js
// (Vercel's Bearer CRON_SECRET); the function gets the shared secret as x-cron-secret.
export async function runExpenseScan({ env, fetchImpl }) {
  const base = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  if (!base || !env.CRON_SECRET) return { ok: false, status: 500, body: { error: 'not_configured' } };
  const res = await fetchImpl(`${String(base).replace(/\/$/, '')}/functions/v1/expense-invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cron-secret': env.CRON_SECRET },
    body: JSON.stringify({ action: 'scan' }),
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
    const r = await runExpenseScan({ env: process.env, fetchImpl: fetch });
    return res.status(r.ok ? 200 : 500).json({ success: r.ok, result: r.body });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
