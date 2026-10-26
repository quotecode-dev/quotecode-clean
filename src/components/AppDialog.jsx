// Owner console 2026-10-26 (typed: "מאשר החלפת חלונות הדפדפן בחלון של המערכת בעברית ובאנגלית, כולל שינוי ב-L-01, L-09, L-13, L-15, L-17,
// L-24, L-26, L-27, L-28 ובבדיקות השומרות שלהם"): every question, notice and copy-by-hand text is the app's own window - never the
// browser's ("www.tekango.com says" with OK / Cancel in the browser's language). Hebrew right to left, English left to right, the
// product's look (the Issue-quote dialog), one window at a time (a queue), Escape / the backdrop / the phone Back = the safe answer.
// The host mounts itself on the first call, outside every screen's React tree (its keys never reach a screen underneath).
//
// askConfirm(text, isHebrew, { yes, no, danger }) -> Promise<boolean>   (true only for the confirming button)
// showNotice(text, isHebrew)                     -> Promise<void>
// showCopyText(text, isHebrew, title)            -> Promise<void>      (a text the browser would not copy, selected for copying)
// askChoice(text, isHebrew, { options, cancel })  -> Promise<value|null>  (named answers + Cancel; Escape / backdrop / Back = null)
// A guard may answer at once (true / false) or with a pending question (a Promise): isPending / andAllowed / whenAllowed handle both.
/* eslint-disable react-refresh/only-export-components -- the question API and its self-mounting host share one module-level queue (the host is never hot-swapped alone) */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { QP_VARS } from './quotePresentation/qpTheme';
import { focusableWithin } from './quotePresentation/useFocusTrap';
import './quotePresentation/quotePresentation.css';

let queue = [];
let seq = 0;
const subscribers = new Set();
let host = null; // { root, el }
const emit = () => subscribers.forEach((fn) => fn());
const subscribe = (fn) => { subscribers.add(fn); return () => subscribers.delete(fn); };
const current = () => queue[0] || null;

export const isPending = (v) => !!v && typeof v.then === 'function';
/** a then b: each may be a boolean or a pending question; b runs only after a said yes */
export const andAllowed = (a, next) => (isPending(a) ? a.then((ok) => (ok === true ? next() : false)) : (a ? next() : false));
/** run once the answer is yes (at once, or after the question was answered) */
export const whenAllowed = (answer, run) => (isPending(answer) ? answer.then((ok) => (ok === true ? run() : undefined)) : (answer ? run() : undefined));

function ensureHost() {
  if (host || typeof document === 'undefined' || !document.body) return !!host;
  const el = document.createElement('div');
  el.className = 'no-print';
  el.setAttribute('data-app-dialog-root', '');
  document.body.appendChild(el);
  const root = createRoot(el);
  host = { root, el };
  root.render(<AppDialogHost />);
  return true;
}

function open(item) {
  return new Promise((resolve) => {
    if (!ensureHost()) {
      // no page to draw in (a server render): the browser's own dialog, as before
      const w = typeof window !== 'undefined' ? window : null;
      if (item.kind === 'confirm') resolve(!!(w?.confirm && w.confirm(item.text)));
      else if (item.kind === 'choice') resolve(null);
      else { try { if (item.kind === 'copy') w?.prompt?.(item.title || '', item.text); else w?.alert?.(item.text); } catch { /* no dialog */ } resolve(undefined); }
      return;
    }
    seq += 1;
    queue = [...queue, { ...item, id: seq, resolve }];
    emit();
  });
}

function answer(id, value) {
  const head = current();
  if (!head || head.id !== id) return;
  queue = queue.slice(1);
  emit();
  head.resolve(value);
}

export function askConfirm(text, isHebrew, { yes = null, no = null, danger = false } = {}) {
  return open({ kind: 'confirm', text: String(text ?? ''), he: !!isHebrew, yes, no, danger }).then((v) => v === true);
}
export function showNotice(text, isHebrew) {
  return open({ kind: 'notice', text: String(text ?? ''), he: !!isHebrew }).then(() => undefined);
}
export function showCopyText(text, isHebrew, title = '') {
  return open({ kind: 'copy', text: String(text ?? ''), title: String(title ?? ''), he: !!isHebrew }).then(() => undefined);
}
// Owner console 2026-10-26 (typed L-09 / L-15 / L-17 approval, docs/CODEX_ITEM_PATHS_SPEC_2026-10-26.md F-08): a question with named
// answers and an explicit Cancel - Cancel is never one of the answers. options: [{ value, label }] (the first is the main answer).
export function askChoice(text, isHebrew, { options = [], cancel = null } = {}) {
  return open({ kind: 'choice', text: String(text ?? ''), he: !!isHebrew, options: options.map((o) => ({ value: o.value, label: String(o.label) })), cancel })
    .then((v) => (options.some((o) => o.value === v) ? v : null));
}
/** the answers of an unsaved-work question: leave without saving / stay ('editor': leave the editor - its draft stays on the device) */
export const leaveLabels = (isHebrew, what = 'save') => (isHebrew
  ? { yes: what === 'editor' ? 'לעזוב את העורך' : 'לצאת בלי לשמור', no: 'להישאר' }
  : { yes: what === 'editor' ? 'Leave the editor' : 'Leave without saving', no: 'Stay' });

/** tests: answer every open window with the safe answer and remove the host */
export function resetAppDialogs() {
  const open_ = queue;
  queue = [];
  open_.forEach((q) => q.resolve(safeAnswer(q.kind)));
  if (host) { const { root, el } = host; host = null; try { root.unmount(); } catch { /* already gone */ } el.remove(); }
}

const safeAnswer = (kind) => (kind === 'confirm' ? false : kind === 'choice' ? null : undefined);

const LABELS = {
  he: { yes: 'להמשיך', no: 'ביטול', ok: 'הבנתי', close: 'סגירה' },
  en: { yes: 'Continue', no: 'Cancel', ok: 'OK', close: 'Close' },
};

function AppDialogHost() {
  const item = useSyncExternalStore(subscribe, current, current);
  const dialogRef = useRef(null);
  const safeRef = useRef(null);
  const returnFocusRef = useRef(null);
  const id = item?.id ?? null;
  useEffect(() => {
    if (id === null) return undefined;
    returnFocusRef.current = document.activeElement;
    const area = dialogRef.current?.querySelector('textarea');
    if (area) { area.focus(); area.select(); } else safeRef.current?.focus();
    // capture on window: the first listener of all - Escape / Tab never reach the screen (or another window) underneath
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.();
        answer(id, safeAnswer(queue[0]?.kind));
        return;
      }
      if (e.key !== 'Tab') return;
      e.stopPropagation(); e.stopImmediatePropagation?.();
      const list = focusableWithin(dialogRef.current);
      if (!list.length) { e.preventDefault(); return; }
      const first = list[0];
      const last = list[list.length - 1];
      const inside = dialogRef.current?.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      const el = returnFocusRef.current;
      if (el && typeof el.focus === 'function' && document.contains(el) && queue.length === 0) el.focus();
    };
  }, [id]);
  if (!item) return null;
  const L = item.he ? LABELS.he : LABELS.en;
  const choice = item.kind === 'choice';
  const confirm = item.kind === 'confirm' || choice;
  const safeValue = safeAnswer(item.kind);
  const textId = `app-dialog-text-${item.id}`;
  return (
    <div className="qp-backdrop" style={{ zIndex: 2147483000 }} data-testid="app-dialog-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) answer(item.id, safeValue); }}>
      <div ref={dialogRef} className="qp-dialog qp-root" role={confirm ? 'alertdialog' : 'dialog'} aria-modal="true" aria-describedby={textId}
        aria-label={item.kind === 'copy' && item.title ? item.title : undefined}
        dir={item.he ? 'rtl' : 'ltr'} lang={item.he ? 'he' : 'en'} style={{ ...QP_VARS, textAlign: 'start' }} data-testid={`app-dialog-${item.kind}`}>
        <p id={textId} data-testid="app-dialog-text" style={{ margin: 0, whiteSpace: 'pre-line', lineHeight: 1.55, overflowWrap: 'anywhere' }}>
          {item.kind === 'copy' ? item.title : item.text}
        </p>
        {item.kind === 'copy' && (
          <textarea readOnly value={item.text} rows={6} dir="auto" data-testid="app-dialog-copy-text"
            style={{ width: '100%', boxSizing: 'border-box', marginTop: 10, padding: 8, borderRadius: 10, border: '1px solid var(--qp-border)', font: 'inherit', fontSize: '0.88rem', resize: 'vertical' }} />
        )}
        <div className="qp-dialog-actions">
          {choice && item.options.map((o, i) => (
            // PRODUCT_TRUTH_DECORATIVE: one named answer of the app's own question - the screen that asked carries on with it
            <button key={String(o.value)} type="button" className={i === 0 ? 'qp-btn qp-btn--primary' : 'qp-btn'} onClick={() => answer(item.id, o.value)}
              data-testid={`app-dialog-choice-${o.value}`}>
              {o.label}
            </button>
          ))}
          {confirm && !choice && (
            // PRODUCT_TRUTH_DECORATIVE: the confirming answer of the app's own question - the screen that asked carries on
            <button type="button" className="qp-btn qp-btn--primary" onClick={() => answer(item.id, true)}
              style={item.danger ? { background: 'var(--qp-error)', borderColor: 'var(--qp-error)', color: '#fff' } : undefined} data-testid="app-dialog-yes">
              {item.yes || L.yes}
            </button>
          )}
          {/* PRODUCT_TRUTH_DECORATIVE: the safe answer (cancel / close) - nothing changes */}
          <button type="button" className="qp-btn" ref={safeRef} onClick={() => answer(item.id, safeValue)} data-testid={confirm ? 'app-dialog-no' : 'app-dialog-close'}>
            {choice ? (item.cancel || L.no) : confirm ? (item.no || L.no) : (item.kind === 'copy' ? L.close : L.ok)}
          </button>
        </div>
      </div>
    </div>
  );
}
