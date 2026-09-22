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
  ['ai_mutation', [
    /\b(can|could|will|does)\s+(the\s+)?(ai|assistant|bot|chat)\s+.{0,30}(edit|change|modify|update|delete|mutate|do (it|that|this) for me)\b/i,
    /\bcan you (edit|change|modify|update|delete)\s+(my|this|the)\s+(quote|client|item|price)\s+for me\b/i,
    /(האם ה-?ai|האם הבוט|האם הצ'?אט)\s.{0,20}(עורך|משנה|מוחק|מעדכן)/,
    /תעשה? (את זה|עבורי|בשבילי)/,
  ]],
  ['autonomous_email', [
    /\b(can|does)\s+(the\s+)?(ai|assistant|bot)\s+.{0,30}send\s+.{0,20}(email|mail)\s+.{0,20}automatic/i,
    /\bautomatically (send|reply to|answer)\s+(my\s+)?(emails?|customers?|clients?)\b/i,
    /(שולח|עונה)\s.{0,20}(מייל|אימייל)\s.{0,20}(אוטומטית|לבד)/,
  ]],
  ['payment_processing', [/\b(can (tekango|you|the system) (take|accept|process)|does tekango (take|accept|process))\s+.{0,20}payment/i, /(האם TEKANGO|האם המערכת) (גובה|מקבל|מעבד)ת? תשלום/]],
  ['invoicing', [/\bcan (tekango|you|the system) (issue|create|generate)\s+.{0,10}invoice/i, /(מפיק|מפיקה|יכולים להפיק) חשבונית/]],

  ['editor_calculator', [/\b(do you|does (tekango|it|the (app|editor))) have a calculator\b/i, /\bis there a calculator\b/i, /(יש לכם|יש כאן|קיים) מחשבון/]],
  ['editor_currency_converter', [/\bconvert(ing)? currency\b.{0,20}(editor|quote|calculator)/i, /(המר|להמיר).{0,10}מטבע.{0,30}(עורך|הצעה|מחשבון)/]],
  ['public_currency_converter', [/\bpublic (currency )?converter\b/i, /ממיר מטבעות/]],
  ['public_unit_converter', [/\bunit converter\b/i, /ממיר יחידות/]],
  ['public_metals_calculator', [/\bmetals? (calculator|price|rate)s?\b/i, /מחשבון מתכות/]],
  ['public_crypto_calculator', [/\bcrypto(currency)? (calculator|converter|price)\b/i, /מחשבון (קריפטו|מטבעות קריפטוגרפיים)/]],

  ['quote_csv', [/\bexport\s+.{0,15}(quotes?)\s+.{0,10}csv\b/i, /\bcsv\b.{0,15}quotes?/i, /(יצוא|לייצא).{0,15}הצעות.{0,15}csv/i, /csv.{0,15}הצעות/i]],
  ['expense_csv', [/\bexport\s+.{0,15}expenses?\s+.{0,10}csv\b/i, /\bcsv\b.{0,15}expenses?/i, /(יצוא|לייצא).{0,15}הוצאות.{0,15}csv/i, /csv.{0,15}הוצאות/i]],

  ['owner_whatsapp_share', [/\b(share|send)\s+.{0,15}(quote|it)\s+.{0,10}whatsapp\b/i, /\bwhatsapp\b.{0,20}(share|send)\b/i, /שיתוף.{0,15}(הצעה|whatsapp)/, /לשלוח.{0,15}וואטסאפ/]],
  ['public_whatsapp_contact', [/\b(contact\s+.{0,10}whatsapp|whatsapp\s+.{0,10}contact)\b/i, /יצירת קשר.{0,15}וואטסאפ/]],
  ['public_call', [/\bcall\s+(button|option)\b.{0,20}(quote|public)/i, /כפתור.{0,10}התקשרות/]],

  ['quote_email', [/\bemail\s+(a|the|my)?\s*quote\b/i, /\bsend\s+(a|the|my)?\s*quote\s+by\s+email\b/i, /לשלוח הצעה?.{0,10}(במייל|באימייל)/]],
  ['quote_pdf', [/\b(pdf|download)\b.{0,20}quote/i, /\bexport\s+.{0,10}pdf\b/i, /(pdf.{0,15}הצעה|הצעה.{0,15}pdf)/i]],
  ['quote_print', [/\bprint\s+.{0,10}(a|the|my)?\s*quote\b/i, /להדפיס.{0,10}הצעה/]],

  ['attachments', [/\b(attach|upload)\s+.{0,15}(files?|drawings?|photos?)\b/i, /לצרף.{0,15}קבצים/]],
  ['measured_quote', [/\b(measured|professional)\s+quote\b/i, /הצעה.{0,10}(מדודה|מקצועית)/]],
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
  ['admin_console', [/\badmin (console|screen|area)\b/i, /מסך ניהול/]],
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

// The AI capability answer contract (§52.8 / task step 8) — the STATE dictates the framing; the
// model never chooses it. Plan-gated: the capability exists, the account restriction is explained
// (never "TEKANGO does not have X"). Mutating: may explain how the user can do it; never "I did it".
export function formatCapabilityTruthAnswer(id: string, facts: CapabilityFacts, isHebrew: boolean, accountTier: string | null = null): string | null {
  const current = facts.capabilities.find((c) => c.id === id);
  const nonCurrent = facts.nonCurrentCapabilities.find((c) => c.id === id);
  const fact = current || nonCurrent;
  if (!fact) return null;

  const name = label(fact, isHebrew);
  const desc = description(fact, isHebrew);

  switch (fact.state) {
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
      // Plan-gated: say the capability exists and explain the restriction — never deny existence.
      if (current.minimumPlan && current.minimumPlan !== 'free' && accountTier) {
        const hasIt = current.planAvailability ? current.planAvailability[accountTier as 'free' | 'basic' | 'pro'] === true : null;
        if (hasIt === false) {
          return isHebrew
            ? `כן - ${name} קיימת ב-TEKANGO, אך דורשת תוכנית ${current.minimumPlan.toUpperCase()} ומעלה. ${desc} התוכנית הנוכחית שלך אינה כוללת אותה.`
            : `Yes - ${name} exists in TEKANGO, but it requires the ${current.minimumPlan.toUpperCase()} plan or above. ${desc} Your current plan does not include it.`;
        }
      } else if (current.minimumPlan && current.minimumPlan !== 'free' && !accountTier) {
        return isHebrew
          ? `כן - ${name} קיימת ב-TEKANGO, החל מתוכנית ${current.minimumPlan.toUpperCase()}. ${desc}`
          : `Yes - ${name} exists in TEKANGO, from the ${current.minimumPlan.toUpperCase()} plan. ${desc}`;
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
