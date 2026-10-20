// Owner console 2026-10-20 (L-12 "בדיקת אני לא רובוט בהרשמה, בהתחברות ובאיפוס סיסמה"): the Cloudflare Turnstile check of one auth form.
// Managed mode - most people pass without doing anything; the widget keeps the current token in src/shared/captcha.js and issues a new
// one after every attempt (a token is single use). If the script cannot load, nothing is shown and the form still submits (the server
// is the judge once captcha is enabled in Auth).
import { useEffect, useRef } from 'react';
import { loadTurnstile, onCaptchaReset, setCaptchaToken, turnstileSiteKey } from '../shared/captcha';

export default function TurnstileWidget({ slot = 'auth', isHebrew = true }) {
  const box = useRef(null);
  const widgetId = useRef(null);
  useEffect(() => {
    let cancelled = false;
    setCaptchaToken(slot, null);
    loadTurnstile().then((ts) => {
      if (cancelled || !ts || !box.current) return;
      try {
        widgetId.current = ts.render(box.current, {
          sitekey: turnstileSiteKey(),
          language: isHebrew ? 'he' : 'en',
          theme: 'light',
          size: 'flexible',
          callback: (token) => setCaptchaToken(slot, token),
          'expired-callback': () => setCaptchaToken(slot, null),
          'error-callback': () => { setCaptchaToken(slot, null); },
        });
      } catch {
        widgetId.current = null;
      }
    });
    const off = onCaptchaReset((s) => {
      if (s !== slot || widgetId.current === null) return;
      try { window.turnstile?.reset(widgetId.current); } catch { /* gone */ }
    });
    return () => {
      cancelled = true;
      off();
      setCaptchaToken(slot, null);
      if (widgetId.current !== null) {
        try { window.turnstile?.remove(widgetId.current); } catch { /* gone */ }
        widgetId.current = null;
      }
    };
  }, [slot, isHebrew]);
  return <div ref={box} className="auth-turnstile" data-testid={`turnstile-${slot}`} style={{ marginBottom: 12 }} />;
}
