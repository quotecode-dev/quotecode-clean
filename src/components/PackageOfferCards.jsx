// Task 27: the in-app offer cards (Free-10 + the one all-inclusive package) used by the plans view (PricingModal) and the Free-10 upgrade
// window. Data = pricingModalModel (one price source). The package card has an accessible monthly / annual radio choice and shows ONE
// price at a time, with the saving line only for the annual period. Display only: no purchase action exists while checkout is inactive.
import { useId, useState } from 'react';
import { Check, BrainCircuit } from 'lucide-react';
import './landing/smartPack.css';

// Task 30: amounts and percentages inside a note ("15%", "₪54.00", "$32.00") are LTR-isolated, tabular figures (text unchanged).
const NUMERIC_TOKEN = /([₪$€£]?\d[\d.,]*%?)/;
function isolateNumbers(text) {
  return String(text).split(NUMERIC_TOKEN).map((part, i) => (i % 2 === 1
    ? <bdi key={i} dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>{part}</bdi>
    : part));
}

// Owner console 2026-10-20 (typed: "מאשר שינוי ב-L-22: תיבת הוספה של חכם פלוס במסך המסלולים בתוך המערכת ..."): the package card offers the
// unticked SMART PACK add-on box (`plan.addOn`, pricingModalModel) - the same look as the landing plan card; ticked, the shown price is
// the package plus the add-on for the chosen period, with the breakdown line. Display only: nothing is purchased or stored.
// Owner console 2026-10-20 (typed: "מאשר שינוי ב-L-22: כפתור לתשלום במסך המסלולים, ותיבת חכם פלוס שנוספת לאותו תשלום"): when the
// server billing phase is on (`purchase.enabled`, packageCheckoutAvailable), the package card gets a pay button for the chosen period;
// the ticked SMART PACK box joins the same payment. Off (today) = the card renders exactly as before.
const PAY_COPY = {
  he: { pay: 'לתשלום', busy: 'פותח את דף התשלום…', fee: 'ביטול מוקדם: החזר יחסי בניכוי דמי ביטול, לפי סעיף 6 בתנאי השימוש.' },
  en: { pay: 'Pay now', busy: 'Opening the payment page…', fee: 'Early cancellation: a pro-rata refund less a cancellation fee, as set out in section 6 of the Terms.' },
};
function PayAction({ purchase, period, withAddOn, isHebrew }) {
  const t = PAY_COPY[isHebrew ? 'he' : 'en'];
  return (
    <div data-pay-action style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
      {/* PRODUCT_TRUTH_DECORATIVE: opens the PayPlus payment page of the SERVER attempt (package of the chosen period + the ticked SMART PACK line); rendered only while the server billing phase is on; the package opens only after a verified payment */}
      <button type="button" data-testid="plans-pay" disabled={purchase.busy} onClick={() => purchase.onPay({ billingPeriod: period, smartPack: withAddOn })}
        style={{ minHeight: 44, borderRadius: 10, border: 'none', background: purchase.busy ? '#94a3b8' : '#0F6672', color: '#ffffff', fontWeight: 800,
          fontSize: '0.95rem', cursor: purchase.busy ? 'wait' : 'pointer' }}>
        {purchase.busy ? t.busy : t.pay}
      </button>
      {purchase.error && <p role="alert" data-testid="plans-pay-error" dir={isHebrew ? 'rtl' : 'ltr'} style={{ margin: 0, color: '#b91c1c', fontSize: '0.8rem' }}>{purchase.error}</p>}
      <p data-testid="plans-pay-fee" dir={isHebrew ? 'rtl' : 'ltr'} style={{ margin: 0, color: '#64748b', fontSize: '0.75rem' }}>{t.fee}</p>
    </div>
  );
}

// Owner console 2026-10-21 (typed L-22 approval): onAddOnChange tells the plans window the box state, so the local-currency estimate
// below the cards follows the total that would be charged
function PriceBlock({ plan, isHebrew, purchase = null, onAddOnChange = null }) {
  const uid = useId();
  const [period, setPeriod] = useState(plan.prices[0]?.period);
  const [withAddOn, setWithAddOn] = useState(false);
  const addOnFor = (r) => (withAddOn && plan.addOn ? plan.addOn.perPeriod[r.period] : null);
  const choice = plan.periodChoice && plan.prices.length > 1 ? plan.periodChoice : null;
  const shown = choice ? plan.prices.filter((r) => r.period === period) : plan.prices;
  return (
    <div data-region="price">
      {choice && (
        <fieldset data-period-choice style={{ border: 0, padding: 0, margin: '0 0 6px', minWidth: 0 }}>
          <legend style={{ padding: 0, marginBottom: 4, fontSize: '0.76rem', fontWeight: 600, color: '#475569' }}>{choice.legend}</legend>
          <div style={{ display: 'inline-flex', gap: 4, padding: 3, background: '#eef2f3', border: '1px solid #d5dee0', borderRadius: 9, flexWrap: 'wrap' }}>
            {plan.prices.map((r) => (
              <label key={r.period} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 40, minWidth: 76,
                padding: '0 12px', borderRadius: 7, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', boxSizing: 'border-box',
                background: period === r.period ? '#0F6672' : 'transparent', color: period === r.period ? '#ffffff' : '#1e293b' }}>
                {/* PRODUCT_TRUTH_DECORATIVE: chooses which billing period's price the offer card shows; no purchase, nothing stored */}
                <input type="radio" name={`${uid}-period`} value={r.period} checked={period === r.period} onChange={() => setPeriod(r.period)} data-period={r.period}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, opacity: 0, cursor: 'pointer' }} />
                <span>{choice.labels[r.period]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div aria-live={choice ? 'polite' : undefined}>
        {shown.map((r) => (
          <div key={r.period}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }} data-billing-period={r.period}>
              <span className="pf-money" data-price style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', fontVariantNumeric: 'tabular-nums', direction: 'ltr', unicodeBidi: 'isolate' }}>{addOnFor(r)?.amount || r.amount}</span>
              {r.per && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{r.per}</span>}
            </div>
            {addOnFor(r) && <div className="tl-plan-addon-line" data-addon-line={r.period} dir={isHebrew ? 'rtl' : 'ltr'}>{isolateNumbers(addOnFor(r).line)}</div>}
            {r.note && <div data-period-note={r.period} dir={isHebrew ? 'rtl' : 'ltr'} style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 6, background: '#e3f1ea', color: '#1e5c42', fontSize: '0.8rem', fontWeight: 700 }}>{isolateNumbers(r.note)}</div>}
          </div>
        ))}
      </div>
      {plan.addOn && (
        <label className={`tl-plan-addon${withAddOn ? ' is-checked' : ''}`} data-addon-choice dir={isHebrew ? 'rtl' : 'ltr'}>
          {/* PRODUCT_TRUTH_DECORATIVE: adds the SMART PACK add-on to the offer card's shown price; no purchase, nothing stored */}
          <input type="checkbox" checked={withAddOn} onChange={(e) => { setWithAddOn(e.target.checked); if (typeof onAddOnChange === 'function') onAddOnChange(e.target.checked); }} data-addon-toggle />
          <span className="tl-plan-addon-check" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
          <span className="tl-plan-addon-icon" aria-hidden="true"><BrainCircuit size={18} strokeWidth={2.1} /></span>
          <span className="tl-plan-addon-text"><strong>{plan.addOn.label}</strong> {isolateNumbers(plan.addOn.perPeriod[period]?.add || '')}</span>
        </label>
      )}
      {plan.addOn?.summary && <p className="tl-plan-addon-summary" data-addon-summary dir={isHebrew ? 'rtl' : 'ltr'}>{plan.addOn.summary}</p>}
      {purchase?.enabled && plan.id === 'all_inclusive' && <PayAction purchase={purchase} period={period} withAddOn={Boolean(plan.addOn) && withAddOn} isHebrew={isHebrew} />}
    </div>
  );
}

export default function PackageOfferCards({ model, isHebrew, currentPlanId = null, only = null, testIdPrefix = 'plans-modal', purchase = null, onAddOnChange = null }) {
  const plans = only ? model.plans.filter((p) => only.includes(p.id)) : model.plans;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
      {plans.map((p) => {
        const isCurrent = currentPlanId === p.id;
        return (
          <section key={p.id} data-testid={`${testIdPrefix}-card-${p.id}`} aria-label={p.name}
            style={{ border: `${isCurrent ? 2 : 1}px solid ${isCurrent ? '#0F6672' : '#e2e8f0'}`, borderRadius: '12px', padding: '14px', background: '#f8fafc', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.05rem' }}>{p.name}</h3>
            {p.tagline && <p style={{ margin: 0, color: '#475569', fontSize: '0.82rem' }}>{p.tagline}</p>}
            <PriceBlock plan={p} isHebrew={isHebrew} purchase={purchase} onAddOnChange={onAddOnChange} />
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: '#334155' }}>
              {p.lines.map((line) => (
                <li key={line} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}><Check size={14} color="#0F6672" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />{line}</li>
              ))}
            </ul>
            {isCurrent && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F6672' }}>{isHebrew ? 'המסלול שלך' : 'Your plan'}</span>}
          </section>
        );
      })}
    </div>
  );
}
