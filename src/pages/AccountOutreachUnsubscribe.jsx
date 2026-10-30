// Codex release 9, topic 9 (Owner console 2026-10-30, L-12 / L-15 / L-17 unlocked for this change): the unsubscribe link of a help email.
// Opening the link only shows a confirmation; the withdrawal happens on the button (outreach_unsubscribe - the token can only withdraw
// its own purpose, and the answer is the same whatever the token: no account is revealed). The token is read once and removed from the
// address bar; this page is never measured (siteAnalytics measures an allowlist of public pages only).
import { useState } from 'react';
import { supabase } from '../shared/supabase';

const COPY = {
  he: {
    title: 'הפסקת הודעות העזרה',
    body: 'אפשר להפסיק כאן את הודעות העזרה היזומות של TEKANGO. הודעות שנדרשות להפעלת החשבון ולאבטחה ימשיכו להישלח.',
    button: 'הפסקת הודעות העזרה',
    done: 'בוצע. לא יישלחו אליכם יותר הודעות עזרה יזומות. אפשר לחזור ולבקש אותן בהגדרות החשבון.',
    failed: 'הבקשה לא הושלמה. נסו שוב בעוד רגע.',
    missing: 'הקישור לא שלם. פתחו אותו שוב מתוך המייל, או הפסיקו את ההודעות בהגדרות החשבון.',
    home: 'לדף הבית',
  },
  en: {
    title: 'Stop help emails',
    body: 'You can stop TEKANGO’s optional help emails here. Messages needed to run your account and keep it secure will still be sent.',
    button: 'Stop help emails',
    done: 'Done. No more optional help emails will be sent to you. You can turn them on again in your account settings.',
    failed: 'The request did not complete. Try again in a moment.',
    missing: 'The link is incomplete. Open it again from the email, or stop the emails in your account settings.',
    home: 'Home page',
  },
};

const readToken = () => {
  if (typeof window === 'undefined') return '';
  const t = new URLSearchParams(window.location.search).get('t') || '';
  try { window.history.replaceState(null, '', window.location.pathname); } catch { /* the address keeps its query */ }
  return /^[0-9a-f]{64}$/.test(t) ? t : '';
};

export default function AccountOutreachUnsubscribe({ isHebrew }) {
  const c = isHebrew ? COPY.he : COPY.en;
  const [token] = useState(readToken);
  const [state, setState] = useState(token ? 'confirm' : 'missing');

  const withdraw = async () => {
    setState('busy');
    try {
      const { data, error } = await supabase.rpc('outreach_unsubscribe', { p_token: token });
      setState(!error && data === true ? 'done' : 'failed');
    } catch {
      setState('failed');
    }
  };

  return (
    <main dir={isHebrew ? 'rtl' : 'ltr'} data-testid="outreach-unsubscribe" style={{ fontFamily: "'Rubik', Arial, Segoe UI, Tahoma, sans-serif", background: '#f4f7f8', minHeight: '100vh', color: '#172129', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', boxSizing: 'border-box' }}>
      <section style={{ background: '#ffffff', border: '1px solid #d9e0e3', borderRadius: 12, padding: 24, maxWidth: 520, width: '100%', boxSizing: 'border-box' }}>
        <h1 style={{ fontSize: '1.3rem', margin: '0 0 12px' }}>{c.title}</h1>
        {state === 'missing' && <p role="status" data-testid="outreach-unsubscribe-missing" style={{ lineHeight: 1.6, margin: '0 0 16px' }}>{c.missing}</p>}
        {state === 'done' && <p role="status" data-testid="outreach-unsubscribe-done" style={{ lineHeight: 1.6, margin: '0 0 16px', fontWeight: 600 }}>{c.done}</p>}
        {(state === 'confirm' || state === 'busy' || state === 'failed') && (
          <>
            <p style={{ lineHeight: 1.6, margin: '0 0 16px' }}>{c.body}</p>
            {state === 'failed' && <p role="status" data-testid="outreach-unsubscribe-failed" style={{ color: '#9A4040', margin: '0 0 12px', fontWeight: 600 }}>{c.failed}</p>}
            {/* PRODUCT_TRUTH_DECORATIVE: withdraws only the optional help emails bound to this link (outreach_unsubscribe) */}
            <button type="button" onClick={withdraw} disabled={state === 'busy'} data-testid="outreach-unsubscribe-button"
              style={{ background: '#0F6672', color: '#ffffff', border: 'none', borderRadius: 8, padding: '10px 18px', minHeight: 44, fontSize: '0.95rem', fontWeight: 600, cursor: state === 'busy' ? 'default' : 'pointer', fontFamily: 'inherit' }}>
              {c.button}
            </button>
          </>
        )}
        {/* PRODUCT_TRUTH_DECORATIVE: a link back to the public home page of this language */}
        <p style={{ margin: '20px 0 0' }}><a href={isHebrew ? '/he' : '/en'} style={{ color: '#0F6672' }}>{c.home}</a></p>
      </section>
    </main>
  );
}
