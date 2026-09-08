// חוק ברזל (Domain/Brand Centralization, systemic remediation task,
// 2026-09-09): the audit found the canonical domain hardcoded independently
// in 14+ locations across three separately-deployed runtimes (the Vercel
// frontend bundle, Vercel Edge Middleware, and each Supabase Edge Function) -
// exactly the shape of defect that caused send-quote-email to keep sending
// from the retired quotecodepro.com domain for 8 days after the TEKANGO
// migration, and has since been found live in chat-ai and billing-checkout-
// stub too. This module is the single source of truth for the FRONTEND
// bundle only - it cannot reach across the deploy boundary into Vercel Edge
// Middleware (middleware.ts's own CANONICAL_ORIGIN constant, a correct,
// separate source of truth for that runtime) or into any Supabase Edge
// Function (each is bundled and deployed independently; there is no shared
// import path across them without a deploy-time build step this project
// does not have). Every Edge Function must still define its own copy of
// these values - `scripts/retired-domain-guard.test.js` is the mechanism
// that keeps those copies honest going forward, since a shared runtime
// module is not possible for them.
export const CANONICAL_DOMAIN = 'tekango.com';
export const CANONICAL_ORIGIN = 'https://www.tekango.com';
export const SUPPORT_EMAIL_HE = 'support@tekango.com';
export const SUPPORT_EMAIL_EN = 'info@tekango.com';
