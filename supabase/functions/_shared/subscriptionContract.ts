// Subscriptions cross-cutting contract (OD-01..OD-20, spec v3). ONE source for the client (src/ imports this file, like
// quoteStyleCapabilities.ts) and the Edge functions. Pure module: no Deno globals, no remote imports, no I/O.
//
// What lives here:
//   - canonical plan IDs and display names (OD-16);
//   - stable capability IDs and their metadata (OD-17/18). Eligible plans are NOT approved (OPEN-02): every entry keeps
//     eligiblePlans = null, which the UI renders as "not decided yet" and the server treats as "not granted";
//   - the account-summary/v1 response contract and its strict parser (OD-20). Anything outside the allowlist fails closed;
//   - the capability decision rule shared by every gate.
// Legacy free/basic/pro/trial values are audit history only and never appear here.

export const ACCOUNT_SUMMARY_SCHEMA = 'account-summary/v1';

// Task 27 (§249 / §253, Owner 2026-10-11): the current paid offer is ONE all-inclusive package ('all_inclusive', monthly or annual);
// quote styles are not subscriptions. 'classic' / 'modern' / 'visual' stay valid plan IDs ONLY as legacy paid plans, so existing rights
// keep their identity (no automatic migration of any account).
export type PlanId = 'free' | 'all_inclusive' | 'classic' | 'modern' | 'visual';
export type Lang = 'he' | 'en';

export const PLAN_IDS: readonly PlanId[] = Object.freeze(['free', 'all_inclusive', 'classic', 'modern', 'visual'] as PlanId[]);
export const PAID_PLAN_IDS: readonly PlanId[] = Object.freeze(['all_inclusive', 'classic', 'modern', 'visual'] as PlanId[]);
export const CURRENT_PAID_PLAN_ID: PlanId = 'all_inclusive';
export const LEGACY_PAID_PLAN_IDS: readonly PlanId[] = Object.freeze(['classic', 'modern', 'visual'] as PlanId[]);
export const PACKAGE_BILLING_PERIODS = Object.freeze(['month', 'year'] as const);

// OD-16 - the only user-facing plan names.
export const PLAN_NAMES: Readonly<Record<Lang, Readonly<Record<PlanId, string>>>> = Object.freeze({
  he: Object.freeze({ free: 'חינם', all_inclusive: 'הכול כלול', classic: 'קלאסיק', modern: 'מודרן', visual: 'ויזואל' }),
  en: Object.freeze({ free: 'Free', all_inclusive: 'All-inclusive', classic: 'Classic', modern: 'Modern', visual: 'Visual' }),
});

export function normalizePlanId(value: unknown): PlanId | null {
  return typeof value === 'string' && (PLAN_IDS as readonly string[]).includes(value) ? value as PlanId : null;
}

export function planName(planId: unknown, lang: unknown): string | null {
  const id = normalizePlanId(planId);
  if (!id) return null;
  return PLAN_NAMES[lang === 'he' ? 'he' : 'en'][id];
}

export const FREE_QUOTES_TOTAL = 10; // OD-01 + Owner 2026-10-20: 10 quotes OR 7 days, whichever ends first (the server sends the window)

// Output channels (OD-02). WhatsApp and email are Send paths; approval/signature use the same artifact.
export const OUTPUT_CHANNELS = Object.freeze(['send', 'public_share', 'final_pdf', 'final_print'] as const);
export type OutputChannel = typeof OUTPUT_CHANNELS[number];

// Activation phases. The live TEST/Production phase is 'off' (nothing applied). 'prepared' = schema present, inert.
export const ACTIVATION_PHASES = Object.freeze(['off', 'prepared', 'shadow', 'enforced'] as const);
export type ActivationPhase = typeof ACTIVATION_PHASES[number];

// ---------------------------------------------------------------------------------------------------------------------
// Capabilities (OD-17). Every capability stays visible; a locked one opens CapabilityUpgradeNotice and mutates nothing.
// eligiblePlans: null = commercial matrix not approved (OPEN-02 / OPEN-13). The server never grants a capability without an
// approved policy row; freeEligible:false is an approved hard denial (OD-18).
// ---------------------------------------------------------------------------------------------------------------------
export type CapabilityId =
  | 'quote_style.classic'
  | 'quote_style.modern'
  | 'quote_style.visual'
  | 'quote_media.upload'
  | 'catalog_product_image.upload'
  | 'quote_attachment.upload'
  | 'quote.edit_duplicate'
  | 'quote.whatsapp_delete'
  | 'professional_quote.use'
  | 'professional_quote.reuse'
  | 'catalog_capacity.expand';

export interface CapabilityMeta {
  id: CapabilityId;
  label: Readonly<Record<Lang, string>>;
  explanation: Readonly<Record<Lang, string>>;
  baseline: boolean;            // granted to every provisioned account by the server (current server truth)
  freeEligible: boolean | null; // false = approved denial for Free (OD-18); null = not decided
  eligiblePlans: readonly PlanId[] | null; // null = not approved (OPEN-02/OPEN-13)
  decision: string;             // the decision ID that owns the open value
}

function cap(id: CapabilityId, he: string, en: string, heWhy: string, enWhy: string,
  extra: Partial<Pick<CapabilityMeta, 'baseline' | 'freeEligible' | 'eligiblePlans' | 'decision'>> = {}): CapabilityMeta {
  return Object.freeze({
    id,
    label: Object.freeze({ he, en }),
    explanation: Object.freeze({ he: heWhy, en: enWhy }),
    baseline: extra.baseline ?? false,
    freeEligible: extra.freeEligible ?? null,
    eligiblePlans: extra.eligiblePlans ?? null,
    decision: extra.decision ?? 'OPEN-02',
  });
}

export const CAPABILITIES: Readonly<Record<CapabilityId, CapabilityMeta>> = Object.freeze({
  // technical baseline = current server truth (every account renders Classic); not a commercial decision
  'quote_style.classic': cap('quote_style.classic', 'סגנון קלאסיק', 'Classic style',
    'סגנון ההצעה הקלאסי.', 'The classic quote style.', { baseline: true, decision: 'technical baseline (current server truth), not commercial' }),
  'quote_style.modern': cap('quote_style.modern', 'סגנון מודרן', 'Modern style',
    'סגנון הצעה עם תמונות ופריסה מודרנית.', 'A quote style with images and a modern layout.'),
  'quote_style.visual': cap('quote_style.visual', 'סגנון ויזואל', 'Visual style',
    'סגנון הצעה עם תמונה ראשית וגלריה.', 'A quote style with a hero image and a gallery.'),
  'quote_media.upload': cap('quote_media.upload', 'תמונות בהצעה', 'Images in quotes',
    'הוספת תמונות להצעת מחיר.', 'Adding images to a quote.'),
  'catalog_product_image.upload': cap('catalog_product_image.upload', 'תמונות מוצר בקטלוג', 'Catalog product images',
    'הוספת תמונות למוצרים בקטלוג.', 'Adding images to catalog products.', { freeEligible: false }),
  'quote_attachment.upload': cap('quote_attachment.upload', 'קבצים מצורפים', 'Attachments',
    'צירוף קבצים להצעת מחיר.', 'Attaching files to a quote.', { decision: 'OPEN-13' }),
  // Not plan-gated in the new model: their only gate was the retired legacy plan model (OD-01/15/16). The server grants them to
  // every provisioned account in the enforced phase (20261007150900); a future approved rule may gate them.
  'quote.edit_duplicate': cap('quote.edit_duplicate', 'עריכה ושכפול של הצעה שנשלחה', 'Edit and duplicate a sent quote',
    'עריכה או שכפול של הצעה שכבר יצאה ללקוח.', 'Editing or duplicating a quote that was already sent.', { decision: 'not plan-gated (retired legacy-model gate)' }),
  'quote.whatsapp_delete': cap('quote.whatsapp_delete', 'מחיקת הצעה שנשלחה', 'Delete a sent quote',
    'מחיקה של הצעה שכבר יצאה ללקוח.', 'Deleting a quote that was already sent.', { decision: 'not plan-gated (retired legacy-model gate)' }),
  'professional_quote.use': cap('professional_quote.use', 'הצעה מקצועית', 'Professional quote',
    'בניית הצעה מקצועית עם פרקים ופריטים.', 'Building a professional quote with sections and items.', { decision: 'not plan-gated (retired legacy-model gate)' }),
  'professional_quote.reuse': cap('professional_quote.reuse', 'שימוש חוזר בהצעה מקצועית', 'Reuse a professional quote',
    'יצירת הצעה חדשה מתוך הצעה מקצועית קיימת.', 'Creating a new quote from an existing professional quote.', { decision: 'not plan-gated (retired legacy-model gate)' }),
  'catalog_capacity.expand': cap('catalog_capacity.expand', 'הרחבת קטלוג', 'Catalog expansion',
    // OD-04/07 define the paid add-on; whether Free may buy it is not decided (OPEN-03); purchase unavailable (OPEN-12)
    'הוספת 100 מוצרי קטלוג למסלול בתשלום.', 'Adding 100 catalog products to a paid plan.', { decision: 'OD-04/OD-07; Free OPEN-03; purchase OPEN-12' }),
});

export const CAPABILITY_IDS: readonly CapabilityId[] = Object.freeze(Object.keys(CAPABILITIES) as CapabilityId[]);

export function isCapabilityId(value: unknown): value is CapabilityId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CAPABILITIES, value);
}

// ---------------------------------------------------------------------------------------------------------------------
// account-summary/v1. Produced only by public.get_account_summary() (JWT -> auth.uid(); no argument can name an account).
// Success shape (every field required):
//   { ok:true, schema:'account-summary/v1', version:int>=1, phase:{output, catalog, billing}, market:'IL'|'INTERNATIONAL'|null,
//     plan:{ id:PlanId }, subscriptionStatus:'none'|'pending'|'active'|'past_due'|'failed'|'cancelled',
//     capabilities:CapabilityId[], eligiblePlans:{ [CapabilityId]: PlanId[] } (only approved entries; normally {}),
//     free10:{ limit:10, consumed, reserved, remaining } | null (null for paid),
//     catalog:{ active:int (raw services rows; NO commercial meaning while countDefinition is 'unset' - OPEN-03),
//               countDefinition:'unset'|'approved:<ref>', limit:int|null, blocks:int, limitDecided:boolean }, priceCatalogVersion }
// Failure shape: { ok:false, code } with code in SUMMARY_FAILURE_CODES.
// ---------------------------------------------------------------------------------------------------------------------
export const SUMMARY_FAILURE_CODES = Object.freeze(['not_activated', 'account_not_provisioned', 'not_authenticated'] as const);
export const SUBSCRIPTION_STATUSES = Object.freeze(['none', 'pending', 'active', 'past_due', 'failed', 'cancelled'] as const);

export type SummaryState = 'loading' | 'ready' | 'not_activated' | 'not_deployed' | 'unprovisioned' | 'unavailable' | 'invalid';

export interface ReadySummary {
  state: 'ready';
  version: number;
  phase: { output: ActivationPhase; catalog: ActivationPhase; billing: ActivationPhase };
  market: 'IL' | 'INTERNATIONAL' | null;
  planId: PlanId;
  subscriptionStatus: typeof SUBSCRIPTION_STATUSES[number];
  capabilities: readonly CapabilityId[];
  eligiblePlans: Readonly<Partial<Record<CapabilityId, readonly PlanId[]>>>;
  free10: { limit: number; consumed: number; reserved: number; remaining: number; endsAt: string | null; periodEnded: boolean } | null;
  catalog: { active: number; countDefinition: string; limit: number | null; blocks: number; limitDecided: boolean };
  priceCatalogVersion: string | null;
  // 20261021200000 (Owner 2026-10-18): the paid period, the 3 grace days after a failed charge and limited mode
  billing: { paidThrough: string | null; graceEndsAt: string | null; inGrace: boolean; limited: boolean };
}
export type AccountSummary = ReadySummary | { state: Exclude<SummaryState, 'ready'>; code?: string };

// the server's window end: UTC with milliseconds (to_char in 20261021100000), which every browser engine parses
const ISO_UTC_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const isInt = (v: unknown, min = 0) => typeof v === 'number' && Number.isInteger(v) && v >= min;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isPhase = (v: unknown): v is ActivationPhase => typeof v === 'string' && (ACTIVATION_PHASES as readonly string[]).includes(v);

// Strict allowlist parser. Never trusts a field it does not validate; any mismatch is 'invalid' (fail closed).
export function parseAccountSummary(raw: unknown): AccountSummary {
  if (!isObj(raw)) return { state: 'invalid', code: 'not_an_object' };
  if (raw.ok === false) {
    if (raw.code === 'not_activated') return { state: 'not_activated', code: 'not_activated' };
    if (raw.code === 'account_not_provisioned') return { state: 'unprovisioned', code: 'account_not_provisioned' };
    if (raw.code === 'not_authenticated') return { state: 'unavailable', code: 'not_authenticated' };
    return { state: 'invalid', code: 'unknown_failure_code' };
  }
  if (raw.ok !== true || raw.schema !== ACCOUNT_SUMMARY_SCHEMA) return { state: 'invalid', code: 'schema' };
  if (!isInt(raw.version, 1)) return { state: 'invalid', code: 'version' };
  const phase = raw.phase;
  if (!isObj(phase) || !isPhase(phase.output) || !isPhase(phase.catalog) || !isPhase(phase.billing)) return { state: 'invalid', code: 'phase' };
  if (!(raw.market === null || raw.market === 'IL' || raw.market === 'INTERNATIONAL')) return { state: 'invalid', code: 'market' };
  const plan = raw.plan;
  const planId = isObj(plan) ? normalizePlanId(plan.id) : null;
  if (!planId) return { state: 'invalid', code: 'plan' };
  if (typeof raw.subscriptionStatus !== 'string' || !(SUBSCRIPTION_STATUSES as readonly string[]).includes(raw.subscriptionStatus)) {
    return { state: 'invalid', code: 'subscription_status' };
  }
  if (!Array.isArray(raw.capabilities) || !raw.capabilities.every(isCapabilityId)) return { state: 'invalid', code: 'capabilities' };
  const capabilities = Object.freeze([...new Set(raw.capabilities as CapabilityId[])]);
  // OD-18: Free never holds catalog product image upload, whatever the payload says.
  if (planId === 'free' && capabilities.includes('catalog_product_image.upload')) return { state: 'invalid', code: 'free_catalog_image' };
  const eligibleRaw = raw.eligiblePlans;
  if (!isObj(eligibleRaw)) return { state: 'invalid', code: 'eligible_plans' };
  const eligiblePlans: Partial<Record<CapabilityId, readonly PlanId[]>> = {};
  for (const [k, v] of Object.entries(eligibleRaw)) {
    if (!isCapabilityId(k) || !Array.isArray(v) || !v.every((p) => normalizePlanId(p))) return { state: 'invalid', code: 'eligible_plans' };
    eligiblePlans[k] = Object.freeze([...v] as PlanId[]);
  }
  let free10: ReadySummary['free10'] = null;
  if (planId === 'free') {
    const f = raw.free10;
    if (!isObj(f) || f.limit !== FREE_QUOTES_TOTAL || !isInt(f.consumed) || !isInt(f.reserved) || !isInt(f.remaining)) {
      return { state: 'invalid', code: 'free10' };
    }
    if ((f.consumed as number) > FREE_QUOTES_TOTAL
      || f.remaining !== Math.max(FREE_QUOTES_TOTAL - (f.consumed as number) - (f.reserved as number), 0)) {
      return { state: 'invalid', code: 'free10_arithmetic' };
    }
    // 20261021100000 (Owner 2026-10-20): the 7-day window. Absent on an older server = no window (null / false); when present it must be
    // well-formed, and an ended period always names its end.
    const endsAt = f.endsAt === undefined ? null : f.endsAt;
    const periodEnded = f.periodEnded === undefined ? false : f.periodEnded;
    if (!(endsAt === null || (typeof endsAt === 'string' && ISO_UTC_MS.test(endsAt) && !Number.isNaN(Date.parse(endsAt))))
      || typeof periodEnded !== 'boolean'
      || (periodEnded && endsAt === null)) {
      return { state: 'invalid', code: 'free10_window' };
    }
    free10 = Object.freeze({ limit: FREE_QUOTES_TOTAL, consumed: f.consumed as number, reserved: f.reserved as number, remaining: f.remaining as number,
      endsAt: endsAt as string | null, periodEnded });
  } else if (raw.free10 !== null) {
    return { state: 'invalid', code: 'free10_paid' };
  }
  const c = raw.catalog;
  if (!isObj(c) || !isInt(c.active) || !isInt(c.blocks) || typeof c.limitDecided !== 'boolean'
    || !(c.limit === null || isInt(c.limit))) {
    return { state: 'invalid', code: 'catalog' };
  }
  if (c.limitDecided !== (c.limit !== null)) return { state: 'invalid', code: 'catalog_limit' };
  // OPEN-03: the item / variant / archive count definition must be stated; 'unset' until the Owner approves one
  if (typeof c.countDefinition !== 'string' || !/^(unset|approved:[A-Za-z0-9._-]{3,64})$/.test(c.countDefinition)) {
    return { state: 'invalid', code: 'catalog_count_definition' };
  }
  if (!(raw.priceCatalogVersion === null || typeof raw.priceCatalogVersion === 'string')) return { state: 'invalid', code: 'price_version' };
  // absent on an older server = no paid period / grace (never a false block); when present it must be well-formed
  const bRaw = raw.billing === undefined ? { paidThrough: null, graceEndsAt: null, inGrace: false, limited: false } : raw.billing;
  const isTime = (v: unknown) => v === null || (typeof v === 'string' && ISO_UTC_MS.test(v) && !Number.isNaN(Date.parse(v)));
  if (!isObj(bRaw) || !isTime(bRaw.paidThrough) || !isTime(bRaw.graceEndsAt) || typeof bRaw.inGrace !== 'boolean' || typeof bRaw.limited !== 'boolean'
    || ((bRaw.inGrace || bRaw.limited) && bRaw.graceEndsAt === null) || (bRaw.inGrace && bRaw.limited)) {
    return { state: 'invalid', code: 'billing' };
  }
  const billing = Object.freeze({ paidThrough: bRaw.paidThrough as string | null, graceEndsAt: bRaw.graceEndsAt as string | null,
    inGrace: bRaw.inGrace, limited: bRaw.limited });
  return Object.freeze({
    state: 'ready',
    version: raw.version as number,
    phase: Object.freeze({ output: phase.output, catalog: phase.catalog, billing: phase.billing }),
    market: raw.market as ReadySummary['market'],
    planId,
    subscriptionStatus: raw.subscriptionStatus as ReadySummary['subscriptionStatus'],
    capabilities,
    eligiblePlans: Object.freeze(eligiblePlans),
    free10,
    catalog: Object.freeze({ active: c.active as number, countDefinition: c.countDefinition as string, limit: c.limit as number | null, blocks: c.blocks as number, limitDecided: c.limitDecided }),
    priceCatalogVersion: raw.priceCatalogVersion as string | null,
    billing,
  }) as ReadySummary;
}

// ---------------------------------------------------------------------------------------------------------------------
// The single capability decision rule.
//   * ready + output phase 'enforced' -> the server capability list decides (authoritative); unknown -> denied.
//   * unprovisioned / invalid        -> denied (fail closed; the subscription system is active but this account is not).
//   * not_activated / not_deployed / unavailable / loading -> the subscription system is not active for this account, so
//     the pre-existing entitlement of the account is kept unchanged (legacyAllowed, computed by the caller from the legacy
//     record) - no plan is assumed, nothing is granted or revoked by the cutover code itself. legacyAllowed must be an
//     explicit boolean; anything else is denied.
//   * shadow observes only (no enforcement on the client or the server): the legacy entitlement is kept, for Free too.
//   * OD-18: in the enforced phase a Free account is always denied catalog_product_image.upload.
// ---------------------------------------------------------------------------------------------------------------------
export interface CapabilityDecision { allowed: boolean; source: 'server' | 'legacy' | 'fail_closed'; reason: string }

export function decideCapability(summary: AccountSummary | null | undefined, capabilityId: unknown, legacyAllowed?: unknown): CapabilityDecision {
  if (!isCapabilityId(capabilityId)) return { allowed: false, source: 'fail_closed', reason: 'unknown_capability' };
  const state = summary?.state ?? 'loading';
  if (state === 'ready') {
    const s = summary as ReadySummary;
    if (s.phase.output === 'enforced') {
      if (s.planId === 'free' && capabilityId === 'catalog_product_image.upload') return { allowed: false, source: 'server', reason: 'free_not_eligible' };
      return s.capabilities.includes(capabilityId)
        ? { allowed: true, source: 'server', reason: 'granted' }
        : { allowed: false, source: 'server', reason: 'not_included' };
    }
    return legacyAllowed === true
      ? { allowed: true, source: 'legacy', reason: 'not_enforced' }
      : { allowed: false, source: 'legacy', reason: 'legacy_not_included' };
  }
  if (state === 'unprovisioned' || state === 'invalid') return { allowed: false, source: 'fail_closed', reason: state };
  return legacyAllowed === true
    ? { allowed: true, source: 'legacy', reason: state }
    : { allowed: false, source: 'legacy', reason: 'legacy_not_included' };
}

// Output phase as the client should use it to pick the legacy or the authorized path. The server is the authority either
// way (DB trigger + get-public-quote + authority function); this only chooses which request to make.
export function outputPhaseOf(summary: AccountSummary | null | undefined): ActivationPhase {
  return summary?.state === 'ready' ? (summary as ReadySummary).phase.output : 'off';
}

// ---------------------------------------------------------------------------------------------------------------------
// Task 27 (Owner decision 2026-10-11, §253): after Free-10 is exhausted, an attempted PAID action opens a dismissible upgrade window;
// permitted actions (viewing quotes, editing an existing draft, re-sending an already-output quote, clients, tasks, ...) stay available.
// Paid actions = the canonical contract: a FIRST client output of a quote (OD-02, enforced by the server ledger) and - by the Owner's
// 2026-10-11 decision - creating a NEW quote (new / duplicate / AI / measured / from template), checked BEFORE any insert.
// Enforced only when the server says so: summary ready + output phase 'enforced' + plan 'free' + remaining 0 or the 7 free days ended (Owner 2026-10-20). Off / prepared / shadow /
// not deployed / loading never add a restriction (no new restriction on existing accounts while activation is off). A paid plan
// (current or legacy) is never blocked. The server is the authority (quotes INSERT trigger + output ledger); this only decides the UI.
// ---------------------------------------------------------------------------------------------------------------------
export interface QuotaDecision { allowed: boolean; reason: 'not_enforced' | 'paid_plan' | 'within_free10' | 'free_issue_limit_reached' | 'free_period_ended' | 'subscription_limited' | 'fail_closed'; free10?: ReadySummary['free10'] }

export function decideFree10Action(summary: AccountSummary | null | undefined): QuotaDecision {
  if (summary?.state !== 'ready') return { allowed: true, reason: 'not_enforced' };
  const s = summary as ReadySummary;
  if (s.phase.output !== 'enforced') return { allowed: true, reason: 'not_enforced' };
  // 20261021200000 (Owner 2026-10-18): a paid account whose 3 grace days after a failed charge are over is limited like the Free end
  if (s.planId !== 'free') return s.billing?.limited ? { allowed: false, reason: 'subscription_limited' } : { allowed: true, reason: 'paid_plan' };
  if (!s.free10) return { allowed: false, reason: 'fail_closed' };
  // Owner 2026-10-20: the 7 free days ended before the 10 quotes were used (10 used names the 10, as the window does)
  if (s.free10.periodEnded && s.free10.remaining > 0) return { allowed: false, reason: 'free_period_ended', free10: s.free10 };
  return s.free10.remaining > 0
    ? { allowed: true, reason: 'within_free10', free10: s.free10 }
    : { allowed: false, reason: 'free_issue_limit_reached', free10: s.free10 };
}
