// scheduled-health (Codex release 7, Owner console 2026-10-30, decision 11): the watcher of the seven scheduled runs, outside Vercel.
//  - verify_jwt = false: called only by the database's schedule (pg_cron, every ten minutes) with x-schedule-secret =
//    SCHEDULE_MONITOR_SECRET (the same value the Owner stores in Vault as tekango_schedule_monitor_secret); anything else is refused.
//  - Secrets already set for the support email: RESEND_API_KEY, SUPPORT_OWNER_NOTIFY_ADDRESS. The service role reads the incidents.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendMail } from '../support-inbound/mail.ts';
import { healthHandler, type Item } from './lib.ts';

const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { ok: false, code: 'method_not_allowed' });
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false, autoRefreshToken: false } });
  const owner = (Deno.env.get('SUPPORT_OWNER_NOTIFY_ADDRESS') ?? '').trim();
  try {
    const r = await healthHandler(req.headers.get('x-schedule-secret'), {
      secret: Deno.env.get('SCHEDULE_MONITOR_SECRET') ?? '',
      evaluate: async () => {
        const { data, error } = await admin.rpc('scheduled_health_evaluate', {});
        if (error) throw new Error('database');
        return (Array.isArray(data) ? data : []) as Item[];
      },
      mailed: async (id, mail) => {
        const { data, error } = await admin.rpc('scheduled_health_mailed', { p_id: id, p_mail: mail });
        return !error && data === true;
      },
      send: async (mail) => {
        if (!owner) return false;
        const r = await sendMail({ fetch: fetch as never, apiKey: Deno.env.get('RESEND_API_KEY') ?? '' },
          { from: 'TEKANGO Support <support@tekango.com>', replyTo: 'support@tekango.com', to: owner, ...mail });
        return r.ok;
      },
    });
    return json(r.status, r.body);
  } catch {
    console.error('scheduled-health: the evaluation failed');
    return json(500, { ok: false, code: 'failed' });
  }
});
