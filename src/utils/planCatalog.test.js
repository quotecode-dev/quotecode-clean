import { describe, it, expect } from 'vitest';
import { PLAN_CATALOG, PLAN_IDS, getPlanDefinition, getEntitlementSet, BADGE_STATE_META, DISPLAY_IDENTITY_LABELS, getDisplayIdentityLabel, shouldShowUpgradeCta, DISPLAY_IDENTITY_BADGE_META, getDisplayIdentityBadgeMeta } from './planCatalog';

describe('planCatalog', () => {
  it('defines exactly the three currently-authorized purchasable plans', () => {
    expect(PLAN_IDS).toEqual(['free', 'basic', 'pro']);
    expect(Object.keys(PLAN_CATALOG).sort()).toEqual(['basic', 'free', 'pro']);
  });

  it('does not define TRIAL as a catalog entry — trial is a lifecycle state, not a purchasable plan', () => {
    expect(PLAN_CATALOG.trial).toBeUndefined();
  });

  it('every plan carries both HE and EN display labels', () => {
    for (const id of PLAN_IDS) {
      const def = PLAN_CATALOG[id];
      expect(def.displayLabel.he).toBeTruthy();
      expect(def.displayLabel.en).toBeTruthy();
    }
  });

  it('every plan carries a badge icon and color token (no hardcoded hex in the catalog itself)', () => {
    for (const id of PLAN_IDS) {
      const def = PLAN_CATALOG[id];
      expect(def.badge.icon).toBeTruthy();
      expect(def.badge.colorToken).toBeTruthy();
      expect(def.badge.bgTint).toMatch(/^rgba\(/);
    }
  });

  it('preserves the already-approved entitlement limits exactly (5/20/unlimited quotes)', () => {
    expect(PLAN_CATALOG.free.entitlements.monthlyQuoteLimit).toBe(5);
    expect(PLAN_CATALOG.basic.entitlements.monthlyQuoteLimit).toBe(20);
    expect(PLAN_CATALOG.pro.entitlements.monthlyQuoteLimit).toBe(Infinity);
  });

  it('preserves the already-approved feature gates exactly (edit/duplicate, WhatsApp/delete, attachments)', () => {
    expect(PLAN_CATALOG.free.entitlements.editDuplicate).toBe(false);
    expect(PLAN_CATALOG.basic.entitlements.editDuplicate).toBe(true);
    expect(PLAN_CATALOG.pro.entitlements.editDuplicate).toBe(true);

    expect(PLAN_CATALOG.free.entitlements.whatsappDelete).toBe(false);
    expect(PLAN_CATALOG.basic.entitlements.whatsappDelete).toBe(false);
    expect(PLAN_CATALOG.pro.entitlements.whatsappDelete).toBe(true);

    expect(PLAN_CATALOG.free.entitlements.attachments).toBe(false);
    expect(PLAN_CATALOG.basic.entitlements.attachments).toBe(false);
    expect(PLAN_CATALOG.pro.entitlements.attachments).toBe(true);
  });

  it('ranks plans in ascending commercial order (free < basic < pro)', () => {
    expect(PLAN_CATALOG.free.rank).toBeLessThan(PLAN_CATALOG.basic.rank);
    expect(PLAN_CATALOG.basic.rank).toBeLessThan(PLAN_CATALOG.pro.rank);
  });

  it('all three plans are currently sellable and not hidden (matches the closed "BASIC is real and sellable" decision)', () => {
    for (const id of PLAN_IDS) {
      expect(PLAN_CATALOG[id].sellable).toBe(true);
      expect(PLAN_CATALOG[id].hidden).toBe(false);
    }
  });

  describe('getPlanDefinition', () => {
    it('returns the matching definition for a known id, case-insensitively', () => {
      expect(getPlanDefinition('pro').id).toBe('pro');
      expect(getPlanDefinition('PRO').id).toBe('pro');
    });

    it('falls back to free for an unknown/malformed id, defensively not by guessing', () => {
      expect(getPlanDefinition('enterprise').id).toBe('free');
      expect(getPlanDefinition(null).id).toBe('free');
      expect(getPlanDefinition(undefined).id).toBe('free');
    });
  });

  it('defines a separate TRIAL badge-state metadata entry, distinct from the plan catalog itself', () => {
    expect(BADGE_STATE_META.TRIAL.icon).toBeTruthy();
    expect(BADGE_STATE_META.TRIAL.colorToken).toBeTruthy();
  });

  // חוק ברזל (LIFETIME Full-PRO Inheritance, §151): הבדיקות האלה בכוונה
  // *לא* רושמות רשימת-שדות מפורשת (monthlyQuoteLimit/editDuplicate/...) -
  // הן משוות ישירות אל PLAN_CATALOG.pro.entitlements עצמו, כדי שיכולת
  // עתידית שתתווסף שם תישאר מכוסה אוטומטית בלי לגעת בקובץ-הבדיקה הזה.
  describe('getEntitlementSet — the single inheritance point (§151)', () => {
    it('returns exactly the entitlements object stored for a known plan, whatever fields it currently contains', () => {
      expect(getEntitlementSet('free')).toEqual(PLAN_CATALOG.free.entitlements);
      expect(getEntitlementSet('basic')).toEqual(PLAN_CATALOG.basic.entitlements);
      expect(getEntitlementSet('pro')).toEqual(PLAN_CATALOG.pro.entitlements);
    });

    it('returns a fresh copy, not a shared reference — mutating the result must not corrupt the catalog', () => {
      const result = getEntitlementSet('pro');
      result.monthlyQuoteLimit = 1;
      expect(PLAN_CATALOG.pro.entitlements.monthlyQuoteLimit).toBe(Infinity);
    });

    it('falls back to free for an unknown plan id, same as getPlanDefinition', () => {
      expect(getEntitlementSet('enterprise')).toEqual(PLAN_CATALOG.free.entitlements);
    });
  });

  // חוק ברזל (Professional Quotes Stage B, PROFLOW_PROJECT_CONTEXT.md §156,
  // Owner-approved canonical matrix §155.1.8/§155.1.9/§155.1.10): שתי
  // יכולות נפרדות, ניתנות-לניהול-עצמאי - professionalQuotes (ליבה,
  // BASIC+) ו-professionalQuoteReuse (מתקדם, PRO+ בלבד). הוספו כשדות-
  // entitlements רגילים - LIFETIME/FREE(TRIAL) יורשים אוטומטית דרך
  // getEntitlementSet('pro') הקיים, ללא קוד חדש כלשהו.
  describe('Professional Quotes entitlement matrix (§155.1.8-10, Stage B)', () => {
    it('FREE: neither capability', () => {
      expect(PLAN_CATALOG.free.entitlements.professionalQuotes).toBe(false);
      expect(PLAN_CATALOG.free.entitlements.professionalQuoteReuse).toBe(false);
    });

    it('BASIC: Core yes, Advanced Reuse no — the approved product differentiator', () => {
      expect(PLAN_CATALOG.basic.entitlements.professionalQuotes).toBe(true);
      expect(PLAN_CATALOG.basic.entitlements.professionalQuoteReuse).toBe(false);
    });

    it('PRO: both capabilities', () => {
      expect(PLAN_CATALOG.pro.entitlements.professionalQuotes).toBe(true);
      expect(PLAN_CATALOG.pro.entitlements.professionalQuoteReuse).toBe(true);
    });
  });
});

describe('DISPLAY_IDENTITY_LABELS / getDisplayIdentityLabel (Stage 1, PROFLOW_PROJECT_CONTEXT.md §148)', () => {
  it('defines exactly the five canonical display identities', () => {
    expect(Object.keys(DISPLAY_IDENTITY_LABELS).sort()).toEqual(['BASIC', 'FREE', 'FREE_TRIAL', 'LIFETIME', 'PRO']);
  });

  it('every identity carries both HE and EN labels', () => {
    for (const key of Object.keys(DISPLAY_IDENTITY_LABELS)) {
      expect(DISPLAY_IDENTITY_LABELS[key].he).toBeTruthy();
      expect(DISPLAY_IDENTITY_LABELS[key].en).toBeTruthy();
    }
  });

  it('FREE_TRIAL and LIFETIME are distinct labels from PRO, in both languages', () => {
    expect(DISPLAY_IDENTITY_LABELS.FREE_TRIAL.en).not.toBe(DISPLAY_IDENTITY_LABELS.PRO.en);
    expect(DISPLAY_IDENTITY_LABELS.LIFETIME.en).not.toBe(DISPLAY_IDENTITY_LABELS.PRO.en);
    expect(DISPLAY_IDENTITY_LABELS.FREE_TRIAL.he).not.toBe(DISPLAY_IDENTITY_LABELS.PRO.he);
    expect(DISPLAY_IDENTITY_LABELS.LIFETIME.he).not.toBe(DISPLAY_IDENTITY_LABELS.PRO.he);
  });

  it('the EN label for FREE_TRIAL is exactly "FREE (TRIAL)", the Owner-required literal string', () => {
    expect(DISPLAY_IDENTITY_LABELS.FREE_TRIAL.en).toBe('FREE (TRIAL)');
  });

  it('getDisplayIdentityLabel returns the correct label per language', () => {
    expect(getDisplayIdentityLabel('LIFETIME', false)).toBe('LIFETIME');
    expect(getDisplayIdentityLabel('FREE_TRIAL', false)).toBe('FREE (TRIAL)');
    expect(getDisplayIdentityLabel('PRO', true)).toBe('PRO');
  });

  it('falls back to FREE for an unknown identity, defensively not by guessing', () => {
    expect(getDisplayIdentityLabel('ENTERPRISE', false)).toBe(DISPLAY_IDENTITY_LABELS.FREE.en);
  });
});

describe('shouldShowUpgradeCta (Stage 1 — the single canonical rule replacing the two contradictory ones found at §147.1)', () => {
  it('shows for FREE', () => {
    expect(shouldShowUpgradeCta({ tier: 'free', isLifetime: false, isSuperAdmin: false })).toBe(true);
  });

  it('shows for BASIC', () => {
    expect(shouldShowUpgradeCta({ tier: 'basic', isLifetime: false, isSuperAdmin: false })).toBe(true);
  });

  it('hides for ordinary PRO (already at the top sellable tier)', () => {
    expect(shouldShowUpgradeCta({ tier: 'pro', isLifetime: false, isSuperAdmin: false })).toBe(false);
  });

  it('hides for an active trial (tier resolves to pro during trial, same as ordinary PRO)', () => {
    expect(shouldShowUpgradeCta({ tier: 'pro', isLifetime: false, isSuperAdmin: false })).toBe(false);
  });

  it('hides for Lifetime — the Owner-required core case, even if tier happens to be basic', () => {
    expect(shouldShowUpgradeCta({ tier: 'pro', isLifetime: true, isSuperAdmin: false })).toBe(false);
    expect(shouldShowUpgradeCta({ tier: 'basic', isLifetime: true, isSuperAdmin: false })).toBe(false);
  });

  it('hides for super_admin regardless of tier', () => {
    expect(shouldShowUpgradeCta({ tier: 'free', isLifetime: false, isSuperAdmin: true })).toBe(false);
  });
});

describe('DISPLAY_IDENTITY_VISUAL / getDisplayIdentityVisual (Professional Plan-Identity Icon System, Owner-required 2026-09-03)', () => {
  it('defines a visual entry for all five canonical display identities', () => {
    expect(Object.keys(DISPLAY_IDENTITY_BADGE_META).sort()).toEqual(['BASIC', 'FREE', 'FREE_TRIAL', 'LIFETIME', 'PRO'].sort());
    for (const key of Object.keys(DISPLAY_IDENTITY_BADGE_META)) {
      const meta = DISPLAY_IDENTITY_BADGE_META[key];
      expect(meta.icon).toBeTruthy();
      expect(meta.colorToken).toBeTruthy();
      expect(meta.gradientFrom).toBeTruthy();
      expect(meta.gradientTo).toBeTruthy();
    }
  });

  it('matches the Owner-approved visual family: FREE=leaf, BASIC=diamond(gem), PRO/LIFETIME=crown', () => {
    expect(DISPLAY_IDENTITY_BADGE_META.FREE.icon).toBe('Leaf');
    expect(DISPLAY_IDENTITY_BADGE_META.BASIC.icon).toBe('Gem');
    expect(DISPLAY_IDENTITY_BADGE_META.PRO.icon).toBe('Crown');
    expect(DISPLAY_IDENTITY_BADGE_META.LIFETIME.icon).toBe('Crown');
  });

  it('LIFETIME shares PRO\'s base icon/color family (it inherits PRO capabilities) but carries a distinct accent icon — never depends on color alone', () => {
    expect(DISPLAY_IDENTITY_BADGE_META.LIFETIME.icon).toBe(DISPLAY_IDENTITY_BADGE_META.PRO.icon);
    expect(DISPLAY_IDENTITY_BADGE_META.LIFETIME.colorToken).toBe(DISPLAY_IDENTITY_BADGE_META.PRO.colorToken);
    expect(DISPLAY_IDENTITY_BADGE_META.LIFETIME.accentIcon).toBe('Infinity');
    expect(DISPLAY_IDENTITY_BADGE_META.PRO.accentIcon).toBeNull();
  });

  it('FREE_TRIAL belongs visually to the FREE family (leaf) but carries a distinct accent icon — never depends on color alone', () => {
    expect(DISPLAY_IDENTITY_BADGE_META.FREE_TRIAL.icon).toBe(DISPLAY_IDENTITY_BADGE_META.FREE.icon);
    expect(DISPLAY_IDENTITY_BADGE_META.FREE_TRIAL.accentIcon).toBe('Clock');
    expect(DISPLAY_IDENTITY_BADGE_META.FREE.accentIcon).toBeNull();
  });

  it('getDisplayIdentityBadgeMeta falls back safely to FREE for an unknown identity', () => {
    expect(getDisplayIdentityBadgeMeta('NOT_REAL')).toEqual(DISPLAY_IDENTITY_BADGE_META.FREE);
    expect(getDisplayIdentityBadgeMeta(undefined)).toEqual(DISPLAY_IDENTITY_BADGE_META.FREE);
  });
});
