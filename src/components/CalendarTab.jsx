// Task 19 - Calendar (minimal Owner-approved scope). Internal, owner-only: day / week / month views of existing tasks (due date / time)
// and SENT quotes on their existing validity-end date; Local/Israel accounts also see the bundled Israeli holiday layer and the three
// subtle day classes (ordinary / Saturday / holiday). International accounts see a regular calendar: no holidays, no Saturday tint.
// Dates follow IRON-DATE-001 (account market day; date-only values never shift); the week starts on Sunday. HE structural RTL, EN LTR
// (inherited); dates, times and quote numbers are LTR-isolated atoms. A task opens the existing task flow; a quote opens its existing view.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { APP as NEON, appHeadingTextStyle as neonGlowTextStyle, RADIUS, SHADOW } from '../theme/neonTheme';
import { formatShortDate } from '../utils/shortDate';
import { getQuoteViewLink } from '../utils/quoteListRows';
import { taskMarket } from '../utils/manualTasks';
import { listTasks } from '../utils/tasksClient';
import { listServiceSchedules } from '../utils/serviceScheduleClient';
import {
  EN_WEEKDAYS, EN_WEEKDAYS_SHORT, HE_WEEKDAYS, HE_WEEKDAYS_SHORT, addDays, addMonths, buildCalendarEvents, dayClassOf, dayOfMonth, eventsByDate,
  holidayDataCovers, holidaysFor, initialViewFor, marketToday, monthKey, monthTitle, monthWeeks, weekDates, weekday,
} from '../utils/calendarModel';

const CAL_CSS = `
  .pf-cal { --cal-ordinary: #F8FAFB; --cal-saturday: #F7F0E3; --cal-holiday: #E5F2EE; --cal-line: ${NEON.border}; }
  .pf-cal-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; }
  .pf-cal-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .pf-cal-btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-block-size: 32px; min-inline-size: 32px; padding-inline: 10px; border-radius: ${RADIUS.sm}; border: 1px solid ${NEON.borderStrong}; background: ${NEON.bgCard}; color: ${NEON.textPrimary}; font-size: 0.8rem; font-weight: 700; cursor: pointer; }
  .pf-cal-btn--today { border-color: ${NEON.violet}; color: ${NEON.violet}; }
  .pf-cal-period { font-size: 0.98rem; font-weight: 800; min-inline-size: 0; }
  .pf-cal-seg { display: inline-flex; border: 1px solid ${NEON.borderStrong}; border-radius: ${RADIUS.sm}; overflow: hidden; }
  .pf-cal-seg button { min-block-size: 32px; padding-inline: 12px; border: none; background: ${NEON.bgCard}; color: ${NEON.textSecondary}; font-size: 0.8rem; font-weight: 700; cursor: pointer; }
  .pf-cal-seg button[aria-pressed="true"] { background: ${NEON.violet}; color: #fff; }
  .pf-cal-layers { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-block: 10px; }
  .pf-cal-chip { display: inline-flex; align-items: center; gap: 6px; min-block-size: 28px; padding-inline: 10px; border-radius: 999px; border: 1px solid ${NEON.border}; background: ${NEON.bgCard}; color: ${NEON.textPrimary}; font-size: 0.76rem; font-weight: 600; cursor: pointer; }
  .pf-cal-chip[aria-pressed="false"] { opacity: 0.5; text-decoration: line-through; }
  .pf-cal-dot { inline-size: 9px; block-size: 9px; border-radius: 50%; flex: none; }
  .pf-cal-legend { display: inline-flex; align-items: center; gap: 4px; font-size: 0.72rem; color: ${NEON.textMuted}; }
  .pf-cal-swatch { inline-size: 14px; block-size: 14px; border-radius: 4px; border: 1px solid var(--cal-line); flex: none; }
  .pf-cal-note { font-size: 0.74rem; color: ${NEON.textMuted}; margin-block: 6px; }
  .pf-cal-state { padding: 14px 4px; font-size: 0.85rem; color: ${NEON.textSecondary}; }
  .pf-cal-alert { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 12px; border-radius: ${RADIUS.sm}; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: 0.8rem; font-weight: 600; }
  .pf-cal [data-day-class="ordinary"] { background: var(--cal-ordinary); }
  .pf-cal [data-day-class="saturday"] { background: var(--cal-saturday); }
  .pf-cal [data-day-class="holiday"] { background: var(--cal-holiday); }
  .pf-cal-dow { padding: 6px; font-size: 0.72rem; font-weight: 700; color: ${NEON.textSecondary}; text-align: start; background: ${NEON.bgCard}; }
  .pf-cal-month { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-block-start: 1px solid var(--cal-line); border-inline-start: 1px solid var(--cal-line); }
  .pf-cal-month > * { border-inline-end: 1px solid var(--cal-line); border-block-end: 1px solid var(--cal-line); min-inline-size: 0; }
  .pf-cal-cell { position: relative; min-block-size: 96px; padding: 4px; display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
  .pf-cal-cell[data-out="true"] > * { opacity: 0.45; }
  .pf-cal-cell[data-today="true"] { box-shadow: inset 0 0 0 2px ${NEON.violet}; }
  .pf-cal-daynum { align-self: flex-start; display: inline-flex; align-items: center; justify-content: center; min-inline-size: 26px; block-size: 24px; padding-inline: 4px; border: none; border-radius: 999px; background: transparent; color: ${NEON.textPrimary}; font-size: 0.78rem; font-weight: 700; cursor: pointer; }
  .pf-cal-cell[aria-selected="true"] .pf-cal-daynum, .pf-cal-mini button[aria-pressed="true"] { background: ${NEON.textPrimary}; color: #fff; }
  .pf-cal-hol { font-size: 0.7rem; font-weight: 700; color: #1F5A4F; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pf-cal-ev { display: block; inline-size: 100%; text-align: start; border: none; border-inline-start: 3px solid; border-radius: 4px; padding: 2px 5px; font: inherit; font-size: 0.72rem; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; }
  .pf-cal-ev[data-kind="task"] { background: #E3F1F2; border-color: #0F6672; color: #0B4F58; }
  .pf-cal-ev[data-kind="task"][data-status="overdue"] { border-color: #B42318; }
  .pf-cal-ev[data-kind="task"][data-status="completed"] { background: #EEF1F2; border-color: #9AA5AB; color: #5B6870; text-decoration: line-through; }
  .pf-cal-ev[data-kind="quote"] { background: #FFF3E0; border-color: #9A5B12; color: #6E420C; }
  .pf-cal-ev[data-kind="quote"][data-status="expired"] { background: #F2EEEA; border-color: #8A7A6C; color: #5E5146; }
  .pf-cal-ev[data-kind="service"] { background: #EEEFFC; border-color: #4338CA; color: #312E81; }
  .pf-cal-more { font-size: 0.7rem; font-weight: 700; color: ${NEON.textMuted}; background: none; border: none; padding: 0; margin: 0; font-family: inherit; cursor: pointer; text-decoration: underline; text-align: start; }
  .pf-cal-week { display: grid; grid-template-columns: 52px repeat(7, minmax(0, 1fr)); border-block-start: 1px solid var(--cal-line); border-inline-start: 1px solid var(--cal-line); }
  .pf-cal-week > * { border-inline-end: 1px solid var(--cal-line); border-block-end: 1px solid var(--cal-line); min-inline-size: 0; }
  .pf-cal-wkhead { padding: 6px 4px; display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 0.72rem; font-weight: 700; color: ${NEON.textSecondary}; }
  .pf-cal-wkhead[data-today="true"] { box-shadow: inset 0 -3px 0 ${NEON.violet}; color: ${NEON.textPrimary}; }
  .pf-cal-allday { padding: 3px; display: flex; flex-direction: column; gap: 3px; min-block-size: 34px; }
  .pf-cal-hour { padding: 2px 4px; font-size: 0.68rem; color: ${NEON.textMuted}; background: ${NEON.bgCard}; }
  .pf-cal-slot { min-block-size: 34px; padding: 2px; display: flex; flex-direction: column; gap: 2px; }
  .pf-cal-slot .pf-cal-ev { white-space: normal; }
  .pf-cal-dayview { display: grid; grid-template-columns: minmax(260px, 320px) minmax(0, 1fr); gap: 16px; align-items: start; }
  .pf-cal-mini { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px; }
  .pf-cal-mini .pf-cal-dow { text-align: center; padding: 2px; background: transparent; }
  .pf-cal-mini button { position: relative; block-size: 36px; border: 1px solid transparent; border-radius: 8px; font: inherit; font-size: 0.78rem; font-weight: 700; color: ${NEON.textPrimary}; cursor: pointer; }
  .pf-cal-mini button[data-out="true"] { opacity: 0.4; }
  .pf-cal-mini button[data-today="true"] { border-color: ${NEON.violet}; box-shadow: inset 0 0 0 1px ${NEON.violet}; }
  .pf-cal-mini .pf-cal-marks { position: absolute; inset-block-end: 3px; inset-inline: 0; display: flex; justify-content: center; gap: 2px; }
  .pf-cal-mini .pf-cal-marks i { inline-size: 5px; block-size: 5px; border-radius: 50%; display: block; }
  .pf-cal-agenda { display: flex; flex-direction: column; gap: 8px; min-inline-size: 0; }
  .pf-cal-dayhead { font-size: 0.95rem; font-weight: 800; }
  .pf-cal-holbanner { padding: 8px 12px; border-radius: 10px; border: 1px solid #C7E1D9; background: var(--cal-holiday); color: #1F5A4F; font-weight: 700; font-size: 0.82rem; }
  .pf-cal-item { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 8px; align-items: start; inline-size: 100%; text-align: start; padding: 8px 10px; border-radius: 10px; border: 1px solid ${NEON.border}; border-inline-start: 4px solid; background: ${NEON.bgCard}; font: inherit; color: ${NEON.textPrimary}; cursor: pointer; }
  .pf-cal-item[data-kind="task"] { border-inline-start-color: #0F6672; }
  .pf-cal-item[data-kind="task"][data-status="overdue"] { border-inline-start-color: #B42318; }
  .pf-cal-item[data-kind="task"][data-status="completed"] { border-inline-start-color: #9AA5AB; color: ${NEON.textMuted}; }
  .pf-cal-item[data-kind="quote"] { border-inline-start-color: #9A5B12; background: #FFFBF4; }
  .pf-cal-item[data-kind="quote"][data-status="expired"] { border-inline-start-color: #8A7A6C; background: #FAF8F6; }
  .pf-cal-item[data-kind="service"] { border-inline-start-color: #4338CA; background: #F7F7FE; }
  .pf-cal-item-time { font-size: 0.76rem; font-weight: 700; color: ${NEON.textMuted}; }
  .pf-cal-item-title { font-weight: 700; font-size: 0.86rem; overflow-wrap: anywhere; }
  .pf-cal-item-sub { font-size: 0.74rem; color: ${NEON.textSecondary}; margin-block-start: 2px; }
  .pf-cal-subhead { font-size: 0.78rem; font-weight: 700; color: ${NEON.textMuted}; margin-block-start: 4px; }
  @media (max-width: 900px) {
    .pf-cal-dayview { grid-template-columns: minmax(0, 1fr); }
    .pf-cal-cell { min-block-size: 78px; }
  }
  @media (max-width: 560px) {
    .pf-cal-btn, .pf-cal-seg button, .pf-cal-chip, .pf-cal-daynum { min-block-size: 40px; }
    .pf-cal-btn { min-inline-size: 40px; }
    .pf-cal-mini button { block-size: 40px; }
    .pf-cal-cell { min-block-size: 56px; }
    .pf-cal-ev { font-size: 0.66rem; }
  }
`;
const STATUS_TEXT = {
  awaiting_signature: ['ממתינה לחתימה', 'Awaiting signature'],
  expired: ['פג תוקף ההצעה', 'Quote validity ended'],
};
const SERVICE_TEXT = ['תאריך ביצוע', 'Work date'];
const KIND_COLOR = { task: '#0F6672', quote: '#9A5B12', service: '#4338CA' };
const DAY_CLASS_TEXT = { ordinary: ['יום רגיל', 'Regular day'], saturday: ['שבת', 'Saturday'], holiday: ['חג / יום מנוחה', 'Holiday / rest day'] };

// PRODUCT_TRUTH_CAPABILITY: calendar
export default function CalendarTab({ client, userId, isHebrew, isLocalIsraeliBusiness, quotes = [], onOpenTask, now = null }) {
  const L = useCallback((pair) => (isHebrew ? pair[0] : pair[1]), [isHebrew]);
  const local = isLocalIsraeliBusiness === true;
  const market = taskMarket(local); // the authenticated account market - never the UI language (IRON-DATE-001)
  const clockNow = useMemo(() => now ?? new Date(), [now]);
  const today = marketToday(market, clockNow);
  const [view, setView] = useState(() => (typeof window === 'undefined' ? 'month' : initialViewFor(window.innerWidth, window.innerHeight)));
  const [selected, setSelected] = useState(today);
  const [layers, setLayers] = useState({ tasks: true, quotes: true, service: true, holidays: true });
  const [tasks, setTasks] = useState([]);
  const [load, setLoad] = useState({ state: 'loading', code: null });
  // Task 27: work dates - 'unavailable' (no table on this server) hides the layer; any other failure says so, the rest still shows
  const [schedules, setSchedules] = useState({ state: 'loading', rows: [] });

  const reload = useCallback(async () => {
    setLoad({ state: 'loading', code: null });
    const [r, s] = await Promise.all([listTasks(client, userId), listServiceSchedules(client, userId)]);
    setSchedules(s.ok ? { state: 'ready', rows: s.data } : { state: s.error.code === 'unavailable' ? 'unavailable' : 'error', rows: [] });
    if (r.ok) { setTasks(r.data); setLoad({ state: 'ready', code: null }); } else setLoad({ state: 'error', code: r.error.code });
  }, [client, userId]);
  useEffect(() => { reload(); }, [reload]);

  const holidays = useMemo(() => holidaysFor(local), [local]);
  const showHolidays = local && layers.holidays;
  const events = useMemo(() => buildCalendarEvents({ tasks, quotes, schedules: schedules.rows, market, now: clockNow }), [tasks, quotes, schedules.rows, market, clockNow]);
  const byDate = useMemo(() => eventsByDate(events.filter((e) => (e.kind === 'task' ? layers.tasks : e.kind === 'service' ? layers.service : layers.quotes))), [events, layers.tasks, layers.quotes, layers.service]);
  const classOf = (iso) => dayClassOf(iso, { isLocalIsraeliBusiness: local, holidays: showHolidays ? holidays : null });
  const holidayNames = (iso) => (showHolidays ? (holidays.get(iso) || []).map((h) => L([h.he, h.en])) : []);

  const step = (dir) => setSelected((s) => (view === 'month' ? addMonths(s, dir) : addDays(s, view === 'week' ? 7 * dir : dir)));
  const openEvent = (e) => {
    if (e.kind === 'task') { if (typeof onOpenTask === 'function') onOpenTask(e.ref); return; }
    window.open(getQuoteViewLink(e.quote), '_blank');
  };
  const eventTitle = (e) => (e.kind === 'task' ? e.title : `${L(e.kind === 'service' ? SERVICE_TEXT : STATUS_TEXT[e.status])} · ${e.number} · ${e.party.text}`);
  const dateText = (iso) => formatShortDate(iso, market);
  const dayAria = (iso) => [(isHebrew ? HE_WEEKDAYS : EN_WEEKDAYS)[weekday(iso)], dateText(iso), L(DAY_CLASS_TEXT[classOf(iso)]), ...holidayNames(iso)].filter(Boolean).join(', ');

  const renderChip = (e) => (
    // PRODUCT_TRUTH_CAPABILITY: calendar
    <button key={e.id} type="button" className="pf-cal-ev" data-kind={e.kind} data-status={e.status} data-event-id={e.id} title={eventTitle(e)} onClick={() => openEvent(e)}>
      {e.kind === 'task' ? (<>{e.time && <bdi className="pf-num" dir="ltr">{e.time}</bdi>}{e.time ? ' ' : ''}{e.title}</>)
        : e.kind === 'service' ? (<>{e.time && <bdi className="pf-num" dir="ltr">{e.time}</bdi>}{e.time ? ' ' : ''}{L(SERVICE_TEXT)} · <bdi className="pf-num" dir="ltr">{e.number}</bdi></>)
          : (<>{L(STATUS_TEXT[e.status])} · <bdi className="pf-num" dir="ltr">{e.number}</bdi></>)}
    </button>
  );

  const periodLabel = view === 'month' ? monthTitle(selected, isHebrew)
    : view === 'week' ? <bdi className="pf-num" dir="ltr">{`${dateText(weekDates(selected)[0])} – ${dateText(weekDates(selected)[6])}`}</bdi>
      : <bdi className="pf-num" dir="ltr">{dateText(selected)}</bdi>;
  const visibleYears = view === 'month' ? [selected] : weekDates(selected);
  const outOfHolidayRange = local && layers.holidays && visibleYears.some((d) => !holidayDataCovers(d));

  function renderMonth(maxPerCell) {
    const weeks = monthWeeks(selected);
    const month = monthKey(selected);
    return (
      <div className="pf-cal-month" role="grid" aria-label={monthTitle(selected, isHebrew)} data-testid="calendar-month">
        {(isHebrew ? HE_WEEKDAYS_SHORT : EN_WEEKDAYS_SHORT).map((d) => <div key={d} className="pf-cal-dow" role="columnheader">{d}</div>)}
        {weeks.flat().map((iso) => {
          const evs = byDate.get(iso) || [];
          const hol = holidayNames(iso);
          return (
            <div key={iso} className="pf-cal-cell" role="gridcell" data-date={iso} data-day-class={classOf(iso)} data-out={monthKey(iso) !== month ? 'true' : undefined}
              data-today={iso === today ? 'true' : undefined} aria-selected={iso === selected} aria-label={dayAria(iso)}>
              {/* PRODUCT_TRUTH_CAPABILITY: calendar */}
              <button type="button" className="pf-cal-daynum" onClick={() => setSelected(iso)} aria-label={dayAria(iso)}><bdi className="pf-num" dir="ltr">{dayOfMonth(iso)}</bdi></button>
              {hol.map((h) => <div key={h} className="pf-cal-hol" title={h} data-testid="calendar-holiday">{h}</div>)}
              {evs.slice(0, maxPerCell).map(renderChip)}
              {/* QA 2026-10-25 (C6): the "+N" opens that day in the Day view, where every event of the day is listed */}
              {/* PRODUCT_TRUTH_DECORATIVE: switches the calendar to that day's view; changes no data */}
              {evs.length > maxPerCell && <button type="button" className="pf-cal-more" data-testid="calendar-more" onClick={() => { setSelected(iso); setView('day'); }}
                aria-label={L([`עוד ${evs.length - maxPerCell} ביום הזה - פתיחת תצוגת יום`, `${evs.length - maxPerCell} more on this day - open the Day view`])}><bdi className="pf-num" dir="ltr">{`+${evs.length - maxPerCell}`}</bdi></button>}
            </div>
          );
        })}
      </div>
    );
  }

  function renderWeek() {
    const days = weekDates(selected);
    const timed = days.flatMap((d) => (byDate.get(d) || []).filter((e) => e.time));
    const hours = timed.map((e) => Number(e.time.slice(0, 2)));
    const from = Math.min(7, ...hours); const to = Math.max(19, ...hours);
    const rows = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    return (
      <div className="pf-cal-week" data-testid="calendar-week">
        <div className="pf-cal-hour" />
        {days.map((iso) => (
          <div key={iso} className="pf-cal-wkhead" data-date={iso} data-day-class={classOf(iso)} data-today={iso === today ? 'true' : undefined} aria-label={dayAria(iso)}>
            <span>{(isHebrew ? HE_WEEKDAYS_SHORT : EN_WEEKDAYS_SHORT)[weekday(iso)]}</span>
            {/* PRODUCT_TRUTH_CAPABILITY: calendar */}
            <button type="button" className="pf-cal-daynum" aria-pressed={iso === selected} onClick={() => setSelected(iso)} style={iso === selected ? { background: NEON.textPrimary, color: '#fff' } : undefined}><bdi className="pf-num" dir="ltr">{dayOfMonth(iso)}</bdi></button>
          </div>
        ))}
        <div className="pf-cal-hour">{L(['כל היום', 'All day'])}</div>
        {days.map((iso) => (
          <div key={iso} className="pf-cal-allday" data-date={iso} data-day-class={classOf(iso)}>
            {holidayNames(iso).map((h) => <div key={h} className="pf-cal-hol" title={h} data-testid="calendar-holiday">{h}</div>)}
            {(byDate.get(iso) || []).filter((e) => !e.time).map(renderChip)}
          </div>
        ))}
        {rows.map((hr) => (
          <div key={hr} style={{ display: 'contents' }}>
            <div className="pf-cal-hour"><bdi className="pf-num" dir="ltr">{`${String(hr).padStart(2, '0')}:00`}</bdi></div>
            {days.map((iso) => (
              <div key={iso} className="pf-cal-slot" data-day-class={classOf(iso)}>
                {(byDate.get(iso) || []).filter((e) => e.time && Number(e.time.slice(0, 2)) === hr).map(renderChip)}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  function renderDay() {
    const weeks = monthWeeks(selected);
    const month = monthKey(selected);
    const evs = byDate.get(selected) || [];
    const hol = holidayNames(selected);
    const upcoming = [];
    for (let i = 1; i <= 7 && upcoming.length < 6; i += 1) { const d = addDays(selected, i); for (const e of byDate.get(d) || []) if (upcoming.length < 6) upcoming.push(e); }
    const item = (e, showDate) => (
      // PRODUCT_TRUTH_CAPABILITY: calendar
      <button key={e.id} type="button" className="pf-cal-item" data-kind={e.kind} data-status={e.status} data-event-id={e.id} onClick={() => openEvent(e)}>
        <span className="pf-cal-item-time"><bdi className="pf-num" dir="ltr">{showDate ? dateText(e.date) : (e.time || L(['כל היום', 'All day']))}</bdi></span>
        <span>
          <span className="pf-cal-item-title">{e.kind === 'task' ? e.title : <>{L(e.kind === 'service' ? SERVICE_TEXT : STATUS_TEXT[e.status])} · <bdi className="pf-num" dir="ltr">{e.number}</bdi></>}</span>
          <span className="pf-cal-item-sub" style={{ display: 'block' }}>
            {e.kind === 'task' ? L(e.status === 'completed' ? ['משימה שהושלמה', 'Completed task'] : e.status === 'overdue' ? ['משימה באיחור', 'Overdue task'] : ['משימה', 'Task'])
              : e.kind === 'service' ? `${L(['מועד העבודה של ההצעה', 'Work date of the quote'])} · ${e.party.text}` : `${L(['סוף תוקף ההצעה', 'Quote validity ends'])} · ${e.party.text}`}
          </span>
        </span>
      </button>
    );
    return (
      <div className="pf-cal-dayview" data-testid="calendar-day">
        <div className="pf-cal-mini" role="grid" aria-label={monthTitle(selected, isHebrew)}>
          {(isHebrew ? HE_WEEKDAYS_SHORT : EN_WEEKDAYS_SHORT).map((d) => <div key={d} className="pf-cal-dow">{d}</div>)}
          {weeks.flat().map((iso) => {
            const kinds = [...new Set((byDate.get(iso) || []).map((e) => e.kind))];
            return (
              // PRODUCT_TRUTH_CAPABILITY: calendar
              <button key={iso} type="button" data-date={iso} data-day-class={classOf(iso)} data-out={monthKey(iso) !== month ? 'true' : undefined} data-today={iso === today ? 'true' : undefined}
                aria-pressed={iso === selected} aria-label={dayAria(iso)} onClick={() => setSelected(iso)}>
                <bdi className="pf-num" dir="ltr">{dayOfMonth(iso)}</bdi>
                {kinds.length > 0 && <span className="pf-cal-marks">{kinds.map((k) => <i key={k} style={{ background: KIND_COLOR[k] }} />)}</span>}
              </button>
            );
          })}
        </div>
        <div className="pf-cal-agenda">
          <div className="pf-cal-dayhead">{(isHebrew ? HE_WEEKDAYS : EN_WEEKDAYS)[weekday(selected)]}, <bdi className="pf-num" dir="ltr">{dateText(selected)}</bdi></div>
          {hol.map((h) => <div key={h} className="pf-cal-holbanner" data-testid="calendar-holiday">{h}</div>)}
          {evs.length === 0 && <div className="pf-cal-state" data-testid="calendar-day-empty">{L(['אין משימות או מועדי הצעות ביום זה.', 'No tasks or quote deadlines on this day.'])}</div>}
          {evs.map((e) => item(e, false))}
          {upcoming.length > 0 && <div className="pf-cal-subhead">{L(['בימים הקרובים', 'Coming up'])}</div>}
          {upcoming.map((e) => item(e, true))}
        </div>
      </div>
    );
  }

  return (
    <div className="pf-screen pf-work-screen pf-cal" data-testid="calendar-screen" data-market={local ? 'Local' : 'International'} style={{ background: NEON.bgCard, padding: '18px', borderRadius: RADIUS.lg, border: 'none', boxShadow: SHADOW.sm }}>
      <style>{CAL_CSS}</style>
      <div className="pf-cal-head">
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', ...neonGlowTextStyle }}>
            <CalendarDays size={18} color={NEON.textSecondary} strokeWidth={2} aria-hidden="true" />
            {L(['יומן', 'Calendar'])}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: NEON.textSecondary }}>
            {local ? L(['משימות, מועדי הצעות וחגי ישראל בתצוגה אחת', 'Tasks, quote deadlines and Israeli holidays in one view']) : L(['משימות ומועדי הצעות בתצוגה אחת', 'Tasks and quote deadlines in one view'])}
          </p>
        </div>
        <div className="pf-cal-tools">
          {/* PRODUCT_TRUTH_CAPABILITY: calendar */}
          <button type="button" className="pf-cal-btn pf-cal-btn--today" data-testid="calendar-today" onClick={() => setSelected(today)}>{L(['היום', 'Today'])}</button>
          {/* PRODUCT_TRUTH_CAPABILITY: calendar */}
          <button type="button" className="pf-cal-btn" data-testid="calendar-prev" onClick={() => step(-1)} aria-label={L(['הקודם', 'Previous'])}>{isHebrew ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronLeft size={16} aria-hidden="true" />}</button>
          <span className="pf-cal-period" data-testid="calendar-period">{periodLabel}</span>
          {/* PRODUCT_TRUTH_CAPABILITY: calendar */}
          <button type="button" className="pf-cal-btn" data-testid="calendar-next" onClick={() => step(1)} aria-label={L(['הבא', 'Next'])}>{isHebrew ? <ChevronLeft size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}</button>
          <span className="pf-cal-seg" role="group" aria-label={L(['תצוגה', 'View'])}>
            {[['day', ['יום', 'Day']], ['week', ['שבוע', 'Week']], ['month', ['חודש', 'Month']]].map(([v, label]) => (
              // PRODUCT_TRUTH_CAPABILITY: calendar
              <button key={v} type="button" data-view={v} aria-pressed={view === v} onClick={() => setView(v)}>{L(label)}</button>
            ))}
          </span>
        </div>
      </div>

      <div className="pf-cal-layers" role="group" aria-label={L(['שכבות', 'Layers'])}>
        {/* PRODUCT_TRUTH_CAPABILITY: calendar */}
        <button type="button" className="pf-cal-chip" data-layer="tasks" aria-pressed={layers.tasks} onClick={() => setLayers((x) => ({ ...x, tasks: !x.tasks }))}><span className="pf-cal-dot" style={{ background: '#0F6672' }} />{L(['משימות', 'Tasks'])}</button>
        {/* PRODUCT_TRUTH_CAPABILITY: calendar */}
        <button type="button" className="pf-cal-chip" data-layer="quotes" aria-pressed={layers.quotes} onClick={() => setLayers((x) => ({ ...x, quotes: !x.quotes }))}><span className="pf-cal-dot" style={{ background: '#9A5B12' }} />{L(['הצעות ממתינות לחתימה', 'Quotes awaiting signature'])}</button>
        {schedules.state === 'ready' && (
          // PRODUCT_TRUTH_CAPABILITY: calendar
          <button type="button" className="pf-cal-chip" data-layer="service" aria-pressed={layers.service} onClick={() => setLayers((x) => ({ ...x, service: !x.service }))}><span className="pf-cal-dot" style={{ background: KIND_COLOR.service }} />{L(['תאריכי ביצוע', 'Work dates'])}</button>
        )}
        {local && (
          // PRODUCT_TRUTH_CAPABILITY: calendar
          <button type="button" className="pf-cal-chip" data-layer="holidays" aria-pressed={layers.holidays} onClick={() => setLayers((x) => ({ ...x, holidays: !x.holidays }))}><span className="pf-cal-dot" style={{ background: '#2F7D6B' }} />{L(['חגים וימי מנוחה בישראל', 'Israeli holidays and rest days'])}</button>
        )}
        {local && (
          <span className="pf-cal-legend" data-testid="calendar-legend">
            <span className="pf-cal-swatch" data-day-class="ordinary" />{L(DAY_CLASS_TEXT.ordinary)}
            <span className="pf-cal-swatch" data-day-class="saturday" />{L(DAY_CLASS_TEXT.saturday)}
            <span className="pf-cal-swatch" data-day-class="holiday" />{L(DAY_CLASS_TEXT.holiday)}
          </span>
        )}
      </div>
      {outOfHolidayRange && <div className="pf-cal-note" data-testid="calendar-holiday-range">{L(['אין נתוני חגים לתקופה זו (הנתונים זמינים לשנים 2020–2040).', 'No holiday data for this period (data covers 2020–2040).'])}</div>}

      <div className="pf-screen-body" data-testid="calendar-body">
        {load.state === 'error' && (
          <div className="pf-cal-alert" role="alert" data-testid="calendar-load-error">
            <span>{L(['לא ניתן היה לטעון את המשימות. מועדי ההצעות מוצגים.', 'Tasks could not be loaded. Quote deadlines are shown.'])}</span>
            {/* PRODUCT_TRUTH_CAPABILITY: calendar */}
            <button type="button" className="pf-cal-btn" onClick={reload}><RotateCcw size={14} aria-hidden="true" />{L(['נסו שוב', 'Try again'])}</button>
          </div>
        )}
        {schedules.state === 'error' && <div className="pf-cal-note" role="status" data-testid="calendar-service-error">{L(['לא ניתן היה לטעון את תאריכי הביצוע. שאר היומן מוצג.', 'Work dates could not be loaded. The rest of the calendar is shown.'])}</div>}
        {load.state === 'loading' && <div className="pf-cal-state" role="status" data-testid="calendar-loading">{L(['טוען משימות…', 'Loading tasks...'])}</div>}
        {view === 'month' && renderMonth(3)}
        {view === 'week' && renderWeek()}
        {view === 'day' && renderDay()}
      </div>
    </div>
  );
}
