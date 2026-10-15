// Self-healing data loads (Owner 2026-10-15: quotes vanished with zero counters until a manual refresh; "no user action, no refresh - a
// permanent fix"). A failed request never replaces good data and never reads as "nothing exists": the load retries by itself with a growing
// pause until it succeeds, refreshing an expired sign-in token first when that is the cause, and stops only when the user / session changes.

export const RETRY_DELAYS_MS = Object.freeze([1000, 2000, 4000, 8000, 15000, 30000]);

// A rejected / expired access token (a phone waking up with a stale session) - refresh the session, then retry.
export function isAuthExpiredError(error, status) {
  const s = Number(status ?? error?.status ?? 0);
  const text = `${error?.code || ''} ${error?.message || ''}`;
  return s === 401 || /PGRST30[123]|jwt|token (is )?expired/i.test(text);
}

// No answer from the server at all (offline, a dropped connection, a request cut by the browser while the tab slept).
export function isNetworkError(error, status) {
  if (!error) return false;
  if (Number(status) === 0) return true;
  return /failed to fetch|networkerror|network request failed|load failed|internet|timed? ?out|aborted/i.test(String(error?.message || error));
}

const realSleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// run() resolves to { ok: true, data } or { ok: false, error, status }; a throw counts as a failure. Returns the successful result, or
// { ok: false, cancelled: true } once isCurrent() turns false (signed out / another user / unmounted) - never a silent empty result.
export async function loadWithRetry(run, { isCurrent = () => true, refreshAuth = null, onRetry = null, sleep = realSleep, delays = RETRY_DELAYS_MS } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    if (!isCurrent()) return { ok: false, cancelled: true };
    let res;
    try { res = await run(); } catch (error) { res = { ok: false, error }; }
    if (res && res.ok) return res;
    if (!isCurrent()) return { ok: false, cancelled: true };
    if (onRetry) onRetry(attempt + 1, res?.error, res?.status);
    if (refreshAuth && isAuthExpiredError(res?.error, res?.status)) {
      try { await refreshAuth(); } catch { /* the next attempt reports it */ }
    }
    await sleep(delays[Math.min(attempt, delays.length - 1)]);
  }
}
