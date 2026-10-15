// Owner 2026-10-15 (video: the landing footer -> Terms opened at the BOTTOM, on the operator details; Back returned to the middle of the
// landing): the SPA kept window.scrollY across route changes, and react-router 7 renders the new route in a transition, so the browser's
// own restoration ran against the old page. One manager for every public route (rendered once inside each BrowserRouter):
//   - a new page (PUSH / REPLACE to another path) opens at its top - or at its #section when the link names one;
//   - Back / Forward (POP) returns to the exact position the user left, retrying briefly while a page is still rendering its content;
//   - same-path changes (query / in-page #anchors, the dashboard back-trap entries) are left alone.
// The dashboard scrolls inside its own containers, not the window, so this never moves the workspace.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const STORE_KEY = 'tekango.routeScroll.v1';
const RESTORE_TIMEOUT_MS = 2000;

const readStore = () => { try { return JSON.parse(sessionStorage.getItem(STORE_KEY) || '{}') || {}; } catch { return {}; } };
const writeStore = (m) => { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(m)); } catch { /* private mode */ } };

function scrollToHash(hash, win = window) {
  const id = decodeURIComponent(String(hash || '').replace(/^#/, ''));
  if (!id) return false;
  const el = win.document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ block: 'start' });
  return true;
}

// restore y once the page is tall enough (async pages render late); stops on the user's own input or after the timeout
function restoreY(y, win = window) {
  let done = false;
  const stop = () => { done = true; ['wheel', 'touchstart', 'keydown'].forEach((e) => win.removeEventListener(e, stop)); };
  ['wheel', 'touchstart', 'keydown'].forEach((e) => win.addEventListener(e, stop, { passive: true }));
  const started = Date.now();
  const tick = () => {
    if (done) return;
    const max = win.document.documentElement.scrollHeight - win.innerHeight;
    win.scrollTo(0, Math.min(y, Math.max(0, max)));
    if (max >= y || Date.now() - started > RESTORE_TIMEOUT_MS) { stop(); return; }
    win.requestAnimationFrame(tick);
  };
  tick();
  return stop;
}

export default function RouteScrollManager() {
  const location = useLocation();
  const navType = useNavigationType();
  const positions = useRef(null);
  if (positions.current === null) positions.current = readStore();
  const prev = useRef(location);

  useEffect(() => {
    if (!('scrollRestoration' in window.history)) return undefined;
    const before = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => { window.history.scrollRestoration = before; };
  }, []);

  // ONE listener records the position of the entry that is current at that moment (the key switches in the layout effect below, before
  // the new page is scrolled, so the old entry's position is never overwritten by the switch itself); persisted for reloads
  const currentKey = useRef(location.key);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => { raf = 0; positions.current[currentKey.current] = window.scrollY; });
    };
    const onHide = () => writeStore(positions.current);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', onHide);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = location;
    currentKey.current = location.key;
    writeStore(positions.current);
    if (before === location) return undefined; // first render: the browser's own fresh load (and the page's hash handling)
    // same page: query / in-page anchor changes and the dashboard's raw back-trap entries (same URL) keep their position. (The FIRST entry
    // of a tab has the key "default" too, so that key alone must not be skipped - Back to the landing is exactly that entry.)
    if (before.pathname === location.pathname) return undefined;
    if (navType === 'POP' && typeof positions.current[location.key] === 'number') return restoreY(positions.current[location.key]);
    if (location.hash && scrollToHash(location.hash)) return undefined;
    window.scrollTo(0, 0);
    return undefined;
  }, [location, navType]);

  return null;
}
