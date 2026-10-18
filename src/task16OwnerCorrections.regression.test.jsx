// Task 16 - regression gates for the Owner corrections of 2026-10-05 (cloud). Each block fails on the defect that was
// measured before the fix (see docs/task16-quote-experience-v2/cloud-audit-2026-10-05). Unit/static level only: the
// geometry proof (positions, list room, print emulation) is the browser gate scripts/task16/qa/layout-regression-gate.mjs.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import LandingHeader from './components/landing/LandingHeader';
import PublicQuoteHeader from './components/PublicQuoteHeader';
import { APP_HEADER, APP_SHELL, APP_FOCUS } from './theme/neonTheme';

const read = (p) => readFileSync(join(cwd(), p), 'utf8');

// WCAG relative luminance / contrast (hex or rgba over a background)
const hexRgb = (h) => { const x = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)); };
const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const over = (rgba, bg) => { const m = rgba.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/); if (!m) return hexRgb(rgba); const a = +m[4]; return [1, 2, 3].map((i, k) => Math.round(+m[i] * a + bg[k] * (1 - a))); };
const contrast = (fg, bgHex) => { const bg = hexRgb(bgHex); const f = over(fg, bg); const [a, b] = [lum(f), lum(bg)].sort((x, y) => y - x); return (a + 0.05) / (b + 0.05); };

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('F1 landing - no visible HE/EN switch; routes, auth links and alternates stay', () => {
  const nav = { sections: [{ id: 'styles', label: 'Styles' }], label: 'Main', homeLabel: 'Home', menu: 'Menu', closeMenu: 'Close', login: 'Sign in', cta: 'Start trial', ctaShort: 'Trial', forgotPassword: 'Forgot' };
  const links = { home: '/he', login: '/dashboard?lang=he', signup: '/dashboard?signup=true&lang=he' };

  it('header and opened drawer contain no link to the other locale', () => {
    const { container } = render(<LandingHeader nav={nav} links={links} navigate={() => {}} />);
    fireEvent.click(container.querySelector('.tl-menu-toggle'));
    const hrefs = [...document.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).not.toContain('/en');
    expect(document.querySelector('.tl-lang')).toBeNull();
    expect(hrefs).toEqual(expect.arrayContaining(['/he', '/dashboard?lang=he', '/dashboard?signup=true&lang=he']));
  });

  it('landing copy carries no cross-language link data any more; locale auth links stay', () => {
    for (const [f, lang] of [['src/pages/LandingLocal.jsx', 'he'], ['src/pages/LandingGlobal.jsx', 'en']]) {
      const src = read(f);
      expect(src).not.toMatch(/otherLang/);
      expect(src).toContain(`login: '/dashboard?lang=${lang}'`);
      expect(src).toContain(`signup: '/dashboard?signup=true&lang=${lang}'`);
    }
  });

  it('canonical + hreflang alternates for /he and /en are still produced by the public SEO table', () => {
    const seo = read('src/shared/publicSeoRoutes.js');
    expect(seo).toMatch(/hreflang/);
    expect(seo).toMatch(/'\/he'/);
    expect(seo).toMatch(/'\/en'/);
  });

  // Superseded (local fix 6, R1): the 2026-10-05 reading "logo and actions together on the right" is replaced by the later
  // explicit Owner instruction (2026-10-06): HE logo far right -> section links right after it -> sign-in / trial far left
  // (the RTL mirror of EN). The physical geometry is gated by scripts/task16/qa/landing/header-order.mjs (bounding boxes).
  it('HE: logo far right, section links right after it, sign-in/trial far left (DOM order = visual order), at every width', () => {
    const css = read('src/components/landing/landing.css');
    // no CSS order override may move the actions next to the logo again
    expect(css).not.toMatch(/\.tl-landing\[dir='rtl'\] \.tl-(logo|actions|menu) \{ order: \d; \}/);
    expect(css).toMatch(/\.tl-landing\[dir='rtl'\] \.tl-menu \{ margin-inline-start: 0; \}/);
    expect(css).toMatch(/\.tl-landing\[dir='rtl'\] \.tl-actions \{ margin-inline-start: auto; \}/);
    // collapsed widths: the actions (toggle + trial) go to the far end in both locales (no HE neutralisation)
    expect(css).not.toMatch(/\.tl-landing\[dir='rtl'\] \.tl-actions \{ margin-inline-start: 0; \}/);
  });

  it('landing section text starts on the language side (no centred closing band)', () => {
    const css = read('src/components/landing/landing.css');
    const closing = css.match(/\.tl-closing \{[^}]*\}/)[0];
    expect(closing).toMatch(/text-align: start/);
    for (const sel of ['.tl-hero', '.tl-title', '.tl-section', '.tl-closing h2', '.tl-closing p']) {
      const rules = [...css.matchAll(new RegExp(`${sel.replace(/\./g, '\\.')}(?:\\s|,)[^{]*\\{[^}]*\\}|${sel.replace(/\./g, '\\.')} \\{[^}]*\\}`, 'g'))].map((m) => m[0]);
      for (const r of rules) expect(r, r).not.toMatch(/text-align:\s*center/);
    }
  });
});

describe('F4 header - black band on screen, white print, Direct PDF kept as its own mode', () => {
  const props = { isHebrew: true, bizLogo: null, bizName: 'Biz', bizTaxId: '1', bizPhone: '', bizEmail: 'a@example.com', bizAddress: null, quote: { id: 'x', quote_number: 1048, created_at: '2026-10-05T00:00:00Z', valid_until: '2026-11-01' } };
  const mm = () => { window.matchMedia = vi.fn().mockImplementation((q) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })); };

  for (const variant of ['classic', 'modern', 'visual']) {
    it(`${variant}: ONE band holds the issuer + the metadata; the title is outside, below it`, () => {
      mm();
      const { container } = render(<PublicQuoteHeader {...props} variant={variant} />);
      const bands = container.querySelectorAll('.pq-lh-band');
      expect(bands.length).toBe(1);
      expect(bands[0].querySelector('.pq-lh-issuer')).not.toBeNull();
      expect(bands[0].querySelector('.pq-meta')).not.toBeNull();
      const title = container.querySelector('.pq-doc-title');
      expect(bands[0].contains(title)).toBe(false);
      expect(bands[0].compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      // metadata stays centred per cell
      for (const cell of container.querySelectorAll('.pq-meta-cell')) expect(cell.style.textAlign).toBe('center');
    });
  }

  it('screen band tones are dark and every band text keeps >= 4.5:1', () => {
    const css = read('src/quoteDocument/quoteDocument.css');
    const classic = css.match(/--pq-band-bg: (#[0-9A-Fa-f]{6})/)[1];
    const visual = css.match(/\.pq-letterhead\.pq-letterhead-visual \{\s*--pq-band-bg: (#[0-9A-Fa-f]{6})/)[1];
    for (const bg of [classic, visual]) {
      expect(lum(hexRgb(bg))).toBeLessThan(0.05);
      expect(contrast('#FFFFFF', bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast('rgba(255, 255, 255, 0.78)', bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast('#F5B5B5', bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(css).toMatch(/\.pq-letterhead \.pq-lh-band \{\s*background: var\(--pq-band-bg\);/);
  });

  it('native print renders the band white with dark text', () => {
    const css = read('src/quoteDocument/quoteDocument.css');
    const printBlocks = [...css.matchAll(/@media print \{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
    expect(printBlocks).toMatch(/\.pq-letterhead \.pq-lh-band,[\s\S]*?background: #FFFFFF !important;/);
    expect(printBlocks).toMatch(/\.pq-lh-band \.pq-lh-name,[\s\S]*?color: var\(--pq-ink\) !important;/);
  });

  // Owner console 2026-10-18, typed: "זה חייב להראות בדיוק כמו המסך רק מבלי להדפיס את ההדר בשחור" - Print and the Direct PDF ARE the screen document
  it('Direct PDF capture: the screen band geometry in WHITE (the Owner decided: Print and the PDF are the screen document, the header never black)', () => {
    const css = read('src/quoteDocument/quoteDocument.css');
    expect(css).toMatch(/\.pq-pdf-capturing \.pq-letterhead \.pq-lh-band,[\s\S]*?\{\s*background: #FFFFFF !important;/);
    expect(css).not.toMatch(/OWNER DECISION PENDING/);
  });

  it('interface: the Dashboard greeting card token is dark with readable text; sidebar token unchanged', () => {
    const bg = APP_HEADER.sidebarBg;
    expect(lum(hexRgb(bg))).toBeLessThan(0.05);
    expect(contrast(APP_HEADER.sidebarTextActive, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(APP_HEADER.sidebarText, bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(APP_HEADER.sidebarTextMuted, bg)).toBeGreaterThanOrEqual(4.5);
    expect(APP_SHELL.sidebarBg).toBe('#152229');
    expect(contrast(APP_FOCUS.onDark, bg)).toBeGreaterThanOrEqual(3);
    expect(read('src/pages/Dashboard.jsx')).toMatch(/\.dash-upper-section :focus-visible \{\s*outline-color: \$\{APP_FOCUS\.onDark\} !important;/);
  });
});

describe('F3 Quote History - base title, one-row greeting, no status-count metrics (R25 / ledger Q01-Q03)', () => {
  it('the Quote History title is a plain class-styled h2 (approved 980px dashboard supersedes ledger Q03: base 1.2rem/800, desktop 25px/700)', () => {
    expect(read('src/components/QuotesTab.jsx')).toMatch(/<h2 className="quote-workspace-title"/);
  });
  it('greeting one-row contract at <=360px tightens only padding (no font below 12px)', () => {
    const src = read('src/pages/Dashboard.jsx');
    const block = src.match(/@media \(max-width: 360px\) \{\s*\.dash-header-badge-mobile \.dash-header-ai-btn \{[\s\S]*?\n {8}\}/)[0];
    expect(block).toMatch(/padding: 0 4px;/);
    expect(block).not.toMatch(/font-size/);
  });
  it('no Task 16 status-count metrics at any width (R25 rollback to the base c65f742 structure)', () => {
    expect(read('src/index.css')).not.toMatch(/qh-metrics|pf-qh-metric/);
    expect(read('src/components/QuotesTab.jsx')).not.toMatch(/qh-metrics|renderMetrics|metricsInHeader/);
  });
});

describe('IRON-ILS-001 scope (Owner 2026-10-05): calculators are NOT whole-shekel surfaces', () => {
  const CALCULATORS = ['src/components/DraggableCalculator.jsx', 'src/components/PublicTools.jsx', 'src/components/PublicToolsEn.jsx'];
  it('calculator files are outside the protected Local money list', () => {
    const list = read('src/ilsMoney.static.test.js').match(/PROTECTED_LOCAL_MONEY_FILES = \[([\s\S]*?)\];/)[1];
    for (const f of CALCULATORS) expect(list).not.toContain(f);
  });
  it('calculator results / conversions / rates are never routed through the whole-shekel formatters', () => {
    for (const f of CALCULATORS) expect(read(f)).not.toMatch(/formatWholeMoney|roundHalfUpWhole|formatMoneyForCurrency|formatMoneyDisplay/);
  });
});
