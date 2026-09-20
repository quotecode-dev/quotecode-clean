import { describe, it, expect } from 'vitest';
import { ADMIN_NAV_GROUPS, ADMIN_SECTION_IDS, DEFAULT_ADMIN_SECTION, getAdminDestinationTitle } from './adminNavGroups';

describe('adminNavGroups - single source of truth for Admin destinations', () => {
  it('DEFAULT_ADMIN_SECTION is always a valid, known section id', () => {
    expect(ADMIN_SECTION_IDS.has(DEFAULT_ADMIN_SECTION)).toBe(true);
  });

  it('every nav group item has a unique id, present in ADMIN_SECTION_IDS', () => {
    const ids = ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(ADMIN_SECTION_IDS.has(id)).toBe(true);
  });

  it('ordinary business screens are never listed as Admin destinations', () => {
    const ids = ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));
    for (const businessTab of ['main', 'settings', 'clients', 'finances', 'catalog']) {
      expect(ids).not.toContain(businessTab);
    }
  });

  it('getAdminDestinationTitle falls back safely for an unknown/invalid section id', () => {
    expect(getAdminDestinationTitle('not-a-real-section', false)).toBeTruthy();
    expect(getAdminDestinationTitle(undefined, true)).toBeTruthy();
  });

  it('getAdminDestinationTitle returns a Hebrew string only when isHebrew is true', () => {
    const en = getAdminDestinationTitle('overview', false);
    const he = getAdminDestinationTitle('overview', true);
    expect(en).not.toBe(he);
  });
});
