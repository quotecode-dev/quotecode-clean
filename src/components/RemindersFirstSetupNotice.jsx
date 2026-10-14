// Task 20 (Phase 4) - first-setup explanation of the three reminder modes (Owner: Full must be visible and understood at first setup).
// It is a dismissible NOTICE that names the one settings path (Business settings › Reminders & automation); per the Owner clarification
// it is NOT a second entry button. Shown until dismissed on this device, and only while the business has never saved reminder settings.
import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { APP as NEON, RADIUS } from '../theme/neonTheme';
import { REMINDERS_COPY, loadReminderSettings } from '../utils/reminders';

const keyFor = (userId) => `tk.reminders.firstSetupSeen.${userId}`;
const readSeen = (userId) => { try { return window.localStorage.getItem(keyFor(userId)) === '1'; } catch { return false; } };
const writeSeen = (userId) => { try { window.localStorage.setItem(keyFor(userId), '1'); } catch { /* per-device convenience only */ } };

export default function RemindersFirstSetupNotice({ client, userId, isHebrew }) {
  const C = REMINDERS_COPY[isHebrew ? 'he' : 'en'];
  const [show, setShow] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!client || !userId || readSeen(userId)) return undefined;
    loadReminderSettings(client, userId).then((r) => { if (alive) setShow(!(r.ok && r.data.stored)); });
    return () => { alive = false; };
  }, [client, userId]);
  if (!show) return null;
  const dismiss = () => { writeSeen(userId); setShow(false); };
  return (
    <div role="note" data-testid="reminders-first-setup" dir={isHebrew ? 'rtl' : 'ltr'}
      style={{ display: 'flex', gap: 10, alignItems: 'flex-start', border: '1.5px solid #B9A9EC', background: 'linear-gradient(135deg,#F6F3FE,#EEF7F8)', borderRadius: RADIUS.lg, padding: '12px 14px', marginBottom: 12 }}>
      <span style={{ background: '#E3F1F2', color: '#0F6672', borderRadius: 8, padding: 6, display: 'inline-flex', flex: 'none' }}><BellRing size={16} /></span>
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: NEON.textPrimary }}>{C.firstSetupTitle}</div>
        <div style={{ fontSize: '0.78rem', color: NEON.textSecondary, marginTop: 3, lineHeight: 1.5 }}>{C.firstSetupText}</div>
      </div>
      {/* PRODUCT_TRUTH_DECORATIVE: dismisses the first-setup notice on this device; changes no account data */}
      <button type="button" onClick={dismiss} aria-label={C.gotIt} data-testid="reminders-first-setup-dismiss"
        style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, border: `1px solid ${NEON.borderStrong}`, background: '#fff', borderRadius: 8, padding: '6px 10px', minHeight: 36, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, color: NEON.textPrimary, fontFamily: 'inherit' }}>
        <X size={13} aria-hidden="true" />{C.gotIt}
      </button>
    </div>
  );
}
