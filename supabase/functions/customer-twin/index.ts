// customer-twin - wiring only (the logic is in lib.ts). The gateway verifies the JWT (verify_jwt = true) and the code verifies it again
// with auth.getUser; the allowance is claimed with the CALLER's JWT (auth.uid() in SQL), storing / refunding use the service role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { customerTwinHandler, TWIN_PROMPT_VERSION } from "./lib.ts";
import { calendarParts } from "../_shared/shortDate.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const PROVIDER_TIMEOUT_MS = 30000;
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply(405, { ok: false, code: 'method_not_allowed' });
  let body: unknown;
  try { body = await req.json(); } catch { return reply(400, { ok: false, code: 'invalid_request' }); }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return reply(401, { ok: false, code: 'unauthenticated' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const caller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
  let userId: string | null = null;
  try { const { data } = await caller.auth.getUser(); userId = data?.user?.id ?? null; } catch { userId = null; }
  if (!userId) return reply(401, { ok: false, code: 'unauthenticated' });
  // the service key: the new secret keys (as admin-billing), else the legacy service role key
  let secretKey = '';
  try { secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')['default'] ?? ''; } catch { secretKey = ''; }
  if (!secretKey) secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const rpc = async (client: ReturnType<typeof createClient>, fn: string, args: Record<string, unknown>) => {
    const { data, error } = await client.rpc(fn, args);
    if (error) throw new Error(fn);
    return data as Record<string, unknown>;
  };

  const r = await customerTwinHandler({
    market: async () => {
      const { data, error } = await caller.from('business_settings').select('country').eq('user_id', userId).maybeSingle();
      if (error) throw new Error('settings');
      const country = (data as { country?: string } | null)?.country;
      return country === 'Local' ? 'IL' : country === 'International' ? 'INTERNATIONAL' : null;
    },
    claim: (sha) => rpc(caller, 'customer_twin_claim', { p_content_sha256: sha }),
    store: (claimId, result, model) => rpc(admin, 'customer_twin_store', { p_claim_id: claimId, p_result: result, p_model: model, p_prompt_version: TWIN_PROMPT_VERSION }),
    refund: (claimId) => rpc(admin, 'customer_twin_refund', { p_claim_id: claimId }),
    complete: async ({ model, messages, schema }) => {
      const legacy = model === 'gpt-4o-mini';
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), PROVIDER_TIMEOUT_MS);
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages, response_format: { type: 'json_schema', json_schema: schema },
            ...(legacy ? { max_tokens: 1400, temperature: 0.3 } : { max_completion_tokens: 1400, reasoning_effort: 'none' }) }),
          signal: abort.signal,
        });
        if (res.status === 404 || (res.status === 400 && /model/i.test(await res.clone().text()))) throw new Error('model_unavailable');
        if (!res.ok) throw new Error('provider_failure');
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== 'string') throw new Error('provider_failure');
        return content;
      } finally { clearTimeout(timer); }
    },
    sha256: async (text) => {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    },
    today: () => { const p = calendarParts(new Date(), 'Local'); return p ? `${p.y}-${p.m}-${p.d}` : ''; },
  }, body);
  return reply(r.status, r.body);
});
