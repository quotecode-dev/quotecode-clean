// Owner console 2026-10-21 (typed L-12): the visitor measurement of the public pages (rules in siteAnalytics.js), rendered once inside
// each BrowserRouter. The English website shows a small cookie notice on its public pages until the visitor accepts or declines;
// both buttons look the same (no nudging). The choice can be changed later from the Privacy Policy, section 4.
// Owner console 2026-10-23 (typed: "מאשר שינוי ב-L-12: סעיף 7 אפשרות א"): the Hebrew website asks too when the visitor is in the EU / EEA,
// the UK or Switzerland, or when the country is unknown - the same notice, in Hebrew. The country comes from the proflow_geo_country
// cookie (middleware.ts, on "/") or, when it is missing, from /api/geo once; until it is known nothing is measured and no notice shows.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CONSENT_EVENT, CONSENT_KEY, applyWithdrawal, consentRequired, inConsentRegion, isMeasuredPath, isProductionHost, readConsent, syncMeasurement, writeConsent } from './siteAnalytics';
import { geoCountryFromCookie } from '../domain/subscriptions/localPriceEstimate';

const BUTTON = {
  background: 'transparent', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '8px',
  padding: '8px 18px', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: '44px', minWidth: '96px',
};

const COPY = {
  he: {
    region: 'הודעה על עוגיות',
    text: 'אנחנו משתמשים בעוגיות של Google Analytics כדי לדעת איך מבקרים מגיעים לאתר ומשתמשים בו. הן נשמרות רק אם תאשרו.',
    privacy: 'מדיניות הפרטיות', privacyHref: '/he/privacy#cookies', decline: 'דחייה', accept: 'אישור',
  },
  en: {
    region: 'Cookie notice',
    text: 'We use Google Analytics cookies to see how visitors find and use our website. They are set only if you accept.',
    privacy: 'Privacy Policy', privacyHref: '/en/privacy#cookies', decline: 'Decline', accept: 'Accept',
  },
};


// hostname: the page's host (tests pass the production host; the app never passes it)
export default function SiteAnalytics({ isHebrew, hostname = typeof window !== 'undefined' ? window.location.hostname : '' }) {
  const location = useLocation();
  const [consent, setConsent] = useState(() => readConsent());
  // the visitor's country, only where it decides anything (the Hebrew website on the production host): undefined = not known yet
  const needCountry = isHebrew === true && isProductionHost(hostname);
  const [country, setCountry] = useState(() => (needCountry ? (geoCountryFromCookie(typeof document !== 'undefined' ? document.cookie : '') ?? undefined) : null));

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
    if (!needCountry || country !== undefined) return undefined;
    let live = true;
    fetch('/api/geo', { cache: 'no-store', credentials: 'omit' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (live) setCountry(typeof j?.country === 'string' ? j.country : null); })
      .catch(() => { if (live) setCountry(null); });
    return () => { live = false; };
  }, [needCountry, country]);

  const region = needCountry ? (country === undefined ? null : inConsentRegion(country)) : false;

  useEffect(() => {
    syncMeasurement({ isHebrew, consent, region });
  }, [location.pathname, location.search, location.hash, isHebrew, consent, region]);

  const asking = consent === null && isMeasuredPath(location.pathname) && !(needCountry && country === undefined)
    && consentRequired({ pathname: location.pathname, isHebrew, region });
  if (!asking) return null;
  const hebrewPage = isHebrew === true && !location.pathname.startsWith('/en/') && location.pathname !== '/en'; // an /en address is English
  const c = hebrewPage ? COPY.he : COPY.en;

  return (
    <div role="region" aria-label={c.region} data-testid="analytics-consent-banner" dir={hebrewPage ? 'rtl' : 'ltr'}
      style={{ position: 'fixed', left: '12px', right: '12px', bottom: '12px', maxWidth: '560px', margin: '0 auto',
        // above the chat button (z-index 999999) and the update banner until the visitor chooses
        zIndex: 1000000,
        background: '#111827', color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '12px', padding: '14px 16px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.45)', fontFamily: "'Rubik', Arial, sans-serif", fontSize: '0.88rem', boxSizing: 'border-box', textAlign: 'start' }}>
      <p style={{ margin: '0 0 12px', lineHeight: 1.55 }}>
        {c.text}{' '}
        {/* PRODUCT_TRUTH_DECORATIVE: opens the Privacy Policy section on cookies (no state change) */}
        <a href={c.privacyHref} style={{ color: '#5eead4', fontWeight: 600 }}>{c.privacy}</a>
      </p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {/* PRODUCT_TRUTH_DECORATIVE: stores "declined" in this browser - no measurement cookies are set */}
        <button type="button" data-testid="analytics-consent-decline" style={BUTTON} onClick={() => writeConsent('denied')}>{c.decline}</button>
        {/* PRODUCT_TRUTH_DECORATIVE: stores "accepted" in this browser - Google Analytics may then measure the public pages */}
        <button type="button" data-testid="analytics-consent-accept" style={BUTTON} onClick={() => writeConsent('granted')}>{c.accept}</button>
      </div>
    </div>
  );
}
