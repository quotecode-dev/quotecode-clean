// Task 20 (Phase 4) - the header bell's notification center. The bell keeps EXACTLY the geometry of the former decorative 18px icon
// (a zero-padding 18x18 button; the unread badge and the panel are out of flow), so the locked header layout does not move.
// In-app reminders are DERIVED from the account's own tasks and quotes with the shared rules (reminderRules.js) and the business's
// saved mode/checkboxes (defaults = In-app only when nothing is saved). Read marks persist only when the server table exists.
// It never sends anything and never navigates to settings (the single settings entry is inside Business settings).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { APP as NEON } from '../theme/neonTheme';
import { listTasks } from '../utils/tasksClient';
import { taskMarket, marketToday, marketClock } from '../utils/manualTasks';
import { isQuoteAcceptanceExpired } from '../utils/quoteValidity';
import { displayQuoteNumber, quotePartyLabel } from '../utils/quoteListRows';
import { formatShortDate, formatShortDateTime } from '../utils/shortDate';
import {
  REMINDERS_COPY, normalizeReminderSettings, deriveInAppReminders, loadReminderSettings, listReadMarks, markRemindersRead, firstViewAvailableFor,
  WELCOME_ITEM_KEY, OPEN_REMINDERS_SETTINGS_EVENT, isWelcomeVisible,
} from '../utils/reminders';
import { SUPPORT_EMAIL_HE, SUPPORT_EMAIL_EN } from '../shared/brand';
import AiRobotIcon from './AiRobotIcon';

const KIND_COLOR = { first_view: '#5B3FB6', task_due: '#0F6672', validity_ending: '#9A5B12', viewed_not_approved: '#65727A' };

// variant: 'desktop' = the former decorative 18x18 icon footprint (desktop / tablet-landscape account cluster);
//          'mobile'  = the slot freed by the removed plans indicator in the mobile / tablet-portrait header (Owner console instruction
//                      2026-10-09): a 30px-high round tap target matching the AI-chat chip height, same 18px icon, same panel.
export default function NotificationCenter({ client, userId, isHebrew, isLocalIsraeliBusiness, quotes = [], now = null, variant = 'desktop', authUser = null }) {
  const mobile = variant === 'mobile';
  const C = REMINDERS_COPY[isHebrew ? 'he' : 'en'];
  const local = isLocalIsraeliBusiness === true;
  const market = taskMarket(local);
  const dateMarket = local ? 'Local' : 'International';
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(() => normalizeReminderSettings(null));
  const [tasks, setTasks] = useState([]);
  const [read, setRead] = useState(() => new Set());
  const [readPersisted, setReadPersisted] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  // Both header variants are mounted (CSS shows one per breakpoint): only the VISIBLE bell loads data, so a hidden copy never fetches.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = btnRef.current;
    if (!el || typeof ResizeObserver === 'undefined') { setShown(true); return undefined; }
    const check = () => setShown(el.getClientRects().length > 0);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const refresh = useCallback(async () => {
    if (!client || !userId) return;
    const [s, t, r] = await Promise.all([loadReminderSettings(client, userId), listTasks(client, userId), listReadMarks(client, userId)]);
    if (s.ok) { setSettings(s.data.settings); setSettingsLoaded(true); } // otherwise the In-app defaults stay (nothing is ever sent)
    if (t.ok) setTasks(t.data);
    if (r.ok) { setRead(r.data); setReadPersisted(true); } else setReadPersisted(false);
  }, [client, userId]);
  useEffect(() => { if (shown) refresh(); }, [shown, refresh]);
  useEffect(() => { if (open) refresh(); }, [open, refresh]);

  const clock = now ?? new Date();
  const items = useMemo(() => deriveInAppReminders({
    settings, tasks, quotes, today: marketToday(market, clock), nowClock: marketClock(market, clock), now: clock.getTime(),
    isExpired: (q) => isQuoteAcceptanceExpired(q?.valid_until, dateMarket, clock), firstViewAvailable: firstViewAvailableFor(quotes),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [settings, tasks, quotes, market, dateMarket, open]);
  // Task 40: the welcome item (a new account, reminders not Off - known only once the saved mode loaded) sits above the derived
  // reminders; it counts as unread only while a read mark can be saved, so a badge the user cannot clear never appears
  const supportEmail = isHebrew ? SUPPORT_EMAIL_HE : SUPPORT_EMAIL_EN;
  const welcome = settingsLoaded && isWelcomeVisible({ accountCreatedAt: authUser?.created_at, mode: settings.mode, now: clock.getTime() });
  const welcomeRead = read.has(WELCOME_ITEM_KEY);
  const unread = items.filter((i) => !read.has(i.key)).length + (welcome && readPersisted && !welcomeRead ? 1 : 0);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const place = () => {
      const r = btnRef.current.getBoundingClientRect();
      const width = Math.min(360, window.innerWidth - 16);
      const left = isHebrew ? Math.max(8, Math.min(r.left - 12, window.innerWidth - width - 8)) : Math.max(8, Math.min(r.right + 12 - width, window.innerWidth - width - 8));
      setPos({ top: r.bottom + 10, left, width });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, isHebrew]);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!panelRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  // the welcome's AI button opens the ONE existing assistant through its existing window event (the same one the header chip uses)
  const openAiChatFromWelcome = () => { setOpen(false); window.dispatchEvent(new CustomEvent('open-proflow-ai-chat')); };
  const openRemindersSettings = () => { setOpen(false); window.dispatchEvent(new CustomEvent(OPEN_REMINDERS_SETTINGS_EVENT)); };

  const markAll = async () => {
    const keys = [...(welcome ? [WELCOME_ITEM_KEY] : []), ...items.map((i) => i.key)];
    const r = await markRemindersRead(client, userId, keys);
    if (r.ok) setRead((s) => new Set([...s, ...keys]));
  };

  const line = (i) => {
    if (i.kind === 'task_due') return { title: C.item.task_due(i), meta: i.overdue ? `${C.item.task_due_overdue} · ${formatShortDate(i.date, dateMarket)}` : `${C.item.today}${i.time ? ` · ${i.time}` : ''}` };
    const n = displayQuoteNumber(i.quote);
    // the truthful party label (client name, else quote title); the number is already in the line, so never repeat it
    const p = quotePartyLabel(i.quote);
    const party = p.kind === 'number' ? '' : p.text;
    if (i.kind === 'first_view') return { title: C.item.first_view(n), meta: `${party ? `${party} · ` : ''}${formatShortDateTime(i.at, dateMarket)}` };
    if (i.kind === 'viewed_not_approved') return { title: C.item.viewed_not_approved(n, i.days), meta: party };
    return { title: C.item.validity_ending(n, i.daysLeft), meta: formatShortDate(i.validUntil, dateMarket) };
  };

  return (
    <>
      {/* PRODUCT_TRUTH_CAPABILITY: reminders_automation */}
      <button ref={btnRef} type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}
        aria-label={unread ? `${C.center.title} (${unread})` : C.center.title} data-testid="header-bell"
        style={mobile
          ? { position: 'relative', width: 30, height: 30, padding: 0, margin: 0, border: '1px solid rgba(255,255,255,0.22)', borderRadius: 999, background: 'rgba(255,255,255,0.10)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', boxSizing: 'border-box' }
          : { position: 'relative', width: 18, height: 18, padding: 0, margin: 0, border: 0, background: 'none', color: 'inherit', display: 'inline-flex', cursor: 'pointer', flex: 'none' }}>
        <Bell size={18} strokeWidth={1.6} aria-hidden="true" />
        {/* <b>, not <span>: the mobile header CSS styles every button > span (plans-pill padding / min-height) */}
        {unread > 0 && (
          <b aria-hidden="true" data-testid="header-bell-count" style={{ position: 'absolute', top: mobile ? -4 : -6, insetInlineEnd: mobile ? -5 : -8, minWidth: 15, height: 15, padding: '0 4px', boxSizing: 'border-box', borderRadius: 999, background: '#F5B700', color: '#152229', fontSize: 9.5, fontWeight: 800, lineHeight: '15px', textAlign: 'center', direction: 'ltr', fontVariantNumeric: 'tabular-nums' }}>
            {unread > 9 ? '9+' : unread}
          </b>
        )}
      </button>
      {open && pos && (
        <div ref={panelRef} role="dialog" aria-label={C.center.title} data-testid="notification-center" dir={isHebrew ? 'rtl' : 'ltr'}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, maxHeight: 'min(70vh, 520px)', overflowY: 'auto', background: '#fff', color: NEON.textPrimary, borderRadius: 14, boxShadow: '0 18px 40px -10px rgba(15,23,42,.35)', border: `1px solid ${NEON.border}`, zIndex: 2000, textAlign: 'start', fontWeight: 400 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${NEON.border}`, gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{C.center.title}</span>
            {readPersisted && unread > 0 && (
              // PRODUCT_TRUTH_CAPABILITY: reminders_automation
              <button type="button" onClick={markAll} style={{ background: 'none', border: 0, color: '#0F6672', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', padding: '6px 0', fontFamily: 'inherit' }}>{C.center.markAll}</button>
            )}
          </div>
          {welcome && (
            <div data-testid="notification-welcome" style={{ padding: '12px 14px', borderBottom: `1px solid ${NEON.border}`, opacity: welcomeRead ? 0.6 : 1 }}>
              <div style={{ fontWeight: 800, fontSize: '0.86rem', overflowWrap: 'anywhere' }}>{C.welcome.title}</div>
              <div style={{ fontSize: '0.78rem', lineHeight: 1.45, marginTop: 4 }}>
                {C.welcome.body}{' '}
                {/* PRODUCT_TRUTH_CAPABILITY: reminders_automation */}
                <button type="button" data-testid="notification-welcome-settings" onClick={openRemindersSettings}
                  style={{ display: 'inline', padding: 0, margin: 0, border: 0, background: 'none', color: '#0F6672', fontWeight: 700, fontSize: 'inherit', lineHeight: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'start' }}>
                  {C.welcome.settingsLink}
                </button>.
              </div>
              <div style={{ fontSize: '0.75rem', color: NEON.textSecondary, marginTop: 6 }}>
                {C.welcome.support}{' '}
                {/* PRODUCT_TRUTH_DECORATIVE: mailto link that opens an email to the service support mailbox (answered by the team; nothing changes in the account) */}
                <a href={`mailto:${supportEmail}`} style={{ color: '#0F6672', fontWeight: 600 }}><bdi dir="ltr">{supportEmail}</bdi></a>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: '0.75rem', color: NEON.textSecondary, marginTop: 4 }}>
                <span>{C.welcome.ai}</span>
                {/* PRODUCT_TRUTH_CAPABILITY: ai_chat */}
                <button type="button" data-testid="notification-welcome-ai" onClick={openAiChatFromWelcome}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: '1px solid #0F6672', borderRadius: 999, background: 'none', color: '#0F6672', fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <AiRobotIcon size={14} />
                  <span>{C.welcome.aiButton}</span>
                </button>
              </div>
            </div>
          )}
          {settings.mode === 'off' ? (
            <div style={{ padding: '14px', fontSize: '0.8rem', color: NEON.textSecondary }}>{C.center.modeOff}</div>
          ) : items.length === 0 ? (
            <div style={{ padding: '14px', fontSize: '0.8rem', color: NEON.textSecondary }}>{C.center.empty}</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {items.map((i) => {
                const l = line(i);
                const isRead = read.has(i.key);
                return (
                  <li key={i.key} data-testid={`notification-${i.kind}`} style={{ display: 'grid', gridTemplateColumns: '10px minmax(0,1fr)', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${NEON.border}`, opacity: isRead ? 0.6 : 1 }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, background: KIND_COLOR[i.kind] }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', overflowWrap: 'anywhere' }} dir="auto">{l.title}</div>
                      {l.meta && <div style={{ color: NEON.textSecondary, fontSize: '0.72rem', marginTop: 2 }}><bdi>{l.meta}</bdi></div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div style={{ padding: '8px 14px', fontSize: '0.72rem', color: NEON.textSecondary }}>
            {C.center.modeLine[settings.mode]}{!readPersisted && items.length > 0 ? ` ${C.center.readNotSaved}` : ''}
          </div>
        </div>
      )}
    </>
  );
}
