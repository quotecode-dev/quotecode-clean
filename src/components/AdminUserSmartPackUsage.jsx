// Owner console 2026-11-06 (release C, typed: "מאשר את שחרור ג׳, כולל שינוי ב-L-06, L-09, L-14, L-17 ו-L-22"; the request: "אני רוצה
// לראות שימוש של משתמש בכרטיס שלו"): the account's SMART PACK usage this Israel month inside the admin user card ("מסלול וניצול") -
// % used, ILS of the 4 ILS budget, the actions counted, and a bar per day of the month. Reads smart_pack_usage_account (super admin only,
// server-checked; the meter's own numbers). Numbers only, never content. Read-only.
import { useEffect, useState } from 'react';
import { supabase } from '../shared/supabase';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const ils = (v) => `₪${num(v).toFixed(2)}`;
const N = ({ v }) => <bdi className="av-num">{v}</bdi>;

/** the days of the account's month ("YYYY-MM"), each with its ILS and actions (0 for a day without usage) */
export function usageDays(month, days) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  if (!m) return [];
  const count = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
  const byDay = new Map((Array.isArray(days) ? days : []).map((d) => [String(d.day), d]));
  return Array.from({ length: count }, (_, i) => {
    const day = `${m[1]}-${m[2]}-${String(i + 1).padStart(2, '0')}`;
    const d = byDay.get(day);
    return { day: i + 1, costIls: num(d?.costIls), actions: num(d?.actions) };
  });
}

/** "נובמבר 2026" / "November 2026" (no bidi-mixed "2026-11") */
export function monthName(month, isHebrew) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  if (!m) return '';
  return new Intl.DateTimeFormat(isHebrew ? 'he-IL' : 'en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)));
}

export default function AdminUserSmartPackUsage({ uid, isHebrew, refreshKey = 0 }) {
  const [data, setData] = useState('loading');
  useEffect(() => {
    let cancelled = false;
    setData('loading');
    Promise.resolve(supabase.rpc('smart_pack_usage_account', { p_user_id: uid })).then(({ data: d, error }) => {
      if (!cancelled) setData(error || !d || d.ok !== true || !Array.isArray(d.days) ? 'unavailable' : d);
    }).catch(() => { if (!cancelled) setData('unavailable'); });
    return () => { cancelled = true; };
  }, [uid, refreshKey]);

  const label = isHebrew ? 'חכם פלוס החודש' : 'SMART PACK this month';
  if (data === 'loading' || data === 'unavailable') {
    return (
      <div className="av-statline" data-testid="admin-user-smart-pack">
        <span>{label}</span><strong>{data === 'loading' ? '—' : (isHebrew ? 'לא זמין' : 'Unavailable')}</strong>
      </div>
    );
  }
  const actions = num(data.actions);
  const actionsText = isHebrew ? <>{' · '}<N v={actions} /> {actions === 1 ? 'פעולה' : 'פעולות'}</> : <>{' · '}<N v={actions} /> {actions === 1 ? 'action' : 'actions'}</>;
  const value = data.unlimited
    ? <>{isHebrew ? 'חשבון הניהול, לא נספר מהתקציב' : 'The admin account, not counted against the budget'}{' · '}<N v={ils(data.usedIls)} />{actionsText}</>
    : !data.smartPack && actions === 0
      ? (isHebrew ? 'אין חכם פלוס' : 'No SMART PACK')
      : <>{isHebrew ? 'נוצלו ' : ''}<N v={`${num(data.percentUsed).toFixed(1)}%`} />{isHebrew ? '' : ' used'}{' · '}<N v={ils(data.usedIls)} />{isHebrew ? ' מתוך ' : ' of '}<N v={ils(data.budgetIls)} />{actionsText}</>;
  const days = usageDays(data.month, data.days);
  const max = Math.max(...days.map((d) => d.costIls), 0);
  const chartLabel = isHebrew ? `השימוש לפי יום, ${monthName(data.month, true)}` : `Usage by day, ${monthName(data.month, false)}`;
  return (
    <div data-testid="admin-user-smart-pack">
      <div className="av-statline">
        <span>{label}</span>
        <strong data-testid="admin-user-smart-pack-value">{value}</strong>
      </div>
      {days.length > 0 && (
        <figure className="av-section" style={{ margin: '6px 0 0' }} data-testid="admin-user-smart-pack-chart">
          <div role="img" aria-label={chartLabel} style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '64px', borderBottom: '1px solid var(--av-line)' }}>
            {days.map((d) => (
              <div key={d.day} data-day={d.day} title={`${d.day}: ${ils(d.costIls)} · ${d.actions}`}
                style={{ flex: '1 1 0', minWidth: 0, height: max > 0 && d.costIls > 0 ? `${Math.max(4, Math.round((d.costIls / max) * 100))}%` : '0', background: 'var(--av-accent)', borderRadius: '2px 2px 0 0' }} />
            ))}
          </div>
          <figcaption className="av-tiny av-muted" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <N v={1} /><span>{chartLabel}</span><N v={days.length} />
          </figcaption>
        </figure>
      )}
    </div>
  );
}
