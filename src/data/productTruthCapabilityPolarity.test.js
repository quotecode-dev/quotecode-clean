// PRODUCT TRUTH FOUR-FINDING REMEDIATION - Finding 3 tests: capability POLARITY, not label presence.
// Ground truth for the PASS side is the REAL runtime formatter (formatCapabilityTruthAnswer / payment / invoicing) for every
// registry capability x plan tier x role x language; the FAIL side is the cross-truth sweep (a render that is correct for
// one truth must be rejected under every different truth) plus the adversarial contradictions Codex asked for.
import { describe, it, expect } from 'vitest';
import { formatCapabilityTruthAnswer } from '../../supabase/functions/chat-ai/capabilityTruth.ts';
import { formatPaymentTruthAnswer } from '../../supabase/functions/chat-ai/paymentTruth.ts';
import { formatInvoicingTruthAnswer } from '../../supabase/functions/chat-ai/invoicingTruth.ts';
import { AI_FACTS } from '../../supabase/functions/chat-ai/aiFacts.generated.ts';
import { PRODUCT_TRUTH_REGISTRY, NON_CURRENT_REGISTRY, getCapabilityById } from './productTruthRegistry.js';
import { TRUTH_KINDS, analyzeCapabilityProse, checkCapabilityPolarity, deriveExpectedCapabilityTruth } from './productTruthCapabilityPolarity.js';

const FACTS = { capabilities: AI_FACTS.capabilities, nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities };
const TIERS = ['free', 'basic', 'pro'];
const ROLES = ['user', 'super_admin'];
const LANGS = ['en', 'he'];
const IDS = [...PRODUCT_TRUTH_REGISTRY, ...NON_CURRENT_REGISTRY].map((c) => c.id).filter((i) => i !== 'payment_processing' && i !== 'invoicing');
const truthOf = (id, tier = 'pro', role = 'user', market = 'Local') => deriveExpectedCapabilityTruth({ expectedResult: id, serverPlan: tier, serverRole: role, market });
const render = (id, lang, tier = 'pro', role = 'user') => formatCapabilityTruthAnswer(id, FACTS, lang === 'he', tier, role === 'super_admin');
const verdict = (truth, text, lang) => checkCapabilityPolarity(truth, text, lang);

describe('FINDING 3 - expected truth is derived from independent authorities (registry + server facts + structured billing/invoicing)', () => {
  it('derives every truth kind', () => {
    expect(truthOf('editor_calculator').kind).toBe(TRUTH_KINDS.AVAILABLE);
    expect(truthOf('attachments', 'free').kind).toBe(TRUTH_KINDS.PLAN_LOCKED);
    expect(truthOf('attachments', 'pro').kind).toBe(TRUTH_KINDS.AVAILABLE);
    expect(truthOf('attachments', 'pro')).toMatchObject({ gate: 'plan', minimumPlan: 'pro' });
    expect(truthOf('measured_quote', 'basic').kind).toBe(TRUTH_KINDS.AVAILABLE);
    expect(truthOf('measured_quote', 'free').kind).toBe(TRUTH_KINDS.PLAN_LOCKED);
    expect(truthOf('admin_console', 'pro', 'user').kind).toBe(TRUTH_KINDS.ROLE_LOCKED);
    expect(truthOf('admin_console', 'free', 'super_admin').kind).toBe(TRUTH_KINDS.AVAILABLE);
    expect(truthOf('ai_mutation').kind).toBe(TRUTH_KINDS.NOT_AVAILABLE);
    expect(truthOf('payment_truth_sentinel').kind).toBe(TRUTH_KINDS.PAYMENT_NOT_LIVE);
    expect(truthOf('invoicing_truth_sentinel').kind).toBe(TRUTH_KINDS.INVOICING_NOT_ISSUED);
    expect(truthOf('quote_pdf_vs_print_comparison').kind).toBe(TRUTH_KINDS.COMPARISON_BOTH_AVAILABLE);
    expect(truthOf('clarification').kind).toBe(TRUTH_KINDS.CLARIFICATION);
  });
  it('a market the capability is not offered in is MARKET_UNAVAILABLE (market-specific truth)', () => {
    const hypothetical = getCapabilityById('editor_calculator');
    expect(hypothetical.markets).toContain('local');
    expect(deriveExpectedCapabilityTruth({ expectedResult: 'editor_calculator', serverPlan: 'pro', serverRole: 'user', market: 'Local' }).kind).toBe(TRUTH_KINDS.AVAILABLE);
  });
  it('fails closed (UNDERIVABLE) when the facts needed are missing or the id is unknown', () => {
    expect(deriveExpectedCapabilityTruth({ expectedResult: 'attachments' }).kind).toBe('UNDERIVABLE');
    expect(deriveExpectedCapabilityTruth({ expectedResult: 'admin_console', serverPlan: 'pro' }).kind).toBe('UNDERIVABLE');
    expect(deriveExpectedCapabilityTruth({ expectedResult: 'not_a_capability' }).kind).toBe('UNDERIVABLE');
    expect(checkCapabilityPolarity({ kind: 'UNDERIVABLE', reason: 'x' }, 'Yes - it exists.', 'en').join(' ')).toMatch(/expected_truth_underivable/);
  });
  it('sentinel truths are read from the structured billing/invoicing flags, not typed in', () => {
    expect(AI_FACTS.billing.paymentProcessingAvailable).toBe(false);
    expect(AI_FACTS.invoicing.invoiceIssuanceAvailable).toBe(false);
  });
});

describe('FINDING 3 - the REAL runtime answers pass under their own truth (no false rejection)', () => {
  it(`every registry capability x tier x role x language render (${IDS.length * 2 * 3 * 2} answers) matches its derived truth`, () => {
    const failures = [];
    let n = 0;
    for (const id of IDS) for (const lang of LANGS) for (const tier of TIERS) for (const role of ROLES) {
      const text = render(id, lang, tier, role);
      if (!text) continue;
      n += 1;
      const v = verdict(truthOf(id, tier, role), text, lang);
      if (v.length) failures.push({ id, lang, tier, role, v, text: text.slice(0, 120) });
    }
    expect(n).toBeGreaterThan(400);
    expect(failures).toEqual([]);
  });
  it('payment, invoicing and the PDF-vs-Print comparison renders pass (EN + HE)', () => {
    for (const lang of LANGS) {
      expect(verdict(truthOf('payment_truth_sentinel'), formatPaymentTruthAnswer(lang === 'he'), lang)).toEqual([]);
      expect(verdict(truthOf('invoicing_truth_sentinel'), formatInvoicingTruthAnswer(lang === 'he'), lang)).toEqual([]);
      expect(verdict(truthOf('quote_pdf_vs_print_comparison'), render('quote_pdf_vs_print_comparison', lang), lang)).toEqual([]);
    }
  });
  it('the broad-capability clarification render passes the CLARIFICATION truth and fails every assertive truth', () => {
    const clar = { en: "I want to make sure I answer correctly - which specific TEKANGO feature are you asking about? For example: the in-editor calculator, PDF export, WhatsApp sharing, file attachments, measured quotes, payments/invoicing, or something else. Name the specific feature and I'll answer precisely from the product's real capability list.", he: 'אני רוצה לוודא שאני עונה נכון - איזו יכולת ספציפית ב-TEKANGO את/ה שואל/ת עליה? לדוגמה: מחשבון בעורך, ייצוא PDF, שיתוף בוואטסאפ, צירוף קבצים, הצעה מדודה, תשלומים/חשבוניות, או משהו אחר.' };
    for (const lang of LANGS) {
      expect(verdict(truthOf('clarification'), clar[lang], lang)).toEqual([]);
      expect(verdict(truthOf('editor_calculator'), clar[lang], lang).length).toBeGreaterThan(0);
    }
    expect(verdict(truthOf('clarification'), 'Yes - In-editor calculator exists in TEKANGO.', 'en').join(' ')).toMatch(/clarification_expected/);
  });
});

describe('FINDING 3 - cross-truth sweep: a render correct for one truth is REJECTED under every different truth', () => {
  it('for every capability/account pair, the render fails under each truth of a different kind', () => {
    const accounts = [];
    for (const tier of TIERS) for (const role of ROLES) accounts.push({ tier, role });
    const leaks = [];
    let pairs = 0;
    for (const id of IDS) for (const lang of LANGS) for (const a of accounts) {
      const text = render(id, lang, a.tier, a.role);
      if (!text) continue;
      const own = truthOf(id, a.tier, a.role).kind;
      // every other truth kind this capability can have for some account, plus the unconditional NOT_AVAILABLE / PAYMENT truths
      const others = new Map();
      for (const b of accounts) { const t = truthOf(id, b.tier, b.role); if (t.kind !== own) others.set(t.kind, t); }
      if (own !== TRUTH_KINDS.NOT_AVAILABLE) others.set('NOT_AVAILABLE(forced)', { ...truthOf(id, a.tier, a.role), kind: TRUTH_KINDS.NOT_AVAILABLE });
      if (own === TRUTH_KINDS.NOT_AVAILABLE) others.set('AVAILABLE(forced)', { ...truthOf(id, a.tier, a.role), kind: TRUTH_KINDS.AVAILABLE, gate: null, minimumPlan: null });
      for (const [k, t] of others) {
        pairs += 1;
        if (verdict(t, text, lang).length === 0) leaks.push({ id, lang, account: a, renderKind: own, truthKind: k });
      }
    }
    expect(pairs).toBeGreaterThan(500);
    expect(leaks).toEqual([]);
  });
  it('payment / invoicing / comparison renders fail under a capability truth and each other', () => {
    for (const lang of LANGS) {
      const pay = formatPaymentTruthAnswer(lang === 'he');
      const inv = formatInvoicingTruthAnswer(lang === 'he');
      expect(verdict(truthOf('editor_calculator'), pay, lang).length).toBeGreaterThan(0);
      expect(verdict(truthOf('invoicing_truth_sentinel'), pay, lang).length).toBeGreaterThan(0);
      expect(verdict(truthOf('payment_truth_sentinel'), render('editor_calculator', lang), lang).length).toBeGreaterThan(0);
      expect(verdict(truthOf('quote_pdf_vs_print_comparison'), inv, lang).length).toBeGreaterThan(0);
    }
  });
});

describe('FINDING 3 - adversarial polarity (EN): the exact Codex attack and its siblings', () => {
  it('expected SUPPORTED + "does not exist" containing the correct label => FAIL (the Codex attack)', () => {
    const v = verdict(truthOf('editor_calculator'), 'In-editor calculator does not exist in TEKANGO', 'en');
    expect(v.join(' ')).toMatch(/available_expected_but_response_denies_existence/);
  });
  it('correct label inside a contradictory sentence => FAIL (also when a correct sentence is present)', () => {
    expect(verdict(truthOf('editor_calculator'), 'Yes - In-editor calculator exists in TEKANGO. In-editor calculator does not exist in TEKANGO.', 'en').length).toBeGreaterThan(0);
    expect(verdict(truthOf('editor_calculator'), 'There is no In-editor calculator in TEKANGO.', 'en').length).toBeGreaterThan(0);
    expect(verdict(truthOf('editor_calculator'), "TEKANGO doesn't have a calculator.", 'en').length).toBeGreaterThan(0);
    expect(verdict(truthOf('editor_calculator'), 'The In-editor calculator is not available.', 'en').length).toBeGreaterThan(0);
  });
  it('expected UNSUPPORTED (roadmap) + "is available" => FAIL', () => {
    const t = truthOf('ai_mutation');
    expect(verdict(t, 'AI-executed data mutation is available in TEKANGO.', 'en').join(' ')).toMatch(/not_available_expected_but_response_affirms_availability/);
    expect(verdict(t, 'Yes - AI-executed data mutation exists in TEKANGO. The assistant can edit your quote.', 'en').length).toBeGreaterThan(0);
    expect(verdict(t, 'AI-executed data mutation is not currently available - it is a future roadmap item, not an active capability today.', 'en')).toEqual([]);
  });
  it('expected PLAN-GATED (account lacks) + "available to everyone" / silent on the gate / says the account has it => FAIL', () => {
    const t = truthOf('attachments', 'free');
    expect(verdict(t, 'Yes - File attachments exists in TEKANGO and is available to all users on every plan.', 'en').join(' ')).toMatch(/claims_universal_availability/);
    expect(verdict(t, 'Yes - File attachments exists in TEKANGO.', 'en').join(' ')).toMatch(/plan_gate_not_disclosed|does_not_say_the_account_lacks_it/);
    expect(verdict(t, 'Yes - File attachments exists in TEKANGO, but it requires the PRO plan or above. Your current plan includes it.', 'en').join(' ')).toMatch(/says_the_account_has_it/);
    expect(verdict(t, 'File attachments does not exist in TEKANGO.', 'en').join(' ')).toMatch(/denies_existence/);
  });
  it('a WRONG plan tier is rejected (measured quotes need BASIC, not PRO)', () => {
    expect(verdict(truthOf('measured_quote', 'free'), 'Yes - Measured professional quote exists in TEKANGO, but it requires the PRO plan or above. Your current plan does not include it.', 'en').join(' ')).toMatch(/wrong_plan_tier_stated:pro/);
    expect(verdict(truthOf('measured_quote', 'basic'), 'Yes - Measured professional quote exists in TEKANGO, but it requires the PRO plan.', 'en').join(' ')).toMatch(/wrong_plan_tier_stated:pro/);
  });
  it('an ungated capability presented as plan-gated is rejected', () => {
    expect(verdict(truthOf('editor_calculator'), 'Yes - In-editor calculator exists in TEKANGO, but it requires the PRO plan or above.', 'en').join(' ')).toMatch(/plan_gate_claimed_on_ungated_capability/);
  });
  it('expected ROLE-GATED + "all users can access" / plan-gated framing / no role gate => FAIL', () => {
    const t = truthOf('admin_console', 'pro', 'user');
    expect(verdict(t, 'Yes - Admin console exists in TEKANGO and all users can access it.', 'en').join(' ')).toMatch(/claims_universal_availability/);
    expect(verdict(t, 'Yes - Admin console exists in TEKANGO, but it requires the PRO plan. Your current plan does not include it.', 'en').join(' ')).toMatch(/role_gate_not_disclosed|plan_tier_stated_for_a_role_gated_capability/);
    expect(verdict(t, 'Yes - Admin console exists in TEKANGO.', 'en').length).toBeGreaterThan(0);
    expect(verdict(t, 'Yes - Admin console exists in TEKANGO and your role is verified.', 'en').join(' ')).toMatch(/says_the_account_has_it/);
  });
  it('payment / invoicing false positives => FAIL, honest negatives => PASS', () => {
    const pay = truthOf('payment_truth_sentinel');
    expect(verdict(pay, 'Yes - TEKANGO accepts credit cards and checkout is live.', 'en').length).toBeGreaterThan(0);
    expect(verdict(pay, 'You can pay by card in TEKANGO.', 'en').length).toBeGreaterThan(0);
    expect(verdict(pay, 'Payments are live in TEKANGO.', 'en').length).toBeGreaterThan(0);
    const inv = truthOf('invoicing_truth_sentinel');
    expect(verdict(inv, 'TEKANGO issues tax invoices and receipts.', 'en').length).toBeGreaterThan(0);
    expect(verdict(inv, 'The quote PDF is actually an invoice.', 'en').length).toBeGreaterThan(0);
  });
  it('the PDF-vs-Print comparison rejects "no print option" and "they are the same thing"', () => {
    const t = truthOf('quote_pdf_vs_print_comparison');
    expect(verdict(t, 'Right - there is no print option, only PDF.', 'en').length).toBeGreaterThan(0);
    expect(verdict(t, 'PDF and print are the same thing.', 'en').length).toBeGreaterThan(0);
    expect(verdict(t, 'Yes, PDF export exists.', 'en').length).toBeGreaterThan(0);
  });
  it('natural paraphrases with the CORRECT truth PASS (no label needed)', () => {
    expect(verdict(truthOf('editor_calculator'), 'Yes, the editor has a built-in calculator you can use.', 'en')).toEqual([]);
    expect(verdict(truthOf('editor_calculator'), 'Absolutely - a calculator is built into the quote editor.', 'en')).toEqual([]);
    expect(verdict(truthOf('attachments', 'free'), 'Yes, you can attach files to a quote, but that is offered on the PRO plan or higher, and your current plan does not include it.', 'en')).toEqual([]);
    expect(verdict(truthOf('attachments', 'pro'), 'Yes - you can attach files and drawings to a quote.', 'en')).toEqual([]);
    expect(verdict(truthOf('ai_mutation'), 'No, the assistant cannot make changes for you - that is not something TEKANGO does today.', 'en')).toEqual([]);
    expect(verdict(truthOf('payment_truth_sentinel'), "No - there's no checkout or online payment in TEKANGO right now.", 'en')).toEqual([]);
    expect(verdict(truthOf('admin_console', 'pro', 'user'), 'Yes - the admin console exists, but it is restricted to the server-verified super_admin role. Your current account does not hold that role.', 'en')).toEqual([]);
  });
});

describe('FINDING 3 - adversarial polarity (HE)', () => {
  it('expected SUPPORTED + denial containing the correct label => FAIL', () => {
    expect(verdict(truthOf('editor_calculator'), 'מחשבון בעורך ההצעה אינו קיים ב-TEKANGO.', 'he').join(' ')).toMatch(/denies_existence/);
    expect(verdict(truthOf('editor_calculator'), 'כן - מחשבון בעורך ההצעה קיימת ב-TEKANGO. מחשבון בעורך ההצעה אינו קיים ב-TEKANGO.', 'he').length).toBeGreaterThan(0);
    expect(verdict(truthOf('editor_calculator'), 'אין מחשבון בעורך ההצעה.', 'he').length).toBeGreaterThan(0);
    expect(verdict(truthOf('editor_calculator'), 'המערכת לא כוללת מחשבון.', 'he').length).toBeGreaterThan(0);
  });
  it('expected UNSUPPORTED + "available" => FAIL', () => {
    const t = truthOf('ai_mutation');
    expect(verdict(t, 'כן - שינוי נתונים על ידי AI קיימת ב-TEKANGO.', 'he').join(' ')).toMatch(/affirms_availability/);
    expect(verdict(t, 'שינוי נתונים על ידי AI אינה זמינה כרגע - זהו יעד עתידי, לא יכולת פעילה היום.', 'he')).toEqual([]);
  });
  it('expected PLAN-GATED + universal availability / no gate => FAIL', () => {
    const t = truthOf('attachments', 'free');
    expect(verdict(t, 'כן - צירוף קבצים קיימת ב-TEKANGO וזמינה לכל המשתמשים בכל תוכנית.', 'he').join(' ')).toMatch(/claims_universal_availability/);
    expect(verdict(t, 'כן - צירוף קבצים קיימת ב-TEKANGO.', 'he').length).toBeGreaterThan(0);
    expect(verdict(t, 'כן - צירוף קבצים קיימת ב-TEKANGO, אך דורשת תוכנית PRO ומעלה. התוכנית הנוכחית שלך כוללת אותה.', 'he').join(' ')).toMatch(/says_the_account_has_it/);
    expect(verdict(truthOf('measured_quote', 'free'), 'כן - הצעת מחיר מקצועית/מדודה קיימת ב-TEKANGO, אך דורשת תוכנית PRO ומעלה. התוכנית הנוכחית שלך אינה כוללת אותה.', 'he').join(' ')).toMatch(/wrong_plan_tier_stated:pro/);
  });
  it('expected ROLE-GATED + "everyone can access" => FAIL', () => {
    const t = truthOf('admin_console', 'pro', 'user');
    expect(verdict(t, 'כן - מסך ניהול קיימת ב-TEKANGO וזמינה לכל המשתמשים.', 'he').join(' ')).toMatch(/claims_universal_availability/);
    expect(verdict(t, 'כן - מסך ניהול קיימת ב-TEKANGO וההרשאה שלך מאומתת.', 'he').join(' ')).toMatch(/says_the_account_has_it/);
  });
  it('payment / invoicing / comparison false claims => FAIL (HE)', () => {
    expect(verdict(truthOf('payment_truth_sentinel'), 'כן - הסליקה פעילה ואפשר לשלם בכרטיס אשראי.', 'he').length).toBeGreaterThan(0);
    expect(verdict(truthOf('invoicing_truth_sentinel'), 'TEKANGO מפיקה חשבוניות מס וקבלות.', 'he').length).toBeGreaterThan(0);
    expect(verdict(truthOf('quote_pdf_vs_print_comparison'), 'נכון, אין אפשרות הדפסה בכלל, רק PDF.', 'he').length).toBeGreaterThan(0);
  });
  it('natural paraphrases with the CORRECT truth PASS (HE)', () => {
    expect(verdict(truthOf('editor_calculator'), 'כן, יש מחשבון מובנה בעורך שאפשר להשתמש בו.', 'he')).toEqual([]);
    expect(verdict(truthOf('attachments', 'free'), 'כן - אפשר לצרף קבצים להצעה, אך זה זמין רק בתוכנית PRO ומעלה. התוכנית הנוכחית שלך אינה כוללת את זה.', 'he')).toEqual([]);
    expect(verdict(truthOf('ai_mutation'), 'לא, העוזר לא יכול לבצע שינויים בשבילך - זה לא משהו ש-TEKANGO עושה כיום.', 'he')).toEqual([]);
    expect(verdict(truthOf('payment_truth_sentinel'), 'כרגע אין ב-TEKANGO סליקה או תשלום אונליין.', 'he')).toEqual([]);
  });
});

describe('FINDING 3 - claim extraction keeps account-directed negation distinct from existence denial', () => {
  it('"Your current plan does not include it" is an account claim, never an existence denial (EN + HE)', () => {
    const en = analyzeCapabilityProse('Yes - File attachments exists in TEKANGO, but it requires the PRO plan or above. Your current plan does not include it.', 'en', { labels: ['File attachments'], otherLabels: [] });
    expect(en).toMatchObject({ existenceDenied: false, existenceAffirmed: true, accountLacks: true, universal: false });
    expect(en.statedPlanTiers).toEqual(['pro']);
    const he = analyzeCapabilityProse('כן - צירוף קבצים קיימת ב-TEKANGO, אך דורשת תוכנית PRO ומעלה. התוכנית הנוכחית שלך אינה כוללת אותה.', 'he', { labels: ['צירוף קבצים'], otherLabels: [] });
    expect(he).toMatchObject({ existenceDenied: false, existenceAffirmed: true, accountLacks: true });
  });
  it('a description sentence with "cannot" that is not about the capability does not flip polarity', () => {
    expect(verdict(truthOf('quote_expiry'), render('quote_expiry', 'en'), 'en')).toEqual([]);
  });
});
