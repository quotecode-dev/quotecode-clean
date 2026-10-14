// Task 16 - "Issue quote" confirmation (and the not-entitled explanation that replaces it when the quote's style is not
// included in the presentation tier). Confirming only triggers the existing save path with status Sent followed by
// the presentation issue call - no email, no message, nothing else.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { presentationCopy } from './presentationCopy';
import { QP_VARS } from './qpTheme';
import useFocusTrap from './useFocusTrap';
import './quotePresentation.css';

export default function IssueQuoteDialog({ lang = 'en', kind, styleTitle, onConfirm, onClose }) {
  const copy = presentationCopy(lang);
  const firstRef = useRef(null);
  const returnFocusRef = useRef(null);
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, !!kind);
  useEffect(() => {
    if (!kind) return undefined;
    returnFocusRef.current = document.activeElement;
    firstRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const el = returnFocusRef.current;
      if (el && typeof el.focus === 'function' && document.contains(el)) el.focus();
    };
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!kind) return null;
  const isConfirm = kind === 'confirm';
  const titleId = 'qp-issue-title';
  return createPortal(
    <div className="qp-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div ref={dialogRef} className="qp-dialog qp-root" role={isConfirm ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby={titleId} dir={lang === 'he' ? 'rtl' : 'ltr'} style={QP_VARS} data-testid={`qp-issue-dialog-${kind}`}>
        <h2 id={titleId}>{isConfirm ? copy.issueConfirmTitle : copy.notEntitledTitle}</h2>
        <p>{isConfirm ? copy.issueConfirmBody(styleTitle) : copy.notEntitledBody(styleTitle)}</p>
        <div className="qp-dialog-actions">
          {isConfirm && (
            // PRODUCT_TRUTH_CAPABILITY: quote_status
            <button type="button" className="qp-btn qp-btn--primary" onClick={() => onConfirm?.()} data-testid="qp-issue-confirm">{copy.issueConfirm}</button>
          )}
          {/* PRODUCT_TRUTH_DECORATIVE: cancels/closes the issue confirmation or explanation dialog */}
          <button type="button" className="qp-btn" ref={firstRef} onClick={() => onClose?.()} data-testid="qp-issue-cancel">{isConfirm ? copy.cancel : copy.close}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
