// Owner console 2026-10-20 (L-12 "בדיקת אני לא רובוט בהרשמה, בהתחברות ובאיפוס סיסמה"): the Cloudflare Turnstile check of one auth form.
// Managed mode - most people pass without doing anything; the widget keeps the current token in src/shared/captcha.js and issues a new
// one after every attempt (a token is single use). If the script cannot load, nothing is shown and the form still submits (the server
// is the judge once captcha is enabled in Auth).
import { useEffect, useRef, useState } from 'react';
import { loadTurnstile, onCaptchaReset, setCaptchaToken, turnstileSiteKey } from '../shared/captcha';

export default function TurnstileWidget({ slot = 'auth', isHebrew = true }) {
  const box = useRef(null);
  const inner = useRef(null);
  const widgetId = useRef(null);
  // the column width: the widget needs 300px - a narrower column shows it scaled to exactly the column (the width of the fields)
  const [fit, setFit] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const measure = () => { const w = el.clientWidth || 300; setFit(w < 300 ? w / 300 : 1); };
    measure();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    setCaptchaToken(slot, null);
    loadTurnstile().then((ts) => {
      if (cancelled || !ts || !inner.current) return;
      try {
        widgetId.current = ts.render(inner.current, {
          sitekey: turnstileSiteKey(),
          language: isHebrew ? 'he' : 'en',
          theme: 'dark', // the auth card is dark
          // the width of the email / password fields (Owner 2026-11-13); a column under 300px shows it scaled (see fit)
          size: 'flexible',
          // Owner console 2026-11-13 (typed: "תתקן אולי גם על הדרך את "אני לא רובוט" שיופיע תמיד" + "כן מאשר את שלושת החלקים, כולל שינוי
          // ב-L-12 וב-L-14"): the "I am not a robot" box is ALWAYS shown on signup, login and password reset (replaces 'interaction-only' of 11/11)
          appearance: 'always',
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
  // Owner 2026-11-11 (finding 25): the box never sticks out of the form column on a phone; empty (nothing to show) it takes no space
  // the regular widget is 65px tall; scaled, the box keeps its scaled height (nothing below it moves into it)
  return (
    <div ref={box} className="auth-turnstile" data-testid={`turnstile-${slot}`} style={{ maxWidth: '100%', overflow: 'hidden', marginBlockEnd: 12, height: fit < 1 ? Math.ceil(65 * fit) : undefined }}>
      <div ref={inner} style={fit < 1 ? { width: 300, transform: `scale(${fit})`, transformOrigin: isHebrew ? 'top right' : 'top left' } : undefined} />
    </div>
  );
}
