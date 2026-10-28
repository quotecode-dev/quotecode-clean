// Task 23 + Task 24 (Phase 5): the digital business card itself - ONE presentational component used by the owner editor's live preview
// and by the public page /card/:id. It renders only the public card of supabase/functions/_shared/businessCard.js (name, job title,
// slogan, about, the business's own photo / logo, and ONLY the contact channels the owner opted in to), the share actions and the QR,
// with TEKANGO identity, in ONE clean presentation. Task 26 (Owner correction 2026-10-11): Classic / Modern with images / Visual are
// QUOTE presentation styles (Business settings → quote design), never business-card styles - the card has no style choice and never reads one.
// No external or invented image is ever used; without images the card is still complete (initial letter). Direction and language
// follow the card (Local -> HE/RTL, International -> EN/LTR); phone, email and the link stay LTR-isolated.
import { useMemo, useState } from 'react';
import { Phone, Mail, MapPin, Share2, Copy, Check, MessageCircle } from 'lucide-react';
import ProFlowLogo from './ProFlowLogo';
import { encodeQr, qrSvgPath } from '../utils/qrCode';
import MailLink from './MailLink';

const TEAL = '#0F6672';
const BUSINESS_CARD_COPY = {
  he: { call: 'התקשרו', whatsapp: 'WhatsApp', whatsappAria: 'שליחת הודעת WhatsApp', email: 'כתובת מייל', address: 'כתובת', about: 'אודות', share: 'שיתוף הכרטיס', copy: 'העתקת הקישור', copied: 'הקישור הועתק', qr: 'קוד QR לכרטיס הביקור', by: 'כרטיס ביקור דיגיטלי ב-TEKANGO' },
  en: { call: 'Call', whatsapp: 'WhatsApp', whatsappAria: 'Send a WhatsApp message', email: 'Email', address: 'Address', about: 'About', share: 'Share card', copy: 'Copy link', copied: 'Link copied', qr: 'QR code for this business card', by: 'Digital business card by TEKANGO' },
};

const businessCardCss = `
.pf-bcard { width: 100%; max-width: 420px; margin: 0 auto; background: #ffffff; border-radius: 18px; box-shadow: 0 10px 30px -12px rgba(15,23,42,.25); border: 1px solid #E2E8F0; overflow: hidden; box-sizing: border-box; color: #0F172A; }
.pf-bcard-head { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 22px 18px 14px; position: relative; }
.pf-bcard-avatar { width: 78px; height: 78px; border-radius: 50%; object-fit: cover; background: #ffffff; box-sizing: border-box; flex: none; }
.pf-bcard-avatar.logo { object-fit: contain; padding: 8px; border-radius: 18px; }
.pf-bcard-initial { width: 78px; height: 78px; border-radius: 50%; background: #E3F1F2; color: ${TEAL}; font-weight: 800; font-size: 2rem; display: flex; align-items: center; justify-content: center; flex: none; }
.pf-bcard-name { margin: 0; font-size: 1.25rem; font-weight: 800; line-height: 1.3; overflow-wrap: anywhere; }
.pf-bcard-title { font-size: 0.9rem; font-weight: 600; color: #334155; overflow-wrap: anywhere; }
.pf-bcard-slogan { font-size: 0.86rem; color: #475569; overflow-wrap: anywhere; }
.pf-bcard-body { padding: 6px 16px 6px; display: flex; flex-direction: column; gap: 8px; }
.pf-bcard-row { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 8px 10px; border-radius: 10px; background: #F8FAFC; color: #0F172A; text-decoration: none; font-size: 0.92rem; box-sizing: border-box; }
.pf-bcard-row svg { flex: none; color: ${TEAL}; }
.pf-bcard-row span { min-width: 0; overflow-wrap: anywhere; }
a.pf-bcard-row:hover { background: #EEF6F7; }
.pf-bcard-about { margin: 4px 0 0; padding: 10px 12px; border-radius: 10px; background: #F8FAFC; font-size: 0.86rem; line-height: 1.55; white-space: pre-line; overflow-wrap: anywhere; }
.pf-bcard-about strong { display: block; font-size: 0.78rem; color: #475569; margin-bottom: 2px; }
.pf-bcard-actions { display: flex; gap: 8px; padding: 8px 16px 4px; flex-wrap: wrap; }
.pf-bcard-btn { flex: 1 1 140px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; border-radius: 10px; border: 1px solid ${TEAL}; background: #ffffff; color: ${TEAL}; font-weight: 700; font-size: 0.85rem; cursor: pointer; font-family: inherit; }
.pf-bcard-btn.pri { background: ${TEAL}; color: #ffffff; }
.pf-bcard-qr { display: flex; justify-content: center; padding: 12px 16px 4px; }
.pf-bcard-qr-tile { background: #ffffff; border-radius: 12px; padding: 6px; line-height: 0; }
.pf-bcard-qr svg { width: 140px; height: 140px; }
.pf-bcard-by { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 16px 14px; color: #64748B; font-size: 0.74rem; }
/* one card presentation (Task 26): clean and minimal */
.pf-bcard .pf-bcard-head { border-bottom: 1px solid #EEF2F6; margin: 0 16px 6px; padding-inline: 2px; }
.pf-bcard .pf-bcard-avatar, .pf-bcard .pf-bcard-initial { border: 2px solid #E2E8F0; }
`;

function Avatar({ src, logo, name, onError }) {
  if (src) return <img className={`pf-bcard-avatar${logo ? ' logo' : ''}`} src={src} alt="" onError={onError} />;
  return <div className="pf-bcard-initial" aria-hidden="true">{(name || '?').trim().charAt(0).toUpperCase()}</div>;
}

export default function BusinessCard({ card, shareUrl = null, onShare, onCopy, copied = false, testId = 'business-card' }) {
  const he = card.language === 'he';
  const t = BUSINESS_CARD_COPY[he ? 'he' : 'en'];
  const qr = useMemo(() => {
    if (!shareUrl) return null;
    try { const q = encodeQr(shareUrl); return { size: q.size + 8, path: qrSvgPath(q.modules) }; } catch { return null; }
  }, [shareUrl]);
  const [failed, setFailed] = useState({});
  const photo = card.photoUrl && !failed.photo ? card.photoUrl : '';
  const logo = card.logoUrl && !failed.logo ? card.logoUrl : '';
  const tel = card.phone ? card.phone.replace(/[^\d+]/g, '') : '';
  // one avatar: the business's own photo first, else its logo, else the initial letter
  const avatar = photo ? { src: photo, logo: false, key: 'photo' } : logo ? { src: logo, logo: true, key: 'logo' } : null;

  return (
    <article className="pf-bcard" dir={he ? 'rtl' : 'ltr'} lang={he ? 'he' : 'en'} data-testid={testId}>
      <style>{businessCardCss}</style>
      <header className="pf-bcard-head">
        <Avatar src={avatar?.src} logo={avatar?.logo} name={card.businessName} onError={() => setFailed((f) => ({ ...f, [avatar.key]: true }))} />
        <h1 className="pf-bcard-name">{card.businessName}</h1>
        {card.jobTitle && <div className="pf-bcard-title">{card.jobTitle}</div>}
        {card.slogan && <div className="pf-bcard-slogan">{card.slogan}</div>}
      </header>
      <div className="pf-bcard-body">
        {card.phone && (
          // PRODUCT_TRUTH_CAPABILITY: digital_business_card
          <a className="pf-bcard-row" href={`tel:${tel}`} aria-label={`${t.call} ${card.phone}`} data-channel="phone">
            <Phone size={18} aria-hidden="true" /><span><bdi dir="ltr" className="pf-num">{card.phone}</bdi></span>
          </a>
        )}
        {card.whatsappUrl && (
          // PRODUCT_TRUTH_CAPABILITY: digital_business_card
          <a className="pf-bcard-row" href={card.whatsappUrl} target="_blank" rel="noopener noreferrer" aria-label={t.whatsappAria} data-channel="whatsapp">
            <MessageCircle size={18} aria-hidden="true" /><span>{t.whatsapp}</span>
          </a>
        )}
        {card.email && (
          // PRODUCT_TRUTH_CAPABILITY: digital_business_card
          <MailLink className="pf-bcard-row" href={`mailto:${card.email}`} isHebrew={he} aria-label={`${t.email} ${card.email}`} data-channel="email">
            <Mail size={18} aria-hidden="true" /><span><bdi dir="ltr">{card.email}</bdi></span>
          </MailLink>
        )}
        {card.address && (
          <div className="pf-bcard-row" aria-label={`${t.address} ${card.address}`} data-channel="address">
            <MapPin size={18} aria-hidden="true" /><span>{card.address}</span>
          </div>
        )}
        {card.about && <p className="pf-bcard-about"><strong>{t.about}</strong>{card.about}</p>}
      </div>
      {shareUrl && (
        <>
          <div className="pf-bcard-actions">
            {/* PRODUCT_TRUTH_CAPABILITY: digital_business_card */}
            <button type="button" className="pf-bcard-btn pri" onClick={onShare} data-testid={`${testId}-share`}><Share2 size={16} aria-hidden="true" />{t.share}</button>
            {/* PRODUCT_TRUTH_CAPABILITY: digital_business_card */}
            <button type="button" className="pf-bcard-btn" onClick={onCopy} data-testid={`${testId}-copy`} aria-live="polite">
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}{copied ? t.copied : t.copy}
            </button>
          </div>
          {qr && (
            <div className="pf-bcard-qr">
              <div className="pf-bcard-qr-tile">
                <svg viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label={t.qr} shapeRendering="crispEdges" data-testid={`${testId}-qr`}>
                  <rect width={qr.size} height={qr.size} fill="#ffffff" />
                  <path d={qr.path} fill="#0F172A" />
                </svg>
              </div>
            </div>
          )}
        </>
      )}
      <footer className="pf-bcard-by"><ProFlowLogo size={16} /><span>{t.by}</span></footer>
    </article>
  );
}
