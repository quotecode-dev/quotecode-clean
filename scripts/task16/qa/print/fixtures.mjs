import { createHash } from 'node:crypto';
// Task 16 cloud-fix3 (A6) - SYNTHETIC public-quote fixtures for the print-pagination and long-amount checks.
// Every value is invented (example.com / 555 numbers / fictional companies). The DTOs have the get-public-quote shape
// ({ quote, business, client, items, attachments, sections }) so the same JSON can be fed to the approved base renderer
// (c65f742) and to the candidate through the real /quote/:id route (SmartPublicQuote -> PublicQuote / PublicQuoteEn).
// HE fixtures are ILS + tax_rate 0.18 (PublicQuote), EN fixtures are USD/EUR/GBP + tax_rate 0 (PublicQuoteEn).
// Money stored with full precision (cents); the ILS document DISPLAYS whole shekels - the fixture never pre-rounds.

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// synthetic hand-drawn-looking signature (SVG data URI; the renderer only requires a data:image URL)
export const SIGNATURE_PNG = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80"><path d="M10 60 C 40 10, 70 70, 100 30 S 160 60, 190 25 S 250 50, 290 35" stroke="#111" stroke-width="3" fill="none"/></svg>')}`;
// small synthetic logo (SVG data URI)
export const LOGO_SVG = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60"><rect width="160" height="60" rx="8" fill="#1f3a5f"/><text x="80" y="38" font-size="22" text-anchor="middle" fill="#fff" font-family="Arial">LOGO</text></svg>')}`;

const T = {
  he: {
    biz: { business_name: 'נגריית האלון הצפוני', email: 'office@example.com', phone: '050-5550101', address: 'רחוב התעשייה 12|קריית אתא', tax_id: '515555555', logo_url: null },
    client: { company_name: 'מרכז הלוגיסטיקה גליל מערבי בע״מ', email: 'purchasing@example.com', phone: '04-5550199', address: 'שדרות ההסתדרות 120, קומה 3|חיפה' },
    attn: 'יעל כהן-ברק', role: 'מנהלת רכש ותפעול',
    subject: 'ריהוט משרדי בהתאמה אישית', project: 'ייצור והתקנה של עמדות עבודה וארונות אחסון לקומת המשרדים החדשה',
    notesShort: 'המחיר כולל הובלה והתקנה.',
    termsShort: 'שוטף + 30.',
    notes: 'המחיר כולל הובלה, התקנה באתר ופינוי פסולת. גוון סופי ודוגמת פורניר יאושרו מול הלקוח לפני תחילת הייצור. עבודות חשמל ותקשורת אינן כלולות.',
    terms: '40% מקדמה עם אישור ההצעה, 40% עם תחילת ההתקנה ו-20% במסירה. זמן אספקה משוער: 30 ימי עבודה ממועד אישור השרטוטים. אחריות לשנה על פרזול ומנגנונים.',
    notesLong: 'המחיר כולל הובלה, התקנה באתר ופינוי פסולת. גוון סופי ודוגמת פורניר יאושרו מול הלקוח לפני תחילת הייצור. עבודות חשמל, תקשורת, אינסטלציה וצבע אינן כלולות בהצעה זו ויתומחרו בנפרד במידת הצורך. כל שינוי במידות לאחר אישור השרטוטים יחייב עדכון מחיר ולוח זמנים. הלקוח אחראי לגישה חופשית לאתר, למעלית משא ולחניה לרכב ההובלה בימי ההתקנה.',
    termsLong: '40% מקדמה עם אישור ההצעה, 40% עם תחילת ההתקנה ו-20% במסירה. זמן אספקה משוער: 30 ימי עבודה ממועד אישור השרטוטים הסופיים. אחריות לשנה על פרזול ומנגנונים ולחמש שנים על שלד הארונות. ההצעה בתוקף ל-30 יום. המחירים אינם כוללים מע״מ אלא אם צוין אחרת. ביטול לאחר תחילת הייצור יחויב בעלות החומרים שנרכשו.',
    rows: [
      { d: 'עמדת עבודה כפולה', s: 'משטח למינציה 28 מ״מ, רגלי מתכת שחורות, תעלת כבלים', q: 6, p: 2450 },
      { d: 'ארון אחסון גבוה', s: 'פורניר אלון, 4 מדפים מתכווננים, מנעול', q: 4, p: 3180 },
      { d: 'שולחן ישיבות', s: '240×110 ס״מ, פורניר אלון, הכנה לשקעים', q: 1, p: 6900 },
      { d: 'התקנה והובלה', s: 'הובלה, הרכבה באתר ופינוי אריזות', q: 1, p: 1800 },
    ],
    longRow: (i) => ({ d: `פריט ייצור מס׳ ${i + 1} קוד R${String(i + 1).padStart(3, '0')}`, s: `מפרט שורה ${i + 1}`, q: (i % 3) + 1, p: 400 + i * 15 }),
    footerRe: /מסמך זה נערך/,
    attach: [{ name: 'שרטוט-עמדות.pdf', url: 'https://example.com/a1.pdf' }, { name: 'הדמיה-קומה.jpg', url: 'https://example.com/a2.jpg' }],
  },
  en: {
    biz: { business_name: 'Northern Oak Joinery', email: 'office@example.com', phone: '+1 555 0101', address: '12 Industry Road|Springfield', tax_id: 'US-55-5555555', logo_url: null },
    client: { company_name: 'Western Galilee Logistics Center Ltd.', email: 'purchasing@example.com', phone: '+1 555 0199', address: '120 Harbor Boulevard, Floor 3|Portland' },
    attn: 'Jordan Whitfield-Barker', role: 'Purchasing & Operations Manager',
    subject: 'Custom office furniture', project: 'Fabrication and installation of workstations and storage units for the new office floor',
    notesShort: 'Price includes delivery and installation.',
    termsShort: 'Net 30.',
    notes: 'Price includes delivery, on-site installation and waste removal. Final finish and veneer sample will be approved with the client before fabrication starts. Electrical and data work is not included.',
    terms: '40% deposit on approval, 40% at the start of installation and 20% on handover. Estimated lead time: 30 business days from approval of the drawings. One-year warranty on hardware and mechanisms.',
    notesLong: 'Price includes delivery, on-site installation and waste removal. Final finish and veneer sample will be approved with the client before fabrication starts. Electrical, data, plumbing and paint work are not included in this quote and will be priced separately if required. Any change of dimensions after drawing approval requires an updated price and schedule. The client provides free site access, a freight elevator and parking for the delivery truck on installation days.',
    termsLong: '40% deposit on approval, 40% at the start of installation and 20% on handover. Estimated lead time: 30 business days from approval of the final drawings. One-year warranty on hardware and mechanisms and five years on cabinet carcasses. This quote is valid for 30 days. Cancellation after fabrication has started is charged at the cost of materials already purchased.',
    rows: [
      { d: 'Double workstation', s: '28 mm laminate top, black steel legs, cable tray', q: 6, p: 2450 },
      { d: 'Tall storage cabinet', s: 'Oak veneer, 4 adjustable shelves, lock', q: 4, p: 3180 },
      { d: 'Meeting table', s: '240x110 cm, oak veneer, power-ready', q: 1, p: 6900 },
      { d: 'Installation & delivery', s: 'Delivery, on-site assembly and packaging removal', q: 1, p: 1800 },
    ],
    longRow: (i) => ({ d: `Fabrication item no. ${i + 1} code R${String(i + 1).padStart(3, '0')}`, s: `Row ${i + 1} specification`, q: (i % 3) + 1, p: 400 + i * 15 }),
    footerRe: null,
    attach: [{ name: 'workstation-drawing.pdf', url: 'https://example.com/a1.pdf' }, { name: 'floor-render.jpg', url: 'https://example.com/a2.jpg' }],
  },
};

function item(r) {
  const it = {
    description: r.d,
    quantity: r.q,
    unit_price: r.p,
    price: r.p,
    pricing_unit: r.unit || null,
    calculated_quantity: r.cq ?? null,
    quantity_source: r.unit ? 'manual' : null,
    calculation_method: r.unit ? 'manual' : null,
    specification: r.s ? [{ label: '', value: r.s }] : [],
    measurements: [],
    section_id: null,
  };
  const qty = r.cq != null ? Number(r.cq) : Number(r.q);
  it.total_price = round2(qty * Number(r.p));
  return it;
}

// Financials as the save path stores them: subtotal (sum of line totals), discount (%), total (net + VAT for HE business).
function financials(items, { taxRate, discount }) {
  const subtotal = round2(items.reduce((a, i) => a + i.total_price, 0));
  const discountAmount = round2(subtotal * (Number(discount || 0) / 100));
  const net = round2(subtotal - discountAmount);
  const total = round2(net * (1 + taxRate));
  return { subtotal, total };
}

/**
 * build({ locale, rows, notes, terms, clientDetails, attn, attachments, business, logo, signed, discount, currency, name })
 *   rows: number (1-4 = the realistic rows, >4 = synthetic repeated rows) or an explicit row array [{ d, s, q, p, cq, unit }]
 *   notes/terms: 'none' | 'short' | 'medium' | 'long'
 *   clientDetails: 'full' | 'none' ; attn: 'full' | 'name' | 'none' ; attachments: 0 | 2
 *   business: 'full' | 'min' ; logo: bool ; signed: bool
 *   notesText / termsText: explicit text (overrides notes / terms; used by the footer-orphan sweep)
 */
export function build(o) {
  const L = o.locale === 'en' ? 'en' : 'he';
  const t = T[L];
  let rows;
  if (Array.isArray(o.rows)) rows = o.rows;
  else if (o.rows <= 4) rows = t.rows.slice(0, o.rows);
  else rows = Array.from({ length: o.rows }, (_, i) => t.longRow(i));
  const items = rows.map(item);
  const taxRate = L === 'he' ? 0.18 : 0;
  const discount = o.discount ?? 0;
  const fin = financials(items, { taxRate, discount });
  const pick = (k) => ({ none: null, short: t[`${k}Short`], medium: t[k], long: t[`${k}Long`] }[o[k] || 'medium']);
  const biz = o.business === 'min'
    ? { business_name: t.biz.business_name, email: null, phone: null, address: null, tax_id: null, logo_url: null }
    : { ...t.biz };
  if (o.logo) biz.logo_url = LOGO_SVG;
  const client = o.clientDetails === 'none'
    ? { company_name: t.client.company_name, email: null, phone: null, address: null }
    : { ...t.client };
  const quote = {
    id: '00000000-0000-4000-9000-0000000000aa',
    quote_number: 2207,
    status: o.signed ? 'approved' : 'sent',
    signature: o.signed ? SIGNATURE_PNG : null,
    currency: o.currency || (L === 'he' ? 'ILS' : 'USD'),
    tax_rate: taxRate,
    client_type: 'business',
    is_owner_viewing: false,
    subtotal: fin.subtotal,
    discount,
    total: fin.total,
    created_at: '2026-10-01',
    valid_until: '2027-12-31',
    subject: t.subject,
    project_name: t.project,
    attn_name: o.attn === 'none' ? null : t.attn,
    attn_role: o.attn === 'full' ? t.role : null,
    terms: o.termsText !== undefined ? o.termsText : pick('terms'),
    notes: o.notesText !== undefined ? o.notesText : pick('notes'),
    warranty: null,
  };
  return {
    name: o.name,
    locale: L,
    quoteData: { quote, business: biz, client, items, attachments: o.attachments ? t.attach : [], sections: [] },
    rowDescriptions: items.map((i) => i.description),
  };
}

export const presentationFor = (style, media = []) => ({ mode: 'draft', style, styleVersion: 1, branding: null, media });

// The pagination fixture grid (per locale). `short*` fixtures are expected to fit on ONE A4 page in every style; the
// long ones must paginate and keep every row.
export const PAGINATION_FIXTURES = [
  { name: 'short-1item-min', rows: 1, notes: 'short', terms: 'short', clientDetails: 'none', attn: 'none', business: 'min' },
  { name: 'short-2items', rows: 2, notes: 'short', terms: 'short', clientDetails: 'full', attn: 'name', business: 'full' },
  { name: 'short-3items-attn', rows: 3, notes: 'medium', terms: 'medium', clientDetails: 'full', attn: 'full', business: 'full' },
  { name: 'test-like', rows: 3, notes: 'medium', terms: 'medium', clientDetails: 'full', attn: 'full', business: 'full', discount: 5 },
  { name: 'test-like-logo', rows: 3, notes: 'medium', terms: 'medium', clientDetails: 'full', attn: 'full', business: 'full', discount: 5, logo: true },
  { name: 'test-like-attach', rows: 3, notes: 'medium', terms: 'medium', clientDetails: 'full', attn: 'full', business: 'full', discount: 5, attachments: 2 },
  { name: 'test-like-signed', rows: 3, notes: 'medium', terms: 'medium', clientDetails: 'full', attn: 'full', business: 'full', discount: 5, signed: true },
  { name: 'short-4items-longnotes', rows: 4, notes: 'long', terms: 'long', clientDetails: 'full', attn: 'full', business: 'full', discount: 5 },
  { name: 'long-18', rows: 18, notes: 'medium', terms: 'medium', clientDetails: 'full', attn: 'full', business: 'full', discount: 10 },
  { name: 'long-40', rows: 40, notes: 'medium', terms: 'medium', clientDetails: 'full', attn: 'full', business: 'full', discount: 10 },
];

// Long-amount fixture (Task 2): 7- and 8-digit amounts, decimal quantities, a long description, discount and VAT.
// ILS displays whole shekels; USD/EUR/GBP keep cents; quantities keep their decimals.
export function longAmounts(locale, currency) {
  const L = locale === 'en' ? 'en' : 'he';
  const desc = L === 'he'
    ? 'מערכת חזיתות אלומיניום וזכוכית מבודדת לבניין משרדים בן שתים-עשרה קומות כולל פרופילים תרמיים, אטמים והתקנה מלאה בגובה'
    : 'Aluminium and insulated-glass facade system for a twelve-storey office building including thermal profiles, seals and full installation at height';
  const cents = currency && currency !== 'ILS';
  const rows = [
    { d: desc, s: L === 'he' ? 'כולל פיגומים ומנוף' : 'Scaffolding and crane included', q: 1, cq: 3.375, unit: 'm2', p: cents ? 1250000.75 : 1250000 },
    { d: L === 'he' ? 'מערכת מיזוג מרכזית' : 'Central HVAC plant', s: '', q: 1, p: cents ? 12500000.5 : 12500000 },
    { d: L === 'he' ? 'עבודות גמר' : 'Finishing works', s: '', q: 12, cq: 12.5, unit: 'm2', p: cents ? 98765.43 : 98765 },
  ];
  const f = build({ name: `long-amounts-${L}-${currency || 'ILS'}`, locale: L, rows, notes: 'short', terms: 'short', clientDetails: 'full', attn: 'full', business: 'full', discount: 7.5, currency });
  return f;
}

// Synthetic filler text of ~n characters (whole words) for the sweep.
export function fillerText(locale, n) {
  const base = locale === 'en'
    ? 'Site measurements are confirmed before fabrication and every panel is labelled for installation. '
    : 'מדידות האתר מאושרות לפני הייצור וכל לוח מסומן לצורך ההתקנה באתר. ';
  let s = '';
  while (s.length < n) s += base;
  return s.slice(0, n).replace(/\s+\S*$/, '').trim();
}

// cloud-fix4b (A13): CONTENT FINGERPRINT of a quote document - what a page count may be bound to (never the word "short"):
// the item rows (description, quantity, price, detail), the media (url, role, caption), notes / terms / warranty, the
// subject / project, the parties and the business identity. Same data => same fingerprint; any added row, image or text
// changes it, so an expectation recorded for one fixture can never silently cover different content.
export function contentFingerprint(quoteData, presentation = null) {
  const q = quoteData.quote || {};
  const media = Array.isArray(presentation?.media) ? presentation.media : [];
  const rows = (quoteData.items || []).map((i) => [i.description, i.quantity, i.calculated_quantity ?? null, i.unit_price ?? i.price, (i.specification || []).map((x) => `${x.label}:${x.value}`).join('|')]);
  const payload = {
    rows, media: media.map((m) => [m.url, m.role, m.caption || '', m.itemKey || null]),
    text: [q.subject, q.project_name, q.notes, q.terms, q.warranty, q.attn_name, q.attn_role, q.discount, q.currency, q.status, !!q.signature],
    client: [quoteData.client?.company_name, quoteData.client?.email, quoteData.client?.phone, quoteData.client?.address],
    business: [quoteData.business?.business_name, quoteData.business?.email, quoteData.business?.address, quoteData.business?.tax_id, !!quoteData.business?.logo_url],
    attachments: (quoteData.attachments || []).length,
  };
  return { rows: rows.length, images: media.length, fp: createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16) };
}

// cloud-fix4 / 4b (A13): short fixtures whose print content at the SCREEN type (with the restored base panels) is taller
// than one A4 content box (1031.8 CSS px) even with the A4 layout layer - 2 pages asserted, with REAL content on page 2
// (the end group .pq-doc-end = last body block + approval / signature record + footer moves as one: no orphan, every
// row, semantic approval placement). Each waiver is BOUND to its fixture's content fingerprint (fp, filled from
// contentFingerprint(build(...))): a waiver whose fixture content changed FAILS (print/waiver-bound) instead of
// legitimising 2 pages for different content. Measured overflow (cloud-fix4b) in the reason.
export const PRINT_WAIVERS = {
  'test-like-signed/he/classic': { reason: 'signature record (+41px)', rows: 3, images: 0, fp: 'd188d67a4140d545' }, 'test-like-signed/he/modern': { reason: 'signature record (+71px)', rows: 3, images: 0, fp: 'd188d67a4140d545' },
  'test-like-signed/he/visual': { reason: 'signature record (+10px)', rows: 3, images: 0, fp: 'd188d67a4140d545' }, 'test-like-signed/en/modern': { reason: 'signature record (+28px)', rows: 3, images: 0, fp: '2b25b22284c1dab5' },
  'short-4items-longnotes/he/classic': { reason: 'long notes (+33px)', rows: 4, images: 0, fp: '83c3e72b4b71c357' }, 'short-4items-longnotes/he/modern': { reason: 'long notes (+24px)', rows: 4, images: 0, fp: '83c3e72b4b71c357' },
  'short-4items-longnotes/en/classic': { reason: 'long notes (+33px)', rows: 4, images: 0, fp: '8a7ca9d2a55ecfe5' }, 'short-4items-longnotes/en/modern': { reason: 'long notes (+25px)', rows: 4, images: 0, fp: '8a7ca9d2a55ecfe5' },
  'short-4items-longnotes/en/visual': { reason: 'long notes (+15px)', rows: 4, images: 0, fp: '8a7ca9d2a55ecfe5' },
};
