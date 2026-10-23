// Owner console 2026-10-21 (typed L-12): Google Analytics only on the public pages, only on production, English only after consent;
// never on the app, the customer quote links or the business cards; the page address keeps the path + utm_* only.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  GA_MEASUREMENT_ID, CONSENT_KEY, isMeasuredPath, isProductionHost, carriesAuthState, sanitizedPageLocation, measurementAllowed,
  syncMeasurement, readConsent, writeConsent, sanitizedReferrer, applyWithdrawal, inConsentRegion,
} from './siteAnalytics';
import SiteAnalytics from './SiteAnalyticsTracker';

const fakeWin = (href) => {
  const u = new URL(href);
  return { location: { pathname: u.pathname, search: u.search, hash: u.hash, hostname: u.hostname, origin: u.origin } };
};
const fakeDoc = () => {
  const added = [];
  return { title: 'T', added, createElement: () => ({}), head: { appendChild: (s) => added.push(s) } };
};

describe('siteAnalytics rules', () => {
  beforeEach(() => { localStorage.clear(); });

  it('measures only the public marketing pages', () => {
    for (const p of ['/', '/he', '/en', '/he/terms', '/en/privacy', '/he/contact', '/en/tools', '/en/']) expect(isMeasuredPath(p)).toBe(true);
    for (const p of ['/dashboard', '/public-quote/c/abc123', '/en/public-quote/c/abc123', '/public-quote/1', '/quote/1', '/card/1',
      '/ai-logs', '/professional-preview', '/he/sample-quote', '/he/tools/currency', '/nope']) expect(isMeasuredPath(p)).toBe(false);
  });

  it('runs only on the production host', () => {
    expect(isProductionHost('www.tekango.com')).toBe(true);
    expect(isProductionHost('tekango.com')).toBe(true);
    for (const h of ['127.0.0.1', 'localhost', '192.168.1.189', 'tekango.vercel.app']) expect(isProductionHost(h)).toBe(false);
  });

  it('never measures a sign-in / recovery return and keeps only the path + utm_* tags', () => {
    expect(carriesAuthState('', '#access_token=x&type=recovery')).toBe(true);
    expect(carriesAuthState('?code=abc', '')).toBe(true);
    expect(carriesAuthState('?utm_source=tiktok', '')).toBe(false);
    expect(sanitizedPageLocation({ origin: 'https://www.tekango.com', pathname: '/he/', search: '?utm_source=tiktok&email=a@b.c&utm_campaign=x' }))
      .toBe('https://www.tekango.com/he?utm_source=tiktok&utm_campaign=x');
  });

  it('Hebrew measures by default, English only after consent', () => {
    const base = { pathname: '/en', search: '', hash: '', hostname: 'www.tekango.com' };
    expect(measurementAllowed({ ...base, pathname: '/he', isHebrew: true, consent: null })).toBe(true);
    expect(measurementAllowed({ ...base, isHebrew: false, consent: null })).toBe(false);
    expect(measurementAllowed({ ...base, isHebrew: false, consent: 'denied' })).toBe(false);
    expect(measurementAllowed({ ...base, isHebrew: false, consent: 'granted' })).toBe(true);
    expect(measurementAllowed({ ...base, pathname: '/en/public-quote/c/tok', isHebrew: false, consent: 'granted' })).toBe(false);
  });

  it('a "declined" choice is respected on the Hebrew site too; an /en address needs consent whichever bundle renders it', () => {
    const base = { search: '', hash: '', hostname: 'www.tekango.com' };
    expect(measurementAllowed({ ...base, pathname: '/he', isHebrew: true, consent: 'denied' })).toBe(false);
    expect(measurementAllowed({ ...base, pathname: '/en', isHebrew: true, consent: null })).toBe(false);
    expect(measurementAllowed({ ...base, pathname: '/en/privacy', isHebrew: true, consent: 'granted' })).toBe(true);
  });

  it('an expired / failed sign-in link return is never measured', () => {
    expect(carriesAuthState('', '#error=access_denied&error_code=otp_expired')).toBe(true);
    expect(carriesAuthState('?type=signup', '')).toBe(true);
    expect(measurementAllowed({ pathname: '/he', search: '', hash: '#error_code=otp_expired', hostname: 'www.tekango.com', isHebrew: true, consent: null })).toBe(false);
  });

  it('a private route sets the Google opt-out flag and loads nothing; a public page sends a sanitized page view', () => {
    const doc = fakeDoc();
    const priv = fakeWin('https://www.tekango.com/public-quote/c/SECRET');
    expect(syncMeasurement({ isHebrew: true, consent: null, win: priv, doc })).toBe(false);
    expect(priv[`ga-disable-${GA_MEASUREMENT_ID}`]).toBe(true);
    expect(priv.dataLayer).toBeUndefined();
    expect(doc.added).toHaveLength(0);

    const pub = fakeWin('https://www.tekango.com/he?utm_source=instagram&x=1');
    expect(syncMeasurement({ isHebrew: true, consent: null, win: pub, doc })).toBe(true);
    expect(pub[`ga-disable-${GA_MEASUREMENT_ID}`]).toBe(false);
    expect(doc.added).toHaveLength(1);
    expect(doc.added[0].src).toBe(`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`);
    const calls = pub.dataLayer.map((a) => [...a]);
    expect(calls).toContainEqual(['consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' }]);
    expect(calls).toContainEqual(['config', GA_MEASUREMENT_ID, { send_page_view: false, page_location: 'https://www.tekango.com/he?utm_source=instagram', page_referrer: '' }]);
    expect(calls).toContainEqual(['event', 'page_view', { page_location: 'https://www.tekango.com/he?utm_source=instagram', page_referrer: '', page_title: 'T' }]);
    expect(JSON.stringify(calls)).not.toMatch(/SECRET|x=1/);

    // moving on to the app in the same visit: the flag turns measurement off again
    pub.location.pathname = '/dashboard';
    expect(syncMeasurement({ isHebrew: true, consent: null, win: pub, doc })).toBe(false);
    expect(pub[`ga-disable-${GA_MEASUREMENT_ID}`]).toBe(true);
  });

  it('Codex finding 1: the referrer Google gets is never a private page of this site (app, quote link, card) nor another site\'s full address', () => {
    const o = 'https://www.tekango.com';
    expect(sanitizedReferrer('https://www.tekango.com/dashboard?view=quotes&id=5', o)).toBe('');
    expect(sanitizedReferrer('https://www.tekango.com/public-quote/c/SECRET', o)).toBe('');
    expect(sanitizedReferrer('https://www.tekango.com/he/terms?utm_source=x&email=a', o)).toBe('https://www.tekango.com/he/terms?utm_source=x');
    expect(sanitizedReferrer('https://www.facebook.com/some/path?fbclid=123', o)).toBe('https://www.facebook.com/');
    expect(sanitizedReferrer('', o)).toBe('');
    // a public page opened from the app in a new tab: the event carries an empty referrer, never the dashboard address
    const doc = { ...fakeDoc(), referrer: 'https://www.tekango.com/dashboard?view=clients&client=42' };
    const w = fakeWin('https://www.tekango.com/he/privacy');
    syncMeasurement({ isHebrew: true, consent: null, win: w, doc });
    expect(JSON.stringify(w.dataLayer.map((a) => [...a]))).not.toMatch(/dashboard|client=42/);
    // SPA: the next public page's referrer is the previous measured page; after a private page it is empty again
    w.location.pathname = '/he/terms'; syncMeasurement({ isHebrew: true, consent: null, win: w, doc });
    expect(w.dataLayer.map((a) => [...a]).filter((c) => c[1] === 'page_view').pop()[2].page_referrer).toBe('https://www.tekango.com/he/privacy');
    w.location.pathname = '/dashboard'; syncMeasurement({ isHebrew: true, consent: null, win: w, doc });
    w.location.pathname = '/he'; syncMeasurement({ isHebrew: true, consent: null, win: w, doc });
    expect(w.dataLayer.map((a) => [...a]).filter((c) => c[1] === 'page_view').pop()[2].page_referrer).toBe('');
  });

  it('Codex finding 3: a page load that started as a sign-in / recovery return is never measured, even after its address was cleaned', () => {
    const doc = fakeDoc();
    const w = fakeWin('https://www.tekango.com/he');
    expect(syncMeasurement({ isHebrew: true, consent: null, win: w, doc, authContext: true })).toBe(false);
    expect(w[`ga-disable-${GA_MEASUREMENT_ID}`]).toBe(true);
    expect(doc.added).toHaveLength(0);
  });

  it('Codex finding 2: a withdrawal stops the tag at once and asks it to stop storing', () => {
    const w = { location: { hostname: 'www.tekango.com' }, document: { cookie: '' }, dataLayer: [] };
    w.gtag = function gtag() { w.dataLayer.push(arguments); };
    applyWithdrawal(w);
    expect(w[`ga-disable-${GA_MEASUREMENT_ID}`]).toBe(true);
    expect(w.dataLayer.map((a) => [...a])).toContainEqual(['consent', 'update', { analytics_storage: 'denied' }]);
  });

  it('the TEST / local preview never loads the tag', () => {
    const doc = fakeDoc();
    const w = fakeWin('http://192.168.1.189:5186/he');
    expect(syncMeasurement({ isHebrew: true, consent: null, win: w, doc })).toBe(false);
    expect(doc.added).toHaveLength(0);
  });

  it('the stored choice round-trips; a withdrawn choice is cleared', () => {
    expect(readConsent()).toBe(null);
    writeConsent('granted');
    expect(localStorage.getItem(CONSENT_KEY)).toBe('granted');
    writeConsent(null);
    expect(readConsent()).toBe(null);
  });

  it('index.html no longer loads the tag on every route', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).not.toMatch(/googletagmanager\.com\/gtag\/js/);
    expect(html).not.toMatch(/gtag\('config'/);
  });
});

describe('the English cookie notice', () => {
  beforeEach(() => { localStorage.clear(); });
  const at = (path, isHebrew) => render(<MemoryRouter initialEntries={[path]}><SiteAnalytics isHebrew={isHebrew} /></MemoryRouter>);

  it('shows on English public pages until a choice is made; both buttons look the same', () => {
    at('/en', false);
    const banner = screen.getByTestId('analytics-consent-banner');
    expect(banner.textContent).toMatch(/Google Analytics cookies/);
    expect(screen.getByTestId('analytics-consent-accept').getAttribute('style')).toBe(screen.getByTestId('analytics-consent-decline').getAttribute('style'));
    act(() => { fireEvent.click(screen.getByTestId('analytics-consent-decline')); });
    expect(screen.queryByTestId('analytics-consent-banner')).toBeNull();
    expect(readConsent()).toBe('denied');
  });

  it('Codex finding 2: a withdrawal made in another tab (storage event) stops measurement in this tab at once', () => {
    localStorage.setItem(CONSENT_KEY, 'granted');
    at('/en', false);
    window[`ga-disable-${GA_MEASUREMENT_ID}`] = false;
    localStorage.setItem(CONSENT_KEY, 'denied');
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: CONSENT_KEY, newValue: 'denied' })); });
    expect(window[`ga-disable-${GA_MEASUREMENT_ID}`]).toBe(true);
  });

  it('never shows on the Hebrew site, the app or a quote link', () => {
    at('/he', true);
    expect(screen.queryByTestId('analytics-consent-banner')).toBeNull();
  });
  it('never shows inside the app', () => {
    at('/dashboard', false);
    expect(screen.queryByTestId('analytics-consent-banner')).toBeNull();
  });
  it('never shows on a customer quote link', () => {
    at('/en/public-quote/c/tok', false);
    expect(screen.queryByTestId('analytics-consent-banner')).toBeNull();
  });
});

// Owner console 2026-10-23 (typed: "מאשר שינוי ב-L-12: סעיף 7 אפשרות א"): consent by LOCATION - the EU / EEA, the UK and Switzerland are asked
// first on the Hebrew website too, an unknown country is asked too; elsewhere the Hebrew website measures by default and offers an opt-out
describe('consent by location (item 7 א)', () => {
  it('the consent region: EU / EEA / UK / CH -> true; Israel / US -> false; unknown -> null', () => {
    for (const c of ['DE', 'fr', 'GB', 'CH', 'NO', 'IS', 'LI', 'IE']) expect(inConsentRegion(c)).toBe(true);
    for (const c of ['IL', 'US', 'CA', 'AU']) expect(inConsentRegion(c)).toBe(false);
    for (const c of [null, undefined, '', 'XX1', 'Israel']) expect(inConsentRegion(c)).toBe(null);
  });
  it('the Hebrew website needs consent in the region and when the country is unknown; not elsewhere', () => {
    const base = { pathname: '/he', search: '', hash: '', hostname: 'www.tekango.com', isHebrew: true, authContext: false };
    expect(measurementAllowed({ ...base, consent: null, region: false })).toBe(true);
    expect(measurementAllowed({ ...base, consent: null, region: true })).toBe(false);
    expect(measurementAllowed({ ...base, consent: null, region: null })).toBe(false);
    expect(measurementAllowed({ ...base, consent: 'granted', region: true })).toBe(true);
    expect(measurementAllowed({ ...base, consent: 'denied', region: false })).toBe(false);
  });
  const atHe = (country) => render(<MemoryRouter initialEntries={['/he']}><SiteAnalytics isHebrew hostname="www.tekango.com" /></MemoryRouter>);
  const setCookie = (v) => { document.cookie = `proflow_geo_country=${v}; path=/`; };
  beforeEach(() => { try { window.localStorage.clear(); } catch { /* none */ } document.cookie = 'proflow_geo_country=; Max-Age=0; path=/'; });
  it('a visitor from Germany on the Hebrew website gets the notice IN HEBREW (RTL), and both choices work', () => {
    setCookie('DE');
    atHe();
    const banner = screen.getByTestId('analytics-consent-banner');
    expect(banner.getAttribute('dir')).toBe('rtl');
    expect(banner.textContent).toContain('הן נשמרות רק אם תאשרו');
    expect(banner.querySelector('a').getAttribute('href')).toBe('/he/privacy#cookies');
    fireEvent.click(screen.getByTestId('analytics-consent-decline'));
    expect(readConsent()).toBe('denied');
    expect(screen.queryByTestId('analytics-consent-banner')).toBeNull();
  });
  it('a visitor from Israel on the Hebrew website: no notice (measured by default)', () => {
    setCookie('IL');
    atHe();
    expect(screen.queryByTestId('analytics-consent-banner')).toBeNull();
  });
  it('no country cookie: asks the server once; until it answers no notice; an unknown country gets the notice', async () => {
    const orig = global.fetch;
    let resolve;
    global.fetch = vi.fn(() => new Promise((r) => { resolve = r; }));
    try {
      atHe();
      expect(global.fetch).toHaveBeenCalledWith('/api/geo', expect.objectContaining({ cache: 'no-store' }));
      expect(screen.queryByTestId('analytics-consent-banner')).toBeNull();
      await act(async () => { resolve({ ok: true, json: async () => ({ country: null }) }); });
      expect(screen.getByTestId('analytics-consent-banner').getAttribute('dir')).toBe('rtl');
    } finally { global.fetch = orig; }
  });
});

describe('the Hebrew opt-out in the Privacy Policy (item 7 א)', () => {
  it('section 4 in Hebrew turns measurement off and back on in this browser', async () => {
    const { default: Privacy } = await import('../pages/Privacy');
    try { window.localStorage.clear(); } catch { /* none */ }
    render(<MemoryRouter initialEntries={['/he/privacy']}><Privacy isHebrew /></MemoryRouter>);
    const btn = screen.getByTestId('privacy-cookie-choice-he');
    expect(btn.textContent).toBe('ביטול המדידה בדפדפן הזה');
    fireEvent.click(btn);
    expect(readConsent()).toBe('denied');
    expect(screen.getByTestId('privacy-cookie-choice-he').textContent).toBe('החזרת המדידה בדפדפן הזה');
    fireEvent.click(screen.getByTestId('privacy-cookie-choice-he'));
    expect(readConsent()).toBe('granted');
  });
});
