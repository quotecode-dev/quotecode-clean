// PREVIEW / NOT CONNECTED / NOT ACTIVATED - content guards for the subscriptions landing preview (2026-10-07 night task).
// Run: npx vitest run --config subscriptions-prep/vitest.config.mjs subscriptions-prep/landing-preview
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PREVIEW_MARKER, buildSubscriptionsPreview, monthlyIlsPrice, catalogCapacity, minimumBlocksFor,
} from './subscriptionsLandingPreview.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const he = buildSubscriptionsPreview('he');
const en = buildSubscriptionsPreview('en');

// Fields that carry identifiers / mapping metadata, not customer-facing text.
const TECHNICAL_KEYS = new Set([
  'marker', 'key', 'id', 'status', 'lang', 'replaces', 'changeRequest', 'separateBlockChangeRequest',
  'priceStatus', 'planId', 'cardIds', 'featureStatuses',
]);
// Latin-script words explicitly allowed in Hebrew display text. Deliberately empty: Hebrew plan names are used.
const HE_ALLOWED_LATIN = [];

function walk(node, visit, path = '$') {
  if (Array.isArray(node)) { node.forEach((v, i) => walk(v, visit, `${path}[${i}]`)); return; }
  if (node && typeof node === 'object') {
    visit(node, path);
    for (const [k, v] of Object.entries(node)) walk(v, visit, `${path}.${k}`);
  }
}

function displayStrings(node, out = [], parentKey = '') {
  if (typeof node === 'string') { if (!TECHNICAL_KEYS.has(parentKey)) out.push(node); return out; }
  if (Array.isArray(node)) { node.forEach((v) => displayStrings(v, out, parentKey)); return out; }
  if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) displayStrings(v, out, k);
  return out;
}

const stripPlaceholders = (s) => s.replace(/\{[a-zA-Z]+\}/g, '');
const heText = displayStrings(he).map(stripPlaceholders);
const enText = displayStrings(en).map(stripPlaceholders);
const allText = [...heText, ...enText];
const card = (p, id) => p.planCards.cards.find((c) => c.id === id);

describe('preview marker', () => {
  it('is the exact agreed literal', () => {
    expect(PREVIEW_MARKER).toBe('PREVIEW — NOT CONNECTED — NOT ACTIVATED');
  });

  it('is carried by every object of both languages', () => {
    for (const p of [he, en]) {
      let objects = 0;
      walk(p, (obj, path) => {
        objects += 1;
        expect(obj.marker, path).toBe(PREVIEW_MARKER);
      });
      expect(objects).toBeGreaterThan(50);
    }
  });

  it('is frozen, so a consumer cannot strip the marker', () => {
    expect(Object.isFrozen(he)).toBe(true);
    expect(Object.isFrozen(he.planCards.cards[1])).toBe(true);
  });

  it('rejects any language other than he / en', () => {
    expect(() => buildSubscriptionsPreview('fr')).toThrow();
    expect(() => buildSubscriptionsPreview(undefined)).toThrow();
  });
});

describe('language separation', () => {
  it('Hebrew text has no Latin-script words beyond the explicit allowlist', () => {
    const offenders = heText
      .map((s) => HE_ALLOWED_LATIN.reduce((acc, w) => acc.split(w).join(''), s))
      .filter((s) => /[A-Za-z]/.test(s));
    expect(offenders).toEqual([]);
  });

  it('every Hebrew sentence-like string is actually Hebrew', () => {
    const lettered = heText.filter((s) => /\p{L}/u.test(s.replace(/₪/g, '')));
    expect(lettered.length).toBeGreaterThan(40);
    for (const s of lettered) expect(s, s).toMatch(/[֐-׿]/);
  });

  it('English text has no Hebrew characters', () => {
    expect(enText.filter((s) => /[֐-׿]/.test(s))).toEqual([]);
  });
});

describe('no trial wording and no live-commerce claim in the new content', () => {
  it('never mentions a 14-day period, a trial or trying', () => {
    const bad = allText.filter((s) => /14\s*[-־]?\s*(יום|ימים|ימי|days?)/i.test(s) || /ניסיון|נסו|trial/i.test(s));
    expect(bad).toEqual([]);
  });

  it('makes no checkout / buy-now / live-payment claim', () => {
    const forbidden = [
      /checkout/i, /\bbuy\b/i, /\b(subscribe|purchase|pay|upgrade) now\b/i, /secure payment/i, /payment (is )?(live|active)/i,
      /קנו/, /רכשו/, /לרכישה עכשיו/, /שדרגו עכשיו/, /תשלום מאובטח/, /הצטרפו למנוי/,
    ];
    const bad = allText.filter((s) => forbidden.some((re) => re.test(s)));
    expect(bad).toEqual([]);
  });

  it('no card is purchasable and every paid card says it is not yet available for purchase', () => {
    for (const p of [he, en]) {
      for (const c of p.planCards.cards) expect(c.purchasable, c.id).toBe(false);
    }
    for (const id of ['classic', 'modern', 'visual']) {
      expect(card(he, id).tagline).toContain('עדיין לא זמין לרכישה');
      expect(card(en, id).tagline).toContain('not yet available for purchase');
    }
    expect(he.plans.trialNote).toContain('אינם זמינים לרכישה');
    expect(en.plans.trialNote).toContain('not available for purchase yet');
  });
});

describe('HE / ILS money (IRON-ILS-001, Owner prices)', () => {
  const OWNER_PRICES = { classic: '₪29.00', modern: '₪49.00', visual: '₪69.00' };
  const amount = (s) => Number(s.replace(/[₪,]/g, ''));

  it('paid cards show exactly the Owner-approved monthly prices', () => {
    for (const [id, price] of Object.entries(OWNER_PRICES)) {
      expect(card(he, id).price).toBe(price);
      expect(card(he, id).per).toBe('/ חודש');
    }
  });

  // Codex review 2026-10-07: tax treatment of the approved prices is NOT decided -> no VAT rate, breakdown or "incl. VAT" claim.
  // (Replaces the earlier VAT-breakdown test one-for-one; the test count is unchanged.)
  it('no VAT rate / breakdown / "includes VAT" claim anywhere; tax treatment is an open decision in both languages', () => {
    for (const id of Object.keys(OWNER_PRICES)) expect(card(he, id).vatNote).toBeNull();
    for (const c of [...he.planCards.cards, ...en.planCards.cards]) expect(c.vatNote ?? null).toBeNull();
    for (const s of allText) {
      expect(s).not.toMatch(/18\s?%|מע"מ\s*18|כולל מע"מ|לפני מע"מ|incl(\.|uding)? VAT|VAT included|before VAT/i);
    }
    expect(he.openDecisions.map((d) => d.key)).toContain('taxTreatment');
    expect(en.openDecisions.map((d) => d.key)).toContain('taxTreatment');
    // the already-decided post-10 access is stated as a fact, not as an open decision
    expect(heText.join(' ')).toContain('הצעות שכבר יצאו ללקוחות נשארות זמינות לכם');
    expect(enText.join(' ')).toContain('the quotes you have already issued stay available to you');
    expect([...he.openDecisions, ...en.openDecisions].map((d) => d.text).join(' ')).not.toMatch(/tenth|העשירית/);
  });

  it('every shekel amount anywhere in the Hebrew text is whole with ".00"', () => {
    const amounts = heText.flatMap((s) => s.match(/₪[\d,]+(\.\d+)?/g) ?? []);
    expect(amounts.length).toBeGreaterThan(10);
    for (const a of amounts) expect(a).toMatch(/^₪\d{1,3}(,\d{3})*\.00$/);
  });

  it('an expansion block costs ₪5.00 per month and is optional', () => {
    const f = card(he, 'visual').features.find((x) => x.key === 'catalogExpansion');
    expect(f.text).toContain('₪5.00 לחודש');
    expect(f.text).toContain('בחירה מפורשת');
    expect(he.expansionsLine.text).toContain('₪5.00');
    expect(he.expansionsLine.text).toContain('אין חיוב אוטומטי');
  });

  it('the Owner examples hold: Visual with 50 products = ₪69.00, with 1,000 products = 9 expansions = ₪114.00', () => {
    const ex = (n) => he.expansionsLine.examples.find((e) => e.products === n);
    expect(ex(50)).toMatchObject({ blocks: 0, price: '₪69.00' });
    expect(ex(1000)).toMatchObject({ blocks: 9, price: '₪114.00' });
    expect(ex(1000).text).toContain('9 הרחבות');
    expect(he.faqReplacement.optionalExpansionItem.a).toContain('₪69.00');
    expect(he.faqReplacement.optionalExpansionItem.a).toContain('9 הרחבות');
    expect(he.faqReplacement.optionalExpansionItem.a).toContain('₪114.00');
  });

  it('every example price is base 69 + 5 x blocks and the blocks are the minimum that fits the catalog', () => {
    for (const e of he.expansionsLine.examples) {
      expect(amount(e.price)).toBe(69 + 5 * e.blocks);
      expect(e.capacity).toBe(100 + 100 * e.blocks);
      expect(e.capacity).toBeGreaterThanOrEqual(e.products);
      if (e.blocks > 0) expect(e.capacity - 100).toBeLessThan(e.products);
    }
    expect(he.expansionsLine.examples.map((e) => e.blocks)).toEqual(expect.arrayContaining([0, 1, 9]));
  });

  it('pricing helpers: boundaries and refusals', () => {
    expect(minimumBlocksFor(100)).toBe(0);
    expect(minimumBlocksFor(101)).toBe(1);
    expect(minimumBlocksFor(200)).toBe(1);
    expect(minimumBlocksFor(201)).toBe(2);
    expect(catalogCapacity(0)).toBe(100);
    expect(monthlyIlsPrice('classic', 2)).toBe(39);
    expect(() => monthlyIlsPrice('free10', 0)).toThrow();
    expect(() => monthlyIlsPrice('pro', 0)).toThrow();
    expect(() => monthlyIlsPrice('visual', -1)).toThrow();
    expect(() => monthlyIlsPrice('visual', 1.5)).toThrow();
  });
});

describe('EN: international prices are not decided', () => {
  it('shows no currency symbol or currency code anywhere', () => {
    const bad = enText.filter((s) => /[$€£₪]|\b(USD|EUR|GBP|ILS|NIS)\b|shekel/i.test(s));
    expect(bad).toEqual([]);
  });

  it('paid cards carry an explicit not-decided price and no VAT line', () => {
    for (const id of ['classic', 'modern', 'visual']) {
      const c = card(en, id);
      expect(c.price).toBe('Not decided yet');
      expect(c.priceStatus).toBe('open');
      expect(c.vatNote).toBeNull();
      expect(c.price).not.toMatch(/\d/);
    }
    for (const e of en.expansionsLine.examples) expect(e.price).toBe('Not decided yet');
  });
});

describe('HE / EN parity', () => {
  it('same plan ids in the same order', () => {
    expect(en.planCards.cards.map((c) => c.id)).toEqual(he.planCards.cards.map((c) => c.id));
    expect(he.planCards.cards.map((c) => c.id)).toEqual(['free10', 'classic', 'modern', 'visual']);
  });

  it('same feature keys and statuses on every card', () => {
    for (const c of he.planCards.cards) {
      const e = card(en, c.id);
      expect(e.features.map((f) => [f.key, f.status])).toEqual(c.features.map((f) => [f.key, f.status]));
    }
  });

  it('same open-decision keys', () => {
    expect(en.openDecisions.map((d) => d.key)).toEqual(he.openDecisions.map((d) => d.key));
    expect(he.openDecisions.every((d) => d.status === 'open')).toBe(true);
  });

  it('same capability rows and cell statuses; only the ILS price cells differ (approved in HE, open in EN)', () => {
    expect(en.capabilityTable.rows.map((r) => r.key)).toEqual(he.capabilityTable.rows.map((r) => r.key));
    for (const r of he.capabilityTable.rows) {
      const er = en.capabilityTable.rows.find((x) => x.key === r.key);
      for (const [plan, cell] of Object.entries(r.cells)) {
        if (plan === 'marker') continue;
        const priceCell = ['monthlyPrice', 'catalogExpansion'].includes(r.key) && plan !== 'free10';
        expect(er.cells[plan].status, `${r.key}.${plan}`).toBe(priceCell ? 'open' : cell.status);
      }
    }
  });

  it('same expansion examples (products / blocks / capacity)', () => {
    const shape = (p) => p.expansionsLine.examples.map((e) => [e.products, e.blocks, e.capacity]);
    expect(shape(en)).toEqual(shape(he));
  });
});

describe('unapproved capacity, AI and image entitlements are never presented', () => {
  it('no storage sizes, AI credit counts or usage-package names', () => {
    const bad = allText.filter((s) => /\d+(\.\d+)?\s*(GB|MB|TB)\b/i.test(s)
      || /credit|קרדיט/i.test(s)
      || /\b(small|medium|large)\b/i.test(s)
      || /חבילה (קטנה|בינונית|גדולה)|חבילת (קטן|בינוני|גדול)/.test(s));
    expect(bad).toEqual([]);
  });

  it('storage and AI are always open, never approved', () => {
    for (const p of [he, en]) {
      for (const key of ['storage', 'aiUsage']) {
        const row = p.capabilityTable.rows.find((r) => r.key === key);
        for (const [plan, cell] of Object.entries(row.cells)) if (plan !== 'marker') expect(cell.status).toBe('open');
      }
    }
  });

  it('images are never marked approved, and every mention of images is a not-decided or a never-unlocks statement', () => {
    for (const p of [he, en]) {
      const row = p.capabilityTable.rows.find((r) => r.key === 'images');
      for (const [plan, cell] of Object.entries(row.cells)) if (plan !== 'marker') expect(cell.status).toBe('open');
      for (const c of p.planCards.cards) {
        for (const f of c.features) if (f.key === 'images') expect(f.status).toBe('open');
      }
    }
    const rowLabels = new Set([he, en].map((p) => p.capabilityTable.rows.find((r) => r.key === 'images').label));
    const mentions = allText.filter((s) => /תמונ|image/i.test(s) && !rowLabels.has(s));
    expect(mentions.length).toBeGreaterThan(0);
    for (const s of mentions) expect(s, s).toMatch(/טרם נקבע|אינה פותחת|not decided|never unlocks/i);
  });

  it('approved features do not smuggle in an open topic', () => {
    for (const p of [he, en]) {
      for (const c of p.planCards.cards) {
        for (const f of c.features.filter((x) => x.status === 'approved')) {
          expect(f.text, f.text).not.toMatch(/טרם נקבע|not decided|תמונ|image|סגנון|style|אחסון|storage/i);
          expect(f.ok).toBe(true);
        }
        for (const f of c.features.filter((x) => x.status === 'open')) {
          expect(f.ok).toBeNull();
          expect(f.text).toMatch(/טרם נקבע|not decided yet/);
        }
      }
    }
  });
});

describe('preview stays unconnected and the live landing is untouched', () => {
  function filesUnder(dir) {
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? filesUnder(full) : [full];
    });
  }

  it('nothing under src/ imports the preview module', () => {
    const importers = filesUnder(join(REPO_ROOT, 'src'))
      .filter((f) => /\.(jsx?|mjs|tsx?)$/.test(f))
      .filter((f) => readFileSync(f, 'utf8').includes('subscriptionsLandingPreview'));
    expect(importers).toEqual([]);
  });

  // Owner unified execution instruction 2026-10-07 (4.b.4) supersedes the night-task rule "no 10-free claim on the live landing
  // before activation": the landing now states Free-10 instead of the trial, but ONLY together with the truthful "not active
  // yet" marker, and never the preview's unqualified hero line (which would imply an active entitlement).
  it('the landing states Free-10 only as not yet active while the trial mechanism is still the active behavior', () => {
    const local = readFileSync(join(REPO_ROOT, 'src/pages/LandingLocal.jsx'), 'utf8');
    const global = readFileSync(join(REPO_ROOT, 'src/pages/LandingGlobal.jsx'), 'utf8');
    expect(local).not.toContain(`'${he.heroTrialLine.text}'`);
    expect(global).not.toContain(`'${en.heroTrialLine.text}'`);
    expect(local).toContain('10 הצעות חינם בסך הכול · טרם הופעל');
    expect(local).toContain('המדיניות החדשה טרם הופעלה');
    expect(global).toContain('10 free quotes in total · not active yet');
    expect(global).toContain('The new policy is not active yet');
  });
});
