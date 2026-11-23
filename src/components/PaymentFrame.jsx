// Owner console 2026-11-10 (typed: "מאשר פתיחת דף התשלום של פיי פלוס כחלון מעל האפליקציה (כולל חזרה אוטומטית, ופתיחה רגילה אם החלון לא
// נטען), כולל שינוי ב-L-01 ו-L-22, שחרור עד הלייב"; "שיפתח דף נוסף מעל האפליקציה שהאפליקציה תישאר ברקע, שזה יהיה כמו הודעה עם המסך"):
// the PayPlus payment page opens in a window above the app (the app stays behind it).
//   * The return address of the payment page (/dashboard?billing=...) loads INSIDE this window; main.jsx hands its kind to the app
//     behind (postMessage, same origin only) and this window closes - the existing return flow (useBillingReturn) takes it from there.
//   * The window did not load in time, or the browser refused to show it (content policy) -> the payment page opens as a full page,
//     as before. "Open as a full page" does the same by hand at any moment.
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { BILLING_RETURN_KINDS } from '../domain/subscriptions/packageCheckout';
import { PAYMENT_FRAME_RETURN, PAYMENT_FRAME_LOAD_MS, PAYMENT_WINDOW_OPEN } from '../shared/paymentFrameReturn';

export default function PaymentFrame({ url, isHebrew, onClose, onReturn, onFallback, loadMs = PAYMENT_FRAME_LOAD_MS }) {
  const frame = useRef(null);
  const loaded = useRef(false);
  const done = useRef(false);

  useEffect(() => {
    if (!url) return undefined;
    loaded.current = false;
    done.current = false;
    const fallback = () => { if (!done.current) { done.current = true; onFallback(url); } };
    const onMessage = (e) => {
      if (e.origin !== window.location.origin || !frame.current || e.source !== frame.current.contentWindow) return;
      if (e.data && e.data.type === PAYMENT_FRAME_RETURN && e.data.close === true && !done.current) { done.current = true; onClose(); return; }
      const kind = e.data && e.data.type === PAYMENT_FRAME_RETURN ? e.data.kind : null;
      if (!BILLING_RETURN_KINDS.includes(kind) || done.current) return;
      done.current = true;
      onReturn(kind);
    };
    const onViolation = (e) => { if (String(e.effectiveDirective || e.violatedDirective || '').startsWith('frame-src')) fallback(); };
    const timer = setTimeout(() => { if (!loaded.current) fallback(); }, loadMs);
    window[PAYMENT_WINDOW_OPEN] = true;
    window.addEventListener('message', onMessage);
    document.addEventListener('securitypolicyviolation', onViolation);
    return () => {
      clearTimeout(timer);
      window[PAYMENT_WINDOW_OPEN] = false;
      window.removeEventListener('message', onMessage);
      document.removeEventListener('securitypolicyviolation', onViolation);
    };
  }, [url, onReturn, onFallback, onClose, loadMs]);

  if (!url) return null;
  const he = !!isHebrew;
  // a phone: the window fills the screen
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 600px)').matches;
  return (
    <div className="no-print" data-testid="payment-frame" role="dialog" aria-modal="true" aria-label={he ? 'תשלום מאובטח' : 'Secure payment'} dir={he ? 'rtl' : 'ltr'}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 10050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: phone ? 0 : 'min(4vh, 24px) min(3vw, 16px)' }}>
      <div className="payment-frame-panel" style={{ background: '#fff', borderRadius: phone ? 0 : 16, width: phone ? '100%' : 'min(560px, 100%)', height: phone ? '100%' : 'min(860px, 100%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 18px 50px rgba(15, 23, 42, 0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px 8px 16px', paddingInlineStart: 16, paddingInlineEnd: 8, borderBottom: '1px solid #e2e8f0' }}>
          <strong style={{ flex: '1 1 auto', fontSize: '1rem', color: '#0f172a' }}>{he ? 'תשלום מאובטח' : 'Secure payment'}</strong>
          {/* PRODUCT_TRUTH_DECORATIVE: opens the same PayPlus payment page as a full page instead of the window */}
          <button type="button" data-testid="payment-frame-full" onClick={() => { done.current = true; onFallback(url); }}
            style={{ background: 'none', border: 'none', color: '#0f766e', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline', padding: '6px 4px' }}>
            {he ? 'פתיחה בדף מלא' : 'Open as a full page'}
          </button>
          {/* PRODUCT_TRUTH_DECORATIVE: closes the payment window; nothing is paid unless the payment page itself confirmed it */}
          <button type="button" data-testid="payment-frame-close" aria-label={he ? 'סגירת חלון התשלום' : 'Close the payment window'} onClick={() => { done.current = true; onClose(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'inline-flex', minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <X size={22} color="#334155" />
          </button>
        </div>
        <iframe ref={frame} data-testid="payment-frame-iframe" title={he ? 'דף התשלום של PayPlus' : 'PayPlus payment page'} src={url}
          allow="payment" referrerPolicy="strict-origin-when-cross-origin" onLoad={() => { loaded.current = true; }}
          style={{ flex: '1 1 auto', width: '100%', border: 'none', background: '#fff' }} />
      </div>
    </div>
  );
}
