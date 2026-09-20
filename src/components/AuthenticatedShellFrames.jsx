import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
// Shared authenticated chrome. Context owns slots, never a second shell.
//
// Unified Header + Always-Available AI Chat task, §9 "Header Contract":
// two new OPTIONAL slots, `dynamic` and `entitlement` - additive only (both
// default to nothing rendered, so the two pre-existing callers of this
// component - Dashboard.jsx's business/admin header, this file's own test -
// are completely unaffected until a caller opts in). Rendered together with
// `actions` inside one `.dash-topbar-trailing` wrapper (not as siblings
// directly under `.dash-topbar-global`'s own `justify-content:space-between`
// row) so the pre-existing 2-region space-between layout (identity hugs the
// header's start, everything else hugs its end) is preserved unchanged
// regardless of how many of the new optional slots a given caller fills.
export function AuthenticatedHeaderFrame({ context, identity, actions, summary, dynamic, entitlement }) {
  return <header className="dash-topbar no-print" data-shell-context={context}>
    <div className="dash-topbar-global">
      <div className="dash-topbar-identity">{identity}</div>
      <div className="dash-topbar-trailing">
        {dynamic && <div className="dash-topbar-dynamic">{dynamic}</div>}
        {entitlement && <div className="dash-topbar-entitlement">{entitlement}</div>}
        <div className="dash-topbar-actions">{actions}</div>
      </div>
    </div>
    {summary && <div className="dash-topbar-summary">{summary}</div>}
  </header>;
}

// §9 "Dynamic information": "transient message slot; when empty, clock/date
// fallback; no Header-height jump when content changes." `message` is an
// OPTIONAL, bounded, already-localized string a future caller can pass for a
// transient notice - this component never invents one. Absent `message`, a
// live clock/date renders instead, in the exact same single-line slot (same
// font-size/line-height as the message case would use), so swapping between
// the two never changes the Header's own height. The clock re-renders once
// per minute (not per second - a header clock does not need second-level
// precision, and re-rendering the whole authenticated shell every second
// would be wasteful) via one shared interval, cleared on unmount.
export function HeaderDynamicSlot({ message, isHebrew }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (message) return undefined;
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, [message]);
  if (message) {
    return <span className="dash-topbar-dynamic-text" role="status">{message}</span>;
  }
  const time = now.toLocaleTimeString(isHebrew ? 'he-IL' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString(isHebrew ? 'he-IL' : 'en-GB', { day: '2-digit', month: '2-digit' });
  return <span className="dash-topbar-dynamic-text" aria-hidden="true">{date} · {time}</span>;
}
export function AuthenticatedSidebarFrame({ drawerEnabled, open, onClose, isHebrew, children }) {
  const frame = useRef(null);
  useEffect(() => {
    if (!open || !window.matchMedia('(max-width:768px)').matches) return;
    const previous = document.activeElement;
    const media = window.matchMedia('(max-width:768px)');
    const onResize = () => { if (!media.matches) onClose(); };
    media.addEventListener('change', onResize);
    const focusable = () => [...frame.current.querySelectorAll('button,a,input,select,[tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
    focusable()[0]?.focus();
    const handleKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const items = focusable(); const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = priorOverflow; document.removeEventListener('keydown', handleKey); media.removeEventListener('change', onResize); previous?.focus(); };
  }, [open, onClose]);
  return <aside ref={frame} id="authenticated-sidebar" className={`dash-sidebar no-print ${drawerEnabled ? 'dash-operator-sidebar' : ''} ${open ? 'dash-sidebar-open' : ''}`} onClickCapture={event => { if (open && event.target.closest('button,a')) onClose(); }}>
    {drawerEnabled && <button type="button" className="dash-drawer-close dash-sidebar-btn" onClick={onClose} aria-label={isHebrew ? 'סגירת תפריט' : 'Close menu'}><X size={20} /></button>}
    {children}
  </aside>;
}
