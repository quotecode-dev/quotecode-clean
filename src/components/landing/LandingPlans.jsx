// Plan cards (IRON-LANDING-001 as amended by the Owner 2026-10-11; PROFLOW_PROJECT_CONTEXT.md §249): Free-10, then ONE all-inclusive
// package, shown for review. The page files own every string and take the numbers from landingPackageFacts.js; this component only lays
// them out in six shared regions (name, description, price, capacity, features, notice) so the rows of both cards line up (OD-12).
// Task 26 (Owner 2026-10-11): a card with several billing periods (`periodChoice`) shows an accessible monthly / annual radio choice
// and exactly ONE price at a time - the chosen period's (initially the first, monthly), plus that period's note when it has one (the
// annual saving vs 12 monthly payments). Choosing a period only changes the displayed price: registration and billing are not active, so the cards carry no purchase, signup or plan-hint action and nothing is stored.
// The Free-10 call to action lives OUTSIDE the cards (LandingPage.jsx), always paired with its "not active yet" status.
import { useId, useState } from 'react';
import { CheckCircle2, Check, BrainCircuit } from 'lucide-react';
import './smartPack.css';

// Owner 2026-10-20 (TEST only): a card may offer the SMART PACK add-on (`addOn`) - an unticked box under the price; ticked, the shown price
// becomes the package plus the add-on for the chosen period, with the breakdown line. Display only: nothing is purchased or stored.
function PlanPrice({ plan }) {
  const uid = useId();
  const [period, setPeriod] = useState(plan.prices[0]?.period);
  const [withAddOn, setWithAddOn] = useState(false);
  const addOnFor = (r) => (withAddOn && plan.addOn ? plan.addOn.perPeriod[r.period] : null);
  const choice = plan.periodChoice && plan.prices.length > 1 ? plan.periodChoice : null;
  const shown = choice ? plan.prices.filter((r) => r.period === period) : plan.prices;
  return (
    <div className="tl-plan-price" data-region="price">
      {choice && (
        <fieldset className="tl-period" data-period-choice>
          <legend className="tl-period-legend">{choice.legend}</legend>
          <div className="tl-period-options">
            {plan.prices.map((r) => (
              <label key={r.period} className={`tl-period-option${period === r.period ? ' is-checked' : ''}`}>
                {/* PRODUCT_TRUTH_DECORATIVE: chooses which billing period's price the review card shows; no purchase, nothing stored */}
                <input type="radio" name={`${uid}-period`} value={r.period} checked={period === r.period} onChange={() => setPeriod(r.period)} data-period={r.period} />
                <span>{choice.labels[r.period]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div aria-live={choice ? 'polite' : undefined}>
        {shown.map((r) => (
          <div key={r.period}>
            <p className="tl-plan-price-row" data-billing-period={r.period}>
              <span className="tl-plan-amount">{addOnFor(r)?.amount || r.amount}</span>
              {r.per && <span className="tl-plan-per">{r.per}</span>}
            </p>
            {addOnFor(r) && <p className="tl-plan-addon-line" data-addon-line={r.period}>{addOnFor(r).line}</p>}
            {r.note && <p className="tl-plan-saving" data-period-note={r.period}>{r.note}</p>}
          </div>
        ))}
      </div>
      {plan.addOn && (
        <label className={`tl-plan-addon${withAddOn ? ' is-checked' : ''}`} data-addon-choice>
          {/* PRODUCT_TRUTH_DECORATIVE: adds the SMART PACK add-on to the review card's shown price; no purchase, nothing stored */}
          <input type="checkbox" checked={withAddOn} onChange={(e) => setWithAddOn(e.target.checked)} data-addon-toggle />
          <span className="tl-plan-addon-check" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
          <span className="tl-plan-addon-icon" aria-hidden="true"><BrainCircuit size={18} strokeWidth={2.1} /></span>
          <span className="tl-plan-addon-text"><strong>{plan.addOn.label}</strong> {plan.addOn.perPeriod[period]?.add}</span>
        </label>
      )}
    </div>
  );
}

export default function LandingPlans({ copy, plans }) {
  return (
    <div className="tl-plans">
      <p className="tl-plans-review" role="note">{copy.reviewNotice}</p>
      {copy.priceNote && <p className="tl-plans-price-note" data-price-note>{copy.priceNote}</p>}
      <div className="tl-plan-grid tl-plan-grid--two">
        {plans.map((p) => {
          const Icon = p.icon;
          return (
            <article key={p.id} className="tl-plan" data-plan-card={p.id}>
              <div className="tl-plan-head" data-region="name">
                {Icon && <Icon size={20} strokeWidth={2} aria-hidden="true" />}
                <h3>{p.name}</h3>
              </div>
              <p className="tl-plan-tagline" data-region="description">{p.tagline}</p>
              <PlanPrice plan={p} />
              <ul className="tl-plan-capacity" data-region="capacity">
                {p.capacity.map((t) => (
                  <li key={t}><CheckCircle2 size={16} aria-hidden="true" /><span>{t}</span></li>
                ))}
              </ul>
              <ul className="tl-plan-features" data-region="features">
                {p.features.map((t) => (
                  <li key={t}><CheckCircle2 size={16} aria-hidden="true" /><span>{t}</span></li>
                ))}
              </ul>
              <p className="tl-plan-notice" data-region="notice">{p.notice}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
