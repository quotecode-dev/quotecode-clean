// The in-app plans view. Task 27 (§249 + the Owner's 2026-10-11 amendment, §253): Free-10 and ONE all-inclusive package, monthly or
// annual, from the one price source (pricingModalModel -> packageCatalog.js): IL ₪30.00 / ₪306.00 including VAT, INTERNATIONAL
// $18.00 / $184.00 USD - the shown amount is the amount that would be billed. Quote styles are not plans; a legacy style plan an account
// may hold is shown only as its current-plan line. Purchase is not available: checkout is server-driven and not activated, so this view
// never starts a payment and never changes the plan.
// The current plan line comes ONLY from the server account summary (OD-20); market = the server summary market, else the
// account's recorded business market (never the UI language, locale or a client-side rate).
import { X, LayoutList } from 'lucide-react';
import BrandName from './BrandName';
import AiModalHeader from './AiModalHeader';
import { pricingModalModel } from '../domain/subscriptions/pricingModalModel';
import { accountStatusModel } from '../domain/subscriptions/accountSummaryClient';
import PackageOfferCards from './PackageOfferCards';

export default function PricingModal({ isOpen, onClose, isHebrew, isLocalIsraeliBusiness, accountSummary }) {
  if (!isOpen) return null;
  const lang = isHebrew ? 'he' : 'en';
  const serverMarket = accountSummary?.state === 'ready' ? accountSummary.market : null;
  const market = serverMarket || (isLocalIsraeliBusiness ? 'IL' : 'INTERNATIONAL');
  const m = pricingModalModel({ isHebrew, market });
  const status = accountStatusModel(accountSummary, lang);
  const current = status.tone === 'plan' ? status.planId : null;

  return (
    <div className="no-print" data-testid="plans-modal" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '16px' }} dir={isHebrew ? 'rtl' : 'ltr'}>
      <div role="dialog" aria-modal="true" aria-labelledby="plans-modal-title" style={{ background: 'white', padding: '24px', borderRadius: '14px', width: '100%', maxWidth: '860px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: isHebrew ? 'right' : 'left', position: 'relative', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}>
        {/* §51.16: ONE header row - AI action centred · Close */}
        <AiModalHeader onClose={onClose} closeLabel={isHebrew ? 'סגור' : 'Close'} closeContent={<X size={18} strokeWidth={2.5} />} isHebrew={isHebrew} testId="ai-help-plans" style={{ color: '#64748b', marginBottom: '8px' }} />
        <h2 id="plans-modal-title" style={{ marginTop: 0, color: '#1e293b', fontSize: '1.3rem', textAlign: 'center', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <LayoutList size={20} color="#0F6672" aria-hidden="true" />
          {isHebrew ? <>מסלולי <BrandName onDark={false} /></> : <><BrandName onDark={false} /> Plans</>}
        </h2>
        {/* Task 39 (Owner): where no account-summary service exists (no summary prop - LIVE) there is no plan line at all, never a
            permanent "Loading plan…"; with a summary (TEST) the line is unchanged */}
        {accountSummary !== undefined && (
          <p data-testid="plans-modal-current" style={{ color: '#334155', textAlign: 'center', margin: '0 0 4px', fontSize: '0.88rem', fontWeight: 600 }}>
            {status.tone === 'plan'
              ? `${isHebrew ? 'המסלול הנוכחי' : 'Current plan'}: ${status.label}${status.detail ? ` · ${status.detail}` : ''}`
              : status.label}
          </p>
        )}
        <p data-testid="plans-modal-availability" style={{ color: '#64748b', textAlign: 'center', margin: '0 0 16px', fontSize: '0.85rem' }}>{m.availability}</p>

        <div style={{ marginBottom: '14px' }}><PackageOfferCards model={m} isHebrew={isHebrew} currentPlanId={current} /></div>

        <p data-testid="plans-modal-price-note" data-price-note style={{ textAlign: 'center', color: '#334155', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 4px' }}>{m.priceNote}</p>
        <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.78rem', margin: '0 0 10px' }}>{m.notDecided}</p>
        <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.75rem' }}>
          {isHebrew ? 'יש לך שאלות? צור איתנו קשר דרך עוזר ה-AI או במייל.' : 'Have questions? Contact us via AI assistant or email.'}
        </div>
      </div>
    </div>
  );
}
