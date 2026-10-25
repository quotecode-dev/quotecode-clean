// Task 27 (P2, spec §6 settings): "Sharing & thank-you" - its own settings screen, separate from quote design, reminders and the digital
// card. The owner writes the default WhatsApp message he sends himself, an optional thank-you shown to the customer only after a verified
// signature, and an opt-in website link. Nothing is sent or automated. Save shows success only after the database returned the row.
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Share2 } from 'lucide-react';
import { APP as NEON, RADIUS } from '../theme/neonTheme';
import { EMPTY_SHARE_DEFAULTS, SHARE_TEXT_MAX, SHARE_VARIABLES, THANKS_TEXT_MAX, loadShareDefaults, normalizeShareDefaults, saveShareDefaults } from '../utils/shareDefaultsClient';

const COPY = {
  he: {
    back: 'חזרה להגדרות', title: 'שיתוף ותודה ללקוח', sub: 'נוסחים קבועים לשיתוף ידני. שום דבר לא נשלח אוטומטית.',
    shareLabel: 'הודעת ברירת מחדל לוואטסאפ (לא חובה)',
    shareHelp: 'ההודעה נפתחת בוואטסאפ לפני השליחה, ותמיד מצורף אליה קישור להצעה. אם השדה ריק, תופיע ההודעה הרגילה.',
    varsTitle: 'אפשר להשתמש במשתנים:', vars: ['שם הלקוח', 'שם העסק', 'מספר ההצעה', 'סכום ההצעה'],
    thanksLabel: 'הודעת תודה אחרי חתימה (לא חובה)', thanksHelp: 'מוצגת ללקוח בעמוד ההצעה רק אחרי שהחתימה נקלטה בשרת.',
    websiteLabel: 'כתובת אתר העסק (https, לא חובה)', optIn: 'להציג קישור לאתר ליד הודעת התודה', optInHelp: 'קישור רגיל שהלקוח יכול לבחור לפתוח - בלי העברה אוטומטית.',
    save: 'שמירה', saving: 'שומר…', saved: 'נשמר.', loading: 'טוען…',
    unavailable: 'האפשרות עדיין לא זמינה בשרת הזה, ולכן אי אפשר לשמור כאן כרגע. ההודעות הרגילות ממשיכות לעבוד.',
    error: 'לא ניתן היה לטעון את ההגדרות.', retry: 'נסו שוב', leaveUnsaved: 'יש שינויים שלא נשמרו. לצאת בלי לשמור?', saveError: 'השמירה נכשלה. שום דבר לא שונה.',
    errors: { share_text_too_long: `ההודעה ארוכה מ-${SHARE_TEXT_MAX} תווים.`, thanks_text_too_long: `הודעת התודה ארוכה מ-${THANKS_TEXT_MAX} תווים.`, website_invalid: 'כתובת האתר חייבת להתחיל ב-https://.', website_required: 'כדי להציג קישור יש להזין כתובת אתר.' },
  },
  en: {
    back: 'Back to settings', title: 'Sharing & thank-you', sub: 'Default texts for manual sharing. Nothing is sent automatically.',
    shareLabel: 'Default WhatsApp message (optional)',
    shareHelp: 'Opens in your WhatsApp before you send it; the quote link is always added. Empty = the standard message.',
    varsTitle: 'You can use these variables:', vars: ['customer name', 'business name', 'quote number', 'quote total'],
    thanksLabel: 'Thank-you after signing (optional)', thanksHelp: 'Shown to the customer on the quote page only after the server recorded the signature.',
    websiteLabel: 'Business website (https, optional)', optIn: 'Show a website link next to the thank-you', optInHelp: 'A normal link the customer may choose to open - no automatic redirect.',
    save: 'Save', saving: 'Saving...', saved: 'Saved.', loading: 'Loading...',
    unavailable: 'This option is not available on this server yet, so it cannot be saved here right now. The standard messages keep working.',
    error: 'The settings could not be loaded.', retry: 'Try again', leaveUnsaved: 'You have unsaved changes. Leave without saving?', saveError: 'Saving failed. Nothing was changed.',
    errors: { share_text_too_long: `The message is longer than ${SHARE_TEXT_MAX} characters.`, thanks_text_too_long: `The thank-you is longer than ${THANKS_TEXT_MAX} characters.`, website_invalid: 'The website must start with https://.', website_required: 'Enter a website to show a link.' },
  },
};

export default function ShareDefaultsSettings({ isHebrew, client, userId, onBack, onSaved = null, registerLeaveGuard = null }) {
  const C = COPY[isHebrew ? 'he' : 'en'];
  const Arrow = isHebrew ? ArrowRight : ArrowLeft;
  const [load, setLoad] = useState('loading');
  const [draft, setDraft] = useState({ ...EMPTY_SHARE_DEFAULTS });
  const [save, setSave] = useState({ state: 'idle', errors: [] });
  // QA 2026-10-25 (C3): what the server holds (Back asks before unsaved text is lost) and a retry for a failed load
  const [stored, setStored] = useState({ ...EMPTY_SHARE_DEFAULTS });
  const [loadRun, setLoadRun] = useState(0);

  useEffect(() => {
    let live = true;
    loadShareDefaults(client, userId).then((r) => {
      if (!live) return;
      if (r.ok) { setDraft(r.value); setStored(r.value); setLoad('ready'); } else setLoad(r.error.code === 'unavailable' ? 'unavailable' : 'error');
    });
    return () => { live = false; };
  }, [client, userId, loadRun]);
  const unsaved = load === 'ready' && JSON.stringify(draft) !== JSON.stringify(stored);
  // Owner 2026-10-25 (typed L-15 / L-01 / L-09): the phone Back and a menu item ask the same unsaved question as this screen's Back
  useEffect(() => (typeof registerLeaveGuard === 'function' ? registerLeaveGuard(() => !unsaved || window.confirm(C.leaveUnsaved)) : undefined), [registerLeaveGuard, unsaved, C]);

  const set = (k, v) => { setDraft((d) => ({ ...d, [k]: v })); setSave({ state: 'idle', errors: [] }); };
  const onSubmit = async (e) => {
    e.preventDefault();
    const n = normalizeShareDefaults(draft);
    if (!n.ok) { setSave({ state: 'invalid', errors: n.errors }); return; }
    setSave({ state: 'saving', errors: [] });
    const r = await saveShareDefaults(client, userId, draft);
    if (r.ok) { setDraft(r.value); setStored(r.value); setSave({ state: 'saved', errors: [] }); if (typeof onSaved === 'function') onSaved(r.value); }
    else if (r.error.code === 'unavailable') { setLoad('unavailable'); setSave({ state: 'idle', errors: [] }); }
    else setSave({ state: 'error', errors: r.errors || [] });
  };
  const disabled = load !== 'ready' || save.state === 'saving';
  const field = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: disabled ? NEON.bgCardAlt : NEON.bgInput, color: NEON.textPrimary, fontSize: '0.88rem', fontFamily: 'inherit' };
  const label = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: NEON.textPrimary, marginBottom: '4px' };
  const help = { fontSize: '0.74rem', color: NEON.textSecondary, marginTop: '4px' };

  return (
    <div data-testid="share-defaults-settings" data-state={load} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        {/* PRODUCT_TRUTH_CAPABILITY: business_settings */}
        <button type="button" onClick={() => { if (!unsaved || window.confirm(C.leaveUnsaved)) onBack(); }} data-testid="share-defaults-back" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '40px', padding: '0 12px', borderRadius: RADIUS.sm, border: `1px solid ${NEON.borderStrong}`, background: NEON.bgCard, color: NEON.textPrimary, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Arrow size={15} aria-hidden="true" />{C.back}
        </button>
      </div>
      <form onSubmit={onSubmit} style={{ background: NEON.bgCard, borderRadius: RADIUS.lg, padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: NEON.textPrimary }}><Share2 size={18} color="#0F6672" aria-hidden="true" />{C.title}</h2>
          <div style={{ color: NEON.textSecondary, fontSize: '0.8rem', marginTop: 3 }}>{C.sub}</div>
        </div>
        {load === 'loading' && <div role="status" style={help}>{C.loading}</div>}
        {load === 'unavailable' && <div role="status" data-testid="share-defaults-unavailable" style={{ ...help, color: '#9a3412', fontWeight: 600 }}>{C.unavailable}</div>}
        {load === 'error' && (
          <div role="alert" style={{ ...help, color: '#991b1b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span>{C.error}</span>
            {/* PRODUCT_TRUTH_DECORATIVE: loads the settings again; changes no data */}
            <button type="button" data-testid="share-defaults-retry" onClick={() => { setLoad('loading'); setLoadRun((n) => n + 1); }}
              style={{ minHeight: '36px', padding: '0 12px', borderRadius: RADIUS.sm, border: `1px solid ${NEON.borderStrong}`, background: NEON.bgCard, color: NEON.textPrimary, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{C.retry}</button>
          </div>
        )}
        <div>
          <label htmlFor="sd-share-text" style={label}>{C.shareLabel}</label>
          <textarea id="sd-share-text" data-testid="sd-share-text" rows={3} maxLength={SHARE_TEXT_MAX} value={draft.share_text} disabled={disabled} onChange={(e) => set('share_text', e.target.value)} style={{ ...field, resize: 'vertical' }} />
          <div style={help}>{C.shareHelp}</div>
          {/* each variable is an LTR atom next to its meaning (never a mixed-direction run) */}
          <div style={help} data-testid="sd-variables">{C.varsTitle}
            <ul style={{ margin: '2px 0 0', paddingInlineStart: 18 }}>
              {SHARE_VARIABLES.map((v, i) => <li key={v}><bdi dir="ltr" className="pf-num">{v}</bdi> - {C.vars[i]}</li>)}
            </ul>
          </div>
        </div>
        <div>
          <label htmlFor="sd-thanks-text" style={label}>{C.thanksLabel}</label>
          <textarea id="sd-thanks-text" data-testid="sd-thanks-text" rows={2} maxLength={THANKS_TEXT_MAX} value={draft.thanks_text} disabled={disabled} onChange={(e) => set('thanks_text', e.target.value)} style={{ ...field, resize: 'vertical' }} />
          <div style={help}>{C.thanksHelp}</div>
        </div>
        <div>
          <label htmlFor="sd-website" style={label}>{C.websiteLabel}</label>
          <input id="sd-website" data-testid="sd-website" type="url" dir="ltr" inputMode="url" placeholder="https://" value={draft.website_url} disabled={disabled} onChange={(e) => set('website_url', e.target.value)} style={{ ...field, textAlign: 'left' }} />
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '8px', fontSize: '0.82rem', color: NEON.textPrimary, cursor: disabled ? 'default' : 'pointer' }}>
            <input type="checkbox" data-testid="sd-website-optin" checked={draft.show_website_after_signature} disabled={disabled} onChange={(e) => set('show_website_after_signature', e.target.checked)} style={{ marginTop: '3px', flex: 'none' }} />
            <span>{C.optIn}<span style={{ display: 'block', ...help, marginTop: '2px' }}>{C.optInHelp}</span></span>
          </label>
        </div>
        {save.errors.length > 0 && (
          <div role="alert" data-testid="sd-errors" style={{ fontSize: '0.8rem', color: '#991b1b', fontWeight: 600 }}>{save.errors.map((k) => C.errors[k] || k).join(' ')}</div>
        )}
        {save.state === 'error' && save.errors.length === 0 && <div role="alert" style={{ fontSize: '0.8rem', color: '#991b1b', fontWeight: 600 }}>{C.saveError}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* PRODUCT_TRUTH_CAPABILITY: business_settings */}
          <button type="submit" data-testid="sd-save" disabled={disabled} style={{ minHeight: '40px', padding: '0 18px', borderRadius: RADIUS.sm, border: 'none', background: disabled ? NEON.borderStrong : NEON.violet, color: '#fff', fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {save.state === 'saving' ? C.saving : C.save}
          </button>
          {save.state === 'saved' && <span role="status" data-testid="sd-saved" style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 700 }}>{C.saved}</span>}
        </div>
      </form>
    </div>
  );
}
