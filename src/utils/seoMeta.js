import { CANONICAL_ORIGIN } from '../shared/brand';

// index.html bakes in a single static <title>/<meta name="description">/
// <link rel="canonical">/og:url pointing at the homepage. Since this is a
// client-rendered SPA, every other route (react-router path) inherited that
// exact same canonical - which tells Google "this page is a duplicate of
// the homepage, index that instead," actively blocking /tools, /contact,
// /privacy, /terms etc. from being indexed as their own pages even though
// they're all listed in sitemap.xml. Call setSeoMeta() from a useEffect on
// every indexable page so each distinct URL gets its own correct tags.
//
// חוק ברזל (Landing Pages + Business Tools TEST/Staging task, §13 - Locale
// metadata correction): שלושה באגים אמיתיים אותרו וכולם מתוקנים כאן, במקום
// אחד, כדי שכל הדפים הצרכניים (7 בסך הכול) יקבלו את התיקון בבת אחת:
// (1) `<html lang="en" dir="ltr">` הקבוע ב-index.html מעולם לא עודכן ע"י
// אף עמוד ציבורי - עמוד עברי כלשהו (כולל LandingLocal) הוגש בפועל עם
// lang="en"/dir="ltr" על ה-<html> עצמו (רק ה-div הפנימי קיבל dir="rtl"
// בעבר) - זה איתות-שפה שגוי חמור למנועי-חיפוש ולקוראי-מסך (dir על
// אלמנט-תוכן פנימי משפיע רק על פריסה חזותית, לא על השפה המוכרזת בפועל).
// (2) `og:locale`/`og:locale:alternate` היו קבועים סטטית ב-index.html
// (en_US/he_IL) ומעולם לא התעדכנו per-page - בדיוק הממצא "Hebrew page
// exposes English og:locale=en_US". (3) ה-JSON-LD הסטטי ב-index.html
// (SoftwareApplication, priceCurrency:"USD") ירש לכל עמוד עברי גם הוא.
// updateSocial:false (רק LandingLocal/LandingGlobal השתמשו בו, "שלב עתידי
// נפרד") הוסר בכוונה - זהו בדיוק אותו שלב עתידי, עכשיו.
// SEO indexing remediation (2026-09-16 TEST task), item B6: a fresh audit
// found this function had NO robots/indexing-state handling at all, and
// its own hreflang handling only ever ADDED/UPDATED tags, never REMOVED
// one a previous page had set that the current page doesn't repeat - both
// are real, confirmed "stale SPA meta across navigation" defects: a page
// previously marked noindex (item B1's internal preview routes now call
// this with `noindex: true`) would leave that state behind on the next
// page that doesn't explicitly reset it, and a hreflang cluster from one
// content family (e.g. /he/tools's own alternates) could survive
// navigation to a page with a different/no cluster of its own. Both are
// fixed by making every call an EXPLICIT, total assertion of the current
// page's indexing/hreflang state rather than a partial patch - `noindex`
// defaults to `false` (index, follow) on every call with no exception,
// and `hreflang` tags not present in the CURRENT call are actively
// removed, never left over from the last page that happened to set them.
export function setSeoMeta({ title, description, canonicalPath, ogTitle, ogDescription, hreflang, lang, structuredData, updateSocial = true, noindex = false }) {
  if (typeof document === 'undefined') return;

  if (title) document.title = title;

  // Always writes an explicit value - never conditional, never skipped -
  // so a noindex page navigated away from can never leave that state
  // behind, and an indexable page always positively asserts index,follow
  // rather than merely "not overriding" whatever robots state came before.
  let robotsTag = document.querySelector('meta[name="robots"]');
  if (!robotsTag) {
    robotsTag = document.createElement('meta');
    robotsTag.setAttribute('name', 'robots');
    document.head.appendChild(robotsTag);
  }
  robotsTag.setAttribute('content', noindex ? 'noindex, nofollow' : 'index, follow');

  const setMeta = (selector, attr, value) => {
    if (!value) return;
    let tag = document.querySelector(selector);
    if (!tag) {
      tag = document.createElement('meta');
      const [, attrName, attrValue] = selector.match(/\[(\w+)="([^"]+)"\]/) || [];
      if (attrName && attrValue) tag.setAttribute(attrName, attrValue);
      document.head.appendChild(tag);
    }
    tag.setAttribute(attr, value);
  };

  // חוק ברזל: מוחל תמיד (לא מותנה updateSocial) - שפת-ה-<html> היא איתות-
  // שפה בסיסי, לא "תגית חברתית", ולעולם לא אמורה להישאר תלויה בברירת-
  // המחדל הסטטית של index.html ברגע שהעמוד עצמו יודע את שפתו האמיתית.
  if (lang === 'he' || lang === 'en') {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    setMeta('meta[property="og:locale"]', 'content', lang === 'he' ? 'he_IL' : 'en_US');
    setMeta('meta[property="og:locale:alternate"]', 'content', lang === 'he' ? 'en_US' : 'he_IL');
  }

  if (description) setMeta('meta[name="description"]', 'content', description);
  if (updateSocial) {
    setMeta('meta[property="og:title"]', 'content', ogTitle || title);
    setMeta('meta[property="og:description"]', 'content', ogDescription || description);
    setMeta('meta[name="twitter:title"]', 'content', ogTitle || title);
    setMeta('meta[name="twitter:description"]', 'content', ogDescription || description);
  }

  // Self-referential canonical/og:url = the URL actually being viewed (path
  // only, no query string) - the standard, safe default for pages that
  // aren't true duplicates of one another.
  const path = canonicalPath !== undefined ? canonicalPath : window.location.pathname;
  const fullUrl = `${CANONICAL_ORIGIN}${path === '/' ? '/' : path.replace(/\/$/, '')}`;

  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', fullUrl);
  if (updateSocial) setMeta('meta[property="og:url"]', 'content', fullUrl);

  // Reciprocal hreflang cluster for this content family - pass as an array
  // of { lang: 'he' | 'en' | 'x-default', path: '/he/contact' }. Reuses the
  // find-or-create pattern above so repeated calls (e.g. on isHebrew change)
  // update the existing <link> tags in place instead of creating duplicates.
  //
  // Fix (item B6 above): a hreflang tag from the PREVIOUS page's own
  // cluster that this call does not repeat is now actively removed - the
  // full set of `link[rel=alternate][hreflang]` tags is reconciled to
  // EXACTLY what this call specifies (an empty/omitted `hreflang` clears
  // every existing one), never a partial patch that could leave one
  // page's alternates pointing at a completely different page after SPA
  // navigation.
  const hreflangEntries = Array.isArray(hreflang) ? hreflang.filter((h) => h && h.lang && h.path) : [];
  const keepLangs = new Set(hreflangEntries.map((h) => h.lang));
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((tag) => {
    if (!keepLangs.has(tag.getAttribute('hreflang'))) tag.remove();
  });
  hreflangEntries.forEach(({ lang: hrefLang, path: hrefPath }) => {
    let tag = document.querySelector(`link[rel="alternate"][hreflang="${hrefLang}"]`);
    if (!tag) {
      tag = document.createElement('link');
      tag.setAttribute('rel', 'alternate');
      tag.setAttribute('hreflang', hrefLang);
      document.head.appendChild(tag);
    }
    tag.setAttribute('href', `${CANONICAL_ORIGIN}${hrefPath}`);
  });

  // Fix (item B10 above): the static SoftwareApplication JSON-LD baked
  // into index.html (priceCurrency:"USD", id="proflow-static-structured-
  // data") is removed the FIRST time any real page's own setSeoMeta call
  // runs - it existed only for the very first paint before any client
  // route mounts, and every real indexable page in this app calls
  // setSeoMeta on mount, so this always fires before a crawler executing
  // JS would see the final DOM. Without this, a page that provides its
  // own correct structuredData ended up shipping TWO SoftwareApplication
  // blocks simultaneously (the static USD one plus this page's own,
  // correct, localized one) - a genuine duplicate-schema defect. Idempotent
  // (a no-op once already removed).
  document.getElementById('proflow-static-structured-data')?.remove();

  // JSON-LD structured data override - the ONE dynamic structured-data
  // tag this app now carries once the static default above is gone (or
  // removes itself entirely when a page passes none - never leaves a
  // stale tag from a previous route behind after client-side navigation).
  let ldTag = document.getElementById('proflow-structured-data-override');
  if (structuredData) {
    if (!ldTag) {
      ldTag = document.createElement('script');
      ldTag.type = 'application/ld+json';
      ldTag.id = 'proflow-structured-data-override';
      document.head.appendChild(ldTag);
    }
    ldTag.textContent = JSON.stringify(structuredData);
  } else if (ldTag) {
    ldTag.remove();
  }
}
