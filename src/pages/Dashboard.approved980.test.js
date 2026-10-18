import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

// Source guards for the approved 980px dashboard (2026-10-08). The full Dashboard needs heavy auth/Supabase mocks, so (like
// Dashboard.navigation.test.js) these guard the structural decisions at source level; the rendered proof is the real HE/EN
// geometry check against the approved reference.
const root = cwd();
const read = (...p) => readFileSync(join(root, ...p), 'utf8').split(String.fromCharCode(13)).join('');
const dashboard = read('src', 'pages', 'Dashboard.jsx');
const indexCss = read('src', 'index.css');
const css = dashboard.replace(/\/\*[\s\S]*?\*\//g, '');

const desktopBlock = () => {
  const start = css.search(/@media \(min-width: 769px\) \{\s*\.dash-sidebar \{\s*width: 178px;/);
  expect(start).toBeGreaterThan(-1);
  let depth = 0;
  let i = css.indexOf('{', start);
  const from = i;
  for (; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') { depth -= 1; if (!depth) break; }
  }
  return css.slice(from, i);
};
const rule = (block, selector) => {
  const idx = block.indexOf(`${selector} {`);
  expect(idx, selector).toBeGreaterThan(-1);
  return block.slice(idx, block.indexOf('}', idx));
};

describe('approved 980px shell (source guards)', () => {
  it('the shell token is exactly min(980px, 100%) so it never stretches with the viewport', () => {
    expect(indexCss).toMatch(/--pf-dashboard-shell-total-width:\s*min\(980px,\s*100%\);/);
    expect(indexCss).not.toMatch(/--pf-dashboard-shell-total-width:\s*min\(980px,\s*96vw\)/);
  });

  it('never uses the undefined --pf-content-dir and never forces direction on layout containers', () => {
    expect(dashboard).not.toContain('--pf-content-dir');
    const block = desktopBlock();
    for (const sel of ['.quote-workspace-controls', '.dash-header-account', '.dash-header-row', '.quote-modern-row', '.dash-sidebar', '.dash-sidebar-user', '.quote-overview']) {
      expect(block.includes(`${sel} {`) ? rule(block, sel) : '', sel).not.toMatch(/direction\s*:/);
    }
    expect(block).not.toMatch(/row-reverse/);
  });

  it('one flat navy band: 68px header, 68px sidebar brand block, 178px sidebar, no gradients on the shared seam', () => {
    const block = desktopBlock();
    expect(rule(block, '.dash-upper-section')).toMatch(/height: 68px;/);
    expect(rule(block, '.dash-upper-section')).toMatch(/background: #11274a !important;/);
    expect(rule(block, '.dash-sidebar-brand')).toMatch(/height: 68px;/);
    expect(rule(block, '.dash-sidebar-brand')).toMatch(/background: #11274a;/);
    expect(rule(block, '.dash-sidebar')).toMatch(/width: 178px;/);
    expect(rule(block, '.dash-sidebar')).toMatch(/background: #102444 !important;/);
    expect(block).not.toMatch(/linear-gradient/);
  });

  it('the header band holds no hot-quote banner (it lives under the band, in the quotes workspace) and drops the stats row on desktop', () => {
    const block = desktopBlock();
    expect(dashboard).not.toContain('dash-hot-quote-alert');
    expect(dashboard).not.toContain('hotQuotesList');
    expect(read('src', 'components', 'QuotesTab.jsx')).toContain('className="quote-hot-banner"');
    expect(block).toMatch(/\.dash-header-stats \{ display: none !important; \}/);
    expect(block).not.toMatch(/grid-template-columns:\s*1fr auto 1fr/);
  });

  it('the header account cluster is [greeting, bell, plan medallion] in one DOM order (medallion outermost in both languages; Owner 2026-10-14: greeting instead of the business name, medallion instead of the avatar)', () => {
    const at = dashboard.indexOf('<div className="dash-header-account">');
    const cluster = dashboard.slice(at, at + 1400);
    expect(cluster.indexOf('<HeaderGreeting isHebrew={isHebrew} />')).toBeGreaterThan(-1);
    // Task 20: the bell is rendered by NotificationCenter (same 18px Bell icon, same slot) - the locked order is unchanged
    expect(cluster.indexOf('<HeaderGreeting isHebrew={isHebrew} />')).toBeLessThan(cluster.indexOf('<NotificationCenter'));
    expect(cluster.indexOf('<NotificationCenter')).toBeLessThan(cluster.indexOf('<HeaderPlanMedallion'));
    const center = readFileSync(join(cwd(), 'src', 'components', 'NotificationCenter.jsx'), 'utf8');
    expect(center).toContain('<Bell size={18} strokeWidth={1.6} aria-hidden="true" />');
    expect(center).toMatch(/width: 18, height: 18, padding: 0, margin: 0, border: 0/);
  });

  it('the header clock is one line (weekday, date | time), SECOND precision synced to the device clock, with isolated numeric atoms', () => {
    const clock = dashboard.slice(dashboard.indexOf('function HeaderClock'), dashboard.indexOf('// PRODUCT_TRUTH_CAPABILITY: dashboard_overview'));
    // Owner console 2026-10-18, typed: "1 - עם שניות", "2 - שיהיה מסונכרן בדיוק לפי שעון המחשב", "3 - להחזיר את האנימציה": seconds, ticking on the device clock's second boundary
    expect(clock).toContain("const schedule = () => { id = setTimeout(() => { setNow(new Date()); schedule(); }, 1000 - (Date.now() % 1000) + 2); };");
    expect(clock).toContain("second: '2-digit'");
    expect(clock).toMatch(/<bdi dir="ltr" className="dash-header-date pf-num">/);
    expect(clock).toMatch(/<bdi dir="ltr" className="dash-header-time pf-num">/);
    expect(clock).toMatch(/className="dash-header-sep" aria-hidden="true">\|<\/span>/);
  });

  it('the sidebar top is the static TEKANGO logo card, the nav is plain rows, and Sign out lives behind the identity gear', () => {
    expect(dashboard).toMatch(/className="dash-sidebar-brand-card" role="img" aria-label="TEKANGO"/);
    expect(dashboard).not.toContain('dash-sidebar-platform-brand"');
    expect(dashboard).toMatch(/<SidebarAccountMenu/);
    expect(dashboard).toMatch(/onSignOut=\{\(\) => setShowSignOutModal\(true\)\}/);
    const block = desktopBlock();
    expect(rule(block, '.dash-sidebar-btn.dash-sidebar-btn-active')).toMatch(/border: 0;/);
    expect(rule(block, '.dash-sidebar-nav')).toMatch(/padding-top: 23px;/);
  });
});

describe('approved dashboard QA fixes (source guards)', () => {
  it('sidebar labels never wrap: nowrap rows/labels with a 13.5px label and a narrow inline padding so "Expenses & Reports" fits 178px', () => {
    const block = desktopBlock();
    expect(rule(block, '.dash-sidebar-cta,\n          .dash-sidebar-btn')).toMatch(/white-space: nowrap;/);
    expect(rule(block, '.dash-sidebar-cta,\n          .dash-sidebar-btn')).toMatch(/font-size: 13.5px;/);
    expect(rule(block, '.dash-sidebar-cta,\n          .dash-sidebar-btn')).toMatch(/min-height: 36px;/);
    expect(block).toMatch(/\.dash-sidebar-btn > span \{ min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; \}/);
    expect(rule(block, '.dash-sidebar')).toMatch(/padding: 0 4px 10px;/);
  });

  it('the header keeps [date, account cluster] in the same order at every width >= 769 (the old 769-1000 order rules are neutralized)', () => {
    const block = desktopBlock();
    expect(rule(block, '.dash-header-title')).toMatch(/order: 0;/);
    expect(rule(block, '.dash-header-badge-desktop')).toMatch(/order: 1;/);
    expect(rule(block, '.dash-header-row')).toMatch(/flex-wrap: nowrap;/);
  });

  it('only a hot quote is orange; a plain sent quote uses the existing sent teal', () => {
    const block = desktopBlock();
    expect(block).toMatch(/\.quote-modern-status\[data-tone="hot"\] \{ color: #f0640f; \}/);
    expect(block).toMatch(/\.quote-modern-status\[data-tone="sent"\] \{ color: #0f6672; \}/);
  });

  it('amount slot keeps >= 12px clear on the action side via the list real dir (6px padding + 6px column gap), and shrinks only 13+ character amounts', () => {
    const block = desktopBlock();
    expect(block).toMatch(/\.quote-modern-list\[dir="rtl"\] \.quote-modern-row > \.quote-modern-amount \{ padding-left: 6px; \}/);
    expect(block).toMatch(/\.quote-modern-list\[dir="ltr"\] \.quote-modern-row > \.quote-modern-amount \{ padding-right: 6px; \}/);
    expect(block).toMatch(/--qm-gap: 6px;/);
    expect(block).toMatch(/\.quote-modern-amount\.is-long \{ font-size: 12\.5px; \}/);
  });

  it('the header block stays fixed at 40px above the list and the new-quote popover is width-capped', () => {
    const block = desktopBlock();
    expect(read('src', 'pages', 'Dashboard.jsx')).toMatch(/\.pf-newquote-popover \{ min-width: 0; max-width: min\(268px, calc\(100vw - 24px\)\); \}/);
    expect(rule(block, '.quote-workspace .quote-workspace-header')).toMatch(/block-size: 40px;/);
  });

  it('IRON-ILS-001: the dashboard hands the list ONLY the canonical money formatter (no exact-cent list formatter)', () => {
    expect(dashboard).toMatch(/const formatMoneyDisplay = \(val, cur\) => formatMoneyForCurrency\(/);
    expect(dashboard).not.toMatch(/formatExactMoney/);
    const quotesTabCall = dashboard.slice(dashboard.indexOf('<QuotesTab'), dashboard.indexOf('/>', dashboard.indexOf('<QuotesTab')));
    expect(quotesTabCall).toMatch(/formatMoneyDisplay=\{formatMoneyDisplay\}/);
    expect(quotesTabCall).not.toMatch(/formatExactMoney|listMoney|formatMoney=|formatNum=/);
  });
});

describe('approved quotes workspace (source guards)', () => {
  it('every row and the header strip share ONE seven-track template and the inline start/end paddings of the approved geometry', () => {
    const block = desktopBlock();
    expect(block.match(/grid-template-columns: var\(--qm-cols\);/g) || []).toHaveLength(2);
    expect(rule(block, '.quote-modern-head-row')).toMatch(/grid-template-columns: var\(--qm-cols\);/);
    expect(rule(block, '.quote-modern-row')).toMatch(/grid-template-columns: var\(--qm-cols\);/);
    // Owner R5: the leading 30px hold the row-edge dropdown trigger (the header strip reserves the same spacing)
    expect(rule(block, '.quote-modern-row')).toMatch(/padding-inline: 30px 16px;/);
    expect(rule(block, '.quote-modern-head-row')).toMatch(/padding-inline: 24px 6px;/);
    expect(rule(block, '.quote-modern-item')).toMatch(/border-inline-start: 4px solid transparent;/);
    expect(rule(block, '.quote-modern-item.is-hot')).toMatch(/#f66a25/);
  });

  it('numeric slots are tabular and LTR-isolated; the dropdown action is a fixed-height button; the total font is fixed', () => {
    const block = desktopBlock();
    expect(rule(block, '.quote-modern-row > .quote-modern-amount')).toMatch(/font-variant-numeric: tabular-nums lining-nums;/);
    expect(rule(block, '.quote-modern-row > .quote-modern-amount')).toMatch(/unicode-bidi: isolate;/);
    expect(rule(block, '.quote-modern-detail .quote-modern-action')).toMatch(/block-size: 32px;/);
    expect(block).not.toMatch(/\.quote-modern-head-action \{/);
    expect(rule(block, '.quote-workspace .quote-overview')).toMatch(/grid-template-columns: 125fr 150fr 138fr 346fr;/);
    expect(block).not.toMatch(/clamp\(/);
  });

  it('the list card sizes to its content (no blank area under Show all)', () => {
    const card = rule(desktopBlock(), '.quote-workspace > .quote-modern-list');
    expect(card).toMatch(/align-self: flex-start;/);
    expect(card).toMatch(/height: auto;/);
  });

  // Task 21 (Owner-pasted relay 2026-10-10): the measured choice also marks a measured entry; the AI choice opens the AI quote-draft dialog
  // on the blank form instead of only the general chat. Both still reset FIRST through handleCreateNewQuoteClick.
  it('New quote menu choices: structured resets first then marks the measured entry (one list, no rooms first - Owner round 1, A1); AI resets first then opens the AI draft dialog', () => {
    // Task 27: the reset doubles as the Free-10 creation check (returns false = stopped before anything opens)
    expect(dashboard).toMatch(/const handleCreateStructuredQuoteClick = \(\) => \{\s*if \(handleCreateNewQuoteClick\(\) === false\) return;\s*setMeasuredQuoteEntry\(true\);\s*\};/);
    expect(dashboard).toMatch(/const handleCreateAiQuoteClick = \(\) => \{\s*if \(handleCreateNewQuoteClick\(\) === false\) return;\s*setShowAiQuoteDraft\(true\);\s*\};/);
    expect(dashboard).toMatch(/onCreateStructuredQuote=\{handleCreateStructuredQuoteClick\}/);
    expect(dashboard).toMatch(/onCreateAiQuote=\{handleCreateAiQuoteClick\}/);
  });

  it('the AI launcher is docked at the workspace inline-end bottom corner on desktop (never over the content)', () => {
    const block = desktopBlock();
    expect(block).toMatch(/\.dash-ai-chat-mount \.ai-chat-container \{ bottom: 0 !important; \}/);
    expect(block).toMatch(/justify-content: flex-end !important;/);
    expect(css).toMatch(/\.dash-ai-chat-mount \{ direction: \$\{isHebrew \? 'rtl' : 'ltr'\}; \}/);
  });
});
