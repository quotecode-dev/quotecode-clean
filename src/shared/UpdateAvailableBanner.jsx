import { useEffect, useState } from 'react';
import { startVersionPolling } from './versionAwareness';

// חוק ברזל (Frontend Version Awareness, Gate F, systemic remediation
// continuation task, 2026-09-09): a small, dismissible, non-blocking
// banner - never an automatic reload, which could silently discard
// unsaved work (a quote mid-edit, a form mid-fill). The user always
// decides when to actually refresh.
export default function UpdateAvailableBanner({ isHebrew }) {
  const [newVersionAvailable, setNewVersionAvailable] = useState(false);

  useEffect(() => {
    const stop = startVersionPolling(() => setNewVersionAvailable(true));
    return stop;
  }, []);

  if (!newVersionAvailable) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '16px',
        insetInlineEnd: '16px',
        zIndex: 9999,
        background: '#171830',
        color: 'rgba(255,255,255,0.92)',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: '12px',
        padding: '12px 16px',
        boxShadow: '0 8px 24px -8px rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '0.85rem',
        maxWidth: '320px',
      }}
    >
      <span style={{ flex: '1 1 auto' }}>
        {isHebrew ? 'גרסה חדשה זמינה. רענן/י לקבלת העדכון.' : 'A new version is available. Refresh to update.'}
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          background: '#7c3aed',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          padding: '6px 12px',
          fontSize: '0.8rem',
          fontWeight: '700',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        {isHebrew ? 'רענן' : 'Refresh'}
      </button>
      <button
        type="button"
        onClick={() => setNewVersionAvailable(false)}
        aria-label={isHebrew ? 'סגור' : 'Dismiss'}
        style={{
          background: 'transparent',
          color: 'rgba(255,255,255,0.6)',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1rem',
          lineHeight: 1,
          flexShrink: 0,
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
