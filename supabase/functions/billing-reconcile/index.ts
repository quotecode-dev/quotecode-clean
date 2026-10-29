/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
// billing-reconcile - WIRING ONLY (the logic is lib.ts, unit-tested). Owner console 2026-10-23, typed approval of the daily payment
// reconciliation with an admin screen (L-22). READ ONLY towards PayPlus and towards our billing records: it never changes an account, an
// entitlement or a payment; it keeps what it found in billing_reconcile_runs / billing_reconcile_findings.
//  - verify_jwt = false: the site cron has no user JWT; it is accepted only with the shared secret (x-cron-secret = CRON_SECRET,
//    constant-time). The Owner's "run now" is a verified super admin (JWT + business_settings.role).
//  - Secrets: PAYPLUS_API_KEY / PAYPLUS_SECRET_KEY / PAYPLUS_ENVIRONMENT (already set) + PAYPLUS_TERMINAL_UID (the terminal whose history
//    is read - without it every run is recorded as "not configured"), RESEND_API_KEY + SUPPORT_OWNER_NOTIFY_ADDRESS, CRON_SECRET,
//    PAYPLUS_PROXY_URL (the fixed-IP relay every PayPlus call goes through - the account's IP check; _shared/payplusEgress.ts).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { reconcileHandler, readHistory, type ReconcileDeps, type Finding, type OurCharge, type OurRefund, type OwedRefund } from './lib.ts';
import { PAYPLUS_API_BASES } from '../subscription-authority/payplus.ts';
import { sendMail } from '../support-inbound/mail.ts';
import { payplusEgress } from '../_shared/payplusEgress.ts';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const APP_URL = 'https://www.tekango.com';
const sameText = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i += 1) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { ok: false, code: 'method_not_allowed' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  let secretKey = '';
  try { secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')['default'] ?? ''; } catch { secretKey = ''; }
  if (!secretKey) secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const egress = payplusEgress(Deno.env.get('PAYPLUS_PROXY_URL'));

  let role: 'admin' | 'cron' | null = null;
  const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
  const auth = req.headers.get('Authorization');
  if (cronSecret && sameText(req.headers.get('x-cron-secret') ?? '', cronSecret)) role = 'cron';
  else if (auth) {
    try {
      const caller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: auth } } });
      const uid = (await caller.auth.getUser()).data?.user?.id;
      if (uid) {
        const { data } = await admin.from('business_settings').select('role').eq('user_id', uid).maybeSingle();
        if ((data as { role?: string } | null)?.role === 'super_admin') role = 'admin';
      }
    } catch { role = null; }
  }

  const db = async <T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<T> => {
    const { data, error } = await p;
    if (error) { console.error(`billing-reconcile: database ${(error as { code?: string }).code ?? ''}`); throw new Error('database'); }
    return data;
  };
  const deps: ReconcileDeps = {
    caller: async () => role,
    now: () => new Date(),
    config: () => {
      const env = (Deno.env.get('PAYPLUS_ENVIRONMENT') ?? '').trim();
      const apiKey = (Deno.env.get('PAYPLUS_API_KEY') ?? '').trim();
      const secret = (Deno.env.get('PAYPLUS_SECRET_KEY') ?? '').trim();
      const terminalUid = (Deno.env.get('PAYPLUS_TERMINAL_UID') ?? '').trim();
      if ((env !== 'production' && env !== 'staging') || !apiKey || !secret || !terminalUid) return null;
      return { apiBase: PAYPLUS_API_BASES[env], apiKey, secretKey: secret, terminalUid };
    },
    claimRun: async (day, source) => {
      const { data, error } = await admin.from('billing_reconcile_runs').insert({ run_day: day, source }).select('run_id').maybeSingle();
      if (!error) return (data as { run_id: string } | null)?.run_id ?? null;
      if ((error as { code?: string }).code !== '23505') {
        console.error(`billing-reconcile: database ${(error as { code?: string }).code ?? ''}`);
        throw new Error('database');
      }
      // today's site run exists: it is taken again only when it failed or stalled (running for 30+ minutes) - the second daily call retries
      const today = await db(admin.from('billing_reconcile_runs').select('run_id, status, started_at').eq('run_day', day).eq('source', 'cron').maybeSingle()) as
        { run_id: string; status: string; started_at: string } | null;
      const stalled = today?.status === 'running' && Date.now() - Date.parse(today.started_at) > 30 * 60000;
      if (!today || !(today.status === 'failed' || stalled)) return null;
      const again = await db(admin.from('billing_reconcile_runs').update({ status: 'running', started_at: new Date().toISOString(), finished_at: null, error_code: null })
        // Codex R-06: a compare-and-swap on the status AND the start time it was read with - two callers that saw the same stalled row
        // cannot both take it (the second matches no row)
        .eq('run_id', today.run_id).eq('status', today.status).eq('started_at', today.started_at).select('run_id')) as { run_id: string }[] | null;
      return again && again.length === 1 ? again[0].run_id : null;
    },
    finishRun: async (runId, p) => {
      await db(admin.from('billing_reconcile_runs').update({
        status: p.status, finished_at: new Date().toISOString(), window_from: p.windowFrom ?? null, window_until: p.windowUntil ?? null,
        provider_count: p.providerCount ?? 0, ours_count: p.oursCount ?? 0, matched: p.matched ?? 0, unverified: p.unverified ?? 0, new_findings: p.newFindings ?? 0,
        amount_scale: p.scale ?? null, types: p.types ?? {}, error_code: p.errorCode ?? null,
      }).eq('run_id', runId));
    },
    source: async (from, until) => {
      const r = await db(admin.rpc('billing_reconcile_source', { p_from: from, p_until: until })) as { charges?: OurCharge[]; refunds?: OurRefund[]; owedRefunds?: OwedRefund[] } | null;
      return { charges: Array.isArray(r?.charges) ? r.charges : [], refunds: Array.isArray(r?.refunds) ? r.refunds : [], owedRefunds: Array.isArray(r?.owedRefunds) ? r.owedRefunds : [] };
    },
    history: (cfg, from, until, currency) => readHistory(egress.fetch, cfg, from, until, currency),
    saveFindings: async (runId, findings, seenByOwner) => {
      if (!findings.length) return [];
      // once per (code, transaction): a finding a previous run already kept is not new
      const told = seenByOwner ? new Date().toISOString() : null;
      const rows = await db(admin.from('billing_reconcile_findings')
        .upsert(findings.map((f: Finding) => ({ run_id: runId, code: f.code, uid: f.uid, detail: f.detail, mailed_at: told })), { onConflict: 'code,uid', ignoreDuplicates: true })
        .select('code, uid')) as { code: string; uid: string }[] | null;
      const fresh = new Set((rows ?? []).map((r) => `${r.code}|${r.uid}`));
      return findings.filter((f) => fresh.has(`${f.code}|${f.uid}`));
    },
    enrichOwed: async (findings) => {
      for (const f of findings) {
        // only a row that does not carry the account yet; its status, mail time and history are untouched
        await db(admin.from('billing_reconcile_findings').update({ detail: f.detail }).eq('code', 'REFUND_OWED').eq('uid', f.uid).is('detail->>userId', null));
      }
    },
    unmailed: async () => (await db(admin.from('billing_reconcile_findings').select('id, code, uid, detail')
      .eq('status', 'new').is('mailed_at', null).order('created_at', { ascending: true }).limit(200)) ?? []) as (Finding & { id: string })[],
    mailOwner: async (subject, text, key) => {
      const to = (Deno.env.get('SUPPORT_OWNER_NOTIFY_ADDRESS') ?? '').trim();
      const r = await sendMail({ fetch: (u, i) => fetch(u, i), apiKey: Deno.env.get('RESEND_API_KEY') ?? '' }, {
        from: 'TEKANGO <support@tekango.com>', replyTo: 'support@tekango.com', to, subject, text, idempotencyKey: `tekango-billing/v1/reconcile/${key}`,
      });
      return r.ok;
    },
    previousCron: async (day) => (await db(admin.from('billing_reconcile_runs').select('status').eq('source', 'cron').lt('run_day', day)
      .order('run_day', { ascending: false }).limit(1).maybeSingle())) as { status: string } | null,
    failureToldToday: async (runId) => {
      const row = await db(admin.from('billing_reconcile_runs').select('mailed_at').eq('run_id', runId).maybeSingle()) as { mailed_at: string | null } | null;
      return !!row?.mailed_at;
    },
    markMailed: async (runId, ids) => {
      const at = new Date().toISOString();
      if (ids.length) await db(admin.from('billing_reconcile_findings').update({ mailed_at: at }).in('id', ids));
      await db(admin.from('billing_reconcile_runs').update({ mailed_at: at }).eq('run_id', runId));
    },
  };

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json(400, { ok: false, code: 'invalid_request' }); }
  try {
    const r = await reconcileHandler(body, deps, APP_URL);
    return json(r.status, r.body);
  } catch (e) {
    console.error(`billing-reconcile: failed ${(e as Error)?.message ?? ''}`.slice(0, 200));
    return json(500, { ok: false, code: 'failed' });
  } finally {
    egress.close();
  }
});
