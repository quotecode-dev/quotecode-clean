import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

// Responsive sticky screen-block parity (Owner-locked): on EVERY viewport the
// canonical Header and each screen's static block (title/controls/column
// header) stay put and ONLY the inner body scrolls. Mobile/tablet must use the
// desktop scroll model - responsive differences may change layout, never what
// is sticky or what owns scroll. These guards fail if a breakpoint-specific
// scroll model, an outer-page scroll owner, or a body-less screen returns.
const root = cwd();
const read = (...p) => readFileSync(join(root, ...p), 'utf8');
const dashboard = read('src', 'pages', 'Dashboard.jsx');
const css = dashboard.replace(/\/\*[\s\S]*?\*\//g, '');

// Every top-level @media block, with its body (brace matched).
function mediaBlocks(source) {
  const blocks = [];
  const re = /@media\s*([^{]+)\{/g;
  let m;
  while ((m = re.exec(source))) {
    let depth = 1; let i = re.lastIndex;
    while (depth && i < source.length) { if (source[i] === '{') depth += 1; else if (source[i] === '}') depth -= 1; i += 1; }
    blocks.push({ query: m[1].trim(), body: source.slice(re.lastIndex, i - 1) });
  }
  return blocks;
}
const outsideMedia = (source) => {
  let out = source;
  for (const b of mediaBlocks(source)) out = out.replace(`@media ${b.query}{${b.body}}`, '').replace(new RegExp(`@media\\s*${b.query.replace(/[()]/g, '\\$&')}\\s*\\{`), '');
  return out;
};

describe('ONE responsive static-block / inner-body scroll contract', () => {
  it('the scroll contract (.pf-screen / .pf-screen-body / .pf-head-gutter + fixed-height shell) is NOT inside any breakpoint media query', () => {
    for (const { query, body } of mediaBlocks(css)) {
      expect(body, query).not.toMatch(/\.pf-screen\b/);
      expect(body, query).not.toMatch(/\.pf-head-gutter/);
      expect(body, query).not.toMatch(/\.dash-app-shell\s*\{[^}]*height:\s*100/);
    }
    expect(css).toMatch(/\.pf-screen\s*>\s*\.pf-screen-body\s*\{[^}]*overflow-y:\s*auto/);
    expect(css).toMatch(/\.dash-app-shell\s*\{[^}]*height:\s*100dvh;[^}]*overflow:\s*hidden/);
  });

  it('the app shell is a fixed-height column on every viewport, so the OUTER page never owns vertical scroll', () => {
    expect(css).toMatch(/\.dash-app-shell\s*\{[^}]*height:\s*100vh;\s*height:\s*100dvh;\s*overflow:\s*hidden;/);
    expect(css).toMatch(/\.dash-shell-main\s*\{[^}]*min-height:\s*0;[^}]*height:\s*100%/);
    expect(css).not.toMatch(/@media\s*\(max-width:\s*768px\)\s*\{[^@]*\.dash-app-shell\s*\{[^}]*(height:\s*auto|overflow:\s*visible)/);
  });

  it('the only mobile/tablet media rules for the content column are layout insets (safe-area top, bottom-nav bottom) - no scroll-model override', () => {
    for (const { query, body } of mediaBlocks(css).filter((b) => /max-width:\s*768px/.test(b.query))) {
      const mainRules = [...body.matchAll(/\.dash-main-content\s*\{([^}]*)\}/g)].map((m) => m[1]);
      for (const rule of mainRules) {
        expect(rule, query).not.toMatch(/overflow(-y)?\s*:/);
        expect(rule, query).not.toMatch(/\bheight\s*:|max-height/);
      }
    }
  });

  it('the bottom-nav inset keeps the scroll body clear of the fixed mobile nav (the single mobile bottom inset)', () => {
    expect(css).toMatch(/\.dash-main-content\s*\{\s*padding-bottom:\s*calc\(66px \+ env\(safe-area-inset-bottom,\s*0px\)\)\s*!important/);
  });

  it('children of the scroll body never flex-shrink (a shrunk overflow:hidden card is ~0px tall and untappable)', () => {
    expect(css).toMatch(/\.pf-screen\s*>\s*\.pf-screen-body\s*>\s*\*\s*\{\s*flex-shrink:\s*0;/);
  });

  it('no desktop-only query remains around the shared contract (sidebar alignment is the only min-width:769px scroll-shell rule)', () => {
    const desktopBlocks = mediaBlocks(css).filter((b) => /min-width:\s*769px/.test(b.query));
    for (const { body } of desktopBlocks) expect(body).not.toMatch(/\.pf-screen|\.dash-shell-main|\.dash-app-shell/);
  });
});

describe('every authenticated screen keeps a static block and an inner scroll body on ALL viewports', () => {
  const screens = {
    'Quote History': 'QuotesTab.jsx', Clients: 'ClientsTab.jsx', 'Business Settings': 'SettingsTab.jsx',
    Catalog: 'ServicesCatalog.jsx', Finances: 'FinancesTab.jsx', 'New/Edit Quote': 'QuoteForm.jsx',
  };
  for (const [name, file] of Object.entries(screens)) {
    it(`${name}: pf-screen + pf-screen-body`, () => {
      const src = read('src', 'components', file);
      expect(src).toMatch(/className="pf-screen( pf-work-screen)?"/);
      expect(src).toMatch(/className="pf-screen-body/);
    });
  }
  it('Quote History mobile cards are the inner scroll body (not a body-less list that lets the page scroll)', () => {
    // Line-ending independent (the file may be checked out CRLF).
    const src = read('src', 'components', 'QuotesTab.jsx').split(String.fromCharCode(13)).join('');
    const mobile = src.slice(src.search(/\{isMobileView && \(\s*<>/));
    expect(mobile.length).toBeGreaterThan(100);
    expect(mobile).toMatch(/<div (ref={cardListRef} )?className="pf-screen-body" style=\{\{ display: 'flex', flexDirection: 'column', gap: '6px' \}\}>/);
  });
  it('Clients mobile list is the inner scroll body and no non-visual node separates the static block from it', () => {
    const src = read('src', 'components', 'ClientsTab.jsx');
    const start = src.search(/className="pf-screen( pf-work-screen)?"/);
    expect(src.indexOf('<style>{`', start)).toBeLessThan(src.indexOf('<div style={{ display: \'flex\', justifyContent: \'space-between\'', start));
    expect(src).toMatch(/\{isMobileView && \(\s*<div className="pf-screen-body"/);
  });
  it('all Admin destinations render through AdminScreenFrame (pf-screen + pf-screen-body) - same model as user screens', () => {
    const frame = read('src', 'components', 'AdminScreenFrame.jsx');
    expect(frame).toContain('pf-screen');
    expect(frame).toContain('pf-screen-body');
  });
});

describe('Header + AI Chat stay reachable while the body scrolls', () => {
  it('the canonical Header is outside the scroll body (a static sibling above the screen), on every viewport', () => {
    expect(dashboard.indexOf('className="dash-upper-section"')).toBeLessThan(dashboard.indexOf('{activeTab === \'main\' && !showQuoteForm && ('));
    expect(css).not.toMatch(/\.dash-upper-section\s*\{[^}]*position:\s*fixed/);
  });
  it('AI Chat launcher lives in the canonical Header (renderHeaderAIChatButton), never in a scrolling region', () => {
    expect((dashboard.match(/renderHeaderAIChatButton\(\)/g) || []).length).toBeGreaterThanOrEqual(2);
  });
  it('outerscroll helper sanity: media-query parser found the shell blocks it guards', () => {
    expect(mediaBlocks(css).length).toBeGreaterThan(3);
    expect(typeof outsideMedia(css)).toBe('string');
  });
});
