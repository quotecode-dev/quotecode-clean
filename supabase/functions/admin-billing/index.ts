// admin-billing - Edge entry. WIRING ONLY: the handler is lib.ts (unit-tested). Migration 20261022300000; Owner console 2026-10-21.
// Env allowlist: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SECRET_KEYS + the PayPlus secrets PAYPLUS_API_KEY / PAYPLUS_SECRET_KEY /
// PAYPLUS_ENVIRONMENT / PAYPLUS_TERMINAL_UID (the Owner sets them; never in code, never shown). Without them nothing can be stopped.
// INERT while billing is 'off' (SQL answers billing_off). NOT deployed: deploying needs the Owner's own step.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { claimReauthProof, writeAuditLog } from '../_shared/adminReauth.ts';
import { PAYPLUS_API_BASES, payplusStandingOrders } from '../subscription-authority/payplus.ts';
import { adminBillingHandler, type AdminBillingDeps } from './lib.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json', 'cache-control': 'no-store' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function payplusFromSecrets(): AdminBillingDeps['payplus'] {
  const apiKey = (Deno.env.get('PAYPLUS_API_KEY') ?? '').trim();
  const secretKey = (Deno.env.get('PAYPLUS_SECRET_KEY') ?? '').trim();
  const environment = (Deno.env.get('PAYPLUS_ENVIRONMENT') ?? '').trim();
  const terminalUid = (Deno.env.get('PAYPLUS_TERMINAL_UID') ?? '').trim().toLowerCase();
  if (!apiKey || !secretKey || (environment !== 'production' && environment !== 'staging') || !UUID.test(terminalUid)) return null;
  try {
    const orders = payplusStandingOrders({ apiBase: PAYPLUS_API_BASES[environment], apiKey, secretKey, fetch: (u, init) => fetch(u, init) });
    return { terminalUid, cancel: orders.cancel, refund: orders.refund };
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { ok: false, code: 'method_not_allowed' });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    let secretKey = '';
    try { secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')['default'] ?? ''; } catch { secretKey = ''; }
    if (!supabaseUrl || !anonKey || !secretKey) return json(503, { ok: false, code: 'server_misconfigured' });
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { ok: false, code: 'not_authenticated' });
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error } = await callerClient.auth.getUser();
    if (error || !user) return json(401, { ok: false, code: 'not_authenticated' });
    const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const rpc = async (fn: string, args: Record<string, unknown>) => {
      const { data, error: e } = await admin.rpc(fn, args);
      if (e) throw new Error('rpc_failed');
      return data as Record<string, unknown>;
    };
    const deps: AdminBillingDeps = {
      isSuperAdmin: async (id) => {
        const { data } = await admin.from('business_settings').select('role').eq('user_id', id).maybeSingle();
        return data?.role === 'super_admin';
      },
      claimProof: async (a) => (await claimReauthProof({ adminClient: admin, ...a })).ok,
      preview: (userId, waiveFee) => rpc('billing_admin_preview', { p_user_id: userId, p_waive_fee: waiveFee }),
      begin: (a) => rpc('billing_admin_begin', { p_actor_user_id: a.actorUserId, p_user_id: a.userId, p_kind: a.kind, p_waive_fee: a.waiveFee,
        p_expected_refund_minor: a.expectedRefundMinor, p_reason: a.reason }),
      openAction: async (userId) => (await rpc('billing_admin_open_action', { p_user_id: userId })) ?? null,
      finish: (a) => rpc('billing_admin_finish', { p_action_id: a.actionId, p_cancel_status: a.cancelStatus, p_resolved_by_owner: a.resolvedByOwner }),
      refundSending: (actionId) => rpc('billing_admin_refund_sending', { p_action_id: actionId }),
      recordRefund: (a) => rpc('billing_admin_record_refund', { p_action_id: a.actionId, p_refund_status: a.refundStatus,
        p_refund_ref: a.refundRef, p_refunded_minor: a.refundedMinor }),
      unsettledRefund: async (userId) => (await rpc('billing_admin_unsettled_refund', { p_user_id: userId })) ?? null,
      settleRefund: (actionId, actorUserId) => rpc('billing_admin_settle_refund', { p_action_id: actionId, p_actor_user_id: actorUserId }),
      payplus: payplusFromSecrets(),
      audit: (a) => writeAuditLog({ adminClient: admin, ...a }),
    };
    const body = await req.json().catch(() => null);
    const r = await adminBillingHandler(deps, user.id, body);
    return json(r.status, r.body);
  } catch {
    return json(503, { ok: false, code: 'unavailable' }); // no detail, no token, no body is ever logged
  }
});
