import { describe, it, expect } from 'vitest';
import { resolveAccountEntitlement } from './accountEntitlement';
import { getEntitlementSet } from './planCatalog';

const FIXED_NOW = new Date('2026-08-30T12:00:00.000Z');
const daysFromNow = (days) => new Date(FIXED_NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

describe('resolveAccountEntitlement — the confirmed Admin bug, regression-locked', () => {
  it('REGRESSION: a self-cancelled FREE account (plan:free, trial_ends_at:null) must resolve to FREE, never PRO/Lifetime', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('free');
    expect(r.badgeState).toBe('FREE');
    expect(r.isLifetime).toBe(false);
  });

  it('REGRESSION: same self-cancelled shape with trial_ends_at undefined (not just null) also resolves to FREE', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: undefined, role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('free');
    expect(r.isLifetime).toBe(false);
  });

  it('a genuine admin-granted Lifetime PRO account (plan:pro, trial_ends_at:null) resolves to PRO with isLifetime true', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('pro');
    expect(r.badgeState).toBe('PRO');
    expect(r.isLifetime).toBe(true);
  });

  it('a hypothetical Lifetime BASIC (plan:basic, trial_ends_at:null) resolves to BASIC with isLifetime true (same rule, not special-cased)', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('basic');
    expect(r.isLifetime).toBe(true);
  });
});

describe('resolveAccountEntitlement — trial lifecycle', () => {
  it('active trial, far from expiring: tier pro, badgeState TRIAL, trialStatus active', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('pro');
    expect(r.badgeState).toBe('TRIAL');
    expect(r.trialStatus).toBe('active');
    expect(r.trialDaysLeft).toBeGreaterThan(5);
  });

  it('active trial, within the expiring-soon window (<=5 days): trialStatus expiringSoon, tier still pro', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(3), role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('pro');
    expect(r.badgeState).toBe('TRIAL');
    expect(r.trialStatus).toBe('expiringSoon');
  });

  it('expired trial (past date, not null): tier flips to free, trialStatus expired, badgeState FREE — the core §91 fix, reconfirmed here', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(-5), role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('free');
    expect(r.trialStatus).toBe('expired');
    expect(r.badgeState).toBe('FREE');
    expect(r.isLifetime).toBe(false);
  });

  it('exact boundary (trial_ends_at exactly now) counts as expired', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: FIXED_NOW.toISOString(), role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('free');
    expect(r.trialStatus).toBe('expired');
  });

  it('genuine FREE (never trialed) has trialStatus none, not "expired"', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.trialStatus).toBe('none');
  });
});

describe('resolveAccountEntitlement — plan tiers', () => {
  it('FREE resolves correctly with FREE entitlement limits', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('free');
    expect(r.entitlement.monthlyQuoteLimit).toBe(5);
    expect(r.entitlement.editDuplicate).toBe(false);
    expect(r.entitlement.whatsappDelete).toBe(false);
    expect(r.entitlement.attachments).toBe(false);
  });

  it('BASIC resolves correctly with BASIC entitlement limits, independent of any trial_ends_at value present', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: daysFromNow(-30), role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('basic');
    expect(r.entitlement.monthlyQuoteLimit).toBe(20);
    expect(r.entitlement.editDuplicate).toBe(true);
    expect(r.entitlement.whatsappDelete).toBe(false);
    expect(r.entitlement.attachments).toBe(false);
    // BASIC's tier is never trial-derived - a stray/legacy trial_ends_at must not produce a trial badge.
    expect(r.trialStatus).toBe('none');
    expect(r.badgeState).toBe('BASIC');
  });

  it('PRO (via active trial) resolves with full PRO entitlement limits', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.entitlement.monthlyQuoteLimit).toBe(Infinity);
    expect(r.entitlement.editDuplicate).toBe(true);
    expect(r.entitlement.whatsappDelete).toBe(true);
    expect(r.entitlement.attachments).toBe(true);
  });

  it('PRO (via Lifetime) resolves with full PRO entitlement limits', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.entitlement.monthlyQuoteLimit).toBe(Infinity);
    expect(r.entitlement.whatsappDelete).toBe(true);
  });
});

describe('resolveAccountEntitlement — role and legacy-data edge cases', () => {
  it('super_admin always resolves to PRO tier and full entitlement, regardless of stored plan/trial fields', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'super_admin', now: FIXED_NOW });
    expect(r.tier).toBe('pro');
    expect(r.badgeState).toBe('PRO');
    expect(r.isSuperAdmin).toBe(true);
    expect(r.entitlement.whatsappDelete).toBe(true);
  });

  it('super_admin is never flagged isLifetime (that concept is for ordinary accounts, not the admin role itself)', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'super_admin', now: FIXED_NOW });
    expect(r.isLifetime).toBe(false);
  });

  it('malformed/unknown plan value fails safe to FREE-equivalent behavior and is flagged, not silently pretended-known', () => {
    const r = resolveAccountEntitlement({ plan: 'enterprise', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.isKnownPlan).toBe(false);
    expect(r.tier).toBe('free');
  });

  it('missing plan value (null) is treated as free and flagged as a known value (matches the DB column default, not a data error)', () => {
    const r = resolveAccountEntitlement({ plan: null, trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('free');
    expect(r.isKnownPlan).toBe(true);
  });

  it('is case-insensitive on the raw plan value, same as the underlying resolver', () => {
    const r = resolveAccountEntitlement({ plan: 'PRO', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('pro');
    expect(r.rawPlan).toBe('pro');
  });

  it('conflicting legacy state (raw plan free, but a genuinely future trial_ends_at present) resolves defensively to pro, same as the underlying resolver already did before this task', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: daysFromNow(5), role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('pro');
  });
});

describe('resolveAccountEntitlement — badgeState is a display concept, distinct from tier', () => {
  it('badgeState is FREE for genuine FREE, never TRIAL or PRO', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.badgeState).toBe('FREE');
  });

  it('badgeState is TRIAL (not PRO) for an active trial, even though the underlying tier is pro', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('pro');
    expect(r.badgeState).toBe('TRIAL');
  });

  it('badgeState is FREE (not TRIAL, not PRO) once a trial expires', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(-1), role: 'user', now: FIXED_NOW });
    expect(r.badgeState).toBe('FREE');
  });

  it('badgeState is PRO (not TRIAL) for a genuine Lifetime grant', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.badgeState).toBe('PRO');
  });
});

describe('resolveAccountEntitlement — displayIdentity (Stage 1, PROFLOW_PROJECT_CONTEXT.md §148, the five canonical identities)', () => {
  it('genuine FREE (never trialed): displayIdentity FREE', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('FREE');
  });

  it('active trial: displayIdentity FREE_TRIAL, never PRO, even though tier is pro', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.tier).toBe('pro');
    expect(r.displayIdentity).toBe('FREE_TRIAL');
  });

  it('expiring-soon trial: displayIdentity is still FREE_TRIAL, not FREE and not PRO', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(3), role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('FREE_TRIAL');
  });

  it('expired trial: displayIdentity reverts to FREE, not left as FREE_TRIAL and never PRO', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(-5), role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('FREE');
  });

  it('BASIC: displayIdentity BASIC (trial_ends_at present but irrelevant, matching the existing "independent of any trial_ends_at value" BASIC rule)', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: daysFromNow(-30), role: 'user', now: FIXED_NOW });
    expect(r.isLifetime).toBe(false);
    expect(r.displayIdentity).toBe('BASIC');
  });

  it('ordinary PRO (real trial_ends_at, active): PRO is represented as FREE_TRIAL while trialing, never a bare "PRO" identity during trial', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).not.toBe('PRO');
  });

  it('genuine Lifetime grant: displayIdentity LIFETIME, never PRO — the core Stage 1 fix', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.isLifetime).toBe(true);
    expect(r.displayIdentity).toBe('LIFETIME');
    expect(r.displayIdentity).not.toBe('PRO');
  });

  it('Lifetime BASIC (hypothetical, same rule not special-cased): displayIdentity LIFETIME, not BASIC', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('LIFETIME');
  });

  it('super_admin: displayIdentity PRO (matches existing badgeState/tier behavior for the admin role, not conflated with Lifetime)', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'super_admin', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('PRO');
    expect(r.isLifetime).toBe(false);
  });

  it('self-cancelled FREE (plan:free, trial_ends_at:null): displayIdentity FREE, never LIFETIME — regression guard for the already-known ambiguity', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('FREE');
  });
});

// חוק ברזל (Entitlement/Quota Centralization, PROFLOW_PROJECT_CONTEXT.md §150):
// החוזה הקנוני שהבעלים הגדיר במפורש עבור entitlement.monthlyQuoteLimit -
// המקור היחיד ש-Dashboard.jsx (תצוגה+אכיפה) קורא ממנו כעת, ללא נוסחה
// עצמאית משלו. שש הזהויות תואמות ישירות את הטבלה מהתקציר: FREE=5,
// FREE(TRIAL פעיל)=ללא הגבלה, FREE(TRIAL שפג)=5, BASIC=20, PRO
// (ללא הגבלה כל עוד ה"מנוי" בתוקף - תחת הארכיטקטורה הנוכחית מיוצג
// באמצעות אותו שדה trial_ends_at, ר' ההערה למטה), LIFETIME=ללא הגבלה
// ללא תלות בחבילה הגולמית שמתחתיו (התיקון המרכזי של המשימה הזו).
describe('resolveAccountEntitlement — Owner canonical quota contract (§150), six-identity matrix', () => {
  it('A. FREE: monthlyQuoteLimit = 5', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('FREE');
    expect(r.entitlement.monthlyQuoteLimit).toBe(5);
  });

  it('B. FREE (TRIAL active): monthlyQuoteLimit = unlimited (temporary PRO-level entitlement, per Core Architectural Law - identity stays FREE_TRIAL, never becomes real PRO)', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('FREE_TRIAL');
    expect(r.entitlement.monthlyQuoteLimit).toBe(Infinity);
  });

  it('B2. FREE (TRIAL expiring-soon, still active): monthlyQuoteLimit still unlimited until actual expiry', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(3), role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('FREE_TRIAL');
    expect(r.entitlement.monthlyQuoteLimit).toBe(Infinity);
  });

  it('C. FREE (TRIAL expired): monthlyQuoteLimit reverts to 5, not left unlimited', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(-5), role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('FREE');
    expect(r.entitlement.monthlyQuoteLimit).toBe(5);
  });

  it('D. BASIC: monthlyQuoteLimit = 20', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: daysFromNow(-30), role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('BASIC');
    expect(r.entitlement.monthlyQuoteLimit).toBe(20);
  });

  it('E. PRO (subscription-shaped, currently only representable via the trial-window field - see §150 blocker note): monthlyQuoteLimit = unlimited while that field has not yet expired', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.entitlement.monthlyQuoteLimit).toBe(Infinity);
    // בלוקר מתועד (§150/§8 בעלים): תחת הסכימה הנוכחית, אין דרך להבדיל בין
    // "PRO אמיתי בתשלום שטרם פג" לבין "ניסיון FREE פעיל" - שתיהן אותה צורת-
    // נתונים בדיוק (plan:'pro' + trial_ends_at עתידי אמיתי). displayIdentity
    // הנוכחי מזהה זאת נכון כ-FREE_TRIAL (לא PRO מזויף) - זו ההתנהגות
    // הנכונה תחת המגבלה הקיימת, לא באג, אבל "PRO תקף אמיתי" עצמאי-מזוהה
    // דורש שדה נפרד (subscription/billing) שאינו קיים היום.
    expect(r.displayIdentity).toBe('FREE_TRIAL');
  });

  it('F. LIFETIME on a pro-shaped underlying account: monthlyQuoteLimit = unlimited', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('LIFETIME');
    expect(r.entitlement.monthlyQuoteLimit).toBe(Infinity);
  });

  it('F2. THE CORE FIX: LIFETIME on a basic-shaped underlying account also resolves to monthlyQuoteLimit = unlimited, not 20 — proves the Owner\'s "LIFETIME = unlimited, no subscription expiry" contract holds regardless of the raw plan underneath. Before this task, isLifetime was computed but never consumed by monthlyQuoteLimit, so this exact case silently returned 20 (the same defect class as the David Aluminum "0/5" alarm, just at the BASIC/20 boundary instead of FREE/5).', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.isLifetime).toBe(true);
    expect(r.displayIdentity).toBe('LIFETIME');
    expect(r.tier).toBe('basic');
    expect(r.entitlement.monthlyQuoteLimit).toBe(Infinity);
  });

  it('F3. LIFETIME on a free-shaped underlying account is impossible by design (isLifetime requires rawPlan !== free) — self-cancel must never be reinterpreted as Lifetime', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.isLifetime).toBe(false);
    expect(r.entitlement.monthlyQuoteLimit).toBe(5);
  });
});

// חוק ברזל (§150, סעיף 19 - Boundary Tests): מראה בדיוק את אותה השוואה
// ש-Dashboard.jsx handleSaveQuote מבצע בפועל (monthlyQuotesCount >= limit),
// כנגד entitlement.monthlyQuoteLimit האמיתי לכל זהות - מבלי לשנות/למטב
// חשבון TEST אמיתי כדי להגיע למכסה.
describe('resolveAccountEntitlement — quota boundary proof (mirrors Dashboard.jsx enforcement comparison)', () => {
  const wouldBlock = (count, limit) => count >= limit;

  it('FREE: usage 4 does not block, usage 5 blocks', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(wouldBlock(4, r.entitlement.monthlyQuoteLimit)).toBe(false);
    expect(wouldBlock(5, r.entitlement.monthlyQuoteLimit)).toBe(true);
  });

  it('BASIC: usage 19 does not block, usage 20 blocks', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: daysFromNow(-30), role: 'user', now: FIXED_NOW });
    expect(wouldBlock(19, r.entitlement.monthlyQuoteLimit)).toBe(false);
    expect(wouldBlock(20, r.entitlement.monthlyQuoteLimit)).toBe(true);
  });

  it('FREE(TRIAL active): usage 20+ never blocks on the monthly quota', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(wouldBlock(20, r.entitlement.monthlyQuoteLimit)).toBe(false);
    expect(wouldBlock(9999, r.entitlement.monthlyQuoteLimit)).toBe(false);
  });

  it('LIFETIME (any underlying tier): usage 20+ never blocks on the monthly quota', () => {
    const rPro = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    const rBasic = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(wouldBlock(20, rPro.entitlement.monthlyQuoteLimit)).toBe(false);
    expect(wouldBlock(20, rBasic.entitlement.monthlyQuoteLimit)).toBe(false);
  });
});

// חוק ברזל (LIFETIME Full-PRO Inheritance, PROFLOW_PROJECT_CONTEXT.md §151,
// Owner-defined canonical rule): LIFETIME יורש את קבוצת-הזכאות *המלאה* של
// PRO - כל יכולת נוכחית ועתידית - עד ביטול מפורש של הבעלים. הארכיטקטורה
// חייבת להוכיח את זה כירושה אמיתית (getEntitlementSet('pro') דרך אותה
// נקודת-קריאה), לא כארבעה תנאי-Lifetime נפרדים. הבדיקה הכי חשובה כאן
// (I - "the architectural invariant") היא זו שלא מפרטת שדות בעצמה כלל -
// היא משווה ישירות בין תוצאת-LIFETIME לתוצאת-PRO, כך שיכולת חמישית
// עתידית תישאר מכוסה אוטומטית.
describe('resolveAccountEntitlement — LIFETIME Full-PRO Inheritance (§151)', () => {
  it('A. PRO entitlement object contains the expected full capability set', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.entitlement).toEqual({
      monthlyQuoteLimit: Infinity,
      editDuplicate: true,
      whatsappDelete: true,
      attachments: true,
      professionalQuotes: true,
      professionalQuoteReuse: true,
    });
  });

  it('B/I. THE ARCHITECTURAL INVARIANT: LIFETIME\'s entitlement set is deep-equal to a real PRO account\'s entitlement set, derived from the same source — not a hand-reproduction of today\'s four fields. A future fifth capability added to PLAN_CATALOG.pro.entitlements is automatically covered by this same comparison, with zero change to this test.', () => {
    const proResult = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    const lifetimeOnPro = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    const lifetimeOnBasic = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(lifetimeOnPro.entitlement).toEqual(proResult.entitlement);
    expect(lifetimeOnBasic.entitlement).toEqual(proResult.entitlement);
  });

  it('C. LIFETIME identity remains LIFETIME, not collapsed into PRO', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('LIFETIME');
    expect(r.isLifetime).toBe(true);
  });

  it('D. PRO identity remains PRO where representable (super_admin, the one currently-representable non-trial non-Lifetime PRO shape)', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'super_admin', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('PRO');
    expect(r.isLifetime).toBe(false);
  });

  it('E. FREE(TRIAL) receives temporary full PRO-level capabilities while retaining FREE_TRIAL display identity, never becoming real PRO/LIFETIME', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.displayIdentity).toBe('FREE_TRIAL');
    expect(r.entitlement).toEqual(getEntitlementSet('pro'));
  });

  it('F. BASIC does NOT accidentally inherit full PRO entitlements', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: daysFromNow(-30), role: 'user', now: FIXED_NOW });
    expect(r.entitlement).not.toEqual(getEntitlementSet('pro'));
    expect(r.entitlement.whatsappDelete).toBe(false);
    expect(r.entitlement.attachments).toBe(false);
  });

  it('G. FREE does NOT accidentally inherit full PRO entitlements', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.entitlement).not.toEqual(getEntitlementSet('pro'));
    expect(r.entitlement.monthlyQuoteLimit).toBe(5);
  });

  it('H. LIFETIME monthlyQuoteLimit = Infinity, regardless of underlying raw tier', () => {
    expect(resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', now: FIXED_NOW }).entitlement.monthlyQuoteLimit).toBe(Infinity);
    expect(resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', now: FIXED_NOW }).entitlement.monthlyQuoteLimit).toBe(Infinity);
  });

  it('I2. LIFETIME editDuplicate === PRO editDuplicate', () => {
    const pro = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    const lifetime = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(lifetime.entitlement.editDuplicate).toBe(pro.entitlement.editDuplicate);
    expect(lifetime.entitlement.editDuplicate).toBe(true);
  });

  it('J. LIFETIME whatsappDelete === PRO whatsappDelete', () => {
    const pro = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    const lifetime = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(lifetime.entitlement.whatsappDelete).toBe(pro.entitlement.whatsappDelete);
    expect(lifetime.entitlement.whatsappDelete).toBe(true);
  });

  it('K. LIFETIME attachments === PRO attachments', () => {
    const pro = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    const lifetime = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(lifetime.entitlement.attachments).toBe(pro.entitlement.attachments);
    expect(lifetime.entitlement.attachments).toBe(true);
  });

  it('super_admin entitlement set also matches getEntitlementSet("pro") exactly, via the same tier-forcing path, not a separate isSuperAdmin override', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'super_admin', now: FIXED_NOW });
    expect(r.entitlement).toEqual(getEntitlementSet('pro'));
  });
});

// חוק ברזל (Professional Quotes Stage B, PROFLOW_PROJECT_CONTEXT.md §156,
// Owner-approved canonical matrix §155.1.8/§155.1.9/§155.1.10): שתי יכולות
// עצמאיות - professionalQuotes (ליבה) ו-professionalQuoteReuse (מתקדם) -
// זורמות דרך אותה נקודת-אמת קנונית (getEntitlementSet) בדיוק כמו כל יכולת
// קודמת - אפס קוד ספציפי ל-Lifetime/Trial, אפס if(isLifetime) חדש. הבדיקה
// "I2. THE ARCHITECTURAL INVARIANT" הקיימת (למעלה) כבר משווה אובייקט-
// entitlement שלם בין LIFETIME ל-PRO אמיתי - היא מכסה את שתי היכולות
// החדשות אוטומטית, בלי לגעת בה כלל.
describe('resolveAccountEntitlement — Professional Quotes entitlement matrix (§156, Stage B)', () => {
  it('FREE: neither capability', () => {
    const r = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.entitlement.professionalQuotes).toBe(false);
    expect(r.entitlement.professionalQuoteReuse).toBe(false);
  });

  it('FREE(TRIAL active): both capabilities temporarily, identity stays FREE_TRIAL — never falsely becomes PRO', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.entitlement.professionalQuotes).toBe(true);
    expect(r.entitlement.professionalQuoteReuse).toBe(true);
    expect(r.displayIdentity).toBe('FREE_TRIAL');
  });

  it('FREE(TRIAL expired): both capabilities withdrawn automatically, reverts to FREE', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(-5), role: 'user', now: FIXED_NOW });
    expect(r.entitlement.professionalQuotes).toBe(false);
    expect(r.entitlement.professionalQuoteReuse).toBe(false);
    expect(r.displayIdentity).toBe('FREE');
  });

  it('BASIC: Core yes, Advanced Reuse no', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: daysFromNow(-30), role: 'user', now: FIXED_NOW });
    expect(r.entitlement.professionalQuotes).toBe(true);
    expect(r.entitlement.professionalQuoteReuse).toBe(false);
  });

  it('PRO: both capabilities', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    expect(r.entitlement.professionalQuotes).toBe(true);
    expect(r.entitlement.professionalQuoteReuse).toBe(true);
  });

  it('LIFETIME (pro-underlying): both capabilities, identity stays LIFETIME, obtained through canonical PRO inheritance — no isLifetime-specific code exists for these fields', () => {
    const r = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.entitlement.professionalQuotes).toBe(true);
    expect(r.entitlement.professionalQuoteReuse).toBe(true);
    expect(r.displayIdentity).toBe('LIFETIME');
    expect(r.isLifetime).toBe(true);
  });

  it('LIFETIME (basic-underlying): both capabilities still fully inherited — proves the inheritance is not tier-limited', () => {
    const r = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(r.entitlement.professionalQuotes).toBe(true);
    expect(r.entitlement.professionalQuoteReuse).toBe(true);
    expect(r.displayIdentity).toBe('LIFETIME');
  });

  it('LIFETIME entitlement object deep-equals a real PRO account entitlement object, including the two new capabilities — same architectural invariant proven in §151, automatically extended', () => {
    const pro = resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW });
    const lifetime = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(lifetime.entitlement).toEqual(pro.entitlement);
    expect(lifetime.entitlement.professionalQuotes).toBe(true);
    expect(lifetime.entitlement.professionalQuoteReuse).toBe(true);
  });

  it('regression: monthlyQuoteLimit is unaffected by the new capabilities for every identity', () => {
    expect(resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW }).entitlement.monthlyQuoteLimit).toBe(5);
    expect(resolveAccountEntitlement({ plan: 'basic', trialEndsAt: daysFromNow(-30), role: 'user', now: FIXED_NOW }).entitlement.monthlyQuoteLimit).toBe(20);
    expect(resolveAccountEntitlement({ plan: 'pro', trialEndsAt: daysFromNow(10), role: 'user', now: FIXED_NOW }).entitlement.monthlyQuoteLimit).toBe(Infinity);
    expect(resolveAccountEntitlement({ plan: 'basic', trialEndsAt: null, role: 'user', now: FIXED_NOW }).entitlement.monthlyQuoteLimit).toBe(Infinity);
  });

  it('regression: editDuplicate/whatsappDelete/attachments are unaffected by the new capabilities', () => {
    const free = resolveAccountEntitlement({ plan: 'free', trialEndsAt: null, role: 'user', now: FIXED_NOW });
    expect(free.entitlement.editDuplicate).toBe(false);
    expect(free.entitlement.whatsappDelete).toBe(false);
    expect(free.entitlement.attachments).toBe(false);
    const basic = resolveAccountEntitlement({ plan: 'basic', trialEndsAt: daysFromNow(-30), role: 'user', now: FIXED_NOW });
    expect(basic.entitlement.editDuplicate).toBe(true);
    expect(basic.entitlement.whatsappDelete).toBe(false);
    expect(basic.entitlement.attachments).toBe(false);
  });
});
