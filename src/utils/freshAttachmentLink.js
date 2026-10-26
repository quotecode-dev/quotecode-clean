// Owner 2026-10-23 (typed L-09, L-13, L-14, L-17, L-22, L-24..L-27): get-public-quote signs every attachment link for 5
// minutes. A customer who reads the quote longer and then clicks a file got an expired link. A click on a link older than
// ATTACHMENT_LINK_FRESH_MS re-reads the quote (the same read-only get-public-quote call the page loaded with) and opens the
// fresh link of the same file. The tab opens at once, inside the click, so the browser never blocks it.
// Codex review 2026-10-23 R-04: the same file is found by its id (get-public-quote returns it); a file that is no longer attached is
// said so - never another file that shares its name. Without ids (an older server) only a name that is unique counts; an ambiguous
// name opens the original link.
export const ATTACHMENT_LINK_FRESH_MS = 4 * 60 * 1000;

function sameFile(list, att, index) {
  if (!Array.isArray(list)) return { kind: 'unknown' };
  if (att.id) {
    const byId = list.find((a) => a && a.id === att.id);
    return byId ? { kind: 'found', file: byId } : { kind: 'removed' };
  }
  const named = list.filter((a) => a && a.file_name === att.file_name);
  if (named.length === 1) return { kind: 'found', file: named[0] };
  return { kind: 'unknown', index };
}

// -> true when the click was taken over (an old link); false lets the normal link open.
// notify (Owner 2026-10-26): the app's own notice window; without it the browser's alert, as before
export function openAttachmentFresh(event, { att, index, loadedAt, reload, now = Date.now(), win = window, removedText = '', notify = null }) {
  if (typeof reload !== 'function' || now - loadedAt < ATTACHMENT_LINK_FRESH_MS) return false;
  const tab = win.open('', '_blank');
  // a blocked tab: the link opens as it always did (the quote page itself never navigates away - a signature may be in progress)
  if (!tab) return false;
  event.preventDefault();
  tab.opener = null;
  const go = (url) => { if (!tab.closed) tab.location.href = url; };
  Promise.resolve()
    .then(reload)
    .then((fresh) => {
      const match = sameFile(fresh?.attachments, att, index);
      if (match.kind === 'removed') {
        try { tab.close(); } catch { /* already closed */ }
        if (removedText) { try { (typeof notify === 'function' ? notify : (t) => win.alert(t))(removedText); } catch { /* no dialog */ } }
        return;
      }
      go(match.kind === 'found' && match.file.url ? match.file.url : att.url);
    })
    .catch(() => go(att.url));
  return true;
}
