// Which messages the Auth Send Email Hook sends for one hook call (Codex Post-LIVE Wave 1 blocker 1, 2026-09-27).
//
// Contract sources (read 2026-09-27):
// - Supabase docs, "Send Email Hook" (supabase.com/docs/guides/auth/auth-hooks/send-email-hook): the documented
//   `email_action_type` values are exactly DOCUMENTED_ACTION_TYPES below; for `email_change` "The token hash field names
//   are reversed due to backward compatibility": `token_hash_new` goes with the CURRENT address (`user.email`) and `token`,
//   `token_hash` goes with the NEW address (`user.new_email`) and `token_new`. Secure Email Change enabled -> two emails;
//   disabled -> one email, to the new address.
// - supabase/auth source (internal/api/mail.go sendEmailChange + sendEmail): `token_hash` is always the new-address hash
//   (`EmailChangeTokenNew`); `token_hash_new` is set only when Secure Email Change is enabled AND the user has a current
//   email (`EmailChangeTokenCurrent`); otherwise it is empty and a single email goes to the new address. The pending new
//   address is serialized on the user as `new_email` (models.User.EmailChange). Built-in mailer links for both addresses
//   use `/verify?token=<hash>&type=email_change`. Notifications carry no token; the built-in mailer sends
//   `email_changed_notification` to the OLD address (`old_email`) and every other notification to `user.email`.
//   `reauthentication` is a one-time code only (no link).
//
// The secure/non-secure branch is taken from the payload itself (presence of `token_hash_new`), never from a guess about
// project configuration. `email` (EmailOTPVerification) is listed in the enum but its message semantics are not
// documented for this hook, so it is refused (non-2xx, nothing sent) rather than guessed.

import { buildVerifyUrl, type AuthEmailMessage, type NotificationActionType } from './emailContent.ts';

export const DOCUMENTED_ACTION_TYPES = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
  'reauthentication',
  'password_changed_notification',
  'email_changed_notification',
  'phone_changed_notification',
  'identity_linked_notification',
  'identity_unlinked_notification',
  'mfa_factor_enrolled_notification',
  'mfa_factor_unenrolled_notification',
] as const;

export const NOTIFICATION_ACTION_TYPES: readonly NotificationActionType[] = [
  'password_changed_notification',
  'email_changed_notification',
  'phone_changed_notification',
  'identity_linked_notification',
  'identity_unlinked_notification',
  'mfa_factor_enrolled_notification',
  'mfa_factor_unenrolled_notification',
];

export interface SendEmailHookPayload {
  user?: {
    id?: string;
    email?: string | null;
    new_email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  } | null;
  email_data?: {
    token?: string | null;
    token_hash?: string | null;
    token_new?: string | null;
    token_hash_new?: string | null;
    redirect_to?: string | null;
    email_action_type?: string | null;
    site_url?: string | null;
    old_email?: string | null;
    old_phone?: string | null;
    provider?: string | null;
    factor_type?: string | null;
  } | null;
}

// A planned message plus the stable suffix used to derive its provider idempotency key.
export type PlannedMessage = { slot: 'primary' | 'current' | 'new'; message: AuthEmailMessage };
export type EmailPlan = { ok: true; actionType: string; messages: PlannedMessage[] } | { ok: false; reason: string };

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
// Minimal address sanity (Auth has already validated addresses; this only rejects empty/structurally broken values).
const isAddress = (v: string) => /^[^\s@<>]+@[^\s@<>]+$/.test(v);

export function planAuthEmails(payload: SendEmailHookPayload, supabaseUrl: string): EmailPlan {
  const user = payload?.user ?? null;
  const data = payload?.email_data ?? null;
  if (!user || !data) return { ok: false, reason: 'malformed_payload' };

  const actionType = str(data.email_action_type);
  const email = str(user.email);
  const redirectTo = str(data.redirect_to);
  const link = (hash: string, verifyType: string) => buildVerifyUrl(supabaseUrl, hash, verifyType, redirectTo);

  switch (actionType) {
    case 'signup':
    case 'invite':
    case 'magiclink':
    case 'recovery': {
      const hash = str(data.token_hash);
      if (!isAddress(email)) return { ok: false, reason: 'missing_recipient' };
      if (!hash) return { ok: false, reason: 'missing_token_hash' };
      return { ok: true, actionType, messages: [{ slot: 'primary', message: { kind: actionType, to: email, verifyUrl: link(hash, actionType) } }] };
    }

    case 'email_change': {
      const newEmail = str(user.new_email);
      const hashForNew = str(data.token_hash); // reversed naming: token_hash -> NEW address
      const hashForCurrent = str(data.token_hash_new); // reversed naming: token_hash_new -> CURRENT address
      if (!isAddress(newEmail)) return { ok: false, reason: 'missing_new_email' };
      if (!hashForNew) return { ok: false, reason: 'missing_token_hash' };

      const toNew: PlannedMessage = {
        slot: 'new',
        message: { kind: 'email_change_confirm_new', to: newEmail, verifyUrl: link(hashForNew, 'email_change') },
      };
      if (!hashForCurrent) {
        // Secure Email Change disabled (or no current address): one email, to the NEW address only.
        return { ok: true, actionType, messages: [toNew] };
      }
      // Secure Email Change enabled: both addresses must confirm.
      if (!isAddress(email)) return { ok: false, reason: 'missing_current_email' };
      if (email.toLowerCase() === newEmail.toLowerCase()) return { ok: false, reason: 'current_equals_new' };
      return {
        ok: true,
        actionType,
        messages: [
          {
            slot: 'current',
            message: { kind: 'email_change_confirm_current', to: email, verifyUrl: link(hashForCurrent, 'email_change'), newEmail },
          },
          toNew,
        ],
      };
    }

    case 'reauthentication': {
      const code = str(data.token);
      if (!isAddress(email)) return { ok: false, reason: 'missing_recipient' };
      if (!/^\d{4,10}$/.test(code)) return { ok: false, reason: 'missing_token' };
      return { ok: true, actionType, messages: [{ slot: 'primary', message: { kind: 'reauthentication', to: email, code } }] };
    }

    case 'password_changed_notification':
    case 'email_changed_notification':
    case 'phone_changed_notification':
    case 'identity_linked_notification':
    case 'identity_unlinked_notification':
    case 'mfa_factor_enrolled_notification':
    case 'mfa_factor_unenrolled_notification': {
      const to = actionType === 'email_changed_notification' ? str(data.old_email) : email;
      if (!isAddress(to)) return { ok: false, reason: 'missing_recipient' };
      const details = {
        email: email || undefined,
        oldEmail: str(data.old_email) || undefined,
        provider: str(data.provider) || undefined,
        factorType: str(data.factor_type) || undefined,
      };
      return { ok: true, actionType, messages: [{ slot: 'primary', message: { kind: actionType, to, details } }] };
    }

    case 'email':
      return { ok: false, reason: 'unsupported_action_type:email' };

    default:
      return { ok: false, reason: 'unknown_action_type' };
  }
}
