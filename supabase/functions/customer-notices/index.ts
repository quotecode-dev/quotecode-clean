/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
// customer-notices (Owner console 2026-11-02, stage 1 of docs/SPEC_CUSTOMER_EMAILS_2026-11-02.md): the failed-renewal emails. Called only by the
// site cron every hour with the shared cron secret; customer_notices decides that nothing is sent twice.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendMail } from "../support-inbound/mail.ts";
import { healthOf, runNotices, type BillingFact, type Fact, type LifeFact } from "./lib.ts";

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, code: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('CRON_SECRET') ?? '';
  if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ ok: false, code: 'unauthorized' }, 401);
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  // Owner console 2026-11-10: subscription-authority asks for ONE account right after a paid return ({ user }); the hourly cron sends no body
  let only: string | undefined;
  try { const b = await req.json(); if (b && typeof b.user === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.user)) only = b.user; } catch { only = undefined; }
  const mail = { fetch: fetch as never, apiKey: Deno.env.get('RESEND_API_KEY') ?? '' };
  // recording never breaks or delays the job itself
  const report = async (body: Parameters<typeof healthOf>[0]) => {
    const h = healthOf(body);
    await Promise.resolve(admin.rpc('scheduled_health_record', { p_job: 'customer-notices', p_event: h.event, p_outcome: h.outcome })).catch(() => undefined);
  };
  try {
    const body = await runNotices({
      facts: async (user) => {
        const u = user ?? only;
        const { data, error } = await admin.rpc('customer_notice_facts', u ? { p_user: u } : {});
        if (error) throw new Error('facts_failed');
        return (data ?? []) as Fact[];
      },
      lifecycle: async (user) => {
        const u = user ?? only;
        const { data, error } = await admin.rpc('customer_notice_lifecycle_facts', u ? { p_user: u } : {});
        if (error) throw new Error('facts_failed');
        return (data ?? []) as LifeFact[];
      },
      // 2026-11-05 (night task item 2): the billing-change emails - their own switch (customer_notice_settings.billing_phase)
      billing: async (user) => {
        const u = user ?? only;
        const { data, error } = await admin.rpc('customer_notice_billing_facts', u ? { p_user: u } : {});
        if (error) throw new Error('facts_failed');
        return (data ?? []) as BillingFact[];
      },
      claim: async (user, kind, episode, seq, key) => {
        const { data, error } = await admin.rpc('customer_notice_claim', { p_user: user, p_kind: kind, p_episode: episode, p_seq: seq, p_key: key });
        if (error) throw new Error('claim_failed');
        return typeof data === 'string' ? data : null;
      },
      complete: async (user, kind, episode, seq, key, outcome, providerId) => {
        const { data, error } = await admin.rpc('customer_notice_complete', { p_user: user, p_kind: kind, p_episode: episode, p_seq: seq, p_key: key, p_outcome: outcome, p_provider_id: providerId ?? null });
        return !error && data === true;
      },
      send: (m) => sendMail(mail, { ...m, customer: { replyAllowed: true, automatic: true } }),
      now: () => new Date(),
      uuid: () => crypto.randomUUID(),
    });
    await report(body);
    return json(body);
  } catch (e) {
    const code = (e as Error)?.message === 'facts_failed' || (e as Error)?.message === 'claim_failed' ? (e as Error).message : 'failed';
    await report({ ok: false, code });
    return json({ ok: false, code }, 500);
  }
});
