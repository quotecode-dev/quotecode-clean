// The in-app plans view. Task 27 (§249 + the Owner's 2026-10-11 amendment, §253): Free-10 and ONE all-inclusive package, monthly or
// annual, from the one price source (pricingModalModel -> packageCatalog.js): IL ₪30.00 / ₪306.00 including VAT, INTERNATIONAL
// $18.00 / $184.00 USD - the shown amount is the amount that would be billed. Quote styles are not plans; a legacy style plan an account
// may hold is shown only as its current-plan line. Purchase is server-driven: Owner console 2026-10-20 (typed L-22 approval for the pay
// button + the SMART PACK box on the same payment) - the pay button appears only while the server billing phase is on
// (packageCheckoutAvailable); it opens the server attempt's payment page and never changes the plan itself (only a verified payment does).
// The current plan line comes ONLY from the server account summary (OD-20); market = the server summary market, else the
// account's recorded business market (never the UI language, locale or a client-side rate).
// Owner console 2026-10-21 (typed: "מאשר שינוי ב-L-22 וב-L-01: מסך החזרה מהתשלום בחלון המסלולים, ותיקון הנוסח, הכפתור והשוק בחלון
// המסלולים"): the return-from-payment line (billingReturn: waiting / confirmed / timeout / failed / cancelled - 'confirmed' only from
// the server summary); while paying is possible the 'not available yet' and 'details later' lines are not shown; the pay button
// starts fresh whenever the window opens or the page comes back from the payment page; Israel only (packageCheckoutAvailable).
import { useEffect, useState } from 'react';
import { X, LayoutList } from 'lucide-react';
import { loadUsdRate, ESTIMATE_CURRENCIES } from '../domain/subscriptions/localPriceEstimate';
import BrandName from './BrandName';
import AiModalHeader from './AiModalHeader';
import { pricingModalModel } from '../domain/subscriptions/pricingModalModel';
import { accountStatusModel, lifetimeAccountModel } from '../domain/subscriptions/accountSummaryClient';
import PackageOfferCards from './PackageOfferCards';
import { packageCheckoutAvailable, checkoutErrorMessage, billingReturnText, israelPurchaseOpen, plansAvailabilityLine, smartPackStatusLine, pastDueLine } from '../domain/subscriptions/packageCheckout';
import { formatShortDate } from '../utils/shortDate';
import SmartPackAddOnOffer from './SmartPackAddOnOffer';
import SmartPackRemoval from './SmartPackRemoval';
import MailLink from './MailLink';

// Owner 2026-10-25 ("למה פשוט לא לכתוב במסלולים שהוא נמצא עכשיו במסלול חינם, למה יש לו את האופציה לבחור את זה בכלל?"): the Free plan is
// never a card to choose - the status lines above say the account is on it (and its balance); only the paid package card, single width.
// Owner console 2026-10-25 (typed: "מאשר שינוי ב-L-22 וב-L-01 ... כפתור הוספת חכם פלוס ... - מאשר"; "ב: חיוב יחסי עכשיו"): an active
// subscriber without SMART PACK gets the add-on box (smartPackAddOn = { invoke, onLeave }, only when smartPackAddOnAvailable); back from
// its page the return line speaks of SMART PACK (billingReturn.addOn)
// Owner console 2026-10-25 (typed: "מאשר לתקן את ממצאים 1 עד 13 בעברית ובאנגלית, כולל שינוי ב-L-01, L-14, L-17, L-22"): the account's
// SMART PACK line, a failed renewal's line with the service mailbox, and an availability line that says the truth (loading + retry,
// not open abroad, billing off) instead of "cannot be purchased yet"; the card of the account's own plan opens on its own period.
// item ד: amounts inside the SMART PACK information line are LTR atoms (the same rule as the card notes)
const NUMERIC_TOKEN = /([≈₪$\u20AC\u00A3]*\d[\d.,]*%?)/;
const isolateNumbers = (text) => String(text).split(NUMERIC_TOKEN).map((part, i) => (i % 2 === 1
  ? <bdi key={i} dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>{part}</bdi> : part));

export default function PricingModal({ isOpen, onClose, isHebrew, isLocalIsraeliBusiness, accountSummary, currency, accountCurrency = null, isLifetime = false, statusLine = null, onPurchase = null, billingReturn = null, smartPackAddOn = null, smartPackRemoval = null, onRetrySummary = null }) {
  const [rate, setRate] = useState(null);
  const [pay, setPay] = useState({ busy: false, error: null });
  // Owner console 2026-10-21 (typed L-22 approval): the SMART PACK box state, so the local-currency estimate follows the total
  const [addOnTicked, setAddOnTicked] = useState(false);
  // Owner console 2026-10-26 (typed L-01 / L-22, item ג): the account's own currency (business settings) when the caller has it
  const ownCurrency = accountCurrency || currency;
  const wantsEstimate = isOpen && !isLocalIsraeliBusiness && ESTIMATE_CURRENCIES.includes(String(ownCurrency || '').toUpperCase());
  useEffect(() => {
    if (!wantsEstimate) return undefined;
    let alive = true;
    loadUsdRate(ownCurrency).then((r) => { if (alive) setRate(r); }).catch(() => {});
    return () => { alive = false; };
  }, [wantsEstimate, ownCurrency]);
  // a fresh pay button on every opening and when the browser brings this page back from the payment page (Back)
  useEffect(() => { if (isOpen) { setPay({ busy: false, error: null }); setAddOnTicked(false); } }, [isOpen]);
  useEffect(() => {
    const back = () => setPay({ busy: false, error: null });
    window.addEventListener('pageshow', back);
    return () => window.removeEventListener('pageshow', back);
  }, []);
  if (!isOpen) return null;
  const lang = isHebrew ? 'he' : 'en';
  const serverMarket = accountSummary?.state === 'ready' ? accountSummary.market : null;
  const market = serverMarket || (isLocalIsraeliBusiness ? 'IL' : 'INTERNATIONAL');
  const m = pricingModalModel({ isHebrew, market, accountCurrency: market === 'IL' ? null : ownCurrency, estimateRate: rate });
  const status = accountStatusModel(accountSummary, lang);
  const current = status.tone === 'plan' ? status.planId : null;
  const lifetime = isLifetime === true ? lifetimeAccountModel(lang) : null;
  const ready = accountSummary?.state === 'ready';
  const dateFor = (iso) => formatShortDate(iso, ready && accountSummary.market === 'IL' ? 'Local' : 'International');
  const smartPackLine = smartPackStatusLine(accountSummary, isHebrew, dateFor);
  const pastDue = pastDueLine(accountSummary, isHebrew);
  // SMART PACK on the standing order (no end date): the subscriber's card shows the total charged each period
  const smartPackRenewing = ready && accountSummary.smartPack?.active === true && accountSummary.smartPack.source === 'add_on' && !accountSummary.smartPack.until;
  // back from the payment page: the words of the state; SMART PACK only from the server summary (the plan is on the line below)
  const returnText = billingReturn?.state ? billingReturnText(billingReturn.state, isHebrew, {
    smartPack: accountSummary?.state === 'ready' && accountSummary.smartPack?.active === true, addOn: billingReturn.addOn === true,
  }) : '';
  // the pay action (server billing phase on only); the server answers with the payment page of its own attempt
  const purchase = typeof onPurchase === 'function' && packageCheckoutAvailable(accountSummary, isLifetime) ? {
    enabled: true, busy: pay.busy, error: pay.error,
    onPay: async (choice) => {
      setPay({ busy: true, error: null });
      const r = await onPurchase(choice).catch(() => ({ ok: false, code: 'checkout_unavailable' }));
      if (!r || r.ok !== true) setPay({ busy: false, error: checkoutErrorMessage(r?.code, isHebrew) });
    },
  } : null;

  return (
    <div className="no-print" data-testid="plans-modal" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '16px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div role="dialog" aria-modal="true" aria-labelledby="plans-modal-title" style={{ background: 'white', padding: '24px', borderRadius: '14px', width: '100%', maxWidth: '860px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: isHebrew ? 'right' : 'left', position: 'relative', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}>
        {/* §51.16: ONE header row - AI action centred · Close */}
        <AiModalHeader onClose={onClose} closeLabel={isHebrew ? 'סגירה' : 'Close'} closeContent={<X size={18} strokeWidth={2.5} />} isHebrew={isHebrew} testId="ai-help-plans" style={{ color: '#64748b', marginBottom: '8px' }} />
        <h2 id="plans-modal-title" style={{ marginTop: 0, color: '#1e293b', fontSize: '1.3rem', textAlign: 'center', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <LayoutList size={20} color="#0F6672" aria-hidden="true" />
          {isHebrew ? <>מסלולי <BrandName onDark={false} /></> : <><BrandName onDark={false} /> Plans</>}
        </h2>
        {/* Task 39 (Owner): where no account-summary service exists (no summary prop - LIVE) there is no plan line at all, never a
            permanent "Loading plan…"; with a summary (TEST) the line is unchanged */}
        {/* Owner 2026-10-14: a lifetime account sees "Lifetime subscription - no charge" and no package, price or cancellation lines */}
        {lifetime ? (
          <p data-testid="plans-modal-lifetime" role="status" style={{ color: '#334155', textAlign: 'center', margin: '0 0 16px', fontSize: '0.95rem', fontWeight: 700 }}>
            {lifetime.label}
            <span style={{ display: 'block', color: '#64748b', fontSize: '0.85rem', fontWeight: 500, marginTop: '4px' }}>{lifetime.detail}</span>
          </p>
        ) : (<>
        {returnText && (
          <div data-testid="plans-modal-billing-return" data-state={billingReturn.state} role={billingReturn.state === 'failed' ? 'alert' : 'status'}
            style={{ margin: '0 0 12px', padding: '10px 14px', borderRadius: '10px', textAlign: 'center', fontSize: '0.92rem', fontWeight: 700,
              background: billingReturn.state === 'confirmed' ? '#ecfdf5' : billingReturn.state === 'failed' ? '#fef2f2' : '#f1f5f9',
              color: billingReturn.state === 'confirmed' ? '#065f46' : billingReturn.state === 'failed' ? '#b91c1c' : '#1e293b' }}>
            {returnText}
            {billingReturn.state === 'timeout' && typeof billingReturn.onCheckAgain === 'function' && (
              // PRODUCT_TRUTH_DECORATIVE: reads the account's own server summary again after a payment; changes nothing, buys nothing
              <button type="button" data-testid="plans-modal-billing-check-again" onClick={billingReturn.onCheckAgain}
                style={{ display: 'block', margin: '8px auto 0', background: '#0F6672', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}>
                {isHebrew ? 'בדיקה חוזרת' : 'Check again'}
              </button>
            )}
          </div>
        )}
        {/* Owner console 2026-10-16: the account's own subscription status, the same as its header medallion and the admin */}
        {statusLine && (
          <p data-testid="plans-modal-subscription-status" role="status" style={{ color: '#1e293b', textAlign: 'center', margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 700 }}>{statusLine}</p>
        )}
        {accountSummary !== undefined && (
          <p data-testid="plans-modal-current" style={{ color: '#334155', textAlign: 'center', margin: '0 0 4px', fontSize: '0.88rem', fontWeight: 600 }}>
            {status.tone === 'plan'
              ? `${isHebrew ? 'המסלול הנוכחי' : 'Current plan'}: ${status.label}${status.detail ? ` · ${status.detail}` : ''}`
              : status.label}
          </p>
        )}
        {smartPackLine && (
          <p data-testid="plans-modal-smart-pack-status" role="status" style={{ color: '#0F6672', textAlign: 'center', margin: '0 0 4px', fontSize: '0.85rem', fontWeight: 600 }}>{smartPackLine}</p>
        )}
        {/* 20261027100000 (Owner 2026-10-26): the subscriber removes SMART PACK - at the end of the paid period (a yearly one refunded per section 6) */}
        {smartPackRemoval && !lifetime && <SmartPackRemoval isHebrew={isHebrew} invoke={smartPackRemoval.invoke} onDone={smartPackRemoval.onDone} />}
        {pastDue && (
          <p data-testid="plans-modal-past-due" role="status" style={{ color: '#b45309', textAlign: 'center', margin: '0 0 4px', fontSize: '0.85rem', fontWeight: 600 }}>
            {pastDue.text}{' '}
            {/* PRODUCT_TRUTH_DECORATIVE: mailto link to the service mailbox (updating the card is handled by the team; nothing changes in the account) */}
            <MailLink href={`mailto:${pastDue.mail}`} isHebrew={isHebrew} style={{ color: '#0F6672' }}><bdi dir="ltr">{pastDue.mail}</bdi></MailLink>
          </p>
        )}
        {/* Owner 2026-10-25: in Israel (purchase open) never "cannot be purchased yet", even for an account with nothing to buy */}
        {purchase || israelPurchaseOpen(accountSummary)
          ? <div style={{ height: '12px' }} aria-hidden="true" />
          : (() => {
            const line = plansAvailabilityLine(accountSummary, isHebrew);
            return (
              <p data-testid="plans-modal-availability" data-kind={line ? line.kind : 'off'} role="status" style={{ color: '#64748b', textAlign: 'center', margin: '0 0 16px', fontSize: '0.85rem' }}>
                {line ? line.text : m.availability}
                {line?.kind === 'error' && typeof onRetrySummary === 'function' && (
                  // PRODUCT_TRUTH_DECORATIVE: re-requests the server account summary; changes no data
                  <button type="button" data-testid="plans-modal-retry" onClick={() => onRetrySummary()}
                    style={{ display: 'block', margin: '8px auto 0', minHeight: 40, background: '#0F6672', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}>
                    {isHebrew ? 'טעינה מחדש' : 'Reload'}
                  </button>
                )}
              </p>
            );
          })()}

        {/* Owner console 2026-10-26 (typed L-22, item ד): abroad - SMART PACK as information only (same currency as the card; no box, no button) */}
        {m.smartPackAbroad && !lifetime && ready && (
          <p data-testid="plans-smart-pack-abroad" dir={isHebrew ? 'rtl' : 'ltr'} style={{ maxWidth: '440px', margin: '0 auto 12px', textAlign: 'center', color: '#475569', fontSize: '0.85rem' }}>{isolateNumbers(m.smartPackAbroad)}</p>
        )}
        {/* never a second add-on page while the return from one is still being confirmed */}
        {smartPackAddOn && !lifetime && !(billingReturn?.addOn === true && ['waiting', 'timeout'].includes(billingReturn.state)) && <SmartPackAddOnOffer isHebrew={isHebrew} invoke={smartPackAddOn.invoke} onLeave={smartPackAddOn.onLeave} />}
        <div style={{ marginBottom: '14px', maxWidth: '440px', marginInline: 'auto' }}><PackageOfferCards model={m} isHebrew={isHebrew} currentPlanId={current} currentPeriod={ready ? accountSummary.billingPeriod ?? null : null} purchase={purchase} onAddOnChange={setAddOnTicked} only={['all_inclusive']} smartPackRenewing={smartPackRenewing} /></div>

        <p data-testid="plans-modal-price-note" data-price-note style={{ textAlign: 'center', color: '#334155', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 4px' }}>{m.priceNote}</p>
        {m.estimateNote && <p data-testid="plans-modal-estimate" style={{ textAlign: 'center', color: '#475569', fontSize: '0.8rem', margin: '0 0 4px' }}>{addOnTicked && m.estimateNoteWithAddOn ? m.estimateNoteWithAddOn : m.estimateNote}</p>}
        {!purchase && !israelPurchaseOpen(accountSummary) && !plansAvailabilityLine(accountSummary, isHebrew) && <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.78rem', margin: '0 0 10px' }}>{m.notDecided}</p>}
        <p data-testid="plans-modal-cancellation" style={{ textAlign: 'center', color: '#64748b', fontSize: '0.78rem', margin: '0 0 10px' }}>
          {m.cancellation.text}{' '}
          {/* PRODUCT_TRUTH_DECORATIVE: mailto link that opens a cancellation-request email to the service mailbox (handled by the team; no automatic cancellation, nothing changes in the account) */}
          <MailLink href={m.cancellation.href} isHebrew={isHebrew} data-testid="plans-modal-cancel-request" style={{ color: '#0F6672', fontWeight: 600 }}>{m.cancellation.linkLabel}</MailLink>{' · '}
          {/* PRODUCT_TRUTH_DECORATIVE: public legal page link (the cancellation and refund terms) */}
          <a href={m.cancellation.termsHref} target="_blank" rel="noopener noreferrer" style={{ color: '#0F6672' }}>{m.cancellation.termsLabel}</a>
        </p>
        </>)}
        <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.75rem' }}>
          {isHebrew ? 'יש שאלות? אפשר לפנות אלינו דרך העוזר החכם או במייל.' : 'Have questions? Contact us via AI assistant or email.'}
        </div>
      </div>
    </div>
  );
}
