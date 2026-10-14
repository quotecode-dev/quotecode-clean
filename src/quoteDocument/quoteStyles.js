// Task 16 - Quote Experience V2: the ONE shared presentation-style capability definition.
// Consumed by the creator style picker, the landing comparison and (through the parity-tested twin
// supabase/functions/_shared/quoteStyleCapabilities.ts) the authoritative quote-presentation function.
//
// Classic / Modern / Visual are presentation capability tiers. They are deliberately NOT mapped to the
// commercial FREE / BASIC / PRO plans (src/utils/planCatalog.js): that mapping, numeric prices, billing periods
// and checkout remain an open Owner decision.
// Locale (HE/EN) and Compact/Expanded are independent of style and are never paid tiers.

export const QUOTE_STYLE_IDS = Object.freeze(['classic', 'modern', 'visual']);

// Version of each style's composition. Frozen into an issued quote so later renderer changes cannot restyle it.
export const QUOTE_STYLE_VERSIONS = Object.freeze({ classic: 1, modern: 1, visual: 1 });

export const DEFAULT_QUOTE_STYLE = 'classic';

// Inclusive tiers: each tier includes every lower-ranked style.
export const PRESENTATION_TIERS = Object.freeze([
  Object.freeze({ id: 'classic', rank: 1, includes: Object.freeze(['classic']) }),
  Object.freeze({ id: 'modern', rank: 2, includes: Object.freeze(['classic', 'modern']) }),
  Object.freeze({ id: 'visual', rank: 3, includes: Object.freeze(['classic', 'modern', 'visual']) }),
]);

export const COMMERCIAL_MAPPING_STATUS = 'pending_owner_decision';

export function normalizeStyleId(value) {
  return typeof value === 'string' && QUOTE_STYLE_IDS.includes(value) ? value : null;
}

export function normalizeTierId(value) {
  return PRESENTATION_TIERS.some((t) => t.id === value) ? value : 'classic';
}

export function isStyleIncluded(tierId, styleId) {
  const tier = PRESENTATION_TIERS.find((t) => t.id === normalizeTierId(tierId));
  return !!normalizeStyleId(styleId) && tier.includes.includes(styleId);
}

// Images are part of Modern and Visual (R2 decision: BOTH richer styles support product imagery).
export function styleSupportsImages(styleId) {
  return styleId === 'modern' || styleId === 'visual';
}

// Draft override -> business default -> Classic. A non-entitled choice is reported, never silently rewritten:
// the caller decides (preview shows it as locked; issue refuses it; the stored draft value is preserved).
export function resolveEffectiveStyle({ draftStyle, businessDefault, tierId }) {
  const requested = normalizeStyleId(draftStyle) || normalizeStyleId(businessDefault) || DEFAULT_QUOTE_STYLE;
  const source = normalizeStyleId(draftStyle) ? 'draft' : normalizeStyleId(businessDefault) ? 'business_default' : 'fallback';
  return { style: requested, source, entitled: isStyleIncluded(tierId, requested) };
}

// Customer-facing / owner-facing copy (from the approved refined R2 package).
// cloud-fix4b (A17 K2, truth): the Classic bullet names the four fields instead of "four columns" - on phones with long
// amounts the description takes its own full row (narrowItems.css), so a visual four-column promise would be inaccurate.
export const STYLE_COPY = Object.freeze({
  he: {
    classic: {
      title: 'Classic',
      description: 'מסמך עסקי לבן, נקי וישיר שמבליט את זהות העסק, פרטי ההצעה והסכום הסופי.',
      benefits: ['מתאים לעסק שרוצה מסמך רשמי ומאופק', 'טבלת פריטים ברורה עם ארבעת השדות', 'סיכום ותנאי אישור שקל לסרוק'],
    },
    modern: {
      title: 'Modern עם תמונות',
      description: 'תמונות מוצר עוזרות ללקוח להבין מה הוא מקבל, בלי לפגוע בקריאות הפריטים, המחירים והסיכום.',
      benefits: ['תמונות מוצר כחלק מההצעה', 'כותרת פרויקט ומידע מסודר', 'סיכום מסחרי ברור לצד פרטי ההצעה'],
    },
    visual: {
      title: 'Visual',
      description: 'תמונה ראשית, פרטים תומכים וכיתובים נותנים לפרויקט הקשר עשיר יותר לפני המעבר להצעה המסחרית המלאה.',
      benefits: ['סקירת פרויקט חזותית בפתיחה', 'תמונות תומכות עם כיתובים משמעותיים', 'אותה טבלת פריטים ומחירים מלאה'],
    },
  },
  en: {
    classic: {
      title: 'Classic',
      description: 'A clean, direct business document that gives the business identity, quote details and final amount a clear hierarchy.',
      benefits: ['For businesses that prefer a formal, restrained document', 'A legible item table with all four fields', 'An approval section that is easy to scan'],
    },
    modern: {
      title: 'Modern with images',
      description: 'Product images help customers understand the offer while item details, prices and the commercial summary remain clear.',
      benefits: ['Product imagery within the quotation', 'An organized project title and details', 'A clear commercial summary alongside the offer'],
    },
    visual: {
      title: 'Visual',
      description: 'A primary image, supporting details and captions give the project richer context before the complete commercial quotation.',
      benefits: ['An image-led project overview', 'Supporting visuals with meaningful captions', 'The same complete item and pricing table'],
    },
  },
});
