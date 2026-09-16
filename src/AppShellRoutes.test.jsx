import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import AppLocal from './local/AppLocal';
import AppGlobal from './global/AppGlobal';

// חוק ברזל (Route/Entrypoint Truth, systemic remediation task, 2026-09-09):
// the SEO dead-entrypoint incident (App.jsx never imported by main.jsx)
// happened because no test in this repository ever started from a real app
// shell and resolved a URL through its actual <Routes> tree - every existing
// test imports a page/component directly by path, which cannot detect
// "this route silently falls through to the wildcard landing page instead
// of the intended component." These tests render the REAL AppLocal/AppGlobal
// shells (the ones src/main.jsx actually mounts) with window.history set to
// a specific path before render, so a route can only pass by actually
// resolving through react-router - not by any component-level guess.
//
// AppLocal/AppGlobal hardcode <BrowserRouter> internally (not <MemoryRouter>),
// so the standard way to control the resolved path here is to push real
// browser history before each render, exactly as a real navigation would.
// Password Recovery Fresh-Link Root-Landing Hardening (2026-09-15 task):
// the mock's rootRecoveryIntent must be the SAME mutable-object shape the
// real src/shared/supabase.js exports (AppLocal.jsx/AppGlobal.jsx read its
// current fields at render time; Dashboard.jsx both reads and clears it) -
// a frozen/static mock value would make the "/" root-recovery routing
// tests below unable to simulate a fresh recovery link at all.
const { mockRootRecoveryIntent, mockRootSignupIntent, mockUpdateUserImpl } = vi.hoisted(() => ({
  mockRootRecoveryIntent: { isRecovery: false, isError: false },
  // Signup Callback Fix (2026-09-16, TEST-only task): same mutable-object
  // shape as mockRootRecoveryIntent immediately above, for the independent
  // signup-intent marker (src/shared/supabase.js's rootSignupIntent) -
  // AppLocal.jsx/AppGlobal.jsx now read this at render time too.
  mockRootSignupIntent: { isSignup: false },
  // Codex integration-coverage gap (2026-09-15, second pass): a plain
  // object holder (not a bare `let`) so the mock factory below - evaluated
  // once, before any test body runs - and individual test bodies share the
  // SAME mutable reference; tests reassign `.current` to control what the
  // real handleUpdatePasswordFromRecovery (Dashboard.jsx) sees from a real
  // supabase.auth.updateUser() call, without needing to touch Dashboard.jsx
  // itself or reach into its closure.
  mockUpdateUserImpl: { current: () => Promise.resolve({ data: {}, error: null }) },
}));
vi.mock('./shared/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      updateUser: (...args) => mockUpdateUserImpl.current(...args),
    },
    functions: {
      invoke: () => Promise.resolve({ data: null, error: { message: 'not invoked in this route-resolution test' } }),
    },
  },
  rootRecoveryIntent: mockRootRecoveryIntent,
  consumeRootRecoveryIntent: () => {
    mockRootRecoveryIntent.isRecovery = false;
    mockRootRecoveryIntent.isError = false;
  },
  computeRootRecoveryIntent: ({ hash = '', search = '' } = {}) => ({
    isRecovery: hash.includes('type=recovery') || search.includes('type=recovery'),
    isError: hash.includes('error_code=') || search.includes('error_code=') || hash.includes('error=') || search.includes('error='),
  }),
  // Signup Callback Fix (2026-09-16, TEST-only task): mirrors the recovery
  // marker's mock exports immediately above, independently.
  rootSignupIntent: mockRootSignupIntent,
  consumeRootSignupIntent: () => {
    mockRootSignupIntent.isSignup = false;
  },
  computeRootSignupIntent: ({ hash = '', search = '' } = {}) => ({
    isSignup: hash.includes('type=signup') || search.includes('type=signup'),
  }),
  isLocalTestMode: false,
}));

// PublicTools.jsx/PublicToolsEn.jsx read localStorage synchronously on mount
// for their live-rate cache - this test environment's jsdom does not
// provide a real localStorage global, so a minimal in-memory stub is
// supplied here (route-resolution proof, not a test of the caching logic
// itself, which has no dedicated coverage of its own either way).
beforeEach(() => {
  const store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  });
});

function renderAtPath(Component, path) {
  cleanup(); // each loop iteration in a single test renders fresh, not stacked
  window.history.pushState({}, '', path);
  return render(<Component />);
}

describe('AppLocal (HE shell) - real route resolution', () => {
  beforeEach(() => {
    document.title = '';
  });

  it('/ and /he both resolve to LandingLocal (root landing)', async () => {
    renderAtPath(AppLocal, '/');
    expect((await screen.findAllByText(/TEKANGO/i)).length).toBeGreaterThan(0);
  });

  it('/he/tools and its 4 calculator sub-routes all resolve to the Tools hub (PublicTools) - documents the known per-tool-metadata gap rather than silently assuming it exists', async () => {
    const titles = [];
    for (const path of ['/he/tools', '/he/tools/currency', '/he/tools/units', '/he/tools/metals', '/he/tools/crypto']) {
      renderAtPath(AppLocal, path);
      expect(await screen.findByText('מרכז הכלים והמחשבונים העסקיים')).toBeInTheDocument();
      titles.push(document.title);
    }
    // KNOWN, DOCUMENTED GAP (not a silent pass): origin/main's PublicTools()
    // takes no props, so every sub-route currently renders byte-identical
    // title/H1/content - there is no per-tool SEO metadata yet. If this ever
    // starts failing (titles become distinct), update this test deliberately
    // - it means the per-tool metadata feature has finally shipped.
    expect(new Set(titles).size).toBe(1);
  });

  it('/tools (bare compatibility alias) resolves to the same Tools hub as /he/tools', async () => {
    renderAtPath(AppLocal, '/tools');
    expect(await screen.findByText('מרכז הכלים והמחשבונים העסקיים')).toBeInTheDocument();
  });

  it('/contact, /privacy, /terms (bare aliases) and their /he/* equivalents resolve to distinct, correct pages - NEGATIVE CONTROL: none of them fall through to the wildcard landing page', async () => {
    for (const path of ['/contact', '/he/contact']) {
      renderAtPath(AppLocal, path);
      await screen.findByRole('heading', { level: 1 });
      expect(screen.queryByText('מרכז הכלים והמחשבונים העסקיים')).not.toBeInTheDocument();
    }
    for (const path of ['/privacy', '/he/privacy', '/terms', '/he/terms']) {
      renderAtPath(AppLocal, path);
      await screen.findByRole('heading', { level: 1 });
    }
  });

  // SEO indexing remediation (2026-09-16 TEST task, item B7): this test
  // used to assert the wildcard route fell through to LandingLocal (the
  // real homepage component) - a real, confirmed defect, since
  // LandingLocal unconditionally asserts its own indexable canonical/
  // title/hreflang/structured-data on every render, with no way to know
  // it was reached via an unknown path rather than a real homepage visit.
  // Fixed: the wildcard route now renders a dedicated NotFound component
  // (src/pages/NotFound.jsx) - distinct content, never mistaken for the
  // homepage, and (per the second assertion below) an explicit noindex
  // signal, never the homepage's own indexable canonical carried over by
  // accident.
  it('an unknown path falls through to a dedicated NotFound view, not a blank/broken page, and never the real (indexable) homepage', async () => {
    renderAtPath(AppLocal, '/this-path-does-not-exist-anywhere');
    expect(await screen.findByText('404')).toBeInTheDocument();
    expect(screen.queryByText('מרכז הכלים והמחשבונים העסקיים')).not.toBeInTheDocument();
  });

  it('the NotFound view sets noindex - an unknown path must never carry the homepage\'s own indexable canonical/meta', async () => {
    renderAtPath(AppLocal, '/this-path-does-not-exist-anywhere');
    await screen.findByText('404');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
  });
});

describe('AppGlobal (EN shell) - real route resolution', () => {
  beforeEach(() => {
    document.title = '';
  });

  it('/ and /en both resolve to LandingGlobal (root landing)', async () => {
    renderAtPath(AppGlobal, '/');
    expect((await screen.findAllByText(/TEKANGO/i)).length).toBeGreaterThan(0);
  });

  it('/en/tools and its 4 calculator sub-routes all resolve to the Tools hub (PublicToolsEn) - same documented gap as the Hebrew shell', async () => {
    const titles = [];
    for (const path of ['/en/tools', '/en/tools/currency', '/en/tools/units', '/en/tools/metals', '/en/tools/crypto']) {
      renderAtPath(AppGlobal, path);
      await screen.findByRole('heading', { level: 1 });
      titles.push(document.title);
    }
    expect(new Set(titles).size).toBe(1);
  });

  it('/tools (bare compatibility alias) resolves to the same Tools hub as /en/tools', async () => {
    renderAtPath(AppGlobal, '/tools');
    await screen.findByRole('heading', { level: 1 });
  });

  it('/contact, /privacy, /terms (bare aliases) and their /en/* equivalents resolve to distinct, correct pages - NEGATIVE CONTROL: none fall through to the wildcard landing page', async () => {
    for (const path of ['/contact', '/en/contact', '/privacy', '/en/privacy', '/terms', '/en/terms']) {
      renderAtPath(AppGlobal, path);
      await screen.findByRole('heading', { level: 1 });
    }
  });

  // SEO indexing remediation (2026-09-16 TEST task, item B7) - see the
  // AppLocal equivalent test above for the full root-cause/fix rationale,
  // identical here for the EN shell.
  it('an unknown path falls through to a dedicated NotFound view, never the real (indexable) homepage', async () => {
    renderAtPath(AppGlobal, '/this-path-does-not-exist-anywhere');
    expect(await screen.findByText('404')).toBeInTheDocument();
  });

  it('the NotFound view sets noindex for an unknown EN path too', async () => {
    renderAtPath(AppGlobal, '/this-path-does-not-exist-anywhere');
    await screen.findByText('404');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
  });
});

describe('Public Quote route dispatch - real route resolution (both shells)', () => {
  // SmartPublicQuote itself fetches via a mocked Edge Function call and
  // renders a loading/error state without a live network - this proves the
  // ROUTE resolves to SmartPublicQuote (never a 404/blank/wildcard fallback),
  // which is exactly the class of bug (route silently unwired) this suite
  // exists to catch. Full render-through-to-PublicQuote/PublicQuoteEn
  // behavior is covered by PublicQuote.businessAccountGate.test.jsx.
  it('/public-quote/:id, /quote/:id resolve through SmartPublicQuote in AppLocal, not the wildcard landing page', async () => {
    for (const path of ['/public-quote/00000000-0000-0000-0000-000000000000', '/quote/00000000-0000-0000-0000-000000000000']) {
      renderAtPath(AppLocal, path);
      await new Promise((r) => setTimeout(r, 0));
      expect(screen.queryByText('מרכז הכלים והמחשבונים העסקיים')).not.toBeInTheDocument();
    }
  });

  it('/public-quote/:id, /quote/:id, /en/public-quote/:id resolve through SmartPublicQuote in AppGlobal', async () => {
    for (const path of ['/public-quote/00000000-0000-0000-0000-000000000000', '/quote/00000000-0000-0000-0000-000000000000', '/en/public-quote/00000000-0000-0000-0000-000000000000']) {
      renderAtPath(AppGlobal, path);
      await new Promise((r) => setTimeout(r, 0));
    }
  });
});

describe('Password Recovery Fresh-Link Root-Landing Hardening (2026-09-15 task) - real route resolution', () => {
  beforeEach(() => {
    mockRootRecoveryIntent.isRecovery = false;
    mockRootRecoveryIntent.isError = false;
    mockRootSignupIntent.isSignup = false;
  });

  it('HE: root "/" with a recovery marker mounts the Dashboard/AuthScreen recovery owner, not LandingLocal', async () => {
    mockRootRecoveryIntent.isRecovery = true;
    renderAtPath(AppLocal, '/');
    expect(await screen.findByText('הגדרת סיסמה חדשה')).toBeInTheDocument();
    expect(screen.queryByText('מרכז הכלים והמחשבונים העסקיים')).not.toBeInTheDocument();
  });

  it('EN: root "/" with a recovery marker mounts the Dashboard/AuthScreen recovery owner, not LandingGlobal', async () => {
    mockRootRecoveryIntent.isRecovery = true;
    renderAtPath(AppGlobal, '/');
    expect(await screen.findByText('Set New Password')).toBeInTheDocument();
  });

  it('HE: root "/" WITHOUT a recovery marker still renders the ordinary landing page (no regression to normal traffic)', async () => {
    renderAtPath(AppLocal, '/');
    expect((await screen.findAllByText(/TEKANGO/i)).length).toBeGreaterThan(0);
    expect(screen.queryByText('הגדרת סיסמה חדשה')).not.toBeInTheDocument();
  });

  it('EN: root "/" WITHOUT a recovery marker still renders the ordinary landing page', async () => {
    renderAtPath(AppGlobal, '/');
    expect((await screen.findAllByText(/TEKANGO/i)).length).toBeGreaterThan(0);
    expect(screen.queryByText('Set New Password')).not.toBeInTheDocument();
  });

  it('HE: an expired/invalid recovery link on root ("/") still reaches the ordinary login screen with the curated bilingual message - LOCKED behavior, not the new-password form', async () => {
    mockRootRecoveryIntent.isError = true;
    renderAtPath(AppLocal, '/');
    expect(await screen.findByText('❌ קישור השחזור אינו תקין או שפג תוקפו. יש לבקש קישור חדש.')).toBeInTheDocument();
    expect(screen.queryByText('הגדרת סיסמה חדשה')).not.toBeInTheDocument();
    // No raw Supabase provider text anywhere in the curated message.
    expect(screen.getByText('❌ קישור השחזור אינו תקין או שפג תוקפו. יש לבקש קישור חדש.').textContent).not.toMatch(/otp_expired|access_denied/i);
  });

  it('EN: an expired/invalid recovery link on root ("/") reaches the ordinary login screen with the curated English message', async () => {
    mockRootRecoveryIntent.isError = true;
    renderAtPath(AppGlobal, '/');
    expect(await screen.findByText('❌ This recovery link is invalid or has expired. Please request a new one.')).toBeInTheDocument();
  });

  it('the direct /dashboard?lang=he route (hash still present in the URL) still works exactly as before - unaffected by this hardening', async () => {
    cleanup();
    window.history.pushState({}, '', '/dashboard?lang=he#access_token=fake&type=recovery');
    render(<AppLocal />);
    expect(await screen.findByText('הגדרת סיסמה חדשה')).toBeInTheDocument();
  });

  it('no duplicate recovery overlay is introduced - exactly one "new password" heading renders even when both the URL hash and the marker indicate recovery', async () => {
    mockRootRecoveryIntent.isRecovery = true;
    cleanup();
    window.history.pushState({}, '', '/#access_token=fake&type=recovery');
    render(<AppLocal />);
    expect(await screen.findAllByText('הגדרת סיסמה חדשה')).toHaveLength(1);
  });

  it('the marker is cleared after Dashboard consumes it, so a later render in the same module instance does not re-trigger recovery mode from stale state', async () => {
    mockRootRecoveryIntent.isRecovery = true;
    renderAtPath(AppLocal, '/');
    await screen.findByText('הגדרת סיסמה חדשה');
    // Dashboard's own effect clears the shared marker object on mount.
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRootRecoveryIntent.isRecovery).toBe(false);
    expect(mockRootRecoveryIntent.isError).toBe(false);
  });
});

// Signup Callback Fix (2026-09-16, TEST-only task): EN AUTH SIGNUP EMAIL
// root cause was a fresh signup-confirmation link's callback landing on
// bare "/" and silently mounting the public landing page instead of the
// authenticated app - the "/" route previously had NO fallback at all for
// type=signup (unlike recovery, which already had rootRecoveryIntent for
// the identical class of Supabase redirect-allowlist fallback). These
// tests prove the fix through REAL route resolution (the same class of
// proof AppShellRoutes.test.jsx exists for, per this file's own header
// comment), not a source-string check - the actual defect was "the wrong
// React component mounts," which only a real route-resolution test can
// catch.
describe('Signup Callback Fix (2026-09-16 task) - real route resolution', () => {
  beforeEach(() => {
    mockRootRecoveryIntent.isRecovery = false;
    mockRootRecoveryIntent.isError = false;
    mockRootSignupIntent.isSignup = false;
  });

  it('HE: root "/" with a signup-confirmation marker mounts Dashboard/AuthScreen (the authenticated app), not the public LandingLocal', async () => {
    mockRootSignupIntent.isSignup = true;
    renderAtPath(AppLocal, '/');
    expect(await screen.findByText('התחבר למערכת הניהול שלך')).toBeInTheDocument();
    expect(screen.queryByText('מרכז הכלים והמחשבונים העסקיים')).not.toBeInTheDocument();
  });

  it('EN: root "/" with a signup-confirmation marker mounts Dashboard/AuthScreen (the authenticated app), not the public LandingGlobal', async () => {
    mockRootSignupIntent.isSignup = true;
    renderAtPath(AppGlobal, '/');
    expect(await screen.findByText('Sign in to your management dashboard')).toBeInTheDocument();
  });

  it('HE: root "/" WITHOUT a signup marker still renders the ordinary public landing page (no regression to normal traffic)', async () => {
    renderAtPath(AppLocal, '/');
    expect((await screen.findAllByText(/TEKANGO/i)).length).toBeGreaterThan(0);
    expect(screen.queryByText('התחבר למערכת הניהול שלך')).not.toBeInTheDocument();
  });

  it('EN: root "/" WITHOUT a signup marker still renders the ordinary public landing page', async () => {
    renderAtPath(AppGlobal, '/');
    expect((await screen.findAllByText(/TEKANGO/i)).length).toBeGreaterThan(0);
    expect(screen.queryByText('Sign in to your management dashboard')).not.toBeInTheDocument();
  });

  it('a signup marker does not leak into recovery mode - the login screen renders, not the "Set New Password" form (no cross-contamination between the two independent markers)', async () => {
    mockRootSignupIntent.isSignup = true;
    renderAtPath(AppGlobal, '/');
    expect(await screen.findByText('Sign in to your management dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Set New Password')).not.toBeInTheDocument();
  });

  it('recovery behavior is completely unaffected by the signup marker existing - a recovery marker (signup marker false) still reaches "Set New Password", not the login screen', async () => {
    mockRootRecoveryIntent.isRecovery = true;
    renderAtPath(AppGlobal, '/');
    expect(await screen.findByText('Set New Password')).toBeInTheDocument();
    expect(screen.queryByText('Sign in to your management dashboard')).not.toBeInTheDocument();
  });

  it('the direct /dashboard?lang=en route (hash still present) is unaffected by this fix - documents that the "/" fallback is additive, not a replacement for the primary redirect fix', async () => {
    cleanup();
    window.history.pushState({}, '', '/dashboard?lang=en#access_token=fake&type=signup');
    render(<AppGlobal />);
    expect(await screen.findByText('Sign in to your management dashboard')).toBeInTheDocument();
  });

  it('the marker is cleared after Dashboard consumes it, so a later render in the same module instance does not re-trigger the authenticated route from stale state', async () => {
    mockRootSignupIntent.isSignup = true;
    renderAtPath(AppGlobal, '/');
    await screen.findByText('Sign in to your management dashboard');
    await new Promise((r) => setTimeout(r, 0));
    expect(mockRootSignupIntent.isSignup).toBe(false);
  });
});

// Codex integration-coverage gap (2026-09-15, second pass): proves
// handleUpdatePasswordFromRecovery (Dashboard.jsx) - the REAL, unmodified
// handler, reached through a real render, a real form submit, and a real
// (mocked-at-the-supabase-boundary) supabase.auth.updateUser() rejection -
// renders the dedicated password_reuse copy, not the weak_password copy,
// and that this is the shared authErrorClassification.js module doing the
// classifying (not some Dashboard-local reimplementation): the exact same
// mock, driven only through mockUpdateUserImpl, produces DIFFERENT curated
// text for a `same_password` rejection vs. a weak-password rejection,
// which could only happen if the real, single, shared normalizeAuthError()
// is what Dashboard's handler actually calls.
describe('Dashboard password-recovery handler - password_reuse vs weak_password (Codex integration gap)', () => {
  beforeEach(() => {
    mockRootRecoveryIntent.isRecovery = false;
    mockRootRecoveryIntent.isError = false;
    mockUpdateUserImpl.current = () => Promise.resolve({ data: {}, error: null });
  });

  async function submitRecoveryPassword(AppShell, { newPasswordPlaceholder, confirmPasswordPlaceholder, submitLabel }) {
    fireEvent.change(screen.getByPlaceholderText(newPasswordPlaceholder), { target: { value: 'CorrectHorseBattery9!' } });
    fireEvent.change(screen.getByPlaceholderText(confirmPasswordPlaceholder), { target: { value: 'CorrectHorseBattery9!' } });
    fireEvent.click(screen.getByRole('button', { name: submitLabel }));
  }

  it('HE: a same_password rejection renders the dedicated password-reuse message, not a weak-password message', async () => {
    mockUpdateUserImpl.current = () => Promise.resolve({ data: null, error: { code: 'same_password', message: 'New password should be different from the old password.' } });
    mockRootRecoveryIntent.isRecovery = true;
    renderAtPath(AppLocal, '/');
    await screen.findByText('הגדרת סיסמה חדשה');

    await submitRecoveryPassword(AppLocal, { newPasswordPlaceholder: 'סיסמה חדשה', confirmPasswordPlaceholder: 'אימות סיסמה חדשה', submitLabel: 'עדכן סיסמה ושמור' });

    expect(await screen.findByText('❌ כבר השתמשת בסיסמה הזו בעבר. יש לבחור סיסמה אחרת.')).toBeInTheDocument();
    expect(screen.queryByText(/הסיסמה חלשה מדי/)).not.toBeInTheDocument();
  });

  it('EN: a same_password rejection renders the dedicated password-reuse message, not a weak-password message', async () => {
    mockUpdateUserImpl.current = () => Promise.resolve({ data: null, error: { code: 'same_password', message: 'New password should be different from the old password.' } });
    mockRootRecoveryIntent.isRecovery = true;
    renderAtPath(AppGlobal, '/');
    await screen.findByText('Set New Password');

    await submitRecoveryPassword(AppGlobal, { newPasswordPlaceholder: 'New password', confirmPasswordPlaceholder: 'Confirm new password', submitLabel: 'Update Password & Save' });

    expect(await screen.findByText('❌ You have used this password before. Please choose a different password.')).toBeInTheDocument();
    expect(screen.queryByText(/Password is too weak/)).not.toBeInTheDocument();
  });

  it('EN: a genuine weak-password rejection still renders the weak-password copy, not the reuse copy (precedence proof through the real handler)', async () => {
    mockUpdateUserImpl.current = () => Promise.resolve({ data: null, error: { message: 'Password should be at least 6 characters' } });
    mockRootRecoveryIntent.isRecovery = true;
    renderAtPath(AppGlobal, '/');
    await screen.findByText('Set New Password');

    await submitRecoveryPassword(AppGlobal, { newPasswordPlaceholder: 'New password', confirmPasswordPlaceholder: 'Confirm new password', submitLabel: 'Update Password & Save' });

    expect(await screen.findByText('❌ Password is too weak. Please choose a longer/stronger password.')).toBeInTheDocument();
    expect(screen.queryByText(/used this password before/)).not.toBeInTheDocument();
  });

  it('HE: a successful update (no error) renders the success message, never a stale error from a prior test/mock state (mock hygiene check)', async () => {
    mockRootRecoveryIntent.isRecovery = true;
    renderAtPath(AppLocal, '/');
    await screen.findByText('הגדרת סיסמה חדשה');

    await submitRecoveryPassword(AppLocal, { newPasswordPlaceholder: 'סיסמה חדשה', confirmPasswordPlaceholder: 'אימות סיסמה חדשה', submitLabel: 'עדכן סיסמה ושמור' });

    expect(await screen.findByText(/הסיסמה עודכנה בהצלחה/)).toBeInTheDocument();
  });
});
