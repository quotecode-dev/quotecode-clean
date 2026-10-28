// Owner console 2026-10-26 (typed: "מאשר את התוכנית א עד ז בשחרור אחד ...", item ז): a mailto link opens nothing on a computer without a
// desktop mail app (Gmail / Outlook in the browser). Every mail link keeps its mailto href and opens the in-app mail window
// (src/components/MailLink.jsx), which offers the same message in Gmail, Outlook on the web or the mail app. No component code here.

/** { to, subject, body } from a mailto href; null when it is not one plain address. */
export function parseMailto(href) {
  if (typeof href !== 'string' || !href.startsWith('mailto:')) return null;
  const [addr, query = ''] = href.slice('mailto:'.length).split('?');
  // 20261029000000 (Codex F20): a literal % in an address (sales%team@...) is not an escape - never a crash while the card renders
  let to;
  try { to = decodeURIComponent(addr).trim(); } catch { to = addr.trim(); }
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to)) return null;
  const p = new URLSearchParams(query.replace(/\+/g, '%2B'));
  return { to, subject: p.get('subject') ?? '', body: p.get('body') ?? '' };
}

/** The three ways to write the same message. Every value is URL-encoded; empty parts are left out. */
export function mailComposeLinks({ to, subject = '', body = '' }) {
  const e = encodeURIComponent;
  const q = (pairs) => pairs.filter(([, v]) => v).map(([k, v]) => `&${k}=${e(v)}`).join('');
  const mq = [subject && `subject=${e(subject)}`, body && `body=${e(body)}`].filter(Boolean).join('&');
  return {
    mailto: `mailto:${String(to).replace(/%/g, '%25')}${mq ? `?${mq}` : ''}`,
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${e(to)}${q([['su', subject], ['body', body]])}`,
    outlook: `https://outlook.live.com/mail/0/deeplink/compose?to=${e(to)}${q([['subject', subject], ['body', body]])}`,
  };
}
