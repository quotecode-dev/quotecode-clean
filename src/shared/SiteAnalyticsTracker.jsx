// Owner console 2026-10-21 (typed L-12): the visitor measurement of the public pages (rules in siteAnalytics.js), rendered once inside
// each BrowserRouter. The English website shows a small cookie notice on its public pages until the visitor accepts or declines;
// both buttons look the same (no nudging). The choice can be changed later from the Privacy Policy, section 4.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CONSENT_EVENT, CONSENT_KEY, applyWithdrawal, isMeasuredPath, readConsent, syncMeasurement, writeConsent } from './siteAnalytics';

const BUTTON = {
  background: 'transparent', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '8px',
  padding: '8px 18px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: '44px', minWidth: '96px',
};

export default function SiteAnalytics({ isHebrew }) {
  const location = useLocation();
  const [consent, setConsent] = useState(() => readConsent());

  useEffect(() => {
    const onChange = () => setConsent(readConsent());
    // another open tab changed the stored choice: a withdrawal stops measurement here at once (Codex night review, finding 2)
    const onStorage = (e) => {
      if (e.key !== null && e.key !== CONSENT_KEY) return;
      const next = readConsent();
      if (next !== 'granted') applyWithdrawal(window);
      setConsent(next);
    };
    window.addEventListener(CONSENT_EVENT, onChange);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener(CONSENT_EVENT, onChange); window.removeEventListener('storage', onStorage); };
  }, []);

  useEffect(() => {
    syncMeasurement({ isHebrew, consent });
  }, [location.pathname, location.search, location.hash, isHebrew, consent]);

  if (isHebrew || consent !== null || !isMeasuredPath(location.pathname)) return null;

  return (
    <div role="region" aria-label="Cookie notice" data-testid="analytics-consent-banner" dir="ltr"
      style={{ position: 'fixed', left: '12px', right: '12px', bottom: '12px', maxWidth: '560px', margin: '0 auto',
        // above the chat button (z-index 999999) and the update banner until the visitor chooses
        zIndex: 1000000,
        background: '#111827', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '12px', padding: '14px 16px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.45)', fontFamily: "'Rubik', Arial, sans-serif", fontSize: '0.88rem', boxSizing: 'border-box', textAlign: 'left' }}>
      <p style={{ margin: '0 0 12px', lineHeight: 1.55 }}>
        We use Google Analytics cookies to see how visitors find and use our website. They are set only if you accept.{' '}
        {/* PRODUCT_TRUTH_DECORATIVE: opens the Privacy Policy section on cookies (no state change) */}
        <a href="/en/privacy#cookies" style={{ color: '#5eead4', fontWeight: 600 }}>Privacy Policy</a>
      </p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {/* PRODUCT_TRUTH_DECORATIVE: stores "declined" in this browser - no measurement cookies are set */}
        <button type="button" data-testid="analytics-consent-decline" style={BUTTON} onClick={() => writeConsent('denied')}>Decline</button>
        {/* PRODUCT_TRUTH_DECORATIVE: stores "accepted" in this browser - Google Analytics may then measure the public pages */}
        <button type="button" data-testid="analytics-consent-accept" style={BUTTON} onClick={() => writeConsent('granted')}>Accept</button>
      </div>
    </div>
  );
}
