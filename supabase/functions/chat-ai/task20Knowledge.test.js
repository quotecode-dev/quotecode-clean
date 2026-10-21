// Task 20 (Owner addendum 2026-10-09): the ONE assistant answers the Phase 4 / Tasks 17-19 product questions from the canonical
// registry (src/data/productTruthRegistry.js -> generated AI_FACTS), in HE and EN, and never promises what is not active:
// automatic customer messages (implemented, not released) and automatic WhatsApp (future phase) answer "not available";
// an email open / green dot is never presented as proof that the customer viewed the quote.
import { describe, it, expect } from 'vitest';
import { classifyCapabilityIntent, resolveCapabilityTruthResponse } from './capabilityTruth.ts';
import { AI_FACTS } from './aiFacts.generated.ts';
import { checkSemanticClaim, FORBIDDEN_CLAIM_FAMILIES } from '../../../src/data/forbiddenClaimSemantics.js';

const FACTS = { capabilities: AI_FACTS.capabilities, nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities };
const ask = (q, isHebrew, market = isHebrew ? 'IL' : 'INTERNATIONAL') => {
  const id = classifyCapabilityIntent(q);
  const r = id ? resolveCapabilityTruthResponse(id, FACTS, isHebrew, null, false, market) : null;
  return { id, answer: r?.answer ?? null, payload: r?.factPayload ?? null };
};

const CASES = [
  // [question, isHebrew, expected id, must contain (all), must NOT contain (any)]
  ['יש לכם יומן עם חגים ושבתות?', true, 'calendar', ['כן', 'יומן', 'חגים', 'שבתות'], []],
  ['Does TEKANGO have a calendar with holidays?', false, 'calendar', ['Yes', 'calendar', 'holidays', 'Sunday'], []],
  ['איך יוצרים משימה?', true, 'manual_tasks', ['כן', 'משימה', 'משימת מעקב'], []],
  ['How do I add a task?', false, 'manual_tasks', ['Yes', 'task', 'follow-up task'], []],
  ['איפה רואים סטטיסטיקה והצעות חמות?', true, 'quote_statistics', ['כן', 'שיעור ההמרה', 'לכל מטבע בנפרד'], []],
  ['Where can I see statistics?', false, 'quote_statistics', ['Yes', 'conversion rate', 'per currency'], []],
  ['מה ההבדל בין הצעה שנשלחה להצעה שנצפתה?', true, 'quote_link_view', ['נשלחה', 'צפייה בקישור ההצעה', 'אינדיקציה לפתיחת הקישור', 'הנקודה הירוקה'], []],
  ['Does the green dot mean the customer read my email?', false, 'quote_link_view', ['green dot', 'email provider accepted', 'indicates that the link was opened'], []],
  ['הלקוח ראה את ההצעה שלי?', true, 'quote_link_view', ['צפייה בקישור ההצעה', 'אינדיקציה לפתיחת הקישור בלבד'], []],
  ['Did the customer see my quote?', false, 'quote_link_view', ['Quote link viewed', 'indicates that the link was opened', 'can also count'], []],
  ['Was my quote link viewed?', false, 'quote_link_view', ['Quote link viewed'], []],
  ['איך מגדירים תזכורות?', true, 'reminders_automation', ['הגדרות עסק', 'בממשק בלבד', 'כבוי', 'מלא', 'תיבות סימון', 'ימים', 'תוכן', 'שעות שליחה', 'אזור זמן', 'ידנית'], []],
  ['What is Full mode in reminders?', false, 'reminders_automation', ['Business settings', 'In-app only', 'Off', 'Full, including customer sending', 'explicit', 'tick', 'sending hours', 'time zone', 'manually'], []],
  ['האם TEKANGO שולח ללקוחות מיילים אוטומטית?', true, 'automatic_customer_messages', ['אינה זמינה כרגע'], ['כן -']],
  ['Does TEKANGO email my customers automatically?', false, 'automatic_customer_messages', ['not currently available'], ['Yes -']],
  ['WhatsApp נשלח אוטומטית?', true, 'automatic_whatsapp', ['אינה זמינה כרגע', 'יעד עתידי'], ['כן -']],
  ['Does TEKANGO send WhatsApp automatically?', false, 'automatic_whatsapp', ['not currently available', 'future roadmap'], ['Yes -']],
];

describe('Task 20 - representative HE/EN product questions answer from the canonical registry', () => {
  it.each(CASES)('%s', (q, isHebrew, expectedId, mustHave, mustNot) => {
    const r = ask(q, isHebrew);
    expect(r.id).toBe(expectedId);
    expect(r.answer).toBeTruthy();
    for (const s of mustHave) expect(r.answer).toContain(s);
    for (const s of mustNot) expect(r.answer.startsWith(s)).toBe(false);
  });

  it('inactive sending capabilities are structured as NOT_AVAILABLE, never AVAILABLE', () => {
    for (const [q, he] of [['Does TEKANGO email my customers automatically?', false], ['WhatsApp נשלח אוטומטית?', true]]) {
      expect(ask(q, he).payload.truthStatus).toBe('NOT_AVAILABLE');
    }
    expect(ask('איך מגדירים תזכורות?', true).payload.truthStatus).not.toBe('NOT_AVAILABLE');
  });

  it('the forbidden-claim family catches a promise of automatic sending', () => {
    const claims = (text, he) => FORBIDDEN_CLAIM_FAMILIES.automaticSending[he ? 'he' : 'en'].some((re) => checkSemanticClaim(text, re, he).claimed);
    expect(claims('WhatsApp נשלח אוטומטית ללקוח אחרי שבוע.', true)).toBe(true);
    expect(claims('TEKANGO automatically emails your customers when they open a quote.', false)).toBe(true);
    expect(claims('WhatsApp לא נשלח אוטומטית - רק ידנית.', true)).toBe(false);
    expect(claims('Automatic customer emails are not active yet.', false)).toBe(false);
  });

  it('a link view is never presented as certain customer identification', () => {
    for (const [q, he] of [['Did the customer see my quote?', false], ['הלקוח ראה את ההצעה שלי?', true], ['Does the green dot mean the customer read my email?', false]]) {
      const a = ask(q, he).answer;
      expect(a).not.toMatch(/the customer (viewed|saw|read|opened)|הלקוח (צפה|ראה|קרא|פתח)/);
    }
  });

  it('answers are global product facts: no account, customer, quote or task data of any tenant appears in them', () => {
    for (const [q, he] of CASES.map((c) => [c[0], c[1]])) {
      const a = ask(q, he).answer;
      expect(a).not.toMatch(/@|A\d{4,}|synthetic|דנה/);
    }
  });

  it('every answer is in the account language (HE answers Hebrew, EN answers English)', () => {
    for (const [q, he] of CASES.map((c) => [c[0], c[1]])) {
      const a = ask(q, he).answer;
      expect(/[֐-׿]/.test(a)).toBe(he);
    }
  });
});
