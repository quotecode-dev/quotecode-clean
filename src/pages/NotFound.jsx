import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LIGHT as NEON, FONT_HE } from '../theme/neonTheme';
import { setSeoMeta } from '../utils/seoMeta';

// TEKANGO SEO indexing remediation (2026-09-16 TEST task): before this
// component existed, BOTH app shells' wildcard (`*`) fallback route
// rendered the real homepage component (LandingLocal/LandingGlobal)
// directly for ANY unrecognized path - and that homepage component
// unconditionally asserts its own indexable canonical/title/hreflang/
// structured-data on every render, with no way to know it was reached via
// an unknown path rather than a real homepage visit. Confirmed live: an
// invalid URL rendered HTTP 200 with the homepage's own indexable
// canonical metadata - a soft-404/duplicate-URL risk. This is a real,
// dedicated soft-404 view instead: distinct content (never mistaken for
// the homepage), `noindex` (via `setSeoMeta`), and no canonical asserting
// this path is a real page.
//
// Known, disclosed limitation: this is a client-side SPA route, so the
// actual HTTP response status for an unknown path is still 200 (the
// static index.html shell, matching every other client route) - a true
// HTTP 404 status would need a server/edge-level rewrite rule change
// (vercel.json or an edge function) distinguishing known-valid paths from
// everything else, a materially higher-risk change than this task's scope
// covers. The `noindex` meta signal (which crawlers do respect even at
// HTTP 200) is the safe fix implemented here.
export default function NotFound({ isHebrew }) {
  useEffect(() => {
    setSeoMeta({
      title: isHebrew ? 'הדף לא נמצא - TEKANGO' : 'Page Not Found - TEKANGO',
      noindex: true,
      lang: isHebrew ? 'he' : 'en',
    });
  }, [isHebrew]);

  return (
    <div
      dir={isHebrew ? 'rtl' : 'ltr'}
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        padding: '24px',
        textAlign: 'center',
        background: NEON.bg || '#faf9fd',
        fontFamily: isHebrew ? FONT_HE : 'inherit',
      }}
    >
      <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: NEON.textPrimary, margin: 0 }}>404</h1>
      <p style={{ fontSize: '1.1rem', color: NEON.textSecondary, margin: 0, maxWidth: '480px' }}>
        {isHebrew ? 'העמוד שחיפשת לא נמצא.' : 'The page you are looking for could not be found.'}
      </p>
      <Link
        to={isHebrew ? '/he' : '/en'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: NEON.violet || '#7c3aed',
          color: '#fff',
          borderRadius: '10px',
          padding: '12px 20px',
          fontWeight: 700,
          textDecoration: 'none',
        }}
      >
        {isHebrew ? 'חזרה לעמוד הבית' : 'Back to Home'}
      </Link>
    </div>
  );
}
