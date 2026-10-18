// Task 29: the fixed quote-email template as a PURE function (no I/O), with every dynamic value escaped ONCE for the context it is used in:
//   - HTML text (header business name, greeting customer name, intro default, amount, footer): escapeHtml (the shared helper)
//   - HTML attributes (logo alt, logo src, button href): URL validation FIRST (separate from escaping), then escapeHtml for the attribute
//   - subject: plain text for the provider API (never HTML) - only control characters / line breaks are removed
// The owner's share text keeps its own path (emailIntro.ts -> the shared formatter, values escaped there). The copy, layout and the canonical
// link are unchanged; for safe values (no & < > " ') the HTML is byte-identical to the previous template.
import { escapeHtml } from '../_shared/shareMessage.js';
import { emailIntroHtml } from './emailIntro.ts';

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001F\u007F]+/g;
const plain = (v: unknown) => String(v ?? '').replace(CONTROL, ' ').replace(/\s+/g, ' ').trim();

// The logo is still taken from the request (pre-existing product choice, see index.ts); only an absolute http(s) URL that is not an SVG
// is used. Returns the normalized URL (to be attribute-escaped by the caller) or null.
export function safeLogoUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.pathname.toLowerCase().endsWith('.svg')) return null;
  return u.href;
}

// בעל המערכת 2026-10-18 ("לתקן עכשיו את הלוגו במייל?" -> "כן"): לוגו שהועלה מהמחשב נשמר כתמונה מוטבעת (data:), ותוכנות דואר
// לא מציגות כתובת כזו. לכן הוא מצורף למייל כתמונה פנימית (cid:) - רק PNG או JPEG אמיתיים (נבדקת חתימת הקובץ), עד 500KB כמו
// בהעלאה. SVG לא מצורף (ג'ימייל ואאוטלוק לא מציגים אותו) - במקומו נשאר שם העסק.
export const INLINE_LOGO_CID = 'business-logo';
const INLINE_LOGO_MAX_BYTES = 500 * 1024;
export function inlineLogoAttachment(raw: unknown): { filename: string; content: string; content_type: string; content_id: string } | null {
  if (typeof raw !== 'string') return null;
  const m = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(raw.trim());
  if (!m) return null;
  const b64 = m[2];
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)); } catch { return null; }
  if (bytes.length === 0 || bytes.length > INLINE_LOGO_MAX_BYTES) return null;
  const isPng = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!isPng && !isJpeg) return null;
  return isPng
    ? { filename: 'logo.png', content: b64, content_type: 'image/png', content_id: INLINE_LOGO_CID }
    : { filename: 'logo.jpg', content: b64, content_type: 'image/jpeg', content_id: INLINE_LOGO_CID };
}

// The quote link is built on the server (decideEmailLink); it must stay on the canonical origin. Anything else is refused (null).
export function safeQuoteLink(link: unknown, origin: string): string | null {
  if (typeof link !== 'string') return null;
  let u: URL;
  try { u = new URL(link); } catch { return null; }
  if (u.origin !== origin || u.protocol !== 'https:') return null;
  return u.href;
}

export function buildQuoteEmail(o: {
  hebrew: boolean; bizTitle: string; clientDisplayName: string; quoteNumberDisplay: string; symbol: string; displayTotal: string; partialTotal?: boolean;
  quoteLink: string; logoUrl: string | null; shareText: unknown;
}): { subject: string; html: string } {
  const biz = escapeHtml(o.bizTitle);
  const client = escapeHtml(o.clientDisplayName);
  const total = escapeHtml(`${o.symbol}${o.displayTotal}`);
  const href = escapeHtml(o.quoteLink);
  const introHtml = emailIntroHtml({
    shareText: o.shareText, hebrew: o.hebrew, bizTitle: o.bizTitle,
    vars: { customer: o.clientDisplayName, business: o.bizTitle, number: o.quoteNumberDisplay, total: `${o.symbol}${o.displayTotal}` },
  });
  const subject = o.hebrew
    ? plain(`הצעת מחיר ${o.quoteNumberDisplay} מ-${o.bizTitle}`)
    : plain(`Quote ${o.quoteNumberDisplay} from ${o.bizTitle}`);
  const headerHtml = o.logoUrl
    ? `<div style="text-align: center; margin-bottom: 20px;"><img src="${escapeHtml(o.logoUrl)}" alt="${biz}" style="max-height: 55px; object-fit: contain;" /></div>`
    : `<div style="text-align: center; margin-bottom: 20px; font-size: 1.5rem; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">${biz}</div>`;
  const html = o.hebrew ? `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 25px; color: #1e293b; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
        ${headerHtml}
        <h2 style="color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">שלום ${client},</h2>
        <p style="font-size: 1rem; line-height: 1.5;">${introHtml}</p>
        <p style="font-size: 1.1rem;"><strong>סך הכל לתשלום:</strong> <span style="color: #4f46e5; font-weight: bold;">${total}</span></p>
        ${o.partialTotal ? '<p style="color: #b45309; font-weight: bold;">הסכום חלקי: יש בהצעה פריטים שטרם תומחרו.</p>' : ''}
        <br/>
        <p>לצפייה בהצעה המלאה, אישור או חתימה דיגיטלית לחץ על הכפתור הבא:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${href}" style="background: #4f46e5; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 1rem; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);">צפה בהצעת המחיר</a>
        </div>
        <br/>
        <p style="color: #64748b; font-size: 0.9rem;">נשמח לעמוד לשירותך לכל שאלה!</p>
        <p style="color: #64748b; font-size: 0.9rem; margin-top: 15px;">צוות ${biz}</p>
      </div>
    ` : `
      <div dir="ltr" style="font-family: Arial, sans-serif; padding: 25px; color: #1e293b; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
        ${headerHtml}
        <h2 style="color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">Hello ${client},</h2>
        <p style="font-size: 1rem; line-height: 1.5;">${introHtml}</p>
        <p style="font-size: 1.1rem;"><strong>Total Amount:</strong> <span style="color: #4f46e5; font-weight: bold;">${total}</span></p>
        ${o.partialTotal ? '<p style="color: #b45309; font-weight: bold;">Partial total: some items in this quote are not priced yet.</p>' : ''}
        <br/>
        <p>To view, approve or digitally sign your quote, click the button below:</p>
        <div style="text-align: center; margin: 25px 0;">
          <a href="${href}" style="background: #4f46e5; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 1rem; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.2);">View Quote</a>
        </div>
        <br/>
        <p style="color: #64748b; font-size: 0.9rem;">Feel free to contact us with any questions!</p>
        <p style="color: #64748b; font-size: 0.9rem; margin-top: 15px;">${biz} Team</p>
      </div>
    `;
  return { subject, html };
}
