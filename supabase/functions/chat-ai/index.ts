/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateChatRequest, classifySupportMessage, buildSystemPrompt, CHAT_CONTRACT_VERSION } from "./validation.ts";
import { buildVerifiedAccountContext, fetchServerAccountSummary, isHebrewFromMarket, type BusinessSettingsRow } from "./accountContext.ts";
import { decideSmartPack, type AccountSummary } from "../_shared/subscriptionContract.ts";
import { resolveSubscriptionTruthResponse, findSubscriptionClaimViolations, safeSubscriptionAnswer } from "./subscriptionTruth.ts";
import { ownsQuote, sanitizeQuoteContext, buildQuoteContextBlock, type RawQuoteRow } from "./quoteContext.ts";
import { extractNavigationAction } from "./navigation.ts";
import { classifyDirectFactIntent, resolveDirectFact, formatDirectFactAnswer } from "./directFacts.ts";
import { paymentTruthApplies, classifyPaymentIntent, resolvePaymentTruthResponse, subscriptionPurchaseOpen } from "./paymentTruth.ts";
import { AI_FACTS } from "./aiFacts.generated.ts";
import { invoicingTruthApplies, classifyInvoicingIntent, resolveInvoicingTruthResponse } from "./invoicingTruth.ts";
import { capabilityTruthApplies, classifyCapabilityIntent, classifyBroadCapabilityQuestionSignal, resolveBroadCapabilityClarification, resolveCapabilityTruthResponse, BUILD_QUOTE_REQUEST, HOW_QUESTION } from "./capabilityTruth.ts";
import { howToStepsForCapability } from "./howToTruth.ts";
import { classifyAccountMarketIntent, formatAccountMarketAnswer } from "./marketTruth.ts";
import { buildAccountMarketFactPayload, NO_ACCOUNT_FACTS, type PayloadAccountFacts } from "./productTruthPayload.ts";
import type { ChatFactPayload } from "../_shared/aiChatContract.ts";
import { deriveTrustedFacts, reconcileBlockers, serverPrerequisites, classifyHelpIntent, deterministicHelpAnswer, buildHelpContextBlocks, allowedNavigation, type TrustedServerFacts, type ReconciledBlocker } from "./helpContext.ts";
import { buildErrorEnvelope, withLegacyChoices, type ChatErrorCode } from "../_shared/aiChatContract.ts";
import { classifyQuoteStatsIntent, computeQuoteStats, formatQuoteStatsAnswer, mentionsPlan, type QuoteStatRow } from "./quoteStatsTruth.ts";
import { buildNoInventionBlock, removeInventedOffers } from "./noInvention.ts";
import { CHEAP_MODEL, LEGACY_CHEAP_MODEL, isOwnDataQuestion, hasDataQualifier, chatCompletionsTools, chatCompletionToolCalls, runToolLoop, buildToolsPromptBlock, dailyCapAnswer, type ToolContext } from "./chatTools.ts";

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
  const { messages, isHebrew: clientIsHebrew, isDashboard, guidedIntent, guidedSubtopic, currentArea, selectedQuoteId, workflowContext, contextRevision, helpContext: rawHelpContext, draftSnapshot, screenshot: rawScreenshot } = validation.value;
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
  // Subscriptions cutover (OD-20): the account's plan facts come ONLY from public.get_account_summary(), called below with the
  // caller's OWN JWT (the RPC derives identity from auth.uid() and takes no argument). Never from the request body.
  let accountSummary: AccountSummary = { state: 'unavailable', code: 'no_verified_user' };
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
          accountSummary = await fetchServerAccountSummary((fn) => callerClient.rpc(fn));
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
  let trustedFacts: TrustedServerFacts | null = null;
  let isHebrew = clientIsHebrew;
  if (verifiedUserId) {
    const { data: bizRow } = await adminClient
      .from('business_settings')
      .select('role, country, phone, tax_id, is_lifetime')
      .eq('user_id', verifiedUserId)
      .maybeSingle();
    accountContext = buildVerifiedAccountContext(bizRow as BusinessSettingsRow | null, currentArea, accountSummary);
    // AI HELP V4 - Layer 3 trusted facts, scoped to this verified user only (profile completeness, server account summary).
    // The retired monthly quote counter is no longer computed (OD-20).
    trustedFacts = deriveTrustedFacts(accountContext, bizRow as { phone?: string; tax_id?: string; country?: string; role?: string } | null,
      accountSummary.state === 'ready' ? accountSummary.capabilities : null);
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

  // AI HELP V4 (AI-HELP-AVAILABILITY-001): browser help context is used ONLY behind a verified user (no private help otherwise);
  // every blocker is reconciled against Layer 3 facts (contradicted/stale claims are dropped).
  const helpContext = verifiedUserId && isDashboard ? rawHelpContext : null;
  const { active: activeBlockers, dropped: droppedBlockers } = helpContext ? reconcileBlockers(helpContext, trustedFacts) : { active: [] as ReconciledBlocker[], dropped: [] as ReconciledBlocker[] };
  const helpMode = helpContext ? (activeBlockers.length ? 'BLOCKED_WORKFLOW_HELP' : 'NORMAL_HELP') : null;
  const navAllowed = verifiedUserId ? allowedNavigation({ ctx: helpContext ? { ...helpContext, blockers: activeBlockers } : null, isAdmin: !!trustedFacts?.isAdmin, hasSelectedQuote: selectedQuoteAvailable }) : [];
  // Layer 3 prerequisites open their own product-owned resolution even before the browser reported a blocker
  if (helpContext) for (const f of serverPrerequisites(helpContext, trustedFacts)) {
    if (f === 'business_phone' && !navAllowed.includes('open_business_phone')) navAllowed.push('open_business_phone');
    if (f === 'business_tax_id' && !navAllowed.includes('open_business_tax_id')) navAllowed.push('open_business_tax_id');
  }
  const helpEnvelope = { helpMode, blockerCodes: activeBlockers.map((b) => b.code), privateHelp: !!verifiedUserId };
  const logChat = async (answerText: string) => {
    try {
      const { error: logError } = await adminClient.from('chat_logs').insert([
        { user_email: attributedEmail, user_question: lastUserMessage, ai_response: answerText, category: classifySupportMessage(lastUserMessage), created_at: new Date().toISOString() },
      ]);
      if (logError) console.error("chat_logs insert returned an error:", logError.message);
    } catch (logErr) {
      console.error("Failed to log chat question:", logErr);
    }
  };
  // STRUCTURED TRUTH: the SERVER-VERIFIED account facts every deterministic Product Truth payload is resolved against (never anything the
  // caller claimed). No verified account (public chat) = no account facts.
  const payloadAccount: PayloadAccountFacts = verifiedUserId && accountContext
    ? { market: accountContext.market, plan: accountContext.account.summaryState === 'ready' ? accountContext.account.planId : null, isAdmin: !!trustedFacts?.isAdmin }
    : NO_ACCOUNT_FACTS;
  // `factPayload` carries the structured Product Truth payload for a deterministic Product Truth answer (canonical authority -> structured
  // truth -> prose); it stays null for help / free-form answers that make no deterministic Product Truth claim.
  const deterministicResponse = (answerText: string, navigation: { action: string; focus: string | null } | null = null, truthPayload: ChatFactPayload | null = null) => new Response(JSON.stringify(withLegacyChoices({
    contractVersion: CHAT_CONTRACT_VERSION, requestId: crypto.randomUUID(), contextRevision, answer: answerText, answerSource: 'deterministic', factPayload: truthPayload,
    navigation, selectedQuoteContext: selectedQuoteRequested ? { requested: true, available: selectedQuoteAvailable } : null, ...helpEnvelope, error: null,
  })), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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
      return new Response(JSON.stringify(withLegacyChoices({
        contractVersion: CHAT_CONTRACT_VERSION,
        requestId: crypto.randomUUID(),
        contextRevision,
        answer: factAnswer,
        answerSource: 'deterministic',
        factPayload,
        navigation: null,
        selectedQuoteContext: { requested: true, available: true },
        ...helpEnvelope,
        error: null,
      })), {
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
  // AI HELP V4: invoicing truth is as deterministic as payment truth. A question about both gets both statements.
  const asksInvoicing = invoicingTruthApplies(AI_FACTS.invoicing) && classifyInvoicingIntent(lastUserMessage);
  const asksPayment = paymentTruthApplies(AI_FACTS.billing) && classifyPaymentIntent(lastUserMessage);
  if (asksInvoicing || asksPayment) {
    const truth = asksInvoicing ? resolveInvoicingTruthResponse(isHebrew, AI_FACTS.invoicing, payloadAccount, subscriptionPurchaseOpen(isHebrew, AI_FACTS.billing)) : resolvePaymentTruthResponse(isHebrew, AI_FACTS.billing, payloadAccount);
    await logChat(truth.answer);
    return deterministicResponse(truth.answer, null, truth.factPayload);
  }

  // QUOTE STATISTICS TRUTH (Owner console 2026-10-19, typed L-17 approval): "how many quotes do I have / what are their amounts" is
  // answered from THIS account's own quotes (the caller's JWT + user_id = the verified user; read-only), per currency, with the quote
  // list (its overview shows the same numbers) as the click-required destination. Runs before the subscription truth, which keeps the
  // plan-balance question ("how many quotes do I have LEFT" - excluded by the classifier).
  // Owner LIVE check 2026-10-19: a question about the user's OWN records goes to the read-only data tools when they are available -
  // the fixed account-wide statistics keep only the plain "how many quotes do I have" (no client / period / state in it).
  // Owner 2026-10-20 (typed L-17 approval): reading the user's own data (the tools) is SMART PACK once the plan system is enforced
  // (decideSmartPack: off / prepared / shadow / an unreadable summary keep today's access)
  const smartPackAllowed = decideSmartPack(accountSummary).allowed;
  const toolsEligible = !!(verifiedUserId && isDashboard && accountContext && !draftSnapshot && smartPackAllowed);
  const ownDataQuestion = toolsEligible && isOwnDataQuestion(lastUserMessage);
  if (!smartPackAllowed && verifiedUserId && isDashboard && accountContext && !draftSnapshot
      && isOwnDataQuestion(lastUserMessage) && hasDataQualifier(lastUserMessage)) {
    const smartPackAnswer = isHebrew
      ? 'קריאת הנתונים שלך בצ׳אט (הצעות, לקוחות, קטלוג ומשימות) היא חלק מחכם פלוס. אפשר להוסיף אותו במסך המסלולים.'
      : 'Reading your own data in the chat (quotes, clients, catalog and tasks) is part of SMART PACK. You can add it in the plans view.';
    await logChat(smartPackAnswer);
    return deterministicResponse(smartPackAnswer, null, null);
  }
  if (verifiedUserId && isDashboard && accountContext && classifyQuoteStatsIntent(lastUserMessage) && !(ownDataQuestion && hasDataQualifier(lastUserMessage))) {
    try {
      const statsClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
      const { data: statRows, error: statErr } = await statsClient.from('quotes').select('status, total, currency, view_count').eq('user_id', verifiedUserId);
      if (!statErr && Array.isArray(statRows)) {
        const { data: curRow } = await adminClient.from('business_settings').select('currency').eq('user_id', verifiedUserId).maybeSingle();
        const bizCur = String((curRow as { currency?: string } | null)?.currency || '').toUpperCase();
        const accountCurrency = accountContext.market === 'Local' ? 'ILS' : (['USD', 'EUR', 'GBP'].includes(bizCur) ? bizCur : 'USD');
        const statsAnswer = formatQuoteStatsAnswer(computeQuoteStats(statRows as QuoteStatRow[], accountCurrency), accountCurrency, isHebrew);
        await logChat(statsAnswer);
        return deterministicResponse(statsAnswer, navAllowed.includes('open_quote_history') ? { action: 'open_quote_history', focus: null } : null, null);
      }
    } catch (statsErr) {
      console.error('quote statistics answer failed:', statsErr);
    }
  }

  // SUBSCRIPTION TRUTH (OD-01..OD-20): a plan / price / trial / quota / "unlimited" question is answered DETERMINISTICALLY from
  // AI_FACTS.subscriptions (subscriptionContract.ts + priceCatalog.js) and the SERVER account summary - never by the model,
  // never from a plan the user claims. Runs after payment/invoicing (they keep first refusal on payment questions) and before
  // the market and capability routers. See subscriptionTruth.ts.
  {
    const subscription = resolveSubscriptionTruthResponse(lastUserMessage, isHebrew, verifiedUserId && accountContext ? accountContext.account : null);
    // Owner LIVE check 2026-10-19: "how many quotes do I have for client X" is a question about the user's records, not about the plan
    // allowance - unless it names the plan (left / free / subscription...), it goes to the data tools
    const dataNotPlan = ownDataQuestion && hasDataQualifier(lastUserMessage) && !mentionsPlan(lastUserMessage);
    if (subscription && !dataNotPlan) {
      await logChat(subscription.answer);
      // Owner 2026-10-25 (typed L-17, QA report): the plan answer offers the plans view (click-required, as every navigation)
      return deterministicResponse(subscription.answer, verifiedUserId && navAllowed.includes('open_plan_information') ? { action: 'open_plan_information', focus: null } : null, null);
    }
  }

  // ACCOUNT MARKET / CURRENCY TRUTH (structured-truth closure): a message that asserts or asks to change the account's market / currency is
  // answered DETERMINISTICALLY from the server-verified market, ACCOUNT-scoped - so the model can never turn it into a product-wide
  // currency claim ("TEKANGO prices are ILS only"). Only for a verified account whose market is known; see marketTruth.ts.
  if (verifiedUserId && accountContext && accountContext.market !== 'Unknown' && classifyAccountMarketIntent(lastUserMessage)) {
    const marketPayload = buildAccountMarketFactPayload(payloadAccount);
    const marketAnswer = formatAccountMarketAnswer(isHebrew, marketPayload);
    await logChat(marketAnswer);
    return deterministicResponse(marketAnswer, null, marketPayload);
  }

  // PRODUCT TRUTH REGISTRY (TEKANGO_AI_ARCHITECTURE.md v2.5 section 52): a "does the product have X"
  // question is answered DETERMINISTICALLY from the registry (no model guessing), the same pattern
  // as payment/invoicing truth above - closes the root cause of the wrong "no calculator" answer.
  // Runs AFTER payment/invoicing (they keep first refusal on their own questions) and before AI
  // Help V4. A capability question with a known nav destination gets a click-required suggestion,
  // re-validated the same way any other navigation is (navAllowed / extractNavigationAction).
  // Task 34: an explicit "review this quote" request (verified dashboard user + sanitized snapshot) carries the snapshot to the model, but
  // EVERY deterministic truth gate (payment / invoicing / subscription / market / capability / why-blocked) still runs first, unchanged.
  const reviewSnapshot = isDashboard && verifiedUserId ? draftSnapshot : null;
  if (capabilityTruthApplies({ capabilities: AI_FACTS.capabilities, nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities })) {
    // a question about the user's own records (e.g. "which tasks are overdue") is not a "does the product have X" question; the broad
    // existence guard below still runs for it unchanged
    // Owner 2026-10-25 (typed L-17, QA report): a troubleshooting question ("why can't I send on WhatsApp", "the email did not arrive")
    // resolves to no capability and is not a broad existence question (capabilityTruth.ts isTroubleshootingQuestion) - it goes to AI Help
    // (real blockers) and then the model with the verified steps, never "yes - this capability exists"
    const capabilityId = ownDataQuestion ? null : classifyCapabilityIntent(lastUserMessage);
    if (capabilityId) {
      // Codex "structured runtime answer contract" (2026-09-2X): formatCapabilityTruthAnswer
      // resolves a structured CapabilityAnswerState and THROWS CapabilityAnswerInvariantError if it
      // would violate a hard product invariant (payment/invoicing/AI-execution/etc.) - a real,
      // runtime hard-fail (not merely a test-time check), deliberately left uncaught here so a
      // violation can never be papered over into a wrong deterministic answer; the request fails
      // closed with a generic error rather than returning a false claim. Real data has zero
      // violations today (capabilityAnswerState.test.js) - this path exists as a regression guard.
      const capabilityTruth = resolveCapabilityTruthResponse(
        capabilityId,
        { capabilities: AI_FACTS.capabilities, nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities },
        isHebrew,
        payloadAccount.plan,
        verifiedUserId ? !!trustedFacts?.isAdmin : null,
        accountContext?.market ?? null,
      );
      if (capabilityTruth) {
        const matched = AI_FACTS.capabilities.find((c) => c.id === capabilityId);
        // Owner 2026-10-25 (typed L-17, QA report): a "how do I ..." question gets the verified steps after the fixed answer
        const steps = matched && HOW_QUESTION.test(lastUserMessage) && ['AVAILABLE', 'PLAN_NOT_DECIDED', 'PLAN_LOCKED'].includes(String(capabilityTruth.factPayload.truthStatus))
          ? howToStepsForCapability(capabilityId, lastUserMessage, isHebrew, AI_FACTS.howTo) : '';
        const capabilityAnswer = steps ? `${capabilityTruth.answer}\n\n${steps}` : capabilityTruth.answer;
        // Owner 2026-10-24 (typed L-17): "can you build / write me a quote" (ai_mutation about a quote) offers the AI smart quote button;
        // 2026-10-25 (QA report): only a build / write request - "can you send / delete my quote" gets no button
        const navId = matched?.aiMayNavigate && matched.safeNavigationId ? matched.safeNavigationId
          : capabilityId === 'ai_mutation' && BUILD_QUOTE_REQUEST.some((re) => re.test(lastUserMessage)) ? 'open_ai_quote' : null;
        const navSuggestion = navId && verifiedUserId && navAllowed.includes(navId) ? { action: navId, focus: null } : null;
        await logChat(capabilityAnswer);
        return deterministicResponse(capabilityAnswer, navSuggestion, capabilityTruth.factPayload);
      }
    }
    // Codex "deterministic product-capability-question guard" (2026-09-2X, blocker 3 §4.3): the
    // specific classifier above found no unique capability id, but the message clearly still ASKS
    // whether a product feature exists/is available/is supported/is allowed (an explicit existence-
    // verb phrasing the specific per-capability patterns did not happen to match). Such a message
    // must NEVER be allowed to reach the free-form model, which could otherwise guess at capability
    // availability - the exact defect class this entire subsystem exists to close. A bounded,
    // deterministic clarification is returned instead; the model is never invoked for this turn.
    else if (classifyBroadCapabilityQuestionSignal(lastUserMessage)) {
      const clarification = resolveBroadCapabilityClarification(isHebrew, payloadAccount);
      await logChat(clarification.answer);
      return deterministicResponse(clarification.answer, null, clarification.factPayload);
    }
  }

  // AI HELP V4: "why is this blocked / what is missing" and "is my work saved" are answered deterministically from the reconciled
  // blockers / draft provenance (no model guessing), with a safe, click-required navigation to the resolution when one exists.
  if (helpContext) {
    const det = deterministicHelpAnswer(classifyHelpIntent(lastUserMessage), helpContext, activeBlockers, trustedFacts, isHebrew, selectedQuoteAvailable);
    if (det) {
      await logChat(det.answer);
      return deterministicResponse(det.answer, det.navigation && navAllowed.includes(det.navigation.action) ? det.navigation : null);
    }
  }

  // System prompt: assembled entirely from AI_FACTS + verified server-
  // derived context - see validation.ts's buildSystemPrompt. guidedIntent/
  // guidedSubtopic/quoteContextBlock are transient request-scoped data
  // only: used here to build the prompt, never persisted (the chat_logs
  // insert below references none of them).
  const helpBlocks = helpContext ? buildHelpContextBlocks(helpContext, activeBlockers, droppedBlockers, trustedFacts, isHebrew) : null;
  const systemPrompt = buildSystemPrompt({ isHebrew, guidedIntent, guidedSubtopic, accountContext, quoteContextBlock, workflowContext: effectiveWorkflowContext, helpBlocks, allowedNavigation: verifiedUserId ? navAllowed : null, draftSnapshot: reviewSnapshot });

  // SMART CHAT (Owner console 2026-10-19, task-control activeTask.smartChatTools20261019, L-17 unlocked): a verified dashboard user's
  // question that reaches the model counts against the day's 30 (chat_ai_claim_question, the caller's own JWT; an admin is not
  // counted). Over the cap -> a fixed answer, no model call. A claim failure never blocks the chat (AI-HELP-AVAILABILITY-001).
  const userJwtClient = verifiedUserId && isDashboard
    ? createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    : null;
  if (userJwtClient && !trustedFacts?.isAdmin) {
    try {
      const { data: claim, error: claimErr } = await userJwtClient.rpc('chat_ai_claim_question');
      if (claimErr) console.error('chat_ai_claim_question failed:', claimErr.message);
      else if (claim && (claim as { allowed?: boolean }).allowed === false) {
        const capAnswer = dailyCapAnswer(isHebrew, Number((claim as { limit?: number }).limit) || 30);
        await logChat(capAnswer);
        return deterministicResponse(capAnswer, null, null);
      }
    } catch (claimErr) {
      console.error('chat_ai_claim_question failed:', claimErr);
    }
  }
  // the read-only data tools are offered only to a verified dashboard user (never on the public chat, never with a review snapshot)
  // Codex audit H01 (Owner 2026-10-21 "כן, את כולן"; the typed L-17 SMART PACK gate): no data tool at all without SMART PACK - the
  // classification of the question above is not the only guard (a paraphrase must never reach the account's data)
  const toolCtx: ToolContext | null = smartPackAllowed && userJwtClient && verifiedUserId && accountContext && !reviewSnapshot
    ? await (async () => {
      const { data: curRow } = await adminClient.from('business_settings').select('currency').eq('user_id', verifiedUserId).maybeSingle();
      const bizCur = String((curRow as { currency?: string } | null)?.currency || '').toUpperCase();
      const accountCurrency = accountContext.market === 'Local' ? 'ILS' : (['USD', 'EUR', 'GBP'].includes(bizCur) ? bizCur : 'USD');
      return { db: userJwtClient, userId: verifiedUserId, accountCurrency, today: new Date().toISOString().slice(0, 10) };
    })()
    : null;
  // Owner 2026-10-19 ("איך אתה אומר שהוא לא ממציא"): every model answer is told never to offer an action the product does not have;
  // a pasted / attached screenshot exists only in the signed-in dashboard chat (Owner "כן לצילום מסך ... העתק הדבק")
  const screenshot = toolCtx ? rawScreenshot : null;
  const promptWithRules = systemPrompt + buildNoInventionBlock(isHebrew, !!toolCtx);
  const modelInstructions = toolCtx ? promptWithRules + buildToolsPromptBlock(isHebrew, toolCtx.today) : promptWithRules;

  let data: Record<string, unknown> = {};
  // Task 35: the provider call is bounded - a hung model ends in the closed provider_failure state (the widget offers a retry)
  // Owner 2026-10-19 ("תחליף עכשיו כן"): the cheap model is the provider's replacement (no reasoning, so function calling works on
  // this endpoint); when it fails the old model answers the same request, so the chat never stops because of the switch.
  const callCheapModel = async (withTools: boolean, model: string) => {
    const providerAbort = new AbortController();
    const providerTimer = setTimeout(() => providerAbort.abort(), 25000);
    const legacy = model === LEGACY_CHEAP_MODEL;
    try {
      return await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: withTools ? modelInstructions : promptWithRules },
            // `messages` here is the array rebuilt by validateChatRequest -
            // only { role: 'user'|'assistant', content: string } objects,
            // never the raw caller payload spread in directly.
            ...messages
          ],
          ...(legacy
            ? { max_tokens: reviewSnapshot ? 900 : 600, temperature: 0.2 }
            : { max_completion_tokens: reviewSnapshot ? 900 : 600, reasoning_effort: 'none' }),
          ...(withTools ? { tools: chatCompletionsTools(), tool_choice: ownDataQuestion ? 'required' : 'auto', parallel_tool_calls: false } : {}),
        }),
        signal: providerAbort.signal,
      });
    } finally {
      clearTimeout(providerTimer);
    }
  };
  const callCheapWithFallback = async (withTools: boolean) => {
    try {
      const res = await callCheapModel(withTools, CHEAP_MODEL);
      if (res.ok) return res;
      console.warn(`chat-ai: ${CHEAP_MODEL} returned ${res.status}, answering with ${LEGACY_CHEAP_MODEL}`);
    } catch {
      console.warn(`chat-ai: ${CHEAP_MODEL} unreachable, answering with ${LEGACY_CHEAP_MODEL}`);
    }
    return await callCheapModel(withTools, LEGACY_CHEAP_MODEL);
  };
  // a question with a screenshot goes straight to the stronger model (it reads images; the cheap first call is skipped)
  if (!screenshot) {
    try {
      const openAiResponse = await callCheapWithFallback(!!toolCtx);

      if (!openAiResponse.ok) {
        return errorResponse('provider_failure', 'The AI provider returned an error', 502);
      }

      data = await openAiResponse.json();
    } catch {
      return errorResponse('provider_failure', 'Failed to reach the AI provider', 502);
    }
  }

  // the cheap model's reply text - the only place the provider response's choice list is read
  const replyText = (data: Record<string, unknown>) => (data?.choices as Array<{ message?: { content?: string } }> | undefined)?.[0]?.message?.content;
  let aiReply = screenshot ? undefined : replyText(data);
  // the cheap model asked for data -> the stronger model continues the turn with the tools; if that path fails, the question is
  // answered exactly as before this change (the cheap model, no tools)
  const firstCalls = toolCtx && !screenshot ? chatCompletionToolCalls(data) : [];
  if (toolCtx && (firstCalls.length || screenshot)) {
    const toolTurn = await runToolLoop({
      fetchImpl: fetch as unknown as Parameters<typeof runToolLoop>[0]['fetchImpl'], apiKey: Deno.env.get('OPENAI_API_KEY') ?? '',
      instructions: modelInstructions, messages, firstCalls, ctx: toolCtx, screenshot,
    });
    if (toolTurn) {
      aiReply = toolTurn.answer;
    } else {
      console.warn('chat-ai: tool path failed, falling back to the plain answer');
      try {
        const fallback = await callCheapWithFallback(false);
        if (!fallback.ok) return errorResponse('provider_failure', 'The AI provider returned an error', 502);
        aiReply = replyText(await fallback.json());
      } catch {
        return errorResponse('provider_failure', 'Failed to reach the AI provider', 502);
      }
    }
  }
  if (typeof aiReply !== 'string') {
    return errorResponse('malformed_provider_response', 'The AI provider returned an unexpected response shape', 502);
  }

  // אכיפה גורפת ומדויקת שמחליפה את support ל-info בכל צורה שלא תהיה בעברית
  // (isHebrew כאן הוא כבר הערך האפקטיבי - server-derived למשתמש מאומת,
  // client-supplied רק עבור הצ'אט הציבורי - ר' למעלה).
  if (!isHebrew) {
    aiReply = aiReply.replace(/support@tekango\.com/gi, 'info@tekango.com');
  }

  // an offer the product cannot keep (attaching a file / document; a screenshot outside the signed-in chat) is removed
  aiReply = removeInventedOffers(aiReply, { screenshots: !!toolCtx });

  // §8: parse and validate any trailing navigation marker - the visible
  // answer never contains the raw "NAVIGATE: ..." line either way.
  const extracted = extractNavigationAction(aiReply, selectedQuoteAvailable, verifiedUserId ? navAllowed : []);
  const navigationAction = extracted.action;
  // SUBSCRIPTION TRUTH answer gate: a model answer that states retired / unapproved plan truth (legacy plan names, a trial,
  // "unlimited", a monthly quote limit, annual pricing, an unapproved plan price, a shekel price on the International side)
  // is REJECTED and replaced by the canonical deterministic statement; the rejection is logged with its violation codes.
  const subscriptionViolations = findSubscriptionClaimViolations(extracted.answer, isHebrew);
  const answer = subscriptionViolations.length
    ? safeSubscriptionAnswer(isHebrew, verifiedUserId && accountContext ? accountContext.account : null)
    : extracted.answer;
  if (subscriptionViolations.length) console.warn('chat-ai: model answer rejected by subscription truth gate:', subscriptionViolations.join(','));
  const NAV_FOCUS: Record<string, string> = { open_business_phone: 'business_phone', open_business_tax_id: 'business_tax_id', open_business_details: 'business_details' };

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

  return new Response(JSON.stringify(withLegacyChoices({
    contractVersion: CHAT_CONTRACT_VERSION,
    requestId: crypto.randomUUID(),
    contextRevision,
    answer,
    answerSource: subscriptionViolations.length ? 'deterministic' : 'model',
    factPayload: null,
    navigation: navigationAction ? { action: navigationAction, focus: NAV_FOCUS[navigationAction] ?? null } : null,
    selectedQuoteContext: selectedQuoteRequested ? { requested: true, available: selectedQuoteAvailable } : null,
    ...helpEnvelope,
    error: null,
  })), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
