// Owner console 2026-11-04 (typed: "מאשר את תוכנית ההתקנה, כולל שינוי ב-L-11 ו-L-17"): installing TEKANGO on the home screen from inside
// the site. Chrome / Android offers its own install window through `beforeinstallprompt`, which fires once, early in the page load - it is
// kept here (captureInstallPrompt runs from main.jsx) until the user taps "Install". iPhone / iPad and any browser without that window get a
// short explanation instead (InstallAppSheet). Nothing is offered when the site already runs from the home-screen icon. No service worker.

let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => { try { fn(); } catch { /* a listener never breaks the others */ } });

export function captureInstallPrompt(win = typeof window !== 'undefined' ? window : null) {
  if (!win || typeof win.addEventListener !== 'function') return;
  win.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; notify(); });
  win.addEventListener('appinstalled', () => { deferredPrompt = null; notify(); });
}

export const subscribeInstallPrompt = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const hasNativeInstallPrompt = () => !!deferredPrompt;

/** the site already runs from the home-screen icon */
export function isInstalledApp(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return false;
  try {
    if (typeof win.matchMedia === 'function' && (win.matchMedia('(display-mode: standalone)').matches || win.matchMedia('(display-mode: fullscreen)').matches)) return true;
  } catch { /* no media queries */ }
  return win.navigator?.standalone === true;
}

/** iPhone / iPad (an iPad reports itself as a Mac with touch) */
export function isAppleMobile(nav = typeof navigator !== 'undefined' ? navigator : null) {
  if (!nav) return false;
  const ua = String(nav.userAgent || '');
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && Number(nav.maxTouchPoints || 0) > 1);
}

/** a phone or a tablet: a touch screen as the main pointer */
export function isTouchDevice(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return false;
  try { if (typeof win.matchMedia === 'function' && win.matchMedia('(pointer: coarse)').matches) return true; } catch { /* no media queries */ }
  return /Android|iPhone|iPad|iPod|Mobile/i.test(String(win.navigator?.userAgent || '')) || isAppleMobile(win.navigator);
}

/** the install offer applies: a phone or tablet, not yet running from the icon */
export const canOfferInstall = (win = typeof window !== 'undefined' ? window : null) => !!win && isTouchDevice(win) && !isInstalledApp(win);

/**
 * "Install" was tapped: Chrome's own install window when the browser offered one; otherwise the caller shows the explanation.
 * Resolves 'prompted' (the native window was shown) or 'explain' with the steps to show ('ios' / 'browser').
 */
export async function startInstall(win = typeof window !== 'undefined' ? window : null) {
  const prompt = deferredPrompt;
  if (prompt && typeof prompt.prompt === 'function') {
    deferredPrompt = null; // a prompt event can be used once
    notify();
    try { await prompt.prompt(); return { result: 'prompted' }; } catch { /* fall back to the explanation */ }
  }
  return { result: 'explain', steps: isAppleMobile(win?.navigator) ? 'ios' : 'browser' };
}

// tests only
export const __resetInstallPromptForTests = () => { deferredPrompt = null; listeners.clear(); };
