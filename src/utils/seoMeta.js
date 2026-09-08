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
export function setSeoMeta({ title, description, canonicalPath, ogTitle, ogDescription, hreflang, lang, structuredData, updateSocial = true }) {
  if (typeof document === 'undefined') return;

  if (title) document.title = title;

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
  const fullUrl = `https://www.tekango.com${path === '/' ? '/' : path.replace(/\/$/, '')}`;

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
  if (Array.isArray(hreflang)) {
    hreflang.forEach(({ lang: hrefLang, path: hrefPath }) => {
      if (!hrefLang || !hrefPath) return;
      let tag = document.querySelector(`link[rel="alternate"][hreflang="${hrefLang}"]`);
      if (!tag) {
        tag = document.createElement('link');
        tag.setAttribute('rel', 'alternate');
        tag.setAttribute('hreflang', hrefLang);
        document.head.appendChild(tag);
      }
      tag.setAttribute('href', `https://www.tekango.com${hrefPath}`);
    });
  }

  // JSON-LD structured data override - replaces the static SoftwareApplication
  // (priceCurrency:"USD") baked into index.html with a page-appropriate one
  // (or removes the override entirely when a page passes none, falling back
  // to the static default - never leaves a stale tag from a previous route
  // behind after client-side navigation).
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
