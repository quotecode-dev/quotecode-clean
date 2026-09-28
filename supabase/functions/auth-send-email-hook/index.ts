/// <reference types="https://deno.land/std@0.168.0/types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleSendEmailHook } from "./handler.ts";
import { makeBusinessMarketLookup } from "./marketLookup.ts";

// ==========================================
// Post-LIVE Priority 1 (Auth email localization + TEKANGO rebrand +
// sender separation), TEST-only preparation, 2026-09-16.
//
// This is a Supabase Auth "Send Email" Hook target: Supabase Auth itself
// (not this repo) calls this function synchronously, once, right before
// it would otherwise send its own built-in confirmation/recovery/magic-
// link/email-change email - the *only* architecture that lets a single
// account send a correctly-localized, correctly-branded, market-separated
// email for every Auth email type without duplicating Auth's own token/
// link-generation logic into a second, drifting pipeline (the alternative
// this task's own instruction explicitly rejects: "do not duplicate
// unrelated mail pipelines").
//
// ENABLED on the hosted TEST project (ljfizgrdyzxddswcedwr) as of the
// "Enable Auth Send Email Hook (TEST only)" continuation task, 2026-09-16,
// after the Owner added the missing RESEND_API_KEY secret this function
// depends on (see this file's own git history for the prior task's own
// deploy-but-do-not-activate decision and its exact reasoning). Activated
// via `supabase config push --project-ref ljfizgrdyzxddswcedwr`, explicit
// project-ref every time - never Production (ixabnzhjeqevtbhdfswv).
// Post-LIVE Wave 1 (2026-09-27): NOT deployed / NOT enabled on Production;
// enabling it there is an Owner decision (hook + SEND_EMAIL_HOOK_SECRET).
//
// Market signal (Auth market identity gap F1 - Option C, Owner-approved 2026-09-28; supersedes the earlier
// "signup_market for the account's whole lifetime" design, which sent English to existing Local accounts created before
// signup_market existed): the CANONICAL public.business_settings.country of the verified user decides ('Local' / 'LCL' ->
// Hebrew, support@; 'International' -> English, info@; anything else -> English, metadata ignored). user_metadata.
// signup_market (written at supabase.auth.signUp() in Dashboard.jsx) is used ONLY while no business_settings row exists yet
// (the signup email itself, or before the first login creates the row). Lookup failure / timeout fails closed to English
// and the email is still sent. See marketResolver.ts / marketLookup.ts and
// evidence/wave1-production-release-plan-2026-09-27/AUTH_MARKET_IDENTITY_DESIGN.md.
//
// Content (subject / HTML / text / sender) lives in ./emailContent.ts, the
// per-action message plan in ./emailPlan.ts, Standard Webhooks verification
// in ./webhookVerify.ts and the request handler in ./handler.ts - all
// runtime-independent and exercised by vitest. This file only wires Deno in.
//
// Codex Post-LIVE Wave 1 blocker remediation (2026-09-27): the previous
// handler modelled non-contract action names (email_change_current /
// email_change_new), always mailed user.email, ignored the webhook
// timestamp age and signature version and compared signatures with ===.
// See handler.ts / emailPlan.ts / webhookVerify.ts for the corrected,
// source-verified contract.
// ==========================================

const env = (name: string) => Deno.env.get(name);
const lookupMarketRows = makeBusinessMarketLookup({ env, createClient });

serve((req) => handleSendEmailHook(req, {
  env,
  fetch: (input, init) => fetch(input, init),
  nowMs: () => Date.now(),
  lookupMarketRows,
}));
