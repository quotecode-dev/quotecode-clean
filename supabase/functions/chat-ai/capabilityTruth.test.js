// AI PRODUCT TRUTH ANSWER MATRIX (TEKANGO_AI_ARCHITECTURE.md v2.5 §52, implementation task step 16).
import { describe, it, expect } from 'vitest';
import { classifyCapabilityIntent, formatCapabilityTruthAnswer, capabilityTruthApplies, buildCapabilityTruthBlock } from './capabilityTruth.ts';
import { AI_FACTS } from './aiFacts.generated.ts';

const FACTS = { capabilities: AI_FACTS.capabilities, nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities };

// Direct-question HE/EN pair per registered classifier id (task step 16: "direct question" cell).
const DIRECT_QUESTIONS = {
  ai_mutation: ['Can the AI edit my quote for me?', 'האם ה-ai עורך את ההצעה שלי?'],
  autonomous_email: ['Does the assistant send email automatically?', 'הצ׳אט שולח מייל אוטומטית ללקוחות?'],
  payment_processing: ['Can TEKANGO take payment?', 'האם TEKANGO גובה תשלום?'],
  invoicing: ['Can TEKANGO issue invoices?', 'האם TEKANGO מפיקה חשבונית?'],
  editor_calculator: ['Do you have a calculator?', 'יש לכם מחשבון?'],
  editor_currency_converter: ['Can I convert currency in the editor calculator?', 'אפשר להמיר מטבע בעורך בעזרת המחשבון?'],
  public_currency_converter: ['Is there a public currency converter?', 'יש ממיר מטבעות ציבורי?'],
  public_unit_converter: ['Is there a unit converter?', 'יש ממיר יחידות?'],
  public_metals_calculator: ['Do you have a metals calculator?', 'יש מחשבון מתכות?'],
  public_crypto_calculator: ['Is there a crypto calculator?', 'יש מחשבון קריפטו?'],
  quote_csv: ['Can I export quotes to CSV?', 'אפשר לייצא הצעות ל-csv?'],
  expense_csv: ['Can I export expenses to CSV?', 'אפשר לייצא הוצאות ל-csv?'],
  owner_whatsapp_share: ['Can I share a quote by WhatsApp?', 'אפשר לשלוח הצעה בוואטסאפ?'],
  public_whatsapp_contact: ['Is there a WhatsApp contact option for the customer?', 'יש יצירת קשר בוואטסאפ ללקוח?'],
  public_call: ['Is there a call button on the public quote?', 'יש כפתור התקשרות בהצעה הציבורית?'],
  quote_email: ['Can I email a quote?', 'אפשר לשלוח הצעה במייל?'],
  quote_pdf: ['Can I download a quote as PDF?', 'אפשר להוריד הצעה כ-pdf?'],
  quote_print: ['Can I print a quote?', 'אפשר להדפיס הצעה?'],
  attachments: ['Can I attach files to a quote?', 'אפשר לצרף קבצים להצעה?'],
  measured_quote: ['Can I make a measured quote?', 'אפשר לעשות הצעה מדודה?'],
  professional_reuse: ['Can I reuse professional items?', 'אפשר שימוש חוזר בפריטים מקצועיים?'],
  expenses: ['Can I manage expenses?', 'אפשר לנהל הוצאות?'],
  finance_views: ['Is there a finance dashboard?', 'יש דוח כספי?'],
  catalog: ['Is there a services catalog?', 'יש קטלוג שירותים?'],
  clients: ['Can I manage clients?', 'אפשר לנהל לקוחות?'],
  quote_duplicate: ['Can I duplicate a quote?', 'אפשר לשכפל הצעה?'],
  quote_edit: ['Can I edit a saved quote?', 'אפשר לערוך הצעה שמורה?'],
  quote_create: ['How many quotes can I create?', 'כמה הצעות אפשר ליצור?'],
  smart_quote: ['What is Smart Quote?', 'מה זה הצעה חכמה?'],
  quote_status: ['Can I set the quote status?', 'אפשר לקבוע סטטוס הצעה?'],
  quote_history: ['Is there a quote history screen?', 'יש מסך היסטוריית הצעות?'],
  quote_expiry: ['What happens when a quote is expired?', 'מה קורה כשהצעה פגת תוקף?'],
  public_quote_sign: ['Can a customer sign a quote?', 'הלקוח יכול לחתום על הצעה?'],
  public_quote_view: ['Can the client view the public quote?', 'הלקוח יכול לצפות בהצעה ציבורית?'],
  draft_recovery: ['I have an unsaved draft, can it be recovered?', 'יש לי טיוטה לא שמורה, אפשר לשחזר?'],
  accessibility_tools: ['Is there an accessibility menu?', 'יש תפריט נגישות?'],
  business_settings: ['Where are the business settings?', 'איפה הגדרות עסק?'],
  profile_prerequisites: ['Is a business phone required?', 'טלפון עסקי חובה?'],
  plan_trial: ['Is there a free trial?', 'יש ניסיון חינם?'],
  admin_console: ['Is there an admin console?', 'יש מסך ניהול?'],
  dashboard_overview: ['What is on the dashboard?', 'מה יש בלוח הבקרה?'],
  ai_chat: ['What can the AI chat assistant do?', 'מה ה-ai יכול לעשות?'],
};

describe('classifyCapabilityIntent — direct questions (§52 answer matrix)', () => {
  for (const [id, [en, he]] of Object.entries(DIRECT_QUESTIONS)) {
    it(`classifies EN direct question as "${id}": ${en}`, () => {
      expect(classifyCapabilityIntent(en)).toBe(id);
    });
    it(`classifies HE direct question as "${id}": ${he}`, () => {
      expect(classifyCapabilityIntent(he)).toBe(id);
    });
  }

  it('returns null for empty/whitespace input', () => {
    expect(classifyCapabilityIntent('')).toBeNull();
    expect(classifyCapabilityIntent('   ')).toBeNull();
    expect(classifyCapabilityIntent(undefined)).toBeNull();
  });

  it('does not hijack unrelated conversation (negatives)', () => {
    for (const p of ['Hello, how are you?', 'שלום, מה שלומך?', 'What is the weather today?', 'תודה רבה']) {
      expect(classifyCapabilityIntent(p)).toBeNull();
    }
  });

  it('paraphrase: "does the editor have a built in calculator" still classifies as editor_calculator', () => {
    expect(classifyCapabilityIntent('Does the editor have a calculator?')).toBe('editor_calculator');
  });

  it('the two WhatsApp capabilities never collide with each other', () => {
    expect(classifyCapabilityIntent('Can I share a quote by WhatsApp?')).toBe('owner_whatsapp_share');
    expect(classifyCapabilityIntent('Is there a WhatsApp contact option for the customer?')).toBe('public_whatsapp_contact');
  });

  it('"can the AI edit my quote" classifies as ai_mutation, never as quote_edit (specific-first ordering)', () => {
    expect(classifyCapabilityIntent('Can the AI edit my quote for me?')).toBe('ai_mutation');
    expect(classifyCapabilityIntent('Can I edit a saved quote?')).toBe('quote_edit');
  });

  it('regression (found via live 5186 browser verification): the Hebrew infinitive form "לערוך" also classifies as ai_mutation, not just the participle "עורך"', () => {
    expect(classifyCapabilityIntent('האם ה-ai יכול לערוך את ההצעה שלי בעצמו?')).toBe('ai_mutation');
  });
});

describe('formatCapabilityTruthAnswer — AI capability answer contract (§52.8 / task step 8)', () => {
  it('LIVE_CURRENT, no plan gate: answers YES with the exact description (calculator truth)', () => {
    const answer = formatCapabilityTruthAnswer('editor_calculator', FACTS, false);
    expect(answer).toMatch(/^Yes/);
    expect(answer.toLowerCase()).toContain('calculator');
  });

  it('HE LIVE_CURRENT answers with כן', () => {
    const answer = formatCapabilityTruthAnswer('editor_calculator', FACTS, true);
    expect(answer.startsWith('כן')).toBe(true);
  });

  it('plan-gated capability without a known account tier: says it exists, names the minimum plan (never denies existence)', () => {
    const answer = formatCapabilityTruthAnswer('attachments', FACTS, false, null);
    expect(answer).toMatch(/^Yes/);
    expect(answer).toContain('PRO');
    expect(answer).not.toMatch(/does not have|not available/i);
  });

  it('plan-gated capability, account plan too low: explains the restriction, does not deny the capability exists', () => {
    const answer = formatCapabilityTruthAnswer('attachments', FACTS, false, 'free');
    expect(answer).toMatch(/^Yes/);
    expect(answer).toMatch(/PRO/);
    expect(answer).not.toMatch(/TEKANGO does not have/i);
  });

  it('plan-gated capability, account plan sufficient: still a plain yes with the description', () => {
    const answer = formatCapabilityTruthAnswer('attachments', FACTS, false, 'pro');
    expect(answer).toMatch(/^Yes/);
  });

  it('adversarial: a fake accountTier value never flips a real gate the wrong way (unknown tier treated as no-info, still says yes+plan)', () => {
    const answer = formatCapabilityTruthAnswer('professional_reuse', FACTS, false, 'not-a-real-plan');
    expect(answer).toMatch(/^Yes/);
    expect(answer).toContain('PRO');
  });

  it('ROADMAP_POST_LIVE (autonomous_email): says not currently available, never "yes"', () => {
    const answer = formatCapabilityTruthAnswer('autonomous_email', FACTS, false);
    expect(answer).toMatch(/not currently available/i);
    expect(answer).not.toMatch(/^Yes/);
  });

  it('ROADMAP_POST_LIVE (ai_mutation): says not currently available — the AI must never claim it can mutate data itself', () => {
    const answer = formatCapabilityTruthAnswer('ai_mutation', FACTS, false);
    expect(answer).toMatch(/not currently available/i);
  });

  it('UNAVAILABLE (payment_processing): answers plainly No, consistent with paymentTruth.ts', () => {
    const answer = formatCapabilityTruthAnswer('payment_processing', FACTS, false);
    expect(answer).toMatch(/^No/);
  });

  it('UNAVAILABLE (invoicing): answers plainly No, consistent with invoicingTruth.ts', () => {
    const answer = formatCapabilityTruthAnswer('invoicing', FACTS, false);
    expect(answer).toMatch(/^No/);
  });

  it('unknown capability id returns null (never fabricates an answer for a non-existent id)', () => {
    expect(formatCapabilityTruthAnswer('not_a_real_capability', FACTS, false)).toBeNull();
  });

  it('mutating capability answers never claim the AI executed the action', () => {
    for (const id of ['quote_edit', 'quote_duplicate', 'expenses', 'attachments', 'quote_email', 'public_quote_sign']) {
      const answer = formatCapabilityTruthAnswer(id, FACTS, false);
      expect(answer, id).not.toMatch(/\bI (did|have done|edited|deleted|sent|created) it\b/i);
    }
  });
});

describe('capabilityTruthApplies / buildCapabilityTruthBlock', () => {
  it('applies is true for real facts, false for missing/empty facts', () => {
    expect(capabilityTruthApplies(FACTS)).toBe(true);
    expect(capabilityTruthApplies(null)).toBe(false);
    expect(capabilityTruthApplies({ capabilities: [], nonCurrentCapabilities: [] })).toBe(false);
  });

  it('the authoritative prompt block states the never-claim-execution and never-live-rate invariants', () => {
    const block = buildCapabilityTruthBlock(FACTS);
    expect(block).toMatch(/never execute/i);
    expect(block).toMatch(/never.*live.*rate|not.*live.*unless/i);
  });
});
