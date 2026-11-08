// Task 27 (P2, spec §6) - the ONE data path of whole-quote templates (public.quote_templates, migration 20261011110000). Owner-only (RLS
// forced; the explicit user_id filter is defence in depth). Content is sanitized again here before it is written (quoteTemplates.js);
// the database refuses forbidden keys on its own. Results never throw; 'unavailable' = the table is not on this server yet;
// 'duplicate_name' = the owner already has a template with that name.
import { buildTemplateContent, normalizeTemplateName, readTemplateContent, stripForbiddenKeys, TEMPLATE_SCHEMA } from './quoteTemplates';

export const TEMPLATE_COLUMNS = 'id, user_id, name, content, created_at, updated_at';
const fail = (code, message = '') => ({ ok: false, error: { code, message: String(message || '').slice(0, 300) } });
export function classifyTemplateError(error) {
  const text = `${error?.code ?? ''} ${error?.message ?? ''}`;
  if (/relation .* does not exist|Could not find the table|schema cache|PGRST205|42P01|PGRST204/i.test(text)) return 'unavailable';
  if (/quote_templates_owner_name|23505|duplicate key/i.test(text)) return 'duplicate_name';
  if (/quote_templates_content_size/i.test(text)) return 'too_large';
  if (/row-level security|permission denied|42501|JWT|not authorized/i.test(text)) return 'not_allowed';
  if (/check constraint|quote_templates_/i.test(text)) return 'invalid';
  if (/fetch|network|timeout/i.test(text)) return 'network';
  return 'unknown';
}
const fromError = (error) => fail(classifyTemplateError(error), error?.message);
const usable = (client, userId) => client && typeof client.from === 'function' && typeof userId === 'string' && userId;

export async function listTemplates(client, userId) {
  if (!usable(client, userId)) return fail('not_signed_in');
  try {
    const { data, error } = await client.from('quote_templates').select(TEMPLATE_COLUMNS).eq('user_id', userId).order('name', { ascending: true });
    if (error) return fromError(error);
    // unreadable rows (unknown schema) are left out, never guessed
    return { ok: true, data: (Array.isArray(data) ? data : []).map((r) => ({ ...r, content: readTemplateContent(r.content) })).filter((r) => r.content) };
  } catch (e) { return fail('network', e?.message); }
}

export async function createTemplate(client, userId, name, form, keep) {
  if (!usable(client, userId)) return fail('not_signed_in');
  const n = normalizeTemplateName(name);
  if (!n.ok) return fail('invalid', n.error);
  const content = stripForbiddenKeys(buildTemplateContent(form, keep));
  if (content.schema !== TEMPLATE_SCHEMA || !Array.isArray(content.items) || content.items.length === 0) return fail('invalid', 'no_items');
  try {
    const { data, error } = await client.from('quote_templates').insert({ user_id: userId, name: n.value, content }).select(TEMPLATE_COLUMNS).single();
    if (error) return fromError(error);
    if (!data || data.user_id !== userId) return fail('unknown', 'no persisted row returned');
    return { ok: true, data: { ...data, content: readTemplateContent(data.content) } };
  } catch (e) { return fail('network', e?.message); }
}

export async function deleteTemplate(client, userId, id) {
  if (!usable(client, userId) || !id) return fail('not_signed_in');
  try {
    const { error } = await client.from('quote_templates').delete().eq('id', id).eq('user_id', userId);
    if (error) return fromError(error);
    return { ok: true };
  } catch (e) { return fail('network', e?.message); }
}
