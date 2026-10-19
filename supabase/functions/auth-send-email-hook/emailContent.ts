// Pure content layer of the Auth Send Email Hook (Post-LIVE Wave 1, 2026-09-27): subject / HTML / text / sender for every
// message the hook sends, TEKANGO-branded, one language per email (never mixed HE/EN). No I/O here, so the content can be
// validated by vitest (emailContent.test.js).
//
// Codex Post-LIVE Wave 1 blocker 1 (2026-09-27): content is keyed by the MESSAGE the hook sends, not by an invented action
// name. The hook contract's `email_change` action can produce two messages (current address / new address), so those two
// are separate message kinds here; notification actions produce information-only messages with no verification CTA;
// `reauthentication` carries a one-time code and no link. Which messages exist for a payload is decided in emailPlan.ts.
//
// Market: decided by marketResolver.ts (Option C, 2026-09-28 - canonical business_settings.country first, signup_market
// only while no row exists, fail closed to International). This module only renders the market it is given
// (isHebrew = market is Local). An Auth email cannot be withheld, so the fail-closed branch is the International one.

const HEADER_BG = '#111112';
const FLOW_PURPLE = '#d8b4fe';
const ACCENT_VIOLET = '#8b5cf6';

export type LinkMessageKind = 'signup' | 'recovery' | 'magiclink' | 'invite';

export type NotificationActionType =
  | 'password_changed_notification'
  | 'email_changed_notification'
  | 'phone_changed_notification'
  | 'identity_linked_notification'
  | 'identity_unlinked_notification'
  | 'mfa_factor_enrolled_notification'
  | 'mfa_factor_unenrolled_notification';

export type AuthEmailMessage =
  | { kind: LinkMessageKind; to: string; verifyUrl: string }
  | { kind: 'email_change_confirm_current'; to: string; verifyUrl: string; newEmail: string }
  | { kind: 'email_change_confirm_new'; to: string; verifyUrl: string }
  | { kind: 'reauthentication'; to: string; code: string }
  | {
      kind: NotificationActionType;
      to: string;
      details: { email?: string; oldEmail?: string; provider?: string; factorType?: string };
    };

export function senderAddressFor(isHebrew: boolean) {
  // Same split as send-trial-expiration-email / send-subscription-expiration-email.
  return isHebrew ? 'TEKANGO Support <support@tekango.com>' : 'TEKANGO <info@tekango.com>';
}

function supportAddressFor(isHebrew: boolean) {
  return isHebrew ? 'support@tekango.com' : 'info@tekango.com';
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
// `type` is the GoTrue verify type (for email change it is always `email_change`, for both addresses).
export function buildVerifyUrl(supabaseUrl: string, tokenHash: string, verifyType: string, redirectTo: string) {
  const url = new URL(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/verify`);
  url.searchParams.set('token', tokenHash);
  url.searchParams.set('type', verifyType);
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

type Content = { subject: string; html: string; text: string };

export function buildEmailContent(message: AuthEmailMessage, isHebrew: boolean): Content {
  const greeting = isHebrew ? 'שלום,' : 'Hello,';
  const signature = isHebrew ? 'בברכה,<br>צוות TEKANGO' : 'Best regards,<br>The TEKANGO Team';
  const signatureText = isHebrew ? 'בברכה,\nצוות TEKANGO' : 'Best regards,\nThe TEKANGO Team';
  const support = supportAddressFor(isHebrew);
  const notMe = isHebrew
    ? `אם לא אתם ביצעתם את הפעולה, פנו אלינו מיד בכתובת ${support}.`
    : `If this wasn't you, contact us right away at ${support}.`;

  // Message with a verification link (CTA + the same URL in the text part).
  const withLink = (subject: string, bodyHtml: string, bodyText: string, ctaLabel: string, textLead: string, url: string): Content => ({
    subject,
    html: wrapEmail(isHebrew, `<p>${greeting}</p><p style="line-height:1.6;">${bodyHtml}</p>${ctaButton(url, ctaLabel)}<p style="margin-top:24px;">${signature}</p>`),
    text: `${greeting}\n\n${bodyText}\n\n${textLead}: ${url}\n\n${signatureText}`,
  });
  // Information-only message: no link, no button.
  const infoOnly = (subject: string, bodyHtml: string, bodyText: string): Content => ({
    subject,
    html: wrapEmail(isHebrew, `<p>${greeting}</p><p style="line-height:1.6;">${bodyHtml}</p><p style="line-height:1.6;">${escapeHtml(notMe)}</p><p style="margin-top:24px;">${signature}</p>`),
    text: `${greeting}\n\n${bodyText}\n\n${notMe}\n\n${signatureText}`,
  });

  switch (message.kind) {
    case 'signup': {
      const html = isHebrew
        ? 'תודה שנרשמת למערכת הניהול והצעות המחיר <strong>TEKANGO</strong>. לחצו על הכפתור למטה כדי לאשר את כתובת האימייל ולהפעיל את החשבון שלכם.'
        : 'Thank you for signing up for <strong>TEKANGO</strong>, the business & quoting platform. Click the button below to confirm your email address and activate your account.';
      const text = isHebrew
        ? 'תודה שנרשמת למערכת הניהול והצעות המחיר TEKANGO.'
        : 'Thank you for signing up for TEKANGO, the business & quoting platform.';
      return withLink(
        isHebrew ? 'אישור הרשמה ל-TEKANGO' : 'Confirm your TEKANGO signup',
        html, text,
        isHebrew ? 'אישור כתובת האימייל' : 'Confirm Email Address',
        isHebrew ? 'לאישור ההרשמה' : 'Confirm your signup',
        message.verifyUrl,
      );
    }
    case 'recovery': {
      const safeEmail = escapeHtml(message.to);
      return withLink(
        isHebrew ? 'איפוס סיסמה ל-TEKANGO' : 'Reset your TEKANGO password',
        isHebrew
          ? `קיבלנו בקשה לאיפוס הסיסמה עבור החשבון <strong>${safeEmail}</strong>. לחצו על הכפתור למטה כדי לבחור סיסמה חדשה. אם לא ביקשתם זאת, ניתן להתעלם מהודעה זו בבטחה.`
          : `We received a request to reset the password for <strong>${safeEmail}</strong>. Click the button below to choose a new password. If you didn't request this, you can safely ignore this email.`,
        isHebrew
          ? `קיבלנו בקשה לאיפוס הסיסמה עבור החשבון ${message.to}. אם לא ביקשתם זאת, ניתן להתעלם מהודעה זו בבטחה.`
          : `We received a request to reset the password for ${message.to}. If you didn't request this, you can safely ignore this email.`,
        isHebrew ? 'איפוס סיסמה' : 'Reset Password',
        isHebrew ? 'לאיפוס הסיסמה' : 'Reset your password',
        message.verifyUrl,
      );
    }
    case 'magiclink':
      return withLink(
        isHebrew ? 'קישור כניסה ל-TEKANGO' : 'Your TEKANGO sign-in link',
        isHebrew ? 'לחצו על הכפתור למטה כדי להתחבר ל-TEKANGO ללא סיסמה.' : 'Click the button below to sign in to TEKANGO without a password.',
        isHebrew ? 'קיבלנו בקשה להתחברות ל-TEKANGO ללא סיסמה.' : 'We received a request to sign in to TEKANGO without a password.',
        isHebrew ? 'התחברות' : 'Sign In',
        isHebrew ? 'קישור כניסה' : 'Sign-in link',
        message.verifyUrl,
      );
    case 'invite':
      return withLink(
        isHebrew ? 'הוזמנתם להצטרף ל-TEKANGO' : "You've been invited to TEKANGO",
        isHebrew ? 'הוזמנתם ליצור חשבון ב-<strong>TEKANGO</strong>. לחצו על הכפתור למטה כדי לקבל את ההזמנה.' : 'You have been invited to create a <strong>TEKANGO</strong> account. Click the button below to accept the invitation.',
        isHebrew ? 'הוזמנתם ליצור חשבון ב-TEKANGO.' : 'You have been invited to create a TEKANGO account.',
        isHebrew ? 'קבלת ההזמנה' : 'Accept Invitation',
        isHebrew ? 'לקבלת ההזמנה' : 'Accept the invitation',
        message.verifyUrl,
      );
    case 'email_change_confirm_current': {
      const safeNew = escapeHtml(message.newEmail);
      return withLink(
        isHebrew ? 'אישור שינוי כתובת האימייל בחשבון TEKANGO' : 'Confirm the email change on your TEKANGO account',
        isHebrew
          ? `קיבלנו בקשה לשנות את כתובת האימייל של חשבון TEKANGO שלכם לכתובת <strong>${safeNew}</strong>. לחצו על הכפתור למטה כדי לאשר מכתובת זו את השינוי. אם לא ביקשתם זאת, אל תלחצו על הכפתור ופנו אלינו בכתובת ${support}.`
          : `We received a request to change the email address of your TEKANGO account to <strong>${safeNew}</strong>. Click the button below to approve the change from this address. If you didn't request this, do not click the button and contact us at ${support}.`,
        isHebrew
          ? `קיבלנו בקשה לשנות את כתובת האימייל של חשבון TEKANGO שלכם לכתובת ${message.newEmail}. אם לא ביקשתם זאת, אל תשתמשו בקישור ופנו אלינו בכתובת ${support}.`
          : `We received a request to change the email address of your TEKANGO account to ${message.newEmail}. If you didn't request this, do not use the link and contact us at ${support}.`,
        isHebrew ? 'אישור השינוי' : 'Approve Email Change',
        isHebrew ? 'לאישור השינוי' : 'Approve the email change',
        message.verifyUrl,
      );
    }
    case 'email_change_confirm_new':
      return withLink(
        isHebrew ? 'אישור כתובת האימייל החדשה ל-TEKANGO' : 'Confirm your new TEKANGO email address',
        isHebrew
          ? 'כתובת זו הוזנה ככתובת האימייל החדשה של חשבון TEKANGO. לחצו על הכפתור למטה כדי לאשר שהכתובת שייכת לכם. אם לא ביקשתם זאת, ניתן להתעלם מהודעה זו בבטחה.'
          : "This address was entered as the new email address of a TEKANGO account. Click the button below to confirm that it belongs to you. If you didn't request this, you can safely ignore this email.",
        isHebrew
          ? 'כתובת זו הוזנה ככתובת האימייל החדשה של חשבון TEKANGO. אם לא ביקשתם זאת, ניתן להתעלם מהודעה זו בבטחה.'
          : "This address was entered as the new email address of a TEKANGO account. If you didn't request this, you can safely ignore this email.",
        isHebrew ? 'אישור הכתובת החדשה' : 'Confirm New Email',
        isHebrew ? 'לאישור הכתובת החדשה' : 'Confirm the new email address',
        message.verifyUrl,
      );
    case 'reauthentication': {
      const code = escapeHtml(message.code);
      return {
        subject: isHebrew ? 'קוד אימות ל-TEKANGO' : 'Your TEKANGO verification code',
        html: wrapEmail(isHebrew, `<p>${greeting}</p><p style="line-height:1.6;">${isHebrew ? 'קוד האימות שלכם לאישור הפעולה בחשבון TEKANGO:' : 'Your code to confirm the action on your TEKANGO account:'}</p><p style="font-size:1.6rem;font-weight:800;letter-spacing:4px;" dir="ltr">${code}</p><p style="line-height:1.6;">${escapeHtml(notMe)}</p><p style="margin-top:24px;">${signature}</p>`),
        text: `${greeting}\n\n${isHebrew ? 'קוד האימות שלכם לאישור הפעולה בחשבון TEKANGO' : 'Your code to confirm the action on your TEKANGO account'}: ${message.code}\n\n${notMe}\n\n${signatureText}`,
      };
    }
    case 'password_changed_notification':
      return infoOnly(
        isHebrew ? 'הסיסמה של חשבון TEKANGO שונתה' : 'Your TEKANGO password was changed',
        isHebrew ? 'הסיסמה של חשבון TEKANGO שלכם שונתה.' : 'The password of your TEKANGO account was changed.',
        isHebrew ? 'הסיסמה של חשבון TEKANGO שלכם שונתה.' : 'The password of your TEKANGO account was changed.',
      );
    case 'email_changed_notification': {
      const newEmail = message.details.email ?? '';
      return infoOnly(
        isHebrew ? 'כתובת האימייל של חשבון TEKANGO שונתה' : 'Your TEKANGO email address was changed',
        isHebrew
          ? `כתובת האימייל של חשבון TEKANGO שלכם שונתה לכתובת <strong>${escapeHtml(newEmail)}</strong>.`
          : `The email address of your TEKANGO account was changed to <strong>${escapeHtml(newEmail)}</strong>.`,
        isHebrew
          ? `כתובת האימייל של חשבון TEKANGO שלכם שונתה לכתובת ${newEmail}.`
          : `The email address of your TEKANGO account was changed to ${newEmail}.`,
      );
    }
    case 'phone_changed_notification':
      return infoOnly(
        isHebrew ? 'מספר הטלפון בחשבון TEKANGO שונה' : 'Your TEKANGO phone number was changed',
        isHebrew ? 'מספר הטלפון המקושר לחשבון TEKANGO שלכם שונה.' : 'The phone number linked to your TEKANGO account was changed.',
        isHebrew ? 'מספר הטלפון המקושר לחשבון TEKANGO שלכם שונה.' : 'The phone number linked to your TEKANGO account was changed.',
      );
    case 'identity_linked_notification':
    case 'identity_unlinked_notification': {
      const linked = message.kind === 'identity_linked_notification';
      const provider = message.details.provider ?? '';
      const providerHtml = provider ? ` (<strong>${escapeHtml(provider)}</strong>)` : '';
      const providerText = provider ? ` (${provider})` : '';
      return infoOnly(
        linked
          ? (isHebrew ? 'שיטת התחברות חדשה נוספה לחשבון TEKANGO' : 'A sign-in method was added to your TEKANGO account')
          : (isHebrew ? 'שיטת התחברות הוסרה מחשבון TEKANGO' : 'A sign-in method was removed from your TEKANGO account'),
        linked
          ? (isHebrew ? `שיטת התחברות${providerHtml} נוספה לחשבון TEKANGO שלכם.` : `A sign-in method${providerHtml} was added to your TEKANGO account.`)
          : (isHebrew ? `שיטת התחברות${providerHtml} הוסרה מחשבון TEKANGO שלכם.` : `A sign-in method${providerHtml} was removed from your TEKANGO account.`),
        linked
          ? (isHebrew ? `שיטת התחברות${providerText} נוספה לחשבון TEKANGO שלכם.` : `A sign-in method${providerText} was added to your TEKANGO account.`)
          : (isHebrew ? `שיטת התחברות${providerText} הוסרה מחשבון TEKANGO שלכם.` : `A sign-in method${providerText} was removed from your TEKANGO account.`),
      );
    }
    case 'mfa_factor_enrolled_notification':
    case 'mfa_factor_unenrolled_notification': {
      const enrolled = message.kind === 'mfa_factor_enrolled_notification';
      const factor = message.details.factorType ?? '';
      const factorHtml = factor ? ` (<strong>${escapeHtml(factor)}</strong>)` : '';
      const factorText = factor ? ` (${factor})` : '';
      return infoOnly(
        enrolled
          ? (isHebrew ? 'אמצעי אימות דו-שלבי נוסף לחשבון TEKANGO' : 'A two-factor method was added to your TEKANGO account')
          : (isHebrew ? 'אמצעי אימות דו-שלבי הוסר מחשבון TEKANGO' : 'A two-factor method was removed from your TEKANGO account'),
        enrolled
          ? (isHebrew ? `אמצעי אימות דו-שלבי${factorHtml} נוסף לחשבון TEKANGO שלכם.` : `A two-factor authentication method${factorHtml} was added to your TEKANGO account.`)
          : (isHebrew ? `אמצעי אימות דו-שלבי${factorHtml} הוסר מחשבון TEKANGO שלכם.` : `A two-factor authentication method${factorHtml} was removed from your TEKANGO account.`),
        enrolled
          ? (isHebrew ? `אמצעי אימות דו-שלבי${factorText} נוסף לחשבון TEKANGO שלכם.` : `A two-factor authentication method${factorText} was added to your TEKANGO account.`)
          : (isHebrew ? `אמצעי אימות דו-שלבי${factorText} הוסר מחשבון TEKANGO שלכם.` : `A two-factor authentication method${factorText} was removed from your TEKANGO account.`),
      );
    }
  }
}
