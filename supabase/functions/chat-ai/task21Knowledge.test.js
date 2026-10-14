// Task 21 (Owner report 2026-10-10, PROFLOW_PROJECT_CONTEXT.md §250 / PROFLOW_TODO.md item 82): direct capability questions get a direct,
// truthful deterministic answer from the canonical registry (generated AI_FACTS) - never a false denial of an existing screen and never a
// generic clarification. Internal Calendar vs a Google Calendar connection (future, not connected) are distinguished; the digital
// business card (roadmap Phase 5, not implemented) is answered "not available" without a date or promise.
// NOTE: this proves the LOCAL source and generated facts only - it is not proof of the chat-ai version served on TEST/LIVE.
import { describe, it, expect } from 'vitest';
import { classifyCapabilityIntent, classifyBroadCapabilityQuestionSignal, resolveCapabilityTruthResponse } from './capabilityTruth.ts';
import { AI_FACTS } from './aiFacts.generated.ts';
import { checkSemanticClaim, FORBIDDEN_CLAIM_FAMILIES } from '../../../src/data/forbiddenClaimSemantics.js';

const FACTS = { capabilities: AI_FACTS.capabilities, nonCurrentCapabilities: AI_FACTS.nonCurrentCapabilities };
const ask = (q, isHebrew, market = isHebrew ? 'IL' : 'INTERNATIONAL') => {
  const id = classifyCapabilityIntent(q);
  const r = id ? resolveCapabilityTruthResponse(id, FACTS, isHebrew, null, false, market) : null;
  return { id, answer: r?.answer ?? null, payload: r?.factPayload ?? null };
};

const CASES = [
  // [question, isHebrew, expected id, must contain (all), must NOT contain (any substring)]
  // Statistics - exists: what it shows + where to open it
  ['יש לכם סטטיסטיקה?', true, 'quote_statistics', ['כן', 'סטטיסטיקה', 'נשלחו', 'אושרו', 'שיעור ההמרה', 'הצעות חמות', '„סטטיסטיקה”', '„עוד”'], ['אין']],
  ['מה רואים בסטטיסטיקה?', true, 'quote_statistics', ['כן', 'כמה הצעות נוצרו', 'לכל מטבע בנפרד', '„סטטיסטיקה”'], ['אין']],
  ['Do you have statistics?', false, 'quote_statistics', ['Yes', 'created, sent, approved and paid', 'conversion rate', '“Statistics”', '“More”'], ['no detailed']],
  ['What does the Statistics screen show?', false, 'quote_statistics', ['Yes', 'hot-quote list', 'per currency', '“Statistics”'], []],
  // Internal calendar - exists: purpose + where; never claims an external sync
  ['יש לכם יומן?', true, 'calendar', ['כן', 'יומן', 'יומן פנימי', 'לתכנון העבודה', '„יומן”', 'אינו מסונכרן ל-Google Calendar'], []],
  ['האם יש יומן ב-TEKANGO?', true, 'calendar', ['כן', 'יומן פנימי', '„יומן”'], []],
  ['Is there a calendar?', false, 'calendar', ['Yes', 'internal calendar', 'planning your work', '“Calendar”', 'not synced with Google Calendar'], []],
  ['Does TEKANGO have a calendar?', false, 'calendar', ['Yes', 'internal calendar', '“Calendar”'], []],
  // External calendar connection - not connected; the internal calendar is named
  ['איפה היומן מחובר?', true, 'google_calendar_sync', ['אינטגרציה עם Google Calendar אינה זמינה כרגע', 'יעד עתידי', 'יומן פנימי', '„יומן”', 'אינו מסונכרן'], ['כן -']],
  ['יש סנכרון לגוגל קלנדר?', true, 'google_calendar_sync', ['אינה זמינה כרגע', 'יומן פנימי'], ['כן -']],
  ['אפשר לחבר את היומן ל-Google Calendar?', true, 'google_calendar_sync', ['אינה זמינה כרגע', 'יומן פנימי'], ['כן -']],
  ['Where is the calendar connected?', false, 'google_calendar_sync', ['Google Calendar integration is not currently available', 'future roadmap item', 'internal calendar', '“Calendar”'], ['Yes -']],
  ['Does TEKANGO sync with Google Calendar?', false, 'google_calendar_sync', ['not currently available', 'internal calendar', 'not synced with Google Calendar'], ['Yes -']],
  // Digital business card - Task 23 (Phase 5) made it a current capability: where it is, what it shows, what it never shows, and that
  // the public page opens only after the server update (its function is local source only) - no date, no promise
  ['האם יש לכם כרטיס ביקור דיגיטלי?', true, 'digital_business_card', ['כן -', 'כרטיס ביקור דיגיטלי', 'הגדרות עסק', 'קוד QR', 'מספר עוסק ופרטים פנימיים לא מוצגים', 'רק אחרי עדכון השרת'], ['בקרוב', 'יעד עתידי']],
  ['יש כרטיס ביקור דיגיטלי?', true, 'digital_business_card', ['כן -', 'קישור לשיתוף', 'רק אחרי עדכון השרת'], []],
  ['Do you have a digital business card?', false, 'digital_business_card', ['Yes -', 'Digital business card', 'Business settings', 'QR code', 'tax ID and internal details are never shown', 'only after the server update'], ['soon', 'roadmap']],
  ['Can I create a business card in TEKANGO?', false, 'digital_business_card', ['Yes -', 'share link'], []],
];

describe('Task 21 - direct capability questions are answered from the canonical registry (HE/EN)', () => {
  it.each(CASES)('%s', (q, isHebrew, expectedId, mustHave, mustNot) => {
    const r = ask(q, isHebrew);
    expect(r.id).toBe(expectedId);
    expect(r.answer).toBeTruthy();
    for (const s of mustHave) expect(r.answer).toContain(s);
    for (const s of mustNot) expect(r.answer.includes(s)).toBe(false);
  });

  it('existing screens (incl. the Task 23 business card) are AVAILABLE; Google Calendar is NOT_AVAILABLE', () => {
    expect(ask('יש לכם סטטיסטיקה?', true).payload.truthStatus).toBe('AVAILABLE');
    expect(ask('Is there a calendar?', false).payload.truthStatus).toBe('AVAILABLE');
    expect(ask('איפה היומן מחובר?', true).payload.truthStatus).toBe('NOT_AVAILABLE');
    expect(ask('Do you have a digital business card?', false).payload.truthStatus).toBe('AVAILABLE');
  });

  it('a clear question resolves to ONE capability, so the generic clarification path is never reached', () => {
    for (const [q] of CASES) {
      expect(classifyCapabilityIntent(q)).not.toBeNull();
    }
    // the broad signal alone would have produced the generic clarification the Owner saw
    expect(classifyBroadCapabilityQuestionSignal('האם יש לכם כרטיס ביקור דיגיטלי?')).toBeTruthy();
  });

  it('the generated facts carry the new entries from the registry (generator output, not hand-written)', () => {
    const g = AI_FACTS.nonCurrentCapabilities.find((c) => c.id === 'google_calendar_sync');
    const b = AI_FACTS.capabilities.find((c) => c.id === 'digital_business_card');
    expect(g.state).toBe('ROADMAP_POST_LIVE');
    expect(g.heAnswerNote).toContain('יומן פנימי');
    expect(b.state).toBe('LIVE_CURRENT');
    expect(AI_FACTS.nonCurrentCapabilities.some((c) => c.id === 'digital_business_card')).toBe(false);
  });

  it('forbidden-claim family catches an active Google Calendar sync, not its negation', () => {
    const claims = (family, text, he) => FORBIDDEN_CLAIM_FAMILIES[family][he ? 'he' : 'en'].some((re) => checkSemanticClaim(text, re, he).claimed);
    expect(claims('externalCalendarSync', 'היומן מסונכרן ל-Google Calendar שלך.', true)).toBe(true);
    expect(claims('externalCalendarSync', 'TEKANGO syncs with Google Calendar automatically.', false)).toBe(true);
    expect(claims('externalCalendarSync', 'היומן אינו מסונכרן ל-Google Calendar.', true)).toBe(false);
    expect(claims('externalCalendarSync', 'It is not synced with Google Calendar.', false)).toBe(false);
  });
});
