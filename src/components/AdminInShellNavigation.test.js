import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { ADMIN_DESTINATIONS } from './adminDestinations';
import { ADMIN_NAV_GROUPS, ADMIN_SECTION_IDS } from '../utils/adminNavGroups';
import { getDashboardNavCapabilities } from '../utils/dashboardNavCapabilities';

// Hermetic Admin-shell closure: every Admin destination opens INSIDE the
// unified Admin body; Super Admin keeps every business capability; the
// mobile top anchor has one owner. Structural guards - they fail if a
// standalone page / new tab / duplicate shell / spacer ever returns.
const root = cwd();
const read = (...p) => readFileSync(join(root, ...p), 'utf8');
const dashboard = read('src', 'pages', 'Dashboard.jsx');
const componentsDir = join(root, 'src', 'components');
const adminSources = readdirSync(componentsDir)
  .filter((f) => /^(Admin|AISupport).*\.(jsx|js)$/.test(f) && !f.includes('.test.'))
  .map((f) => ({ f, src: read('src', 'components', f) }));
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Admin destination registry (ONE definition)', () => {
  it('keeps every current destination (Overview, Users, Plans, Activity, AI Support)', () => {
    expect(ADMIN_DESTINATIONS.map((d) => d.id).sort()).toEqual(['activity', 'ai-support', 'overview', 'plans', 'users']);
  });
  it('sidebar groups, section ids and mobile list are all derived from the registry', () => {
    const navIds = ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id)).sort();
    expect(navIds).toEqual(ADMIN_DESTINATIONS.map((d) => d.id).sort());
    expect([...ADMIN_SECTION_IDS].sort()).toEqual(navIds);
    expect(read('src', 'utils', 'adminNavGroups.js')).not.toMatch(/id: '(overview|users|plans|activity|ai-support)'/);
  });
  it('every destination is complete (label, title, icon, permission, renderer) and Super-Admin gated', () => {
    for (const d of ADMIN_DESTINATIONS) {
      expect(d.label.he && d.label.en && d.title.he && d.title.en).toBeTruthy();
      expect(typeof d.render).toBe('function');
      expect(d.icon).toBeTruthy();
      expect(d.permission).toBe('super_admin');
      expect(d.available).toBe(true);
    }
  });
  it('the Dashboard renders Admin content ONLY through AdminDestinationHost (no direct destination components)', () => {
    expect(dashboard).toMatch(/<AdminDestinationHost/);
    for (const name of ['AdminOverview', 'AdminUsersTab', 'AdminUserDetails', 'AdminPlans', 'AdminSystemActivity', 'AISupportLogsContent']) {
      expect(dashboard).not.toMatch(new RegExp(`<${name}[\\s/>]`));
    }
  });
});

describe('ALL registered Admin destinations use the same content host/frame', () => {
  it('every destination content component renders through AdminScreenFrame', () => {
    for (const f of ['AdminOverview', 'AdminPlans', 'AdminSystemActivity', 'AISupportLogsContent', 'AdminUserDetails', 'AdminUsersView']) {
      expect(read('src', 'components', `${f}.jsx`)).toMatch(/<AdminScreenFrame/);
    }
    expect(read('src', 'components', 'AdminDestinationHost.jsx')).toContain('admin-destination-host');
  });
});

describe('Admin shell-bypass calls: ZERO', () => {
  it('no Admin source opens a window/tab or navigates the page', () => {
    for (const { f, src } of adminSources) {
      const code = stripComments(src);
      expect(code, f).not.toMatch(/window\.open\(/);
      expect(code, f).not.toMatch(/target=["']_blank["']/);
      // A same-page reload is not a destination change; assign/href/replace are.
      expect(code.replace(/window\.location\.reload\(\)/g, ''), f).not.toMatch(/window\.location|location\.href|location\.assign|location\.replace/);
    }
  });
  it('no Admin destination navigates to /ai-logs (Dashboard, sidebar, registry, content)', () => {
    expect(stripComments(dashboard)).not.toContain('/ai-logs');
    for (const { f, src } of adminSources) expect(stripComments(src), f).not.toContain('/ai-logs');
  });
  it('AI Support content has no standalone chrome (Back to Dashboard / own page background / own Header)', () => {
    const src = read('src', 'components', 'AISupportLogsContent.jsx');
    expect(src).not.toMatch(/חזרה לדשבורד|Back to Dashboard/);
    expect(src).not.toMatch(/minHeight:\s*'100vh'/);
    expect(src).not.toMatch(/<h1/);
  });
  it('the legacy /ai-logs page is only a redirect into the unified Admin destination (no second UI)', () => {
    const legacy = read('src', 'pages', 'AILogs.jsx');
    expect(legacy).toMatch(/<Navigate to="\/dashboard\?view=admin&section=ai-support" replace \/>/);
    expect(legacy).not.toMatch(/chat_logs|<table|useState/);
  });
  it('an Admin deep link (?view=admin&section=) is read by the Dashboard and mounts inside the shell', () => {
    expect(dashboard).toMatch(/searchParams\.get\('view'\) === 'admin'/);
    expect(dashboard).toMatch(/ADMIN_SECTION_IDS\.has\(requested\)/);
    expect(ADMIN_SECTION_IDS.has('ai-support')).toBe(true);
  });
});

describe('One authenticated shell: no duplicate Header/Sidebar, no Admin-only shell', () => {
  it('exactly one canonical Header and one Sidebar frame are mounted by the Dashboard', () => {
    expect((dashboard.match(/className="dash-upper-section"/g) || []).length).toBe(1);
    expect((dashboard.match(/<AuthenticatedSidebarFrame/g) || []).length).toBe(1);
    expect(dashboard).not.toMatch(/<AuthenticatedHeaderFrame/);
  });
  it('Admin content components never render a Header, Sidebar or app shell of their own', () => {
    for (const { f, src } of adminSources) {
      const code = stripComments(src);
      expect(code, f).not.toMatch(/dash-upper-section|dash-sidebar(?!-btn|-nav)|AuthenticatedSidebarFrame|AuthenticatedHeaderFrame|<header/);
    }
  });
});

describe('SUPER ADMIN = FULL BUSINESS USER + ADDITIVE ADMIN', () => {
  it('Super Admin keeps every ordinary business destination', () => {
    const superIds = getDashboardNavCapabilities({ isSuperAdmin: true, t: {}, isHebrew: true }).map((c) => c.id);
    const userIds = getDashboardNavCapabilities({ isSuperAdmin: false, t: {}, isHebrew: true }).map((c) => c.id);
    for (const id of ['main', 'settings', 'clients', 'finances', 'catalog']) expect(superIds).toContain(id);
    for (const id of userIds) expect(superIds).toContain(id);
  });
  it('the sidebar renders the business navigation for everyone and the Admin group additively for Super Admin', () => {
    expect(dashboard).toMatch(/navCapabilities\.filter\(\(\{ id \}\) => id !== 'admin_clients'\)\.map/);
    expect(dashboard).toMatch(/\{isSuperAdmin && \(\s*<AdminSidebarNav/);
  });
  it('New Quote (desktop CTA + mobile "New") is never role-gated', () => {
    expect(dashboard).not.toMatch(/!isSuperAdmin && \(\s*<button onClick=\{(handleCreateNewQuoteClick|\(\) => \{ setShowMobileMoreMenu)/);
  });
  it('the mobile bottom nav is rendered for every role', () => {
    expect(dashboard).not.toMatch(/!isSuperAdmin && \(\s*<div className="no-print mobile-bottom-nav"/);
  });
  it('the shell is one state model: Admin is an activeTab destination, not a separate app mode', () => {
    expect(dashboard).toMatch(/const isAdminMode = isSuperAdmin && activeTab === 'admin_clients'/);
    expect((dashboard.match(/<div className="dash-app-shell"/g) || []).length).toBe(1);
  });
});

describe('Mobile top-gap: ONE shell top-anchor source', () => {
  it('the retired 72px topbar spacer and the fixed legacy .dash-topbar are gone', () => {
    expect(dashboard).not.toMatch(/padding-top:\s*72px/);
    expect(dashboard).not.toMatch(/\.dash-topbar\s*\{[^}]*position:\s*fixed/);
  });
  it('the only mobile top inset on .dash-main-content is the platform safe-area + the 6px shell spacing (frame fully visible)', () => {
    const rules = [...dashboard.matchAll(/\.dash-main-content\s*\{([^}]*)\}/g)].map((m) => m[1]).filter((b) => /padding-top/.test(b));
    expect(rules.length).toBe(1);
    expect(rules[0]).toMatch(/padding-top:\s*calc\(env\(safe-area-inset-top,\s*0px\)\s*\+\s*6px\)\s*!important/);
  });
  it('root/app-shell overflow guards use clip (hidden creates a scroll container and breaks sticky/inner-scroll ownership)', () => {
    expect(read('index.html')).toMatch(/overflow-x:\s*clip/);
    expect(dashboard).toMatch(/<div className="dash-app-shell"[^\n]*overflowX: 'clip'/);
  });
});
