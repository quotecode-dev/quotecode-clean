// Owner 2026-10-20 (phone review on 5186): (1) on one-column screens the style buttons sit right above the sample quote; (2) what SMART
// PACK gives is shown next to every SMART PACK control - under the landing plan-card box (the one-line summary) and, in the promo strip,
// as a second check list in the add-on purple beside "מוסיפים רק אם רוצים" (attachments line: "צירוף קבצים ותמונות להצעה"); (3) the
// price is centred and animated (drops in large and shrinks, breathes, shimmers; still for reduced motion).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import LandingLocal from './pages/LandingLocal';
import LandingGlobal from './pages/LandingGlobal';
import { SMART_PACK } from './domain/subscriptions/addOnCatalog';

const css = (f) => fs.readFileSync(path.join(__dirname, 'components', 'landing', f), 'utf8').replace(/\r\n/g, '\n');
const html = (Page) => renderToStaticMarkup(<MemoryRouter><Page /></MemoryRouter>);
const text = (s) => s.replace(/<[^>]+>/g, '');

describe('phone: the style buttons right above the sample quote', () => {
  it('one column (<= 959px) only: the copy column lends its children to the grid and only the tabs move next to the viewer', () => {
    expect(css('landing.css')).toMatch(/@media \(max-width: 959px\) \{\n {2}\.tl-showcase \{ gap: 0; \}\n {2}\.tl-style-copy \{ display: contents; \}\n {2}\.tl-style-copy > \.tl-tabs \{ order: 1; margin: 18px 0 12px; \}\n {2}\.tl-showcase > \.tl-viewer \{ order: 2; \}\n\}/);
  });
});

describe('SMART PACK explained next to its controls (HE / EN)', () => {
  const lists = {
    he: ['צ׳אט חכם שקורא את הנתונים של המשתמש (הצעות, לקוחות, קטלוג, משימות)', 'צ׳אט קולי (שאלה בקול ותשובה מוקראת)', 'הצעה חכמה עם AI, כולל הכתבה בקול', 'צירוף קבצים ותמונות להצעה'],
    en: ["A smart chat that reads the user's own data (quotes, clients, catalog, tasks)", 'Voice chat (a spoken question and a read-aloud answer)', 'An AI smart quote, including voice dictation', 'Files and images attached to a quote'],
  };
  for (const [name, Page, lang] of [['HE', LandingLocal, 'he'], ['EN', LandingGlobal, 'en']]) {
    it(`${name}: the plan-card box has its summary (outside its label); the promo strip has the second check list`, () => {
      const h = html(Page);
      const plan = h.match(/<p class="tl-plan-addon-summary" data-addon-summary="[^"]*">([^<]*)<\/p>/);
      expect(text(plan?.[1] || '')).toBe(SMART_PACK.summary[lang]);
      expect(h).toMatch(/<\/label><p class="tl-plan-addon-summary"/);
      const ul = h.match(/<ul class="sp-points sp-includes" data-offer-includes="[^"]*">([\s\S]*?)<\/ul>/);
      const items = [...(ul?.[1] || '').matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]).replace(/&#x27;|&#39;/g, "'"));
      expect(items).toEqual(lists[lang]);
    });
  }
  it('the strip: purple check list, price + lists from the top, button centred, price centred and animated (still for reduced motion)', () => {
    const c = css('smartPack.css');
    expect(c).toMatch(/\.sp-includes li \{ align-items: flex-start; color: var\(--sp-violet\); font-weight: 700; \}/);
    expect(c).toMatch(/\.sp-offer \{ align-items: flex-start; \}\n\.sp-offer > \.sp-cta \{ align-self: center; \}/);
    expect(c).toMatch(/\.sp-price \{ align-items: center; text-align: center; \}/);
    expect(c).toMatch(/@keyframes sp-price-drop \{ 0% \{ transform: translateY\(-46px\) scale\(2\.1\); opacity: 0; \}/);
    expect(c).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.sp-price strong, \.sp-section\.is-visible \.sp-price strong \{ animation: none !important;/);
  });
});
