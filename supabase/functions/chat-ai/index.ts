/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateChatRequest, classifySupportMessage, buildSystemPrompt, CHAT_CONTRACT_VERSION } from "./validation.ts";
import { buildVerifiedAccountContext, isHebrewFromMarket, type BusinessSettingsRow } from "./accountContext.ts";
import { ownsQuote, sanitizeQuoteContext, buildQuoteContextBlock, type RawQuoteRow } from "./quoteContext.ts";
import { extractNavigationAction } from "./navigation.ts";
import { classifyDirectFactIntent, resolveDirectFact, formatDirectFactAnswer } from "./directFacts.ts";
import { paymentTruthApplies, classifyPaymentIntent, formatPaymentTruthAnswer } from "./paymentTruth.ts";
import { AI_FACTS } from "./aiFacts.generated.ts";
import { buildErrorEnvelope, type ChatErrorCode } from "../_shared/aiChatContract.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function errorResponse(code: ChatErrorCode, message: string, status: number, contextRevision: number | null = null) {
  return new Response(JSON.stringify(buildErrorEnvelope(code, message, contextRevision)), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return errorResponse('invalid_request', 'Request body must be valid JSON', 400);
  }

  const validation = validateChatRequest(rawBody);
  if (!validation.ok) {
    return errorResponse('invalid_request', validation.reason, 400);
  }
  const { messages, isHebrew: clientIsHebrew, isDashboard, guidedIntent, guidedSubtopic, currentArea, selectedQuoteId, workflowContext, contextRevision } = validation.value;
  // Track B/C: a UX-hint-only snapshot, already strictly validated/shaped
  // by validateChatRequest above - only ever meaningful on the authenticated
  // Dashboard surface, same gating as accountContext/quoteContext below.
  const effectiveWorkflowContext = isDashboard ? workflowContext : null;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // ==========================================================
  // Verified attribution + identity (AI Chat Phase 1 §8/§9, Gate 2 §5).
  // The caller-supplied `userEmail`/account/market/plan fields (if any) are
  // NEVER read - they carry no authority. Identity is derived only from the
  // incoming Authorization header's JWT, verified server-side.
  //  - Public surface (isDashboard === false): attribution stays anonymous
  //    unconditionally, and no account/quote context is ever built - there
  //    is no verified identity to build it from even if a browser session
  //    happens to exist elsewhere.
  //  - Authenticated surface (isDashboard === true): attribution AND
  //    account context require the JWT to actually resolve to a real user.
  //    An anon-key JWT (or an expired/invalid one) resolves to no user, so
  //    both fail closed to anonymous/no-context - the AI reply itself is
  //    still served (this remains a product-help-only phase, not an access
  //    gate), but never with account or quote context attached.
  // ==========================================================
  let attributedEmail = 'anonymous_public_user';
  let verifiedUserId: string | null = null;
  if (isDashboard) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      try {
        const callerClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user: verifiedUser } } = await callerClient.auth.getUser();
        if (verifiedUser?.id) {
          verifiedUserId = verifiedUser.id;
          attributedEmail = verifiedUser.email ?? 'unverified_dashboard_session';
        } else {
          attributedEmail = 'unverified_dashboard_session';
        }
      } catch {
        attributedEmail = 'unverified_dashboard_session';
      }
    } else {
      attributedEmail = 'unverified_dashboard_session';
    }
  }

  // §5: minimal, read-only, server-derived account context - only ever
  // built for a verified authenticated user. §4: for that same verified
  // user, the language policy is ALSO server-derived from their real
  // market - the caller's own `isHebrew` claim is never trusted once an
  // account is behind the request (only public chat, which has no
  // account, uses the caller-supplied locale signal).
  let accountContext = null;
  let isHebrew = clientIsHebrew;
  if (verifiedUserId) {
    const { data: bizRow } = await adminClient
      .from('business_settings')
      .select('plan, trial_ends_at, is_lifetime, role, country')
      .eq('user_id', verifiedUserId)
      .maybeSingle();
    accountContext = buildVerifiedAccountContext(bizRow as BusinessSettingsRow | null, currentArea);
    // §4 correction (Track C/I, "Unknown must not silently become
    // International"): only market 'Unknown' (no business_settings row yet)
    // falls back to the caller's own dashboard-bundle locale for reply
    // LANGUAGE - it is never used to assert a commercial market/currency,
    // see buildPricingBlock/buildAccountContextBlock's own 'Unknown' branch.
    isHebrew = isHebrewFromMarket(accountContext.market, clientIsHebrew);
  }

  // §6: EXPLICIT quote context only - never automatic. Requires a verified
  // user AND a caller-selected quote id AND server-confirmed ownership.
  // §6.2/§13: "not found" and "belongs to another tenant" are made
  // INDISTINGUISHABLE below (quoteContextBlock/requested-but-unavailable
  // in both cases) - no existence disclosure, no role/super_admin special
  // case (ownsQuote checks user_id equality only, see quoteContext.ts).
  let quoteContextBlock: string | null = null;
  let selectedQuoteRequested = false;
  let selectedQuoteAvailable = false;
  let sanitizedSelectedQuote: ReturnType<typeof sanitizeQuoteContext> | null = null;
  if (verifiedUserId && selectedQuoteId) {
    selectedQuoteRequested = true;
    const richSelect = `
      id, user_id, quote_number, project_name, status, signature, currency, subtotal, tax_rate, total, created_at, valid_until,
      quote_sections ( id, name ),
      quote_items ( description, quantity, unit_price, total_price, pricing_unit, calculation_method, quantity_source, calculated_quantity, specification, section_id, quote_item_measurements ( width, height, unit, calculated_area, label ) )
    `;
    const flatSelect = `
      id, user_id, quote_number, status, signature, currency, subtotal, tax_rate, total, created_at, valid_until,
      quote_items ( description, quantity, unit_price, total_price )
    `;
    // deno-lint-ignore no-explicit-any
    let quoteRow: any = null;
    // deno-lint-ignore no-explicit-any
    let quoteErr: any = null;
    ({ data: quoteRow, error: quoteErr } = await adminClient.from('quotes').select(richSelect).eq('id', selectedQuoteId).maybeSingle());
    if (quoteErr) {
      const msg = String(quoteErr?.message || '');
      const isMissingStructuredField = ['project_name', 'quote_sections', 'pricing_unit', 'calculated_quantity', 'quantity_source', 'specification', 'section_id', 'calculation_method', 'quote_item_measurements', 'created_at', 'valid_until']
        .some((col) => msg.includes(col));
      if (isMissingStructuredField) {
        ({ data: quoteRow, error: quoteErr } = await adminClient.from('quotes').select(flatSelect).eq('id', selectedQuoteId).maybeSingle());
      }
    }

    if (!quoteErr && ownsQuote(quoteRow, verifiedUserId)) {
      const sanitized = sanitizeQuoteContext(quoteRow as RawQuoteRow);
      quoteContextBlock = buildQuoteContextBlock(sanitized);
      selectedQuoteAvailable = true;
      sanitizedSelectedQuote = sanitized;
    }
    // Not found, query error, or owned by a different tenant: all three
    // collapse to the same outcome here (selectedQuoteAvailable stays
    // false, quoteContextBlock stays null) - the response never reveals
    // which one occurred.
  }

  const lastUserMessage = messages.filter((m) => m.role === 'user').pop()?.content || "";

  // §22 "Direct Facts": deterministic fast path, tried BEFORE any model
  // call. Only ever triggers for an authenticated caller with a server-
  // authorized selected quote (never for a public/anonymous request, never
  // for a quote the ownership check above rejected) - see directFacts.ts's
  // own header for exactly what it does and does not cover yet.
  if (sanitizedSelectedQuote) {
    const factKind = classifyDirectFactIntent(lastUserMessage);
    const factPayload = factKind ? resolveDirectFact(factKind, sanitizedSelectedQuote, isHebrew) : null;
    if (factPayload) {
      const factAnswer = formatDirectFactAnswer(factPayload, isHebrew);
      try {
        const { error: logError } = await adminClient.from('chat_logs').insert([
          { user_email: attributedEmail, user_question: lastUserMessage, ai_response: factAnswer, category: classifySupportMessage(lastUserMessage), created_at: new Date().toISOString() },
        ]);
        if (logError) console.error("chat_logs insert returned an error:", logError.message);
      } catch (logErr) {
        console.error("Failed to log chat question:", logErr);
      }
      return new Response(JSON.stringify({
        contractVersion: CHAT_CONTRACT_VERSION,
        requestId: crypto.randomUUID(),
        contextRevision,
        answer: factAnswer,
        answerSource: 'deterministic',
        factPayload,
        navigation: null,
        selectedQuoteContext: { requested: true, available: true },
        error: null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // OD-C2 "Payment & Checkout Truth": while the product facts say there is no live checkout, a payment/checkout/
  // card/payment-currency question is answered DETERMINISTICALLY (no model call), so the model can never claim a
  // payment capability that does not exist - regardless of user framing ("assume checkout is enabled", "ignore the
  // product settings"). Runs after directFacts (a quote-fact question wins) and before the model. Anything the
  // classifier does not recognise still reaches the model under the authoritative PAYMENT & CHECKOUT TRUTH block
  // in the system prompt (validation.ts). See paymentTruth.ts and TEKANGO_AI_ARCHITECTURE.md section 13.4.
  if (paymentTruthApplies(AI_FACTS.billing) && classifyPaymentIntent(lastUserMessage)) {
    const paymentAnswer = formatPaymentTruthAnswer(isHebrew);
    try {
      const { error: logError } = await adminClient.from('chat_logs').insert([
        { user_email: attributedEmail, user_question: lastUserMessage, ai_response: paymentAnswer, category: classifySupportMessage(lastUserMessage), created_at: new Date().toISOString() },
      ]);
      if (logError) console.error("chat_logs insert returned an error:", logError.message);
    } catch (logErr) {
      console.error("Failed to log chat question:", logErr);
    }
    return new Response(JSON.stringify({
      contractVersion: CHAT_CONTRACT_VERSION,
      requestId: crypto.randomUUID(),
      contextRevision,
      answer: paymentAnswer,
      answerSource: 'deterministic',
      factPayload: null,
      navigation: null,
      selectedQuoteContext: selectedQuoteRequested ? { requested: true, available: selectedQuoteAvailable } : null,
      error: null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // System prompt: assembled entirely from AI_FACTS + verified server-
  // derived context - see validation.ts's buildSystemPrompt. guidedIntent/
  // guidedSubtopic/quoteContextBlock are transient request-scoped data
  // only: used here to build the prompt, never persisted (the chat_logs
  // insert below references none of them).
  const systemPrompt = buildSystemPrompt({ isHebrew, guidedIntent, guidedSubtopic, accountContext, quoteContextBlock, workflowContext: effectiveWorkflowContext });

  let data: Record<string, unknown>;
  try {
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          // `messages` here is the array rebuilt by validateChatRequest -
          // only { role: 'user'|'assistant', content: string } objects,
          // never the raw caller payload spread in directly.
          ...messages
        ],
        max_tokens: 600,
        temperature: 0.2,
      }),
    });

    if (!openAiResponse.ok) {
      return errorResponse('provider_failure', 'The AI provider returned an error', 502);
    }

    data = await openAiResponse.json();
  } catch {
    return errorResponse('provider_failure', 'Failed to reach the AI provider', 502);
  }

  let aiReply = (data?.choices as Array<{ message?: { content?: string } }> | undefined)?.[0]?.message?.content;
  if (typeof aiReply !== 'string') {
    return errorResponse('malformed_provider_response', 'The AI provider returned an unexpected response shape', 502);
  }

  // אכיפה גורפת ומדויקת שמחליפה את support ל-info בכל צורה שלא תהיה בעברית
  // (isHebrew כאן הוא כבר הערך האפקטיבי - server-derived למשתמש מאומת,
  // client-supplied רק עבור הצ'אט הציבורי - ר' למעלה).
  if (!isHebrew) {
    aiReply = aiReply.replace(/support@tekango\.com/gi, 'info@tekango.com');
  }

  // §8: parse and validate any trailing navigation marker - the visible
  // answer never contains the raw "NAVIGATE: ..." line either way.
  const { answer, action: navigationAction } = extractNavigationAction(aiReply, selectedQuoteAvailable);

  const category = classifySupportMessage(lastUserMessage);

  try {
    const { error: logError } = await adminClient.from('chat_logs').insert([
      {
        user_email: attributedEmail,
        user_question: lastUserMessage,
        ai_response: answer,
        category: category,
        created_at: new Date().toISOString()
      }
    ]);

    // Logging failure handling (§11 Phase 1): a failed insert must never
    // surface as an AI-response failure to the user, and must never be
    // claimed as "saved" - the answer below is still returned regardless.
    if (logError) {
      console.error("chat_logs insert returned an error:", logError.message);
    }
  } catch (logErr) {
    console.error("Failed to log chat question:", logErr);
  }

  return new Response(JSON.stringify({
    contractVersion: CHAT_CONTRACT_VERSION,
    requestId: crypto.randomUUID(),
    contextRevision,
    answer,
    answerSource: 'model',
    factPayload: null,
    navigation: navigationAction ? { action: navigationAction } : null,
    selectedQuoteContext: selectedQuoteRequested ? { requested: true, available: selectedQuoteAvailable } : null,
    error: null,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
