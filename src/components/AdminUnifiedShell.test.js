import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Unified Admin contract: Admin = the user shell + additive capabilities.
// Source-level guards so a future edit cannot quietly reintroduce a second
// Admin Header/Sidebar/scroll owner.
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const dashboard = read('../pages/Dashboard.jsx');
const css = read('./adminUsers.css');

describe('Unified Admin shell', () => {
  it('has no Admin-specific Header: the canonical Header is never gated by isSuperAdmin and no admin-context header frame remains', () => {
    expect(dashboard).not.toMatch(/<AuthenticatedHeaderFrame/);
    expect(dashboard).not.toMatch(/context=\{isAdminMode/);
    expect(dashboard).not.toMatch(/\{!isSuperAdmin && \(\s*<div ref=\{setUpperSectionNode\}/);
    expect(dashboard).toMatch(/<div ref=\{setUpperSectionNode\} className="dash-upper-section"/);
  });

  it('uses the one shared Sidebar: Admin destinations are an additive group, not a swapped nav', () => {
    expect(dashboard).not.toMatch(/isAdminMode \? \(\s*<AdminSidebarNav/);
    expect(dashboard).toMatch(/<AdminSidebarNav\s+section=\{isAdminMode \? adminSection : null\}/);
    expect(dashboard).toMatch(/<AuthenticatedSidebarFrame drawerEnabled=\{false\}/);
  });

  it('gives a Super Admin the same mobile bottom nav as every user (no !isSuperAdmin gate)', () => {
    expect(dashboard).not.toMatch(/\{!isSuperAdmin && \(\s*<div className="no-print mobile-bottom-nav"/);
  });

  it('every Admin screen renders through AdminScreenFrame (static block + one inner scroll body)', () => {
    for (const file of ['AdminOverview', 'AdminUsersView', 'AdminPlans', 'AdminSystemActivity', 'AdminUserDetails']) {
      expect(read(`./${file}.jsx`)).toMatch(/<AdminScreenFrame/);
    }
    const frame = read('./AdminScreenFrame.jsx');
    expect(frame).toContain('pf-screen');
    expect(frame).toContain('pf-screen-body');
  });

  it('adds no Admin-specific scroll owner, height or offset CSS', () => {
    const frameRules = css.slice(css.indexOf('Unified Admin screen frame'));
    expect(frameRules).not.toMatch(/overflow-y|(^|[\s;{])height\s*:|(^|[\s;{])top\s*:|calc\(100/);
    // Nested list scrolling would create a second scrollbar inside the body.
    expect(css).toMatch(/\.admin-screen \.admin-overview-list \{ max-height:none; overflow:visible; \}/);
  });
});
