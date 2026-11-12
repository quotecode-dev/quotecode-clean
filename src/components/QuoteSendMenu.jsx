// Owner 2026-11-11 (findings 4 + 26, option ב; typed L-07, L-13, L-19, L-29): a prominent "Send" on every quote row, without opening the
// row. It opens three choices that run the SAME paths as the open row's chips: email (the confirm window), WhatsApp and copy the message
// with the link (the Owner's choice for the third option) - the same protected-action gate, output authority and Sent marking (L-13).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, Mail, MessageCircle, ClipboardCopy } from 'lucide-react';

export default function QuoteSendMenu({ quote, isHebrew, variant = 'row', onEmail, onWhatsApp, onCopy }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const wrap = useRef(null);
  const menuRef = useRef(null);
  // the menu floats above everything (position fixed, from the button's place) so no card or list frame clips it; it opens on the
  // language's end side and above the button when there is no room below; a scroll closes it
  const place = () => {
    const b = wrap.current?.querySelector('.quote-send-button')?.getBoundingClientRect();
    if (!b) return null;
    const below = window.innerHeight - b.bottom > 190;
    const v = below ? { top: Math.round(b.bottom + 4) } : { bottom: Math.round(window.innerHeight - b.top + 4) };
    // the page width WITHOUT a scrollbar (window.innerWidth includes it - the English menu stood one scrollbar away from its button)
    const pageWidth = document.documentElement.clientWidth || window.innerWidth;
    return isHebrew ? { ...v, left: Math.max(8, Math.round(b.left)) } : { ...v, right: Math.max(8, Math.round(pageWidth - b.right)) };
  };
  // Owner 2026-11-11 (LIVE check): the page keeps a stable scrollbar gutter, so a fixed `right` is measured from an edge ~7px inside the
  // page width the browser reports - the English menu stood ~7px (14 device px) away from its button's end. Before the first paint the
  // menu's real box is compared with the button and the difference is corrected once (both languages; no correction when already flush).
  useLayoutEffect(() => {
    if (!open || !pos) return;
    const b = wrap.current?.querySelector('.quote-send-button')?.getBoundingClientRect();
    const m = menuRef.current?.getBoundingClientRect();
    if (!b || !m) return;
    const delta = isHebrew ? b.left - m.left : b.right - m.right;
    if (Math.abs(delta) < 1) return; // after one correction the rest is under a pixel (rounding) - never a second pass
    setPos((p) => (p ? (isHebrew ? { ...p, left: Math.max(8, Math.round(p.left + delta)) } : { ...p, right: Math.max(8, Math.round(p.right - delta)) }) : p));
  }, [open, pos, isHebrew]);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (wrap.current && !wrap.current.contains(e.target) && !menuRef.current?.contains(e.target)) setOpen(false); };
    const key = (e) => { if (e.key === 'Escape') { setOpen(false); wrap.current?.querySelector('button')?.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('touchstart', away, { passive: true });
    document.addEventListener('keydown', key);
    const shut = () => setOpen(false);
    window.addEventListener('scroll', shut, true);
    window.addEventListener('resize', shut);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('touchstart', away); document.removeEventListener('keydown', key); window.removeEventListener('scroll', shut, true); window.removeEventListener('resize', shut); };
  }, [open]);
  const run = (fn) => (e) => { e.stopPropagation(); setOpen(false); if (typeof fn === 'function') fn(quote); };
  const items = [
    ['email', Mail, isHebrew ? 'מייל' : 'Email', onEmail],
    ['whatsapp', MessageCircle, isHebrew ? 'וואטסאפ' : 'WhatsApp', onWhatsApp],
    ['copy', ClipboardCopy, isHebrew ? 'העתקת ההודעה עם הקישור' : 'Copy the message with the link', onCopy],
  ].filter(([, , , fn]) => typeof fn === 'function');
  const menuId = `quote-send-menu-${quote.id}`;
  return (
    // PRODUCT_TRUTH_DECORATIVE: the wrapper only keeps a click on Send from also opening / closing the row behind it
    <span ref={wrap} className={`quote-send quote-send--${variant}`} onClick={(e) => e.stopPropagation()}>
      {/* PRODUCT_TRUTH_DECORATIVE: opens the three send choices of this quote (each choice runs its own existing gated action) */}
      <button type="button" className="quote-send-button" data-testid="quote-send" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
        aria-label={`${isHebrew ? 'שליחה' : 'Send'} ${quote.clients?.company_name || ''}`.trim()}
        onClick={(e) => { e.stopPropagation(); if (open) { setOpen(false); return; } setPos(place()); setOpen(true); }}>
        <Send size={14} strokeWidth={2.4} aria-hidden="true" />
        <span>{isHebrew ? 'שליחה' : 'Send'}</span>
      </button>
      {/* the menu is rendered on the page body (a portal) - no row, card or list frame paints over it or clips it */}
      {open && typeof document !== 'undefined' && createPortal(
        // PRODUCT_TRUTH_DECORATIVE: the floating menu box only keeps a click inside it from closing it or reaching the row
        <span ref={menuRef} onClick={(e) => e.stopPropagation()} id={menuId} role="menu" className="quote-send-menu" dir={isHebrew ? 'rtl' : 'ltr'} data-testid="quote-send-menu" style={pos || undefined}>
          {items.map(([k, Icon, label, fn]) => (
            // PRODUCT_TRUTH_DECORATIVE: runs the row's existing gated action (email confirm / WhatsApp / copy message)
            <button key={k} type="button" role="menuitem" className="quote-send-item" data-testid={`quote-send-${k}`} onClick={run(fn)}>
              <Icon size={15} strokeWidth={2.2} aria-hidden="true" /><span>{label}</span>
            </button>
          ))}
        </span>,
        document.body,
      )}
    </span>
  );
}
