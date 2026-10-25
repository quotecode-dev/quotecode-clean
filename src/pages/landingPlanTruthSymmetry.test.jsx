// Plan-card truth gate for the HE (IL) and EN (INTERNATIONAL) landing pages - IRON-LANDING-001 as amended by the Owner in the
// interactive Claude console on 2026-10-11, with the approved catalog of PROFLOW_PROJECT_CONTEXT.md §249 (Owner decision
// 2026-10-09). It replaces the 2026-10-07 Free / Classic / Modern / Visual gate (OD-03..OD-08 three-plan catalog).
// - exactly two cards, Free-10 and the ONE all-inclusive package, each with the six shared regions (name, description, price,
//   capacity, features, notice);
// - HE: the package at ₪30.00 / חודש and ₪306.00 / שנה (whole shekel ".00", IRON-ILS-001) from packageCatalog.js, and the exact
//   sentence "המחירים כוללים מע״מ" - no VAT rate / breakdown / before-VAT line (OD-05);
// - EN: $18.00 USD / month and $184.00 USD / year (IRON-LANDING-001 amended by the Owner in the console 2026-10-11, replaces $183.60), "Charged in USD" (OD-08), and zero ILS / ₪ / NIS / Hebrew on the page (OD-11);
//   no EUR / GBP figure while no verified rate source is wired;
// - Free = 10 quotes in total OR 7 days from sign-up, whichever ends first, with SMART PACK included in those 7 days (IRON-LANDING-001
//   amended by the Owner in the console 2026-10-20); never a monthly allowance, never called a trial (OD-01);
// - Task 26: the package card has an accessible monthly / annual radio choice (initially monthly) and shows exactly ONE price at a time -
//   the chosen period's; choosing changes only the displayed price (no purchase / activation); ONLY while Annual is chosen, the card states
//   the permanent saving vs 12 monthly payments from the catalog in the Owner's wording - HE "חיסכון של 15% - ₪54.00 בשנה" (IRON-ILS-001
//   whole shekel ".00"; exactly 15%), EN "Save approximately 15% - $32.00 per year" ($32.00 of $216.00 = 14.81...%) - never a temporary
//   promotion;
// - the annual price is a price, never a savings claim; no VAT rate, paid quote quota, unlimited, storage or credits claim; the
//   package names no presentation style (Modern / Visual are illustrations only); no purchase / signup / plan-hint action on a card
//   and no billing-cycle switch; the review notice is visible; no 14-day trial text;
// - every Free-10 call to action ("10 הצעות חינם" / "10 free quotes") goes to the existing signup path and carries the visible
//   status "פעיל עכשיו" / "Active now": IRON-LANDING-001 AMENDED by the Owner in the console 2026-10-25 - once the Free-10 activation is
//   verified in the Production server the pages present it as active in both markets (this release ships only after that read-back);
//   the retired "not active yet" wording never comes back;
// - the same amendment: ONLY the Hebrew page, and only while purchase is open in Israel, may say the package is bought inside the account
//   (plans window, by card, monthly or annual); the English page never claims a purchase; no card carries a purchase action; no other
//   payment method is ever named.
// The real pages must pass; mutated copies (negative controls) must fail.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../shared/supabase', () => ({
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
  rootRecoveryIntent: { isRecovery: false, isError: false },
  rootSignupIntent: { isSignup: false },
  consumeRootRecoveryIntent: () => {},
  consumeRootSignupIntent: () => {},
  isLocalTestMode: false,
}));

import LandingLocal from './LandingLocal';
import LandingGlobal from './LandingGlobal';
import { packagePrice, annualSavingMinor, annualSavingPercent } from '../domain/subscriptions/packageCatalog';
import { FREE_QUOTES_TOTAL, majorUnits } from '../domain/subscriptions/priceCatalog';
import { formatMoney, formatWholeMoney } from '../utils/money';

afterEach(() => cleanup());

const REGIONS = ['name', 'description', 'price', 'capacity', 'features', 'notice'];

function extract(Page, choose = null) {
  const { container } = render(<MemoryRouter><Page /></MemoryRouter>);
  if (choose) fireEvent.click(container.querySelector(`[data-plan-card] [data-period-choice] input[data-period="${choose}"]`));
  const squash = (el) => el.textContent.replace(/\s+/g, ' ').trim();
  const cards = [...container.querySelectorAll('[data-plan-card]')].map((c) => ({
    id: c.getAttribute('data-plan-card'),
    regions: [...c.children].map((ch) => ch.getAttribute('data-region')),
    tagline: c.querySelector('[data-region="description"]')?.textContent.trim() || '',
    prices: [...c.querySelectorAll('.tl-plan-price-row')].map((r) => ({
      period: r.getAttribute('data-billing-period'),
      amount: r.querySelector('.tl-plan-amount')?.textContent.trim() || '',
      per: r.querySelector('.tl-plan-per')?.textContent.trim() || '',
    })),
    capacity: [...c.querySelectorAll('[data-region="capacity"] li')].map(squash),
    features: [...c.querySelectorAll('[data-region="features"] li')].map(squash),
    notice: c.querySelector('[data-region="notice"]')?.textContent.trim() || '',
    text: (() => { const k = c.cloneNode(true); k.querySelectorAll('[data-period-note]').forEach((n) => n.remove()); return squash(k); })(),
    note: [...c.querySelectorAll('[data-period-note]')].map(squash).join(' | '),
    actions: c.querySelectorAll('a, button').length,
    choice: [...c.querySelectorAll('[data-period-choice] input')].map((i) => ({ type: i.type, period: i.value, checked: i.checked, label: i.closest('label')?.textContent.trim() || '' })),
    legend: c.querySelector('[data-period-choice] legend')?.textContent.trim() || '',
    otherInputs: [...c.querySelectorAll('input, select, textarea')].filter((i) => !i.closest('[data-period-choice]') && !i.closest('[data-addon-choice]')).length,
    // IRON-LANDING-001 AMENDED 2026-10-20 (Owner typed): the all-inclusive card may carry ONE unticked SMART PACK add-on box
    addOn: [...c.querySelectorAll('[data-addon-choice] input')].map((i) => ({ type: i.type, checked: i.checked, label: squash(i.closest('label')) })),
  }));
  const free10 = [...container.querySelectorAll('[data-free10-cta]')].map((a) => ({
    href: a.getAttribute('href'),
    label: a.querySelector('.tl-free10-label')?.textContent.trim() || '',
    status: a.querySelector('[data-free10-status]')?.textContent.trim() || '',
  }));
  const text = container.textContent.replace(/\s+/g, ' ');
  const cycles = container.querySelectorAll('.tl-cycle button').length;
  const notice = container.querySelector('#plans .tl-plans-review')?.textContent.trim() || '';
  const priceNote = container.querySelector('#plans [data-price-note]')?.textContent.trim() || '';
  const oldBlock = container.querySelectorAll('[data-task16-proposed-tiers], .tl-tier, [data-proposed-tier-notice]').length;
  cleanup();
  return { cards, free10, text, cycles, notice, priceNote, oldBlock };
}

const BROAD = /\bno limits?\b|\bwithout limits?\b|\blimitless\b|\bunlimited\b|ללא מגבלות|בלי מגבלות|ללא הגבלה כלל|ללא כל הגבלה/i;
const OPEN_FACT = /VAT \d|מע"?״?מ \d|\d+\s*%|לפני מע|\bsav(e|es|ing|ings)\b|חיסכון|חסכו|הנחה|discount|unlimited|ללא הגבלת הצעות|\bGB\b|storage|אחסון|credits?|קרדיט|quotes? per month|הצעות מחיר בחודש|buy now|subscribe now|purchase now|לרכישה עכשיו|לתשלום/i;
const STYLE_ON_PACKAGE = /\b(Classic|Modern|Visual)\b/;
// IRON-LANDING-001 amended 2026-10-25: Free-10 is active - the retired "not active yet" wording is a stale (false) claim now
const STALE_INACTIVE = /עדיין לא הופעל|ההטבה עדיין לא|not active yet|is not active/i;
// the English (international) page never claims a purchase; neither page names a payment method other than the card
const EN_PURCHASE_CLAIM = /\b(buy|bought|purchase[ds]?|pay)\b[^.]{0,60}\b(account|plans window|card|now)\b|credit card|checkout/i;
const OTHER_PAYMENT = /paypal|stripe|\bbit\b|(^|[\s("'״-])ביט($|[\s.,)"'״])|העברה בנקאית|bank transfer|מזומן|\bcash\b|(^|\s)צ['׳]ק($|[\s.,])/i;
// Task 37: the Owner replaced the 2026-10-07 review notice (registration exists; checkout and Free-10 are off; no reviewer note to customers)
// IRON-LANDING-001 amended 2026-10-25 (Owner typed): Free-10 active in both markets; buying inside the account in Israel only
const NOTICE = { he: 'המסלולים פעילים: פותחים חשבון בחינם, ואת המנוי בתשלום רוכשים בתוך החשבון.', en: 'The 10 free quotes are active. The paid package cannot be purchased yet, and there is no online payment. You can already open an account.' };
const PRICE_NOTE = { he: 'המחירים כוללים מע״מ', en: 'Prices are in US dollars. Charged in USD.' };
const PER = { he: { month: '/ חודש', year: '/ שנה' }, en: { month: 'USD / month', year: 'USD / year' } };
const SAVING = {
  he: `חיסכון של ${Number.isInteger(annualSavingPercent('IL')) ? '' : 'כ-'}${Math.round(annualSavingPercent('IL'))}% - ₪${formatWholeMoney(majorUnits(annualSavingMinor('IL')))} בשנה`,
  en: `Save ${Number.isInteger(annualSavingPercent('INTERNATIONAL')) ? '' : 'approximately '}${Math.round(annualSavingPercent('INTERNATIONAL'))}% - $${formatMoney(majorUnits(annualSavingMinor('INTERNATIONAL')))} per year`,
};
const PROMO = /מבצע|לזמן מוגבל|רק עכשיו|רק היום|עד סוף|limited[- ]time|promo|offer ends|today only|for a limited|hurry/i;
const CHOICE = { he: { legend: 'תקופת חיוב', month: 'חודשי', year: 'שנתי' }, en: { legend: 'Billing period', month: 'Monthly', year: 'Annual' } };
// IRON-LANDING-001 AMENDED 2026-10-20: the approved SMART PACK add-on prices (typed by the Owner in the console), written out here on
// purpose - the check compares the page with the law's own figures, not with the catalog the page reads
const ADDON = { he: { name: 'חכם פלוס', month: '₪10.00', year: '₪102.00' }, en: { name: 'SMART PACK', month: '$5.00', year: '$51.00' } };
const FREE10 = { he: { label: '10 הצעות חינם', status: 'פעיל עכשיו' }, en: { label: '10 free quotes', status: 'Active now' } };
const SIGNUP = { he: '/dashboard?signup=true&lang=he', en: '/dashboard?signup=true&lang=en' };
const TRIAL_14 = /14\s*(יום|ימי)|14[\s-]day/i;
const money = (locale, period) => (locale === 'he'
  ? `₪${formatWholeMoney(majorUnits(packagePrice('IL', period).amountMinor))}`
  : `$${formatMoney(majorUnits(packagePrice('INTERNATIONAL', period).amountMinor))}`);

// pure check: returns the list of truth problems for one locale's extracted landing
export function planTruthProblems(page, locale, chosen = 'month') {
  const p = [];
  const ids = page.cards.map((c) => c.id).join();
  if (ids !== 'free,all_inclusive') p.push(`plan cards ${ids} != free,all_inclusive`);
  for (const c of page.cards) {
    if (c.regions.join() !== REGIONS.join()) p.push(`${c.id}: regions ${c.regions.join()} != ${REGIONS.join()}`);
    if (BROAD.test(c.tagline)) p.push(`${c.id}: unqualified broad claim in the tagline "${c.tagline}"`);
    if (OPEN_FACT.test(c.text)) p.push(`${c.id}: undecided / unapproved claim on the card: "${c.text.match(OPEN_FACT)[0]}"`);
    if (c.actions) p.push(`${c.id}: ${c.actions} action(s) on a card (a card never carries a purchase / signup action; buying is inside the account)`);
    if (c.otherInputs) p.push(`${c.id}: ${c.otherInputs} input(s) on a card besides the billing-period choice`);
    if (!c.notice) p.push(`${c.id}: empty notice region`);
    if (locale === 'he' && /\$|USD|€|£/.test(c.text)) p.push(`${c.id}: a non-ILS currency on the HE card`);
    if (locale === 'en' && /₪|\bILS\b|\bNIS\b|[֐-׿]/.test(c.text)) p.push(`${c.id}: ILS / ₪ / NIS / Hebrew on the EN card`);
    if (locale === 'en' && /€|£|\bEUR\b|\bGBP\b/.test(c.text)) p.push(`${c.id}: a converted non-USD price on the EN card (no verified rate source)`);
    if (c.id === 'free') {
      const zero = locale === 'he' ? `₪${formatWholeMoney(0)}` : `$${formatMoney(0)}`;
      if (c.prices.length !== 1 || c.prices[0].amount !== zero) p.push(`free: prices ${JSON.stringify(c.prices)} != one "${zero}"`);
      if (c.prices.some((r) => r.per)) p.push('free: a period next to the price (10 in total, not per month)');
      if (!c.capacity.some((t) => t.startsWith(`${FREE_QUOTES_TOTAL} `) && /בסך הכול|in total/.test(t))) p.push('free: 10 quotes in total not visible');
      if (!c.capacity.some((t) => /או 7 ימים מההרשמה, המוקדם מביניהם|Or 7 days from sign-up, whichever comes first/.test(t))) p.push('free: "or 7 days, whichever first" not visible');
      if (!c.capacity.some((t) => /חכם פלוס|SMART PACK/.test(t))) p.push('free: SMART PACK in the 7 days not visible');
      if (c.capacity.some((t) => /בלי הגבלת זמן|ללא הגבלת זמן|No time limit/i.test(t))) p.push('free: the retired "no time limit" is back');
      if (/ניסיון|trial/i.test(c.text)) p.push('free: trial wording on the Free card');
      if (c.choice.length) p.push('free: a billing-period choice on the Free card');
      if (c.note) p.push('free: a saving note on the Free card');
      if (c.addOn.length) p.push('free: an add-on box on the Free card');
      continue;
    }
    // IRON-LANDING-001 AMENDED 2026-10-20 (Owner typed: "כרטיס הכול כלול מציג תיבת הוספה לא מסומנת של חכם פלוס במחיר 10 ש"ח לחודש או 102 ש"ח
    // לשנה, ובחו"ל 5 דולר או 51 דולר"): exactly one checkbox, unticked, naming the add-on and its approved price for the chosen period
    const wantAdd = ADDON[locale];
    const box = c.addOn[0];
    if (c.addOn.length !== 1 || box.type !== 'checkbox' || box.checked || !box.label.includes(wantAdd.name) || !box.label.includes(wantAdd[chosen])) {
      p.push(`all_inclusive: add-on box ${JSON.stringify(c.addOn)} != one unticked "${wantAdd.name}" checkbox at ${wantAdd[chosen]}`);
    }
    if (c.id !== 'all_inclusive') { p.push(`${c.id}: not an approved plan`); continue; }
    const choice = JSON.stringify(c.choice.map((r) => [r.type, r.period, r.label]));
    const wantChoice = JSON.stringify([['radio', 'month', CHOICE[locale].month], ['radio', 'year', CHOICE[locale].year]]);
    if (choice !== wantChoice) p.push(`all_inclusive: billing-period choice ${choice} != ${wantChoice}`);
    if (c.legend !== CHOICE[locale].legend) p.push(`all_inclusive: choice legend "${c.legend}" != "${CHOICE[locale].legend}"`);
    const checked = c.choice.filter((r) => r.checked).map((r) => r.period);
    if (checked.join() !== chosen) p.push(`all_inclusive: checked period(s) ${checked.join() || 'none'} != ${chosen}`);
    const want = [{ period: chosen, amount: money(locale, chosen), per: PER[locale][chosen] }];
    if (JSON.stringify(c.prices) !== JSON.stringify(want)) p.push(`all_inclusive: shown prices ${JSON.stringify(c.prices)} != exactly the chosen ${JSON.stringify(want)}`);
    if (chosen === 'year' && c.note !== SAVING[locale]) p.push(`all_inclusive: annual saving "${c.note}" != "${SAVING[locale]}"`);
    if (chosen !== 'year' && c.note) p.push(`all_inclusive: a saving "${c.note}" shown although the monthly period is chosen`);
    if (PROMO.test(c.note)) p.push(`all_inclusive: the saving is worded as a percentage / promotion: "${c.note.match(PROMO)[0]}"`);
    if (!c.capacity.some((t) => t.includes(`${FREE_QUOTES_TOTAL}`) && /החינמיות|free quotes/.test(t))) p.push('all_inclusive: "after the 10 free quotes" not visible');
    if (!/הזמינות|available/.test(c.tagline)) p.push('all_inclusive: "every capability" is not qualified as the available ones');
    if (STYLE_ON_PACKAGE.test(c.text)) p.push(`all_inclusive: a presentation style named on the package: "${c.text.match(STYLE_ON_PACKAGE)[0]}"`);
  }
  if (page.cycles !== 0) p.push(`a billing-cycle switch is shown (${page.cycles} buttons); both prices are listed instead`);
  if (page.notice !== NOTICE[locale]) p.push(`review notice "${page.notice}" != the Owner wording`);
  if (page.priceNote !== PRICE_NOTE[locale]) p.push(`price note "${page.priceNote}" != "${PRICE_NOTE[locale]}"`);
  if (page.oldBlock) p.push('the rejected X / X+Y proposal block is rendered (OD-12)');
  if (TRIAL_14.test(page.text)) p.push('14-day trial text on the page (OD-01)');
  if (STALE_INACTIVE.test(page.text)) p.push(`Free-10 presented as not active (stale since 2026-10-25): "${page.text.match(STALE_INACTIVE)[0]}"`);
  if (locale === 'en' && EN_PURCHASE_CLAIM.test(page.text)) p.push(`a purchase claim on the international page: "${page.text.match(EN_PURCHASE_CLAIM)[0]}"`);
  if (OTHER_PAYMENT.test(page.text)) p.push(`a payment method other than the card: "${page.text.match(OTHER_PAYMENT)[0]}"`);
  if (page.free10.length < 4) p.push(`only ${page.free10.length} Free-10 call(s) to action (header, hero, plans, closing expected)`);
  for (const [i, b] of page.free10.entries()) {
    if (b.label !== FREE10[locale].label) p.push(`Free-10 CTA ${i}: label "${b.label}" != "${FREE10[locale].label}"`);
    if (b.status !== FREE10[locale].status) p.push(`Free-10 CTA ${i}: status "${b.status}" != "${FREE10[locale].status}"`);
    if (b.href !== SIGNUP[locale]) p.push(`Free-10 CTA ${i}: href "${b.href}" is not the existing signup path`);
  }
  if (locale === 'en' && /₪|\bILS\b|\bNIS\b/.test(page.text)) p.push('ILS / ₪ / NIS on the International page (OD-11)');
  return p;
}

const HE = extract(LandingLocal);
const EN = extract(LandingGlobal);
const HE_Y = extract(LandingLocal, 'year');
const EN_Y = extract(LandingGlobal, 'year');
const clone = (x) => JSON.parse(JSON.stringify(x));
const mut = (page, fn) => { const m = clone(page); fn(m); return m; };
const card = (m, id) => m.cards.find((c) => c.id === id);
const row = (m, period) => card(m, 'all_inclusive').prices.find((r) => r.period === period);
const pick = (m, period) => { card(m, 'all_inclusive').choice.forEach((r) => { r.checked = r.period === period; }); };

describe('plan-card truth (IRON-LANDING-001 as amended 2026-10-11, PROFLOW_PROJECT_CONTEXT.md §249)', () => {
  it('the package catalog holds exactly the §249 prices', () => {
    expect(['month', 'year'].map((b) => packagePrice('IL', b).amountMinor)).toEqual([3000, 30600]);
    expect(['month', 'year'].map((b) => packagePrice('INTERNATIONAL', b).amountMinor)).toEqual([1800, 18400]); // Owner 2026-10-11: $184.00
    expect(SAVING).toEqual({ he: 'חיסכון של 15% - ₪54.00 בשנה', en: 'Save approximately 15% - $32.00 per year' }); // the Owner's wording
    expect(packagePrice('IL', 'month').taxMode).toBe('included');
    expect(packagePrice('INTERNATIONAL', 'year').currency).toBe('USD');
    expect(FREE_QUOTES_TOTAL).toBe(10);
  });
  it.each([['he', HE], ['en', EN]])('%s: the real landing shows exactly the approved plan facts and nothing undecided (initially monthly)', (loc, page) => {
    expect(planTruthProblems(page, loc)).toEqual([]);
  });
  it.each([['he', HE_Y], ['en', EN_Y]])('%s: choosing the annual period shows ONLY the annual price', (loc, page) => {
    expect(planTruthProblems(page, loc, 'year')).toEqual([]);
  });
  it('HE and EN have the same card and call-to-action structure (ids, regions, price rows, capacity / feature counts, Free-10 CTAs)', () => {
    const shape = (m) => [m.cards.map((c) => [c.id, c.regions.join(), c.prices.map((r) => r.period).join(), c.choice.map((r) => r.period).join(), c.capacity.length, c.features.length]), m.free10.length];
    expect(shape(HE)).toEqual(shape(EN));
  });
  describe('negative controls - each mutation must be detected', () => {
    const cases = [
      ['EN: "with no limits" tagline injected', 'en', EN, (m) => { card(m, 'all_inclusive').tagline = 'One package with no limits.'; }],
      ['HE: "ללא מגבלות" tagline injected', 'he', HE, (m) => { card(m, 'all_inclusive').tagline = 'מסלול אחד ללא מגבלות.'; }],
      ['EN: an ILS price on the package', 'en', EN, (m) => { row(m, 'month').amount = 'ILS 30.00'; card(m, 'all_inclusive').text += ' ILS 30.00'; }],
      ['EN: ILS anywhere on the page', 'en', EN, (m) => { m.text += ' ILS 5.00'; }],
      ['EN: price without ".00"', 'en', EN, (m) => { row(m, 'month').amount = '$18'; }],
      ['EN: annual price changed (annual chosen)', 'en', EN_Y, (m) => { row(m, 'year').amount = '$185.00'; }, 'year'],
      ['EN: a converted EUR price', 'en', EN, (m) => { card(m, 'all_inclusive').text += ' €16.50'; }],
      ['EN: "Charged in USD" removed', 'en', EN, (m) => { m.priceNote = 'Prices are in your currency.'; }],
      ['HE: the monthly price changed to the retired ₪29.00', 'he', HE, (m) => { row(m, 'month').amount = '₪29.00'; }],
      ['HE: the annual price changed (annual chosen)', 'he', HE_Y, (m) => { row(m, 'year').amount = '₪360.00'; }, 'year'],
      ['HE: the annual option removed from the choice', 'he', HE, (m) => { card(m, 'all_inclusive').choice = card(m, 'all_inclusive').choice.slice(0, 1); }],
      ['EN: annual chosen but the monthly price still shown', 'en', EN_Y, (m) => { card(m, 'all_inclusive').prices = [{ period: 'month', amount: '$18.00', per: 'USD / month' }]; }, 'year'],
      ['HE: the year period label changed to a month (annual chosen)', 'he', HE_Y, (m) => { row(m, 'year').per = '/ חודש'; }, 'year'],
      ['EN: both prices shown at once', 'en', EN, (m) => { card(m, 'all_inclusive').prices.push({ period: 'year', amount: '$184.00', per: 'USD / year' }); }],
      ['HE: no period chosen', 'he', HE, (m) => { pick(m, 'none'); }],
      ['HE: the saving shown while monthly is chosen', 'he', HE, (m) => { card(m, 'all_inclusive').note = clone(card(HE_Y, 'all_inclusive').note); }],
      ['HE: the saving missing on annual', 'he', HE_Y, (m) => { card(m, 'all_inclusive').note = ''; }, 'year'],
      ['HE: the saving not rounded to ".00" (IRON-ILS-001)', 'he', HE_Y, (m) => { card(m, 'all_inclusive').note = card(m, 'all_inclusive').note.replace('₪54.00', '₪54'); }, 'year'],
      ['HE: a wrong saving amount', 'he', HE_Y, (m) => { card(m, 'all_inclusive').note = card(m, 'all_inclusive').note.replace('₪54.00', '₪60.00'); }, 'year'],
      ['EN: the retired $32.40 saving', 'en', EN_Y, (m) => { card(m, 'all_inclusive').note = card(m, 'all_inclusive').note.replace('$32.00', '$32.40'); }, 'year'],
      ['EN: the retired $183.60 annual price', 'en', EN_Y, (m) => { row(m, 'year').amount = '$183.60'; }, 'year'],
      ['EN: "approximately" dropped (claims an exact 15%)', 'en', EN_Y, (m) => { card(m, 'all_inclusive').note = card(m, 'all_inclusive').note.replace('approximately ', ''); }, 'year'],
      ['EN: a wrong saving rate', 'en', EN_Y, (m) => { card(m, 'all_inclusive').note = card(m, 'all_inclusive').note.replace('15%', '20%'); }, 'year'],
      ['HE: the saving rate removed', 'he', HE_Y, (m) => { card(m, 'all_inclusive').note = card(m, 'all_inclusive').note.replace('15% - ', ''); }, 'year'],
      ['EN: a percentage badge elsewhere on the card', 'en', EN_Y, (m) => { card(m, 'all_inclusive').text += ' 15% off'; }, 'year'],
      ['HE: the saving worded as a limited-time promotion', 'he', HE_Y, (m) => { card(m, 'all_inclusive').note += ' · מבצע לזמן מוגבל'; }, 'year'],
      ['EN: a second savings claim elsewhere on the card', 'en', EN, (m) => { card(m, 'all_inclusive').text += ' Save big!'; }],
      ['EN: both periods checked', 'en', EN, (m) => { card(m, 'all_inclusive').choice.forEach((r) => { r.checked = true; }); }],
      ['HE: the choice is a checkbox, not a radio', 'he', HE, (m) => { card(m, 'all_inclusive').choice[1].type = 'checkbox'; }],
      ['EN: an extra input (e.g. a quantity / payment field) on a card', 'en', EN, (m) => { card(m, 'all_inclusive').otherInputs = 1; }],
      ['HE: the SMART PACK add-on pre-ticked (IRON-LANDING-001 amended 2026-10-20)', 'he', HE, (m) => { card(m, 'all_inclusive').addOn[0].checked = true; }],
      ['EN: the SMART PACK add-on at another price', 'en', EN, (m) => { card(m, 'all_inclusive').addOn[0].label = card(m, 'all_inclusive').addOn[0].label.replace('$5.00', '$6.00'); }],
      ['HE: the annual add-on price shown while annual is chosen is wrong', 'he', HE_Y, (m) => { card(m, 'all_inclusive').addOn[0].label = card(m, 'all_inclusive').addOn[0].label.replace('₪102.00', '₪120.00'); }, 'year'],
      ['EN: the SMART PACK add-on box missing', 'en', EN, (m) => { card(m, 'all_inclusive').addOn = []; }],
      ['HE: a second add-on box', 'he', HE, (m) => { card(m, 'all_inclusive').addOn.push(clone(card(m, 'all_inclusive').addOn[0])); }],
      ['HE: an add-on box on the Free card', 'he', HE, (m) => { card(m, 'free').addOn = clone(card(m, 'all_inclusive').addOn); }],
      ['HE: a billing-period choice on the Free card', 'he', HE, (m) => { card(m, 'free').choice = clone(card(m, 'all_inclusive').choice); }],
      ['HE: the VAT sentence removed', 'he', HE, (m) => { m.priceNote = ''; }],
      ['HE: a VAT rate / breakdown injected', 'he', HE, (m) => { card(m, 'all_inclusive').text += ' ₪25.42 לפני מע"מ + מע"מ 18%'; }],
      ['EN: an annual savings badge injected', 'en', EN, (m) => { card(m, 'all_inclusive').text += ' Save 15%'; }],
      ['HE: an annual savings claim injected', 'he', HE, (m) => { card(m, 'all_inclusive').text += ' חסכו 15% בתשלום שנתי'; }],
      ['HE: Free shown per month', 'he', HE, (m) => { card(m, 'free').prices[0].per = '/ חודש'; }],
      ['EN: Free 10 removed', 'en', EN, (m) => { card(m, 'free').capacity = card(m, 'free').capacity.slice(1); }],
      ['HE: trial wording on the Free card', 'he', HE, (m) => { card(m, 'free').text += ' 14 יום ניסיון'; }],
      ['EN: 14-day trial text on the page', 'en', EN, (m) => { m.text += ' 14-day full PRO trial'; }],
      ['EN: unlimited quotes injected', 'en', EN, (m) => { card(m, 'all_inclusive').text += ' Unlimited quotes'; }],
      ['HE: Modern named on the package card', 'he', HE, (m) => { card(m, 'all_inclusive').text += ' כולל סגנון Modern'; }],
      ['EN: "every capability" without the available qualifier', 'en', EN, (m) => { card(m, 'all_inclusive').tagline = 'One package with every capability, billed monthly or annually.'; }],
      ['HE: a purchase button added', 'he', HE, (m) => { card(m, 'all_inclusive').actions = 1; }],
      ['EN: the billing-cycle switch restored', 'en', EN, (m) => { m.cycles = 2; }],
      ['HE: the review notice removed', 'he', HE, (m) => { m.notice = ''; }],
      ['HE: the X / X+Y block rendered again', 'he', HE, (m) => { m.oldBlock = 1; }],
      ['EN: a Hebrew word on an English card', 'en', EN, (m) => { card(m, 'free').text += ' חינם'; }],
      ['HE: a third card', 'he', HE, (m) => { m.cards.push({ ...clone(card(m, 'all_inclusive')), id: 'pro' }); }],
      ['EN: a region missing (rows would not line up)', 'en', EN, (m) => { card(m, 'all_inclusive').regions = card(m, 'all_inclusive').regions.filter((r) => r !== 'capacity'); }],
      ['HE: a Free-10 CTA without its status', 'he', HE, (m) => { m.free10[1].status = ''; }],
      ['EN: a Free-10 CTA relabelled as a trial', 'en', EN, (m) => { m.free10[0].label = 'Start your free trial'; }],
      ['HE: a Free-10 CTA pointing to a checkout', 'he', HE, (m) => { m.free10[2].href = '/checkout?plan=all_inclusive'; }],
      ['HE: a Free-10 CTA removed', 'he', HE, (m) => { m.free10 = m.free10.slice(1); }],
      ['HE: Free-10 presented as not active again (stale)', 'he', HE, (m) => { m.text += ' ההטבה עדיין לא הופעלה'; }],
      ['EN: the retired "Not active yet" status back on a CTA', 'en', EN, (m) => { m.free10[0].status = 'Not active yet'; }],
      ['EN: a purchase claim on the international page', 'en', EN, (m) => { m.text += ' Buy the package inside your account by card.'; }],
      ['HE: another payment method named', 'he', HE, (m) => { m.text += ' אפשר לשלם גם ב-PayPal'; }],
      ['EN: checkout claimed', 'en', EN, (m) => { m.text += ' Checkout is open.'; }],
    ];
    it.each(cases)('%s', (_name, loc, page, fn, chosen = 'month') => {
      expect(planTruthProblems(page, loc, chosen)).toEqual([]); // the unmutated page passes for that period
      expect(planTruthProblems(mut(page, fn), loc, chosen).length).toBeGreaterThan(0);
    });
  });
});
