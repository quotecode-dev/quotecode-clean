import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { LogOut, Settings } from 'lucide-react';

// Gear at the sidebar's identity block. It opens a small menu with Business Settings and Sign out, so sign-out stays one
// click away without a dedicated tile (the caller still owns the SignOutModal confirmation flow). The popover is
// position:fixed and opens upward from the trigger; its inline alignment follows the trigger's computed direction.
export default function SidebarAccountMenu({ isHebrew, onSettings, onSignOut }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const toggle = () => {
    if (open) { close(); return; }
    const trigger = triggerRef.current;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      const rtl = getComputedStyle(trigger).direction === 'rtl';
      setPos({ bottom: Math.max(8, window.innerHeight - rect.top + 6), ...(rtl ? { right: Math.max(8, window.innerWidth - rect.right) } : { left: Math.max(8, rect.left) }) });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector('[role="menuitem"]')?.focus();
    const onPointer = (event) => { if (!triggerRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) close(); };
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
      if (event.key === 'Tab') { close(); return; }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])];
      if (!items.length) return;
      event.preventDefault();
      const index = items.indexOf(document.activeElement);
      items[event.key === 'ArrowDown' ? (index + 1) % items.length : (index <= 0 ? items.length - 1 : index - 1)].focus();
    };
    const onViewport = () => close();
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onViewport);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onViewport);
    };
  }, [open, close]);

  return (
    <>
      {/* PRODUCT_TRUTH_DECORATIVE: gear that only opens the small account menu (Business Settings / Sign out); generic authenticated-shell chrome */}
      <button
        ref={triggerRef}
        type="button"
        className="dash-sidebar-gear"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={isHebrew ? 'תפריט חשבון והגדרות' : 'Account and settings menu'}
        title={isHebrew ? 'הגדרות והתנתקות' : 'Settings and sign out'}
      >
        <Settings size={19} strokeWidth={1.5} aria-hidden="true" />
      </button>
      {open && pos && (
        <div ref={menuRef} id={menuId} role="menu" className="pf-account-popover" style={pos} aria-label={isHebrew ? 'חשבון' : 'Account'}>
          {/* PRODUCT_TRUTH_DECORATIVE: account-menu entry that navigates to the existing Business Settings tab via the caller's handler */}
          <button type="button" role="menuitem" className="pf-account-item" onClick={() => { close(); onSettings(); }}>
            <Settings size={17} strokeWidth={1.6} aria-hidden="true" />
            <span>{isHebrew ? 'הגדרות העסק' : 'Business Settings'}</span>
          </button>
          {/* PRODUCT_TRUTH_DECORATIVE: account-menu entry that opens the existing SignOutModal confirmation; session sign-out is generic auth chrome, not a registered capability */}
          <button type="button" role="menuitem" className="pf-account-item pf-account-item--danger dash-sidebar-signout" onClick={() => { close(); onSignOut(); }}>
            <LogOut size={17} strokeWidth={1.6} aria-hidden="true" />
            <span>{isHebrew ? 'התנתקות' : 'Sign out'}</span>
          </button>
        </div>
      )}
    </>
  );
}
