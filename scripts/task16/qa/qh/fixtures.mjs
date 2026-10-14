// Task 16 - SYNTHETIC Quote History fixtures shared by layout-regression-gate.mjs and qh-room-compare.mjs (LOCAL-DEV only).
// No persona, no real account, no TEST/Production contact: every Supabase request is answered by a Playwright route mock.
//
// Variants (same shape for the Local/HE/ILS account and the International/EN/USD account):
//   std    - the original gate account (16 quotes, 4 client names, revenue of 5 digits). Kept byte-for-byte equal to the
//            data the base c65f742 list-room table (QH_BASE_LIST) was first measured with.
//   rev8   - same 16 quotes, but the approved quotes add up to an 8-DIGIT header revenue (12,345,678 - ILS whole shekels /
//            USD) and the list carries 7-digit amounts plus one 8-digit amount (Codex/TEST finding 2026-10-05).
//   long8  - 40 quotes, long client names (the approved client-name ellipsis), 8-digit revenue, 7/8-digit amounts.
//   basic8 - rev8 on the BASIC plan: the header stats then also show the "This month: n/limit" usage line.
//   free8  - rev8 on the FREE plan (upgrade badge button + usage line; the Codex TEST EN account was a FREE persona).
//   trial8 - rev8 on an active trial (FREE (TRIAL) · n days badge).
export const SUPA = 'http://127.0.0.1:54399';
export const QH_VARIANTS = ['std', 'rev8', 'long8', 'basic8', 'free8', 'trial8'];
// Revenue the 8-digit variants must show in the header (sum of the approved quotes' totals; whole numbers, so the ILS
// whole-shekel display (IRON-ILS-001) and the USD display show the same digits - no value is rounded by the fixture).
export const REV8_TOTAL = 12345678;

const LONG_NAMES = {
  he: ['אלומיניום הצפון והשרון לבנייה ושיפוצים בע"מ', 'משפחת כהן-לוי-אברהמי (דירת גן, רעננה מערב)', 'נגרות השרון - מטבחים, ארונות וחיפויי עץ', 'בית ספר אורנים לאמנויות ומדעים - אגף ב'],
  en: ['Northwind Builders and Renovation Contractors LLC', 'Harbor Kitchens & Custom Cabinetry International', 'Maple & Co Architectural Glass and Aluminium Works', 'Riverside Lofts Homeowners Association (Building C)'],
};

export function account(market, variant = 'std', now = Date.now()) {
  const local = market === 'Local';
  const uid = local ? '00000000-0000-4000-8000-00000000a001' : '00000000-0000-4000-8000-00000000b001';
  const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: local ? 'gate-local@example.test' : 'gate-intl@example.test', app_metadata: { provider: 'email' }, user_metadata: { country: market } };
  const plan = { basic8: 'basic', free8: 'free', trial8: 'free' }[variant] || 'pro';
  const trialEndsAt = variant === 'trial8' ? new Date(now + 9.5 * 86400000).toISOString() : null;
  const settings = { id: 9001, user_id: uid, business_name: local ? 'סטודיו בדיקה' : 'Audit Studio', plan, role: 'user', country: market, currency: local ? 'ILS' : 'USD', trial_ends_at: trialEndsAt };
  const shortNames = local ? ['אלומיניום הצפון בע"מ', 'משפחת כהן', 'נגרות השרון', 'דירת גן רעננה'] : ['Northwind Builders LLC', 'Harbor Kitchens', 'Maple & Co', 'Riverside Lofts'];
  const names = variant === 'long8' ? LONG_NAMES[local ? 'he' : 'en'] : shortNames;
  const count = variant === 'long8' ? 40 : 16;
  const statuses = ['draft', 'sent', 'approved', 'sent'];
  const approvedIdx = Array.from({ length: count }, (_, i) => i).filter((i) => statuses[i % 4] === 'approved');
  const big = variant !== 'std';
  const totalFor = (i) => {
    if (!big) return (1000 + i * 731.5) * (local ? 1.18 : 1);
    const k = approvedIdx.indexOf(i);
    if (k >= 0) { // spread REV8_TOTAL over the approved quotes in whole units; the last one takes the remainder
      const share = Math.floor(REV8_TOTAL / approvedIdx.length);
      return k === approvedIdx.length - 1 ? REV8_TOTAL - share * (approvedIdx.length - 1) : share;
    }
    return i === 1 ? 10250000 : 1234567 + i * 1000; // one 8-digit list amount, the rest 7 digits
  };
  const quotes = Array.from({ length: count }, (_, i) => {
    const total = totalFor(i);
    return {
      id: `00000000-0000-4000-9000-${String(i + 1).padStart(12, '0')}`, user_id: uid, quote_number: 1040 + i, client_id: `c${i % 4}`,
      clients: { id: `c${i % 4}`, company_name: names[i % 4], contact_name: names[i % 4] }, status: statuses[i % 4],
      created_at: new Date(now - i * 2 * 86400000).toISOString(), valid_until: new Date(now + (20 - i) * 86400000).toISOString().slice(0, 10),
      subtotal: big ? (local ? total / 1.18 : total) : 1000 + i * 731.5, discount: 0, tax_rate: local ? 18 : 0, total,
      currency: local ? 'ILS' : 'USD', client_type: 'business', quote_items: [], quote_sections: [],
    };
  });
  const session = { access_token: 't', token_type: 'bearer', expires_in: 86400, expires_at: Math.floor(now / 1000) + 86400, refresh_token: 'r', user };
  return { user, settings, quotes, session, variant, market };
}

// Same mock contract as the original gate (auth user, business_settings, quotes; every other REST table empty).
export async function mockAccount(ctx, acc, lang) {
  await ctx.route(`${SUPA}/**`, (route) => {
    const u = new URL(route.request().url());
    const single = (route.request().headers().accept || '').includes('vnd.pgrst.object');
    let body = {};
    if (u.pathname.startsWith('/auth/v1/user')) body = acc.user;
    else if (u.pathname.startsWith('/rest/v1/business_settings')) body = single ? acc.settings : [acc.settings];
    else if (u.pathname.startsWith('/rest/v1/quotes')) body = single ? acc.quotes[0] : acc.quotes;
    else if (u.pathname.startsWith('/rest/v1/rpc/')) body = null;
    else if (u.pathname.startsWith('/rest/v1/')) body = single ? null : [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await ctx.addInitScript(([s, l]) => { try { localStorage.setItem('sb-127-auth-token', s); localStorage.setItem('proflow_lang', l); } catch { /* storage unavailable */ } }, [JSON.stringify(acc.session), lang]);
}
