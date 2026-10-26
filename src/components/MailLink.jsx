// Owner console 2026-10-26 (typed: "מאשר את התוכנית א עד ז בשחרור אחד ...", item ז; the Owner clicked "שליחת בקשת ביטול" and nothing
// opened): a mail link keeps its mailto href, and a click opens a small window inside the page - the address with Copy, the
// prepared subject, and Gmail / Outlook on the web / the mail app. Sends nothing by itself. HE = RTL, EN = LTR; the address is an LTR atom.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useFocusTrap from './quotePresentation/useFocusTrap';
import { copyText } from '../utils/businessCardShare';
import { mailComposeLinks, parseMailto } from '../shared/mailCompose';

const COPY = {
  he: {
    title: 'שליחת מייל', to: 'אל:', subject: 'נושא:', copy: 'העתקת הכתובת', copied: 'הכתובת הועתקה',
    copyFailed: 'לא הצלחנו להעתיק. סמנו את הכתובת והעתיקו אותה.',
    gmail: 'פתיחה בג׳ימייל', outlook: 'פתיחה באאוטלוק', app: 'פתיחה בתוכנת המייל', close: 'סגירה',
  },
  en: {
    title: 'Send an email', to: 'To:', subject: 'Subject:', copy: 'Copy the address', copied: 'Address copied',
    copyFailed: 'We could not copy it. Select the address and copy it.',
    gmail: 'Open in Gmail', outlook: 'Open in Outlook', app: 'Open in your mail app', close: 'Close',
  },
};
const btn = (primary) => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 44, padding: '0 16px', boxSizing: 'border-box',
  borderRadius: 9, border: primary ? 'none' : '1px solid #94a3b8', background: primary ? '#0F6672' : '#fff', color: primary ? '#fff' : '#1e293b',
  fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' });

export function MailComposeDialog({ mail, isHebrew, onClose }) {
  const C = COPY[isHebrew ? 'he' : 'en'];
  const ref = useRef(null);
  const [copied, setCopied] = useState(null);
  const links = mailComposeLinks(mail);
  useFocusTrap(ref, true);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.querySelector('button')?.focus();
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); if (prev && typeof prev.focus === 'function') prev.focus(); };
  }, [onClose]);
  const copyAddress = async () => setCopied(await copyText(mail.to));
  return (
    <div className="no-print" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10060, padding: 16 }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="mail-compose-title" dir={isHebrew ? 'rtl' : 'ltr'} lang={isHebrew ? 'he' : 'en'} data-testid="mail-compose"
        style={{ background: '#ffffff', borderRadius: 14, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', padding: 20, boxSizing: 'border-box', textAlign: 'start', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', color: '#1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
          <h2 id="mail-compose-title" style={{ margin: 0, fontSize: '1.15rem', color: '#0F6672' }}>{C.title}</h2>
          {/* PRODUCT_TRUTH_DECORATIVE: closes the mail window; sends nothing and changes no data */}
          <button type="button" onClick={onClose} aria-label={C.close} data-testid="mail-compose-close"
            style={{ minWidth: 44, minHeight: 44, border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p style={{ margin: '0 0 4px', fontSize: '0.95rem' }}>
          <span style={{ color: '#64748b' }}>{C.to}</span>{' '}
          <bdi dir="ltr" data-testid="mail-compose-to" style={{ fontWeight: 700, userSelect: 'all', overflowWrap: 'anywhere' }}>{mail.to}</bdi>
        </p>
        {mail.subject && (
          <p style={{ margin: '0 0 12px', fontSize: '0.9rem' }}>
            <span style={{ color: '#64748b' }}>{C.subject}</span> <span data-testid="mail-compose-subject">{mail.subject}</span>
          </p>
        )}
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {/* PRODUCT_TRUTH_DECORATIVE: copies the mail address to the clipboard; sends nothing */}
          <button type="button" onClick={copyAddress} data-testid="mail-compose-copy" style={btn(false)}>{C.copy}</button>
          {copied && (
            <p role="status" data-testid="mail-compose-copy-status" style={{ margin: 0, fontSize: '0.85rem', color: copied === 'copied' ? '#0F6672' : '#b45309', textAlign: 'center' }}>
              {copied === 'copied' ? C.copied : C.copyFailed}
            </p>
          )}
          {/* PRODUCT_TRUTH_DECORATIVE: opens a new Gmail message to this address in a new tab; the user writes and sends it */}
          <a href={links.gmail} target="_blank" rel="noopener noreferrer" data-testid="mail-compose-gmail" onClick={onClose} style={btn(true)}>{C.gmail}</a>
          {/* PRODUCT_TRUTH_DECORATIVE: opens a new Outlook on the web message to this address in a new tab; the user writes and sends it */}
          <a href={links.outlook} target="_blank" rel="noopener noreferrer" data-testid="mail-compose-outlook" onClick={onClose} style={btn(true)}>{C.outlook}</a>
          {/* PRODUCT_TRUTH_DECORATIVE: hands the message to the device mail app (mailto); the user writes and sends it */}
          <a href={links.mailto} data-testid="mail-compose-app" onClick={onClose} style={btn(false)}>{C.app}</a>
        </div>
      </div>
    </div>
  );
}

/** A mail link: `href` is the mailto (kept on the anchor); a click opens MailComposeDialog. Any other prop goes to the anchor. */
export default function MailLink({ href, isHebrew, children, ...rest }) {
  const [open, setOpen] = useState(false);
  const mail = parseMailto(href);
  const onClick = (e) => { if (!mail) return; e.preventDefault(); setOpen(true); };
  return (
    <>
      {/* PRODUCT_TRUTH_DECORATIVE: opens the in-app mail window (address, copy, Gmail / Outlook / mail app); sends nothing by itself */}
      <a href={href} onClick={onClick} {...rest}>{children}</a>
      {open && mail && typeof document !== 'undefined' && createPortal(<MailComposeDialog mail={mail} isHebrew={isHebrew} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
