// Trial reminder email content (subject / HTML / text / sender), moved out of index.ts unchanged in wording so it can be
// tested under vitest (Codex Post-LIVE Wave 1 blocker 5, 2026-09-27). The only input that selects language, direction,
// date locale, CTA URL and sender is the EXACT canonical market ('Local' | 'International') resolved by eligibility.ts;
// there is no boolean "isHebrew" guess at the call sites any more.

import type { ReminderMarket } from './eligibility.ts';

const HEADER_BG = '#111112';
const FLOW_PURPLE = '#d8b4fe';
const ACCENT_VIOLET = '#8b5cf6';

export type Stage = '3d' | '24h';

export function senderAddressFor(market: ReminderMarket) {
  return market === 'Local' ? 'TEKANGO Support <support@tekango.com>' : 'TEKANGO <info@tekango.com>';
}

function formatDate(dateStr: string, isHebrew: boolean) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(isHebrew ? 'he-IL' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function wrapEmail(isHebrew: boolean, bodyHtml: string) {
  return `<!DOCTYPE html>
<html dir="${isHebrew ? 'rtl' : 'ltr'}" lang="${isHebrew ? 'he' : 'en'}">
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Segoe UI,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:${HEADER_BG};padding:20px 28px;">
              <span style="color:${FLOW_PURPLE};font-size:1.2rem;font-weight:800;letter-spacing:0.5px;font-family:Arial,Segoe UI,sans-serif;">TEKANGO</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;text-align:${isHebrew ? 'right' : 'left'};color:#1e293b;">
              ${bodyHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(isHebrew: boolean) {
  const url = 'https://www.tekango.com/dashboard' + (isHebrew ? '' : '?lang=en');
  return `<a href="${url}" style="display:inline-block;margin-top:16px;background:${ACCENT_VIOLET};color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:700;font-size:0.9rem;">${isHebrew ? 'שדרג עכשיו' : 'Upgrade Now'}</a>`;
}

export function buildTrialReminderEmail({ stage, businessName, trialEndsAt, market }: {
  stage: Stage; businessName: string | null | undefined; trialEndsAt: string; market: ReminderMarket;
}) {
  const isHebrew = market === 'Local';
  const name = businessName || (isHebrew ? 'עסק יקר' : 'there');
  const dateStr = formatDate(trialEndsAt, isHebrew);

  if (stage === '3d') {
    const subject = isHebrew
      ? 'תקופת הניסיון שלך ב-TEKANGO מסתיימת בעוד 3 ימים'
      : 'Your TEKANGO trial ends in 3 days';
    const html = wrapEmail(isHebrew, `
      <div dir="${isHebrew ? 'rtl' : 'ltr'}" style="text-align:${isHebrew ? 'right' : 'left'};">
        <p style="font-size:1rem; margin-bottom:16px;">${isHebrew ? `שלום ${name},` : `Hi ${name},`}</p>
        <p style="font-size:0.95rem; line-height:1.6; margin-bottom:16px;">
          ${isHebrew
            ? `תקופת הניסיון החינמית שלך במערכת <strong>TEKANGO</strong> עומדת להסתיים בתאריך <strong>${dateStr}</strong> (עוד 3 ימים). כדי להמשיך ליהנות מכלל יכולות ה-PRO ללא שום הפרעה, נשמח שתשדרג את החשבון שלך לתוכנית בתשלום.`
            : `Your free TEKANGO trial ends on <strong>${dateStr}</strong> (in 3 days). To keep enjoying all PRO features without interruption, upgrade to a paid plan.`}
        </p>
        ${ctaButton(isHebrew)}
      </div>
    `);
    const text = isHebrew
      ? `שלום ${name}, תקופת הניסיון שלך ב-TEKANGO מסתיימת ב-${dateStr} (עוד 3 ימים). שדרג עכשיו: https://www.tekango.com/dashboard`
      : `Hi ${name}, your TEKANGO trial ends on ${dateStr} (in 3 days). Upgrade now: https://www.tekango.com/dashboard?lang=en`;
    return { subject, html, text };
  }

  const subject = isHebrew
    ? 'תזכורת אחרונה: תקופת הניסיון שלך מסתיימת מחר'
    : 'Last reminder: your TEKANGO trial ends tomorrow';
  const html = wrapEmail(isHebrew, `
    <div dir="${isHebrew ? 'rtl' : 'ltr'}" style="text-align:${isHebrew ? 'right' : 'left'};">
      <p style="font-size:1rem; margin-bottom:16px;">${isHebrew ? `שלום ${name},` : `Hi ${name},`}</p>
      <p style="font-size:0.95rem; line-height:1.6; margin-bottom:16px;">
        ${isHebrew
          ? `נשארו פחות מ-24 שעות לתקופת הניסיון שלך ב-TEKANGO, שתסתיים בתאריך <strong>${dateStr}</strong>. לאחר מכן החשבון יעבור אוטומטית לתוכנית החינמית. שדרג עכשיו כדי להימנע מהפסקת שירות.`
          : `Less than 24 hours remain on your TEKANGO trial, ending on <strong>${dateStr}</strong>. After that your account moves automatically to the Free plan. Upgrade now to avoid any interruption.`}
      </p>
      ${ctaButton(isHebrew)}
    </div>
  `);
  const text = isHebrew
    ? `שלום ${name}, נשארו פחות מ-24 שעות לתקופת הניסיון שלך ב-TEKANGO (מסתיימת ב-${dateStr}). שדרג עכשיו: https://www.tekango.com/dashboard`
    : `Hi ${name}, less than 24 hours remain on your TEKANGO trial (ends ${dateStr}). Upgrade now: https://www.tekango.com/dashboard?lang=en`;
  return { subject, html, text };
}
