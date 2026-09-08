import { useState } from 'react';
import { Package, PackagePlus, Pencil, Trash2, Save, X, Search } from 'lucide-react';
import { LIGHT as NEON, lightHeadingTextStyle as neonGlowTextStyle, RADIUS, SHADOW } from './../theme/neonTheme';

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
  formatNum
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

  const handleAddSubmit = (e) => {
    e.preventDefault();
    handleAddService(e);
    setShowAddForm(false);
  };

  return (
    <div style={{ background: NEON.bgCard, padding: '18px', borderRadius: RADIUS.lg, border: 'none', boxShadow: SHADOW.sm }}>
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
            <button type="submit" style={{ background: NEON.gradient, color: 'white', border: 'none', padding: '8px 16px', borderRadius: RADIUS.sm, fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', boxShadow: NEON.glowSoft }}>
              {isHebrew ? 'שמור' : 'Save'}
            </button>
            <button type="button" onClick={() => setShowAddForm(false)} style={{ background: NEON.bgCardAlt, color: NEON.textSecondary, border: `1px solid ${NEON.borderStrong}`, padding: '8px 16px', borderRadius: RADIUS.sm, fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}>
              {isHebrew ? 'ביטול' : 'Cancel'}
            </button>
          </div>
        </form>
      )}

      {/* חוק ברזל (§H4/§H5): ניהול-פריטים-קיימים בטבלה נקייה מתחת; מצב-ריק
          מכוון (לא רק שורת-טקסט בתוך טבלה ריקה) כשאין פריטים כלל; רשימה
          קצרה לא נמתחת באופן מלאכותי (הטבלה עצמה ממילא לא כופה גובה). */}
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
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isHebrew ? 'right' : 'left', minWidth: '320px' }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${NEON.border}`, color: NEON.textSecondary, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '6px' }}>{t.description}</th>
                <th style={{ padding: '6px' }}>{t.defaultPrice}</th>
                <th style={{ padding: '6px' }}>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.map((svc) => {
                const isEditingThisSvc = editingServiceId === svc.id;
                return (
                  <tr key={svc.id} style={{ borderBottom: `1px solid ${NEON.border}`, fontSize: '0.8rem' }}>
                    <td style={{ padding: '8px 6px', fontWeight: '400', color: NEON.textPrimary }}>
                      {isEditingThisSvc ? (
                        <input
                          type="text"
                          value={editServiceName}
                          onChange={(e) => setEditServiceName(e.target.value)}
                          style={{ padding: '4px 8px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', width: '100%', fontSize: '0.8rem', background: NEON.bgInput, color: NEON.textPrimary }}
                        />
                      ) : (
                        svc.name
                      )}
                    </td>
                    <td style={{ padding: '8px 6px', color: NEON.violetLight, fontWeight: '400' }}>
                      {isEditingThisSvc ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editServicePrice}
                          onChange={(e) => setEditServicePrice(e.target.value)}
                          style={{ padding: '4px 8px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '6px', width: '100px', fontSize: '0.8rem', background: NEON.bgInput, color: NEON.textPrimary }}
                        />
                      ) : (
                        `${sym}${formatNum(svc.price)}`
                      )}
                    </td>
                    <td style={{ padding: '8px 6px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {isEditingThisSvc ? (
                        <>
                          <button
                            onClick={() => handleSaveEditedService(svc.id)}
                            style={{ background: NEON.emeraldDark, color: 'white', border: 'none', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          >
                            <Save size={11} strokeWidth={2.5} />
                            {isHebrew ? 'שמור' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingServiceId(null)}
                            style={{ background: 'rgba(255,255,255,0.06)', color: NEON.textSecondary, border: `1px solid ${NEON.borderStrong}`, padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          >
                            <X size={11} strokeWidth={2.5} />
                            {isHebrew ? 'ביטול' : 'Cancel'}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingServiceId(svc.id);
                              setEditServiceName(svc.name);
                              setEditServicePrice(svc.price);
                            }}
                            style={{ background: 'rgba(139, 92, 246, 0.15)', color: NEON.violetLight, border: 'none', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          >
                            <Pencil size={11} strokeWidth={2.5} />
                            {isHebrew ? 'ערוך' : 'Edit'}
                          </button>
                          {/* חוק ברזל (§K - Shared Design-Language Check, real
                              defect found+fixed): title היה t.delete הגלובלי
                              ("מחק הצעה"/"Delete Quote") - אותה תקלה כמו זו
                              שכבר תוקנה ב-ClientsTab.jsx, כאן על פריט-קטלוג.
                              תוקן לתווית נקודתית-לקטלוג. */}
                          <button
                            title={isHebrew ? 'מחק פריט' : 'Delete item'}
                            onClick={() => handleDeleteService(svc.id, svc.name)}
                            style={{ background: 'rgba(239, 68, 68, 0.15)', color: NEON.red, border: 'none', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '400', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          >
                            <Trash2 size={11} strokeWidth={2.5} />
                            {isHebrew ? 'מחק' : 'Delete'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
