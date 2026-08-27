import { useState } from 'react';
import { Package, Pencil, Trash2, Save, X, Search } from 'lucide-react';
import { LIGHT as NEON, lightHeadingTextStyle as neonGlowTextStyle } from './../theme/neonTheme';

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

  return (
    <div style={{ background: NEON.bgCard, padding: '14px', borderRadius: '14px', border: `1px solid ${NEON.border}` }}>
      <h2 style={{ fontSize: '1rem', fontWeight: '800', margin: 0, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', ...neonGlowTextStyle }}>
        <Package size={18} color={NEON.violetLight} strokeWidth={2.2} />
        {t.servicesCatalog}
      </h2>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <form onSubmit={handleAddService} style={{ display: 'flex', gap: '6px', flexDirection: 'row', flexWrap: 'wrap', flex: '2 1 260px' }}>
          <input
            type="text"
            placeholder={t.serviceName}
            value={newServiceName}
            onChange={(e) => setNewServiceName(e.target.value)}
            required
            style={{ flex: '2 1 140px', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: NEON.bgInput, color: NEON.textPrimary }}
          />
          <input
            type="number"
            step="0.01"
            placeholder={t.defaultPrice}
            value={newServicePrice}
            onChange={(e) => setNewServicePrice(e.target.value)}
            required
            style={{ flex: '1 1 80px', padding: '7px 10px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', fontSize: '0.8rem', background: NEON.bgInput, color: NEON.textPrimary }}
          />
          <button type="submit" style={{ background: NEON.gradient, color: 'white', border: 'none', padding: '7px 14px', borderRadius: '8px', fontWeight: '600', fontSize: '0.8rem', boxShadow: NEON.glow }}>
            {t.addService}
          </button>
        </form>

        <div style={{ position: 'relative', flex: '1 1 180px', minWidth: '160px' }}>
          <Search size={14} color={NEON.textMuted} style={{ position: 'absolute', top: '50%', [isHebrew ? 'right' : 'left']: '10px', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder={isHebrew ? 'חיפוש בקטלוג...' : 'Search catalog...'}
            value={catalogSearchTerm}
            onChange={(e) => setCatalogSearchTerm(e.target.value)}
            style={{ width: '100%', padding: isHebrew ? '7px 32px 7px 10px' : '7px 10px 7px 32px', border: `1px solid ${NEON.borderStrong}`, borderRadius: '8px', boxSizing: 'border-box', textAlign: isHebrew ? 'right' : 'left', fontSize: '0.8rem', background: NEON.bgInput, color: NEON.textPrimary }}
          />
        </div>
      </div>

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
            {filteredServices.length === 0 ? (
              <tr>
                <td colSpan="3" style={{ textAlign: 'center', padding: '16px', color: NEON.textMuted, fontSize: '0.8rem' }}>
                  {services.length === 0
                    ? (isHebrew ? 'הקטלוג ריק. הוסף שירותים למעלה.' : 'Your catalog is empty. Add services above.')
                    : (isHebrew ? 'לא נמצאו פריטים תואמים לחיפוש.' : 'No catalog items match your search.')}
                </td>
              </tr>
            ) : (
              filteredServices.map((svc) => {
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
                          <button
                            title={t.delete}
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
              })
            )}
          </tbody>
         </table>
      </div>
    </div>
  );
}
