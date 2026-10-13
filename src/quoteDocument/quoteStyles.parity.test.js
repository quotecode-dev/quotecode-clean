// IRON-LANDING-001 / IRON-MIRRORING-001 (one product source) - parity between the ONE style definition
// (src/quoteDocument/quoteStyles.js) and every place this candidate consumes it: the landing style showcase (tabs + copy),
// the landing quotation renderer (image support, CSS variants), the showcase availability rule and the sample quotation.
// A style added / renamed in one place but not the others would crash or misdescribe the landing; these pin the agreement.
// (The entitlement helpers in the same module have no consumer in this candidate and are not exercised here.)
import { describe, it, expect, afterEach } from 'vitest';
import { createElement } from 'react';
import { render, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { DEFAULT_QUOTE_STYLE, PRESENTATION_TIERS, QUOTE_STYLE_IDS, QUOTE_STYLE_VERSIONS, STYLE_COPY, normalizeStyleId, styleSupportsImages } from './quoteStyles.js';
import { AVAILABLE_SHOWCASE_STYLES, DEFAULT_SHOWCASE_STYLE } from '../components/landing/showcaseAvailability.js';
import LandingQuoteDocument from '../components/landing/LandingQuoteDocument';
import { buildSampleQuote, parseSampleQuery } from './sampleQuotes.js';

afterEach(cleanup);

describe('quote style parity across the definition and its consumers', () => {
  it('ONE closed style set: ids, composition versions, tiers and both copy languages name exactly the same styles', () => {
    expect(QUOTE_STYLE_IDS).toEqual(['classic', 'modern', 'visual']);
    for (const keys of [Object.keys(QUOTE_STYLE_VERSIONS), PRESENTATION_TIERS.map((t) => t.id), Object.keys(STYLE_COPY.he), Object.keys(STYLE_COPY.en)]) {
      expect(keys).toEqual(QUOTE_STYLE_IDS);
    }
    for (const id of QUOTE_STYLE_IDS) expect(Number.isInteger(QUOTE_STYLE_VERSIONS[id]) && QUOTE_STYLE_VERSIONS[id] >= 1).toBe(true);
    expect(Object.isFrozen(QUOTE_STYLE_IDS) && Object.isFrozen(STYLE_COPY)).toBe(true);
  });

  it('HE and EN copy are symmetric: every style has a title, a description and the same number of benefits, in its own script', () => {
    for (const id of QUOTE_STYLE_IDS) {
      const he = STYLE_COPY.he[id];
      const en = STYLE_COPY.en[id];
      expect(he.benefits.length).toBe(en.benefits.length);
      expect(he.benefits.length).toBeGreaterThan(0);
      for (const c of [he, en]) expect(c.title && c.description && c.benefits.every(Boolean)).toBeTruthy();
      expect(he.description).toMatch(/[֐-׿]/);
      expect(en.description).not.toMatch(/[֐-׿]/);
    }
  });

  it('image support in the definition is exactly what the landing renderer shows (row thumbnails / figures only for image styles)', () => {
    for (const style of QUOTE_STYLE_IDS) {
      for (const locale of ['he', 'en']) {
        const doc = render(createElement(LandingQuoteDocument, { locale, style })).container;
        const hasImages = doc.querySelectorAll('.pq-media-thumb, figure').length > 0;
        expect(hasImages, `${locale}/${style}`).toBe(styleSupportsImages(style));
        cleanup();
      }
    }
  });

  it('the default style is the same everywhere: definition, showcase opening tab, showcase availability and the sample fallback', () => {
    expect(DEFAULT_SHOWCASE_STYLE).toBe(DEFAULT_QUOTE_STYLE);
    expect(AVAILABLE_SHOWCASE_STYLES).toEqual([DEFAULT_QUOTE_STYLE]);
    for (const s of AVAILABLE_SHOWCASE_STYLES) expect(QUOTE_STYLE_IDS).toContain(s);
    expect(parseSampleQuery('?style=premium').style).toBe(DEFAULT_QUOTE_STYLE);
    expect(buildSampleQuote({ style: undefined }).style).toBe(DEFAULT_QUOTE_STYLE);
    for (const v of ['Classic', ' modern', 'pro', '', null, 3]) expect(normalizeStyleId(v)).toBeNull();
  });

  it('every non-default style has its own landing document variant in the landing stylesheet; the default is the base document', () => {
    const css = readFileSync(join(cwd(), 'src', 'components', 'landing', 'landing.css'), 'utf8');
    for (const id of QUOTE_STYLE_IDS.filter((s) => s !== DEFAULT_QUOTE_STYLE)) expect(css, id).toMatch(new RegExp(`\\.tl-doc--${id}\\b`));
    expect(css).toMatch(/\.tl-doc\s*\{/);
    for (const id of QUOTE_STYLE_IDS) {
      expect(render(createElement(LandingQuoteDocument, { locale: 'en', style: id })).container.querySelector('article')).toHaveClass(`tl-doc--${id}`);
      cleanup();
    }
  });
});
