// quote-from-file - wiring only (the logic is in lib.ts). The gateway verifies the JWT (verify_jwt = true) and the code verifies it again
// with auth.getUser BEFORE the body is read; the allowance is claimed with the CALLER's JWT (auth.uid() in SQL), finishing uses the
// service role. Owner 2026-11-03: the file is never stored - it is read once into memory, sent to the provider once, and dropped.
// Nothing here logs a body, a file name, a provider answer or an error object: only fixed incident codes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { costMicros, meterCostUsdMicros, FILE_MODEL, MAX_PAGES, buildMessages, EXTRACTION_SCHEMA, handleQuoteFromFile, PROVIDER_TIMEOUT_MS, type Usage } from "./lib.ts";
import { claimMeter, inputTokensMax, reserveUsdMicros, FILE_PAGE_TOKENS_MAX, finishMeter, usdMicrosOrReserve, RESERVE_MICROS } from "../_shared/usageMeter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function readCapped(req: Request, max: number): Promise<Uint8Array | null> {
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { try { await reader.cancel(); } catch { /* ignore */ } return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  chunks.length = 0;
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply(405, { ok: false, code: 'method_not_allowed' });
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return reply(401, { ok: false, code: 'unauthenticated' });
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const caller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
  // the service key: the new secret keys (as admin-billing), else the legacy service role key
  let secretKey = '';
  try { secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')['default'] ?? ''; } catch { secretKey = ''; }
  if (!secretKey) secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const lengthHeader = req.headers.get('content-length');
  const contentLength = lengthHeader !== null && /^\d+$/.test(lengthHeader) ? Number(lengthHeader) : null;

  const r = await handleQuoteFromFile({
    userId: async () => { const { data } = await caller.auth.getUser(); return data?.user?.id ?? null; },
    claim: async () => {
      const { data, error } = await caller.rpc('quote_file_read_claim', {});
      if (error) throw new Error('claim');
      return data as { ok: boolean; code?: string; claimId?: string; status?: Record<string, unknown> };
    },
    finish: async (claimId, ok, u: Usage | null) => {
      const { data, error } = await admin.rpc('quote_file_read_finish', { p_claim_id: claimId, p_ok: ok, p_model: u?.model ?? FILE_MODEL,
        p_prompt_tokens: u?.promptTokens ?? null, p_completion_tokens: u?.completionTokens ?? null, p_provider_ms: u?.providerMs ?? null,
        p_cost_micros: u ? costMicros(u) : null });
      if (error) throw new Error('finish');
      return data as Record<string, unknown>;
    },
    // Owner 2026-11-06: the SMART PACK usage meter (claim with the caller's JWT, finish with the service role)
    // Owner console 2026-11-07 (release D, Codex M02): the proven maximum - the pages at a fixed page bound + the instructions, + the
    // 6,000 output cap, at the model's price (micro-USD; the database converts it at today's rate)
    meterClaim: () => claimMeter(caller, 'file_quote', RESERVE_MICROS.file_quote,
      reserveUsdMicros([FILE_MODEL], MAX_PAGES * FILE_PAGE_TOKENS_MAX + inputTokensMax(buildMessages('pdf', '')), 6000)),
    meterFinish: (claimId, ok, u: Usage | null) => finishMeter(admin, claimId, ok, {
      // the real cost whenever the provider answered - counted only when ok; an unusable answer keeps it on the claim (D01, the Owner)
      costUsdMicros: u ? usdMicrosOrReserve(meterCostUsdMicros(u), (u?.promptTokens ?? 0) + (u?.completionTokens ?? 0), RESERVE_MICROS.file_quote) : 0,
      model: u?.model ?? FILE_MODEL, promptTokens: u?.promptTokens ?? undefined, cachedTokens: u?.cachedTokens ?? undefined, completionTokens: u?.completionTokens ?? undefined }),
    readBody: (max) => readCapped(req, max),
    complete: async (messages) => {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), PROVIDER_TIMEOUT_MS);
      const started = Date.now();
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: FILE_MODEL, messages, response_format: { type: 'json_schema', json_schema: EXTRACTION_SCHEMA },
            max_completion_tokens: 6000, reasoning_effort: 'none', store: false }),
          signal: abort.signal,
        });
        if (!res.ok) throw new Error('provider_failure');   // the provider's error body is never read
        const data = await res.json();
        const choice = data?.choices?.[0];
        const content = choice?.message?.content;
        const n = (v: unknown) => (Number.isInteger(v) ? (v as number) : null);
        const usage = { model: FILE_MODEL, promptTokens: n(data?.usage?.prompt_tokens), completionTokens: n(data?.usage?.completion_tokens), providerMs: Date.now() - started,
          cachedTokens: n(data?.usage?.prompt_tokens_details?.cached_tokens) };
        // a cut / refused answer is a failure (never half a list) - but the provider answered, so its usage goes with the failure (the meter)
        if (typeof content !== 'string' || (choice?.finish_reason && choice.finish_reason !== 'stop') || choice?.message?.refusal) throw Object.assign(new Error('provider_failure'), { usage });
        return { content, usage };
      } finally { clearTimeout(timer); }
    },
    onIncident: (code) => console.error(JSON.stringify({ fn: 'quote-from-file', incident: code })),
  }, { contentType: req.headers.get('content-type'), contentLength });
  return reply(r.status, r.body);
});
