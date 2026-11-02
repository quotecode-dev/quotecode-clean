// Owner console 2026-11-02 (typed: "מאשר בניית שלב 1: מסכי ימי החסד ומיילי החיוב שנכשל לפי ההחלטה מ-18/10, כולל שינוי ב-L-02, L-11, L-12, L-13 ו-L-15,
// עם ההמלצות בהחלטות 1, 2 ו-4, שחרור עד הלייב"): the red bar at the top of every screen, which cannot be closed, with a live countdown, and the window on
// every opening of the app ("remind me later" = 4 hours). Limited: the bar stays, with a pay button. Printing never shows it.
import { useEffect, useRef, useState } from 'react';
import { askChoice } from './AppDialog';
import { barText, payLabel, popupOptions, popupSnoozed, popupText, snoozePopup, updateCardHref, updateCardLabel } from '../domain/subscriptions/billingNotices';

const TICK_MS = 30000;
const safeStorage = () => { try { return window.localStorage; } catch { return null; } };

export default function BillingNoticeBar({ model, isHebrew, userId, onPay, onEnded }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const asked = useRef(false);
  const ended = useRef(false);
  const grace = model?.state === 'grace';

  useEffect(() => {
    if (!grace) return undefined;
    const t = setInterval(() => setNowMs(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, [grace]);

  // the grace days ended while the screen is open: the server's summary says what is true now
  useEffect(() => {
    if (!grace || ended.current || Date.parse(model.endsAt) > nowMs) return;
    ended.current = true;
    onEnded?.();
  }, [grace, model, nowMs, onEnded]);

  useEffect(() => {
    if (!grace || asked.current) return;
    asked.current = true;
    const now = Date.now();
    const storage = safeStorage();
    if (storage && popupSnoozed(userId, now, storage)) return;
    askChoice(popupText(model, now, isHebrew), isHebrew, popupOptions(isHebrew)).then((choice) => {
      if (choice === 'update') { window.location.href = updateCardHref(model, isHebrew); return; }
      if (storage) snoozePopup(userId, Date.now(), storage);
    });
  }, [grace, model, isHebrew, userId]);

  if (!model) return null;
  const buttonStyle = { flexShrink: 0, background: '#fff', color: '#b91c1c', border: 0, borderRadius: 8, padding: '6px 14px', minHeight: 36, fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' };
  return (
    <div className="no-print" data-html2canvas-ignore="true" role="alert" data-testid="billing-notice-bar" data-state={model.state}
      style={{ flex: '0 0 auto', background: '#b91c1c', color: '#fff', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '6px 12px', fontSize: '0.9rem', fontWeight: 600, lineHeight: 1.35, textAlign: 'center', position: 'relative', zIndex: 60 }}>
      <span data-testid="billing-notice-text" style={{ minWidth: 0 }}>{barText(model, nowMs, isHebrew)}</span>
      {grace && (
        // PRODUCT_TRUTH_DECORATIVE: opens a mail to the service mailbox, the way a card is updated during the grace days (decision 1)
        <a href={updateCardHref(model, isHebrew)} data-testid="billing-notice-update" style={buttonStyle}>{updateCardLabel(isHebrew)}</a>
      )}
      {!grace && (
        // PRODUCT_TRUTH_DECORATIVE: opens the existing plans window, where a limited account can pay
        <button type="button" onClick={onPay} data-testid="billing-notice-pay" style={buttonStyle}>{payLabel(isHebrew)}</button>
      )}
    </div>
  );
}
