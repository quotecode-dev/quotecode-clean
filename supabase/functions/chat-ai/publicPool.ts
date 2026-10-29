// Codex release 2a SEC-AI-01 (Owner console 2026-10-29, typed: "מאשר שחרור 2א עכשיו: ... ותקרה של 500 פניות ביום לצ'אט הציבורי (החלטה 4),
// כולל שינוי ב-L-17"): every caller that is not a verified dashboard user spends from ONE public pool of 500 paid provider attempts per UTC
// day (migration 20261030000000, chat_ai_public_reserve - atomic, service-only). Each physical provider request reserves first (a fallback
// is its own attempt); a refused or unavailable reservation calls no provider and answers with a fixed sentence - the site's information
// and the contact page stay available. PURE: the caller passes the reservation function.
export type PoolOutcome = 'ok' | 'exhausted' | 'unavailable';

export class PublicPoolRefusal extends Error {
  constructor(readonly reason: Exclude<PoolOutcome, 'ok'>) { super(`public_pool_${reason}`); }
}

export async function reservePublicSlot(reserve: () => Promise<{ data: unknown; error: unknown }>): Promise<PoolOutcome> {
  try {
    const { data, error } = await reserve();
    if (error || !data || typeof data !== 'object') return 'unavailable';
    const allowed = (data as { allowed?: unknown }).allowed;
    if (allowed === true) return 'ok';
    if (allowed === false) return 'exhausted';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export function publicPoolAnswer(isHebrew: boolean, reason: Exclude<PoolOutcome, 'ok'>): string {
  if (reason === 'exhausted') {
    return isHebrew
      ? 'מכסת התשובות החכמות להיום נוצלה. אפשר להמשיך להיעזר במידע שבאתר או לפנות אלינו דרך עמוד יצירת הקשר.'
      : 'Today’s allowance for smart answers has been reached. You can still use the information on the site or contact us through the Contact page.';
  }
  return isHebrew
    ? 'התשובות החכמות אינן זמינות כרגע. אפשר להמשיך להיעזר במידע שבאתר או לפנות אלינו דרך עמוד יצירת הקשר.'
    : 'Smart answers are not available right now. You can still use the information on the site or contact us through the Contact page.';
}
