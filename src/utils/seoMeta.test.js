import { describe, it, expect, beforeEach } from 'vitest';
import { setSeoMeta } from './seoMeta';

// TEKANGO domain migration: canonical/hreflang URLs must be built from the
// new www.tekango.com host, not the retired www.quotecodepro.com one.

beforeEach(() => {
  document.head.querySelectorAll('link[rel="canonical"], link[rel="alternate"]').forEach((el) => el.remove());
});

describe('setSeoMeta - TEKANGO canonical domain', () => {
  it('builds an absolute canonical URL on the tekango.com domain', () => {
    setSeoMeta({ title: 'x', canonicalPath: '/he/tools/metals' });
    expect(document.querySelector('link[rel="canonical"]').getAttribute('href')).toBe('https://www.tekango.com/he/tools/metals');
  });

  it('writes reciprocal hreflang alternate links on the tekango.com domain', () => {
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
