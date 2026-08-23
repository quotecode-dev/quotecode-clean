# Invoicing & Billing Infrastructure

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

Added to `.env.example` (copy to `.env` locally, which is gitignored -
see the "Security" section below for why this matters here specifically):

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

## 4. Integration steps for a real Stripe connection

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
  never be committed; `.env.example` documents the variable *names*
  only, with empty values.
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
