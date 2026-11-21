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
    // Owner 2026-10-19 (L-25 / L-26): the same rotation now cycles the next steps (overdue tasks, the hot quotes, expiring quotes)
    expect(quotesTabSource).toMatch(/const stepLead = steps\.length \? steps\[hotIndex % steps\.length\] : null;/);
    expect(quotesTabSource).toMatch(/const hotLead = stepLead\?\.kind === 'hot' \? stepLead : null;/);
    expect(quotesTabSource).toMatch(/setInterval\(\(\) => setHotIndex\(\(i\) => i \+ 1\), 4000\)/);
    expect(quotesTabSource).toMatch(/onClick=\{\(\) => openHotQuote\(hotLead\.quote\.id\)\}/);
    expect(quotesTabSource).toContain('openTrackingFor(quoteId);');
    expect(quotesTabSource).toMatch(/quote-modern-detail-\$\{quoteId\}/);
  });

  // Owner updates 2026-10-09 (all devices): no flame and no "hot quote" title; ONE illustrated eye at the inline-start edge, then
  // "{clientName} viewed this quote {viewCount} times and still hasn't signed." with the REAL client name (no generic "the client").
  it('keeps ONE eye icon only (no Flame, no title), first at inline-start, then the real client name and the exact HE/EN sentence', () => {
    // Owner console 2026-11-19 (L-25 / L-26, typed: "מאשר שינוי ב-L-25 וב-L-26: בטלפון ובטאבלט לאורך, שם או משימה ארוכים בפס ההודעה החמה מסתיימים
    // בשלוש נקודות, ונגיעה בשורה פותחת בועה עם כל השורה, ואת שאר התוכנית"): the sentence is defined once (hotLine) - the computer line and the
    // phone tap bubble show the same words; the block is that definition + the banner itself
    const sentence = quotesTabSource.slice(quotesTabSource.indexOf('const hotLine = hotLead ? ('), quotesTabSource.indexOf('const stepLine = '));
    expect(quotesTabSource).toContain('<span className="quote-hot-banner-text">{hotLine}</span>');
    const block = sentence + quotesTabSource.slice(quotesTabSource.indexOf('className="quote-hot-banner"'), quotesTabSource.indexOf('data-testid="quote-list-header"'));
    expect(sentence.length).toBeGreaterThan(100);
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
    // Owner console 2026-11-20/21 (the simple-quotes sketch; typed L-03 / L-04 / L-19 / L-25 / L-26 only as needed): the sketch's one line - "<name> • צפיות: 3; טרם נחתמה" / "<name> • Views: 3; not signed yet"
    expect(block.indexOf('quote-hot-banner-name')).toBeLessThan(block.indexOf("' • צפיות: '"));
    expect(block).toContain("' • צפיות: '");
    expect(block).toContain("'; טרם נחתמה'");
    expect(block).toContain("' • Views: '");
    expect(block).toContain("'; not signed yet'");
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

  // Owner console 2026-11-20/21 (the simple-quotes sketch, typed L-19 / L-25 / L-26 only as needed): the banner is the sketch's one thin line
  // (36px, the light orange family, logical properties only); a long line ends with "…" and the whole line shows in the bubble (law 50 as
  // amended 19/11 - the EllipsisText bubble of the phone line, the title of the computer line)
  it('is the sketch\'s thin 36px line in the hot-orange family, styled with logical properties only; its words are never lost', () => {
    const list = readFileSync(join(here, '..', 'components', 'quotesList.css'), 'utf8');
    const banner = list.match(/\.dash-main-content \.quote-workspace \.quote-hot-banner \{([^}]*)\}/)[1];
    expect(banner).toMatch(/min-height: 36px;/);
    expect(banner).toMatch(/background: #fff7ed;/);
    expect(banner).toMatch(/border: 1px solid #fed7aa;/);
    expect(banner).toMatch(/padding-inline: 6px 6px;/);
    expect(banner).not.toMatch(/\b(left|right)\b|margin-left|margin-right|padding-left|padding-right/);
    expect(css).not.toMatch(/\.quote-hot-banner-(flame|label) \{/);
    expect(list).toContain('.dash-main-content .quote-workspace .quote-hot-banner .quote-hot-banner-text { flex: 1; min-width: 0; font-size: 13px; color: #7c2d12; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;');
    // the phone line keeps the tap bubble with the whole line (EllipsisText tapLine)
    expect(quotesTabSource).toMatch(/className="quote-hot-banner-name qhb-short-name" text=\{quotePartyLabel\(hotLead\.quote\)\.text\}\s*bubble=\{hotLine\}/);
  });

  it('the underlying eligibility rule (3+ views, not approved/paid) lives in ONE shared helper', () => {
    const sortSource = norm(readFileSync(join(here, '..', 'utils', 'quoteListSort.js'), 'utf-8'));
    expect(sortSource).toMatch(/Number\(quote\?\.view_count \|\| 0\) >= 3 && status !== 'approved' && status !== 'paid'/);
  });
});
