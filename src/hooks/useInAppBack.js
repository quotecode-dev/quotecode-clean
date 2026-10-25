// Owner console 2026-10-19, typed: "מאשר שינוי ב-L-15 ואת תוכנית החזרה בכל המסכים" (the Owner: "לא יתכן שמשתמש נכנס לפונקציה ואין
// לו דרך לחזור אחורה!"). The signed-in app switches screens with React state; this hook gives it a real back stack:
//  - every screen change records the screen it left (with its search / filter / scroll) and adds one browser history entry;
//  - the phone / browser Back (and the visible Back button) first closes an open window, then leaves the quote editor through the
//    unsaved-work question, then returns to the previous screen exactly as it was;
//  - only on the first screen with nothing open does Back ask to sign out (the earlier behaviour, kept there - L-15).
// Returning to the screen just below on the stack (an editor cancelled back to its origin, a save landing on the list it came from)
// consumes that entry instead of adding one, so Back never revisits a screen twice.
import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_DEPTH = 40;
const innerScroller = (root) => root?.querySelector('.quote-modern-body') || root?.querySelector('.pf-screen > .pf-screen-body') || null;

/**
 * screen: { key, tab, editor, ...anything apply() needs }   - the current screen (key = identity of the screen)
 * apply(snapshot): show that screen again                    - called with a recorded snapshot
 * closeTopWindow(): boolean                                  - closes the topmost open window; true when one was open
 * mayLeaveEditor(): boolean                                  - the editor is open: ask about unsaved work; true = leave
 * leaveEditor(): void                                        - close the editor (the draft stays on this device)
 * onRoot(): void                                             - Back on the first screen with nothing open
 * scrollRoot(): Element | null                               - the workspace scroller
 */
export function useInAppBack({ enabled, screen, apply, closeTopWindow, mayLeaveEditor, leaveEditor, onRoot, scrollRoot, resetKey = null }) {
  const stackRef = useRef([]);
  const [depth, setDepth] = useState(0);
  const [previous, setPrevious] = useState(null);
  const sync = () => { const s = stackRef.current; setDepth(s.length); setPrevious(s.length ? s[s.length - 1] : null); };
  const currentRef = useRef(screen);
  const prevScreenRef = useRef(null);
  const restoringRef = useRef(null); // the key being restored by Back (its history entry was already consumed)
  const ignorePopRef = useRef(0); // our own silent history.back() calls
  const freshRef = useRef(false); // the next screen change came from the menu (startFresh)
  const scrollByKeyRef = useRef(new Map());
  const handlersRef = useRef({});
  handlersRef.current = { apply, closeTopWindow, mayLeaveEditor, leaveEditor, onRoot, scrollRoot };
  currentRef.current = screen;

  // the scroll of every screen, recorded while the user scrolls it (the inner list bodies do not bubble: capture)
  useEffect(() => {
    if (!enabled) return undefined;
    const root = handlersRef.current.scrollRoot?.();
    if (!root) return undefined;
    const onScroll = () => {
      const inner = innerScroller(root);
      scrollByKeyRef.current.set(currentRef.current.key, { root: root.scrollTop, inner: inner ? inner.scrollTop : 0 });
    };
    root.addEventListener('scroll', onScroll, true);
    return () => root.removeEventListener('scroll', onScroll, true);
  }, [enabled]);

  const restoreScroll = (snap) => {
    const pos = snap?.scroll;
    if (!pos) return;
    const put = () => {
      const root = handlersRef.current.scrollRoot?.();
      if (!root) return;
      root.scrollTop = pos.root;
      const inner = innerScroller(root);
      if (inner) inner.scrollTop = pos.inner;
    };
    // after the screen's own "open at the top" reset (L-15) and its first layout frame
    setTimeout(() => { put(); requestAnimationFrame(put); }, 60);
  };

  // Owner console 2026-10-22, typed: "מאשר שינוי ב-L-15 וב-L-22: איפוס המסך וההיסטוריה בהתנתקות ובמעבר בין חשבונות ...": another
  // account (or none) in the same tab starts with an empty Back history - the previous account's screens are never Back targets.
  // Declared BEFORE the screen-change effect, so the screen reset that comes with the switch is not recorded either.
  const resetKeyRef = useRef(resetKey);
  useEffect(() => {
    if (resetKeyRef.current === resetKey) return;
    resetKeyRef.current = resetKey;
    stackRef.current = [];
    restoringRef.current = null;
    prevScreenRef.current = null;
    scrollByKeyRef.current = new Map();
    sync();
  }, [resetKey]);

  // a screen change: record the screen that was left, AS IT WAS when left (its last render: search / filter typed there) - or consume
  // the entry when returning to it
  useEffect(() => {
    const prev = prevScreenRef.current;
    if (!enabled || !prev || prev.key === screen.key) return;
    const stack = stackRef.current;
    if (restoringRef.current === screen.key) { restoringRef.current = null; sync(); return; }
    restoringRef.current = null;
    // Owner console 2026-10-22, typed: "מאשר שינוי ב-L-15: מעבר דרך התפריט הצדדי או השורה התחתונה פותח מסך נקי בלי כפתור חזרה;
    // כפתור החזרה מופיע רק בתוך מסלול" - a screen opened from the menu starts a new path: nothing below it to go back to
    if (freshRef.current) {
      freshRef.current = false;
      stackRef.current = [];
      sync();
      return;
    }
    if (stack.length && stack[stack.length - 1].key === screen.key) {
      // returned to the screen right below (an editor cancelled to its origin, a save on the list it came from)
      const back = stack.pop();
      ignorePopRef.current += 1;
      window.history.back();
      restoreScroll(back);
      sync();
      return;
    }
    // a CLOSED editor is never a Back target (an editor only hidden behind another screen - e.g. a save sent to Business settings for
    // missing details - stays one: Back returns to it)
    if (prev.editor && !screen.editorAlive) { sync(); return; }
    // a screen the account could not see (Admin for an account without Admin access - L-15 / L-22, 2026-10-22) is never a Back target
    if (prev.notBackTarget) { sync(); return; }
    stack.push({ ...prev, scroll: scrollByKeyRef.current.get(prev.key) || null });
    if (stack.length > MAX_DEPTH) stack.shift();
    window.history.pushState({ tekangoNav: true }, '', window.location.href);
    sync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, screen.key]);
  // after every render (declared after the effect above, so it still sees the previous render): the screen as last shown
  useEffect(() => { prevScreenRef.current = screen; });

  // the system Back
  useEffect(() => {
    if (!enabled) return undefined;
    // the guard entry: Back on the first screen stays in the app (and asks to sign out, as before)
    window.history.pushState({ dashboard: true }, '', window.location.href);
    const stay = () => window.history.pushState({ dashboard: true }, '', window.location.href);
    const lastWindowRef = { el: null };
    const onPop = () => {
      if (ignorePopRef.current > 0) { ignorePopRef.current -= 1; return; }
      const h = handlersRef.current;
      if (h.closeTopWindow?.(lastWindowRef)) { stay(); return; }
      const cur = currentRef.current;
      const stack = stackRef.current;
      if (cur.editor) {
        if (!h.mayLeaveEditor?.()) { stay(); return; }
        if (!stack.length) { h.leaveEditor?.(); stay(); return; }
      }
      if (stack.length) {
        const target = stack.pop();
        if (target.key !== cur.key) restoringRef.current = target.key;
        if (cur.editor && !target.editor) h.leaveEditor?.();
        h.apply?.(target);
        restoreScroll(target);
        sync();
        return;
      }
      stay();
      h.onRoot?.();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [enabled]);

  // the visible Back button = the same step as the system Back
  const back = useCallback(() => { window.history.back(); }, []);
  // a menu destination (sidebar / bottom row / More / Admin menu / Settings): call right before switching the screen. The screen
  // change it causes (flushed with the click) starts a clean path; a click that changed nothing leaves no mark behind.
  const startFresh = useCallback(() => {
    freshRef.current = true;
    setTimeout(() => { freshRef.current = false; }, 0);
  }, []);
  // the editor's "Cancel & return": back to the screen the editor was opened from (called after the editor closed itself)
  const returnToOrigin = useCallback(() => {
    const s = stackRef.current;
    const origin = s.length ? s[s.length - 1] : null;
    if (origin && !origin.editor) handlersRef.current.apply?.(origin);
  }, []);
  return { depth, previous, back, returnToOrigin, startFresh };
}

/** The topmost open window in the page (a dialog) - closed with Escape, the way every app window already closes. */
export function closeTopDialogWithEscape(memo) {
  if (typeof document === 'undefined') return false;
  const open = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].filter((el) => el.getClientRects().length > 0);
  const top = open[open.length - 1];
  if (!top) { if (memo) memo.el = null; return false; }
  // a window that did not close on the previous Back press does not hold Back forever
  if (memo && memo.el === top) { memo.el = null; return false; }
  if (memo) memo.el = top;
  const ev = { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true };
  // ONE Escape, from inside the window (it bubbles to the document / window listeners too)
  (top.contains(document.activeElement) ? document.activeElement : top).dispatchEvent(new KeyboardEvent('keydown', ev));
  return true;
}
