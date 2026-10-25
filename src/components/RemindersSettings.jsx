// Task 20 (Phase 4) - the ONE Reminders & automation screen, opened only from the entry button inside Business settings (Owner
// clarification 2026-10-09). Everything lives here: the three modes (In-app only default / Off / Full after explicit activation), the
// checkbox behaviors, per-rule setup with preview and pause, timing, sending hours, time zone, pause-all and action history.
// Visual language: the Owner-approved Phase 4 sketches (evidence/task20-phase4/sketches). Data path: src/utils/reminders.js.
// Nothing here sends anything: customer sending / automation execution are reported inactive until a server activation exists.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowLeft, BellRing, Check, PauseCircle, PlayCircle, History, Clock, MessageCircle } from 'lucide-react';
import { APP as NEON, RADIUS, SHADOW } from '../theme/neonTheme';
import { formatShortDateTime } from '../utils/shortDate';
import {
  REMINDERS_COPY, AUDIT_ACTION_COPY, BEHAVIORS, DAY_CHOICES, WEEKDAYS, DEFAULT_TEMPLATES, TEMPLATE_TOKENS, INTERNATIONAL_SENDING_TIME_ZONES,
  normalizeReminderSettings, behaviorBlockers, resolveSendingTimeZone, renderTemplateText, loadReminderSettings, saveReminderSettings,
  listReminderAudit, SERVER_AUTOMATION_ACTIVE, CUSTOMER_SENDING_ACTIVE,
} from '../utils/reminders';

const TEAL = '#0F6672';
const VIOLET = '#5B3FB6';
const HALF_HOURS = Array.from({ length: 33 }, (_, i) => { const m = 6 * 60 + i * 30; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; });
const css = `
.pf-rem { display: flex; flex-direction: column; gap: 14px; }
.pf-rem-card { background: ${NEON.bgCard}; border-radius: ${RADIUS.lg}; padding: 16px; box-shadow: ${SHADOW.sm}; }
.pf-rem-modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 12px; }
.pf-rem-mode { border: 1.5px solid ${NEON.border}; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 6px; cursor: pointer; background: ${NEON.bgCard}; text-align: start; font: inherit; color: inherit; min-height: 44px; }
.pf-rem-mode[aria-checked="true"] { border-color: ${TEAL}; background: #E3F1F2; }
.pf-rem-mode.full { border-color: #B9A9EC; }
.pf-rem-mode.full[aria-checked="true"] { border-color: ${VIOLET}; background: #F3F0FC; }
.pf-rem-mode:disabled { cursor: not-allowed; opacity: .72; }
.pf-rem-row { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; column-gap: 10px; row-gap: 6px; padding: 10px 0; border-bottom: 1px solid ${NEON.border}; align-items: start; }
.pf-rem-row:last-child { border-bottom: 0; }
.pf-rem-end { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
.pf-rem-two { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 14px; align-items: start; }
.pf-rem-tag { font-size: 0.68rem; font-weight: 700; border-radius: 999px; padding: 1px 8px; white-space: nowrap; }
.pf-rem-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border-radius: 9px; padding: 8px 14px; min-height: 40px; font-weight: 700; font-size: 0.8rem; border: 1px solid ${NEON.borderStrong}; background: ${NEON.bgCard}; color: ${NEON.textPrimary}; cursor: pointer; white-space: nowrap; font-family: inherit; }
.pf-rem-btn:disabled { opacity: .55; cursor: not-allowed; }
.pf-rem-btn.pri { background: ${TEAL}; border-color: ${TEAL}; color: #fff; }
.pf-rem-btn.full { background: linear-gradient(135deg, ${VIOLET}, ${TEAL}); border: 0; color: #fff; }
.pf-rem-sel { border: 1px solid ${NEON.borderStrong}; border-radius: 8px; padding: 6px 8px; min-height: 36px; background: ${NEON.bgInput}; color: ${NEON.textPrimary}; font: inherit; font-size: 0.8rem; }
.pf-rem-kv { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 10px 12px; align-items: start; }
.pf-rem-kv dt { color: ${NEON.textSecondary}; font-size: 0.75rem; font-weight: 600; padding-top: 6px; }
.pf-rem-kv dd { margin: 0; min-width: 0; }
.pf-rem-input { width: 100%; box-sizing: border-box; border: 1px solid ${NEON.borderStrong}; border-radius: 8px; padding: 7px 10px; background: ${NEON.bgInput}; color: ${NEON.textPrimary}; font: inherit; font-size: 0.85rem; }
.pf-rem-callout { border-radius: 10px; padding: 10px 12px; font-size: 0.78rem; line-height: 1.45; }
.pf-rem-days { display: flex; flex-wrap: wrap; gap: 6px; }
.pf-rem-day { min-width: 40px; min-height: 36px; border-radius: 8px; border: 1px solid ${NEON.borderStrong}; background: ${NEON.bgCard}; font: inherit; font-size: 0.78rem; font-weight: 700; cursor: pointer; color: ${NEON.textPrimary}; }
.pf-rem-day[aria-pressed="true"] { background: ${TEAL}; border-color: ${TEAL}; color: #fff; }
.pf-rem-mail { border: 1px solid ${NEON.border}; border-radius: 12px; overflow: hidden; }
.pf-rem-num { direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums lining-nums; }
@media (max-width: 900px) { .pf-rem-modes { grid-template-columns: minmax(0, 1fr); } .pf-rem-two { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 640px) {
  .pf-rem-card { padding: 12px; }
  .pf-rem-row { grid-template-columns: 22px minmax(0, 1fr); }
  .pf-rem-row .pf-rem-end { grid-column: 2; justify-content: flex-start; }
  .pf-rem-kv { grid-template-columns: minmax(0, 1fr); gap: 2px 0; }
  .pf-rem-kv dt { padding-top: 8px; }
}
`;

function Box({ checked, disabled, onChange, label }) {
  return (
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={label}
      style={{ width: 18, height: 18, margin: '2px 0 0', accentColor: TEAL, cursor: disabled ? 'not-allowed' : 'pointer' }} />
  );
}

function Tag({ tone = 'off', children }) {
  const tones = { def: [TEAL, '#fff'], opt: ['#EFEAFB', VIOLET], off: ['#F1F3F4', NEON.textMuted], warn: ['#FFF3E0', '#8B621E'], ok: ['#E8F3EE', '#2B6C51'] };
  const [bg, fg] = tones[tone] || tones.off;
  return <span className="pf-rem-tag" style={{ background: bg, color: fg }}>{children}</span>;
}

export default function RemindersSettings({ isHebrew, isLocalIsraeliBusiness, client, userId, bizName, onBack }) {
  const lang = isHebrew ? 'he' : 'en';
  const C = REMINDERS_COPY[lang];
  const local = isLocalIsraeliBusiness === true;
  const [load, setLoad] = useState({ state: 'loading', code: null });
  const [saved, setSaved] = useState(() => normalizeReminderSettings(null));
  const [draft, setDraft] = useState(() => normalizeReminderSettings(null));
  const [status, setStatus] = useState(null); // 'saving' | 'saved' | 'failed'
  const [confirmFull, setConfirmFull] = useState(false);
  const [openRule, setOpenRule] = useState(null);
  const [audit, setAudit] = useState([]);
  const available = load.state === 'ready';
  const locked = !available; // honest: nothing is editable while the server cannot store it

  const reload = useCallback(async () => {
    setLoad({ state: 'loading', code: null });
    const r = await loadReminderSettings(client, userId);
    if (r.ok) {
      setSaved(r.data.settings); setDraft(r.data.settings); setLoad({ state: 'ready', code: null });
      const a = await listReminderAudit(client, userId);
      if (a.ok) setAudit(a.data);
    } else setLoad({ state: 'error', code: r.error.code });
  }, [client, userId]);
  useEffect(() => { reload(); }, [reload]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const set = (patch) => { setStatus(null); setDraft((d) => ({ ...d, ...patch })); };
  const setBehavior = (id, on) => set({ behaviors: { ...draft.behaviors, [id]: on } });
  const setDays = (id, v) => { const days = { ...draft.days }; if (v) days[id] = Number(v); else delete days[id]; set({ days }); };
  const setRule = (id, patch) => set({ rules: { ...draft.rules, [id]: { ...draft.rules[id], ...patch } } });
  const ruleWithDefaults = (id) => {
    const r = draft.rules[id] || {};
    return r.subject || r.body ? r : { ...r, subject: DEFAULT_TEMPLATES[lang][id].subject, body: DEFAULT_TEMPLATES[lang][id].body };
  };
  const openRuleSetup = (id) => {
    const r = draft.rules[id] || {};
    if (!r.subject && !r.body && !locked) setRule(id, { subject: DEFAULT_TEMPLATES[lang][id].subject, body: DEFAULT_TEMPLATES[lang][id].body });
    setOpenRule(openRule === id ? null : id);
  };

  const save = async () => {
    setStatus('saving');
    const r = await saveReminderSettings(client, userId, draft);
    if (r.ok) {
      setSaved(r.data.settings); setDraft(r.data.settings); setStatus('saved');
      const a = await listReminderAudit(client, userId); if (a.ok) setAudit(a.data);
    } else setStatus('failed');
  };

  const ctx = { firstViewAvailable: available, serverAutomationAvailable: SERVER_AUTOMATION_ACTIVE, customerSendingAvailable: CUSTOMER_SENDING_ACTIVE, isLocal: local };
  const zone = resolveSendingTimeZone({ isLocal: local, chosenZone: draft.timeZone });
  const sw = draft.sendWindow || { days: [], start: '', end: '' };
  const setWindow = (patch) => {
    const w = { ...sw, ...patch };
    set({ sendWindow: w.days.length && w.start && w.end && w.start < w.end ? { ...w, days: [...w.days].sort() } : (w.days.length || w.start || w.end ? w : null) });
  };
  const Arrow = isHebrew ? ArrowRight : ArrowLeft;
  const sample = { ...C.rule.sample, business_name: bizName || (isHebrew ? 'העסק שלי' : 'My Business') };

  const renderRow = (b) => {
    const [title, meta] = C.behaviors[b.id];
    const blockers = behaviorBlockers(draft, b.id, ctx);
    const full = b.group === 'full';
    const disabledBox = locked || draft.mode === 'off' || (full && draft.mode !== 'full');
    const visibleBlockers = blockers.filter((x) => x !== 'not_selected' && !(x === 'full_mode_required' && !draft.behaviors[b.id]));
    return (
      <div key={b.id} className="pf-rem-row" data-testid={`rem-behavior-${b.id}`}>
        {/* PRODUCT_TRUTH_CAPABILITY: reminders_automation */}
        <Box checked={!!draft.behaviors[b.id]} disabled={disabledBox} onChange={(v) => setBehavior(b.id, v)} label={title} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: NEON.textPrimary }}>{title}</div>
          <div style={{ fontSize: '0.75rem', color: NEON.textSecondary, marginTop: 2 }}>{meta}</div>
          {draft.behaviors[b.id] && draft.mode !== 'off' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {blockers.length === 0 ? <Tag tone="ok">{C.ready}</Tag> : visibleBlockers.map((x) => <Tag key={x} tone="warn">{C.blockers[x]}</Tag>)}
            </div>
          )}
        </div>
        <div className="pf-rem-end">
          {b.needsDays && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: NEON.textSecondary }}>
              {/* PRODUCT_TRUTH_CAPABILITY: reminders_automation */}
              <select className="pf-rem-sel" value={draft.days[b.id] || ''} disabled={locked} onChange={(e) => setDays(b.id, e.target.value)} aria-label={`${title} — ${C.chooseDays}`}
                style={!draft.days[b.id] ? { borderStyle: 'dashed', borderColor: '#C99A4A' } : undefined}>
                <option value="">{C.chooseDays}</option>
                {DAY_CHOICES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <span>{b.id === 'validity_ending' || b.id === 'customer_validity_email' ? C.daysBefore : C.daysAfterView}</span>
            </label>
          )}
          {b.customer && (
            // PRODUCT_TRUTH_CAPABILITY: reminders_automation
            <button type="button" className="pf-rem-btn" onClick={() => openRuleSetup(b.id)} aria-expanded={openRule === b.id} data-testid={`rem-configure-${b.id}`}>
              {C.configure}
            </button>
          )}
          {full && draft.mode !== 'full' && <Tag tone="opt">{C.needsFull}</Tag>}
        </div>
        {b.customer && openRule === b.id && <div style={{ gridColumn: '1 / -1' }}>{renderRuleSetup(b.id)}</div>}
      </div>
    );
  };

  function renderRuleSetup(id) {
    const r = ruleWithDefaults(id);
    const tokens = Object.values(TEMPLATE_TOKENS[lang]);
    const blockers = behaviorBlockers(draft, id, ctx);
    const subject = renderTemplateText(r.subject, lang, sample);
    const bodyLines = renderTemplateText(r.body, lang, sample).split('\n');
    return (
      <div className="pf-rem-two" style={{ marginTop: 8, padding: 12, background: NEON.bgCardAlt, borderRadius: 12 }} data-testid={`rem-rule-${id}`}>
        <div>
          <dl className="pf-rem-kv">
            <dt>{C.rule.trigger}</dt><dd style={{ fontSize: '0.82rem' }}>{C.rule.triggers[id]}</dd>
            <dt>{C.rule.timing}</dt><dd style={{ fontSize: '0.82rem' }}>{draft.days[id] ? <><span className="pf-rem-num">{draft.days[id]}</span> {id === 'customer_validity_email' ? C.daysBefore : C.daysAfterView}</> : <Tag tone="warn">{C.chooseDays}</Tag>} · {C.rule.withinHours}</dd>
            <dt>{C.rule.recipient}</dt><dd style={{ fontSize: '0.82rem' }}>{C.rule.recipientText}</dd>
            <dt>{C.rule.channel}</dt><dd style={{ fontSize: '0.82rem', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>{C.rule.channelText} <Tag>{C.rule.waManual}</Tag></dd>
            <dt>{C.rule.language}</dt><dd style={{ fontSize: '0.82rem' }}>{C.rule.languageText}</dd>
            <dt><label htmlFor={`rem-subject-${id}`}>{C.rule.subject}</label></dt>
            {/* PRODUCT_TRUTH_CAPABILITY: reminders_automation */}
            <dd><input id={`rem-subject-${id}`} className="pf-rem-input" value={r.subject} disabled={locked} maxLength={200} onChange={(e) => setRule(id, { subject: e.target.value })} /></dd>
            <dt><label htmlFor={`rem-body-${id}`}>{C.rule.body}</label></dt>
            {/* PRODUCT_TRUTH_CAPABILITY: reminders_automation */}
            <dd><textarea id={`rem-body-${id}`} className="pf-rem-input" rows={5} value={r.body} disabled={locked} maxLength={4000} onChange={(e) => setRule(id, { body: e.target.value })} style={{ lineHeight: 1.45, resize: 'vertical' }} />
              <div style={{ fontSize: '0.7rem', color: NEON.textMuted, marginTop: 4 }}>{C.rule.tokens}: {tokens.map((t) => <code key={t} style={{ background: '#E3F1F2', color: '#0B4F58', borderRadius: 4, padding: '0 4px', marginInlineEnd: 4 }}>{t}</code>)}</div></dd>
          </dl>
          <div className="pf-rem-callout" style={{ background: '#E3F1F2', color: '#0B4F58', marginTop: 10 }}>{C.rule.safety.map((s) => <div key={s}>✓ {s}</div>)}</div>
          {blockers.length > 0 && (
            <div className="pf-rem-callout" style={{ background: '#FFF3E0', color: '#6E420C', marginTop: 8 }}>
              {C.rule.needsToRun} {blockers.filter((x) => x !== 'unknown_behavior').map((x) => C.blockers[x]).join(' · ')}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {/* PRODUCT_TRUTH_CAPABILITY: reminders_automation */}
            <button type="button" className="pf-rem-btn" disabled={locked} onClick={() => setRule(id, { paused: !draft.rules[id]?.paused })}>
              {draft.rules[id]?.paused ? <PlayCircle size={15} /> : <PauseCircle size={15} />}{draft.rules[id]?.paused ? C.rule.resumeRule : C.rule.pauseRule}
            </button>
            {/* PRODUCT_TRUTH_DECORATIVE: closes the inline rule panel; changes no data */}
            <button type="button" className="pf-rem-btn" onClick={() => setOpenRule(null)}>{C.rule.done}</button>
          </div>
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: 8 }}>{C.rule.preview}</div>
          <div className="pf-rem-mail" dir={isHebrew ? 'rtl' : 'ltr'} data-testid={`rem-preview-${id}`}>
            <div style={{ background: '#F7F9FA', padding: '8px 12px', fontSize: '0.72rem', color: NEON.textSecondary, borderBottom: `1px solid ${NEON.border}` }}>
              {C.rule.previewTo.replace('{business}', sample.business_name)}<br /><b style={{ color: NEON.textPrimary, fontSize: '0.8rem' }}>{subject}</b>
            </div>
            <div style={{ padding: 14, fontSize: '0.82rem', lineHeight: 1.5, background: '#fff', color: '#1e293b' }}>
              {bodyLines.map((l, i) => <p key={i} style={{ margin: '0 0 6px' }} dir="auto">{l}</p>)}
              <div style={{ fontSize: '0.7rem', color: NEON.textMuted, borderTop: `1px dashed ${NEON.border}`, paddingTop: 8, marginTop: 10 }}>
                {C.rule.stopFooter.replace('{business}', sample.business_name)} <u style={{ color: TEAL }}>{C.rule.stopLink}</u>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pf-rem" data-testid="reminders-settings">
      <style>{css}</style>
      <div>
        {/* PRODUCT_TRUTH_DECORATIVE: navigation back to the Business settings screen; changes no data */}
        <button type="button" className="pf-rem-btn" onClick={onBack} data-testid="reminders-back"><Arrow size={15} />{C.back}</button>
      </div>

      <div className="pf-rem-card">
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8, color: NEON.textPrimary }}><BellRing size={18} color={TEAL} />{C.title}</h2>
        <div style={{ color: NEON.textSecondary, fontSize: '0.8rem', marginTop: 3 }}>{C.sub}</div>
        {load.state === 'error' && (
          <div className="pf-rem-callout" role="status" style={{ background: '#FFF3E0', color: '#6E420C', marginTop: 12 }} data-testid="reminders-unavailable">
            {load.code === 'unavailable' ? C.unavailable : C.saveFailed}
          </div>
        )}
        <div className="pf-rem-modes" role="radiogroup" aria-label={C.title}>
          {['in_app', 'off', 'full'].map((m) => (
            // PRODUCT_TRUTH_CAPABILITY: reminders_automation
            <button key={m} type="button" role="radio" aria-checked={draft.mode === m} disabled={locked} className={`pf-rem-mode${m === 'full' ? ' full' : ''}`}
              data-testid={`rem-mode-${m}`} onClick={() => (m === 'full' && draft.mode !== 'full' ? setConfirmFull(true) : set({ mode: m }))}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: '0.88rem', flexWrap: 'wrap' }}>
                <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${draft.mode === m ? (m === 'full' ? VIOLET : TEAL) : NEON.textMuted}`, background: draft.mode === m ? (m === 'full' ? VIOLET : TEAL) : 'transparent', boxShadow: draft.mode === m ? 'inset 0 0 0 3px #fff' : 'none', flex: 'none' }} />
                {C.modes[m]}
                {C.modeTags[m] && <Tag tone={m === 'in_app' ? 'def' : 'opt'}>{C.modeTags[m]}</Tag>}
              </span>
              <span style={{ fontSize: '0.78rem', color: NEON.textSecondary }}>{C.modeText[m]}</span>
              {m === 'full' && draft.mode !== 'full' && <span className="pf-rem-btn full" style={{ alignSelf: 'flex-start', marginTop: 4 }}>{C.turnOnFull}</span>}
            </button>
          ))}
        </div>
        {confirmFull && (
          <div role="dialog" aria-modal="false" aria-labelledby="rem-full-title" className="pf-rem-callout" style={{ background: '#F3F0FC', color: '#2E2166', marginTop: 12, border: `1px solid #B9A9EC` }} data-testid="rem-full-confirm">
            <div id="rem-full-title" style={{ fontWeight: 800, marginBottom: 4 }}>{C.fullConfirmTitle}</div>
            <div>{C.fullConfirmText}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {/* PRODUCT_TRUTH_CAPABILITY: reminders_automation */}
              <button type="button" className="pf-rem-btn full" onClick={() => { set({ mode: 'full' }); setConfirmFull(false); }} data-testid="rem-full-yes">{C.fullConfirmYes}</button>
              {/* PRODUCT_TRUTH_DECORATIVE: dismisses the Full-mode confirmation; changes no data */}
              <button type="button" className="pf-rem-btn" onClick={() => setConfirmFull(false)}>{C.cancel}</button>
            </div>
          </div>
        )}
        {draft.mode === 'full' && !CUSTOMER_SENDING_ACTIVE && (
          <div className="pf-rem-callout" style={{ background: '#FFF3E0', color: '#6E420C', marginTop: 12 }} data-testid="rem-sending-inactive">{C.customerSendingInactive}</div>
        )}
      </div>

      <div className="pf-rem-card">
        <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0 0 6px', color: NEON.textPrimary }}>{C.whatTitle}</h3>
        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: NEON.textMuted, margin: '10px 0 2px' }}>{C.groupInApp}</div>
        {BEHAVIORS.filter((b) => b.group === 'in_app').map(renderRow)}
        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: NEON.textMuted, margin: '14px 0 2px', display: 'flex', gap: 8, alignItems: 'center' }}>{C.groupFull}<Tag tone="opt">{C.groupFullTag}</Tag></div>
        {BEHAVIORS.filter((b) => b.group === 'full').map(renderRow)}
        <div className="pf-rem-row" data-testid="rem-whatsapp-manual">
          <Box checked={false} disabled onChange={() => {}} label={C.waTitle} />
          <div><div style={{ fontWeight: 700, fontSize: '0.85rem', color: NEON.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}><MessageCircle size={14} />{C.waTitle}</div><div style={{ fontSize: '0.75rem', color: NEON.textSecondary, marginTop: 2 }}>{C.waText}</div></div>
          <div className="pf-rem-end"><Tag>{C.waTag}</Tag></div>
        </div>
      </div>

      <div className="pf-rem-two">
        <div className="pf-rem-card" data-testid="rem-sending-times">
          <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: '0 0 8px', color: NEON.textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={15} color={TEAL} />{C.sendTitle}</h3>
          <dl className="pf-rem-kv">
            <dt>{C.zone}</dt>
            <dd style={{ fontSize: '0.82rem' }}>
              {local ? C.zoneLocal : (
                <>
                  {/* PRODUCT_TRUTH_CAPABILITY: reminders_automation */}
                  <select className="pf-rem-sel" value={draft.timeZone || ''} disabled={locked} onChange={(e) => set({ timeZone: e.target.value || null })} aria-label={C.zone} data-testid="rem-zone" dir="ltr">
                    <option value="">{C.zoneChoose}</option>
                    {INTERNATIONAL_SENDING_TIME_ZONES.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
                  </select>
                  {!zone && <div className="pf-rem-callout" style={{ background: '#FFF3E0', color: '#6E420C', marginTop: 6 }}>{C.zoneIntlMissing}</div>}
                </>
              )}
            </dd>
            <dt>{C.hours}</dt>
            <dd>
              <div className="pf-rem-days" role="group" aria-label={C.hours}>
                {WEEKDAYS.map((d) => (
                  // PRODUCT_TRUTH_CAPABILITY: reminders_automation
                  <button key={d} type="button" className="pf-rem-day" aria-pressed={sw.days.includes(d)} disabled={locked}
                    onClick={() => setWindow({ days: sw.days.includes(d) ? sw.days.filter((x) => x !== d) : [...sw.days, d] })}>{C.weekdays[d]}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap', fontSize: '0.78rem' }}>
                <span>{C.from}</span>
                {/* PRODUCT_TRUTH_CAPABILITY: reminders_automation */}
                <select className="pf-rem-sel pf-rem-num" value={sw.start} disabled={locked} onChange={(e) => setWindow({ start: e.target.value })} aria-label={`${C.hours} ${C.from}`}>
                  <option value="">--:--</option>{HALF_HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <span>{C.to}</span>
                {/* PRODUCT_TRUTH_CAPABILITY: reminders_automation */}
                <select className="pf-rem-sel pf-rem-num" value={sw.end} disabled={locked} onChange={(e) => setWindow({ end: e.target.value })} aria-label={`${C.hours} ${C.to}`}>
                  <option value="">--:--</option>{HALF_HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              {!draft.sendWindow && <div style={{ fontSize: '0.72rem', color: '#8B621E', marginTop: 6 }}>{C.hoursMissing}</div>}
            </dd>
          </dl>
        </div>
        <div className="pf-rem-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: NEON.textPrimary }}>{C.pauseTitle}</h3>
              <div style={{ fontSize: '0.75rem', color: NEON.textSecondary, marginTop: 3 }}>{C.pauseText}</div>
            </div>
            {/* PRODUCT_TRUTH_CAPABILITY: reminders_automation */}
            <button type="button" role="switch" aria-checked={draft.paused} aria-label={C.pauseTitle} disabled={locked} onClick={() => set({ paused: !draft.paused })} data-testid="rem-pause"
              style={{ width: 44, height: 26, borderRadius: 999, border: 0, background: draft.paused ? TEAL : '#C9D1D4', position: 'relative', cursor: locked ? 'not-allowed' : 'pointer', flex: 'none' }}>
              <span aria-hidden="true" style={{ position: 'absolute', top: 3, insetInlineStart: draft.paused ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff' }} />
            </button>
          </div>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 800, margin: '16px 0 6px', color: NEON.textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}><History size={14} color={TEAL} />{C.historyTitle}</h3>
          {audit.length === 0 ? <div style={{ fontSize: '0.75rem', color: NEON.textMuted }}>{C.historyEmpty}</div> : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, fontSize: '0.75rem' }}>
              {audit.map((a) => (
                <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0', borderBottom: `1px solid ${NEON.border}` }}>
                  <span>{AUDIT_ACTION_COPY[lang][a.action] || a.action}{a.detail?.mode ? ` — ${C.modes[a.detail.mode] || ''}` : ''}</span>
                  <span className="pf-rem-num" style={{ color: NEON.textMuted }}>{formatShortDateTime(a.at, local ? 'Local' : 'International')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* PRODUCT_TRUTH_CAPABILITY: reminders_automation */}
        <button type="button" className="pf-rem-btn pri" disabled={locked || !dirty || status === 'saving'} onClick={save} data-testid="rem-save">
          {status === 'saving' ? C.saving : C.save}
        </button>
        {status === 'saved' && !dirty && <span role="status" style={{ color: '#2B6C51', fontSize: '0.8rem', display: 'inline-flex', gap: 4, alignItems: 'center' }}><Check size={14} />{C.saved}</span>}
        {status === 'failed' && <span role="alert" style={{ color: NEON.red, fontSize: '0.8rem' }}>{C.saveFailed}</span>}
      </div>
    </div>
  );
}
