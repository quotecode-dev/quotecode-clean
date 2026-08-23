// Bilingual HTML/text templates for the trial expiration reminder emails sent
// from api/cron.js. Kept in a separate module (leading underscore = not a
// route, Vercel ignores it) so the cron handler stays focused on scheduling.

function formatDate(dateStr, isHebrew) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(isHebrew ? 'he-IL' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function wrap(isHebrew, bodyHtml) {
  return `<!DOCTYPE html>
<html dir="${isHebrew ? 'rtl' : 'ltr'}" lang="${isHebrew ? 'he' : 'en'}">
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Segoe UI,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:#111112;padding:20px 28px;">
              <span style="color:#ffffff;font-size:1.2rem;font-weight:800;font-family:Arial,Segoe UI,sans-serif;">Pro</span><span style="color:#d8b4fe;font-size:1.2rem;font-weight:800;font-family:Arial,Segoe UI,sans-serif;">Flow</span>
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

function ctaButton(isHebrew) {
  const url = 'https://www.quotecodepro.com/dashboard' + (isHebrew ? '' : '?lang=en');
  return `<a href="${url}" style="display:inline-block;margin-top:16px;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:700;font-size:0.9rem;">${isHebrew ? 'שדרג עכשיו' : 'Upgrade Now'}</a>`;
}

export function buildTrialReminderEmail({ stage, businessName, trialEndsAt, isHebrew }) {
  const name = businessName || (isHebrew ? 'לקוח יקר' : 'there');
  const dateStr = formatDate(trialEndsAt, isHebrew);

  if (stage === '3d') {
    const subject = isHebrew
      ? 'תקופת הניסיון שלך ב-ProFlow מסתיימת בעוד 3 ימים'
      : 'Your ProFlow trial ends in 3 days';
    const html = wrap(isHebrew, `
      <p style="font-size:1rem;">${isHebrew ? `שלום ${name},` : `Hi ${name},`}</p>
      <p style="font-size:0.95rem;line-height:1.6;">
        ${isHebrew
          ? `תקופת הניסיון החינמית שלך ב-ProFlow תסתיים בתאריך <strong>${dateStr}</strong> (עוד 3 ימים). כדי להמשיך ליהנות מכל יכולות ה-PRO ללא הפרעה, נשמח שתשדרג לתוכנית בתשלום.`
          : `Your free ProFlow trial ends on <strong>${dateStr}</strong> (in 3 days). To keep enjoying all PRO features without interruption, upgrade to a paid plan.`}
      </p>
      ${ctaButton(isHebrew)}
    `);
    const text = isHebrew
      ? `שלום ${name}, תקופת הניסיון שלך ב-ProFlow מסתיימת ב-${dateStr} (עוד 3 ימים). שדרג עכשיו: https://www.quotecodepro.com/dashboard`
      : `Hi ${name}, your ProFlow trial ends on ${dateStr} (in 3 days). Upgrade now: https://www.quotecodepro.com/dashboard?lang=en`;
    return { subject, html, text };
  }

  const subject = isHebrew
    ? 'תזכורת אחרונה: תקופת הניסיון שלך מסתיימת מחר'
    : 'Last reminder: your ProFlow trial ends tomorrow';
  const html = wrap(isHebrew, `
    <p style="font-size:1rem;">${isHebrew ? `שלום ${name},` : `Hi ${name},`}</p>
    <p style="font-size:0.95rem;line-height:1.6;">
      ${isHebrew
        ? `נשארו פחות מ-24 שעות לתקופת הניסיון שלך ב-ProFlow, שתסתיים בתאריך <strong>${dateStr}</strong>. לאחר מכן החשבון יעבור אוטומטית לתוכנית החינמית עם המגבלות שלה. שדרג עכשיו כדי להימנע מהפרעה.`
        : `Less than 24 hours remain on your ProFlow trial, ending on <strong>${dateStr}</strong>. After that your account moves automatically to the Free plan with its limits. Upgrade now to avoid any interruption.`}
    </p>
    ${ctaButton(isHebrew)}
  `);
  const text = isHebrew
    ? `שלום ${name}, נשארו פחות מ-24 שעות לתקופת הניסיון שלך ב-ProFlow (מסתיימת ב-${dateStr}). שדרג עכשיו: https://www.quotecodepro.com/dashboard`
    : `Hi ${name}, less than 24 hours remain on your ProFlow trial (ends ${dateStr}). Upgrade now: https://www.quotecodepro.com/dashboard?lang=en`;
  return { subject, html, text };
}

export function senderAddressFor(isHebrew) {
  return isHebrew
    ? 'ProFlow Support <support@quotecodepro.com>'
    : 'ProFlow <info@quotecodepro.com>';
}
