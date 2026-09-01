import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { LIGHT, FONT_HE } from '../theme/neonTheme';
import { buildCustomerFriendlySpec, buildCompactSummary } from '../utils/customerFriendlySpec';

// David Aluminum demo only - customer-facing item row, three presentation
// variants (A/B/C) plus 'current' (today's plain row, for baseline
// comparison). Never recalculates price/quantity/total - always the item's
// own real, unmodified values.

function money(n) {
  return `₪${Number(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CustomerQuoteItemRow({ item, variant, index, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const { summary, detailRows } = buildCustomerFriendlySpec(item);
  const compactSummary = buildCompactSummary(item);

  // CURRENT: exactly today's real Public Quote table row - description,
  // quantity, unit price, total. No specification of any kind.
  if (variant === 'current') {
    return (
      <tr style={{ borderBottom: `1px solid ${LIGHT.border}` }}>
        <td style={{ padding: '10px 6px', textAlign: 'right' }}>{item.description.trim()}</td>
        <td style={{ padding: '10px 6px', textAlign: 'center' }}>{item.quantity}</td>
        <td style={{ padding: '10px 6px', textAlign: 'center' }}>{money(item.unit_price)}</td>
        <td style={{ padding: '10px 6px', textAlign: 'left', fontWeight: '700' }}>{money(item.total_price)}</td>
      </tr>
    );
  }

  const cardStyle = {
    background: LIGHT.bgCard,
    border: `1px solid ${LIGHT.border}`,
    borderRadius: '12px',
    padding: '14px 16px',
    marginBottom: '10px',
  };

  // A — CLEAN / PREMIUM: name, qty (if meaningful), price, one concise spec line.
  if (variant === 'A') {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: LIGHT.textPrimary }}>{item.description.trim()}</div>
            {summary && <div style={{ fontSize: '0.78rem', color: LIGHT.textMuted, marginTop: '3px' }}>{summary}</div>}
            {item.quantity > 1 && <div style={{ fontSize: '0.72rem', color: LIGHT.textMuted, marginTop: '2px' }}>{item.quantity} יחידות</div>}
          </div>
          <div style={{ fontWeight: '800', fontSize: '1rem', color: LIGHT.textPrimary, whiteSpace: 'nowrap' }}>{money(item.total_price)}</div>
        </div>
      </div>
    );
  }

  // B — COLLAPSIBLE: clean summary by default, "פירוט מידות ומפרט" reveals real rows.
  if (variant === 'B') {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: LIGHT.textPrimary }}>{item.description.trim()}</div>
            {summary && <div style={{ fontSize: '0.78rem', color: LIGHT.textMuted, marginTop: '3px' }}>{summary}</div>}
          </div>
          <div style={{ fontWeight: '800', fontSize: '1rem', color: LIGHT.textPrimary, whiteSpace: 'nowrap' }}>{money(item.total_price)}</div>
        </div>
        {detailRows.length > 0 && (
          <>
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none',
                color: LIGHT.violet, fontFamily: FONT_HE, fontWeight: '600', fontSize: '0.78rem',
                cursor: 'pointer', padding: '8px 0 0', marginTop: '6px',
              }}
            >
              <ChevronDown size={14} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              {expanded ? 'הסתר פירוט' : 'פירוט מידות ומפרט'}
            </button>
            {expanded && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px dashed ${LIGHT.border}` }}>
                {detailRows.map((row, i) => (
                  <div key={i} style={{ fontSize: '0.78rem', color: LIGHT.textSecondary, padding: '3px 0', fontFamily: 'monospace' }}>{row}</div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // B+ — COMPACT PROFESSIONAL DOCUMENT: B's same collapsed-summary /
  // expand-on-demand mechanic, but rendered as one dense row within a single
  // continuous document (no per-item card/border/gap) with subtle sequential
  // numbering. Caller wraps all rows in one shared bordered container and
  // passes `isLast` to suppress the final divider.
  if (variant === 'B+') {
    return (
      <div style={{ padding: '9px 12px', borderBottom: isLast ? 'none' : `1px solid ${LIGHT.border}` }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: '700', color: LIGHT.textMuted, minWidth: '18px', paddingTop: '2px', fontFamily: 'monospace' }}>
            {String(index + 1).padStart(2, '0')}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: '700', fontSize: '0.88rem', color: LIGHT.textPrimary }}>{item.description.trim()}</div>
            {compactSummary && <div style={{ fontSize: '0.74rem', color: LIGHT.textMuted, marginTop: '1px' }}>{compactSummary}</div>}
          </div>
          <div style={{ fontWeight: '800', fontSize: '0.92rem', color: LIGHT.textPrimary, whiteSpace: 'nowrap' }}>{money(item.total_price)}</div>
        </div>
        {detailRows.length > 0 && (
          <div style={{ marginInlineStart: '28px' }}>
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '3px', background: 'none', border: 'none',
                color: LIGHT.violet, fontFamily: FONT_HE, fontWeight: '600', fontSize: '0.72rem',
                cursor: 'pointer', padding: '5px 0 0', marginTop: '2px',
              }}
            >
              <ChevronDown size={12} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              {expanded ? 'הסתר פירוט' : 'פירוט מידות ומפרט'}
            </button>
            {expanded && (
              <div style={{ marginTop: '5px', paddingBottom: '2px' }}>
                {detailRows.map((row, i) => (
                  <div key={i} style={{ fontSize: '0.72rem', color: LIGHT.textSecondary, padding: '2px 0', fontFamily: 'monospace' }}>{row}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // C — PROFESSIONAL / TRANSPARENT: spec shown inline, always visible, styled as
  // a documented scope rather than a spreadsheet.
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: detailRows.length ? '10px' : 0 }}>
        <div style={{ fontWeight: '700', fontSize: '0.95rem', color: LIGHT.textPrimary }}>{item.description.trim()}</div>
        <div style={{ fontWeight: '800', fontSize: '1rem', color: LIGHT.textPrimary, whiteSpace: 'nowrap' }}>{money(item.total_price)}</div>
      </div>
      {detailRows.length > 0 && (
        <div style={{ background: LIGHT.bgCardAlt, borderRadius: '8px', padding: '8px 12px' }}>
          <div style={{ fontSize: '0.68rem', fontWeight: '700', color: LIGHT.violet, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            היקף העבודה
          </div>
          {detailRows.map((row, i) => (
            <div key={i} style={{ fontSize: '0.78rem', color: LIGHT.textSecondary, padding: '2px 0' }}>{row}</div>
          ))}
        </div>
      )}
    </div>
  );
}
