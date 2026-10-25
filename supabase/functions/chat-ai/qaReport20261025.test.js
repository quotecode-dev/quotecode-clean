// Owner console 2026-10-25 (typed: "מאשר שינוי ב-L-14 ו-L-17: תיקוני העוזר לפי דוח הבדיקה"): the questions of the assistant QA report
// (a tradesperson's first week, HE + EN) replayed against the deterministic routing, the answer filters and the verified steps.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  classifyCapabilityIntent, classifyBroadCapabilityQuestionSignal, isTroubleshootingQuestion, BUILD_QUOTE_REQUEST, HOW_QUESTION,
  formatCapabilityTruthAnswer,
} from './capabilityTruth.ts';
import { classifyPaymentIntent } from './paymentTruth.ts';
import { findSubscriptionClaimViolations, resolveSubscriptionTruthResponse } from './subscriptionTruth.ts';
import { removeInventedOffers } from './noInvention.ts';
import { howToStepsForCapability } from './howToTruth.ts';
import { AI_FACTS } from './aiFacts.generated.ts';
import { buildSystemPrompt } from './validation.ts';

const FACTS = { capabilities: AI_FACTS.capabilities, nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities };
const index = readFileSync('supabase/functions/chat-ai/index.ts', 'utf8');

describe('QA report 2026-10-25: routing', () => {
  it('"how can I ..." questions reach the steps, not the generic "which feature" question (H2, E1)', () => {
    for (const q of ['איך אני יכול להוסיף לקוח חדש?', 'How can I add a client?', 'How can I reset my password?']) {
      expect(classifyBroadCapabilityQuestionSignal(q), q).toBe(false);
      expect(HOW_QUESTION.test(q), q).toBe(true);
    }
    // a bare availability question keeps the guard
    expect(classifyBroadCapabilityQuestionSignal('Can I put recurring quotes on autopilot?')).toBe(true);
  });

  it('the user\'s own past act and "can you explain / help" are not the AI acting (H9-H11)', () => {
    for (const q of ['אפשר לערוך הצעה אחרי ששלחתי אותה?', 'מחקתי הצעה בטעות, אפשר לשחזר?', 'אתה יכול לעזור לי לערוך הצעה?', 'אתה יכול להסביר לי איך לשלוח הצעה?']) {
      expect(classifyCapabilityIntent(q), q).not.toBe('ai_mutation');
    }
    for (const q of ['ערכת לי את ההצעה?', 'אתה יכול לערוך את ההצעה שלי?', 'Can you edit my quote?', 'You already edited it for me']) {
      expect(classifyCapabilityIntent(q), q).toBe('ai_mutation');
    }
  });

  it('what TEKANGO costs, installments and "mark as paid" are not the "no payment processing" answer (H20, H22, H26, E7, E8)', () => {
    for (const q of ['האם המערכת בתשלום?', 'כמה צריך לשלם על המערכת?', 'Do I have to pay to use TEKANGO?', 'איך מסמנים הצעה כשולמה?', 'How do I mark a quote as paid?', 'איך מגדירים שהלקוח ישלם בשלושה תשלומים?', 'Can I offer installments in a quote?']) {
      expect(classifyPaymentIntent(q), q).toBe(false);
    }
    for (const q of ['האם אפשר לשלם בכרטיס אשראי?', 'Can my clients pay online?', 'Does TEKANGO accept credit cards?']) {
      expect(classifyPaymentIntent(q), q).toBe(true);
    }
    expect(resolveSubscriptionTruthResponse('האם המערכת בתשלום?', true, null)).not.toBeNull();
    expect(resolveSubscriptionTruthResponse('Do I have to pay to use TEKANGO?', false, null)).not.toBeNull();
    expect(classifyCapabilityIntent('איך מסמנים הצעה כשולמה?')).toBe('quote_status');
    expect(classifyCapabilityIntent('How do I mark a quote as paid?')).toBe('quote_status');
  });

  it('the classifier gaps of the report resolve to their capability (H12, H14, H16, H21, H31, E2, E11)', () => {
    const cases = [
      ['יש לכם קטלוג?', 'catalog'], ['Do you have a catalog?', 'catalog'],
      ['האם יש תבניות?', 'quote_create'], ['Do you have templates?', 'quote_create'], ['איך שומרים הצעה כתבנית?', 'quote_create'],
      ['האם אפשר לתמחר לפי מטר רבוע?', 'measured_quote'], ['Can I measure in square feet?', 'measured_quote'],
      ['איך מגדירים תוקף להצעה?', 'quote_expiry'], ['How do I set the valid until date?', 'quote_expiry'],
      ['איך מייצאים הצעות לאקסל?', 'quote_csv'], ['איך מצרפים קובץ להצעה?', 'attachments'], ['How do I attach a file?', 'attachments'],
    ];
    for (const [q, id] of cases) expect(classifyCapabilityIntent(q), q).toBe(id);
  });

  it('troubleshooting is never "yes - it exists" (H6, H7, H34)', () => {
    for (const q of ['למה המייל לא הגיע ללקוח?', 'הלקוח אומר שלא קיבל את המייל, מה לעשות?', 'למה אני לא מצליח לשלוח בוואטסאפ?', "Why can't I send on WhatsApp?", "My client didn't get the email"]) {
      expect(isTroubleshootingQuestion(q), q).toBe(true);
    }
    expect(classifyCapabilityIntent('למה המייל לא הגיע ללקוח?')).not.toBe('quote_link_view');
    for (const q of ['איך שולחים הצעה בוואטסאפ?', 'How do I send a quote by email?', 'האם הלקוח פתח את ההצעה?']) expect(isTroubleshootingQuestion(q), q).toBe(false);
    for (const q of ['למה המייל לא הגיע ללקוח?', 'למה אני לא מצליח לשלוח בוואטסאפ?', "Why can't I send on WhatsApp?"]) {
      expect(classifyCapabilityIntent(q), q).toBeNull();
      expect(classifyBroadCapabilityQuestionSignal(q), q).toBe(false);
    }
  });

  it('only a build / write request offers the AI smart quote button (E14)', () => {
    expect(BUILD_QUOTE_REQUEST.some((re) => re.test('תכין לי הצעה למטבח'))).toBe(true);
    expect(BUILD_QUOTE_REQUEST.some((re) => re.test('make me a quote for a bathroom'))).toBe(true);
    for (const q of ['אתה יכול לשלוח את ההצעה ללקוח?', 'Can you send the quote to my client?', 'אתה יכול למחוק את ההצעה?']) {
      expect(BUILD_QUOTE_REQUEST.some((re) => re.test(q)), q).toBe(false);
    }
    expect(index).toContain("capabilityId === 'ai_mutation' && BUILD_QUOTE_REQUEST.some((re) => re.test(lastUserMessage)) ? 'open_ai_quote' : null");
  });
});

describe('QA report 2026-10-25: answers', () => {
  it('a "how" question gets the verified steps of the matching task (H1, H13, H21, H24)', () => {
    expect(howToStepsForCapability('business_settings', 'איך מוסיפים לוגו להצעה?', true, AI_FACTS.howTo)).toContain('העלאת קובץ');
    expect(howToStepsForCapability('quote_create', 'איך שומרים הצעה כתבנית?', true, AI_FACTS.howTo)).toContain('שמירה כתבנית (בלי פרטי לקוח)');
    expect(howToStepsForCapability('quote_expiry', 'איך מגדירים תוקף להצעה?', true, AI_FACTS.howTo)).toContain('"בתוקף עד"');
    expect(howToStepsForCapability('quote_pdf', 'How do I download a PDF?', false, AI_FACTS.howTo)).toContain('"Download PDF"');
    expect(howToStepsForCapability('quote_email', 'הלקוח לא קיבל את המייל', true, AI_FACTS.howTo)).toContain('ספאם');
    expect(howToStepsForCapability('public_call', 'how?', false, AI_FACTS.howTo)).toBe('');
    expect(index).toMatch(/const capabilityAnswer = steps \? `\$\{capabilityTruth\.answer\}\\n\\n\$\{steps\}` : capabilityTruth\.answer;/);
  });

  it('the new how-to facts exist for the tasks the report found missing (L-14)', () => {
    const ids = AI_FACTS.howTo.map((e) => e.id);
    for (const id of ['quote_validity', 'quote_discount', 'quote_terms_deposit', 'quote_vat', 'quote_delete', 'share_default_texts', 'business_currency', 'improve_quote', 'email_not_received']) {
      expect(ids, id).toContain(id);
    }
    const en = AI_FACTS.howTo.find((e) => e.id === 'business_currency').en.steps.join(' ');
    expect(en).not.toMatch(/₪|ILS|shekel/i); // market isolation: the English side never names the shekel
  });

  it('SMART PACK prices pass the plan-answer filter; an item "package" in a quote is not a plan (H27, E9)', () => {
    expect(findSubscriptionClaimViolations('חכם פלוס עולה 10.00 ₪ לחודש או 102.00 ₪ לשנה.', true)).not.toContain('UNAPPROVED_PRICE');
    expect(findSubscriptionClaimViolations('SMART PACK is 5.00 USD per month or 51.00 USD per year.', false)).not.toContain('UNAPPROVED_PRICE');
    expect(findSubscriptionClaimViolations('בהצעה יש חבילת התקנה במחיר 1700 ₪.', true)).toEqual([]);
    expect(findSubscriptionClaimViolations('המסלול עולה 99 ₪ לחודש.', true)).toContain('UNAPPROVED_PRICE');
    expect(findSubscriptionClaimViolations('The package costs 99 USD per month.', false)).toContain('UNAPPROVED_PRICE');
  });

  it('the product\'s own attach steps are kept; an offer to send a file to the assistant is removed (E12)', () => {
    const steps = 'בקטע "קבצים מצורפים / שרטוטים" לוחצים על כפתור צירוף הקובץ ובוחרים את הקובץ.';
    expect(removeInventedOffers(steps, { screenshots: true })).toBe(steps);
    expect(removeInventedOffers('Click "Attach File" and choose the file.', { screenshots: true })).toBe('Click "Attach File" and choose the file.');
    expect(removeInventedOffers('שלחו לי את הקובץ ואבדוק אותו.', { screenshots: true })).toBe('');
    expect(removeInventedOffers('You can upload the PDF here in the chat.', { screenshots: true })).toBe('');
  });

  it('the cancellation answer names the request link and the Terms, not an internal check (H28)', () => {
    const he = formatCapabilityTruthAnswer('account_lifecycle_not_self_service', FACTS, true);
    expect(he).toContain('שליחת בקשת ביטול');
    expect(he).toContain('סעיף 6 בתנאי השימוש');
    expect(he).not.toContain('לא נמצא בממשק');
    expect(formatCapabilityTruthAnswer('account_lifecycle_not_self_service', FACTS, false)).not.toMatch(/fresh source check/);
  });

  it('"Improve quote" exists in the prompt facts (H32) and the plan answer offers the plans view (H25)', () => {
    expect(buildSystemPrompt({ isHebrew: true })).toMatch(/"Improve quote" .*EXISTS today/);
    expect(index).toContain("navAllowed.includes('open_plan_information') ? { action: 'open_plan_information', focus: null } : null");
  });
});
