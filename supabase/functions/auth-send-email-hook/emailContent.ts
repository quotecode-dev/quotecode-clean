// Pure content layer of the Auth Send Email Hook (Post-LIVE Wave 1, 2026-09-27): subject / HTML / text / sender for every
// Supabase Auth email type, TEKANGO-branded, one language per email (never mixed HE/EN). Extracted from index.ts unchanged in
// behavior except that the user's email address is now HTML-escaped where it is interpolated into HTML. No I/O here, so the
// content can be validated by vitest (emailContent.test.js).
//
// Market signal: `user_metadata.signup_market` written by Dashboard.jsx handleSignUp ('Local' | 'International').
// Only the exact value 'Local' selects Hebrew; anything else (missing / legacy / unexpected) fails closed to English.

const HEADER_BG = '#111112';
const FLOW_PURPLE = '#d8b4fe';
const ACCENT_VIOLET = '#8b5cf6';

export type EmailActionType =
  | 'signup'
  | 'recovery'
  | 'magiclink'
  | 'invite'
  | 'email_change_current'
  | 'email_change_new'
  | 'reauthentication';

export function isHebrewMarket(userMetadata: Record<string, unknown> | undefined | null): boolean {
  return userMetadata?.signup_market === 'Local';
}

export function senderAddressFor(isHebrew: boolean) {
  // Same split as send-trial-expiration-email / send-subscription-expiration-email.
  return isHebrew ? 'TEKANGO Support <support@tekango.com>' : 'TEKANGO <info@tekango.com>';
}

export function escapeHtml(value: string) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The verify endpoint lives under the Auth API base URL (SUPABASE_URL), never under a payload-supplied host.
export function buildVerifyUrl(supabaseUrl: string, tokenHash: string, actionType: string, redirectTo: string) {
  const url = new URL(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/verify`);
  url.searchParams.set('token', tokenHash);
  url.searchParams.set('type', actionType);
  url.searchParams.set('redirect_to', redirectTo);
  return url.toString();
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

function ctaButton(url: string, label: string) {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;margin-top:16px;background:${ACCENT_VIOLET};color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:700;font-size:0.9rem;">${label}</a>`;
}

export function buildEmailContent(
  actionType: EmailActionType | string,
  isHebrew: boolean,
  verifyUrl: string,
  toEmail: string,
): { subject: string; html: string; text: string } {
  const greeting = isHebrew ? 'שלום,' : 'Hello,';
  const signature = isHebrew ? 'בברכה,<br>צוות TEKANGO' : 'Best regards,<br>The TEKANGO Team';
  const safeEmail = escapeHtml(toEmail);
  const compose = (subject: string, bodyCopy: string, ctaLabel: string, textLead: string) => ({
    subject,
    html: wrapEmail(isHebrew, `<p>${greeting}</p><p style="line-height:1.6;">${bodyCopy}</p>${ctaButton(verifyUrl, ctaLabel)}<p style="margin-top:24px;">${signature}</p>`),
    text: textLead ? `${greeting}\n\n${textLead}: ${verifyUrl}` : `${greeting}\n\n${verifyUrl}`,
  });

  switch (actionType) {
    case 'signup':
      return compose(
        isHebrew ? 'אישור הרשמה ל-TEKANGO' : 'Confirm your TEKANGO signup',
        isHebrew
          ? 'תודה שנרשמת למערכת הניהול והצעות המחיר <strong>TEKANGO</strong>. לחצו על הכפתור למטה כדי לאשר את כתובת האימייל ולהפעיל את החשבון שלכם.'
          : 'Thank you for signing up for <strong>TEKANGO</strong>, the business & quoting platform. Click the button below to confirm your email address and activate your account.',
        isHebrew ? 'אישור כתובת האימייל' : 'Confirm Email Address',
        isHebrew ? 'לאישור ההרשמה' : 'Confirm your signup',
      );
    case 'recovery':
      return compose(
        isHebrew ? 'איפוס סיסמה ל-TEKANGO' : 'Reset your TEKANGO password',
        isHebrew
          ? `קיבלנו בקשה לאיפוס הסיסמה עבור החשבון <strong>${safeEmail}</strong>. לחצו על הכפתור למטה כדי לבחור סיסמה חדשה. אם לא ביקשתם זאת, ניתן להתעלם מהודעה זו בבטחה.`
          : `We received a request to reset the password for <strong>${safeEmail}</strong>. Click the button below to choose a new password. If you didn't request this, you can safely ignore this email.`,
        isHebrew ? 'איפוס סיסמה' : 'Reset Password',
        isHebrew ? 'לאיפוס הסיסמה' : 'Reset your password',
      );
    case 'magiclink':
      return compose(
        isHebrew ? 'קישור כניסה ל-TEKANGO' : 'Your TEKANGO sign-in link',
        isHebrew ? 'לחצו על הכפתור למטה כדי להתחבר ל-TEKANGO ללא סיסמה.' : 'Click the button below to sign in to TEKANGO without a password.',
        isHebrew ? 'התחברות' : 'Sign In',
        isHebrew ? 'קישור כניסה' : 'Sign-in link',
      );
    case 'email_change_current':
    case 'email_change_new':
      return compose(
        isHebrew ? 'אישור שינוי כתובת אימייל ב-TEKANGO' : 'Confirm your TEKANGO email change',
        isHebrew
          ? 'קיבלנו בקשה לשנות את כתובת האימייל בחשבון TEKANGO שלכם. לחצו על הכפתור למטה כדי לאשר את השינוי. אם לא ביקשתם זאת, ניתן להתעלם מהודעה זו בבטחה.'
          : "We received a request to change the email address on your TEKANGO account. Click the button below to confirm the change. If you didn't request this, you can safely ignore this email.",
        isHebrew ? 'אישור שינוי כתובת' : 'Confirm Email Change',
        isHebrew ? 'לאישור שינוי הכתובת' : 'Confirm the email change',
      );
    default:
      // invite / reauthentication / any future type: still branded and localized, never silently dropped.
      return compose(
        isHebrew ? 'פעולה נדרשת בחשבון TEKANGO שלך' : 'Action required on your TEKANGO account',
        isHebrew ? 'לחצו על הכפתור למטה כדי להשלים את הפעולה המבוקשת בחשבון TEKANGO שלכם.' : 'Click the button below to complete the requested action on your TEKANGO account.',
        isHebrew ? 'המשך' : 'Continue',
        '',
      );
  }
}
