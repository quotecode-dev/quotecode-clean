// Task 16 - creator layout: form + live preview side by side only when both stay readable (viewport >= 1024 px AND
// the workspace is wide enough for both columns); otherwise (portrait tablet, phone, narrow desktop) the preview is a
// full-width sheet opened on demand, with a close button, Escape to close and focus restored to the opener.
// The tree shape never changes between modes - the form column is always the same element - so switching orientation
// or breakpoint never remounts the editor or resets any state.
import { useEffect, useRef, useState } from 'react';
import { QP_VARS } from './qpTheme';
import QuotePreviewPane from './QuotePreviewPane';
import useFocusTrap from './useFocusTrap';
import './quotePresentation.css';

const SPLIT_MIN_VIEWPORT = 1024;
const SPLIT_MIN_WIDTH = 956; // form column >= 560 + preview column >= 380 (the 390 customer-mobile composition) + 16 gap

function useSplitMode(ref) {
  const [split, setSplit] = useState(false);
  useEffect(() => {
    const el = ref.current;
    const evaluate = () => {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
      const w = el ? el.getBoundingClientRect().width : 0;
      setSplit(vw >= SPLIT_MIN_VIEWPORT && w >= SPLIT_MIN_WIDTH);
    };
    evaluate();
    let ro = null;
    if (el && typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(evaluate); ro.observe(el); }
    window.addEventListener('resize', evaluate);
    window.addEventListener('orientationchange', evaluate);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', evaluate);
      window.removeEventListener('orientationchange', evaluate);
    };
  }, [ref]);
  return split;
}

export default function QuoteCreatorLayout({ ctl, previewData, children, enabled = true }) {
  const rootRef = useRef(null);
  const headingRef = useRef(null);
  const openerRef = useRef(null);
  const sheetRef = useRef(null);
  const split = useSplitMode(rootRef);
  const sheetOpen = enabled && !split && ctl.ui.sheetOpen;
  const showSplitPreview = enabled && split && !ctl.ui.splitHidden;
  useFocusTrap(sheetRef, sheetOpen);
  const { setLayoutMode } = ctl;
  useEffect(() => { setLayoutMode(split ? 'split' : 'stack'); }, [split, setLayoutMode]);

  // Sheet: remember the opener, move focus into the sheet, lock page scroll, Escape closes, focus returns on close.
  useEffect(() => {
    if (!sheetOpen) return undefined;
    openerRef.current = document.activeElement;
    headingRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.qp-backdrop')) return; // a dialog above the sheet owns Escape
      ctl.closePreview();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      const el = openerRef.current;
      if (el && typeof el.focus === 'function' && document.contains(el)) el.focus();
    };
  }, [sheetOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const modeClass = split ? `qp-creator--split${ctl.ui.splitHidden ? ' qp-creator--hidden' : ''}` : 'qp-creator--stack';
  return (
    <div ref={rootRef} className={`qp-creator ${enabled ? modeClass : ''}`} style={QP_VARS} data-testid="qp-creator" data-layout={split ? 'split' : 'stack'}>
      <div className="qp-creator-form">{children}</div>
      {enabled && (
        <div
          ref={sheetRef}
          className={`qp-preview-col${sheetOpen ? ' is-open' : ''}`}
          role={sheetOpen ? 'dialog' : undefined}
          aria-modal={sheetOpen ? 'true' : undefined}
          aria-label={sheetOpen ? ctl.copy.preview : undefined}
        >
          {(showSplitPreview || sheetOpen) && (
            <QuotePreviewPane
              ctl={ctl}
              previewData={previewData}
              mode={split ? 'split' : 'sheet'}
              headingRef={headingRef}
              onClose={ctl.closePreview}
              onHide={() => ctl.setSplitHidden(true)}
            />
          )}
        </div>
      )}
    </div>
  );
}

