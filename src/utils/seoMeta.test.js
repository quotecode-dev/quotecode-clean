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
  document.head.querySelectorAll('meta, link[rel="canonical"], link[rel="alternate"], #proflow-structured-data-override').forEach((el) => el.remove());
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
