// Task 24: owner read / write of the digital business card profile (public.business_cards, owner-only RLS). Closed statuses:
//   ok | unavailable (the table is not on this server yet - migration 20261011000000 not applied) | invalid (fails the stored limits) | failed
// The write sends exactly the contract row (cardProfileToRow) for the signed-in owner; nothing else is stored.
import { BUSINESS_CARD_PROFILE_COLUMNS, normalizeCardProfile, cardProfileToRow } from '../../supabase/functions/_shared/businessCard.js';

export const BUSINESS_CARD_TABLE = 'business_cards';
// Same "table not deployed" signals as the reminders client (src/utils/reminders.js).
const isMissingTable = (error) => /relation .* does not exist|Could not find the table|schema cache|PGRST205|42P01|PGRST204/i.test(`${error?.code ?? ''} ${error?.message ?? ''}`);

export async function loadCardProfile(client, userId) {
  try {
    const { data, error } = await client.from(BUSINESS_CARD_TABLE).select(BUSINESS_CARD_PROFILE_COLUMNS).eq('user_id', userId).maybeSingle();
    if (error) return { status: isMissingTable(error) ? 'unavailable' : 'failed' };
    return { status: 'ok', exists: !!data, profile: normalizeCardProfile(data) };
  } catch {
    return { status: 'failed' };
  }
}

export async function saveCardProfile(client, userId, profile) {
  const checked = cardProfileToRow(profile);
  if (!checked.ok) return { status: 'invalid', errors: checked.errors };
  try {
    const { data, error } = await client.from(BUSINESS_CARD_TABLE)
      .upsert({ user_id: userId, ...checked.row }, { onConflict: 'user_id' })
      .select(BUSINESS_CARD_PROFILE_COLUMNS)
      .single();
    if (error) return { status: isMissingTable(error) ? 'unavailable' : 'failed' };
    return { status: 'ok', profile: normalizeCardProfile(data) };
  } catch {
    return { status: 'failed' };
  }
}
