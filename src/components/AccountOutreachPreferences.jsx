// Codex release 9, topic 9 (Owner console 2026-10-30, typed: "אשר עבודה רצופה מעכשיו: ... כולל שינוי ב-L-22, L-23, L-26, L-12, L-15 ו-L-17 ...";
// decision 16 "הסכמה נפרדת לפניות יזומות ונוסח בדף הפרטיות"): the account owner's OWN consent to optional help emails - separate from the
// Terms, unchecked until the owner ticks it (no retrospective consent), withdrawn at any time. The text is the spec's, word for word
// (docs/CODEX_SPEC_MORNING_PLANS_2026-10-29.md section 9). Read / written only through account_outreach_get / account_outreach_set, which
// bind auth.uid() on the server - never another account. Messages needed to run the account are a separate purpose and are not affected.
import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { APP as NEON, lightHeadingTextStyle as neonGlowTextStyle } from '../theme/neonTheme';
import { OUTREACH_COPY } from './accountOutreachCopy';

export default function AccountOutreachPreferences({ isHebrew, client }) {
  const c = isHebrew ? OUTREACH_COPY.he : OUTREACH_COPY.en;
  const [state, setState] = useState('loading');
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let live = true;
    Promise.resolve(client.rpc('account_outreach_get')).then(({ data, error } = {}) => {
      if (!live) return;
      if (error || !data || typeof data.optionalHelp !== 'boolean') { setState('failed'); return; }
      setOn(data.optionalHelp);
      setState('ready');
    }).catch(() => { if (live) setState('failed'); });
    return () => { live = false; };
  }, [client]);

  const change = async (next) => {
    setBusy(true); setNotice(null);
    try {
      const { data, error } = await client.rpc('account_outreach_set', { p_optional_help: next });
      if (error || data?.optionalHelp !== next) throw new Error('not_saved');
      setOn(next);
      setNotice({ ok: true, text: next ? c.savedOn : c.savedOff });
    } catch {
      setNotice({ ok: false, text: c.failed });
    }
    setBusy(false);
  };

  return (
    <section data-testid="settings-outreach" aria-labelledby="settings-outreach-title" style={{ marginTop: '24px', paddingTop: '20px', borderTop: `1px solid ${NEON.border}` }}>
      <h3 id="settings-outreach-title" style={{ fontSize: '0.95rem', fontWeight: '800', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', ...neonGlowTextStyle }}>
        <Mail size={16} color={NEON.violetLight} strokeWidth={2} />
        {c.title}
      </h3>
      <div className="pf-m-surface" style={{ background: NEON.bgCard, padding: '16px', borderRadius: '10px', border: `1px solid ${NEON.border}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {state === 'failed' ? (
          <p role="status" data-testid="settings-outreach-load-failed" style={{ margin: 0, fontSize: '0.85rem', color: NEON.textSecondary }}>{c.loadFailed}</p>
        ) : (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minHeight: '44px', cursor: state === 'ready' && !busy ? 'pointer' : 'default', fontSize: '0.9rem', color: NEON.textPrimary, lineHeight: 1.5 }}>
            {/* PRODUCT_TRUTH_DECORATIVE: the account owner's own consent to optional help emails (default off; account_outreach_set, his own account only) */}
            <input type="checkbox" checked={on} disabled={busy || state !== 'ready'} onChange={(e) => change(e.target.checked)} data-testid="settings-outreach-checkbox"
              style={{ width: '20px', height: '20px', marginTop: '2px', flex: '0 0 auto', accentColor: NEON.violet }} />
            <span>{c.label}</span>
          </label>
        )}
        <p style={{ margin: 0, fontSize: '0.78rem', color: NEON.textSecondary }}>{c.note}</p>
        {notice && <p role="status" data-testid="settings-outreach-notice" style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: notice.ok ? NEON.textPrimary : NEON.red }}>{notice.text}</p>}
      </div>
    </section>
  );
}
