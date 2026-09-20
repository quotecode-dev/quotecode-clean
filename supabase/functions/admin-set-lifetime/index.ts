/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { claimReauthProof, writeAuditLog } from "../_shared/adminReauth.ts";

// ==========================================
// TEKANGO Admin V1 (Task 3.3): Grant/Revoke Lifetime. Explicit is_lifetime
// write only (never inferred from null dates - plan/trial_ends_at are
// completely untouched by this function). Requires a claimed re-auth
// proof minted by admin-reauth-verify for this exact
// grant_lifetime/revoke_lifetime action+target+{reason}. The DB trigger
// guard_business_settings_plan_trial() (20260908000000 migration) is a
// second, independent server-side authorization layer beneath this one -
// even a forged/bypassed proof check could not make a non-super_admin
// caller's write to is_lifetime succeed, since that trigger re-derives the
// caller's role itself from business_settings.role via auth.uid().
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
    const grant = (body as { grant?: unknown })?.grant;

    if (!targetUserId || typeof targetUserId !== 'string') {
      return jsonResponse({ error: 'Missing or invalid targetUserId' }, 400);
    }
    if (typeof grant !== 'boolean') {
      return jsonResponse({ error: 'Missing or invalid grant (boolean)' }, 400);
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
      console.error('admin-set-lifetime: missing required server configuration');
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

    const action = grant ? 'grant_lifetime' : 'revoke_lifetime';
    const proof = await claimReauthProof({
      adminClient, proofToken, actorUserId: callerUser.id, action, targetUserId, params: { reason },
    });
    if (!proof.ok) return jsonResponse({ error: proof.error }, 403);

    const { data: targetBefore, error: targetFetchErr } = await adminClient
      .from('business_settings').select('id, role, is_lifetime').eq('user_id', targetUserId).maybeSingle();
    if (targetFetchErr || !targetBefore) {
      await writeAuditLog({ adminClient, actorUserId: callerUser.id, targetUserId, action, reason, outcome: 'denied' });
      return jsonResponse({ error: 'Target account not found.' }, 404);
    }
    if (targetBefore.role === 'super_admin') {
      await writeAuditLog({ adminClient, actorUserId: callerUser.id, targetUserId, action, reason, outcome: 'denied' });
      return jsonResponse({ error: 'Cannot change Lifetime state for a Super Admin account.' }, 400);
    }

    const { error: updateErr } = await adminClient
      .from('business_settings').update({ is_lifetime: grant }).eq('id', targetBefore.id);
    if (updateErr) {
      await writeAuditLog({ adminClient, actorUserId: callerUser.id, targetUserId, action, reason, beforeState: { is_lifetime: targetBefore.is_lifetime }, outcome: 'error' });
      return jsonResponse({ error: updateErr.message }, 500);
    }

    // Authoritative read-back: confirm the actual stored value, not just
    // "no error" (an RLS-filtered UPDATE can silently affect 0 rows).
    const { data: verifyRow, error: verifyErr } = await adminClient
      .from('business_settings').select('is_lifetime').eq('id', targetBefore.id).maybeSingle();
    if (verifyErr || !verifyRow || verifyRow.is_lifetime !== grant) {
      await writeAuditLog({ adminClient, actorUserId: callerUser.id, targetUserId, action, reason, beforeState: { is_lifetime: targetBefore.is_lifetime }, outcome: 'error' });
      return jsonResponse({ error: 'The write could not be verified against the server - the action may not have completed.' }, 500);
    }

    await writeAuditLog({
      adminClient, actorUserId: callerUser.id, targetUserId, action, reason,
      beforeState: { is_lifetime: targetBefore.is_lifetime }, afterState: { is_lifetime: verifyRow.is_lifetime }, outcome: 'success',
    });

    return jsonResponse({ success: true, is_lifetime: verifyRow.is_lifetime }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('admin-set-lifetime error:', message);
    return jsonResponse({ error: message }, 400);
  }
});
