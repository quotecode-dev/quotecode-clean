// PRODUCT TRUTH FOUR-FINDING REMEDIATION - Finding 3 (Codex "PRODUCT TRUTH FINAL THREE-ACTION DELTA REVIEW: FAIL"):
// "for ordinary Owner and Plan/Role capability answers the semantic gate checks whether the canonical capability label
// appears in the response - a false statement such as 'In-editor calculator does not exist in TEKANGO' passes merely
// because it contains the expected capability label." That is a semantic POLARITY failure: label presence proves
// nothing about whether the answer says the capability exists, does not exist, is plan-gated, is role-gated, ...
//
// THE FIX compares TWO structured objects, never a label string:
//   (1) EXPECTED TRUTH  - deriveExpectedCapabilityTruth(): derived ONLY from independent authorities:
//         the canonical Product Truth registry (state, market, minimumPlan / requiredRole), the structured
//         AI_FACTS.billing / AI_FACTS.invoicing flags (for the payment / invoicing sentinels), and the persona's
//         SERVER-VERIFIED plan / role (deriveRegistryEntitlement). It never reads the response or the evidence row.
//   (2) CLAIMS MADE     - analyzeCapabilityProse(): a sentence-scoped extraction of what the response actually asserts
//         (existence affirmed / denied, account lacks / has it, which plan tier or role gate it states, universal
//         "available to everyone" claims, clarification), with account-directed negation ("Your current plan does not
//         include it") kept distinct from existence-directed negation ("... does not exist").
// checkCapabilityPolarity() then requires the claims to be consistent with the truth kind:
//   AVAILABLE / PLAN_LOCKED / ROLE_LOCKED / NOT_AVAILABLE (roadmap, unavailable, market) / PAYMENT_NOT_LIVE /
//   INVOICING_NOT_ISSUED / COMPARISON_BOTH_AVAILABLE / CLARIFICATION.
// Why claims are extracted from prose at all: the chat-ai response envelope carries no structured answer state
// (`factPayload` is null for capability answers), so the deployed answer's polarity can only be read from its text.
// The extractor is therefore validated (productTruthCapabilityPolarity.test.js) against the REAL runtime formatter
// outputs for every registry capability x plan tier x role x language, plus adversarial contradictions and natural
// paraphrases in EN and HE. The runtime is NOT changed.
import { getCapabilityById, PRODUCT_TRUTH_REGISTRY, NON_CURRENT_REGISTRY } from './productTruthRegistry.js';
import { PLAN_IDS } from '../utils/planCatalog.js';
import { AI_FACTS } from '../../supabase/functions/chat-ai/aiFacts.generated.ts';

export const TRUTH_KINDS = Object.freeze({
  AVAILABLE: 'AVAILABLE', // exists / supported for this account (gated-but-entitled counts)
  PLAN_LOCKED: 'PLAN_LOCKED', // exists, plan-gated, this account's plan is below the minimum
  ROLE_LOCKED: 'ROLE_LOCKED', // exists, role-gated, this account does not hold the role
  NOT_AVAILABLE: 'NOT_AVAILABLE', // roadmap / unavailable / deprecated / not released - not supported today
  MARKET_UNAVAILABLE: 'MARKET_UNAVAILABLE', // live, but not in this account's market
  PAYMENT_NOT_LIVE: 'PAYMENT_NOT_LIVE',
  INVOICING_NOT_ISSUED: 'INVOICING_NOT_ISSUED',
  COMPARISON_BOTH_AVAILABLE: 'COMPARISON_BOTH_AVAILABLE', // PDF and Print are two distinct, real capabilities
  CLARIFICATION: 'CLARIFICATION', // cannot infer the capability - must ask, must not assert
});

/**
 * Entitlement the CANONICAL registry rule yields for a capability given a persona's SERVER-VERIFIED plan/role.
 * (canonical_registry authority applied to a server_verified_fact - it reads neither the evidence row's own
 * expectedEntitlement nor the chat-ai response.)
 * @returns {'GRANTED'|'DENIED'|'UNKNOWN'}
 */
export function deriveRegistryEntitlement(capabilityId, serverPlan, serverRole) {
  const capability = getCapabilityById(capabilityId);
  if (!capability) return 'UNKNOWN';
  if (capability.authorityType === 'role') {
    if (!isNonEmpty(serverRole) || !isNonEmpty(capability.requiredRole)) return 'UNKNOWN';
    return serverRole === capability.requiredRole ? 'GRANTED' : 'DENIED';
  }
  if (capability.authorityType === 'plan') {
    const have = PLAN_IDS.indexOf(serverPlan);
    const need = PLAN_IDS.indexOf(capability.minimumPlan);
    if (have < 0 || need < 0) return 'UNKNOWN';
    return have >= need ? 'GRANTED' : 'DENIED';
  }
  return 'GRANTED';
}

function isNonEmpty(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

const MARKET_KEY = Object.freeze({ Local: 'local', International: 'international' });

/**
 * EXPECTED TRUTH from independent authorities only (see the file header).
 * @param {{ expectedResult: string, serverPlan?: string, serverRole?: string, market?: string }} input
 * @returns {{ kind: string, capabilityId?: string, gate?: 'plan'|'role'|null, minimumPlan?: string|null, requiredRole?: string|null, authority: string } | { kind: 'UNDERIVABLE', reason: string }}
 */
export function deriveExpectedCapabilityTruth({ expectedResult, serverPlan, serverRole, market }) {
  if (expectedResult === 'clarification') return { kind: TRUTH_KINDS.CLARIFICATION, authority: 'fixed acceptance expectation' };
  if (expectedResult === 'payment_truth_sentinel') {
    return AI_FACTS.billing.paymentProcessingAvailable === false && AI_FACTS.billing.liveCheckoutAvailable === false
      ? { kind: TRUTH_KINDS.PAYMENT_NOT_LIVE, authority: 'AI_FACTS.billing (paymentProcessingAvailable=false, liveCheckoutAvailable=false)' }
      : { kind: 'UNDERIVABLE', reason: 'AI_FACTS.billing says payment/checkout is live - the payment_truth_sentinel expectation no longer holds' };
  }
  if (expectedResult === 'invoicing_truth_sentinel') {
    return AI_FACTS.invoicing.invoiceIssuanceAvailable === false && AI_FACTS.invoicing.receiptIssuanceAvailable === false
      ? { kind: TRUTH_KINDS.INVOICING_NOT_ISSUED, authority: 'AI_FACTS.invoicing (invoiceIssuanceAvailable=false, receiptIssuanceAvailable=false)' }
      : { kind: 'UNDERIVABLE', reason: 'AI_FACTS.invoicing says invoices are issued - the invoicing_truth_sentinel expectation no longer holds' };
  }
  if (expectedResult === 'quote_pdf_vs_print_comparison') {
    const both = ['quote_pdf', 'quote_print'].every((id) => getCapabilityById(id)?.state === 'LIVE_CURRENT');
    return both
      ? { kind: TRUTH_KINDS.COMPARISON_BOTH_AVAILABLE, authority: 'canonical registry (quote_pdf and quote_print both LIVE_CURRENT)' }
      : { kind: 'UNDERIVABLE', reason: 'quote_pdf / quote_print are not both LIVE_CURRENT in the registry' };
  }
  const capability = getCapabilityById(expectedResult);
  if (!capability) return { kind: 'UNDERIVABLE', reason: `not a registry capability id: ${expectedResult}` };
  const base = { capabilityId: capability.id, authority: 'canonical registry + server-verified facts' };
  if (capability.state !== 'LIVE_CURRENT') {
    return ['ROADMAP_POST_LIVE', 'UNAVAILABLE', 'DEPRECATED', 'IMPLEMENTED_NOT_RELEASED'].includes(capability.state)
      ? { ...base, kind: TRUTH_KINDS.NOT_AVAILABLE, gate: null }
      : { kind: 'UNDERIVABLE', reason: `registry state ${capability.state} has no acceptance truth kind` };
  }
  const marketKey = MARKET_KEY[market];
  if (marketKey && Array.isArray(capability.markets) && !capability.markets.includes(marketKey)) return { ...base, kind: TRUTH_KINDS.MARKET_UNAVAILABLE, gate: null };
  if (capability.authorityType === 'role') {
    const e = deriveRegistryEntitlement(capability.id, serverPlan, serverRole);
    if (e === 'UNKNOWN') return { kind: 'UNDERIVABLE', reason: 'role entitlement underivable (no server-verified role)' };
    return { ...base, kind: e === 'GRANTED' ? TRUTH_KINDS.AVAILABLE : TRUTH_KINDS.ROLE_LOCKED, gate: 'role', requiredRole: capability.requiredRole, minimumPlan: null };
  }
  if (capability.authorityType === 'plan') {
    const e = deriveRegistryEntitlement(capability.id, serverPlan, serverRole);
    if (e === 'UNKNOWN') return { kind: 'UNDERIVABLE', reason: 'plan entitlement underivable (no server-verified plan)' };
    return { ...base, kind: e === 'GRANTED' ? TRUTH_KINDS.AVAILABLE : TRUTH_KINDS.PLAN_LOCKED, gate: 'plan', minimumPlan: capability.minimumPlan, requiredRole: null };
  }
  return { ...base, kind: TRUTH_KINDS.AVAILABLE, gate: null, minimumPlan: null, requiredRole: null };
}

// ---------------------------------------------------------------------------------------------------------------------
// PROSE -> CLAIMS
const NEG_BEFORE_EN = /\b(?:no|not|never|without|cannot|can['’]t|isn['’]t|doesn['’]t|don['’]t|won['’]t|n['’]t)\b/i;
const NEG_BEFORE_HE = /(?:^|\s)(?:אין|לא|אינ\S*|בלי)(?:\s|$)/;

const PATTERNS = Object.freeze({
  en: {
    // account-directed: the sentence is about THIS ACCOUNT / PLAN / ROLE lacking or having it, not about the capability existing.
    accountLacks: [
      /\b(?:your|the)\s+(?:current\s+)?(?:plan|account|role|tier)\b[^.!?]{0,50}?\b(?:does(?:\s+not|n['’]t)|do(?:es)?\s+not|is\s+not|isn['’]t|lacks?|has\s+no)\b/i,
      /\bnot\s+(?:included|available|enabled)\s+(?:in|on|for|to|under)\s+your\b/i,
      /\byou\s+(?:do\s+not|don['’]t)\s+(?:currently\s+)?(?:have|hold|get)\b/i,
      /\byou\s+(?:cannot|can['’]t|can\s+not|are\s+not\s+able\s+to)\s+(?:use|access|attach|share|reuse|open|create)\b/i,
    ],
    accountHas: [
      /\byour\s+(?:current\s+)?(?:plan|account|role|tier)\s+(?:includes|has|holds|covers|is\s+verified)\b/i,
      /\byour\s+role\s+is\s+verified\b/i,
      /\byou\s+(?:already\s+)?(?:have|hold)\s+(?:access|it|this)\b/i,
    ],
    planTier: [
      /\b(?:requires?|required|needs?)\s+(?:the\s+)?(FREE|BASIC|PRO)\b/gi,
      /\bfrom\s+the\s+(BASIC|PRO)\s+plan\b/gi,
      /\b(BASIC|PRO)\s+plan\s+or\s+(?:above|higher)\b/gi,
      /\bonly\s+(?:available\s+)?(?:on|in|with|for)\s+(?:the\s+)?(BASIC|PRO)\b/gi,
      /\bavailable\s+(?:on|in|with|from)\s+(?:the\s+)?(BASIC|PRO)\s+plan\b/gi,
    ],
    roleGate: [
      /\brestricted\s+to\b[^.!?]{0,70}?\brole\b/i,
      /\b(?:super_admin|super\s+admin|admin)\s+(?:role|permission)\b/i,
      /\brequires?\b[^.!?]{0,30}\b(?:super_admin|admin)\b/i,
    ],
    universal: [
      /\b(?:all|every|any)\s+(?:users?|plans?|accounts?|customers?|tiers?)\b/i,
      /\beveryone\b/i,
      /\bregardless\s+of\s+(?:your\s+)?(?:plan|role|tier|account)\b/i,
      /\bavailable\s+(?:to|for)\s+(?:all|everyone|any)\b/i,
      /\bno\s+(?:plan|role)\s+(?:is\s+)?(?:required|needed)\b/i,
      /\bwithout\s+(?:any\s+)?(?:plan|role)\s+(?:restriction|requirement)s?\b/i,
      /\bon\s+(?:all|every)\s+plans?\b/i,
    ],
    denyExistence: [
      /\b(?:does(?:\s+not|n['’]t)|do(?:es)?\s+not|don['’]t)\s+(?:currently\s+)?(?:actually\s+)?(?:exist|have|offer|support|provide|include|feature|contain)\b/i,
      /\b(?:is|are)\s+not\s+(?:currently\s+|yet\s+|really\s+)?(?:available|supported|live|offered|present|possible|active|part\s+of)\b/i,
      /\bisn['’]t\s+(?:currently\s+)?(?:available|supported|live|offered|present|possible|active)\b/i,
      /\b(?:there\s+(?:is|are)\s+no|there['’]s\s+no|no\s+such)\b/i,
      /\bnon-?existent\b|\bunavailable\b/i,
    ],
    // weaker denial cues: counted only in a sentence that NAMES the capability (a description sentence such as
    // "An expired quote stays viewable but cannot be signed" is not a claim about the capability's existence)
    denyExistenceNamed: [/\b(?:cannot|can['’]t|can\s+not|unable\s+to)\b/i],
    // an AGENT that plainly cannot / does not do it ("the assistant cannot make changes", "TEKANGO doesn't have a calculator")
    denyExistenceAgent: [/\b(?:I|we|the\s+assistant|the\s+ai|tekango|the\s+system|the\s+app|the\s+editor)\s+(?:cannot|can['’]t|can\s+not|(?:am|are|is)\s+(?:not\s+)?unable\s+to|do(?:es)?\s+not|don['’]t|doesn['’]t)\s+(?:currently\s+)?\w+/i],
    affirmExistence: [
      /\bexists?\b/i,
      /\b(?:is|are)\s+(?:currently\s+)?(?:available|supported|live|active|included|built[- ]in(?:to)?)\b/i,
      /\b(?:supports?|supported|offers?|offered|provides?|provided|includes?|included|has\s+(?:a|an|the)|have\s+(?:a|an|the)|comes\s+with)\b/i,
      /\byou\s+can\b/i,
      /^\s*yes\b/i,
    ],
    clarification: [/\bwhich\s+specific\b/i, /\bname\s+the\s+specific\b/i, /\bwhat\s+(?:specific|exactly)\b/i],
  },
  he: {
    accountLacks: [
      /(?:התוכנית|החשבון|ההרשאה|התפקיד)(?:\s+הנוכח\S*)?\s+שלך\s+(?:אינ[הו]|לא)\s+\S+/,
      /(?:אינ[הו]|לא)\s+כלול[הת]?\s+ב(?:תוכנית|חשבון)\s+שלך/,
      /(?:אין\s+לך|לא\s+ניתן\s+לך)\s+(?:גישה|הרשאה)/,
      /(?:אינ[הו]|לא)\s+(?:זמינ[הו]|זמין)\s+(?:ב|ל)(?:תוכנית|חשבון)\s+(?:הנוכח\S*\s+)?שלך/,
    ],
    accountHas: [
      /(?:התוכנית|החשבון)(?:\s+הנוכח\S*)?\s+שלך\s+(?:כולל[תה]|מכסה)/,
      /ההרשאה\s+שלך\s+מאומת[תה]?/,
      /יש\s+לך\s+(?:גישה|הרשאה)/,
    ],
    planTier: [
      /(?:דורשת|דורש|נדרשת|נדרש)\s+תוכנית\s+(FREE|BASIC|PRO)/gi,
      /החל\s+מתוכנית\s+(BASIC|PRO)/gi,
      /תוכנית\s+(BASIC|PRO)\s+ומעלה/gi,
      /רק\s+ב(?:תוכנית\s+)?(BASIC|PRO)/gi,
      /(?:זמינ[הו]|זמין)\s+(?:רק\s+)?ב(?:תוכנית\s+)?(BASIC|PRO)/gi,
    ],
    roleGate: [
      /מוגבלת\s+ל(?:הרשאת|תפקיד)/,
      /הרשאת\s+(?:super_admin|admin)/i,
      /תפקיד\s+(?:Super\s+Admin|super_admin|admin)/i,
      /(?:דורשת|נדרשת)[^.!?]{0,30}(?:super_admin|admin)/i,
    ],
    universal: [
      /(?:לכל|כל)\s+(?:המשתמשים|התוכניות|החשבונות|הלקוחות|משתמש)/,
      /(?:^|\s)לכולם(?:\s|$|[.,])/,
      /ללא\s+(?:צורך\s+ב|הגבלה|תלות\s+ב)(?:תוכנית|הרשאה|תפקיד)?/,
      /בכל\s+(?:תוכנית|חשבון)/,
      /ללא\s+קשר\s+ל(?:תוכנית|תפקיד)/,
    ],
    denyExistence: [
      // Hebrew masculine-singular forms end in FINAL letters (קיים, זמין, נתמך) - a plain מ/נ/כ stem would miss them
      /(?:אינ(?:ה|ו|ם|ן)?|לא)\s+(?:קיי[םמ](?:ת|ים|ות)?|זמינ(?:ה|ים|ות)?|זמין|נתמכ(?:ת|ים|ות)?|נתמך|פעיל(?:ה|ים|ות)?|מוצע(?:ת|ים)?)/,
      /(?:^|[\s,;-])אין(?!\s+לך)(?:\s|$)/,
    ],
    // weaker cues, counted only in a sentence that NAMES the capability (Hebrew has no \b: Hebrew letters are not \w)
    denyExistenceAgent: [/(?:העוזר|המערכת|האפליקציה|העורך|TEKANGO|ה-?AI)\s+(?:לא|אינ(?:ה|ו)?)\s+\S+/],
    denyExistenceNamed: [/(?:^|\s)(?:לא|אי)\s*אפשר(?:\s|$|[.,])/, /(?:^|\s)לא\s+ניתן(?:\s|$)/, /(?:^|\s)אי-אפשר(?:\s|$)/, /(?:^|\s)בלי\s+/],
    affirmExistence: [
      /קיי[םמ](?:ת|ים|ות)?/,
      /זמינ(?:ה|ים|ות)?|זמין/,
      /נתמכ(?:ת|ים|ות)?|נתמך/,
      /פעיל(?:ה|ים|ות)?/,
      /(?:^|[\s-])כן(?:[\s.,-]|$)/,
      /(?:אפשר|ניתן)\s+ל/,
    ],
    clarification: [/איזו\s+יכולת\s+ספציפית/, /איזה\s+(?:פיצ'ר|פיצר|יכולת)\s+(?:ספציפי|בדיוק)/],
  },
});

function splitSentences(text) {
  return String(text ?? '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const anyMatch = (patterns, s) => patterns.some((p) => { p.lastIndex = 0; return p.test(s); });

/** Existence-directed negation: a negation pattern hit that is NOT directed at the account/plan/role ("Your current plan does not include it"). */
function existenceDenied(sentence, lang, named) {
  const P = PATTERNS[lang];
  for (const re of [...P.denyExistence, ...P.denyExistenceAgent, ...(named ? P.denyExistenceNamed : [])]) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = g.exec(sentence))) {
      const before = sentence.slice(Math.max(0, m.index - 60), m.index);
      const after = sentence.slice(m.index, m.index + m[0].length + 40);
      // account-directed: the negation's subject is your plan/account/role, or it is "... not available on/for your plan"
      const accountSubject = lang === 'en'
        ? /\b(?:your|the)\s+(?:current\s+)?(?:plan|account|role|tier)\b[^.!?]*$/i.test(before) || /\b(?:you|your)\b/i.test(before.slice(-25)) && /^(?:cannot|can['’]t|can\s+not|unable|do\s+not|don['’]t)/i.test(m[0])
        : /(?:התוכנית|החשבון|ההרשאה|התפקיד)(?:\s+הנוכח\S*)?\s+שלך[^.!?]*$/.test(before);
      const availableToYou = lang === 'en' ? /\b(?:on|in|for|to|under)\s+(?:your|the\s+current)\b/i.test(after) : /(?:ב|ל)(?:תוכנית|חשבון)\s+(?:הנוכח\S*\s+)?שלך/.test(after);
      if (!accountSubject && !availableToYou) return true;
    }
  }
  return false;
}

/** An existence-affirming cue that is not itself under a negation ("does not include" is not an affirmation). */
function affirmsUnnegated(sentence, lang) {
  const neg = lang === 'en' ? NEG_BEFORE_EN : NEG_BEFORE_HE;
  for (const re of PATTERNS[lang].affirmExistence) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = g.exec(sentence))) {
      const clauseBefore = sentence.slice(Math.max(0, m.index - 35), m.index).split(/[,;:]/).pop() ?? '';
      if (!neg.test(clauseBefore)) return true;
    }
  }
  return false;
}

/**
 * Extracts what the response CLAIMS about a capability, sentence by sentence.
 * @param {string} response
 * @param {'he'|'en'} language
 * @param {{ labels: string[], otherLabels?: string[] }} focus - the capability's own canonical label(s) and every OTHER capability's label
 */
export function analyzeCapabilityProse(response, language, focus = { labels: [], otherLabels: [] }) {
  const P = PATTERNS[language];
  const sentences = splitSentences(response).map((text) => {
    const lower = text.toLowerCase();
    const mentionsFocus = focus.labels.some((l) => lower.includes(l.toLowerCase()));
    const mentionsOther = (focus.otherLabels || []).some((l) => lower.includes(l.toLowerCase()));
    const denied = existenceDenied(text, language, mentionsFocus);
    const acctLacks = anyMatch(P.accountLacks, text);
    const acctHas = anyMatch(P.accountHas, text);
    // ("Your current plan does not include it" is account-directed AND its 'include' is negated, so it is not an affirmation)
    const affirmed = !denied && affirmsUnnegated(text, language);
    const relevant = mentionsFocus || (!mentionsOther && (denied || affirmed));
    const tiers = [];
    for (const re of P.planTier) {
      const g = new RegExp(re.source, re.flags);
      let m;
      while ((m = g.exec(text))) tiers.push(m[1].toLowerCase());
    }
    return {
      text, relevant, mentionsFocus, denied, affirmed,
      accountLacks: acctLacks,
      accountHas: acctHas,
      tiers,
      roleGate: anyMatch(P.roleGate, text),
      universal: anyMatch(P.universal, text),
    };
  });
  const rel = sentences.filter((s) => s.relevant);
  return {
    sentences,
    existenceDenied: rel.some((s) => s.denied),
    existenceAffirmed: rel.some((s) => s.affirmed),
    accountLacks: sentences.some((s) => s.accountLacks),
    accountHas: sentences.some((s) => s.accountHas),
    statedPlanTiers: [...new Set(sentences.flatMap((s) => s.tiers))],
    roleGateStated: sentences.some((s) => s.roleGate),
    universal: sentences.some((s) => s.universal),
    clarification: anyMatch(P.clarification, String(response ?? '')),
  };
}

// --- payment / invoicing / comparison analyzers (whole-response, negation-aware) -----------------------------------------
const NOT_LIVE = Object.freeze({
  PAYMENT_NOT_LIVE: {
    en: {
      denies: [/\b(?:no|not|never|n['’]t)\b[^.!?]{0,60}?\b(?:checkout|payments?|paying|processing)\b/i, /\b(?:checkout|payments?)\b[^.!?]{0,60}?\b(?:not|no)\b[^.!?]{0,25}?\b(?:live|available|active|supported)\b/i],
      claims: [
        /\b(?:accepts?|takes?|supports?|offers?|processes?|enables?)\s+(?:online\s+)?(?:credit\s+)?(?:card\s+)?(?:payments?|cards?|checkout)\b/i,
        /\bcheckout\s+(?:is|are)\s+(?:now\s+)?(?:live|available|active|enabled|open)\b/i,
        /\b(?:you|users?|customers?)\s+can\s+(?:now\s+)?(?:pay|check\s*out|be\s+charged)\b/i,
        /\bpayments?\s+(?:is|are)\s+(?:now\s+)?(?:live|available|active|enabled)\b/i,
        /\byes\b[^.!?]{0,20}\b(?:can|does|do)\s+(?:take|accept|charge)\b/i,
      ],
    },
    he: {
      denies: [/(?:אין|לא|אינ\S*)[^.!?]{0,60}?(?:סליקה|תשלום|תשלומים|חיוב)/],
      claims: [
        /(?:הסליקה|התשלום|התשלומים|הצ'קאאוט)\s+(?:פעיל[הים]*|זמינ[הים]*|זמין|מופעל[תים]*)/,
        /(?:אפשר|ניתן)\s+לשלם/,
        /(?:TEKANGO|המערכת)\s+(?:גובה|מקבלת|מעבדת|תומכת\s+ב)\s+(?:\S+\s+)?(?:כרטיס|כרטיסי|תשלום|תשלומים)/,
      ],
    },
  },
  INVOICING_NOT_ISSUED: {
    en: {
      denies: [/\b(?:does\s+not|doesn['’]t|do\s+not|don['’]t|no|not|cannot)\b[^.!?]{0,40}?\b(?:issue|generate|produce|provide)\b[^.!?]{0,30}?\b(?:invoices?|receipts?)\b/i, /\b(?:invoices?|receipts?)\b[^.!?]{0,40}?\b(?:not|no)\b[^.!?]{0,20}?\b(?:live|available|issued)\b/i],
      claims: [
        /\b(?:issues?|generates?|produces?|creates?|provides?)\s+(?:tax\s+)?(?:invoices?|receipts?)\b/i,
        /\bquote\s+PDF\s+(?:is|counts\s+as|serves\s+as)\s+(?:actually\s+)?(?:an?\s+)?(?:tax\s+)?invoice\b/i,
        /\bPDF\b[^.!?]{0,30}\bis\s+(?:actually\s+)?an?\s+invoice\b/i,
      ],
    },
    he: {
      denies: [/(?:לא|אינ\S*|אין)\s+(?:\S+\s+){0,2}(?:מפיק\S*|מנפיק\S*|הפקת)\s*(?:חשבונית|חשבוניות|קבלה|קבלות)/],
      claims: [
        /(?:מפיק(?:ה|ים)|מנפיק\S*)\s+חשבונ/,
        /ה-?PDF\s+(?:הוא|היא)\s+(?:למעשה\s+)?חשבונית/,
      ],
    },
  },
});

function unnegatedMatches(text, patterns, lang) {
  const neg = lang === 'en' ? NEG_BEFORE_EN : NEG_BEFORE_HE;
  const hits = [];
  for (const re of patterns) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = g.exec(text))) {
      const before = text.slice(Math.max(0, m.index - 70), m.index);
      const clauseBefore = before.split(/[.!?]/).pop() ?? '';
      if (!neg.test(clauseBefore)) hits.push(m[0]);
    }
  }
  return hits;
}

const COMPARISON = Object.freeze({
  en: {
    deniesEither: [
      /\b(?:no|without)\s+(?:a\s+|any\s+)?print(?:ing)?\s+(?:option|feature|button|support|capability|available)\b/i,
      /\bthere\s+(?:is|are|['’]s)\s+no\s+print/i,
      /\bprint(?:ing)?\s+(?:is|are)\s+not\s+(?:available|supported|possible)\b/i,
      /\bprint(?:ing)?\s+(?:does\s+not|doesn['’]t)\s+exist\b/i,
      /\bonly\s+(?:a\s+)?PDF\b/i,
      /\bno\s+PDF\b|\bPDF\s+(?:is|are)\s+not\s+(?:available|supported)\b/i,
      /\b(?:are|is)\s+the\s+same\s+(?:thing|action|feature)\b/i,
    ],
    mentionsBoth: [/\bPDF\b/, /\bprint(?:ing)?\b/i],
    distinguishes: /\b(?:two\s+(?:different|separate|distinct)|different|distinct|separate)\b/i,
  },
  he: {
    deniesEither: [/(?:^|\s)אין\s+(?:אפשרות\s+)?הדפסה/, /הדפסה\s+(?:אינה|לא)\s+(?:קיימת|קיים|זמינה|זמין|נתמכת|נתמך)/, /(?:^|\s)רק\s+PDF/, /(?:^|\s)אין\s+PDF/, /(?:אותו|אותה)\s+(?:דבר|פעולה)/],
    mentionsBoth: [/PDF/, /הדפס/],
    distinguishes: /(?:שתי\s+פעולות\s+שונות|שונ(?:ות|ה|ים)|נפרד)/,
  },
});

/**
 * POLARITY VERDICT: are the claims the response makes consistent with the expected truth?
 * @param {ReturnType<typeof deriveExpectedCapabilityTruth>} truth
 * @param {string} response
 * @param {'he'|'en'} language
 * @returns {string[]} violations (empty = the response's polarity matches the truth)
 */
export function checkCapabilityPolarity(truth, response, language) {
  const v = [];
  if (!truth || truth.kind === 'UNDERIVABLE') return [`expected_truth_underivable:${truth?.reason ?? 'no truth'}`];
  const text = String(response ?? '');
  if (!text.trim()) return ['empty_response'];

  if (truth.kind === TRUTH_KINDS.CLARIFICATION) {
    const c = analyzeCapabilityProse(text, language);
    if (!c.clarification) v.push('clarification_expected_but_response_does_not_ask');
    if (c.existenceAffirmed || c.existenceDenied) v.push('clarification_expected_but_response_asserts_a_capability_claim');
    return v;
  }
  if (truth.kind === TRUTH_KINDS.PAYMENT_NOT_LIVE || truth.kind === TRUTH_KINDS.INVOICING_NOT_ISSUED) {
    const spec = NOT_LIVE[truth.kind][language];
    if (!spec.denies.some((p) => p.test(text))) v.push(`${truth.kind}:response_does_not_state_it_is_not_live`);
    const claims = unnegatedMatches(text, spec.claims, language);
    if (claims.length) v.push(`${truth.kind}:false_positive_claim:${claims[0]}`);
    return v;
  }
  if (truth.kind === TRUTH_KINDS.COMPARISON_BOTH_AVAILABLE) {
    const spec = COMPARISON[language];
    for (const p of spec.mentionsBoth) if (!p.test(text)) v.push(`comparison:does_not_mention_both_capabilities:${p}`);
    for (const p of spec.deniesEither) if (p.test(text)) v.push(`comparison:denies_or_conflates_a_capability:${p}`);
    if (!spec.distinguishes.test(text)) v.push('comparison:does_not_distinguish_the_two');
    return v;
  }

  const registry = getCapabilityById(truth.capabilityId);
  const labels = registry ? [language === 'he' ? registry.heLabel : registry.enLabel] : [];
  const otherLabels = [...PRODUCT_TRUTH_REGISTRY, ...NON_CURRENT_REGISTRY].filter((c) => c.id !== truth.capabilityId).map((c) => (language === 'he' ? c.heLabel : c.enLabel)).filter(Boolean);
  const c = analyzeCapabilityProse(text, language, { labels, otherLabels });
  const wrongTier = () => c.statedPlanTiers.filter((t) => t !== truth.minimumPlan);

  switch (truth.kind) {
    case TRUTH_KINDS.AVAILABLE:
      if (c.existenceDenied) v.push('available_expected_but_response_denies_existence');
      if (!c.existenceAffirmed) v.push('available_expected_but_response_does_not_affirm_existence');
      if (c.accountLacks) v.push('available_expected_but_response_says_the_account_lacks_it');
      if (truth.gate === 'plan' && wrongTier().length) v.push(`wrong_plan_tier_stated:${wrongTier().join(',')} (canonical minimum ${truth.minimumPlan})`);
      if (truth.gate === null && c.statedPlanTiers.length) v.push(`plan_gate_claimed_on_ungated_capability:${c.statedPlanTiers.join(',')}`);
      break;
    case TRUTH_KINDS.PLAN_LOCKED:
      if (c.existenceDenied) v.push('plan_locked_expected_but_response_denies_existence');
      if (!c.existenceAffirmed) v.push('plan_locked_expected_but_response_does_not_say_it_exists');
      if (c.universal) v.push('plan_locked_expected_but_response_claims_universal_availability');
      if (c.accountHas) v.push('plan_locked_expected_but_response_says_the_account_has_it');
      if (!c.accountLacks) v.push('plan_locked_expected_but_response_does_not_say_the_account_lacks_it');
      if (!c.statedPlanTiers.includes(truth.minimumPlan)) v.push(`plan_gate_not_disclosed:${truth.minimumPlan}`);
      if (wrongTier().length) v.push(`wrong_plan_tier_stated:${wrongTier().join(',')} (canonical minimum ${truth.minimumPlan})`);
      break;
    case TRUTH_KINDS.ROLE_LOCKED:
      if (c.existenceDenied) v.push('role_locked_expected_but_response_denies_existence');
      if (!c.existenceAffirmed) v.push('role_locked_expected_but_response_does_not_say_it_exists');
      if (c.universal) v.push('role_locked_expected_but_response_claims_universal_availability');
      if (c.accountHas) v.push('role_locked_expected_but_response_says_the_account_has_it');
      if (!c.roleGateStated) v.push('role_gate_not_disclosed');
      if (!c.accountLacks) v.push('role_locked_expected_but_response_does_not_say_the_account_lacks_the_role');
      if (c.statedPlanTiers.length) v.push(`plan_tier_stated_for_a_role_gated_capability:${c.statedPlanTiers.join(',')}`);
      break;
    case TRUTH_KINDS.NOT_AVAILABLE:
    case TRUTH_KINDS.MARKET_UNAVAILABLE:
      if (!c.existenceDenied) v.push('not_available_expected_but_response_does_not_deny_availability');
      if (c.existenceAffirmed) v.push('not_available_expected_but_response_affirms_availability');
      break;
    default:
      v.push(`unhandled_truth_kind:${truth.kind}`);
  }
  return v;
}
