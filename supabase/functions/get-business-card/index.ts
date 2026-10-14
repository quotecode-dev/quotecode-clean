/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
// get-business-card (Task 23 + Task 24, Phase 5): the PUBLIC read behind /card/:id. Anonymous by design (verify_jwt = false) - a business card is
// meant to be shared. Read-only; it returns ONLY the whitelisted public contact fields of ../_shared/businessCard.js for the business
// whose owner user_id is the card id (an unguessable UUID; never the sequential business_settings.id). Every miss - malformed id, no
// row, no real business name, unresolved market - is the same uniform 404, so the endpoint does not reveal which ids exist.
// The service role is used server-side only, with an explicit column list (never select('*')); nothing is logged or written.
// LOCAL SOURCE ONLY in Task 23 - not deployed (no deploy authorized for it); the public page says so honestly until it is.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BUSINESS_CARD_CONTRACT_VERSION, BUSINESS_CARD_COLUMNS, BUSINESS_CARD_PROFILE_COLUMNS, isBusinessCardId, projectBusinessCard } from "../_shared/businessCard.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function reply(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify({ contractVersion: BUSINESS_CARD_CONTRACT_VERSION, ...body }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}
const NOT_FOUND = () => reply({ ok: false, code: 'not_found' }, 404);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ ok: false, code: 'method_not_allowed' }, 405);

  let body: { id?: unknown } | null = null;
  try { body = await req.json(); } catch { return reply({ ok: false, code: 'invalid_request' }, 400); }
  const id = body && typeof body === 'object' ? body.id : null;
  if (!isBusinessCardId(id)) return NOT_FOUND();

  // same server-key convention as get-public-quote (SUPABASE_SECRET_KEYS.default); missing configuration fails closed
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  let secretKey = '';
  try { secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')['default'] ?? ''; } catch { secretKey = ''; }
  if (!supabaseUrl || !secretKey) return reply({ ok: false, code: 'server_error' }, 500);
  const admin = createClient(supabaseUrl, secretKey);
  const { data, error } = await admin.from('business_settings').select(BUSINESS_CARD_COLUMNS).eq('user_id', id).maybeSingle();
  if (error) return reply({ ok: false, code: 'server_error' }, 500);
  // Task 24: the owner's card profile (optional fields, opt-in channel flags, style). Until the business_cards migration is applied the
  // table does not exist: that is "no profile" (name + logo only, no channel), never an error. Any other read failure fails closed.
  const profile = await admin.from('business_cards').select(BUSINESS_CARD_PROFILE_COLUMNS).eq('user_id', id).maybeSingle();
  const missingTable = !!profile.error && /42P01|PGRST205|does not exist|schema cache/i.test(`${profile.error.code ?? ''} ${profile.error.message ?? ''}`);
  if (profile.error && !missingTable) return reply({ ok: false, code: 'server_error' }, 500);
  const card = projectBusinessCard(data, missingTable ? null : profile.data);
  if (!card) return NOT_FOUND();
  return reply({ ok: true, card });
});
