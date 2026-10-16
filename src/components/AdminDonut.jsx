// Admin ring chart (Owner 2026-10-16, admin spec §6 + the approved sketch donut): ONE array feeds the SVG, the legend and the accessible
// table. Zero rows stay in the legend / table (monthly and annual at 0) but draw no sector; no records -> a neutral ring with "no data"
// and no percentages; loading / error never draw sectors or zeros. A legend row is a button (keyboard) that filters the users list.
import { useId } from 'react';
import { ADMIN_COPY as C, t } from '../domain/admin/adminCopy';

const pct = (n, total) => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '—');

export default function AdminDonut({ title, description, segments, isHebrew, state = 'ready', onSelect = null, renderMark = null }) {
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const total = segments.reduce((s, x) => s + (x.count || 0), 0);
  const ready = state === 'ready' || state === 'stale';
  let off = 0;
  const arcs = ready && total > 0 ? segments.filter((s) => s.count > 0).map((s) => {
    const n = (s.count / total) * 100;
    const arc = <circle key={s.key} cx="100" cy="100" r="77" fill="none" stroke={s.color} strokeWidth="24" pathLength="100" strokeDasharray={`${n} ${100 - n}`} strokeDashoffset={-off} transform="rotate(-90 100 100)" />;
    off += n;
    return arc;
  }) : [];
  const center = !ready ? (state === 'loading' ? t(isHebrew, C.loading.he, C.loading.en) : '—') : total > 0 ? String(total) : t(isHebrew, C.noData.he, C.noData.en);
  return (
    <div>
      <div className="av-chart">
        <svg className="av-donut" role="img" aria-labelledby={`${gid}-t ${gid}-d`} viewBox="0 0 200 200">
          <title id={`${gid}-t`}>{title}</title>
          <desc id={`${gid}-d`}>{description}</desc>
          <circle cx="100" cy="100" r="77" fill="none" stroke="#edf1f6" strokeWidth="24" />
          {arcs}
          <text className="av-big" x="100" y={ready && total > 0 ? 102 : 106} textAnchor="middle" style={ready && total > 0 ? undefined : { fontSize: 15, fontWeight: 600 }}>{center}</text>
          {ready && total > 0 && <text className="av-tiny-t" x="100" y="123" textAnchor="middle">{t(isHebrew, C.accounts.he, C.accounts.en)}</text>}
        </svg>
        <div className="av-legend">
          {segments.map((s) => {
            const body = (
              <>
                <span className="av-name">{renderMark ? renderMark(s) : <span className="av-dot" style={{ background: s.color }} aria-hidden="true" />}<span>{s.label}</span></span>
                <b className="av-num">{ready ? s.count : '—'}</b>
                <span className="av-pct av-num">{ready && total > 0 ? pct(s.count, total) : ''}</span>
              </>
            );
            if (!onSelect) return <div key={s.key} className="av-legend-row" data-segment={s.key}>{body}</div>;
            return (
              // PRODUCT_TRUTH_DECORATIVE: a legend row opens the users list filtered to this group (navigation, no data change)
              <button key={s.key} type="button" className="av-legend-row" onClick={() => onSelect(s.key)} data-segment={s.key}>{body}</button>
            );
          })}
        </div>
      </div>
      {ready && (
        <details className="av-datatable">
          <summary>{t(isHebrew, C.dataTable.he, C.dataTable.en)}</summary>
          <table>
            <caption>{title}</caption>
            <thead><tr><th scope="col">{t(isHebrew, C.dimension.he, C.dimension.en)}</th><th scope="col">{t(isHebrew, C.count.he, C.count.en)}</th><th scope="col">%</th></tr></thead>
            <tbody>{segments.map((s) => <tr key={s.key}><td>{s.label}</td><td className="av-num">{s.count}</td><td className="av-num">{pct(s.count, total)}</td></tr>)}</tbody>
          </table>
        </details>
      )}
    </div>
  );
}
