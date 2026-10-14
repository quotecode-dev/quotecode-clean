// LEGACY AUDIT HISTORY - NOT CURRENT PRODUCT TRUTH.
//
// Subscriptions cutover (OD-01..OD-20, 2026-10-07): the current Product Truth registry no longer carries the pre-cutover
// plan gates (the legacy free/basic/pro tiers, the trial and the monthly quote limits). The committed historical evidence
// under evidence/product-truth/ was, however, CAPTURED from the deployed chat-ai v39 runtime while those gates were in force,
// and the acceptance validators must keep judging each historical row against the rules that were in force at capture time
// (rewriting history to the new truth would make every historical row "fail" for a reason that did not exist then).
//
// This file is the ONE frozen snapshot of those historical rules. It is read ONLY by the historical-evidence validators
// (productTruthCapabilityPolarity.js / productTruthFactPayload.js / productTruthEvidenceSchema.js when they are asked for the
// `legacy_v39` ruleset). It is never imported by chat-ai, never projected into AI_FACTS, never rendered to a user.
// Do not edit these values: they describe the past, not the product.
import { getCapabilityById, PRODUCT_TRUTH_REGISTRY, NON_CURRENT_REGISTRY } from './productTruthRegistry.js';

export const LEGACY_RULESET_ID = 'legacy_v39';
export const CURRENT_RULESET_ID = 'current';
export const RULESETS = Object.freeze([CURRENT_RULESET_ID, LEGACY_RULESET_ID]);

// The historical tier order (lowest -> highest) of the pre-cutover model.
export const LEGACY_PLAN_IDS = Object.freeze(['free', 'basic', 'pro']);

// The historical minimum tier per plan-gated capability (as the registry declared it at revision
// 2c584f6d910b130bd446183b41e94bda35a5900f, the revision the v39 evidence was validated against).
export const LEGACY_MINIMUM_PLAN = Object.freeze({
  quote_edit: 'basic',
  quote_duplicate: 'basic',
  measured_quote: 'basic',
  professional_reuse: 'pro',
  attachments: 'pro',
  owner_whatsapp_share: 'pro',
});

// The historical labels of the one entry whose CONTENT changed meaning at the cutover (plan_trial).
const LEGACY_LABELS = Object.freeze({
  plan_trial: Object.freeze({ heLabel: 'ניסיון חינם', enLabel: '14-day free trial' }),
});

/** A capability as the historical (v39) rules described it. Returns null for an unknown id. */
export function getHistoricalCapabilityById(id) {
  const c = getCapabilityById(id);
  if (!c) return null;
  const minimumPlan = LEGACY_MINIMUM_PLAN[id] ?? null;
  return Object.freeze({
    ...c,
    ...(LEGACY_LABELS[id] || {}),
    minimumPlan,
    authorityType: minimumPlan ? 'plan' : c.authorityType === 'role' ? 'role' : 'none',
  });
}

/** Capability lookup for a ruleset: 'current' -> the live registry, 'legacy_v39' -> the frozen historical view. */
export function capabilityForRuleset(id, ruleset = CURRENT_RULESET_ID) {
  return ruleset === LEGACY_RULESET_ID ? getHistoricalCapabilityById(id) : getCapabilityById(id);
}

/** Every capability label (for "other capability" detection) under a ruleset. */
export function labelsForRuleset(ruleset = CURRENT_RULESET_ID) {
  const all = [...PRODUCT_TRUTH_REGISTRY, ...NON_CURRENT_REGISTRY];
  return ruleset === LEGACY_RULESET_ID ? all.map((c) => ({ ...c, ...(LEGACY_LABELS[c.id] || {}) })) : all;
}
