// Owner console 2026-10-27, typed: "מאשר את האיורים" (style 2 - a drawn small-business character beside the topic, in the agents-room
// character line, calm TEKANGO backgrounds; the Owner left the choice to Claude: "תעשה מה שאתה חושב שיהיה הכי נכון"). Eight illustrations
// under public/guides/art/<key>.svg, the same image for both languages (no text inside). A static guide has a fixed one; a database guide
// gets one by the words of its address, else the general "writing a quote" one - never a database or function change.
export const ART_KEYS = Object.freeze(['pricing', 'quote', 'signature', 'measure', 'renovation', 'currency', 'followup', 'send']);

const FIXED = Object.freeze({
  'how-to-write-a-quote-clients-approve': 'quote',
  'renovation-contractor-quote': 'renovation',
  'quote-by-measurements': 'measure',
  'import-pricing-currency-conversion': 'currency',
});

// first match wins, in this order (a "price" guide is about pricing even when it also says "quote")
const BY_WORD = [
  ['pricing', /^(price|prices|pricing|cost|costs|rate|rates|margin|markup)$/],
  ['signature', /^(sign|signed|signature|signatures|esign)$/],
  ['measure', /^(measure|measures|measurement|measurements|meter|meters|sqm|area|size|sizes)$/],
  ['renovation', /^(renovation|renovations|contractor|contractors|construction|build|builder|painting|paint|plumbing|plumber|electrician|tiling|flooring)$/],
  ['currency', /^(currency|currencies|import|imports|exchange|dollar|euro|forex)$/],
  ['followup', /^(follow|followup|tracking|track|reminder|reminders|status)$/],
  ['send', /^(send|sending|whatsapp|email|emails|share|sharing)$/],
];

export function articleArt(slug) {
  if (FIXED[slug]) return FIXED[slug];
  const words = String(slug || '').toLowerCase().split('-');
  for (const [key, re] of BY_WORD) if (words.some((w) => re.test(w))) return key;
  return 'quote';
}

// the image description for screen readers, in the page's language
export const ART_ALT = Object.freeze({
  pricing: { he: 'איור: בעל עסק עם מחשבון, תג מחיר ומטבעות', en: 'Illustration: a business owner with a calculator, a price tag and coins' },
  quote: { he: 'איור: בעלת עסק לצד הצעת מחיר שנכתבת', en: 'Illustration: a business owner beside a quote being written' },
  signature: { he: 'איור: הצעת מחיר חתומה ולקוחה עם טלפון', en: 'Illustration: a signed quote and a client with a phone' },
  measure: { he: 'איור: בעל מקצוע לצד תוכנית עם מידות וסרט מדידה', en: 'Illustration: a tradesperson beside a floor plan with dimensions and a tape measure' },
  renovation: { he: 'איור: קבלן צובע קיר ברולר', en: 'Illustration: a contractor painting a wall with a roller' },
  currency: { he: 'איור: גלובוס, מטבעות דולר ואירו וארגז יבוא', en: 'Illustration: a globe, dollar and euro coins and an import box' },
  followup: { he: 'איור: רשימת הצעות עם סימני מצב ופעמון תזכורת', en: 'Illustration: a list of quotes with status marks and a reminder bell' },
  send: { he: 'איור: טלפון עם הודעות, מעטפה ובעל עסק ששולח', en: 'Illustration: a phone with messages, an envelope and a business owner sending' },
});

export const artSrc = (key) => `/guides/art/${key}.svg`;
