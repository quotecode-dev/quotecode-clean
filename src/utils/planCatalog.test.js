import { describe, it, expect } from 'vitest';
import { PLAN_CATALOG, PLAN_IDS, getPlanDefinition, BADGE_STATE_META } from './planCatalog';

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
    expect(PLAN_CATALOG.free.monthlyQuoteLimit).toBe(5);
    expect(PLAN_CATALOG.basic.monthlyQuoteLimit).toBe(20);
    expect(PLAN_CATALOG.pro.monthlyQuoteLimit).toBe(Infinity);
  });

  it('preserves the already-approved feature gates exactly (edit/duplicate, WhatsApp/delete, attachments)', () => {
    expect(PLAN_CATALOG.free.editDuplicate).toBe(false);
    expect(PLAN_CATALOG.basic.editDuplicate).toBe(true);
    expect(PLAN_CATALOG.pro.editDuplicate).toBe(true);

    expect(PLAN_CATALOG.free.whatsappDelete).toBe(false);
    expect(PLAN_CATALOG.basic.whatsappDelete).toBe(false);
    expect(PLAN_CATALOG.pro.whatsappDelete).toBe(true);

    expect(PLAN_CATALOG.free.attachments).toBe(false);
    expect(PLAN_CATALOG.basic.attachments).toBe(false);
    expect(PLAN_CATALOG.pro.attachments).toBe(true);
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
});
