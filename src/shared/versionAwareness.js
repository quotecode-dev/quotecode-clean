// חוק ברזל (Frontend Version Awareness, Gate F, systemic remediation
// continuation task, 2026-09-09): the audit found no mechanism anywhere in
// this app for an already-open tab to learn a newer version was deployed -
// an SPA never re-fetches its own already-executing JS bundle merely from
// user interaction, so a tab opened before a deploy can run stale code
// indefinitely (this was the best-evidenced explanation for the §216
// Quote Search contradiction). This is not a caching bug - Vercel already
// serves everything with Cache-Control: max-age=0 - it is a total absence
// of any version-comparison mechanism, which this file adds.
//
// __PROFLOW_BUILD_SHA__ is injected at build time (vite.config.js, the
// versionManifestPlugin) - it is the exact commit SHA baked into THIS
// already-running bundle. /version.json is a static file, also written by
// that same plugin, always reflecting whatever is CURRENTLY DEPLOYED
// (static /public files are served fresh, never held in an in-memory tab
// the way the executing JS bundle itself is). Polling and comparing the
// two is the entire mechanism - no service worker, no new infrastructure.
/* global __PROFLOW_BUILD_SHA__, __PROFLOW_BUILD_IDENTITY__ */

export const CURRENT_BUILD_SHA = typeof __PROFLOW_BUILD_SHA__ !== 'undefined' ? __PROFLOW_BUILD_SHA__ : 'unknown';

// LOADED-TAB IDENTITY (5186 SERVED + LOADED IDENTITY): what THIS tab's JavaScript was built from - baked into the bundle at build
// time, so an old tab that never reloaded keeps reporting the OLD identity (unlike /version.json, which reports what is served NOW).
export const LOADED_BUILD_IDENTITY = Object.freeze(typeof __PROFLOW_BUILD_IDENTITY__ !== 'undefined' ? { ...__PROFLOW_BUILD_IDENTITY__ } : { buildSha: CURRENT_BUILD_SHA, buildInputDigest: 'unknown', dirty: null, mode: 'unknown' });
export function exposeLoadedBuildIdentity(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return;
  try { Object.defineProperty(win, '__TEKANGO_BUILD__', { value: LOADED_BUILD_IDENTITY, enumerable: false, configurable: false, writable: false }); } catch { /* already defined for this tab */ }
}

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes - frequent enough to matter, rare enough to be free

export async function checkForNewVersion() {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.buildSha || data.buildSha === 'unknown') return null;
    if (CURRENT_BUILD_SHA === 'unknown') return null;
    return data.buildSha !== CURRENT_BUILD_SHA ? data.buildSha : null;
  } catch {
    return null; // network hiccup / offline - never treat as "new version", never nag on a flaky connection
  }
}

// חוק ברזל: לעולם לא רענון אוטומטי - עלול למחוק עבודה לא-שמורה של המשתמש
// (הצעת מחיר בעריכה וכו'). מחזיר רק callback שהקורא מפעיל (banner UI) -
// ההחלטה מתי בפועל לרענן נשארת תמיד ביד המשתמש.
export function startVersionPolling(onNewVersion) {
  let stopped = false;
  const poll = async () => {
    if (stopped) return;
    const newSha = await checkForNewVersion();
    if (newSha && !stopped) onNewVersion(newSha);
  };
  poll(); // check once immediately, then on the interval
  const intervalId = setInterval(poll, POLL_INTERVAL_MS);
  const onFocus = () => poll(); // also check when the tab regains focus - cheap, catches the common "left it open overnight" case
  window.addEventListener('focus', onFocus);
  return () => {
    stopped = true;
    clearInterval(intervalId);
    window.removeEventListener('focus', onFocus);
  };
}
