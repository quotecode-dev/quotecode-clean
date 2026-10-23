// Owner 2026-10-23 (typed L-09, L-13, L-14, L-17, L-22, L-24..L-27): get-public-quote signs every attachment link for 5
// minutes. A customer who reads the quote longer and then clicks a file got an expired link. A click on a link older than
// ATTACHMENT_LINK_FRESH_MS re-reads the quote (the same read-only get-public-quote call the page loaded with) and opens the
// fresh link of the same file. The tab opens at once, inside the click, so the browser never blocks it.
export const ATTACHMENT_LINK_FRESH_MS = 4 * 60 * 1000;

function sameFile(list, att, index) {
  if (!Array.isArray(list)) return null;
  const byIndex = list[index];
  if (byIndex && byIndex.file_name === att.file_name) return byIndex;
  return list.find((a) => a && a.file_name === att.file_name) || null;
}

// -> true when the click was taken over (an old link); false lets the normal link open.
export function openAttachmentFresh(event, { att, index, loadedAt, reload, now = Date.now(), win = window }) {
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
      go(match?.url || att.url);
    })
    .catch(() => go(att.url));
  return true;
}
