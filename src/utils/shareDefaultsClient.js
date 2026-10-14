// Task 27 (P2, spec §6) - the owner's MANUAL sharing defaults (public.business_share_defaults, migration 20261011110000):
//   share_text   - the default WhatsApp message the owner sends HIMSELF (variables below); the quote link is always appended
//   thanks_text  - an optional thank-you the customer sees on the public quote only after a server-verified signature
//   website_url + show_website_after_signature - an optional, opt-in https link shown next to that thank-you (never a redirect)
// Nothing here sends anything. Owner-only (RLS forced); results never throw; 'unavailable' = the table is not on this server yet.
import { SHARE_VARIABLES, renderShareTemplate } from '../../supabase/functions/_shared/shareMessage.js';

export { SHARE_VARIABLES };
export const SHARE_DEFAULTS_COLUMNS = 'user_id, share_text, thanks_text, website_url, show_website_after_signature';
export const SHARE_TEXT_MAX = 600;
export const THANKS_TEXT_MAX = 300;
const WEBSITE_RE = /^https:\/\/[^\s<>"]+$/;
export const EMPTY_SHARE_DEFAULTS = Object.freeze({ share_text: '', thanks_text: '', website_url: '', show_website_after_signature: false });

const fail = (code, message = '') => ({ ok: false, error: { code, message: String(message || '').slice(0, 300) } });
export function classifyShareDefaultsError(error) {
  const text = `${error?.code ?? ''} ${error?.message ?? ''}`;
  if (/relation .* does not exist|Could not find the table|schema cache|PGRST205|42P01|PGRST204/i.test(text)) return 'unavailable';
  if (/row-level security|permission denied|42501|JWT|not authorized/i.test(text)) return 'not_allowed';
  if (/check constraint|business_share_defaults_/i.test(text)) return 'invalid';
  if (/fetch|network|timeout/i.test(text)) return 'network';
  return 'unknown';
}
const fromError = (error) => fail(classifyShareDefaultsError(error), error?.message);
const usable = (client, userId) => client && typeof client.from === 'function' && typeof userId === 'string' && userId;
const rowToValue = (row) => (row ? {
  share_text: row.share_text || '', thanks_text: row.thanks_text || '', website_url: row.website_url || '', show_website_after_signature: row.show_website_after_signature === true,
} : { ...EMPTY_SHARE_DEFAULTS });

// The same rules as the table CHECKs (trimmed, bounded, https only, opt-in needs a URL) -> { ok, value (DB shape, '' -> NULL) } | { ok: false, errors }
export function normalizeShareDefaults(v) {
  const share = String(v?.share_text ?? '').trim();
  const thanks = String(v?.thanks_text ?? '').trim();
  const url = String(v?.website_url ?? '').trim();
  const optIn = v?.show_website_after_signature === true;
  const errors = [];
  if (share.length > SHARE_TEXT_MAX) errors.push('share_text_too_long');
  if (thanks.length > THANKS_TEXT_MAX) errors.push('thanks_text_too_long');
  if (url && (url.length > 300 || !WEBSITE_RE.test(url))) errors.push('website_invalid');
  if (optIn && !url) errors.push('website_required');
  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { share_text: share || null, thanks_text: thanks || null, website_url: url || null, show_website_after_signature: optIn } };
}

export async function loadShareDefaults(client, userId) {
  if (!usable(client, userId)) return fail('not_signed_in');
  try {
    const { data, error } = await client.from('business_share_defaults').select(SHARE_DEFAULTS_COLUMNS).eq('user_id', userId).maybeSingle();
    if (error) return fromError(error);
    return { ok: true, value: rowToValue(data) };
  } catch (e) { return fail('network', e?.message); }
}

export async function saveShareDefaults(client, userId, value) {
  if (!usable(client, userId)) return fail('not_signed_in');
  const n = normalizeShareDefaults(value);
  if (!n.ok) return { ok: false, error: { code: 'invalid', message: n.errors.join(',') }, errors: n.errors };
  try {
    const { data, error } = await client.from('business_share_defaults').upsert({ user_id: userId, ...n.value }, { onConflict: 'user_id' }).select(SHARE_DEFAULTS_COLUMNS).single();
    if (error) return fromError(error);
    if (!data || data.user_id !== userId) return fail('unknown', 'no persisted row returned');
    return { ok: true, value: rowToValue(data) };
  } catch (e) { return fail('network', e?.message); }
}

// The owner's message with the variables filled in (unknown braces stay as typed). Returns null when there is no custom text, so the
// caller keeps its built-in message unchanged.
export function renderShareText(template, vars = {}) {
  return renderShareTemplate(template, vars, { format: 'text', rtl: false }); // Task 28: the one shared formatter
}
