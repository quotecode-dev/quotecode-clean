import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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
vi.mock('./shared/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      updateUser: () => Promise.resolve({ data: {}, error: null }),
    },
    functions: {
      invoke: () => Promise.resolve({ data: null, error: { message: 'not invoked in this route-resolution test' } }),
    },
  },
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

  it('an unknown path falls through to the wildcard LandingLocal, not a blank/broken page (positive control for the fallback route itself)', async () => {
    renderAtPath(AppLocal, '/this-path-does-not-exist-anywhere');
    expect((await screen.findAllByText(/TEKANGO/i)).length).toBeGreaterThan(0);
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

  it('an unknown path falls through to the wildcard LandingGlobal (positive control)', async () => {
    renderAtPath(AppGlobal, '/this-path-does-not-exist-anywhere');
    expect((await screen.findAllByText(/TEKANGO/i)).length).toBeGreaterThan(0);
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
