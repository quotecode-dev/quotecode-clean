import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, CirclePlus, Plus } from 'lucide-react';
import { newQuoteChoices, templateChoice } from '../utils/newQuoteChoices';

// One "New quote" entry used by the sidebar row and the quotes toolbar. It presents three plain-language ways to
// start a quote and only delegates to handlers the caller already owns:
//   standard   -> the existing blank-quote flow
//   ai         -> the existing AI entry (the caller opens the quote form and the AI chat; no new backend)
//   structured -> the existing measured / divided (profession-aware) quote structure
// The popover is position:fixed (measured from the trigger when it opens) so the scrolling sidebar nav never clips it;
// its inline alignment follows the trigger's real computed direction and is clamped inside the dashboard shell.
const MENU_WIDTH = 268;

export default function NewQuoteMenu({ isHebrew, variant = 'toolbar', onStandard, onAi, onStructured, onTemplate = null }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();
  const choices = typeof onTemplate === 'function' ? [...newQuoteChoices(isHebrew), templateChoice(isHebrew)] : newQuoteChoices(isHebrew);
  const handlers = { standard: onStandard, ai: onAi || onStandard, structured: onStructured || onStandard, template: onTemplate };

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
      const width = Math.min(MENU_WIDTH, window.innerWidth - 24);
      // Toolbar trigger sits at the outside edge of the workspace: align the menu's inline-END edge to the trigger's so it opens toward the
      // content. Sidebar row: align inline-START so it opens inward. Then clamp inside the shell (and viewport) so it never overflows.
      const alignEnd = variant !== 'sidebar';
      const startEdge = alignEnd === rtl ? rect.left : rect.right - width;
      const shell = trigger.closest('.dash-shell-outer')?.getBoundingClientRect();
      const minLeft = Math.max(8, (shell?.left ?? 0) + 8);
      const maxLeft = Math.min(window.innerWidth - 8, (shell?.right ?? window.innerWidth) - 8) - width;
      const left = Math.max(minLeft, Math.min(startEdge, Math.max(minLeft, maxLeft)));
      setPos({ top: rect.bottom + 6, left, width });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector('[role="menuitem"]')?.focus();
    const onPointer = (event) => { if (!wrapRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) close(); };
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
      if (event.key === 'Tab') { close(); return; }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])];
      if (!items.length) return;
      event.preventDefault();
      const index = items.indexOf(document.activeElement);
      const next = event.key === 'ArrowDown' ? (index + 1) % items.length : (index <= 0 ? items.length - 1 : index - 1);
      items[next].focus();
    };
    const onViewport = () => close();
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onViewport);
    window.addEventListener('scroll', onViewport, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onViewport);
      window.removeEventListener('scroll', onViewport, true);
    };
  }, [open, close]);

  const choose = (id) => {
    close();
    handlers[id]?.();
  };

  const triggerProps = {
    ref: triggerRef,
    type: 'button',
    onClick: toggle,
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open ? menuId : undefined,
  };

  return (
    <div ref={wrapRef} className={`pf-newquote-menu pf-newquote-menu--${variant}`}>
      {/* PRODUCT_TRUTH_DECORATIVE: trigger that only opens the three-choice new-quote menu; creating a quote stays the existing quote_create handler the caller passes in */}
      {variant === 'sidebar' ? (
        <button {...triggerProps} className="dash-sidebar-cta">
          <CirclePlus size={19} strokeWidth={1.5} aria-hidden="true" />
          <span>{isHebrew ? 'הצעה חדשה' : 'New quote'}</span>
        </button>
      ) : (
        <button {...triggerProps} className="quote-primary-action">
          <Plus size={19} strokeWidth={2.2} aria-hidden="true" />
          <span>{isHebrew ? 'הצעת מחיר חדשה' : 'New quote'}</span>
          <ChevronDown size={17} strokeWidth={2.2} aria-hidden="true" />
        </button>
      )}
      {open && pos && (
        <div ref={menuRef} id={menuId} role="menu" className="pf-newquote-popover" style={pos} aria-label={isHebrew ? 'סוג הצעת מחיר חדשה' : 'New quote type'}>
          {/* PRODUCT_TRUTH_DECORATIVE: menu choice that hands off to one of the caller's existing create handlers (standard / AI chat entry / measured structure); no behaviour of its own */}
          {choices.map(({ id, Icon, label, hint }) => (
            <button key={id} type="button" role="menuitem" data-choice={id} className="pf-newquote-item" onClick={() => choose(id)}>
              <Icon size={19} strokeWidth={1.6} aria-hidden="true" />
              <span className="pf-newquote-item-text">
                <strong>{label}</strong>
                <small>{hint}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
