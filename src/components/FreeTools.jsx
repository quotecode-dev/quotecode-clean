// Owner console 2026-11-26, typed: "מאשר ליישם בשחרור אחד את שורת הביטחון, הכלים החינמיים, דף היכולת בלי חלק הסרטון עד שיצולם, קובץ ההסבר
// למנועי AI ודף ההשוואה כמו בסקיצות, ולשחרר עד הלייב" (sketch TEKANGO-sketch-free-tools-2026-11-26; Owner choices: "ב" - the VAT / sales-tax
// calculator only as a card on the tools hub, its own page WITHOUT a fifth tab in the calculators' tab row; "א" - the template saves nothing,
// to save or send you sign up). Two free public pages, no sign-up:
// - the free quote template: business, client and work lines with a live preview, downloaded as a PDF by the product's own PDF tool
//   (src/utils/generateQuotePdf.js, called - never changed, L-28), loaded only on the click; nothing is stored anywhere;
// - the VAT calculator (Israel, 18% - src/utils/regionConfig.js) / the sales-tax calculator (international: the rate differs by state and
//   city, so the user types it; no "VAT", no shekel).
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Plus } from 'lucide-react';
import ProFlowLogo from './ProFlowLogo';
import { FONT_HE } from '../theme/neonTheme';
import { TOOLS } from '../theme/toolsLightTheme';
import { setSeoMeta } from '../utils/seoMeta';
import { publicSeo } from '../shared/publicSeoRoutes';
import { parseToolNumber as parseRaw, INPUT_ERRORS, formatToolNumber } from '../utils/publicToolsCore';
import './freeTools.css';

// a typed amount may carry thousands separators (shown as 4,500 once the field is left, as in the sketch)
const parseToolNumber = (v, o) => parseRaw(String(v ?? '').replace(/,/g, ''), o);
const grouped = (v) => { const r = parseToolNumber(v); return r.ok ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(r.value) : v; };

const IL_VAT_RATE = 0.18; // the Israeli rate since 01/01/2025 (src/utils/regionConfig.js, Local)

const FREE_TOOL_PATHS = Object.freeze({
  template: { he: '/he/tools/quote-template', en: '/en/tools/quote-template' },
  tax: { he: '/he/tools/tax', en: '/en/tools/tax' },
});

const COPY = {
  he: {
    home: 'חזרה לדף הבית',
    template: {
      h1: 'תבנית הצעת מחיר חינמית',
      intro: 'ממלאים, רואים את ההצעה ומורידים PDF. בלי הרשמה ובלי כרטיס אשראי.',
      business: 'פרטי העסק', businessName: 'שם העסק', phone: 'טלפון', client: 'הלקוח', clientName: 'שם הלקוח',
      lines: 'שורות העבודה', desc: 'תיאור', qty: 'כמות', price: 'מחיר', addLine: 'שורה',
      preview: 'כך תיראה ההצעה', docTitle: 'הצעת מחיר', to: 'לכבוד', amount: 'סכום',
      subtotal: 'סכום ביניים', vat: 'מע״מ (18%)', total: 'סה״כ לתשלום',
      phBusiness: 'אלון שיפוצים', phPhone: '050-1234567', phClient: 'משפחת לוי', phDesc: 'צביעת דירה',
      pdf: 'הורדת PDF', pdfBusy: 'מכינים את הקובץ…', pdfError: 'לא הצלחנו להכין את הקובץ. נסו שוב.',
      file: 'הצעת-מחיר.pdf',
      ctaH: 'רוצים לשלוח את ההצעה ללקוח ולקבל חתימה?',
      ctaP: 'ב-TEKANGO שולחים בוואטסאפ או במייל, רואים מתי הלקוח פתח, והוא חותם מהטלפון.',
      cta: '10 הצעות חינם',
    },
    tax: {
      h1: 'מחשבון מע״מ',
      intro: 'הוספת מע״מ לסכום או חילוץ המע״מ מסכום כולל, לפי שיעור המע״מ בישראל (18%).',
      h2: 'מחשבון מע״מ', add: 'הוספת מע״מ', extract: 'חילוץ מע״מ מסכום כולל',
      amountAdd: 'סכום לפני מע״מ (₪)', amountExtract: 'סכום כולל מע״מ (₪)', rate: 'שיעור המע״מ', rateNote: 'השיעור בישראל מ-01/01/2025.',
      totalWith: 'סה״כ כולל מע״מ', before: 'לפני מע״מ', vatPart: 'מע״מ',
    },
  },
  en: {
    home: 'Back to home',
    template: {
      h1: 'Free quote template',
      intro: 'Fill it in, see the quote and download a PDF. No sign-up, no card needed.',
      business: 'Your business', businessName: 'Business name', phone: 'Phone', client: 'Client', clientName: 'Client name',
      lines: 'Work lines', desc: 'Description', qty: 'Qty', price: 'Price', addLine: 'Line',
      preview: 'How the quote will look', docTitle: 'Quote', to: 'To', amount: 'Amount',
      subtotal: 'Subtotal', total: 'Total',
      phBusiness: 'Alon Renovations', phPhone: '(555) 123-4567', phClient: 'The Levi Family', phDesc: 'Apartment painting',
      pdf: 'Download PDF', pdfBusy: 'Preparing the file…', pdfError: 'We could not prepare the file. Please try again.',
      file: 'quote.pdf',
      ctaH: 'Want to send it to your client and get it signed?',
      ctaP: 'With TEKANGO you send by WhatsApp or e-mail, see when the client opened it, and they sign from the phone.',
      cta: '10 free quotes',
    },
    tax: {
      h1: 'Sales tax calculator',
      intro: 'Add sales tax to an amount or take it out of a total. Rates differ by state and city, so you enter your own rate.',
      h2: 'Sales tax calculator', add: 'Add tax', extract: 'Remove tax from a total',
      amountAdd: 'Amount before tax ($)', amountExtract: 'Total with tax ($)', rate: 'Tax rate (%)', rateNote: 'Enter the rate for your state and city.',
      ratePh: 'e.g. 8.25', totalWith: 'Total with tax', before: 'Before tax', vatPart: 'Tax',
    },
  },
};

const money = (n, he) => (he ? `₪${formatToolNumber(n, 'he-IL', 2, 2)}` : `$${formatToolNumber(n, 'en-US', 2, 2)}`);
const labelStyle = { display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600, color: TOOLS.textSecondary };
const inputStyle = { width: '100%', padding: '12px', border: `1px solid ${TOOLS.borderStrong}`, borderRadius: '7px', minHeight: '44px', fontSize: '1rem', outline: 'none', background: TOOLS.bgInput, color: TOOLS.textPrimary, boxSizing: 'border-box', minWidth: 0 };
const cardStyle = { background: TOOLS.bgCard, borderRadius: '12px', boxShadow: TOOLS.cardShadow, border: `1px solid ${TOOLS.border}` };
const h2Style = { fontSize: '1.15rem', margin: '0 0 14px', color: TOOLS.button, fontWeight: 700 };

function ToolShell({ lang, h1, intro, seoPath, children }) {
  const navigate = useNavigate();
  const he = lang === 'he';
  useEffect(() => { setSeoMeta(publicSeo(seoPath)); }, [seoPath]);
  return (
    <div style={{ minHeight: '100vh', display: 'flow-root', background: TOOLS.bg, color: TOOLS.textPrimary, fontFamily: FONT_HE }} dir={he ? 'rtl' : 'ltr'} lang={lang}>
      <header style={{ background: TOOLS.bg, padding: '56px 20px 40px', textAlign: 'center', position: 'relative', borderBottom: `1px solid ${TOOLS.border}` }}>
        {/* PRODUCT_TRUTH_DECORATIVE: navigation link back to the landing page of the same language */}
        <a href={`/${lang}`} data-testid="free-tool-home" onClick={(e) => { e.preventDefault(); navigate(`/${lang}`); }} style={{ position: 'absolute', top: '12px', insetInlineStart: '16px', color: TOOLS.button, fontSize: '0.95rem', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', minHeight: '44px' }}>{COPY[lang].home}</a>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}><ProFlowLogo size={30} darkText /></div>
        <h1 style={{ fontSize: '2.2rem', margin: '0 0 10px', fontWeight: 700, color: TOOLS.button }}>{h1}</h1>
        <p style={{ fontSize: '1.05rem', color: TOOLS.textSecondary, maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>{intro}</p>
      </header>
      <main style={{ maxWidth: '800px', margin: '32px auto 40px', padding: '0 16px' }}>{children}</main>
    </div>
  );
}

const emptyLine = () => ({ desc: '', qty: '1', price: '' });

export function FreeQuoteTemplatePage({ lang = 'he' }) {
  const navigate = useNavigate();
  const he = lang === 'he';
  const t = COPY[lang].template;
  const [biz, setBiz] = useState('');
  const [phone, setPhone] = useState('');
  const [client, setClient] = useState('');
  const [lines, setLines] = useState([emptyLine(), emptyLine()]);
  const [pdfState, setPdfState] = useState('idle');
  const docRef = useRef(null);

  const setLine = (i, key, v) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [key]: v } : l)));
  const rows = lines.map((l) => {
    const q = parseToolNumber(l.qty); const p = parseToolNumber(l.price);
    const qty = q.ok ? q.value : 0; const price = p.ok ? p.value : 0;
    return { desc: l.desc.trim(), qty, price, amount: qty * price, shown: l.desc.trim() !== '' || (p.ok && p.value > 0) };
  });
  const shown = rows.filter((r) => r.shown);
  const subtotal = shown.reduce((s, r) => s + r.amount, 0);
  const vat = he ? subtotal * IL_VAT_RATE : 0;
  const total = subtotal + vat;

  const downloadPdf = async () => {
    if (!docRef.current || pdfState === 'busy') return;
    setPdfState('busy');
    try {
      const { generateQuotePdf } = await import('../utils/generateQuotePdf');
      await generateQuotePdf({ captureEl: docRef.current, filename: t.file });
      setPdfState('idle');
    } catch {
      setPdfState('error');
    }
  };

  const th = { padding: '8px 4px', fontWeight: 700, fontSize: '0.8rem', color: TOOLS.textSecondary, borderBottom: `1px solid ${TOOLS.border}`, textAlign: 'start' };
  const td = { padding: '8px 4px', fontSize: '0.8rem', borderBottom: `1px solid ${TOOLS.border}`, verticalAlign: 'top' };
  const num = { ...td, textAlign: he ? 'left' : 'right', whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'isolate' }; // the physical side of the column headers (HE left, EN right) - 'end' inside an LTR cell would be the right side in Hebrew too

  return (
    <ToolShell lang={lang} h1={t.h1} intro={t.intro} seoPath={FREE_TOOL_PATHS.template[lang]}>
      <div style={{ ...cardStyle, padding: '26px 22px' }} data-testid="free-template">
        <div className="ft-grid">
          <form onSubmit={(e) => e.preventDefault()} aria-label={t.h1} style={{ minWidth: 0 }}>
            <h2 style={h2Style}>{t.business}</h2>
            <div className="ft-bizrow">
              <div><label htmlFor="ft-biz" style={labelStyle}>{t.businessName}</label>
              <input id="ft-biz" value={biz} onChange={(e) => setBiz(e.target.value)} placeholder={t.phBusiness} autoComplete="organization" style={{ ...inputStyle, marginBottom: '14px' }} /></div>
              <div><label htmlFor="ft-phone" style={labelStyle}>{t.phone}</label>
              <input id="ft-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.phPhone} autoComplete="tel" style={{ ...inputStyle, direction: 'ltr', textAlign: he ? 'right' : 'left', marginBottom: '14px' }} /></div>
            </div>
            <div style={{ height: '8px' }} />
            <h2 style={h2Style}>{t.client}</h2>
            <label htmlFor="ft-client" style={labelStyle}>{t.clientName}</label>
            <input id="ft-client" value={client} onChange={(e) => setClient(e.target.value)} placeholder={t.phClient} style={{ ...inputStyle, marginBottom: '22px' }} />
            <h2 style={h2Style}>{t.lines}</h2>
            <div className="ft-lines">
              <span style={{ ...labelStyle, marginBottom: 0 }}>{t.desc}</span>
              <span style={{ ...labelStyle, marginBottom: 0 }}>{t.qty}</span>
              <span style={{ ...labelStyle, marginBottom: 0 }}>{t.price}</span>
              {lines.map((l, i) => (
                <div key={i} style={{ display: 'contents' }}>
                  <input aria-label={`${t.desc} ${i + 1}`} value={l.desc} onChange={(e) => setLine(i, 'desc', e.target.value)} placeholder={i === 0 ? t.phDesc : ''} style={inputStyle} />
                  <input aria-label={`${t.qty} ${i + 1}`} inputMode="decimal" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} style={{ ...inputStyle, direction: 'ltr', textAlign: he ? 'right' : 'left' }} />
                  <input aria-label={`${t.price} ${i + 1}`} inputMode="decimal" value={l.price} onChange={(e) => setLine(i, 'price', e.target.value)} onBlur={(e) => setLine(i, 'price', grouped(e.target.value))} style={{ ...inputStyle, direction: 'ltr', textAlign: he ? 'right' : 'left' }} />
                </div>
              ))}
            </div>
            {/* PRODUCT_TRUTH_DECORATIVE: adds an empty work line to the free public quote template (nothing is stored) */}
            <button type="button" data-testid="free-template-add" onClick={() => setLines((ls) => [...ls, emptyLine()])} style={{ marginTop: '12px', border: 'none', background: 'none', color: TOOLS.button, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', minHeight: '44px', padding: 0, fontSize: '0.95rem' }}><Plus size={16} strokeWidth={2.4} aria-hidden="true" />{t.addLine}</button>
          </form>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: TOOLS.textSecondary, margin: '0 0 8px' }}>{t.preview}</div>
            <div ref={docRef} data-testid="free-template-doc" dir={he ? 'rtl' : 'ltr'} style={{ background: '#ffffff', border: `1px solid ${TOOLS.border}`, borderRadius: '10px', overflow: 'hidden', fontFamily: FONT_HE, color: '#0f172a' }}>
              <div className="pq-header-box" style={{ background: '#000000', color: '#ffffff', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', overflowWrap: 'anywhere', color: biz ? '#ffffff' : '#9ca3af' }}>{biz || t.phBusiness}</div>
                  <div style={{ fontSize: '0.75rem', direction: 'ltr', unicodeBidi: 'isolate', textAlign: he ? 'right' : 'left', color: phone ? '#ffffff' : '#9ca3af' }}>{phone || t.phPhone}</div>
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', whiteSpace: 'nowrap' }}>{t.docTitle}</div>
              </div>
              <div style={{ padding: '14px 16px' }}>
                <div className="pq-recipient" style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{t.to}</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', overflowWrap: 'anywhere', color: client ? '#0f172a' : '#9ca3af' }}>{client || t.phClient}</div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <thead><tr><th style={{ ...th, width: '30%' }}>{t.desc}</th><th style={{ ...th, width: '14%', textAlign: 'end' }}>{t.qty}</th><th style={{ ...th, width: '28%', textAlign: 'end' }}>{t.price}</th><th style={{ ...th, width: '28%', textAlign: 'end' }}>{t.amount}</th></tr></thead>
                  <tbody>
                    {shown.length ? shown.map((r, i) => (
                      <tr key={i}><td style={{ ...td, overflowWrap: 'anywhere' }}>{r.desc}</td><td style={num}>{formatToolNumber(r.qty, he ? 'he-IL' : 'en-US')}</td><td style={num}>{money(r.price, he)}</td><td style={num}>{money(r.amount, he)}</td></tr>
                    )) : <tr><td colSpan={4} style={{ ...td, color: '#9ca3af' }}>{t.phDesc}</td></tr>}
                  </tbody>
                </table>
                <div className="pq-section" style={{ marginTop: '10px', fontSize: '0.85rem', padding: '0 4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#475569' }}><span>{t.subtotal}</span><span style={{ direction: 'ltr', unicodeBidi: 'isolate' }}>{money(subtotal, he)}</span></div>
                  {he ? <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#475569' }}><span>{t.vat}</span><span style={{ direction: 'ltr', unicodeBidi: 'isolate' }}>{money(vat, he)}</span></div> : null}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', marginTop: '4px', borderTop: `1px solid ${TOOLS.border}`, fontWeight: 800, fontSize: '1rem' }}><span>{t.total}</span><span style={{ direction: 'ltr', unicodeBidi: 'isolate' }} data-testid="free-template-total">{money(total, he)}</span></div>
                </div>
              </div>
            </div>
            {/* PRODUCT_TRUTH_DECORATIVE: downloads the free public quote template as a PDF made in the browser (the product's PDF tool; nothing is stored) */}
            <button type="button" data-testid="free-template-pdf" onClick={downloadPdf} disabled={pdfState === 'busy'} style={{ marginTop: '14px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: TOOLS.button, color: '#ffffff', border: `1px solid ${TOOLS.button}`, borderRadius: '8px', minHeight: '46px', fontWeight: 700, fontSize: '1rem', cursor: pdfState === 'busy' ? 'wait' : 'pointer' }}>
              <Download size={18} strokeWidth={2.2} aria-hidden="true" />{pdfState === 'busy' ? t.pdfBusy : t.pdf}
            </button>
            {pdfState === 'error' ? <div role="alert" style={{ color: TOOLS.red, fontSize: '0.85rem', marginTop: '8px' }}>{t.pdfError}</div> : null}
          </div>
        </div>

        <div style={{ marginTop: '26px', background: TOOLS.accentSoft, borderRadius: '10px', padding: '18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
          <div style={{ minWidth: 0, flex: '1 1 260px' }}>
            <div style={{ fontWeight: 700, color: TOOLS.button, marginBottom: '4px' }}>{t.ctaH}</div>
            <div style={{ fontSize: '0.85rem', color: TOOLS.textSecondary, lineHeight: 1.5 }}>{t.ctaP}</div>
          </div>
          {/* PRODUCT_TRUTH_DECORATIVE: marketing CTA opening the account-creation screen (the landing signup path) */}
          <button type="button" data-testid="free-template-cta" onClick={() => navigate(`/dashboard?signup=true&lang=${lang}`)} style={{ background: TOOLS.button, color: '#ffffff', border: `1px solid ${TOOLS.button}`, borderRadius: '8px', minHeight: '46px', padding: '0 18px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>{t.cta}</button>
        </div>
      </div>
    </ToolShell>
  );
}

export function VatCalculatorPage({ lang = 'he' }) {
  const he = lang === 'he';
  const t = COPY[lang].tax;
  const err = INPUT_ERRORS[lang];
  const [mode, setMode] = useState('add');
  const [amount, setAmount] = useState('1,000');
  const [rate, setRate] = useState('');
  const a = parseToolNumber(amount);
  const r = he ? { ok: true, value: IL_VAT_RATE * 100 } : parseToolNumber(rate, { max: 100 });
  let res = null;
  if (a.ok && r.ok) {
    const k = r.value / 100;
    if (mode === 'add') res = { before: a.value, tax: a.value * k, total: a.value * (1 + k) };
    else { const before = a.value / (1 + k); res = { before, tax: a.value - before, total: a.value }; }
  }
  const segBtn = (key) => ({ flex: 1, minHeight: '46px', border: 'none', background: mode === key ? TOOLS.button : '#ffffff', color: mode === key ? '#ffffff' : TOOLS.button, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', padding: '0 10px' });
  const big = mode === 'add' ? res?.total : res?.before;
  return (
    <ToolShell lang={lang} h1={t.h1} intro={t.intro} seoPath={FREE_TOOL_PATHS.tax[lang]}>
      <div style={{ ...cardStyle, padding: '30px 28px' }} data-testid="free-tax">
        <h2 style={{ ...h2Style, fontSize: '1.3rem', marginBottom: '20px' }}>{t.h2}</h2>
        <div role="group" aria-label={t.h2} style={{ display: 'flex', border: `1px solid ${TOOLS.button}`, borderRadius: '8px', overflow: 'hidden', marginBottom: '22px' }}>
          {/* PRODUCT_TRUTH_DECORATIVE: switches the free public tax calculator to adding tax to an amount */}
          <button type="button" aria-pressed={mode === 'add'} data-testid="free-tax-add" onClick={() => setMode('add')} style={segBtn('add')}>{t.add}</button>
          {/* PRODUCT_TRUTH_DECORATIVE: switches the free public tax calculator to taking the tax out of a total */}
          <button type="button" aria-pressed={mode === 'extract'} data-testid="free-tax-extract" onClick={() => setMode('extract')} style={segBtn('extract')}>{t.extract}</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '16px', marginBottom: '22px' }}>
          <div>
            <label htmlFor="ft-amount" style={labelStyle}>{mode === 'add' ? t.amountAdd : t.amountExtract}</label>
            <input id="ft-amount" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} onBlur={(e) => setAmount(grouped(e.target.value))} style={{ ...inputStyle, direction: 'ltr', textAlign: he ? 'right' : 'left' }} />
            {!a.ok ? <div role="alert" style={{ color: TOOLS.red, fontSize: '0.8rem', marginTop: '6px' }}>{err[a.code]}</div> : null}
          </div>
          <div>
            <label htmlFor="ft-rate" style={labelStyle}>{t.rate}</label>
            {he
              ? <input id="ft-rate" readOnly value="18%" style={{ ...inputStyle, direction: 'ltr', textAlign: 'right', background: '#f1f5f9', color: TOOLS.textSecondary }} />
              : <input id="ft-rate" inputMode="decimal" autoComplete="off" value={rate} placeholder={t.ratePh} onChange={(e) => setRate(e.target.value)} style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }} />}
            <div style={{ fontSize: '0.8rem', color: TOOLS.textSecondary, marginTop: '6px' }}>{t.rateNote}</div>
          </div>
        </div>
        <div role="status" data-testid="free-tax-result" style={{ background: TOOLS.button, color: '#ffffff', borderRadius: '12px', padding: '22px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', marginBottom: '8px' }}>{mode === 'add' ? t.totalWith : t.before}</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, direction: 'ltr', unicodeBidi: 'isolate' }}>{big == null ? '—' : money(big, he)}</div>
          <div style={{ fontSize: '0.85rem', marginTop: '10px' }}>
            {res ? <>{t.vatPart}: <bdi dir="ltr">{money(res.tax, he)}</bdi> • {mode === 'add' ? t.before : t.totalWith}: <bdi dir="ltr">{money(mode === 'add' ? res.before : res.total, he)}</bdi></> : '—'}
          </div>
        </div>
      </div>
    </ToolShell>
  );
}
