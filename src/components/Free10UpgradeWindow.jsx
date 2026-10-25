// Task 27 (Owner decision 2026-10-11, §253 / spec §1, §4): the Free-10 upgrade window. It opens ONLY when the owner attempts a paid
// action after the 10 free quotes are used (a new quote, or a first client output of a quote that was never output) - never on a timer,
// never because a screen was opened, and it never locks the app. Closing it (button, backdrop or Escape) returns to the permitted flow
// with the owner's work untouched; the next attempted paid action opens it again. The counter comes from the server account summary
// (consumed / reserved / remaining); prices come from the one price source. Checkout is not active, so the subscription choice is shown
// as not available yet - nothing is purchased or charged, and nothing pretends it was.
// Codex audit 2026-10-21 (Owner "כן, לתקן"): H07 - while paying is possible (onChoose, from packageCheckoutAvailable) the choice opens
// the plans window instead of a dead end; M06 - the window opens at its top (focus on the top close button), so the title is never
// scrolled out of view on a phone.
import { useEffect, useRef } from 'react';
import { X, Sparkles } from 'lucide-react';
import { pricingModalModel } from '../domain/subscriptions/pricingModalModel';
import { FREE_QUOTES_TOTAL } from '../../supabase/functions/_shared/subscriptionContract.ts';
import { FREE_DAYS_TOTAL } from '../domain/subscriptions/priceCatalog';
import useFocusTrap from './quotePresentation/useFocusTrap';
import PackageOfferCards from './PackageOfferCards';
import { limitedReasonSentence } from '../domain/subscriptions/billingReasonCopy';

const COPY = {
  he: {
    title: 'המשיכו לעבוד ללא הגבלה',
    used: (f) => `נוצלו כל ${FREE_QUOTES_TOTAL} ההצעות החינמיות (${f.consumed} נוצלו${f.reserved ? `, ${f.reserved} בתהליך שליחה` : ''}).`,
    // Owner 2026-10-20: the 7 free days can end before the 10 quotes are used
    // Owner 2026-10-18: a limited paid account - its sentence by the server's reason (Codex audit M-01, billingReasonCopy)
    ended: (f) => `תמו ${FREE_DAYS_TOTAL} ימי החינם (נוצלו ${f.consumed} מתוך ${FREE_QUOTES_TOTAL} ההצעות החינמיות).`,
    why: 'כדי ליצור הצעה חדשה או להעביר ללקוח הצעה בפעם הראשונה, צריך מנוי.',
    allowed: 'אפשר להמשיך לצפות בהצעות הקיימות, לערוך טיוטות, לשלוח שוב הצעות שכבר יצאו ולעבוד עם לקוחות, משימות והוצאות.',
    choose: 'בחירת מנוי',
    unavailable: 'רכישת מנוי עדיין לא זמינה במערכת, ולא מתבצע חיוב.',
    close: 'חזרה לעבודה',
    closeAria: 'סגירה',
  },
  en: {
    title: 'Keep working without limits',
    used: (f) => `All ${FREE_QUOTES_TOTAL} free quotes have been used (${f.consumed} used${f.reserved ? `, ${f.reserved} being sent` : ''}).`,
    ended: (f) => `The ${FREE_DAYS_TOTAL} free days have ended (${f.consumed} of ${FREE_QUOTES_TOTAL} free quotes used).`,
    why: 'A subscription is needed to create a new quote or to send a client a quote that was never sent.',
    allowed: 'You can keep viewing your quotes, editing drafts, re-sending quotes that were already sent and working with clients, tasks and expenses.',
    choose: 'Choose a subscription',
    unavailable: 'Subscriptions cannot be purchased in the system yet, and nothing is charged.',
    close: 'Back to work',
    closeAria: 'Close',
  },
};

// limited: false, or the server's limitedReason ('cancelled' | 'payment_failed' | 'period_ended'; true = not stated)
// purchaseOpen (Owner 2026-10-25): purchasing is open in this market - never the disabled button nor "cannot be purchased yet"
export default function Free10UpgradeWindow({ open, onClose, isHebrew, market, free10, limited = false, onChoose = null, purchaseOpen = false }) {
  const ref = useRef(null);
  const topRef = useRef(null);
  useFocusTrap(ref, open);
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    topRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (prev && typeof prev.focus === 'function') prev.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  const t = COPY[isHebrew ? 'he' : 'en'];
  const m = pricingModalModel({ isHebrew, market });
  const f = free10 || { consumed: FREE_QUOTES_TOTAL, reserved: 0, remaining: 0 };
  return (
    <div className="no-print" data-testid="free10-upgrade-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10050, padding: 16 }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="free10-upgrade-title" aria-describedby="free10-upgrade-used" dir={isHebrew ? 'rtl' : 'ltr'} data-testid="free10-upgrade-window"
        style={{ background: '#ffffff', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 20, boxSizing: 'border-box', textAlign: 'start', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {/* PRODUCT_TRUTH_DECORATIVE: closes the upgrade window and returns to the permitted flow; changes no data */}
          <button type="button" ref={topRef} onClick={onClose} aria-label={t.closeAria} data-testid="free10-upgrade-x"
            style={{ minWidth: 44, minHeight: 44, border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <h2 id="free10-upgrade-title" style={{ margin: '0 0 6px', fontSize: '1.3rem', color: '#0F6672', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={20} aria-hidden="true" />{t.title}
        </h2>
        <p id="free10-upgrade-used" data-testid="free10-upgrade-used" style={{ margin: '0 0 4px', color: '#1e293b', fontWeight: 700, fontSize: '0.9rem' }}>{limited ? limitedReasonSentence(limited, isHebrew, { withKeep: true }) : (f.periodEnded && f.remaining > 0 ? t.ended(f) : t.used(f))}</p>
        <p style={{ margin: '0 0 4px', color: '#334155', fontSize: '0.85rem' }}>{t.why}</p>
        <p data-testid="free10-upgrade-allowed" style={{ margin: '0 0 12px', color: '#475569', fontSize: '0.82rem' }}>{t.allowed}</p>
        <PackageOfferCards model={m} isHebrew={isHebrew} only={['all_inclusive']} testIdPrefix="free10-upgrade" />
        <p data-price-note style={{ margin: '10px 0 0', color: '#334155', fontSize: '0.82rem', fontWeight: 600 }}>{m.priceNote}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' }}>
          {typeof onChoose === 'function' ? (
            // PRODUCT_TRUTH_DECORATIVE: opens the plans window (where the server payment page is chosen); starts no payment by itself
            <button type="button" onClick={onChoose} data-testid="free10-upgrade-choose"
              style={{ minHeight: 44, padding: '0 16px', borderRadius: 9, border: '1px solid #0F6672', background: '#ffffff', color: '#0F6672', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              {t.choose}
            </button>
          ) : purchaseOpen ? null : (
            // PRODUCT_TRUTH_DECORATIVE: subscription choice shown as unavailable while checkout is not active; starts nothing
            <button type="button" disabled aria-describedby="free10-upgrade-unavailable" data-testid="free10-upgrade-choose"
              style={{ minHeight: 44, padding: '0 16px', borderRadius: 9, border: '1px solid #94a3b8', background: '#e2e8f0', color: '#475569', fontWeight: 700, cursor: 'not-allowed', fontFamily: 'inherit' }}>
              {t.choose}
            </button>
          )}
          {/* PRODUCT_TRUTH_DECORATIVE: closes the upgrade window and returns to the permitted flow; changes no data */}
          <button type="button" onClick={onClose} data-testid="free10-upgrade-close"
            style={{ minHeight: 44, padding: '0 16px', borderRadius: 9, border: '1px solid #0F6672', background: '#0F6672', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {t.close}
          </button>
        </div>
        {typeof onChoose !== 'function' && !purchaseOpen && <p id="free10-upgrade-unavailable" data-testid="free10-upgrade-unavailable" style={{ margin: '8px 0 0', color: '#64748b', fontSize: '0.78rem' }}>{t.unavailable}</p>}
      </div>
    </div>
  );
}
