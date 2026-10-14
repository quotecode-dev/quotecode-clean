import { useState, useEffect } from 'react';
import { Settings, Building2, Hash, Mail, Phone, Coins, MapPin, Image as ImageIcon, FileText, Shield, ShieldCheck, Users, Ruler, LayoutTemplate, BellRing, IdCard, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { APP as NEON, lightHeadingTextStyle as neonGlowTextStyle, RADIUS, SHADOW } from '../theme/neonTheme';
import BusinessQuoteStyleSection from './quotePresentation/BusinessQuoteStyleSection';
import { presentationCopy } from './quotePresentation/presentationCopy';
import { subscriptionSectionState } from '../domain/subscriptions/accountSummaryClient';
import { pricingModalModel } from '../domain/subscriptions/pricingModalModel';
import PackageOfferCards from './PackageOfferCards';
import { PROFESSIONAL_DOMAINS } from '../utils/professionalQuoteItem';
import RemindersSettings from './RemindersSettings';
import BusinessCardSettings from './BusinessCardSettings';
import ShareDefaultsSettings from './ShareDefaultsSettings';
import { BUSINESS_CARD_SETTINGS_COPY } from './businessCardSettingsCopy';
import { useBusinessCardProfile } from '../hooks/useBusinessCardProfile';
import { REMINDERS_COPY } from '../utils/reminders';

// פונקציית עזר לזיהוי קידומת לפי מטבע עסק
const getDialByCurrency = (curr, isLocal) => {
  if (isLocal || curr === 'ILS') return { dial: '+972', label: 'IL (+972)' };
  if (curr === 'GBP') return { dial: '+44', label: 'GB (+44)' };
  if (curr === 'EUR') return { dial: '+49', label: 'DE (+49)' };
  if (curr === 'CAD') return { dial: '+1', label: 'CA (+1)' };
  if (curr === 'AUD') return { dial: '+61', label: 'AU (+61)' };
  if (curr === 'USD') return { dial: '+1', label: 'US (+1)' };
  return { dial: '+972', label: 'IL (+972)' };
};

// PRODUCT_TRUTH_CAPABILITY: business_settings
export default function SettingsTab({
  isHebrew,
  handleSaveSettings,
  bizName,
  setBizName,
  bizTaxId,
  setBizTaxId,
  bizEmail,
  setBizEmail,
  bizPhone,
  setBizPhone,
  currency,
  setCurrency,
  isLocalIsraeliBusiness,
  bizAddress,
  setBizAddress,
  bizLogoUrl,
  setBizLogoUrl,
  // OD-16 / OD-20: the account plan state comes ONLY from the server account summary
  accountSummary,
  onRetryAccountSummary,
  // Owner 2026-10-14: a lifetime account sees "Lifetime subscription - no charge" and no package
  isLifetime = false,
  // Subscriptions (continuation A): while the plan system is active (server phase shadow/enforced), issued documents take the
  // logo ONLY from an immutable imported asset. A logo change must therefore be imported (bytes, server read-back) first.
  logoImportRequired = false,
  onImportLogo,
  isSuperAdmin,
  canUseAttachments,
  defaultTerms,
  setDefaultTerms,
  defaultWarranty,
  setDefaultWarranty,
  professionalDomain,
  setProfessionalDomain,
  canUseProfessionalQuotes,
  // Task 16: presentation controller (business default quote style). Absent => no section.
  presentationController = null,
  // Task 20: the ONE entry to Reminders & automation (Owner clarification 2026-10-09). Absent client/userId => no entry button.
  remindersClient = null,
  remindersUserId = null,
  // Task 23 (Phase 5): the digital business card entry (separate button next to Reminders & automation). Absent => no entry button.
  businessCardClient = null,
  businessCardUserId = null,
  // Task 27 (spec §6): manual sharing defaults + the thank-you after signing - its own entry and screen. Absent => no entry button.
  shareDefaultsClient = null,
  shareDefaultsUserId = null,
  onShareDefaultsSaved = null,
}) {
  const [view, setView] = useState('business');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [stateProv, setStateProv] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [logoError, setLogoError] = useState('');
  // Task 24: ONE business card profile state for the card editor (Task 26: the card has no style choice; quote styles live in the quote design section).
  const cardProfile = useBusinessCardProfile(businessCardClient, businessCardUserId);
  const lifetimeAccount = isLifetime === true && !isSuperAdmin;
  const accountState = subscriptionSectionState(accountSummary, isHebrew ? 'he' : 'en', { isLifetime: lifetimeAccount });
  // Task 30: market = the server summary market, else the account's recorded business market (never the UI language) - as PricingModal.
  const subscriptionMarket = (accountSummary?.state === 'ready' ? accountSummary.market : null) || (isLocalIsraeliBusiness ? 'IL' : 'INTERNATIONAL');
  const subscriptionOffer = pricingModalModel({ isHebrew, market: subscriptionMarket });

  // אכיפה מוחלטת: אם העסק מקומי בישראל, המטבע חייב להיות תמיד ILS ברזל
  useEffect(() => {
    if (isLocalIsraeliBusiness && currency !== 'ILS') {
      setCurrency('ILS');
    }
  }, [isLocalIsraeliBusiness, currency, setCurrency]);

  // גזירת הקידומת האוטומטית עם אכיפה מלאה למקומיים
  const effectiveCurr = isLocalIsraeliBusiness ? 'ILS' : currency;
  const currencyPhoneConfig = getDialByCurrency(effectiveCurr, isLocalIsraeliBusiness);
  const defaultDial = currencyPhoneConfig.dial;
  const defaultLabel = currencyPhoneConfig.label;

  const [localPhone, setLocalPhone] = useState('');

  const handleLocalPhoneChange = (numVal) => {
    setLocalPhone(numVal);
    setBizPhone(`${defaultDial} ${numVal}`);
  };

  useEffect(() => {
    if (bizPhone) {
      if (bizPhone.startsWith(defaultDial)) {
        setLocalPhone(bizPhone.replace(defaultDial, '').trim());
      } else {
        const clean = bizPhone.replace(/^\+\d+/, '').trim();
        setLocalPhone(clean || bizPhone);
      }
    } else {
      setLocalPhone('');
    }
  }, [bizPhone, defaultDial]);

  useEffect(() => {
    if (bizAddress) {
      const parts = bizAddress.split('|');
      if (parts.length >= 4) {
        setStreet(parts[0] || '');
        setCity(parts[1] || '');
        setStateProv(parts[2] || '');
        setZipCode(parts[3] || '');
      } else {
        setStreet(bizAddress);
      }
    } else {
      setStreet('');
      setCity('');
      setStateProv('');
      setZipCode('');
    }
  }, [bizAddress]);

  const handleAddressFieldChange = (newStreet, newCity, newState, newZip) => {
    setStreet(newStreet);
    setCity(newCity);
    setStateProv(newState);
    setZipCode(newZip);
    const combined = `${newStreet}|${newCity}|${newState}|${newZip}`;
    setBizAddress(combined);
  };

  const handleLogoFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLogoError('');

    if (file.size > 500 * 1024) {
      setLogoError(isHebrew ? 'הקובץ חורג ממשקל 500KB. אנא בחר קובץ קטן יותר.' : 'File exceeds 500KB. Please choose a smaller file.');
      return;
    }

    const validTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setLogoError(isHebrew ? 'ניתן להעלות קבצי SVG, JPG או PNG בלבד.' : 'Only SVG, JPG or PNG files are allowed.');
      return;
    }

    if (logoImportRequired && !['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      setLogoError(isHebrew ? 'במסמכים מונפקים ניתן להשתמש רק בלוגו PNG או JPG. הלוגו הנוכחי נשאר ללא שינוי.' : 'Issued documents accept only a PNG or JPG logo. The current logo is unchanged.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (uploadEvent) => {
      const dataUrl = uploadEvent.target.result;
      if (logoImportRequired) {
        // import first: only a logo the server stored immutably (and read back) may appear on issued documents; on any
        // failure the current logo and all data stay unchanged
        const res = onImportLogo ? await onImportLogo(String(dataUrl).split(',')[1] || '') : { ok: false };
        if (!res || res.ok !== true) {
          setLogoError(isHebrew ? 'לא ניתן לשמור את הלוגו כרגע. הלוגו הנוכחי נשאר ללא שינוי.' : 'The logo could not be saved right now. The current logo is unchanged.');
          return;
        }
      }
      setBizLogoUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const remindersCopy = REMINDERS_COPY[isHebrew ? 'he' : 'en'];
  if (view === 'reminders' && remindersClient && remindersUserId) {
    return (
      <div className="pf-screen pf-work-screen" style={{ background: NEON.bg, padding: 0, borderRadius: RADIUS.lg }}>
        <div className="pf-screen-body">
          <RemindersSettings isHebrew={isHebrew} isLocalIsraeliBusiness={isLocalIsraeliBusiness} client={remindersClient} userId={remindersUserId} bizName={bizName} onBack={() => setView('business')} />
        </div>
      </div>
    );
  }
  if (view === 'shareDefaults' && shareDefaultsClient && shareDefaultsUserId) {
    return (
      <div className="pf-screen pf-work-screen" style={{ background: NEON.bg, padding: 0, borderRadius: RADIUS.lg }}>
        <div className="pf-screen-body">
          <ShareDefaultsSettings isHebrew={isHebrew} client={shareDefaultsClient} userId={shareDefaultsUserId} onBack={() => setView('business')} onSaved={onShareDefaultsSaved} />
        </div>
      </div>
    );
  }
  if (view === 'businessCard' && businessCardClient && businessCardUserId) {
    return (
      <div className="pf-screen pf-work-screen" style={{ background: NEON.bg, padding: 0, borderRadius: RADIUS.lg }}>
        <div className="pf-screen-body">
          <BusinessCardSettings isHebrew={isHebrew} isLocalIsraeliBusiness={isLocalIsraeliBusiness} client={businessCardClient} userId={businessCardUserId}
            bizName={bizName} bizPhone={bizPhone} bizEmail={bizEmail} bizAddress={bizAddress} bizLogoUrl={bizLogoUrl} onBack={() => setView('business')} profile={cardProfile} />
        </div>
      </div>
    );
  }
  const cardCopy = BUSINESS_CARD_SETTINGS_COPY[isHebrew ? 'he' : 'en'];
  const entryStyle = { flex: '1 1 260px', minWidth: 0, display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'start', background: NEON.bgCardAlt, border: `1px solid ${NEON.borderStrong}`, borderRadius: '10px', padding: '10px 12px', minHeight: '48px', cursor: 'pointer', color: NEON.textPrimary, fontFamily: 'inherit' };
  const EntryChevron = isHebrew ? ChevronLeft : ChevronRight;

  return (
    <div className="pf-screen pf-work-screen pf-settings-screen" style={{ background: NEON.bgCard, padding: '18px', borderRadius: RADIUS.lg, border: 'none', boxShadow: SHADOW.sm }}>
      {/* Cross-Surface Visual Consolidation (§10): shadow-card pattern,
          matches Quote History/Dashboard - see ClientsTab.jsx for the full
          rationale comment. Container-level only. */}
      <h2 style={{ fontSize: '1rem', fontWeight: '800', marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', ...neonGlowTextStyle }}>
        <Settings size={18} color={NEON.violetLight} strokeWidth={2.2} />
        {isHebrew ? 'הגדרות עסק' : 'Business Settings'}
      </h2>
      <div className="pf-screen-body">
        {/* Task 30 (Owner addendum, business-settings layout): the action cards are the FIRST content of the ONE scroll body (they scroll
            with the quote design, the preview and the fields) instead of a static block above it that squeezed a low window. */}
        {/* Task 23: one row of separate entry buttons - Reminders & automation first (inline-start), the digital business card next to it
            (inline-end = visually LEFT of it in Hebrew/RTL, mirrored in English/LTR); they wrap onto two lines on narrow screens. */}
        {((remindersClient && remindersUserId) || (businessCardClient && businessCardUserId) || (shareDefaultsClient && shareDefaultsUserId)) && (
          <div className="pf-settings-entries" data-testid="settings-entries" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          {remindersClient && remindersUserId && (
            // PRODUCT_TRUTH_CAPABILITY: reminders_automation
            <button type="button" onClick={() => setView('reminders')} data-testid="settings-open-reminders"
              style={entryStyle}>
              <span style={{ background: '#E3F1F2', color: '#0F6672', borderRadius: '8px', padding: '6px', display: 'inline-flex', flex: 'none' }}><BellRing size={16} strokeWidth={2.2} /></span>
              <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem' }}>{remindersCopy.entry}</span>
                <span style={{ display: 'block', fontSize: '0.74rem', color: NEON.textSecondary }}>{remindersCopy.entrySub}</span>
              </span>
              <EntryChevron size={18} color={NEON.textMuted} aria-hidden="true" style={{ flex: 'none' }} />
            </button>
          )}
          {businessCardClient && businessCardUserId && (
            // PRODUCT_TRUTH_CAPABILITY: digital_business_card
            <button type="button" onClick={() => setView('businessCard')} data-testid="settings-open-business-card" style={entryStyle}>
              <span style={{ background: '#E3F1F2', color: '#0F6672', borderRadius: '8px', padding: '6px', display: 'inline-flex', flex: 'none' }}><IdCard size={16} strokeWidth={2.2} /></span>
              <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem' }}>{cardCopy.entry}</span>
                <span style={{ display: 'block', fontSize: '0.74rem', color: NEON.textSecondary }}>{cardCopy.entrySub}</span>
              </span>
              <EntryChevron size={18} color={NEON.textMuted} aria-hidden="true" style={{ flex: 'none' }} />
            </button>
          )}
          {shareDefaultsClient && shareDefaultsUserId && (
            // PRODUCT_TRUTH_CAPABILITY: business_settings
            <button type="button" onClick={() => setView('shareDefaults')} data-testid="settings-open-share-defaults" style={entryStyle}>
              <span style={{ background: '#E3F1F2', color: '#0F6672', borderRadius: '8px', padding: '6px', display: 'inline-flex', flex: 'none' }}><Share2 size={16} strokeWidth={2.2} /></span>
              <span style={{ flex: '1 1 auto', minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: '0.88rem' }}>{isHebrew ? 'שיתוף ותודה ללקוח' : 'Sharing & thank-you'}</span>
                <span style={{ display: 'block', fontSize: '0.74rem', color: NEON.textSecondary }}>{isHebrew ? 'הודעת וואטסאפ קבועה ותודה אחרי חתימה' : 'A default WhatsApp message and a thank-you after signing'}</span>
              </span>
              <EntryChevron size={18} color={NEON.textMuted} aria-hidden="true" style={{ flex: 'none' }} />
            </button>
          )}
          </div>
        )}
        {/* Task 27 (spec §6 settings): quote design directly below the two separate action cards (reminders / digital card) - its own
            section, separate from both; the business details form follows. */}
        {presentationController && (
          <section data-testid="settings-quote-design" style={{ marginBottom: '20px', paddingBottom: '18px', borderBottom: `1px solid ${NEON.border}` }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '800', marginTop: 0, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', ...neonGlowTextStyle }}>
              <LayoutTemplate size={16} color={NEON.violetLight} strokeWidth={2} />
              {presentationCopy(isHebrew ? 'he' : 'en').settingsSectionTitle}
            </h3>
            <BusinessQuoteStyleSection ctl={presentationController} />
          </section>
        )}
      <form onSubmit={handleSaveSettings}>
        {/* חוק ברזל (UI Composition Correction — Professional Business Type
            Placement, Owner-required, 2026-09-03): הועבר מסוף הטופס (אחרי
            תנאים/אחריות) לראש הטופס - הוא אמור להיות התצורה העסקית המשמעותית
            הראשונה שהמשתמש רואה, לא שדה "שנוסף בהמשך" אחרי גלילה. תוכן/ערכים/
            שמירה/persistence/entitlement-gating (canUseProfessionalQuotes)
            זהים לחלוטין למה שהיה - זו תיקון-מיקום/הרכב בלבד, לא שינוי לוגיקה.
            עיצוב-קופסה (רקע-גוון+מסגרת+פינות) תואם את התבנית הקיימת כבר לקטע
            "כתובת העסק" למטה - כדי שהמיקום החדש ירגיש כמו חלק מכוון מהעיצוב,
            לא כמו שדה שהוצמד בחיפזון לראש המסך. בקרה יחידה-אחת קיימת - לא
            שכפול (הבקרה הישנה הוסרה במלואה מהמיקום הקודם). */}
        {canUseProfessionalQuotes && (
          <div className="pf-m-surface" style={{ background: NEON.bgCardAlt, padding: '14px', borderRadius: '10px', border: `1px solid ${NEON.border}`, marginBottom: '18px' }}>
            <h3 style={{ fontSize: '0.85rem', color: NEON.violetLight, fontWeight: '700', marginTop: 0, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Ruler size={14} color={NEON.violetLight} />{isHebrew ? 'מה סוג העיסוק המקצועי של העסק?' : 'What kind of professional work does your business do?'}
            </h3>
            <select
              value={professionalDomain || ''}
              onChange={(e) => setProfessionalDomain(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }}
            >
              <option value="">{isHebrew ? 'לא נבחר (ללא הצעת ברירת מחדל)' : 'Not set (no default suggestion)'}</option>
              {PROFESSIONAL_DOMAINS.filter(d => d.id !== 'general').map(d => (
                <option key={d.id} value={d.id}>{isHebrew ? d.he : d.en}</option>
              ))}
            </select>
            <div style={{ fontSize: '0.72rem', color: NEON.textMuted, marginTop: '4px' }}>
              {isHebrew
                ? 'קובע רק הצעת ברירת מחדל ליחידת תמחור בפריט מקצועי חדש - ניתן תמיד לבחור יחידה אחרת בכל פריט.'
                : 'Only sets a default suggestion for a new Professional item\'s pricing unit - you can always choose a different unit on any item.'}
            </div>
          </div>
        )}

        <div id="pf-settings-business_details" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: '400', color: NEON.textSecondary, marginBottom: '3px' }}><Building2 size={13} color={NEON.sky} />{isHebrew ? 'שם העסק' : 'Business Name'}</label>
            <input type="text" value={bizName} onChange={(e) => setBizName(e.target.value)} required style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }} />
          </div>
          {/* PRODUCT_TRUTH_CAPABILITY: profile_prerequisites */}
          <div id="pf-settings-business_tax_id">
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: '400', color: NEON.textSecondary, marginBottom: '3px' }}><Hash size={13} color={NEON.amber} />{isHebrew ? 'ח.פ / עוסק מורשה / פטור' : 'Tax ID / Lic No'}</label>
            <input type="text" value={bizTaxId} onChange={(e) => setBizTaxId(e.target.value)} placeholder="516000000" style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }} />
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: '400', color: NEON.textSecondary, marginBottom: '3px' }}><Mail size={13} color={NEON.violetLight} />{isHebrew ? 'אימייל עסק' : 'Business Email'}</label>
            <input type="email" value={bizEmail} onChange={(e) => setBizEmail(e.target.value)} placeholder="business@example.com" style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }} />
          </div>

          <div id="pf-settings-business_phone">
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: '400', color: NEON.textSecondary, marginBottom: '3px' }}><Phone size={13} color={NEON.emerald} />{isHebrew ? 'טלפון עסק' : 'Business Phone'}</label>
            <div style={{ display: 'flex', flexDirection: isHebrew ? 'row-reverse' : 'row', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, overflow: 'hidden', boxSizing: 'border-box' }}>
              <div style={{ background: 'rgba(255,255,255,0.06)', padding: '7px 10px', fontSize: '0.8rem', color: NEON.textPrimary, fontWeight: '600', display: 'flex', alignItems: 'center', [isHebrew ? 'borderLeft' : 'borderRight']: `1px solid ${NEON.borderStrong}`, whiteSpace: 'nowrap' }}>
                {defaultLabel}
              </div>
              <input
                type="text"
                value={localPhone}
                onChange={(e) => handleLocalPhoneChange(e.target.value)}
                placeholder="500000000"
                style={{ flex: 1, padding: '7px 8px', border: 'none', outline: 'none', background: 'transparent', color: NEON.textPrimary, direction: 'ltr', textAlign: 'left', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: '400', color: NEON.textSecondary, marginBottom: '3px' }}>
              <Coins size={13} color={NEON.amber} />{isHebrew ? 'מטבע העסק' : 'Business Currency'}
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={isLocalIsraeliBusiness}
              style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', background: isLocalIsraeliBusiness ? 'rgba(255,255,255,0.04)' : NEON.bgInput, fontSize: '0.85rem', fontWeight: '400', color: NEON.violetLight }}
            >
              {isLocalIsraeliBusiness ? (
                <option value="ILS">ILS (₪)</option>
              ) : (
                <>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </>
              )}
            </select>
          </div>
        </div>

        <div className="pf-m-surface" style={{ background: NEON.bgCard, padding: '14px', borderRadius: '10px', border: `1px solid ${NEON.border}`, marginBottom: '16px' }}>
          <h3 style={{ fontSize: '0.85rem', color: NEON.textSecondary, fontWeight: '500', marginTop: 0, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={14} color={NEON.red} />{isHebrew ? 'כתובת העסק' : 'Business Address Details'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '400', color: NEON.textMuted, marginBottom: '2px' }}>{isHebrew ? 'רחוב ומספר' : 'Street Address'}</label>
              <input type="text" value={street} onChange={(e) => handleAddressFieldChange(e.target.value, city, stateProv, zipCode)} placeholder={isHebrew ? 'הזן כתובת רחוב ומספר' : 'e.g. 123 Main St'} style={{ width: '100%', padding: '6px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '400', color: NEON.textMuted, marginBottom: '2px' }}>{isHebrew ? 'עיר' : 'City'}</label>
              <input type="text" value={city} onChange={(e) => handleAddressFieldChange(street, e.target.value, stateProv, zipCode)} placeholder={isHebrew ? 'עיר' : 'City'} style={{ width: '100%', padding: '6px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '400', color: NEON.textMuted, marginBottom: '2px' }}>{isHebrew ? 'מדינה / מחוז (State)' : 'State / Province'}</label>
              <input type="text" value={stateProv} onChange={(e) => handleAddressFieldChange(street, city, e.target.value, zipCode)} placeholder={isHebrew ? 'מדינה/אזור' : 'State / Region'} style={{ width: '100%', padding: '6px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem', textAlign: isHebrew ? 'right' : 'left' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '400', color: NEON.textMuted, marginBottom: '2px' }}>{isHebrew ? 'מיקוד (ZIP / Postal)' : 'ZIP / Postal Code'}</label>
              <input type="text" value={zipCode} onChange={(e) => handleAddressFieldChange(street, city, stateProv, e.target.value)} placeholder="10001" style={{ width: '100%', padding: '6px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem', direction: 'ltr', textAlign: 'left' }} />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          {/* חוק ברזל (Super Admin PRO-Gate Bug, PROVEN root cause,
              PROFLOW_PROJECT_CONTEXT.md §204/§205-אזור, fixed 2026-09-08):
              שער ה-Logo בדק בעבר effectivePlan!=='pro' ישירות - משתנה גולמי
              שאין לו שום מודעות ל-role (computeEffectivePlan לוקח plan/
              trialEndsAt בלבד, לעולם לא role) ולעולם לא יכול לדעת ש-
              super_admin זכאי תמיד, וגם לא זיהה Lifetime על חשבון בסיסי-
              basic (effectivePlan מחזיר 'basic', לא 'pro', עבור Lifetime
              על plan גולמי='basic'). זהו היה השער היחיד באפליקציה שלא עבר
              דרך entitlement.* הקנוני - כל שער-חסימה אחר (attachments/
              editDuplicate/whatsappDelete/monthlyQuoteLimit) כבר עשה זאת
              נכון. עכשיו קורא ל-canUseAttachments (=entitlement.attachments
              מ-Dashboard.jsx, אותה נוסחה קנונית בדיוק כמו QuoteForm.jsx -
              כבר כוללת isSuperAdmin/isLifetime באופן מובנה, ר'
              accountEntitlement.js) - לא עוד נוסחה כפולה. */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: '400', color: NEON.textSecondary, marginBottom: '3px' }}>
            <ImageIcon size={13} color={NEON.violetLight} />{isHebrew ? 'כתובת תמונת לוגו (URL) או העלאת קובץ' : 'Logo Image URL or File Upload'} {!canUseAttachments && <span style={{ color: NEON.amber, fontSize: '0.75rem' }}>{isHebrew ? '(העלאת לוגו אינה זמינה בחשבון זה כרגע)' : '(Logo upload is not available on this account right now)'}</span>}
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="url"
              value={bizLogoUrl}
              onChange={(e) => setBizLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.svg"
              // active plan system: an external URL cannot be bound to issued documents (no URL fetch); upload a file instead
              disabled={!canUseAttachments || logoImportRequired}
              title={logoImportRequired ? (isHebrew ? 'להחלפת הלוגו העלו קובץ PNG או JPG' : 'Upload a PNG or JPG file to change the logo') : undefined}
              style={{ flex: 1, minWidth: '220px', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left', background: !canUseAttachments ? 'rgba(255,255,255,0.03)' : NEON.bgInput, color: NEON.textPrimary, fontSize: '0.85rem' }}
            />
            <label style={{ background: !canUseAttachments ? 'rgba(255,255,255,0.08)' : NEON.gradient, color: !canUseAttachments ? NEON.textMuted : 'white', padding: '7px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: !canUseAttachments ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', boxShadow: !canUseAttachments ? 'none' : NEON.glowSoft }}>
              <span>{isHebrew ? 'העלה קובץ' : 'Upload File'}</span>
              <input
                type="file"
                accept=".svg,.png,.jpg,.jpeg"
                onChange={handleLogoFileChange}
                disabled={!canUseAttachments}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          <div style={{ fontSize: '0.72rem', color: NEON.textMuted, marginTop: '4px' }}>
            {isHebrew ? 'ניתן להעלות קבצים עד משקל של 500KB ואך ורק מסוג של SVG JPG וכו\'' : 'Files up to 500KB only, formats: SVG, JPG, PNG, etc.'}
          </div>
          {logoError && (
            <div style={{ fontSize: '0.75rem', color: NEON.red, marginTop: '3px' }}>
              {logoError}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: '400', color: NEON.textSecondary, marginBottom: '3px' }}><FileText size={13} color={NEON.textSecondary} />{isHebrew ? 'תנאים כלליים ברירת מחדל להצעות חדשות' : 'Default Terms & Conditions for New Quotes'}</label>
          <textarea
            value={defaultTerms}
            onChange={(e) => setDefaultTerms(e.target.value)}
            rows="4"
            style={{ width: '100%', padding: '8px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.85rem', fontFamily: 'inherit', lineHeight: '1.4' }}
          />
        </div>

        {/* חוק ברזל (Item 23 Warranty, TEST Acceptance Package 1): שדה נפרד
            מ"תנאים כלליים" בכוונה - default_warranty הוא עמודה נפרדת
            לחלוטין מ-default_terms, לא מיזוג/הרחבה של השדה הקיים. */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: '400', color: NEON.textSecondary, marginBottom: '3px' }}><ShieldCheck size={13} color={NEON.textSecondary} />{isHebrew ? 'אחריות ברירת מחדל להצעות חדשות' : 'Default Warranty for New Quotes'}</label>
          <textarea
            value={defaultWarranty || ''}
            onChange={(e) => setDefaultWarranty(e.target.value)}
            rows="4"
            style={{ width: '100%', padding: '8px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', background: NEON.bgInput, color: NEON.textPrimary, boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.85rem', fontFamily: 'inherit', lineHeight: '1.4' }}
          />
        </div>


        {/* PRODUCT_TRUTH_CAPABILITY: business_settings */}
        <button type="submit" style={{ background: NEON.gradient, color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', boxShadow: NEON.glow }}>
          {isHebrew ? 'שמור הגדרות עסק' : 'Save Business Settings'}
        </button>
      </form>

      {/* Task 30: Settings › "My subscription" - the server account state, then the ONE all-inclusive package directly here (monthly /
          annual choice, one price = the price that would be billed, the annual saving) and the real purchase availability. No separate
          plans button and no wording that implies several paid packages. */}
      <section data-testid="settings-subscription" aria-labelledby="settings-subscription-title" style={{ marginTop: '24px', paddingTop: '20px', borderTop: `1px solid ${NEON.border}` }}>
        <h3 id="settings-subscription-title" style={{ fontSize: '0.95rem', fontWeight: '800', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', ...neonGlowTextStyle }}>
          <Shield size={16} color={NEON.violetLight} strokeWidth={2} />
          {isHebrew ? 'המנוי שלי' : 'My subscription'}
        </h3>
        <div className="pf-m-surface" style={{ background: NEON.bgCard, padding: '16px', borderRadius: '10px', border: `1px solid ${NEON.border}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
               <div style={{ background: NEON.violetLighter, color: NEON.violetLight, padding: '8px', borderRadius: '8px', display: 'flex' }}>
                 <Users size={20} strokeWidth={2} />
               </div>
               <div data-testid="settings-account-plan" data-account-state={accountState.state} style={{ minWidth: 0 }}>
                 {/* OD-16 / OD-20: plan name and Free-10 balance from the server account summary only (the balance only while Free-10 is
                     enforced); a fail-closed line with a retry when the summary cannot be trusted. */}
                 <div style={{ fontSize: '0.9rem', fontWeight: '600', color: NEON.textPrimary }}>
                   {accountState.tone === 'plan' ? `${isHebrew ? 'המסלול שלך' : 'Your plan'}: ${accountState.label}` : accountState.label}
                 </div>
                 {accountState.detail && (
                   <div data-testid="settings-account-detail" style={{ fontSize: '0.75rem', color: NEON.textSecondary }}>{accountState.detail}</div>
                 )}
               </div>
             </div>
             {accountState.retry && onRetryAccountSummary && (
               // PRODUCT_TRUTH_DECORATIVE: re-requests the server account summary; changes no data
               <button type="button" onClick={() => onRetryAccountSummary()} data-testid="settings-account-retry" style={{ background: NEON.bgCardAlt, color: NEON.textSecondary, padding: '8px 14px', minHeight: '44px', borderRadius: '8px', fontSize: '0.8rem', border: `1px solid ${NEON.borderStrong}`, cursor: 'pointer', fontWeight: '600' }}>
                 {isHebrew ? 'טעינה מחדש' : 'Reload'}
               </button>
             )}
           </div>
           {!isSuperAdmin && !lifetimeAccount && (
             <>
               <PackageOfferCards model={subscriptionOffer} isHebrew={isHebrew} only={['all_inclusive']} currentPlanId={accountState.tone === 'plan' ? accountState.planId : null} testIdPrefix="settings-subscription" />
               <p data-testid="settings-subscription-price-note" style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: NEON.textPrimary }}>{subscriptionOffer.priceNote}</p>
               <p data-testid="settings-subscription-availability" role="status" style={{ margin: 0, fontSize: '0.8rem', color: NEON.textSecondary }}>{subscriptionOffer.availability}</p>
             </>
           )}
        </div>
      </section>
      </div>
    </div>
  );
}
