// Task 28: the intro paragraph of the quote email. The owner's default share text (business_share_defaults.share_text, read by
// index.ts for the VERIFIED owner of the quote only) replaces the built-in sentence, rendered by the ONE shared formatter as escaped HTML
// with every variable value server-derived (customer / business / number / total). No owner text -> the built-in sentence (Task 29: the
// business name HTML-escaped once; byte-identical to the previous template for safe names). The recipient, subject, link button, region and money are unchanged; the quote link stays the button only.
import { escapeHtml, renderShareTemplate } from '../_shared/shareMessage.js';

export function emailIntroHtml(opts: {
  shareText: unknown; hebrew: boolean; bizTitle: string;
  vars: { customer: string; business: string; number: string; total: string };
}): string {
  const custom = renderShareTemplate(typeof opts.shareText === 'string' ? opts.shareText : null, opts.vars, { format: 'html', rtl: opts.hebrew });
  if (custom !== null) return custom;
  return opts.hebrew
    ? `מצורפת הצעת המחיר שלך ממערכת <strong>${escapeHtml(opts.bizTitle)}</strong>.`
    : `Please find your quote attached from <strong>${escapeHtml(opts.bizTitle)}</strong>.`;
}
