// Owner 2026-10-15: the "Back" button of the Terms / Privacy / Contact pages did nothing when the page was opened in a new tab (the
// signup consent links open one) - there is no in-app history to go back to. Then: a tab our own site opened is closed; anything
// else (a direct link, a search result) goes to the landing page of the page's language. With in-app history: a normal back.
export function goBackOrHome(navigate, isHebrew, win = typeof window !== 'undefined' ? window : null) {
  const idx = win?.history?.state?.idx;
  if (typeof idx === 'number' && idx > 0) { navigate(-1); return 'back'; }
  let sameOriginOpener;
  try { sameOriginOpener = !!win?.document?.referrer && new URL(win.document.referrer).origin === win.location.origin; } catch { sameOriginOpener = false; }
  if (sameOriginOpener && win.history.length <= 1) {
    try { win.close(); } catch { /* not closable */ }
  }
  // if the tab could not be closed (or must not be), the landing page of the page's language
  navigate(isHebrew ? '/he' : '/en', { replace: true });
  return 'home';
}
