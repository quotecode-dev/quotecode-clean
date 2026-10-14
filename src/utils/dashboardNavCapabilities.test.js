import { describe, it, expect } from 'vitest';
import { getDashboardNavCapabilities } from './dashboardNavCapabilities';

// Functional-Parity Root-Cause Audit (2026-09-08) found Super Admin's
// "User & Business Management" reachable on Desktop but absent from Mobile,
// because Desktop and Mobile each hand-maintained their own independent
// destination list. getDashboardNavCapabilities() is the single resolved
// source both Dashboard.jsx renderers now consume (see Dashboard.jsx's own
// `navCapabilities` const) - these tests validate that one canonical list
// directly, without needing to render/mock the full Dashboard component.

const t = {
  quotesNav: 'Quotes',
  settingsNav: 'Business Settings',
  clientsNav: 'Clients',
  financesNav: 'Finances',
  catalogNav: 'Catalog',
  usersAdminNav: 'Users Admin',
  statisticsNav: 'Statistics',
  tasksNav: 'Tasks',
  calendarNav: 'Calendar',
};

describe('getDashboardNavCapabilities - cross-viewport capability parity', () => {
  it('an ordinary user (isSuperAdmin=false) resolves exactly the 8 non-admin destinations, none admin-only', () => {
    const caps = getDashboardNavCapabilities({ isSuperAdmin: false, t, isHebrew: false });
    // Task 17 adds Statistics after Finances, Task 18 Tasks after Statistics, Task 19 Calendar after Tasks (approved relative order unchanged)
    expect(caps.map((c) => c.id)).toEqual(['main', 'clients', 'catalog', 'finances', 'statistics', 'tasks', 'calendar', 'settings']);
    expect(caps.some((c) => c.id === 'admin_clients')).toBe(false);
  });

  it('a Super Admin resolves the same 8 destinations PLUS admin_clients - never fewer, never a different set', () => {
    const caps = getDashboardNavCapabilities({ isSuperAdmin: true, t, isHebrew: false });
    expect(caps.map((c) => c.id)).toEqual(['main', 'clients', 'catalog', 'finances', 'statistics', 'tasks', 'calendar', 'settings', 'admin_clients']);
  });

  it('every destination has a mobileGroup, so no destination can silently exist for Desktop only', () => {
    for (const isSuperAdmin of [false, true]) {
      const caps = getDashboardNavCapabilities({ isSuperAdmin, t, isHebrew: false });
      for (const cap of caps) {
        expect(['bottom', 'more']).toContain(cap.mobileGroup);
      }
    }
  });

  it('the resolved Desktop-ordered set and the Mobile-grouped set (bottom + more) contain exactly the same ids - no destination lost or duplicated when split by group', () => {
    const caps = getDashboardNavCapabilities({ isSuperAdmin: true, t, isHebrew: false });
    const bottom = caps.filter((c) => c.mobileGroup === 'bottom').map((c) => c.id);
    const more = caps.filter((c) => c.mobileGroup === 'more').map((c) => c.id);
    expect([...bottom, ...more].sort()).toEqual(caps.map((c) => c.id).sort());
  });
});

describe('getDashboardNavCapabilities - role parity (mirrors the audit\'s required assertions)', () => {
  it('admin_clients exists for Super Admin and is absent for an ordinary user', () => {
    const adminCaps = getDashboardNavCapabilities({ isSuperAdmin: true, t, isHebrew: false });
    const userCaps = getDashboardNavCapabilities({ isSuperAdmin: false, t, isHebrew: false });
    expect(adminCaps.some((c) => c.id === 'admin_clients')).toBe(true);
    expect(userCaps.some((c) => c.id === 'admin_clients')).toBe(false);
  });

  it('admin_clients is grouped into Mobile "more", not forced into the primary bottom row', () => {
    const caps = getDashboardNavCapabilities({ isSuperAdmin: true, t, isHebrew: false });
    const admin = caps.find((c) => c.id === 'admin_clients');
    expect(admin.mobileGroup).toBe('more');
  });
});

describe('getDashboardNavCapabilities - label/market behavior', () => {
  it('labels come from the passed-in t object (translation source), not a second hardcoded copy', () => {
    const caps = getDashboardNavCapabilities({ isSuperAdmin: true, t, isHebrew: false });
    expect(caps.find((c) => c.id === 'main').label).toBe(t.quotesNav);
    expect(caps.find((c) => c.id === 'admin_clients').label).toBe(t.usersAdminNav);
  });

  it('an optional mobileLabel may present shorter Mobile-only text without changing capability identity (id) or role', () => {
    const capsHe = getDashboardNavCapabilities({ isSuperAdmin: false, t, isHebrew: true });
    const settings = capsHe.find((c) => c.id === 'settings');
    expect(settings.mobileLabel).toBeTruthy();
    expect(settings.mobileLabel).not.toBe(settings.label);
  });

  it('does not branch by market/isHebrew for which capabilities exist, only for label text', () => {
    const capsHe = getDashboardNavCapabilities({ isSuperAdmin: true, t, isHebrew: true });
    const capsEn = getDashboardNavCapabilities({ isSuperAdmin: true, t, isHebrew: false });
    expect(capsHe.map((c) => c.id)).toEqual(capsEn.map((c) => c.id));
    expect(capsHe.map((c) => c.role)).toEqual(capsEn.map((c) => c.role));
  });
});

describe('getDashboardNavCapabilities - approved 980px sidebar order', () => {
  it('lists Quotes, Clients, Catalog, Expenses & Reports, Business Settings in that order, with single-icon components', () => {
    const caps = getDashboardNavCapabilities({ isSuperAdmin: false, t: { ...t, financesNav: 'Expenses & Reports' }, isHebrew: false });
    // the Owner-approved five keep their exact relative order; the authorized additions (Task 17 Statistics, Task 18 Tasks) sit after
    // Expenses & Reports
    expect(caps.filter((c) => !['statistics', 'tasks', 'calendar'].includes(c.id)).map((c) => c.label)).toEqual(['Quotes', 'Clients', 'Catalog', 'Expenses & Reports', 'Business Settings']);
    expect(caps.map((c) => c.label)).toEqual(['Quotes', 'Clients', 'Catalog', 'Expenses & Reports', 'Statistics', 'Tasks', 'Calendar', 'Business Settings']);
    expect(caps.find((c) => c.id === 'calendar').mobileGroup).toBe('more');
    expect(caps.find((c) => c.id === 'statistics').mobileGroup).toBe('more'); // the approved mobile bottom row is unchanged
    expect(caps.find((c) => c.id === 'tasks').mobileGroup).toBe('more');
    for (const cap of caps) expect(cap.icon).toBeTruthy();
  });

  it('keeps the short mobile labels for the relabelled destinations (mobile nav text is unchanged)', () => {
    const caps = getDashboardNavCapabilities({ isSuperAdmin: false, t, isHebrew: true });
    expect(caps.find((c) => c.id === 'finances').mobileLabel).toBe('פיננסים');
    expect(caps.find((c) => c.id === 'settings').mobileLabel).toBe('הגדרות');
  });
});
