// Leads stage 1 (Owner console 2026-11-18): the leads state of the Clients screen and a market wall-clock helper (kept apart from the
// components for Fast Refresh). L-10: the leads load here through loadWithRetry - never in Dashboard.loadData; a failed load never shows
// "no leads" and never empties a list already shown.
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadWithRetry } from '../../utils/resilientLoad';
import { listLeads } from '../../utils/leadsClient';
import { marketTimeZone } from '../../utils/shortDate';

/** The owner's leads: loaded once per signed-in user, retried on failure (L-10). */
export function useLeads(leadsApi) {
  const client = leadsApi?.client || null;
  const userId = leadsApi?.userId || null;
  const [state, setState] = useState({ status: 'idle', leads: [] });
  const gen = useRef(0);
  const load = useCallback(() => {
    if (!client || !userId) return;
    const my = ++gen.current;
    setState((s) => ({ ...s, status: s.status === 'ready' ? 'ready' : 'loading' }));
    loadWithRetry(() => listLeads(client, userId), { isCurrent: () => gen.current === my }).then((res) => {
      if (gen.current !== my || res.cancelled) return;
      if (res.ok) setState({ status: 'ready', leads: res.data });
    });
  }, [client, userId]);
  useEffect(() => { load(); return () => { gen.current += 1; }; }, [load]);
  const put = useCallback((lead) => setState((s) => ({ ...s, leads: s.leads.some((l) => l.id === lead.id) ? s.leads.map((l) => (l.id === lead.id ? lead : l)) : [lead, ...s.leads] })), []);
  return { ...state, reload: load, put };
}


/** The instant of a wall-clock date + time in the account market's product time zone (the entry time the owner typed). */
export function marketInstant(date, time, market) {
  const m = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); const t = String(time || '00:00').match(/^(\d{2}):(\d{2})$/);
  if (!m || !t) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: marketTimeZone(market), year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
  const g = (k) => Number(parts.find((p) => p.type === k)?.value);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
  return new Date(guess - (asUtc - guess)).toISOString();
}
