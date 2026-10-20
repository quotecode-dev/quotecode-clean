// Owner console 2026-10-20, typed: "מאשר שינוי ב-L-12: בדיקת אני לא רובוט בהרשמה, בהתחברות ובאיפוס סיסמה, ושורה עליה במדיניות הפרטיות"
// (after a bot signup with a random business name and someone else's address, 19/10). Cloudflare Turnstile, passed to Supabase Auth as
// `captchaToken` on signUp / signInWithPassword / resetPasswordForEmail; the server verifies it once captcha is enabled in Auth.
// The site key is public. Only the LIVE hostnames use the real widget (its hostname list is tekango.com + www.tekango.com); every other
// host (local, 5186, the journey stack) uses Cloudflare's documented always-pass test key, whose token those servers never check.
export const TURNSTILE_SITE_KEY_LIVE = '0x4AAAAAAFdsufSKzoD2AKzz';
export const TURNSTILE_SITE_KEY_TEST = '1x00000000000000000000AA';

export function turnstileSiteKey(hostname = typeof window !== 'undefined' ? window.location.hostname : '') {
  return /^(www\.)?tekango\.com$/i.test(String(hostname || '')) ? TURNSTILE_SITE_KEY_LIVE : TURNSTILE_SITE_KEY_TEST;
}

// One token per form ('auth' = signup / login, 'reset' = password reset). A token is single use: taking it clears it and tells the
// widget of that form to issue a new one.
const tokens = { auth: null, reset: null };
const listeners = new Set();

export function setCaptchaToken(slot, token) {
  tokens[slot] = typeof token === 'string' && token ? token : null;
}

/** The current token of a form (undefined when there is none yet), cleared and the widget reset for the next attempt. */
export function takeCaptchaToken(slot) {
  const token = tokens[slot] || undefined;
  tokens[slot] = null;
  for (const fn of listeners) {
    try { fn(slot); } catch { /* a widget that is gone */ }
  }
  return token;
}

export function onCaptchaReset(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let scriptPromise = null;
/** Loads the Turnstile script once (explicit render). Resolves to window.turnstile, or null when it cannot load. */
export function loadTurnstile() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.defer = true;
      s.onload = () => resolve(window.turnstile || null);
      s.onerror = () => { scriptPromise = null; resolve(null); };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}
