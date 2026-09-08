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
    expect(dashboardSource).toMatch(/\{navCapabilities\.map\(\(\{ id, icon: TabIcon, label \}\) => \(/);
    // The old pattern - an inline array literal with its own isSuperAdmin
    // spread, defined only inside the Desktop sidebar block - must be gone.
    expect(dashboardSource).not.toMatch(/\{ key: 'admin_clients', icon: Shield, label: t\.usersAdminNav \}/);
  });

  it('the Mobile bottom-nav filters navCapabilities by mobileGroup==="bottom", not three separate hardcoded buttons', () => {
    expect(dashboardSource).toMatch(/navCapabilities\s*\n\s*\.filter\(\(cap\) => cap\.mobileGroup === 'bottom'\)/);
  });

  it('the Mobile More menu filters navCapabilities by mobileGroup==="more" - this is exactly how admin_clients now reaches Mobile', () => {
    expect(dashboardSource).toMatch(/navCapabilities\s*\n\s*\.filter\(\(cap\) => cap\.mobileGroup === 'more'\)/);
  });

  it('every navCapabilities consumer shares the same setActiveTab-based onClick shape (action parity - no duplicate handler was written)', () => {
    const occurrences = dashboardSource.match(/setActiveTab\(id\); setIsCreatingQuote\(false\); setEditingQuoteId\(null\);/g) || [];
    // Desktop sidebar map + Mobile bottom-nav map + Mobile More-menu map:
    // exactly 3 call sites, all invoking the identical canonical action.
    expect(occurrences.length).toBe(3);
  });
});

describe('Dashboard navigation - New Quote role parity (Super Admin hidden on both viewports)', () => {
  it('the Desktop New Quote CTA remains gated by !isSuperAdmin', () => {
    expect(dashboardSource).toMatch(/\{!isSuperAdmin && \(\s*<button onClick=\{handleCreateNewQuoteClick\} className="dash-sidebar-cta">/);
  });

  it('the Mobile "New" button is now also gated by the same !isSuperAdmin condition - the audit\'s gap 2 fix', () => {
    expect(dashboardSource).toMatch(/\{!isSuperAdmin && \(\s*<button onClick=\{\(\) => \{ setShowMobileMoreMenu\(false\); handleCreateNewQuoteClick\(\); \}\}/);
  });
});

describe('Dashboard navigation - AI Support Logs accessibility (the audit\'s gap 3 fix)', () => {
  it('the Mobile AI Support Logs icon-only button has a non-empty aria-label and title', () => {
    const marker = "className=\"dash-topbar-ghost-btn\"";
    const idx = dashboardSource.indexOf(marker);
    expect(idx).toBeGreaterThan(-1);
    const block = dashboardSource.slice(idx, idx + 300);
    expect(block).toMatch(/aria-label="AI Support Logs"/);
    expect(block).toMatch(/title="AI Support Logs"/);
  });
});

describe('Dashboard navigation - existing Quotes/Clients/Finances/Settings/Catalog/AI Chat handlers unchanged', () => {
  it('AI Chat still dispatches the same single CustomEvent on both Desktop and Mobile (untouched by this task)', () => {
    const occurrences = dashboardSource.match(/dispatchEvent\(new CustomEvent\('open-proflow-ai-chat'\)\)/g) || [];
    expect(occurrences.length).toBe(2);
  });

  it('AI Support Logs still navigates to the same real route on both Desktop and Mobile (untouched by this task)', () => {
    const occurrences = dashboardSource.match(/window\.location\.href = '\/ai-logs';/g) || [];
    expect(occurrences.length).toBe(2);
  });
});
