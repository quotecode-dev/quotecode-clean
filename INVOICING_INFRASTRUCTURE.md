# Invoicing & Billing Infrastructure

> **Canonical payment/invoicing provider status (2026-09-22, Owner-directed) - READ FIRST**
>
> | Item | Status |
> |---|---|
> | PAYPLUS | **PROVIDER CANDIDATE** |
> | COMMERCIAL OFFER | **RECEIVED** · **NOT SIGNED** |
> | TECHNICAL INTEGRATION | **NOT STARTED** |
> | CHECKOUT | **NOT LIVE** |
> | INVOICING | **NOT LIVE** |
> | PRODUCTION PROVIDER DECISION | **NOT FINAL** |
>
> The architecture stays **provider-neutral**. The Stripe-oriented material below (§2-§5, `billing-checkout-stub`) is **generic,
> incomplete scaffolding written before any provider evaluation - it is NOT evidence that Stripe was selected** and must not be read as
> a provider decision. PayPlus details, the commercial proposal and the open due-diligence questions: **§8**. No part of the product
> processes card payments, issues invoices/receipts, or charges subscriptions today; signup starts the 14-day free trial only.

Status: **scaffolding only**. Nothing in this document describes a live
integration - no real Stripe account is connected, no invoicing API is
called. This records the exact architecture, currency/VAT rules, and the
integration points a future engineer (or a future AI session) should use
to wire up real billing without having to re-derive any of this from
scratch or, worse, re-implement the region/currency/VAT logic in a way
that drifts from what the rest of the app already relies on.

## 1. Regional currency & VAT rules (already enforced, not new)

This is the one rule set the whole app already treats as load-bearing -
billing/invoicing must reuse it, not reinvent it:

| Region | `business_settings.country` | Currency | VAT | Language |
|---|---|---|---|---|
| Local (Israel) | `'Local'` | ILS (`₪`) | **18%** | Hebrew |
| International | `'International'` | USD (`$`) | **0%** (export exemption) | English |

Why 0% for international: under Israeli VAT law, export of services to a
customer outside Israel is zero-rated (`מע"מ בשיעור אפס`), not merely
"not applicable" - it is a specific exemption, which is why the codebase
already treats it as an explicit rate (`0.00`) rather than the absence of
a tax field. See `src/utils/regionConfig.js`:

```js
export const REGION_RULES = Object.freeze({
  LOCAL: { countryCode: 'Local', currencySymbol: '₪', vatRate: 0.18 },
  INTERNATIONAL: { countryCode: 'International', defaultCurrencySymbol: '$', vatRate: 0.00 },
});
```

`region` is a **binding, admin-set, immutable field** determined
automatically at signup from the business's detected locale - it is
intentionally not user-editable from the dashboard or the admin table
(see `AdminUsersTab.jsx`'s region badge, which is display-only). Any
billing/invoicing code must treat `business_settings.country` as the
single source of truth for which currency/VAT applies to a given
business - never infer it from UI language, browser locale, or IP at
checkout time.

### The consolidated accessor: `getRegionBillingProfile(country)`

Added specifically for billing/invoicing consumers, in
`src/utils/regionConfig.js`. It wraps the existing `REGION_RULES` /
`getRegionTaxRate` / `getCurrencySym` helpers (still used elsewhere and
left untouched) into one convenient, frozen shape:

```js
import { getRegionBillingProfile } from './src/utils/regionConfig.js';

getRegionBillingProfile('Local');
// {
//   countryCode: 'Local', currencyCode: 'ILS', currencySymbol: '₪',
//   vatRate: 0.18, vatPercentLabel: '18%', language: 'he',
//   isExportVatExempt: false,
// }

getRegionBillingProfile('International');
// {
//   countryCode: 'International', currencyCode: 'USD', currencySymbol: '$',
//   vatRate: 0.00, vatPercentLabel: '0%', language: 'en',
//   isExportVatExempt: true,
// }
```

Any new billing/invoicing code (client-side or a new Edge Function)
should call this rather than re-deriving currency/VAT from scratch.

**Edge Functions cannot import this file directly.** Every Supabase Edge
Function in this project is an independent Deno deployment with no
bundler tying it to the Vite/React `src/` tree (see `send-trial-
expiration-email`, `send-subscription-expiration-email`, `send-quote-
email` for the existing pattern) - each one keeps its own small,
self-contained copy of whatever constants it needs. `billing-checkout-
stub/index.ts` follows the same convention: it has its own
`getRegionBillingProfile()` that must be kept in sync with
`src/utils/regionConfig.js` by hand if the rules ever change (they are
frozen/`Object.freeze`d specifically because they are not expected to).

## 2. Environment variables

Add these to your local `.env` (gitignored — see the "Security" section
below for why this matters here specifically; the full root env variable
reference lives in `PROFLOW_ARCHITECTURE.md` §21, which replaced the
retired `.env.example` template):

```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
INVOICE_API_KEY=
```

- `STRIPE_SECRET_KEY` - server-side only (Supabase secret / Vercel env
  var). Never reference this in any client-side (`VITE_*`) variable or
  ship it to the browser bundle. Use a **test-mode** key
  (`sk_test_...`) during development; only a production Stripe account
  with real billing terms configured should ever see a live key
  (`sk_live_...`).
- `STRIPE_WEBHOOK_SECRET` - the signing secret Stripe gives you when you
  register a webhook endpoint (`whsec_...`). Used to verify incoming
  webhook requests are genuinely from Stripe, exactly the same role
  `RESEND_WEBHOOK_SECRET` plays for `resend-email-webhook` (see that
  function for the Svix/HMAC verification pattern to mirror - Stripe
  uses its own signature scheme, not Svix, so the verification code
  itself won't be identical, but the *shape* of the check - reject
  anything whose signature doesn't match before trusting the payload -
  is the same).
- `INVOICE_API_KEY` - placeholder for whichever regional invoicing
  provider gets chosen (e.g. an Israeli-compliant invoicing API for
  `חשבונית מס` generation - this has specific legal requirements beyond
  what Stripe itself produces, which is why it's a separate integration
  rather than "just use Stripe's built-in invoices").

## 3. The stub: `supabase/functions/billing-checkout-stub/index.ts`

Deployed and callable today, but every response it returns is explicitly
marked `stub: true` - it computes the *correct region/currency/VAT*
using real `business_settings` data, but never calls Stripe or any
invoicing API. It exists to lock in the integration points before any
real money is involved:

- **Auth**: requires a valid Supabase session (`verify_jwt = true` at the
  gateway, plus an internal check that the caller's JWT matches the
  `userId` being requested, or that the caller is `super_admin`) - the
  same ownership-check pattern used by `admin-delete-user`. A stub is
  still a template other code will copy from, so it's secure by default,
  not just "will work."
- **`action: "checkout"` (default)**: looks up the business's region,
  computes its billing profile, and returns what *would* be sent to
  Stripe - `wouldCreateCheckoutFor: { planId, currency, vatRate,
  language }` - plus a commented-out example of the real
  `stripe.checkout.sessions.create(...)` call showing exactly where
  `billingProfile.currencyCode` and `automatic_tax` plug in.
- **`action: "invoice_line_item"`**: given a description/unit
  price/quantity, computes a fully-formed invoice line item (subtotal,
  VAT amount, total, and a human-readable VAT note distinguishing "18%
  Israeli VAT" from "0% export exemption") using the business's real
  region - again, without calling any external invoicing API.

## 4. Integration steps for a real Stripe connection (generic scaffold written before provider evaluation - Stripe is NOT selected; see §8)

1. Create the Stripe product/price objects - **one price per currency**
   (Stripe prices are single-currency; you cannot charge USD and ILS off
   one price object). Store the price ID mapping (plan → currency →
   Stripe price ID) somewhere queryable (a small `stripe_prices` table
   is simplest, or the price IDs can be resolved directly from
   `getRegionBillingProfile(...).currencyCode` at checkout time).
2. Set `STRIPE_SECRET_KEY` as a Supabase secret
   (`supabase secrets set STRIPE_SECRET_KEY=sk_test_... --project-ref
   <ref>`) - test mode first, always.
3. In `billing-checkout-stub` (or a renamed/promoted version of it once
   it's no longer a stub), replace `buildStubCheckoutResponse` with a
   real `stripe.checkout.sessions.create(...)` call. Deno supports npm
   packages directly: `import Stripe from 'npm:stripe@^16';`. Set
   `automatic_tax: { enabled: !billingProfile.isExportVatExempt }` (or
   configure Stripe Tax with the correct Israeli VAT registration) so
   the 18%/0% rule is enforced by Stripe itself at checkout, not just by
   this function's own math.
4. Create a **new** webhook-receiving Edge Function (do not reuse
   `resend-email-webhook` - different signer, different secret, different
   event shapes) modeled directly on it: verify `stripe-signature`
   against `STRIPE_WEBHOOK_SECRET`, handle `checkout.session.completed`
   / `invoice.paid` / `customer.subscription.deleted`, and update
   `business_settings.plan` (mirroring what `handleAdminPlanChange`
   already does manually today) so a real payment automatically upgrades
   the account instead of requiring an admin to do it by hand.
5. Register the new webhook endpoint's URL in the Stripe Dashboard, copy
   the signing secret it generates into `STRIPE_WEBHOOK_SECRET`.
6. Add the "Upgrade" button flow in `PricingModal.jsx` to call this
   function and redirect the browser to the returned `checkoutUrl`
   instead of (or before) any manual admin plan-change flow.

## 5. Integration steps for a real invoicing API

1. Choose a provider that can issue an Israeli-compliant `חשבונית מס
   קבלה` (or a plain export invoice for international customers) - this
   is a legal document format distinct from a Stripe receipt.
2. Set `INVOICE_API_KEY` as a Supabase secret.
3. Replace `buildRegionalInvoiceLineItem`'s return value with an actual
   API call to that provider once a Stripe payment succeeds (triggered
   from the same webhook function described above), passing through the
   already-computed `billingProfile` so the invoice is issued in the
   correct currency with the correct VAT treatment automatically.
4. Store the resulting invoice ID/PDF URL somewhere associated with the
   payment (a `subscription_invoices` table, or a column on
   `business_settings` if one invoice per billing cycle is enough).

## 6. Security notes

- `.env` is now gitignored (it previously was not - see the repo history
  around this document's introduction). Real Stripe/invoicing keys must
  never be committed; `PROFLOW_ARCHITECTURE.md` §21 documents the variable
  *names* only, with empty values (replaces the retired `.env.example`).
- Never read `STRIPE_SECRET_KEY`/`INVOICE_API_KEY` in any client-side
  (`VITE_*`) context - both must only ever be read via `Deno.env.get(...)`
  inside an Edge Function, exactly like `RESEND_API_KEY` today.
- Any endpoint that looks up another business's data by ID must verify
  the caller owns that ID or is `super_admin` - `billing-checkout-stub`
  demonstrates the pattern; copy it rather than skipping the check
  "since it's just a stub."
- Webhook endpoints (Stripe, or any invoicing provider with webhooks)
  must verify the provider's signature before trusting the payload,
  exactly like `resend-email-webhook` does for Resend's Svix signatures.
  Never process a webhook body without first confirming who sent it.

## 7. Customer-Facing vs. Internal Tax Presentation — Permanent Separation Rule (added 2026-09-15, Owner-approved product/governance decision)

This section records a **product separation rule**, not a final legal
determination of the tax treatment of any International transaction —
see the Legal/Accounting Confirmation Boundary at the end of this
section before implementing any automatic VAT/tax behavior.

**HE / LOCAL / RTL / ILS TAX PRESENTATION MUST REMAIN ISOLATED FROM
EN / INTERNATIONAL / LTR / INTERNATIONAL-CURRENCY TAX PRESENTATION.**
This extends the existing §1 market-separation rule (already
load-bearing throughout the app for language/direction/currency/VAT
rate) to **customer-facing tax terminology** specifically. The Owner
explicitly rejected exposing internal Israeli tax/legal classification
text inside international customer documents.

**INTERNAL TAX CLASSIFICATION MUST NEVER LEAK INTO CUSTOMER-FACING
INTERNATIONAL DOCUMENTS.** For an International customer-facing
invoice/receipt/subscription document, the implementation must:

- display only customer-relevant tax information;
- preserve EN / LTR;
- preserve the customer's international currency;
- not expose internal Israeli legal/tax reasoning unless a specific
  legal requirement later proves such disclosure mandatory;
- not show Israeli internal legal-basis wording merely because the
  seller is Israeli;
- never show internal phrases such as "Israeli zero-rated export of
  services", "Section 30(a)(5)", internal Israeli VAT classification
  notes, or internal jurisdiction/audit metadata.

Customer-facing international presentation may use neutral
customer-relevant fields such as **Subtotal**, **VAT**/**Tax** (label
chosen per the final jurisdiction-specific invoicing policy — not
hardcoded globally without legal/accounting approval), **Tax Amount**,
**Total**.

**Concrete existing gap this rule applies to**: §3's
`billing-checkout-stub` `action: "invoice_line_item"` response already
returns "a human-readable VAT note distinguishing '18% Israeli VAT'
from '0% export exemption'" — that reasoning-shaped note is exactly the
kind of internal-classification text this rule forbids from reaching an
International customer directly. Before that stub (or any real
invoicing integration replacing it) is ever wired into customer-facing
output, its response shape must separate an internal field (e.g. a
`taxTreatment`/reasoning note, for bookkeeping/audit/accountant review
only) from the customer-facing field (a neutral `Subtotal`/`VAT`/`Tax`/
`Total` breakdown only) — no shared rendering shortcut may let the
internal note leak into the rendered document.

**INTERNAL ACCOUNTING METADATA AND CUSTOMER-FACING INVOICE
PRESENTATION ARE SEPARATE LAYERS.** TEKANGO may preserve internal
tax/accounting metadata separately for bookkeeping, accountant review,
audit trail, tax reporting, and compliance logic. Examples of
internal-only metadata: Tax Treatment, Jurisdiction, Legal Basis,
Customer Residency, Tax Decision Reason. These internal fields must not
automatically appear in International customer-facing output. When
this is implemented, the architecture must structurally separate
INTERNAL TAX METADATA from CUSTOMER-FACING INVOICE PRESENTATION — no
shared rendering shortcut may cause internal Israeli tax labels to leak
into EN/International documents.

**Local / Israel customers are unaffected**: Local Israeli
customer-facing documents remain governed by the existing Local market
separation (HE / Local / RTL / ILS, §1 above) and may show Israeli tax
terminology that is legally/accountingly appropriate for Israeli
customers. The International presentation rules above must never be
used to weaken or overwrite the Local presentation rules.

**NO GLOBAL TAX LABEL OR RATE MAY BE HARD-CODED FOR INTERNATIONAL
CUSTOMERS WITHOUT JURISDICTION-SPECIFIC APPROVAL.**

**Legal / Accounting Confirmation Boundary**: before implementing
automatic VAT/tax behavior for International subscriptions, obtain (and
account for) final professional confirmation on: Israeli VAT treatment;
foreign digital-services VAT/GST/sales-tax obligations; B2B vs. B2C
differences; country-specific invoice requirements; whether "VAT",
"Tax", or another label is appropriate per jurisdiction. Do not
hardcode a global 0% VAT rule into customer-facing invoices solely from
this documentation — §1's existing `vatRate: 0.00` for International
remains the current, already-enforced product rule for internal
calculation purposes; this section governs *customer-facing
presentation/labeling* on top of it, not a change to that rate.

## 8. Payment / invoicing provider candidate: PayPlus (recorded 2026-09-22 - commercial evaluation only)

**Status (canonical):** PAYPLUS: PROVIDER CANDIDATE · COMMERCIAL OFFER: RECEIVED · COMMERCIAL OFFER: NOT SIGNED · TECHNICAL INTEGRATION:
NOT STARTED · CHECKOUT: NOT LIVE · INVOICING: NOT LIVE · PRODUCTION PROVIDER DECISION: NOT FINAL.

This section records a received commercial proposal. **It is not implementation truth, not a signed agreement, and not a provider
decision.** Nothing here authorizes code, credentials, webhooks, a merchant account, or any customer-facing payment claim. The integration
contract stays provider-neutral (a provider adapter behind the existing region/currency/VAT accessor, §1), so a different provider can
still be chosen without re-architecture.

### 8.1 Services in the received proposal (all prices before VAT, as reported by the Owner)

| Service | Proposal figure |
|---|---|
| Digital terminal setup | ILS 250 one-time, up to 1,000 transactions/month |
| Website payment page | ILS 79 / month |
| API permissions | ILS 29.90 / month |
| Standing orders (recurring-payment capability) | ILS 85 / month |
| Standing-order transaction charge | **preserve the proposal's exact wording and units until clarified with PayPlus** (not restated here to avoid inventing a unit) |
| Token service | ILS 39.90 / month |
| 3D Secure (optional / additional) | ILS 400 one-time + ILS 1.20 per transaction |
| Digital invoices - Professional | up to 100 documents / month, ILS 29 / month |
| Digital invoices - Enterprise | up to 250 documents / month, ILS 49 / month |
| Digital invoices - Premium | up to 500 documents / month, ILS 79 / month |
| Digital wallets | optional, for one-time payments |
| Acquiring | a **separate acquiring-company / internet merchant number** is required (not part of the PayPlus fees) |

### 8.2 Open due-diligence questions (must be answered before any provider decision or integration work)

1. **Tenant / merchant model** - is TEKANGO the merchant (platform subscriptions only) or does each TEKANGO business need its own merchant
   account to collect from its customers (marketplace/sub-merchant model)? Both flows must stay separable.
2. **Per-tenant credentials** - how are per-business terminals/keys provisioned, stored and rotated; can TEKANGO hold them securely server-side only?
3. **Onboarding** - merchant onboarding steps, KYC, lead time, who signs with the acquirer.
4. **API authentication** - key types, scopes, IP allow-listing, key rotation.
5. **Sandbox** - is there a full sandbox (payments, tokens, recurring, documents) usable from TEST without real money?
6. **Webhook signatures** - signed callbacks? algorithm, secret rotation, replay protection.
7. **Idempotency** - idempotency keys on charge/refund/document creation; behavior on retries/timeouts.
8. **Reconciliation** - settlement reports, transaction status API, how to reconcile against our records.
9. **Refunds / voids** - full/partial refunds, void windows, how refunds map to credit documents.
10. **Tokenization** - token scope (per terminal/merchant), portability if we change provider, token lifetime.
11. **PCI boundary** - hosted page / iframe / fields: does card data ever touch TEKANGO? (target: never - SAQ A scope).
12. **Recurring billing** - standing-order semantics, schedule control, proration, retries.
13. **Failed renewal** - retry schedule, dunning notifications, webhook events, grace period mapping to our entitlement model.
14. **Invoice / receipt document APIs** - document types (tax invoice, receipt, tax invoice-receipt, credit note), numbering, legal validity.
15. **Transaction <-> accounting document linkage** - automatic document per charge? one API call or two? atomicity/idempotency.
16. **Local vs International document rules** - ILS Israeli VAT documents vs USD/EUR/GBP documents for foreign customers; language (HE/EN);
    presentation must follow §7 (no internal Israeli tax classification text on International customer documents).
17. **Hosted vs embedded checkout** - options, branding, redirect/return flows, mobile behavior.
18. **Currencies** - which currencies can be charged and settled (ILS, USD, EUR, GBP), FX handling, settlement currency.
19. **3DS** - when it is mandatory vs optional, liability shift, UX.
20. **Wallets** - Apple Pay / Google Pay availability, one-time only vs recurring.
21. **Accessibility** - hosted payment page accessibility conformance (Israeli standard IS 5568 / WCAG 2.x AA).
22. **Subscription lifecycle** - upgrade, downgrade, cancel, renewal, proration and refunds for TEKANGO plans (monthly / annual).

### 8.3 Rules until a provider is decided and an integration is separately authorized

- No landing/pricing/marketing copy may claim live checkout, card processing, automatic invoices/receipts or recurring billing.
  Plan prices and the annual plan stay visible (Owner decision: PRICING DISPLAY KEEP, ANNUAL PLAN KEEP, 14-DAY FREE TRIAL KEEP);
  signup truthfully starts the 14-day free trial with no card and no payment step.
- No payment/invoicing credentials in the repo or client bundle; server-side secrets only, when an integration is authorized.
- A risky integration must ship behind a kill-switch (OD-5) and with forward-safe database changes only.
