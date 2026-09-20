/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { claimReauthProof, writeAuditLog } from "../_shared/adminReauth.ts";

// ==========================================
// TEKANGO Admin V1 (Task 3.4): Extend Trial by a fixed 14 days. Binding V1
// policy, enforced here (server-side), not just suggested client-side:
// only when the account has NO currently-active trial (trial_ends_at is
// null, or is in the past) - never extends an already-active trial, never
// a custom duration, never repeated unlimited extensions (nothing here
// prevents a second call once the newly-granted 14 days later expire
// again, by design - each call is independently re-evaluated against the
// CURRENT stored trial_ends_at, exactly like the eligibility check itself).
// Requires a claimed re-auth proof for extend_trial+target+{reason}, and
// performs the same authoritative read-back pattern as admin-set-lifetime.
// ==========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const TRIAL_EXTENSION_MS = 14 * 24 * 60 * 60 * 1000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await req.json().catch(() => null);
    const targetUserId = (body as { targetUserId?: unknown })?.targetUserId;
    const proofToken = (body as { proofToken?: unknown })?.proofToken;
    const reason = (body as { reason?: unknown })?.reason;

    if (!targetUserId || typeof targetUserId !== 'string') {
      return jsonResponse({ error: 'Missing or invalid targetUserId' }, 400);
    }
    if (typeof reason !== 'string' || !reason.trim()) {
      return jsonResponse({ error: 'A reason is required for this protected action.' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')['default'] ?? '';
    if (!supabaseUrl || !anonKey || !secretKey) {
      console.error('admin-extend-trial: missing required server configuration');
      return jsonResponse({ error: 'Server misconfiguration' }, 500);
    }

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: callerUser }, error: callerAuthErr } = await callerClient.auth.getUser();
    if (callerAuthErr || !callerUser) return jsonResponse({ error: 'Invalid or expired session' }, 401);

    const adminClient = createClient(supabaseUrl, secretKey);

    const { data: callerBiz, error: callerBizErr } = await adminClient
      .from('business_settings').select('role').eq('user_id', callerUser.id).maybeSingle();
    if (callerBizErr) return jsonResponse({ error: `Failed to verify caller permissions: ${callerBizErr.message}` }, 500);
    if (callerBiz?.role !== 'super_admin') return jsonResponse({ error: 'Forbidden: super_admin role required' }, 403);

    const action = 'extend_trial';
    const proof = await claimReauthProof({
      adminClient, proofToken, actorUserId: callerUser.id, action, targetUserId, params: { reason },
    });
    if (!proof.ok) return jsonResponse({ error: proof.error }, 403);

    const { data: target, error: targetFetchErr } = await adminClient
      .from('business_settings').select('id, role, is_lifetime, trial_ends_at').eq('user_id', targetUserId).maybeSingle();
    if (targetFetchErr || !target) {
      await writeAuditLog({ adminClient, actorUserId: callerUser.id, targetUserId, action, reason, outcome: 'denied' });
      return jsonResponse({ error: 'Target account not found.' }, 404);
    }
    if (target.role === 'super_admin' || target.is_lifetime) {
      await writeAuditLog({ adminClient, actorUserId: callerUser.id, targetUserId, action, reason, outcome: 'denied' });
      return jsonResponse({ error: 'This account is not eligible for a trial extension.' }, 400);
    }
    const now = Date.now();
    const hasActiveTrial = Boolean(target.trial_ends_at) && new Date(target.trial_ends_at).getTime() > now;
    if (hasActiveTrial) {
      await writeAuditLog({ adminClient, actorUserId: callerUser.id, targetUserId, action, reason, beforeState: { trial_ends_at: target.trial_ends_at }, outcome: 'denied' });
      return jsonResponse({ error: 'This account already has an active trial - it cannot be extended until it expires.' }, 400);
    }

    const newTrialEndsAt = new Date(now + TRIAL_EXTENSION_MS).toISOString();
    const { error: updateErr } = await adminClient
      .from('business_settings').update({ trial_ends_at: newTrialEndsAt }).eq('id', target.id);
    if (updateErr) {
      await writeAuditLog({ adminClient, actorUserId: callerUser.id, targetUserId, action, reason, beforeState: { trial_ends_at: target.trial_ends_at }, outcome: 'error' });
      return jsonResponse({ error: updateErr.message }, 500);
    }

    const { data: verifyRow, error: verifyErr } = await adminClient
      .from('business_settings').select('trial_ends_at').eq('id', target.id).maybeSingle();
    if (verifyErr || !verifyRow || verifyRow.trial_ends_at !== newTrialEndsAt) {
      await writeAuditLog({ adminClient, actorUserId: callerUser.id, targetUserId, action, reason, beforeState: { trial_ends_at: target.trial_ends_at }, outcome: 'error' });
      return jsonResponse({ error: 'The write could not be verified against the server - the action may not have completed.' }, 500);
    }

    await writeAuditLog({
      adminClient, actorUserId: callerUser.id, targetUserId, action, reason,
      beforeState: { trial_ends_at: target.trial_ends_at }, afterState: { trial_ends_at: verifyRow.trial_ends_at }, outcome: 'success',
    });

    return jsonResponse({ success: true, trial_ends_at: verifyRow.trial_ends_at }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('admin-extend-trial error:', message);
    return jsonResponse({ error: message }, 400);
  }
});
