// Owner console 2026-10-21 (typed: "מאשר שינוי ב-L-22 וב-L-01: מסך החזרה מהתשלום בחלון המסלולים, ותיקון הנוסח, הכפתור והשוק בחלון
// המסלולים"): back from the payment page.
//   * The pay button marks the departure in this tab (markBillingDeparture: the account id + time). A return counts only for the SAME
//     signed-in account that left from this tab (never another account after a sign-in, never a typed / shared address, never LIFETIME -
//     it has no pay button).
//   * The return address (?billing=processing | failed | cancelled) is read ONCE, kept for this tab (sessionStorage - it survives the
//     one-time language reload of the dashboard) and removed from the address with the payment page's own parameters.
//   * While the server billing phase is on, the plans window opens with the return state; 'processing' reads the server summary quietly
//     every 3 seconds for up to 90 seconds. Closing the window, however it is closed, ends the return.
//   * Billing off = the address is removed and ignored; nothing opens.
//   * Owner console 2026-10-25 (typed: "מאשר שינוי ב-L-01, L-06, L-07, L-11, L-12, L-14, L-17, L-22 להפעלת הרכישה בישראל"): while waiting,
//     and on "check again", the server is asked to pull the result from PayPlus (subscription-authority checkout_status - at most every
//     9 seconds here, the server limits it too) and the summary is read right after, so a lost PayPlus callback never leaves a paid
//     account closed.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BILLING_RETURN_KINDS, BILLING_RETURN_POLL_MS, billingReturnFromSearch, billingReturnState, searchWithoutBillingReturn,
} from '../domain/subscriptions/packageCheckout';

const RETURN_KEY = 'tekango:billing-return';
const DEPARTURE_KEY = 'tekango:billing-departure';
const RETURN_KEEP_MS = 10 * 60 * 1000;
const DEPARTURE_KEEP_MS = 2 * 60 * 60 * 1000;
const PULL_EVERY_MS = 9000;

const readJson = (key) => {
  try { return JSON.parse(window.sessionStorage.getItem(key) || 'null'); } catch { return null; }
};
const write = (key, v) => {
  try {
    if (v) window.sessionStorage.setItem(key, JSON.stringify(v));
    else window.sessionStorage.removeItem(key);
  } catch { /* no storage: the return simply does not survive a reload */ }
};

/** the pay button, right before leaving for the payment page */
export function markBillingDeparture(userId, now = Date.now()) {
  if (typeof userId === 'string' && userId) write(DEPARTURE_KEY, { userId, at: now });
}

function departureOf(userId, now) {
  const d = readJson(DEPARTURE_KEY);
  return d && typeof d.userId === 'string' && d.userId === userId && Number.isFinite(d.at) && now - d.at >= 0 && now - d.at < DEPARTURE_KEEP_MS;
}

/** -> { state, kind, dismiss, checkAgain } ; state = billingReturnState(...) or null */
export default function useBillingReturn({ summary, userId, plansOpen, refreshQuiet, openPlans, pullStatus = null, now = () => Date.now() }) {
  const [ret, setRet] = useState(() => {
    if (typeof window === 'undefined') return null;
    const kind = billingReturnFromSearch(window.location.search);
    if (kind) {
      const v = { kind, at: now(), from: now() };
      write(RETURN_KEY, v);
      try {
        const { pathname, search, hash } = window.location;
        window.history.replaceState(window.history.state, '', pathname + searchWithoutBillingReturn(search) + hash);
      } catch { /* keep the address */ }
      return v;
    }
    const v = readJson(RETURN_KEY);
    return v && BILLING_RETURN_KINDS.includes(v.kind) && Number.isFinite(v.at) && Number.isFinite(v.from) && now() - v.at < RETURN_KEEP_MS ? v : null;
  });
  const [tick, setTick] = useState(0);
  const opened = useRef(false);
  const wasOpen = useRef(false);
  const lastPull = useRef(0);
  // the server pull first (when due), then the summary - a failed pull still reads the summary
  const pullThenRefresh = useCallback((force = false) => {
    const at = now();
    const due = typeof pullStatus === 'function' && (force || at - lastPull.current >= PULL_EVERY_MS);
    if (due) lastPull.current = at;
    const pulled = due ? Promise.resolve().then(() => pullStatus()).catch(() => {}) : Promise.resolve();
    return pulled.then(() => refreshQuiet()).catch(() => {});
  }, [pullStatus, refreshQuiet, now]);

  const ready = summary?.state === 'ready';
  const billingOn = ready && ['prepared', 'enforced'].includes(summary.phase?.billing);
  const t = now();
  const valid = !!ret && ready && billingOn && departureOf(userId, t) && t - ret.at < RETURN_KEEP_MS;
  const state = valid ? billingReturnState(ret.kind, summary, t - ret.from) : null;

  const forget = useCallback(() => { write(RETURN_KEY, null); write(DEPARTURE_KEY, null); setRet(null); }, []);

  // not this account's return, billing off, or too old: forget it (once the server summary of the signed-in account is known)
  useEffect(() => {
    if (ret && ready && !valid) forget();
  }, [ret, ready, valid, forget]);

  // open the plans window once, with the return state
  useEffect(() => {
    if (state && !opened.current) { opened.current = true; openPlans(); }
  }, [state, openPlans]);

  // the window was closed (X, Back, any path) after the return opened it: the return ends
  useEffect(() => {
    if (wasOpen.current && !plansOpen && opened.current && ret) forget();
    wasOpen.current = !!plansOpen;
  }, [plansOpen, ret, forget]);

  // waiting: read the server summary quietly; the clock re-renders even if a read hangs
  useEffect(() => {
    if (state !== 'waiting') return undefined;
    const timer = setTimeout(() => {
      setTick((n) => n + 1);
      pullThenRefresh();
    }, BILLING_RETURN_POLL_MS);
    return () => clearTimeout(timer);
  }, [state, tick, pullThenRefresh]);

  const checkAgain = useCallback(() => {
    setRet((r) => {
      if (!r) return r;
      const next = { ...r, from: now() };
      write(RETURN_KEY, next);
      return next;
    });
    pullThenRefresh(true);
  }, [pullThenRefresh, now]);

  return { state, kind: valid ? ret.kind : null, dismiss: forget, checkAgain };
}
