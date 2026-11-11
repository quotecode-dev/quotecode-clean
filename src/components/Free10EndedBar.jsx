// Owner 2026-11-11 (finding 7, option א, like the competitor's red bar): once the 10 free quotes are used or the 7 free days are over, a
// bar at the top of every screen says so, with "choose a subscription". It cannot be closed and never prints. The server summary decides
// (decideFree10Action) - a paid, LIFETIME or not-enforced account never sees it; a limited paid account has its own billing bar.
import { decideFree10Action, FREE_QUOTES_TOTAL } from '../../supabase/functions/_shared/subscriptionContract.ts';
import { FREE_DAYS_TOTAL } from '../domain/subscriptions/priceCatalog';

function free10EndedReason(summary, isLifetime = false) {
  if (isLifetime || summary?.state !== 'ready' || summary.planId !== 'free') return null;
  const d = decideFree10Action(summary);
  return d.allowed ? null : (d.reason === 'free_period_ended' ? 'period' : 'limit');
}

function free10EndedText(reason, isHebrew) {
  if (reason === 'period') {
    return isHebrew
      ? `תמו ${FREE_DAYS_TOTAL} ימי החינם. כדי ליצור, לערוך ולשלוח הצעות צריך מנוי.`
      : `The ${FREE_DAYS_TOTAL} free days have ended. A subscription is needed to create, edit and send quotes.`;
  }
  return isHebrew
    ? `נוצלו כל ${FREE_QUOTES_TOTAL} ההצעות החינמיות. כדי ליצור, לערוך ולשלוח הצעות צריך מנוי.`
    : `All ${FREE_QUOTES_TOTAL} free quotes have been used. A subscription is needed to create, edit and send quotes.`;
}

export default function Free10EndedBar({ summary, isLifetime = false, isHebrew, onChoose }) {
  const reason = free10EndedReason(summary, isLifetime);
  if (!reason) return null;
  return (
    <div className="no-print" data-html2canvas-ignore="true" role="status" data-testid="free10-ended-bar" data-reason={reason} dir={isHebrew ? 'rtl' : 'ltr'}
      style={{ flex: '0 0 auto', background: '#b91c1c', color: '#fff', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '6px 12px', fontSize: '0.9rem', fontWeight: 600, lineHeight: 1.35, textAlign: 'center', position: 'relative', zIndex: 60 }}>
      <span data-testid="free10-ended-text" style={{ minWidth: 0 }}>{free10EndedText(reason, isHebrew)}</span>
      {typeof onChoose === 'function' && (
        // PRODUCT_TRUTH_DECORATIVE: opens the plans window (where the server payment page is chosen); starts no payment by itself
        <button type="button" onClick={onChoose} data-testid="free10-ended-choose"
          style={{ flexShrink: 0, background: '#fff', color: '#b91c1c', border: 0, borderRadius: 8, padding: '6px 14px', minHeight: 44, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          {isHebrew ? 'בחירת מנוי' : 'Choose a subscription'}
        </button>
      )}
    </div>
  );
}
