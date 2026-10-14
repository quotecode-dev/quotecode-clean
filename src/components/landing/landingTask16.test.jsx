// Task 16 (correction A) - refined landing gates: shared layout, readable sample quotation, style tabs, plans truth,
// TEST-only proposed tiers, market separation and SSR safety.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import fs, { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

vi.mock('../../shared/supabase', () => ({
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
  rootRecoveryIntent: { isRecovery: false, isError: false },
  rootSignupIntent: { isSignup: false },
  consumeRootRecoveryIntent: () => {},
  consumeRootSignupIntent: () => {},
  isLocalTestMode: false,
}));

import QuoteStyleShowcase from './QuoteStyleShowcase';
import { DEFAULT_SHOWCASE_STYLE, AVAILABLE_SHOWCASE_STYLES } from './showcaseAvailability';
import LandingQuoteDocument from './LandingQuoteDocument';
import { buildLandingQuoteModel, sampleQuoteHref, LANDING_ACCENT } from './landingQuoteModel';
import { QUOTE_STYLE_IDS, STYLE_COPY } from '../../quoteDocument/quoteStyles';
import LandingLocal from '../../pages/LandingLocal';
import LandingGlobal from '../../pages/LandingGlobal';

const read = (p) => readFileSync(join(cwd(), p), 'utf8');
const HEBREW = /[֐-׿]/;
const ssr = (el, path) => renderToString(<StaticRouter location={path}>{el}</StaticRouter>).replace(/<style>[\s\S]*?<\/style>/g, '');
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
const showcaseCopy = { eyebrow: 'e', title: 't', intro: 'i', tablistLabel: 'Quote styles', shared: 's', viewerLabel: 'v', availableBadge: 'Available to every account', previewBadge: 'Preview only · not currently available', previewNote: 'Illustration only: this style is not currently available on any plan; quotes are currently presented in the Classic style.' };

afterEach(() => cleanup());

describe('refined landing - sample quotation model (same fixture and rules as /sample-quote)', () => {
  it('HE: whole-shekel .00 amounts computed from the rows (IRON-ILS-001), DD/MM/YYYY dates', () => {
    const m = buildLandingQuoteModel('he');
    expect(m.rows.map((r) => r.amount)).toEqual(['₪2,400.00', '₪1,530.00', '₪850.00']);
    expect(m.totals.subtotal).toBe('₪4,780.00');
    expect(m.totals.discount).toBe('−₪478.00');
    expect(m.totals.tax).toBe('₪774.00');
    expect(m.totals.total).toBe('₪5,076.00');
    expect(m.raw.total - m.raw.tax).toBe(4302); // the shown lines add up exactly
    expect(m.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
  it('EN: International - full-precision formatter, no tax line, MM/DD/YYYY, no Hebrew', () => {
    const m = buildLandingQuoteModel('en');
    expect(m.totals.total).toBe('$4,302.00');
    expect(m.totals.tax).toBeNull();
    expect(m.date).toBe('10/04/2026');
    expect(JSON.stringify(m)).not.toMatch(HEBREW);
    expect(JSON.stringify(m)).not.toMatch(/₪|ILS|NIS/);
  });
  it('only Modern and Visual carry images; four commercial columns in every style; no headings inside', () => {
    for (const style of QUOTE_STYLE_IDS) {
      const html = renderToString(<LandingQuoteDocument locale="he" style={style} />);
      expect((html.match(/class="tl-figure"[\s\S]*?<img /g) || []).length).toBe(style === 'classic' ? 0 : 3);
      expect((html.match(/<th /g) || []).length).toBe(4);
      expect(html).not.toMatch(/<h[1-6]/);
    }
  });
  it('every px font-size in the landing stylesheet is >= 12 (readable document on every viewport)', () => {
    const css = read('src/components/landing/landing.css');
    const px = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
    expect(px.length).toBeGreaterThan(20);
    for (const s of px) expect(s).toBeGreaterThanOrEqual(12);
  });
});

describe('refined landing - three styles section', () => {
  // Owner 2026-10-14: every account resolves to the full visual tier (resolveTier), so all three styles are labelled available; the
  // section still opens on Classic; no sample-quote link (L08).
  it('accessible tabs with STYLE_COPY titles + availability badge; switching swaps copy and document; no sample link', () => {
    render(<QuoteStyleShowcase locale="en" copy={showcaseCopy} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.firstChild.textContent)).toEqual(QUOTE_STYLE_IDS.map((id) => STYLE_COPY.en[id].title));
    expect(DEFAULT_SHOWCASE_STYLE).toBe('classic');
    expect(AVAILABLE_SHOWCASE_STYLES).toEqual(['classic', 'modern', 'visual']);
    expect(tabs.filter((t) => t.getAttribute('aria-selected') === 'true')[0].id).toBe(`tl-tab-${DEFAULT_SHOWCASE_STYLE}`);
    for (const t of tabs) {
      expect(t.querySelector('.tl-tab-badge').textContent).toBe(showcaseCopy.availableBadge);
    }
    for (const id of QUOTE_STYLE_IDS) {
      fireEvent.click(document.getElementById(`tl-tab-${id}`));
      const panel = screen.getByRole('tabpanel');
      expect(panel.textContent).toContain(STYLE_COPY.en[id].description);
      expect(panel.getAttribute('data-style-availability')).toBe('available');
      expect(panel.querySelector('.tl-style-status').textContent).toBe(showcaseCopy.availableBadge);
      expect(within(panel).queryAllByRole('link')).toHaveLength(0);
      expect(panel.innerHTML).not.toMatch(/sample-quote/);
      expect(panel.querySelector(`[data-landing-doc="${id}"]`)).not.toBeNull();
    }
  });
  it('keyboard: arrows follow the visual order (RTL inverted), Home/End', () => {
    render(<QuoteStyleShowcase locale="he" copy={showcaseCopy} />);
    const tab = (id) => document.getElementById(`tl-tab-${id}`);
    fireEvent.keyDown(tab('classic'), { key: 'ArrowLeft' });
    expect(tab('modern').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab('modern'));
    fireEvent.keyDown(tab('modern'), { key: 'End' });
    expect(tab('visual').getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tab('visual'), { key: 'Home' });
    expect(tab('classic').getAttribute('aria-selected')).toBe('true');
  });
  it('no proposed tier price (X / X+Y) appears outside the gated comparison', () => {
    const html = renderToString(<QuoteStyleShowcase locale="he" copy={showcaseCopy} />);
    expect(text(html)).not.toMatch(/\bX\+Y\b|\bX\b/);
  });
});

// OD-12 (Owner 2026-10-07): the rejected X / X+Y / "price not decided" proposal block is removed from the landing in HE,
// EN and TEST; the style showcase and the sample-quote routes stay.
describe('the rejected proposal block is gone (OD-12)', () => {
  it('neither landing renders the X / X+Y block, in any build mode', () => {
    for (const [Page, path] of [[LandingLocal, '/he'], [LandingGlobal, '/en']]) {
      const html = ssr(<Page />, path);
      expect(html).not.toMatch(/data-task16-proposed-tiers|data-proposed-tier|tl-tier|tl-review-band/);
      expect(text(html)).not.toMatch(/\bX\+Y\b|המחיר טרם נקבע|Price not decided/);
      expect(html).toContain('data-task16-showcase');
    }
  });
});

describe('refined landing pages (server render, as the prerender does)', () => {
  const he = ssr(<LandingLocal />, '/he');
  const en = ssr(<LandingGlobal />, '/en');

  it('one h1, the refined hero with the readable Classic quotation; no public sample-quote link or caption (L08)', () => {
    for (const [html, lang] of [[he, 'he'], [en, 'en']]) {
      expect((html.match(/<h1/g) || []).length).toBe(1);
      expect(html).toMatch(/data-landing-doc="classic"/);
      expect(html).not.toContain(`href="${sampleQuoteHref(lang, 'classic')}"`);
      expect(html).not.toMatch(/sample-quote|tl-hero-caption|<figcaption/);
      for (const id of ['styles', 'workflow', 'plans', 'faq', 'tools']) expect(html).toContain(`id="${id}"`);
    }
    for (const s of ['צפו בהצעה לדוגמה', 'לצפייה בהצעה לדוגמה במלואה', 'נתונים סינתטיים']) expect(text(he)).not.toContain(s);
    for (const s of ['See a sample quote', 'View the full sample quote', 'synthetic data']) expect(text(en)).not.toContain(s);
    // authority ledger L07: the base hero h1 (c65f742) in the light composition
    // Owner HE language edit 2026-10-06: fewer superlatives in the HE h1 (EN unchanged)
    expect(he).toMatch(/<h1 id="tl-hero-title">הצעות מחיר וניהול\u00a0העסק <br\/>בקלות ובמהירות<\/h1>/);
    expect(en).toMatch(/<h1 id="tl-hero-title">Smart Quotes &amp; Business Management <br\/>Easily, Fast &amp; Professionally<\/h1>/);
  });

  // Owner 2026-10-07: the review plan cards carry no signup / plan-hint action (registration and billing are not active).
  it('auth entry points and legal/contact/tools links are kept; the plan cards carry no intended-plan hint', () => {
    for (const [html, lang] of [[he, 'he'], [en, 'en']]) {
      expect(html).toContain(`href="/dashboard?lang=${lang}"`);
      expect(html).toContain(`class="tl-cta tl-header-cta tl-free10-cta" href="/dashboard?signup=true&amp;lang=${lang}"`);
      expect(html).not.toMatch(/intendedPlan|intendedCycle/);
      for (const p of ['terms', 'privacy', 'contact', 'tools']) expect(html).toContain(`href="/${lang}/${p}"`);
    }
  });

  // OD-08 / OD-11 (Owner 2026-10-07): HE = ILS only; EN = USD catalog, zero ILS / ₪ / NIS / Hebrew anywhere on the page.
  it('market separation: HE has ₪ and no $ / USD; EN has $ / USD and no Hebrew / ILS / ₪ / NIS', () => {
    expect(text(he)).toMatch(/₪/);
    expect(text(he)).not.toMatch(/\$|USD/);
    expect(text(en)).toMatch(/\$18\.00/);
    expect(en).not.toMatch(HEBREW);
    expect(text(en)).not.toMatch(/₪|\bILS\b|\bNIS\b/);
    const enCards = en.match(/<article\b[^>]*\bdata-plan-card="[^"]*"[^>]*>[\s\S]*?<\/article>/g);
    expect(enCards).toHaveLength(2);
    for (const c of enCards) expect(text(c)).not.toMatch(/€|£|\bEUR\b|\bGBP\b/);
  });

  // IRON-LANDING-001 as amended 2026-10-11 (§249): IL prices whole shekel ".00" incl. VAT with the exact sentence and no rate /
  // breakdown; EN USD with two decimals and the USD charge disclosure; the retired three-plan amounts are gone from the landing.
  // Task 26: one price at a time - the server render (= the prerendered page) shows the initial monthly choice; the annual price
  // appears only after choosing it (landingPlanTruthSymmetry proves both periods in the browser render).
  it('plan amounts: HE ₪30.00 / month incl. VAT (no rate / breakdown); EN $18.00 / month, charged in USD; the annual price only on choice', () => {
    const t = text(he).replace(/\s+/g, ' ');
    for (const v of ['₪0.00', '₪30.00 / חודש', 'תקופת חיוב', 'חודשי', 'שנתי', 'המחירים כוללים מע״מ']) expect(t).toContain(v);
    expect(t).not.toContain('₪306.00');
    expect(t).not.toContain('₪54.00'); // the annual saving appears only when Annual is chosen
    for (const v of ['₪29.00', '₪49.00', '₪69.00', '₪5.00']) expect(t).not.toContain(v);
    const te = text(en).replace(/\s+/g, ' ');
    for (const v of ['$0.00', '$18.00 USD / month', 'Billing period', 'Monthly', 'Annual', 'Charged in USD']) expect(te).toContain(v);
    expect(te).not.toContain('$183.60');
    expect(te).not.toContain('$32.40');
    expect(te).not.toContain('$184.00'); // the annual price (Owner $184.00) appears only when Annual is chosen
    expect(te).not.toContain('$32.00');
    for (const v of ['$28.00', '$38.00', '$3.00', '$6.00']) expect(te).not.toContain(v);
    expect(text(he)).not.toMatch(/\d ₪|\d\.\d{2}(?!\d) ₪/); // no "49 ₪" / "41.53 ₪" leftovers (raw spacing, as before)
    const heCards = (he.match(/<article\b[^>]*\bdata-plan-card="[^"]*"[^>]*>[\s\S]*?<\/article>/g) || []).map(text).join(' ');
    expect(heCards).not.toMatch(/מע"?״?מ|\d+%/);
  });

  it('the phone menu toggle has an accessible name even when its text is hidden', () => {
    expect(he).toMatch(/class="tl-menu-toggle" aria-label="תפריט"/);
    expect(en).toMatch(/class="tl-menu-toggle" aria-label="Menu"/);
  });

  it('uses the locale-specific static phone showcase with intrinsic dimensions and lazy loading', () => {
    expect(he).toMatch(/<figure class="tl-phone-showcase"><img src="\/assets\/landing\/quotes-list-he\.webp" width="1122" height="1402" loading="lazy" decoding="async" alt="בעל מקצוע מצביע על רשימת הצעות המחיר של TEKANGO בטלפון"\/><\/figure>/);
    expect(en).toMatch(/<figure class="tl-phone-showcase"><img src="\/assets\/landing\/quotes-list-en\.webp" width="1122" height="1402" loading="lazy" decoding="async" alt="A tradesperson pointing at the TEKANGO quotes list on a phone"\/><\/figure>/);
    expect(he).not.toMatch(/quotes-list-en\.webp|quote-electrician-en\.webp|phone-showcase-(he|en)\.webp/);
    expect(en).not.toMatch(/quotes-list-he\.webp|quote-electrician-he\.webp|phone-showcase-(he|en)\.webp/);
  });
  // Task 27 (Owner-approved images, spec §5): the electrician photo sits above the style copy; the interactive style tabs and the live
  // quote document stay (the photo is not a replacement for the renderer).
  it('styles section: locale electrician photo with intrinsic size + alt in the right language; tabs and the live document remain', () => {
    expect(he).toMatch(/<figure class="tl-style-photo"><img src="\/assets\/landing\/quote-electrician-he\.webp" width="1280" height="699" loading="lazy" decoding="async" alt="חשמלאי מחזיק טלפון עם הצעת מחיר של TEKANGO"\/><\/figure>/);
    expect(en).toMatch(/<figure class="tl-style-photo"><img src="\/assets\/landing\/quote-electrician-en\.webp" width="1280" height="698" loading="lazy" decoding="async" alt="An electrician holding a phone with a TEKANGO quote"\/><\/figure>/);
    for (const html of [he, en]) {
      expect(html).toMatch(/role="tablist"/);
      expect((html.match(/role="tab"/g) || []).length).toBe(3);
      expect(html).toMatch(/data-landing-doc="classic"[\s\S]*data-landing-doc="classic"/);
      const styles = html.slice(html.indexOf('id="styles"'), html.indexOf('</section>', html.indexOf('id="styles"')));
      expect(styles.indexOf('tl-style-photo')).toBeGreaterThan(-1);
      expect(styles.indexOf('tl-style-photo')).toBeLessThan(styles.indexOf('tl-viewer'));
    }
    for (const f of ['quotes-list-he.webp', 'quotes-list-en.webp', 'quote-electrician-he.webp', 'quote-electrician-en.webp']) {
      expect(fs.existsSync(join(cwd(), 'public', 'assets', 'landing', f)), f).toBe(true);
      expect(fs.statSync(join(cwd(), 'public', 'assets', 'landing', f)).size).toBeLessThan(160 * 1024);
    }
  });

  it('accent contrast: white on the teal CTA >= 4.5:1', () => {
    const lum = (hex) => {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    expect(1.05 / (lum(LANDING_ACCENT) + 0.05)).toBeGreaterThanOrEqual(4.5);
    expect(read('src/components/landing/landing.css')).toContain(`--tl-accent: ${LANDING_ACCENT}`);
  });

  it('no legacy dark purple hero or pain comparison remains', () => {
    for (const src of [read('src/pages/LandingLocal.jsx'), read('src/pages/LandingGlobal.jsx')]) {
      expect(src).not.toMatch(/NEON_GRADIENT|NEON\.gradient|pain-box|hero-glow/);
    }
  });
});

// cloud-fix4 A14 - landing truth (L09), free business tools (L03), footer (L17), light closing / illustration sidebar
// (Codex P1 dark scope) and the base 1050px content column (Codex 1180/1440 geometry).
describe('cloud-fix4 A14 - landing truth, base restores, light regions, base column', () => {
  const he = ssr(<LandingLocal />, '/he');
  const en = ssr(<LandingGlobal />, '/en');
  const css = read('src/components/landing/landing.css');
  const rule = (sel) => { const m = css.match(new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`)); return m ? m[2] : ''; };

  it('styles: the server render opens on Classic; all three tabs are labelled available (Owner 2026-10-14)', () => {
    for (const [html, ok, prev] of [[he, 'זמין בכל החשבונות', 'דוגמה בלבד · לא זמין כרגע'], [en, 'Available to every account', 'Preview only · not currently available']]) {
      expect(html).toMatch(/id="tl-tab-classic"[^>]*aria-selected="true"/);
      expect(html).toMatch(/data-style-availability="available"/);
      expect(html).toMatch(/data-landing-doc="classic"[\s\S]*data-landing-doc="classic"/); // hero + styles viewer
      expect((text(html).match(new RegExp(ok, 'g')) || []).length).toBeGreaterThanOrEqual(4); // three tab badges + status line
      expect(text(html)).not.toContain(prev);
    }
  });

  it('styles are not tied to a plan, and the copy states all three are available to every account (HE + EN)', () => {
    for (const s of ['הכלולים במסלול', 'להמחשה בלבד, וכרגע אינם זמינים']) expect(text(he)).not.toContain(s);
    for (const s of ['included in your plan', 'illustrations only and are not currently available']) expect(text(en)).not.toContain(s);
    expect(text(he)).toContain('שלושה סגנונות להצעת מחיר, זמינים בכל החשבונות');
    expect(text(he)).toContain('שלושת הסגנונות זמינים בכל החשבונות');
    expect(text(en)).toContain('Three quote styles, available to every account');
    expect(text(en)).toContain('All three styles are available to every account');
  });

  it('L03: the base free business tools section is back (base strings, /he|en/tools, no signup)', () => {
    expect(he).toMatch(/<h2 id="tl-tools-title">כלים עסקיים חינמיים<\/h2>/);
    expect(text(he)).toContain('מחשבוני מטבעות, יחידות, מתכות וקריפטו בחינם, פתוחים לכולם, ללא הרשמה.'); // Owner HE language edit 2026-10-06
    expect(text(he)).not.toContain('כתוסף חופשי');
    expect(he).toMatch(/<a class="tl-ghost" href="\/he\/tools">למעבר לכלים העסקיים/);
    expect(en).toMatch(/<h2 id="tl-tools-title">Free Business Tools<\/h2>/);
    expect(text(en)).toContain('Free business tools: currency, unit, metals & crypto calculators - available to everyone, no signup required, as a free companion to  TEKANGO .');
    expect(en).toMatch(/<a class="tl-ghost" href="\/en\/tools">Explore the Free Business Tools/);
    // section order: FAQ > free tools > closing (base order)
    for (const html of [he, en]) expect(html.indexOf('id="faq"')).toBeLessThan(html.indexOf('id="tools"'));
    for (const html of [he, en]) expect(html.indexOf('id="tools"')).toBeLessThan(html.indexOf('tl-closing'));
  });

  it('L17: footer brand is the base <BrandName /> markup; the unsourced nav label is gone, links kept', () => {
    expect(he.replace(/<!-- -->/g, '')).toMatch(/© \d{4} <bdi dir="ltr" style="font-weight:700;color:#a78bfa;unicode-bidi:isolate">TEKANGO<\/bdi> ישראל\. כל הזכויות שמורות\./);
    expect(en.replace(/<!-- -->/g, '')).toMatch(/© \d{4} <bdi dir="ltr" style="font-weight:700;color:#a78bfa;unicode-bidi:isolate">TEKANGO<\/bdi> Global\. All rights reserved\./);
    expect(he).not.toContain('קישורים משפטיים וכלים');
    expect(en).not.toContain('Legal and tools links');
    expect(he).toMatch(/<nav class="tl-footer-links">/);
  });

  it('dark scope: the closing band is light (no dark token), the closing CTA is the teal CTA; no dark illustration sidebar', () => {
    expect(rule('.tl-closing')).toMatch(/background: var\(--tl-accent-soft\)/);
    expect(rule('.tl-closing')).not.toMatch(/--tl-dark|#17272d|#101b20/);
    expect(css).not.toMatch(/tl-mg|#19272e/); // ledger L15: the management preview (and its dark side navigation) is gone
    for (const html of [he, en]) expect(html).not.toMatch(/tl-mg|class="tl-benefit/);
    expect(css).not.toMatch(/tl-cta--on-dark/);
    for (const html of [he, en]) expect(html).not.toMatch(/tl-cta--on-dark/);
  });

  it('cloud-fix4b U12/F5a: the footer is light (no #101b20 / dark token); links keep 44px targets and the launcher clearance', () => {
    expect(rule('.tl-footer')).toMatch(/background: var\(--tl-alt\)/);
    expect(rule('.tl-footer')).not.toMatch(/#101b20|--tl-dark|#17272d|#000/);
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/#101b20/); // rules only (the comment names the old value)
    expect(rule('.tl-footer-links a, .tl-footer-links button')).toMatch(/min-height: 44px/);
    expect(rule('.tl-footer-links a, .tl-footer-links button')).toMatch(/color: var\(--tl-ink\) !important/);
    expect(css).toMatch(/\.tl-footer \{ padding-bottom: 148px; \}/);
  });

  it('cloud-fix4b dark scope: selected tab / billing-cycle controls are the teal accent, never near-black --tl-dark', () => {
    expect(rule(".tl-tab[aria-selected='true']")).toMatch(/background: var\(--tl-accent\)/);
    expect(rule(".tl-cycle button[aria-pressed='true']")).toMatch(/background: var\(--tl-accent\)/);
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/background: var\(--tl-dark\)/);
  });

  it('cloud-fix4b truth: the styles copy no longer promises four columns on phones; it states the four fields and the long-amount layout', () => {
    expect(he).not.toContain('בארבע עמודות, גם בטלפון');
    expect(en).not.toContain('keeps its four columns, on phones too');
    expect(he).toContain('בכל הסגנונות נשמרים ארבעת השדות של טבלת הפריטים: תיאור פריט, כמות, מחיר יחידה וסה&quot;כ.');
    expect(he).toContain('התיאור עובר לשורה מלאה ושלושת הערכים המספריים מופיעים מתחת לכותרות שלהם');
    expect(en).toContain('In every style the item table keeps its four fields: Description, Qty, Unit Price and Total.');
    expect(en).toContain('the description moves to its own full row and the three numeric values appear under their own headers');
    for (const html of [he, en]) expect(html).not.toMatch(/ארבע עמודות|four-column|four columns/); // A17 K2: no visual four-column promise anywhere on the landing
  });

  it('geometry: the base 1050px content column (no 1180px column)', () => {
    expect(rule('.tl-nav')).toMatch(/max-width: 1050px;[^;]*;[^;]*; padding: 0 20px/);
    expect(rule('.tl-inner')).toMatch(/max-width: 1050px/);
    expect(rule('.tl-hero')).toMatch(/max-width: 1082px;[^;]*; padding: 64px 16px 58px/);
    expect(rule('.tl-section')).toMatch(/padding: 74px 16px/);
    expect(css).not.toMatch(/max-width: 1180px;/);
  });

  it('authority ledger L07: base hero subtitle, base "how it works" (3 steps) and base closing; reference strings gone', () => {
    expect(text(he)).toContain('מערכת להפקת הצעות מחיר ולניהול העסק, המותאמת לעסקים בישראל: חישוב מע"מ 18% בהצעות, מחירים בשקלים, חתימה דיגיטלית של הלקוח וניהול לקוחות.'); // Owner HE language edit 2026-10-06 (same facts)
    expect(text(he)).not.toContain('פלטפורמת SaaS');
    expect(text(en)).toContain('An advanced global SaaS platform tailored for modern businesses (featuring automatic quote totals, customer e-signatures, and streamlined client management).');
    expect(he).toMatch(/<h2 id="tl-flow-title">איך זה עובד\?<\/h2><p>מהצעה ראשונה ועד חתימת הלקוח, בשלושה צעדים\.<\/p>/);
    for (const s of ['צרו הצעת מחיר צעד אחר צעד', 'שלחו ללקוח קישור אישי', 'בלי לצרף קבצים למייל', 'חותם דיגיטלית מהטלפון']) expect(text(he)).toContain(s);
    for (const s of ['בונים הצעה מודרכת', 'מייל כבד']) expect(text(he)).not.toContain(s);
    expect(en).toMatch(/<h2 id="tl-flow-title">How It Works<\/h2><p>From a blank page to a signed quote in three clear steps\.<\/p>/);
    for (const html of [he, en]) expect((html.match(/class="tl-flow-step"/g) || []).length).toBe(3);
    for (const s of ['יצירה', 'שליחה', 'אישור וחתימה']) expect(he).toContain(`<h3>${s}</h3>`);
    for (const s of ['Create', 'Send', 'Approve &amp; Sign']) expect(en).toContain(`<h3>${s}</h3>`);
    expect(he).toMatch(/<h2 id="tl-closing-title">מוכנים ליצור את ההצעה הראשונה שלכם\?<\/h2><p>הצעת מחיר ברורה, צעד אחר צעד\.<\/p>/);
    expect(en).toMatch(/<h2 id="tl-closing-title">Ready to create your first quote\?<\/h2><p>A professional quote, one clear step at a time\.<\/p>/);
    for (const s of ['הצעות מחיר שנראות כמו העסק שלכם', 'ארבעה צעדים', 'מהיצירה ועד אישור הלקוח', 'הצעת המחיר הבאה מתחילה בתהליך ברור']) expect(text(he)).not.toContain(s);
    for (const s of ['Quotes that look like your business', 'Four steps', 'From creation to customer approval', 'Your next quote starts with a clear process']) expect(text(en)).not.toContain(s);
  });

  it('authority ledger L15: no management preview or reference benefits; the base five capability cards in base order', () => {
    const titles = (html) => [...html.matchAll(/<article class="tl-capability">[\s\S]*?<h3>([^<]*)<\/h3>/g)].map((m) => m[1]);
    expect(titles(he)).toEqual(['הפקת הצעות מחיר בקלות', 'חתימה דיגיטלית ואישור לקוח', 'ניהול הכנסות והוצאות', 'הצעות מחיר לפי מידות ומפרט', 'עוזר חכם שמלווה אתכם בעבודה']);
    expect(titles(en)).toEqual(['Quotes Made Simple', 'Digital Signatures &amp; Approvals', 'Income &amp; Expense Tracking', 'Professional Quotes with Measurements &amp; Specs', 'AI Assistant Inside Your Workflow']);
    expect(text(he)).toContain('צרו הצעות מחיר מסודרות, עם חישוב מע"מ אוטומטי, הנחות ומוצרים מהקטלוג שלכם.');
    expect(text(en)).toContain('Create professional, beautiful price quotes including automatic totals, discounts, and items from your catalog.');
    for (const s of ['היסטוריה שקל לסרוק', 'ממשק מייצג', 'לקוחות ופריטים לשימוש חוזר']) expect(text(he)).not.toContain(s);
    for (const s of ['Scannable quote history', 'Representative interface', 'Reusable customers and items']) expect(text(en)).not.toContain(s);
    expect(rule('.tl-capabilities')).toMatch(/repeat\(auto-fit, minmax\(260px, 1fr\)\); gap: 20px/);
  });

  it('authority ledger L07b: base FAQ heading + subtitle, no added eyebrows, no business heading, no added FAQ item', () => {
    expect(he).toMatch(/<h2 id="tl-faq-title">שאלות נפוצות<\/h2><p>תשובות לשאלות נפוצות על המערכת\.<\/p>/);
    expect(en).toMatch(/<h2 id="tl-faq-title">Frequently Asked Questions<\/h2><p>Everything you need to know about the platform\.<\/p>/);
    for (const s of ['לפני שבוחרים', 'שאלות שימושיות', 'הצעה מקצועית. תהליך אחד ברור.', 'יותר מעיצוב המסמך', 'כל ההצעות, הלקוחות והפריטים במקום אחד', 'איך הלקוח מקבל ומאשר את ההצעה?']) expect(text(he)).not.toContain(s);
    for (const s of ['Before you choose', 'Useful answers', 'A professional quote. One clear flow.', 'More than document styling', 'Quotes, customers and items in one place', 'How does a customer receive and approve a quote?']) expect(text(en)).not.toContain(s);
    for (const html of [he, en]) {
      expect(html).not.toMatch(/tl-business-title/);
      const hero = html.slice(html.indexOf('class="tl-hero"'), html.indexOf('</section>', html.indexOf('class="tl-hero"')));
      expect(hero).not.toMatch(/tl-eyebrow/);
      const faq = html.slice(html.indexOf('id="faq"'), html.indexOf('</section>', html.indexOf('id="faq"')));
      expect(faq).not.toMatch(/tl-eyebrow/);
      // 8 base items + the Owner-approved cancellation / refunds item (Task 39 final scope, published on LIVE 2026-10-14)
      expect((faq.match(/<details/g) || []).length).toBe(9);
    }
  });
});
