// Task 23 + Task 24 (Phase 5): Business settings -> „כרטיס ביקור דיגיטלי” / "Digital business card" - the create / edit screen.
//   - two tabs: company details (optional photo, card name, job title, slogan, about), contact options (opt-in, offered only when the
//     detail exists in Business settings). Task 26: no style / design tab - Classic / Modern / Visual are QUOTE styles (Business settings →
//     quote design), never the card's.
//   - a live preview in a phone frame = exactly what the public page renders (same BusinessCard component, same projection)
//   - share link / QR and the TRUE state of the public page (checked through the same public endpoint a customer would use)
// Everything is bound to the useBusinessCardProfile state owned by SettingsTab. Nothing is invented:
// contact details come from Business settings, images only from what the business uploads.
import { useEffect, useId, useState } from 'react';
import { ArrowRight, ArrowLeft, IdCard, Share2, Check, ImagePlus, Trash2, Phone, MessageCircle, Mail, MapPin } from 'lucide-react';
import { APP as NEON, RADIUS, SHADOW } from '../theme/neonTheme';
import BusinessCard from './BusinessCard';
import { shareOrCopy, copyText } from '../utils/businessCardShare';
import { BUSINESS_CARD_SETTINGS_COPY } from './businessCardSettingsCopy';
import { projectBusinessCard, formatCardAddress, whatsappNumber, CARD_FIELD_LIMITS } from '../../supabase/functions/_shared/businessCard.js';
import { businessCardShareUrl, fetchPublicBusinessCard } from '../utils/businessCardClient';

const TEAL = '#0F6672';
const MAX_PHOTO_BYTES = 500 * 1024;
const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const css = `
.pf-bcs { display: flex; flex-direction: column; gap: 14px; container-type: inline-size; }
.pf-bcs-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.pf-bcs-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: 9px; padding: 8px 14px; min-height: 44px; font-weight: 700; font-size: 0.8rem; border: 1px solid ${NEON.borderStrong}; background: ${NEON.bgCard}; color: ${NEON.textPrimary}; cursor: pointer; white-space: nowrap; font-family: inherit; }
.pf-bcs-btn.pri { background: ${TEAL}; border-color: ${TEAL}; color: #ffffff; }
.pf-bcs-btn:disabled { opacity: .55; cursor: not-allowed; }
.pf-bcs-card { background: ${NEON.bgCard}; border-radius: ${RADIUS.lg}; padding: 16px; box-shadow: ${SHADOW.sm}; min-width: 0; }
.pf-bcs-callout { border-radius: 10px; padding: 10px 12px; font-size: 0.8rem; line-height: 1.45; margin-top: 12px; }
.pf-bcs-link { width: 100%; box-sizing: border-box; direction: ltr; text-align: left; padding: 9px 10px; border: 1px solid ${NEON.borderStrong}; border-radius: 8px; background: ${NEON.bgInput}; color: ${NEON.textPrimary}; font-size: 0.82rem; }
.pf-bcs-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; align-items: start; }
@container (min-width: 700px) { .pf-bcs-grid { grid-template-columns: minmax(0, 1fr) 320px; } .pf-bcs-preview { position: sticky; top: 12px; } }
.pf-bcs-tabs { display: flex; gap: 4px; border-bottom: 1px solid ${NEON.border}; margin: -4px -4px 14px; overflow-x: auto; }
.pf-bcs-tab { flex: 1 1 0; min-width: max-content; min-height: 44px; padding: 8px 12px; border: 0; border-bottom: 3px solid transparent; background: none; color: ${NEON.textSecondary}; font-weight: 700; font-size: 0.84rem; cursor: pointer; font-family: inherit; }
.pf-bcs-tab[aria-selected="true"] { color: ${TEAL}; border-bottom-color: ${TEAL}; }
.pf-bcs-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; font-size: 0.82rem; font-weight: 700; color: ${NEON.textPrimary}; }
.pf-bcs-input { width: 100%; box-sizing: border-box; padding: 10px 12px; min-height: 44px; border: 1px solid ${NEON.borderStrong}; border-radius: 8px; background: ${NEON.bgInput}; color: ${NEON.textPrimary}; font-size: 16px; font-family: inherit; font-weight: 400; }
textarea.pf-bcs-input { min-height: 96px; resize: vertical; line-height: 1.5; }
.pf-bcs-help { font-size: 0.74rem; font-weight: 400; color: ${NEON.textSecondary}; line-height: 1.4; }
.pf-bcs-photo { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.pf-bcs-thumb { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 1px solid ${NEON.borderStrong}; background: ${NEON.bgCardAlt}; flex: none; }
.pf-bcs-channel { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid ${NEON.border}; border-radius: 10px; margin-bottom: 8px; min-height: 52px; box-sizing: border-box; }
.pf-bcs-channel svg { flex: none; color: ${TEAL}; }
.pf-bcs-channel-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; font-size: 0.84rem; font-weight: 700; }
.pf-bcs-channel-main small { font-weight: 400; color: ${NEON.textSecondary}; font-size: 0.76rem; overflow-wrap: anywhere; }
.pf-bcs-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 0.78rem; font-weight: 700; color: ${NEON.textPrimary}; cursor: pointer; white-space: nowrap; min-height: 44px; }
.pf-bcs-toggle input { width: 20px; height: 20px; accent-color: ${TEAL}; }
.pf-bcs-savebar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 6px; padding-top: 12px; border-top: 1px solid ${NEON.border}; }
.pf-bcs-phone { width: 100%; max-width: 320px; margin: 0 auto; border: 10px solid #0F172A; border-radius: 34px; background: #F1F5F9; box-sizing: border-box; box-shadow: 0 18px 40px -18px rgba(15,23,42,.5); overflow: hidden; }
.pf-bcs-screen { max-height: 640px; overflow-y: auto; padding: 14px 10px; box-sizing: border-box; }
.pf-bcs-screen .pf-bcard { max-width: 100%; }
`;

const draftAsRow = (d) => ({
  display_name: d.displayName, job_title: d.jobTitle, slogan: d.slogan, about: d.about, photo_url: d.photoUrl,
  show_phone: d.showPhone, show_whatsapp: d.showWhatsapp, show_email: d.showEmail, show_address: d.showAddress,
});

export default function BusinessCardSettings({ isHebrew, isLocalIsraeliBusiness, client, userId, bizName, bizPhone, bizEmail, bizAddress, bizLogoUrl, onBack, profile }) {
  const C = BUSINESS_CARD_SETTINGS_COPY[isHebrew ? 'he' : 'en'];
  const Arrow = isHebrew ? ArrowRight : ArrowLeft;
  const uid = useId();
  const [tab, setTab] = useState('company');
  const [publicStatus, setPublicStatus] = useState('checking');
  // QA 2026-10-25: the public page status is checked again after each successful save (it no longer says "not found" until re-entry)
  const [statusRun, setStatusRun] = useState(0);
  const [copied, setCopied] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const draft = profile.draft;
  const market = isLocalIsraeliBusiness ? 'Local' : 'International';
  const settingsRow = { business_name: bizName, phone: bizPhone, email: bizEmail, address: bizAddress, logo_url: bizLogoUrl, country: market };
  const card = projectBusinessCard(settingsRow, draftAsRow(draft));
  const shareUrl = businessCardShareUrl(userId);
  const language = isLocalIsraeliBusiness ? 'he' : 'en';
  const available = {
    phone: !!(bizPhone && bizPhone.replace(/\D/g, '').length >= 6),
    whatsapp: !!whatsappNumber(bizPhone || '', language),
    email: !!(bizEmail && bizEmail.includes('@')),
    address: !!formatCardAddress(bizAddress),
  };
  const values = { phone: bizPhone, whatsapp: bizPhone, email: bizEmail, address: formatCardAddress(bizAddress) };

  useEffect(() => {
    let alive = true;
    if (!client || !userId) { setPublicStatus('other'); return undefined; }
    fetchPublicBusinessCard(client, userId).then((r) => { if (alive) setPublicStatus(r.status); });
    return () => { alive = false; };
  }, [client, userId, statusRun]);

  const flashCopied = (result) => { if (result === 'copied') { setCopied(true); setTimeout(() => setCopied(false), 2000); } };
  const statusText = C.status[publicStatus] || C.status.other;
  const statusTone = publicStatus === 'ok' ? { background: '#E7F6EC', color: '#14532D' } : publicStatus === 'checking' ? { background: NEON.bgCardAlt, color: NEON.textSecondary } : { background: '#FFF3E0', color: '#6E420C' };

  const onPhoto = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError('');
    if (!PHOTO_TYPES.includes(file.type)) { setPhotoError(C.photoType); return; }
    if (file.size > MAX_PHOTO_BYTES) { setPhotoError(C.photoTooBig); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') profile.update({ photoUrl: reader.result }); };
    reader.readAsDataURL(file);
  };

  const TABS = ['company', 'channels'];
  const onTabKey = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const step = (e.key === 'ArrowLeft') === isHebrew ? 1 : -1;
    const next = TABS[(TABS.indexOf(tab) + step + TABS.length) % TABS.length];
    setTab(next);
    document.getElementById(`${uid}-tab-${next}`)?.focus();
  };
  const textField = (key, label, placeholder, max, multi = false) => {
    const Tag = multi ? 'textarea' : 'input';
    return (
      <label className="pf-bcs-field" key={key}>
        {label}
        <Tag className="pf-bcs-input" value={draft[key]} placeholder={placeholder} maxLength={max} onChange={(e) => profile.update({ [key]: e.target.value })} data-testid={`card-field-${key}`} />
        {multi && <span className="pf-bcs-help" aria-hidden="true"><bdi dir="ltr" className="pf-num">{(draft[key] || '').length}/{max}</bdi></span>}
      </label>
    );
  };
  const CHANNELS = [
    { key: 'phone', flag: 'showPhone', Icon: Phone },
    { key: 'whatsapp', flag: 'showWhatsapp', Icon: MessageCircle },
    { key: 'email', flag: 'showEmail', Icon: Mail },
    { key: 'address', flag: 'showAddress', Icon: MapPin },
  ];
  const saveText = profile.saveStatus === 'saving' ? C.saving : (C.saveStatus[profile.saveStatus] || '');

  return (
    <div className="pf-bcs" data-testid="business-card-settings" dir={isHebrew ? 'rtl' : 'ltr'}>
      <style>{css}</style>
      <div className="pf-bcs-top">
        {/* PRODUCT_TRUTH_DECORATIVE: navigation back to the Business settings screen; changes no data */}
        <button type="button" className="pf-bcs-btn" onClick={onBack} data-testid="business-card-back"><Arrow size={15} />{C.back}</button>
        {shareUrl && (
          // PRODUCT_TRUTH_CAPABILITY: digital_business_card
          <button type="button" className="pf-bcs-btn pri" onClick={async () => flashCopied(await shareOrCopy(shareUrl, card?.businessName || bizName))} data-testid="business-card-top-share">
            {copied ? <Check size={15} aria-hidden="true" /> : <Share2 size={15} aria-hidden="true" />}{copied ? C.shared : C.share}
          </button>
        )}
      </div>

      <div className="pf-bcs-card">
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: NEON.textPrimary }} data-testid="business-card-title">
          <IdCard size={18} color={TEAL} />{profile.exists ? C.titleEdit : C.titleCreate}
        </h2>
        <div style={{ color: NEON.textSecondary, fontSize: '0.8rem', marginTop: 3 }}>{C.sub}</div>
        {profile.load === 'unavailable' && (
          <div className="pf-bcs-callout" role="status" style={{ background: '#FFF3E0', color: '#6E420C' }} data-testid="business-card-save-unavailable">{C.loadUnavailable}</div>
        )}
        {profile.load === 'failed' && (
          <div className="pf-bcs-callout" role="alert" style={{ background: '#FDECEC', color: '#7F1D1D', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }} data-testid="business-card-load-failed">
            <span style={{ minWidth: 0, flex: '1 1 220px' }}>{C.loadFailed}</span>
            {/* PRODUCT_TRUTH_DECORATIVE: loads the stored card again; changes no data */}
            <button type="button" className="pf-bcs-btn" onClick={() => profile.reload()} data-testid="business-card-load-retry">{C.retry}</button>
          </div>
        )}
        <div className="pf-bcs-callout" role="status" style={statusTone} data-testid="business-card-public-status" data-status={publicStatus}>{statusText}</div>
        {shareUrl && (
          <label style={{ display: 'block', marginTop: 12, fontSize: '0.8rem', fontWeight: 700, color: NEON.textPrimary }}>
            {C.link}
            <input className="pf-bcs-link" readOnly value={shareUrl} onFocus={(e) => e.target.select()} data-testid="business-card-link" style={{ marginTop: 4 }} />
          </label>
        )}
      </div>

      <div className="pf-bcs-grid">
        <section className="pf-bcs-card" aria-label={profile.exists ? C.titleEdit : C.titleCreate}>
          <div className="pf-bcs-tabs" role="tablist" aria-label={C.title} onKeyDown={onTabKey}>
            {TABS.map((id) => (
              // PRODUCT_TRUTH_DECORATIVE: switches the visible tab of the card editor; changes no data
              <button key={id} id={`${uid}-tab-${id}`} type="button" role="tab" className="pf-bcs-tab" aria-selected={tab === id} aria-controls={`${uid}-panel-${id}`} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} data-testid={`card-tab-${id}`}>
                {C.tabs[id]}
              </button>
            ))}
          </div>

          {tab === 'company' && (
            <div role="tabpanel" id={`${uid}-panel-company`} aria-labelledby={`${uid}-tab-company`} data-testid="card-panel-company">
              <p className="pf-bcs-help" style={{ margin: '0 0 12px' }}>{C.emptyHidden}</p>
              <div className="pf-bcs-field">
                {C.photo}
                <div className="pf-bcs-photo">
                  {draft.photoUrl ? <img className="pf-bcs-thumb" src={draft.photoUrl} alt="" /> : <span className="pf-bcs-thumb" aria-hidden="true" />}
                  {/* PRODUCT_TRUTH_CAPABILITY: digital_business_card */}
                  <label className="pf-bcs-btn" style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                    <ImagePlus size={15} aria-hidden="true" />{C.photoPick}
                    <input type="file" accept={PHOTO_TYPES.join(',')} onChange={onPhoto} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} data-testid="card-photo-input" />
                  </label>
                  {draft.photoUrl && (
                    // PRODUCT_TRUTH_CAPABILITY: digital_business_card
                    <button type="button" className="pf-bcs-btn" onClick={() => profile.update({ photoUrl: '' })} data-testid="card-photo-remove"><Trash2 size={15} aria-hidden="true" />{C.photoRemove}</button>
                  )}
                </div>
                <span className="pf-bcs-help">{C.photoHint}</span>
                {photoError && <span role="alert" style={{ color: NEON.red, fontSize: '0.78rem', fontWeight: 600 }}>{photoError}</span>}
              </div>
              {textField('displayName', C.displayName, bizName || C.displayNamePh, CARD_FIELD_LIMITS.displayName)}
              {textField('jobTitle', C.jobTitle, C.jobTitlePh, CARD_FIELD_LIMITS.jobTitle)}
              {textField('slogan', C.slogan, C.sloganPh, CARD_FIELD_LIMITS.slogan)}
              {textField('about', C.about, C.aboutPh, CARD_FIELD_LIMITS.about, true)}
            </div>
          )}

          {tab === 'channels' && (
            <div role="tabpanel" id={`${uid}-panel-channels`} aria-labelledby={`${uid}-tab-channels`} data-testid="card-panel-channels">
              <p className="pf-bcs-help" style={{ margin: '0 0 12px' }}>{C.channelsIntro}</p>
              {CHANNELS.map(({ key, flag, Icon }) => (
                <div className="pf-bcs-channel" key={key} data-channel={key}>
                  <Icon size={18} aria-hidden="true" />
                  <span className="pf-bcs-channel-main">
                    {C.ch[key]}
                    <small>{available[key] ? (key === 'whatsapp' ? C.chWhatsappNote : <bdi dir={key === 'address' ? undefined : 'ltr'}>{values[key]}</bdi>) : C.chMissing[key]}</small>
                  </span>
                  {/* PRODUCT_TRUTH_CAPABILITY: digital_business_card */}
                  <label className="pf-bcs-toggle">
                    <input type="checkbox" checked={available[key] && draft[flag]} disabled={!available[key]} onChange={(e) => profile.update({ [flag]: e.target.checked })} data-testid={`card-channel-${key}`} />
                    {C.chShow}
                  </label>
                </div>
              ))}
            </div>
          )}

          <div className="pf-bcs-savebar">
            {/* PRODUCT_TRUTH_CAPABILITY: digital_business_card */}
            <button type="button" className="pf-bcs-btn pri" onClick={async () => { if ((await profile.save()) === 'ok') setStatusRun((n) => n + 1); }} disabled={!profile.dirty || profile.saveStatus === 'saving' || profile.load === 'unavailable' || profile.load === 'loading' || profile.load === 'failed'} data-testid="card-save">
              {profile.saveStatus === 'saving' ? C.saving : C.save}
            </button>
            {profile.dirty && profile.saveStatus !== 'saving' && <span className="pf-bcs-help" data-testid="card-unsaved">{C.unsaved}</span>}
            {saveText && <span className="pf-bcs-help" role="status" data-testid="card-save-status">{saveText}</span>}
          </div>
        </section>

        <aside className="pf-bcs-preview" aria-label={C.preview} data-testid="business-card-preview-frame">
          <div className="pf-bcs-help" style={{ textAlign: 'center', fontWeight: 700, marginBottom: 6 }}>{C.preview}</div>
          <div className="pf-bcs-phone">
            <div className="pf-bcs-screen">
              {card ? (
                <BusinessCard card={card} shareUrl={shareUrl} copied={copied}
                  onShare={async () => flashCopied(await shareOrCopy(shareUrl, card.businessName))}
                  onCopy={async () => flashCopied(await copyText(shareUrl))}
                  testId="business-card-preview" />
              ) : (
                <div className="pf-bcs-callout" role="status" style={{ background: '#FFF3E0', color: '#6E420C', marginTop: 0 }} data-testid="business-card-needs-name">{C.needsName}</div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
