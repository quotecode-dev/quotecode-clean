// OD-17 / OD-18: the ONE explanation shown when an account activates a capability its plan does not include (style picker,
// creator, catalog/media, edit/duplicate, delete, attachments, professional quotes). Every capability stays visible; this
// notice explains locally, names the current canonical plan (or a neutral state line), lists eligible plans ONLY when the
// server provides an approved list (OPEN-02: normally none -> "not decided yet"), and offers the plans view.
// It never mutates: no draft/default/style/media change, no upload, no reservation, no consumption, no storage write.
// Close is a pure no-op for application state (it only hides this notice and returns focus to the opener).
import { useEffect, useRef } from 'react';
import { Lock, X, LayoutList } from 'lucide-react';
import { APP as T } from '../../theme/neonTheme';
import { capabilityNoticeCopy } from '../../domain/subscriptions/capabilityNoticeCopy';

export default function CapabilityUpgradeNotice({ lang = 'en', capabilityId, summary, details = null, onUpgrade, onClose, variant = 'dialog', idPrefix = 'cap-notice', testIds = null, closeLabel = null }) {
  const headingRef = useRef(null);
  const he = lang === 'he';
  const open = !!capabilityId;

  // a11y: focus the heading on open; return focus to the control that opened the notice when it closes
  useEffect(() => {
    if (!open) return undefined;
    const opener = typeof document !== 'undefined' ? document.activeElement : null;
    headingRef.current?.focus();
    return () => {
      if (opener && opener !== document.body && document.contains(opener) && typeof opener.focus === 'function') opener.focus();
    };
  }, [open, capabilityId]);

  if (!open) return null;
  const c = capabilityNoticeCopy(lang, capabilityId, summary);
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-desc`;
  const close = () => { if (onClose) onClose(); };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    // dialog: keep Tab inside the notice (aria-modal)
    if (e.key === 'Tab' && variant !== 'inline') {
      const nodes = Array.from(e.currentTarget.querySelectorAll('button'));
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  const body = (
    <>
      <h3 id={titleId} ref={headingRef} tabIndex={-1}
        style={{ margin: '0 0 8px', fontSize: '1.02rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: T.textPrimary, outline: 'none' }}>
        <Lock size={16} aria-hidden="true" color={T.amber} />{c.title}
      </h3>
      <div id={descId}>
        {c.explanation && <p style={{ margin: '0 0 8px', lineHeight: 1.55, fontSize: '0.92rem', color: T.textPrimary }}>{c.explanation}</p>}
        {details}
        <p data-testid={`${idPrefix}-current-plan`} style={{ margin: '8px 0 4px', fontSize: '0.88rem', fontWeight: 600, color: T.textPrimary }}>{c.currentPlan}</p>
        <p data-testid={`${idPrefix}-eligible`} style={{ margin: '0 0 8px', fontSize: '0.88rem', color: T.textSecondary }}>{c.eligible}</p>
        <p style={{ margin: '0 0 12px', fontSize: '0.84rem', color: T.textMuted }}>{c.unchanged}</p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: variant === 'dialog' ? 'center' : 'flex-start' }}>
        {onUpgrade && (
          // PRODUCT_TRUTH_DECORATIVE: opens the plans view (prices and availability); never purchases or changes the plan
          <button type="button" data-testid={`${idPrefix}-upgrade`} onClick={() => onUpgrade(capabilityId)}
            style={{ minHeight: 44, minWidth: 44, padding: '0 18px', borderRadius: 8, border: 'none', background: T.gradient, color: T.textOnAccent, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <LayoutList size={15} aria-hidden="true" />{c.upgrade}
          </button>
        )}
        {/* PRODUCT_TRUTH_DECORATIVE: closes the explanation; changes no data */}
        <button type="button" data-testid={testIds?.close || `${idPrefix}-close`} onClick={close}
          style={{ minHeight: 44, minWidth: 44, padding: '0 18px', borderRadius: 8, border: `1px solid ${T.borderStrong}`, background: T.bgCardAlt, color: T.textSecondary, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <X size={15} aria-hidden="true" />{closeLabel || c.close}
        </button>
      </div>
    </>
  );

  if (variant === 'inline') {
    return (
      <section role="region" aria-labelledby={titleId} aria-describedby={descId} data-testid={testIds?.root || idPrefix} data-capability={capabilityId}
        dir={he ? 'rtl' : 'ltr'} onKeyDown={onKeyDown}
        style={{ marginTop: 14, border: `1px solid ${T.border}`, background: T.bgCardAlt, borderRadius: 8, padding: 14 }}>
        {body}
      </section>
    );
  }
  return (
    <div data-testid={`${idPrefix}-backdrop`} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,28,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId} data-testid={testIds?.root || idPrefix} data-capability={capabilityId}
        dir={he ? 'rtl' : 'ltr'} onKeyDown={onKeyDown}
        style={{ background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 14, padding: 22, width: '100%', maxWidth: 440, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.35)', textAlign: he ? 'right' : 'left' }}>
        {body}
      </div>
    </div>
  );
}
