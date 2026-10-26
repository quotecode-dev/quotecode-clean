// Build-time SSR entry for the PUBLIC marketing / legal pages ONLY (Google indexing root-canonical remediation, 2026-09-28).
// Built with `vite build --ssr` by scripts/prerender-public-routes.mjs and executed in Node to write the initial HTML of every
// public sitemap route. It imports only the public page components - never Dashboard, auth, public quotes, admin or AI logs - and
// is not imported by main.jsx or any router, so the client bundle is unchanged. main.jsx uses createRoot (no hydration): the client
// re-renders over this markup, so there is no hydration-mismatch class; the markup exists for crawlers and the first paint.
/* eslint-disable react-refresh/only-export-components -- build-time SSR entry (Node only): never part of the dev server / HMR graph */
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import LandingLocal from './pages/LandingLocal';
import LandingGlobal from './pages/LandingGlobal';
import PublicTools from './components/PublicTools';
import PublicToolsEn from './components/PublicToolsEn';
import Contact from './pages/Contact';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';

export { PUBLIC_SEO_ROUTES } from './shared/publicSeoRoutes';

// page kind x locale -> the SAME component (and props) the live router mounts for that URL (AppLocal.jsx / AppGlobal.jsx).
const PAGES = {
  landing: { he: () => <LandingLocal />, en: () => <LandingGlobal /> },
  tools: { he: () => <PublicTools />, en: () => <PublicToolsEn /> },
  contact: { he: () => <Contact isHebrew />, en: () => <Contact isHebrew={false} /> },
  privacy: { he: () => <Privacy isHebrew />, en: () => <Privacy isHebrew={false} /> },
  terms: { he: () => <Terms isHebrew />, en: () => <Terms isHebrew={false} /> },
};

export function renderPublicPage(route) {
  const make = PAGES[route.page]?.[route.lang];
  if (!make) throw new Error(`entry-prerender: no component for ${route.page}/${route.lang} (${route.path})`);
  return renderToString(<StaticRouter location={route.path}>{make()}</StaticRouter>);
}
