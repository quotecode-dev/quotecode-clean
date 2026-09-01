import { LIGHT, FONT_HE } from '../theme/neonTheme';
import { formatMoney } from '../utils/money';

// David Aluminum demo only. Renders one classified quote item as an
// OLD (today's simple description/qty/price row) vs NEW (professional
// presentation) comparison. Every number shown comes from the real,
// already-persisted quote_items row and, when present, the real notes-derived
// measurements - nothing here is fabricated or editable; this is a read-only
// preview, never a write path.

const KIND_LABEL = { simple: 'פשוט', measured: 'נמדד', repeating: 'מדידות חוזרות' };
const KIND_COLOR = { simple: LIGHT.textMuted, measured: LIGHT.violet, emerald: LIGHT.emerald };

// AUDIT-001 (PROFLOW_PROJECT_CONTEXT.md §128/§131): delegates to the
// canonical formatMoney instead of an independent local reimplementation -
// same fix pattern as CustomerQuoteItemRow.jsx/ProfessionalPublicPreview.jsx.
function money(n) {
  return <span className="pf-money">₪{formatMoney(n)}</span>;
}

export default function ProfessionalItemComparisonCard({ item }) {
  const isMeasuredOrRepeating = item.kind === 'measured' || item.kind === 'repeating';
  const badgeColor = item.kind === 'simple' ? LIGHT.textMuted : LIGHT.emerald;

  return (
    <div
      dir="rtl"
      style={{
        fontFamily: FONT_HE,
        background: LIGHT.bgCard,
        border: `1px solid ${LIGHT.border}`,
        borderRadius: '14px',
        padding: '16px 18px',
        marginBottom: '14px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div style={{ fontWeight: '700', fontSize: '0.95rem', color: LIGHT.textPrimary }}>{item.description.trim()}</div>
        <span
          style={{
            fontSize: '0.66rem', fontWeight: '700', padding: '3px 9px', borderRadius: '999px',
            background: item.kind === 'simple' ? LIGHT.bgCardAlt : LIGHT.violetLighter,
            color: badgeColor, whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          {KIND_LABEL[item.kind]}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
        {/* OLD */}
        <div style={{ flex: '1 1 220px', minWidth: '220px' }}>
          <div style={{ fontSize: '0.66rem', fontWeight: '700', color: LIGHT.textMuted, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            כפי שמופיע היום
          </div>
          <div style={{ fontSize: '0.82rem', color: LIGHT.textSecondary }}>
            {item.quantity} × {money(item.unit_price)}
          </div>
          <div style={{ fontWeight: '700', color: LIGHT.textPrimary, marginTop: '2px' }}>{money(item.total_price)}</div>
        </div>

        {/* NEW */}
        <div style={{ flex: '1 1 220px', minWidth: '220px', borderInlineStart: `1px dashed ${LIGHT.border}`, paddingInlineStart: '14px' }}>
          <div style={{ fontSize: '0.66rem', fontWeight: '700', color: LIGHT.violet, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            בחוויה החדשה
          </div>
          {!isMeasuredOrRepeating ? (
            <div style={{ fontSize: '0.8rem', color: LIGHT.textSecondary }}>
              נשאר בדיוק כמו היום — פריט פשוט, ללא נתוני מידה בהצעה המקורית.
            </div>
          ) : (
            <>
              {item.measurements.map((m, i) => (
                <div key={i} style={{ fontSize: '0.78rem', color: LIGHT.textSecondary, fontFamily: 'monospace', marginBottom: '2px' }}>
                  {m.width}×{m.height} ס״מ ← <span style={{ color: LIGHT.emerald, fontWeight: '700' }}>{m.area_m2} מ״ר</span>
                </div>
              ))}
              {item.kind === 'repeating' && (
                <div style={{ fontSize: '0.72rem', color: LIGHT.textMuted, marginTop: '4px' }}>
                  {item.measurements.length} שורות מידה · סה״כ {item.totalArea_m2} מ״ר
                </div>
              )}
              <div style={{ fontSize: '0.72rem', color: LIGHT.textMuted, marginTop: '6px' }}>
                תמחור: {money(item.unit_price)} ליחידה (ללא שינוי מהמקור — המידות הן נתון מפרט, לא בסיס תמחור)
              </div>
              <div style={{ fontWeight: '700', color: LIGHT.textPrimary, marginTop: '4px' }}>{money(item.total_price)}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
