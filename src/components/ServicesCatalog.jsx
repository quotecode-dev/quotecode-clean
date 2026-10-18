import { useRef, useState } from 'react';
import { Package, PackagePlus, Pencil, Trash2, Save, X, Search, Image as ImageIcon, Lock } from 'lucide-react';
import { APP as NEON, lightHeadingTextStyle as neonGlowTextStyle, RADIUS, SHADOW } from './../theme/neonTheme';
import CatalogMediaControl from './quotePresentation/CatalogMediaControl';
import { catalogLinkFor } from './quotePresentation/useQuotePresentationEditor';
import { presentationCopy } from './quotePresentation/presentationCopy';
import { CAPABILITIES, decideCapability } from '../../supabase/functions/_shared/subscriptionContract.ts';
import './servicesCatalog.css';

const CATALOG_IMAGE_CAPABILITY = 'catalog_product_image.upload';

// PRODUCT_TRUTH_CAPABILITY: catalog
export default function ServicesCatalog({
  t,
  isHebrew,
  newServiceName,
  setNewServiceName,
  newServicePrice,
  setNewServicePrice,
  handleAddService,
  services,
  editingServiceId,
  setEditingServiceId,
  editServiceName,
  setEditServiceName,
  editServicePrice,
  setEditServicePrice,
  handleSaveEditedService,
  handleDeleteService,
  sym,
  formatMoneyDisplay,
  // Task 16: presentation controller (catalog images). Absent => no image controls.
  presentationController = null,
  // OD-17/OD-18 (subscriptions cross-cut): catalog product image gate. The parent passes the account-summary object
  // (useAccountSummary().summary, or undefined), the account's pre-existing legacy capabilities as explicit booleans
  // (e.g. { 'catalog_product_image.upload': true }) and opens CapabilityUpgradeNotice through onLockedCapability.
  accountSummary,
  legacyCapabilities,
  onLockedCapability,
}) {
  // חוק ברזל: החיפוש הוא סינון client-side בלבד על הנתונים שכבר נטענו
  // (services), ללא כל פנייה נוספת למסד הנתונים ובלי לשנות סכימה. מודל
  // הנתונים הנוכחי של הקטלוג כולל אך ורק name ו-price - אין שדה description
  // אמיתי (הכותרת t.description בטבלה היא תווית מחרוזת שאינה תואמת שדה
  // ממשי) - החיפוש בודק אפוא רק name, השדה הטקסטואלי הבטוח היחיד שקיים בפועל.
  const [catalogSearchTerm, setCatalogSearchTerm] = useState('');
  const normalizedSearch = catalogSearchTerm.trim().toLowerCase();
  const filteredServices = normalizedSearch
    ? services.filter((svc) => (svc.name || '').toLowerCase().includes(normalizedSearch))
    : services;

  // חוק ברזל (Consolidated Open UI Corrections task, §H2/§H3): שדות
  // היצירה (newServiceName/newServicePrice, ה-state הקיימים כבר ב-
  // Dashboard.jsx, ללא שינוי) לא נשארים מוצגים-לצמיתות לצד החיפוש - הם
  // עוברים ל-drawer/מודל שנפתח ע"י כפתור "הוסף פריט"/"Add Item" ראשי
  // אחד. state מקומי טהור לפתיחה/סגירה - handleAddService (הקיים) עדיין
  // מבצע את היצירה בפועל; רק העטיפה החזותית סביבו השתנתה.
  const [showAddForm, setShowAddForm] = useState(false);
  // Task 16: which catalog row has its image controls open (UI-only)
  const [imageRowId, setImageRowId] = useState(null);
  // OD-18: which row shows the local "not included" explanation (only when no parent notice handler exists)
  const [lockedRowId, setLockedRowId] = useState(null);
  const lastKeyActivation = useRef(0);
  const pcopy = presentationCopy(isHebrew ? 'he' : 'en');
  const lang = isHebrew ? 'he' : 'en';
  const dir = isHebrew ? 'rtl' : 'ltr';

  // OD-17/OD-18: one decision rule (shared contract). Locked => the image action stays visible and focusable, but it never
  // opens the image controls, never opens a file picker and never calls an upload/link function.
  const imageDecision = decideCapability(accountSummary, CATALOG_IMAGE_CAPABILITY, legacyCapabilities?.[CATALOG_IMAGE_CAPABILITY]);
  const imageAllowed = imageDecision.allowed === true;
  const imageCapability = CAPABILITIES[CATALOG_IMAGE_CAPABILITY];

  const activateImageAction = (svc) => {
    if (!imageAllowed) {
      setImageRowId(null);
      if (typeof onLockedCapability === 'function') onLockedCapability(CATALOG_IMAGE_CAPABILITY);
      else setLockedRowId((cur) => (cur === svc.id ? null : svc.id));
      return;
    }
    setImageRowId((cur) => (cur === svc.id ? null : svc.id));
  };
  // Enter/Space are handled explicitly (deterministic, one activation); a keyboard-synthesized click that may follow a
  // handled key press (detail 0, same gesture) is ignored, while assistive-technology clicks without a key press still work.
  const onImageKeyDown = (e, svc) => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    e.preventDefault();
    lastKeyActivation.current = Date.now();
    activateImageAction(svc);
  };
  const onImageClick = (e, svc) => {
    if (e.detail === 0 && Date.now() - lastKeyActivation.current < 500) return;
    activateImageAction(svc);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    handleAddService(e);
    setShowAddForm(false);
  };

  // Theme tokens for the scoped catalog stylesheet (servicesCatalog.css) - the catalog region only, no global reskin.
  const catalogVars = {
    '--svc-border': NEON.border,
    '--svc-border-strong': NEON.borderStrong,
    '--svc-text': NEON.textPrimary,
    '--svc-text-secondary': NEON.textSecondary,
    '--svc-muted': NEON.textMuted,
    '--svc-price': NEON.violetLight,
    '--svc-accent': NEON.violetLight,
    '--svc-accent-bg': NEON.violetLighter,
    '--svc-btn-bg': NEON.bgCardAlt,
    '--svc-input-bg': NEON.bgInput,
    '--svc-danger': NEON.red,
    '--svc-save': NEON.emeraldDark,
    '--svc-focus': NEON.violet,
  };

  return (
    <div className="pf-screen pf-work-screen" style={{ background: NEON.bgCard, padding: '18px', borderRadius: RADIUS.lg, border: 'none', boxShadow: SHADOW.sm }}>
      {/* חוק ברזל (§H1): כותרת ברורה - "קטלוג שירותים ומוצרים"/"Services &
          Products Catalog" (הספק המדויק של המשימה). */}
      <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', ...neonGlowTextStyle }}>
        <Package size={18} color={NEON.violetLight} strokeWidth={2.2} />
        {isHebrew ? 'קטלוג שירותים ומוצרים' : 'Services & Products Catalog'}
      </h2>

      {/* חוק ברזל (§H2): שורת-כלים ברירת-מחדל - חיפוש רחב + כפתור-פעולה
          ראשי אחד בלבד ("הוסף פריט"/"Add Item", סגול) - לא עוד שדות-יצירה
          קבועים מעורבים עם החיפוש. */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '160px' }}>
          <Search size={14} color={NEON.textMuted} style={{ position: 'absolute', top: '50%', [isHebrew ? 'right' : 'left']: '10px', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder={isHebrew ? 'חיפוש בקטלוג...' : 'Search catalog...'}
            value={catalogSearchTerm}
            onChange={(e) => setCatalogSearchTerm(e.target.value)}
            style={{ width: '100%', padding: isHebrew ? '8px 32px 8px 12px' : '8px 12px 8px 32px', border: `1px solid ${NEON.borderStrong}`, borderRadius: RADIUS.sm, boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: NEON.bgInput, color: NEON.textPrimary }}
          />
        </div>
        {/* PRODUCT_TRUTH_CAPABILITY: catalog */}
        <button
          type="button"
          onClick={() => setShowAddForm((prev) => !prev)}
          aria-expanded={showAddForm}
          style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', background: NEON.gradient, color: 'white', border: 'none', padding: '8px 14px', borderRadius: RADIUS.sm, cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem', boxShadow: NEON.glowSoft }}
        >
          <PackagePlus size={15} strokeWidth={2.4} />
          {isHebrew ? 'הוסף פריט' : 'Add Item'}
        </button>
      </div>

      {/* חוק ברזל (§H3): "Add Item opens a deliberate inline row... Save/
          Cancel" - name+price (שני השדות הממשיים היחידים הקיימים במודל-
          הנתונים - אין שדה description אמיתי, ר' ההערה למעלה, ולכן לא
          מוצג כאן שדה בדוי) + Save/Cancel על שורה אחת יחד, לא שדה תלוש
          לבדו על שורה שנייה נפרדת. */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end', background: NEON.bgCardAlt, border: `1px solid ${NEON.border}`, borderRadius: RADIUS.sm, padding: '12px', marginBottom: '14px' }}>
          <div style={{ flex: '2 1 160px' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: NEON.textSecondary, marginBottom: '4px' }}>{t.serviceName}</label>
            <input
              type="text"
              placeholder={t.serviceName}
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              required
              autoFocus
              style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: RADIUS.sm, boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: NEON.bgInput, color: NEON.textPrimary }}
            />
          </div>
          <div style={{ flex: '1 1 100px' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: NEON.textSecondary, marginBottom: '4px' }}>{t.defaultPrice}</label>
            <input
              type="number"
              step="0.01"
              placeholder={t.defaultPrice}
              value={newServicePrice}
              onChange={(e) => setNewServicePrice(e.target.value)}
              required
              style={{ width: '100%', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: RADIUS.sm, boxSizing: 'border-box', fontSize: '0.8rem', background: NEON.bgInput, color: NEON.textPrimary }}
            />
          </div>
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
            {/* PRODUCT_TRUTH_CAPABILITY: catalog */}
            <button type="submit" style={{ background: NEON.gradient, color: 'white', border: 'none', padding: '8px 16px', borderRadius: RADIUS.sm, fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', boxShadow: NEON.glowSoft }}>
              {isHebrew ? 'שמור' : 'Save'}
            </button>
            {/* PRODUCT_TRUTH_DECORATIVE: cancels/closes the inline 'Add Item' form without saving */}
            <button type="button" onClick={() => setShowAddForm(false)} style={{ background: NEON.bgCardAlt, color: NEON.textSecondary, border: `1px solid ${NEON.borderStrong}`, padding: '8px 16px', borderRadius: RADIUS.sm, fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}>
              {isHebrew ? 'ביטול' : 'Cancel'}
            </button>
          </div>
        </form>
      )}

      {/* חוק ברזל (§H4/§H5): ניהול-פריטים-קיימים ברשימה נקייה מתחת; מצב-ריק
          מכוון (לא רק שורת-טקסט בתוך רשימה ריקה) כשאין פריטים כלל; רשימה
          קצרה לא נמתחת באופן מלאכותי. */}
      {filteredServices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px', color: NEON.textMuted, fontSize: '0.85rem', border: `1px dashed ${NEON.border}`, borderRadius: RADIUS.sm }}>
          <Package size={28} color={NEON.textMuted} strokeWidth={1.5} style={{ marginBottom: '8px', opacity: 0.6 }} />
          <div>
            {services.length === 0
              ? (isHebrew ? 'הקטלוג ריק. הוסף שירותים ומוצרים כדי להתחיל.' : 'Your catalog is empty. Add services or products to get started.')
              : (isHebrew ? 'לא נמצאו פריטים תואמים לחיפוש.' : 'No catalog items match your search.')}
          </div>
        </div>
      ) : (
        <>
        {/* OD-19 compact catalog: ONE deterministic CSS grid (servicesCatalog.css) shared by the static column header and
            every row - description | price (tabular numerals, end-aligned on one axis) | one consolidated actions area
            (44x44 targets). The header is visual only; every row carries its own accessible names. */}
        <div className="pf-head-gutter">
          <div className="svc-cat-cq" dir={dir} style={catalogVars}>
            <div className="svc-cat-grid svc-cat-head" aria-hidden="true">
              <span className="svc-cat-desc">{t.description}</span>
              <span className="svc-cat-price">{t.defaultPrice}</span>
              <span className="svc-cat-actions">{t.actions}</span>
            </div>
          </div>
        </div>
        <div className="pf-screen-body pf-screen-body--track">
          <ul className="svc-cat-list svc-cat-cq" dir={dir} style={catalogVars} aria-label={isHebrew ? 'פריטי הקטלוג' : 'Catalog items'} data-testid="catalog-list">
            {filteredServices.map((svc) => {
              const isEditingThisSvc = editingServiceId === svc.id;
              const hasImage = !!(presentationController && catalogLinkFor(presentationController.context.catalog, svc.id));
              const name = svc.name || '';
              const note = typeof svc.description === 'string' && svc.description.trim() ? svc.description.trim() : null;
              const imageLabel = imageAllowed
                ? pcopy.catalogImageTitle(name)
                : `${pcopy.catalogImageTitle(name)} (${isHebrew ? 'לא כלול' : 'not included'})`;
              return (
                <li key={svc.id} className="svc-cat-item" data-testid={`catalog-row-${svc.id}`}>
                  <div className="svc-cat-grid svc-cat-row">
                    <div className="svc-cat-desc">
                      {isEditingThisSvc ? (
                        <input
                          type="text"
                          className="svc-cat-input"
                          aria-label={t.serviceName}
                          value={editServiceName}
                          onChange={(e) => setEditServiceName(e.target.value)}
                        />
                      ) : (
                        <>
                          <span className="svc-cat-name" dir="auto">{name}</span>
                          {note && <span className="svc-cat-note" dir="auto">{note}</span>}
                        </>
                      )}
                    </div>
                    <div className="svc-cat-price">
                      {isEditingThisSvc ? (
                        <input
                          type="number"
                          step="0.01"
                          className="svc-cat-input svc-cat-input--price"
                          aria-label={t.defaultPrice}
                          value={editServicePrice}
                          onChange={(e) => setEditServicePrice(e.target.value)}
                        />
                      ) : (
                        <>
                          <span className="sr-only">{t.defaultPrice}: </span>
                          <span className="svc-cat-money" dir="ltr" data-testid={`catalog-price-${svc.id}`}>{`${sym}${formatMoneyDisplay(svc.price)}`}</span>
                        </>
                      )}
                    </div>
                    <div className="svc-cat-actions" role="group" aria-label={isHebrew ? `פעולות עבור ${name}` : `Actions for ${name}`}>
                      {isEditingThisSvc ? (
                        <>
                          {/* PRODUCT_TRUTH_CAPABILITY: catalog */}
                          <button
                            type="button"
                            className="svc-cat-btn svc-cat-btn--save"
                            aria-label={isHebrew ? `שמור את ${name}` : `Save ${name}`}
                            title={isHebrew ? 'שמור' : 'Save'}
                            onClick={() => handleSaveEditedService(svc.id)}
                          >
                            <Save size={18} strokeWidth={2.4} aria-hidden="true" />
                          </button>
                          {/* PRODUCT_TRUTH_DECORATIVE: cancels an in-progress inline edit of a catalog row without saving */}
                          <button
                            type="button"
                            className="svc-cat-btn"
                            aria-label={isHebrew ? `בטל עריכה של ${name}` : `Cancel editing ${name}`}
                            title={isHebrew ? 'ביטול' : 'Cancel'}
                            onClick={() => setEditingServiceId(null)}
                          >
                            <X size={18} strokeWidth={2.4} aria-hidden="true" />
                          </button>
                        </>
                      ) : (
                        <>
                          {/* PRODUCT_TRUTH_CAPABILITY: catalog */}
                          <button
                            type="button"
                            className="svc-cat-btn"
                            aria-label={isHebrew ? `ערוך את ${name}` : `Edit ${name}`}
                            title={isHebrew ? 'ערוך' : 'Edit'}
                            data-testid={`catalog-edit-${svc.id}`}
                            onClick={() => {
                              setEditingServiceId(svc.id);
                              setEditServiceName(svc.name);
                              setEditServicePrice(svc.price);
                            }}
                          >
                            <Pencil size={18} strokeWidth={2.4} aria-hidden="true" />
                          </button>
                          {/* חוק ברזל (§K): תווית נקודתית-לקטלוג ("מחק פריט"/"Delete item"), לא t.delete הגלובלי. */}
                          {/* PRODUCT_TRUTH_CAPABILITY: catalog */}
                          <button
                            type="button"
                            className="svc-cat-btn svc-cat-btn--danger"
                            aria-label={isHebrew ? `מחק פריט: ${name}` : `Delete item: ${name}`}
                            title={isHebrew ? 'מחק פריט' : 'Delete item'}
                            data-testid={`catalog-delete-${svc.id}`}
                            onClick={() => handleDeleteService(svc.id, svc.name)}
                          >
                            <Trash2 size={18} strokeWidth={2.4} aria-hidden="true" />
                          </button>
                          {presentationController && (
                            // PRODUCT_TRUTH_DECORATIVE: shows/hides this catalog row's image controls, or (OD-18, not included) opens the parent's capability notice - the attach/unlink actions inside carry the catalog marker
                            <button
                              type="button"
                              className={`svc-cat-btn${imageAllowed && hasImage ? ' is-active' : ''}${imageAllowed ? '' : ' is-locked'}`}
                              aria-label={imageLabel}
                              title={imageLabel}
                              aria-expanded={imageAllowed ? imageRowId === svc.id : undefined}
                              aria-haspopup={!imageAllowed && typeof onLockedCapability === 'function' ? 'dialog' : undefined}
                              data-locked={imageAllowed ? undefined : 'true'}
                              onKeyDown={(e) => onImageKeyDown(e, svc)}
                              onClick={(e) => onImageClick(e, svc)}
                              data-testid={`catalog-image-toggle-${svc.id}`}
                            >
                              <ImageIcon size={18} strokeWidth={2.4} aria-hidden="true" />
                              {!imageAllowed && <Lock className="svc-cat-lock" size={11} strokeWidth={2.6} aria-hidden="true" />}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {presentationController && imageAllowed && imageRowId === svc.id && (
                    <div className="svc-cat-panel">
                      <CatalogMediaControl ctl={presentationController} service={svc} />
                    </div>
                  )}
                  {!imageAllowed && lockedRowId === svc.id && typeof onLockedCapability !== 'function' && (
                    <p className="svc-cat-locked-msg" role="status" data-testid={`catalog-image-locked-${svc.id}`}>
                      {`${imageCapability.label[lang]}: ${isHebrew ? 'לא כלול כרגע בחשבון שלך. לא בוצע שום שינוי.' : 'not included in your account right now. Nothing was changed.'}`}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        </>
      )}
    </div>
  );
}
