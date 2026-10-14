import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Functional-Parity Root-Cause Audit (2026-09-08) proved the Desktop sidebar
// and the Mobile bottom-nav/More menu were two independently hand-maintained
// destination lists in Dashboard.jsx - admin_clients (Super Admin's "User &
// Business Management") existed only in the Desktop array, unreachable on
// Mobile by any means (activeTab is plain useState, no URL/route bypass).
// The root fix moved both renderers onto one shared, resolved list
// (getDashboardNavCapabilities, see src/utils/dashboardNavCapabilities.js
// and its own dedicated unit tests). Mounting the full Dashboard component
// here would require heavy Supabase/auth/session mocks disproportionate to
// what these structural invariants need (same rationale as
// Dashboard.hotquote.test.js) - these are source-level regression guards
// against the *pattern* recurring, not a substitute for the pure-function
// unit tests or the live browser verification recorded in continuity.
const dashboardSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'Dashboard.jsx'),
  'utf-8',
);

describe('Dashboard navigation - Desktop and Mobile consume one shared capability source', () => {
  it('imports getDashboardNavCapabilities and computes it once as navCapabilities', () => {
    expect(dashboardSource).toMatch(/import \{ getDashboardNavCapabilities \} from '\.\.\/utils\/dashboardNavCapabilities';/);
    expect(dashboardSource).toMatch(/const navCapabilities = getDashboardNavCapabilities\(\{ isSuperAdmin, t, isHebrew \}\);/);
  });

  it('the Desktop sidebar maps over navCapabilities, not a second independent array literal', () => {
    expect(dashboardSource).toMatch(/\{navCapabilities\.filter\(\(\{ id \}\) => id !== 'admin_clients'\)\.map\(\(\{ id, icon: TabIcon, label \}\) => \(/);
    // The old pattern - an inline array literal with its own isSuperAdmin
    // spread, defined only inside the Desktop sidebar block - must be gone.
    expect(dashboardSource).not.toMatch(/\{ key: 'admin_clients', icon: Shield, label: t\.usersAdminNav \}/);
  });

  it('the Mobile bottom-nav filters navCapabilities by mobileGroup==="bottom", not three separate hardcoded buttons', () => {
    expect(dashboardSource).toMatch(/navCapabilities\s*\n\s*\.filter\(\(cap\) => cap\.mobileGroup === 'bottom'\)/);
  });

  it('the Mobile More menu filters navCapabilities by mobileGroup==="more"; Admin destinations join it as an additive Super Admin group, never a second nav', () => {
    expect(dashboardSource).toMatch(/navCapabilities\s*\n\s*\.filter\(\(cap\) => cap\.mobileGroup === 'more' && cap\.id !== 'admin_clients'\)/);
    expect(dashboardSource).toMatch(/isSuperAdmin && ADMIN_NAV_GROUPS\.flatMap/);
  });

  it('every navCapabilities consumer shares the same setActiveTab-based onClick shape (action parity - no duplicate handler was written)', () => {
    const occurrences = dashboardSource.match(/setActiveTab\(id\); setIsCreatingQuote\(false\); setEditingQuoteId\(null\);/g) || [];
    // Desktop sidebar map + Mobile bottom-nav map + Mobile More-menu map:
    // exactly 3 call sites, all invoking the identical canonical action.
    expect(occurrences.length).toBe(3);
  });
});

describe('Dashboard navigation - New Quote is available to Super Admin (SUPER ADMIN = FULL BUSINESS USER + ADDITIVE ADMIN)', () => {
  it('the Desktop New Quote CTA is NOT gated by !isSuperAdmin', () => {
    expect(dashboardSource).not.toMatch(/\{!isSuperAdmin && \(\s*<button onClick=\{handleCreateNewQuoteClick\} className="dash-sidebar-cta">/);
    expect(dashboardSource).toMatch(/<button onClick=\{handleCreateNewQuoteClick\} className="dash-sidebar-cta">/);
  });

  it('the Mobile "New" button is NOT gated by !isSuperAdmin', () => {
    expect(dashboardSource).not.toMatch(/\{!isSuperAdmin && \(\s*<button onClick=\{\(\) => \{ setShowMobileMoreMenu\(false\); handleCreateNewQuoteClick\(\); \}\}/);
    expect(dashboardSource).toMatch(/<button onClick=\{\(\) => \{ setShowMobileMoreMenu\(false\); handleCreateNewQuoteClick\(\); \}\}/);
  });
});

describe('Dashboard navigation - AI Support Logs is an in-shell Admin destination', () => {
  it('reaches AI Support through the registry-driven Admin nav group (desktop sidebar + mobile More), never a /ai-logs breakout', () => {
    expect(dashboardSource).not.toContain('/ai-logs');
    expect(dashboardSource).toMatch(/<AdminSidebarNav\s+section=/);
    expect(dashboardSource).toMatch(/isSuperAdmin && ADMIN_NAV_GROUPS\.flatMap/);
  });
});

describe('Dashboard navigation - existing Quotes/Clients/Finances/Settings/Catalog/AI Chat handlers unchanged', () => {
  it('AI Chat has exactly ONE shared dispatch implementation (renderHeaderAIChatButton), reused by every render site - Owner Header Reference Correction task (2026-09-18) consolidated the prior 2 independently hand-duplicated call sites (Desktop sidebar + Mobile topbar, both now retired) into this 1 shared one, closing a real drift-risk surface rather than widening it', () => {
    const occurrences = dashboardSource.match(/dispatchEvent\(new CustomEvent\('open-proflow-ai-chat'\)\)/g) || [];
    expect(occurrences.length).toBe(1);
    expect(dashboardSource).toContain('const renderHeaderAIChatButton');
  });
});
