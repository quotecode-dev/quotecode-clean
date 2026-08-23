// index.html bakes in a single static <title>/<meta name="description">/
// <link rel="canonical">/og:url pointing at the homepage. Since this is a
// client-rendered SPA, every other route (react-router path) inherited that
// exact same canonical - which tells Google "this page is a duplicate of
// the homepage, index that instead," actively blocking /tools, /contact,
// /privacy, /terms etc. from being indexed as their own pages even though
// they're all listed in sitemap.xml. Call setSeoMeta() from a useEffect on
// every indexable page so each distinct URL gets its own correct tags.
export function setSeoMeta({ title, description, canonicalPath, ogTitle, ogDescription }) {
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

  if (description) setMeta('meta[name="description"]', 'content', description);
  setMeta('meta[property="og:title"]', 'content', ogTitle || title);
  setMeta('meta[property="og:description"]', 'content', ogDescription || description);
  setMeta('meta[name="twitter:title"]', 'content', ogTitle || title);
  setMeta('meta[name="twitter:description"]', 'content', ogDescription || description);

  // Self-referential canonical/og:url = the URL actually being viewed (path
  // only, no query string) - the standard, safe default for pages that
  // aren't true duplicates of one another.
  const path = canonicalPath !== undefined ? canonicalPath : window.location.pathname;
  const fullUrl = `https://www.quotecodepro.com${path === '/' ? '/' : path.replace(/\/$/, '')}`;

  let canonicalLink = document.querySelector('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.setAttribute('href', fullUrl);
  setMeta('meta[property="og:url"]', 'content', fullUrl);
}
