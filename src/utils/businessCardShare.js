// Task 23 (Phase 5): share / copy helpers for the digital business card link (no component code here - Fast Refresh rule).
// Share via the device share sheet when available, else copy the link. Returns 'shared' | 'copied' | 'failed'.
export async function shareOrCopy(url, title) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') { await navigator.share({ title, url }); return 'shared'; }
  } catch (e) { if (e && e.name === 'AbortError') return 'failed'; }
  return copyText(url);
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return 'copied'; } catch { return 'failed'; }
}
