// Customer Twin ("בדיקת הלקוח", Owner 2026-10-16 one definition; night task 2026-10-22, binding visual docs/customer-twin/reference-2026-10-16.png).
// The internal pre-send view of a quote: the free checklist (no AI) is always shown; the AI view (three customer perspectives, what
// persuades / may stop / to strengthen, suggested additions) runs only on the owner's click and is counted ("2 of 20" this month, "4 of
// 10" purchased). Every suggestion changes the quote ONLY when the owner approves it (onApplyEdit); from the quotes list the analysis is
// read-only and the owner opens the editor to add. The recipient never sees any of it. HE / RTL and EN / LTR.
import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Sparkles, Check, AlertCircle, Lightbulb, Wallet, BadgeCheck, SearchCheck, CircleCheck, CircleAlert, CircleMinus, Plus, Pencil } from 'lucide-react';
import useFocusTrap from './quotePresentation/useFocusTrap';
import { twinChecklist } from '../../supabase/functions/_shared/customerTwin.js';
import { fetchTwinStatus, requestCustomerTwin } from '../utils/customerTwinClient';
import { calendarParts } from '../utils/shortDate';

const C = {
  ink: '#0f172a', text: '#334155', muted: '#64748b', line: '#e2e8f0', card: '#ffffff', page: '#f8fafc', blue: '#1d4ed8', blueSoft: '#eff6ff',
  green: '#15803d', greenSoft: '#f0fdf4', greenChip: '#dcfce7', amber: '#b45309', amberSoft: '#fffbeb', amberChip: '#fef3c7',
  red: '#b91c1c', redSoft: '#fef2f2', redChip: '#fee2e2', violet: '#6d28d9', heroFrom: '#eef2ff', heroTo: '#f5f3ff',
};

const COPY = {
  he: {
    label: 'בדיקת הלקוח', close: 'סגירה',
    heroTitle: 'ראו את ההצעה דרך העיניים של הלקוח',
    heroText: 'המערכת בודקת את ההצעה מנקודת המבט של שלושה סוגי לקוחות, כדי שתוכלו לחזק אותה לפני השליחה.',
    monthly: (r, l) => `נשארו לכם ${r} מתוך ${l} בדיקות החודש`,
    purchased: (r, t) => `${r} מתוך ${t} בדיקות שנקנו`,
    checklistTitle: 'בדיקה קבועה (חינם, בלי בינה)',
    checks: {
      breakdown: { ok: 'פירוט העבודה ברור', warn: 'כדאי לפרט יותר את העבודה בכל פריט' },
      prices: { ok: 'לכל הפריטים יש מחיר', missing: 'יש פריט בלי מחיר' },
      warranty: { ok: 'יש אחריות בהצעה', missing: 'אין אחריות בהצעה' },
      payment: { ok: 'תנאי התשלום כתובים', missing: 'לא כתובים תנאי תשלום' },
      vat: { ok: 'ברור איך מחושב המע״מ', warn: 'לא ברור אם המחיר כולל מע״מ' },
      disposal: { ok: 'פינוי הפסולת מוזכר', warn: 'לא כתוב אם פינוי הפסולת כלול' },
      validity: { ok: 'יש תוקף להצעה', warn: 'אין תוקף להצעה', missing: 'תוקף ההצעה כבר עבר' },
    },
    run: 'הפעלת בדיקת הלקוח', running: 'בודקים את ההצעה…', again: 'בדיקה מחדש',
    personas: {
      price: { title: 'לקוח רגיש למחיר', sub: 'מחפש את התמורה הטובה ביותר' },
      quality: { title: 'לקוח שמחפש איכות', sub: 'מעריך מקצועיות ואמינות' },
      skeptic: { title: 'לקוח חשדן', sub: 'רוצה להבין בדיוק על מה הוא משלם' },
    },
    states: { convinced: 'משוכנע', hesitant: 'מהסס', may_stop: 'עלול לעצור' },
    persuasive: 'מה משכנע בהצעה?', blockers: 'מה עלול לעצור את הלקוח?', strengthen: 'מה כדאי לחזק לפני השליחה?', none: 'אין כרגע',
    editsTitle: 'רוצים לשפר את ההצעה בלי לשנות את המחיר?',
    editsText: 'אלה תוספות שאפשר להכניס להצעה. כל תוספת נכנסת רק אחרי שתאשרו אותה, ואפשר לערוך אותה אחר כך.',
    target: { terms: 'תוספת לתנאים', warranty: 'תוספת לאחריות', item: (n) => `פירוט לפריט ${n}` },
    apply: 'הוספה להצעה', applied: 'נוסף להצעה', fill: 'את המקומות עם ___ צריך להשלים בעורך.',
    listNote: 'כדי להוסיף תוספת להצעה, פתחו אותה בעורך.', openEditor: 'פתיחה בעורך',
    cached: 'זו התוצאה השמורה של אותה הצעה, והיא לא נוכתה שוב.',
    internal: 'הבדיקה פנימית בלבד. הלקוח לא רואה אותה. זו המלצה של הבינה, ושום דבר לא משתנה בהצעה בלי אישור שלכם.',
    errors: {
      not_deployed: 'ניתוח הבינה עדיין לא זמין כאן. הבדיקה הקבועה למעלה זמינה תמיד.',
      quota_exhausted: (l) => `נוצלו כל ${l} הבדיקות של החודש.`,
      smart_pack_required: 'ניתוח הבינה של בדיקת הלקוח הוא חלק מחכם פלוס.',
      in_progress: 'הבדיקה של ההצעה הזו כבר רצה. נסו שוב בעוד רגע.',
      provider_failure: 'לא הצלחנו להשלים את הבדיקה, והיא לא נוכתה. אפשר לנסות שוב.',
      failed: 'לא הצלחנו להשלים את הבדיקה. אפשר לנסות שוב.',
      offline: 'אין חיבור לאינטרנט.',
      nothing_to_check: 'צריך לפחות פריט אחד עם תיאור כדי לבדוק את ההצעה.',
      market_unresolved: 'צריך לבחור את מדינת העסק בהגדרות העסק.',
      unauthenticated: 'צריך להתחבר מחדש.',
    },
    buyMore: (n, price) => `${n} בדיקות נוספות ב־${price}`, soon: 'בקרוב', plans: 'למסך המסלולים',
  },
  en: {
    label: 'Customer check', close: 'Close',
    heroTitle: "See your quote through your customer's eyes",
    heroText: 'The system reads your quote from the point of view of three kinds of customers, so you can strengthen it before you send it.',
    monthly: (r, l) => `${r} of ${l} checks left this month`,
    purchased: (r, t) => `${r} of ${t} purchased checks left`,
    checklistTitle: 'Basic check (free, no AI)',
    checks: {
      breakdown: { ok: 'The work breakdown is clear', warn: 'Describe the work of each item in more detail' },
      prices: { ok: 'Every item has a price', missing: 'An item has no price' },
      warranty: { ok: 'The quote includes a warranty', missing: 'No warranty in the quote' },
      payment: { ok: 'Payment terms are stated', missing: 'No payment terms' },
      vat: { ok: 'VAT is clear', warn: 'Unclear whether the price includes VAT' },
      disposal: { ok: 'Waste removal is mentioned', warn: 'Not stated whether waste removal is included' },
      validity: { ok: 'The quote has a validity date', warn: 'The quote has no validity date', missing: 'The quote has expired' },
    },
    run: 'Run the customer check', running: 'Checking your quote…', again: 'Check again',
    personas: {
      price: { title: 'Price-sensitive customer', sub: 'Looks for the best value' },
      quality: { title: 'Quality-focused customer', sub: 'Values professionalism and trust' },
      skeptic: { title: 'Skeptical customer', sub: 'Wants to know exactly what they pay for' },
    },
    states: { convinced: 'Convinced', hesitant: 'Hesitant', may_stop: 'May stop' },
    persuasive: 'What convinces?', blockers: 'What may stop the customer?', strengthen: 'What to strengthen before sending?', none: 'Nothing for now',
    editsTitle: 'Want to improve the quote without changing the price?',
    editsText: 'These are additions you can put in the quote. Each one is added only after you approve it, and you can edit it afterwards.',
    target: { terms: 'Add to the terms', warranty: 'Add to the warranty', item: (n) => `Detail for item ${n}` },
    apply: 'Add to the quote', applied: 'Added to the quote', fill: 'Fill in the ___ places in the editor.',
    listNote: 'To add a suggestion to the quote, open it in the editor.', openEditor: 'Open in the editor',
    cached: 'This is the saved result for the same quote; it was not counted again.',
    internal: 'This check is internal only. Your customer never sees it. These are AI suggestions; nothing changes in the quote without your approval.',
    errors: {
      not_deployed: 'The AI analysis is not available here yet. The basic check above is always available.',
      quota_exhausted: (l) => `All ${l} checks of this month are used.`,
      smart_pack_required: 'The AI customer check is part of SMART PACK.',
      in_progress: 'This quote is already being checked. Try again in a moment.',
      provider_failure: 'We could not complete the check, and it was not counted. You can try again.',
      failed: 'We could not complete the check. You can try again.',
      offline: 'No internet connection.',
      nothing_to_check: 'Add at least one item with a description to check the quote.',
      market_unresolved: 'Choose your business country in Business settings.',
      unauthenticated: 'Please sign in again.',
    },
    buyMore: (n, price) => `${n} more checks for ${price}`, soon: 'Coming soon', plans: 'Open the plans',
  },
};

const STATE_STYLE = {
  convinced: { bg: C.greenSoft, chip: C.greenChip, ink: C.green, border: '#bbf7d0' },
  hesitant: { bg: C.amberSoft, chip: C.amberChip, ink: C.amber, border: '#fde68a' },
  may_stop: { bg: C.redSoft, chip: C.redChip, ink: C.red, border: '#fecaca' },
};
const PERSONA_ICON = { price: Wallet, quality: BadgeCheck, skeptic: SearchCheck };
const CHECK_ICON = { ok: [CircleCheck, C.green], warn: [CircleAlert, C.amber], missing: [CircleAlert, C.red] };
// today on the Israel calendar (IRON-DATE-001 primitive) - only to tell whether the validity date has passed
const isoToday = () => { const p = calendarParts(new Date(), 'Local'); return p ? `${p.y}-${p.m}-${p.d}` : null; };

export default function CustomerTwinPanel({ open, onClose, isHebrew, supabase, quote, market, mode = 'editor', onApplyEdit = null, onOpenEditor = null, onOpenPlans = null }) {
  const ref = useRef(null);
  const closeRef = useRef(null);
  const t = COPY[isHebrew ? 'he' : 'en'];
  const [status, setStatus] = useState(null);
  const [run, setRun] = useState({ state: 'idle' });
  const [applied, setApplied] = useState(() => new Set());
  useFocusTrap(ref, open);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // once per opening (the caller re-renders with a new quote object on every keystroke - that never resets the panel)
  useEffect(() => {
    if (!open) return undefined;
    setRun({ state: 'idle' }); setApplied(new Set());
    const prev = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onCloseRef.current(); } };
    document.addEventListener('keydown', onKey);
    let live = true;
    fetchTwinStatus(supabase).then((r) => { if (live) setStatus(r.state === 'ok' ? r.status : null); });
    return () => { live = false; document.removeEventListener('keydown', onKey); if (prev && typeof prev.focus === 'function') prev.focus(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const checklist = useMemo(() => twinChecklist(quote, isoToday()).filter((c) => c.status !== 'na'), [quote]);
  if (!open) return null;
  const price = market === 'INTERNATIONAL' ? '$2' : '5 ₪';
  const s = run.status || status;
  const analysis = run.state === 'ok' ? run.analysis : null;

  const start = async () => {
    setRun({ state: 'running' });
    const r = await requestCustomerTwin(supabase, quote);
    setRun(r);
    if (r.status) setStatus(r.status);
  };
  const approve = (edit, i) => {
    if (typeof onApplyEdit !== 'function') return;
    onApplyEdit(edit);
    setApplied((prev) => new Set(prev).add(i));
  };

  const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, boxSizing: 'border-box' };
  const btn = { minHeight: 44, padding: '0 18px', borderRadius: 10, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.92rem' };
  const errorText = run.state !== 'idle' && run.state !== 'running' && run.state !== 'ok'
    ? (run.state === 'quota_exhausted' ? t.errors.quota_exhausted(s?.monthlyLimit ?? 20) : (t.errors[run.state] || t.errors.failed)) : null;

  return (
    <div className="no-print" data-testid="customer-twin-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 10040, display: 'flex', justifyContent: 'center', alignItems: 'stretch' }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="customer-twin-title" dir={isHebrew ? 'rtl' : 'ltr'} data-testid="customer-twin-panel"
        style={{ background: C.page, width: '100%', maxWidth: 1120, height: '100%', overflowY: 'auto', boxSizing: 'border-box', textAlign: 'start', color: C.text }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 1, background: C.card, borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px' }}>
          <h2 id="customer-twin-title" style={{ margin: 0, fontSize: '1.15rem', color: C.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={20} color={C.violet} aria-hidden="true" />{t.label}
          </h2>
          {/* PRODUCT_TRUTH_DECORATIVE: closes the Customer Twin panel; changes no data */}
          <button type="button" ref={closeRef} onClick={onClose} aria-label={t.close} data-testid="customer-twin-close"
            style={{ ...btn, padding: 0, minWidth: 44, justifyContent: 'center', background: C.card, border: `1px solid ${C.line}`, color: C.ink }}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section style={{ ...card, background: `linear-gradient(135deg, ${C.heroFrom}, ${C.heroTo})`, border: '1px solid #e0e7ff', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: '1 1 320px' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '1.35rem', color: C.ink }}>{t.heroTitle}</h3>
              <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.6 }}>{t.heroText}</p>
            </div>
            <div style={{ textAlign: 'center' }} dir="ltr">
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: C.ink }}>Customer <span style={{ color: C.blue }}>Twin</span></div>
              <div style={{ fontSize: '0.8rem', color: C.muted }}>By TEKANGO AI</div>
            </div>
          </section>

          {s && (
            <div data-testid="customer-twin-counter" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {s.monthlyLimit > 0 && <span style={{ background: C.blueSoft, color: C.blue, borderRadius: 999, padding: '6px 12px', fontWeight: 700, fontSize: '0.85rem' }}>{t.monthly(s.monthlyRemaining, s.monthlyLimit)}</span>}
              {s.purchasedTotal > 0 && <span style={{ background: '#f5f3ff', color: C.violet, borderRadius: 999, padding: '6px 12px', fontWeight: 700, fontSize: '0.85rem' }}>{t.purchased(s.purchasedRemaining, s.purchasedTotal)}</span>}
            </div>
          )}

          <section style={card} data-testid="customer-twin-checklist">
            <h4 style={{ margin: '0 0 10px', fontSize: '1rem', color: C.ink }}>{t.checklistTitle}</h4>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
              {checklist.map((c) => {
                const [Icon, color] = CHECK_ICON[c.status] || [CircleMinus, C.muted];
                return (
                  <li key={c.id} data-check={c.id} data-status={c.status} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
                    <Icon size={18} color={color} aria-hidden="true" style={{ flexShrink: 0 }} />{t.checks[c.id]?.[c.status] || ''}
                  </li>
                );
              })}
            </ul>
          </section>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            {/* PRODUCT_TRUTH_DECORATIVE: starts the Customer Twin AI check of this quote (a local feature; its capability id awaits the Owner's L-14 registry approval) */}
            <button type="button" onClick={start} disabled={run.state === 'running' || !quote} data-testid="customer-twin-run"
              style={{ ...btn, background: C.blue, color: '#fff', border: 'none', opacity: run.state === 'running' || !quote ? 0.7 : 1 }}>
              <Sparkles size={18} aria-hidden="true" />{run.state === 'running' ? t.running : analysis ? t.again : t.run}
            </button>
            {run.state === 'ok' && run.cached && <span style={{ fontSize: '0.85rem', color: C.muted }}>{t.cached}</span>}
          </div>

          {errorText && (
            <div role="alert" data-testid="customer-twin-error" data-code={run.state} style={{ ...card, background: C.amberSoft, border: '1px solid #fde68a', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontWeight: 700, color: C.ink }}>{errorText}</span>
              {(run.state === 'quota_exhausted' || run.state === 'smart_pack_required') && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  {/* PRODUCT_TRUTH_DECORATIVE: purchase of extra Customer Twin checks, shown as not available yet while billing is off; starts nothing */}
                  <button type="button" disabled style={{ ...btn, background: '#e2e8f0', color: C.muted, border: '1px solid #cbd5e1', cursor: 'not-allowed' }}>
                    {t.buyMore(run.state === 'quota_exhausted' ? 20 : 10, price)} · {t.soon}
                  </button>
                  {run.state === 'smart_pack_required' && typeof onOpenPlans === 'function' && (
                    // PRODUCT_TRUTH_DECORATIVE: opens the plans window (SMART PACK is chosen there); starts no payment by itself
                    <button type="button" onClick={onOpenPlans} style={{ ...btn, background: C.card, color: C.blue, border: `1px solid ${C.blue}` }}>{t.plans}</button>
                  )}
                </div>
              )}
            </div>
          )}

          {analysis && (
            <>
              <div data-testid="customer-twin-personas" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                {analysis.personas.map((p) => {
                  const st = STATE_STYLE[p.state] || STATE_STYLE.hesitant;
                  const Icon = PERSONA_ICON[p.kind] || Wallet;
                  return (
                    <article key={p.kind} data-persona={p.kind} data-state={p.state} style={{ ...card, background: st.bg, border: `1px solid ${st.border}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 48, height: 48, borderRadius: '50%', background: C.card, border: `2px solid ${st.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon size={24} color={st.ink} aria-hidden="true" />
                        </span>
                        <div>
                          <div style={{ fontWeight: 800, color: C.ink }}>{t.personas[p.kind].title}</div>
                          <div style={{ fontSize: '0.8rem', color: C.muted }}>{t.personas[p.kind].sub}</div>
                        </div>
                      </div>
                      <span style={{ alignSelf: 'flex-start', background: st.chip, color: st.ink, borderRadius: 999, padding: '4px 12px', fontWeight: 800, fontSize: '0.85rem' }}>{t.states[p.state]}</span>
                      <p style={{ margin: 0, background: C.card, borderRadius: 10, padding: 12, fontSize: '0.9rem', lineHeight: 1.6 }}>“{p.says}”</p>
                    </article>
                  );
                })}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                {[['persuasive', Check, C.green], ['blockers', AlertCircle, C.red], ['strengthen', Lightbulb, C.amber]].map(([key, Icon, color]) => (
                  <section key={key} data-list={key} style={card}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '1rem', color: C.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon size={20} color={color} aria-hidden="true" />{t[key]}
                    </h4>
                    {analysis[key].length ? (
                      <ul style={{ margin: 0, paddingInlineStart: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.9rem' }}>
                        {analysis[key].map((line, i) => <li key={i}>{line}</li>)}
                      </ul>
                    ) : <p style={{ margin: 0, color: C.muted, fontSize: '0.9rem' }}>{t.none}</p>}
                  </section>
                ))}
              </div>

              {analysis.edits.length > 0 && (
                <section data-testid="customer-twin-edits" style={{ ...card, background: `linear-gradient(135deg, ${C.heroFrom}, ${C.heroTo})`, border: '1px solid #e0e7ff', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', color: C.ink, display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={20} color={C.violet} aria-hidden="true" />{t.editsTitle}</h4>
                  <p style={{ margin: 0, fontSize: '0.88rem' }}>{mode === 'editor' ? t.editsText : t.listNote}</p>
                  {analysis.edits.map((e, i) => (
                    <div key={i} data-edit={e.target} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ flex: '1 1 260px' }}>
                        <div style={{ fontSize: '0.78rem', color: C.violet, fontWeight: 700 }}>{e.target === 'item' ? t.target.item(e.itemNumber) : t.target[e.target]}</div>
                        <div style={{ color: C.ink, fontWeight: 600, margin: '2px 0' }}>{e.text}</div>
                        {e.reason && <div style={{ fontSize: '0.8rem', color: C.muted }}>{e.reason}</div>}
                      </div>
                      {mode === 'editor' && typeof onApplyEdit === 'function' && (applied.has(i) ? (
                        <span style={{ color: C.green, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Check size={16} aria-hidden="true" />{t.applied}</span>
                      ) : (
                        // PRODUCT_TRUTH_DECORATIVE: adds ONE approved Customer Twin suggestion to the open draft (the owner saves the quote as usual)
                        <button type="button" onClick={() => approve(e, i)} data-testid="customer-twin-apply"
                          style={{ ...btn, background: C.blue, color: '#fff', border: 'none' }}><Plus size={16} aria-hidden="true" />{t.apply}</button>
                      ))}
                    </div>
                  ))}
                  {mode === 'editor' && analysis.edits.some((e) => e.text.includes('___')) && <p style={{ margin: 0, fontSize: '0.8rem', color: C.muted }}>{t.fill}</p>}
                  {mode !== 'editor' && typeof onOpenEditor === 'function' && (
                    // PRODUCT_TRUTH_DECORATIVE: opens this quote in the editor (the existing Edit flow), where the suggestions can be added
                    <button type="button" onClick={onOpenEditor} style={{ ...btn, alignSelf: 'flex-start', background: C.blue, color: '#fff', border: 'none' }}><Pencil size={16} aria-hidden="true" />{t.openEditor}</button>
                  )}
                </section>
              )}
            </>
          )}

          <p data-testid="customer-twin-internal" style={{ margin: '4px 0 24px', fontSize: '0.8rem', color: C.muted, textAlign: 'center' }}>{t.internal}</p>
        </div>
      </div>
    </div>
  );
}
