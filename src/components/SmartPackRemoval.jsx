// Owner console 2026-10-26 (typed: "מאשר הסרת חכם פלוס בשירות עצמי: בחודשי בסוף התקופה ששולמה בלי החזר, בשנתי לפי סעיף 6, כולל
// שינוי ב-L-14, L-17 ו-L-22"; 20261027100000): a subscriber removes SMART PACK from the plans window. Every date and amount is the
// server's (subscription-authority smart_pack_removal_quote); the removal stops the renewal now, SMART PACK runs to the end of the paid
// period, and a yearly SMART PACK is refunded pro rata less the section 6 fee. Nothing is charged here.
import { useEffect, useRef, useState } from 'react';
import { formatShortDate } from '../utils/shortDate';
import { formatWholeMoney } from '../utils/money';
import { loadSmartPackRemovalQuote, removeSmartPack, smartPackRemovalErrorMessage } from '../domain/subscriptions/packageCheckout';

const money = (minor) => `₪${formatWholeMoney(minor / 100)}`;
const israelDate = (iso) => formatShortDate(iso, 'Local');
const num = (text) => <bdi dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>{text}</bdi>;
const linkBtn = { background: 'none', border: 'none', padding: 0, color: '#0F6672', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'inherit', minHeight: 32 };

export default function SmartPackRemoval({ isHebrew, invoke, onDone }) {
  const he = isHebrew;
  const [quote, setQuote] = useState(null);
  const [step, setStep] = useState('idle'); // idle | confirm | busy | done
  const [result, setResult] = useState(null);
  const invokeRef = useRef(invoke);
  invokeRef.current = invoke;
  useEffect(() => {
    let alive = true;
    loadSmartPackRemovalQuote({ invoke: (...a) => invokeRef.current(...a) }).then((q) => { if (alive) setQuote(q); })
      .catch(() => { if (alive) setQuote({ ok: false, code: 'checkout_unavailable' }); });
    return () => { alive = false; };
  }, []);
  if (!quote) return null;
  const box = { maxWidth: '440px', margin: '0 auto 12px', textAlign: 'center', color: '#475569', fontSize: '0.82rem' };
  // already removed: SMART PACK runs to its date and does not renew (the status line above says "active until")
  if (quote.ok !== true && quote.code === 'already_removed') {
    return <p data-testid="plans-smart-pack-removed" dir={he ? 'rtl' : 'ltr'} style={box}>{he ? 'חכם פלוס לא יתחדש.' : 'SMART PACK will not renew.'}</p>;
  }
  if (quote.ok !== true) return null;
  if (step === 'done' && result) {
    return (
      <p data-testid="plans-smart-pack-removal-done" role="status" dir={he ? 'rtl' : 'ltr'} style={{ ...box, color: '#0F6672', fontWeight: 700 }}>
        {result.state === 'removed'
          ? <>{he ? <>חכם פלוס יפעל עד {num(israelDate(result.effectiveAt))} ולא יתחדש.</> : <>SMART PACK runs until {num(israelDate(result.effectiveAt))} and will not renew.</>}
            {/* 20261029000000 (Codex F02): the refund is promised as done only when it was made */}
            {result.refundMinor > 0 && result.refundState === 'refunded' && <> {he ? <>החזר של {num(money(result.refundMinor))} יגיע לכרטיס.</> : <>A refund of {num(money(result.refundMinor))} goes back to your card.</>}</>}
            {result.refundMinor > 0 && result.refundState !== 'refunded' && <> {he ? <>ההחזר של {num(money(result.refundMinor))} עדיין בטיפול ויבוצע לכרטיס ששימש לתשלום. לשאלות כתבו לנו: <bdi dir="ltr">support@tekango.com</bdi></> : <>Your refund of {num(money(result.refundMinor))} is still being processed and will go back to the card you paid with. Questions? Write to us: <bdi dir="ltr">support@tekango.com</bdi></>}</>}</>
          : smartPackRemovalErrorMessage(result.code ?? (result.state === 'pending' ? 'pending' : 'refused'), he)}
      </p>
    );
  }
  const year = quote.period === 'year';
  const onRemove = async () => {
    setStep('busy');
    const r = await removeSmartPack({ invoke }).catch(() => ({ ok: false, code: 'checkout_unavailable' }));
    setResult(r.ok ? r : { state: 'error', code: r.code });
    setStep('done');
    if (r.ok && typeof onDone === 'function') onDone();
  };
  if (step === 'idle') {
    return (
      <p style={box} dir={he ? 'rtl' : 'ltr'}>
        {/* PRODUCT_TRUTH_DECORATIVE: opens the confirmation of the SMART PACK removal; nothing changes until it is confirmed */}
        <button type="button" data-testid="plans-smart-pack-remove" onClick={() => setStep('confirm')} style={linkBtn}>{he ? 'הסרת חכם פלוס' : 'Remove SMART PACK'}</button>
      </p>
    );
  }
  return (
    <section data-testid="plans-smart-pack-removal-confirm" role="group" aria-label={he ? 'הסרת חכם פלוס' : 'Remove SMART PACK'} dir={he ? 'rtl' : 'ltr'}
      style={{ maxWidth: '440px', margin: '0 auto 12px', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '12px', background: '#fff', boxSizing: 'border-box',
        textAlign: he ? 'right' : 'left', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <p data-testid="plans-smart-pack-removal-text" style={{ margin: 0, color: '#1e293b', fontSize: '0.88rem' }}>
        {he ? <>להסיר את חכם פלוס? הוא ימשיך לפעול עד {num(israelDate(quote.effectiveAt))} ולא יתחדש.</>
          : <>Remove SMART PACK? It keeps working until {num(israelDate(quote.effectiveAt))} and will not renew.</>}{' '}
        {year
          ? (he ? <>יוחזרו לכם {num(money(quote.refundMinor))} - החזר יחסי בניכוי דמי ביטול, לפי סעיף 6 בתנאי השימוש.</>
            : <>{num(money(quote.refundMinor))} is refunded - pro rata less the cancellation fee, as set out in section 6 of the Terms.</>)
          : (he ? 'אין החזר על החודש ששולם.' : 'There is no refund for the month already paid.')}
      </p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {/* PRODUCT_TRUTH_DECORATIVE: confirms the SMART PACK removal - the server takes the line off the standing order (the next charge is the plan alone) */}
        <button type="button" data-testid="plans-smart-pack-removal-yes" disabled={step === 'busy'} onClick={onRemove}
          style={{ minHeight: 40, borderRadius: 9, border: 'none', background: step === 'busy' ? '#94a3b8' : '#b45309', color: '#fff', fontWeight: 700, padding: '0 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
          {step === 'busy' ? (he ? 'מסירים…' : 'Removing…') : (he ? 'כן, להסיר' : 'Yes, remove')}
        </button>
        {/* PRODUCT_TRUTH_DECORATIVE: closes the confirmation; nothing changes */}
        <button type="button" data-testid="plans-smart-pack-removal-no" disabled={step === 'busy'} onClick={() => setStep('idle')}
          style={{ minHeight: 40, borderRadius: 9, border: '1px solid #94a3b8', background: '#fff', color: '#1e293b', fontWeight: 700, padding: '0 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
          {he ? 'לא, להשאיר' : 'No, keep it'}
        </button>
      </div>
    </section>
  );
}
