// FORBIDDEN CLAIM SEMANTIC GATE (Codex defect 9B, 2026-09-23).
//
// Exact-string negative controls (productTruthSurfaceCoverage.test.js) only catch the literal old
// wording reappearing verbatim. This module checks for the MEANING regardless of exact phrasing: a
// forbidden claim is a risky phrase pattern found WITHOUT a negation marker nearby (HE or EN) - so
// a truthful negative statement ("TEKANGO does NOT process payments") never trips it, but a false
// positive assertion ("TEKANGO processes payments") does, even if the exact prose differs from any
// historical string this project has ever used.
//
// Structural note: for every one of chat-ai's own deterministic answer functions (paymentTruth.ts,
// invoicingTruth.ts, capabilityTruth.ts), the SAFEST guarantee is structural, not textual - the
// function can only ever return one of a small, fully-authored set of strings, so it cannot invent
// a false claim regardless of input. This module exists for the case that discipline alone does not
// cover: free-text MODEL output, and a textual regression check on the deterministic strings
// themselves so a future edit to their wording cannot silently reintroduce a claim.

const NEGATION_WINDOW = 30;
const EN_NEGATIONS = ['not ', 'never ', 'no ', "n't ", 'none ', 'nothing ', 'cannot ', "isn't", "doesn't", "don't", "won't"];
const HE_NEGATIONS = ['לא ', 'אין ', 'אינ', 'לעולם לא', 'מעולם לא'];

function hasNearbyNegation(text, matchIndex, isHebrew) {
  const start = Math.max(0, matchIndex - NEGATION_WINDOW);
  const window = text.slice(start, matchIndex + NEGATION_WINDOW);
  const negations = isHebrew ? HE_NEGATIONS : EN_NEGATIONS;
  return negations.some((n) => window.toLowerCase().includes(n.toLowerCase()));
}

/**
 * @param {string} text - the real, current answer text to check
 * @param {RegExp} assertivePattern - matches the RISKY phrase itself (not the negation)
 * @param {boolean} isHebrew
 * @returns {{claimed: boolean, matches: string[]}} claimed=true means the text asserts the risky
 *   claim WITHOUT a nearby negation - this is the forbidden condition.
 */
export function checkSemanticClaim(text, assertivePattern, isHebrew) {
  const matches = [];
  const re = new RegExp(assertivePattern.source, assertivePattern.flags.includes('g') ? assertivePattern.flags : assertivePattern.flags + 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!hasNearbyNegation(text, m.index, isHebrew)) matches.push(m[0]);
    if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-length matches
  }
  return { claimed: matches.length > 0, matches };
}

// One pattern family per forbidden-claim family (task section 5). Each entry is the ASSERTIVE
// (risky) phrase shape only - checkSemanticClaim handles the negation-awareness generically.
export const FORBIDDEN_CLAIM_FAMILIES = {
  payment: {
    en: [
      /checkout (is|works|available)/i,
      /\b(accept|accepts|process|processes|can process)\b[^.]{0,20}\b(card|cards|credit|debit)\b/i,
      /paid status[^.]{0,40}(means|indicates)[^.]{0,20}(payment (was|is) processed|money (was|is) collected)/i,
      /\bPayPlus\b[^.]{0,30}\b(is live|is available|works|customer-facing|processes payment)\b/i,
    ],
    he: [
      /סליקה (זמינה|פעילה|קיימת)/,
      /(מקבל|מקבלת|מעבד|מעבדת)[^.]{0,20}(כרטיס אשראי|תשלום)/,
      /PayPlus[^.]{0,30}(פעיל|זמין|ללקוח)/,
    ],
  },
  invoicing: {
    en: [
      /invoice (issuance|generation) (is|works|available)/i,
      /quote pdf[^.]{0,20}(is|serves as)[^.]{0,10}an? invoice/i,
      /(email|emailing)[^.]{0,20}(a |the )?quote[^.]{0,20}is[^.]{0,10}invoic/i,
    ],
    he: [
      /הפקת חשבונ(ית|יות)[^.]{0,20}(זמינה|פעילה|קיימת)/,
      /pdf[^.]{0,20}(של|היא)[^.]{0,10}חשבונית/,
    ],
  },
  aiMutation: {
    en: [
      /\bI (edited|saved|sent|approved|deleted|created|changed) it\b/i,
      /\bI (have|'ve) (edited|saved|sent|approved|deleted|created|changed)/i,
      /\b(the )?AI (can|will|autonomously)( autonomously)?\s+(edit|save|send|approve|delete)\s+(it|the quote)\b/i,
    ],
    he: [
      /(ערכתי|שמרתי|שלחתי|אישרתי|מחקתי|יצרתי) (את זה|אותה|אותו)/,
      /ה-?AI (יכול|עורך|שולח|מוחק) (באופן עצמאי|לבד)/,
    ],
  },
  settingsLifecycle: {
    en: [
      /cancellation[^.]{0,30}(is|available)[^.]{0,10}self-service/i,
      /(archive|permanently delete)[^.]{0,20}(is|are) available (in|from) Business Settings/i,
    ],
    he: [
      /ביטול[^.]{0,20}(זמין|קיים)[^.]{0,15}(self-service|עצמאי)/,
      /(ארכיון|מחיקה לצמיתות)[^.]{0,20}(זמינ|קיימ)[^.]{0,15}בהגדרות העסק/,
    ],
  },
  calculatorRates: {
    en: [
      /\bfallback (rate|rates)[^.]{0,20}\b(is|are) (live|current)\b/i,
      /\bdefault rates?[^.]{0,20}\blive\b/i,
    ],
    he: [
      /שערים? (קבועים|ברירת מחדל)[^.]{0,20}(חי|עדכני)/,
    ],
  },
  metals: {
    en: [
      /metals? (calculator|estimate)[^.]{0,30}\bindependent live[^.]{0,10}feed\b/i,
      /\bmetals? (price|prices|rate|rates)\b[^.]{0,20}\blive feed\b/i,
    ],
    he: [
      /(מחשבון )?מתכות[^.]{0,30}(הזנה|שער) חי(ה)? (עצמאי|בלתי תלוי)/,
    ],
  },
  // Codex "structured runtime answer contract" (2026-09-2X): the registry declares several real
  // forbiddenClaimCodes beyond the 6 families above (NO_CONVERSION_CURRENCY_AS_*,
  // NO_OWNER_PUBLIC_WHATSAPP_CONFLATION, NO_LOCAL_DRAFT_AS_CLOUD_SAVED,
  // NO_ADMIN_FROM_PLAN_OR_LIFETIME_INFERENCE, NO_AUTONOMOUS_EMAIL_CLAIM). Every one of them now has
  // a real semantic family here, so claimCodes.ts's hard-fail-on-unknown-code gate never trips on
  // real, already-declared data - only on a genuinely new/typo'd code with no owner at all.
  conversionCurrency: {
    en: [
      /\bconversion currency\b[^.]{0,30}\b(is|as)\b[^.]{0,15}\b(payment|checkout|subscription)\b/i,
      /\b(calculator|converter)\b[^.]{0,30}\bcurrency\b[^.]{0,20}\b(is|becomes)\b[^.]{0,10}\b(the )?(quote|subscription|payment) currency\b/i,
    ],
    he: [
      /מטבע ה?המרה[^.]{0,20}(הוא|היא|משמש)[^.]{0,15}(תשלום|מנוי|הצעה)/,
    ],
  },
  whatsappConflation: {
    en: [
      /\bowner\b[^.]{0,20}whatsapp[^.]{0,20}\b(is|same as)\b[^.]{0,20}\bpublic\b[^.]{0,15}whatsapp/i,
      /\bpublic\b[^.]{0,20}whatsapp[^.]{0,20}\b(is|same as)\b[^.]{0,20}\bowner\b[^.]{0,15}whatsapp/i,
    ],
    he: [
      /שיתוף.{0,20}וואטסאפ.{0,20}(של בעל העסק|זהה).{0,20}(יצירת קשר|ציבורי)/,
    ],
  },
  draftProvenance: {
    en: [
      /\b(local|unsaved)\b[^.]{0,15}draft[^.]{0,20}\b(is|are|was)\b[^.]{0,15}\bsaved\b[^.]{0,10}\b(in the )?cloud\b/i,
      /\bdraft\b[^.]{0,20}\bsaved\b[^.]{0,10}\b(to|in)\b[^.]{0,10}\b(the )?(server|cloud|database)\b/i,
    ],
    he: [
      /טיוטה[^.]{0,20}(שמורה|נשמרה)[^.]{0,15}(בענן|בשרת|במסד הנתונים)/,
    ],
  },
  adminInference: {
    en: [
      /\b(pro|lifetime)\b[^.]{0,20}(account|plan)[^.]{0,20}\b(has|gives?|grants?)\b[^.]{0,15}\badmin\b/i,
      /\badmin\b[^.]{0,20}\b(access|console)\b[^.]{0,20}\bbecause\b[^.]{0,20}\b(pro|lifetime|plan)\b/i,
    ],
    he: [
      /(פרו|לייפטיים|תוכנית)[^.]{0,20}(מעניק|נותן|נותנת)[^.]{0,15}(גישת )?ניהול/,
    ],
  },
};
