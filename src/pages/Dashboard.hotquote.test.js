import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Hot-quote banner contract (owner correction 2026-10-08): the banner is NOT part of the dark header band. It is the first child of
// the quotes workspace, directly under the band and above the toolbar/title block, localized, compact (40px) and tinted in the
// existing hot-orange family. Mounting the full Dashboard needs heavy Supabase/auth mocks, so (like the other Dashboard source
// guards) the structure is pinned at source level; the behaviour (pick, hidden-when-none, handler, copy HE/EN) is rendered in
// QuotesTab.test.jsx and the rendered geometry is verified in a real browser.
const here = dirname(fileURLToPath(import.meta.url));
const norm = (text) => text.split(String.fromCharCode(13)).join('');
const dashboardSource = norm(readFileSync(join(here, 'Dashboard.jsx'), 'utf-8'));
const quotesTabSource = norm(readFileSync(join(here, '..', 'components', 'QuotesTab.jsx'), 'utf-8'));
const css = dashboardSource.replace(/\/\*[\s\S]*?\*\//g, '');

const rule = (selector) => {
  const idx = css.indexOf(`${selector} {`);
  expect(idx, selector).toBeGreaterThan(-1);
  return css.slice(idx, css.indexOf('}', idx));
};

describe('Hot quote banner (source-level regression guard)', () => {
  it('the dark header band holds no banner and the old rotation/eligibility copy in Dashboard is gone', () => {
    expect(dashboardSource).not.toContain('dash-hot-quote-alert');
    expect(dashboardSource).not.toMatch(/hotQuotesList|currentHotQuote|hotQuoteIndex/);
  });

  it('the banner is the first child of the quotes workspace (above the toolbar/title block) and renders only for a real lead quote', () => {
    const banner = quotesTabSource.indexOf('className="quote-hot-banner"');
    const toolbar = quotesTabSource.indexOf('data-testid="quote-list-header"');
    expect(banner).toBeGreaterThan(-1);
    expect(banner).toBeLessThan(toolbar);
    // + Owner console 2026-10-18, typed: "שאלה 2: ב" - the banner steps aside while a search is typed
    expect(quotesTabSource).toMatch(/\{hotLead && !searchActive && \(\s*<div className="quote-hot-banner"/);
  });

  // Owner console 2026-10-18, typed: "מאשר שינוי ב-L-19: פס ההצעה החמה יתחלף כל 4 שניות בין כל ההצעות החמות" - the banner shows every hot
  // quote in turn (hottest first); the row promotion keeps the ONE hottest (pickCompactRows -> pickLeadHotRow)
  it('the banner rotates through every hot quote (hottest first), the row promotion keeps the hottest, and it reuses the tracking-details handler', () => {
    expect(quotesTabSource).toMatch(/const hotLead = hotRows\.length \? hotRows\[hotIndex % hotRows\.length\] : null;/);
    expect(quotesTabSource).toMatch(/setInterval\(\(\) => setHotIndex\(\(i\) => i \+ 1\), 4000\)/);
    expect(quotesTabSource).toMatch(/onClick=\{\(\) => openHotQuote\(hotLead\.quote\.id\)\}/);
    expect(quotesTabSource).toContain('openTrackingFor(quoteId);');
    expect(quotesTabSource).toMatch(/quote-modern-detail-\$\{quoteId\}/);
  });

  // Owner updates 2026-10-09 (all devices): no flame and no "hot quote" title; ONE illustrated eye at the inline-start edge, then
  // "{clientName} viewed this quote {viewCount} times and still hasn't signed." with the REAL client name (no generic "the client").
  it('keeps ONE eye icon only (no Flame, no title), first at inline-start, then the real client name and the exact HE/EN sentence', () => {
    const block = quotesTabSource.slice(quotesTabSource.indexOf('className="quote-hot-banner"'), quotesTabSource.indexOf('data-testid="quote-list-header"'));
    expect(block).not.toMatch(/Flame|quote-hot-banner-label/);
    expect(block).not.toMatch(/הצעה חמה|Hot quote|הלקוח צפה|The client viewed/i);
    // ONE icon: the original illustrated TEKANGO eye (Owner: no Lucide / generic / pixel icon) at a legible 24px
    expect(block).not.toMatch(/<Eye /);
    expect(block.match(/<TekangoEyeIcon /g)).toHaveLength(1);
    expect(block).toMatch(/<TekangoEyeIcon size=\{24\} className="quote-hot-banner-eye" \/>/);
    // the eye button is the banner's FIRST child -> inline-start (right in HE, left in EN) before the text, via dir only
    expect(block.indexOf('className="quote-hot-banner-action"')).toBeLessThan(block.indexOf('className="quote-hot-banner-text"'));
    expect(block).not.toMatch(/row-reverse|isHebrew \? 'right'|isHebrew \? 'left'/);
    // the real client name, else the quote title, else its full number - ONE shared rule (quotePartyLabel, also the Statistics list)
    // night task 2026-10-16 (R-28): the name is bidi-isolated inside the mark
    expect(block).toMatch(/<mark className="quote-hot-banner-name"><bdi>\{quotePartyLabel\(hotLead\.quote\)\.text\}<\/bdi><\/mark>/);
    expect(block.indexOf('quote-hot-banner-name')).toBeLessThan(block.indexOf("' צפה בהצעה '"));
    expect(block).toContain("' צפה בהצעה '");
    expect(block).toContain("' פעמים ועדיין לא חתם.'");
    expect(block).toContain("' viewed this quote '");
    expect(block).toContain("' times and still hasn’t signed.'");
    expect(block).toMatch(/<bdi className="pf-num" dir="ltr">/);
    expect(block).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    // the flame and the hot title are gone from every quote-list surface (rows, legacy table, mobile cards)
    expect(quotesTabSource).not.toMatch(/\bFlame\b|🔥|'הצעה חמה'|'Hot quote'|quote-modern-hot|quote-card-hot/);
  });

  it('ONLY the eyelid blinks (CSS inside the SVG), once every 6-8s, briefly, never scaling/moving the icon; off for reduced motion', () => {
    const iconSource = norm(readFileSync(join(here, '..', 'components', 'TekangoEyeIcon.jsx'), 'utf-8'));
    expect(iconSource).toMatch(/<svg[\s\S]*?<style>\{TK_EYE_BLINK_CSS\}<\/style>/);
    const cssStart = iconSource.indexOf('const TK_EYE_BLINK_CSS = `');
    expect(cssStart).toBeGreaterThan(-1);
    const globalCss = iconSource.slice(cssStart, iconSource.indexOf('`;', cssStart));
    const lidAt = globalCss.indexOf('.tk-eye-lid {');
    expect(lidAt).toBeGreaterThan(-1);
    const lidRule = globalCss.slice(lidAt, globalCss.indexOf('}', lidAt));
    const m = lidRule.match(/animation: tk-eye-blink (\d+(?:\.\d+)?)s ease-in-out infinite;/);
    expect(m).not.toBeNull();
    expect(Number(m[1])).toBeGreaterThanOrEqual(6);
    expect(Number(m[1])).toBeLessThanOrEqual(8);
    const kfStart = globalCss.indexOf('@keyframes tk-eye-blink');
    const kf = globalCss.slice(kfStart, globalCss.indexOf('@media (prefers-reduced-motion: reduce)', kfStart));
    // the lid slides (translateY) inside the clipped eye opening; no scale and no size/spacing/position property
    expect(kf).toMatch(/transform: translateY\(0\)/);
    expect(kf).toMatch(/transform: translateY\(\d+(\.\d+)?px\)/);
    expect(kf).not.toMatch(/scale|width|height|inline-size|block-size|margin|padding|font-size|inset|\btop\b|\bleft\b/);
    // short and natural: closed and reopened within the last 7% of the cycle
    const stops = [...kf.matchAll(/(\d+(?:\.\d+)?)%/g)].map((x) => Number(x[1]));
    expect(100 - Math.max(...stops.filter((s) => s < 100 && s > 0 && s < 95))).toBeLessThanOrEqual(7);
    expect(globalCss).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.tk-eye-lid \{ animation: none; \}/);
    // the whole icon / the banner eye carries no animation of its own
    expect(globalCss).not.toMatch(/\.tk-eye \{[^}]*animation/);
    expect(css).not.toMatch(/\.quote-hot-banner-eye \{[^}]*animation/);
  });

  it('is a compact 40px tinted bar in the hot-orange family, styled with logical properties only', () => {
    const banner = rule('.quote-hot-banner');
    expect(banner).toMatch(/min-height: 40px;/);
    expect(banner).toMatch(/background: #fff4ed;/);
    expect(banner).toMatch(/border: 1px solid #fdba74;/);
    expect(banner).toMatch(/color: #9a3412;/);
    // the eye button sits at inline-start (4px from the edge); the text gets the wider inline-end padding
    expect(banner).toMatch(/padding-inline: 4px 12px;/);
    expect(banner).not.toMatch(/\b(left|right)\b|margin-left|margin-right|padding-left|padding-right/);
    expect(css).not.toMatch(/\.quote-hot-banner-(flame|label) \{/);
    // Owner correction 2026-10-09: the real name and the count stay readable - the text wraps, never ellipsized or clamped away
    const text = rule('.quote-hot-banner-text');
    expect(text).not.toMatch(/white-space: nowrap|text-overflow: ellipsis|line-clamp|overflow: hidden/);
    expect(text).toMatch(/white-space: normal;/);
    expect(text).toMatch(/overflow-wrap: anywhere;/);
    // the vertical padding sits on the text, so a single-line alert keeps the unchanged bar height
    expect(banner).toMatch(/padding-block: 0;/);
    expect(text).toMatch(/padding-block: 2px;/);
  });

  it('the underlying eligibility rule (3+ views, not approved/paid) lives in ONE shared helper', () => {
    const sortSource = norm(readFileSync(join(here, '..', 'utils', 'quoteListSort.js'), 'utf-8'));
    expect(sortSource).toMatch(/Number\(quote\?\.view_count \|\| 0\) >= 3 && status !== 'approved' && status !== 'paid'/);
  });
});
