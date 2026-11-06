// Owner console 2026-11-03 (typed: "מאשר הפעלת ארבעת הסוכנים ובניית הצעה מקובץ לפי האפיון וששת ההחלטות שלי, כולל שינוי ב-L-05, L-06,
// L-09, L-12, L-14, L-15, L-17, L-22, L-23, L-24, L-25, L-27 ו-L-28, שחרור עד הלייב"; spec docs/CODEX_SPEC_QUOTE_FROM_FILE_2026-11-03.md):
// "quote from a file" (SMART PACK), opened by the fifth choice of the new-quote menu on top of the blank quote form.
// The owner picks ONE PDF or JPG of a quote another business gave the customer; the server reads its lines; the review shows on every
// line the price in the document (read-only) and "your price" (filled from the catalog only on an exact name match), the two totals and
// the gap. Only the owner's own prices reach the form ("יש למלא מחיר" until every ticked line has one); the document prices and the
// comparison live only in this dialog's memory and are dropped on close. The file is never kept: not here, not in the draft store.
// Customer details are never read from the file - the owner picks the client in the form, as always.
import { useEffect, useRef, useState } from 'react';
import { X, FileUp, Check } from 'lucide-react';
import AiModalHeader from './AiModalHeader';
import { APP as NEON } from '../theme/neonTheme';
import { getProfessionalUnitLabel } from '../utils/professionalQuoteItem';
import { draftUnitsForMarket } from '../../supabase/functions/_shared/aiQuoteDraft.js';
import { MAX_FILE_BYTES, catalogPriceFor, checkPickedFile, compareTotals, fileSizeLabel, parseOwnPrice } from '../utils/quoteFromFileClient';

const positiveQuantity = (v) => {
  const n = Number(String(v ?? '').trim().replace(',', '.'));
  return String(v ?? '').trim() !== '' && Number.isFinite(n) && n > 0 && n <= 100000 ? Math.round(n * 1000) / 1000 : null;
};

const COPY = {
  he: {
    title: 'הצעת מחיר מקובץ',
    intro: 'מעלים קובץ PDF או JPG של הצעה או רשימת עבודות. ה-AI קורא את השורות, הכמויות, המידות והמחירים, ואתם קובעים את המחירים שלכם.',
    choose: 'בחרו קובץ', chosen: 'הקובץ שנבחר', read: 'קריאת הפרטים', reading: 'קוראים את הקובץ…', cancel: 'ביטול', manual: 'מילוי ידני',
    small: 'הקובץ נשלח לספק ה-AI רק לקריאת הפרטים. אצלנו הקובץ לא נשמר ולא מצורף להצעה. הספק שומר עותק לזמן מוגבל, לפי התנאים שלו.',
    allowance: (r, l, free) => (free ? `נשארו לכם ${r} מתוך ${l} קבצים בשבעת הימים החינמיים` : `נשארו לכם ${r} מתוך ${l} קבצים החודש`),
    reviewTitle: 'בדיקת השורות', reviewHint: 'בדקו כל שורה ומלאו את המחיר שלכם. ללקוח יוצא רק המחיר שלכם; המחיר במסמך מוצג רק כאן.',
    item: 'תיאור', qty: 'כמות', unit: 'יחידה', noUnit: 'ללא יחידה', docPrice: 'מחיר במסמך', docLineTotal: 'סה״כ השורה במסמך', ownPrice: 'המחיר שלכם',
    notRead: 'לא נקרא', fromCatalog: 'מהקטלוג שלכם',
    docTotal: 'סה״כ במסמך', ownTotal: 'סה״כ שלכם', gap: 'הפער',
    scopeIL: 'לשורות שנבחרו, לפני מע״מ והנחות', scopeIntl: 'לשורות שנבחרו, לפני הנחות ותוספות',
    cheaper: (p) => `ההצעה שלכם זולה ב-${p}%`, dearer: (p) => `ההצעה שלכם יקרה ב-${p}%`, same: 'אותו סכום',
    noGapCurrency: 'המטבע במסמך שונה או לא זוהה, ולכן אין השוואה באחוזים.', noGapMissing: 'בחלק מהשורות לא נקרא מחיר במסמך, ולכן אין השוואה באחוזים.',
    add: 'הוספת השורות להצעה', fillPrice: 'יש למלא מחיר', fillQty: 'יש למלא כמות', fillText: 'יש למלא תיאור', none: 'לא נבחרה אף שורה',
    errors: {
      unsupported_type: 'אפשר להעלות רק קובץ PDF או JPG.', too_large: 'הקובץ גדול מ-8 מגה. אפשר להקטין אותו ולנסות שוב.',
      too_many_pages: 'אפשר לקרוא עד 5 עמודים. אפשר לשמור רק את העמודים עם השורות ולנסות שוב.',
      too_many_lines: 'במסמך יותר מ-30 שורות. אפשר לפצל אותו ולנסות שוב.',
      not_a_quote: 'לא מצאנו בקובץ שורות של עבודות או מוצרים. אפשר לנסות קובץ אחר או למלא ידנית.',
      unreadable: 'לא הצלחנו לקרוא את הקובץ. אפשר לנסות צילום ברור יותר או למלא ידנית.',
      smart_pack_required: 'הצעת מחיר מקובץ היא חלק מחכם פלוס. אפשר להוסיף אותו בחלון המסלולים, או למלא את ההצעה ידנית.',
      quota_exhausted: 'הגעתם למכסת הקבצים לתקופה הזו. אפשר להמשיך להכין הצעות ידנית.',
      too_many_failures: 'היו היום יותר מדי ניסיונות שלא הצליחו. אפשר לנסות שוב מחר או למלא ידנית.',
      in_progress: 'קובץ אחר עדיין נקרא. נסו שוב בעוד רגע.', offline: 'אין חיבור לאינטרנט כרגע.',
      failed: 'הקריאה לא הצליחה. אפשר לנסות שוב או למלא ידנית.',
    },
  },
  en: {
    title: 'Quote from a file',
    intro: 'Upload a PDF or JPG of a quote or job list. The AI reads the lines, quantities, dimensions and prices, and you set your own prices.',
    choose: 'Choose a file', chosen: 'Chosen file', read: 'Read details', reading: 'Reading the file…', cancel: 'Cancel', manual: 'Fill in manually',
    small: 'The file is sent to our AI provider only to read the details. We do not store the file or attach it to your quote. The provider keeps a copy for a limited time under its own terms.',
    allowance: (r, l, free) => (free ? `${r} of ${l} files left in your 7 free days` : `${r} of ${l} files left this month`),
    reviewTitle: 'Review the lines', reviewHint: 'Check each line and fill in your price. Only your price goes to the customer; the document price is shown here only.',
    item: 'Description', qty: 'Qty', unit: 'Unit', noUnit: 'No unit', docPrice: 'Price in the document', docLineTotal: 'Line total in the document', ownPrice: 'Your price',
    notRead: 'Not read', fromCatalog: 'From your catalog',
    docTotal: 'Document total', ownTotal: 'Your total', gap: 'Difference',
    scopeIL: 'Selected lines, before VAT and discounts', scopeIntl: 'Selected lines, before discounts and additional charges',
    cheaper: (p) => `Your quote is ${p}% lower`, dearer: (p) => `Your quote is ${p}% higher`, same: 'The same amount',
    noGapCurrency: 'The document currency is different or unknown, so there is no percentage comparison.', noGapMissing: 'Some lines have no price in the document, so there is no percentage comparison.',
    add: 'Add the lines to the quote', fillPrice: 'Please fill in a price', fillQty: 'Please fill in a quantity', fillText: 'Please fill in a description', none: 'No line is selected',
    errors: {
      unsupported_type: 'Only a PDF or JPG file can be uploaded.', too_large: 'The file is larger than 8 MB. Make it smaller and try again.',
      too_many_pages: 'Up to 5 pages can be read. Keep only the pages with the lines and try again.',
      too_many_lines: 'The document has more than 30 lines. Split it and try again.',
      not_a_quote: 'We found no work or product lines in the file. Try another file or fill in manually.',
      unreadable: 'We could not read the file. Try a clearer photo or fill in manually.',
      smart_pack_required: 'Quote from a file is part of SMART PACK. You can add it in the plans window, or fill in the quote manually.',
      quota_exhausted: 'You have reached the file limit for this period. You can keep creating quotes manually.',
      too_many_failures: 'There were too many unsuccessful tries today. Try again tomorrow or fill in manually.',
      in_progress: 'Another file is still being read. Try again in a moment.', offline: 'There is no internet connection right now.',
      failed: 'Reading did not work. Try again or fill in manually.',
    },
  },
};

const inputBase = { boxSizing: 'border-box', padding: '7px 9px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '7px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '16px', fontFamily: 'inherit' };
const secondaryBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', minHeight: '44px', padding: '0 16px', borderRadius: '10px', border: `1px solid ${NEON.borderStrong}`, background: 'none', color: NEON.textPrimary, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', fontFamily: 'inherit' };
const primaryBtn = { ...secondaryBtn, border: 'none', background: NEON.violet, color: '#ffffff' };

const toRow = (line, catalog) => {
  const hit = catalogPriceFor(line.description, catalog);
  return {
    description: line.description, quantityInput: line.quantity != null ? String(line.quantity) : '', unit: line.unit || null,
    docUnitPrice: line.unitPrice, docLineTotal: line.lineTotal,
    ownInput: hit ? String(hit.price) : '', catalogId: hit ? hit.catalogId : null, catalogPrice: hit ? hit.price : null,
  };
};

export default function QuoteFromFileDialog({ isOpen, isHebrew, sym, formatMoneyDisplay, currency, catalog, readFile, readAllowance, onClose, onApply, international = false }) {
  // Owner 2026-11-05 (L-17): one shared unit list by market (the feet units abroad); a line keeps its own unit
  const unitChoices = (own) => { const list = draftUnitsForMarket(international); return own && !list.includes(own) ? [...list, own] : list; };
  const t = isHebrew ? COPY.he : COPY.en;
  const [phase, setPhase] = useState('pick');          // pick | loading | review
  const [file, setFile] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const [allowance, setAllowance] = useState(null);
  const [result, setResult] = useState(null);          // { currency, documentTotal } of the read document (memory only)
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState([]);
  const [blocked, setBlocked] = useState(null);        // { index, field, text }
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const requestSeq = useRef(0);
  const appliedRef = useRef(false);

  const reset = () => { setPhase('pick'); setFile(null); setErrorCode(null); setResult(null); setRows([]); setSelected([]); setBlocked(null); appliedRef.current = false; };
  useEffect(() => {
    if (!isOpen) { reset(); return undefined; }
    reset();
    let live = true;
    if (typeof readAllowance === 'function') Promise.resolve(readAllowance()).then((a) => { if (live) setAllowance(a || null); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  // the file, the read lines and the document prices never outlive the dialog (an unmount drops them too)
  useEffect(() => () => { requestSeq.current += 1; }, []);

  if (!isOpen) return null;

  const close = () => { requestSeq.current += 1; reset(); onClose(); };
  const pick = (f) => {
    setErrorCode(null);
    const problem = f ? checkPickedFile(f) : null;
    if (problem) { setFile(null); setErrorCode(problem); if (inputRef.current) inputRef.current.value = ''; return; }
    setFile(f || null);
  };
  const read = async () => {
    if (!file || phase === 'loading') return;
    const seq = ++requestSeq.current;
    setErrorCode(null); setPhase('loading');
    const r = await readFile(file);
    if (seq !== requestSeq.current) return;  // closed meanwhile
    if (r?.allowance) setAllowance(r.allowance);
    if (r?.status === 'ok') {
      setFile(null); if (inputRef.current) inputRef.current.value = '';
      setResult({ currency: r.currency, documentTotal: r.documentTotal });
      const next = r.lines.map((l) => toRow(l, catalog));
      setRows(next); setSelected(next.map(() => true)); setPhase('review'); appliedRef.current = false;
    } else {
      setErrorCode(r?.status || 'failed'); setPhase('pick');
    }
  };
  const edit = (i, patch) => { setBlocked(null); setRows((all) => all.map((r, j) => (j === i ? { ...r, ...patch } : r))); };
  const chosenIdx = rows.map((_, i) => i).filter((i) => selected[i]);
  const accountCurrency = String(currency || '').toUpperCase();
  const sameCurrency = !!result?.currency && result.currency === accountCurrency;
  const cmp = compareTotals(chosenIdx.map((i) => ({ quantity: positiveQuantity(rows[i].quantityInput), docUnitPrice: rows[i].docUnitPrice,
    docLineTotal: rows[i].docLineTotal, ownPrice: parseOwnPrice(rows[i].ownInput) })), { sameCurrency });
  const money = (v) => (v == null ? t.notRead : formatMoneyDisplay ? `${sym || ''}${formatMoneyDisplay(v)}` : String(v));
  // a document price in another / unknown currency never borrows the account's symbol (no misleading "₪")
  const docMoney = (v) => (v == null ? t.notRead : sameCurrency ? money(v) : `${formatMoneyDisplay ? formatMoneyDisplay(v) : v}${result?.currency ? ` ${result.currency}` : ''}`);
  const focusField = (i, field) => {
    const el = dialogRef.current?.querySelector(`[data-line-index="${i}"] [data-field="${field}"]`);
    el?.focus();
  };
  const add = () => {
    if (appliedRef.current) return;
    if (!chosenIdx.length) { setBlocked({ index: null, field: null, text: t.none }); return; }
    for (const i of chosenIdx) {
      const r = rows[i];
      if (!String(r.description || '').trim()) { setBlocked({ index: i, field: 'description', text: t.fillText }); focusField(i, 'description'); return; }
      if (positiveQuantity(r.quantityInput) == null) { setBlocked({ index: i, field: 'quantity', text: t.fillQty }); focusField(i, 'quantity'); return; }
      if (parseOwnPrice(r.ownInput) == null) { setBlocked({ index: i, field: 'own', text: t.fillPrice }); focusField(i, 'own'); return; }
    }
    appliedRef.current = true;
    // ONLY the owner's own lines leave the dialog: description, quantity, unit, the owner's price (+ the catalog id when the catalog price is kept)
    const lines = chosenIdx.map((i) => {
      const r = rows[i];
      const own = parseOwnPrice(r.ownInput);
      return { description: String(r.description).trim(), quantity: positiveQuantity(r.quantityInput), unit: r.unit || null, unitPrice: own,
        catalogId: r.catalogId != null && own === r.catalogPrice ? r.catalogId : null };
    });
    reset();
    onApply(lines);
  };
  const free = allowance?.period === 'free';
  const allowanceText = allowance && Number.isInteger(allowance.limit) && allowance.limit > 0 ? t.allowance(allowance.remaining, allowance.limit, free) : null;
  const errorText = errorCode ? (t.errors[errorCode] || t.errors.failed) : null;
  const gapText = cmp.gapPercent == null ? null : cmp.gapPercent < 0 ? t.cheaper(Math.abs(cmp.gapPercent)) : cmp.gapPercent > 0 ? t.dearer(cmp.gapPercent) : t.same;

  return (
    <div role="dialog" aria-modal="true" aria-label={t.title} dir={isHebrew ? 'rtl' : 'ltr'} ref={dialogRef} tabIndex={-1} className="pf-quote-from-file"
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '16px', boxSizing: 'border-box', outline: 'none' }}
      onKeyDown={(e) => { if (e.key === 'Escape') close(); }}>
      <div style={{ background: NEON.bgCard, borderRadius: '16px', width: '100%', maxWidth: '680px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px -15px rgba(0,0,0,0.4)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
        <AiModalHeader className="pf-modal-head--bar" title={t.title} onClose={close} closeLabel={t.cancel} closeContent={<X size={20} />} isHebrew={isHebrew} testId="quote-from-file" />
        <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: '12px', textAlign: isHebrew ? 'right' : 'left' }}>
          {phase !== 'review' ? (
            <>
              <p style={{ margin: 0, fontSize: '0.86rem', color: NEON.textSecondary, lineHeight: 1.5 }}>{t.intro}</p>
              <input ref={inputRef} id="quote-from-file-input" type="file" accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg" data-testid="quote-from-file-input"
                onChange={(e) => pick(e.target.files?.[0] || null)} style={{ display: 'none' }} />
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
                {/* PRODUCT_TRUTH_DECORATIVE: opens the device file picker (PDF / JPG only); nothing is sent until "read details" */}
                <button type="button" onClick={() => inputRef.current?.click()} disabled={phase === 'loading'} style={secondaryBtn}>
                  <FileUp size={18} aria-hidden="true" />{t.choose}
                </button>
                {file && <span data-testid="quote-from-file-chosen" style={{ fontSize: '0.84rem', color: NEON.textPrimary, overflowWrap: 'anywhere' }}>{t.chosen}: <bdi>{file.name}</bdi> (<bdi dir="ltr">{fileSizeLabel(file.size)}</bdi>)</span>}
              </div>
              <small data-testid="quote-from-file-small-print" style={{ fontSize: '0.72rem', color: NEON.textSecondary, lineHeight: 1.45 }}>{t.small}</small>
              {allowanceText && <div data-testid="quote-from-file-allowance" style={{ fontSize: '0.78rem', color: NEON.textSecondary }}>{allowanceText}</div>}
              {errorText && <div role="alert" data-testid="quote-from-file-error" style={{ color: NEON.red, fontSize: '0.82rem', lineHeight: 1.45 }}>{errorText}</div>}
              {phase === 'loading' && <div role="status" aria-live="polite" style={{ fontSize: '0.84rem', color: NEON.textSecondary }}>{t.reading}</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end' }}>
                {/* PRODUCT_TRUTH_DECORATIVE: closes the dialog and leaves the blank quote form for manual entry */}
                <button type="button" onClick={close} style={secondaryBtn}>{t.manual}</button>
                {/* PRODUCT_TRUTH_CAPABILITY: smart_quote */}
                <button type="button" data-testid="quote-from-file-read" onClick={read} disabled={!file || phase === 'loading'} style={{ ...primaryBtn, opacity: !file || phase === 'loading' ? 0.6 : 1 }}>
                  <Check size={16} aria-hidden="true" />{phase === 'loading' ? t.reading : t.read}
                </button>
              </div>
              <span hidden data-max-bytes={MAX_FILE_BYTES} />
            </>
          ) : (
            <>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: NEON.textPrimary }}>{t.reviewTitle}</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: NEON.textSecondary, lineHeight: 1.45 }}>{t.reviewHint}</p>
              <ul data-testid="quote-from-file-lines" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {rows.map((r, i) => {
                  const own = parseOwnPrice(r.ownInput);
                  const isBlocked = blocked?.index === i;
                  return (
                    <li key={i} data-testid="quote-from-file-line" data-line-index={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', border: `1px solid ${isBlocked ? (NEON.amber || NEON.red) : selected[i] ? NEON.violetLight : NEON.border}`, borderRadius: '10px', background: selected[i] ? NEON.violetLighter : NEON.bgCardAlt, boxSizing: 'border-box' }}>
                      {/* PRODUCT_TRUTH_DECORATIVE: ticks / unticks one read line before it is added */}
                      <input type="checkbox" aria-label={r.description} checked={!!selected[i]} onChange={() => { setBlocked(null); setSelected((s) => s.map((v, j) => (j === i ? !v : v))); }} style={{ marginTop: '10px', width: '18px', height: '18px', flexShrink: 0 }} />
                      <span style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, flex: '1 1 auto' }}>
                        <input type="text" data-field="description" aria-label={t.item} value={r.description} maxLength={200} onChange={(e) => edit(i, { description: e.target.value })}
                          style={{ ...inputBase, width: '100%', fontWeight: 700, textAlign: isHebrew ? 'right' : 'left' }} />
                        <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 12px', fontSize: '0.78rem', color: NEON.textSecondary }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{t.qty}:
                            <input type="text" inputMode="decimal" dir="ltr" className="pf-num" data-field="quantity" aria-label={t.qty} value={r.quantityInput} onChange={(e) => edit(i, { quantityInput: e.target.value })} style={{ ...inputBase, width: '76px', textAlign: 'left' }} />
                          </label>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{t.unit}:
                            <select aria-label={t.unit} value={r.unit || ''} onChange={(e) => edit(i, { unit: e.target.value || null })} style={{ ...inputBase, padding: '6px 8px' }}>
                              <option value="">{t.noUnit}</option>
                              {unitChoices(r.unit).map((u) => <option key={u} value={u}>{getProfessionalUnitLabel(u, isHebrew)}</option>)}
                            </select>
                          </label>
                        </span>
                        <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px', fontSize: '0.8rem' }}>
                          <span data-testid="quote-from-file-doc-price" style={{ color: NEON.textSecondary }}>
                            {r.docUnitPrice == null && r.docLineTotal != null ? t.docLineTotal : t.docPrice}:{' '}
                            <bdi className="pf-money" dir="ltr" style={{ color: NEON.textPrimary, fontWeight: 600 }}>{docMoney(r.docUnitPrice != null ? r.docUnitPrice : r.docLineTotal)}</bdi>
                          </span>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: NEON.textPrimary, fontWeight: 700 }}>{t.ownPrice}:
                            <input type="text" inputMode="decimal" dir="ltr" className="pf-num" data-field="own" aria-label={t.ownPrice} aria-invalid={isBlocked && blocked.field === 'own'} value={r.ownInput}
                              onChange={(e) => edit(i, { ownInput: e.target.value })} style={{ ...inputBase, width: '110px', textAlign: 'left', borderColor: isBlocked && blocked.field === 'own' ? (NEON.amber || NEON.red) : NEON.borderStrong }} />
                          </label>
                          {r.catalogId != null && own === r.catalogPrice && <span style={{ fontSize: '0.74rem', color: NEON.textSecondary }}>{t.fromCatalog}</span>}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div data-testid="quote-from-file-totals" style={{ border: `1px solid ${NEON.border}`, borderRadius: '10px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.84rem' }}>
                <span style={{ fontSize: '0.74rem', color: NEON.textSecondary }}>{accountCurrency === 'ILS' ? t.scopeIL : t.scopeIntl}</span>
                <span style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px' }}><span>{t.docTotal}</span><bdi className="pf-money" dir="ltr">{docMoney(cmp.docTotal)}</bdi></span>
                <span style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', fontWeight: 700 }}><span>{t.ownTotal}</span><bdi className="pf-money" dir="ltr">{money(cmp.ownTotal)}</bdi></span>
                {gapText
                  ? <span data-testid="quote-from-file-gap" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', color: cmp.gapPercent < 0 ? (NEON.green || NEON.textPrimary) : NEON.textPrimary, fontWeight: 700 }}><span>{t.gap}</span><span>{gapText}</span></span>
                  : <span data-testid="quote-from-file-no-gap" style={{ fontSize: '0.76rem', color: NEON.textSecondary }}>{!sameCurrency ? t.noGapCurrency : t.noGapMissing}</span>}
              </div>
              {blocked && <div role="alert" data-testid="quote-from-file-blocked" style={{ color: NEON.amber || NEON.red, fontSize: '0.86rem', fontWeight: 700 }}>{blocked.text}</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end' }}>
                {/* PRODUCT_TRUTH_DECORATIVE: closes the review; nothing is added and the read lines are dropped */}
                <button type="button" onClick={close} style={secondaryBtn}>{t.cancel}</button>
                {/* PRODUCT_TRUTH_CAPABILITY: smart_quote */}
                <button type="button" data-testid="quote-from-file-add" onClick={add} style={primaryBtn}><Check size={16} aria-hidden="true" />{t.add}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
