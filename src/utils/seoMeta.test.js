import { describe, it, expect, beforeEach } from 'vitest';
import { setSeoMeta } from './seoMeta';

// Landing Pages + Business Tools TEST/Staging task (§13/§16): this utility
// is the single fix point for a real site-wide defect - document lang/dir
// and og:locale/structured-data were never updated per-page, so every
// Hebrew public page inherited index.html's static English/USD defaults.
// No test file existed for it before this task; covering the exact
// behaviors this task relies on so the fix can't silently regress.

beforeEach(() => {
  document.title = '';
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
  document.head.querySelectorAll('meta, link[rel="canonical"], link[rel="alternate"], #proflow-structured-data-override, #proflow-static-structured-data').forEach((el) => el.remove());
});

describe('setSeoMeta', () => {
  it('sets html lang/dir and og:locale to Hebrew when lang="he"', () => {
    setSeoMeta({ title: 'x', canonicalPath: '/he', lang: 'he' });
    expect(document.documentElement.lang).toBe('he');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.querySelector('meta[property="og:locale"]').getAttribute('content')).toBe('he_IL');
    expect(document.querySelector('meta[property="og:locale:alternate"]').getAttribute('content')).toBe('en_US');
  });

  it('sets html lang/dir and og:locale to English when lang="en"', () => {
    document.documentElement.lang = 'he';
    document.documentElement.dir = 'rtl';
    setSeoMeta({ title: 'x', canonicalPath: '/en', lang: 'en' });
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.querySelector('meta[property="og:locale"]').getAttribute('content')).toBe('en_US');
  });

  it('does not touch html lang/dir when lang is omitted', () => {
    document.documentElement.lang = 'fr';
    setSeoMeta({ title: 'x', canonicalPath: '/somewhere' });
    expect(document.documentElement.lang).toBe('fr');
  });

  it('builds an absolute canonical URL from canonicalPath', () => {
    setSeoMeta({ title: 'x', canonicalPath: '/he/tools/metals' });
    expect(document.querySelector('link[rel="canonical"]').getAttribute('href')).toBe('https://www.tekango.com/he/tools/metals');
  });

  it('adds a structuredData JSON-LD override and removes it when a later call omits it', () => {
    setSeoMeta({ title: 'x', canonicalPath: '/he', structuredData: { '@type': 'WebApplication', name: 'Test' } });
    const tag = document.getElementById('proflow-structured-data-override');
    expect(tag).toBeTruthy();
    expect(JSON.parse(tag.textContent)).toEqual({ '@type': 'WebApplication', name: 'Test' });

    setSeoMeta({ title: 'y', canonicalPath: '/he/other' });
    expect(document.getElementById('proflow-structured-data-override')).toBeNull();
  });

  it('writes reciprocal hreflang alternate links', () => {
    setSeoMeta({
      title: 'x',
      canonicalPath: '/he/tools/units',
      hreflang: [
        { lang: 'he', path: '/he/tools/units' },
        { lang: 'en', path: '/en/tools/units' },
      ],
    });
    expect(document.querySelector('link[rel="alternate"][hreflang="he"]').getAttribute('href')).toBe('https://www.tekango.com/he/tools/units');
    expect(document.querySelector('link[rel="alternate"][hreflang="en"]').getAttribute('href')).toBe('https://www.tekango.com/en/tools/units');
  });
});

// SEO indexing remediation (2026-09-16 TEST task), items B1/B6: this
// function had no robots/noindex handling at all before this task, and
// its hreflang handling never removed a tag a previous page had set that
// the current page doesn't repeat - both are real, confirmed "stale SPA
// meta across navigation" defects. These tests prove both fixes.
describe('setSeoMeta - robots/noindex (item B1/B6)', () => {
  it('defaults to index,follow when noindex is not passed - an explicit positive assertion, not merely "no override"', () => {
    setSeoMeta({ title: 'x', canonicalPath: '/he' });
    expect(document.querySelector('meta[name="robots"]').getAttribute('content')).toBe('index, follow');
  });

  it('sets noindex,nofollow when noindex:true is passed - the mechanism internal preview routes (item B1) now use', () => {
    setSeoMeta({ title: 'x', canonicalPath: '/professional-preview', noindex: true });
    expect(document.querySelector('meta[name="robots"]').getAttribute('content')).toBe('noindex, nofollow');
  });

  it('a page previously marked noindex does NOT leave that state behind when navigating to an indexable page (the exact B6 defect)', () => {
    setSeoMeta({ title: 'preview', canonicalPath: '/professional-preview', noindex: true });
    expect(document.querySelector('meta[name="robots"]').getAttribute('content')).toBe('noindex, nofollow');

    setSeoMeta({ title: 'real page', canonicalPath: '/he/contact' });
    expect(document.querySelector('meta[name="robots"]').getAttribute('content')).toBe('index, follow');
  });

  it('an indexable page does NOT leave index,follow behind when navigating to a noindex internal page', () => {
    setSeoMeta({ title: 'real page', canonicalPath: '/he/contact' });
    expect(document.querySelector('meta[name="robots"]').getAttribute('content')).toBe('index, follow');

    setSeoMeta({ title: 'preview', canonicalPath: '/professional-preview', noindex: true });
    expect(document.querySelector('meta[name="robots"]').getAttribute('content')).toBe('noindex, nofollow');
  });
});

describe('setSeoMeta - removes the static index.html JSON-LD once a real page mounts (item B10)', () => {
  it('removes #proflow-static-structured-data on the very first call, even when the page provides no override of its own', () => {
    const staticTag = document.createElement('script');
    staticTag.type = 'application/ld+json';
    staticTag.id = 'proflow-static-structured-data';
    staticTag.textContent = '{"@type":"SoftwareApplication","offers":{"priceCurrency":"USD"}}';
    document.head.appendChild(staticTag);

    setSeoMeta({ title: 'x', canonicalPath: '/he/terms' });
    expect(document.getElementById('proflow-static-structured-data')).toBeNull();
  });

  it('never ships both the static default AND a page-specific override simultaneously - the exact duplicate-schema defect this item fixes', () => {
    const staticTag = document.createElement('script');
    staticTag.type = 'application/ld+json';
    staticTag.id = 'proflow-static-structured-data';
    document.head.appendChild(staticTag);

    setSeoMeta({ title: 'x', canonicalPath: '/he', structuredData: { '@type': 'SoftwareApplication', offers: { priceCurrency: 'ILS' } } });

    expect(document.getElementById('proflow-static-structured-data')).toBeNull();
    const ldTags = document.querySelectorAll('script[type="application/ld+json"]');
    expect(ldTags.length).toBe(1);
    expect(ldTags[0].id).toBe('proflow-structured-data-override');
  });
});

describe('setSeoMeta - hreflang cleanup across navigation (item B6)', () => {
  it('removes a hreflang tag from a previous page\'s cluster that the current call does not repeat', () => {
    setSeoMeta({
      title: 'x', canonicalPath: '/he/tools/units',
      hreflang: [{ lang: 'he', path: '/he/tools/units' }, { lang: 'en', path: '/en/tools/units' }],
    });
    expect(document.querySelectorAll('link[rel="alternate"][hreflang]').length).toBe(2);

    // Next page has a DIFFERENT (smaller) cluster.
    setSeoMeta({ title: 'y', canonicalPath: '/he/contact', hreflang: [{ lang: 'he', path: '/he/contact' }] });
    const remaining = [...document.querySelectorAll('link[rel="alternate"][hreflang]')];
    expect(remaining.length).toBe(1);
    expect(remaining[0].getAttribute('hreflang')).toBe('he');
    expect(remaining[0].getAttribute('href')).toBe('https://www.tekango.com/he/contact');
  });

  it('clears ALL previous hreflang tags when the current call omits hreflang entirely - never leaves a stale cluster pointing at a different page', () => {
    setSeoMeta({
      title: 'x', canonicalPath: '/he/tools/units',
      hreflang: [{ lang: 'he', path: '/he/tools/units' }, { lang: 'en', path: '/en/tools/units' }],
    });
    expect(document.querySelectorAll('link[rel="alternate"][hreflang]').length).toBe(2);

    setSeoMeta({ title: 'internal page', canonicalPath: '/professional-preview', noindex: true });
    expect(document.querySelectorAll('link[rel="alternate"][hreflang]').length).toBe(0);
  });
});
