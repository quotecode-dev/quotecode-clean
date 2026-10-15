// Owner 2026-10-15: scroll position on every screen switch + sign-outs. Source wiring kept true (the behaviour itself: RouteScrollManager.test,
// invokeWithFreshSession.test; the dashboard scroll needs a signed-in browser and is an Owner check).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const read = (p) => readFileSync(join(cwd(), p), 'utf8');

describe('scroll wiring', () => {
  it('both live routers render the ONE route scroll manager', () => {
    for (const p of ['src/local/AppLocal.jsx', 'src/global/AppGlobal.jsx']) expect(read(p), p).toMatch(/<RouteScrollManager \/>/);
  });
  it('dashboard: the workspace scroller has the ref; editor / quote switch -> top; back to the list -> its saved position; tab switch -> top', () => {
    const d = read('src/pages/Dashboard.jsx');
    expect(d).toContain('className="dash-main-content" ref={mainScrollRef}');
    expect(d).toContain("if (editorIdentity) { root.scrollTop = 0; return; }");
    expect(d).toContain('const y = quoteListScrollRef.current;');
    expect(d).toContain("root.addEventListener('scroll', onScroll, true);");
    expect(d).toContain('useLayoutEffect(() => { if (mainScrollRef.current) mainScrollRef.current.scrollTop = 0; }, [activeTab]);');
  });
  it('item wizard: every step opens at its top', () => {
    const w = read('src/components/AddItemWizard.jsx');
    expect(w).toContain('useLayoutEffect(() => { if (stepBodyRef.current) stepBodyRef.current.scrollTop = 0; }, [step]);');
    expect(w).toContain('<div ref={stepBodyRef} style={{ padding');
  });
});

describe('session wiring', () => {
  const d = read('src/pages/Dashboard.jsx');
  it('Sign out ends this device only; no sign-out on a business_settings query error', () => {
    expect(d).toContain("await supabase.auth.signOut({ scope: 'local' });");
    const fetchSettings = d.slice(d.indexOf('async function fetchSettings('), d.indexOf('if (data) {', d.indexOf('async function fetchSettings(')));
    expect(fetchSettings).not.toMatch(/auth\.signOut\(/);
    expect(fetchSettings).toContain('refreshAuth: () => supabase.auth.refreshSession(),');
  });
  it('signed-in Edge Function calls go through invokeWithFreshSession (public calls stay anonymous)', () => {
    expect(d).not.toMatch(/supabase\.functions\.invoke\(/);
    for (const p of ['src/components/AdminUsersTab.jsx']) expect(read(p), p).not.toMatch(/supabase\.functions\.invoke\(/);
    const qp = read('src/utils/quotePresentationClient.js');
    expect(qp).toContain("body?.action === 'public_get' ? (n, o) => supabase.functions.invoke(n, o) : invokeWithFreshSession");
  });
});
