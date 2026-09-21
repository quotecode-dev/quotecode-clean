// TEMPORARY, TEST-ONLY return-to-app diagnostics. Inert unless
// localStorage.tkDiag === '1' (or ?diag=1 was used once). Records a small ring
// buffer at window.__tkDiag and localStorage.tkDiagLog so a phone session can be
// inspected after a cold reload. PRIVACY: never records tokens, passwords,
// emails or secrets - only event names, booleans, and 6-char user-id prefixes.
const KEY = 'tkDiagLog';
const MAX = 40;

export function diagEnabled() {
  try {
    if (new URLSearchParams(window.location.search).get('diag') === '1') localStorage.setItem('tkDiag', '1');
    return localStorage.getItem('tkDiag') === '1';
  } catch { return false; }
}

export function diagLog(kind, data = {}) {
  if (!diagEnabled()) return;
  const entry = { t: new Date().toISOString(), vis: document.visibilityState, kind, ...data };
  try {
    window.__tkDiag = window.__tkDiag || [];
    window.__tkDiag.push(entry);
    const prior = JSON.parse(localStorage.getItem(KEY) || '[]');
    prior.push(entry);
    localStorage.setItem(KEY, JSON.stringify(prior.slice(-MAX)));
  } catch { /* diagnostics must never affect the app */ }
}

export const idPrefix = (id) => (id ? String(id).slice(0, 6) : null);

export function diagBoot() {
  if (!diagEnabled()) return;
  const nav = performance.getEntriesByType('navigation')[0];
  diagLog('boot', { navType: nav ? nav.type : 'unknown', loadedAtMs: Math.round(performance.timeOrigin), initAuthFromScratch: true });
}

// ---- Durable-draft lifecycle diagnostics (2026-09-21) --------------------------------------------------------------
// Answers "did the browser RELOAD the page, or keep it alive?" after backgrounding, without any customer data:
// per-boot id, timeOrigin, navigation type, pageshow.persisted, visibility transitions, freeze/resume,
// document.wasDiscarded, auth event NAMES (never tokens) and draft-restore outcomes (never draft content).
export const BOOT_ID = (() => { try { return Math.random().toString(36).slice(2, 10); } catch { return 'x'; } })();
let lifecycleInstalled = false;
export function installLifecycleDiag() {
  if (lifecycleInstalled || typeof window === 'undefined') return;
  lifecycleInstalled = true;
  if (!diagEnabled()) return;
  const nav = performance.getEntriesByType('navigation')[0];
  diagLog('lifecycle-boot', { bootId: BOOT_ID, timeOrigin: Math.round(performance.timeOrigin), navType: nav ? nav.type : 'unknown', wasDiscarded: !!document.wasDiscarded });
  window.addEventListener('pageshow', (e) => diagLog('pageshow', { bootId: BOOT_ID, persisted: !!e.persisted }));
  window.addEventListener('pagehide', (e) => diagLog('pagehide', { bootId: BOOT_ID, persisted: !!e.persisted }));
  document.addEventListener('visibilitychange', () => diagLog('visibility', { bootId: BOOT_ID, state: document.visibilityState }));
  document.addEventListener('freeze', () => diagLog('freeze', { bootId: BOOT_ID }));
  document.addEventListener('resume', () => diagLog('resume', { bootId: BOOT_ID }));
}
