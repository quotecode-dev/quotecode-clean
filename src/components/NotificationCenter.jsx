// Task 20 (Phase 4) - the header bell's notification center. The bell keeps EXACTLY the geometry of the former decorative 18px icon
// (a zero-padding 18x18 button; the unread badge and the panel are out of flow), so the locked header layout does not move.
// In-app reminders are DERIVED from the account's own tasks and quotes with the shared rules (reminderRules.js) and the business's
// saved mode/checkboxes (defaults = In-app only when nothing is saved). Read marks persist only when the server table exists.
// It never sends anything and never navigates to settings (the single settings entry is inside Business settings).
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X } from 'lucide-react';
import { APP as NEON } from '../theme/neonTheme';
import { listTasks, TASKS_CHANGED_EVENT } from '../utils/tasksClient';
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
import { BELL_SUBJECT_EVENT, BELL_ACTION_COPY, bellActionsFor, loadFloatedKeys, saveFloatedKeys, floatedStorageKey, pendingFloating } from '../utils/bellSubject';
import { activeAnnouncements } from '../utils/bellAnnouncements';

const KIND_COLOR = { announce: '#7C3AED', signed: '#15803D', first_view: '#5B3FB6', task_due: '#0F6672', validity_ending: '#9A5B12', viewed_not_approved: '#65727A' };

// variant: 'desktop' = the former decorative 18x18 icon footprint (desktop / tablet-landscape account cluster);
//          'mobile'  = the slot freed by the removed plans indicator in the mobile / tablet-portrait header (Owner console instruction
//                      2026-10-09): a 30px-high round tap target matching the AI-chat chip height, same 18px icon, same panel.
export default function NotificationCenter({ client, userId, isHebrew, isLocalIsraeliBusiness, quotes = [], now = null, variant = 'desktop', authUser = null, quotesReady = true, quotesFresh = undefined, announcements = [], upgradeQuoteId = null }) {
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
  // night task 2026-10-19: the floating notice starts only after every input of the derivation loaded once
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [readLoaded, setReadLoaded] = useState(false);
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
    if (t.ok) { setTasks(t.data); setTasksLoaded(true); }
    if (r.ok) { setRead(r.data); setReadPersisted(true); } else setReadPersisted(false);
    setReadLoaded(true);
  }, [client, userId]);
  useEffect(() => { if (shown) refresh(); }, [shown, refresh]);
  useEffect(() => { if (open) refresh(); }, [open, refresh]);
  // R-09 (night task 2026-10-16): the count follows time (a task due at 14:00 counts at 14:00) and a task written anywhere in the app
  const [minuteTick, setMinuteTick] = useState(0);
  useEffect(() => {
    if (!shown) return undefined;
    const id = setInterval(() => setMinuteTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, [shown]);
  useEffect(() => {
    if (!shown) return undefined;
    const onChanged = () => { refresh(); };
    window.addEventListener(TASKS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(TASKS_CHANGED_EVENT, onChanged);
  }, [shown, refresh]);

  const clock = now ?? new Date();
  const derivedItems = useMemo(() => deriveInAppReminders({
    settings, tasks, quotes, today: marketToday(market, clock), nowClock: marketClock(market, clock), now: clock.getTime(),
    isExpired: (q) => isQuoteAcceptanceExpired(q?.valid_until, dateMarket, clock), firstViewAvailable: firstViewAvailableFor(quotes),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [settings, tasks, quotes, market, dateMarket, open, minuteTick]);
  // Owner 2026-10-19 (typed L-17 approval): a product announcement (the voice assistant) is one more bell item after the reminders -
  // unread until read, floating once like every new notification; reminders Off shows none of it
  const announcementsDay = clock.toISOString().slice(0, 10);
  const items = useMemo(() => (settings.mode === 'off' ? derivedItems : [...derivedItems, ...activeAnnouncements(announcements, clock)]),
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [derivedItems, settings.mode, announcements, announcementsDay]);
  // Task 40: the welcome item (a new account, reminders not Off - known only once the saved mode loaded) sits above the derived
  // reminders; it counts as unread only while a read mark can be saved, so a badge the user cannot clear never appears
  const supportEmail = isHebrew ? SUPPORT_EMAIL_HE : SUPPORT_EMAIL_EN;
  const welcome = settingsLoaded && isWelcomeVisible({ accountCreatedAt: authUser?.created_at, mode: settings.mode, now: clock.getTime() });
  const welcomeRead = read.has(WELCOME_ITEM_KEY);
  const unread = items.filter((i) => !read.has(i.key)).length + (welcome && readPersisted && !welcomeRead ? 1 : 0);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const place = () => setPos(panelPlacement(btnRef.current, isHebrew));
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

  const markOne = async (key) => {
    const r = await markRemindersRead(client, userId, [key]);
    if (r.ok) setRead((s) => new Set([...s, key]));
  };
  const markAll = async () => {
    const keys = [...(welcome ? [WELCOME_ITEM_KEY] : []), ...items.map((i) => i.key)];
    const r = await markRemindersRead(client, userId, keys);
    if (r.ok) setRead((s) => new Set([...s, ...keys]));
  };

  // night task 2026-10-19: a notification's own subject (quote / task / client) - the Dashboard opens it through the same unsaved-work
  // guard as every other navigation; the notification becomes read and the panel / floating notice closes
  const A = BELL_ACTION_COPY[isHebrew ? 'he' : 'en'];
  const [notice, setNotice] = useState(null);
  const openSubject = (item, action) => {
    setOpen(false);
    setNotice(null);
    markRemindersRead(client, userId, [item.key]).then((r) => { if (r?.ok) setRead((s) => new Set([...s, item.key])); }).catch(() => {});
    // an announcement's action opens the ONE existing assistant through its existing window event (like the welcome item)
    if (action.kind === 'assistant') { window.dispatchEvent(new CustomEvent('open-proflow-ai-chat')); return; }
    // Owner 2026-10-20 (L-17): the SMART PACK announcement opens the ONE plans view (the Dashboard listens)
    if (action.kind === 'plans') { window.dispatchEvent(new CustomEvent('tekango:open-plans')); return; }
    window.dispatchEvent(new CustomEvent(BELL_SUBJECT_EVENT, { detail: { ...action } }));
  };
  const actionsFor = (item) => bellActionsFor(item, tasks, upgradeQuoteId);

  // the floating notice: a NEW unread notification floats once (newest, "+N" for the others); the first run in this browser only
  // records the existing notifications (nothing floats); another tab of the same account never floats it again
  const [floated, setFloated] = useState(null);
  // the first run's baseline stays open for a few seconds: lists that settle in two steps (cache, then server) never float on that run
  const baselineUntilRef = useRef(0);
  const baselineStartRef = useRef(0);
  // the quotes must be the server's list of this load, not the browser's cached copy: a notification present only in the fresh list
  // would otherwise look new on the first run and float
  // (and the full list: a short list without first_viewed_at would hide every link-view notification from the first-run memory)
  const floatReady = shown && !!userId && settingsLoaded && tasksLoaded && readLoaded && (quotesFresh ?? quotesReady)
    && (quotes.length === 0 || firstViewAvailableFor(quotes));
  useEffect(() => {
    if (!floatReady || floated) return;
    const stored = loadFloatedKeys(userId);
    if (stored === null) {
      const baseline = new Set(items.map((i) => i.key));
      saveFloatedKeys(userId, baseline);
      baselineStartRef.current = Date.now();
      baselineUntilRef.current = Date.now() + 4000;
      setFloated(baseline);
    } else setFloated(stored);
  }, [floatReady, floated, userId, items]);
  useEffect(() => {
    if (!userId) return undefined;
    const onStorage = (e) => { if (e.key === floatedStorageKey(userId)) setFloated(loadFloatedKeys(userId) || new Set()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [userId]);
  useEffect(() => {
    if (!floated || notice) return;
    // re-read the shared memory right before showing, so a second tab that already floated it stays quiet
    const latest = loadFloatedKeys(userId) || floated;
    const pending = pendingFloating(items, read, latest);
    if (!pending.length) return;
    const next = new Set([...latest, ...pending.map((i) => i.key)]);
    saveFloatedKeys(userId, next);
    setFloated(next);
    if (Date.now() < baselineUntilRef.current) {
      // still the first run's baseline: recorded, not floated; a list still arriving keeps it open (at most 20 s after the start)
      baselineUntilRef.current = Math.min(Date.now() + 4000, baselineStartRef.current + 20000);
      return;
    }
    const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
    if (!open && visible) setNotice({ item: pending[0], more: pending.length - 1 });
  }, [floated, notice, items, read, open, userId]);
  useEffect(() => { if (settings.mode === 'off') setNotice(null); }, [settings.mode]);

  // Owner 2026-10-20 placement (replaces 2026-10-19): the notice floats exactly where the bell panel opens, at the panel's size, on
  // the phone and on the computer - the same placement function as the panel, anchored to this (visible) bell.
  const [noticePos, setNoticePos] = useState(null);
  useLayoutEffect(() => {
    if (!notice || !btnRef.current) { setNoticePos(null); return undefined; }
    const place = () => setNoticePos(panelPlacement(btnRef.current, isHebrew));
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [notice, isHebrew]);
  useEffect(() => {
    if (!notice) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && document.activeElement?.closest?.('[data-testid="bell-float-notice"]')) setNotice(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [notice]);

  // R-28 (night task 2026-10-16): the meta line is a list of isolated parts (a name in its own script, dates / times as LTR numbers),
  // so a name and a date never swap sides with the script of the name
  const txt = (text) => ({ text, num: false });
  const num = (text) => ({ text, num: true });
  const line = (i) => {
    if (i.kind === 'announce') { const ac = i.copy[isHebrew ? 'he' : 'en']; return { title: ac.title, meta: [txt(ac.body)] }; }
    if (i.kind === 'task_due') return { title: C.item.task_due(i), meta: i.overdue ? [txt(C.item.task_due_overdue), num(formatShortDate(i.date, dateMarket))] : [txt(C.item.today), ...(i.time ? [num(i.time)] : [])] };
    const n = displayQuoteNumber(i.quote);
    // the truthful party label (client name, else quote title); the number is already in the line, so never repeat it
    const p = quotePartyLabel(i.quote);
    const party = p.kind === 'number' ? '' : p.text;
    if (i.kind === 'first_view') return { title: C.item.first_view(n), meta: [...(party ? [txt(party)] : []), num(formatShortDateTime(i.at, dateMarket))] };
    // Owner 2026-10-19 (L-17): the customer signed - the client and the signing time (server time, market format)
    if (i.kind === 'signed') return { title: C.item.signed(n), meta: [...(party ? [txt(party)] : []), num(formatShortDateTime(i.at, dateMarket))] };
    if (i.kind === 'viewed_not_approved') return { title: C.item.viewed_not_approved(n, i.days), meta: party ? [txt(party)] : [] };
    return { title: C.item.validity_ending(n, i.daysLeft), meta: [num(formatShortDate(i.validUntil, dateMarket))] };
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
          style={{ ...panelBox(pos), zIndex: 2000 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: `1px solid ${NEON.border}`, gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{C.center.title}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              {readPersisted && unread > 0 && (
                // PRODUCT_TRUTH_CAPABILITY: reminders_automation
                <button type="button" onClick={markAll} style={{ background: 'none', border: 0, color: '#0F6672', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', padding: '6px 0', fontFamily: 'inherit' }}>{C.center.markAll}</button>
              )}
              {/* Owner 2026-10-20: the panel closes on its own X too (not only outside / Escape) */}
              {/* PRODUCT_TRUTH_CAPABILITY: reminders_automation */}
              <button type="button" data-testid="notification-center-close" aria-label={A.closePanel} title={A.closePanel} onClick={() => { setOpen(false); btnRef.current?.focus(); }}
                style={closeBtnStyle(mobile)}>
                <X size={16} aria-hidden="true" />
              </button>
            </span>
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
            // R-10: while the quotes are still loading the panel says so - never "no reminders" for a list that is not there yet
            <div style={{ padding: '14px', fontSize: '0.8rem', color: NEON.textSecondary }}>{quotesReady ? C.center.empty : C.center.loading}</div>
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
                      {l.meta.length > 0 && (
                        <div style={{ color: NEON.textSecondary, fontSize: '0.72rem', marginTop: 2 }}>
                          {l.meta.map((part, k) => (
                            <Fragment key={k}>{k > 0 && ' · '}{part.num ? <bdi className="pf-num" dir="ltr">{part.text}</bdi> : <bdi>{part.text}</bdi>}</Fragment>
                          ))}
                        </div>
                      )}
                      {(actionsFor(i).length > 0 || (readPersisted && !isRead)) && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 }}>
                          {actionsFor(i).map((a) => (
                            // PRODUCT_TRUTH_CAPABILITY: reminders_automation
                            <button key={a.kind} type="button" data-testid={`notification-action-${a.kind}`} onClick={() => openSubject(i, a)} style={actionBtnStyle(mobile)}>
                              {A[a.kind]}
                            </button>
                          ))}
                          {readPersisted && !isRead && (
                            // Owner 2026-10-20: one notification marked read on its own (the panel stays open)
                            // PRODUCT_TRUTH_CAPABILITY: reminders_automation
                            <button type="button" data-testid="notification-mark-read" onClick={() => markOne(i.key)}
                              style={{ background: 'none', border: 0, color: '#0F6672', fontWeight: 600, fontSize: '0.74rem', cursor: 'pointer', padding: '6px 4px', minHeight: mobile ? 44 : 30, fontFamily: 'inherit' }}>
                              {A.markRead}
                            </button>
                          )}
                        </div>
                      )}
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
      {notice && noticePos && typeof document !== 'undefined' && createPortal(
        <div data-testid="bell-float-notice" role="status" aria-live="polite" aria-label={A.region} dir={isHebrew ? 'rtl' : 'ltr'} className="no-print"
          data-notice-kind={notice.item.kind}
          style={{ ...panelBox(noticePos), zIndex: 2100 }}>
          {/* the panel's own header row (title + close) and item row, so it reads as the bell panel holding the one new notification */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBlock: 6, paddingInlineStart: 14, paddingInlineEnd: 8, borderBottom: `1px solid ${NEON.border}`, gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{C.center.title}</span>
            {/* PRODUCT_TRUTH_CAPABILITY: reminders_automation */}
            <button type="button" data-testid="bell-float-close" aria-label={A.close} title={A.close} onClick={() => setNotice(null)}
              style={closeBtnStyle(mobile)}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '10px minmax(0,1fr)', gap: 10, padding: '10px 14px' }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, background: KIND_COLOR[notice.item.kind] }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', overflowWrap: 'anywhere' }} dir="auto">{line(notice.item).title}</div>
              {line(notice.item).meta.length > 0 && (
                <div style={{ color: NEON.textSecondary, fontSize: '0.72rem', marginTop: 2 }}>
                  {line(notice.item).meta.map((part, k) => (
                    <Fragment key={k}>{k > 0 && ' · '}{part.num ? <bdi className="pf-num" dir="ltr">{part.text}</bdi> : <bdi>{part.text}</bdi>}</Fragment>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                {actionsFor(notice.item).map((a) => (
                  // PRODUCT_TRUTH_CAPABILITY: reminders_automation
                  <button key={a.kind} type="button" data-testid={`bell-float-action-${a.kind}`} onClick={() => openSubject(notice.item, a)} style={actionBtnStyle(mobile)}>
                    {A[a.kind]}
                  </button>
                ))}
                {notice.more > 0 && (
                  // PRODUCT_TRUTH_CAPABILITY: reminders_automation
                  <button type="button" data-testid="bell-float-more" onClick={() => { setNotice(null); setOpen(true); }}
                    style={{ ...actionBtnStyle(mobile), border: 0, textDecoration: 'underline' }}>
                    <bdi className="pf-num">{A.more(notice.more)}</bdi>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// the bell panel's place under its bell (the floating notice uses the very same place and size)
function panelPlacement(btn, isHebrew) {
  const r = btn.getBoundingClientRect();
  const width = Math.min(360, window.innerWidth - 16);
  const left = isHebrew ? Math.max(8, Math.min(r.left - 12, window.innerWidth - width - 8)) : Math.max(8, Math.min(r.right + 12 - width, window.innerWidth - width - 8));
  return { top: r.bottom + 10, left, width };
}
function panelBox(p) {
  return { position: 'fixed', top: p.top, left: p.left, width: p.width, maxHeight: 'min(70vh, 520px)', overflowY: 'auto', background: '#fff', color: NEON.textPrimary, borderRadius: 14, boxShadow: '0 18px 40px -10px rgba(15,23,42,.35)', border: `1px solid ${NEON.border}`, textAlign: 'start', fontWeight: 400 };
}

// the round X of the panel and of the floating notice; a 44px touch target on the phone
function closeBtnStyle(phone) {
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: phone ? 44 : 32, height: phone ? 44 : 32, padding: 0, border: 0, borderRadius: 999, background: 'rgba(15,23,42,0.06)', color: NEON.textPrimary, cursor: 'pointer', flex: 'none' };
}

// the subject buttons: an outlined pill (the welcome item's AI button style); a 44px touch target on the phone
function actionBtnStyle(phone) {
  return { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: phone ? 44 : 30, padding: '4px 12px', border: '1px solid #0F6672', borderRadius: 999, background: 'none', color: '#0F6672', fontWeight: 700, fontSize: '0.74rem', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' };
}
