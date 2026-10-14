/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { UNAVAILABLE_PROVIDER } from "../subscription-authority/billing.ts";

// ==========================================
// billing-checkout-stub (name kept on purpose - spec Phase 9: "Do not rename billing-checkout-stub").
// The former Stripe-named scaffold is REPLACED behind the provider-neutral BillingProvider interface
// (supabase/functions/subscription-authority/billing.ts: createCheckout / verifyWebhook). The only provider available is
// UNAVAILABLE_PROVIDER (OPEN-12: no written PayPlus/Max evidence), so checkout is unavailable.
// What was removed and why:
//   * the body `userId` (+ super_admin override) - the account always comes from the verified JWT;
//   * the `invoice_line_item` action - it added 18% VAT on top of a CLIENT-supplied unit price, contradicting OD-05 (local
//     prices already include VAT; nothing is added) and the server-catalog-only amount rule;
//   * the "wouldCreateCheckoutFor" Stripe stub payload.
// The real checkout entry is subscription-authority {action:'checkout_intent'} (server price catalog + server market).
// A redirect never grants an entitlement; only a verified provider event does.
// ==========================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ ok: false, code: 'not_authenticated' }, 401);
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error } = await callerClient.auth.getUser();
    if (error || !user) return jsonResponse({ ok: false, code: 'not_authenticated' }, 401);
    // No server attempt exists for this path; the provider-neutral interface is asked anyway so that an available provider
    // could never be reached from here with a client amount: there is no amount, currency or account in this request.
    const hosted = await UNAVAILABLE_PROVIDER.createCheckout({ attemptId: '00000000-0000-0000-0000-000000000000', currency: 'USD', amountMinor: 0 });
    if (!hosted) return jsonResponse({ ok: false, code: 'checkout_unavailable' }, 503);
    return jsonResponse({ ok: false, code: 'checkout_unavailable' }, 503);
  } catch {
    return jsonResponse({ ok: false, code: 'checkout_unavailable' }, 503);
  }
});
