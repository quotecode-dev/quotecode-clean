// Task 16 (correction A) - the landing's sample quotation model (pure; SSR-safe; no window/document).
// Rows, quantities and every amount come from the SAME synthetic fixture the real /he|en/sample-quote page renders
// (src/quoteDocument/sampleQuotes.js: buildSampleItems + computeSampleFinancials, i.e. the save path's own rules),
// so the landing document can never show numbers the sample page would not.
//   HE (Local / ILS) - IRON-ILS-001: every displayed amount is whole-shekel with ".00" (formatWholeMoney); the shown
//   VAT is the whole-shekel total minus the whole-shekel net, so the displayed lines always add up exactly.
//   EN (International) - formatMoney (full cent precision), no tax line (International VAT rate is 0).
// Dates follow IRON-DATE-001: Local DD/MM/YYYY, International MM/DD/YYYY. Synthetic personas only (IRON-DATA-001).
import { buildSampleItems, buildSampleMedia, computeSampleFinancials, SAMPLE_DISCOUNT_PERCENT } from '../../quoteDocument/sampleQuotes';
import { mediaForItem } from '../../quoteDocument/quoteMediaModel';
import { getActiveQuantity } from '../../utils/professionalQuoteItem';
import { formatMoney, formatWholeMoney, roundHalfUpWhole } from '../../utils/money';
import { formatShortDate } from '../../utils/shortDate';

// Fixed synthetic sample dates (date-only, so no time-zone shift), formatted by the product short-date primitive.
const SAMPLE_DATE = '2026-10-04';
const SAMPLE_VALID_UNTIL = '2026-10-31';

const DOC_COPY = {
  he: {
    country: 'Local',
    logo: '/task16-samples/vistaro-symbol.png',
    business: 'ויסטארו',
    businessLine: 'חלונות, דלתות ומעטפת בניין · חיפה',
    businessPhone: '050-1234567',
    businessEmail: 'office@vistaro.example',
    businessAddress: 'דרך התעשייה 12, חיפה',
    // Recipient data, separated (the public renderer's base contract): the CLIENT (company + its details) and the
    // independent attention CONTACT (name + optional role). The business is never a recipient party.
    client: { name: 'מרחבי צפון בע״מ', details: ['דרך הנמל 18, חיפה'] },
    contact: { name: 'נועה לוי', role: 'מנהלת לוגיסטיקה' },
    title: 'עבודות אלומיניום למשרד',
    subtitle: 'ייצור והתקנת חלונות, מחיצת זכוכית ודלת אלומיניום',
    number: 'Q-1048',
    chip: 'דוגמה',
    notes: 'המחיר כולל הובלה והתקנה באזור חיפה. גוון הפרופיל והזכוכית יאושרו לפני הייצור.',
    terms: '50% בתחילת עבודה, יתרה במסירה. זמן אספקה משוער: 21 ימי עבודה.',
    labels: {
      quote: 'הצעת מחיר', number: 'מס׳ הצעה', date: 'תאריך', valid: 'בתוקף עד', to: 'לכבוד', attn: 'לידי',
      item: 'פריט ותיאור', qty: 'כמות', unit: 'מחיר יחידה', amount: 'סכום', subtotal: 'סכום ביניים',
      discount: `הנחה (${SAMPLE_DISCOUNT_PERCENT}%)`, tax: 'מע״מ (18%)', total: 'סה״כ לתשלום', notes: 'הערות', terms: 'תנאים',
      approve: 'אישור ההצעה', approveText: 'חתימת הלקוח מאשרת את תנאי ההצעה', signature: 'חתימה',
      call: 'התקשרות לעסק', pdf: 'הורדה כ-PDF', print: 'הדפסת המסמך', whatsapp: 'וואטסאפ',
    },
  },
  en: {
    country: 'International',
    logo: '/task16-samples/vistaro-symbol.png',
    business: 'VISTARO',
    businessLine: 'Windows, doors & building envelope · Portland',
    businessPhone: '+1 503 555 0148',
    businessEmail: 'office@vistaro.example',
    businessAddress: '4 Industry Way, Portland',
    client: { name: 'Northline Workspaces Ltd.', details: ['18 Harbor Way, Portland'] },
    contact: { name: 'Nora Lane', role: 'Logistics Manager' },
    title: 'Office aluminum works',
    subtitle: 'Fabrication and installation of windows, a glass partition and an aluminum door',
    number: 'Q-1048',
    chip: 'Sample',
    notes: 'Price includes delivery and installation in Portland. Profile finish and glazing will be approved before fabrication.',
    terms: '50% at start, balance on handover. Estimated lead time: 21 business days.',
    labels: {
      quote: 'Quotation', number: 'Quote number', date: 'Date', valid: 'Valid through', to: 'To', attn: 'Attn',
      item: 'Item & description', qty: 'Qty.', unit: 'Unit price', amount: 'Amount', subtotal: 'Subtotal',
      discount: `Discount (${SAMPLE_DISCOUNT_PERCENT}%)`, tax: 'Tax', total: 'Total', notes: 'Notes', terms: 'Terms',
      approve: 'Quote approval', approveText: 'The customer’s signature confirms the quotation terms', signature: 'Signature',
      call: 'Call me', pdf: 'Download PDF', print: 'Print document', whatsapp: 'WhatsApp',
    },
  },
};

function resolveContact(fixture, override) {
  if (override === false || override === null) return null;
  const src = override && typeof override === 'object' ? override : fixture;
  if (!src || !src.name) return null;
  return { name: src.name, role: src.role || null };
}

function formatQty(n) {
  const v = Number(n);
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

// options.contact: omitted/true -> the fixture's attention contact; false/null -> no contact (the document then renders
// NO contact block); an object { name, role? } -> that contact (synthetic only).
export function buildLandingQuoteModel(locale = 'he', options = {}) {
  const lang = locale === 'en' ? 'en' : 'he';
  const c = DOC_COPY[lang];
  const items = buildSampleItems(lang, 'short');
  const fin = computeSampleFinancials(items, { country: c.country, clientType: 'business', discount: SAMPLE_DISCOUNT_PERCENT });
  const isLocal = lang === 'he';
  const money = isLocal ? (v) => `₪${formatWholeMoney(v)}` : (v) => `$${formatMoney(v)}`;
  let subtotal = fin.subtotal;
  let discount = fin.discountAmount;
  let tax = fin.taxAmount;
  let total = fin.total;
  if (isLocal) {
    // IRON-ILS-001 display (the PublicQuote pattern): whole-shekel total; VAT shown as total minus whole-shekel net.
    total = roundHalfUpWhole(fin.total);
    tax = total - roundHalfUpWhole(fin.netAmount);
    subtotal = roundHalfUpWhole(fin.subtotal);
    discount = roundHalfUpWhole(fin.discountAmount);
  }
  const details = lang === 'he'
    ? ['ייצור לפי מידה, פרופיל שחור וזכוכית בידודית', 'פרופיל דק, זכוכית בטיחות והכנה לעיגון', 'הובלה, התקנה באתר, איטום ובדיקת מסירה']
    : ['Made to measure, black profile and insulated glazing', 'Slim profile, safety glass and prepared anchoring', 'Delivery, on-site installation, sealing and handover check'];
  const allMedia = buildSampleMedia(lang);
  const sampleMedia = allMedia.filter((entry) => !entry.itemKey).slice(0, 3);
  return {
    lang,
    dir: isLocal ? 'rtl' : 'ltr',
    ...c,
    contact: resolveContact(c.contact, options.contact),
    date: formatShortDate(SAMPLE_DATE, c.country),
    valid: formatShortDate(SAMPLE_VALID_UNTIL, c.country),
    rows: items.map((it, i) => {
      const image = mediaForItem(allMedia, it.description);
      return {
        name: it.description,
        detail: details[i] || '',
        qty: formatQty(getActiveQuantity(it)),
        unit: money(it.unit_price),
        amount: money(it.total_price),
        image: image ? { src: image.url, alt: image.alt || it.description } : null,
      };
    }),
    totals: {
      subtotal: money(subtotal),
      discount: `−${money(discount)}`,
      tax: Number(fin.taxRate) > 0 ? money(tax) : null,
      total: money(total),
    },
    raw: { subtotal, discount, tax, total },
    images: sampleMedia.map((entry) => ({ src: entry.url, caption: entry.caption })),
  };
}

export function sampleQuoteHref(locale, styleId = 'classic') {
  return `${locale === 'en' ? '/en' : '/he'}/sample-quote?style=${encodeURIComponent(styleId)}`;
}

// Accessible landing CTA fill: white text on #315f6f = 7.0:1 (restrained teal, IRON-LANDING visual language).
export const LANDING_ACCENT = '#315f6f';
