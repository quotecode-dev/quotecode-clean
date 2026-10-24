// Owner console 2026-10-21 (typed L-12: "מאשר שינוי ב-L-12: עדכון מדיניות הפרטיות על מדידת המבקרים של גוגל, עם תאריך גרסה חדש"):
// the Google Analytics visitor measurement, which used to load from index.html on EVERY route (the dashboard and the customer quote
// links included - the quote link token reached Google as a page path), now runs ONLY:
//   - on the public marketing pages (the one public route table, publicSeoRoutes.js, plus "/");
//   - on the production host (never on the local / TEST 5186 preview);
//   - on the English website only after the visitor accepts it in the cookie notice (EU / UK visitors); the Hebrew website measures
//     by default, as disclosed in the Privacy Policy, section 4.
// Any other route sets Google's own opt-out flag (window['ga-disable-<id>']), so nothing is sent from the app, quotes or cards even
// after the tag was loaded on a public page of the same visit. The page address sent is the path + the utm_* tags only.
import { PUBLIC_SEO_ROUTES } from './publicSeoRoutes';

export const GA_MEASUREMENT_ID = 'G-YSTSKDZMCM';
export const CONSENT_KEY = 'tekango.analyticsConsent.v1';
export const CONSENT_EVENT = 'tekango:analytics-consent';
const PRODUCTION_HOSTS = new Set(['www.tekango.com', 'tekango.com']);
const MEASURED_PATHS = new Set(['/', ...PUBLIC_SEO_ROUTES.map((r) => r.path)]);

const normalizePath = (pathname) => String(pathname || '').replace(/\/+$/, '') || '/';

export function isMeasuredPath(pathname) {
  return MEASURED_PATHS.has(normalizePath(pathname));
}

export function isProductionHost(hostname) {
  return PRODUCTION_HOSTS.has(String(hostname || '').toLowerCase());
}

// a sign-in / password-recovery / expired-link return carries its session or its error in the address - never measured
export function carriesAuthState(search, hash) {
  return /access_token|refresh_token|type=(?:recovery|signup|magiclink|invite)|token_hash|[?&#]code=|[?&#]error(?:_code|_description)?=/i.test(`${search || ''}${hash || ''}`);
}

// The sign-in / recovery / expired-link marker is taken ONCE, when this module loads - before the Supabase client clears the
// address asynchronously - so a page load that started as an auth return is never measured, even after its address was cleaned
// (Codex night review 2026-10-22, finding 3).
export const bootAuthContext = typeof window === 'undefined' ? false : carriesAuthState(window.location.search, window.location.hash);

// origin + path + utm_* only (never any other query value, never the #fragment)
export function sanitizedPageLocation({ origin, pathname, search }) {
  const kept = new URLSearchParams();
  new URLSearchParams(search || '').forEach((value, key) => { if (/^utm_[a-z]+$/i.test(key)) kept.append(key, value); });
  const q = kept.toString();
  return `${origin}${normalizePath(pathname)}${q ? `?${q}` : ''}`;
}

// The referrer Google receives (Codex night review 2026-10-22, finding 1): a page of this site counts only when it is a measured
// public page and it is sent sanitized; any other page of this site (the app, a quote link, a card) is sent as empty; another
// site is sent as its origin only. Never the browser's raw document.referrer.
export function sanitizedReferrer(referrer, origin) {
  if (!referrer) return '';
  let u;
  try { u = new URL(referrer); } catch { return ''; }
  if (u.origin === origin) {
    return isMeasuredPath(u.pathname) && !carriesAuthState(u.search, u.hash) ? sanitizedPageLocation({ origin, pathname: u.pathname, search: u.search }) : '';
  }
  return /^https?:$/.test(u.protocol) ? `${u.origin}/` : '';
}

export function readConsent(storage = typeof window !== 'undefined' ? window.localStorage : null) {
  try {
    const v = storage?.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch { return null; }
}

// a withdrawn choice also removes the measurement cookies already set (_ga, _ga_<id>) on this host and its parent domain
function clearMeasurementCookies(win) {
  try {
    const host = win.location.hostname;
    const bare = host.replace(/^www\./, '');
    const domains = ['', host, bare, `.${bare}`];
    win.document.cookie.split(';').map((c) => c.split('=')[0].trim()).filter((n) => /^_ga(_|$)/.test(n)).forEach((name) => {
      domains.forEach((d) => { win.document.cookie = `${name}=; Max-Age=0; Path=/${d ? `; Domain=${d}` : ''}`; });
    });
  } catch { /* no document */ }
}

// a withdrawn / declined choice: stop at once in THIS tab - the opt-out flag, the tag's own consent state and the cookies already set.
// Called by writeConsent and by every other open tab when the stored choice changes there (storage event; Codex finding 2).
export function applyWithdrawal(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return;
  win[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
  clearMeasurementCookies(win);
  try { if (typeof win.gtag === 'function') win.gtag('consent', 'update', { analytics_storage: 'denied' }); } catch { /* no tag */ }
}

export function writeConsent(value, win = typeof window !== 'undefined' ? window : null) {
  if (value !== 'granted' && win) applyWithdrawal(win);
  try {
    if (value === 'granted' || value === 'denied') win?.localStorage?.setItem(CONSENT_KEY, value);
    else win?.localStorage?.removeItem(CONSENT_KEY);
  } catch { /* storage disabled: the choice lasts for this page only */ }
  try { win?.dispatchEvent(new Event(CONSENT_EVENT)); } catch { /* no window */ }
}

// an explicit "declined" is respected on both sites; any /en address needs consent, whichever bundle renders it
export function measurementAllowed({ pathname, search, hash, hostname, isHebrew, consent, authContext = bootAuthContext }) {
  if (authContext || !isProductionHost(hostname) || !isMeasuredPath(pathname) || carriesAuthState(search, hash)) return false;
  if (consent === 'denied') return false;
  const needsConsent = isHebrew !== true || /^\/en(?:\/|$)/.test(String(pathname || ''));
  return !needsConsent || consent === 'granted';
}

function ensureGtag(win, doc, pageLocation, pageReferrer) {
  if (win.__tekangoGtagLoaded) return;
  win.__tekangoGtagLoaded = true;
  win.dataLayer = win.dataLayer || [];
  // gtag.js reads the Arguments object itself - the official snippet shape
  win.gtag = function gtag() { win.dataLayer.push(arguments); };
  win.gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
  win.gtag('js', new Date());
  win.gtag('set', { page_location: pageLocation, page_referrer: pageReferrer });
  win.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false, page_location: pageLocation, page_referrer: pageReferrer });
  const s = doc.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  doc.head.appendChild(s);
}

// called on every route change; returns true when a page view was sent
export function syncMeasurement({ isHebrew, consent, win = window, doc = document, authContext = bootAuthContext }) {
  const loc = win.location;
  const allowed = measurementAllowed({ pathname: loc.pathname, search: loc.search, hash: loc.hash, hostname: loc.hostname, isHebrew, consent, authContext });
  win[`ga-disable-${GA_MEASUREMENT_ID}`] = !allowed;
  if (!allowed) { win.__tekangoLastMeasured = ''; return false; }
  const pageLocation = sanitizedPageLocation({ origin: loc.origin, pathname: loc.pathname, search: loc.search });
  // inside the SPA the referrer is the previous measured page (empty after a private page); the first page uses the sanitized
  // browser referrer
  const pageReferrer = win.__tekangoLastMeasured !== undefined ? (win.__tekangoLastMeasured || '') : sanitizedReferrer(doc.referrer, loc.origin);
  ensureGtag(win, doc, pageLocation, pageReferrer);
  win.gtag('consent', 'update', { analytics_storage: 'granted' });
  win.gtag('set', { page_location: pageLocation, page_referrer: pageReferrer });
  win.gtag('event', 'page_view', { page_location: pageLocation, page_referrer: pageReferrer, page_title: doc.title });
  win.__tekangoLastMeasured = pageLocation;
  return true;
}
