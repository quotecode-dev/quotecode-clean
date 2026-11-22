// simple1120 regression guards (law-48 walk of the other screens, 2026-11-22): the phone header grows for the stats line outside the
// sketch's screens, and the empty next-step note never ends in dots (L-25 / L-26).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const indexCss = fs.readFileSync('src/index.css', 'utf8');
const listCss = fs.readFileSync('src/components/quotesList.css', 'utf8');

describe('simple1120 regressions', () => {
  it('outside the quote list / editor the phone header grows to hold the stats line', () => {
    expect(indexCss).toContain('html body:not(:has(.pf-editor-form)) .dash-main-content .dash-upper-section:not([data-quotes-overview="true"]) { height: auto !important; min-height: 48px !important; padding: 2px 10px 8px !important; flex-shrink: 0 !important; }');
  });
  it('the empty next-step note wraps instead of ending in dots', () => {
    expect(listCss).toContain('.quote-hot-banner.quote-hot-banner--empty .quote-hot-banner-text { white-space: normal !important; overflow: visible !important; text-overflow: clip !important; }');
  });
});

describe('simple1120 law-50 measured corrections', () => {
  const treeCss = fs.readFileSync('src/components/quoteTree/quoteTree.css', 'utf8');
  it('the editor starts 10px (computer) / 6px (phone) under the header, as the sketch', () => {
    expect(treeCss).toContain('.pf-screen.qe > .pf-editor-form { padding-top: 10px !important; }');
    expect(treeCss).toContain('@media (max-width: 768px) { .pf-screen.qe > .pf-editor-form { padding-top: 6px !important; } }');
  });
  it('the header keeps the same 16px side padding on every screen (computer)', () => {
    expect(indexCss).toContain('@media (min-width: 769px) { html body .dash-main-content .dash-upper-section { padding-inline: 16px !important; } }');
  });
});

describe('simple1120: "To: Whole quote" spacing as the sketch', () => {
  it('the whole-quote target is its own item, so the 4px gap of .qt-to separates it from "To:" (the sketch: two flex items)', () => {
    const src = fs.readFileSync('src/components/quoteTree/QuoteTreeEditor.jsx', 'utf8');
    expect(src).toContain('{toText === t.whole ? <span>{t.whole}</span> : <EllipsisText');
  });
});

describe('simple1120: the sketch type and the saved screen strip (measured)', () => {
  it('the sketch screens use normal letter spacing (the shell keeps its -0.01em elsewhere)', () => {
    expect(indexCss).toContain('html body:has(.quote-workspace, .qe, .sq-saved--sketch) .dash-app-shell { letter-spacing: normal !important; }');
  });
  it('the saved screen keeps the sketch 10px end strip on a tablet / phone', () => {
    expect(indexCss).toContain('@media (max-width: 768px) { .sq-saved.sq-saved--sketch { padding-inline-end: 10px !important; } }');
  });
  it('the phone start window uses the sketch 13px / 12.5px', () => {
    expect(listCss).toContain('  .dash-mobile-newquote-menu > span { font-size: 13px !important; }\n  .dash-mobile-newquote-menu > button small { font-size: 12.5px !important; }');
  });
});

describe('simple1120: every text at the sketch size (measured)', () => {
  const treeCss = fs.readFileSync('src/components/quoteTree/quoteTree.css', 'utf8');
  it('structure menu 14px / 12px, row name 13px, project labels 12.5px on a phone', () => {
    expect(treeCss).toContain('.qt-menu .qt-sopt b { font-size: 14px; }');
    expect(treeCss).toContain('.qt-menu .qt-sopt small { font-size: 12px; }');
    expect(treeCss).toContain('.qe .qt-row-name { font-size: 13px; }');
    expect(treeCss).toContain('@media (max-width: 768px) { .qe .qt-page-label { font-size: 12.5px; } }');
  });
  it('phone hot-banner name 13px and card number 12.5px', () => {
    expect(listCss).toContain('.quote-hot-banner .qhb-short-name { font-size: 13px !important; }');
    expect(listCss).toContain('.quote-workspace .qc-num { font-size: 12.5px !important; }');
  });
});

describe('simple1120: last measured corrections', () => {
  const treeCss = fs.readFileSync('src/components/quoteTree/quoteTree.css', 'utf8');
  it('the shell (header, side menu, bottom bar) keeps normal letter spacing on every screen', () => {
    expect(indexCss).toContain('html body .dash-app-shell .dash-upper-section, html body .dash-app-shell aside, html body .dash-app-shell .mobile-bottom-nav { letter-spacing: normal !important; }');
  });
  it('the sort arrow takes the title colour; the question window does not shrink', () => {
    expect(listCss).toContain('.quote-modern-sort-arrow { color: inherit !important; opacity: 1 !important; }');
    expect(treeCss).toContain('.qp-dialog.qp-dialog--sketch { flex: none !important; }');
  });
});

describe('simple1120-fix1: the finances expenses (Owner console 2026-11-22)', () => {
  const fin = fs.readFileSync('src/components/FinancesTab.jsx', 'utf8');
  it('on a phone every expense is a card that fits the width (no sideways scroll, no column cut by the screen edge)', () => {
    expect(indexCss).toContain('@media (max-width: 560px) {\n  .fin-exp-wrap { overflow-x: visible !important; }\n  .fin-exp-table { min-width: 0 !important; display: block !important; }');
    expect(indexCss).toContain('grid-template-areas: "desc desc desc amt" "cat type date date" "act act act act";');
    for (const c of ['fin-exp-wrap', 'fin-exp-table', 'fin-exp-head', 'fin-exp-row', 'fin-exp-desc', 'fin-exp-cat', 'fin-exp-type', 'fin-exp-date', 'fin-exp-amt', 'fin-exp-act']) expect(fin).toContain(`className="${c}"`);
  });
  it('the total column is as wide as its amount and the amount keeps the physical right-edge axis (IRON-NUMERIC-001)', () => {
    expect(fin).toContain("<th style={{ padding: '6px', textAlign: 'right', width: '1%', whiteSpace: 'nowrap' }}>{t.total}</th>");
    expect(fin).toContain("<td className=\"fin-exp-amt\" style={{ padding: '8px 6px', textAlign: 'right', width: '1%', whiteSpace: 'nowrap' }}><MoneyValue slot symbol={sym}");
  });
});
