import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { LIGHT, FONT_HE } from '../theme/neonTheme';
import { buildCustomerFriendlySpec, buildCompactSummary } from '../utils/customerFriendlySpec';
import { formatMoney } from '../utils/money';

// David Aluminum demo only - customer-facing item row, three presentation
// variants (A/B/C) plus 'current' (today's plain row, for baseline
// comparison). Never recalculates price/quantity/total - always the item's
// own real, unmodified values.

// AUDIT-001 (PROFLOW_PROJECT_CONTEXT.md §128/§131): delegates to the
// canonical formatMoney rather than a local re-implementation (matches the
// existing Dashboard.jsx/PublicQuoteEn.jsx thin-wrapper convention, §44.B).
// Returns a real <span className="pf-money"> element (LTR digit order +
// tabular-nums + bidi isolation), not a plain string - every call site below
// gets correct digit rendering for free without its own JSX wrapper.
function money(n) {
  return <span className="pf-money">₪{formatMoney(n)}</span>;
}

// AUDIT-004: a shared, fixed-width, right-anchored money column used at
// every repeated-row money site below - sized to comfortably fit David's
// real representative range (₪550.00-₪10,000.00) with headroom, per the
// established "size to the realistic range, not a padded worst-case" lesson
// (PROFLOW_PROJECT_CONTEXT.md §83). Because every row uses the identical
// literal width (never per-row computed), sibling rows' money boxes are
// byte-identical in width and right edge by construction, regardless of
// content length - this is the deterministic-geometry requirement, not a
// per-value nudge.
const MONEY_COL_WIDTH = '92px';

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
        {/* AUDIT-003: money always right-anchors regardless of language
            (§44.D item 2) - was textAlign:'left' on total_price (wrong,
            hardcoded) and 'center' on unit_price (not the money contract's
            anchor either); both fixed to 'right', unconditional. A native
            <table> column already gives every row in this column the same
            rendered width automatically (§44.D item 3's own named ideal
            case) - no extra fixed-width box needed here. */}
        <td style={{ padding: '10px 6px', textAlign: 'right' }}>{money(item.unit_price)}</td>
        <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: '700' }}>{money(item.total_price)}</td>
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
  // AUDIT-002/004: replaced justifyContent:'space-between' (the historical
  // "wrong-edge-under-RTL" anti-pattern, §44.D item 3) with flex:'1 1 auto'
  // on the description block + a fixed-width right-anchored money column -
  // deterministic geometry across every sibling row, not per-row shrink-fit.
  if (variant === 'A') {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: LIGHT.textPrimary }}>{item.description.trim()}</div>
            {summary && <div style={{ fontSize: '0.78rem', color: LIGHT.textMuted, marginTop: '3px' }}>{summary}</div>}
            {item.quantity > 1 && <div style={{ fontSize: '0.72rem', color: LIGHT.textMuted, marginTop: '2px' }}>{item.quantity} יחידות</div>}
          </div>
          <div style={{ flexShrink: 0, width: MONEY_COL_WIDTH, textAlign: 'right', fontWeight: '800', fontSize: '1rem', color: LIGHT.textPrimary, whiteSpace: 'nowrap' }}>{money(item.total_price)}</div>
        </div>
      </div>
    );
  }

  // B — COLLAPSIBLE: clean summary by default, "פירוט מידות ומפרט" reveals real rows.
  // AUDIT-002/004: same shared-geometry pattern as variant A above.
  if (variant === 'B') {
    return (
      <div style={cardStyle}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: LIGHT.textPrimary }}>{item.description.trim()}</div>
            {summary && <div style={{ fontSize: '0.78rem', color: LIGHT.textMuted, marginTop: '3px' }}>{summary}</div>}
          </div>
          <div style={{ flexShrink: 0, width: MONEY_COL_WIDTH, textAlign: 'right', fontWeight: '800', fontSize: '1rem', color: LIGHT.textPrimary, whiteSpace: 'nowrap' }}>{money(item.total_price)}</div>
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
          {/* AUDIT-004: upgraded from implicit shrink-to-fit (correct edge,
              but non-deterministic width) to the same explicit fixed-width
              right-anchored column as every other variant - guarantees byte-
              identical geometry across every row, not just a correct anchor. */}
          <div style={{ flexShrink: 0, width: MONEY_COL_WIDTH, textAlign: 'right', fontWeight: '800', fontSize: '0.92rem', color: LIGHT.textPrimary, whiteSpace: 'nowrap' }}>{money(item.total_price)}</div>
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
  // AUDIT-002/004: same shared-geometry pattern as variants A/B above.
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', gap: '10px', marginBottom: detailRows.length ? '10px' : 0 }}>
        <div style={{ flex: '1 1 auto', minWidth: 0, fontWeight: '700', fontSize: '0.95rem', color: LIGHT.textPrimary }}>{item.description.trim()}</div>
        <div style={{ flexShrink: 0, width: MONEY_COL_WIDTH, textAlign: 'right', fontWeight: '800', fontSize: '1rem', color: LIGHT.textPrimary, whiteSpace: 'nowrap' }}>{money(item.total_price)}</div>
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
