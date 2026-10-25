// Owner console 2026-10-25 ("ב: חיוב יחסי עכשיו"; 20261025300000): an active subscriber without SMART PACK adds it from the plans
// window. The amount is the server's (subscription-authority smart_pack_add_on_quote: the SMART PACK price x the days left of the paid
// period); the button leaves for the server's one-time PayPlus page. Nothing opens here - SMART PACK opens only after a verified payment,
// and from the next renewal it rides on the subscription (the standing order line).
import { useEffect, useRef, useState } from 'react';
import { BrainCircuit } from 'lucide-react';
import { SMART_PACK } from '../domain/subscriptions/addOnCatalog';
import { formatWholeMoney } from '../utils/money';
import { formatShortDate } from '../utils/shortDate';
import { loadSmartPackAddOnQuote, smartPackAddOnErrorMessage, startSmartPackAddOn } from '../domain/subscriptions/packageCheckout';

// IRON-ILS-001: a whole shekel with .00 (the server charges whole shekels); IRON-DATE-001: the Israeli short date DD/MM/YYYY
const money = (minor) => `₪${formatWholeMoney(minor / 100)}`;
const israelDate = (iso) => formatShortDate(iso, 'Local');
const num = (text) => <bdi dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>{text}</bdi>;

export default function SmartPackAddOnOffer({ isHebrew, invoke, onLeave }) {
  const [quote, setQuote] = useState(null); // null = loading; { ok, ... }
  const [pay, setPay] = useState({ busy: false, error: null });
  // the quote is read once per opening of the window (the caller's invoke may be a new function on every render)
  const invokeRef = useRef(invoke);
  invokeRef.current = invoke;
  useEffect(() => {
    let alive = true;
    loadSmartPackAddOnQuote({ invoke: (...a) => invokeRef.current(...a) }).then((q) => { if (alive) setQuote(q); })
      .catch(() => { if (alive) setQuote({ ok: false, code: 'checkout_unavailable' }); });
    // a fresh pay button when the browser brings this page back from the payment page (Back)
    const back = () => setPay({ busy: false, error: null });
    window.addEventListener('pageshow', back);
    return () => { alive = false; window.removeEventListener('pageshow', back); };
  }, []);
  if (!quote || quote.ok !== true || !Number.isFinite(Date.parse(quote.periodEnd))) return null; // nothing to offer (or not now)
  const he = isHebrew;
  const per = quote.period === 'year' ? (he ? 'לשנה' : 'a year') : (he ? 'לחודש' : 'a month');
  const onPay = async () => {
    setPay({ busy: true, error: null });
    const r = await startSmartPackAddOn({ invoke }).catch(() => ({ ok: false, code: 'checkout_unavailable' }));
    if (r.ok) { onLeave(r.redirectUrl); return; }
    setPay({ busy: false, error: smartPackAddOnErrorMessage(r.code, he) });
  };
  return (
    <section data-testid="plans-smart-pack-add-on" aria-label={he ? 'הוספת חכם פלוס' : 'Add SMART PACK'} dir={he ? 'rtl' : 'ltr'}
      style={{ maxWidth: '440px', margin: '0 auto 14px', border: '1px solid #0F6672', borderRadius: '12px', padding: '14px', background: '#f0f9f8',
        display: 'flex', flexDirection: 'column', gap: '8px', boxSizing: 'border-box', textAlign: he ? 'right' : 'left' }}>
      <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <BrainCircuit size={18} color="#0F6672" aria-hidden="true" />
        {he ? 'הוספת חכם פלוס למנוי' : 'Add SMART PACK to your package'}
      </h3>
      <p style={{ margin: 0, color: '#475569', fontSize: '0.82rem' }}>{SMART_PACK.summary[he ? 'he' : 'en']}</p>
      <p data-testid="plans-smart-pack-add-on-now" style={{ margin: 0, color: '#1e293b', fontSize: '0.88rem', fontWeight: 700 }}>
        {he ? <>לתשלום עכשיו: {num(money(quote.amountMinor))} (חלק יחסי עד {num(israelDate(quote.periodEnd))})</>
          : <>{num(money(quote.amountMinor))} now (pro-rated until {num(israelDate(quote.periodEnd))})</>}
      </p>
      <p data-testid="plans-smart-pack-add-on-then" style={{ margin: 0, color: '#334155', fontSize: '0.82rem' }}>
        {he ? <>אחר כך {num(money(quote.recurringMinor))} {per}, יחד עם חידוש המנוי.</> : <>Then {num(money(quote.recurringMinor))} {per}, with your package renewal.</>}
      </p>
      {/* PRODUCT_TRUTH_DECORATIVE: opens the PayPlus one-time page of the SERVER add-on row (the server's pro-rata amount); SMART PACK opens only after a verified payment */}
      <button type="button" data-testid="plans-smart-pack-add-on-pay" disabled={pay.busy} onClick={onPay}
        style={{ minHeight: 44, borderRadius: 10, border: 'none', background: pay.busy ? '#94a3b8' : '#0F6672', color: '#ffffff', fontWeight: 800,
          fontSize: '0.95rem', cursor: pay.busy ? 'wait' : 'pointer' }}>
        {pay.busy ? (he ? 'פותח את דף התשלום…' : 'Opening the payment page…') : <>{he ? 'הוספה ותשלום' : 'Add and pay'} {num(money(quote.amountMinor))}</>}
      </button>
      {pay.error && <p role="alert" data-testid="plans-smart-pack-add-on-error" style={{ margin: 0, color: '#b91c1c', fontSize: '0.8rem' }}>{pay.error}</p>}
    </section>
  );
}
