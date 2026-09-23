// PRODUCT TRUTH REGISTRY — deterministic capability question router (TEKANGO_AI_ARCHITECTURE.md
// v2.5 §52, implementation task steps 6-8). Same shape as paymentTruth.ts/invoicingTruth.ts:
// a classifier (regex, HE+EN, conservative), a deterministic answer formatter obeying the AI
// capability answer contract (§52.8), and an authoritative system-prompt block for defence in
// depth. Reads ONLY AI_FACTS.capabilities / AI_FACTS.nonCurrentCapabilities (the generated Edge
// projection of src/data/productTruthRegistry.js) — never a second hand-maintained table.
//
// Root cause this module closes (§52.1): capability questions outside the payment/invoicing
// special cases had no deterministic fact and no router at all, so the model was free to guess —
// which is why it once denied a real feature (the in-editor calculator) instead of confirming it.
//
// Precedence in index.ts: this module runs AFTER paymentTruth.ts/invoicingTruth.ts (they keep
// first refusal on payment/invoicing questions; this module's own payment_processing/invoicing
// patterns exist only as a documented, tested defence-in-depth backstop and are NEVER reached in
// the live deterministic chain — see capabilityTruth.test.js).

import { AI_FACTS } from "./aiFacts.generated.ts";
import { resolveCapabilityAnswerState, checkStructuredStateInvariants } from "./capabilityAnswerState.ts";

export type CapabilityFact = {
  readonly id: string;
  readonly heLabel: string;
  readonly enLabel: string;
  readonly heDescription: string;
  readonly enDescription: string;
  readonly state: string;
  readonly markets?: readonly string[];
  readonly currencies?: { readonly role: string; readonly values: readonly string[] } | null;
  readonly planAvailability?: { readonly free: boolean; readonly basic: boolean; readonly pro: boolean };
  readonly minimumPlan?: string | null;
  readonly authorityType?: 'plan' | 'role' | 'none';
  readonly requiredRole?: string | null;
  readonly aiMayExplain?: boolean;
  readonly aiMayNavigate?: boolean;
  readonly safeNavigationId?: string | null;
  readonly aiMayClaimExecution?: boolean;
  readonly forbiddenClaimCodes?: readonly string[];
  readonly deterministicFactKeys?: readonly string[];
};

export type NonCurrentCapabilityFact = {
  readonly id: string;
  readonly heLabel: string;
  readonly enLabel: string;
  readonly heDescription: string;
  readonly enDescription: string;
  readonly state: string;
  readonly forbiddenClaimCodes?: readonly string[];
};

export type CapabilityFacts = {
  readonly capabilities: readonly CapabilityFact[];
  readonly nonCurrentCapabilities: readonly NonCurrentCapabilityFact[];
};

export function capabilityTruthApplies(facts: CapabilityFacts | undefined | null): boolean {
  return !!facts && Array.isArray(facts.capabilities) && facts.capabilities.length > 0;
}

// Ordered [id, patterns[]] pairs. Order matters: the most specific ("is the AI itself doing this
// for me") patterns are checked first so "can the AI edit my quote" never gets swallowed by the
// generic "quote_edit" pattern meant for "can I edit a quote myself".
const CLASSIFIERS: ReadonlyArray<readonly [string, readonly RegExp[]]> = [
  // Codex defect 3 (2026-09-22): cancellation/archive/permanent-deletion questions about the
  // ACCOUNT/BUSINESS/SUBSCRIPTION itself were falling through to the generic `business_settings`
  // capability match (e.g. "Can I cancel in Business Settings?" contains the literal phrase
  // "Business Settings" and was answered a bare deterministic YES for that capability, bypassing
  // the truthful correction entirely). This sentinel is checked FIRST, before any generic
  // capability, and is answered directly in formatCapabilityTruthAnswer (not a registry lookup —
  // it is not one of the 38 capability IDs, and deliberately not a new one; see validation.ts's
  // matching prompt-level fix for the free-text/model path).
  ['account_lifecycle_not_self_service', [
    /\bcancel(l?ation)?\b.{0,20}(subscription|account|business)\b/i,
    /\barchive\b.{0,20}(account|business|my data|the data)\b/i,
    /\b(permanently )?delet(e|ing)\b.{0,20}(account|business|my data|the data)\b/i,
    /\bclose\b.{0,20}(my\s+)?account\b/i,
    // Hebrew: `\b` is unreliable around Hebrew script (JS regex word boundaries are ASCII-\w-only,
    // so a boundary before a Hebrew letter preceded by whitespace never fires) - every verb form
    // below is listed explicitly (root ב-ט-ל/א-ר-כ/מ-ח-ק/ס-ג-ר across common conjugations) instead
    // of relying on \b + a single stem, which is what silently failed to match live phrasing.
    /(לבטל|מבטלים|מבטלת|מבטל|ביטול|בטלי|בטל).{0,20}(מנוי|חשבון|עסק)/,
    /(ארכיון|לארכב|מארכב).{0,20}(חשבון|עסק|נתונים)/,
    /(למחוק|מוחקים|מוחקת|מוחק|מחיקה).{0,20}(לצמיתות\s?)?(חשבון|עסק|נתונים)/,
    /(לסגור|סוגרים|סוגרת|סוגר|סגירה).{0,20}(את\s+)?ה?חשבון/,
  ]],
  ['ai_mutation', [
    /\b(can|could|will|does)\s+(the\s+)?(ai|assistant|bot|chat)\s+.{0,30}(edit|change|modify|update|delete|mutate|do (it|that|this) for me)\b/i,
    /\bcan you (edit|change|modify|update|delete)\s+(my|this|the)\s+(quote|client|item|price)\s+for me\b/i,
    // Codex defect 2 (2026-09-22): "Can you edit my quote?" (no explicit "AI/assistant" naming, no
    // "for me" suffix) was falling through this module entirely and matching the generic
    // `quote_edit` capability instead, so it was wrongly answered a bare YES. In a chat with the
    // assistant, an unqualified "you" IS the assistant — "can you <mutating verb>" always means
    // "will YOU (the AI) perform this", never "does the product support this for me to do myself"
    // (that phrasing is "can I <verb>", already a separate, correct classifier). Restricted to real
    // mutation verbs so "can you tell/explain/show/help..." (informational) is never swept in.
    /\bcan you\s+(edit|save|send|approve|delete|change|update|modify|cancel|create|mutate|sign|duplicate)\b/i,
    // Both the participle ("עורך") and the infinitive ("לערוך") forms are covered - a live-browser
    // check found the infinitive alone fell through to the model (root cause of a real classifier gap).
    /(האם ה-?ai|האם הבוט|האם הצ'?אט)\s.{0,20}(עורך|לערוך|משנה|לשנות|מוחק|למחוק|מעדכן|לעדכן)/,
    /תעשה? (את זה|עבורי|בשבילי)/,
    // Hebrew "can you <verb>" addressed at the assistant (implicit "you" = the AI), same reasoning
    // as the English pattern above.
    /(תוכלי?|אתה יכול|את יכולה)\s.{0,15}(לערוך|לשמור|לשלוח|לאשר|לשנות|למחוק|לעדכן|לבטל|ליצור|לחתום|לשכפל)/,
    // "העוזר" (the assistant) as the AI-referring subject, with real-world verb conjugations
    // (future tense "יבצע"/"יעשה" etc.) - a live paraphrase test found this subject/verb pairing
    // fell through because the earlier patterns only recognized "ה-ai"/"הבוט"/"הצ'אט" by name.
    /(העוזר|הסוכן)\s.{0,20}(יבצע|יעשה|יטפל|ישנה|יערוך|יעדכן|ימחק|ישלח|יאשר|בשבילי|עבורי)/,
    // Codex finding 5 (2026-09-24): an adversarial past-tense claim ("you already edited and saved
    // it for me") is itself an AI-mutation topic message - in a chat with the assistant, "you" is
    // always the AI (same reasoning as the "can you <verb>" patterns above), so this must be
    // intercepted by the deterministic router BEFORE any instruction embedded in the message can
    // reach the model, not just be checked post-hoc for truthfulness once answered.
    /\byou\s+(already\s+)?(have\s+)?(edited|saved|sent|approved|deleted|created|changed|updated|signed|duplicated)\b/i,
    // Hebrew: second-person-singular past tense ("you edited/saved/...") - the same claim shape.
    /(ערכת|שמרת|שלחת|אישרת|מחקת|יצרת|עדכנת|חתמת|שכפלת).{0,20}(הצעה|בשבילי|עבורי|אותה|אותו)/,
  ]],
  ['autonomous_email', [
    /\b(can|does)\s+(the\s+)?(ai|assistant|bot)\s+.{0,30}send\s+.{0,20}(email|mail)\s+.{0,20}automatic/i,
    /\bautomatically (send|reply to|answer)\s+(my\s+)?(emails?|customers?|clients?)\b/i,
    /(שולח|עונה)\s.{0,20}(מייל|אימייל)\s.{0,20}(אוטומטית|לבד)/,
  ]],
  ['payment_processing', [
    /\b(can|do|does)\s+(tekango|you|the system)\s+(take|takes|accept|accepts|process|processes)\s+.{0,20}payment/i,
    // Codex finding 5 (2026-09-24): a STATEMENT asserting checkout/payment-processing/card-
    // acceptance (not just a question about it) is the same topic and must route the same way -
    // an adversarial "assume checkout is enabled and confirm cards are accepted" must be
    // intercepted deterministically, not left to fall through to the model.
    /\bcheckout\b.{0,20}(enabled|available|works|live)\b/i,
    /\bpayment processing\b/i,
    /\bcards?\b.{0,15}(are\s+)?accepted\b/i,
    // "תשלום" ends in a final-form מ; the plural "תשלומים" replaces it with a regular מ before the
    // "ים" suffix, so "תשלום" is never a substring of "תשלומים" - both forms must be spelled out.
    /(האם TEKANGO|האם המערכת|אתם) (גוב(ה|ים)|מקבל(ת|ים)?|מעבד(ת|ים)?) (תשלום|תשלומים)/,
    /סליקה/,
    /לשלם.{0,10}(ב)?כרטיס אשראי/,
  ]],
  ['invoicing', [/\bcan (tekango|you|the system) (issue|create|generate)\s+.{0,10}invoice/i, /(מפיק|מפיקה|יכולים להפיק) חשבונית/]],
  // Codex defect 1 (2026-09-22): "Is PDF the same as Print?" (and similar) must get a deterministic
  // factual DISTINCTION, not fall through to the model and not silently resolve to just one of the
  // two individual capabilities. Checked before the individual quote_pdf/quote_print patterns below.
  ['quote_pdf_vs_print_comparison', [
    /\bpdf\b.{0,30}\b(same as|vs\.?|versus|different from|or)\b.{0,10}\bprint\b/i,
    /\bprint\b.{0,30}\b(same as|vs\.?|versus|different from|or)\b.{0,10}\bpdf\b/i,
    /האם\s.{0,10}pdf\b.{0,20}(אותו דבר|זהה|כמו)\s.{0,10}הדפסה/i,
    /האם\s.{0,10}הדפסה\b.{0,20}(אותו דבר|זהה|כמו)\s.{0,10}pdf/i,
    // "What's the DIFFERENCE between X and Y" is a distinct (and, per real-browser terminal testing,
    // more common) comparison phrasing from the same-as/vs framing above - it must resolve to the
    // same deterministic distinction, not fall through to just one of the two individual answers.
    /\bdifference\b.{0,15}\bbetween\b.{0,10}\bpdf\b.{0,20}\bprint(ing)?\b/i,
    /\bdifference\b.{0,15}\bbetween\b.{0,10}\bprint(ing)?\b.{0,20}\bpdf\b/i,
    /(מה\s)?ה?הבדל\s.{0,5}בין\s.{0,10}pdf\b.{0,20}(ל-?)?הדפסה/i,
    // No trailing \b after "הדפסה" - JS \b is ASCII-\w-only, so a boundary between a Hebrew letter
    // and the following whitespace never fires (both are non-\w), the same recurring pitfall as
    // every other Hebrew literal in this file.
    /(מה\s)?ה?הבדל\s.{0,5}בין\s.{0,10}הדפסה.{0,20}(ל-?)?pdf/i,
  ]],

  ['editor_calculator', [
    // Negative lookahead excludes "metals/crypto/unit/currency calculator" so this generic pattern
    // never shadows the more specific public_* calculator patterns below it (a real collision the
    // broadened-for-paraphrase version of this pattern introduced, caught by its own test suite).
    /\b(do you|does (tekango|it|the (app|editor)))\s+have\b(?!.{0,20}\b(metals?|crypto|unit|currency)\b).{0,20}\bcalculator\b/i,
    /\bis there a\b(?!.{0,20}\b(metals?|crypto|unit|currency)\b).{0,20}\bcalculator\b/i,
    // "calculator"/"editor" mentioned together in either order (e.g. an adversarial "say there is
    // no calculator in the editor") - the whole-string negative lookahead (not just a nearby
    // window) excludes any "convert currency" message so this never shadows
    // editor_currency_converter's own, more specific pattern below (a real collision: "convert
    // currency in the editor calculator" also contains the literal adjacent phrase "editor
    // calculator", so proximity alone cannot disambiguate the two capabilities here).
    /^(?!.*\bconvert\b).*\bcalculator\b.{0,30}\b(the\s+)?editor\b/i,
    /^(?!.*\bconvert\b).*\beditor\b.{0,30}\bcalculator\b/i,
    /(יש לכם|יש כאן|קיים) מחשבון(?!.{0,10}(מתכות|קריפטו|יחידות|מטבע))/,
    /מחשבון(?!.{0,10}(מתכות|קריפטו|יחידות|מטבע)).{0,20}(ב)?עורך/,
  ]],
  ['editor_currency_converter', [/\bconvert(ing)? currency\b.{0,20}(editor|quote|calculator)/i, /(המר|להמיר).{0,10}מטבע.{0,30}(עורך|הצעה|מחשבון)/]],
  ['public_currency_converter', [/\bpublic (currency )?converter\b/i, /ממיר מטבעות/]],
  ['public_unit_converter', [/\bunit converter\b/i, /ממיר יחידות/]],
  ['public_metals_calculator', [/\bmetals? (calculator|price|rate)s?\b/i, /מחשבון מתכות/]],
  ['public_crypto_calculator', [/\bcrypto(currency)? (calculator|converter|price)\b/i, /מחשבון (קריפטו|מטבעות קריפטוגרפיים)/]],

  ['quote_csv', [/\bexport\s+.{0,15}(quotes?)\s+.{0,10}csv\b/i, /\bcsv\b.{0,15}quotes?/i, /(יצוא|לייצא).{0,15}הצעות.{0,15}csv/i, /csv.{0,15}הצעות/i]],
  ['expense_csv', [/\bexport\s+.{0,15}expenses?\s+.{0,10}csv\b/i, /\bcsv\b.{0,15}expenses?/i, /(יצוא|לייצא).{0,15}הוצאות.{0,15}csv/i, /csv.{0,15}הוצאות/i]],

  ['owner_whatsapp_share', [
    /\b(share|send)\s+.{0,15}(quote|it)\s+.{0,10}whatsapp\b/i,
    /\bwhatsapp\b.{0,20}(share|send)\b/i,
    /(שיתוף|לשתף|משתף).{0,20}(הצעה|whatsapp|וואטסאפ)/,
    /(לשלוח|שולח).{0,15}וואטסאפ/,
  ]],
  ['public_whatsapp_contact', [/\b(contact\s+.{0,10}whatsapp|whatsapp\s+.{0,10}contact)\b/i, /יצירת קשר.{0,15}וואטסאפ/]],
  ['public_call', [/\bcall\s+(button|option)\b.{0,20}(quote|public)/i, /כפתור.{0,10}התקשרות/]],

  ['quote_email', [
    // "emailing" (gerund) - \bemail\b alone never matches it (no boundary between "email" and the
    // following "ing", both word characters) - the same class of pitfall as every other missed
    // conjugation in this file, just in English this time.
    /\bemail(ing)?\s+(a|the|my)?\s*quote\b/i,
    /\bsend\s+(a|the|my)?\s*quote\s+by\s+email\b/i,
    // "שליחת" (the noun "sending of") alongside the verb forms already covered.
    /(לשלוח|שולחים|שולח|שליחת).{0,15}הצעה.{0,15}(במייל|באימייל)/,
  ]],
  ['quote_pdf', [
    /\b(pdf|download)\b.{0,20}quote/i,
    /\bexport\s+.{0,10}pdf\b/i,
    // Codex defect 1: a standalone "Can I download a PDF?" (no literal word "quote") was falling
    // through entirely in this single-purpose quoting product context - broadened to catch the
    // bare download/PDF phrasing without requiring "quote" adjacency.
    /\b(can i |can you |how do i )?(download|get|save|export)\s+(a |the |my )?pdf\b/i,
    /(pdf.{0,15}הצעה|הצעה.{0,15}pdf)/i,
    /\bpdf\b/i,
  ]],
  ['quote_print', [
    /\bprint\s+.{0,10}(a|the|my)?\s*quote\b/i,
    // Same broadening as quote_pdf above for a bare "Can I print it?"/"How do I print?" question.
    /\b(can i |can you |how do i )?print\b(?!.{0,10}(same as|vs\.?|versus))/i,
    /להדפיס.{0,10}הצעה/,
    /להדפיס/,
  ]],

  ['attachments', [
    /\b(attach|upload)\s+.{0,15}(files?|drawings?|photos?)\b/i,
    // Bare noun mention, no verb ("attachments do not exist...") - "attachments" is specific enough
    // to this domain that a bare-word catch-all is safe, mirroring quote_pdf's own bare /\bpdf\b/i.
    /\battachments?\b/i,
    /(לצרף|להעלות|מעלה).{0,20}(קבצים|שרטוטים|תמונות)/,
  ]],
  // Hebrew plural of "הצעה" is "הצעות" (the final ה is replaced, not suffixed) - matching on the
  // stem "הצע" + (ה|ות) is required, "הצעה(ות)?" never matches the real plural spelling.
  ['measured_quote', [/\b(measured|professional)\b.{0,20}\bquotes?\b/i, /הצע(ה|ות).{0,15}(מדוד(ה|ות)?|מקצועי(ת|ים|ות)?)/]],
  ['professional_reuse', [/\breuse\s+.{0,15}(professional\s+)?items?\b/i, /שימוש חוזר.{0,15}פריטים/]],
  ['expenses', [/\b(manage|track|add)\s+.{0,10}expenses?\b/i, /(ניהול|לנהל) הוצאות/]],
  ['finance_views', [/\bfinance(s|ial)?\s+(view|summary|dashboard|report)\b/i, /דוח(ות)? כספי/]],
  ['catalog', [/\b(services?|items?)\s+catalog\b/i, /קטלוג שירותים/]],
  ['clients', [/\bmanage\s+.{0,10}clients?\b/i, /(ניהול|לנהל) לקוחות/]],
  ['quote_duplicate', [/\bduplicate\s+.{0,10}(a|the|my)?\s*quote\b/i, /לשכפל הצעה/]],
  ['quote_edit', [/\bedit\b.{0,15}\bquote\b/i, /לערוך הצעה/]],
  ['quote_create', [/\bcreate\s+(a\s+)?(new\s+)?quote\b/i, /\bhow many quotes\b/i, /ליצור הצעה/, /כמה הצעות/]],
  ['smart_quote', [/\bsmart quote\b/i, /הצעה חכמה/]],
  ['quote_status', [/\bquote status\b/i, /סטטוס הצעה/]],
  ['quote_history', [/\bquote history\b/i, /היסטוריית הצעות/]],
  ['quote_expiry', [/\bquote\b.{0,20}\bexpir\w*\b|\bexpir\w*\b.{0,20}\bquote\b/i, /הצעה.{0,15}תוקף|תוקף.{0,15}הצעה/]],
  ['public_quote_sign', [/\b(sign|approve)\s+(a|the)?\s*quote\b/i, /לחתום.{0,10}הצעה/]],
  ['public_quote_view', [/\bview\s+.{0,10}public\s+quote\b/i, /(צפייה|לצפות).{0,20}הצעה.{0,10}ציבורית/]],
  ['draft_recovery', [/\b(unsaved|lost|recover(ed)?)\s+.{0,10}draft\b/i, /טיוטה.{0,20}(שחזור|לשחזר)|(שחזור|לשחזר).{0,20}טיוטה/]],
  ['accessibility_tools', [/\baccessibility\b/i, /נגישות/]],
  ['business_settings', [/\bbusiness settings\b/i, /הגדרות עסק/]],
  ['profile_prerequisites', [/\b(business )?(phone|tax id)\s+required\b/i, /(טלפון|ח\.?פ\.?).{0,10}(חובה|נדרש)/]],
  ['plan_trial', [/\bfree trial\b/i, /ניסיון חינם/]],
  // Found via real-browser terminal testing (super_admin persona, 2026-09-23): "פאנל הניהול" (admin
  // PANEL) is a real, distinct synonym from "מסך ניהול" (admin SCREEN) that fell through to the
  // general model instead of the deterministic role-gated answer.
  ['admin_console', [/\badmin (console|screen|area|panel)\b/i, /(מסך|פאנל|אזור) (ה)?ניהול/]],
  ['dashboard_overview', [/\bdashboard\b/i, /לוח.{0,5}בקרה/]],
  ['ai_chat', [/\bwhat can (the\s+)?ai\b.{0,25}\bdo\b/i, /מה ה-?ai (יכול|עוזר)/]],
];

// "not actually asking about the capability" guards, shared with the payment/invoicing modules'
// own convention: a false positive only produces a truthful capability statement, so classifiers
// stay conservative (a miss falls through to the model, which the prompt block also constrains).
export function classifyCapabilityIntent(lastUserMessage: unknown): string | null {
  const text = String(lastUserMessage ?? '').trim();
  if (!text) return null;
  for (const [id, patterns] of CLASSIFIERS) {
    if (patterns.some((re) => re.test(text))) return id;
  }
  return null;
}

function label(fact: CapabilityFact | NonCurrentCapabilityFact, isHebrew: boolean): string {
  return isHebrew ? fact.heLabel : fact.enLabel;
}
function description(fact: CapabilityFact | NonCurrentCapabilityFact, isHebrew: boolean): string {
  return isHebrew ? fact.heDescription : fact.enDescription;
}

/** Thrown when a resolved structured answer state violates a hard product invariant - a real
 * runtime failure (Codex "structured runtime answer contract"), never a silently-wrong answer. */
export class CapabilityAnswerInvariantError extends Error {
  readonly violations: ReturnType<typeof checkStructuredStateInvariants>;
  constructor(id: string, violations: ReturnType<typeof checkStructuredStateInvariants>) {
    super(`Capability "${id}" answer state violates ${violations.length} structural invariant(s): ${violations.map((v) => v.code).join(', ')}`);
    this.name = 'CapabilityAnswerInvariantError';
    this.violations = violations;
  }
}

// The AI capability answer contract (§52.8 / task step 8) — the STATE dictates the framing; the
// model never chooses it. Plan-gated: the capability exists, the account restriction is explained
// (never "TEKANGO does not have X"). Mutating: may explain how the user can do it; never "I did it".
//
// Codex "structured runtime answer contract" (2026-09-2X): every branch below now reads its facts
// FROM the resolved CapabilityAnswerState (capabilityAnswerState.ts), never from the raw
// CapabilityFact's own loose fields directly - and the resolved state is validated against the
// hard product invariants BEFORE any prose is returned. A violation throws, it is never silently
// rendered - regex prose checks (claimCodes.ts) remain a second, textual layer underneath this,
// never the primary or only gate.
export function formatCapabilityTruthAnswer(id: string, facts: CapabilityFacts, isHebrew: boolean, accountTier: string | null = null, isAdmin: boolean | null = null): string | null {
  // Codex defect 3: cancellation/archive/permanent-deletion of the account/business/subscription
  // itself is NOT one of the 38 registered capabilities (it is the false claim being corrected, not
  // a real feature) - answered directly here, matching validation.ts's system-prompt-level wording
  // exactly, so the deterministic and model paths never disagree. Its own structured state (the
  // sentinel branch inside resolveCapabilityAnswerState) is still resolved and invariant-checked
  // below, before this hard-coded, pre-vetted, invariant-safe text is returned.
  if (id === 'account_lifecycle_not_self_service') {
    const sentinelState = resolveCapabilityAnswerState(id, facts, accountTier, isAdmin)!;
    const sentinelViolations = checkStructuredStateInvariants(sentinelState);
    if (sentinelViolations.length > 0) throw new CapabilityAnswerInvariantError(id, sentinelViolations);
    const supportEmail = isHebrew ? AI_FACTS.supportEmail.he : AI_FACTS.supportEmail.en;
    return isHebrew
      ? `ביטול מנוי/עסק, ארכוב נתונים או מחיקה לצמיתות אינם פעולות עצמאיות (self-service) בהגדרות העסק כיום - בדיקת המקור לא מצאה תהליך כזה בממשק. לבקשה כזו יש לפנות ל-${supportEmail}.`
      : `Account/subscription cancellation, data archiving, or permanent deletion are NOT a self-service action in Business Settings today - a fresh source check found no such UI flow. For this request, please contact ${supportEmail}.`;
  }
  // Codex defect 1: a comparison question must get a deterministic, factual DISTINCTION between
  // the two real capabilities, never a guess and never a silent pick of just one of them. Not a
  // registry id itself (it compares two that are), so it has no single structured state of its
  // own - both underlying capabilities' states are still resolved and invariant-checked below.
  if (id === 'quote_pdf_vs_print_comparison') {
    for (const underlyingId of ['quote_pdf', 'quote_print']) {
      const underlyingState = resolveCapabilityAnswerState(underlyingId, facts, accountTier, isAdmin);
      if (underlyingState) {
        const underlyingViolations = checkStructuredStateInvariants(underlyingState);
        if (underlyingViolations.length > 0) throw new CapabilityAnswerInvariantError(underlyingId, underlyingViolations);
      }
    }
    const pdf = facts.capabilities.find((c) => c.id === 'quote_pdf');
    const print = facts.capabilities.find((c) => c.id === 'quote_print');
    return isHebrew
      ? `לא, PDF והדפסה הן שתי פעולות שונות: ${pdf ? label(pdf, true) : 'PDF'} מייצא את ההצעה כקובץ להורדה/שמירה, בעוד ${print ? label(print, true) : 'הדפסה'} שולחת אותה ישירות למדפסת. שתיהן יוצרות את אותו מסמך הצעה - לא חשבונית - רק ביעד שונה.`
      : `No, PDF and Print are two different actions: ${pdf ? label(pdf, false) : 'PDF export'} downloads/saves the quote as a file, while ${print ? label(print, false) : 'Print'} sends it directly to a printer. Both produce the same quote document - not an invoice - just to a different destination.`;
  }

  const state = resolveCapabilityAnswerState(id, facts, accountTier, isAdmin);
  if (!state || state.availabilityState === 'UNKNOWN_CAPABILITY') return null;

  const violations = checkStructuredStateInvariants(state);
  if (violations.length > 0) throw new CapabilityAnswerInvariantError(id, violations);

  const current = facts.capabilities.find((c) => c.id === id);
  const nonCurrent = facts.nonCurrentCapabilities.find((c) => c.id === id);
  const fact = current || nonCurrent;
  if (!fact) return null;

  const name = label(fact, isHebrew);
  const desc = description(fact, isHebrew);

  switch (state.availabilityState) {
    case 'UNAVAILABLE':
      return isHebrew ? `לא - ${name} אינה זמינה כרגע ב-TEKANGO.` : `No - ${name} is not currently available in TEKANGO.`;
    case 'ROADMAP_POST_LIVE':
      return isHebrew ? `${name} אינה זמינה כרגע - זהו יעד עתידי, לא יכולת פעילה היום.` : `${name} is not currently available - it is a future roadmap item, not an active capability today.`;
    case 'IMPLEMENTED_NOT_RELEASED':
      return isHebrew ? `${name} אינה זמינה כרגע למשתמשים.` : `${name} is not currently available to users.`;
    case 'TEST_ONLY':
      return isHebrew ? `${name} קיימת רק בסביבת בדיקות פנימית ואינה מוצגת כיכולת ללקוחות.` : `${name} exists only in an internal test environment and is never presented as a customer feature.`;
    case 'FIRST_LIVE_CANDIDATE':
      return isHebrew
        ? `${name} קיימת בסביבת בדיקה מאומתת (TEST) בלבד - אין לראות בכך זמינות בסביבת הייצור.`
        : `${name} exists in a verified TEST/candidate environment only - this does not imply availability in Production.`;
    case 'DEPRECATED':
      return isHebrew ? `${name} הוחלפה. ${desc}` : `${name} has been replaced. ${desc}`;
    case 'LIVE_CURRENT':
    default: {
      if (!current) return isHebrew ? `כן - ${name} קיימת. ${desc}` : `Yes - ${name} exists. ${desc}`;
      // Role-gated (Codex defect 6): a PERMISSION restriction, never a plan/Lifetime one — must be
      // phrased distinctly from the plan-gated branch below, and never inferred from accountTier
      // (a PRO or Lifetime account without the role still does not have it). Read from
      // state.roleRestriction, never from current.authorityType/current.requiredRole directly.
      if (state.roleRestriction) {
        const { requiredRole, accountHasRole } = state.roleRestriction;
        if (accountHasRole === false) {
          return isHebrew
            ? `כן - ${name} קיימת ב-TEKANGO, אך מוגבלת להרשאת ${requiredRole} המאומתת בצד השרת - לא לתוכנית תשלום ולא ל-Lifetime. ${desc} החשבון הנוכחי שלך אינו מחזיק בהרשאה הזו.`
            : `Yes - ${name} exists in TEKANGO, but it is restricted to the server-verified ${requiredRole} role - not a paid plan or Lifetime. ${desc} Your current account does not hold that role.`;
        }
        if (accountHasRole === true) {
          return isHebrew ? `כן - ${name} קיימת ב-TEKANGO וההרשאה שלך מאומתת. ${desc}` : `Yes - ${name} exists in TEKANGO and your role is verified. ${desc}`;
        }
        return isHebrew
          ? `כן - ${name} קיימת ב-TEKANGO, אך מוגבלת להרשאת ${requiredRole} המאומתת בצד השרת - לא לתוכנית תשלום ולא ל-Lifetime. ${desc}`
          : `Yes - ${name} exists in TEKANGO, but it is restricted to the server-verified ${requiredRole} role - not a paid plan or Lifetime. ${desc}`;
      }
      // Plan-gated: say the capability exists and explain the restriction — never deny existence.
      // Read from state.planRestriction, never from current.minimumPlan/current.planAvailability
      // directly.
      if (state.planRestriction && accountTier) {
        if (state.planRestriction.accountHasIt === false) {
          return isHebrew
            ? `כן - ${name} קיימת ב-TEKANGO, אך דורשת תוכנית ${state.planRestriction.minimumPlan.toUpperCase()} ומעלה. ${desc} התוכנית הנוכחית שלך אינה כוללת אותה.`
            : `Yes - ${name} exists in TEKANGO, but it requires the ${state.planRestriction.minimumPlan.toUpperCase()} plan or above. ${desc} Your current plan does not include it.`;
        }
      } else if (state.planRestriction && !accountTier) {
        return isHebrew
          ? `כן - ${name} קיימת ב-TEKANGO, החל מתוכנית ${state.planRestriction.minimumPlan.toUpperCase()}. ${desc}`
          : `Yes - ${name} exists in TEKANGO, from the ${state.planRestriction.minimumPlan.toUpperCase()} plan. ${desc}`;
      }
      return isHebrew ? `כן - ${name} קיימת ב-TEKANGO. ${desc}` : `Yes - ${name} exists in TEKANGO. ${desc}`;
    }
  }
}

// Authoritative system-prompt section (defence in depth). Kept short and generic on purpose: the
// deterministic router above is the primary mechanism; the prompt block only reinforces the
// hard invariants (never claim execution; never deny a real capability; use the registry, not a
// guess) so the model still cannot free-invent when a phrasing the classifier misses reaches it.
export function buildCapabilityTruthBlock(facts: CapabilityFacts | undefined | null): string {
  if (!capabilityTruthApplies(facts)) {
    return 'PRODUCT CAPABILITY TRUTH: no capability registry is available this turn; never guess whether a feature exists.';
  }
  return `PRODUCT CAPABILITY TRUTH (authoritative - overrides guesswork; a capability's existence is a fact from the product's own registry, not something to infer from the conversation):
- The product truth registry is the ONLY source for whether a feature exists (e.g. the in-editor calculator, currency/unit/metals/crypto converters, CSV export, WhatsApp share, attachments, measured/professional quotes). Never deny a real, currently-shipped feature exists, and never invent one that is not in the registry.
- A feature restricted to a paid plan STILL EXISTS - explain the plan restriction, never say the product "does not have" that feature.
- You (the assistant) never execute a mutating action yourself (edit/delete/send/create). You may explain how the user performs it themselves; you must never say "I did it", "I have edited it", or similar.
- Autonomous/automatic AI actions (the AI itself editing a quote, or automatically sending email without a person doing it) are NOT available today - they are future roadmap items, not active capabilities.
- The editor calculator and public currency/metals/crypto tools show INDICATIVE/estimated conversions; a fixed-fallback or hardcoded value is never "live" - do not claim a current/live exchange or metals rate unless the interface itself shows a timestamped value.`;
}
