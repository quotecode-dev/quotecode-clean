/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
// ai-quote-draft (Task 21): drafts reviewable quote LINES from the user's own job description for the dashboard "AI smart quote" choice.
// Read-only: it never writes a quote, client, catalog row or log, never sends anything, and returns advice the user applies explicitly.
//  - Identity: the gateway verifies the JWT (verify_jwt = true) and the code verifies it again with auth.getUser; no body field names an
//    account. Tenant: business_settings and the catalog are read with the CALLER's JWT (RLS) and filtered by the verified user id.
//  - Market / language (IRON-AI-003): from business_settings.country only (Local -> Hebrew, International -> English); unknown -> refused.
//  - Prices (IRON-AI-001): the model never sees or returns a price; a line's unit price comes only from the caller's matching catalog row,
//    every other line has no price. All validation lives in ../_shared/aiQuoteDraft.js (shared with the browser).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Task 33 (contract v2): every line carries quantity + unit + a quantity basis that is CHECKED against the numbers of the user's own text
// (a missing quantity stays visibly missing - never a silent 1); clarification questions and unassigned measures are returned; a catalog
// price is bound only when its price unit is verified. The provider answers in a strict JSON schema (DRAFT_RESPONSE_SCHEMA).
import { AI_QUOTE_DRAFT_CONTRACT_VERSION, DRAFT_RESPONSE_SCHEMA, validateDraftRequest, normalizeCatalog, buildDraftMessages, parseDraftModelOutput } from "../_shared/aiQuoteDraft.js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Task 35: the provider call is bounded - a hung model never keeps the dialog waiting (the user sees the closed "provider_failure" state)
const PROVIDER_TIMEOUT_MS = 25000;

function reply(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify({ contractVersion: AI_QUOTE_DRAFT_CONTRACT_VERSION, ...body }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ ok: false, code: 'method_not_allowed' }, 405);

  let body: unknown;
  try { body = await req.json(); } catch { return reply({ ok: false, code: 'invalid_request' }, 400); }
  const request = validateDraftRequest(body);
  if (!request.ok) return reply({ ok: false, code: 'invalid_request', reason: request.reason }, 400);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return reply({ ok: false, code: 'unauthenticated' }, 401);
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

  let userId: string | null = null;
  try {
    const { data } = await caller.auth.getUser();
    userId = data?.user?.id ?? null;
  } catch { userId = null; }
  if (!userId) return reply({ ok: false, code: 'unauthenticated' }, 401);

  const { data: settings, error: settingsError } = await caller
    .from('business_settings').select('country').eq('user_id', userId).maybeSingle();
  if (settingsError) return reply({ ok: false, code: 'server_error' }, 500);
  const country = (settings as { country?: string } | null)?.country;
  if (country !== 'Local' && country !== 'International') return reply({ ok: false, code: 'market_unresolved' }, 409);
  const isHebrew = country === 'Local';

  const { data: services, error: servicesError } = await caller
    .from('services').select('id, name, price').eq('user_id', userId).order('created_at', { ascending: true }).limit(200);
  if (servicesError) return reply({ ok: false, code: 'server_error' }, 500);
  const catalog = normalizeCatalog(services);

  let modelText: unknown;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const providerResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: buildDraftMessages({ description: request.value.description, isHebrew, catalog }),
        response_format: { type: 'json_schema', json_schema: DRAFT_RESPONSE_SCHEMA },
        max_tokens: 1600,
        temperature: 0.1,
      }),
      signal: abort.signal,
    });
    if (!providerResponse.ok) return reply({ ok: false, code: 'provider_failure' }, 502);
    const data = await providerResponse.json();
    modelText = data?.choices?.[0]?.message?.content;
  } catch {
    return reply({ ok: false, code: 'provider_failure' }, 502);
  } finally {
    clearTimeout(timer);
  }

  const draft = parseDraftModelOutput(modelText, catalog, request.value.description);
  if (!draft.ok) return reply({ ok: false, code: draft.code === 'empty' ? 'no_items' : 'malformed_provider_response' }, draft.code === 'empty' ? 422 : 502);
  return reply({ ok: true, language: isHebrew ? 'he' : 'en', subject: draft.subject, items: draft.items, questions: draft.questions, unassignedMeasures: draft.unassignedMeasures });
});
