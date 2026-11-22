// simple1120 regression guards (law-48 walk of the other screens, 2026-11-22): the phone header grows for the stats line outside the
// sketch's screens, and the empty next-step note never ends in dots (L-25 / L-26).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const indexCss = fs.readFileSync('src/index.css', 'utf8');
const listCss = fs.readFileSync('src/components/quotesList.css', 'utf8');

describe('simple1120 regressions', () => {
  it('outside the quote list / editor the phone header grows to hold the stats line', () => {
    expect(indexCss).toContain('html body:not(:has(.pf-editor-form)) .dash-main-content .dash-upper-section:not([data-quotes-overview="true"]) { height: auto !important; min-height: 48px !important;');
  });
  it('the empty next-step note wraps instead of ending in dots', () => {
    expect(listCss).toContain('.quote-hot-banner.quote-hot-banner--empty .quote-hot-banner-text { white-space: normal !important; overflow: visible !important; text-overflow: clip !important; }');
  });
});
