/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { canonicalParamsHash } from "../_shared/adminReauth.ts";

// ==========================================
// TEKANGO Admin V1 (Task 3, binding rule): "SENSITIVE ADMIN ACTIONS:
// RE-AUTH REQUIRED... A client-side password dialog alone is NOT
// sufficient." This function is the one place a Super Admin's password is
// verified server-side (a fresh signInWithPassword call, done here rather
// than only on the client as before) before minting a short-lived (5 min),
// single-use proof row (admin_reauth_proofs) bound to exactly one
// action/target/params combination. Every privileged Edge Function
// (admin-set-lifetime/admin-extend-trial/admin-delete-user/admin-cleanup-
// user-quotes) then requires a matching, unexpired, unused proof before
// doing anything else - see _shared/adminReauth.ts's claimReauthProof.
// The password itself is never logged and never stored - only used for
// one signInWithPassword call, whose result (pass/fail) is the only thing
// that survives it.
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

const ALLOWED_ACTIONS = new Set(['grant_lifetime', 'revoke_lifetime', 'extend_trial', 'delete_user', 'reset_quotes']);
const PROOF_TTL_MS = 5 * 60 * 1000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await req.json().catch(() => null);
    const action = (body as { action?: unknown })?.action;
    const targetUserId = (body as { targetUserId?: unknown })?.targetUserId ?? null;
    const params = (body as { params?: unknown })?.params ?? {};
    const password = (body as { password?: unknown })?.password;

    if (typeof action !== 'string' || !ALLOWED_ACTIONS.has(action)) {
      return jsonResponse({ error: 'Missing or invalid action' }, 400);
    }
    if (targetUserId !== null && typeof targetUserId !== 'string') {
      return jsonResponse({ error: 'Invalid targetUserId' }, 400);
    }
    if (typeof password !== 'string' || !password) {
      return jsonResponse({ error: 'Missing password' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')['default'] ?? '';
    if (!supabaseUrl || !anonKey || !secretKey) {
      console.error('admin-reauth-verify: missing required server configuration');
      return jsonResponse({ error: 'Server misconfiguration' }, 500);
    }

    // Identifies the actual caller via their own JWT - never trusted from
    // any client-supplied field.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerUser }, error: callerAuthErr } = await callerClient.auth.getUser();
    if (callerAuthErr || !callerUser || !callerUser.email) {
      return jsonResponse({ error: 'Invalid or expired session' }, 401);
    }

    const adminClient = createClient(supabaseUrl, secretKey);

    // Server-side role re-verification - never trust a client-supplied
    // "isAdmin" claim, same pattern as admin-delete-user/admin-cleanup-
    // user-quotes.
    const { data: callerBiz, error: callerBizErr } = await adminClient
      .from('business_settings')
      .select('role')
      .eq('user_id', callerUser.id)
      .maybeSingle();
    if (callerBizErr) {
      return jsonResponse({ error: `Failed to verify caller permissions: ${callerBizErr.message}` }, 500);
    }
    if (callerBiz?.role !== 'super_admin') {
      return jsonResponse({ error: 'Forbidden: super_admin role required' }, 403);
    }

    // The fresh, server-side password check itself. A brand-new anon
    // client is used (not callerClient, whose session must stay
    // untouched) so this is a pure credential check, not a session
    // replacement - signInWithPassword succeeding/failing here never
    // changes the caller's own active session either way.
    const checkClient = createClient(supabaseUrl, anonKey);
    const { error: passwordErr } = await checkClient.auth.signInWithPassword({
      email: callerUser.email,
      password,
    });
    if (passwordErr) {
      return jsonResponse({ error: 'Incorrect password.' }, 401);
    }

    // delete_user targeting another super_admin is refused at proof-mint
    // time too (defense in depth - admin-delete-user re-checks this again
    // independently before actually deleting).
    if (action === 'delete_user' && targetUserId) {
      const { data: targetBiz } = await adminClient
        .from('business_settings')
        .select('role')
        .eq('user_id', targetUserId)
        .maybeSingle();
      if (targetBiz?.role === 'super_admin') {
        return jsonResponse({ error: 'Cannot target a Super Admin account.' }, 400);
      }
    }

    const paramsHash = await canonicalParamsHash(params);
    const expiresAt = new Date(Date.now() + PROOF_TTL_MS).toISOString();

    const { data: proofRow, error: insertErr } = await adminClient
      .from('admin_reauth_proofs')
      .insert([{
        actor_user_id: callerUser.id,
        action,
        target_user_id: targetUserId,
        params_hash: paramsHash,
        expires_at: expiresAt,
      }])
      .select('id')
      .single();

    if (insertErr || !proofRow) {
      return jsonResponse({ error: 'Failed to issue re-authentication proof.' }, 500);
    }

    return jsonResponse({ success: true, proofToken: proofRow.id, expiresAt }, 200);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('admin-reauth-verify error:', message);
    return jsonResponse({ error: message }, 400);
  }
});
